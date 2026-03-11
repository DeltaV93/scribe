/**
 * Chatbot Intake Service
 *
 * AI-powered conversational intake that guides potential clients through
 * the intake form process using natural language, with crisis detection
 * and human handoff capabilities.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { prisma } from "@/lib/db";
import { anthropic, FAST_MODEL, logClaudeUsage } from "@/lib/ai/client";
import { moderateContent, type ModerationResult } from "./content-moderation";
import { createClient } from "./clients";
import { createNotification } from "./notifications";
import { Prisma, type ChatSessionStatus, type FormField } from "@prisma/client";
import crypto from "crypto";

// ============================================
// TYPES
// ============================================

export interface ChatSessionInput {
  orgSlug: string;
  formId?: string;
  resumeToken?: string;
}

export interface ChatSession {
  id: string;
  organizationId: string;
  formId: string;
  status: ChatSessionStatus;
  clientPhone: string | null;
  clientEmail: string | null;
  extractedData: Record<string, unknown> | null;
  lastQuestionIndex: number;
  handoffRequested: boolean;
  crisisDetected: boolean;
  resumeToken: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ProcessMessageResult {
  message: ChatMessage;
  nextQuestion: string | null;
  isComplete: boolean;
  crisisDetected: boolean;
  crisisResources?: CrisisResources;
  moderationResult?: ModerationResult;
}

export interface CrisisResources {
  title: string;
  message: string;
  resources: Array<{
    name: string;
    phone?: string;
    url?: string;
    description: string;
  }>;
}

export interface HandoffResult {
  queued: boolean;
  estimatedWait: string | null;
  chatRoomId?: string;
}

export interface CompleteSessionResult {
  clientId: string;
  submissionId?: string;
  message: string;
}

interface FormFieldForChatbot {
  id: string;
  slug: string;
  name: string;
  type: string;
  helpText: string | null;
  isRequired: boolean;
  options: Array<{ value: string; label: string }> | null;
  section: string | null;
  order: number;
}

// ============================================
// CRISIS RESOURCES
// ============================================

const DEFAULT_CRISIS_RESOURCES: CrisisResources = {
  title: "We're Here to Help",
  message: "It sounds like you might be going through a difficult time. Your safety is our priority. Please reach out to one of these resources for immediate support:",
  resources: [
    {
      name: "988 Suicide & Crisis Lifeline",
      phone: "988",
      description: "Free, confidential 24/7 support for people in distress",
    },
    {
      name: "Crisis Text Line",
      phone: "Text HOME to 741741",
      description: "Free, 24/7 crisis support via text message",
    },
    {
      name: "National Domestic Violence Hotline",
      phone: "1-800-799-7233",
      description: "24/7 support for domestic violence survivors",
    },
    {
      name: "SAMHSA National Helpline",
      phone: "1-800-662-4357",
      description: "Treatment referrals and information 24/7",
    },
  ],
};

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new chatbot session
 */
