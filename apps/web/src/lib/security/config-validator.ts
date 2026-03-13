/**
 * Security Configuration Validator
 *
 * Validates that required security-related environment variables are properly
 * configured. Should be called at application startup.
 *
 * @security This module helps ensure security configurations are not missed
 * in production deployments.
 */

interface ConfigCheck {
  name: string;
  envVar: string;
  required: boolean;
  description: string;
  validate?: (value: string) => boolean;
  validationMessage?: string;
}

/**
 * Security configuration checks
 */
const SECURITY_CONFIGS: ConfigCheck[] = [
  {
    name: "MFA Encryption Key",
    envVar: "MFA_ENCRYPTION_KEY",
    required: true,
    description: "AES-256 key for encrypting TOTP secrets",
    validate: (v) => v.length >= 32,
    validationMessage: "Should be at least 32 characters (ideally 64 hex chars for 256-bit key)",
  },
  {
    name: "MFA Key Salt",
    envVar: "MFA_KEY_SALT",
    required: true,
    description: "Salt for MFA key derivation (must be unique per deployment)",
  },
  {
    name: "Stripe Webhook Secret",
    envVar: "STRIPE_WEBHOOK_SECRET",
    required: true,
    description: "Stripe webhook signature verification secret",
    validate: (v) => v.startsWith("whsec_"),
    validationMessage: "Should start with 'whsec_'",
  },
  {
    name: "Cron Secret",
    envVar: "CRON_SECRET",
    required: true,
    description: "Secret for authenticating cron job requests",
    validate: (v) => v.length >= 32,
    validationMessage: "Should be at least 32 characters",
  },
  {
    name: "Jobs API Key",
    envVar: "JOBS_API_KEY",
    required: true,
    description: "API key for background job authentication",
    validate: (v) => v.length >= 32,
    validationMessage: "Should be at least 32 characters",
  },
  {
    name: "Meeting Bot Webhook Secret",
    envVar: "MEETING_BOT_WEBHOOK_SECRET",
    required: false,
    description: "HMAC secret for meeting bot webhook verification",
  },
  {
    name: "Marketing URL",
    envVar: "MARKETING_URL",
    required: false,
    description: "Marketing site URL for CORS configuration",
    validate: (v) => v.startsWith("https://"),
    validationMessage: "Should be an HTTPS URL",
  },
  {
    name: "Dev Encryption Secret",
    envVar: "DEV_ENCRYPTION_SECRET",
    required: false,
    description: "Encryption secret for development mode (not for production)",
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all security configurations
 *
 * @returns Validation result with errors and warnings
 */
export function validateSecurityConfig(): ValidationResult {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of SECURITY_CONFIGS) {
    const value = process.env[config.envVar];

    // Check if required variable is missing
    if (!value) {
      if (config.required && isProduction) {
        errors.push(`Missing required security config: ${config.name} (${config.envVar}) - ${config.description}`);
      } else if (config.required) {
        warnings.push(`Missing ${config.name} (${config.envVar}) - required in production`);
      }
      continue;
    }

    // Run validation function if provided
    if (config.validate && !config.validate(value)) {
      const message = config.validationMessage || "Invalid value";
      if (isProduction) {
        errors.push(`Invalid ${config.name} (${config.envVar}): ${message}`);
      } else {
        warnings.push(`${config.name} (${config.envVar}): ${message}`);
      }
    }
  }

  // Check for insecure development settings in production
  if (isProduction) {
    if (process.env.SKIP_WEBHOOK_VALIDATION === "true") {
      errors.push("SKIP_WEBHOOK_VALIDATION=true is not allowed in production");
    }
    if (process.env.DEV_ENCRYPTION_SECRET) {
      warnings.push("DEV_ENCRYPTION_SECRET should not be set in production");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log security configuration status
 * Call this at application startup
 */
export function logSecurityConfigStatus(): void {
  const result = validateSecurityConfig();
  const isProduction = process.env.NODE_ENV === "production";

  if (result.errors.length > 0) {
    console.error("[SECURITY CONFIG] Configuration errors detected:");
    result.errors.forEach((e) => console.error(`  - ${e}`));
    if (isProduction) {
      console.error("[SECURITY CONFIG] Application may not function correctly!");
    }
  }

  if (result.warnings.length > 0) {
    console.warn("[SECURITY CONFIG] Configuration warnings:");
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("[SECURITY CONFIG] All security configurations validated successfully");
  }
}

/**
 * Assert that security configuration is valid
 * Throws an error if critical configs are missing in production
 */
export function assertSecurityConfig(): void {
  const result = validateSecurityConfig();

  if (!result.valid && process.env.NODE_ENV === "production") {
    throw new Error(
      `Security configuration errors:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }
}
