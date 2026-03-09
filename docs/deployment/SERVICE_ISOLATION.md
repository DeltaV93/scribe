# Service Isolation Guide

This document details the isolation strategy between Demo and Production environments for Inkra.

## Overview

Inkra maintains **complete isolation** between Demo and Production environments. No credentials, data, or resources are shared.

| Aspect | Demo | Production |
|--------|------|------------|
| **Purpose** | Customer demos, internal testing | Real customer data, PHI |
| **PHI Allowed** | No | Yes |
| **BAA Required** | No | Yes |
| **SOC2 Scope** | Out of scope | In scope |

---

## Third-Party Service Isolation

### 1. Supabase Authentication

Create two separate Supabase projects:

| Setting | Demo | Production |
|---------|------|------------|
| **Project Name** | `inkra-demo` | `inkra-prod` |
| **Region** | Any | `us-west-2` (HIPAA region) |
| **Plan** | Free/Pro | Pro (for BAA) |

**Setup Steps:**
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create new project `inkra-demo`
3. Create new project `inkra-prod`
4. Enable Row Level Security on both
5. Configure auth providers (email, Google, etc.) on both
6. For production: Contact Supabase for BAA signing

**Environment Variables:**
```bash
# Demo
NEXT_PUBLIC_SUPABASE_URL=https://xxxdemo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...demo
SUPABASE_SERVICE_ROLE_KEY=eyJ...demo

# Production
NEXT_PUBLIC_SUPABASE_URL=https://xxxprod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...prod
SUPABASE_SERVICE_ROLE_KEY=eyJ...prod
```

---

### 2. Twilio VoIP

Create two Twilio subaccounts:

| Setting | Demo | Production |
|---------|------|------------|
| **Subaccount Name** | `Inkra Demo` | `Inkra Production` |
| **Phone Number** | Test number (+1555...) | Production number |
| **Webhook URL** | `https://demo.inkra.app/api/webhooks/twilio/*` | `https://app.inkra.app/api/webhooks/twilio/*` |