export async function createSession(input: ChatSessionInput): Promise<{
  session: ChatSession;
  welcomeMessage: string;
  firstQuestion: string;
}> {
  // Get organization by slug
  const org = await prisma.organization.findUnique({
    where: { slug: input.orgSlug },
    select: {
      id: true,
      name: true,
      chatbotEnabled: true,
      chatbotFormId: true,
      chatbotAuthRequired: true,
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  if (!org.chatbotEnabled) {
    throw new Error("Chatbot is not enabled for this organization");
  }

  // Determine which form to use
  const formId = input.formId || org.chatbotFormId;
  if (!formId) {
    throw new Error("No form configured for chatbot intake");
  }

  // Verify form exists and is published
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      orgId: org.id,
      status: "PUBLISHED",
    },
    include: {
      fields: {
        where: { isAiExtractable: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!form) {
    throw new Error("Form not found or not published");
  }

  // Check for resume token
  if (input.resumeToken) {
    const existingSession = await prisma.chatSession.findUnique({
      where: { resumeToken: input.resumeToken },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (existingSession && existingSession.status === "ACTIVE") {
      // Resume existing session
      const lastQuestion = getNextQuestion(
        form.fields as unknown as FormFieldForChatbot[],
        existingSession.lastQuestionIndex,
        existingSession.extractedData as Record<string, unknown> | null
      );

      return {
        session: transformSession(existingSession),
        welcomeMessage: "Welcome back! Let's continue where we left off.",
        firstQuestion: lastQuestion || "It looks like we've collected all the information we need. Would you like to submit your intake?",
      };
    }
  }

  // Generate resume token
  const resumeToken = crypto.randomBytes(32).toString("hex");

  // Create new session
  const session = await prisma.chatSession.create({
    data: {
      organizationId: org.id,
      formId: formId,
      status: "ACTIVE",
      resumeToken: resumeToken,
      extractedData: {},
      lastQuestionIndex: 0,
    },
  });

  // Generate welcome message
  const welcomeMessage = generateWelcomeMessage(org.name, form.name);
  const firstQuestion = getNextQuestion(
    form.fields as unknown as FormFieldForChatbot[],
    0,
    {}
  );

  // Store welcome and first question as messages
  await prisma.chatMessage.createMany({
    data: [
      {
        sessionId: session.id,
        role: "assistant",
        content: welcomeMessage,
        metadata: { type: "welcome" },
      },
      {
        sessionId: session.id,
        role: "assistant",
        content: firstQuestion || "Please tell me a bit about yourself.",
        metadata: { type: "question", fieldIndex: 0 },
      },
    ],
  });

  return {
    session: transformSession(session),
    welcomeMessage,
    firstQuestion: firstQuestion || "Please tell me a bit about yourself.",
  };
}

/**
 * Get session by ID
 */
export async function getSession(
  sessionId: string,
  orgId?: string
): Promise<ChatSession | null> {
  const session = await prisma.chatSession.findFirst({
    where: {
      id: sessionId,
      ...(orgId && { organizationId: orgId }),
    },
  });

  return session ? transformSession(session) : null;
}

/**
 * Get session messages
 */
export async function getSessionMessages(
  sessionId: string
): Promise<ChatMessage[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return messages.map(transformMessage);
}

// ============================================
// MESSAGE PROCESSING
// ============================================

/**
 * Process a user message in the chatbot session
 */
export async function processMessage(
  sessionId: string,
  userContent: string
): Promise<ProcessMessageResult> {
  // Get session with form and messages
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      form: {
        include: {
          fields: {
            where: { isAiExtractable: true },
            orderBy: { order: "asc" },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 20, // Last 20 messages for context
      },
      organization: {
        select: {
          id: true,
          chatbotCrisisContact: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "ACTIVE") {
    throw new Error(`Session is ${session.status.toLowerCase()}`);
  }

  // Run content moderation
  const moderationResult = await moderateContent(userContent, {
    checkPHI: true,
    checkProfanity: false, // Allow profanity in intake
    checkThreats: true,
    checkLinks: false,
  });

  // Store user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: userContent,
      metadata: moderationResult.flags.length > 0
        ? { moderation: { flagged: true, severity: moderationResult.severity } } as Prisma.JsonObject
        : Prisma.JsonNull,
    },
  });

  // Check for crisis indicators
  const crisisDetected = detectCrisis(moderationResult);
  if (crisisDetected && !session.crisisDetected) {
    await handleCrisis(session.id, session.organization.chatbotCrisisContact);

    // Create crisis response message
    const crisisMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: DEFAULT_CRISIS_RESOURCES.message,
        metadata: { type: "crisis_response", resources: DEFAULT_CRISIS_RESOURCES.resources },
      },
    });

    return {
      message: transformMessage(crisisMessage),
      nextQuestion: null,
      isComplete: false,
      crisisDetected: true,
      crisisResources: DEFAULT_CRISIS_RESOURCES,
      moderationResult,
    };
  }

  // Process with AI to extract data and generate response
  const fields = session.form.fields as unknown as FormFieldForChatbot[];
  const currentFieldIndex = session.lastQuestionIndex;
  const extractedData = (session.extractedData as Record<string, unknown>) || {};
  const conversationHistory = session.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Add current user message to history
  conversationHistory.push({ role: "user", content: userContent });

  // Extract data from the conversation
  const extractionResult = await extractFromConversation(
    fields,
    currentFieldIndex,
    conversationHistory,
    extractedData
  );

  // Update extracted data
  const updatedData = { ...extractedData, ...extractionResult.extractedFields };

  // Determine next question
  const nextFieldIndex = extractionResult.answeredCurrentField
    ? currentFieldIndex + 1
    : currentFieldIndex;

  const isComplete = nextFieldIndex >= fields.length;
  const nextQuestion = isComplete
    ? null
    : getNextQuestion(fields, nextFieldIndex, updatedData);

  // Generate AI response
  const aiResponse = await generateResponse(
    fields,
    nextFieldIndex,
    conversationHistory,
    updatedData,
    extractionResult.clarificationNeeded,
    isComplete
  );

  // Store AI response
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: aiResponse,
      metadata: {
        type: isComplete ? "completion_prompt" : "question",
        fieldIndex: nextFieldIndex,
        extractedInThisTurn: Object.keys(extractionResult.extractedFields),
      },
    },
  });

  // Update session
  // Build update data
  const updateData: Prisma.ChatSessionUpdateInput = {
    extractedData: updatedData as Prisma.JsonObject,
    lastQuestionIndex: nextFieldIndex,
    dropOffField: isComplete ? null : fields[nextFieldIndex]?.slug,
  };

  // Update contact info if extracted
  if (updatedData.phone) {
    updateData.clientPhone = String(updatedData.phone);
  }
  if (updatedData.email) {
    updateData.clientEmail = String(updatedData.email);
  }

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  return {
    message: transformMessage(assistantMessage),
    nextQuestion,
    isComplete,
    crisisDetected: false,
    moderationResult,
  };
}

