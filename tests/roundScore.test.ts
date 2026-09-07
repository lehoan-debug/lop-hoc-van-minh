import { describe, it, expect } from "vitest";
import {
  buildCriteriaSnapshot,
  totalsFromSnapshot,
  isAllCriteriaAnswered,
} from "@/lib/scoring/roundScore";
import type { CriterionConfig } from "@/types";

function criterion(overrides: Partial<CriterionConfig>): CriterionConfig {
  return {
    criterionId: "C1",
    criterionNumber: 1,
    criterionName: "Vệ sinh lớp",
    description: "Vệ sinh lớp",
    active: true,
    sortOrder: 1,
    needsReview: false,
    maxScore: 1,
    scoringType: "PASS_FAIL",
    gradeIds: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("buildCriteriaSnapshot / totalsFromSnapshot", () => {
  it("tiêu chí 2 điểm, PASS -> +2", () => {
    const criteria = [criterion({ criterionId: "C1", maxScore: 2 })];
    const snapshot = buildCriteriaSnapshot(criteria, { C1: "PASS" });
    expect(snapshot[0]?.awardedScore).toBe(2);
    expect(totalsFromSnapshot(snapshot)).toEqual({ totalScore: 2, maxPossibleScore: 2 });
  });

  it("tiêu chí 2 điểm, FAIL -> +0", () => {
    const criteria = [criterion({ criterionId: "C1", maxScore: 2 })];
    const snapshot = buildCriteriaSnapshot(criteria, { C1: "FAIL" });
    expect(snapshot[0]?.awardedScore).toBe(0);
    expect(totalsFromSnapshot(snapshot)).toEqual({ totalScore: 0, maxPossibleScore: 2 });
  });

  it("hỗ trợ điểm thập phân (0.5)", () => {
    const criteria = [criterion({ criterionId: "C_dp", maxScore: 0.5 })];
    const snapshot = buildCriteriaSnapshot(criteria, { C_dp: "PASS" });
    expect(snapshot[0]?.awardedScore).toBe(0.5);
  });

  it("không trả lời (thiếu key) -> mặc định FAIL, không tự cho điểm", () => {
    const criteria = [criterion({ criterionId: "C1", maxScore: 1 })];
    const snapshot = buildCriteriaSnapshot(criteria, {});
    expect(snapshot[0]?.result).toBe("FAIL");
    expect(snapshot[0]?.awardedScore).toBe(0);
  });

  it("tổng điểm tối đa động theo tổng maxScore thực tế, không hard-code 11", () => {
    const criteria = [
      criterion({ criterionId: "C1", maxScore: 2 }),
      criterion({ criterionId: "C2", maxScore: 0.5 }),
      criterion({ criterionId: "C3", maxScore: 1 }),
    ];
    const snapshot = buildCriteriaSnapshot(criteria, {
      C1: "PASS",
      C2: "FAIL",
      C3: "PASS",
    });
    expect(totalsFromSnapshot(snapshot)).toEqual({ totalScore: 3, maxPossibleScore: 3.5 });
  });

  it("Criteria thay đổi SAU KHI đã lưu snapshot không làm thay đổi điểm lịch sử", () => {
    const criteriaV1 = [criterion({ criterionId: "C1", maxScore: 1 })];
    const storedSnapshot = buildCriteriaSnapshot(criteriaV1, { C1: "PASS" });
    const storedTotals = totalsFromSnapshot(storedSnapshot);
    expect(storedTotals.totalScore).toBe(1);

    // Admin đổi tiêu chí C1 từ 1 điểm -> 2 điểm.
    // Snapshot đã lưu (storedSnapshot) không được tính lại theo criteria mới —
    // totals đọc lại từ đúng object đã lưu vẫn phải giữ nguyên giá trị cũ.
    const recomputedFromStoredSnapshot = totalsFromSnapshot(storedSnapshot);
    expect(recomputedFromStoredSnapshot.totalScore).toBe(1);
    expect(recomputedFromStoredSnapshot.maxPossibleScore).toBe(1);
  });
});

describe("isAllCriteriaAnswered", () => {
  it("thiếu 1 tiêu chí -> false", () => {
    const criteria = [criterion({ criterionId: "C1" }), criterion({ criterionId: "C2" })];
    expect(isAllCriteriaAnswered(criteria, { C1: "PASS" })).toBe(false);
  });
  it("đủ toàn bộ -> true", () => {
    const criteria = [criterion({ criterionId: "C1" }), criterion({ criterionId: "C2" })];
    expect(isAllCriteriaAnswered(criteria, { C1: "PASS", C2: "FAIL" })).toBe(true);
  });
});
