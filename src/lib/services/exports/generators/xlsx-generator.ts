/**
 * Excel (XLSX) Export Generator
 *
 * Generates Excel exports for CalGrants format.
 * Uses exceljs for Excel file generation.
 */

import { ExportType } from "@prisma/client";
import { BaseExportGenerator } from "./base";
import { ExtractedRecord, OutputConfig, FieldMapping, CodeMappings } from "../types";

// Dynamic import for exceljs to avoid loading it unless needed
// Note: exceljs must be installed: npm install exceljs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExcelJS(): Promise<any> {
  try {
    const ExcelJS = await import("exceljs");
    return ExcelJS.default || ExcelJS;
  } catch {
    throw new Error(
      "exceljs is required for Excel exports. Install it with: npm install exceljs"
    );
  }
}

/**
 * Excel (XLSX) Export Generator for CalGrants
 */
export class XLSXExportGenerator extends BaseExportGenerator {
  exportType: ExportType = "CALI_GRANTS";

  constructor(fieldMappings?: FieldMapping[], codeMappings?: CodeMappings) {
    super("CALI_GRANTS", fieldMappings, codeMappings);
  }

  /**
   * Generate Excel file from records
   */
  async generate(records: ExtractedRecord[], config: OutputConfig): Promise<Buffer> {
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();

    // Set workbook properties
    workbook.creator = "Scrybe";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Create main data worksheet
    const worksheet = workbook.addWorksheet("Export Data", {
      properties: { tabColor: { argb: "FF4472C4" } },
    });

    // Add headers with styling
    const headers = this.getHeaders();
    const headerRow = worksheet.addRow(headers);

    // Style header row
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Set column widths based on header content
    worksheet.columns = headers.map((header, index) => ({
      key: header,
      width: Math.max(header.length + 5, 15),
    }));

    // Add data rows
    for (const record of records) {
      const rowData = this.formatRowForExcel(record);
      const row = worksheet.addRow(rowData);

      // Apply date formatting to date columns
      this.fieldMappings.forEach((mapping, colIndex) => {
        if (mapping.transformer?.startsWith("date:")) {
          const cell = row.getCell(colIndex + 1);
          if (cell.value instanceof Date) {
            cell.numFmt = "yyyy-mm-dd";
          }
        }
      });
    }

    // Add alternating row colors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2F2F2" },
        };
      }
    });

    // Freeze header row
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    // Add auto-filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    // Add metadata worksheet
    const metaSheet = workbook.addWorksheet("Export Info");
    metaSheet.addRow(["Export Type", this.exportType]);
    metaSheet.addRow(["Generated At", new Date().toISOString()]);
    metaSheet.addRow(["Total Records", records.length]);
    metaSheet.addRow(["Field Count", headers.length]);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  getFileExtension(): string {
    return "xlsx";
  }

  getContentType(): string {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  /**
   * Format row for Excel, preserving data types
   */
  protected formatRowForExcel(record: ExtractedRecord): (string | number | Date | null)[] {
    return this.fieldMappings.map((mapping) => {
      let value = record.data[mapping.externalField];

      // Use default value if empty
      if (value === undefined || value === null || value === "") {
        const defaultVal = mapping.defaultValue;
        if (defaultVal === undefined) return null;
        value = defaultVal;
      }

      // Handle different data types
      if (mapping.transformer?.startsWith("date:")) {
        // Try to parse as date
        const dateValue = new Date(value as string);
        if (!isNaN(dateValue.getTime())) {
          return dateValue;
        }
        return String(value);
      }

      if (mapping.transformer?.startsWith("number:")) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          return numValue;
        }
        return String(value);
      }

      return String(value);
    });
  }
}

/**
 * CalGrants specific generator
 */
export class CalGrantsGenerator extends XLSXExportGenerator {
  constructor(fieldMappings?: FieldMapping[], codeMappings?: CodeMappings) {
    super(fieldMappings, codeMappings);
  }

  /**
   * Generate CalGrants Excel with additional sheets
   */
  async generate(records: ExtractedRecord[], config: OutputConfig): Promise<Buffer> {
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Scrybe - CalGrants Export";
    workbook.created = new Date();

    // Main data worksheet
    const dataSheet = workbook.addWorksheet("Participant Data");
    await this.populateDataSheet(dataSheet, records);

    // Summary worksheet
    const summarySheet = workbook.addWorksheet("Summary Statistics");
    this.populateSummarySheet(summarySheet, records);

    // Export Info worksheet
    const infoSheet = workbook.addWorksheet("Export Info");
    this.populateInfoSheet(infoSheet, records);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async populateDataSheet(worksheet: any, records: ExtractedRecord[]) {
    const headers = this.getHeaders();

    // Header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2E7D32" }, // California green
    };

    // Set column widths
    worksheet.columns = headers.map((header) => ({
      key: header,
      width: Math.max(header.length + 5, 15),
    }));

    // Data rows
    for (const record of records) {
      worksheet.addRow(this.formatRowForExcel(record));
    }

    // Freeze and filter
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private populateSummarySheet(worksheet: any, records: ExtractedRecord[]) {
    worksheet.addRow(["Summary Statistics"]).font = { bold: true, size: 14 };
    worksheet.addRow([]);

    // Count by status
    const statusCounts: Record<string, number> = {};
    records.forEach((r) => {
      const status = String(r.data["Completion_Status"] || "Unknown");
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    worksheet.addRow(["Completion Status", "Count"]).font = { bold: true };
    Object.entries(statusCounts).forEach(([status, count]) => {
      worksheet.addRow([status, count]);
    });

    worksheet.addRow([]);

    // Count by county
    const countyCounts: Record<string, number> = {};
    records.forEach((r) => {
      const county = String(r.data["County_of_Residence"] || "Unknown");
      countyCounts[county] = (countyCounts[county] || 0) + 1;
    });

    worksheet.addRow(["County", "Participants"]).font = { bold: true };
    Object.entries(countyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([county, count]) => {
        worksheet.addRow([county, count]);
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private populateInfoSheet(worksheet: any, records: ExtractedRecord[]) {
    worksheet.addRow(["Export Information"]).font = { bold: true, size: 14 };
    worksheet.addRow([]);

    const info = [
      ["Export Type", "CalGrants Performance Report"],
      ["Generated At", new Date().toISOString()],
      ["Total Participants", records.length],
      ["Field Count", this.fieldMappings.length],
      ["Format", "XLSX (Excel)"],
    ];

    info.forEach(([label, value]) => {
      const row = worksheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    });
  }
}