// ============================================
// AI EXTRACTION & RESPONSE GENERATION
// ============================================

interface ExtractionResult {
  extractedFields: Record<string, unknown>;
  answeredCurrentField: boolean;
  clarificationNeeded: string | null;
}

/**
 * Extract data from conversation using Claude
 */
async function extractFromConversation(
  fields: FormFieldForChatbot[],
  currentFieldIndex: number,
  conversationHistory: Array<{ role: string; content: string }>,
  existingData: Record<string, unknown>
): Promise<ExtractionResult> {
  const currentField = fields[currentFieldIndex];
  if (!currentField) {
    return { extractedFields: {}, answeredCurrentField: true, clarificationNeeded: null };
  }

  const startTime = Date.now();

  const systemPrompt = `You are an AI assistant helping with intake data extraction.
Your job is to:
1. Determine if the user's latest message contains an answer to the current question
2. Extract structured data from their response
3. Identify if clarification is needed

Current field being asked: "${currentField.name}" (${currentField.type})
${currentField.helpText ? `Description: ${currentField.helpText}` : ""}
${currentField.options ? `Valid options: ${currentField.options.map(o => o.label).join(", ")}` : ""}
Required: ${currentField.isRequired ? "Yes" : "No"}

Already collected data: ${JSON.stringify(existingData)}

Respond with JSON only:
{
  "answeredCurrentField": true/false,
  "extractedValue": <value or null>,
  "clarificationNeeded": <string or null>,
  "additionalFields": { "field_slug": value } // Any other fields mentioned
}`;

  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    logClaudeUsage("chatbot_extraction", FAST_MODEL, response.usage, Date.now() - startTime);

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { extractedFields: {}, answeredCurrentField: false, clarificationNeeded: null };
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { extractedFields: {}, answeredCurrentField: false, clarificationNeeded: null };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const extractedFields: Record<string, unknown> = {};

    if (parsed.answeredCurrentField && parsed.extractedValue !== null) {
      extractedFields[currentField.slug] = parsed.extractedValue;
    }

    if (parsed.additionalFields) {
      Object.assign(extractedFields, parsed.additionalFields);
    }

    return {
      extractedFields,
      answeredCurrentField: parsed.answeredCurrentField,
      clarificationNeeded: parsed.clarificationNeeded,
    };
  } catch (error) {
    console.error("Extraction error:", error);
    return { extractedFields: {}, answeredCurrentField: false, clarificationNeeded: null };
  }
}

/**
 * Generate a conversational response
 */
