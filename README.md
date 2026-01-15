# Scrybe

A full-stack SaaS platform for social services, nonprofits, and grant-funded organizations. Scrybe streamlines intake forms, automates data collection from calls using AI, and ensures compliance with audit requirements.

## Features

- **Dynamic Form Builder** - Create intake, followup, assessment, and custom forms with conditional logic
- **Call Management** - VoIP integration with automatic recording and transcription
- **AI-Powered Extraction** - Automatically extract structured data from call transcripts using Claude AI
- **Client Management** - Track clients, calls, forms, and case notes
- **Compliance & Audit** - Immutable audit logs, digital signatures, and compliance reporting
- **Team Collaboration** - Role-based access control (Admin, Program Manager, Case Manager, Viewer)
- **Billing** - Tiered subscriptions with Stripe integration

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Supabase Auth
- **AI**: Anthropic Claude API
- **Transcription**: Deepgram
- **VoIP**: Twilio
- **Payments**: Stripe
- **Styling**: Tailwind CSS + shadcn/ui

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project (for auth)
- API keys for: Anthropic, Twilio, Deepgram, Stripe

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

See `.env.example` for all required environment variables. Key services:

- **Database**: PostgreSQL connection string
- **Supabase**: Auth configuration
- **Anthropic**: Claude AI API key
- **Twilio**: VoIP integration
- **Deepgram**: Transcription service
- **Stripe**: Payment processing
- **Radar**: Address autocomplete

## Deployment (Railway)

1. **Create a new project on [Railway](https://railway.app)**

2. **Add a PostgreSQL database**
   - Click "New" → "Database" → "PostgreSQL"
   - Copy the `DATABASE_URL` from the database settings

3. **Deploy the app**
   - Connect your GitHub repository, or
   - Use Railway CLI: `railway up`

4. **Set environment variables**
   In your Railway project settings, add all variables from `.env.example`:
   - `DATABASE_URL` (from Railway PostgreSQL)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Railway domain)
   - `ANTHROPIC_API_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - `DEEPGRAM_API_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Stripe product IDs
   - `NEXT_PUBLIC_RADAR_KEY`, `RADAR_SECRET_KEY`

5. **Generate a domain**
   - Go to Settings → Networking → Generate Domain

## License

Private - All rights reserved
