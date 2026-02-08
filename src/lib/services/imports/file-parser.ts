/**
 * File Parser Service
 *
 * Parses CSV, Excel, and JSON files for import using xlsx and papaparse packages.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ParsedFile, ParseError, ParseOptions } from "./types";

// ============================================
// CSV PARSING (using papaparse)
// ============================================

/**
 * Parse a CSV file from a Buffer using papaparse
 */
export async function parseCSV(
  buffer: Buffer,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const {
    delimiter,
    hasHeaders = true,
    encoding = "utf-8",
    skipRows = 0,
    maxRows,
  } = options;

  const content = buffer.toString(encoding as BufferEncoding);
  const errors: ParseError[] = [];

  // Use papaparse for robust CSV parsing
  const parseResult = Papa.parse<Record<string, unknown>>(content, {
    header: hasHeaders,
    delimiter: delimiter || undefined, // Auto-detect if not specified
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    for (const err of parseResult.errors) {
      if (!errors.some((e) => e.row === err.row && e.message === err.message)) {
        errors.push({
          row: err.row,
          message: err.message,
          severity: err.type === "Quotes" || err.type === "FieldMismatch" ? "warning" : "error",
        });
      }
    }
  }

  // Skip initial rows if specified
  let data = parseResult.data;
  if (skipRows > 0 && data.length > skipRows) {
    data = data.slice(skipRows);
  }

  // Limit rows if specified
  const totalRows = data.length;
  const records = maxRows ? data.slice(0, maxRows) : data;

  // Get column names
  const columns = parseResult.meta.fields ||
    (data.length > 0 ? Object.keys(data[0]) : []);

  return {
    fileName: "",
    fileFormat: "CSV",
    totalRows,
    columns,
    preview: records.slice(0, 10),
    errors,
  };
}

// ============================================
// EXCEL PARSING (using xlsx package)
// ============================================

/**
 * Parse an Excel file from a Buffer using xlsx package
 */
export async function parseExcel(
  buffer: Buffer,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const { sheetName, hasHeaders = true, skipRows = 0, maxRows } = options;

  try {
    // Parse workbook from buffer
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Get the specified sheet or the first one
    const sheetNameToUse = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetNameToUse];

    if (!worksheet) {
      return {
        fileName: "",
        fileFormat: "XLSX",
        totalRows: 0,
        columns: [],
        preview: [],
        errors: [{ message: `Sheet "${sheetNameToUse}" not found in file`, severity: "error" }],
      };
    }

    // Convert to JSON with headers
    const jsonOptions: XLSX.Sheet2JSONOpts = {
      header: hasHeaders ? undefined : 1, // Use row 1 as header or generate A, B, C...
      defval: "", // Default value for empty cells
      raw: false, // Format dates and numbers
    };

    // Get raw data
    let rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, jsonOptions);

    // Skip rows if specified
    if (skipRows > 0) {
      rawData = rawData.slice(skipRows);
    }

    const totalRows = rawData.length;

    // Limit rows for processing
    const data = maxRows ? rawData.slice(0, maxRows) : rawData;

    // Extract column names
    let columns: string[] = [];
    if (data.length > 0) {
      columns = Object.keys(data[0]).map((key) => String(key));
    } else if (hasHeaders) {
      // Try to get headers from range
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = worksheet[cellAddress];
        columns.push(cell ? String(cell.v) : `Column ${col + 1}`);
      }
    }

    // Convert to our record format
    const records: Record<string, unknown>[] = data.map((row) => {
      const record: Record<string, unknown> = {};
      for (const col of columns) {
        record[col] = row[col] ?? "";
      }
      return record;
    });

    return {
      fileName: "",
      fileFormat: "XLSX",
      totalRows,
      columns,
      preview: records.slice(0, 10),
      errors: [],
    };
  } catch (error) {
    return {
      fileName: "",
      fileFormat: "XLSX",
      totalRows: 0,
      columns: [],
      preview: [],
      errors: [
        {
          message: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "error",
        },
      ],
    };
  }
}

// ============================================
// JSON PARSING
// ============================================

/**
 * Parse a JSON file from a Buffer
 */
