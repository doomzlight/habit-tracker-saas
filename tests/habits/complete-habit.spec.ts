import { test, expect } from "@playwright/test";
import { login } from "../utils/auth";

test("user can complete a habit", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/create a habit/i)).toBeVisible();

  const habitName = `Habit ${Date.now()}`;

  await page.getByPlaceholder("Habit name").fill(habitName);
  await page.getByRole("button", { name: /add habit/i }).click();

  const card = page.locator("div", { has: page.getByRole("heading", { name: habitName }) });

  await card.getByRole("button", { name: /mark done/i }).click();
  await expect(card.getByRole("button", { name: /undo today/i })).toBeVisible();
});
