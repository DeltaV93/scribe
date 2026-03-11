/**
 * CSV Export Generator
 *
 * Generates CSV exports for HUD HMIS, CAP60, and custom exports.
 */

import { ExportType } from "@prisma/client";
import { BaseExportGenerator } from "./base";
import { ExtractedRecord, OutputConfig, FieldMapping, CodeMappings } from "../types";

/**
 * CSV Export Generator
 */
export class CSVExportGenerator extends BaseExportGenerator {
  exportType: ExportType;

  constructor(
    exportType: ExportType,
    fieldMappings?: FieldMapping[],
    codeMappings?: CodeMappings
  ) {
    super(exportType, fieldMappings, codeMappings);
    this.exportType = exportType;
  }

  /**
   * Generate CSV file from records
   */
  async generate(records: ExtractedRecord[], config: OutputConfig): Promise<Buffer> {
    const rows: string[][] = [];

    // Add headers if configured
    if (config.includeHeaders) {
      rows.push(this.getHeaders());
    }

    // Add data rows
    for (const record of records) {
      rows.push(this.formatRow(record));
    }

    return this.buildOutput(rows, config);
  }

  getFileExtension(): string {
    return "csv";
  }

  getContentType(): string {
    return "text/csv";
  }
}

/**
 * HUD HMIS specific generator
 */
export class HUDHMISGenerator extends CSVExportGenerator {
  constructor(fieldMappings?: FieldMapping[], codeMappings?: CodeMappings) {
    super("HUD_HMIS", fieldMappings, codeMappings);
    this.exportType = "HUD_HMIS";
  }

  /**
   * Override to handle HMIS-specific formatting
   */
  protected formatRow(record: ExtractedRecord): string[] {
    return this.fieldMappings.map((mapping) => {
      let value = record.data[mapping.externalField];

      // Use default value if empty
      if (value === undefined || value === null || value === "") {
        value = mapping.defaultValue ?? "";
      }

      // HMIS requires specific formats for certain fields
      const strValue = String(value);

      // SSN should not have dashes for HMIS
      if (mapping.externalField === "SSN" && strValue) {
        return strValue.replace(/-/g, "");
      }

      return strValue;
    });
  }
}

/**
 * CAP60 specific generator
 */
export class CAP60Generator extends CSVExportGenerator {
  constructor(fieldMappings?: FieldMapping[], codeMappings?: CodeMappings) {
    super("CAP60", fieldMappings, codeMappings);
    this.exportType = "CAP60";
  }
}
