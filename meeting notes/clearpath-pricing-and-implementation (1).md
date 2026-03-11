# Clear Path — Pricing Model, Financial Projections & Implementation Spec

> **Purpose:** Complete reference for pricing, paywall logic, user types, and financial projections. Designed to be consumed by engineering (Claude Code) for paywall implementation and by business for pricing decisions.
>
> **Last updated:** February 2026

---

## 1. Pricing Overview

Clear Path runs a two-sided model: consumers pay for their own homebuying journey, and professionals (realtors, lending officers, financial planners) pay a subscription to manage clients through the platform.

### Consumer Tiers — Journey Pricing (One-Time)

| Tier | Price | Billing | `user_type` |
|------|-------|---------|-------------|
| **Free (Trail)** | $0 | Free forever | `consumer_free` |
| **Clear Path Pass** | $39 | One-time | `consumer_pass` |
| **Clear Path Summit** | $79 | One-time | `consumer_summit` |
| **Invited Client** | $0 (covered by pro) | N/A | `consumer_invited` |

### Professional Tiers — Subscription (Monthly/Annual)

| Tier | Monthly | Annual (2 mo free) | Billing | `user_type` |
|------|---------|-------------------|---------|-------------|
| **Solo** | $59/mo | $590/yr | Monthly or Annual | `pro_solo` |
| **Team** | $199/mo | $1,990/yr | Monthly or Annual | `pro_team` |
| **Enterprise** | $799/mo | $7,990/yr | Annual only | `pro_enterprise` |

### Add-On Revenue

| Add-On | Price | Available To | Margin Note |
|--------|-------|-------------|-------------|
| Document Verification | $7/doc | All paid tiers | AI processing cost ~$0.50/doc |
| API Access (standalone) | $299/mo | Enterprise only | Near-zero marginal cost |
| Referral Marketplace | $75–150/lead | Consumers (free + paid) | Revenue share with partners |
| Additional client seats | $15/seat/mo | Solo & Team tiers | Infrastructure cost ~$3/seat |
| Extended journey | $19 per 6mo extension | Pass & Summit | Minimal incremental cost |

---

## 2. Feature Matrix

### Consumer Features

#### Document Management

| Feature | Free (Trail) | Pass ($39) | Summit ($79) |
|---------|:---:|:---:|:---:|
| Document uploads | 3 max | Unlimited | Unlimited |
| Document checklist | ✓ | ✓ | ✓ |
| Document status tracking | Basic | Full | Full |
| Secure encrypted storage (AES-256) | ✗ | ✓ | ✓ |
| AI document review | ✗ | ✗ | ✓ Priority |
| Document concierge (AI guidance) | ✗ | ✗ | ✓ |

#### Sharing & Collaboration

| Feature | Free (Trail) | Pass ($39) | Summit ($79) |
|---------|:---:|:---:|:---:|
| Share documents with professionals | ✗ | ✓ | ✓ |
| Receive shared docs from professionals | ✓ | ✓ | ✓ |
| Share link generation | ✗ | ✓ | ✓ |
| Multi-party sharing (agent + lender) | ✗ | ✗ | ✓ |

#### Journey Tracking

| Feature | Free (Trail) | Pass ($39) | Summit ($79) |
|---------|:---:|:---:|:---:|
| Trail progress visualization | Basic (3 steps) | Full trail | Full trail |
| Timeline estimator | ✗ | ✗ | ✓ |
| Closing cost estimator | ✗ | ✗ | ✓ |
| Milestone notifications | ✗ | ✓ | ✓ |

#### Experience

| Feature | Free (Trail) | Pass ($39) | Summit ($79) |
|---------|:---:|:---:|:---:|
| Terrain pattern backgrounds | ✗ | ✓ | ✓ |
| Dark mode | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✗ | ✓ |
| Journey duration | Unlimited | 12 months | 18 months |

### Professional Features

#### Seats & Clients

