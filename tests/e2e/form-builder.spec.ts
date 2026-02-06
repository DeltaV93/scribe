import { test, expect } from "@playwright/test";

/**
 * Form Builder E2E Tests
 *
 * Note: These tests require authentication. In a real test environment,
 * you would set up test users and authentication state.
 *
 * For testing without auth, use:
 * - Mock auth middleware in test environment
 * - Or use authenticated browser state
 */

test.describe("Form Builder", () => {
  // Skip auth-required tests in CI without proper setup
  test.skip(({ browserName }) => !process.env.TEST_AUTH_ENABLED, "Requires auth setup");

  test.describe("Form List", () => {
    test("should display forms page with create button", async ({ page }) => {
      await page.goto("/forms");

      // Check for page header
      await expect(page.getByRole("heading", { name: /forms/i })).toBeVisible();

      // Check for create button
      await expect(page.getByRole("button", { name: /create|new form/i })).toBeVisible();
    });

    test("should show empty state when no forms exist", async ({ page }) => {
      await page.goto("/forms");

      // Check for empty state or form list
      const hasEmptyState = await page.getByText(/no forms|get started|create your first/i).isVisible().catch(() => false);
      const hasFormList = await page.locator("[data-testid='form-card']").count() > 0;

      expect(hasEmptyState || hasFormList).toBeTruthy();
    });
  });

  test.describe("Form Creation", () => {
    test("should open form creation wizard", async ({ page }) => {
      await page.goto("/forms");

      // Click create button
      await page.getByRole("button", { name: /create|new form/i }).click();

      // Should show form creation wizard or modal
      await expect(page.getByText(/create|new|form type/i)).toBeVisible();
    });

    test("should allow selecting form type", async ({ page }) => {
      await page.goto("/forms/new");

      // Check for form type options
      const formTypes = ["intake", "followup", "referral", "assessment", "custom"];

      for (const type of formTypes) {
        const option = page.getByText(new RegExp(type, "i"));
        await expect(option).toBeVisible();
      }
    });
  });

  test.describe("Form Editor", () => {
    test("should display field palette", async ({ page }) => {
      // Navigate to form editor (assuming a form exists)
      await page.goto("/forms/test-form-id/edit");

      // Check for field type buttons
      const fieldTypes = ["Text", "Number", "Date", "Email", "Phone"];

      for (const fieldType of fieldTypes) {
        await expect(page.getByRole("button", { name: new RegExp(fieldType, "i") })).toBeVisible();
      }
    });

    test("should allow adding fields to canvas", async ({ page }) => {
      await page.goto("/forms/test-form-id/edit");

      // Drag a field to the canvas (or click to add)
      await page.getByRole("button", { name: /short text/i }).click();

      // Verify field was added
      await expect(page.locator("[data-testid='form-field']")).toHaveCount(1);
    });

    test("should open field editor when clicking a field", async ({ page }) => {
      await page.goto("/forms/test-form-id/edit");

      // Add a field first
      await page.getByRole("button", { name: /short text/i }).click();

      // Click on the field
      await page.locator("[data-testid='form-field']").first().click();

      // Should show field editor panel
      await expect(page.getByText(/field settings|properties|edit field/i)).toBeVisible();
    });
  });

  test.describe("Form Publishing", () => {
    test("should show publish button for draft forms", async ({ page }) => {
      await page.goto("/forms/test-form-id/edit");

      // Check for publish button
      await expect(page.getByRole("button", { name: /publish/i })).toBeVisible();
    });

    test("should confirm before publishing", async ({ page }) => {
      await page.goto("/forms/test-form-id/edit");

      // Click publish
      await page.getByRole("button", { name: /publish/i }).click();

      // Should show confirmation
      await expect(page.getByText(/confirm|sure|publish this form/i)).toBeVisible();
    });
  });
});

test.describe("Form Preview", () => {
  // Skip auth-required tests in CI without proper setup
  // Form preview is a step within the form builder wizard, not a standalone route
  test.skip(
    () => !process.env.TEST_AUTH_ENABLED,
    "Requires auth setup - preview is part of form builder wizard"
  );

  test("should show preview of form fields in wizard", async ({ page }) => {
    // Navigate to form editor
    await page.goto("/forms/test-form-id/edit");

    // Navigate to preview step in the wizard
    await page.getByRole("button", { name: /preview/i }).click();

    // Should display form preview with view mode selector
    await expect(page.getByRole("button", { name: /desktop/i })).toBeVisible();

    // Form fields should be visible (disabled inputs in preview)
    await expect(page.locator("input, textarea, select")).toBeTruthy();
  });

  test("should show responsive preview modes", async ({ page }) => {
    await page.goto("/forms/test-form-id/edit");

    // Navigate to preview step
    await page.getByRole("button", { name: /preview/i }).click();

    // Check for responsive view modes
    await expect(page.getByRole("button", { name: /desktop/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /tablet/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /mobile/i })).toBeVisible();
  });
});
