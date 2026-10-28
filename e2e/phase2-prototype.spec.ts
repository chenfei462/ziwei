import { expect, test } from "@playwright/test";

test("phase 2 prototype supports the desktop interaction flow", async ({ page }) => {
  await page.goto("/internal/phases/phase2");

  await expect(page.getByRole("heading", { name: "紫微星垣互动原型" })).toBeVisible();
  await expect(page.getByTestId("chart-board")).toBeVisible();
  await expect(page.getByTestId("palace-tile")).toHaveCount(12);
  await expect(page.getByText("api_chart_ready")).toBeVisible({ timeout: 25_000 });

  const interpretResponse = page.waitForResponse(
    (response) => response.url().includes("/api/interpret") && response.request().method() === "POST" && response.ok(),
    { timeout: 30_000 }
  );
  await page.getByTestId("palace-tile").first().click();
  await interpretResponse;
  await expect(page.locator(".interpretation-block").getByRole("heading", { name: "依据" })).toBeVisible();
  await expect(page.getByRole("button", { name: "专业" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "娱乐" }).click({ force: true });
  await expect(page.getByRole("button", { name: "娱乐" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /查看规则溯源/ }).click({ force: true });
  await expect(page.getByText("phase3_palace_wealth_theme")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /切换星曜层/ }).click();
  await page.getByRole("button", { name: /切换大限/ }).click();
  await page.getByRole("button", { name: /模拟开掌/ }).click();

  await expect(page.getByText("open_palm")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Product Signals" })).toBeVisible();
  await page.getByTestId("palace-tile").first().click();
  await expect(page.getByRole("button", { name: "Generate share card" })).toBeEnabled();
  await page.getByRole("button", { name: "Generate share card" }).click();
  await expect(page.getByText(/Share card created/)).toBeVisible();
  await page.getByRole("button", { name: "Save favorite" }).click();
  await expect(page.getByText(/Favorite saved/)).toBeVisible();
  await page.getByLabel("Report tier").selectOption("standard_49");
  await page.getByLabel("Report interest").selectOption("5");
  await page.getByRole("button", { name: "Submit report intent" }).click();
  await expect(page.getByText(/Report intent recorded/)).toBeVisible();

  await expect(page.getByRole("heading", { name: "封测反馈" })).toBeVisible();
  await page.getByLabel("反馈内容").fill("封测流程完整，愿意继续体验。");
  await page.getByLabel(/我同意提交封测反馈/).check({ force: true });
  await page.getByRole("button", { name: "提交反馈" }).click({ force: true });
  await expect(page.getByText(/反馈已记录/)).toBeVisible();
});
