import { expect, test } from "@playwright/test";

test("phase 14 page completes mini program and multi-channel distribution flow", async ({ page }) => {
  await page.goto("/internal/phases/phase14");

  await expect(page.getByRole("heading", { name: "Phase 14 Channel Distribution" })).toBeVisible();
  await expect(page.getByText("mini_program_h5_v0.1")).toBeVisible();
  await expect(page.getByText("channel_attribution_v0.1")).toBeVisible();
  await expect(page.getByText("privacy_share_v0.1")).toBeVisible();

  await page.getByRole("button", { name: "Create channel entry" }).click();
  await expect(page.getByText("channel_entry_ready")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Link anonymous visitor" }).click();
  await expect(page.getByText("anonymous_linked")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Create channel share" }).click();
  await expect(page.getByText("mini_program_card")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Record channel event" }).click();
  await expect(page.getByText("channel_event_recorded")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Load channel dashboard" }).click();
  await expect(page.getByText(/total_channel_events:/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/wechat_group: \d+/)).toBeVisible();

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
