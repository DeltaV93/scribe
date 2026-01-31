/**
 * Data Extraction Service
 *
 * Extracts data from Scrybe clients, form submissions, and program enrollments
 * for export to funder systems.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  ExtractionParams,
  ExtractionResult,
  ExtractedRecord,
  FieldMapping,
  CodeMappings,
} from "../types";
import { mapFields, SourceData } from "./field-mapper";

export { mapFields, extractValue, validateMappings, suggestMappings } from "./field-mapper";
export type { SourceData } from "./field-mapper";
export { transformValue, getAvailableTransformers } from "./transformers";

/**
 * Extract data from clients and their form submissions
 */
export async function extractData(params: ExtractionParams): Promise<ExtractionResult> {
  const {
    orgId,
    sourceFormIds,
    fieldMappings,
    codeMappings,
    periodStart,
    periodEnd,
    programIds,
    clientIds,
  } = params;

  // Build client query
  const clientWhere: Prisma.ClientWhereInput = {
    orgId,
    deletedAt: null,
    ...(clientIds && clientIds.length > 0 && { id: { in: clientIds } }),
  };

  // If program IDs specified, filter clients by enrollment
  if (programIds && programIds.length > 0) {
    clientWhere.programEnrollments = {
      some: {
        programId: { in: programIds },
        enrolledDate: { lte: periodEnd },
        OR: [
          { completionDate: null },
          { completionDate: { gte: periodStart } },
        ],
      },
    };
  }

  // Fetch clients with related data
  const clients = await prisma.client.findMany({
    where: clientWhere,
    include: {
      formSubmissions: {
        where: {
          formId: { in: sourceFormIds },
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
          isDraft: false,
        },
        orderBy: { createdAt: "desc" },
        include: {
          form: {
            select: { id: true, name: true },
          },
        },
      },
      programEnrollments: programIds && programIds.length > 0
        ? {
            where: {
              programId: { in: programIds },
            },
            include: {
              program: true,
              attendance: {
                where: {
                  session: {
                    date: {
                      gte: periodStart,
                      lte: periodEnd,
                    },
                  },
                },
              },
            },
          }
        : false,
    },
  });

  // Extract records
  const records: ExtractedRecord[] = [];
  const extractedFieldsSet = new Set<string>();
  const missingFieldsCounts: Record<string, number> = {};

  for (const client of clients) {
    // Aggregate form data from all submissions
    const aggregatedFormData: Record<string, unknown> = {};
    const formSubmissionIds: string[] = [];

    for (const submission of client.formSubmissions) {
      formSubmissionIds.push(submission.id);
      const data = submission.data as Record<string, unknown>;
      // Later submissions override earlier ones
      Object.assign(aggregatedFormData, data);
    }

    // Get enrollment data if available
    let enrollmentData: SourceData["enrollment"] = null;
    let programData: SourceData["program"] = null;

    // Type assertion for programEnrollments when it's included
    const enrollments = client.programEnrollments as Array<{
      id: string;
      enrolledDate: Date;
      status: string;
      completionDate: Date | null;
      withdrawalDate: Date | null;
      attendance?: Array<{ hoursAttended: { toNumber: () => number } | null }>;
      program?: {
        id: string;
        name: string;
        labelType: string;
        startDate: Date | null;
        endDate: Date | null;
        location: string | null;
      };
    }> | undefined;

    if (enrollments && Array.isArray(enrollments) && enrollments.length > 0) {
      const enrollment = enrollments[0];
      if (enrollment) {
        // Calculate total hours from attendance
        const totalHours = enrollment.attendance?.reduce((sum: number, att) => {
          return sum + (att.hoursAttended?.toNumber() || 0);
        }, 0) || 0;

        enrollmentData = {
          id: enrollment.id,
          enrolledDate: enrollment.enrolledDate,
          status: enrollment.status,
          completionDate: enrollment.completionDate,
          withdrawalDate: enrollment.withdrawalDate,
          totalHours,
        };

        if (enrollment.program) {
          programData = {
            id: enrollment.program.id,
            name: enrollment.program.name,
            labelType: enrollment.program.labelType,
            startDate: enrollment.program.startDate,
            endDate: enrollment.program.endDate,
            location: enrollment.program.location,
          };
        }
      }
    }

    // Parse address if stored as JSON
    let address = client.address as SourceData["client"]["address"];
    if (typeof address === "string") {
      try {
        address = JSON.parse(address);
      } catch {
        address = null;
      }
    }

    // Build source data structure
    const sourceData: SourceData = {
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        address,
        internalId: client.internalId,
        status: client.status,
        createdAt: client.createdAt,
      },
      formData: aggregatedFormData,
      program: programData,
      enrollment: enrollmentData,
    };

    // Map fields to external format
    const mappedData = mapFields(sourceData, fieldMappings, codeMappings);

    // Track extracted and missing fields
    for (const mapping of fieldMappings) {
      const value = mappedData[mapping.externalField];
      if (value !== undefined && value !== null && value !== "") {
        extractedFieldsSet.add(mapping.externalField);
      } else if (mapping.required && !mapping.defaultValue) {
        missingFieldsCounts[mapping.externalField] =
          (missingFieldsCounts[mapping.externalField] || 0) + 1;
      }
    }

    records.push({
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      data: mappedData,
      formSubmissionIds,
      extractedAt: new Date(),
    });
  }

  return {
    records,
    totalClients: clients.length,
    extractedFields: Array.from(extractedFieldsSet),
    missingFields: Object.entries(missingFieldsCounts).map(([field, count]) => ({
      field,
      count,
    })),
  };
}

