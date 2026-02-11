/**
 * Higher-order function wrapper for Next.js API routes that handles
 * authentication and automatic PHI access audit logging.
 *
 * @module lib/auth/with-auth-audit
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit/service";
import type { AuditAction, AuditResource } from "@/lib/audit/types";
import type { SessionUser } from "@/types";

/**
 * Configuration for the withAuthAndAudit wrapper
 */
export interface AuthAuditConfig {
  /** The audit action to log (e.g., "VIEW", "CREATE", "UPDATE") */
  action: AuditAction;

  /** The resource type being accessed (e.g., "CLIENT", "CALL", "SUBMISSION") */
  resource: AuditResource;

  /**
   * Whether to log audit entry only on successful responses (2xx status codes).
   * Defaults to true.
   */
  auditOnSuccess?: boolean;

  /**
   * Function to extract the resource ID from the request context.
   * Can extract from route params, request body, or response data.
   * If not provided, attempts to extract from common patterns.
   */
  getResourceId?: (context: ResourceIdContext) => string | null | Promise<string | null>;

  /**
   * Optional function to extract the resource name for the audit log
   */
  getResourceName?: (context: ResourceIdContext) => string | null | Promise<string | null>;

  /**
   * Optional additional details to include in the audit log
   */
  getDetails?: (context: ResourceIdContext) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
}

/**
 * Context passed to resource ID extraction functions
 */
export interface ResourceIdContext {
  /** Route parameters (e.g., { clientId: "abc123" }) */
  params: Record<string, string>;

  /** Parsed request body (if JSON) */
  body: Record<string, unknown> | null;

  /** The authenticated user */
  user: SessionUser;

  /** The original request */
  request: NextRequest;

  /** The response (available only in post-response hooks) */
  response?: NextResponse;
}

/**
 * Extended route context type for Next.js App Router
 */
export interface RouteContext {
  params: Promise<Record<string, string>> | Record<string, string>;
}

/**
 * Type for the wrapped API route handler
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: RouteContext,
  user: SessionUser
) => Promise<NextResponse>;

/**
 * Type for the standard Next.js API route handler
 */
export type ApiRouteHandler = (
  request: NextRequest,
  context: RouteContext
) => Promise<NextResponse>;

/**
 * Extract IP address from request headers
 */
function getIpAddress(request: NextRequest): string | undefined {
  // Check common proxy headers first
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Vercel-specific header
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }

  // Cloudflare-specific header
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return undefined;
}

/**
 * Extract user agent from request headers
 */
function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get("user-agent") || undefined;
}

/**
 * Attempt to extract resource ID from common patterns in params
 */
function extractResourceIdFromParams(
  params: Record<string, string>,
  resource: AuditResource
): string | null {
  // Map resource types to common param names
  const resourceParamMap: Record<AuditResource, string[]> = {
    CLIENT: ["clientId", "client_id", "id"],
    CALL: ["callId", "call_id", "id"],
    SUBMISSION: ["submissionId", "submission_id", "id"],
    FORM: ["formId", "form_id", "id"],
    FORM_VERSION: ["versionId", "version_id", "id"],
    FORM_FIELD: ["fieldId", "field_id", "id"],
    FILE: ["fileId", "file_id", "id"],
    USER: ["userId", "user_id", "id"],
    ORGANIZATION: ["orgId", "org_id", "id"],
    REPORT: ["reportId", "report_id", "id"],
    SETTING: ["settingId", "setting_id", "id"],
    CLIENT_SHARE: ["shareId", "share_id", "id"],
    CLIENT_GOAL: ["goalId", "goal_id", "id"],
    NOTE: ["noteId", "note_id", "id"],
    MESSAGE: ["messageId", "message_id", "id"],
    ATTENDANCE_UPLOAD: ["uploadId", "upload_id", "id"],
    ATTENDANCE_RECORD: ["recordId", "record_id", "id"],
    ATTENDANCE_SHEET: ["sheetId", "sheet_id", "id"],
    EMAIL: ["emailId", "email_id", "id"],
    IN_PERSON_RECORDING: ["recordingId", "recording_id", "id"],
    GOAL: ["goalId", "goal_id", "id"],
    KPI: ["kpiId", "kpi_id", "id"],
    SESSION: ["sessionId", "session_id", "id"],
  };

  const possibleParams = resourceParamMap[resource] || ["id"];

  for (const paramName of possibleParams) {
    if (params[paramName]) {
      return params[paramName];
    }
  }

  return null;
}

/**
 * Safely parse request body as JSON
 */
