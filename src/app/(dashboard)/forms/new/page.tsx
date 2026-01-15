import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FormBuilder } from "@/components/form-builder";

export default async function NewFormPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has permission to create forms
  if (!user.permissions.canCreateForms) {
    redirect("/forms?error=no_permission");
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <FormBuilder />
    </div>
  );
}
