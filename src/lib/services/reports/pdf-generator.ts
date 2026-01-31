/**
 * Report PDF Generator
 *
 * Generates professional PDF reports from report data.
 */

import pdfMake from "pdfmake/build/pdfmake";
import { ReportType } from "@prisma/client";
import { MetricResult } from "./aggregation";
import { NarrativeSection } from "./narrative";
import { PreBuiltMetric } from "./pre-built-metrics";
import { TDocumentDefinitions, Content, TableCell, StyleDictionary } from "pdfmake/interfaces";

// Define fonts for pdfmake - using built-in Helvetica fonts (no vfs needed)
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export interface ReportPdfData {
  organizationName: string;
  reportName: string;
  reportType: ReportType;
  reportingPeriod: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  metrics: Array<{
    metric: PreBuiltMetric;
    result: MetricResult;
  }>;
  narratives: NarrativeSection[];
  logo?: string; // Base64 encoded logo
  customSections?: Array<{
    title: string;
    content: Content;
  }>;
}

export interface PdfGenerationOptions {
  includeTableOfContents?: boolean;
  includePageNumbers?: boolean;
  watermark?: string;
  pageSize?: "LETTER" | "A4";
  orientation?: "portrait" | "landscape";
}

/**
 * Generate a PDF report
 */
export async function generateReportPdf(
  data: ReportPdfData,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const {
    includeTableOfContents = true,
    includePageNumbers = true,
    watermark,
    pageSize = "LETTER",
    orientation = "portrait",
  } = options;

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize,
    pageOrientation: orientation,
    pageMargins: [40, 60, 40, 60],

    header: buildHeader(data),
    footer: includePageNumbers ? buildFooter() : undefined,

    content: buildContent(data, includeTableOfContents),

    styles: getStyles(),

    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
    },

    ...(watermark && {
      watermark: {
        text: watermark,
        color: "#cccccc",
        opacity: 0.2,
        bold: true,
        fontSize: 60,
      },
    }),
  };

  // Generate PDF
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

function buildHeader(data: ReportPdfData): Content {
  return {
    columns: [
      {
        text: data.organizationName,
        style: "headerOrg",
        width: "*",
      },
      {
        text: getReportTypeLabel(data.reportType),
        style: "headerType",
        width: "auto",
        alignment: "right",
      },
    ],
    margin: [40, 20, 40, 20],
  };
}

function buildFooter(): (currentPage: number, pageCount: number) => Content {
  return (currentPage: number, pageCount: number): Content => ({
    columns: [
      {
        text: `Generated ${new Date().toLocaleDateString()}`,
        style: "footer",
        width: "*",
      },
      {
        text: `Page ${currentPage} of ${pageCount}`,
        style: "footer",
        width: "auto",
        alignment: "right",
      },
    ],
    margin: [40, 0, 40, 0],
  });
}

function buildContent(data: ReportPdfData, includeTableOfContents: boolean): Content[] {
  const content: Content[] = [];

  // Title page
  content.push(buildTitlePage(data));
  content.push({ text: "", pageBreak: "after" });

  // Table of contents
  if (includeTableOfContents) {
    content.push(buildTableOfContents(data));
    content.push({ text: "", pageBreak: "after" });
  }

  // Narratives
  for (const narrative of data.narratives) {
    content.push(buildNarrativeSection(narrative));
  }

  // Metrics section
  content.push(buildMetricsSection(data.metrics));

  // Custom sections
  if (data.customSections) {
    for (const section of data.customSections) {
      content.push({
        text: section.title,
        style: "sectionHeader",
        margin: [0, 20, 0, 10],
      });
      content.push(section.content);
    }
  }

  return content;
}

function buildTitlePage(data: ReportPdfData): Content {
  const periodStart = data.reportingPeriod.start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const periodEnd = data.reportingPeriod.end.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    stack: [
      { text: "", margin: [0, 100, 0, 0] },
      {
        text: data.reportName,
        style: "title",
        alignment: "center",
      },
      {
        text: getReportTypeLabel(data.reportType),
        style: "subtitle",
        alignment: "center",
        margin: [0, 10, 0, 30],
      },
      {
        text: data.organizationName,
        style: "orgName",
        alignment: "center",
        margin: [0, 0, 0, 20],
      },
      {
        text: `Reporting Period: ${periodStart} - ${periodEnd}`,
        style: "period",
        alignment: "center",
        margin: [0, 0, 0, 50],
      },
      {
        text: [
          { text: "Generated: ", bold: true },
          data.generatedAt.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        ],
        alignment: "center",
        fontSize: 10,
        color: "#666666",
      },
      {
        text: [
          { text: "Prepared by: ", bold: true },
          data.generatedBy,
        ],
        alignment: "center",
        fontSize: 10,
        color: "#666666",
        margin: [0, 5, 0, 0],
      },
    ],
  };
}

