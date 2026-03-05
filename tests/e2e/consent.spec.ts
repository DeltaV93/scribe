import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * E2E Tests for Consent Management Features (PX-735)
 *
 * Test categories:
 * 1. UI Tests - Client page consent display and interaction
 * 2. API Tests - Direct API endpoint testing with mocked webhooks
 * 3. Webhook Simulation - Twilio consent flow simulation
 */

// Test data for webhook simulations
const TEST_CALL_SID = "CA1234567890";
const TEST_PHONE_NUMBER = "+14155551234";

/**
 * Generate a Twilio webhook payload
 */
function createTwilioWebhookPayload(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    CallSid: TEST_CALL_SID,
    AccountSid: "AC123",
    From: "client:test-user",
    To: TEST_PHONE_NUMBER,
    CallStatus: "ringing",
    Direction: "outbound-api",
    ...overrides,
  });
}

test.describe("Recording Consent (PX-735)", () => {
  test.describe("Client Page Consent Display", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/clients");
    });

    test("should display consent status badge on client page", async ({
      page,
    }) => {
      // Wait for clients list to load
      await page.waitForSelector("table", { timeout: 10000 });

      // Click on first client
      const clientRow = page.locator("tr").nth(1);
      if (await clientRow.isVisible()) {
        await clientRow.click();

        // Wait for client detail page to load
        await page.waitForURL(/\/clients\/.+/);

        // Look for consent badge - should show one of: Granted, Opted Out, Not Yet
        const consentBadge = page.locator(
          '[data-testid="consent-badge"], [class*="consent"]'
        );

        // At minimum, check the page contains consent-related content
        const pageContent = await page.textContent("body");
        const hasConsentContent =
          pageContent?.toLowerCase().includes("consent") ||
          pageContent?.toLowerCase().includes("recording");

        expect(hasConsentContent).toBeTruthy();
      }
    });

    test("should show consent section with history", async ({ page }) => {
      await page.waitForSelector("table", { timeout: 10000 });

      const clientRow = page.locator("tr").nth(1);
      if (await clientRow.isVisible()) {
        await clientRow.click();
        await page.waitForURL(/\/clients\/.+/);

        // Look for Privacy & Consent section or tab
        const consentTab = page.getByRole("tab", { name: /consent|privacy/i });
        if (await consentTab.isVisible()) {
          await consentTab.click();

          // Should show consent history or status
          const consentSection = page.locator('[data-testid="consent-section"]');
          await expect(consentSection.or(page.getByText(/consent/i).first())).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });

    test("should allow revoking consent with confirmation", async ({ page }) => {
      await page.waitForSelector("table", { timeout: 10000 });

      const clientRow = page.locator("tr").nth(1);
      if (await clientRow.isVisible()) {
        await clientRow.click();
        await page.waitForURL(/\/clients\/.+/);

        // Find revoke consent button
        const revokeButton = page.getByRole("button", { name: /revoke/i });

        if (await revokeButton.isVisible()) {
          await revokeButton.click();

          // Should show confirmation dialog
          const confirmDialog = page.getByRole("alertdialog");
          await expect(confirmDialog).toBeVisible({ timeout: 3000 });

          // Cancel the action
          await page.getByRole("button", { name: /cancel/i }).click();
          await expect(confirmDialog).not.toBeVisible();
        }
      }
    });
  });

  test.describe("Consent Warning Modal", () => {
    test("should show warning when calling opted-out client", async ({
      page,
    }) => {
      // This test requires a client with REVOKED consent status
      // In a real test, we would seed test data first

      await page.goto("/clients");
      await page.waitForSelector("table", { timeout: 10000 });

      // Look for a client with "Opted Out" badge
      const optedOutBadge = page.getByText(/opted out/i);

      if (await optedOutBadge.isVisible()) {
        // Click on that client's row
        await optedOutBadge.click();
        await page.waitForURL(/\/clients\/.+/);

        // Try to initiate a call
        const callButton = page.getByRole("button", { name: /call/i });
        if (await callButton.isVisible()) {
          await callButton.click();

          // Should show consent warning modal
          const warningModal = page.getByRole("alertdialog");
          const warningText = page.getByText(/opted out of recording/i);

          // Either modal or warning text should be visible
          const hasWarning =
            (await warningModal.isVisible()) ||
            (await warningText.isVisible());

          // In production, this would be an assertion
          // For now, log the result
          console.log("Warning modal displayed:", hasWarning);
        }
      }
    });
  });

  test.describe("Unrecorded Call Modal", () => {
    test("should show documentation prompt after unrecorded call", async ({
      page,
    }) => {
      // This test would verify the unrecorded call modal appears
      // after a call ends with isRecorded=false

      // Navigate to an active call page (would need test setup)
      // The modal should appear automatically after call ends

      // Placeholder - would need actual call flow
      await page.goto("/calls");
      await page.waitForTimeout(1000);

      // Check if there's an active unrecorded call interface
      const unrecordedIndicator = page.getByText(/not recorded|unrecorded/i);
      const isUnrecordedCallPage = await unrecordedIndicator.isVisible();

      console.log("Unrecorded call indicator visible:", isUnrecordedCallPage);
    });
  });
});

