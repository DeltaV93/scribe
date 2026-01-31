/**
 * Report PDF Generator
 *
 * Re-exports and extends the existing PDF generator with additional features.
 */

// Re-export from existing reports service
export {
  generateReportPdf,
  generatePreviewPdf,
  type ReportPdfData,
  type PdfGenerationOptions,
} from "@/lib/services/reports/pdf-generator";

import { generateReportPdf, ReportPdfData, PdfGenerationOptions } from "@/lib/services/reports/pdf-generator";
import { ReportType } from "@prisma/client";

/**
 * Generate a summary-only PDF (first page only)
 */
export async function generateSummaryPdf(
  data: ReportPdfData
): Promise<Buffer> {
  // Generate with minimal sections
  const summaryData: ReportPdfData = {
    ...data,
    narratives: data.narratives.filter((n) => n.type === "executive_summary"),
    metrics: data.metrics.slice(0, 5), // Only top 5 metrics
  };

  return generateReportPdf(summaryData, {
    includeTableOfContents: false,
    includePageNumbers: false,
  });
}

/**
 * Generate a branded PDF with custom logo
 */
export async function generateBrandedPdf(
  data: ReportPdfData,
  branding: {
    logoBase64?: string;
    primaryColor?: string;
    accentColor?: string;
  }
): Promise<Buffer> {
  const brandedData: ReportPdfData = {
    ...data,
    logo: branding.logoBase64,
  };

  return generateReportPdf(brandedData);
}

/**
 * Get recommended PDF options for a report type
 */
export function getRecommendedPdfOptions(
  reportType: ReportType
): PdfGenerationOptions {
  switch (reportType) {
    case "HUD_APR":
    case "DOL_WORKFORCE":
    case "CALI_GRANTS":
      // Formal funder reports
      return {
        includeTableOfContents: true,
        includePageNumbers: true,
        pageSize: "LETTER",
        orientation: "portrait",
      };

    case "BOARD_REPORT":
      // Board presentations
      return {
        includeTableOfContents: true,
        includePageNumbers: true,
        pageSize: "LETTER",
        orientation: "landscape",
      };

    case "IMPACT_REPORT":
      // Public-facing impact reports
      return {
        includeTableOfContents: false,
        includePageNumbers: true,
        pageSize: "LETTER",
        orientation: "portrait",
      };

    case "CUSTOM":
    default:
      return {
        includeTableOfContents: true,
        includePageNumbers: true,
        pageSize: "LETTER",
        orientation: "portrait",
      };
  }
}
