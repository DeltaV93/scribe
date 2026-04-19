#!/usr/bin/env npx tsx
/**
 * Create Admin User Script
 *
 * Creates a new admin user with organization for production environments
 * where signup is disabled.
 *
 * Usage (from apps/web directory):
 *   cd apps/web
 *   npx tsx scripts/create-admin-user.ts
 *
 * For production, set env vars first:
 *   export DATABASE_URL="postgresql://..."
 *   export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npx tsx scripts/create-admin-user.ts
 *
 * Required environment variables:
 *   - DATABASE_URL: Prisma database connection string
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (admin access)
 *
 * You'll be prompted for:
 *   - Email address
 *   - Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
 *   - Full name
 *   - Organization name
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient, UserRole } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

// Default permissions for ADMIN role
const ADMIN_PERMISSIONS = {
  canCreateForms: true,
  canReadForms: true,
  canUpdateForms: true,
  canDeleteForms: true,
  canPublishForms: true,
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      // For password input, we need to handle it differently
      process.stdout.write(question);
      let password = "";

      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      const onData = (char: string) => {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          stdin.setRawMode(false);
          stdin.removeListener("data", onData);
          console.log();
          rl.close();
          resolve(password);
        } else if (char === "\u0003") {
          // Ctrl+C
          process.exit();
        } else if (char === "\u007F" || char === "\b") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          password += char;
          process.stdout.write("*");
        }
      };

      stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function main() {
  console.log("\n=== Create Admin User ===\n");

  // Check required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase environment variables");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error("Error: Missing DATABASE_URL environment variable");
    process.exit(1);
  }

  console.log("Connected to Supabase:", supabaseUrl);
  console.log();

  // Collect user input
  const email = await prompt("Email: ");
  if (!validateEmail(email)) {
    console.error("Error: Invalid email address");
    process.exit(1);
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.error("Error: An account with this email already exists");
    process.exit(1);
  }

  const password = await prompt("Password: ", true);
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    console.error(`Error: ${passwordValidation.error}`);
    process.exit(1);
  }

  const name = await prompt("Full name: ");
  if (name.length < 2) {
    console.error("Error: Name must be at least 2 characters");
    process.exit(1);
  }

  const organizationName = await prompt("Organization name: ");
  if (organizationName.length < 2) {
    console.error("Error: Organization name must be at least 2 characters");
    process.exit(1);
  }

  console.log("\n--- Summary ---");
  console.log(`Email: ${email}`);
  console.log(`Name: ${name}`);
  console.log(`Organization: ${organizationName}`);
  console.log(`Role: ADMIN (full permissions)`);

  const confirm = await prompt("\nCreate this account? (yes/no): ");
  if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
    console.log("Cancelled.");
    process.exit(0);
  }

  console.log("\nCreating account...");

  // Create Supabase admin client
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Create Supabase auth user
  console.log("  1. Creating Supabase auth user...");
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      name,
      organizationName,
    },
  });

  if (authError) {
    console.error(`Error creating Supabase user: ${authError.message}`);
    process.exit(1);
  }

  if (!authData.user) {
    console.error("Error: Failed to create Supabase user (no user returned)");
    process.exit(1);
  }

  console.log(`     Supabase user ID: ${authData.user.id}`);

  // Step 2: Generate unique org slug
  let orgSlug = generateSlug(organizationName);
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (existingOrg) {
    orgSlug = `${orgSlug}-${Date.now().toString(36)}`;
  }

  // Step 3: Create organization and user in database
  console.log("  2. Creating organization and user in database...");

  try {
    const org = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: orgSlug,
        users: {
          create: {
            email,
            name,
            supabaseUserId: authData.user.id,
            role: UserRole.ADMIN,
            ...ADMIN_PERMISSIONS,
          },
        },
      },
      include: {
        users: true,
      },
    });

    console.log(`     Organization ID: ${org.id}`);
    console.log(`     Organization slug: ${org.slug}`);
    console.log(`     User ID: ${org.users[0].id}`);

    console.log("\n=== Success! ===");
    console.log(`\nAdmin account created for ${email}`);
    console.log(`Organization: ${organizationName} (${orgSlug})`);
    console.log("\nThe user can now sign in at your app's login page.");
  } catch (dbError) {
    // Rollback Supabase user if database creation failed
    console.error("Database error, rolling back Supabase user...");
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

    console.error("Error creating database records:", dbError);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
