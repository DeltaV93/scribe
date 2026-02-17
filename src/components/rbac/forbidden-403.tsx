"use client";

/**
 * 403 Forbidden Page Component
 *
 * Displays access denied message with:
 * - Role context explanation
 * - Admin contact information
 * - Navigation back to safe area
 */

import { ShieldAlert, Mail, ArrowLeft, HelpCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@/types";

// ============================================
// Types
// ============================================

export interface Forbidden403Props {
  /** The resource that was denied (e.g., "clients", "forms") */
  resource?: string;
  /** The action that was denied (e.g., "create", "delete") */
  action?: string;
  /** Admin email for contact button */
  adminEmail?: string;
  /** Admin name for display */
  adminName?: string;
  /** Custom error message */
  customMessage?: string;
  /** User's current role */
  userRole?: UserRole | string;
}

// ============================================
// Role Descriptions
// ============================================

const roleDescriptions: Record<string, string> = {
  VIEWER: "Your Viewer role provides read-only access to assigned data.",
  FACILITATOR:
    "Your Facilitator role focuses on program sessions and attendance.",
  CASE_MANAGER: "Your Case Manager role is scoped to your assigned clients.",
  PROGRAM_MANAGER:
    "Your Program Manager role covers programs you are assigned to.",
  ADMIN: "Please contact support if you believe this is an error.",
  SUPER_ADMIN: "Please contact support if you believe this is an error.",
};

const roleDisplayNames: Record<string, string> = {
  VIEWER: "Viewer",
  FACILITATOR: "Facilitator",
  CASE_MANAGER: "Case Manager",
  PROGRAM_MANAGER: "Program Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

// ============================================
// Component
// ============================================

export function Forbidden403({
  resource,
  action,
  adminEmail,
  adminName,
  customMessage,
  userRole,
}: Forbidden403Props) {
  const router = useRouter();

  // Build default message based on resource/action
  const defaultMessage =
    resource && action
      ? `You don't have permission to ${action} ${resource}.`
      : "You don't have permission to access this page.";

  const roleDescription = userRole
    ? roleDescriptions[userRole] ||
      "Your current role does not grant access to this feature."
    : "Your current role does not grant access to this feature.";

  const roleName = userRole
    ? roleDisplayNames[userRole] || userRole.replace(/_/g, " ")
    : "Unknown";

  // Build mailto subject/body
  const mailtoSubject = encodeURIComponent(
    `Access Request - ${resource || "Feature"}`
  );
  const mailtoBody = encodeURIComponent(
    `Hi,\n\nI need access to ${resource || "a feature"} in Scrybe.\n\nMy current role: ${roleName}\nAction needed: ${action || "access"}\n\nThank you!`
  );

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="text-base">
            {customMessage || defaultMessage}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Role Context */}
          {userRole && (
            <div className="bg-muted rounded-lg p-4 text-sm">
              <p className="font-medium text-foreground mb-1">
                Your role: {roleName}
              </p>
              <p className="text-muted-foreground">{roleDescription}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>

            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>

            {adminEmail && (
              <Button variant="default" asChild>
                <a
                  href={`mailto:${adminEmail}?subject=${mailtoSubject}&body=${mailtoBody}`}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact {adminName || "Administrator"}
                </a>
              </Button>
            )}
          </div>

          {/* Help Link */}
          <div className="pt-4 border-t text-center">
            <Link
              href="/help/permissions"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <HelpCircle className="h-4 w-4" />
              Learn about roles and permissions
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
