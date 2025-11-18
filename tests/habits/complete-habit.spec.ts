import { test, expect } from "@playwright/test";

test("user can complete a habit", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(process.env.PLAYWRIGHT_USER_EMAIL!);
  await page.getByPlaceholder("Password").fill(process.env.PLAYWRIGHT_USER_PASSWORD!);
  await page.getByRole("button", { name: /login/i }).click();

  await page.waitForURL(/dashboard/);

  await page.getByText("Drink Water").click(); 
  await expect(page.getByText("Completed")).toBeVisible();
});
