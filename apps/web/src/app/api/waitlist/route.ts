import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { submitToWaitlist } from "@/lib/services/waitlist";

// ============================================
// WAITLIST API (PX-902)
// ============================================
// POST /api/waitlist - Submit waitlist entry
// Rate limit: 10 submissions per IP per hour

/**
 * Custom rate limit config for waitlist submissions
 * More restrictive than public endpoints to prevent abuse
 */
const WAITLIST_RATE_LIMIT = {
  limit: 10,
  windowSeconds: 60 * 60, // 1 hour
  name: "Waitlist",
  trackByUser: false,
  trackByIp: true,
  message: "Too many submissions. Please try again later.",
};

/**
 * Validation schema for waitlist submission
 */
const waitlistSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name too long"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name too long"),
  email: z
    .string()
    .email("Invalid email address")
    .max(255, "Email too long")
    .transform((email) => email.toLowerCase().trim()),
  organization: z
    .string()
    .min(1, "Organization is required")
    .max(200, "Organization name too long"),
  role: z.string().min(1, "Role is required").max(100, "Role too long"),
  teamSize: z
    .string()
    .min(1, "Team size is required")
    .max(50, "Team size too long"),
  industry: z
    .string()
    .min(1, "Industry is required")
    .max(100, "Industry too long"),
});

export type WaitlistSubmission = z.infer<typeof waitlistSchema>;

/**
 * POST /api/waitlist
 *
 * Submit a new waitlist entry.
 * For now, returns success stub - full implementation in PX-902.
 *
 * Response codes:
 * - 201: New entry created
 * - 200: Duplicate email (already on list) - returns success with different message
 * - 400: Validation error
 * - 429: Rate limit exceeded
 * - 500: Internal error
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const clientIp = getClientIp(request) ?? undefined;
    const rateLimitResult = await checkRateLimit(
      "public",
      WAITLIST_RATE_LIMIT,
      { ip: clientIp }
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: WAITLIST_RATE_LIMIT.message,
            retryAfter: rateLimitResult.retryAfter,
          },
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            "Retry-After": rateLimitResult.retryAfter.toString(),
          },
        }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        },
        { status: 400 }
      );
    }

    const validation = waitlistSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Submit to waitlist (handles duplicates and sends confirmation email)
    const { entry, isNew } = await submitToWaitlist({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      organization: data.organization,
      role: data.role,
      teamSize: data.teamSize,
      industry: data.industry,
    });

    // Log the submission
    console.log("[Waitlist] Submission:", {
      email: entry.email,
      isNew,
      ip: clientIp,
      timestamp: new Date().toISOString(),
    });

    if (!isNew) {
      return NextResponse.json(
        {
          success: true,
          message: "You're already on the list! We'll notify you when your access is ready.",
          duplicate: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "You're on the list! We'll notify you when your access is ready.",
        duplicate: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Waitlist API] Error processing submission:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