| Feature | Solo ($59/mo) | Team ($199/mo) | Enterprise ($799/mo) |
|---------|:---:|:---:|:---:|
| Professional seats | 1 | 5 | Unlimited |
| Active client journeys | 15 | 50 | Unlimited |
| Client gets full Pass experience | ✓ Included | ✓ Included | ✓ Included |

#### Client Management

| Feature | Solo ($59/mo) | Team ($199/mo) | Enterprise ($799/mo) |
|---------|:---:|:---:|:---:|
| Client dashboard | ✓ | ✓ | ✓ |
| Invite clients to Clear Path | ✓ | ✓ | ✓ |
| Track all client document status | ✓ | ✓ | ✓ |
| Client journey overview | ✓ | ✓ | ✓ |
| Team client visibility | ✗ | ✓ | ✓ |
| Role-based access (admin/associate) | ✗ | ✓ | ✓ |

#### Branding & Integration

| Feature | Solo ($59/mo) | Team ($199/mo) | Enterprise ($799/mo) |
|---------|:---:|:---:|:---:|
| Co-branding on client experience | ✗ | ✓ | ✓ |
| Custom branding / white-label | ✗ | ✗ | ✓ |
| API access | ✗ | ✗ | ✓ |
| CRM / LOS integration | ✗ | ✗ | ✓ |

#### Analytics & Compliance

| Feature | Solo ($59/mo) | Team ($199/mo) | Enterprise ($799/mo) |
|---------|:---:|:---:|:---:|
| Basic analytics | ✓ | ✓ | ✓ |
| Team analytics | ✗ | ✓ | ✓ |
| Compliance reporting | ✗ | ✗ | ✓ |
| Audit trail | ✗ | ✓ | ✓ |
| SLA support | ✗ | ✗ | ✓ |

### Target Users by Professional Tier

| User Type | Solo | Team | Enterprise |
|-----------|:---:|:---:|:---:|
| Individual realtors | ✓ | | |
| Individual loan officers | ✓ | | |
| Financial planners | ✓ | | |
| Small brokerages (2–10 agents) | | ✓ | |
| Lending teams | | ✓ | |
| Large brokerages (10+) | | | ✓ |
| Mortgage companies | | | ✓ |
| Enterprise financial services | | | ✓ |

---

## 3. Unit Economics

### Monthly Infrastructure Cost Per User

| Cost Component | Free User | Pass User | Summit User | Pro Solo | Pro Team (per seat) |
|----------------|-----------|-----------|-------------|----------|-------------------|
| Cloud storage (S3/equivalent) | $0.25 | $0.75 | $1.00 | $2.00 | $2.50 |
| AI processing (Claude API) | $0.00 | $0.00 | $1.50 | $0.50 | $0.75 |
| Compute (servers/functions) | $0.15 | $0.30 | $0.40 | $0.60 | $0.80 |
| Database (Postgres/equivalent) | $0.10 | $0.20 | $0.25 | $0.40 | $0.50 |
| Email/notifications | $0.05 | $0.10 | $0.15 | $0.20 | $0.25 |
| Encryption overhead | $0.00 | $0.15 | $0.15 | $0.20 | $0.20 |
| CDN / bandwidth | $0.05 | $0.10 | $0.15 | $0.15 | $0.20 |
| Auth / identity | $0.05 | $0.05 | $0.05 | $0.10 | $0.10 |
| Monitoring / logging | $0.02 | $0.03 | $0.04 | $0.05 | $0.06 |
| **TOTAL MONTHLY COST** | **$0.67** | **$1.68** | **$3.69** | **$4.20** | **$5.36** |

### Revenue & Margin Per User

| Metric | Free | Pass | Summit | Pro Solo | Pro Team (per seat) |
|--------|------|------|--------|----------|-------------------|
| Price | $0 | $39 one-time | $79 one-time | $59/mo | $39.80/mo ($199/5) |
| Avg journey/subscription duration | 2 mo | 4 mo | 4 mo | 12 mo | 12 mo |
| Effective monthly revenue | $0.00 | $9.75 | $19.75 | $59.00 | $39.80 |
| Monthly infrastructure cost | $0.67 | $1.68 | $3.69 | $4.20 | $5.36 |
| **Monthly gross profit** | **($0.67)** | **$8.07** | **$16.06** | **$54.80** | **$34.44** |
| **Gross margin** | **N/A** | **82.8%** | **81.3%** | **92.9%** | **86.5%** |

