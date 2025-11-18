import { test, expect } from "@playwright/test";

test("habits reset daily", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("Not completed")).toBeVisible();
  await expect(page.getByText("Completed today")).not.toBeVisible();
});
