import { test, expect } from "@playwright/test";

test("dark mode toggle", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /dark mode/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: /light mode/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