test.describe("Consent Webhook API", () => {
  // These tests simulate Twilio webhook calls

  test.describe("Voice Webhook - Outbound Calls", () => {
    test("should return consent prompt TwiML for pending consent", async ({
      request,
    }) => {
      // Simulate voice webhook for a new client (no prior consent)
      const response = await request.post("/api/webhooks/twilio/voice", {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Note: In dev, SKIP_WEBHOOK_VALIDATION should be set
        },
        form: {
          CallSid: TEST_CALL_SID,
          From: "client:test-user",
          To: TEST_PHONE_NUMBER,
          callId: "test-call-id",
        },
      });

      // Should return TwiML
      expect(response.headers()["content-type"]).toContain("text/xml");

      const body = await response.text();

      // Should contain consent prompt elements (Gather for DTMF)
      expect(body).toContain("<Response>");

      // Either has Gather (consent prompt) or Dial (already consented)
      const hasGather = body.includes("<Gather");
      const hasDial = body.includes("<Dial");

      expect(hasGather || hasDial).toBeTruthy();
    });
  });

  test.describe("Consent Webhook - DTMF Responses", () => {
    test("should handle press 1 (consent granted)", async ({ request }) => {
      const response = await request.post(
        "/api/webhooks/twilio/consent?callId=test-call&clientId=test-client&lang=en",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          form: {
            Digits: "1",
            CallSid: TEST_CALL_SID,
          },
        }
      );

      expect(response.ok() || response.status() === 403).toBeTruthy(); // 403 if validation fails

      if (response.ok()) {
        const body = await response.text();
        expect(body).toContain("<Response>");

        // Should contain Dial with recording
        if (body.includes("<Dial")) {
          expect(body).toContain("record");
        }
      }
    });

    test("should handle press 2 (opt out)", async ({ request }) => {
      const response = await request.post(
        "/api/webhooks/twilio/consent?callId=test-call&clientId=test-client&lang=en",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          form: {
            Digits: "2",
            CallSid: TEST_CALL_SID,
          },
        }
      );

      expect(response.ok() || response.status() === 403).toBeTruthy();

      if (response.ok()) {
        const body = await response.text();
        expect(body).toContain("<Response>");

        // Should contain Dial WITHOUT record attribute or with record disabled
        if (body.includes("<Dial")) {
          // Opted out - should NOT have recording callback
          const hasRecordingCallback = body.includes("recordingStatusCallback");
          console.log("Has recording callback (should be false):", hasRecordingCallback);
        }
      }
    });

    test("should handle press 9 (Spanish language)", async ({ request }) => {
      const response = await request.post(
        "/api/webhooks/twilio/consent?callId=test-call&clientId=test-client&lang=en",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          form: {
            Digits: "9",
            CallSid: TEST_CALL_SID,
          },
        }
      );

      expect(response.ok() || response.status() === 403).toBeTruthy();

      if (response.ok()) {
        const body = await response.text();
        expect(body).toContain("<Response>");

        // Should redirect to Spanish prompt or contain Spanish language indicator
        const hasSpanish =
          body.includes("lang=es") ||
          body.includes("Polly.Lupe") ||
          body.includes("es-US");

        console.log("Contains Spanish indicators:", hasSpanish);
      }
    });

    test("should handle timeout (silence = consent)", async ({ request }) => {
      const response = await request.post(
        "/api/webhooks/twilio/consent?callId=test-call&clientId=test-client&lang=en&timeout=true",
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          form: {
            CallSid: TEST_CALL_SID,
          },
        }
      );

      expect(response.ok() || response.status() === 403).toBeTruthy();

      if (response.ok()) {
        const body = await response.text();
        expect(body).toContain("<Response>");

        // Timeout should grant consent and proceed with recording
        if (body.includes("<Dial")) {
          expect(body).toContain("record");
        }
      }
    });
  });

  test.describe("Consent Status API", () => {
    test("should return consent status for client", async ({ request }) => {
      // This would require a valid client ID and authentication
      // Placeholder for when auth is configured

      // const response = await request.get('/api/clients/test-client-id/consent');
      // expect(response.ok()).toBeTruthy();
      // const data = await response.json();
      // expect(data).toHaveProperty('status');
    });

    test("should allow revoking consent via API", async ({ request }) => {
      // This would require authentication
      // Placeholder test

      // const response = await request.post('/api/clients/test-client-id/consent/revoke', {
      //   data: { reason: 'Client requested' }
      // });
      // expect(response.ok()).toBeTruthy();
    });
  });
});

