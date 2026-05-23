import { expect, test } from "@playwright/test";

test("phase 10 page completes launch ops and support refund flow", async ({ page }) => {
  await page.goto("/phase10");

  await expect(page.getByRole("heading", { name: "Phase 10 Production Launch And Ops" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Launch Ops Console" })).toBeVisible();

  await expect(page.locator(".phase10-result").filter({ hasText: /order_/ }).first()).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Support message").fill("Refund request for 2000-08-16 03:30 Shanghai");
  await page.getByRole("button", { name: "Create support ticket" }).click();
  await expect(page.getByText(/ticket_/)).toBeVisible({ timeout: 15_000 });

  await expect(page.getByRole("button", { name: "Mark manual refund" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Mark manual refund" }).click();
  await expect(page.locator(".phase10-result").filter({ hasText: "refunded_manual" }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/privacy_scan 0/)).toBeVisible();
  await expect(page.getByText(/support_resolved/)).toBeVisible();

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
