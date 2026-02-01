"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserRole } from "@/types";
import { getDefaultPermissions } from "./index";
import { generateSlug } from "@/lib/utils";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  name: z.string().min(2, "Name must be at least 2 characters"),
  organizationName: z
    .string()
    .min(2, "Organization name must be at least 2 characters"),
});

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

// ============================================
// AUTH ACTIONS
// ============================================

export type AuthState = {
  error?: string;
  success?: string;
};

/**
 * Sign up a new user with organization
 */
export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    name: formData.get("name") as string,
    organizationName: formData.get("organizationName") as string,
  };

  // Validate input
  const validatedFields = signUpSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.errors[0].message,
    };
  }

  const { email, password, name, organizationName } = validatedFields.data;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      error: "An account with this email already exists",
    };
  }

  const supabase = await createClient();

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        name,
        organizationName,
      },
    },
  });

  if (authError) {
    return {
      error: authError.message,
    };
  }

  if (!authData.user) {
    return {
      error: "Failed to create account. Please try again.",
    };
  }

  // Generate unique org slug
  let orgSlug = generateSlug(organizationName);
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (existingOrg) {
    orgSlug = `${orgSlug}-${Date.now().toString(36)}`;
  }

  // Create organization and user in database
  try {
    const defaultPermissions = getDefaultPermissions(UserRole.ADMIN);

    await prisma.organization.create({
      data: {
        name: organizationName,
        slug: orgSlug,
        users: {
          create: {
            email,
            name,
            supabaseUserId: authData.user.id,
            role: UserRole.ADMIN,
            ...defaultPermissions,
          },
        },
      },
    });
  } catch (dbError) {
    // If database creation fails, we should ideally clean up the Supabase user
    // For now, just return an error
    console.error("Database error during signup:", dbError);
    return {
      error: "Failed to create organization. Please contact support.",
    };
  }

  return {
    success:
      "Account created! Please check your email to verify your account.",
  };
}

/**
 * Sign in an existing user
 * Handles MFA verification redirect if user has MFA enabled
 */
export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Validate input
  const validatedFields = signInSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.errors[0].message,
    };
  }

  const { email, password } = validatedFields.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      return {
        error: "Please verify your email before signing in.",
      };
    }
    return {
      error: "Invalid email or password",
    };
  }

  // Get user from database to check MFA status
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      mfaEnabled: true,
      role: true,
      organization: {
        select: {
          requireMfa: true,
        },
      },
    },
  });

  if (user) {
    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Check if user needs MFA verification
    if (user.mfaEnabled) {
      // User has MFA enabled - redirect to verification page
      revalidatePath("/", "layout");
      redirect(`/mfa-verify?userId=${user.id}`);
    }

    // Check if user needs to set up MFA (required but not enabled)
    const isMFARequiredForRole =
      user.role === "ADMIN" || user.role === "PROGRAM_MANAGER";
    const isMFARequiredByOrg = user.organization.requireMfa;

    if ((isMFARequiredForRole || isMFARequiredByOrg) && !user.mfaEnabled) {
      // User needs to set up MFA before accessing the app
      revalidatePath("/", "layout");
      redirect("/mfa-setup");
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Send password reset email
 */
export async function forgotPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    email: formData.get("email") as string,
  };

  // Validate input
  const validatedFields = forgotPasswordSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.errors[0].message,
    };
  }

  const { email } = validatedFields.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    return {
      error: "Failed to send reset email. Please try again.",
    };
  }

  return {
    success: "If an account exists with this email, you will receive a password reset link.",
  };
}

/**
 * Reset password with token
 */
export async function resetPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const rawData = {
    password: formData.get("password") as string,
  };

  // Validate input
  const validatedFields = resetPasswordSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.errors[0].message,
    };
  }

  const { password } = validatedFields.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return {
      error: "Failed to reset password. The link may have expired.",
    };
  }

  return {
    success: "Password updated successfully!",
  };
}

/**
 * Sign out the current user
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;

  if (!email) {
    return {
      error: "Email is required",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return {
      error: "Failed to resend verification email. Please try again.",
    };
  }

  return {
    success: "Verification email sent! Please check your inbox.",
  };
}
