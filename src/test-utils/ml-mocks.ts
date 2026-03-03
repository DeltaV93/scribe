/**
 * ML Services Mock Data and Test Utilities
 *
 * Mock data generators and MSW handlers for testing ML Services integration.
 */

import type {
  Model,
  ModelVersion,
  ModelDeployment,
  OrgProfile,
  PrivacyBudget,
  ComplianceStatus,
  AuditEvent,
  PaginatedResponse,
} from "@/lib/ml-services/types";

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate a mock Model
 */
export function createMockModel(overrides: Partial<Model> = {}): Model {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    name: `test-model-${id.slice(0, 8)}`,
    model_type: "extraction",
    description: "Test model for unit tests",
    is_global: false,
    org_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock ModelVersion
 */
export function createMockVersion(
  overrides: Partial<ModelVersion> = {}
): ModelVersion {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    model_id: overrides.model_id || crypto.randomUUID(),
    version_number: 1,
    status: "ready",
    artifact_s3_path: `s3://ml-artifacts/models/${id}/model.pkl`,
    config: { learning_rate: 0.001, epochs: 100 },
    metrics: { accuracy: 0.95, f1_score: 0.92 },
    parent_version_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deployed_at: null,
    ...overrides,
  };
}

/**
 * Generate a mock ModelDeployment
 */
export function createMockDeployment(
  overrides: Partial<ModelDeployment> = {}
): ModelDeployment {
  return {
    id: crypto.randomUUID(),
    version_id: overrides.version_id || crypto.randomUUID(),
    environment: "staging",
    deployment_status: "active",
    traffic_percentage: 100,
    started_at: new Date().toISOString(),
    ended_at: null,
    ...overrides,
  };
}

/**
 * Generate a mock OrgProfile
 */
export function createMockOrgProfile(
  overrides: Partial<OrgProfile> = {}
): OrgProfile {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    org_id: overrides.org_id || crypto.randomUUID(),
    compliance_frameworks: ["HIPAA"],
    retention_policies: { training_data: "6y", audit_events: "7y" },
    privacy_settings: { anonymization: true },
    epsilon_budget: 5.0,
    epsilon_consumed: 0.0,
    budget_reset_at: null,
    model_training_enabled: true,
    audit_routing_config: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock PrivacyBudget
 */
export function createMockPrivacyBudget(
  overrides: Partial<PrivacyBudget> = {}
): PrivacyBudget {
  return {
    org_id: overrides.org_id || crypto.randomUUID(),
    epsilon_budget: 5.0,
    epsilon_consumed: 0.0,
    epsilon_remaining: 5.0,
    budget_reset_at: null,
    is_exhausted: false,
    ...overrides,
  };
}

/**
 * Generate a mock ComplianceStatus
 */
export function createMockComplianceStatus(
  overrides: Partial<ComplianceStatus> = {}
): ComplianceStatus {
  return {
    org_id: overrides.org_id || crypto.randomUUID(),
    frameworks: ["HIPAA", "SOC2"],
    overrides_count: 0,
    last_audit_at: null,
    ...overrides,
  };
}

/**
 * Generate a mock AuditEvent
 */
export function createMockAuditEvent(
  overrides: Partial<AuditEvent> = {}
): AuditEvent {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    org_id: overrides.org_id || crypto.randomUUID(),
    event_type: "model.deployed",
    risk_tier: "medium",
    actor_id: crypto.randomUUID(),
    actor_type: "user",
    event_data: { model_id: crypto.randomUUID() },
    source_service: "inkra-nextjs",
    correlation_id: null,
    occurred_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    s3_archive_path: null,
    ...overrides,
  };
}

/**
 * Generate a paginated response wrapper
 */
export function createPaginatedResponse<T>(
  items: T[],
  overrides: { total?: number; page?: number; page_size?: number } = {}
): PaginatedResponse<T> {
  return {
    items,
    total: overrides.total ?? items.length,
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? 50,
  };
}

// ============================================================================
// Mock ML Services Client
// ============================================================================

