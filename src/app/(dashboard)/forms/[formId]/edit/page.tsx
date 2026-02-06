import { getCurrentUser } from "@/lib/auth";
import { getFormById } from "@/lib/services/forms";
import { redirect, notFound } from "next/navigation";
import { FormBuilder } from "@/components/form-builder";
import { isFeatureEnabled } from "@/lib/features/flags";

interface PageProps {
  params: Promise<{ formId: string }>;
}

export default async function EditFormPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { formId } = await params;

  if (!user) {
    redirect("/login");
  }

  // Check if user has permission to update forms
  if (!user.permissions.canUpdateForms) {
    redirect("/forms?error=no_permission");
  }

  // Fetch the form and feature flags in parallel
  const [form, photoToForm, formLogic] = await Promise.all([
    getFormById(formId, user.orgId),
    isFeatureEnabled(user.orgId, "photo-to-form"),
    isFeatureEnabled(user.orgId, "form-logic"),
  ]);

  if (!form) {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <FormBuilder
        initialForm={form}
        featureFlags={{
          photoToForm,
          formLogic,
        }}
        showMethodModal={false}
      />
    </div>
  );
}
