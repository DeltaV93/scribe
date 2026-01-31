/**
 * Predefined Export Templates
 *
 * Pre-built template definitions for common funder export formats:
 * - HUD HMIS (Homeless Management Information System)
 * - DOL WIPS (Workforce Investment Performance System)
 * - CAP60 (Community Action Partnership)
 * - CalGrants (California Grants)
 */

import { ExportType } from "@prisma/client";
import { PredefinedTemplateDefinition } from "../types";

/**
 * HUD HMIS Export Template
 *
 * Compliant with HUD HMIS Data Standards.
 * Uses CSV format with specific field requirements.
 */
export const HUD_HMIS_TEMPLATE: PredefinedTemplateDefinition = {
  name: "HUD HMIS CSV Export",
  description: "Export client data in HUD HMIS format for homeless services reporting",
  outputFormat: "CSV",
  delimiter: ",",
  encoding: "utf-8",
  includeHeaders: true,
  fields: [
    // Personal Identification
    { externalField: "PersonalID", scrybeField: "client.id", required: true, description: "Unique client identifier" },
    { externalField: "FirstName", scrybeField: "client.firstName", required: true },
    { externalField: "MiddleName", scrybeField: "form:middleName", required: false, defaultValue: "" },
    { externalField: "LastName", scrybeField: "client.lastName", required: true },
    { externalField: "NameSuffix", scrybeField: "form:nameSuffix", required: false, defaultValue: "" },
    { externalField: "NameDataQuality", scrybeField: "form:nameDataQuality", required: true, defaultValue: "1", transformer: "code:HMIS_DATA_QUALITY" },

    // Social Security Number
    { externalField: "SSN", scrybeField: "form:ssn", required: false, transformer: "ssn:format" },
    { externalField: "SSNDataQuality", scrybeField: "form:ssnDataQuality", required: true, defaultValue: "99", transformer: "code:HMIS_SSN_QUALITY" },

    // Date of Birth
    { externalField: "DOB", scrybeField: "form:dateOfBirth", required: true, transformer: "date:YYYY-MM-DD" },
    { externalField: "DOBDataQuality", scrybeField: "form:dobDataQuality", required: true, defaultValue: "1", transformer: "code:HMIS_DATA_QUALITY" },

    // Demographics
    { externalField: "AmIndAKNative", scrybeField: "form:raceAmIndAKNative", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "Asian", scrybeField: "form:raceAsian", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "BlackAfAmerican", scrybeField: "form:raceBlackAfAmerican", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "HispanicLatinaeo", scrybeField: "form:raceHispanicLatinaeo", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "MidEastNAfrican", scrybeField: "form:raceMidEastNAfrican", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "NativeHIPacific", scrybeField: "form:raceNativeHIPacific", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "White", scrybeField: "form:raceWhite", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "RaceNone", scrybeField: "form:raceNone", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "Woman", scrybeField: "form:genderWoman", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "Man", scrybeField: "form:genderMan", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "CulturallySpecific", scrybeField: "form:genderCulturallySpecific", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "DifferentIdentity", scrybeField: "form:genderDifferentIdentity", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "NonBinary", scrybeField: "form:genderNonBinary", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "Transgender", scrybeField: "form:genderTransgender", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "Questioning", scrybeField: "form:genderQuestioning", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },
    { externalField: "GenderNone", scrybeField: "form:genderNone", required: true, defaultValue: "0", transformer: "code:HMIS_YESNO" },

    // Veteran Status
    { externalField: "VeteranStatus", scrybeField: "form:veteranStatus", required: true, transformer: "code:HMIS_VETERAN" },

    // Project/Enrollment
    { externalField: "ProjectID", scrybeField: "program.id", required: true },
    { externalField: "EntryDate", scrybeField: "enrollment.enrolledDate", required: true, transformer: "date:YYYY-MM-DD" },
    { externalField: "ExitDate", scrybeField: "enrollment.completionDate", required: false, transformer: "date:YYYY-MM-DD" },

    // Disability
    { externalField: "DisablingCondition", scrybeField: "form:disablingCondition", required: true, transformer: "code:HMIS_YESNODONTKNOW" },

    // Living Situation
    { externalField: "LivingSituation", scrybeField: "form:priorLivingSituation", required: true, transformer: "code:HMIS_LIVING_SITUATION" },
    { externalField: "LOSUnderThreshold", scrybeField: "form:losUnderThreshold", required: true, defaultValue: "99", transformer: "code:HMIS_YESNODONTKNOW" },
    { externalField: "PreviousStreetESSH", scrybeField: "form:previousStreetESSH", required: true, defaultValue: "99", transformer: "code:HMIS_YESNODONTKNOW" },

    // Income
    { externalField: "IncomeFromAnySource", scrybeField: "form:incomeFromAnySource", required: true, transformer: "code:HMIS_YESNODONTKNOW" },
    { externalField: "TotalMonthlyIncome", scrybeField: "form:totalMonthlyIncome", required: false, transformer: "number:integer" },

    // Destination (for exits)
    { externalField: "Destination", scrybeField: "form:exitDestination", required: false, transformer: "code:HMIS_DESTINATION" },
  ],
  codeMappings: {
    HMIS_YESNO: {
      "Yes": "1",
      "No": "0",
      "true": "1",
      "false": "0",
      "1": "1",
      "0": "0",
    },
    HMIS_YESNODONTKNOW: {
      "Yes": "1",
      "No": "0",
      "Client doesn't know": "8",
      "Client prefers not to answer": "9",
      "Data not collected": "99",
    },
    HMIS_DATA_QUALITY: {
      "Full name reported": "1",
      "Partial, street name, or code name reported": "2",
      "Client doesn't know": "8",
      "Client prefers not to answer": "9",
      "Data not collected": "99",
    },
    HMIS_SSN_QUALITY: {
      "Full SSN reported": "1",
      "Approximate or partial SSN reported": "2",
      "Client doesn't know": "8",
      "Client prefers not to answer": "9",
      "Data not collected": "99",
    },
    HMIS_VETERAN: {
      "Yes": "1",
      "No": "0",
      "Client doesn't know": "8",
      "Client prefers not to answer": "9",
      "Data not collected": "99",
    },
    HMIS_LIVING_SITUATION: {
      "Emergency shelter": "101",
      "Safe Haven": "118",
      "Transitional housing": "215",
      "Street/sidewalk": "116",
      "Place not meant for habitation": "101",
      "Permanent housing": "435",
      "Rental by client": "410",
      "Hotel/motel": "329",
      "Hospital": "206",
      "Jail/prison": "207",
    },
    HMIS_DESTINATION: {
      "Permanent housing": "435",
      "Rental by client": "410",
      "Owned by client": "421",
      "Staying with family": "422",
      "Staying with friends": "423",
      "Emergency shelter": "101",
      "Transitional housing": "215",
      "Hotel/motel": "302",
      "Deceased": "24",
    },
  },
  validationRules: [
    { field: "PersonalID", type: "required", message: "PersonalID is required" },
    { field: "FirstName", type: "required", message: "FirstName is required" },
    { field: "LastName", type: "required", message: "LastName is required" },
    { field: "DOB", type: "format", message: "DOB must be a valid date", params: { pattern: "YYYY-MM-DD" } },
    { field: "EntryDate", type: "required", message: "EntryDate is required" },
    { field: "VeteranStatus", type: "enum", message: "VeteranStatus must be 0, 1, 8, 9, or 99", params: { values: ["0", "1", "8", "9", "99"] } },
  ],
};

