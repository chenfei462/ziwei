import { expect, test } from "@playwright/test";

test("internal phase 6 immersive stage and controller complete the paired flow", async ({ page }) => {
  await page.goto("/internal/phases/phase6");

  await expect(page.getByRole("heading", { name: "Stage Screen" })).toBeVisible();
  await expect(page.getByTestId("stage-screen-frame")).toBeVisible();
  const sessionId = await page.getByTestId("immersive-session-id").textContent();
  expect(sessionId).toBeTruthy();

  await page.goto(`/internal/phases/phase6/control/${sessionId}`);
  await expect(page.getByRole("heading", { name: "Mobile Controller" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Select palace" })).toBeEnabled({ timeout: 15_000 });
  await page.getByLabel("Target palace").selectOption("wealth");
  await page.getByRole("button", { name: "Select palace" }).click();
  await expect(page.getByText(/Event sent/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Cycle layer" }).click();
  await expect(page.getByText(/Event sent/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Cycle major period" }).click();
  await expect(page.getByText(/Event sent/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Generate share card" }).click();
  await expect(page.getByText(/Event sent/)).toBeVisible({ timeout: 15_000 });

  await page.goto(`/internal/phases/phase6/ar/${sessionId}`);
  await expect(page.getByRole("heading", { name: "AR Preview" })).toBeVisible();
  await expect(page.getByText(/no video frame/i)).toBeVisible();
});

test("legacy immersive public entry returns the formal 404 and does not expose the internal stage", async ({ page }) => {
  const response = await page.goto("/immersive");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.locator("main a[href='/']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage Screen" })).toHaveCount(0);
});
