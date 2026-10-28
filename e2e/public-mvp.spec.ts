import { expect, test } from "@playwright/test";

test("public user creates a chart, reads interpretation, and opens a redacted share", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /生成你的星垣观察卡/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /生成我的观察卡/ })).toBeVisible();
  await expect(page.getByText("演示用户")).toHaveCount(0);

  await page.getByRole("link", { name: /生成我的观察卡/ }).first().click();
  await page.getByRole("button", { name: "使用演示资料" }).click();
  await expect(page.getByLabel("显示名称")).not.toHaveValue("");
  await page.getByLabel("显示名称").fill("端到端用户");
  await page.getByRole("combobox", { name: "性别规则" }).selectOption("traditional_unspecified");
  await page.getByRole("button", { name: /生成观察卡/ }).click();

  await expect(page.getByRole("heading", { name: "十二宫结构化观察" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("chart-board")).toBeVisible();
  await expect(page.getByTestId("palace-tile")).toHaveCount(12);
  await expect(page.getByRole("heading", { name: "总览摘要" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 转译过程" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 生成说明" })).toBeVisible();
  await expect(page.getByText("传统术语").first()).toBeVisible();
  await expect(page.getByText("安全过滤").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /星垣挑战/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "十二宫详情" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "规则来源" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "免责声明" })).toBeVisible();

  const chartUrl = page.url();
  await page.getByRole("link", { name: /^生成今日星垣卡$/ }).click();
  await expect(page.getByRole("heading", { name: "今天你的星垣落在哪一宫？" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /生成今日星垣卡/ })).toBeVisible();
  await page.getByRole("button", { name: /生成今日星垣卡/ }).click();
  await expect(page.locator(".phase12-daily-card")).toBeVisible({ timeout: 15_000 });
  await page.goto(chartUrl);

  await page.getByRole("button", { name: /加入 7 日观察/ }).click();
  await expect(page.getByText("0/7")).toBeVisible();
  await page.getByRole("button", { name: /今日打卡/ }).click();
  await expect(page.getByText("1/7", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "打开成就分享卡" })).toBeVisible();
  await page.getByRole("link", { name: "打开成就分享卡" }).click();
  await expect(page.getByText("已隐藏生日")).toBeVisible();
  await expect(page.getByText("已隐藏时间")).toBeVisible();
  await expect(page.getByText("已隐藏地点")).toBeVisible();
  await expect(page.getByText("privacy_redaction_required")).toHaveCount(0);
  await page.goto(chartUrl);
  await expect(page.getByText("1/7", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /今日打卡/ })).toBeDisabled();

  await page.getByRole("button", { name: /解锁标准报告 49 元/ }).click();
  await expect(page.getByRole("link", { name: "前往支付" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "前往支付" }).click();
  await expect(page.getByRole("heading", { name: "支付接入验证" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/order_/)).toBeVisible();
  await page.getByRole("button", { name: "确认沙箱支付" }).click();
  await expect(page.getByText("权益已发放")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "返回支付成功页" }).click();
  await expect(page.getByRole("heading", { name: "支付成功" })).toBeVisible({ timeout: 15_000 });
  await page.goto(chartUrl);

  await page.getByRole("button", { name: /生成脱敏分享/ }).click();
  await expect(page.getByRole("link", { name: "打开分享页" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "打开分享页" }).click();
  await expect(page.getByRole("heading", { name: /今日星垣卡/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "生成我的隐私观察卡" })).toBeVisible();
  await expect(page.getByRole("link", { name: "加入 7 日观察" })).toBeVisible();
  await expect(page.getByText("已隐藏生日")).toBeVisible();
  await expect(page.getByText("已隐藏时间")).toBeVisible();
  await expect(page.getByText("已隐藏地点")).toBeVisible();
  await expect(page.getByText("privacy_redaction_required")).toHaveCount(0);

  await expect(page.getByText("2000-08-16")).toHaveCount(0);
  await expect(page.getByText("03:30")).toHaveCount(0);
  await expect(page.getByText("上海")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".share-card")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
