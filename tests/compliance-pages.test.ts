import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("China-market compliance pages", () => {
  test("privacy policy discloses sensitive data, third-party providers, AI labels, and deletion rights", () => {
    const source = readFileSync(resolve("src/app/legal/privacy/page.tsx"), "utf8");

    expect(source).toContain("敏感信息处理");
    expect(source).toContain("第三方服务清单");
    expect(source).toContain("AI 生成内容");
    expect(source).toContain("删除、注销和申诉");
    expect(source).toContain("ICP备案号");
    expect(source).toContain("微信支付、支付宝");
    expect(source).not.toMatch(/测试账号|演示用户|Phase \d/);
  });

  test("terms page states report tiers, quota, refund, prohibited uses, and external qualification gates", () => {
    const source = readFileSync(resolve("src/app/legal/terms/page.tsx"), "utf8");

    expect(source).toContain("免费摘要、标准报告和高级/会员报告");
    expect(source).toContain("互动追问有次数限制");
    expect(source).toContain("退款成功后");
    expect(source).toContain("禁止用途");
    expect(source).toContain("ICP/小程序备案");
    expect(source).not.toMatch(/测试账号|演示用户|Phase \d/);
  });
});
