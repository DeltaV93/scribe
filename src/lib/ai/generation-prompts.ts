// Prompts for AI-powered form generation

import type { GenerateFormRequest } from "./generation-types";

/**
 * System prompt that instructs Claude on how to generate form fields
 * Optimized for token efficiency while maintaining output quality
 */
export const FORM_GENERATION_SYSTEM_PROMPT = `You are an expert form designer for nonprofit case management. Design forms for client services, compliance, and outcome measurement.

## Field Types
TEXT_SHORT (names, short answers), TEXT_LONG (descriptions), NUMBER (age, income), DATE (DOB, service dates), PHONE, EMAIL, ADDRESS (US), DROPDOWN (single select), CHECKBOX (multi-select), YES_NO (boolean), FILE (uploads), SIGNATURE

## Field Purposes
GRANT_REQUIREMENT (funder required), INTERNAL_OPS (case management), COMPLIANCE (HIPAA/HUD), OUTCOME_MEASUREMENT (impact tracking), RISK_ASSESSMENT (risk factors), OTHER (include purposeNote)

## Guidelines
- isRequired: Only for essential fields (name, contact, consent)
- isSensitive: SSN, health info, financial details, immigration, criminal history, mental health
- isAiExtractable: true if can be mentioned in conversation; false for signatures, uploads, physical observation
- Sections: "Personal Information", "Demographics", "Housing Status", "Income & Employment", "Health & Wellness", "Services Needed", "Consent & Signatures"
- HUD forms: Include prior living situation, length of stay, homelessness history, disabling conditions, veteran status, DV status
- Dropdowns: Provide comprehensive options, include "Other"/"Prefer not to say"

## Response Format
Return ONLY valid JSON (no markdown):
{"fields":[{"name":"Full Name","slug":"full_name","type":"TEXT_SHORT","purpose":"INTERNAL_OPS","purposeNote":null,"helpText":"Legal name","isRequired":true,"isSensitive":false,"isAiExtractable":true,"options":null,"section":"Personal Information","order":0,"reasoning":"Required for identification"}],"extractionSuggestions":[{"fieldSlug":"full_name","extractionHint":"'My name is...'","expectedFormat":"First Last","exampleValues":["John Smith"]}],"reasoning":"Brief design explanation"}`;

/**
 * Build the user prompt from form requirements
 */
export function buildGenerationPrompt(request: GenerateFormRequest): string {
  const formTypeDescriptions: Record<string, string> = {
    INTAKE: "An intake form for new clients entering services. Captures comprehensive information needed to begin serving them.",
    FOLLOWUP: "A follow-up form to track client progress and update their status after initial intake.",
    REFERRAL: "A referral form to document services being recommended or connected for the client.",
    ASSESSMENT: "An assessment form to evaluate client needs, risks, or eligibility for specific programs.",
    CUSTOM: "A custom form designed for a specific organizational need.",
  };

  let prompt = `Form: ${request.formName} (${request.formType} - ${formTypeDescriptions[request.formType] || "Custom"})
Purpose: ${request.description}
Data points: ${request.dataPoints}`;

  if (request.complianceRequirements) {
    prompt += `\nCompliance: ${request.complianceRequirements}`;
  }

  prompt += `

Generate fields grouped into sections. Include dropdown options. Mark sensitive fields. Set isAiExtractable=true for fields naturally mentioned in phone conversations. Keep field reasoning brief (1 sentence). Keep extractionHint brief.`;

  return prompt;
}

/**
 * Generate example prompts for different form types (for testing/documentation)
 */
export const EXAMPLE_REQUESTS: Record<string, GenerateFormRequest> = {
  homelessIntake: {
    formName: "Homeless Services Intake",
    formType: "INTAKE",
    description: "Capture all information needed when a new client enters our homeless services program. We need to understand their current situation, history of homelessness, immediate needs, and eligibility for various programs. The outcome is to have a complete picture of the client to provide appropriate services and housing placement.",
    dataPoints: "Full name, date of birth, SSN (optional), contact info, emergency contact, current living situation, how long homeless, prior living situation, veteran status, disability status, income sources, health conditions, substances issues, domestic violence history, family composition, immediate needs (food, shelter, medical), goals",
    complianceRequirements: "HUD CoC Program compliance required. Must capture all Universal Data Elements. Need to track chronic homelessness status for reporting.",
  },
  mentalHealthAssessment: {
    formName: "Mental Health Screening",
    formType: "ASSESSMENT",
    description: "Screen clients for mental health needs and determine appropriate level of care. Used by case managers during intake to identify clients who need mental health referrals.",
    dataPoints: "Current mood, sleep patterns, anxiety levels, depression indicators, substance use, medication compliance, crisis history, support system, treatment history",
    complianceRequirements: "HIPAA compliant. Results will be shared with clinical team.",
  },
  housingReferral: {
    formName: "Housing Referral",
    formType: "REFERRAL",
    description: "Document when referring a client to a housing partner organization. Capture information the housing provider needs to process the referral.",
    dataPoints: "Client name, contact, housing needs, household size, income, barriers to housing, criminal background check consent, preferred locations, accessibility needs",
  },
};
