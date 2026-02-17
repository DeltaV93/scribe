import { Forbidden403 } from "@/components/rbac/forbidden-403";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Access Denied | Scrybe",
};

interface Props {
  searchParams: Promise<{
    resource?: string;
    action?: string;
  }>;
}

export default async function ForbiddenPage({ searchParams }: Props) {
  const user = await requireAuth();
  const params = await searchParams;

  // Get org admin email for contact
  const admin = await prisma.user.findFirst({
    where: {
      orgId: user.orgId,
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      isActive: true,
    },
    select: { email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <Forbidden403
      resource={params.resource}
      action={params.action}
      userRole={user.role}
      adminEmail={admin?.email}
      adminName={admin?.name || undefined}
    />
  );
}