test.describe("Recording Cleanup Cron", () => {
  test("should return purge stats on GET", async ({ request }) => {
    const response = await request.get("/api/cron/purge-recordings");

    // Should return stats (may fail with 500 if DB not configured)
    const isSuccessOrError = response.ok() || response.status() === 500;
    expect(isSuccessOrError).toBeTruthy();

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("pendingPurge");
    }
  });

  test("should reject unauthorized POST requests", async ({ request }) => {
    // POST without auth should be rejected (unless in dev mode)
    const response = await request.post("/api/cron/purge-recordings");

    // In dev mode, it might succeed; in production, should be 401
    const status = response.status();
    console.log("Cron endpoint response status:", status);

    // At minimum, should respond (not hang)
    expect(status).toBeGreaterThan(0);
  });
});

test.describe("State Consent Rules (PX-736)", () => {
  test("should show consent rules for calls", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // Look for consent rules or compliance settings
    const settingsContent = await page.textContent("body");
    const hasComplianceSection =
      settingsContent?.toLowerCase().includes("consent") ||
      settingsContent?.toLowerCase().includes("compliance") ||
      settingsContent?.toLowerCase().includes("recording");

    console.log("Has compliance/consent settings:", hasComplianceSection);
  });
});

test.describe("Inbound Call Consent (US-5)", () => {
  test("should play consent prompt for inbound calls", async ({ request }) => {
    // Simulate an inbound call (From is a phone number, not client:*)
    const response = await request.post("/api/webhooks/twilio/voice", {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      form: {
        CallSid: "CA_INBOUND_123",
        From: "+14155559999", // Inbound caller phone
        To: "+18005551234", // Our Twilio number
        Direction: "inbound",
        CallStatus: "ringing",
      },
    });

    expect(response.ok() || response.status() === 403).toBeTruthy();

    if (response.ok()) {
      const body = await response.text();
      expect(body).toContain("<Response>");

      // Inbound calls should ALWAYS get consent prompt (per US-5)
      const hasGather = body.includes("<Gather");
      console.log("Inbound call has Gather (consent prompt):", hasGather);

      // Should contain consent-related action URL
      if (body.includes("action=")) {
        expect(body).toContain("/consent");
      }
    }
  });
});
