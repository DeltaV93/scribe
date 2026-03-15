/**
 * Migration: Plaintext Tokens to Encrypted Storage (PX-1001)
 *
 * Migrates IntegrationConnection records with plaintext tokens
 * to use IntegrationToken with encrypted storage.
 *
 * Run: npx ts-node scripts/migrate-plaintext-tokens.ts
 *
 * Safe to run multiple times - skips already migrated connections.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Import encryption functions (assumes these are exported)
// In production, use the actual encryption module
async function encryptForOrg(orgId: string, plaintext: string): Promise<string> {
  // This is a placeholder - actual implementation uses field-encryption.ts
  // For the migration script, we need to import the real function
  const { encryptForOrg: encrypt } = await import(
    "../apps/web/src/lib/encryption/field-encryption"
  );
  return encrypt(orgId, plaintext);
}

async function migrateTokens() {
  console.log("Starting plaintext token migration...\n");

  // Find all connections with plaintext tokens but no IntegrationToken
  const connections = await prisma.integrationConnection.findMany({
    where: {
      accessToken: { not: null },
      integrationToken: null,
    },
    select: {
      id: true,
      orgId: true,
      platform: true,
      name: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
    },
  });

  console.log(`Found ${connections.length} connections with plaintext tokens\n`);

  let migrated = 0;
  let failed = 0;

  for (const conn of connections) {
    try {
      console.log(`Migrating ${conn.platform} connection ${conn.id}...`);

      if (!conn.accessToken) {
        console.log(`  Skipping - no access token`);
        continue;
      }

      // Encrypt tokens
      const encryptedAccessToken = await encryptForOrg(conn.orgId, conn.accessToken);
      const encryptedRefreshToken = conn.refreshToken
        ? await encryptForOrg(conn.orgId, conn.refreshToken)
        : null;

      // Create IntegrationToken
      await prisma.integrationToken.create({
        data: {
          type: "WORKFLOW",
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: conn.expiresAt,
          integrationConnectionId: conn.id,
        },
      });

      // Clear plaintext tokens from IntegrationConnection
      await prisma.integrationConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: null,
          refreshToken: null,
        },
      });

      console.log(`  ✓ Migrated successfully`);
      migrated++;
    } catch (error) {
      console.error(`  ✗ Failed:`, error);
      failed++;
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${connections.length - migrated - failed}`);
}

async function verifyMigration() {
  console.log("\nVerifying migration...\n");

  // Check for remaining plaintext tokens
  const remaining = await prisma.integrationConnection.count({
    where: {
      accessToken: { not: null },
      integrationToken: null,
    },
  });

  // Check migrated connections
  const migratedCount = await prisma.integrationConnection.count({
    where: {
      accessToken: null,
      integrationToken: { isNot: null },
    },
  });

  console.log(`Remaining plaintext tokens: ${remaining}`);
  console.log(`Migrated to encrypted storage: ${migratedCount}`);

  if (remaining > 0) {
    console.log("\n⚠️  Some connections still have plaintext tokens!");
    console.log("    Re-run this script to migrate them.");
  } else {
    console.log("\n✓ All tokens migrated to encrypted storage.");
  }
}

async function main() {
  try {
    await migrateTokens();
    await verifyMigration();
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
