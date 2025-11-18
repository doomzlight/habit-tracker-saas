import { test, expect } from "@playwright/test";

test("auth screen renders", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/login/);
  await expect(page.getByRole("heading", { name: /sign in to habit tracker/i })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});

test("can toggle between sign in and sign up", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/login/);

  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();

  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /sign in to habit tracker/i })).toBeVisible();
});
