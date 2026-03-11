/**
 * Consent TwiML Generators (PX-735)
 * Generates TwiML for consent prompts and handling
 */

import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

// Consent prompt scripts
const CONSENT_PROMPTS = {
  en: {
    initial:
      "This call may be recorded and transcribed to better serve you.",
    instructions:
      "Press 1, or stay on the line, to accept. Press 2 to opt out of recording. Press 9 to hear this message in Spanish.",
    accepted: "Thank you. Your call is being connected.",
    optedOut:
      "Understood. Your call will not be recorded. Please hold while we connect you.",
    timeout: "We did not receive your response. The call will proceed with recording.",
    error: "An error occurred. Please try again.",
  },
  es: {
    initial:
      "Esta llamada puede ser grabada y transcrita para servirle mejor.",
    instructions:
      "Presione 1, o permanezca en la línea, para aceptar. Presione 2 para optar por no grabar.",
    accepted: "Gracias. Su llamada está siendo conectada.",
    optedOut:
      "Entendido. Su llamada no será grabada. Por favor espere mientras lo conectamos.",
    timeout: "No recibimos su respuesta. La llamada continuará con grabación.",
    error: "Ocurrió un error. Por favor intente de nuevo.",
  },
};

// Twilio Polly voices (cast as any to allow neural voices)
const VOICES: Record<string, any> = {
  en: "Polly.Joanna",
  es: "Polly.Lupe",
};

interface ConsentTwiMLOptions {
  callId: string;
  clientId: string;
  language?: "en" | "es";
  baseUrl: string;
}

/**
 * Generate TwiML for the initial consent prompt
 */
export function generateConsentPromptTwiML(options: ConsentTwiMLOptions): string {
  const { callId, clientId, language = "en", baseUrl } = options;
  const prompts = CONSENT_PROMPTS[language];
  const voice = VOICES[language];

  const response = new VoiceResponse();

  // Say the initial consent message
  response.say({ voice }, prompts.initial);

  // Gather DTMF input with timeout
  const gather = response.gather({
    numDigits: 1,
    timeout: 10, // 10 seconds timeout
    action: `${baseUrl}/api/webhooks/twilio/consent?callId=${callId}&clientId=${clientId}&lang=${language}`,
    method: "POST",
  });

  // Say instructions within gather
  gather.say({ voice }, prompts.instructions);

  // If no input received, redirect back to consent handler with timeout flag
  response.redirect(
    `${baseUrl}/api/webhooks/twilio/consent?callId=${callId}&clientId=${clientId}&lang=${language}&timeout=true`
  );

  return response.toString();
}

/**
 * Generate TwiML after consent is granted (press 1 or timeout)
 */
export function generateConsentAcceptedTwiML(
  options: ConsentTwiMLOptions & {
    phoneNumber: string;
    callerNumber: string;
  }
): string {
  const { callId, language = "en", baseUrl, phoneNumber, callerNumber } = options;
  const prompts = CONSENT_PROMPTS[language];
  const voice = VOICES[language];

  const response = new VoiceResponse();

  // Confirm acceptance
  response.say({ voice }, prompts.accepted);

  // Dial with recording enabled
  const dial = response.dial({
    callerId: callerNumber,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${baseUrl}/api/webhooks/twilio/recording?callId=${callId}`,
    recordingStatusCallbackMethod: "POST",
    action: `${baseUrl}/api/webhooks/twilio/dial-status?callId=${callId}`,
  });

  dial.number(
    {
      statusCallback: `${baseUrl}/api/webhooks/twilio/status?callId=${callId}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    },
    phoneNumber
  );

  return response.toString();
}

/**
 * Generate TwiML after consent is declined (press 2)
 */
export function generateConsentOptedOutTwiML(
  options: ConsentTwiMLOptions & {
    phoneNumber: string;
    callerNumber: string;
  }
): string {
  const { callId, language = "en", baseUrl, phoneNumber, callerNumber } = options;
  const prompts = CONSENT_PROMPTS[language];
  const voice = VOICES[language];

  const response = new VoiceResponse();

  // Confirm opt-out
  response.say({ voice }, prompts.optedOut);

  // Dial WITHOUT recording
  const dial = response.dial({
    callerId: callerNumber,
    // No record attribute = no recording
    action: `${baseUrl}/api/webhooks/twilio/dial-status?callId=${callId}&unrecorded=true`,
  });

  dial.number(
    {
      statusCallback: `${baseUrl}/api/webhooks/twilio/status?callId=${callId}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    },
    phoneNumber
  );

  return response.toString();
}

/**
 * Generate TwiML for Spanish language prompt
 */
export function generateSpanishPromptTwiML(options: ConsentTwiMLOptions): string {
  return generateConsentPromptTwiML({ ...options, language: "es" });
}

/**
 * Generate TwiML after timeout (silence = consent per spec)
 */
export function generateTimeoutConsentTwiML(
  options: ConsentTwiMLOptions & {
    phoneNumber: string;
    callerNumber: string;
  }
): string {
  const { language = "en" } = options;
  const prompts = CONSENT_PROMPTS[language];
  const voice = VOICES[language];

  const response = new VoiceResponse();

  // Inform about timeout handling
  response.say({ voice }, prompts.timeout);

  // Then proceed as if accepted (silence = consent)
  // Generate the rest same as accepted
  return generateConsentAcceptedTwiML(options);
}

/**
 * Generate error TwiML
 */
export function generateConsentErrorTwiML(language: "en" | "es" = "en"): string {
  const prompts = CONSENT_PROMPTS[language];
  const voice = VOICES[language];

  const response = new VoiceResponse();
  response.say({ voice }, prompts.error);
  response.hangup();

  return response.toString();
}
