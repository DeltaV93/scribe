# Scrybe

A full-stack SaaS platform for social services, nonprofits, and grant-funded organizations. Scrybe streamlines intake forms, automates data collection from calls using AI, and ensures compliance with audit requirements.

## Features

### Core Capabilities
- **Dynamic Form Builder** - Create intake, followup, assessment, and custom forms with conditional logic
- **Call Management** - VoIP integration with automatic recording and transcription
- **AI-Powered Extraction** - Automatically extract structured data from call transcripts using Claude AI
- **Client Management** - Track clients, calls, forms, and case notes
- **Compliance & Audit** - Immutable audit logs, digital signatures, and compliance reporting
- **Team Collaboration** - Role-based access control (Admin, Program Manager, Case Manager, Viewer)
- **Billing** - Tiered subscriptions with Stripe integration

### Meeting Intelligence
- **Meeting Transcription** - Automatic transcription of meetings from Teams, Zoom, and Google Meet
- **AI Summarization** - Generate structured meeting summaries with action items and key decisions
- **Email Distribution** - Automatically distribute meeting summaries to participants

### Knowledge Base
- **Semantic Search** - Search across all organizational knowledge using AI-powered semantic search
- **Document Indexing** - Automatically index meeting notes, call transcripts, and documents

### Data Integration
- **Funder-Specific Exports** - Generate compliant exports for CAP60, DOL WIPS, CalGrants, and HUD HMIS
- **Smart Imports** - Import data from spreadsheets with AI-powered field mapping
- **Scheduled Reports** - Configure automated export schedules for recurring reporting needs

### Additional Features
- **Meeting Platform Integrations** - Connect Microsoft Teams, Zoom, and Google Meet calendars
- **Location-Based Access Control** - Restrict data access based on geographic regions
- **Mass Notes** - Create notes for multiple clients simultaneously
- **Photo/PDF-to-Form Conversion** - Extract form data from scanned documents and photos using AI
- **Automated Reporting** - Schedule and automate compliance and program reports

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Supabase Auth
- **AI**: Anthropic Claude API, OpenAI (embeddings)
- **Transcription**: Deepgram
- **VoIP**: Twilio
- **Payments**: Stripe
- **Email**: SendGrid or AWS SES
- **Storage**: AWS S3
- **Job Queue**: Redis + BullMQ
- **Styling**: Tailwind CSS + shadcn/ui

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis (for job queue)
- Supabase project (for auth)
- API keys for: Anthropic, OpenAI, Twilio, Deepgram, Stripe, SendGrid (or AWS SES)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scrybe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your environment variables in `.env.local`

4. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed the database |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (signup, login)
│   ├── (dashboard)/        # Protected dashboard routes
│   └── api/                # REST API endpoints
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── form-builder/       # Form builder components
│   └── ...                 # Feature-specific components
├── lib/                    # Utilities and services
│   ├── ai/                 # Claude AI integration
│   ├── twilio/             # Twilio VoIP integration
│   └── ...                 # Other services
├── hooks/                  # React hooks
└── types/                  # TypeScript types
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Seed data
docs/                       # Documentation
```

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/scrybe

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Transcription
DEEPGRAM_API_KEY=your-deepgram-key

# Email (choose one)
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
# OR
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# Storage
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key

# Redis (for job queue)
REDIS_URL=redis://localhost:6379
```

### Optional - Meeting Integrations

```bash
# Microsoft Teams
TEAMS_CLIENT_ID=your-teams-client-id
TEAMS_CLIENT_SECRET=your-teams-client-secret

# Zoom
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_WEBHOOK_SECRET_TOKEN=your-zoom-webhook-token

# Google Meet
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Other Services

```bash
# VoIP
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Payments
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Address Autocomplete
NEXT_PUBLIC_RADAR_KEY=prj_...
RADAR_SECRET_KEY=prj_...

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Deployment (Railway)

1. **Create a new project on [Railway](https://railway.app)**

2. **Add databases**
   - Click "New" → "Database" → "PostgreSQL"
   - Click "New" → "Database" → "Redis"
   - Copy the connection URLs from each database's settings

3. **Deploy the app**
   - Connect your GitHub repository, or
   - Use Railway CLI: `railway up`

4. **Set environment variables**
   In your Railway project settings, add all required variables:
   - `DATABASE_URL` (from Railway PostgreSQL)
   - `REDIS_URL` (from Railway Redis)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Railway domain)
   - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - `DEEPGRAM_API_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (or AWS SES equivalents)
   - `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - Meeting integration keys (optional)

5. **Generate a domain**
   - Go to Settings → Networking → Generate Domain

## License

Private - All rights reserved
