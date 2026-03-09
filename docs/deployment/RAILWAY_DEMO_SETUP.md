# Railway Demo Environment Setup

This guide covers setting up the Inkra demo environment on Railway.

## Overview

The demo environment runs on Railway for:
- Fast iteration and deployment
- Customer demonstrations
- Internal testing
- **NO PHI - synthetic data only**

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository connected to Railway
- Access to third-party service credentials (see SERVICE_ISOLATION.md)

---

## Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose the `ufo/scribe` repository
5. Railway will detect `railway.toml` and configure automatically

---

## Step 2: Add PostgreSQL

1. In your Railway project, click "New Service"
2. Select "Database" > "PostgreSQL"
3. Railway will provision a PostgreSQL instance

### Enable pgvector Extension

After PostgreSQL is provisioned:

```bash
# Connect to Railway PostgreSQL
railway connect postgres

# Run in psql:
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
\dx
```

Or via Railway CLI:
```bash
railway run --service postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Step 3: Add Redis

1. In your Railway project, click "New Service"
2. Select "Database" > "Redis"
3. Railway will provision a Redis instance

---

## Step 4: Configure Environment Variables

In Railway project settings, add these environment variables:

### Database (Auto-configured by Railway)
```
DATABASE_URL         # Auto-set by Railway
DIRECT_URL           # Set to same as DATABASE_URL
```

### Redis (Auto-configured by Railway)
```
REDIS_URL            # Auto-set by Railway
```

### Authentication (Supabase Demo)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxdemo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...demo
SUPABASE_SERVICE_ROLE_KEY=eyJ...demo
```

### Application
```
NEXT_PUBLIC_APP_URL=https://demo.inkra.app
NODE_ENV=production
CRON_SECRET=<generate with: openssl rand -hex 32>
JOBS_API_KEY=<generate with: openssl rand -hex 32>
```

### AI Services
```
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...  # Optional, for embeddings
```

### ML Services
```
ML_SERVICE_URL=https://ml.inkra.app  # Or internal Railway URL if co-located
ML_SERVICE_API_KEY=<generate with: openssl rand -base64 32>
```

### Transcription
```
DEEPGRAM_API_KEY=...demo
```

### VoIP (Twilio Demo Subaccount)
```
TWILIO_ACCOUNT_SID=AC...demo
TWILIO_AUTH_TOKEN=...demo
TWILIO_TWIML_APP_SID=AP...demo
TWILIO_API_KEY=SK...demo
TWILIO_API_SECRET=...demo
TWILIO_PHONE_NUMBER=+15550001234
```

### Payments (Stripe Test Mode)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Storage (AWS Demo Bucket)
```
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=AKIA...demo
AWS_SECRET_ACCESS_KEY=...demo
AWS_S3_BUCKET_UPLOADS=scrybe-uploads-demo
AWS_S3_BUCKET_RECORDINGS=scrybe-recordings-demo
AWS_S3_BUCKET_EXPORTS=scrybe-exports-demo
# No KMS key for demo - uses SSE-S3
```

### MFA & Security
```
MFA_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
TRUSTED_DEVICE_SECRET=<generate with: openssl rand -hex 32>
```

### Logging (Optional)
```
LOG_LEVEL=info
SENTRY_DSN=https://...@sentry.io/demo-project
```

---

## Step 5: Configure Custom Domain

1. In Railway project settings, go to "Settings" > "Domains"
2. Add custom domain: `demo.inkra.app`
3. Configure DNS:
   - Add CNAME record: `demo.inkra.app` → `<railway-provided-value>`
4. Railway will auto-provision SSL certificate

---

## Step 6: Configure Twilio Webhooks

In Twilio Console (Demo subaccount):

1. Go to Phone Numbers > Manage > Active Numbers
2. Select your demo number
3. Configure webhooks:

| Event | URL |
|-------|-----|
| Voice incoming | `https://demo.inkra.app/api/webhooks/twilio/voice` |
| Voice status | `https://demo.inkra.app/api/webhooks/twilio/status` |

4. Go to TwiML Apps and configure:

| Setting | Value |
|---------|-------|
| Voice Request URL | `https://demo.inkra.app/api/webhooks/twilio/voice` |
| Voice Status Callback | `https://demo.inkra.app/api/webhooks/twilio/status` |

---

## Step 7: Configure Stripe Webhooks

In Stripe Dashboard (Test mode):

1. Go to Developers > Webhooks
2. Add endpoint: `https://demo.inkra.app/api/billing/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Step 8: Run Database Migrations

Railway runs migrations automatically via `railway.toml`:

```toml
[build]
buildCommand = "npm run db:generate && npx prisma db push && npm run build"
```

For manual migrations:
```bash
railway run npx prisma migrate deploy
```

---

## Step 9: Verify Deployment

### Health Check
```bash
curl https://demo.inkra.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-03-08T..."
}
```

### Database Check
```bash
railway run npx prisma db pull
```

### Test Authentication
1. Go to `https://demo.inkra.app/login`
2. Create test account
3. Verify email (check Supabase logs if needed)

### Test Calling (Optional)
1. Create test client
2. Initiate test call
3. Verify recording uploads to demo S3 bucket

---

## Monitoring

### Railway Logs
```bash
railway logs
```

### Railway Metrics
- Go to Railway Dashboard > Project > Metrics
- Monitor: CPU, Memory, Network

### Sentry (if configured)
- Go to Sentry Dashboard
- Monitor errors in demo project

---

## Troubleshooting

### Database Connection Issues
```bash
# Verify DATABASE_URL is set correctly
railway variables

# Test connection
railway run npx prisma db pull
```

### pgvector Not Found
```bash
# Connect and create extension
railway connect postgres
CREATE EXTENSION vector;
```

### Webhook Failures
1. Check Railway logs for incoming requests
2. Verify webhook URLs in Twilio/Stripe
3. Verify webhook secrets match environment variables

### Memory Issues
Railway free tier has memory limits. If you see OOM:
1. Upgrade to Pro plan
2. Or optimize memory usage in `next.config.js`

---

## Cost Estimation

| Service | Monthly Cost |
|---------|-------------|
| Railway Pro (app) | ~$5-20 |
| Railway PostgreSQL | ~$5-10 |
| Railway Redis | ~$5-10 |
| **Total** | ~$15-40/month |

---

## Next Steps

- [Service Isolation Guide](./SERVICE_ISOLATION.md) - Verify demo credentials
- [Production Setup](./AWS_PRODUCTION_SETUP.md) - Set up production on AWS
- [CI/CD Guide](./CICD_SETUP.md) - Configure automated deployments