function buildTableOfContents(data: ReportPdfData): Content {
  const items: Content[] = [];

  items.push({
    text: "Table of Contents",
    style: "sectionHeader",
    margin: [0, 0, 0, 20],
  });

  let pageNum = 3; // Start after title and TOC

  // Add narrative sections
  for (const narrative of data.narratives) {
    items.push({
      columns: [
        { text: narrative.title, width: "*" },
        { text: String(pageNum), width: "auto", alignment: "right" },
      ],
      margin: [0, 5, 0, 5],
    });
    pageNum++;
  }

  // Add metrics section
  items.push({
    columns: [
      { text: "Performance Metrics", width: "*" },
      { text: String(pageNum), width: "auto", alignment: "right" },
    ],
    margin: [0, 5, 0, 5],
  });

  return { stack: items };
}

function buildNarrativeSection(narrative: NarrativeSection): Content {
  return {
    stack: [
      {
        text: narrative.title,
        style: "sectionHeader",
        margin: [0, 0, 0, 15],
      },
      {
        text: narrative.content,
        style: "paragraph",
        margin: [0, 0, 0, 20],
      },
    ],
    margin: [0, 0, 0, 30],
  };
}

function buildMetricsSection(
  metrics: Array<{
    metric: PreBuiltMetric;
    result: MetricResult;
  }>
): Content {
  // Group metrics by category
  const byCategory = new Map<string, typeof metrics>();
  for (const item of metrics) {
    const category = item.metric.category;
    const existing = byCategory.get(category) || [];
    existing.push(item);
    byCategory.set(category, existing);
  }

  const sections: Content[] = [];

  sections.push({
    text: "Performance Metrics",
    style: "sectionHeader",
    margin: [0, 0, 0, 20],
    pageBreak: "before",
  });

  for (const [category, categoryMetrics] of byCategory) {
    sections.push({
      text: getCategoryLabel(category),
      style: "subsectionHeader",
      margin: [0, 15, 0, 10],
    });

    const tableBody: TableCell[][] = [
      [
        { text: "Metric", style: "tableHeader" },
        { text: "Value", style: "tableHeader" },
        { text: "Status", style: "tableHeader" },
      ],
    ];

    for (const { metric, result } of categoryMetrics) {
      const statusColor = getStatusColor(result.benchmarkStatus);

      tableBody.push([
        { text: metric.name, style: "tableCell" },
        { text: result.formattedValue, style: "tableCell", alignment: "right" },
        {
          text: result.benchmarkStatus
            ? result.benchmarkStatus.charAt(0).toUpperCase() +
              result.benchmarkStatus.slice(1)
            : "-",
          style: "tableCell",
          color: statusColor,
        },
      ]);
    }

    sections.push({
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto"],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 15],
    });
  }

  return { stack: sections };
}

function getStyles(): StyleDictionary {
  return {
    title: {
      fontSize: 28,
      bold: true,
      color: "#1a1a1a",
    },
    subtitle: {
      fontSize: 16,
      color: "#666666",
    },
    orgName: {
      fontSize: 18,
      bold: true,
      color: "#333333",
    },
    period: {
      fontSize: 12,
      color: "#666666",
    },
    sectionHeader: {
      fontSize: 18,
      bold: true,
      color: "#1a1a1a",
    },
    subsectionHeader: {
      fontSize: 14,
      bold: true,
      color: "#333333",
    },
    paragraph: {
      fontSize: 11,
      lineHeight: 1.4,
      color: "#333333",
    },
    tableHeader: {
      fontSize: 10,
      bold: true,
      color: "#ffffff",
      fillColor: "#4a5568",
    },
    tableCell: {
      fontSize: 10,
      color: "#333333",
    },
    headerOrg: {
      fontSize: 10,
      color: "#666666",
    },
    headerType: {
      fontSize: 10,
      color: "#666666",
      italics: true,
    },
    footer: {
      fontSize: 8,
      color: "#999999",
    },
  };
}

function getReportTypeLabel(reportType: ReportType): string {
  const labels: Record<ReportType, string> = {
    HUD_APR: "HUD Annual Performance Report",
    DOL_WORKFORCE: "DOL Workforce Performance Report",
    CALI_GRANTS: "California Grant Report",
    BOARD_REPORT: "Board Report",
    IMPACT_REPORT: "Impact Report",
    CUSTOM: "Custom Report",
  };
  return labels[reportType];
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    demographics: "Demographics",
    services: "Service Delivery",
    outcomes: "Program Outcomes",
    financial: "Financial",
    operations: "Operations",
  };
  return labels[category] || category;
}

function getStatusColor(status?: "below" | "good" | "excellent"): string {
  switch (status) {
    case "excellent":
      return "#059669"; // Green
    case "good":
      return "#2563eb"; // Blue
    case "below":
      return "#dc2626"; // Red
    default:
      return "#666666"; // Gray
  }
}

/**
 * Generate a preview PDF (anonymized, watermarked)
 */
export async function generatePreviewPdf(
  data: ReportPdfData
): Promise<Buffer> {
  // Anonymize metric values for preview
  const anonymizedMetrics = data.metrics.map(({ metric, result }) => ({
    metric,
    result: {
      ...result,
      value: Math.round(result.value * (0.8 + Math.random() * 0.4)),
      formattedValue: "***",
    },
  }));

  return generateReportPdf(
    {
      ...data,
      metrics: anonymizedMetrics,
      narratives: data.narratives.map((n) => ({
        ...n,
        content: "[Preview - Narrative content hidden]",
      })),
    },
    {
      watermark: "PREVIEW",
      includePageNumbers: false,
    }
  );
}
