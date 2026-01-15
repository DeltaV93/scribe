import { getCurrentUser } from "@/lib/auth";
import { getFormById } from "@/lib/services/forms";
import { redirect, notFound } from "next/navigation";
import { FormBuilder } from "@/components/form-builder";

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

  // Fetch the form
  const form = await getFormById(formId, user.orgId);

  if (!form) {
    notFound();
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <FormBuilder initialForm={form} />
    </div>
  );
}
