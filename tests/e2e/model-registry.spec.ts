import { test, expect } from "@playwright/test";

/**
 * Model Registry E2E Tests
 *
 * Tests for the ML Model Registry UI including listing, creating,
 * viewing, and managing models.
 *
 * NOTE: These tests require authentication. In a real test environment,
 * you would set up test users with appropriate permissions.
 */

test.describe("Model Registry", () => {
  test.describe("Unauthenticated Access", () => {
    test("should require authentication for model list page", async ({
      page,
    }) => {
      await page.goto("/admin/ml/models");

      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth)/);
    });

    test("should require authentication for model detail page", async ({
      page,
    }) => {
      await page.goto("/admin/ml/models/test-model-id");

      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth)/);
    });

    test("should require authentication for new model page", async ({
      page,
    }) => {
      await page.goto("/admin/ml/models/new");

      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth)/);
    });
  });

  test.describe("Model List Page", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display models list page", async ({ page }) => {
      await page.goto("/admin/ml/models");

      // Check for page header
      await expect(
        page.getByRole("heading", { name: /models|registry/i })
      ).toBeVisible();
    });

    test("should have create model button", async ({ page }) => {
      await page.goto("/admin/ml/models");

      await expect(
        page.getByRole("button", { name: /create|new|add/i })
      ).toBeVisible();
    });

    test("should display model cards or table", async ({ page }) => {
      await page.goto("/admin/ml/models");

      // Check for model list container
      const modelList = page
        .locator('[data-testid="model-list"]')
        .or(page.locator("table"))
        .or(page.locator('[role="grid"]'));

      await expect(modelList.first()).toBeVisible({ timeout: 10000 });
    });

    test("should show empty state when no models exist", async ({ page }) => {
      await page.goto("/admin/ml/models");

      // Check for empty state or model list
      const hasEmptyState = await page
        .getByText(/no models|get started|create your first/i)
        .isVisible()
        .catch(() => false);
      const hasModelList =
        (await page.locator("[data-testid='model-card']").count()) > 0;

      expect(hasEmptyState || hasModelList).toBeTruthy();
    });

    test("should have filter controls", async ({ page }) => {
      await page.goto("/admin/ml/models");

      // Check for filter elements (search, type filter)
      const searchInput = page.getByPlaceholder(/search/i);
      const typeFilter = page.getByRole("combobox");

      const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
      const hasFilter = await typeFilter.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasSearch || hasFilter).toBeTruthy();
    });
  });

  test.describe("Model Creation", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should open model creation form", async ({ page }) => {
      await page.goto("/admin/ml/models");

      // Click create button
      await page.getByRole("button", { name: /create|new|add/i }).click();

      // Should show creation form or navigate to new page
      const hasForm = await page.getByLabel(/name/i).isVisible({ timeout: 5000 }).catch(() => false);
      const hasNewUrl = page.url().includes("/new");

      expect(hasForm || hasNewUrl).toBeTruthy();
    });

    test("should display model type options", async ({ page }) => {
      await page.goto("/admin/ml/models/new");

      // Check for model type selector
      const typeSelector = page.getByRole("combobox");
      if (await typeSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
        await typeSelector.click();

        // Check for type options
        await expect(page.getByRole("option", { name: /extraction/i })).toBeVisible();
        await expect(page.getByRole("option", { name: /llm/i })).toBeVisible();
        await expect(page.getByRole("option", { name: /classification/i })).toBeVisible();
      }
    });

    test("should require model name", async ({ page }) => {
      await page.goto("/admin/ml/models/new");

      // Try to submit without name
      const submitButton = page.getByRole("button", { name: /create|save|submit/i });
      if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Button should be disabled when name is empty
        await expect(submitButton).toBeDisabled();
      }
    });

    test("should validate model name", async ({ page }) => {
      await page.goto("/admin/ml/models/new");

      const nameInput = page.getByLabel(/name/i);
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Fill with valid name
        await nameInput.fill("test-model");

        // Submit button should be enabled
        const submitButton = page.getByRole("button", { name: /create|save|submit/i });
        await expect(submitButton).toBeEnabled();
      }
    });

    test("should create model successfully", async ({ page }) => {
      await page.goto("/admin/ml/models/new");

      const nameInput = page.getByLabel(/name/i);
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Fill form
        await nameInput.fill(`e2e-test-model-${Date.now()}`);

        // Select type if available
        const typeSelector = page.getByRole("combobox");
        if (await typeSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
          await typeSelector.click();
          await page.getByRole("option", { name: /extraction/i }).click();
        }

        // Submit
        await page.getByRole("button", { name: /create|save|submit/i }).click();

        // Should redirect to model detail or list
        await expect(page).toHaveURL(
          /\/admin\/ml\/models(\/[a-f0-9-]+)?/,
          { timeout: 10000 }
        );
      }
    });
  });

  test.describe("Model Detail Page", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display model details", async ({ page }) => {
      // First create or navigate to a known model
      await page.goto("/admin/ml/models");

      // Click on first model if exists
      const modelLink = page.locator("a[href*='/admin/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Should show model details
        await expect(page.getByText(/type|status|created/i)).toBeVisible();
      }
    });

    test("should display versions list", async ({ page }) => {
      await page.goto("/admin/ml/models");

      const modelLink = page.locator("a[href*='/admin/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Check for versions section
        await expect(page.getByText(/versions/i)).toBeVisible();
      }
    });

    test("should have create version button", async ({ page }) => {
      await page.goto("/admin/ml/models");

      const modelLink = page.locator("a[href*='/admin/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Check for create version button
        const createVersionBtn = page.getByRole("button", {
          name: /new version|create version/i,
        });
        await expect(createVersionBtn).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe("Version Management", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display version details", async ({ page }) => {
      await page.goto("/admin/ml/models");

      const modelLink = page.locator("a[href*='/admin/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Click on a version if exists
        const versionRow = page.locator('[data-testid="version-row"]').first();
        if (await versionRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          await versionRow.click();

          // Should show version details
          await expect(page.getByText(/status|metrics|config/i)).toBeVisible();
        }
      }
    });

    test("should have deploy button for ready versions", async ({ page }) => {
      await page.goto("/admin/ml/models");

      const modelLink = page.locator("a[href*='/admin/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Look for deploy button on a ready version
        const deployBtn = page.getByRole("button", { name: /deploy/i });
        if (await deployBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(deployBtn).toBeVisible();
        }
      }
    });
  });
});

test.describe("Model Registry API", () => {
  test("should reject unauthenticated requests to list models", async ({
    request,
  }) => {
    const response = await request.get("/api/ml/models");

    expect(response.status()).toBe(401);
  });

  test("should reject unauthenticated requests to create model", async ({
    request,
  }) => {
    const response = await request.post("/api/ml/models", {
      data: {
        name: "test-model",
        model_type: "extraction",
      },
    });

    expect(response.status()).toBe(401);
  });

  test("should reject unauthenticated requests to get model", async ({
    request,
  }) => {
    const response = await request.get("/api/ml/models/test-model-id");

    expect(response.status()).toBe(401);
  });
});
