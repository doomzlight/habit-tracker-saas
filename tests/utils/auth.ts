import { expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";

const DASHBOARD_LOCATORS = [
  () => ({ locator: "text=/Create a habit/i" }),
  () => ({ locator: "text=/Your habits/i" }),
  () => ({ locator: "text=/Mobile Dashboard/i" }),
  () => ({ locator: "text=/Habit Dashboard/i" }),
];

async function ensureDashboard(page: Page, timeout = 30_000) {
  try {
    await page.waitForURL(/dashboard/, { timeout });
  } catch {
    /* ignore - fallback to explicit locators */
  }

  for (const entry of DASHBOARD_LOCATORS) {
    const { locator } = entry();
    try {
      await page.waitForSelector(locator, { timeout: 5_000 });
      return true;
    } catch {
      // keep trying other locators
    }
  }
  return false;
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

async function signUp(page: Page, email: string, password: string) {
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.getByPlaceholder("First name").fill("Test");
  await page.getByPlaceholder("Last name").fill("User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /^sign up$/i }).click();
}

export async function login(page: Page) {
  const envEmail = process.env.PLAYWRIGHT_USER_EMAIL;
  const envPassword = process.env.PLAYWRIGHT_USER_PASSWORD;

  await page.goto("/login");

  if (envEmail && envPassword) {
    await signIn(page, envEmail, envPassword);
    const ok = await ensureDashboard(page);
    if (ok) return { email: envEmail, password: envPassword };
  }

  // Fallback: create a disposable user
  const email = `test-${randomUUID()}@example.com`;
  const password = "Test123456!";
  await signUp(page, email, password);
  await ensureDashboard(page);
  await expect.soft(page).toHaveURL(/dashboard/);
  return { email, password };
}
