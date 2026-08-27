import { expect, test } from "@playwright/test"

const SESSION_COOKIE_NAME = "better-auth.session_token"
const SESSION_TOKEN = "e2e-test-session-token-fixed"

test.describe("VenueEdge /nvr fleet", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: SESSION_TOKEN,
        url: baseURL!,
      },
    ])
  })

  test("fleet page loads with pairing and fleet panels", async ({ page }) => {
    await page.route("**/api/operator/venue-edge/installations*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            installations: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                locationId: "22222222-2222-4222-8222-222222222222",
                edgeDeviceId: "33333333-3333-4333-8333-333333333333",
                installationUid: "uid-demo",
                displayName: "Court A PC",
                platform: "windows",
                architecture: "x64",
                currentAgentVersion: "0.1.0-rc1",
                desiredAgentVersion: null,
                updateChannel: "pilot",
                installedAt: "2026-08-27T12:00:00.000Z",
                lastConfigAppliedAt: null,
                commissionedAt: "2026-08-27T12:05:00.000Z",
                commissioningState: "commissioned",
                deviceStatus: "active",
                connectivity: "online",
                lastHeartbeatAt: "2026-08-27T12:10:00.000Z",
                topology: {
                  nvrCount: 1,
                  cameraCount: 2,
                  enabledCameraCount: 2,
                },
                sourceHealth: {
                  healthy: 2,
                  degraded: 0,
                  unhealthy: 0,
                  disabled: 0,
                  unknown: 0,
                },
                hasManualOverride: false,
                hostSleepRisk: false,
                hostSleepRiskReason: null,
                diskPressure: false,
                replayQueueDepth: 0,
                publishedConfigVersion: 3,
                configApplicationStatus: "applied",
                reauthRequiredCount: 0,
              },
            ],
          },
        }),
      })
    })

    await page.route("**/api/operator/venue-edge/pairing-sessions*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { sessions: [] } }),
        })
        return
      }

      await route.continue()
    })

    await page.goto("/nvr")
    await expect(
      page.getByRole("heading", { name: "VenueEdge management" }),
    ).toBeVisible()
    await expect(page.getByText("VenueEdge fleet")).toBeVisible()
    await expect(page.getByText("Court A PC")).toBeVisible()
    await expect(page.getByRole("link", { name: "Manage" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Create pairing code" })).toBeVisible()
  })
})