/**
 * DOL WIPS Export Template
 *
 * Department of Labor Workforce Investment Performance System format.
 * Uses pipe-delimited TXT format.
 */
export const DOL_WIPS_TEMPLATE: PredefinedTemplateDefinition = {
  name: "DOL WIPS Performance Report",
  description: "Export workforce development data for DOL WIOA performance reporting",
  outputFormat: "TXT",
  delimiter: "|",
  encoding: "utf-8",
  includeHeaders: true,
  fields: [
    // Participant Identification
    { externalField: "PARTICIPANT_ID", scrybeField: "client.id", required: true },
    { externalField: "SSN", scrybeField: "form:ssn", required: true, transformer: "ssn:nodash" },
    { externalField: "FIRST_NAME", scrybeField: "client.firstName", required: true },
    { externalField: "LAST_NAME", scrybeField: "client.lastName", required: true },
    { externalField: "MIDDLE_INITIAL", scrybeField: "form:middleInitial", required: false, defaultValue: "" },

    // Demographics
    { externalField: "DATE_OF_BIRTH", scrybeField: "form:dateOfBirth", required: true, transformer: "date:MMDDYYYY" },
    { externalField: "GENDER", scrybeField: "form:gender", required: true, transformer: "code:WIPS_GENDER" },
    { externalField: "RACE_ETHNICITY", scrybeField: "form:raceEthnicity", required: true, transformer: "code:WIPS_RACE" },
    { externalField: "VETERAN_STATUS", scrybeField: "form:veteranStatus", required: true, transformer: "code:WIPS_YESNO" },
    { externalField: "DISABILITY_STATUS", scrybeField: "form:disabilityStatus", required: true, transformer: "code:WIPS_YESNO" },

    // Education
    { externalField: "EDUCATION_LEVEL", scrybeField: "form:educationLevel", required: true, transformer: "code:WIPS_EDUCATION" },
    { externalField: "HIGH_SCHOOL_DIPLOMA", scrybeField: "form:highSchoolDiploma", required: true, transformer: "code:WIPS_YESNO" },

    // Program Participation
    { externalField: "PROGRAM_TYPE", scrybeField: "program.labelType", required: true, transformer: "code:WIPS_PROGRAM_TYPE" },
    { externalField: "PARTICIPATION_DATE", scrybeField: "enrollment.enrolledDate", required: true, transformer: "date:MMDDYYYY" },
    { externalField: "EXIT_DATE", scrybeField: "enrollment.completionDate", required: false, transformer: "date:MMDDYYYY" },
    { externalField: "EXIT_TYPE", scrybeField: "enrollment.status", required: false, transformer: "code:WIPS_EXIT_TYPE" },

    // Employment
    { externalField: "EMPLOYED_AT_ENTRY", scrybeField: "form:employedAtEntry", required: true, transformer: "code:WIPS_YESNO" },
    { externalField: "EMPLOYED_AT_EXIT", scrybeField: "form:employedAtExit", required: false, transformer: "code:WIPS_YESNO" },
    { externalField: "HOURLY_WAGE_AT_ENTRY", scrybeField: "form:hourlyWageAtEntry", required: false, transformer: "number:decimal2" },
    { externalField: "HOURLY_WAGE_AT_EXIT", scrybeField: "form:hourlyWageAtExit", required: false, transformer: "number:decimal2" },

    // Training/Credentials
    { externalField: "TRAINING_COMPLETED", scrybeField: "enrollment.status", required: false, transformer: "code:WIPS_TRAINING_COMPLETE" },
    { externalField: "CREDENTIAL_ATTAINED", scrybeField: "form:credentialAttained", required: false, transformer: "code:WIPS_YESNO" },
    { externalField: "CREDENTIAL_TYPE", scrybeField: "form:credentialType", required: false, transformer: "code:WIPS_CREDENTIAL_TYPE" },

    // Contact Info
    { externalField: "ADDRESS_LINE_1", scrybeField: "client.address.street", required: true },
    { externalField: "CITY", scrybeField: "client.address.city", required: true },
    { externalField: "STATE", scrybeField: "client.address.state", required: true },
    { externalField: "ZIP_CODE", scrybeField: "client.address.zip", required: true },
    { externalField: "PHONE", scrybeField: "client.phone", required: false, transformer: "phone:digits" },
  ],
  codeMappings: {
    WIPS_YESNO: {
      "Yes": "1",
      "No": "0",
      "true": "1",
      "false": "0",
    },
    WIPS_GENDER: {
      "Male": "1",
      "Female": "2",
      "Non-binary": "3",
      "Other": "9",
    },
    WIPS_RACE: {
      "American Indian or Alaska Native": "1",
      "Asian": "2",
      "Black or African American": "3",
      "Hispanic or Latino": "4",
      "Native Hawaiian or Pacific Islander": "5",
      "White": "6",
      "Two or More Races": "7",
    },
    WIPS_EDUCATION: {
      "No formal schooling": "0",
      "Grades 1-5": "1",
      "Grades 6-8": "2",
      "Grades 9-12 (no diploma)": "3",
      "High School Graduate/GED": "4",
      "Some College": "5",
      "Associate's Degree": "6",
      "Bachelor's Degree": "7",
      "Master's Degree or higher": "8",
    },
    WIPS_PROGRAM_TYPE: {
      "PROGRAM": "01",
      "COURSE": "02",
      "CLASS": "03",
      "WORKSHOP": "04",
      "TRAINING": "05",
      "GROUP": "06",
    },
    WIPS_EXIT_TYPE: {
      "COMPLETED": "1",
      "WITHDRAWN": "2",
      "FAILED": "3",
      "ON_HOLD": "4",
    },
    WIPS_TRAINING_COMPLETE: {
      "COMPLETED": "1",
      "IN_PROGRESS": "0",
      "WITHDRAWN": "0",
      "FAILED": "0",
    },
    WIPS_CREDENTIAL_TYPE: {
      "Industry Certification": "1",
      "State License": "2",
      "Associate Degree": "3",
      "Bachelor's Degree": "4",
      "Apprenticeship Certificate": "5",
      "Other Credential": "9",
    },
  },
  validationRules: [
    { field: "SSN", type: "format", message: "SSN must be 9 digits", params: { pattern: "^\\d{9}$" } },
    { field: "DATE_OF_BIRTH", type: "required", message: "Date of birth is required" },
    { field: "PARTICIPATION_DATE", type: "required", message: "Participation date is required" },
    { field: "EDUCATION_LEVEL", type: "required", message: "Education level is required" },
  ],
};

