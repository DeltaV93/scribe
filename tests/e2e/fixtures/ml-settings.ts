/**
 * ML Settings E2E Test Fixtures
 *
 * Contains mock data and helper functions for ML Settings E2E tests.
 * These fixtures provide consistent test data for API mocking.
 */

import { Page, Route } from "@playwright/test";

// Types matching the ML services types
export interface Industry {
  value: string;
  label: string;
}

export interface CompanyType {
  value: string;
  label: string;
}

export interface CustomSignals {
  keywords: string[];
  patterns: string[];
  weights: Record<string, number>;
}

export interface MatchingRules {
  overrides: Record<string, unknown>[];
  weights: Record<string, number>;
  disabled_rules: string[];
}

export interface OrgProfile {
  id: string;
  org_id: string;
  industry: string;
  secondary_industry: string | null;
  company_type: string;
  team_roles: string[];
  model_tier: "shared" | "private";
  data_sharing_consent: boolean;
  custom_signals: CustomSignals;
  matching_rules: MatchingRules;
  compliance_frameworks: string[];
  epsilon_budget: number;
  epsilon_consumed: number;
  created_at: string;
  updated_at: string;
}

export interface IndustryDefault {
  id: string;
  name: string;
  team_roles: string[];
  custom_signals: CustomSignals;
  suggested_compliance: string[];
}