### Lifetime Value

| Metric | Free | Pass | Summit | Pro Solo | Pro Team (per seat) |
|--------|------|------|--------|----------|-------------------|
| Lifetime revenue | $0.00 | $39.00 | $79.00 | $708.00 | $477.60 |
| Lifetime cost | $1.34 | $6.72 | $14.76 | $50.40 | $64.32 |
| **Lifetime gross profit** | **($1.34)** | **$32.28** | **$64.24** | **$657.60** | **$413.28** |

**Target gross margin: 85%** — Pro Solo exceeds target at 92.9%. Consumer tiers land at ~82% amortized, which is acceptable given their role as acquisition channels for professional upgrades and referrals.

---

## 4. Growth Assumptions (24-Month Model)

### User Acquisition

| Assumption | Value | Notes |
|-----------|-------|-------|
| Consumer free signups/month (initial) | 200 | Organic + content marketing |
| Consumer free monthly growth rate | 12% MoM | Compound growth |
| Free → Pass conversion rate | 8% | Of monthly free signups |
| Free → Summit conversion rate | 3% | Of monthly free signups |
| Consumer churn rate (monthly) | 15% | Users completing journeys |

### Professional Acquisition

| Assumption | Value | Notes |
|-----------|-------|-------|
| Pro Solo signups/month (initial) | 10 | Direct sales + referral |
| Pro Solo monthly growth rate | 10% MoM | |
| Pro Team signups/month (initial) | 3 | Teams, not seats |
| Pro Team monthly growth rate | 8% MoM | |
| Pro Enterprise signups/month (initial) | 1 | |
| Pro Enterprise monthly growth rate | 5% MoM | |
| Professional churn rate (monthly) | 4% | |

### Professional → Consumer Bridge

| Assumption | Value | Notes |
|-----------|-------|-------|
| Avg seats per Team account | 5 | |
| Avg seats per Enterprise account | 15 | |
| Clients invited per Pro Solo/month | 4 | Each gets Pass features free |
| Clients invited per Team seat/month | 3 | |
| Clients invited per Enterprise seat/month | 3 | |

### Add-On Revenue

| Assumption | Value | Notes |
|-----------|-------|-------|
| Doc verification attach rate | 15% | Of paid consumers |
| Doc verifications per user/month | 2 | |
| Doc verification price | $7 | Per document |

---

## 5. Implementation Spec (for Engineering)

### 5.1 User Type Enum

```typescript
enum UserType {
  CONSUMER_FREE = 'consumer_free',       // Default consumer, no payment
  CONSUMER_PASS = 'consumer_pass',       // One-time $39 purchase
  CONSUMER_SUMMIT = 'consumer_summit',   // One-time $79 purchase
  CONSUMER_INVITED = 'consumer_invited', // Invited by professional, gets Pass features free
  PRO_SOLO = 'pro_solo',                 // $59/mo individual professional
  PRO_TEAM = 'pro_team',                 // $199/mo for 5 seats
  PRO_ENTERPRISE = 'pro_enterprise',     // $799/mo unlimited seats
}
```

### 5.2 Feature Flags

Each feature flag has a gate type:

- **Paywall** — requires upgrade to access, show upgrade modal
- **Role** — requires professional account type
- **Add-on** — requires separate per-use payment
- **None** — available to all users

```typescript
interface FeatureFlag {
  flag: string;
  gateType: 'paywall' | 'role' | 'addon' | 'none';
  allowedUserTypes: UserType[];
}
```

#### Document Management Flags

