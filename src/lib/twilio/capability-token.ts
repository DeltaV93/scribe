import twilio from "twilio";

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

interface GenerateTokenParams {
  identity: string; // User ID or unique identifier
  outgoingAllowed?: boolean;
  incomingAllowed?: boolean;
}

/**
 * Generate a Twilio access token for WebRTC voice calls
 */
export function generateVoiceToken(params: GenerateTokenParams): string {
  const { identity, outgoingAllowed = true, incomingAllowed = false } = params;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    throw new Error("Twilio configuration incomplete");
  }

  // Log config for debugging (only first few chars of secrets)
  console.log(`[VoiceToken] Generating token with:`);
  console.log(`  accountSid: ${accountSid.substring(0, 10)}...`);
  console.log(`  apiKey: ${apiKey.substring(0, 10)}...`);
  console.log(`  apiSecret: ${apiSecret.substring(0, 5)}... (length: ${apiSecret.length})`);
  console.log(`  twimlAppSid: ${twimlAppSid.substring(0, 10)}...`);

  // Create access token
  const accessToken = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600, // 1 hour
  });

  // Create a Voice grant for this token
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: outgoingAllowed ? twimlAppSid : undefined,
    incomingAllow: incomingAllowed,
  });

  accessToken.addGrant(voiceGrant);

  return accessToken.toJwt();
}

/**
 * Generate token response with additional metadata
 */
export function generateTokenResponse(identity: string) {
  const token = generateVoiceToken({ identity });

  return {
    token,
    identity,
    expiresIn: 3600,
  };
}
