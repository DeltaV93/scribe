"use client";

/**
 * Admin Integrations Tab (PX-882)
 *
 * Allows admins to enable/disable workflow platforms for the organization.
 * Located in the admin page alongside other admin tabs.
 */

import { AdminWorkflowPlatformsSection } from "@/app/(dashboard)/settings/integrations/components";

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <AdminWorkflowPlatformsSection />
    </div>
  );
}
