import { expect, test } from "@playwright/test";

test("phase 9 page completes sandbox commerce flow", async ({ page }) => {
  await page.goto("/internal/phases/phase9");

  await expect(page.getByRole("heading", { name: "Phase 9 Payments Orders And Membership" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "订单与权益" })).toBeVisible();

  await expect(page.getByRole("button", { name: "创建订单" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "创建订单" }).click();
  await expect(page.locator(".phase9-result").first()).toContainText("created", { timeout: 15_000 });
  await expect(page.locator(".phase9-result").first()).toContainText("standard_49");

  await expect(page.getByRole("button", { name: "创建结账页" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "创建结账页" }).click();
  await expect(page.locator(".phase9-result").nth(1)).toContainText("stripe_checkout", { timeout: 15_000 });
  await expect(page.locator(".phase9-result").nth(1)).toContainText("sandbox");

  await expect(page.getByRole("button", { name: "模拟沙箱支付" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "模拟沙箱支付" }).click();
  await expect(page.locator(".phase9-result").first()).toContainText("fulfilled", { timeout: 15_000 });
  await expect(page.getByText("权益已发放")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("可查看我的报告")).toBeVisible();

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