**Setup Steps:**
1. Log into [Twilio Console](https://console.twilio.com)
2. Go to Account > Subaccounts
3. Create subaccount `Inkra Demo`
4. Create subaccount `Inkra Production`
5. Purchase phone numbers in each subaccount
6. Create TwiML apps in each subaccount
7. Generate API keys for each subaccount

**Environment Variables:**
```bash
# Demo
TWILIO_ACCOUNT_SID=AC...demo
TWILIO_AUTH_TOKEN=...demo
TWILIO_TWIML_APP_SID=AP...demo
TWILIO_API_KEY=SK...demo
TWILIO_API_SECRET=...demo
TWILIO_PHONE_NUMBER=+15550001234

# Production
TWILIO_ACCOUNT_SID=AC...prod
TWILIO_AUTH_TOKEN=...prod
TWILIO_TWIML_APP_SID=AP...prod
TWILIO_API_KEY=SK...prod
TWILIO_API_SECRET=...prod
TWILIO_PHONE_NUMBER=+1...real
```

---

### 3. Stripe Payments

Use Stripe's built-in test/live mode separation:

| Setting | Demo | Production |
|---------|------|------------|
| **Mode** | Test | Live |
| **Webhook Endpoint** | `https://demo.inkra.app/api/billing/webhook` | `https://app.inkra.app/api/billing/webhook` |

**Setup Steps:**
1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Toggle to Test Mode for demo keys
3. Toggle to Live Mode for production keys
4. Create webhook endpoints for each environment
5. Create products and prices in both modes (or clone from test)

**Environment Variables:**
```bash
# Demo (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Production (Live Mode)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

### 4. AWS (S3, KMS, IAM)

Create separate IAM users/roles for each environment:

| Resource | Demo | Production |
|----------|------|------------|
| **IAM User/Role** | `inkra-demo` | `inkra-prod-ecs-task` |
| **S3 Buckets** | `scrybe-*-demo` | `scrybe-*-prod` |
| **KMS Key** | None (SSE-S3) | Customer-managed CMK |
| **Encryption** | SSE-S3 | SSE-KMS |
| **Replication** | Disabled | Cross-region enabled |

**Demo IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::scrybe-uploads-demo/*",
        "arn:aws:s3:::scrybe-recordings-demo/*"
      ]
    }
  ]
}
```

**Production**: Uses ECS task role with KMS permissions (see Terraform).

**Environment Variables:**
```bash
# Demo
AWS_ACCESS_KEY_ID=AKIA...demo
AWS_SECRET_ACCESS_KEY=...demo
AWS_S3_BUCKET_UPLOADS=scrybe-uploads-demo
AWS_S3_BUCKET_RECORDINGS=scrybe-recordings-demo
# No KMS key - uses SSE-S3

# Production
# Uses ECS task role - no static credentials
AWS_KMS_KEY_ARN=arn:aws:kms:us-west-2:xxx:key/yyy
AWS_S3_BUCKET_UPLOADS=scrybe-uploads-prod
AWS_S3_BUCKET_RECORDINGS=scrybe-recordings-prod
```

---

### 5. Deepgram Transcription

Create separate API keys:

| Setting | Demo | Production |
|---------|------|------------|
| **Project** | `Inkra Demo` | `Inkra Production` |
| **API Key Scope** | Full | Full |
| **Usage Tracking** | Separate | Separate |

**Setup Steps:**
1. Log into [Deepgram Console](https://console.deepgram.com)
2. Create project `Inkra Demo`
3. Create project `Inkra Production`
4. Generate API key in each project

**Environment Variables:**
```bash
# Demo
DEEPGRAM_API_KEY=...demo

# Production
DEEPGRAM_API_KEY=...prod
```

---

### 6. Anthropic Claude

Shared API key is acceptable since:
- No PHI is sent in prompts (only field definitions)
- Transcript content is anonymized before extraction
- Anthropic does not store API data

**Environment Variables:**
```bash
# Both environments
ANTHROPIC_API_KEY=sk-ant-api03-...
```

If strict isolation is required, create separate Anthropic organizations.

---

## Database Isolation

| Component | Demo | Production |
|-----------|------|------------|
| **Provider** | Railway PostgreSQL | AWS Aurora |
| **Extensions** | pgvector | pgvector |
| **Encryption** | In-transit only | At-rest + in-transit |
| **Backups** | Railway automatic | 7-day automated + cross-region |

**Connection Strings:**
```bash
# Demo
DATABASE_URL=postgresql://user:pass@railway.internal:5432/inkra_demo

# Production
DATABASE_URL=postgresql://user:pass@inkra-prod.cluster-xxx.us-west-2.rds.amazonaws.com:5432/inkra?sslmode=require
```

---

## Redis/Cache Isolation

| Component | Demo | Production |
|-----------|------|------------|
| **Provider** | Railway Redis | AWS ElastiCache |
| **Encryption** | In-transit only | At-rest + in-transit |
| **Auth** | Password | Auth token |

**Connection Strings:**
```bash
# Demo
REDIS_URL=redis://default:pass@railway.internal:6379

# Production
REDIS_URL=rediss://user:token@inkra-prod.xxx.cache.amazonaws.com:6379
```

---

## Domain Configuration

| Domain | Environment | Provider |
|--------|-------------|----------|
| `demo.inkra.app` | Demo | Railway |
| `app.inkra.app` | Production | Vercel/CloudFront |
| `ml.inkra.app` | Production ML Services | AWS ALB |

---

## Verification Checklist

Before deploying, verify:

- [ ] Supabase: Two separate projects exist
- [ ] Twilio: Two separate subaccounts exist
- [ ] Stripe: Test keys for demo, live keys for production
- [ ] AWS: Demo IAM user cannot access prod buckets
- [ ] AWS: Prod IAM role cannot access demo buckets
- [ ] Deepgram: Two separate API keys
- [ ] Database: Demo connection string points to Railway
- [ ] Database: Prod connection string points to Aurora
- [ ] Redis: Demo points to Railway, Prod to ElastiCache
- [ ] Domains: Configured correctly in DNS

---

## Emergency: Cross-Environment Access

If you ever need to access production data from a non-production system:

1. **Don't.** This violates SOC2 and potentially HIPAA.
2. If absolutely necessary (security incident), follow the incident response procedure.
3. All access must be logged and reviewed by security team.
4. Create a ticket documenting the reason and approval.
