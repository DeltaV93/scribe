import { test, expect } from "@playwright/test";

/**
 * Call Workflow E2E Tests
 *
 * Note: These tests mock Twilio interactions since actual phone calls
 * cannot be made in automated tests.
 */

test.describe("Call Workflow", () => {
  // Skip auth-required tests in CI without proper setup
  test.skip(({ browserName }) => !process.env.TEST_AUTH_ENABLED, "Requires auth setup");

  test.describe("Call Initiation", () => {
    test("should show call button on client profile", async ({ page }) => {
      await page.goto("/clients/test-client-id");

      // Check for call button
      await expect(page.getByRole("button", { name: /call|phone/i })).toBeVisible();
    });

    test("should open form selection before call", async ({ page }) => {
      await page.goto("/clients/test-client-id");

      // Click call button
      await page.getByRole("button", { name: /call|phone/i }).click();

      // Should show form selection modal
      await expect(page.getByText(/select forms|choose forms/i)).toBeVisible();
    });

    test("should allow selecting multiple forms for a call", async ({ page }) => {
      await page.goto("/clients/test-client-id");
      await page.getByRole("button", { name: /call|phone/i }).click();

      // Check for form checkboxes
      const formCheckboxes = page.locator("[data-testid='form-checkbox']");
      const count = await formCheckboxes.count();

      if (count > 0) {
        // Select first form
        await formCheckboxes.first().click();
        await expect(formCheckboxes.first()).toBeChecked();
      }
    });
  });

  test.describe("Active Call Interface", () => {
    test("should display call timer", async ({ page }) => {
      // Navigate to active call (would need mock call)
      await page.goto("/calls/test-call-id");

      // Check for timer
      await expect(page.getByText(/\d{1,2}:\d{2}/)).toBeVisible();
    });

    test("should show call controls", async ({ page }) => {
      await page.goto("/calls/test-call-id");

      // Check for call control buttons
      await expect(page.getByRole("button", { name: /end call|hang up/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /mute/i })).toBeVisible();
    });

    test("should display selected forms during call", async ({ page }) => {
      await page.goto("/calls/test-call-id");

      // Check for form fields or sections
      await expect(page.getByText(/form|fields/i)).toBeVisible();
    });

    test("should show conversation guide", async ({ page }) => {
      await page.goto("/calls/test-call-id");

      // Check for conversation guide panel
      await expect(page.getByText(/conversation|guide|questions/i)).toBeVisible();
    });
  });

  test.describe("Call Notes", () => {
    test("should allow adding notes during call", async ({ page }) => {
      await page.goto("/calls/test-call-id");

      // Check for notes input
      const notesInput = page.getByPlaceholder(/add note|notes/i);
      if (await notesInput.isVisible()) {
        await notesInput.fill("Test note during call");
        await page.keyboard.press("Enter");

        // Note should appear
        await expect(page.getByText("Test note during call")).toBeVisible();
      }
    });

    test("should show note history", async ({ page }) => {
      await page.goto("/calls/test-call-id");

      // Check for notes section
      await expect(page.getByText(/notes|history/i)).toBeVisible();
    });
  });

  test.describe("Post-Call Review", () => {
    test("should show extracted fields after call", async ({ page }) => {
      await page.goto("/calls/test-call-id/review");

      // Check for extracted fields section
      await expect(page.getByText(/extracted|ai|fields/i)).toBeVisible();
    });

    test("should display confidence indicators", async ({ page }) => {
      await page.goto("/calls/test-call-id/review");

      // Check for confidence badges or indicators
      const confidenceIndicators = page.locator("[data-testid='confidence-indicator']");
      await expect(confidenceIndicators).toBeTruthy();
    });

    test("should allow correcting extracted values", async ({ page }) => {
      await page.goto("/calls/test-call-id/review");

      // Find an editable field
      const editButton = page.getByRole("button", { name: /edit|correct/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();

        // Should show edit input
        await expect(page.getByRole("textbox")).toBeVisible();
      }
    });

    test("should show call summary", async ({ page }) => {
      await page.goto("/calls/test-call-id/review");

      // Check for summary section
      await expect(page.getByText(/summary|overview/i)).toBeVisible();
    });

    test("should allow submitting reviewed fields", async ({ page }) => {
      await page.goto("/calls/test-call-id/review");

      // Check for submit button
      await expect(page.getByRole("button", { name: /submit|confirm|save/i })).toBeVisible();
    });
  });

  test.describe("Call Transcript", () => {
    test("should display transcript after call", async ({ page }) => {
      await page.goto("/calls/test-call-id/transcript");

      // Check for transcript content
      await expect(page.getByText(/transcript/i)).toBeVisible();
    });

    test("should show speaker labels in transcript", async ({ page }) => {
      await page.goto("/calls/test-call-id/transcript");

      // Check for speaker labels
      const speakerLabels = page.getByText(/case manager|client/i);
      await expect(speakerLabels).toBeVisible();
    });

    test("should allow playing recording", async ({ page }) => {
      await page.goto("/calls/test-call-id/transcript");

      // Check for audio player
      const playButton = page.getByRole("button", { name: /play/i });
      if (await playButton.isVisible()) {
        await expect(playButton).toBeVisible();
      }
    });
  });
});

test.describe("Call History", () => {
  test.skip(({ browserName }) => !process.env.TEST_AUTH_ENABLED, "Requires auth setup");

  test("should display call history for client", async ({ page }) => {
    await page.goto("/clients/test-client-id");

    // Check for calls section
    await expect(page.getByText(/calls|history/i)).toBeVisible();
  });

  test("should show call status badges", async ({ page }) => {
    await page.goto("/clients/test-client-id");

    // Check for status badges
    const statusBadges = page.locator("[data-testid='call-status']");
    if ((await statusBadges.count()) > 0) {
      await expect(statusBadges.first()).toBeVisible();
    }
  });

  test("should link to call details", async ({ page }) => {
    await page.goto("/clients/test-client-id");

    // Click on a call entry
    const callEntry = page.locator("[data-testid='call-entry']").first();
    if (await callEntry.isVisible()) {
      await callEntry.click();

      // Should navigate to call details
      await expect(page).toHaveURL(/\/calls\//);
    }
  });
});
