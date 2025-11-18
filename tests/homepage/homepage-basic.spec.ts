import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("https://YOUR-URL");
  await expect(page).toHaveTitle(/Habit/i);
});

test("login button visible", async ({ page }) => {
  await page.goto("https://YOUR-URL");
  await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
});

test("navigate to login page", async ({ page }) => {
  await page.goto("https://YOUR-URL");
  await page.getByRole("button", { name: /login/i }).click();
  await expect(page).toHaveURL(/login/);
});

test("footer visible", async ({ page }) => {
  await page.goto("https://YOUR-URL");
  await expect(page.getByText("©")).toBeVisible();
});