| Flag | Gate | Allowed `user_type` values | Notes |
|------|------|---------------------------|-------|
| `doc_upload_unlimited` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Free tier: max 3 uploads, then paywall prompt |
| `doc_encrypted_storage` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | AES-256 encryption on stored documents |
| `doc_share_send` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Ability to share docs WITH others |
| `doc_share_receive` | None | ALL | All users can receive shared documents |
| `doc_ai_review` | Paywall | `consumer_summit`, `pro_*` | AI-powered document completeness review |
| `doc_concierge` | Paywall | `consumer_summit` | AI guidance on what documents to gather next |
| `doc_verification` | Add-on | `consumer_pass`, `consumer_summit`, `pro_*` | $7/doc add-on, requires separate payment |

#### Sharing Flags

| Flag | Gate | Allowed `user_type` values | Notes |
|------|------|---------------------------|-------|
| `share_link_generate` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Generate shareable links for document sets |
| `share_multiparty` | Paywall | `consumer_summit`, `pro_team`, `pro_enterprise` | Share with multiple professionals simultaneously |

#### Trail & Journey Flags

| Flag | Gate | Allowed `user_type` values | Notes |
|------|------|---------------------------|-------|
| `trail_full` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Free tier: 3-step basic trail only |
| `trail_timeline` | Paywall | `consumer_summit` | Estimated closing timeline |
| `trail_cost_estimator` | Paywall | `consumer_summit` | Closing cost calculator |
| `trail_notifications` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Milestone push/email notifications |

#### Theme & Experience Flags

| Flag | Gate | Allowed `user_type` values | Notes |
|------|------|---------------------------|-------|
| `theme_terrain_bg` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Terrain pattern backgrounds |
| `theme_dark_mode` | Paywall | `consumer_pass`, `consumer_summit`, `consumer_invited`, `pro_*` | Dark mode toggle |

#### Professional Flags

| Flag | Gate | Allowed `user_type` values | Notes |
|------|------|---------------------------|-------|
| `pro_client_dashboard` | Role | `pro_solo`, `pro_team`, `pro_enterprise` | Professional client management dashboard |
| `pro_invite_clients` | Role | `pro_solo`, `pro_team`, `pro_enterprise` | Invite clients to platform |
| `pro_client_tracking` | Role | `pro_solo`, `pro_team`, `pro_enterprise` | Track all client document status |
| `pro_team_visibility` | Role | `pro_team`, `pro_enterprise` | See all team members' client lists |
| `pro_role_access` | Role | `pro_team`, `pro_enterprise` | Admin vs associate role assignment |
| `pro_cobrand` | Role | `pro_team`, `pro_enterprise` | Co-branding on client experience |
| `pro_whitelabel` | Role | `pro_enterprise` | Full custom branding |
| `pro_api` | Role | `pro_enterprise` | API access for integrations |
| `pro_crm_integration` | Role | `pro_enterprise` | CRM/LOS integration |
| `pro_compliance` | Role | `pro_enterprise` | Compliance reporting and audit trail |
| `pro_analytics_team` | Role | `pro_team`, `pro_enterprise` | Team-level analytics dashboard |
| `pro_sla` | Role | `pro_enterprise` | SLA support tier |

### 5.3 Usage Limits

| Limit Key | `user_type` | Value | Enforcement |
|-----------|-------------|-------|-------------|
| `max_doc_uploads` | `consumer_free` | 3 | Hard limit, show upgrade prompt |
| `max_doc_uploads` | `consumer_pass` | unlimited | — |
| `max_doc_uploads` | `consumer_summit` | unlimited | — |
| `max_active_clients` | `pro_solo` | 15 | Soft limit, show add-on upsell at 12 |
| `max_active_clients` | `pro_team` | 50 | Soft limit, show enterprise upsell at 40 |
| `max_active_clients` | `pro_enterprise` | unlimited | — |
| `max_seats` | `pro_solo` | 1 | Hard limit |
| `max_seats` | `pro_team` | 5 | Can purchase additional at $15/seat/mo |
| `max_seats` | `pro_enterprise` | unlimited | — |
| `journey_duration_months` | `consumer_pass` | 12 | Show extension upsell at month 10 |
| `journey_duration_months` | `consumer_summit` | 18 | Show extension upsell at month 16 |
| `trail_steps_visible` | `consumer_free` | 3 | Show first 3 steps, blur remainder |

