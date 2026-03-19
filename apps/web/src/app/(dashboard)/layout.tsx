import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { QuickActionProvider } from "@/components/quick-actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;

  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Error getting current user:", error);
    redirect("/login?error=auth_error");
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        {children}
      </main>
      <QuickActionProvider userRole={user.role} showFab={user.showQuickActionFab ?? true} />
    </div>
  );
}
