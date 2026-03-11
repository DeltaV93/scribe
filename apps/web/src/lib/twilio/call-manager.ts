import { getTwilioClient } from "./client";
import { getUserPhoneNumber } from "./number-provisioning";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

// Custom error for missing phone number
export class NoPhoneNumberAssignedError extends Error {
  constructor() {
    super("NO_PHONE_NUMBER_ASSIGNED");
    this.name = "NoPhoneNumberAssignedError";
  }
}

interface InitiateCallParams {
  userId: string;
  toNumber: string;
  callId: string;
  orgId: string;
}

interface CallResult {
  callSid: string;
  status: string;
  from: string;
  to: string;
}

/**
 * Initiate an outbound call
 * Requires user to have an assigned phone number (admin must assign first)
 */
export async function initiateOutboundCall(
  params: InitiateCallParams
): Promise<CallResult> {
  const { userId, toNumber, callId, orgId } = params;

  // Get user's assigned phone number
  const userNumber = await getUserPhoneNumber(userId);

  // Require phone number to be assigned by admin
  if (!userNumber) {
    throw new NoPhoneNumberAssignedError();
  }

  const client = getTwilioClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create the call
  const call = await client.calls.create({
    to: toNumber,
    from: userNumber.phoneNumber,
    url: `${baseUrl}/api/webhooks/twilio/voice?callId=${callId}`,
    statusCallback: `${baseUrl}/api/webhooks/twilio/status?callId=${callId}`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
    record: true,
    recordingStatusCallback: `${baseUrl}/api/webhooks/twilio/recording?callId=${callId}&orgId=${orgId}`,
    recordingStatusCallbackMethod: "POST",
  });

  return {
    callSid: call.sid,
    status: call.status,
    from: userNumber.phoneNumber,
    to: toNumber,
  };
}

/**
 * Generate TwiML for connecting a browser call to a phone number
 */
export function generateOutboundCallTwiML(
  toNumber: string,
  callerId: string,
  recordingEnabled: boolean = true
): string {
  const response = new VoiceResponse();

  const dial = response.dial({
    callerId,
    record: recordingEnabled ? "record-from-answer-dual" : undefined,
    recordingStatusCallback: recordingEnabled
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/recording`
      : undefined,
  });

  dial.number(toNumber);

  return response.toString();
}

/**
 * Generate TwiML for consent recording
 */
export function generateConsentTwiML(
  consentMessage: string,
  afterConsentUrl: string
): string {
  const response = new VoiceResponse();

  response.say(
    {
      voice: "Polly.Joanna",
    },
    consentMessage
  );

  // Gather consent (press 1 to continue, press 2 to opt out)
  const gather = response.gather({
    numDigits: 1,
    action: afterConsentUrl,
    method: "POST",
  });

  gather.say(
    {
      voice: "Polly.Joanna",
    },
    "Press 1 to continue with recording, or press 2 to opt out."
  );

  // If no input, repeat
  response.redirect(afterConsentUrl + "?timeout=true");

  return response.toString();
}

/**
 * End an active call
 */
export async function endTwilioCall(callSid: string): Promise<void> {
  const client = getTwilioClient();

  await client.calls(callSid).update({
    status: "completed",
  });
}

/**
 * Get call details from Twilio
 */
export async function getCallDetails(callSid: string) {
  const client = getTwilioClient();

  const call = await client.calls(callSid).fetch();

  return {
    sid: call.sid,
    status: call.status,
    duration: call.duration,
    startTime: call.startTime,
    endTime: call.endTime,
    direction: call.direction,
    from: call.from,
    to: call.to,
  };
}

/**
 * Mute/unmute a call participant
 */
export async function setCallMuted(
  conferenceSid: string,
  participantSid: string,
  muted: boolean
): Promise<void> {
  const client = getTwilioClient();

  await client.conferences(conferenceSid).participants(participantSid).update({
    muted,
  });
}

/**
 * Get recording URL for a call
 */
export async function getCallRecordingUrl(
  callSid: string
): Promise<string | null> {
  const client = getTwilioClient();

  const recordings = await client.recordings.list({
    callSid,
    limit: 1,
  });

  if (recordings.length === 0) {
    return null;
  }

  const recording = recordings[0];
  const accountSid = process.env.TWILIO_ACCOUNT_SID;

  // Return the MP3 recording URL
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recording.sid}.mp3`;
}
