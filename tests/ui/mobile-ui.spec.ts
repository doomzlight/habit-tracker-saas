import { test, expect, devices } from "@playwright/test";

test.use(devices["iPhone 12"]);

test("mobile navigation works", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav")).toBeVisible();
  await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();
});
