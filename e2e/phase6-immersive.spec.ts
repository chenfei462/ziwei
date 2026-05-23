import { expect, test } from "@playwright/test";

test("phase 6 immersive stage and controller complete the paired demo flow", async ({ page }) => {
  await page.goto("/immersive");

  await expect(page.getByRole("heading", { name: "Stage Screen" })).toBeVisible();
  await expect(page.getByTestId("stage-screen-frame")).toBeVisible();
  const sessionId = await page.getByTestId("immersive-session-id").textContent();
  expect(sessionId).toBeTruthy();

  await page.goto(`/immersive/control/${sessionId}`);
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

  await page.goto(`/immersive/ar/${sessionId}`);
  await expect(page.getByRole("heading", { name: "AR Preview" })).toBeVisible();
  await expect(page.getByText(/no video frame/i)).toBeVisible();
});
