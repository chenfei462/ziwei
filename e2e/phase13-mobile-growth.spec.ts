import { expect, test } from "@playwright/test";

test("phase 13 page completes mobile PWA growth and share landing flow", async ({ page }) => {
  await page.goto("/phase13");

  await expect(page.getByRole("heading", { name: "Phase 13 Mobile Growth" })).toBeVisible();
  await expect(page.getByText("pwa_mobile_v0.1")).toBeVisible();
  await expect(page.getByText("share_landing_v0.1")).toBeVisible();

  await page.getByRole("button", { name: "Load streak" }).click();
  await expect(page.getByText(/current_streak:/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Create share landing" }).click();
  await expect(page.getByText("share_landing_ready")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Record referral" }).click();
  await expect(page.getByText("referral_recorded")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Join 7-day challenge" }).click();
  await expect(page.getByText("challenge_7_day_stargarden")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Challenge check-in" }).click();
  await expect(page.getByText(/progress: [1-7]\/7/)).toBeVisible({ timeout: 15_000 });

  const shareHref = await page.getByRole("link", { name: "Open share landing" }).getAttribute("href");
  expect(shareHref).toMatch(/^\/share\//);
  await page.goto(shareHref ?? "/share/missing");
  await expect(page.getByRole("heading", { name: "Share Landing" })).toBeVisible();
  await expect(page.getByText("daily_observation_only")).toBeVisible();

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
