import { expect, test } from "@playwright/test"

const SESSION_COOKIE_NAME = "better-auth.session_token"
const SESSION_TOKEN = "e2e-test-session-token-fixed"

test.describe("Phase 0 golden path", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: SESSION_TOKEN,
        url: baseURL!,
      },
    ])
  })

  test("book hold, release hold, and view account", async ({ page }) => {
    await page.route("**/api/bookings/*/pay", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            authorizationUrl: null,
            displayText: "E2E checkout stub",
          },
        }),
      })
    })

    await page.goto("/account")
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible()
    await expect(page.getByText("E2E Test Player")).toBeVisible()

    await page.goto("/book")
    await expect(page.getByRole("heading", { name: "Book a session" })).toBeVisible()

    const firstAvailableSlot = page.locator("button.booking-slot-row:not([disabled])").first()
    await expect(firstAvailableSlot).toBeVisible({ timeout: 30_000 })
    await firstAvailableSlot.click()

    await page.getByRole("button", { name: /Continue with \d+ players/ }).click()
    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible()

    await page.getByRole("button", { name: "Pay with Paystack" }).click()
    await expect(page.getByText(/Could not start payment|Payment checkout URL was missing/)).toBeVisible({
      timeout: 15_000,
    })

    await page.goto("/dashboard")
    await expect(page.getByText("Payment needed").or(page.getByText("Unpaid"))).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole("link", { name: /View session/ }).first().click()
    await expect(page.getByTestId("release-booking-hold")).toBeVisible()
    await page.getByTestId("release-booking-hold").click()

    await expect(page.getByText("Cancelled")).toBeVisible({ timeout: 15_000 })
  })
})
