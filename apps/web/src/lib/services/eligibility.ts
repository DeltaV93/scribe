/**
 * Eligibility Service
 *
 * Manages insurance eligibility verification, caching, and document generation.
 * Integrates with Availity API for real-time eligibility checks.
 *
 * @module lib/services/eligibility
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  checkEligibility as availityCheck,
  EligibilityRequest,
  EligibilityResponse,
  getPayerList,
  isAvailityConfigured,
} from "@/lib/integrations/availity";
import { secureUpload, getSecureDownloadUrl, S3BucketType } from "@/lib/storage/s3";
import pdfMake from "pdfmake/build/pdfmake";
import { TDocumentDefinitions, Content, StyleDictionary, TableCell } from "pdfmake/interfaces";

// ============================================
// TYPES
// ============================================

export interface CreateInsuranceInput {
  clientId: string;
  planName: string;
  memberId: string;
  groupNumber?: string | null;
  payerCode?: string | null;
  payerName?: string | null;
  effectiveDate: Date;
  terminationDate?: Date | null;
  isPrimary?: boolean;
  subscriberName?: string | null;
  subscriberDob?: Date | null;
  subscriberRelation?: string | null;
  planType?: string | null;
  planPhone?: string | null;
}

export interface UpdateInsuranceInput {
  planName?: string;
  memberId?: string;
  groupNumber?: string | null;
  payerCode?: string | null;
  payerName?: string | null;
  effectiveDate?: Date;
  terminationDate?: Date | null;
  isPrimary?: boolean;
  subscriberName?: string | null;
  subscriberDob?: Date | null;
  subscriberRelation?: string | null;
  planType?: string | null;
  planPhone?: string | null;
}

export interface VerifyEligibilityInput {
  clientId: string;
  insurancePlanId?: string;
  serviceCode: string;
  serviceName?: string;
  providerNpi: string;
  forceRefresh?: boolean;
}

export interface EligibilityResult {
  id: string;
  clientId: string;
  insurancePlanId: string | null;
  serviceCode: string;
  serviceName: string | null;
  isEligible: boolean;
  responseData: EligibilityResponseData;
  documentUrls: string[];
  checkedAt: Date;
  expiresAt: Date;
  isFromCache: boolean;
}

export interface EligibilityResponseData {
  planName: string;
  memberId: string;
  groupNumber?: string;
  effectiveDate?: string;
  terminationDate?: string;
  copay?: number;
  copayDescription?: string;
  deductible?: number;
  deductibleRemaining?: number;
  coinsurance?: number;
  outOfPocketMax?: number;
  outOfPocketRemaining?: number;
  priorAuthRequired?: boolean;
  priorAuthPhone?: string;
  limitations?: string[];
  exclusions?: string[];
  notes?: string[];
  inNetwork?: boolean;
  requestId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface InsuranceWithRelations {
  id: string;
  clientId: string;
  planName: string;
  memberId: string;
  groupNumber: string | null;
  payerCode: string | null;
  payerName: string | null;
  effectiveDate: Date;
  terminationDate: Date | null;
  isPrimary: boolean;
  subscriberName: string | null;
  subscriberDob: Date | null;
  subscriberRelation: string | null;
  planType: string | null;
  planPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    eligibilityChecks: number;
  };
}

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_TTL_DAYS = 7;

/**
 * Calculate expiry date for cache
 */
function getCacheExpiryDate(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + CACHE_TTL_DAYS);
  return expiry;
}

// ============================================
// CLIENT INSURANCE CRUD
// ============================================

/**
 * Save client insurance information
 */