// Available industries
export const INDUSTRIES: Industry[] = [
  { value: "nonprofit", label: "Nonprofit / Social Services" },
  { value: "healthcare", label: "Healthcare / FQHC" },
  { value: "tech", label: "Technology / SaaS" },
  { value: "legal", label: "Legal / Law Firm" },
  { value: "sales", label: "Sales / Business Development" },
  { value: "education", label: "Education / K-12 / Higher Ed" },
  { value: "government", label: "Government" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

// Available company types
export const COMPANY_TYPES: CompanyType[] = [
  { value: "startup", label: "Startup" },
  { value: "enterprise", label: "Enterprise" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "government", label: "Government" },
  { value: "agency", label: "Agency" },
  { value: "consulting", label: "Consulting" },
];

// Compliance frameworks
export const COMPLIANCE_FRAMEWORKS = [
  { value: "HIPAA", label: "HIPAA", description: "Health Insurance Portability and Accountability Act" },
  { value: "SOC2", label: "SOC 2", description: "Service Organization Control 2" },
  { value: "GDPR", label: "GDPR", description: "General Data Protection Regulation" },
  { value: "FERPA", label: "FERPA", description: "Family Educational Rights and Privacy Act" },
  { value: "WIOA", label: "WIOA", description: "Workforce Innovation and Opportunity Act" },
  { value: "42CFR", label: "42 CFR Part 2", description: "Substance Abuse Treatment Records" },
];

// Matching rules available
export const AVAILABLE_RULES = [
  { id: "keyword_exact_match", name: "Keyword Exact Match", description: "Match keywords exactly" },
  { id: "keyword_fuzzy_match", name: "Keyword Fuzzy Match", description: "Match similar keywords" },
  { id: "pattern_detection", name: "Pattern Detection", description: "Detect regex patterns" },
  { id: "context_analysis", name: "Context Analysis", description: "Analyze surrounding context" },
  { id: "entity_extraction", name: "Entity Extraction", description: "Extract named entities" },
  { id: "sentiment_scoring", name: "Sentiment Scoring", description: "Score sentiment of content" },
];

// Default mock profile
export function createMockProfile(overrides?: Partial<OrgProfile>): OrgProfile {
  return {
    id: "test-profile-id",
    org_id: "test-org-id",
    industry: "nonprofit",
    secondary_industry: null,
    company_type: "nonprofit",
    team_roles: ["case_manager", "program_manager"],
    model_tier: "shared",
    data_sharing_consent: false,
    custom_signals: {
      keywords: ["intake", "assessment"],
      patterns: [],
      weights: {},
    },
    matching_rules: {
      overrides: [],
      weights: {},
      disabled_rules: [],
    },
    compliance_frameworks: ["HIPAA"],
    epsilon_budget: 10.0,
    epsilon_consumed: 2.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Default industry defaults
export function createMockIndustryDefaults(): IndustryDefault[] {
  return [
    {
      id: "nonprofit",
      name: "Nonprofit / Social Services",
      team_roles: ["case_manager", "program_manager", "social_worker", "intake_specialist"],
      custom_signals: {
        keywords: ["intake", "assessment", "referral", "case notes", "service plan", "goals"],
        patterns: ["case\\s*#?\\d+", "client\\s*id\\s*:\\s*\\d+"],
        weights: { "case notes": 1.5, assessment: 1.3 },
      },
      suggested_compliance: ["HIPAA", "SOC2", "WIOA"],
    },
    {
      id: "healthcare",
      name: "Healthcare / FQHC",
      team_roles: ["physician", "nurse", "medical_assistant", "care_coordinator", "patient_navigator"],
      custom_signals: {
        keywords: ["patient", "diagnosis", "treatment", "medication", "prescription", "vitals"],
        patterns: ["MRN\\d+", "ICD-10-[A-Z]\\d{2}(\\.\\d+)?", "CPT\\d{5}"],
        weights: { diagnosis: 2.0, medication: 1.8, treatment: 1.5 },
      },
      suggested_compliance: ["HIPAA", "42CFR"],
    },
    {
      id: "tech",
      name: "Technology / SaaS",
      team_roles: ["engineer", "product_manager", "designer", "qa_analyst", "support_agent"],
      custom_signals: {
        keywords: ["bug", "feature", "deployment", "sprint", "backlog", "milestone"],
        patterns: ["JIRA-\\d+", "PR#\\d+", "v\\d+\\.\\d+\\.\\d+"],
        weights: { bug: 1.5, deployment: 1.3 },
      },
      suggested_compliance: ["SOC2", "GDPR"],
    },
    {
      id: "legal",
      name: "Legal / Law Firm",
      team_roles: ["attorney", "paralegal", "legal_assistant", "case_manager"],
      custom_signals: {
        keywords: ["plaintiff", "defendant", "motion", "discovery", "deposition", "settlement"],
        patterns: ["case\\s*no\\.?\\s*\\d+-cv-\\d+", "docket\\s*#?\\d+"],
        weights: { motion: 1.5, discovery: 1.3 },
      },
      suggested_compliance: ["SOC2"],
    },
    {
      id: "education",
      name: "Education / K-12 / Higher Ed",
      team_roles: ["teacher", "administrator", "counselor", "special_education_coordinator"],
      custom_signals: {
        keywords: ["student", "grade", "assessment", "IEP", "accommodation", "graduation"],
        patterns: ["student\\s*id\\s*:\\s*\\d+", "course\\s*#?[A-Z]{3}\\d{3}"],
        weights: { IEP: 2.0, accommodation: 1.5 },
      },
      suggested_compliance: ["FERPA"],
    },
  ];
}

// Profile with exhausted privacy budget
export function createExhaustedBudgetProfile(): OrgProfile {
  return createMockProfile({
    epsilon_budget: 10.0,
    epsilon_consumed: 10.0,
  });
}

// Profile with private model tier
export function createPrivateModelProfile(): OrgProfile {
  return createMockProfile({
    model_tier: "private",
    data_sharing_consent: false,
  });
}

// Profile with full compliance suite
export function createFullComplianceProfile(): OrgProfile {
  return createMockProfile({
    compliance_frameworks: ["HIPAA", "SOC2", "GDPR", "FERPA", "WIOA", "42CFR"],
  });
}

// Profile with custom signals populated
export function createPopulatedSignalsProfile(): OrgProfile {
  return createMockProfile({
    custom_signals: {
      keywords: ["intake", "assessment", "referral", "case notes", "service plan", "goals", "discharge"],
      patterns: ["case\\s*#?\\d+", "client\\s*id\\s*:\\s*\\d+", "SSN:\\s*\\d{3}-\\d{2}-\\d{4}"],
      weights: {
        intake: 1.5,
        assessment: 1.3,
        discharge: 1.2,
      },
    },
  });
}

// Profile with matching rules configured
export function createConfiguredRulesProfile(): OrgProfile {
  return createMockProfile({
    matching_rules: {
      overrides: [],
      weights: {
        keyword_exact_match: 1.5,
        context_analysis: 2.0,
      },
      disabled_rules: ["sentiment_scoring"],
    },
  });
}

/**
 * Helper to setup API mocks for ML Settings tests
 */
export async function setupMLSettingsMocks(
  page: Page,
  options?: {
    profile?: OrgProfile;
    industries?: IndustryDefault[];
    profileUpdateDelay?: number;
    profileUpdateError?: boolean;
  }
) {
  const profile = options?.profile ?? createMockProfile();
  const industries = options?.industries ?? createMockIndustryDefaults();

  // Mock the ML profile endpoint
  await page.route("**/api/ml/org/profile", async (route: Route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: profile }),
      });
    } else if (method === "PUT") {
      if (options?.profileUpdateDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.profileUpdateDelay));
      }

      if (options?.profileUpdateError) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Failed to update profile" } }),
        });
      } else {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { ...profile, ...body },
          }),
        });
      }
    }
  });

  // Mock the industries endpoint
  await page.route("**/api/ml/industries", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ industries }),
    });
  });

  // Mock admin settings check (for auth)
  await page.route("**/api/admin/settings", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });

  // Mock other admin endpoints that load on admin page
  await page.route("**/api/admin/phone-numbers/stats", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          stats: {
            poolCount: 0,
            assignedCount: 0,
            totalCount: 0,
            poolCost: 0,
            assignedCost: 0,
            totalMonthlyCost: 0,
          },
          pricing: { monthlyCost: 1.15, currency: "USD" },
        },
      }),
    });
  });

  await page.route("**/api/admin/phone-requests*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { count: 0, requests: [] } }),
    });
  });

  await page.route("**/api/admin/note-approvals*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { count: 0, approvals: [] } }),
    });
  });

  await page.route("**/api/admin/waitlist*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ counts: { pending: 0 }, entries: [] }),
    });
  });
}