### 5.4 Paywall Trigger Points

These are the specific UX moments where upgrade prompts appear.

| Trigger | Current `user_type` | Upsell Target | UX Pattern |
|---------|-------------------|---------------|------------|
| 4th document upload attempt | `consumer_free` | `consumer_pass` | **Modal:** "Unlock unlimited uploads" with Pass/Summit comparison table |
| Try to share a document | `consumer_free` | `consumer_pass` | **Modal:** "Share securely with your team" with encryption messaging |
| Click blurred trail step | `consumer_free` | `consumer_pass` | **Inline:** blur clears to reveal, then paywall overlay |
| Try to enable dark mode | `consumer_free` | `consumer_pass` | **Settings:** toggle disabled with "Upgrade to unlock" tooltip |
| Try to use AI review | `consumer_pass` | `consumer_summit` | **Modal:** "Get AI-powered document review" Summit upsell |
| 12th active client added | `pro_solo` | `pro_team` | **Dashboard banner:** approaching client limit |
| Try to add 2nd seat | `pro_solo` | `pro_team` | **Modal:** "Add your team" with Team plan comparison |
| Try to access API | `pro_team` | `pro_enterprise` | **Settings:** "API access available on Enterprise" |
| Month 10 of journey | `consumer_pass` | Extension add-on | **Email + in-app:** "Your journey continues" extension offer |

### 5.5 Billing Implementation Notes

#### Consumer (One-Time via Stripe)

- `consumer_free` → `consumer_pass`: Stripe Checkout session, one-time $39 charge
- `consumer_free` → `consumer_summit`: Stripe Checkout session, one-time $79 charge
- `consumer_pass` → `consumer_summit`: Stripe Checkout session, $40 upgrade charge (credit original $39)
- Journey start date recorded at payment; `journey_duration_months` countdown begins
- Extension add-on: separate Stripe Checkout session, $19 one-time

#### Professional (Subscription via Stripe)

- `pro_solo`: Stripe Subscription, $59/mo or $590/yr
- `pro_team`: Stripe Subscription, $199/mo or $1,990/yr
- `pro_enterprise`: Stripe Subscription, $799/mo annual-only ($7,990/yr)
- Additional seats (Team): Stripe metered billing, $15/seat/mo
- Upgrade path: prorate remaining billing period toward new tier
- Downgrade: effective at end of current billing period

#### Invited Clients (`consumer_invited`)

- Created when a professional invites a client via `pro_invite_clients`
- Automatically receives `consumer_pass` feature access at no charge
- `consumer_invited` status persists as long as the inviting professional's subscription is active
- If professional subscription lapses, `consumer_invited` downgrades to `consumer_free` with a prompt to purchase their own Pass
- If an invited client independently purchases Pass or Summit, their `user_type` upgrades and is no longer tied to the professional's subscription

### 5.6 Database Schema Considerations

```typescript
interface User {
  id: string;
  email: string;
  user_type: UserType;
  created_at: Date;
  journey_started_at: Date | null;      // Consumer: when they paid
  journey_expires_at: Date | null;      // Consumer: journey_started_at + duration
  invited_by_pro_id: string | null;     // For consumer_invited
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null; // Pro tiers only
}

interface Organization {
  id: string;
  name: string;
  plan: 'pro_solo' | 'pro_team' | 'pro_enterprise';
  max_seats: number;
  max_active_clients: number;
  cobrand_enabled: boolean;
  whitelabel_enabled: boolean;
  api_enabled: boolean;
  stripe_subscription_id: string;
}

interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'admin' | 'associate';
  joined_at: Date;
}

interface ClientInvitation {
  id: string;
  org_id: string;
  invited_by_user_id: string;
  client_user_id: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: Date;
  accepted_at: Date | null;
}
```

