# Production Deployment Checklist

This checklist covers everything needed to deploy Scrybe to production.

---

## Critical - Must Fix Before Launch

### Secrets Management
- [ ] Add `.env.local` to `.gitignore`
- [ ] Remove `.env.local` from git history
- [ ] Rotate ALL exposed credentials:
  - [ ] Database password
  - [ ] Supabase keys
  - [ ] Twilio credentials
  - [ ] Stripe keys
  - [ ] Anthropic API key
  - [ ] Any other API keys

### Database
- [ ] Set `DATABASE_URL` in production environment
- [ ] Set `DIRECT_URL` in production environment
- [ ] Run `npm run db:push` to push schema to production database
- [ ] Verify database connection pooling is configured

### Authentication (Supabase)
- [ ] Create production Supabase project
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configure auth redirect URLs for production domain
- [ ] Enable email confirmations in Supabase dashboard

### Application URL
- [ ] Set `NEXT_PUBLIC_APP_URL` to production domain (e.g., `https://app.scrybe.com`)

---

## High Priority - External Services

### Twilio (Voice Calls)
- [ ] Set `TWILIO_ACCOUNT_SID`
- [ ] Set `TWILIO_AUTH_TOKEN`
- [ ] Set `TWILIO_API_KEY`
- [ ] Set `TWILIO_API_SECRET`
- [ ] Create TwiML App in Twilio Console
- [ ] Set TwiML App Voice Request URL to `https://yourdomain.com/api/webhooks/twilio/voice`
- [ ] Set TwiML App Status Callback URL to `https://yourdomain.com/api/webhooks/twilio/status`
- [ ] Set `TWILIO_TWIML_APP_SID`
- [ ] Verify Twilio account has funds

### Deepgram (Transcription)
- [ ] Sign up at deepgram.com
- [ ] Set `DEEPGRAM_API_KEY`
- [ ] Verify transcription works with test audio

### Stripe (Billing)
- [ ] Set `STRIPE_SECRET_KEY`
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Create products in Stripe Dashboard:
  - [ ] Starter Plan
  - [ ] Professional Plan
  - [ ] Enterprise Plan
  - [ ] Form Packs (5, 10, 25)
- [ ] Set price ID environment variables:
  - [ ] `STRIPE_STARTER_MONTHLY_PRICE_ID`
  - [ ] `STRIPE_STARTER_YEARLY_PRICE_ID`
  - [ ] `STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID`
  - [ ] `STRIPE_PROFESSIONAL_YEARLY_PRICE_ID`
  - [ ] `STRIPE_ENTERPRISE_MONTHLY_PRICE_ID`
  - [ ] `STRIPE_ENTERPRISE_YEARLY_PRICE_ID`
- [ ] Create webhook endpoint in Stripe Dashboard pointing to `https://yourdomain.com/api/billing/webhook`
- [ ] Set `STRIPE_WEBHOOK_SECRET`

### AWS S3 (File Storage & Recordings)
- [ ] Create S3 bucket for recordings and file uploads
- [ ] Enable versioning on bucket
- [ ] Enable server-side encryption
- [ ] Configure CORS policy for bucket
- [ ] Create IAM user with minimal S3 permissions
- [ ] Set `AWS_ACCESS_KEY_ID`
- [ ] Set `AWS_SECRET_ACCESS_KEY`
- [ ] Set `AWS_S3_BUCKET`
- [ ] Set `AWS_REGION`

### Anthropic (AI Extraction)
- [ ] Set `ANTHROPIC_API_KEY` (production key)
- [ ] Verify API usage limits are sufficient

---

## Medium Priority - Email & Security

### Email Service (AWS SES)
- [ ] Verify domain in AWS SES
- [ ] Move out of SES sandbox (if needed)
- [ ] Set `AWS_SES_REGION`
- [ ] Set `AWS_SES_FROM_EMAIL`
- [ ] Implement email service (currently stub at `src/lib/services/email-notifications.ts`)
- [ ] Test email notifications:
  - [ ] Phone number request approved
  - [ ] Phone number request rejected
  - [ ] User invitation

### Security Headers
- [ ] Add `Strict-Transport-Security` header
- [ ] Add `Content-Security-Policy` header
- [ ] Verify `X-Frame-Options: DENY` is set
- [ ] Verify `X-Content-Type-Options: nosniff` is set

### Rate Limiting
- [ ] Add rate limiting to `/api/auth/*` endpoints
- [ ] Add rate limiting to `/api/billing/webhook`
- [ ] Add rate limiting to phone number purchase endpoints

### Webhook Security
- [ ] Verify Twilio webhook signature validation is enabled
- [ ] Verify Stripe webhook signature validation is enabled

---

## Medium Priority - Optional Services

### File Scanning (ClamAV)
- [ ] Deploy ClamAV daemon (or use external service)
- [ ] Set `CLAMAV_HOST`
- [ ] Set `CLAMAV_PORT`
- [ ] OR set `SCANNER_API_URL` and `SCANNER_API_KEY` for external scanner

### Address Autocomplete (Radar)
- [ ] Sign up at radar.com (or use alternative)
- [ ] Set `NEXT_PUBLIC_RADAR_KEY`
- [ ] Set `RADAR_SECRET_KEY`

---

## Deployment

### Build Verification
- [ ] Run `npm run build` successfully
- [ ] Run `npm run lint` with no errors
- [ ] Test locally with `npm run start`

### Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Configure deployment platform (Railway/Vercel/Docker)
- [ ] Set all environment variables in deployment platform

### Post-Deployment Verification
- [ ] Verify `/api/health` endpoint returns all services OK
- [ ] Test user signup flow
- [ ] Test user login flow
- [ ] Test form creation
- [ ] Test phone number purchase (admin)
- [ ] Test phone number request (case manager)
- [ ] Test outbound call
- [ ] Test transcription processing
- [ ] Test AI extraction
- [ ] Test Stripe checkout flow

---

## Monitoring & Maintenance

### Error Tracking
- [ ] Set up error tracking service (Sentry, LogRocket, etc.)
- [ ] Configure error alerts

### Database Backups
- [ ] Verify automated backups are enabled
- [ ] Test backup restoration process
- [ ] Document backup schedule

### Logging
- [ ] Configure log aggregation
- [ ] Set up log alerts for errors

---

## Environment Variables Summary

```bash
# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_API_KEY=xxx
TWILIO_API_SECRET=xxx
TWILIO_TWIML_APP_SID=xxx

# Deepgram
DEEPGRAM_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_STARTER_MONTHLY_PRICE_ID=price_xxx
STRIPE_STARTER_YEARLY_PRICE_ID=price_xxx
STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID=price_xxx
STRIPE_PROFESSIONAL_YEARLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=price_xxx

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=scrybe-production
AWS_REGION=us-east-1

# AWS SES (Email)
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional: File Scanning
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Optional: Address Autocomplete
NEXT_PUBLIC_RADAR_KEY=xxx
RADAR_SECRET_KEY=xxx
```

---

## Quick Commands

```bash
# Fix .gitignore issue
echo ".env.local" >> .gitignore
git rm --cached .env.local
git commit -m "Stop tracking .env.local"

# Verify build
npm run build

# Push database schema
npm run db:push

# Generate Prisma client
npm run db:generate

# Test health endpoint
curl https://yourdomain.com/api/health
```

---

## Support Contacts

- **Twilio**: https://www.twilio.com/console
- **Stripe**: https://dashboard.stripe.com
- **Supabase**: https://app.supabase.com
- **Deepgram**: https://console.deepgram.com
- **AWS**: https://console.aws.amazon.com
