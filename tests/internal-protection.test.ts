import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("internal route protection", () => {
  test("all internal pages are wrapped by a server-side admin gate and noindex metadata", () => {
    const layoutPath = resolve("src/app/internal/layout.tsx");

    expect(existsSync(layoutPath)).toBe(true);
    const source = readFileSync(layoutPath, "utf8");

    expect(source).toContain("headers");
    expect(source).toContain("PHASE10_ADMIN_TOKEN");
    expect(source).toContain("PHASE10_OPS_MFA_ENABLED");
    expect(source).toContain("PHASE10_OPS_MFA_CODE");
    expect(source).toContain("x-admin-mfa-code");
    expect(source).toContain("noindex");
    expect(source).toContain("children");
    expect(source).not.toMatch(/demo|演示用户|Phase \d/);
  });

  test("public legacy phase routes are not mounted as public route files", () => {
    for (const phase of ["phase7", "phase8", "phase9", "phase10", "phase11", "phase12", "phase13", "phase14", "phase15"]) {
      expect(existsSync(resolve(`src/app/${phase}/page.tsx`)), phase).toBe(false);
    }
  });

  test("formal internal ops entry mounts the audited operations console without public-stage copy", () => {
    const source = readFileSync(resolve("src/app/internal/ops/page.tsx"), "utf8");

    expect(source).toContain("LaunchOpsPanel");
    expect(source).toContain("getOpsOverview");
    expect(source).toContain("admin_audit_logs");
    expect(source).not.toMatch(/demo|Phase \d|prototype|MVP/);
  });
});
