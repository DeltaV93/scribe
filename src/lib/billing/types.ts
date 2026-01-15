// Billing types for Stripe integration

export type SubscriptionTier = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface TierConfig {
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly: string | null;
  stripePriceIdYearly: string | null;
  features: TierFeature[];
  limits: TierLimits;
}

export interface TierFeature {
  name: string;
  included: boolean;
  limit?: number | "unlimited";
}

export interface TierLimits {
  forms: number | "unlimited";
  submissions: number | "unlimited";
  users: number | "unlimited";
  storage: number; // in GB
  aiExtractions: number | "unlimited";
  fileUploads: number | "unlimited";
  customBranding: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  sso: boolean;
  auditLogs: boolean;
  complianceReports: boolean;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  FREE: {
    name: "Free",
    description: "For individuals getting started",
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    features: [
      { name: "Up to 3 forms", included: true, limit: 3 },
      { name: "100 submissions/month", included: true, limit: 100 },
      { name: "1 user", included: true, limit: 1 },
      { name: "1 GB storage", included: true, limit: 1 },
      { name: "Basic AI extraction", included: true, limit: 50 },
      { name: "Email support", included: true },
    ],
    limits: {
      forms: 3,
      submissions: 100,
      users: 1,
      storage: 1,
      aiExtractions: 50,
      fileUploads: 50,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
      sso: false,
      auditLogs: false,
      complianceReports: false,
    },
  },
  STARTER: {
    name: "Starter",
    description: "For small teams",
    priceMonthly: 29,
    priceYearly: 290,
    stripePriceIdMonthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || "",
    features: [
      { name: "Up to 10 forms", included: true, limit: 10 },
      { name: "1,000 submissions/month", included: true, limit: 1000 },
      { name: "5 users", included: true, limit: 5 },
      { name: "10 GB storage", included: true, limit: 10 },
      { name: "500 AI extractions/month", included: true, limit: 500 },
      { name: "Email support", included: true },
      { name: "Basic audit logs", included: true },
    ],
    limits: {
      forms: 10,
      submissions: 1000,
      users: 5,
      storage: 10,
      aiExtractions: 500,
      fileUploads: 500,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false,
      sso: false,
      auditLogs: true,
      complianceReports: false,
    },
  },
  PROFESSIONAL: {
    name: "Professional",
    description: "For growing organizations",
    priceMonthly: 99,
    priceYearly: 990,
    stripePriceIdMonthly: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || "",
    features: [
      { name: "Unlimited forms", included: true, limit: "unlimited" },
      { name: "10,000 submissions/month", included: true, limit: 10000 },
      { name: "25 users", included: true, limit: 25 },
      { name: "100 GB storage", included: true, limit: 100 },
      { name: "5,000 AI extractions/month", included: true, limit: 5000 },
      { name: "Priority email support", included: true },
      { name: "Full audit logs", included: true },
      { name: "Compliance reports", included: true },
      { name: "Custom branding", included: true },
      { name: "API access", included: true },
    ],
    limits: {
      forms: "unlimited",
      submissions: 10000,
      users: 25,
      storage: 100,
      aiExtractions: 5000,
      fileUploads: 5000,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
      sso: false,
      auditLogs: true,
      complianceReports: true,
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "For large organizations with custom needs",
    priceMonthly: 299,
    priceYearly: 2990,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || "",
    features: [
      { name: "Unlimited everything", included: true, limit: "unlimited" },
      { name: "Unlimited users", included: true, limit: "unlimited" },
      { name: "1 TB storage", included: true, limit: 1000 },
      { name: "Unlimited AI extractions", included: true, limit: "unlimited" },
      { name: "24/7 priority support", included: true },
      { name: "Full audit & compliance", included: true },
      { name: "Custom branding", included: true },
      { name: "Full API access", included: true },
      { name: "SSO/SAML", included: true },
      { name: "Dedicated account manager", included: true },
    ],
    limits: {
      forms: "unlimited",
      submissions: "unlimited",
      users: "unlimited",
      storage: 1000,
      aiExtractions: "unlimited",
      fileUploads: "unlimited",
      customBranding: true,
      apiAccess: true,
      prioritySupport: true,
      sso: true,
      auditLogs: true,
      complianceReports: true,
    },
  },
};

// Form pack pricing
export interface FormPack {
  id: string;
  name: string;
  forms: number;
  price: number;
  stripePriceId: string;
}

export const FORM_PACKS: FormPack[] = [
  {
    id: "pack_5",
    name: "5 Form Pack",
    forms: 5,
    price: 15,
    stripePriceId: process.env.STRIPE_FORM_PACK_5_PRICE_ID || "",
  },
  {
    id: "pack_10",
    name: "10 Form Pack",
    forms: 10,
    price: 25,
    stripePriceId: process.env.STRIPE_FORM_PACK_10_PRICE_ID || "",
  },
  {
    id: "pack_25",
    name: "25 Form Pack",
    forms: 25,
    price: 50,
    stripePriceId: process.env.STRIPE_FORM_PACK_25_PRICE_ID || "",
  },
];

// Subscription status
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "unpaid";

export interface Subscription {
  id: string;
  orgId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void";
  pdfUrl?: string;
  createdAt: Date;
}

export interface UsageStats {
  forms: { used: number; limit: number | "unlimited" };
  submissions: { used: number; limit: number | "unlimited" };
  users: { used: number; limit: number | "unlimited" };
  storage: { used: number; limit: number }; // in bytes
  aiExtractions: { used: number; limit: number | "unlimited" };
  fileUploads: { used: number; limit: number | "unlimited" };
}
