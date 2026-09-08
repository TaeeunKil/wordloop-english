import { test, expect } from "@playwright/test";

test("landing page explains WordLoop", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/WordLoop/);
  await expect(page.getByRole("heading", { name: /WordLoop/ })).toBeVisible();
});