/**
 * CAP60 Export Template
 *
 * Community Action Partnership form 60 for CSBG reporting.
 * Uses CSV format.
 */
export const CAP60_TEMPLATE: PredefinedTemplateDefinition = {
  name: "CAP60 CSBG Report Export",
  description: "Export data for Community Services Block Grant annual reporting",
  outputFormat: "CSV",
  delimiter: ",",
  encoding: "utf-8",
  includeHeaders: true,
  fields: [
    // Family/Household
    { externalField: "FamilyID", scrybeField: "client.id", required: true },
    { externalField: "HeadOfHousehold", scrybeField: "form:headOfHousehold", required: true, transformer: "code:CAP_YESNO" },
    { externalField: "HouseholdSize", scrybeField: "form:householdSize", required: true, transformer: "number:integer" },
    { externalField: "AnnualHouseholdIncome", scrybeField: "form:annualHouseholdIncome", required: true, transformer: "number:decimal2" },
    { externalField: "PovertyLevel", scrybeField: "form:povertyLevel", required: true, transformer: "number:percent" },

    // Individual Demographics
    { externalField: "FirstName", scrybeField: "client.firstName", required: true },
    { externalField: "LastName", scrybeField: "client.lastName", required: true },
    { externalField: "DateOfBirth", scrybeField: "form:dateOfBirth", required: true, transformer: "date:MM/DD/YYYY" },
    { externalField: "Age", scrybeField: "form:age", required: true, transformer: "number:integer" },
    { externalField: "Gender", scrybeField: "form:gender", required: true, transformer: "code:CAP_GENDER" },
    { externalField: "Race", scrybeField: "form:race", required: true, transformer: "code:CAP_RACE" },
    { externalField: "Ethnicity", scrybeField: "form:ethnicity", required: true, transformer: "code:CAP_ETHNICITY" },

    // Housing
    { externalField: "HousingType", scrybeField: "form:housingType", required: true, transformer: "code:CAP_HOUSING" },
    { externalField: "HomeOwnership", scrybeField: "form:homeOwnership", required: true, transformer: "code:CAP_OWNERSHIP" },

    // Health
    { externalField: "HealthInsurance", scrybeField: "form:hasHealthInsurance", required: true, transformer: "code:CAP_YESNO" },
    { externalField: "HealthInsuranceType", scrybeField: "form:healthInsuranceType", required: false, transformer: "code:CAP_INSURANCE_TYPE" },
    { externalField: "DisabilityStatus", scrybeField: "form:disabilityStatus", required: true, transformer: "code:CAP_YESNO" },

    // Education/Employment
    { externalField: "EducationLevel", scrybeField: "form:educationLevel", required: true, transformer: "code:CAP_EDUCATION" },
    { externalField: "EmploymentStatus", scrybeField: "form:employmentStatus", required: true, transformer: "code:CAP_EMPLOYMENT" },

    // Services
    { externalField: "ServiceType", scrybeField: "program.labelType", required: true, transformer: "code:CAP_SERVICE" },
    { externalField: "ServiceDate", scrybeField: "enrollment.enrolledDate", required: true, transformer: "date:MM/DD/YYYY" },
    { externalField: "ServiceOutcome", scrybeField: "enrollment.status", required: false, transformer: "code:CAP_OUTCOME" },

    // Geographic
    { externalField: "County", scrybeField: "form:county", required: true },
    { externalField: "ZipCode", scrybeField: "client.address.zip", required: true },
    { externalField: "RuralUrban", scrybeField: "form:ruralUrban", required: true, transformer: "code:CAP_AREA_TYPE" },
  ],
  codeMappings: {
    CAP_YESNO: {
      "Yes": "Y",
      "No": "N",
      "true": "Y",
      "false": "N",
    },
    CAP_GENDER: {
      "Male": "M",
      "Female": "F",
      "Non-binary": "X",
      "Other": "O",
    },
    CAP_RACE: {
      "American Indian or Alaska Native": "1",
      "Asian": "2",
      "Black or African American": "3",
      "Native Hawaiian or Pacific Islander": "4",
      "White": "5",
      "Multi-Race": "6",
      "Other": "7",
    },
    CAP_ETHNICITY: {
      "Hispanic or Latino": "H",
      "Not Hispanic or Latino": "N",
    },
    CAP_HOUSING: {
      "Owned": "1",
      "Rented": "2",
      "Homeless": "3",
      "Other": "4",
    },
    CAP_OWNERSHIP: {
      "Own": "O",
      "Rent": "R",
      "Homeless": "H",
      "Other": "X",
    },
    CAP_INSURANCE_TYPE: {
      "Private": "1",
      "Medicaid": "2",
      "Medicare": "3",
      "CHIP": "4",
      "VA": "5",
      "Other": "9",
    },
    CAP_EDUCATION: {
      "Less than 9th grade": "1",
      "9th-12th grade (no diploma)": "2",
      "High School Graduate/GED": "3",
      "Some college": "4",
      "College graduate": "5",
    },
    CAP_EMPLOYMENT: {
      "Employed Full-Time": "1",
      "Employed Part-Time": "2",
      "Unemployed": "3",
      "Not in Labor Force": "4",
    },
    CAP_SERVICE: {
      "Emergency Services": "ES",
      "Employment": "EM",
      "Education": "ED",
      "Housing": "HO",
      "Health": "HE",
      "Nutrition": "NU",
      "Income Management": "IM",
      "Linkages": "LI",
    },
    CAP_OUTCOME: {
      "COMPLETED": "C",
      "IN_PROGRESS": "P",
      "WITHDRAWN": "W",
    },
    CAP_AREA_TYPE: {
      "Urban": "U",
      "Rural": "R",
      "Suburban": "S",
    },
  },
  validationRules: [
    { field: "FamilyID", type: "required", message: "FamilyID is required" },
    { field: "HouseholdSize", type: "range", message: "HouseholdSize must be 1-20", params: { min: 1, max: 20 } },
    { field: "AnnualHouseholdIncome", type: "range", message: "Income must be non-negative", params: { min: 0 } },
  ],
};

