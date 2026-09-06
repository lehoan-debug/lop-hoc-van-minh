import { describe, it, expect } from "vitest";
import { submitScoreSchema, binaryScoreSchema } from "@/lib/validation/schemas";
import { computeTotalCriteriaScore } from "@/lib/scoring/validation";

describe("binaryScoreSchema", () => {
  it("chấp nhận 0 và 1", () => {
    expect(binaryScoreSchema.safeParse(0).success).toBe(true);
    expect(binaryScoreSchema.safeParse(1).success).toBe(true);
  });

  it("từ chối mọi giá trị khác 0/1", () => {
    expect(binaryScoreSchema.safeParse(2).success).toBe(false);
    expect(binaryScoreSchema.safeParse(-1).success).toBe(false);
    expect(binaryScoreSchema.safeParse(0.5).success).toBe(false);
    expect(binaryScoreSchema.safeParse("1").success).toBe(false);
  });
});

const baseValidPayload = {
  date: "2026-09-06",
  session: "MORNING" as const,
  grade: "10" as const,
  classId: "10A1",
  c1: 1,
  c2: 1,
  c3: 1,
  c4: 1,
  c5: 1,
  c6: 1,
  c7: 1,
  c8: 1,
  c9: 1,
  c10: 1,
  c11: 0,
  notes: [],
};

describe("submitScoreSchema", () => {
  it("chấp nhận payload đầy đủ 11 tiêu chí hợp lệ", () => {
    expect(submitScoreSchema.safeParse(baseValidPayload).success).toBe(true);
  });

  it("từ chối khi thiếu 1 trong 11 tiêu chí", () => {
    const { c11, ...missing } = baseValidPayload;
    void c11;
    expect(submitScoreSchema.safeParse(missing).success).toBe(false);
  });

  it("từ chối khi ngày sai định dạng", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseValidPayload, date: "06/09/2026" }).success,
    ).toBe(false);
  });

  it("từ chối session không hợp lệ", () => {
    expect(
      submitScoreSchema.safeParse({ ...baseValidPayload, session: "NOON" }).success,
    ).toBe(false);
  });
});

describe("computeTotalCriteriaScore", () => {
  it("tính đúng tổng 11 tiêu chí", () => {
    const total = computeTotalCriteriaScore({
      c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 1, c7: 1, c8: 1, c9: 1, c10: 1, c11: 0,
    });
    expect(total).toBe(10);
  });

  it("tổng bằng 0 khi tất cả không đạt", () => {
    const total = computeTotalCriteriaScore({
      c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0, c7: 0, c8: 0, c9: 0, c10: 0, c11: 0,
    });
    expect(total).toBe(0);
  });

  it("tổng bằng 11 khi tất cả đạt", () => {
    const total = computeTotalCriteriaScore({
      c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 1, c7: 1, c8: 1, c9: 1, c10: 1, c11: 1,
    });
    expect(total).toBe(11);
  });
});
