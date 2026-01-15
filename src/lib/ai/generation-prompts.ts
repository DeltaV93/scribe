// Prompts for AI-powered form generation

import type { GenerateFormRequest } from "./generation-types";

/**
 * System prompt that instructs Claude on how to generate form fields
 */
export const FORM_GENERATION_SYSTEM_PROMPT = `You are an expert form designer for nonprofit case management organizations. Your task is to design comprehensive forms that collect the right data for client services, grant compliance, and outcome measurement.

## Available Field Types

| Type | Description | AI Extraction Confidence |
|------|-------------|-------------------------|
| TEXT_SHORT | Single line text (names, short answers) | 80% - Good for specific values |
| TEXT_LONG | Multi-line text (descriptions, notes) | 75% - Good but may need review |
| NUMBER | Numeric values (age, income, counts) | 85% - High accuracy |
| DATE | Date values (DOB, service dates) | 90% - Very high accuracy |
| PHONE | Phone numbers with formatting | 85% - High accuracy |
| EMAIL | Email addresses with validation | 85% - High accuracy |
| ADDRESS | Full street addresses (US only) | 70% - Complex, may need review |
| DROPDOWN | Single selection from options | 75% - Good when options are clear |
| CHECKBOX | Multiple selections from options | 70% - Moderate, context-dependent |
| YES_NO | Boolean yes/no questions | 80% - Good for clear questions |
| FILE | Document/image uploads | 20% - Cannot extract from audio |
| SIGNATURE | Digital signature capture | 0% - Cannot extract from audio |

## Field Purposes (for compliance tracking)

| Purpose | When to Use |
|---------|-------------|
| GRANT_REQUIREMENT | Field is required by a funder/grant |
| INTERNAL_OPS | Needed for day-to-day case management |
| COMPLIANCE | Required by law or regulation (HIPAA, HUD, etc.) |
| OUTCOME_MEASUREMENT | Tracks program effectiveness/impact |
| RISK_ASSESSMENT | Identifies client risk factors |
| OTHER | Custom reason (always include purposeNote) |

## Design Guidelines

1. **Required Fields**: Only mark fields as required if they are truly necessary. Name, contact info, and consent are typically required.

2. **Sensitive Fields**: Mark fields as sensitive (isSensitive: true) for:
   - SSN, government IDs
   - Health information
   - Financial details (income, debts)
   - Immigration status
   - Criminal history
   - Mental health information

3. **AI Extractable**: Set isAiExtractable to true for fields that can be naturally mentioned in a conversation. Set to false for:
   - Signature fields
   - File uploads
   - Fields requiring physical observation
   - System-generated fields

4. **Sections**: Group related fields into logical sections:
   - "Personal Information" - Name, DOB, contact
   - "Demographics" - Race, ethnicity, language
   - "Housing Status" - Current situation, prior living
   - "Income & Employment" - Work status, income sources
   - "Health & Wellness" - Medical, mental health, disabilities
   - "Services Needed" - Goals, referrals, assistance types
   - "Consent & Signatures" - Permissions, signatures

5. **Dropdown Options**: For dropdowns and checkboxes, provide comprehensive options based on the form type. Include "Other" or "Prefer not to say" when appropriate.

6. **HUD Compliance**: For homeless services forms, include HUD-required fields:
   - Prior living situation (with HUD categories)
   - Length of stay in prior situation
   - Homelessness history
   - Disabling conditions
   - Veteran status
   - Domestic violence status

7. **Field Naming**: Use clear, client-friendly field names. Slugs should be snake_case.

## Response Format

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "fields": [
    {
      "name": "Full Name",
      "slug": "full_name",
      "type": "TEXT_SHORT",
      "purpose": "INTERNAL_OPS",
      "purposeNote": null,
      "helpText": "Client's full legal name",
      "isRequired": true,
      "isSensitive": false,
      "isAiExtractable": true,
      "options": null,
      "section": "Personal Information",
      "order": 0,
      "reasoning": "Essential for client identification and all service records"
    }
  ],
  "extractionSuggestions": [
    {
      "fieldSlug": "full_name",
      "extractionHint": "Listen for 'My name is...', 'I'm...' or when case manager asks for name",
      "expectedFormat": "First Last or First Middle Last",
      "exampleValues": ["John Smith", "Maria Garcia Lopez"]
    }
  ],
  "reasoning": "Overall explanation of the form design and key decisions"
}`;

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

  let prompt = `## Form Requirements

**Form Name:** ${request.formName}
**Form Type:** ${request.formType} - ${formTypeDescriptions[request.formType] || "Custom form"}

**Purpose/Outcome:**
${request.description}

**Key Data Points to Collect:**
${request.dataPoints}
`;

  if (request.complianceRequirements) {
    prompt += `
**Compliance/Grant Requirements:**
${request.complianceRequirements}
`;
  }

  prompt += `
## Instructions

Based on the above requirements:
1. Design a comprehensive set of form fields
2. Group fields into logical sections
3. Include appropriate options for dropdown/checkbox fields
4. Mark sensitive fields appropriately
5. Set AI extractable status based on whether the field can be mentioned naturally in conversation
6. Provide extraction suggestions for AI-extractable fields
7. Explain your reasoning for key design decisions

Remember: This form will be used to pre-fill data from recorded phone conversations, so design fields that capture information clients would naturally share verbally.`;

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