/**
 * CalGrants Export Template
 *
 * California Grants reporting format.
 * Uses Excel format for complex data.
 */
export const CALI_GRANTS_TEMPLATE: PredefinedTemplateDefinition = {
  name: "CalGrants Performance Export",
  description: "Export data for California state grant performance reporting",
  outputFormat: "XLSX",
  encoding: "utf-8",
  includeHeaders: true,
  fields: [
    // Participant Info
    { externalField: "Participant_ID", scrybeField: "client.id", required: true },
    { externalField: "First_Name", scrybeField: "client.firstName", required: true },
    { externalField: "Last_Name", scrybeField: "client.lastName", required: true },
    { externalField: "Date_of_Birth", scrybeField: "form:dateOfBirth", required: true, transformer: "date:YYYY-MM-DD" },

    // California-Specific Demographics
    { externalField: "CA_Resident", scrybeField: "form:caResident", required: true, transformer: "code:CALGRANTS_YESNO" },
    { externalField: "County_of_Residence", scrybeField: "form:countyOfResidence", required: true, transformer: "code:CALGRANTS_COUNTY" },
    { externalField: "Primary_Language", scrybeField: "form:primaryLanguage", required: false, transformer: "code:CALGRANTS_LANGUAGE" },
    { externalField: "Immigration_Status", scrybeField: "form:immigrationStatus", required: false, transformer: "code:CALGRANTS_IMMIGRATION" },

    // Program Participation
    { externalField: "Grant_Program", scrybeField: "program.name", required: true },
    { externalField: "Service_Area", scrybeField: "form:serviceArea", required: true, transformer: "code:CALGRANTS_SERVICE_AREA" },
    { externalField: "Enrollment_Date", scrybeField: "enrollment.enrolledDate", required: true, transformer: "date:YYYY-MM-DD" },
    { externalField: "Completion_Date", scrybeField: "enrollment.completionDate", required: false, transformer: "date:YYYY-MM-DD" },
    { externalField: "Completion_Status", scrybeField: "enrollment.status", required: true, transformer: "code:CALGRANTS_STATUS" },

    // Hours and Outcomes
    { externalField: "Total_Service_Hours", scrybeField: "enrollment.totalHours", required: true, transformer: "number:decimal2" },
    { externalField: "Outcome_Achieved", scrybeField: "form:outcomeAchieved", required: false, transformer: "code:CALGRANTS_YESNO" },
    { externalField: "Outcome_Type", scrybeField: "form:outcomeType", required: false, transformer: "code:CALGRANTS_OUTCOME" },

    // Financial
    { externalField: "Income_at_Entry", scrybeField: "form:incomeAtEntry", required: true, transformer: "number:decimal2" },
    { externalField: "Income_at_Exit", scrybeField: "form:incomeAtExit", required: false, transformer: "number:decimal2" },
    { externalField: "Public_Benefits", scrybeField: "form:receivesPublicBenefits", required: true, transformer: "code:CALGRANTS_YESNO" },
    { externalField: "Benefit_Types", scrybeField: "form:benefitTypes", required: false },

    // Employment
    { externalField: "Employment_Status_Entry", scrybeField: "form:employmentStatusEntry", required: true, transformer: "code:CALGRANTS_EMPLOYMENT" },
    { externalField: "Employment_Status_Exit", scrybeField: "form:employmentStatusExit", required: false, transformer: "code:CALGRANTS_EMPLOYMENT" },
    { externalField: "Employer_Name", scrybeField: "form:employerName", required: false },
    { externalField: "Occupation", scrybeField: "form:occupation", required: false },
  ],
  codeMappings: {
    CALGRANTS_YESNO: {
      "Yes": "Y",
      "No": "N",
      "true": "Y",
      "false": "N",
    },
    CALGRANTS_COUNTY: {
      // California counties (abbreviated list)
      "Los Angeles": "19",
      "San Diego": "37",
      "Orange": "30",
      "Riverside": "33",
      "San Bernardino": "36",
      "Santa Clara": "43",
      "Alameda": "01",
      "Sacramento": "34",
      "San Francisco": "38",
      "Fresno": "10",
    },
    CALGRANTS_LANGUAGE: {
      "English": "EN",
      "Spanish": "ES",
      "Chinese": "ZH",
      "Tagalog": "TL",
      "Vietnamese": "VI",
      "Korean": "KO",
      "Other": "OT",
    },
    CALGRANTS_IMMIGRATION: {
      "US Citizen": "1",
      "Permanent Resident": "2",
      "Refugee/Asylee": "3",
      "Other Eligible": "4",
      "Unknown": "9",
    },
    CALGRANTS_SERVICE_AREA: {
      "Workforce Development": "WD",
      "Education": "ED",
      "Health Services": "HS",
      "Housing": "HO",
      "Social Services": "SS",
      "Economic Development": "EC",
    },
    CALGRANTS_STATUS: {
      "ENROLLED": "E",
      "IN_PROGRESS": "P",
      "COMPLETED": "C",
      "WITHDRAWN": "W",
      "FAILED": "F",
    },
    CALGRANTS_OUTCOME: {
      "Employment Obtained": "EO",
      "Credential Earned": "CE",
      "Income Increased": "II",
      "Housing Stabilized": "HS",
      "Health Improved": "HI",
      "Other": "OT",
    },
    CALGRANTS_EMPLOYMENT: {
      "Employed Full-Time": "FT",
      "Employed Part-Time": "PT",
      "Self-Employed": "SE",
      "Unemployed Looking": "UL",
      "Unemployed Not Looking": "UN",
      "Student": "ST",
      "Retired": "RE",
      "Disabled": "DI",
    },
  },
  validationRules: [
    { field: "CA_Resident", type: "required", message: "California residency status is required" },
    { field: "County_of_Residence", type: "required", message: "County is required for California grants" },
    { field: "Total_Service_Hours", type: "range", message: "Service hours must be positive", params: { min: 0 } },
  ],
};

