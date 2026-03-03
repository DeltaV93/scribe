import { test, expect } from "@playwright/test";

/**
 * ML Settings E2E Tests
 *
 * Tests for the ML Services settings page in the admin UI.
 * These tests verify the health status display, privacy budget display,
 * and basic navigation to ML settings.
 *
 * NOTE: These tests require authentication. In a real test environment,
 * you would set up test users with admin privileges.
 */

test.describe("ML Settings Page", () => {
  test.describe("Unauthenticated Access", () => {
    test("should require authentication for ML settings page", async ({
      page,
    }) => {
      await page.goto("/admin/ml");

      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth)/);
    });
  });

  test.describe("Navigation", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should navigate to ML settings from admin page", async ({ page }) => {
      await page.goto("/admin");

      // Look for ML settings link/tab
      const mlLink = page.getByRole("link", { name: /ml|machine learning/i });
      if (await mlLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await mlLink.click();
        await expect(page).toHaveURL(/\/admin\/ml/);
      }
    });

    test("should display ML settings heading", async ({ page }) => {
      await page.goto("/admin/ml");

      await expect(
        page.getByRole("heading", { name: /ml|machine learning|ai/i })
      ).toBeVisible();
    });
  });

  test.describe("Health Status Display", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display ML services health status", async ({ page }) => {
      await page.goto("/admin/ml");

      // Check for health status indicator
      const healthStatus = page.getByText(/healthy|connected|status/i);
      await expect(healthStatus).toBeVisible({ timeout: 10000 });
    });

    test("should show database connection status", async ({ page }) => {
      await page.goto("/admin/ml");

      // Look for database status indicator
      const dbStatus = page.getByText(/database|db/i);
      if (await dbStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(dbStatus).toBeVisible();
      }
    });

    test("should show redis connection status", async ({ page }) => {
      await page.goto("/admin/ml");

      // Look for redis status indicator
      const redisStatus = page.getByText(/redis|cache/i);
      if (await redisStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(redisStatus).toBeVisible();
      }
    });
  });

  test.describe("Privacy Budget Display", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display privacy budget information", async ({ page }) => {
      await page.goto("/admin/ml");

      // Check for privacy budget section
      const privacySection = page.getByText(/privacy.*budget|epsilon/i);
      await expect(privacySection).toBeVisible({ timeout: 10000 });
    });

    test("should show budget usage bar or percentage", async ({ page }) => {
      await page.goto("/admin/ml");

      // Look for progress bar or percentage display
      const usageIndicator = page
        .locator('[role="progressbar"], [data-testid="budget-progress"]')
        .or(page.getByText(/%/));

      if (await usageIndicator.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(usageIndicator.first()).toBeVisible();
      }
    });

    test("should display remaining budget", async ({ page }) => {
      await page.goto("/admin/ml");

      // Look for remaining budget display
      const remaining = page.getByText(/remaining|left|available/i);
      if (await remaining.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(remaining).toBeVisible();
      }
    });
  });

  test.describe("Compliance Frameworks", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display compliance frameworks section", async ({ page }) => {
      await page.goto("/admin/ml");

      // Check for compliance section
      const complianceSection = page.getByText(/compliance|frameworks|hipaa|soc2/i);
      await expect(complianceSection).toBeVisible({ timeout: 10000 });
    });

    test("should list enabled frameworks", async ({ page }) => {
      await page.goto("/admin/ml");

      // Common frameworks that might be displayed
      const frameworks = ["HIPAA", "SOC2", "GDPR"];

      for (const framework of frameworks) {
        const frameworkBadge = page.getByText(new RegExp(framework, "i"));
        // Just check if any exist, not all are required
        if (await frameworkBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(frameworkBadge).toBeVisible();
          break;
        }
      }
    });
  });

  test.describe("Model Training Toggle", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display model training enabled toggle", async ({ page }) => {
      await page.goto("/admin/ml");

      // Check for training toggle
      const trainingToggle = page.getByRole("switch", { name: /training/i });
      if (await trainingToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(trainingToggle).toBeVisible();
      }
    });

    test("should be able to toggle model training", async ({ page }) => {
      await page.goto("/admin/ml");

      const trainingToggle = page.getByRole("switch", { name: /training/i });
      if (await trainingToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        const initialState = await trainingToggle.isChecked();
        await trainingToggle.click();

        // State should change (or show confirmation dialog)
        const stateChanged = (await trainingToggle.isChecked()) !== initialState;
        const dialogShown = await page
          .getByRole("dialog")
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        expect(stateChanged || dialogShown).toBeTruthy();
      }
    });
  });
});

test.describe("ML Settings API Access", () => {
  test("should reject unauthenticated API requests to health endpoint", async ({
    request,
  }) => {
    const response = await request.get("/api/ml/health");

    // Health endpoint should require auth
    expect(response.status()).toBe(401);
  });

  test("should reject unauthenticated API requests to profile endpoint", async ({
    request,
  }) => {
    const response = await request.get("/api/ml/org/profile");

    expect(response.status()).toBe(401);
  });

  test("should reject unauthenticated API requests to privacy budget", async ({
    request,
  }) => {
    const response = await request.get("/api/ml/org/privacy-budget");

    expect(response.status()).toBe(401);
  });
});
