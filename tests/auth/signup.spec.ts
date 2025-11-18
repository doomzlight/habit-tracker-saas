import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";

test("new user can sign up", async ({ page }) => {
  const email = `test-${randomUUID()}@example.com`;
  const password = "Test123456!";

  await page.goto("/");
  await page.getByRole("button", { name: /sign up/i }).click();

  await page.getByPlaceholder("First name").fill("Test");
  await page.getByPlaceholder("Last name").fill("User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);

  await page.getByRole("button", { name: /sign up/i }).click();

  await page.waitForURL(/dashboard/);
  await expect(page).toHaveURL(/dashboard/);
});
