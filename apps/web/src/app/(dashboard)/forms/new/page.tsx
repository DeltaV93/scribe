import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FormBuilder } from "@/components/form-builder";
import { isFeatureEnabled } from "@/lib/features/flags";

export default async function NewFormPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has permission to create forms
  if (!user.permissions.canCreateForms) {
    redirect("/forms?error=no_permission");
  }

  // Fetch feature flags for the organization
  const [photoToForm, formLogic] = await Promise.all([
    isFeatureEnabled(user.orgId, "photo-to-form"),
    isFeatureEnabled(user.orgId, "form-logic"),
  ]);

  return (
    <div className="h-[calc(100vh-4rem)]">
      <FormBuilder
        featureFlags={{
          photoToForm,
          formLogic,
        }}
        showMethodModal={true}
      />
    </div>
  );
}
