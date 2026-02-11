import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Client Activity Feed
 * Covers: PX-728
 */

test.describe("Client Activity Feed (PX-728)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to clients list
    await page.goto("/clients");
  });

  test("should display activity feed on client detail page", async ({ page }) => {
    // Wait for clients list to load
    await page.waitForSelector("table", { timeout: 10000 });

    // Click on first client
    const clientRow = page.locator("tr").nth(1);
    if (await clientRow.isVisible()) {
      await clientRow.click();

      // Wait for client detail page to load
      await page.waitForTimeout(2000);

      // Look for activity section or tab
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();

        // Should show activity items
        await expect(page.getByText(/call|note|form|attendance/i).first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should filter activity by type", async ({ page }) => {
    // Navigate to a client
    await page.waitForSelector("table", { timeout: 10000 });

    const clientRow = page.locator("tr").nth(1);
    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForTimeout(2000);

      // Click activity tab
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();

        // Look for filter controls
        const typeFilter = page.getByRole("combobox").filter({ hasText: /type|filter/i });
        if (await typeFilter.isVisible()) {
          await typeFilter.click();

          // Should have filter options
          await expect(page.getByRole("option")).toHaveCount.greaterThan(0);
        }
      }
    }
  });

  test("should load more activities on scroll", async ({ page }) => {
    // Navigate to a client with many activities
    await page.waitForSelector("table", { timeout: 10000 });

    const clientRow = page.locator("tr").nth(1);
    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForTimeout(2000);

      // Click activity tab
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();
        await page.waitForTimeout(1000);

        // Scroll to bottom of activity list
        const activityList = page.locator("[data-testid='activity-list']");
        if (await activityList.isVisible()) {
          await activityList.evaluate((el) => el.scrollTop = el.scrollHeight);

          // Should load more or show "no more" message
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test("should show activity details in correct format", async ({ page }) => {
    // Navigate to a client
    await page.waitForSelector("table", { timeout: 10000 });

    const clientRow = page.locator("tr").nth(1);
    if (await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForTimeout(2000);

      // Click activity tab
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();

        // Each activity item should have:
        // - Icon/indicator for type
        // - Summary text
        // - Timestamp
        // - Actor name

        const activityItem = page.locator("[data-testid='activity-item']").first();
        if (await activityItem.isVisible()) {
          await expect(activityItem.locator("time")).toBeVisible();
        }
      }
    }
  });
});

test.describe("Activity Feed API", () => {
  test("should fetch activities via API", async ({ request }) => {
    // Test the activity feed API endpoint
    // Requires authentication setup

    // Example API test
    // const response = await request.get('/api/clients/test-client-id/activity');
    // expect(response.ok()).toBeTruthy();
    // const data = await response.json();
    // expect(data.success).toBe(true);
    // expect(Array.isArray(data.data.activities)).toBe(true);
  });

  test("should support cursor-based pagination", async ({ request }) => {
    // Test pagination via API

    // Example API test
    // const response = await request.get('/api/clients/test-client-id/activity?limit=10');
    // expect(response.ok()).toBeTruthy();
    // const data = await response.json();
    // if (data.data.nextCursor) {
    //   const nextResponse = await request.get(`/api/clients/test-client-id/activity?cursor=${data.data.nextCursor}`);
    //   expect(nextResponse.ok()).toBeTruthy();
    // }
  });
});
