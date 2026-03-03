import { expect, test } from "@playwright/test";

test.describe("staging smoke journeys", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("track page search UI renders", async ({ page }) => {
    await page.goto("/track");
    await expect(page.getByTestId("track-search-input")).toBeVisible();
    await expect(page.getByTestId("track-search-submit")).toBeVisible();
  });

  test("bus tickets page renders", async ({ page }) => {
    await page.goto("/bus-tickets");
    await expect(page.getByTestId("bus-tickets-page")).toBeVisible();
  });

  test("admin callback page renders with auth-enabled staging account", async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_RUN_ADMIN_FLOW !== "true",
      "Set E2E_RUN_ADMIN_FLOW=true to execute admin-protected journey.",
    );
    await page.goto("/super-admin/dashboard/callback-requests");
    await expect(page.getByTestId("callback-requests-page")).toBeVisible();
  });
});
