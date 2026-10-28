import { expect, test } from "@playwright/test";

test("phase 15 page completes formal mini program review and launch flow", async ({ page }) => {
  await page.goto("/internal/phases/phase15");

  await expect(page.getByRole("heading", { name: "Phase 15 Mini Program Review" })).toBeVisible();
  await expect(page.getByText("native_shell_v0.1")).toBeVisible();
  await expect(page.getByText("openid_binding_v0.1")).toBeVisible();
  await expect(page.getByText("review_gate_v0.1")).toBeVisible();

  await page.getByRole("button", { name: "Login mini program" }).click();
  await expect(page.getByText("mini_program_session_ready")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Link WeChat member" }).click();
  await expect(page.getByText("openid_bound")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Create mini share" }).click();
  await expect(page.getByText("wechat_mini_card")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Authorize reminder" }).click();
  await expect(page.getByText("subscribe_authorized")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Record reminder event" }).click();
  await expect(page.getByText("reminder_event_recorded")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Load release gate" }).click();
  await expect(page.getByText("review_status: materials_ready")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("fallback_to_h5: true")).toBeVisible();

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
  await expect(page.getByText("wx_code_phase15_demo")).toHaveCount(0);
});