async function generateResponse(
  fields: FormFieldForChatbot[],
  nextFieldIndex: number,
  conversationHistory: Array<{ role: string; content: string }>,
  extractedData: Record<string, unknown>,
  clarificationNeeded: string | null,
  isComplete: boolean
): Promise<string> {
  const startTime = Date.now();

  let instruction: string;
  if (clarificationNeeded) {
    instruction = `Ask for clarification about: ${clarificationNeeded}. Be polite and helpful.`;
  } else if (isComplete) {
    instruction = `All required information has been collected. Thank the user and ask if they're ready to submit their intake. Briefly summarize what you've collected.`;
  } else {
    const nextField = fields[nextFieldIndex];
    instruction = `Acknowledge what they shared (if applicable), then naturally transition to asking about: "${nextField.name}".
${nextField.helpText ? `Context: ${nextField.helpText}` : ""}
${nextField.options ? `Options to choose from: ${nextField.options.map(o => o.label).join(", ")}` : ""}
${nextField.isRequired ? "This is required information." : "This is optional but helpful."}`;
  }

  const systemPrompt = `You are a friendly, empathetic intake assistant for a social services organization.
Your role is to guide people through the intake process conversationally, making them feel comfortable sharing information.

Guidelines:
- Be warm and supportive, not robotic
- Acknowledge what they share before asking the next question
- Keep responses concise (2-3 sentences max)
- If they seem hesitant, reassure them their information is confidential
- Never be judgmental about their situation

Current instruction: ${instruction}

Data collected so far: ${JSON.stringify(extractedData)}`;

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: conversationHistory.slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    logClaudeUsage("chatbot_response", FAST_MODEL, response.usage, Date.now() - startTime);

    const textContent = response.content.find((c) => c.type === "text");
    return textContent?.type === "text" ? textContent.text : "I'm here to help. Could you tell me more?";
  } catch (error) {
    console.error("Response generation error:", error);
    return clarificationNeeded
      ? `Could you please clarify ${clarificationNeeded}?`
      : isComplete
        ? "Thank you for sharing all that information! Would you like to submit your intake now?"
        : `Could you please share your ${fields[nextFieldIndex]?.name || "information"}?`;
  }
}

// ============================================
// CRISIS DETECTION & HANDLING
// ============================================

/**
 * Detect crisis indicators from moderation result
 */
export function detectCrisis(moderationResult: ModerationResult): boolean {
  return moderationResult.flags.some(
    (flag) => flag.type === "SELF_HARM" || flag.type === "CRISIS_INDICATOR"
  );
}

/**
 * Handle crisis detection
 */
export async function handleCrisis(
  sessionId: string,
  crisisContact: string | null
): Promise<void> {
  // Update session status
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: "ESCALATED",
      crisisDetected: true,
      crisisDetectedAt: new Date(),
    },
  });

  // Get session details for notification
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      organization: {
        include: {
          users: {
            where: {
              role: { in: ["ADMIN", "PROGRAM_MANAGER"] },
              isActive: true,
            },
            take: 5,
          },
        },
      },
    },
  });

  if (!session) return;

  // Notify organization admins
  for (const admin of session.organization.users) {
    await createNotification({
      orgId: session.organizationId,
      userId: admin.id,
      type: "SYSTEM",
      title: "Crisis Alert: Chatbot Intake",
      body: `A potential crisis was detected in a chatbot intake session. Session ID: ${sessionId}`,
      metadata: {
        sessionId,
        crisisContact,
        detectedAt: new Date().toISOString(),
      },
    });
  }

  // TODO: Send SMS/Email alerts to crisisContact when email/SMS services are integrated
  console.log(`[CRISIS ALERT] Session ${sessionId} - Contact: ${crisisContact || "Not configured"}`);
}

// ============================================
// HANDOFF
// ============================================

/**
 * Request human handoff for a chatbot session
 */
export async function requestHandoff(sessionId: string): Promise<HandoffResult> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      organization: {
        include: {
          users: {
            where: {
              role: { in: ["CASE_MANAGER", "PROGRAM_MANAGER", "ADMIN"] },
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Update session
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      handoffRequested: true,
      handoffRequestedAt: new Date(),
    },
  });

  // Store handoff request message
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "system",
      content: "User requested to speak with a person.",
      metadata: { type: "handoff_request" },
    },
  });

  // Notify available case managers
  const availableUsers = session.organization.users;
  for (const user of availableUsers) {
    await createNotification({
      orgId: session.organizationId,
      userId: user.id,
      type: "SYSTEM",
      title: "Chatbot Handoff Request",
      body: `A user in the chatbot intake is requesting to speak with a person.`,
      metadata: {
        sessionId,
        requestedAt: new Date().toISOString(),
        clientPhone: session.clientPhone,
        clientEmail: session.clientEmail,
      },
    });
  }

  // TODO: Create real-time chat room for handoff when chat system is fully integrated

  if (availableUsers.length === 0) {
    return {
      queued: true,
      estimatedWait: "within 24 hours",
    };
  }

  return {
    queued: true,
    estimatedWait: "A few minutes",
  };
}

/**
 * Accept handoff request (for case managers)
 */
export async function acceptHandoff(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; chatRoomId?: string }> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.handoffRequested) {
    throw new Error("No handoff request found");
  }

  // Update session with handoff user
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      handoffUserId: userId,
    },
  });

  // Store handoff accepted message
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "system",
      content: "A case manager has joined the conversation.",
      metadata: { type: "handoff_accepted", userId },
    },
  });

  // TODO: Create and return real-time chat room ID
  return { success: true };
}

