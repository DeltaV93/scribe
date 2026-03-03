/**
 * Tests for ML Models API Routes
 *
 * Tests the Next.js API routes that proxy to ml-services.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockModel,
  createPaginatedResponse,
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

describe("GET /api/ml/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();
  });

  it("should return a list of models", async () => {
    const models = [
      createMockModel({ name: "model-1" }),
      createMockModel({ name: "model-2" }),
    ];
    mockMLServices.models.list.mockResolvedValue(createPaginatedResponse(models));

    // Import the route handler after mocks are set up
    const { GET } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models");
    const response = await GET(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
  });

  it("should pass query parameters to ml-services", async () => {
    mockMLServices.models.list.mockResolvedValue(createPaginatedResponse([]));

    const { GET } = await import("../models/route");

    const request = new Request(
      "http://localhost:3000/api/ml/models?model_type=extraction&include_global=true&page=2&page_size=10"
    );
    await GET(request as never);

    expect(mockMLServices.models.list).toHaveBeenCalledWith(
      expect.objectContaining({
        modelType: "extraction",
        includeGlobal: true,
        page: 2,
        pageSize: 10,
      })
    );
  });

  it("should cap page size at 250", async () => {
    mockMLServices.models.list.mockResolvedValue(createPaginatedResponse([]));

    const { GET } = await import("../models/route");

    const request = new Request(
      "http://localhost:3000/api/ml/models?page_size=500"
    );
    await GET(request as never);

    expect(mockMLServices.models.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 250,
      })
    );
  });

  it("should require authentication", async () => {
    const { requireAuth } = await import("@/lib/auth");
    (requireAuth as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Unauthorized")
    );

    const { GET } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models");
    const response = await GET(request as never);

    expect(response.status).toBe(500);
  });

  it("should handle ml-services errors", async () => {
    const { MLServiceApiError } = await import("@/lib/ml-services");
    mockMLServices.models.list.mockRejectedValue(
      new MLServiceApiError("SERVICE_UNAVAILABLE", "ML service is down", 503)
    );

    const { GET } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models");
    const response = await GET(request as never);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("POST /api/ml/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMLServices._reset();

    // Reset auth mock to success state
    const { requireAuth } = vi.mocked(await import("@/lib/auth"));
    requireAuth.mockResolvedValue({
      id: "test-user-id",
      orgId: "test-org-id",
      email: "test@example.com",
    });
  });

  it("should create a model successfully", async () => {
    const newModel = createMockModel({
      name: "new-extraction-model",
      model_type: "extraction",
    });
    mockMLServices.models.create.mockResolvedValue(newModel);

    const { POST } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "new-extraction-model",
        model_type: "extraction",
        description: "Test model",
      }),
    });
    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("new-extraction-model");
  });

  it("should pass org_id from authenticated user", async () => {
    mockMLServices.models.create.mockResolvedValue(createMockModel());

    const { POST } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-model",
        model_type: "extraction",
      }),
    });
    await POST(request as never);

    expect(mockMLServices.models.create).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: "test-org-id",
      })
    );
  });

  it("should validate required fields", async () => {
    const { POST } = await import("../models/route");

    // Missing name
    const request1 = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_type: "extraction",
      }),
    });
    const response1 = await POST(request1 as never);
    const data1 = await response1.json();

    expect(response1.status).toBe(400);
    expect(data1.error.code).toBe("VALIDATION_ERROR");

    // Missing model_type
    const request2 = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-model",
      }),
    });
    const response2 = await POST(request2 as never);

    expect(response2.status).toBe(400);
  });

  it("should validate model_type enum", async () => {
    const { POST } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-model",
        model_type: "invalid_type",
      }),
    });
    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should validate name length", async () => {
    const { POST } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "a".repeat(201), // Exceeds 200 char limit
        model_type: "extraction",
      }),
    });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
  });

  it("should handle ml-services errors", async () => {
    const { MLServiceApiError } = await import("@/lib/ml-services");
    mockMLServices.models.create.mockRejectedValue(
      new MLServiceApiError("DUPLICATE_MODEL", "Model name already exists", 409)
    );

    const { POST } = await import("../models/route");

    const request = new Request("http://localhost:3000/api/ml/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "existing-model",
        model_type: "extraction",
      }),
    });
    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe("DUPLICATE_MODEL");
  });
});
