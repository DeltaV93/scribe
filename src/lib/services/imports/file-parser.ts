/**
 * File Parser Service
 *
 * Parses CSV, Excel, and JSON files for import.
 */

import { ParsedFile, ParseError, ParseOptions } from "./types";

// ============================================
// CSV PARSING
// ============================================

/**
 * Parse a CSV file from a Buffer
 */
export async function parseCSV(
  buffer: Buffer,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const {
    delimiter = ",",
    hasHeaders = true,
    encoding = "utf-8",
    skipRows = 0,
    maxRows,
  } = options;

  const content = buffer.toString(encoding as BufferEncoding);
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    return {
      fileName: "",
      fileFormat: "CSV",
      totalRows: 0,
      columns: [],
      preview: [],
      errors: [{ message: "File is empty", severity: "error" }],
    };
  }

  // Skip rows if specified
  const dataLines = lines.slice(skipRows);

  // Parse headers
  const headerLine = hasHeaders ? dataLines[0] : null;
  const columns = headerLine
    ? parseCSVLine(headerLine, delimiter)
    : dataLines[0]
      ? parseCSVLine(dataLines[0], delimiter).map((_, i) => `Column ${i + 1}`)
      : [];

  // Parse data rows
  const dataStartIndex = hasHeaders ? 1 : 0;
  const dataRows = dataLines.slice(dataStartIndex);
  const rowsToProcess = maxRows ? dataRows.slice(0, maxRows) : dataRows;

  const errors: ParseError[] = [];
  const records: Record<string, unknown>[] = [];

  for (let i = 0; i < rowsToProcess.length; i++) {
    const line = rowsToProcess[i];
    if (!line.trim()) continue;

    try {
      const values = parseCSVLine(line, delimiter);
      const record: Record<string, unknown> = {};

      columns.forEach((col, idx) => {
        record[col] = values[idx] ?? "";
      });

      records.push(record);
    } catch (error) {
      errors.push({
        row: i + dataStartIndex + skipRows + 1,
        message: `Failed to parse row: ${error instanceof Error ? error.message : "Unknown error"}`,
        severity: "warning",
      });
    }
  }

  return {
    fileName: "",
    fileFormat: "CSV",
    totalRows: dataRows.length,
    columns,
    preview: records.slice(0, 10),
    errors,
  };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// ============================================
// EXCEL PARSING
// ============================================

/**
 * Parse an Excel file from a Buffer
 */
export async function parseExcel(
  buffer: Buffer,
  options: ParseOptions = {}
): Promise<ParsedFile> {
  const { sheetName, hasHeaders = true, skipRows = 0, maxRows } = options;

  try {
    // Dynamic import for exceljs
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Get the specified sheet or the first one
    const worksheet = sheetName
      ? workbook.getWorksheet(sheetName)
      : workbook.worksheets[0];

    if (!worksheet) {
      return {
        fileName: "",
        fileFormat: "XLSX",
        totalRows: 0,
        columns: [],
        preview: [],
        errors: [{ message: "No worksheet found in file", severity: "error" }],
      };
    }

    const errors: ParseError[] = [];
    const rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    let rowIndex = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worksheet.eachRow((row: any, rowNumber: number) => {
      // Skip specified rows
      if (rowNumber <= skipRows) return;

      rowIndex++;

      // First data row is headers if hasHeaders
      if (hasHeaders && rowIndex === 1) {
        columns = row.values
          ? (row.values as (string | undefined)[])
              .slice(1) // Excel rows are 1-indexed
              .map((v, i) => String(v || `Column ${i + 1}`))
          : [];
        return;
      }

      // Process data row
      if (maxRows && rows.length >= maxRows) return;

      const record: Record<string, unknown> = {};
      const values = row.values ? (row.values as unknown[]).slice(1) : [];

      columns.forEach((col, idx) => {
        let value = values[idx];

        // Handle Excel cell objects
        if (value && typeof value === "object" && "result" in value) {
          value = (value as { result: unknown }).result;
        }

        record[col] = value ?? "";
      });

      rows.push(record);
    });

    // If no headers, generate column names
    if (!hasHeaders && rows.length > 0) {
      const firstRow = rows[0];
      columns = Object.keys(firstRow);
    }

    return {
      fileName: "",
      fileFormat: "XLSX",
      totalRows: rows.length,
      columns,
      preview: rows.slice(0, 10),
      errors,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExcelJS(): Promise<any> {
  try {
    // @ts-expect-error - exceljs may not be installed
    const ExcelJS = await import("exceljs");
    return ExcelJS.default || ExcelJS;
  } catch (error) {
    throw new Error(
      "exceljs is required for Excel imports. Install it with: npm install exceljs"
    );
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
  const { maxRows } = options;

  try {
    const content = buffer.toString("utf-8");
    const data = JSON.parse(content);

    // Handle array of objects
    if (!Array.isArray(data)) {
      return {
        fileName: "",
        fileFormat: "JSON",
        totalRows: 0,
        columns: [],
        preview: [],
        errors: [
          { message: "JSON must be an array of objects", severity: "error" },
        ],
      };
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

    // Extract columns from first object
    const columns = Object.keys(data[0]);

    // Limit rows if specified
    const records = maxRows ? data.slice(0, maxRows) : data;

    return {
      fileName: "",
      fileFormat: "JSON",
      totalRows: data.length,
      columns,
      preview: records.slice(0, 10),
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
            message: `Unsupported file format: ${extension}. Supported formats: CSV, XLSX, JSON`,
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
    const values = records.map((r) => r[column]).filter((v) => v !== undefined && v !== "");
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

interface ColumnAnalysis {
  column: string;
  sampleValues: string[];
  uniqueCount: number;
  nullCount: number;
  inferredType: "string" | "number" | "date" | "boolean" | "phone" | "email" | "ssn";
  patterns: string[];
}

function inferType(values: unknown[]): ColumnAnalysis["inferredType"] {
  if (values.length === 0) return "string";

  const stringValues = values.map(String);

  // Check for email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (stringValues.every((v) => emailPattern.test(v))) return "email";

  // Check for phone
  const phonePattern = /^[\d\s\-()+ ]{10,}$/;
  if (stringValues.every((v) => phonePattern.test(v))) return "phone";

  // Check for SSN
  const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;
  if (stringValues.every((v) => ssnPattern.test(v))) return "ssn";

  // Check for boolean
  const boolValues = ["true", "false", "yes", "no", "1", "0", "y", "n"];
  if (stringValues.every((v) => boolValues.includes(v.toLowerCase()))) return "boolean";

  // Check for date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // ISO
    /^\d{2}\/\d{2}\/\d{4}$/, // US
    /^\d{2}-\d{2}-\d{4}$/, // EU
  ];
  if (stringValues.every((v) => datePatterns.some((p) => p.test(v)))) return "date";

  // Check for number
  if (values.every((v) => !isNaN(Number(v)))) return "number";

  return "string";
}

function detectPatterns(values: unknown[]): string[] {
  const patterns: string[] = [];
  const stringValues = values.map(String);

  // Check for consistent length
  const lengths = new Set(stringValues.map((v) => v.length));
  if (lengths.size === 1) {
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

  return patterns;
}
