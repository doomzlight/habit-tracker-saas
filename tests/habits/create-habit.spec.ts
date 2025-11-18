import { test, expect } from "@playwright/test";
import { login } from "../utils/auth";

test("user can create a habit", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/create a habit/i)).toBeVisible();

  const habitName = `Habit ${Date.now()}`;

  await page.getByPlaceholder("Habit name").fill(habitName);
  await page.getByRole("button", { name: /add habit/i }).click();

  await expect(page.getByRole("heading", { name: habitName })).toBeVisible();
});