// ============================================
// SESSION COMPLETION
// ============================================

/**
 * Complete a chatbot session and create client record
 */
export async function completeSession(
  sessionId: string
): Promise<CompleteSessionResult> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      form: {
        include: {
          fields: true,
        },
      },
      organization: {
        include: {
          users: {
            where: {
              role: { in: ["CASE_MANAGER", "PROGRAM_MANAGER", "ADMIN"] },
              isActive: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.status !== "ACTIVE") {
    throw new Error(`Session is ${session.status.toLowerCase()}`);
  }

  const extractedData = (session.extractedData as Record<string, unknown>) || {};

  // Validate required fields
  const missingRequired = session.form.fields
    .filter((f) => f.isRequired && !extractedData[f.slug])
    .map((f) => f.name);

  if (missingRequired.length > 0) {
    throw new Error(`Missing required fields: ${missingRequired.join(", ")}`);
  }

  // Get first and last name from extracted data
  const firstName = extractedData.first_name || extractedData.firstName || extractedData.name?.toString().split(" ")[0] || "Unknown";
  const lastName = extractedData.last_name || extractedData.lastName || extractedData.name?.toString().split(" ").slice(1).join(" ") || "";
  const phone = session.clientPhone || extractedData.phone?.toString() || "0000000000";
  const email = session.clientEmail || extractedData.email?.toString() || null;

  // Find a case manager to assign to
  const assignTo = session.organization.users[0]?.id;
  if (!assignTo) {
    throw new Error("No case manager available to assign client");
  }

  // Create client record
  const client = await createClient({
    orgId: session.organizationId,
    createdBy: assignTo, // System-created via chatbot
    assignedTo: assignTo,
    firstName: String(firstName),
    lastName: String(lastName),
    phone: String(phone),
    email: email ? String(email) : null,
    status: "PENDING", // Pending review
  });

  // Create form submission with extracted data
  const latestVersion = await prisma.formVersion.findFirst({
    where: { formId: session.formId },
    orderBy: { version: "desc" },
  });

  let submissionId: string | undefined;
  if (latestVersion) {
    const submission = await prisma.formSubmission.create({
      data: {
        orgId: session.organizationId,
        formId: session.formId,
        formVersionId: latestVersion.id,
        clientId: client.id,
        data: extractedData as Prisma.JsonObject,
        aiExtractedData: extractedData as Prisma.JsonObject,
        status: "SUBMITTED",
        isComplete: true,
        isDraft: false,
        submittedAt: new Date(),
      },
    });
    submissionId = submission.id;
  }

  // Update session as completed
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      clientId: client.id,
    },
  });

  // Store completion message
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "system",
      content: "Intake completed successfully. Client record created.",
      metadata: {
        type: "completion",
        clientId: client.id,
        submissionId,
      },
    },
  });

  // Notify assigned case manager
  await createNotification({
    orgId: session.organizationId,
    userId: assignTo,
    type: "SYSTEM",
    title: "New Client from Chatbot Intake",
    body: `${firstName} ${lastName} completed intake via chatbot and has been assigned to you.`,
    actionUrl: `/clients/${client.id}`,
    metadata: {
      clientId: client.id,
      sessionId,
      submissionId,
    },
  });

  return {
    clientId: client.id,
    submissionId,
    message: "Thank you for completing your intake! A case manager will be in touch with you soon.",
  };
}

// ============================================
// WIDGET CONFIGURATION
// ============================================

/**
 * Get widget configuration for an organization
 */