export async function saveClientInsurance(
  input: CreateInsuranceInput
): Promise<InsuranceWithRelations> {
  // If this is being set as primary, unset other primary insurances
  if (input.isPrimary !== false) {
    await prisma.clientInsurance.updateMany({
      where: {
        clientId: input.clientId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
  }

  const insurance = await prisma.clientInsurance.create({
    data: {
      clientId: input.clientId,
      planName: input.planName,
      memberId: input.memberId,
      groupNumber: input.groupNumber,
      payerCode: input.payerCode,
      payerName: input.payerName,
      effectiveDate: input.effectiveDate,
      terminationDate: input.terminationDate,
      isPrimary: input.isPrimary ?? true,
      subscriberName: input.subscriberName,
      subscriberDob: input.subscriberDob,
      subscriberRelation: input.subscriberRelation,
      planType: input.planType,
      planPhone: input.planPhone,
    },
    include: {
      _count: {
        select: { eligibilityChecks: true },
      },
    },
  });

  return transformInsurance(insurance);
}

/**
 * Update client insurance information
 */
export async function updateClientInsurance(
  insuranceId: string,
  input: UpdateInsuranceInput
): Promise<InsuranceWithRelations> {
  // If setting as primary, unset others first
  if (input.isPrimary === true) {
    const current = await prisma.clientInsurance.findUnique({
      where: { id: insuranceId },
      select: { clientId: true },
    });

    if (current) {
      await prisma.clientInsurance.updateMany({
        where: {
          clientId: current.clientId,
          isPrimary: true,
          id: { not: insuranceId },
        },
        data: { isPrimary: false },
      });
    }
  }

  const insurance = await prisma.clientInsurance.update({
    where: { id: insuranceId },
    data: {
      ...(input.planName !== undefined && { planName: input.planName }),
      ...(input.memberId !== undefined && { memberId: input.memberId }),
      ...(input.groupNumber !== undefined && { groupNumber: input.groupNumber }),
      ...(input.payerCode !== undefined && { payerCode: input.payerCode }),
      ...(input.payerName !== undefined && { payerName: input.payerName }),
      ...(input.effectiveDate !== undefined && { effectiveDate: input.effectiveDate }),
      ...(input.terminationDate !== undefined && { terminationDate: input.terminationDate }),
      ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
      ...(input.subscriberName !== undefined && { subscriberName: input.subscriberName }),
      ...(input.subscriberDob !== undefined && { subscriberDob: input.subscriberDob }),
      ...(input.subscriberRelation !== undefined && { subscriberRelation: input.subscriberRelation }),
      ...(input.planType !== undefined && { planType: input.planType }),
      ...(input.planPhone !== undefined && { planPhone: input.planPhone }),
    },
    include: {
      _count: {
        select: { eligibilityChecks: true },
      },
    },
  });

  return transformInsurance(insurance);
}

/**
 * Delete client insurance
 */
export async function deleteClientInsurance(insuranceId: string): Promise<void> {
  await prisma.clientInsurance.delete({
    where: { id: insuranceId },
  });
}

/**
 * Get client insurance by ID
 */
export async function getClientInsuranceById(
  insuranceId: string
): Promise<InsuranceWithRelations | null> {
  const insurance = await prisma.clientInsurance.findUnique({
    where: { id: insuranceId },
    include: {
      _count: {
        select: { eligibilityChecks: true },
      },
    },
  });

  if (!insurance) return null;
  return transformInsurance(insurance);
}

/**
 * Get all insurance records for a client
 */
export async function getClientInsurance(
  clientId: string
): Promise<InsuranceWithRelations[]> {
  const insurances = await prisma.clientInsurance.findMany({
    where: { clientId },
    include: {
      _count: {
        select: { eligibilityChecks: true },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { effectiveDate: "desc" }],
  });

  return insurances.map(transformInsurance);
}

/**
 * Get primary insurance for a client
 */
export async function getPrimaryInsurance(
  clientId: string
): Promise<InsuranceWithRelations | null> {
  const insurance = await prisma.clientInsurance.findFirst({
    where: {
      clientId,
      isPrimary: true,
    },
    include: {
      _count: {
        select: { eligibilityChecks: true },
      },
    },
  });

  if (!insurance) return null;
  return transformInsurance(insurance);
}

// ============================================
// ELIGIBILITY VERIFICATION
// ============================================

/**
 * Verify eligibility for a service
 *
 * Checks cache first, then calls Availity API if needed.
 */
export async function verifyEligibility(
  input: VerifyEligibilityInput
): Promise<EligibilityResult> {
  // Check cache first (unless force refresh)
  if (!input.forceRefresh) {
    const cached = await getCachedEligibility(
      input.clientId,
      input.serviceCode,
      input.insurancePlanId
    );

    if (cached) {
      return { ...cached, isFromCache: true };
    }
  }

  // Get client and insurance info
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  });

  if (!client) {
    throw new Error(`Client ${input.clientId} not found`);
  }

  // Get insurance plan (either specified or primary)
  let insurance: InsuranceWithRelations | null = null;
  if (input.insurancePlanId) {
    insurance = await getClientInsuranceById(input.insurancePlanId);
  } else {
    insurance = await getPrimaryInsurance(input.clientId);
  }

  if (!insurance) {
    throw new Error("No insurance on file for client");
  }

  // Build eligibility request
  const request: EligibilityRequest = {
    subscriberFirstName: insurance.subscriberName?.split(" ")[0] || client.firstName,
    subscriberLastName: insurance.subscriberName?.split(" ").slice(1).join(" ") || client.lastName,
    subscriberDob: insurance.subscriberDob
      ? insurance.subscriberDob.toISOString().split("T")[0]
      : "1990-01-01", // Default if not available
    memberId: insurance.memberId,
    payerCode: insurance.payerCode || "",
    groupNumber: insurance.groupNumber || undefined,
    providerNpi: input.providerNpi,
    serviceCode: input.serviceCode,
    patientRelation:
      (insurance.subscriberRelation as "self" | "spouse" | "child" | "other") ||
      "self",
    patientFirstName:
      insurance.subscriberRelation !== "self" ? client.firstName : undefined,
    patientLastName:
      insurance.subscriberRelation !== "self" ? client.lastName : undefined,
  };

  // Call Availity API
  const response = await availityCheck(request);

  // Parse response data
  const responseData: EligibilityResponseData = {
    planName: response.planName,
    memberId: response.memberId,
    groupNumber: response.groupNumber,
    effectiveDate: response.effectiveDate,
    terminationDate: response.terminationDate,
    copay: response.copay,
    copayDescription: response.copayDescription,
    deductible: response.deductible,
    deductibleRemaining: response.deductibleRemaining,
    coinsurance: response.coinsurance,
    outOfPocketMax: response.outOfPocketMax,
    outOfPocketRemaining: response.outOfPocketRemaining,
    priorAuthRequired: response.priorAuthRequired,
    priorAuthPhone: response.priorAuthPhone,
    limitations: response.limitations,
    exclusions: response.exclusions,
    notes: response.notes,
    inNetwork: response.inNetwork,
    requestId: response.requestId,
    errorCode: response.errorCode,
    errorMessage: response.errorMessage,
  };

  // Store result in database
  const eligibilityCheck = await prisma.eligibilityCheck.create({
    data: {
      clientId: input.clientId,
      insurancePlanId: insurance.id,
      serviceCode: input.serviceCode,
      serviceName: input.serviceName,
      isEligible: response.isEligible,
      responseData: responseData as unknown as Prisma.JsonObject,
      documentUrls: [],
      checkedAt: new Date(),
      expiresAt: getCacheExpiryDate(),
      requestId: response.requestId,
      providerNpi: input.providerNpi,
    },
  });

  return {
    id: eligibilityCheck.id,
    clientId: eligibilityCheck.clientId,
    insurancePlanId: eligibilityCheck.insurancePlanId,
    serviceCode: eligibilityCheck.serviceCode,
    serviceName: eligibilityCheck.serviceName,
    isEligible: eligibilityCheck.isEligible,
    responseData,
    documentUrls: [],
    checkedAt: eligibilityCheck.checkedAt,
    expiresAt: eligibilityCheck.expiresAt,
    isFromCache: false,
  };
}

/**
 * Get cached eligibility result if valid
 */
export async function getCachedEligibility(
  clientId: string,
  serviceCode: string,
  insurancePlanId?: string | null
): Promise<EligibilityResult | null> {
  const now = new Date();

  const cached = await prisma.eligibilityCheck.findFirst({
    where: {
      clientId,
      serviceCode,
      ...(insurancePlanId && { insurancePlanId }),
      expiresAt: { gt: now },
      isEligible: true, // Only cache positive results
    },
    orderBy: { checkedAt: "desc" },
  });

  if (!cached) return null;

  return {
    id: cached.id,
    clientId: cached.clientId,
    insurancePlanId: cached.insurancePlanId,
    serviceCode: cached.serviceCode,
    serviceName: cached.serviceName,
    isEligible: cached.isEligible,
    responseData: cached.responseData as unknown as EligibilityResponseData,
    documentUrls: cached.documentUrls,
    checkedAt: cached.checkedAt,
    expiresAt: cached.expiresAt,
    isFromCache: true,
  };
}

/**
 * Get eligibility check by ID
 */
export async function getEligibilityCheckById(
  checkId: string
): Promise<EligibilityResult | null> {
  const check = await prisma.eligibilityCheck.findUnique({
    where: { id: checkId },
  });

  if (!check) return null;

  return {
    id: check.id,
    clientId: check.clientId,
    insurancePlanId: check.insurancePlanId,
    serviceCode: check.serviceCode,
    serviceName: check.serviceName,
    isEligible: check.isEligible,
    responseData: check.responseData as unknown as EligibilityResponseData,
    documentUrls: check.documentUrls,
    checkedAt: check.checkedAt,
    expiresAt: check.expiresAt,
    isFromCache: false,
  };
}

/**
 * Get eligibility history for a client
 */
export async function getEligibilityHistory(
  clientId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ checks: EligibilityResult[]; total: number }> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const [checks, total] = await Promise.all([
    prisma.eligibilityCheck.findMany({
      where: { clientId },
      orderBy: { checkedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.eligibilityCheck.count({ where: { clientId } }),
  ]);

  return {
    checks: checks.map((check) => ({
      id: check.id,
      clientId: check.clientId,
      insurancePlanId: check.insurancePlanId,
      serviceCode: check.serviceCode,
      serviceName: check.serviceName,
      isEligible: check.isEligible,
      responseData: check.responseData as unknown as EligibilityResponseData,
      documentUrls: check.documentUrls,
      checkedAt: check.checkedAt,
      expiresAt: check.expiresAt,
      isFromCache: false,
    })),
    total,
  };
}

// ============================================
// DOCUMENT GENERATION
// ============================================

/**
 * Generate eligibility summary PDF
 */
export async function generateEligibilityPDF(
  checkId: string,
  orgId: string
): Promise<string> {
  const check = await prisma.eligibilityCheck.findUnique({
    where: { id: checkId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      insurancePlan: true,
    },
  });

  if (!check) {
    throw new Error(`Eligibility check ${checkId} not found`);
  }

  // Get organization info
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const responseData = check.responseData as unknown as EligibilityResponseData;
  const client = check.client;
  const insurance = check.insurancePlan;

  // Build PDF content
  const docDefinition = buildEligibilityPdfDefinition({
    orgName: org?.name || "Healthcare Organization",
    clientName: `${client.firstName} ${client.lastName}`,
    clientPhone: client.phone,
    clientEmail: client.email,
    planName: insurance?.planName || responseData.planName,
    memberId: insurance?.memberId || responseData.memberId,
    groupNumber: insurance?.groupNumber || responseData.groupNumber,
    serviceCode: check.serviceCode,
    serviceName: check.serviceName,
    isEligible: check.isEligible,
    checkedAt: check.checkedAt,
    expiresAt: check.expiresAt,
    responseData,
  });

  // Generate PDF buffer
  const pdfBuffer = await generatePdfBuffer(docDefinition);

  // Upload to S3 (using EXPORTS bucket for eligibility documents)
  const key = `eligibility/${orgId}/${check.clientId}/${checkId}/eligibility-summary.pdf`;
  await secureUpload(
    S3BucketType.EXPORTS,
    key,
    pdfBuffer,
    {
      contentType: "application/pdf",
      metadata: {
        "eligibility-check-id": checkId,
        "client-id": check.clientId,
        "generated-at": new Date().toISOString(),
      },
    }
  );

  // Get signed URL
  const signedUrl = await getSecureDownloadUrl(
    S3BucketType.EXPORTS,
    key,
    { expiresIn: 86400 } // 24 hours
  );

  // Update check with document URL
  const existingUrls = check.documentUrls || [];
  const updatedUrls = [
    ...existingUrls.filter((url) => !url.includes("eligibility-summary")),
    signedUrl,
  ];

  await prisma.eligibilityCheck.update({
    where: { id: checkId },
    data: { documentUrls: updatedUrls },
  });

  return signedUrl;
}

/**
 * Generate pre-filled CMS-1500 form
 */
export async function generateCMS1500(
  checkId: string,
  orgId: string,
  providerInfo?: {
    name?: string;
    npi?: string;
    taxId?: string;
    address?: string;
    phone?: string;
  }
): Promise<string> {
  const check = await prisma.eligibilityCheck.findUnique({
    where: { id: checkId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          address: true,
        },
      },
      insurancePlan: true,
    },
  });

  if (!check) {
    throw new Error(`Eligibility check ${checkId} not found`);
  }

  // Get organization info
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const responseData = check.responseData as unknown as EligibilityResponseData;
  const client = check.client;
  const insurance = check.insurancePlan;
  const clientAddress = client.address as {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;

  // Build CMS-1500 PDF
  const docDefinition = buildCMS1500PdfDefinition({
    // Patient info (Box 2-5)
    patientName: `${client.lastName}, ${client.firstName}`,
    patientAddress: clientAddress
      ? `${clientAddress.street || ""}\n${clientAddress.city || ""}, ${clientAddress.state || ""} ${clientAddress.zip || ""}`
      : "",
    patientPhone: client.phone,

    // Insurance info (Box 1a, 4, 9, 11)
    insuranceId: insurance?.memberId || responseData.memberId,
    groupNumber: insurance?.groupNumber || responseData.groupNumber,
    insurerName: insurance?.payerName || responseData.planName,
    subscriberName: insurance?.subscriberName,
    subscriberRelation: insurance?.subscriberRelation || "self",

    // Provider info (Box 33)
    providerName: providerInfo?.name || org?.name || "",
    providerNpi: check.providerNpi || providerInfo?.npi || "",
    providerTaxId: providerInfo?.taxId,
    providerAddress: providerInfo?.address,
    providerPhone: providerInfo?.phone,

    // Service info (Box 21, 24)
    serviceCode: check.serviceCode,
    serviceName: check.serviceName,
    serviceDate: check.checkedAt.toISOString().split("T")[0],
  });

  // Generate PDF buffer
  const pdfBuffer = await generatePdfBuffer(docDefinition);

  // Upload to S3 (using EXPORTS bucket for eligibility documents)
  const key = `eligibility/${orgId}/${check.clientId}/${checkId}/cms-1500.pdf`;
  await secureUpload(
    S3BucketType.EXPORTS,
    key,
    pdfBuffer,
    {
      contentType: "application/pdf",
      metadata: {
        "eligibility-check-id": checkId,
        "client-id": check.clientId,
        "document-type": "cms-1500",
        "generated-at": new Date().toISOString(),
      },
    }
  );

  // Get signed URL
  const signedUrl = await getSecureDownloadUrl(
    S3BucketType.EXPORTS,
    key,
    { expiresIn: 86400 } // 24 hours
  );

  // Update check with document URL
  const existingUrls = check.documentUrls || [];
  const updatedUrls = [
    ...existingUrls.filter((url) => !url.includes("cms-1500")),
    signedUrl,
  ];

  await prisma.eligibilityCheck.update({
    where: { id: checkId },
    data: { documentUrls: updatedUrls },
  });

  return signedUrl;
}

// ============================================
// PDF GENERATION HELPERS
// ============================================

// Define fonts for pdfmake
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

interface EligibilityPdfData {
  orgName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  planName: string;
  memberId: string;
  groupNumber?: string;
  serviceCode: string;
  serviceName: string | null;
  isEligible: boolean;
  checkedAt: Date;
  expiresAt: Date;
  responseData: EligibilityResponseData;
}

function buildEligibilityPdfDefinition(data: EligibilityPdfData): TDocumentDefinitions {
  const content: Content[] = [];

  // Header
  content.push({
    columns: [
      { text: data.orgName, style: "headerOrg" },
      { text: "Eligibility Verification", style: "headerTitle", alignment: "right" },
    ],
    margin: [0, 0, 0, 20],
  });

  // Status badge
  content.push({
    text: data.isEligible ? "ELIGIBLE" : "NOT ELIGIBLE",
    style: data.isEligible ? "eligibleBadge" : "notEligibleBadge",
    alignment: "center",
    margin: [0, 0, 0, 20],
  });

  // Client Information section
  content.push({ text: "Patient Information", style: "sectionHeader" });
  content.push({
    table: {
      widths: ["30%", "70%"],
      body: [
        ["Name:", data.clientName],
        ["Phone:", data.clientPhone],
        ["Email:", data.clientEmail || "N/A"],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 15],
  });

  // Insurance Information section
  content.push({ text: "Insurance Information", style: "sectionHeader" });
  content.push({
    table: {
      widths: ["30%", "70%"],
      body: [
        ["Plan Name:", data.planName],
        ["Member ID:", data.memberId],
        ["Group Number:", data.groupNumber || "N/A"],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 15],
  });

  // Service Information section
  content.push({ text: "Service Information", style: "sectionHeader" });
  content.push({
    table: {
      widths: ["30%", "70%"],
      body: [
        ["Service Code:", data.serviceCode],
        ["Service Name:", data.serviceName || "N/A"],
        ["Checked Date:", formatDate(data.checkedAt)],
        ["Valid Until:", formatDate(data.expiresAt)],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 15],
  });

  // Cost Sharing section (if eligible)
  if (data.isEligible && data.responseData) {
    content.push({ text: "Cost Sharing", style: "sectionHeader" });

    const costRows: TableCell[][] = [];
    if (data.responseData.copay !== undefined) {
      costRows.push(["Copay:", `$${data.responseData.copay.toFixed(2)} ${data.responseData.copayDescription || "per visit"}`]);
    }
    if (data.responseData.deductible !== undefined) {
      const remaining = data.responseData.deductibleRemaining !== undefined
        ? ` ($${data.responseData.deductibleRemaining.toFixed(2)} remaining)`
        : "";
      costRows.push(["Deductible:", `$${data.responseData.deductible.toFixed(2)}${remaining}`]);
    }
    if (data.responseData.coinsurance !== undefined) {
      costRows.push(["Coinsurance:", `${data.responseData.coinsurance}%`]);
    }
    if (data.responseData.outOfPocketMax !== undefined) {
      const remaining = data.responseData.outOfPocketRemaining !== undefined
        ? ` ($${data.responseData.outOfPocketRemaining.toFixed(2)} remaining)`
        : "";
      costRows.push(["Out-of-Pocket Max:", `$${data.responseData.outOfPocketMax.toFixed(2)}${remaining}`]);
    }

    if (costRows.length > 0) {
      content.push({
        table: {
          widths: ["30%", "70%"],
          body: costRows,
        },
        layout: "noBorders",
        margin: [0, 0, 0, 15],
      });
    }

    // Prior Authorization
    if (data.responseData.priorAuthRequired) {
      content.push({
        text: "Prior Authorization Required",
        style: "warning",
        margin: [0, 0, 0, 5],
      });
      if (data.responseData.priorAuthPhone) {
        content.push({
          text: `Contact: ${data.responseData.priorAuthPhone}`,
          margin: [0, 0, 0, 15],
        });
      }
    }

    // Limitations
    if (data.responseData.limitations && data.responseData.limitations.length > 0) {
      content.push({ text: "Limitations", style: "sectionHeader" });
      content.push({
        ul: data.responseData.limitations,
        margin: [0, 0, 0, 15],
      });
    }
  }

  // Footer
  content.push({
    text: `This verification was performed on ${formatDate(data.checkedAt)} and is valid until ${formatDate(data.expiresAt)}. Coverage is subject to terms of the member's plan.`,
    style: "footer",
    margin: [0, 30, 0, 0],
  });

  return {
    pageSize: "LETTER",
    pageMargins: [40, 40, 40, 40],
    content,
    styles: getPdfStyles(),
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
    },
  };
}

interface CMS1500Data {
  patientName: string;
  patientAddress: string;
  patientPhone: string;
  insuranceId: string;
  groupNumber?: string;
  insurerName: string;
  subscriberName?: string | null;
  subscriberRelation: string;
  providerName: string;
  providerNpi: string;
  providerTaxId?: string;
  providerAddress?: string;
  providerPhone?: string;
  serviceCode: string;
  serviceName: string | null;
  serviceDate: string;
}

function buildCMS1500PdfDefinition(data: CMS1500Data): TDocumentDefinitions {
  const content: Content[] = [];

  // Title
  content.push({
    text: "CMS-1500 CLAIM FORM (Pre-filled)",
    style: "title",
    alignment: "center",
    margin: [0, 0, 0, 20],
  });

  // Note
  content.push({
    text: "This form has been pre-filled with available information. Please verify all fields before submission.",
    style: "note",
    alignment: "center",
    margin: [0, 0, 0, 20],
  });

  // Box 1: Type of Insurance
  content.push({ text: "1. TYPE OF INSURANCE", style: "boxHeader" });
  content.push({
    text: "[ ] Medicare  [ ] Medicaid  [X] Other",
    margin: [0, 0, 0, 15],
  });

  // Box 1a: Insured's ID Number
  content.push({ text: "1a. INSURED'S I.D. NUMBER", style: "boxHeader" });
  content.push({
    text: data.insuranceId,
    style: "fieldValue",
    margin: [0, 0, 0, 15],
  });

  // Box 2: Patient's Name
  content.push({ text: "2. PATIENT'S NAME (Last Name, First Name)", style: "boxHeader" });
  content.push({
    text: data.patientName,
    style: "fieldValue",
    margin: [0, 0, 0, 15],
  });

  // Box 4: Insured's Name
  content.push({ text: "4. INSURED'S NAME (Last Name, First Name)", style: "boxHeader" });
  content.push({
    text: data.subscriberName || data.patientName,
    style: "fieldValue",
    margin: [0, 0, 0, 15],
  });

  // Box 5: Patient's Address
  content.push({ text: "5. PATIENT'S ADDRESS", style: "boxHeader" });
  content.push({
    text: data.patientAddress || "_______________________________________________",
    style: "fieldValue",
    margin: [0, 0, 0, 15],
  });

  // Box 11: Insured's Policy Group or FECA Number
  content.push({ text: "11. INSURED'S POLICY GROUP OR FECA NUMBER", style: "boxHeader" });
  content.push({
    text: data.groupNumber || "N/A",
    style: "fieldValue",
    margin: [0, 0, 0, 15],
  });

  // Box 24: Service Line
  content.push({ text: "24. SERVICE INFORMATION", style: "boxHeader" });
  content.push({
    table: {
      widths: ["20%", "20%", "30%", "30%"],
      headerRows: 1,
      body: [
        [
          { text: "Date of Service", style: "tableHeader" },
          { text: "CPT/HCPCS", style: "tableHeader" },
          { text: "Description", style: "tableHeader" },
          { text: "Charges", style: "tableHeader" },
        ],
        [
          data.serviceDate,
          data.serviceCode,
          data.serviceName || "",
          "$ ________",
        ],
      ],
    },
    margin: [0, 0, 0, 20],
  });

  // Box 33: Billing Provider Info
  content.push({ text: "33. BILLING PROVIDER INFO", style: "boxHeader" });
  content.push({
    table: {
      widths: ["30%", "70%"],
      body: [
        ["Provider Name:", data.providerName],
        ["NPI:", data.providerNpi],
        ["Tax ID:", data.providerTaxId || "_______________"],
        ["Address:", data.providerAddress || "_______________________________________________"],
        ["Phone:", data.providerPhone || "_______________"],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 20],
  });

  // Signature lines
  content.push({
    columns: [
      {
        stack: [
          { text: "PATIENT/AUTHORIZED SIGNATURE", style: "signatureLabel" },
          { text: "________________________________", margin: [0, 20, 0, 0] },
          { text: "Date: _______________", margin: [0, 5, 0, 0] },
        ],
      },
      {
        stack: [
          { text: "PHYSICIAN/SUPPLIER SIGNATURE", style: "signatureLabel" },
          { text: "________________________________", margin: [0, 20, 0, 0] },
          { text: "Date: _______________", margin: [0, 5, 0, 0] },
        ],
      },
    ],
    margin: [0, 30, 0, 0],
  });

  return {
    pageSize: "LETTER",
    pageMargins: [40, 40, 40, 40],
    content,
    styles: getCMS1500Styles(),
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
    },
  };
}

function getPdfStyles(): StyleDictionary {
  return {
    headerOrg: {
      fontSize: 14,
      bold: true,
    },
    headerTitle: {
      fontSize: 16,
      bold: true,
      color: "#333333",
    },
    sectionHeader: {
      fontSize: 12,
      bold: true,
      color: "#333333",
      margin: [0, 10, 0, 5],
    },
    eligibleBadge: {
      fontSize: 18,
      bold: true,
      color: "#ffffff",
      background: "#22c55e",
    },
    notEligibleBadge: {
      fontSize: 18,
      bold: true,
      color: "#ffffff",
      background: "#ef4444",
    },
    warning: {
      fontSize: 11,
      bold: true,
      color: "#ea580c",
    },
    footer: {
      fontSize: 8,
      color: "#666666",
      italics: true,
    },
  };
}

function getCMS1500Styles(): StyleDictionary {
  return {
    title: {
      fontSize: 16,
      bold: true,
    },
    note: {
      fontSize: 9,
      italics: true,
      color: "#666666",
    },
    boxHeader: {
      fontSize: 9,
      bold: true,
      color: "#333333",
    },
    fieldValue: {
      fontSize: 11,
    },
    tableHeader: {
      fontSize: 9,
      bold: true,
      fillColor: "#f3f4f6",
    },
    signatureLabel: {
      fontSize: 8,
      bold: true,
    },
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition, undefined, fonts);
      pdfDocGenerator.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================
// UTILITY EXPORTS
// ============================================

export { getPayerList, isAvailityConfigured };

function transformInsurance(insurance: Prisma.ClientInsuranceGetPayload<{
  include: { _count: { select: { eligibilityChecks: true } } };
}>): InsuranceWithRelations {
  return {
    id: insurance.id,
    clientId: insurance.clientId,
    planName: insurance.planName,
    memberId: insurance.memberId,
    groupNumber: insurance.groupNumber,
    payerCode: insurance.payerCode,
    payerName: insurance.payerName,
    effectiveDate: insurance.effectiveDate,
    terminationDate: insurance.terminationDate,
    isPrimary: insurance.isPrimary,
    subscriberName: insurance.subscriberName,
    subscriberDob: insurance.subscriberDob,
    subscriberRelation: insurance.subscriberRelation,
    planType: insurance.planType,
    planPhone: insurance.planPhone,
    createdAt: insurance.createdAt,
    updatedAt: insurance.updatedAt,
    _count: insurance._count,
  };
}
