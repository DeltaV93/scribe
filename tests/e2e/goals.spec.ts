import { test, expect } from "@playwright/test";

test.describe("Goals Hub", () => {
  test.describe("Unauthenticated Access", () => {
    test("should require authentication for goals page", async ({ page }) => {
      await page.goto("/goals");

      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth)/);
    });

    test("should require authentication for new goal page", async ({ page }) => {
      await page.goto("/goals/new");

      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth)/);
    });
  });

  test.describe("Goals List Page", () => {
    test.beforeEach(async ({ page }) => {
      // TODO: Add authentication fixture
      // For now, these tests will be skipped until auth fixture is set up
    });

    test.skip("should display goals list page", async ({ page }) => {
      await page.goto("/goals");

      // Check for page elements
      await expect(page.getByRole("heading", { name: /goals/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /new goal|create goal/i })).toBeVisible();
    });

    test.skip("should have filter controls", async ({ page }) => {
      await page.goto("/goals");

      // Check for filter elements
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
      await expect(page.getByRole("combobox")).toBeVisible();
    });

    test.skip("should filter goals by type", async ({ page }) => {
      await page.goto("/goals");

      // Select grant type filter
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /grant/i }).click();

      // URL should update with type filter
      await expect(page).toHaveURL(/type=grant/i);
    });

    test.skip("should filter goals by status", async ({ page }) => {
      await page.goto("/goals");

      // Select status filter
      const statusSelect = page.getByRole("combobox").nth(1);
      await statusSelect.click();
      await page.getByRole("option", { name: /in progress/i }).click();

      // URL should update with status filter
      await expect(page).toHaveURL(/status=in_progress/i);
    });
  });

  test.describe("Goal Creation Wizard", () => {
    test.beforeEach(async ({ page }) => {
      // TODO: Add authentication fixture
    });

    test.skip("should display creation wizard", async ({ page }) => {
      await page.goto("/goals/new");

      // Check for wizard elements
      await expect(page.getByRole("heading", { name: /create new goal/i })).toBeVisible();
      await expect(page.getByText(/basics/i)).toBeVisible();
      await expect(page.getByText(/metrics/i)).toBeVisible();
      await expect(page.getByText(/team/i)).toBeVisible();
    });

    test.skip("should navigate through wizard steps", async ({ page }) => {
      await page.goto("/goals/new");

      // Step 1: Fill basics
      await page.getByLabel(/goal name/i).fill("Test Goal");
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /grant/i }).click();

      // Go to next step
      await page.getByRole("button", { name: /next/i }).click();

      // Should be on metrics step
      await expect(page.getByText(/link existing grants/i)).toBeVisible();

      // Go to next step
      await page.getByRole("button", { name: /next/i }).click();

      // Should be on team step
      await expect(page.getByText(/owner/i)).toBeVisible();
    });

    test.skip("should require goal name", async ({ page }) => {
      await page.goto("/goals/new");

      // Try to proceed without name
      const nextButton = page.getByRole("button", { name: /next/i });

      // Button should be disabled when name is empty
      await expect(nextButton).toBeDisabled();

      // Fill name
      await page.getByLabel(/goal name/i).fill("Test Goal");

      // Button should be enabled
      await expect(nextButton).toBeEnabled();
    });

    test.skip("should create goal successfully", async ({ page }) => {
      await page.goto("/goals/new");

      // Step 1: Basics
      await page.getByLabel(/goal name/i).fill("E2E Test Goal");
      await page.getByRole("button", { name: /next/i }).click();

      // Step 2: Metrics (skip)
      await page.getByRole("button", { name: /next/i }).click();

      // Step 3: Team (skip)
      await page.getByRole("button", { name: /create goal/i }).click();

      // Should redirect to goal detail page
      await expect(page).toHaveURL(/\/goals\/[a-f0-9-]+/);
      await expect(page.getByText("E2E Test Goal")).toBeVisible();
    });
  });

  test.describe("Goal Detail Page", () => {
    test.beforeEach(async ({ page }) => {
      // TODO: Add authentication fixture and create test goal
    });

    test.skip("should display goal details", async ({ page }) => {
      // Assuming a test goal exists with known ID
      await page.goto("/goals/test-goal-id");

      // Check for detail elements
      await expect(page.getByText(/progress/i)).toBeVisible();
      await expect(page.getByText(/status/i)).toBeVisible();
    });

    test.skip("should show linked items", async ({ page }) => {
      await page.goto("/goals/test-goal-id");

      // Check for linked items section
      await expect(page.getByRole("tab", { name: /linked items/i })).toBeVisible();
    });

    test.skip("should show progress history", async ({ page }) => {
      await page.goto("/goals/test-goal-id");

      // Click on activity tab
      await page.getByRole("tab", { name: /activity|history/i }).click();

      // Should show history section
      await expect(page.getByText(/progress history|activity/i)).toBeVisible();
    });
  });

  test.describe("Legacy Route Redirects", () => {
    test("should redirect /grants to /goals with type filter", async ({ page }) => {
      await page.goto("/grants");

      // Should redirect to goals with grant filter (or login if not authenticated)
      const url = page.url();
      expect(url).toMatch(/\/(goals\?type=grant|login)/);
    });

    test("should redirect /okrs to /goals with type filter", async ({ page }) => {
      await page.goto("/okrs");

      // Should redirect to goals with okr filter (or login if not authenticated)
      const url = page.url();
      expect(url).toMatch(/\/(goals\?type=okr|login)/);
    });
  });
});

test.describe("Goals API", () => {
  test("should reject unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/goals");

    // Should return 401 unauthorized
    expect(response.status()).toBe(401);
  });

  test("should reject unauthenticated POST to create goal", async ({ request }) => {
    const response = await request.post("/api/goals", {
      data: {
        name: "Test Goal",
        type: "GRANT",
      },
    });

    // Should return 401 unauthorized
    expect(response.status()).toBe(401);
  });
});

test.describe("KPIs API", () => {
  test("should reject unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/kpis");

    // Should return 401 unauthorized
    expect(response.status()).toBe(401);
  });
});
