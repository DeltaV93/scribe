/**
 * Data Transformers
 *
 * Transform Scrybe values to funder-required formats.
 */

import { CodeMappings } from "../types";

/**
 * Transform a value based on a transformer string
 *
 * Transformer format: "type:params"
 * Examples:
 *   - "date:YYYY-MM-DD"
 *   - "code:HMIS_VETERAN"
 *   - "number:integer"
 *   - "ssn:format"
 *   - "phone:digits"
 */
export function transformValue(
  value: unknown,
  transformer: string,
  codeMappings: CodeMappings
): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  const [type, params] = transformer.split(":", 2);

  switch (type) {
    case "date":
      return transformDate(value, params);

    case "code":
      return transformCode(value, params, codeMappings);

    case "number":
      return transformNumber(value, params);

    case "ssn":
      return transformSSN(value, params);

    case "phone":
      return transformPhone(value, params);

    default:
      return value;
  }
}

/**
 * Transform date to specified format
 */
function transformDate(value: unknown, format: string): string {
  const strValue = String(value);

  // Try to parse the date
  let date: Date;

  // Check if it's already a Date object
  if (value instanceof Date) {
    date = value;
  } else {
    // Try parsing as ISO string or other formats
    date = new Date(strValue);
  }

  if (isNaN(date.getTime())) {
    // Return original if can't parse
    return strValue;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  switch (format) {
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;

    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;

    case "MMDDYYYY":
      return `${month}${day}${year}`;

    case "DD-MM-YYYY":
      return `${day}-${month}-${year}`;

    case "YYYYMMDD":
      return `${year}${month}${day}`;

    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Transform value using code mapping
 */
function transformCode(
  value: unknown,
  mappingName: string,
  codeMappings: CodeMappings
): string {
  const mapping = codeMappings[mappingName];
  if (!mapping) {
    // No mapping found, return original
    return String(value);
  }

  const strValue = String(value);

  // Try exact match first
  if (strValue in mapping) {
    return mapping[strValue];
  }

  // Try case-insensitive match
  const lowerValue = strValue.toLowerCase();
  for (const [key, mappedValue] of Object.entries(mapping)) {
    if (key.toLowerCase() === lowerValue) {
      return mappedValue;
    }
  }

  // Try partial match (value contains key or key contains value)
  for (const [key, mappedValue] of Object.entries(mapping)) {
    if (
      strValue.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(strValue.toLowerCase())
    ) {
      return mappedValue;
    }
  }

  // Return original if no mapping found
  return strValue;
}

/**
 * Transform number to specified format
 */
function transformNumber(value: unknown, format: string): string | number {
  const numValue = Number(value);

  if (isNaN(numValue)) {
    return String(value);
  }

  switch (format) {
    case "integer":
      return Math.round(numValue);

    case "decimal2":
      return numValue.toFixed(2);

    case "decimal4":
      return numValue.toFixed(4);

    case "percent":
      return `${(numValue * 100).toFixed(1)}%`;

    case "currency":
      return numValue.toFixed(2);

    default:
      return numValue;
  }
}

/**
 * Transform SSN to specified format
 */
function transformSSN(value: unknown, format: string): string {
  const strValue = String(value).replace(/\D/g, "");

  // Ensure 9 digits
  const padded = strValue.padStart(9, "0").substring(0, 9);

  switch (format) {
    case "format":
      // XXX-XX-XXXX
      return `${padded.substring(0, 3)}-${padded.substring(3, 5)}-${padded.substring(5)}`;

    case "nodash":
      // XXXXXXXXX
      return padded;

    case "masked":
      // XXX-XX-XXXX with first 5 masked
      return `***-**-${padded.substring(5)}`;

    default:
      return padded;
  }
}

/**
 * Transform phone number to specified format
 */
function transformPhone(value: unknown, format: string): string {
  const strValue = String(value).replace(/\D/g, "");

  // Remove country code if present
  const digits = strValue.length === 11 && strValue.startsWith("1")
    ? strValue.substring(1)
    : strValue;

  switch (format) {
    case "digits":
      return digits;

    case "format":
      // (XXX) XXX-XXXX
      if (digits.length === 10) {
        return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
      }
      return digits;

    case "dashes":
      // XXX-XXX-XXXX
      if (digits.length === 10) {
        return `${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}`;
      }
      return digits;

    case "e164":
      // +1XXXXXXXXXX
      return `+1${digits}`;

    default:
      return digits;
  }
}

/**
 * Get all available transformers
 */
export function getAvailableTransformers(): Array<{
  type: string;
  description: string;
  examples: string[];
}> {
  return [
    {
      type: "date",
      description: "Format date values",
      examples: ["date:YYYY-MM-DD", "date:MM/DD/YYYY", "date:MMDDYYYY"],
    },
    {
      type: "code",
      description: "Map values using code tables",
      examples: ["code:HMIS_VETERAN", "code:WIPS_GENDER"],
    },
    {
      type: "number",
      description: "Format numeric values",
      examples: ["number:integer", "number:decimal2", "number:percent"],
    },
    {
      type: "ssn",
      description: "Format Social Security Numbers",
      examples: ["ssn:format", "ssn:nodash", "ssn:masked"],
    },
    {
      type: "phone",
      description: "Format phone numbers",
      examples: ["phone:digits", "phone:format", "phone:e164"],
    },
  ];
}
