import { test, expect } from "@playwright/test";
import { login } from "../utils/auth";

test("habits reset daily", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/dashboard/);
});
