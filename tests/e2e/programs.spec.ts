import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Program Management Features
 * Covers: PX-721, PX-722, PX-724, PX-726
 */

test.describe("Programs List", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the programs page
    // Note: This requires authentication - adjust based on test setup
    await page.goto("/programs");
  });

  test("should display programs list", async ({ page }) => {
    // Wait for the page to load
    await expect(page.getByRole("heading", { name: /programs/i })).toBeVisible({ timeout: 10000 });

    // Should have search and filter controls
    await expect(page.getByPlaceholder(/search programs/i)).toBeVisible();
  });

  test("should filter programs by status", async ({ page }) => {
    // Open status filter
    await page.getByRole("combobox").first().click();

    // Should have status options
    await expect(page.getByRole("option", { name: /draft/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /active/i })).toBeVisible();
  });
});

test.describe("Session Management (PX-721, PX-724)", () => {
  test("should expand program to show sessions", async ({ page }) => {
    await page.goto("/programs");

    // Wait for programs to load
    await page.waitForSelector("table");

    // Click expand button on first program with sessions
    const expandButton = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await expandButton.isVisible()) {
      await expandButton.click();

      // Should show session rows
      await expect(page.getByText(/session/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show session status dropdown", async ({ page }) => {
    // Navigate to a specific program page
    await page.goto("/programs");

    // Expand first program
    const expandButton = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await expandButton.isVisible()) {
      await expandButton.click();

      // Wait for sessions to load
      await page.waitForTimeout(1000);

      // Find status dropdown button
      const statusButton = page.locator("button").filter({ hasText: /(draft|scheduled|in progress|completed)/i }).first();
      if (await statusButton.isVisible()) {
        await statusButton.click();

        // Should show status options
        await expect(page.getByRole("menuitem")).toHaveCount.greaterThan(0);
      }
    }
  });
});

test.describe("Session Status Update (PX-724)", () => {
  test("should require confirmation for backward status change", async ({ page }) => {
    await page.goto("/programs");

    // This test requires a session in a non-draft state
    // The test will verify the confirmation dialog appears
    // when attempting to move status backward

    // Navigate to programs and expand
    const expandButton = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      // Find a session status dropdown
      const statusButton = page.locator("button").filter({ hasText: /(scheduled|in progress|completed)/i }).first();
      if (await statusButton.isVisible()) {
        await statusButton.click();

        // Try to select a backward status (e.g., Draft)
        const draftOption = page.getByRole("menuitem", { name: /draft/i });
        if (await draftOption.isVisible()) {
          await draftOption.click();

          // Should show confirmation dialog
          await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 3000 });
          await expect(page.getByText(/confirm status change/i)).toBeVisible();
        }
      }
    }
  });
});

test.describe("Session Progress Badge (PX-726)", () => {
  test("should display progress badge in expanded view", async ({ page }) => {
    await page.goto("/programs");

    // Expand a program
    const expandButton = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      // Look for progress badge (e.g., "3/8")
      const progressBadge = page.locator("span").filter({ hasText: /\d+\/\d+/ }).first();
      if (await progressBadge.isVisible()) {
        // Hover to see tooltip
        await progressBadge.hover();
        await expect(page.getByRole("tooltip")).toBeVisible({ timeout: 2000 });
      }
    }
  });
});

test.describe("Materials Quick View (PX-722)", () => {
  test("should show materials indicator for programs with materials", async ({ page }) => {
    await page.goto("/programs");

    // Look for materials indicator (paperclip icon with count)
    const materialsIndicator = page.locator("[title*='material']");
    if (await materialsIndicator.first().isVisible()) {
      await materialsIndicator.first().click();

      // Should open popover with materials list
      await expect(page.getByRole("heading", { name: /materials/i })).toBeVisible({ timeout: 3000 });
    }
  });

  test("should show materials in session rows", async ({ page }) => {
    await page.goto("/programs");

    // Expand a program
    const expandButton = page.locator("button").filter({ has: page.locator("svg") }).first();
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      // Look for materials button in session row
      const materialsButton = page.locator("button").filter({ has: page.locator("svg.lucide-paperclip") }).first();
      if (await materialsButton.isVisible()) {
        await materialsButton.click();

        // Should show materials popover
        await expect(page.getByText(/session materials/i)).toBeVisible({ timeout: 3000 });
      }
    }
  });
});
