# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scrybe is a full-stack SaaS platform for social services, nonprofits, and grant-funded organizations. It streamlines intake forms, automates data collection from calls using AI, and ensures compliance with audit requirements.

## Common Commands

```bash
# Development
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production
npm run lint             # Run ESLint

# Database (Prisma)
npm run db:generate      # Generate Prisma client after schema changes
npm run db:push          # Push schema to database (development)
npm run db:migrate       # Run migrations (production)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed          # Seed database with test data

# Testing
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:e2e:headed  # Run E2E tests in headed browser
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16+ (App Router) with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Supabase Auth (JWT-based, SSR-compatible)
- **State**: Jotai (atomic state management)
- **UI**: Tailwind CSS + shadcn/ui (Radix primitives)
- **AI**: Anthropic Claude API (extraction and form generation)
- **Voice**: Twilio (VoIP) + Deepgram (transcription)
- **Payments**: Stripe (subscriptions + one-time purchases)
- **Storage**: AWS S3 (file uploads, call recordings)

### Key Directories

```
src/app/
├── (auth)/           # Public auth pages (login, signup, password reset)
├── (dashboard)/      # Protected routes (forms, clients, calls, settings)
└── api/              # REST API endpoints (50+ routes)

src/lib/
├── ai/               # Claude integration (extraction.ts, generation, prompts)
├── auth/             # Server actions (signUp, signIn, etc.)
├── billing/          # Stripe integration (service.ts, webhooks.ts)
├── deepgram/         # Transcription service
├── form-builder/     # Jotai store for form builder state
├── services/         # Business logic (forms, calls, clients, locking)
├── supabase/         # Auth clients (server.ts, client.ts, middleware.ts)
├── twilio/           # VoIP integration (call-manager, webhooks)
└── db.ts             # Prisma client singleton

src/components/
├── ui/               # shadcn/ui primitives
├── form-builder/     # Form builder wizard components
├── conditional-logic/# React Flow-based logic editor
└── calls/            # Call interface components
```

### Authentication Flow
1. Middleware (`middleware.ts`) protects `/dashboard/*` routes
2. Supabase handles JWT tokens via `@supabase/ssr`
3. `src/lib/supabase/middleware.ts` refreshes sessions for Server Components
4. `src/lib/auth/actions.ts` contains server actions for auth operations
5. `/api/auth/sync-user` syncs Supabase user to Prisma database on first login

### Database Models (Prisma)
Key relationships in `prisma/schema.prisma`:
- **Organization** → Users, Teams, Forms, Clients (multi-tenant)
- **User** → Role-based (ADMIN, PROGRAM_MANAGER, CASE_MANAGER, VIEWER) with granular permissions
- **Form** → FormFields, FormVersions, FormSubmissions
- **Client** → Calls, Notes, FormSubmissions
- **Call** → Recording, transcript, AI-extracted data, linked forms
- **AuditLog** → Hash-chain for immutable compliance logging

### Form Builder State (Jotai)
Located in `src/lib/form-builder/store.ts`:
- `formBuilderAtom` - Main state (form, fields, selectedFieldId, isDirty)
- `wizardStepAtom` - Current step (setup, fields, organize, logic, preview, ai-config, publish)
- Derived atoms for computed state (sortedFields, fieldsBySection, canPublish)
- Action atoms for mutations (addField, updateField, reorderFields)

### Call Processing Pipeline
1. Initiate call → `POST /api/calls`
2. Twilio webhook receives call → TwiML response with recording
3. Call ends → Status webhook updates Call record
4. Recording ready → Upload to S3, trigger `/api/calls/[callId]/process`
5. Async job: Deepgram transcription → Claude extraction → FormSubmission creation
6. Case manager reviews and finalizes

### AI Integration (`src/lib/ai/`)
- **extraction.ts**: `extractFormData()` - Takes fields + transcript → parsed JSON with confidence scores
- **generation-prompts.ts**: Form generation from natural language requirements
- **client.ts**: Lazy-loaded Anthropic SDK (server-side only)

### Resource Locking
`src/lib/services/resource-locking.ts` provides pessimistic locking for concurrent editing:
- 5-minute lock duration with heartbeat refresh
- `/api/locks` endpoints for acquire/release
- Prevents conflicting edits on form submissions

### Webhook Endpoints
- `/api/webhooks/twilio/voice` - Incoming call TwiML
- `/api/webhooks/twilio/status` - Call status updates
- `/api/webhooks/twilio/recording` - Recording URL callback
- `/api/billing/webhook` - Stripe subscription events

## Important Patterns

### Server Actions
Auth operations use React Server Actions in `src/lib/auth/actions.ts` with `useFormState` pattern.

### API Route Organization
Routes follow RESTful patterns with org-level isolation:
- `/api/forms/[formId]/fields/[fieldId]` - Nested resources
- `/api/clients/[clientId]/calls` - Related resources
- Most endpoints require authenticated user with org context

### Multi-tenancy
All data is scoped to `organizationId`. Middleware enforces auth, and services filter by org.

### Conditional Logic
Form fields support conditional show/hide via `FormField.conditionalLogic` JSON field, visualized with React Flow in the logic editor step.
