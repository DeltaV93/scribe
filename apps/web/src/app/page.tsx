import { redirect } from "next/navigation";

/**
 * Root page for the app - redirects to dashboard.
 * Marketing homepage is now at oninkra.com (apps/marketing).
 */
export default function RootPage() {
  redirect("/dashboard");
}