/**
 * Extract data for a preview (limited records)
 */
export async function extractPreviewData(
  params: ExtractionParams,
  limit: number = 10
): Promise<ExtractionResult> {
  // Limit client IDs for preview
  const limitedParams = { ...params };

  if (!params.clientIds || params.clientIds.length === 0) {
    // Get first N client IDs
    const clients = await prisma.client.findMany({
      where: {
        orgId: params.orgId,
        deletedAt: null,
      },
      select: { id: true },
      take: limit,
    });
    limitedParams.clientIds = clients.map((c) => c.id);
  } else {
    limitedParams.clientIds = params.clientIds.slice(0, limit);
  }

  return extractData(limitedParams);
}

/**
 * Get count of clients that would be included in export
 */
export async function getExportClientCount(params: {
  orgId: string;
  sourceFormIds: string[];
  periodStart: Date;
  periodEnd: Date;
  programIds?: string[];
  clientIds?: string[];
}): Promise<number> {
  const {
    orgId,
    sourceFormIds,
    periodStart,
    periodEnd,
    programIds,
    clientIds,
  } = params;

  const clientWhere: Prisma.ClientWhereInput = {
    orgId,
    deletedAt: null,
    formSubmissions: {
      some: {
        formId: { in: sourceFormIds },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        isDraft: false,
      },
    },
    ...(clientIds && clientIds.length > 0 && { id: { in: clientIds } }),
  };

  if (programIds && programIds.length > 0) {
    clientWhere.programEnrollments = {
      some: {
        programId: { in: programIds },
      },
    };
  }

  return prisma.client.count({ where: clientWhere });
}

/**
 * Get available form fields from source forms
 */
export async function getSourceFormFields(
  orgId: string,
  formIds: string[]
): Promise<Array<{
  formId: string;
  formName: string;
  fields: Array<{ slug: string; name: string; type: string }>;
}>> {
  const forms = await prisma.form.findMany({
    where: {
      id: { in: formIds },
      orgId,
    },
    include: {
      fields: {
        orderBy: { order: "asc" },
        select: {
          slug: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return forms.map((form) => ({
    formId: form.id,
    formName: form.name,
    fields: form.fields.map((f) => ({
      slug: f.slug,
      name: f.name,
      type: f.type,
    })),
  }));
}
