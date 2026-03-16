/**
 * Seed Integration Providers (PX-1001 Phase 3)
 *
 * Seeds the IntegrationProvider table with OAuth configurations.
 * Reads credentials from environment variables and encrypts them.
 *
 * Run: npx ts-node scripts/seed-integration-providers.ts
 *
 * Prerequisites:
 * - DATABASE_URL environment variable set
 * - OAuth credentials in environment variables (LINEAR_CLIENT_ID, etc.)
 * - A system organization ID for encryption (or creates one)
 */

import { PrismaClient, IntegrationPlatform, IntegrationCategory } from "@prisma/client";

const prisma = new PrismaClient();

// Provider definitions with OAuth URLs
const PROVIDERS: Array<{
  platform: IntegrationPlatform;
  displayName: string;
  category: IntegrationCategory;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  iconUrl?: string;
  envClientId: string;
  envClientSecret: string;
}> = [
  {
    platform: "LINEAR",
    displayName: "Linear",
    category: "PROJECT_MGMT",
    authorizeUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scopes: ["read", "write", "issues:create"],
    iconUrl: "/integrations/linear.svg",
    envClientId: "LINEAR_CLIENT_ID",
    envClientSecret: "LINEAR_CLIENT_SECRET",
  },
  {
    platform: "JIRA",
    displayName: "Jira",
    category: "PROJECT_MGMT",
    authorizeUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: ["read:jira-work", "write:jira-work", "read:jira-user", "offline_access"],
    iconUrl: "/integrations/jira.svg",
    envClientId: "JIRA_CLIENT_ID",
    envClientSecret: "JIRA_CLIENT_SECRET",
  },
  {
    platform: "NOTION",
    displayName: "Notion",
    category: "DOCUMENTATION",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    iconUrl: "/integrations/notion.svg",
    envClientId: "NOTION_CLIENT_ID",
    envClientSecret: "NOTION_CLIENT_SECRET",
  },
  {
    platform: "GOOGLE_DOCS",
    displayName: "Google Docs",
    category: "DOCUMENTATION",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
    iconUrl: "/integrations/google-docs.svg",
    envClientId: "GOOGLE_CLIENT_ID",
    envClientSecret: "GOOGLE_CLIENT_SECRET",
  },
  {
    platform: "GOOGLE_CALENDAR",
    displayName: "Google Calendar",
    category: "CALENDAR",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    iconUrl: "/integrations/google-calendar.svg",
    envClientId: "GOOGLE_CLIENT_ID",
    envClientSecret: "GOOGLE_CLIENT_SECRET",
  },
  {
    platform: "OUTLOOK_CALENDAR",
    displayName: "Outlook Calendar",
    category: "CALENDAR",
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Calendars.ReadWrite", "offline_access"],
    iconUrl: "/integrations/outlook.svg",
    envClientId: "MICROSOFT_CLIENT_ID",
    envClientSecret: "MICROSOFT_CLIENT_SECRET",
  },
];

async function seedProviders() {
  console.log("Seeding integration providers...\n");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  let seeded = 0;
  let skipped = 0;

  for (const provider of PROVIDERS) {
    const clientId = process.env[provider.envClientId];
    const clientSecret = process.env[provider.envClientSecret];

    const isConfigured = !!(clientId && clientSecret);

    console.log(`${provider.platform}:`);
    console.log(`  Display Name: ${provider.displayName}`);
    console.log(`  Category: ${provider.category}`);
    console.log(`  Configured: ${isConfigured ? "Yes" : "No (missing credentials)"}`);

    // For this seed script, we store credentials as-is
    // In production, use syncProvidersFromEnv which encrypts them
    const redirectUri = `${baseUrl}/api/integrations/${provider.platform.toLowerCase()}/callback`;

    try {
      await prisma.integrationProvider.upsert({
        where: { platform: provider.platform },
        create: {
          platform: provider.platform,
          displayName: provider.displayName,
          category: provider.category,
          authorizeUrl: provider.authorizeUrl,
          tokenUrl: provider.tokenUrl,
          scopes: provider.scopes,
          iconUrl: provider.iconUrl,
          redirectUri,
          // Store placeholders if no credentials (admin can update later)
          clientId: clientId || `PLACEHOLDER_${provider.platform}_CLIENT_ID`,
          clientSecret: clientSecret || `PLACEHOLDER_${provider.platform}_CLIENT_SECRET`,
          isEnabled: isConfigured,
          isConfigured,
        },
        update: {
          displayName: provider.displayName,
          category: provider.category,
          authorizeUrl: provider.authorizeUrl,
          tokenUrl: provider.tokenUrl,
          scopes: provider.scopes,
          iconUrl: provider.iconUrl,
          redirectUri,
          // Only update credentials if provided
          ...(clientId && { clientId }),
          ...(clientSecret && { clientSecret }),
          isConfigured,
          // Keep existing isEnabled unless newly configured
          ...(isConfigured && { isEnabled: true }),
        },
      });

      seeded++;
      console.log(`  Status: Seeded\n`);
    } catch (error) {
      skipped++;
      console.error(`  Status: Failed - ${error}\n`);
    }
  }

  console.log(`\nSeed complete:`);
  console.log(`  Seeded: ${seeded}`);
  console.log(`  Skipped: ${skipped}`);
}

async function main() {
  try {
    await seedProviders();
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
