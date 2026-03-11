/**
 * TXT (Pipe-Delimited) Export Generator
 *
 * Generates pipe-delimited TXT exports for DOL WIPS format.
 */

import { ExportType } from "@prisma/client";
import { BaseExportGenerator } from "./base";
import { ExtractedRecord, OutputConfig, FieldMapping, CodeMappings } from "../types";

/**
 * Pipe-delimited TXT Export Generator for DOL WIPS
 */
export class TXTExportGenerator extends BaseExportGenerator {
  exportType: ExportType = "DOL_WIPS";

  constructor(fieldMappings?: FieldMapping[], codeMappings?: CodeMappings) {
    super("DOL_WIPS", fieldMappings, codeMappings);
  }

  /**
   * Generate pipe-delimited TXT file from records
   */
  async generate(records: ExtractedRecord[], config: OutputConfig): Promise<Buffer> {
    // DOL WIPS uses pipe delimiter
    const txtConfig: OutputConfig = {
      ...config,
      delimiter: "|",
    };

    const rows: string[][] = [];

    // Add headers if configured
    if (config.includeHeaders) {
      rows.push(this.getHeaders());
    }

    // Add data rows
    for (const record of records) {
      rows.push(this.formatRow(record));
    }

    return this.buildTXTOutput(rows, txtConfig);
  }

  getFileExtension(): string {
    return "txt";
  }

  getContentType(): string {
    return "text/plain";
  }

  /**
   * Format row for DOL WIPS specific requirements
   */
  protected formatRow(record: ExtractedRecord): string[] {
    return this.fieldMappings.map((mapping) => {
      let value = record.data[mapping.externalField];

      // Use default value if empty
      if (value === undefined || value === null || value === "") {
        value = mapping.defaultValue ?? "";
      }

      const strValue = String(value);

      // DOL WIPS specific formatting
      // SSN must be 9 digits, no dashes
      if (mapping.externalField === "SSN" && strValue) {
        return strValue.replace(/-/g, "").padStart(9, "0");
      }

      // Phone must be digits only
      if (mapping.externalField === "PHONE" && strValue) {
        return strValue.replace(/\D/g, "");
      }

      return strValue;
    });
  }

  /**
   * Build pipe-delimited output (no quoting needed for pipe format)
   */
  private buildTXTOutput(rows: string[][], config: OutputConfig): Buffer {
    const lineEnding = config.lineEnding === "CRLF" ? "\r\n" : "\n";

    // For pipe-delimited, we don't quote fields but we do need to escape pipes
    const lines = rows.map((row) =>
      row.map((cell) => this.escapePipe(cell)).join(config.delimiter)
    );

    const content = lines.join(lineEnding);
    return Buffer.from(content, config.encoding as BufferEncoding || "utf-8");
  }

  /**
   * Escape pipe characters in field values
   */
  private escapePipe(value: string): string {
    // Replace pipes with empty string or placeholder
    // DOL WIPS typically doesn't allow pipes in data
    return value.replace(/\|/g, "");
  }
}

/**
 * DOL WIPS specific generator
 */
export class DOLWIPSGenerator extends TXTExportGenerator {
  constructor(fieldMappings?: FieldMapping[], codeMappings?: CodeMappings) {
    super(fieldMappings, codeMappings);
  }

  /**
   * Additional DOL WIPS validation
   */
  protected formatRow(record: ExtractedRecord): string[] {
    const row = super.formatRow(record);

    // DOL WIPS has fixed-width requirements for some fields
    // Apply padding/truncation as needed
    return row.map((value, index) => {
      const mapping = this.fieldMappings[index];

      // Enforce max lengths for specific fields
      const maxLengths: Record<string, number> = {
        FIRST_NAME: 35,
        LAST_NAME: 35,
        MIDDLE_INITIAL: 1,
        ADDRESS_LINE_1: 100,
        CITY: 50,
        STATE: 2,
        ZIP_CODE: 10,
      };

      const maxLen = maxLengths[mapping.externalField];
      if (maxLen && value.length > maxLen) {
        return value.substring(0, maxLen);
      }

      return value;
    });
  }
}
