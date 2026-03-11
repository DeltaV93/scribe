/**
 * Field Mapper
 *
 * Maps Scrybe data fields to external funder field formats.
 */

import { FieldMapping, CodeMappings } from "../types";
import { transformValue } from "./transformers";

/**
 * Source data structure containing all available data sources
 */
export interface SourceData {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    } | null;
    internalId?: string | null;
    status: string;
    createdAt: Date;
  };
  formData: Record<string, unknown>;
  program?: {
    id: string;
    name: string;
    labelType: string;
    startDate?: Date | null;
    endDate?: Date | null;
    location?: string | null;
  } | null;
  enrollment?: {
    id: string;
    enrolledDate: Date;
    status: string;
    completionDate?: Date | null;
    withdrawalDate?: Date | null;
    totalHours?: number;
  } | null;
}

/**
 * Map source data to external field values using field mappings
 */
export function mapFields(
  source: SourceData,
  fieldMappings: FieldMapping[],
  codeMappings: CodeMappings
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of fieldMappings) {
    let value = extractValue(source, mapping.scrybeField);

    // Apply transformer if specified
    if (mapping.transformer && value !== undefined && value !== null) {
      value = transformValue(value, mapping.transformer, codeMappings);
    }

    // Use default value if empty
    if (value === undefined || value === null || value === "") {
      value = mapping.defaultValue ?? "";
    }

    result[mapping.externalField] = value;
  }

  return result;
}

/**
 * Extract a value from source data using a field path
 *
 * Field path format:
 *   - "client.firstName" - direct client field
 *   - "client.address.city" - nested client field
 *   - "form:dateOfBirth" - form field by slug
 *   - "program.name" - program field
 *   - "enrollment.status" - enrollment field
 */
export function extractValue(source: SourceData, fieldPath: string): unknown {
  // Handle form fields (format: "form:fieldSlug")
  if (fieldPath.startsWith("form:")) {
    const slug = fieldPath.substring(5);
    return source.formData[slug];
  }

  // Handle regular dotted paths
  const parts = fieldPath.split(".");
  const rootKey = parts[0] as keyof SourceData;

  let current: unknown = source[rootKey];

  // Navigate nested path
  for (let i = 1; i < parts.length && current !== undefined && current !== null; i++) {
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[parts[i]];
    } else {
      current = undefined;
    }
  }

  return current;
}

/**
 * Get the data type for a field path
 */
export function getFieldType(fieldPath: string): string {
  if (fieldPath.startsWith("form:")) {
    // Form fields could be any type - return unknown
    return "unknown";
  }

  // Map of known field types
  const fieldTypes: Record<string, string> = {
    "client.id": "string",
    "client.firstName": "string",
    "client.lastName": "string",
    "client.phone": "phone",
    "client.email": "email",
    "client.address.street": "string",
    "client.address.city": "string",
    "client.address.state": "string",
    "client.address.zip": "string",
    "client.internalId": "string",
    "client.status": "enum",
    "client.createdAt": "date",
    "program.id": "string",
    "program.name": "string",
    "program.labelType": "enum",
    "program.startDate": "date",
    "program.endDate": "date",
    "program.location": "string",
    "enrollment.id": "string",
    "enrollment.enrolledDate": "date",
    "enrollment.status": "enum",
    "enrollment.completionDate": "date",
    "enrollment.withdrawalDate": "date",
    "enrollment.totalHours": "number",
  };

  return fieldTypes[fieldPath] || "unknown";
}

/**
 * Validate that all required fields can be mapped from source data
 */
export function validateMappings(
  fieldMappings: FieldMapping[],
  availableFormFields: string[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const formFieldSet = new Set(availableFormFields.map((f) => `form:${f}`));

  for (const mapping of fieldMappings) {
    const path = mapping.scrybeField;

    // Check form fields exist
    if (path.startsWith("form:") && !formFieldSet.has(path)) {
      if (mapping.required && !mapping.defaultValue) {
        errors.push(`Required form field not found: ${path}`);
      } else {
        warnings.push(`Form field not found: ${path}`);
      }
    }

    // Check for valid path format
    if (!path.includes(".") && !path.startsWith("form:")) {
      errors.push(`Invalid field path format: ${path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Suggest field mappings based on field names
 */
export function suggestMappings(
  externalFields: string[],
  availableFormFields: string[]
): Array<{
  externalField: string;
  suggestedPath: string | null;
  confidence: number;
}> {
  const suggestions: Array<{
    externalField: string;
    suggestedPath: string | null;
    confidence: number;
  }> = [];

  // Common field name patterns
  const patterns: Record<string, string[]> = {
    firstName: ["client.firstName", "form:firstName", "form:first_name"],
    lastName: ["client.lastName", "form:lastName", "form:last_name"],
    phone: ["client.phone", "form:phone", "form:phoneNumber"],
    email: ["client.email", "form:email", "form:emailAddress"],
    dob: ["form:dateOfBirth", "form:dob", "form:birthDate"],
    ssn: ["form:ssn", "form:socialSecurityNumber"],
    address: ["client.address.street", "form:address", "form:streetAddress"],
    city: ["client.address.city", "form:city"],
    state: ["client.address.state", "form:state"],
    zip: ["client.address.zip", "form:zip", "form:zipCode"],
    veteran: ["form:veteranStatus", "form:isVeteran"],
    gender: ["form:gender", "form:sex"],
  };

  for (const extField of externalFields) {
    const normalizedField = extField.toLowerCase().replace(/[_\s]/g, "");

    let bestMatch: { path: string; confidence: number } | null = null;

    // Check patterns
    for (const [pattern, paths] of Object.entries(patterns)) {
      if (normalizedField.includes(pattern)) {
        // Find first available path
        for (const path of paths) {
          if (path.startsWith("form:")) {
            const slug = path.substring(5);
            if (availableFormFields.includes(slug)) {
              bestMatch = { path, confidence: 0.9 };
              break;
            }
          } else {
            bestMatch = { path, confidence: 0.8 };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    // Try exact form field match
    if (!bestMatch) {
      for (const formField of availableFormFields) {
        if (formField.toLowerCase() === normalizedField) {
          bestMatch = { path: `form:${formField}`, confidence: 1.0 };
          break;
        }
        if (formField.toLowerCase().includes(normalizedField)) {
          bestMatch = { path: `form:${formField}`, confidence: 0.7 };
        }
      }
    }

    suggestions.push({
      externalField: extField,
      suggestedPath: bestMatch?.path || null,
      confidence: bestMatch?.confidence || 0,
    });
  }

  return suggestions;
}
