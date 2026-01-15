import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { addFormPacks } from "./service";
import type { SubscriptionTier } from "./types";

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log(`Unhandled webhook event: ${event.type}`);
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const orgId = session.metadata?.orgId;
  if (!orgId) {
    console.error("No orgId in checkout session metadata");
    return;
  }

  // Check if this is a form pack purchase
  if (session.metadata?.type === "form_pack" && session.metadata?.formPackId) {
    await addFormPacks(orgId, session.metadata.formPackId);

    // Record payment
    await prisma.paymentHistory.create({
      data: {
        orgId,
        stripePaymentId: session.payment_intent as string,
        amount: session.amount_total || 0,
        currency: session.currency || "usd",
        status: "succeeded",
        type: "form_pack",
        description: `Form pack: ${session.metadata.formPackId}`,
        metadata: { formPackId: session.metadata.formPackId },
      },
    });
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const orgId = subscription.metadata?.orgId;
  if (!orgId) {
    console.error("No orgId in subscription metadata");
    return;
  }

  // Determine tier from price ID
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      orgId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      tier,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      tier,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Update organization tier
  await prisma.organization.update({
    where: { id: orgId },
    data: { tier: tier as SubscriptionTier },
  });
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const orgId = subscription.metadata?.orgId;

  // Update subscription status
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: "canceled" },
  });

  // Downgrade organization to free tier
  if (orgId) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { tier: "FREE" },
    });
  }
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription) return;

  // Find the subscription to get orgId
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });

  if (!subscription) return;

  // Record payment
  await prisma.paymentHistory.create({
    data: {
      orgId: subscription.orgId,
      stripePaymentId: invoice.payment_intent as string,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: "succeeded",
      type: "subscription",
      description: `Subscription payment`,
    },
  });
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  if (!invoice.subscription) return;

  // Update subscription status to past_due
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription as string },
    data: { status: "past_due" },
  });

  // TODO: Send notification email to organization admins
}

/**
 * Map Stripe price ID to subscription tier
 */
function getTierFromPriceId(priceId: string): string {
  // Check environment variables for price IDs
  const priceMapping: Record<string, string> = {
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || ""]: "STARTER",
    [process.env.STRIPE_STARTER_YEARLY_PRICE_ID || ""]: "STARTER",
    [process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || ""]: "PROFESSIONAL",
    [process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || ""]: "PROFESSIONAL",
    [process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || ""]: "ENTERPRISE",
    [process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || ""]: "ENTERPRISE",
  };

  return priceMapping[priceId] || "FREE";
}