/**
 * Get predefined template by export type
 */
export function getPredefinedTemplate(exportType: ExportType): PredefinedTemplateDefinition | null {
  switch (exportType) {
    case "HUD_HMIS":
      return HUD_HMIS_TEMPLATE;
    case "DOL_WIPS":
      return DOL_WIPS_TEMPLATE;
    case "CAP60":
      return CAP60_TEMPLATE;
    case "CALI_GRANTS":
      return CALI_GRANTS_TEMPLATE;
    case "CUSTOM":
      return null;
    default:
      return null;
  }
}

/**
 * Get all predefined templates
 */
export function getAllPredefinedTemplates(): Record<ExportType, PredefinedTemplateDefinition | null> {
  return {
    HUD_HMIS: HUD_HMIS_TEMPLATE,
    DOL_WIPS: DOL_WIPS_TEMPLATE,
    CAP60: CAP60_TEMPLATE,
    CALI_GRANTS: CALI_GRANTS_TEMPLATE,
    CUSTOM: null,
  };
}

/**
 * Get suggested field mappings for an export type
 * Returns mappings based on common Scrybe form field patterns
 */
export function getSuggestedMappings(exportType: ExportType): Array<{
  externalField: string;
  suggestedScrybeFields: string[];
  required: boolean;
}> {
  const template = getPredefinedTemplate(exportType);
  if (!template) return [];

  return template.fields.map((field) => ({
    externalField: field.externalField,
    suggestedScrybeFields: [field.scrybeField],
    required: field.required,
  }));
}
