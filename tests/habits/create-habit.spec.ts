import { test, expect } from "@playwright/test";

test("user can create a habit", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(process.env.PLAYWRIGHT_USER_EMAIL!);
  await page.getByPlaceholder("Password").fill(process.env.PLAYWRIGHT_USER_PASSWORD!);
  await page.getByRole("button", { name: /login/i }).click();

  await page.waitForURL(/dashboard/);

  await page.getByRole("button", { name: /new habit/i }).click();
  await page.getByPlaceholder("Habit name").fill("Drink Water");
  await page.getByRole("button", { name: /save/i }).click();

  await expect(page.getByText("Drink Water")).toBeVisible();
});
