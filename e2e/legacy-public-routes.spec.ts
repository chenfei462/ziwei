import { expect, test } from "@playwright/test";

test("legacy phase, ops, commercial dashboard, and immersive public entries return the formal 404", async ({ page }) => {
  for (const legacyPath of ["/phase10", "/phase12", "/phase14", "/phase15", "/ops", "/commercial/dashboard", "/immersive"]) {
    const response = await page.goto(legacyPath);

    expect(response?.status(), legacyPath).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText(/Stage Screen|Launch Ops|Sandbox commerce|Phase/i)).toHaveCount(0);
  }
});
