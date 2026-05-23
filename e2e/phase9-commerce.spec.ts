import { expect, test } from "@playwright/test";

test("phase 9 page completes sandbox commerce flow", async ({ page }) => {
  await page.goto("/phase9");

  await expect(page.getByRole("heading", { name: "Phase 9 Payments Orders And Membership" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Commerce MVP" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Create order" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.locator(".phase9-result").first()).toContainText("draft", { timeout: 15_000 });
  await expect(page.locator(".phase9-result").first()).toContainText("standard_49");

  await expect(page.getByRole("button", { name: "Create checkout session" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Create checkout session" }).click();
  await expect(page.locator(".phase9-result").nth(1)).toContainText("stripe_checkout", { timeout: 15_000 });
  await expect(page.locator(".phase9-result").nth(1)).toContainText("sandbox");

  await expect(page.getByRole("button", { name: "Simulate sandbox payment" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Simulate sandbox payment" }).click();
  await expect(page.locator(".phase9-result").first()).toContainText("fulfilled", { timeout: 15_000 });
  await expect(page.getByText("Access granted")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("My reports")).toBeVisible();

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
