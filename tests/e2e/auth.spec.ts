import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the home page before each test
    await page.goto("/");
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Try to access a protected route
    await page.goto("/forms");

    // Should redirect to login or show auth page
    await expect(page).toHaveURL(/\/(login|auth)/);
  });

  test("should show login form", async ({ page }) => {
    await page.goto("/login");

    // Check for login form elements
    await expect(page.getByRole("heading", { name: /sign in|log in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should show an error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
  });

  test("should have link to sign up", async ({ page }) => {
    await page.goto("/login");

    // Check for sign up link
    const signUpLink = page.getByRole("link", { name: /sign up|create account|register/i });
    await expect(signUpLink).toBeVisible();
  });
});

test.describe("Protected Routes", () => {
  test("should require auth for forms page", async ({ page }) => {
    await page.goto("/forms");
    await expect(page).not.toHaveURL("/forms");
  });

  test("should require auth for clients page", async ({ page }) => {
    await page.goto("/clients");
    await expect(page).not.toHaveURL("/clients");
  });

  test("should require auth for templates page", async ({ page }) => {
    await page.goto("/templates");
    await expect(page).not.toHaveURL("/templates");
  });
});
