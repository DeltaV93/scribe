/**
 * Sensitive Data Masking Utilities
 *
 * Provides functions to mask PII, PHI, credentials, and other sensitive data
 * before logging. Essential for HIPAA and SOC 2 compliance.
 */

// Masking patterns for different types of sensitive data
const MASKING_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
}> = [
  // Email addresses - show domain but mask user part
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: (match: string) => {
      const [, domain] = match.split('@');
      return `***@${domain}`;
    },
  },
  // Phone numbers - various formats
  {
    name: 'phone',
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '***-***-****',
  },
  // SSN - xxx-xx-xxxx format
  {
    name: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '***-**-****',
  },
  // Credit card numbers - 13-19 digits with optional separators
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b/g,
    replacement: (match: string) => {
      // Keep last 4 digits
      const digits = match.replace(/[-\s]/g, '');
      if (digits.length >= 13 && digits.length <= 19) {
        return `****-****-****-${digits.slice(-4)}`;
      }
      return match; // Not a valid card number, don't mask
    },
  },
  // API keys and tokens - common patterns
  {
    name: 'api_key',
    pattern: /\b(?:sk|pk|api|key|token|secret|auth)[-_]?[A-Za-z0-9]{20,}\b/gi,
    replacement: '[REDACTED_API_KEY]',
  },
  // Bearer tokens
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },
  // JWT tokens (standalone)
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*\b/g,
    replacement: '[REDACTED_JWT]',
  },
  // AWS access keys
  {
    name: 'aws_key',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  // AWS secret keys
  {
    name: 'aws_secret',
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
    replacement: (match: string) => {
      // Only mask if it looks like a base64 AWS secret (contains / or +)
      if (match.includes('/') || match.includes('+')) {
        return '[REDACTED_AWS_SECRET]';
      }
      return match;
    },
  },
  // Stripe keys
  {
    name: 'stripe_key',
    pattern: /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{24,}\b/g,
    replacement: '[REDACTED_STRIPE_KEY]',
  },
  // Supabase keys
  {
    name: 'supabase_key',
    pattern: /\beyJ[A-Za-z0-9\-_=]+\.eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]*/g,
    replacement: '[REDACTED_SUPABASE_KEY]',
  },
];

// Fields that should always be completely redacted
const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'api-key',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'private_key',
  'privateKey',
  'private-key',
  'ssn',
  'social_security',
  'socialSecurity',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'cvv',
  'cvc',
  'pin',
  'dob',
  'date_of_birth',
  'dateOfBirth',
  'medical_record',
  'medicalRecord',
  'health_info',
  'healthInfo',
  'diagnosis',
  'treatment',
  'prescription',
  'refresh_token',
  'refreshToken',
  'access_token',
  'accessToken',
  'session_token',
  'sessionToken',
  'cookie',
  'x-api-key',
]);

/**
 * Mask sensitive data in a string
 */
export function maskString(value: string): string {
  let masked = value;

  for (const { pattern, replacement } of MASKING_PATTERNS) {
    if (typeof replacement === 'function') {
      masked = masked.replace(pattern, replacement);
    } else {
      masked = masked.replace(pattern, replacement);
    }
  }

  return masked;
}

/**
 * Check if a field name indicates sensitive data
 */
export function isSensitiveField(fieldName: string): boolean {
  const normalizedName = fieldName.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_FIELD_NAMES.has(fieldName.toLowerCase()) ||
    SENSITIVE_FIELD_NAMES.has(normalizedName) ||
    normalizedName.includes('password') ||
    normalizedName.includes('secret') ||
    normalizedName.includes('token') ||
    normalizedName.includes('apikey') ||
    normalizedName.includes('credential');
}

/**
 * Recursively mask sensitive data in an object
 */
export function maskObject<T>(obj: T, maxDepth = 10): T {
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_EXCEEDED]' as unknown as T;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return maskString(obj) as unknown as T;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskObject(item, maxDepth - 1)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        masked[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        masked[key] = maskString(value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskObject(value, maxDepth - 1);
      } else {
        masked[key] = value;
      }
    }

    return masked as T;
  }

  return obj;
}

/**
 * Mask user context for Sentry (removes PHI but keeps useful debugging info)
 */
export function maskUserContext(user: {
  id?: string;
  email?: string;
  organizationId?: string;
  role?: string;
  [key: string]: unknown;
}): Record<string, unknown> {
  return {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    // Don't include email, name, or other PII
  };
}

/**
 * Mask error for logging (keeps stack trace but masks message if it contains sensitive data)
 */
export function maskError(error: Error): {
  name: string;
  message: string;
  stack?: string;
} {
  return {
    name: error.name,
    message: maskString(error.message),
    stack: error.stack ? maskString(error.stack) : undefined,
  };
}

/**
 * Create a safe log payload by masking all sensitive data
 */
export function createSafeLogPayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  return maskObject(data);
}