export async function getWidgetConfig(orgSlug: string): Promise<{
  enabled: boolean;
  formId: string | null;
  authRequired: boolean;
  orgName: string;
  primaryColor?: string;
  logoUrl?: string;
} | null> {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      chatbotEnabled: true,
      chatbotFormId: true,
      chatbotAuthRequired: true,
      settings: true,
    },
  });

  if (!org) {
    return null;
  }

  const settings = org.settings as Record<string, unknown> || {};

  return {
    enabled: org.chatbotEnabled,
    formId: org.chatbotFormId,
    authRequired: org.chatbotAuthRequired,
    orgName: org.name,
    primaryColor: settings.primaryColor as string | undefined,
    logoUrl: settings.logoUrl as string | undefined,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateWelcomeMessage(orgName: string, formName: string): string {
  return `Hi there! I'm here to help you complete your ${formName.toLowerCase()} for ${orgName}.

I'll ask you a few questions to gather the information we need. You can take your time, and if you need to step away, you can come back and continue later.

If at any point you'd prefer to speak with a person, just let me know or click the "Talk to a person" button.`;
}

function getNextQuestion(
  fields: FormFieldForChatbot[],
  fieldIndex: number,
  extractedData: Record<string, unknown> | null
): string | null {
  // Skip fields that are already filled
  while (fieldIndex < fields.length) {
    const field = fields[fieldIndex];
    if (!extractedData || !extractedData[field.slug]) {
      break;
    }
    fieldIndex++;
  }

  if (fieldIndex >= fields.length) {
    return null;
  }

  const field = fields[fieldIndex];
  let question = `Could you please share your ${field.name.toLowerCase()}?`;

  if (field.helpText) {
    question += ` (${field.helpText})`;
  }

  if (field.options && field.options.length > 0) {
    const optionLabels = field.options.map((o) => o.label).join(", ");
    question += ` Options: ${optionLabels}`;
  }

  return question;
}

function transformSession(session: {
  id: string;
  organizationId: string;
  formId: string;
  status: ChatSessionStatus;
  clientPhone: string | null;
  clientEmail: string | null;
  extractedData: Prisma.JsonValue | null;
  lastQuestionIndex: number;
  handoffRequested: boolean;
  crisisDetected: boolean;
  resumeToken: string | null;
  completedAt: Date | null;
  createdAt: Date;
}): ChatSession {
  return {
    id: session.id,
    organizationId: session.organizationId,
    formId: session.formId,
    status: session.status,
    clientPhone: session.clientPhone,
    clientEmail: session.clientEmail,
    extractedData: session.extractedData as Record<string, unknown> | null,
    lastQuestionIndex: session.lastQuestionIndex,
    handoffRequested: session.handoffRequested,
    crisisDetected: session.crisisDetected,
    resumeToken: session.resumeToken,
    completedAt: session.completedAt,
    createdAt: session.createdAt,
  };
}

function transformMessage(message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role as "user" | "assistant" | "system",
    content: message.content,
    metadata: message.metadata as Record<string, unknown> | null,
    createdAt: message.createdAt,
  };
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get chatbot analytics for an organization
 */
export async function getChatbotAnalytics(
  orgId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalSessions: number;
  completedSessions: number;
  abandonedSessions: number;
  escalatedSessions: number;
  handoffRequests: number;
  completionRate: number;
  avgTimeToComplete: number | null;
  crisisDetectionRate: number;
}> {
  const dateFilter = {
    ...(startDate && { gte: startDate }),
    ...(endDate && { lte: endDate }),
  };

  const [
    totalSessions,
    completedSessions,
    abandonedSessions,
    escalatedSessions,
    handoffRequests,
    crisisDetected,
    avgCompletionTime,
  ] = await Promise.all([
    prisma.chatSession.count({
      where: { organizationId: orgId, createdAt: dateFilter },
    }),
    prisma.chatSession.count({
      where: { organizationId: orgId, status: "COMPLETED", createdAt: dateFilter },
    }),
    prisma.chatSession.count({
      where: { organizationId: orgId, status: "ABANDONED", createdAt: dateFilter },
    }),
    prisma.chatSession.count({
      where: { organizationId: orgId, status: "ESCALATED", createdAt: dateFilter },
    }),
    prisma.chatSession.count({
      where: { organizationId: orgId, handoffRequested: true, createdAt: dateFilter },
    }),
    prisma.chatSession.count({
      where: { organizationId: orgId, crisisDetected: true, createdAt: dateFilter },
    }),
    prisma.chatSession.findMany({
      where: {
        organizationId: orgId,
        status: "COMPLETED",
        completedAt: { not: null },
        createdAt: dateFilter,
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  // Calculate average completion time in minutes
  let avgTimeToComplete: number | null = null;
  if (avgCompletionTime.length > 0) {
    const totalMs = avgCompletionTime.reduce((sum, session) => {
      if (session.completedAt) {
        return sum + (session.completedAt.getTime() - session.createdAt.getTime());
      }
      return sum;
    }, 0);
    avgTimeToComplete = Math.round(totalMs / avgCompletionTime.length / 1000 / 60); // Convert to minutes
  }

  return {
    totalSessions,
    completedSessions,
    abandonedSessions,
    escalatedSessions,
    handoffRequests,
    completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
    avgTimeToComplete,
    crisisDetectionRate: totalSessions > 0 ? Math.round((crisisDetected / totalSessions) * 100) : 0,
  };
}
