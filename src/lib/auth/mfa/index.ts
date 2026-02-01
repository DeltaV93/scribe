/**
 * MFA Module Exports
 *
 * Provides Multi-Factor Authentication (MFA) capabilities for HIPAA compliance.
 * Supports TOTP (Time-based One-Time Password) and backup codes.
 */

// Service exports (main API)
export {
  isMFARequired,
  getMFAStatus,
  initializeMFASetup,
  enableMFA,
  verifyMFA,
  disableMFA,
  regenerateBackupCodes,
  adminResetMFA,
  setOrganizationMFARequirement,
  type MFASetupResult,
  type MFAEnableResult,
  type MFAVerifyResult,
  type MFAStatusResult,
} from "./service";

// TOTP utilities (for advanced use cases)
export {
  verifyTOTP,
  verifyEncryptedTOTP,
  formatSecretForDisplay,
  type TOTPSetupData,
} from "./totp";

// Backup codes utilities
export {
  formatBackupCode,
  normalizeBackupCode,
  countRemainingCodes,
  shouldRegenerateCodes,
} from "./backup-codes";
