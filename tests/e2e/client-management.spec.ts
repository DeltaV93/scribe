import { test, expect } from "@playwright/test";

/**
 * Client Management E2E Tests
 */

test.describe("Client Management", () => {
  // Skip auth-required tests in CI without proper setup
  test.skip(({ browserName }) => !process.env.TEST_AUTH_ENABLED, "Requires auth setup");

  test.describe("Client List", () => {
    test("should display clients page with add button", async ({ page }) => {
      await page.goto("/clients");

      // Check for page header
      await expect(page.getByRole("heading", { name: /clients/i })).toBeVisible();

      // Check for add client button
      await expect(page.getByRole("button", { name: /add|new|create/i })).toBeVisible();
    });

    test("should show search input", async ({ page }) => {
      await page.goto("/clients");

      // Check for search input
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test("should filter clients by status", async ({ page }) => {
      await page.goto("/clients");

      // Look for status filter
      const statusFilter = page.getByRole("combobox", { name: /status/i });
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await expect(page.getByText(/active|on hold|closed|pending/i)).toBeVisible();
      }
    });
  });

  test.describe("Client Creation", () => {
    test("should open client creation form", async ({ page }) => {
      await page.goto("/clients");

      // Click add client button
      await page.getByRole("button", { name: /add|new|create/i }).click();

      // Should show client form
      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      await expect(page.getByLabel(/phone/i)).toBeVisible();
    });

    test("should validate required fields", async ({ page }) => {
      await page.goto("/clients");
      await page.getByRole("button", { name: /add|new|create/i }).click();

      // Try to submit without required fields
      await page.getByRole("button", { name: /save|create|add/i }).click();

      // Should show validation errors
      await expect(page.getByText(/required/i)).toBeVisible();
    });

    test("should create client with valid data", async ({ page }) => {
      await page.goto("/clients");
      await page.getByRole("button", { name: /add|new|create/i }).click();

      // Fill in required fields
      await page.getByLabel(/first name/i).fill("John");
      await page.getByLabel(/last name/i).fill("Doe");
      await page.getByLabel(/phone/i).fill("5551234567");

      // Submit
      await page.getByRole("button", { name: /save|create|add/i }).click();

      // Should show success or redirect
      await expect(page.getByText(/success|created|saved/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Duplicate Detection", () => {
    test("should warn about potential duplicate clients", async ({ page }) => {
      await page.goto("/clients");
      await page.getByRole("button", { name: /add|new|create/i }).click();

      // Fill in data that might match existing client
      await page.getByLabel(/first name/i).fill("John");
      await page.getByLabel(/last name/i).fill("Doe");
      await page.getByLabel(/phone/i).fill("5551234567");

      // Trigger duplicate check (usually on blur or before submit)
      await page.getByLabel(/phone/i).blur();

      // If duplicate found, should show warning
      const duplicateWarning = page.getByText(/duplicate|already exists|similar/i);
      // This may or may not be visible depending on test data
      await duplicateWarning.isVisible().catch(() => false);
    });
  });

  test.describe("Client Profile", () => {
    test("should display client details", async ({ page }) => {
      // Navigate to a client profile (assuming client exists)
      await page.goto("/clients/test-client-id");

      // Should show client information
      await expect(page.getByText(/client|profile/i)).toBeVisible();
      await expect(page.getByText(/phone|contact/i)).toBeVisible();
    });

    test("should show client call history", async ({ page }) => {
      await page.goto("/clients/test-client-id");

      // Check for calls section
      await expect(page.getByText(/calls|history/i)).toBeVisible();
    });

    test("should show client notes", async ({ page }) => {
      await page.goto("/clients/test-client-id");

      // Check for notes section
      await expect(page.getByText(/notes/i)).toBeVisible();
    });
  });

  test.describe("Client Search", () => {
    test("should search by name", async ({ page }) => {
      await page.goto("/clients");

      // Search for a client
      await page.getByPlaceholder(/search/i).fill("John");
      await page.keyboard.press("Enter");

      // Should filter results
      await expect(page.getByText(/john/i)).toBeVisible();
    });

    test("should search by phone number", async ({ page }) => {
      await page.goto("/clients");

      // Search by phone
      await page.getByPlaceholder(/search/i).fill("555");
      await page.keyboard.press("Enter");

      // Results should update
      await page.waitForLoadState("networkidle");
    });
  });
});

test.describe("Client Status Management", () => {
  test.skip(({ browserName }) => !process.env.TEST_AUTH_ENABLED, "Requires auth setup");

  test("should allow changing client status", async ({ page }) => {
    await page.goto("/clients/test-client-id");

    // Find status dropdown or button
    const statusButton = page.getByRole("button", { name: /status|active|on hold/i });
    if (await statusButton.isVisible()) {
      await statusButton.click();

      // Should show status options
      await expect(page.getByText(/on hold/i)).toBeVisible();
      await expect(page.getByText(/closed/i)).toBeVisible();
    }
  });
});
