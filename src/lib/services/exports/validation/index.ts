/**
 * Export Validation Service
 *
 * Validates export data against funder requirements.
 */

import { ExportType } from "@prisma/client";
import {
  ExtractedRecord,
  ValidationResult,
  ValidationError,
  ValidationRule,
} from "../types";
import { getPredefinedTemplate } from "../templates/predefined";

export type { ValidationResult, ValidationError, ValidationRule };

/**
 * Validate extracted records against funder requirements
 */
export function validateRecords(
  records: ExtractedRecord[],
  exportType: ExportType,
  customRules?: ValidationRule[]
): ValidationResult {
  const predefined = getPredefinedTemplate(exportType);
  const rules = customRules || predefined?.validationRules || [];

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  records.forEach((record, index) => {
    // Validate against each rule
    for (const rule of rules) {
      const value = record.data[rule.field];
      const error = validateField(rule, value, index, record.clientId);

      if (error) {
        if (error.severity === "error") {
          errors.push(error);
        } else {
          warnings.push(error);
        }
      }
    }

    // Additional funder-specific validations
    const funderErrors = validateFunderSpecific(exportType, record, index);
    errors.push(...funderErrors.filter((e) => e.severity === "error"));
    warnings.push(...funderErrors.filter((e) => e.severity === "warning"));
  });

  const invalidRecordIndices = new Set(errors.map((e) => e.recordIndex));

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validRecordCount: records.length - invalidRecordIndices.size,
    invalidRecordCount: invalidRecordIndices.size,
  };
}

/**
 * Validate a single field against a rule
 */
function validateField(
  rule: ValidationRule,
  value: unknown,
  recordIndex: number,
  clientId?: string
): ValidationError | null {
  const strValue = value !== undefined && value !== null ? String(value) : "";

  switch (rule.type) {
    case "required":
      if (!strValue) {
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
      if (strValue && rule.params?.pattern) {
        const pattern = new RegExp(rule.params.pattern as string);
        if (!pattern.test(strValue)) {
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

    case "range":
      if (strValue) {
        const numValue = Number(strValue);
        if (!isNaN(numValue)) {
          const min = rule.params?.min as number | undefined;
          const max = rule.params?.max as number | undefined;

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
      if (strValue && rule.params?.values) {
        const validValues = rule.params.values as string[];
        if (!validValues.includes(strValue)) {
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

    case "dependency":
      // Dependency validation: if field A has value, field B must also have value
      // Handled in funder-specific validation
      break;
  }

  return null;
}

/**
 * Funder-specific validation rules
 */
function validateFunderSpecific(
  exportType: ExportType,
  record: ExtractedRecord,
  recordIndex: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (exportType) {
    case "HUD_HMIS":
      errors.push(...validateHMIS(record, recordIndex));
      break;

    case "DOL_WIPS":
      errors.push(...validateDOLWIPS(record, recordIndex));
      break;

    case "CAP60":
      errors.push(...validateCAP60(record, recordIndex));
      break;

    case "CALI_GRANTS":
      errors.push(...validateCalGrants(record, recordIndex));
      break;
  }

  return errors;
}

/**
 * HUD HMIS specific validation
 */
function validateHMIS(record: ExtractedRecord, recordIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const data = record.data;

  // Entry date must be before or equal to exit date
  if (data.EntryDate && data.ExitDate) {
    const entryDate = new Date(data.EntryDate as string);
    const exitDate = new Date(data.ExitDate as string);

    if (entryDate > exitDate) {
      errors.push({
        recordIndex,
        clientId: record.clientId,
        field: "ExitDate",
        value: data.ExitDate,
        message: "Exit date cannot be before entry date",
        severity: "error",
      });
    }
  }

  // If exit date exists, destination is required
  if (data.ExitDate && !data.Destination) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "Destination",
      value: data.Destination,
      message: "Destination is required when exit date is present",
      severity: "warning",
    });
  }

  // At least one gender must be selected
  const genderFields = [
    "Woman", "Man", "CulturallySpecific", "DifferentIdentity",
    "NonBinary", "Transgender", "Questioning", "GenderNone"
  ];
  const hasGender = genderFields.some((f) => data[f] === "1");

  if (!hasGender) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "Gender",
      value: null,
      message: "At least one gender field must be selected",
      severity: "warning",
    });
  }

  // At least one race must be selected
  const raceFields = [
    "AmIndAKNative", "Asian", "BlackAfAmerican", "HispanicLatinaeo",
    "MidEastNAfrican", "NativeHIPacific", "White", "RaceNone"
  ];
  const hasRace = raceFields.some((f) => data[f] === "1");

  if (!hasRace) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "Race",
      value: null,
      message: "At least one race field must be selected",
      severity: "warning",
    });
  }

  return errors;
}

/**
 * DOL WIPS specific validation
 */
