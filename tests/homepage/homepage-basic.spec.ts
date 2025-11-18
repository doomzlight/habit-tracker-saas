import { test, expect, type Page } from "@playwright/test";

const expectLoginPage = async (page: Page) => {
  await page.goto("/");
  await page.waitForURL(/login/);
  await expect(page.getByRole("heading", { name: /sign in to habit tracker/i })).toBeVisible();
};

test("homepage redirects to login when logged out", async ({ page }) => {
  await expectLoginPage(page);
});

test("login button visible", async ({ page }) => {
  await expectLoginPage(page);
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

test("navigate to login page", async ({ page }) => {
  await expectLoginPage(page);
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /sign in to habit tracker/i })).toBeVisible();
});

test("auth toggle visible", async ({ page }) => {
  await expectLoginPage(page);
  await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
});
