import { test, expect } from "@playwright/test";
import { login } from "../utils/auth";

test("dashboard loads", async ({ page }) => {
  await login(page);
  await expect(page.getByText(/create a habit/i)).toBeVisible();
});
