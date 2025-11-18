import { test, expect } from "@playwright/test";

test("navbar visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav")).toBeVisible();
});

test("hero section visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
});
