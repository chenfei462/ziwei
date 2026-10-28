import { expect, test } from "@playwright/test";

test("phase 12 page completes daily theme, atlas, check-in, and achievement flow", async ({ page }) => {
  await page.goto("/internal/phases/phase12");

  await expect(page.getByRole("heading", { name: "Phase 12 Daily Stargarden" })).toBeVisible();
  await expect(page.getByText("today_stargarden_v0.1")).toBeVisible();
  await expect(page.locator(".phase12-atlas-list").filter({ hasText: "Zi Wei" })).toBeVisible();

  await page.getByRole("button", { name: "Generate daily theme" }).click();
  await expect(page.getByText("daily_observation_only").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".phase12-daily-card .phase12-kicker").filter({ hasText: "v0.3" })).toBeVisible();

  await page.getByRole("button", { name: "Complete daily quest" }).click();
  await expect(page.getByText("First Daily Check-in")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Open atlas card star_zi_wei" }).click();
  await expect(page.locator(".phase12-node-detail").filter({ hasText: "star_zi_wei" })).toBeVisible({
    timeout: 15_000
  });

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