function validateDOLWIPS(record: ExtractedRecord, recordIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const data = record.data;

  // SSN format validation (9 digits)
  if (data.SSN) {
    const ssn = String(data.SSN).replace(/\D/g, "");
    if (ssn.length !== 9) {
      errors.push({
        recordIndex,
        clientId: record.clientId,
        field: "SSN",
        value: data.SSN,
        message: "SSN must be exactly 9 digits",
        severity: "error",
      });
    }
  }

  // If exit date present, exit type is required
  if (data.EXIT_DATE && !data.EXIT_TYPE) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "EXIT_TYPE",
      value: data.EXIT_TYPE,
      message: "Exit type is required when exit date is present",
      severity: "warning",
    });
  }

  // If employed at exit, wage should be present
  if (data.EMPLOYED_AT_EXIT === "1" && !data.HOURLY_WAGE_AT_EXIT) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "HOURLY_WAGE_AT_EXIT",
      value: data.HOURLY_WAGE_AT_EXIT,
      message: "Hourly wage is recommended when employed at exit",
      severity: "warning",
    });
  }

  // If credential attained, credential type should be present
  if (data.CREDENTIAL_ATTAINED === "1" && !data.CREDENTIAL_TYPE) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "CREDENTIAL_TYPE",
      value: data.CREDENTIAL_TYPE,
      message: "Credential type is required when credential is attained",
      severity: "error",
    });
  }

  return errors;
}

/**
 * CAP60 specific validation
 */
function validateCAP60(record: ExtractedRecord, recordIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const data = record.data;

  // Household size must be >= 1
  const householdSize = Number(data.HouseholdSize);
  if (!isNaN(householdSize) && householdSize < 1) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "HouseholdSize",
      value: data.HouseholdSize,
      message: "Household size must be at least 1",
      severity: "error",
    });
  }

  // Income must be non-negative
  const income = Number(data.AnnualHouseholdIncome);
  if (!isNaN(income) && income < 0) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "AnnualHouseholdIncome",
      value: data.AnnualHouseholdIncome,
      message: "Annual household income cannot be negative",
      severity: "error",
    });
  }

  // Poverty level should be between 0 and 500%
  const povertyLevel = Number(String(data.PovertyLevel).replace("%", ""));
  if (!isNaN(povertyLevel) && (povertyLevel < 0 || povertyLevel > 500)) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "PovertyLevel",
      value: data.PovertyLevel,
      message: "Poverty level should be between 0% and 500%",
      severity: "warning",
    });
  }

  return errors;
}

/**
 * CalGrants specific validation
 */
function validateCalGrants(record: ExtractedRecord, recordIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const data = record.data;

  // California residency is required
  if (data.CA_Resident !== "Y") {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "CA_Resident",
      value: data.CA_Resident,
      message: "Participant must be a California resident",
      severity: "warning",
    });
  }

  // Total service hours should be positive
  const hours = Number(data.Total_Service_Hours);
  if (!isNaN(hours) && hours < 0) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "Total_Service_Hours",
      value: data.Total_Service_Hours,
      message: "Total service hours cannot be negative",
      severity: "error",
    });
  }

  // If outcome achieved, outcome type is required
  if (data.Outcome_Achieved === "Y" && !data.Outcome_Type) {
    errors.push({
      recordIndex,
      clientId: record.clientId,
      field: "Outcome_Type",
      value: data.Outcome_Type,
      message: "Outcome type is required when outcome is achieved",
      severity: "warning",
    });
  }

  // Enrollment date should be before or equal to completion date
  if (data.Enrollment_Date && data.Completion_Date) {
    const enrollDate = new Date(data.Enrollment_Date as string);
    const completeDate = new Date(data.Completion_Date as string);

    if (enrollDate > completeDate) {
      errors.push({
        recordIndex,
        clientId: record.clientId,
        field: "Completion_Date",
        value: data.Completion_Date,
        message: "Completion date cannot be before enrollment date",
        severity: "error",
      });
    }
  }

  return errors;
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(result: ValidationResult): {
  status: "valid" | "warnings" | "errors";
  message: string;
  details: string[];
} {
  if (result.errors.length === 0 && result.warnings.length === 0) {
    return {
      status: "valid",
      message: `All ${result.validRecordCount} records passed validation`,
      details: [],
    };
  }

  if (result.errors.length === 0) {
    return {
      status: "warnings",
      message: `${result.validRecordCount} records valid with ${result.warnings.length} warnings`,
      details: summarizeErrors(result.warnings),
    };
  }

  return {
    status: "errors",
    message: `${result.invalidRecordCount} of ${result.validRecordCount + result.invalidRecordCount} records have errors`,
    details: summarizeErrors(result.errors),
  };
}

/**
 * Summarize errors by field
 */
function summarizeErrors(errors: ValidationError[]): string[] {
  const byField: Record<string, number> = {};

  for (const error of errors) {
    byField[error.field] = (byField[error.field] || 0) + 1;
  }

  return Object.entries(byField)
    .sort((a, b) => b[1] - a[1])
    .map(([field, count]) => `${field}: ${count} issue${count > 1 ? "s" : ""}`);
}
