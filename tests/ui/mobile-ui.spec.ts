import { test, expect, devices } from "@playwright/test";

test.use(devices["iPhone 12"]);

test("mobile navigation works", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/login/);
  await expect(page.getByRole("heading", { name: /sign in to habit tracker/i })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
});
