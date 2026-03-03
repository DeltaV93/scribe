/**
 * Tests for ML Org Profile API Routes
 *
 * Tests org profile, privacy budget, and compliance routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockOrgProfile,
  createMockPrivacyBudget,
  createMockComplianceStatus,
  createMockMLServicesClient,
} from "@/test-utils/ml-mocks";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    id: "test-user-id",
    orgId: "test-org-id",
    email: "test@example.com",
  }),
}));

// Create mock ml-services client
const mockMLServices = createMockMLServicesClient();

// Mock the ml-services module
vi.mock("@/lib/ml-services", () => ({
  default: mockMLServices,
  MLServiceApiError: class MLServiceApiError extends Error {
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;

    constructor(
      code: string,
      message: string,
      statusCode: number,
      details?: Record<string, unknown>
    ) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
    }
  },
}));

describe("GET /api/ml/org/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should return the org profile", async () => {
    const profile = createMockOrgProfile({ org_id: "test-org-id" });
    mockMLServices.orgProfile.get.mockResolvedValue(profile);

    const { GET } = await import("../org/profile/route");

    const request = new Request("http://localhost:3000/api/ml/org/profile");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.org_id).toBe("test-org-id");
    expect(data.data.compliance_frameworks).toBeDefined();
    expect(data.data.epsilon_budget).toBeDefined();
  });

  it("should return 404 when profile does not exist", async () => {
    const { MLServiceApiError } = await import("@/lib/ml-services");
    mockMLServices.orgProfile.get.mockRejectedValue(
      new MLServiceApiError("ORG_PROFILE_NOT_FOUND", "Profile not found", 404)
    );

    const { GET } = await import("../org/profile/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe("NOT_FOUND");
  });
});

describe("PUT /api/ml/org/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should update existing org profile", async () => {
    const updatedProfile = createMockOrgProfile({
      org_id: "test-org-id",
      epsilon_budget: 10.0,
      compliance_frameworks: ["HIPAA", "SOC2"],
    });
    mockMLServices.orgProfile.update.mockResolvedValue(updatedProfile);

    const { PUT } = await import("../org/profile/route");

    const request = new Request("http://localhost:3000/api/ml/org/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epsilon_budget: 10.0,
        compliance_frameworks: ["HIPAA", "SOC2"],
      }),
    });
    const response = await PUT(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.epsilon_budget).toBe(10.0);
    expect(data.data.compliance_frameworks).toContain("SOC2");
  });

  it("should create profile if it does not exist", async () => {
    const { MLServiceApiError } = await import("@/lib/ml-services");

    // First update fails with not found
    mockMLServices.orgProfile.update.mockRejectedValue(
      new MLServiceApiError("ORG_PROFILE_NOT_FOUND", "Profile not found", 404)
    );

    // Then create succeeds
    const newProfile = createMockOrgProfile({ org_id: "test-org-id" });
    mockMLServices.orgProfile.create.mockResolvedValue(newProfile);

    const { PUT } = await import("../org/profile/route");

    const request = new Request("http://localhost:3000/api/ml/org/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compliance_frameworks: ["HIPAA"],
      }),
    });
    const response = await PUT(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockMLServices.orgProfile.create).toHaveBeenCalled();
  });

  it("should validate epsilon_budget is positive", async () => {
    const { PUT } = await import("../org/profile/route");

    const request = new Request("http://localhost:3000/api/ml/org/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epsilon_budget: -5.0, // Invalid: negative
      }),
    });
    const response = await PUT(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should handle partial updates", async () => {
    const profile = createMockOrgProfile({ org_id: "test-org-id" });
    mockMLServices.orgProfile.update.mockResolvedValue(profile);

    const { PUT } = await import("../org/profile/route");

    // Only update model_training_enabled
    const request = new Request("http://localhost:3000/api/ml/org/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_training_enabled: false,
      }),
    });
    const response = await PUT(request as never);

    expect(response.status).toBe(200);
    expect(mockMLServices.orgProfile.update).toHaveBeenCalledWith(
      "test-org-id",
      expect.objectContaining({ model_training_enabled: false })
    );
  });
});

describe("GET /api/ml/org/privacy-budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should return privacy budget status", async () => {
    const budget = createMockPrivacyBudget({
      org_id: "test-org-id",
      epsilon_budget: 5.0,
      epsilon_consumed: 2.0,
      epsilon_remaining: 3.0,
      is_exhausted: false,
    });
    mockMLServices.orgProfile.getPrivacyBudget.mockResolvedValue(budget);

    const { GET } = await import("../org/privacy-budget/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.epsilon_budget).toBe(5.0);
    expect(data.data.epsilon_remaining).toBe(3.0);
    expect(data.data.is_exhausted).toBe(false);
  });

  it("should indicate when budget is exhausted", async () => {
    const budget = createMockPrivacyBudget({
      org_id: "test-org-id",
      epsilon_budget: 5.0,
      epsilon_consumed: 5.0,
      epsilon_remaining: 0,
      is_exhausted: true,
    });
    mockMLServices.orgProfile.getPrivacyBudget.mockResolvedValue(budget);

    const { GET } = await import("../org/privacy-budget/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.is_exhausted).toBe(true);
    expect(data.data.epsilon_remaining).toBe(0);
  });

  it("should handle profile not found", async () => {
    const { MLServiceApiError } = await import("@/lib/ml-services");
    mockMLServices.orgProfile.getPrivacyBudget.mockRejectedValue(
      new MLServiceApiError("ORG_PROFILE_NOT_FOUND", "Profile not found", 404)
    );

    const { GET } = await import("../org/privacy-budget/route");

    const response = await GET();

    expect(response.status).toBe(404);
  });
});

describe("GET /api/ml/org/compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should return compliance status", async () => {
    const status = createMockComplianceStatus({
      org_id: "test-org-id",
      frameworks: ["HIPAA", "SOC2"],
      overrides_count: 2,
    });
    mockMLServices.orgProfile.getComplianceStatus.mockResolvedValue(status);

    const { GET } = await import("../org/compliance/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.frameworks).toContain("HIPAA");
    expect(data.data.frameworks).toContain("SOC2");
    expect(data.data.overrides_count).toBe(2);
  });

  it("should handle empty frameworks", async () => {
    const status = createMockComplianceStatus({
      org_id: "test-org-id",
      frameworks: [],
      overrides_count: 0,
    });
    mockMLServices.orgProfile.getComplianceStatus.mockResolvedValue(status);

    const { GET } = await import("../org/compliance/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.frameworks).toHaveLength(0);
  });
});

describe("GET /api/ml/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should return health status", async () => {
    mockMLServices.health.ready.mockResolvedValue({
      status: "ok",
      db: "connected",
      redis: "connected",
    });

    const { GET } = await import("../health/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe("ok");
  });

  it("should handle unhealthy status", async () => {
    mockMLServices.health.ready.mockResolvedValue({
      status: "degraded",
      db: "connected",
      redis: "disconnected",
    });

    const { GET } = await import("../health/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe("degraded");
  });

  it("should handle ml-services connection failure", async () => {
    mockMLServices.health.ready.mockRejectedValue(new Error("Connection refused"));

    const { GET } = await import("../health/route");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBeDefined();
  });
});
