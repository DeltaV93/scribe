/**
 * Feature Flags Service
 *
 * Manages feature flags at the organization level.
 * Flags are stored in the Organization.featureFlags JSON field.
 */

import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// Available feature flags
export type FeatureFlag =
  | 'mass-notes'
  | 'photo-to-form'
  | 'automated-reporting'
  | 'sms-messaging'
  | 'client-portal'
  | 'form-logic'

// Feature flag configuration
export interface FeatureFlagConfig {
  enabled: boolean
  enabledAt?: string
  enabledBy?: string
  config?: Record<string, unknown>
}

// Organization feature flags structure
export type OrganizationFeatureFlags = Partial<Record<FeatureFlag, FeatureFlagConfig>>

// Default flag values (all disabled by default)
const DEFAULT_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  'mass-notes': { enabled: false },
  'photo-to-form': { enabled: false },
  'automated-reporting': { enabled: false },
  'sms-messaging': { enabled: false },
  'client-portal': { enabled: false },
  'form-logic': { enabled: false },
}

/**
 * Get all feature flags for an organization
 */
export async function getFeatureFlags(orgId: string): Promise<OrganizationFeatureFlags> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { featureFlags: true },
  })

  if (!org) {
    return DEFAULT_FLAGS
  }

  const flags = (org.featureFlags ?? {}) as OrganizationFeatureFlags
  return { ...DEFAULT_FLAGS, ...flags }
}

/**
 * Check if a specific feature flag is enabled
 */
export async function isFeatureEnabled(orgId: string, flag: FeatureFlag): Promise<boolean> {
  const flags = await getFeatureFlags(orgId)
  return flags[flag]?.enabled ?? false
}

/**
 * Enable a feature flag for an organization
 */
export async function enableFeatureFlag(
  orgId: string,
  flag: FeatureFlag,
  userId: string,
  config?: Record<string, unknown>
): Promise<void> {
  const currentFlags = await getFeatureFlags(orgId)

  const updatedFlags: OrganizationFeatureFlags = {
    ...currentFlags,
    [flag]: {
      enabled: true,
      enabledAt: new Date().toISOString(),
      enabledBy: userId,
      config,
    },
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { featureFlags: updatedFlags as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Disable a feature flag for an organization
 */
export async function disableFeatureFlag(orgId: string, flag: FeatureFlag): Promise<void> {
  const currentFlags = await getFeatureFlags(orgId)

  const updatedFlags: OrganizationFeatureFlags = {
    ...currentFlags,
    [flag]: {
      enabled: false,
    },
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { featureFlags: updatedFlags as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Update feature flag configuration
 */
export async function updateFeatureFlagConfig(
  orgId: string,
  flag: FeatureFlag,
  config: Record<string, unknown>
): Promise<void> {
  const currentFlags = await getFeatureFlags(orgId)
  const currentFlag = currentFlags[flag] ?? DEFAULT_FLAGS[flag]

  const updatedFlags: OrganizationFeatureFlags = {
    ...currentFlags,
    [flag]: {
      ...currentFlag,
      config: {
        ...(currentFlag.config ?? {}),
        ...config,
      },
    },
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { featureFlags: updatedFlags as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Get feature flag configuration
 */
export async function getFeatureFlagConfig<T = Record<string, unknown>>(
  orgId: string,
  flag: FeatureFlag
): Promise<T | null> {
  const flags = await getFeatureFlags(orgId)
  return (flags[flag]?.config as T) ?? null
}

/**
 * Bulk update feature flags
 */
export async function setFeatureFlags(
  orgId: string,
  flags: Partial<Record<FeatureFlag, boolean>>,
  userId: string
): Promise<void> {
  const currentFlags = await getFeatureFlags(orgId)
  const now = new Date().toISOString()

  const updatedFlags: OrganizationFeatureFlags = { ...currentFlags }

  for (const [flag, enabled] of Object.entries(flags)) {
    updatedFlags[flag as FeatureFlag] = {
      enabled,
      ...(enabled ? { enabledAt: now, enabledBy: userId } : {}),
    }
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { featureFlags: updatedFlags as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Check if feature is enabled, throw error if not
 * Useful for API route guards
 */
export async function requireFeatureEnabled(
  orgId: string,
  flag: FeatureFlag
): Promise<void> {
  const enabled = await isFeatureEnabled(orgId, flag)

  if (!enabled) {
    throw new Error(`Feature "${flag}" is not enabled for this organization`)
  }
}
