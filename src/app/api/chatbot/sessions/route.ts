/**
 * POST /api/chatbot/sessions - Initialize a new chatbot session
 *
 * This is a public endpoint that creates a new chatbot intake session.
 * No authentication required (unless org has chatbotAuthRequired set).
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getWidgetConfig } from "@/lib/services/chatbot";
import { cookies } from "next/headers";

// Validation schema
const createSessionSchema = z.object({
  orgSlug: z.string().min(1, "Organization slug is required"),
  formId: z.string().uuid().optional(),
});

/**
 * POST /api/chatbot/sessions - Create a new chatbot session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { orgSlug, formId } = validation.data;

    // Check if chatbot is enabled and get config
    const config = await getWidgetConfig(orgSlug);
    if (!config) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Organization not found" } },
        { status: 404 }
      );
    }

    if (!config.enabled) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Chatbot is not enabled for this organization" } },
        { status: 403 }
      );
    }

    // Check for resume token in cookies
    const cookieStore = await cookies();
    const resumeToken = cookieStore.get(`chatbot_session_${orgSlug}`)?.value;

    // Create or resume session
    const result = await createSession({
      orgSlug,
      formId,
      resumeToken,
    });

    // Set resume token cookie
    const response = NextResponse.json({
      success: true,
      data: {
        session: result.session,
        welcomeMessage: result.welcomeMessage,
        firstQuestion: result.firstQuestion,
      },
    });

    // Set cookie for session resume (7 day expiry)
    response.cookies.set(`chatbot_session_${orgSlug}`, result.session.resumeToken || "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error creating chatbot session:", error);

    if (error instanceof Error) {
      if (error.message === "Organization not found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("not enabled") || error.message.includes("not configured")) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: error.message } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create chatbot session" } },
      { status: 500 }
    );
  }
}
