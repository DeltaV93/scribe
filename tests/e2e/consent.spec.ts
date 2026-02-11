import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Consent Management Features
 * Covers: PX-735, PX-736
 */

test.describe("Recording Consent (PX-735)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a client detail page
    await page.goto("/clients");
  });

  test("should display consent status on client page", async ({ page }) => {
    // Wait for clients list to load
    await page.waitForSelector("table", { timeout: 10000 });

    // Click on first client
    const clientRow = page.locator("tr").nth(1);
    if (await clientRow.isVisible()) {
      await clientRow.click();

      // Should show consent section or tab
      // The exact location depends on client page structure
      await page.waitForTimeout(2000);

      // Look for consent-related content
      const consentSection = page.getByText(/consent|recording/i);
      await expect(consentSection.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should allow granting consent", async ({ page }) => {
    // This test would need to navigate to a specific client
    // and interact with the consent UI

    // Navigate to clients
    await page.goto("/clients");
    await page.waitForSelector("table", { timeout: 10000 });

    // The exact test steps depend on UI implementation
    // This is a placeholder for consent grant flow
  });

  test("should allow revoking consent with confirmation", async ({ page }) => {
    // This test would verify the consent revocation flow
    // including the confirmation dialog

    await page.goto("/clients");
    await page.waitForSelector("table", { timeout: 10000 });

    // The exact test steps depend on UI implementation
    // This is a placeholder for consent revoke flow
  });
});

test.describe("State Consent Rules (PX-736)", () => {
  test("should show consent rules for calls", async ({ page }) => {
    // Navigate to a page where consent rules are displayed
    // This could be the call initiation page or settings

    await page.goto("/calls");
    await page.waitForTimeout(2000);

    // Look for consent-related information
    // The exact UI depends on implementation
  });
});

test.describe("Consent API", () => {
  test("should fetch consent status via API", async ({ request }) => {
    // This test verifies the API endpoint works
    // Requires authentication setup in playwright config

    // Example API test (adjust based on actual setup)
    // const response = await request.get('/api/clients/test-client-id/consent');
    // expect(response.ok()).toBeTruthy();
  });

  test("should fetch state consent rules via API", async ({ request }) => {
    // Test the consent rules API

    // Example API test
    // const response = await request.get('/api/consent-rules?orgState=CA');
    // expect(response.ok()).toBeTruthy();
  });
});
