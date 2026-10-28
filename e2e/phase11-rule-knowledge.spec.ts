import { expect, test } from "@playwright/test";

test("phase 11 page compares rule profiles and searches the knowledge graph", async ({ page }) => {
  await page.goto("/internal/phases/phase11");

  await expect(page.getByRole("heading", { name: "Phase 11 Rule Profiles And Knowledge Graph" })).toBeVisible();
  await expect(page.locator(".phase11-profile-card").filter({ hasText: "Default Zi Wei v0.1" })).toBeVisible();
  await expect(page.locator(".phase11-profile-card").filter({ hasText: "Experimental Sanhe v0.1" })).toBeVisible();

  await page.getByRole("button", { name: "Compare rule profiles" }).click();
  await expect(page.getByText("leap_month_policy")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".phase11-result").filter({ hasText: "experimental_sanhe_v0_1" }).first()).toBeVisible();

  await page.getByLabel("Knowledge query").fill("Zi Wei 2000-08-16 03:30 Shanghai");
  await page.getByRole("button", { name: "Search knowledge" }).click();
  await expect(page.locator(".phase11-knowledge-list span").filter({ hasText: "star_zi_wei" })).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "Open node star_zi_wei" }).click();
  await expect(page.getByText("appears_in_rule")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("Shanghai")).toHaveCount(0);
});