async function parseRequestBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    // Clone the request to avoid consuming the body
    const clonedRequest = request.clone();
    const contentType = clonedRequest.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const text = await clonedRequest.text();
      if (text) {
        return JSON.parse(text);
      }
    }
  } catch {
    // Body parsing failed, return null
  }
  return null;
}

/**
 * Check if response is successful (2xx status code)
 */
function isSuccessResponse(response: NextResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

/**
 * Creates an authenticated API route handler with automatic audit logging.
 *
 * @example
 * ```typescript
 * // Basic usage - view client
 * export const GET = withAuthAndAudit(
 *   async (request, context, user) => {
 *     const { clientId } = await context.params;
 *     const client = await getClientById(clientId, user.orgId);
 *     return NextResponse.json({ success: true, data: client });
 *   },
 *   {
 *     action: "VIEW",
 *     resource: "CLIENT",
 *   }
 * );
 *
 * // With custom resource ID extraction
 * export const POST = withAuthAndAudit(
 *   async (request, context, user) => {
 *     const body = await request.json();
 *     // ... create logic
 *     return NextResponse.json({ success: true, data: created });
 *   },
 *   {
 *     action: "CREATE",
 *     resource: "NOTE",
 *     getResourceId: ({ body }) => body?.clientId as string,
 *     getDetails: ({ body }) => ({ clientId: body?.clientId }),
 *   }
 * );
 * ```
 */
export function withAuthAndAudit(
  handler: AuthenticatedHandler,
  config: AuthAuditConfig
): ApiRouteHandler {
  const { action, resource, auditOnSuccess = true, getResourceId, getResourceName, getDetails } = config;

  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    // Step 1: Authenticate user
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Step 2: Resolve params (handle both Promise and direct object)
    let params: Record<string, string>;
    try {
      params = context.params instanceof Promise ? await context.params : context.params;
    } catch {
      params = {};
    }

    // Step 3: Parse request body for context
    const body = await parseRequestBody(request);

    // Step 4: Build context for resource ID extraction
    const resourceIdContext: ResourceIdContext = {
      params,
      body,
      user,
      request,
    };

    // Step 5: Execute the handler
    let response: NextResponse;
    try {
      response = await handler(request, context, user);
    } catch (error) {
      // Log errors but don't audit failed requests by default
      console.error(`[withAuthAndAudit] Handler error for ${action} ${resource}:`, error);
      throw error;
    }

    // Step 6: Audit logging (if configured and conditions met)
    const shouldAudit = auditOnSuccess ? isSuccessResponse(response) : true;

    if (shouldAudit) {
      try {
        // Add response to context for post-handler extraction
        resourceIdContext.response = response;

        // Extract resource ID
        let resourceId: string | null = null;
        if (getResourceId) {
          resourceId = await Promise.resolve(getResourceId(resourceIdContext));
        }
        if (!resourceId) {
          resourceId = extractResourceIdFromParams(params, resource);
        }

        // Only log if we have a resource ID
        if (resourceId) {
          const ipAddress = getIpAddress(request);
          const userAgent = getUserAgent(request);

          // Extract optional resource name
          let resourceName: string | undefined;
          if (getResourceName) {
            const name = await Promise.resolve(getResourceName(resourceIdContext));
            resourceName = name || undefined;
          }

          // Extract optional details
          let details: Record<string, unknown> | undefined;
          if (getDetails) {
            const detailsResult = await Promise.resolve(getDetails(resourceIdContext));
            details = detailsResult || undefined;
          }

          // Create audit log entry asynchronously (non-blocking)
          createAuditLog({
            orgId: user.orgId,
            userId: user.id,
            action,
            resource,
            resourceId,
            resourceName,
            details,
            ipAddress,
            userAgent,
          }).catch((auditError) => {
            // Log audit failures but don't fail the request
            console.error("[withAuthAndAudit] Failed to create audit log:", auditError);
          });
        } else {
          // Log warning if we couldn't extract resource ID
          console.warn(
            `[withAuthAndAudit] Could not extract resourceId for ${action} ${resource}. ` +
              `Params: ${JSON.stringify(params)}`
          );
        }
      } catch (auditError) {
        // Audit logging should never break the response
        console.error("[withAuthAndAudit] Audit logging error:", auditError);
      }
    }

    return response;
  };
}

/**
 * Creates an authenticated API route handler WITHOUT audit logging.
 * Use this for non-PHI routes that still require authentication.
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (request, context, user) => {
 *   const forms = await getFormsForOrg(user.orgId);
 *   return NextResponse.json({ success: true, data: forms });
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler): ApiRouteHandler {
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    return handler(request, context, user);
  };
}

export default withAuthAndAudit;
