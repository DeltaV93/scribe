/**
 * Export Generators Index
 *
 * Factory for creating the appropriate export generator based on type.
 */

import { ExportType } from "@prisma/client";
import { ExportGenerator, FieldMapping, CodeMappings } from "../types";
import { BaseExportGenerator } from "./base";
import { CSVExportGenerator, HUDHMISGenerator, CAP60Generator } from "./csv-generator";
import { TXTExportGenerator, DOLWIPSGenerator } from "./txt-generator";
import { XLSXExportGenerator, CalGrantsGenerator } from "./xlsx-generator";

export {
  BaseExportGenerator,
  CSVExportGenerator,
  HUDHMISGenerator,
  CAP60Generator,
  TXTExportGenerator,
  DOLWIPSGenerator,
  XLSXExportGenerator,
  CalGrantsGenerator,
};

/**
 * Create the appropriate export generator for a given export type
 */
export function createGenerator(
  exportType: ExportType,
  fieldMappings?: FieldMapping[],
  codeMappings?: CodeMappings
): ExportGenerator {
  switch (exportType) {
    case "HUD_HMIS":
      return new HUDHMISGenerator(fieldMappings, codeMappings);

    case "DOL_WIPS":
      return new DOLWIPSGenerator(fieldMappings, codeMappings);

    case "CAP60":
      return new CAP60Generator(fieldMappings, codeMappings);

    case "CALI_GRANTS":
      return new CalGrantsGenerator(fieldMappings, codeMappings);

    case "CUSTOM":
      // Custom exports default to CSV
      return new CSVExportGenerator("CUSTOM", fieldMappings, codeMappings);

    default:
      throw new Error(`Unsupported export type: ${exportType}`);
  }
}

/**
 * Get the default output format for an export type
 */
export function getDefaultOutputFormat(exportType: ExportType): string {
  switch (exportType) {
    case "HUD_HMIS":
    case "CAP60":
    case "CUSTOM":
      return "CSV";
    case "DOL_WIPS":
      return "TXT";
    case "CALI_GRANTS":
      return "XLSX";
    default:
      return "CSV";
  }
}

/**
 * Get the file extension for an export type
 */
export function getFileExtension(exportType: ExportType): string {
  const generator = createGenerator(exportType);
  return generator.getFileExtension();
}

/**
 * Get the content type for an export type
 */
export function getContentType(exportType: ExportType): string {
  const generator = createGenerator(exportType);
  return generator.getContentType();
}