### 5.7 Feature Check Helper (Pseudocode)

```typescript
function canAccess(user: User, flag: string): boolean {
  const featureConfig = FEATURE_FLAGS[flag];

  if (featureConfig.gateType === 'none') return true;

  if (featureConfig.gateType === 'addon') {
    // Check if user has purchased the add-on
    return hasActiveAddon(user.id, flag);
  }

  // Check if user's type is in the allowed list
  if (featureConfig.allowedUserTypes.includes(user.user_type)) {
    return true;
  }

  // Check wildcard pro access
  if (featureConfig.allowedUserTypes.includes('pro_*') && user.user_type.startsWith('pro_')) {
    return true;
  }

  // Check journey expiration for consumers
  if (user.user_type === 'consumer_pass' || user.user_type === 'consumer_summit') {
    if (user.journey_expires_at && user.journey_expires_at < new Date()) {
      return false; // Journey expired
    }
  }

  // Check invited client status
  if (user.user_type === 'consumer_invited') {
    const invitation = getActiveInvitation(user.id);
    if (!invitation || !isProSubscriptionActive(invitation.org_id)) {
      return false; // Pro subscription lapsed
    }
  }

  return false;
}

function checkLimit(user: User, limitKey: string): { allowed: boolean; current: number; max: number } {
  const limit = USAGE_LIMITS[limitKey][user.user_type];
  if (limit === 'unlimited') return { allowed: true, current: 0, max: Infinity };

  const current = getCurrentUsage(user.id, limitKey);
  return {
    allowed: current < limit,
    current,
    max: limit,
  };
}
```

---

## 6. Revenue Projections Summary (24-Month)

Based on the growth assumptions above, key milestones:

### Month 6

- ~1,800 total active users (consumers + professionals)
- ~$8,500 monthly revenue
- ~$6,800 monthly gross profit
- ~80% blended gross margin

### Month 12

- ~5,500 total active users
- ~$28,000 monthly revenue
- ~$23,500 monthly gross profit
- ~84% blended gross margin

### Month 18

- ~13,000 total active users
- ~$72,000 monthly revenue
- ~$62,000 monthly gross profit
- ~86% blended gross margin

### Month 24

- ~28,000 total active users
- ~$175,000 monthly revenue ($2.1M ARR)
- ~$153,000 monthly gross profit
- ~87% blended gross margin

> **Note:** These projections assume consistent growth rates and no major channel shifts. The full 24-month model with editable assumptions is in the companion spreadsheet (`clearpath-financial-model.xlsx`). Adjust the blue input cells to stress-test different scenarios.

### Revenue Mix at Month 24

- Pro subscriptions (Solo + Team + Enterprise): ~72% of revenue
- Consumer one-time purchases (Pass + Summit): ~22% of revenue
- Add-on revenue (doc verification): ~6% of revenue

Professional subscriptions are the primary revenue engine. Consumer tiers serve as the acquisition funnel — free users convert to paid, and professionals bring their clients onto the platform (creating more free users who may independently convert later).

---

## 7. Key Strategic Notes

### The Professional → Consumer Bridge

When a professional invites a client, that client gets Pass-level access for free. This is the most important growth mechanic because it eliminates friction during an already expensive process for the buyer, makes the professional look generous, drives consumer adoption and brand awareness, and creates a pool of users who already trust Clear Path and may return for future transactions (refinance, second home purchase) as direct-paying consumers.

### Margin Protection

The 85% gross margin target is achievable across the professional tiers. Consumer tiers land slightly below at ~82%, which is acceptable because they function as acquisition channels. The key cost lever is AI processing (Claude API) — batching document reviews and caching common document type analysis can reduce the Summit tier's AI cost from $1.50 to under $0.80/user/month.

### Pricing Discipline

Launch with three visible prices only: Free, $39 Pass, and $59/mo Pro Solo. Add Team and Enterprise tiers once there are 50+ paying professionals and real usage data to validate the unit economics. Overcomplicating pricing at launch creates decision paralysis on both sides of the market.