/**
 * Test user credentials for admin access
 */
export const TEST_ADMIN_USER = {
  email: "test-admin@scrybe.test",
  password: "TestPassword123!",
};

/**
 * Helper to login as admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_ADMIN_USER.email);
  await page.getByLabel(/password/i).fill(TEST_ADMIN_USER.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(dashboard|admin|forms|clients)/, { timeout: 10000 });
}

/**
 * Helper to navigate to ML Settings tab
 */
export async function navigateToMLSettingsTab(page: Page): Promise<void> {
  await page.goto("/admin");
  await page.waitForLoadState("networkidle");

  const mlSettingsTab = page.getByRole("tab", { name: /ml settings/i });
  if (await mlSettingsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await mlSettingsTab.click();
    await page.waitForLoadState("networkidle");
  }
}

/**
 * Helper to expand an accordion section
 */
export async function expandAccordion(page: Page, name: string): Promise<void> {
  const accordion = page.getByRole("button", { name: new RegExp(name, "i") });
  if (await accordion.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Check if already expanded by looking for content
    const isExpanded = await accordion.getAttribute("data-state") === "open";
    if (!isExpanded) {
      await accordion.click();
    }
  }
}

/**
 * Helper to add a keyword in the custom signals editor
 */
export async function addKeyword(page: Page, keyword: string): Promise<void> {
  await expandAccordion(page, "keywords");
  const input = page.getByPlaceholder(/add keyword/i);
  await input.fill(keyword);
  await input.press("Enter");
}

/**
 * Helper to add a regex pattern in the custom signals editor
 */
export async function addPattern(page: Page, pattern: string): Promise<void> {
  await expandAccordion(page, "regex patterns");
  const input = page.getByPlaceholder(/case/i);
  await input.fill(pattern);
  await input.press("Enter");
}

/**
 * Helper to toggle a compliance framework checkbox
 */
export async function toggleComplianceFramework(page: Page, framework: string): Promise<void> {
  const checkbox = page.getByLabel(new RegExp(framework, "i"));
  if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await checkbox.click();
  }
}

/**
 * Helper to save ML settings
 */
export async function saveMLSettings(page: Page): Promise<void> {
  const saveButton = page.getByRole("button", { name: /save ml settings/i });
  if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await saveButton.click();
  }
}
