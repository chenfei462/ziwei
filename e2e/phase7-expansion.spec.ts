import { expect, test } from "@playwright/test";

test("phase 7 page supports synastry and timeline expansion flows", async ({ page }) => {
  await page.goto("/phase7");

  await expect(page.getByRole("heading", { name: "阶段 7 合盘与流年扩展" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "合盘对照" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "年度主题" })).toBeVisible();

  await page.getByLabel(/我确认双方资料仅用于合盘演示/).check();
  await expect(page.getByRole("button", { name: "Create synastry" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "Create synastry" }).click();
  await expect(page.getByText(/沟通风格/)).toBeVisible();
  await expect(page.getByText(/合盘分享/)).toBeVisible();
  await page.getByRole("button", { name: /查看合盘规则溯源/ }).click();
  await expect(page.getByText("phase7_synastry_life_spouse_bridge")).toBeVisible();

  await page.getByLabel("Year").fill("2027");
  await page.getByLabel("Month").selectOption("5");
  await page.getByRole("button", { name: "Generate annual theme" }).click();
  await expect(page.getByText(/2027 年度主题/)).toBeVisible();
  await expect(page.getByText("5 月观察：官禄宫")).toBeVisible();
  await expect(page.getByText("2027 年 5 月年度主题卡")).toBeVisible();
  await expect(page.getByText(/full birth date/i).first()).toBeVisible();
});
