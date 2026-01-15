import { prisma } from "@/lib/db";
import {
  createCustomer,
  createCheckoutSession,
  createFormPackCheckoutSession,
  createBillingPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  updateSubscription,
  listInvoices,
  getUpcomingInvoice,
} from "./stripe";
import {
  TIER_CONFIGS,
  FORM_PACKS,
  type SubscriptionTier,
  type UsageStats,
  type Invoice,
} from "./types";

/**
 * Get or create a Stripe customer for an organization
 */
export async function getOrCreateStripeCustomer(
  orgId: string
): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      users: {
        where: { role: "SUPER_ADMIN" },
        take: 1,
      },
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Return existing customer ID if present
  if (org.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  // Create new Stripe customer
  const adminEmail = org.users[0]?.email || `billing@${org.slug}.com`;
  const customer = await createCustomer(orgId, adminEmail, org.name);

  // Store customer ID
  await prisma.organization.update({
    where: { id: orgId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a checkout session for upgrading subscription
 */
export async function createSubscriptionCheckout(
  orgId: string,
  tier: SubscriptionTier,
  billingPeriod: "monthly" | "yearly"
): Promise<{ sessionUrl: string }> {
  const tierConfig = TIER_CONFIGS[tier];
  const priceId =
    billingPeriod === "monthly"
      ? tierConfig.stripePriceIdMonthly
      : tierConfig.stripePriceIdYearly;

  if (!priceId) {
    throw new Error(`Price ID not configured for ${tier} ${billingPeriod}`);
  }

  const customerId = await getOrCreateStripeCustomer(orgId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await createCheckoutSession(
    customerId,
    priceId,
    orgId,
    `${baseUrl}/billing?success=true`,
    `${baseUrl}/billing?canceled=true`
  );

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return { sessionUrl: session.url };
}

/**
 * Create a checkout session for purchasing form packs
 */
export async function createFormPackCheckout(
  orgId: string,
  packId: string
): Promise<{ sessionUrl: string }> {
  const pack = FORM_PACKS.find((p) => p.id === packId);
  if (!pack) {
    throw new Error("Invalid form pack ID");
  }

  if (!pack.stripePriceId) {
    throw new Error(`Price ID not configured for form pack ${packId}`);
  }

  const customerId = await getOrCreateStripeCustomer(orgId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await createFormPackCheckoutSession(
    customerId,
    pack.stripePriceId,
    orgId,
    packId,
    `${baseUrl}/billing?pack_success=true`,
    `${baseUrl}/billing?canceled=true`
  );

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return { sessionUrl: session.url };
}

/**
 * Get billing portal URL for managing subscription
 */
export async function getBillingPortalUrl(
  orgId: string
): Promise<{ portalUrl: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org?.stripeCustomerId) {
    throw new Error("No billing account found");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const session = await createBillingPortalSession(
    org.stripeCustomerId,
    `${baseUrl}/billing`
  );

  return { portalUrl: session.url };
}

/**
 * Get current subscription details for an organization
 */
export async function getSubscriptionDetails(orgId: string): Promise<{
  tier: SubscriptionTier;
  status: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  formPacksRemaining: number;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // Check for active subscription in Stripe
  const subscription = await prisma.subscription.findFirst({
    where: { orgId, status: { in: ["active", "trialing", "past_due"] } },
    orderBy: { createdAt: "desc" },
  });

  if (subscription) {
    return {
      tier: subscription.tier as SubscriptionTier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      formPacksRemaining: org.purchasedFormPacks,
    };
  }

  // Default to free tier
  return {
    tier: org.tier as SubscriptionTier,
    status: "active",
    formPacksRemaining: org.purchasedFormPacks,
  };
}

/**
 * Cancel subscription at period end
 */
export async function cancelOrgSubscription(
  orgId: string
): Promise<{ success: boolean }> {
  const subscription = await prisma.subscription.findFirst({
    where: { orgId, status: "active" },
  });

  if (!subscription) {
    throw new Error("No active subscription found");
  }

  await cancelSubscription(subscription.stripeSubscriptionId);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true },
  });

  return { success: true };
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateOrgSubscription(
  orgId: string
): Promise<{ success: boolean }> {
  const subscription = await prisma.subscription.findFirst({
    where: { orgId, cancelAtPeriodEnd: true },
  });

  if (!subscription) {
    throw new Error("No canceled subscription found");
  }

  await reactivateSubscription(subscription.stripeSubscriptionId);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false },
  });

  return { success: true };
}

/**
 * Get usage statistics for an organization
 */
export async function getUsageStats(orgId: string): Promise<UsageStats> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const tierConfig = TIER_CONFIGS[org.tier as SubscriptionTier];
  const limits = tierConfig.limits;

  // Get current month's start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count various resources
  const [
    formCount,
    submissionCount,
    userCount,
    fileStats,
    aiExtractionCount,
  ] = await Promise.all([
    prisma.form.count({ where: { orgId } }),
    prisma.formSubmission.count({
      where: { orgId, submittedAt: { gte: monthStart } },
    }),
    prisma.user.count({ where: { orgId } }),
    prisma.fileUpload.aggregate({
      where: { orgId },
      _sum: { sizeBytes: true },
      _count: true,
    }),
    prisma.extractionExample.count({
      where: {
        field: { form: { orgId } },
        createdAt: { gte: monthStart },
      },
    }),
  ]);

  return {
    forms: { used: formCount, limit: limits.forms },
    submissions: { used: submissionCount, limit: limits.submissions },
    users: { used: userCount, limit: limits.users },
    storage: {
      used: fileStats._sum.sizeBytes || 0,
      limit: limits.storage * 1024 * 1024 * 1024, // Convert GB to bytes
    },
    aiExtractions: { used: aiExtractionCount, limit: limits.aiExtractions },
    fileUploads: { used: fileStats._count || 0, limit: limits.fileUploads },
  };
}

