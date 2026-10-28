import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("Prisma relational integrity", () => {
  test("declares ownership and transaction relations with delete semantics", () => {
    const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    expect(schema).toMatch(/member\s+User\s+@relation\([^\n]*fields:\s*\[memberId\][^\n]*onDelete:\s*Cascade/);
    expect(schema).toMatch(/birthProfile\s+BirthProfile\s+@relation\([^\n]*fields:\s*\[birthProfileId\][^\n]*onDelete:\s*Cascade/);
    expect(schema).toMatch(/report\s+Report\s+@relation\([^\n]*fields:\s*\[reportId\][^\n]*onDelete:\s*Cascade/);
    expect((schema.match(/@relation\(/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });
});
