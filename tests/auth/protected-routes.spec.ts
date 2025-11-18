import { test, expect } from "@playwright/test";

test("redirects unauthenticated users from dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
});