/**
 * Create a mock ML services client for testing
 */
export function createMockMLServicesClient() {
  const mockModels: Model[] = [];
  const mockVersions: Map<string, ModelVersion[]> = new Map();
  const mockOrgProfiles: Map<string, OrgProfile> = new Map();
  const mockAuditEvents: AuditEvent[] = [];

  return {
    models: {
      list: vi.fn().mockImplementation(async () => {
        return createPaginatedResponse(mockModels);
      }),
      get: vi.fn().mockImplementation(async (modelId: string) => {
        const model = mockModels.find((m) => m.id === modelId);
        if (!model) throw new Error("Model not found");
        return model;
      }),
      create: vi.fn().mockImplementation(async (data: Partial<Model>) => {
        const model = createMockModel(data);
        mockModels.push(model);
        return model;
      }),
      update: vi
        .fn()
        .mockImplementation(
          async (modelId: string, data: Partial<Model>) => {
            const index = mockModels.findIndex((m) => m.id === modelId);
            if (index === -1) throw new Error("Model not found");
            mockModels[index] = { ...mockModels[index], ...data };
            return mockModels[index];
          }
        ),
    },
    versions: {
      list: vi.fn().mockImplementation(async (modelId: string) => {
        const versions = mockVersions.get(modelId) || [];
        return { items: versions, total: versions.length };
      }),
      get: vi
        .fn()
        .mockImplementation(async (modelId: string, versionNumber: number) => {
          const versions = mockVersions.get(modelId) || [];
          const version = versions.find(
            (v) => v.version_number === versionNumber
          );
          if (!version) throw new Error("Version not found");
          return version;
        }),
      create: vi
        .fn()
        .mockImplementation(
          async (modelId: string, data: Partial<ModelVersion>) => {
            const versions = mockVersions.get(modelId) || [];
            const versionNumber = versions.length + 1;
            const version = createMockVersion({
              ...data,
              model_id: modelId,
              version_number: versionNumber,
            });
            versions.push(version);
            mockVersions.set(modelId, versions);
            return version;
          }
        ),
      deploy: vi
        .fn()
        .mockImplementation(
          async (
            modelId: string,
            versionNumber: number,
            data: { environment: string; traffic_percentage?: number }
          ) => {
            const versions = mockVersions.get(modelId) || [];
            const version = versions.find(
              (v) => v.version_number === versionNumber
            );
            if (!version) throw new Error("Version not found");
            return createMockDeployment({
              version_id: version.id,
              environment: data.environment as "staging" | "production",
              traffic_percentage: data.traffic_percentage ?? 100,
            });
          }
        ),
      rollback: vi.fn().mockImplementation(async () => {
        return createMockDeployment();
      }),
    },
    orgProfile: {
      get: vi.fn().mockImplementation(async (orgId: string) => {
        const profile = mockOrgProfiles.get(orgId);
        if (!profile) throw new Error("Org profile not found");
        return profile;
      }),
      create: vi
        .fn()
        .mockImplementation(async (orgId: string, data: Partial<OrgProfile>) => {
          const profile = createMockOrgProfile({ ...data, org_id: orgId });
          mockOrgProfiles.set(orgId, profile);
          return profile;
        }),
      update: vi
        .fn()
        .mockImplementation(async (orgId: string, data: Partial<OrgProfile>) => {
          const profile = mockOrgProfiles.get(orgId);
          if (!profile) throw new Error("Org profile not found");
          const updated = { ...profile, ...data };
          mockOrgProfiles.set(orgId, updated);
          return updated;
        }),
      getPrivacyBudget: vi.fn().mockImplementation(async (orgId: string) => {
        return createMockPrivacyBudget({ org_id: orgId });
      }),
      getComplianceStatus: vi.fn().mockImplementation(async (orgId: string) => {
        return createMockComplianceStatus({ org_id: orgId });
      }),
    },
    audit: {
      createEvent: vi
        .fn()
        .mockImplementation(async (data: Partial<AuditEvent>) => {
          const event = createMockAuditEvent(data);
          mockAuditEvents.push(event);
          return event;
        }),
      listEvents: vi.fn().mockImplementation(async () => {
        return createPaginatedResponse(mockAuditEvents);
      }),
      getEvent: vi.fn().mockImplementation(async (eventId: string) => {
        const event = mockAuditEvents.find((e) => e.id === eventId);
        if (!event) throw new Error("Event not found");
        return event;
      }),
    },
    health: {
      check: vi.fn().mockResolvedValue({ status: "ok" }),
      ready: vi
        .fn()
        .mockResolvedValue({ status: "ok", db: "connected", redis: "connected" }),
    },

    // Helper to reset all mocks
    _reset: () => {
      mockModels.length = 0;
      mockVersions.clear();
      mockOrgProfiles.clear();
      mockAuditEvents.length = 0;
    },
  };
}