export async function parseJSON(
  buffer: Buffer,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const { maxRows, skipRows = 0 } = options;

  try {
    const content = buffer.toString("utf-8");
    let data = JSON.parse(content);

    // Handle array of objects
    if (!Array.isArray(data)) {
      // Try to find an array property
      const arrayProp = Object.keys(data).find((key) => Array.isArray(data[key]));
      if (arrayProp) {
        data = data[arrayProp];
      } else {
        return {
          fileName: "",
          fileFormat: "JSON",
          totalRows: 0,
          columns: [],
          preview: [],
          errors: [
            { message: "JSON must be an array of objects or contain an array property", severity: "error" },
          ],
        };
      }
    }

    if (data.length === 0) {
      return {
        fileName: "",
        fileFormat: "JSON",
        totalRows: 0,
        columns: [],
        preview: [],
        errors: [{ message: "JSON array is empty", severity: "warning" }],
      };
    }

    // Skip rows if specified
    if (skipRows > 0) {
      data = data.slice(skipRows);
    }

    const totalRows = data.length;

    // Extract columns from first object (flatten nested objects)
    const columns = extractColumns(data[0]);

    // Limit rows if specified
    const records = maxRows ? data.slice(0, maxRows) : data;

    // Flatten records for consistent structure
    const flattenedRecords = records.map((record: Record<string, unknown>) =>
      flattenObject(record)
    );

    return {
      fileName: "",
      fileFormat: "JSON",
      totalRows,
      columns,
      preview: flattenedRecords.slice(0, 10),
      errors: [],
    };
  } catch (error) {
    return {
      fileName: "",
      fileFormat: "JSON",
      totalRows: 0,
      columns: [],
      preview: [],
      errors: [
        {
          message: `Invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "error",
        },
      ],
    };
  }
}

/**
 * Extract column names from an object, flattening nested objects
 */
function extractColumns(obj: Record<string, unknown>, prefix = ""): string[] {
  const columns: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // Recursively extract nested columns
      columns.push(...extractColumns(value as Record<string, unknown>, fullKey));
    } else {
      columns.push(fullKey);
    }
  }

  return columns;
}

/**
 * Flatten a nested object
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}

// ============================================
// UNIFIED PARSER
// ============================================

/**
 * Parse a file based on its format
 */
export async function parseFile(
  buffer: Buffer,
  fileName: string,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const extension = fileName.toLowerCase().split(".").pop();

  let result: ParsedFile;

  switch (extension) {
    case "csv":
    case "txt":
      result = await parseCSV(buffer, options);
      break;
    case "xlsx":
    case "xls":
      result = await parseExcel(buffer, options);
      break;
    case "json":
      result = await parseJSON(buffer, options);
      break;
    default:
      result = {
        fileName,
        fileFormat: "CSV",
        totalRows: 0,
        columns: [],
        preview: [],
        errors: [
          {
            message: `Unsupported file format: ${extension}. Supported formats: CSV, XLSX, XLS, JSON`,
            severity: "error",
          },
        ],
      };
  }

  result.fileName = fileName;
  return result;
}

// ============================================
// COLUMN ANALYSIS
// ============================================

/**
 * Analyze columns to help with mapping suggestions
 */
export function analyzeColumns(
  records: Record<string, unknown>[]
): Record<string, ColumnAnalysis> {
  const analysis: Record<string, ColumnAnalysis> = {};

  if (records.length === 0) return analysis;

  const columns = Object.keys(records[0]);

  for (const column of columns) {
    const values = records.map((r) => r[column]).filter((v) => v !== undefined && v !== "" && v !== null);
    const sampleValues = values.slice(0, 5).map(String);

    analysis[column] = {
      column,
      sampleValues,
      uniqueCount: new Set(values.map(String)).size,
      nullCount: records.length - values.length,
      inferredType: inferType(values),
      patterns: detectPatterns(values),
    };
  }

  return analysis;
}

export interface ColumnAnalysis {
  column: string;
  sampleValues: string[];
  uniqueCount: number;
  nullCount: number;
  inferredType: "string" | "number" | "date" | "boolean" | "phone" | "email" | "ssn" | "address";
  patterns: string[];
}

function inferType(values: unknown[]): ColumnAnalysis["inferredType"] {
  if (values.length === 0) return "string";

  const stringValues = values.map(String).filter((v) => v.trim() !== "");
  if (stringValues.length === 0) return "string";

  // Check for email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (stringValues.every((v) => emailPattern.test(v))) return "email";

  // Check for phone (various formats)
  const phonePattern = /^[\d\s\-()+ .]{7,}$/;
  const phoneDigitPattern = /\d/g;
  if (stringValues.every((v) => {
    const matches = v.match(phoneDigitPattern);
    return phonePattern.test(v) && matches && matches.length >= 7 && matches.length <= 15;
  })) return "phone";

  // Check for SSN
  const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;
  if (stringValues.every((v) => ssnPattern.test(v))) return "ssn";

  // Check for boolean
  const boolValues = ["true", "false", "yes", "no", "1", "0", "y", "n", "t", "f"];
  if (stringValues.every((v) => boolValues.includes(v.toLowerCase()))) return "boolean";

  // Check for date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // ISO
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // US
    /^\d{1,2}-\d{1,2}-\d{2,4}$/, // EU
    /^\d{1,2}\s+\w+\s+\d{2,4}$/, // 01 Jan 2024
  ];
  if (stringValues.every((v) => datePatterns.some((p) => p.test(v)))) return "date";

  // Check for number
  if (values.every((v) => {
    const cleaned = String(v).replace(/[$,]/g, "");
    return !isNaN(Number(cleaned)) && cleaned.trim() !== "";
  })) return "number";

  // Check for address (heuristic: contains numbers and common street words)
  const addressKeywords = ["street", "st", "ave", "avenue", "road", "rd", "drive", "dr", "lane", "ln", "way", "blvd", "court", "ct"];
  if (stringValues.some((v) => {
    const lower = v.toLowerCase();
    return /\d/.test(v) && addressKeywords.some((kw) => lower.includes(kw));
  })) return "address";

  return "string";
}

function detectPatterns(values: unknown[]): string[] {
  const patterns: string[] = [];
  const stringValues = values.map(String).filter((v) => v.trim() !== "");

  if (stringValues.length === 0) return patterns;

  // Check for consistent length
  const lengths = new Set(stringValues.map((v) => v.length));
  if (lengths.size === 1 && stringValues.length > 2) {
    patterns.push(`fixed_length:${[...lengths][0]}`);
  }

  // Check for common prefixes
  if (stringValues.length > 1) {
    let commonPrefix = stringValues[0];
    for (const value of stringValues) {
      while (!value.startsWith(commonPrefix) && commonPrefix.length > 0) {
        commonPrefix = commonPrefix.slice(0, -1);
      }
    }
    if (commonPrefix.length > 2) {
      patterns.push(`common_prefix:${commonPrefix}`);
    }
  }

  // Check for numeric patterns
  if (stringValues.every((v) => /^\d+$/.test(v))) {
    patterns.push("all_numeric");
  }

  // Check for alphanumeric pattern (like IDs)
  if (stringValues.every((v) => /^[A-Z0-9]+$/i.test(v))) {
    patterns.push("alphanumeric");
  }

  return patterns;
}

// ============================================
// COLUMN TYPE DETECTION UTILITIES
// ============================================

/**
 * Auto-detect column types for smart mapping suggestions
 */
export function detectColumnTypes(
  columns: string[],
  sampleData: Record<string, unknown>[]
): Record<string, { type: ColumnAnalysis["inferredType"]; confidence: number }> {
  const analysis = analyzeColumns(sampleData);
  const result: Record<string, { type: ColumnAnalysis["inferredType"]; confidence: number }> = {};

  for (const column of columns) {
    const colAnalysis = analysis[column];
    if (colAnalysis) {
      // Calculate confidence based on consistency
      const nonNullRatio = 1 - (colAnalysis.nullCount / sampleData.length);
      const uniqueRatio = colAnalysis.uniqueCount / (sampleData.length - colAnalysis.nullCount || 1);

      let confidence = nonNullRatio * 0.6;

      // Higher confidence for types that require pattern matching
      if (["email", "phone", "ssn", "date"].includes(colAnalysis.inferredType)) {
        confidence += 0.3;
      }

      result[column] = {
        type: colAnalysis.inferredType,
        confidence: Math.min(confidence, 1),
      };
    }
  }

  return result;
}
