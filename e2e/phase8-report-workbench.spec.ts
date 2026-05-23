import { expect, test } from "@playwright/test";

test("phase 8 page creates a report draft and export preview", async ({ page }) => {
  await page.goto("/phase8");

  await expect(page.getByRole("heading", { name: "Phase 8 Report Export And Creator Workbench" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creator Workbench", exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: "Generate report draft" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Generate report draft" }).click();
  await expect(page.locator(".phase8-result")).toContainText("Report approved", { timeout: 15_000 });
  await expect(page.locator(".phase8-result")).toContainText("single_chart_six_palaces");
  await expect(page.locator(".phase8-result")).toContainText("live_outline");

  await expect(page.getByRole("button", { name: "Preview export" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Preview export" }).click();
  await expect(page.locator(".phase8-preview")).toContainText("preview_only");
  await expect(page.locator(".phase8-preview")).toContainText("/report/report_");

  await page.getByLabel("Report type").selectOption("synastry");
  await expect(page.getByRole("button", { name: "Generate report draft" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Generate report draft" }).click();
  await expect(page.locator(".phase8-result")).toContainText("synastry_card", { timeout: 15_000 });

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
