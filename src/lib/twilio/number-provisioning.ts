import { getTwilioClient } from "./client";
import { prisma } from "@/lib/db";

interface ProvisionNumberParams {
  userId: string;
  preferredAreaCode?: string;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

/**
 * Search for available phone numbers in an area code
 */
export async function searchAvailableNumbers(
  areaCode: string,
  limit: number = 10
): Promise<AvailableNumber[]> {
  const client = getTwilioClient();

  try {
    const numbers = await client.availablePhoneNumbers("US").local.list({
      areaCode: parseInt(areaCode),
      limit,
      voiceEnabled: true,
      smsEnabled: false,
    });

    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
    }));
  } catch (error) {
    console.error("Error searching for available numbers:", error);
    throw new Error("Failed to search for available numbers");
  }
}

/**
 * Provision a new phone number for a user
 */
export async function provisionNumberForUser(
  params: ProvisionNumberParams
): Promise<{ phoneNumber: string; twilioSid: string }> {
  const { userId, preferredAreaCode = "415" } = params;

  // Check if user already has a number
  const existingNumber = await prisma.twilioNumber.findUnique({
    where: { userId },
  });

  if (existingNumber) {
    return {
      phoneNumber: existingNumber.phoneNumber,
      twilioSid: existingNumber.twilioSid,
    };
  }

  const client = getTwilioClient();

  // Search for an available number
  const availableNumbers = await searchAvailableNumbers(preferredAreaCode, 1);

  if (availableNumbers.length === 0) {
    // Try a fallback area code
    const fallbackNumbers = await searchAvailableNumbers("800", 1);
    if (fallbackNumbers.length === 0) {
      throw new Error("No available phone numbers found");
    }
    availableNumbers.push(fallbackNumbers[0]);
  }

  const numberToPurchase = availableNumbers[0].phoneNumber;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  // Purchase the number
  const purchasedNumber = await client.incomingPhoneNumbers.create({
    phoneNumber: numberToPurchase,
    voiceApplicationSid: twimlAppSid,
    friendlyName: `Scrybe - User ${userId}`,
  });

  // Save to database
  await prisma.twilioNumber.create({
    data: {
      userId,
      phoneNumber: purchasedNumber.phoneNumber,
      twilioSid: purchasedNumber.sid,
      areaCode: preferredAreaCode,
    },
  });

  return {
    phoneNumber: purchasedNumber.phoneNumber,
    twilioSid: purchasedNumber.sid,
  };
}

/**
 * Get a user's provisioned phone number
 */
export async function getUserPhoneNumber(userId: string) {
  const twilioNumber = await prisma.twilioNumber.findUnique({
    where: { userId },
  });

  return twilioNumber;
}

/**
 * Release a user's phone number back to Twilio
 */
export async function releaseUserPhoneNumber(userId: string): Promise<void> {
  const twilioNumber = await prisma.twilioNumber.findUnique({
    where: { userId },
  });

  if (!twilioNumber) {
    return;
  }

  const client = getTwilioClient();

  try {
    // Release the number in Twilio
    await client.incomingPhoneNumbers(twilioNumber.twilioSid).remove();

    // Delete from database
    await prisma.twilioNumber.delete({
      where: { userId },
    });
  } catch (error) {
    console.error("Error releasing phone number:", error);
    throw new Error("Failed to release phone number");
  }
}

/**
 * Update the TwiML application for a phone number
 */
export async function updateNumberApplication(
  twilioSid: string,
  twimlAppSid: string
): Promise<void> {
  const client = getTwilioClient();

  await client.incomingPhoneNumbers(twilioSid).update({
    voiceApplicationSid: twimlAppSid,
  });
}
