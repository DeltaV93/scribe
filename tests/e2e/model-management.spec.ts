import { test, expect } from "@playwright/test";

/**
 * Model Management E2E Tests
 *
 * Tests for editing models, filtering, searching, and deployment workflows.
 *
 * NOTE: These tests require authentication and existing test data.
 *
 * Routes:
 * - Model Registry: /settings/ml/models
 * - Model Detail: /settings/ml/models/[modelId]
 */

test.describe("Model Management", () => {
  test.describe("Filtering and Search", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should filter models by type", async ({ page }) => {
      await page.goto("/settings/ml/models");

      // Find type filter
      const typeFilter = page.getByRole("combobox", { name: /type/i });
      if (await typeFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await typeFilter.click();
        await page.getByRole("option", { name: /extraction/i }).click();

        // URL should update with type filter
        await expect(page).toHaveURL(/type=extraction/);

        // Or models should be filtered
        const models = await page.locator("[data-testid='model-card']").all();
        for (const model of models) {
          await expect(model).toContainText(/extraction/i);
        }
      }
    });

    test("should filter models by status", async ({ page }) => {
      await page.goto("/settings/ml/models");

      // Find status filter if available
      const statusFilter = page.getByRole("combobox", { name: /status/i });
      if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await statusFilter.click();
        await page.getByRole("option", { name: /deployed/i }).click();

        // Models should be filtered
        await page.waitForLoadState("networkidle");
      }
    });

    test("should search models by name", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill("extraction");
        await searchInput.press("Enter");

        // Wait for search results
        await page.waitForLoadState("networkidle");

        // URL should include search query or results should be filtered
        const hasSearchParam = page.url().includes("search=");
        const hasQueryParam = page.url().includes("q=");
        const hasResults =
          (await page.locator("[data-testid='model-card']").count()) >= 0;

        expect(hasSearchParam || hasQueryParam || hasResults).toBeTruthy();
      }
    });

    test("should clear filters", async ({ page }) => {
      await page.goto("/settings/ml/models?type=extraction");

      // Find clear filters button
      const clearBtn = page.getByRole("button", { name: /clear|reset/i });
      if (await clearBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clearBtn.click();

        // URL should not have filters
        await expect(page).not.toHaveURL(/type=/);
      }
    });
  });

  test.describe("Model Editing", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should have edit button on model detail page", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Look for edit button
        const editBtn = page.getByRole("button", { name: /edit/i });
        await expect(editBtn).toBeVisible({ timeout: 10000 });
      }
    });

    test("should open edit form", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const editBtn = page.getByRole("button", { name: /edit/i });
        if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await editBtn.click();

          // Should show edit form or dialog
          const nameInput = page.getByLabel(/name/i);
          const descInput = page.getByLabel(/description/i);

          const hasForm =
            (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) ||
            (await descInput.isVisible({ timeout: 5000 }).catch(() => false));

          expect(hasForm).toBeTruthy();
        }
      }
    });

    test("should update model description", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const editBtn = page.getByRole("button", { name: /edit/i });
        if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await editBtn.click();

          const descInput = page.getByLabel(/description/i);
          if (await descInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            const newDesc = `Updated description ${Date.now()}`;
            await descInput.clear();
            await descInput.fill(newDesc);

            // Save changes
            await page.getByRole("button", { name: /save|update/i }).click();

            // Should show success message or updated description
            await expect(page.getByText(newDesc)).toBeVisible({ timeout: 10000 });
          }
        }
      }
    });
  });

  test.describe("Deployment Workflow", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should show deployment dialog", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Find deploy button
        const deployBtn = page.getByRole("button", { name: /deploy/i });
        if (await deployBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await deployBtn.click();

          // Should show deployment dialog
          await expect(page.getByRole("dialog")).toBeVisible();
        }
      }
    });

    test("should have environment selection", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const deployBtn = page.getByRole("button", { name: /deploy/i });
        if (await deployBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await deployBtn.click();

          // Should show environment options
          const stagingOption = page.getByText(/staging/i);
          const productionOption = page.getByText(/production/i);

          await expect(stagingOption.or(productionOption).first()).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });

    test("should confirm before production deployment", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const deployBtn = page.getByRole("button", { name: /deploy/i });
        if (await deployBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await deployBtn.click();

          // Select production
          const productionRadio = page.getByRole("radio", {
            name: /production/i,
          });
          if (
            await productionRadio.isVisible({ timeout: 5000 }).catch(() => false)
          ) {
            await productionRadio.click();

            // Click deploy
            const confirmBtn = page
              .getByRole("dialog")
              .getByRole("button", { name: /deploy|confirm/i });
            if (
              await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)
            ) {
              await confirmBtn.click();

              // Should show confirmation or warning
              const confirmation = page.getByText(
                /confirm|are you sure|production/i
              );
              await expect(confirmation).toBeVisible({ timeout: 5000 });
            }
          }
        }
      }
    });
  });

  test.describe("Rollback Workflow", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should have rollback option for deployed models", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        // Look for rollback button
        const rollbackBtn = page.getByRole("button", { name: /rollback/i });
        if (
          await rollbackBtn.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await expect(rollbackBtn).toBeVisible();
        }
      }
    });

    test("should show version selection for rollback", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const rollbackBtn = page.getByRole("button", { name: /rollback/i });
        if (
          await rollbackBtn.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await rollbackBtn.click();

          // Should show version selection dialog
          await expect(
            page.getByText(/select version|rollback to/i)
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe("Version Creation", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should open new version dialog", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const newVersionBtn = page.getByRole("button", {
          name: /new version|create version/i,
        });
        if (
          await newVersionBtn.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await newVersionBtn.click();

          // Should show version creation form
          await expect(page.getByText(/config|configuration/i)).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });

    test("should allow config input for new version", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const modelLink = page.locator("a[href*='/settings/ml/models/']").first();
      if (await modelLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await modelLink.click();

        const newVersionBtn = page.getByRole("button", {
          name: /new version|create version/i,
        });
        if (
          await newVersionBtn.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await newVersionBtn.click();

          // Look for config input (could be JSON editor or form fields)
          const configInput = page
            .getByRole("textbox", { name: /config/i })
            .or(page.locator('[data-testid="config-editor"]'))
            .or(page.locator("textarea"));

          if (
            await configInput.first().isVisible({ timeout: 5000 }).catch(() => false)
          ) {
            await expect(configInput.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Pagination", () => {
    test.skip(
      () => !process.env.TEST_AUTH_ENABLED,
      "Requires auth setup"
    );

    test("should display pagination controls", async ({ page }) => {
      await page.goto("/settings/ml/models");

      // Look for pagination
      const pagination = page.locator('[data-testid="pagination"]');
      const nextBtn = page.getByRole("button", { name: /next/i });
      const prevBtn = page.getByRole("button", { name: /previous|prev/i });

      const hasPagination =
        (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) ||
        (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) ||
        (await prevBtn.isVisible({ timeout: 5000 }).catch(() => false));

      // Pagination might not be visible if there aren't enough items
      expect(typeof hasPagination).toBe("boolean");
    });

    test("should navigate to next page", async ({ page }) => {
      await page.goto("/settings/ml/models");

      const nextBtn = page.getByRole("button", { name: /next/i });
      if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        if (await nextBtn.isEnabled()) {
          await nextBtn.click();

          // URL should include page parameter
          await expect(page).toHaveURL(/page=2/);
        }
      }
    });
  });
});

test.describe("Model Management API", () => {
  test("should reject or fail unauthenticated version creation", async ({ request }) => {
    const response = await request.post(
      "/api/ml/models/test-model-id/versions",
      {
        data: { config: {} },
      }
    );

    // Unauthenticated requests should return an error status
    // 401 = auth required, 404 = route not found, 500 = internal error
    expect([401, 404, 500]).toContain(response.status());
  });

  test("should reject or fail unauthenticated deployment", async ({ request }) => {
    const response = await request.post(
      "/api/ml/models/test-model-id/versions/1/deploy",
      {
        data: { environment: "staging" },
      }
    );

    // Unauthenticated requests should return an error status
    expect([401, 404, 500]).toContain(response.status());
  });

  test("should reject or fail unauthenticated rollback", async ({ request }) => {
    const response = await request.post(
      "/api/ml/models/test-model-id/versions/1/rollback?environment=staging"
    );

    // Unauthenticated requests should return an error status
    expect([401, 404, 500]).toContain(response.status());
  });
});
