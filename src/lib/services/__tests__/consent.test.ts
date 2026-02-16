/**
 * Consent Service Tests (PX-735)
 *
 * Tests for the consent management service functions.
 * These tests use mocked Prisma to verify business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ConsentType,
  ConsentStatus,
  ConsentCollectionMethod,
} from "@prisma/client";

// Mock prisma before importing the service
vi.mock("@/lib/db", () => ({
  prisma: {
    consentRecord: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
    },
    call: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock audit logging
vi.mock("@/lib/audit/service", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are set up
import { prisma } from "@/lib/db";
import {
  grantConsent,
  revokeConsent,
  getConsentStatus,
  getAllConsentRecords,
  canRecordClient,
  markRecordingsForDeletion,
} from "../consent";

describe("Consent Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("grantConsent", () => {
    it("should create a new consent record when none exists", async () => {
      const mockClient = { orgId: "org-123" };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.consentRecord.upsert).mockResolvedValue({
        id: "consent-1",
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        status: ConsentStatus.GRANTED,
        grantedAt: new Date(),
        method: ConsentCollectionMethod.KEYPRESS,
      } as any);

      await grantConsent({
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        method: ConsentCollectionMethod.KEYPRESS,
        callId: "call-456",
      });

      expect(prisma.consentRecord.upsert).toHaveBeenCalledWith({
        where: {
          clientId_consentType: {
            clientId: "client-123",
            consentType: ConsentType.RECORDING,
          },
        },
        create: expect.objectContaining({
          clientId: "client-123",
          consentType: ConsentType.RECORDING,
          status: ConsentStatus.GRANTED,
          method: ConsentCollectionMethod.KEYPRESS,
          callId: "call-456",
        }),
        update: expect.objectContaining({
          status: ConsentStatus.GRANTED,
          method: ConsentCollectionMethod.KEYPRESS,
          callId: "call-456",
          revokedAt: null,
          revokedById: null,
          retentionUntil: null,
        }),
      });
    });

    it("should update existing consent when re-granting", async () => {
      const mockClient = { orgId: "org-123" };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.consentRecord.upsert).mockResolvedValue({
        id: "consent-1",
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        status: ConsentStatus.GRANTED,
        grantedAt: new Date(),
        method: ConsentCollectionMethod.SILENCE_TIMEOUT,
      } as any);

      await grantConsent({
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        method: ConsentCollectionMethod.SILENCE_TIMEOUT,
      });

      expect(prisma.consentRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: ConsentStatus.GRANTED,
            revokedAt: null,
            revokedById: null,
            retentionUntil: null,
          }),
        })
      );
    });
  });

  describe("revokeConsent", () => {
    it("should revoke consent and set retention period", async () => {
      const mockClient = { orgId: "org-123" };
      vi.mocked(prisma.client.findUnique).mockResolvedValue(mockClient as any);
      vi.mocked(prisma.consentRecord.update).mockResolvedValue({
        id: "consent-1",
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        status: ConsentStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: "user-789",
      } as any);

      await revokeConsent({
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        revokedById: "user-789",
        reason: "Client requested",
      });

      expect(prisma.consentRecord.update).toHaveBeenCalledWith({
        where: {
          clientId_consentType: {
            clientId: "client-123",
            consentType: ConsentType.RECORDING,
          },
        },
        data: expect.objectContaining({
          status: ConsentStatus.REVOKED,
          revokedById: "user-789",
          retentionUntil: expect.any(Date),
        }),
      });

      // Verify retention is ~30 days in the future
      const updateCall = vi.mocked(prisma.consentRecord.update).mock.calls[0];
      const retentionDate = updateCall[0].data.retentionUntil as Date;
      const daysUntilRetention = Math.round(
        (retentionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(daysUntilRetention).toBeGreaterThanOrEqual(29);
      expect(daysUntilRetention).toBeLessThanOrEqual(31);
    });
  });

  describe("getConsentStatus", () => {
    it("should return PENDING status when no consent record exists", async () => {
      vi.mocked(prisma.consentRecord.findUnique).mockResolvedValue(null);

      const status = await getConsentStatus(
        "client-123",
        ConsentType.RECORDING
      );

      expect(status).toEqual({
        hasConsent: false,
        status: ConsentStatus.PENDING,
        grantedAt: null,
        method: null,
      });
    });

    it("should return GRANTED status with details when consent exists", async () => {
      const grantedAt = new Date("2024-01-15");
      vi.mocked(prisma.consentRecord.findUnique).mockResolvedValue({
        id: "consent-1",
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        status: ConsentStatus.GRANTED,
        grantedAt,
        method: ConsentCollectionMethod.KEYPRESS,
      } as any);

      const status = await getConsentStatus(
        "client-123",
        ConsentType.RECORDING
      );

      expect(status).toEqual({
        hasConsent: true,
        status: ConsentStatus.GRANTED,
        grantedAt,
        method: ConsentCollectionMethod.KEYPRESS,
      });
    });

    it("should return REVOKED status when consent was revoked", async () => {
      vi.mocked(prisma.consentRecord.findUnique).mockResolvedValue({
        id: "consent-1",
        clientId: "client-123",
        consentType: ConsentType.RECORDING,
        status: ConsentStatus.REVOKED,
        grantedAt: new Date("2024-01-15"),
        revokedAt: new Date("2024-02-01"),
        method: ConsentCollectionMethod.KEYPRESS,
      } as any);

      const status = await getConsentStatus(
        "client-123",
        ConsentType.RECORDING
      );

      expect(status).toEqual({
        hasConsent: false,
        status: ConsentStatus.REVOKED,
        grantedAt: expect.any(Date),
        method: ConsentCollectionMethod.KEYPRESS,
      });
    });
  });

  describe("canRecordClient", () => {
    it("should return true when recording consent is granted", async () => {
      vi.mocked(prisma.consentRecord.findUnique).mockResolvedValue({
        status: ConsentStatus.GRANTED,
        grantedAt: new Date(),
        method: ConsentCollectionMethod.KEYPRESS,
      } as any);

      const canRecord = await canRecordClient("client-123");

      expect(canRecord).toBe(true);
    });

    it("should return false when no consent record exists", async () => {
      vi.mocked(prisma.consentRecord.findUnique).mockResolvedValue(null);

      const canRecord = await canRecordClient("client-123");

      expect(canRecord).toBe(false);
    });

    it("should return false when consent is revoked", async () => {
      vi.mocked(prisma.consentRecord.findUnique).mockResolvedValue({
        status: ConsentStatus.REVOKED,
        grantedAt: new Date(),
        revokedAt: new Date(),
        method: ConsentCollectionMethod.KEYPRESS,
      } as any);

      const canRecord = await canRecordClient("client-123");

      expect(canRecord).toBe(false);
    });
  });

  describe("getAllConsentRecords", () => {
    it("should return all consent records for a client", async () => {
      const mockRecords = [
        {
          id: "consent-1",
          clientId: "client-123",
          consentType: ConsentType.RECORDING,
          status: ConsentStatus.GRANTED,
          grantedAt: new Date(),
          method: ConsentCollectionMethod.KEYPRESS,
          revokedBy: null,
        },
        {
          id: "consent-2",
          clientId: "client-123",
          consentType: ConsentType.TRANSCRIPTION,
          status: ConsentStatus.GRANTED,
          grantedAt: new Date(),
          method: ConsentCollectionMethod.KEYPRESS,
          revokedBy: null,
        },
      ];
      vi.mocked(prisma.consentRecord.findMany).mockResolvedValue(
        mockRecords as any
      );

      const records = await getAllConsentRecords("client-123");

      expect(records).toHaveLength(2);
      expect(prisma.consentRecord.findMany).toHaveBeenCalledWith({
        where: { clientId: "client-123" },
        include: {
          revokedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  });

  describe("markRecordingsForDeletion", () => {
    it("should return count of recordings to be deleted", async () => {
      vi.mocked(prisma.call.findMany).mockResolvedValue([
        { id: "call-1", recordingUrl: "s3://bucket/recording1.mp3" },
        { id: "call-2", recordingUrl: "s3://bucket/recording2.mp3" },
        { id: "call-3", recordingUrl: "s3://bucket/recording3.mp3" },
      ] as any);

      const count = await markRecordingsForDeletion("client-123", "user-789");

      expect(count).toBe(3);
      expect(prisma.call.findMany).toHaveBeenCalledWith({
        where: {
          clientId: "client-123",
          recordingUrl: { not: null },
        },
        select: { id: true, recordingUrl: true },
      });
    });

    it("should return 0 when client has no recordings", async () => {
      vi.mocked(prisma.call.findMany).mockResolvedValue([]);

      const count = await markRecordingsForDeletion("client-123", "user-789");

      expect(count).toBe(0);
    });
  });
});
