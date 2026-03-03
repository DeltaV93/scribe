/**
 * Tests for ML Model Versions API Routes
 *
 * Tests version creation, deployment, and rollback routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockVersion,
  createMockDeployment,
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

describe("GET /api/ml/models/[modelId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should return a list of versions for a model", async () => {
    const modelId = "test-model-id";
    const versions = [
      createMockVersion({ model_id: modelId, version_number: 1 }),
      createMockVersion({ model_id: modelId, version_number: 2 }),
    ];
    mockMLServices.versions.list.mockResolvedValue({
      items: versions,
      total: versions.length,
    });

    const { GET } = await import("../models/[modelId]/versions/route");

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions`
    );
    const response = await GET(request as never, { params: { modelId } } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(mockMLServices.versions.list).toHaveBeenCalledWith(modelId);
  });

  it("should return empty list for model with no versions", async () => {
    const modelId = "empty-model-id";
    mockMLServices.versions.list.mockResolvedValue({ items: [], total: 0 });

    const { GET } = await import("../models/[modelId]/versions/route");

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions`
    );
    const response = await GET(request as never, { params: { modelId } } as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(0);
  });
});

describe("POST /api/ml/models/[modelId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should create a new version", async () => {
    const modelId = "test-model-id";
    const newVersion = createMockVersion({
      model_id: modelId,
      version_number: 1,
      status: "training",
    });
    mockMLServices.versions.create.mockResolvedValue(newVersion);

    const { POST } = await import("../models/[modelId]/versions/route");

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { learning_rate: 0.001 },
        }),
      }
    );
    const response = await POST(request as never, { params: { modelId } } as never);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.version_number).toBe(1);
    expect(data.data.status).toBe("training");
  });

  it("should create version with empty body", async () => {
    const modelId = "test-model-id";
    mockMLServices.versions.create.mockResolvedValue(
      createMockVersion({ model_id: modelId })
    );

    const { POST } = await import("../models/[modelId]/versions/route");

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    const response = await POST(request as never, { params: { modelId } } as never);

    expect(response.status).toBe(201);
  });
});

describe("POST /api/ml/models/[modelId]/versions/[versionNumber]/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should deploy a version to staging", async () => {
    const modelId = "test-model-id";
    const versionNumber = "1";
    const deployment = createMockDeployment({
      environment: "staging",
      deployment_status: "active",
    });
    mockMLServices.versions.deploy.mockResolvedValue(deployment);

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/deploy/route"
    );

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/deploy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "staging",
        }),
      }
    );
    const response = await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.environment).toBe("staging");
  });

  it("should deploy a version to production", async () => {
    const modelId = "test-model-id";
    const versionNumber = "1";
    const deployment = createMockDeployment({
      environment: "production",
    });
    mockMLServices.versions.deploy.mockResolvedValue(deployment);

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/deploy/route"
    );

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/deploy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "production",
        }),
      }
    );
    const response = await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.environment).toBe("production");
  });

  it("should support traffic percentage for canary deployments", async () => {
    const modelId = "test-model-id";
    const versionNumber = "1";
    mockMLServices.versions.deploy.mockResolvedValue(
      createMockDeployment({ traffic_percentage: 25 })
    );

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/deploy/route"
    );

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/deploy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "production",
          traffic_percentage: 25,
        }),
      }
    );
    await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );

    expect(mockMLServices.versions.deploy).toHaveBeenCalledWith(
      modelId,
      parseInt(versionNumber),
      expect.objectContaining({ traffic_percentage: 25 })
    );
  });

  it("should validate environment field", async () => {
    const modelId = "test-model-id";
    const versionNumber = "1";

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/deploy/route"
    );

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/deploy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: "invalid",
        }),
      }
    );
    const response = await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );

    expect(response.status).toBe(400);
  });
});

describe("POST /api/ml/models/[modelId]/versions/[versionNumber]/rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should rollback to a previous version", async () => {
    const modelId = "test-model-id";
    const versionNumber = "1";
    const deployment = createMockDeployment({
      environment: "production",
    });
    mockMLServices.versions.rollback.mockResolvedValue(deployment);

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/rollback/route"
    );

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/rollback?environment=production`,
      { method: "POST" }
    );
    const response = await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("should require environment parameter", async () => {
    const modelId = "test-model-id";
    const versionNumber = "1";

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/rollback/route"
    );

    // Missing environment query param
    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/rollback`,
      { method: "POST" }
    );
    const response = await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );

    expect(response.status).toBe(400);
  });

  it("should handle version not found error", async () => {
    const modelId = "test-model-id";
    const versionNumber = "999";

    const { MLServiceApiError } = await import("@/lib/ml-services");
    mockMLServices.versions.rollback.mockRejectedValue(
      new MLServiceApiError("VERSION_NOT_FOUND", "Version not found", 404)
    );

    const { POST } = await import(
      "../models/[modelId]/versions/[versionNumber]/rollback/route"
    );

    const request = new Request(
      `http://localhost:3000/api/ml/models/${modelId}/versions/${versionNumber}/rollback?environment=production`,
      { method: "POST" }
    );
    const response = await POST(
      request as never,
      { params: { modelId, versionNumber } } as never
    );

    expect(response.status).toBe(404);
  });
});