// ============================================================================
// Test Data Sets
// ============================================================================

/**
 * Pre-built test data sets for common scenarios
 */
export const testDataSets = {
  /**
   * Empty state - no data
   */
  empty: {
    models: [],
    versions: [],
    events: [],
  },

  /**
   * Single model with one version
   */
  singleModel: () => {
    const model = createMockModel({ name: "extraction-model-v1" });
    const version = createMockVersion({
      model_id: model.id,
      version_number: 1,
      status: "ready",
    });
    return { model, version };
  },

  /**
   * Model with multiple versions at different statuses
   */
  modelWithVersionHistory: () => {
    const model = createMockModel({ name: "model-with-history" });
    const versions = [
      createMockVersion({
        model_id: model.id,
        version_number: 1,
        status: "deprecated",
      }),
      createMockVersion({
        model_id: model.id,
        version_number: 2,
        status: "deployed",
        deployed_at: new Date().toISOString(),
      }),
      createMockVersion({
        model_id: model.id,
        version_number: 3,
        status: "training",
      }),
    ];
    return { model, versions };
  },

  /**
   * Org profile with near-exhausted privacy budget
   */
  nearExhaustedBudget: (orgId: string) => {
    const profile = createMockOrgProfile({
      org_id: orgId,
      epsilon_budget: 5.0,
      epsilon_consumed: 4.8,
    });
    const budget = createMockPrivacyBudget({
      org_id: orgId,
      epsilon_budget: 5.0,
      epsilon_consumed: 4.8,
      epsilon_remaining: 0.2,
      is_exhausted: false,
    });
    return { profile, budget };
  },

  /**
   * Org profile with exhausted privacy budget
   */
  exhaustedBudget: (orgId: string) => {
    const profile = createMockOrgProfile({
      org_id: orgId,
      epsilon_budget: 5.0,
      epsilon_consumed: 5.0,
    });
    const budget = createMockPrivacyBudget({
      org_id: orgId,
      epsilon_budget: 5.0,
      epsilon_consumed: 5.0,
      epsilon_remaining: 0,
      is_exhausted: true,
    });
    return { profile, budget };
  },

  /**
   * Audit events of various types
   */
  mixedAuditEvents: (orgId: string) => {
    return [
      createMockAuditEvent({
        org_id: orgId,
        event_type: "model.deployed",
        risk_tier: "medium",
      }),
      createMockAuditEvent({
        org_id: orgId,
        event_type: "model.rollback",
        risk_tier: "high",
      }),
      createMockAuditEvent({
        org_id: orgId,
        event_type: "training.completed",
        risk_tier: "low",
      }),
      createMockAuditEvent({
        org_id: orgId,
        event_type: "privacy.budget.warning",
        risk_tier: "high",
        actor_type: "system",
        actor_id: null,
      }),
    ];
  },
};

// ============================================================================
// Request/Response Helpers
// ============================================================================

/**
 * Create mock NextRequest for testing
 */
export function createMockNextRequest(options: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const url = options.url || "http://localhost:3000/api/ml/models";
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  return new Request(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Parse JSON from Response
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