/**
 * Check if an organization can perform an action based on their plan
 */
export async function checkLimit(
  orgId: string,
  resource: keyof UsageStats
): Promise<{ allowed: boolean; message?: string }> {
  const stats = await getUsageStats(orgId);
  const { used, limit } = stats[resource];

  if (limit === "unlimited") {
    return { allowed: true };
  }

  if (used >= limit) {
    return {
      allowed: false,
      message: `You have reached your ${resource} limit. Please upgrade your plan.`,
    };
  }

  return { allowed: true };
}

/**
 * Get invoice history for an organization
 */
export async function getInvoiceHistory(orgId: string): Promise<Invoice[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org?.stripeCustomerId) {
    return [];
  }

  const stripeInvoices = await listInvoices(org.stripeCustomerId);

  return stripeInvoices.map((inv) => ({
    id: inv.id,
    stripeInvoiceId: inv.id,
    amount: inv.amount_paid / 100, // Convert from cents
    currency: inv.currency.toUpperCase(),
    status: inv.status as Invoice["status"],
    pdfUrl: inv.invoice_pdf || undefined,
    createdAt: new Date(inv.created * 1000),
  }));
}

/**
 * Get upcoming invoice preview
 */
export async function getUpcomingInvoicePreview(
  orgId: string
): Promise<{ amount: number; currency: string; date: Date } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org?.stripeCustomerId) {
    return null;
  }

  const invoice = await getUpcomingInvoice(org.stripeCustomerId);
  if (!invoice) {
    return null;
  }

  return {
    amount: invoice.amount_due / 100,
    currency: invoice.currency.toUpperCase(),
    date: new Date((invoice.next_payment_attempt || Date.now() / 1000) * 1000),
  };
}

/**
 * Add form packs to an organization (called after successful payment)
 */
export async function addFormPacks(
  orgId: string,
  packId: string
): Promise<void> {
  const pack = FORM_PACKS.find((p) => p.id === packId);
  if (!pack) {
    throw new Error("Invalid form pack ID");
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      purchasedFormPacks: { increment: pack.forms },
    },
  });
}

/**
 * Use a form pack (decrement when creating a form beyond limit)
 */
export async function useFormPack(orgId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org || org.purchasedFormPacks <= 0) {
    return false;
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      purchasedFormPacks: { decrement: 1 },
    },
  });

  return true;
}
