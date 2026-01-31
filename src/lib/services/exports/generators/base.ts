/**
 * Base Export Generator
 *
 * Abstract base class for funder-specific export generators.
 */

import { ExportType } from "@prisma/client";
import {
  ExportGenerator,
  ExtractedRecord,
  OutputConfig,
  ValidationResult,
  ValidationError,
  ValidationRule,
  FieldMapping,
  CodeMappings,
} from "../types";
import { getPredefinedTemplate } from "../templates/predefined";

/**
 * Abstract base class for export generators
 */
export abstract class BaseExportGenerator implements ExportGenerator {
  abstract exportType: ExportType;

  protected fieldMappings: FieldMapping[];
  protected codeMappings: CodeMappings;
  protected validationRules: ValidationRule[];

  constructor(
    exportType: ExportType,
    fieldMappings?: FieldMapping[],
    codeMappings?: CodeMappings
  ) {
    const predefined = getPredefinedTemplate(exportType);
    this.fieldMappings = fieldMappings || predefined?.fields || [];
    this.codeMappings = codeMappings || predefined?.codeMappings || {};
    this.validationRules = predefined?.validationRules || [];
  }

  /**
   * Generate export file from records
   */
  abstract generate(records: ExtractedRecord[], config: OutputConfig): Promise<Buffer>;

  /**
   * Get file extension for this export type
   */
  abstract getFileExtension(): string;

  /**
   * Get content type for this export type
   */
  abstract getContentType(): string;

  /**
   * Validate records against funder requirements
   */
  validate(records: ExtractedRecord[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    records.forEach((record, index) => {
      // Check each validation rule
      for (const rule of this.validationRules) {
        const value = record.data[rule.field];
        const error = this.validateField(rule, value, index, record.clientId);

        if (error) {
          if (error.severity === "error") {
            errors.push(error);
          } else {
            warnings.push(error);
          }
        }
      }

      // Check required fields from mappings
      for (const mapping of this.fieldMappings) {
        if (mapping.required) {
          const value = record.data[mapping.externalField];
          if (value === undefined || value === null || value === "") {
            // Check if there's a default value
            if (!mapping.defaultValue) {
              warnings.push({
                recordIndex: index,
                clientId: record.clientId,
                field: mapping.externalField,
                value,
                message: `Required field ${mapping.externalField} is missing`,
                severity: "warning",
              });
            }
          }
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validRecordCount: records.length - new Set(errors.map((e) => e.recordIndex)).size,
      invalidRecordCount: new Set(errors.map((e) => e.recordIndex)).size,
    };
  }

  /**
   * Validate a single field against a rule
   */
  protected validateField(
    rule: ValidationRule,
    value: unknown,
    recordIndex: number,
    clientId?: string
  ): ValidationError | null {
    switch (rule.type) {
      case "required":
        if (value === undefined || value === null || value === "") {
          return {
            recordIndex,
            clientId,
            field: rule.field,
            value,
            message: rule.message,
            severity: "error",
          };
        }
        break;

      case "format":
        if (value !== undefined && value !== null && value !== "") {
          const pattern = rule.params?.pattern as string;
          if (pattern) {
            const regex = new RegExp(pattern);
            if (!regex.test(String(value))) {
              return {
                recordIndex,
                clientId,
                field: rule.field,
                value,
                message: rule.message,
                severity: "error",
              };
            }
          }
        }
        break;

      case "range":
        if (value !== undefined && value !== null) {
          const numValue = Number(value);
          const min = rule.params?.min as number | undefined;
          const max = rule.params?.max as number | undefined;

          if (!isNaN(numValue)) {
            if (min !== undefined && numValue < min) {
              return {
                recordIndex,
                clientId,
                field: rule.field,
                value,
                message: rule.message,
                severity: "error",
              };
            }
            if (max !== undefined && numValue > max) {
              return {
                recordIndex,
                clientId,
                field: rule.field,
                value,
                message: rule.message,
                severity: "error",
              };
            }
          }
        }
        break;

      case "enum":
        if (value !== undefined && value !== null && value !== "") {
          const validValues = rule.params?.values as string[] | undefined;
          if (validValues && !validValues.includes(String(value))) {
            return {
              recordIndex,
              clientId,
              field: rule.field,
              value,
              message: rule.message,
              severity: "error",
            };
          }
        }
        break;
    }

    return null;
  }

  /**
   * Format a record's data into an ordered row based on field mappings
   */
  protected formatRow(record: ExtractedRecord): string[] {
    return this.fieldMappings.map((mapping) => {
      let value = record.data[mapping.externalField];

      // Use default value if empty
      if (value === undefined || value === null || value === "") {
        value = mapping.defaultValue ?? "";
      }

      return String(value);
    });
  }

  /**
   * Get headers from field mappings
   */
  protected getHeaders(): string[] {
    return this.fieldMappings.map((m) => m.externalField);
  }

  /**
   * Escape a value for CSV output
   */
  protected escapeCSV(value: string, config: OutputConfig): string {
    const quoteChar = config.quoteChar || '"';
    const escapeChar = config.escapeChar || '"';

    // Check if value needs quoting
    const needsQuotes =
      value.includes(config.delimiter) ||
      value.includes(quoteChar) ||
      value.includes("\n") ||
      value.includes("\r");

    if (needsQuotes) {
      // Escape quotes within the value
      const escaped = value.replace(
        new RegExp(quoteChar, "g"),
        escapeChar + quoteChar
      );
      return `${quoteChar}${escaped}${quoteChar}`;
    }

    return value;
  }

  /**
   * Build output buffer from rows
   */
  protected buildOutput(rows: string[][], config: OutputConfig): Buffer {
    const lineEnding = config.lineEnding === "CRLF" ? "\r\n" : "\n";
    const lines = rows.map((row) =>
      row.map((cell) => this.escapeCSV(cell, config)).join(config.delimiter)
    );
    const content = lines.join(lineEnding);
    return Buffer.from(content, config.encoding as BufferEncoding || "utf-8");
  }
}
