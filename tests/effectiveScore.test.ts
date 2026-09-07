import { describe, it, expect } from "vitest";
import {
  getEffectiveScore,
  getEffectiveMaxScore,
  getEffectiveCriteriaResults,
  isRoundScore,
} from "@/lib/scoring/effectiveScore";
import type { CriterionConfig, ScoreRecord } from "@/types";

function legacyScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    submissionId: "s1",
    timestamp: "",
    date: "2026-09-08",
    session: "MORNING",
    grade: "10",
    classId: "10A1",
    className: "10A1",
    judgeEmail: "j@fpt.edu.vn",
    judgeName: "GK",
    c1: 1,
    c2: 1,
    c3: 0,
    c4: 1,
    c5: 1,
    c6: 1,
    c7: 1,
    c8: 1,
    c9: 1,
    c10: 1,
    c11: 1,
    totalCriteriaScore: 10,
    notesJson: "[]",
    deletedAt: "",
    createdAt: "",
    updatedAt: "",
    roundId: "",
    criteriaSnapshotJson: "[]",
    answersJson: "{}",
    totalScore: null,
    maxPossibleScore: null,
    ...overrides,
  };
}

function criterion(overrides: Partial<CriterionConfig>): CriterionConfig {
  return {
    criterionId: "C1",
    criterionNumber: 1,
    criterionName: "Vệ sinh lớp",
    description: "",
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

describe("getEffectiveScore / getEffectiveMaxScore", () => {
  it("bản ghi V1 (legacy) đọc từ totalCriteriaScore, max = CRITERIA_COUNT (11)", () => {
    const s = legacyScore();
    expect(getEffectiveScore(s)).toBe(10);
    expect(getEffectiveMaxScore(s)).toBe(11);
    expect(isRoundScore(s)).toBe(false);
  });

  it("bản ghi V2 (có roundId) đọc từ totalScore/maxPossibleScore, không phải totalCriteriaScore", () => {
    const s = legacyScore({
      roundId: "round-1",
      totalCriteriaScore: 0, // V2 để trống/0, không được dùng
      totalScore: 8.5,
      maxPossibleScore: 13,
    });
    expect(getEffectiveScore(s)).toBe(8.5);
    expect(getEffectiveMaxScore(s)).toBe(13);
    expect(isRoundScore(s)).toBe(true);
  });
});

describe("getEffectiveCriteriaResults", () => {
  it("V1: khớp c1..c11 với criteria theo criterionNumber", () => {
    const criteria = [
      criterion({ criterionId: "C1", criterionNumber: 1, criterionName: "Vệ sinh" }),
      criterion({ criterionId: "C3", criterionNumber: 3, criterionName: "Dây điện" }),
    ];
    const s = legacyScore({ c1: 1, c3: 0 });
    const results = getEffectiveCriteriaResults(s, criteria);
    const c1 = results.find((r) => r.criterionId === "C1");
    const c3 = results.find((r) => r.criterionId === "C3");
    expect(c1?.result).toBe("PASS");
    expect(c3?.result).toBe("FAIL");
  });

  it("V2: đọc thẳng từ criteriaSnapshotJson, không phụ thuộc Criteria hiện tại", () => {
    const s = legacyScore({
      roundId: "round-1",
      criteriaSnapshotJson: JSON.stringify([
        { criterionId: "X1", name: "Tiêu chí động A", maxScore: 2, result: "PASS", awardedScore: 2 },
        { criterionId: "X2", name: "Tiêu chí động B", maxScore: 0.5, result: "FAIL", awardedScore: 0 },
      ]),
    });
    // Truyền criteria rỗng — V2 không cần tra cứu Criteria hiện tại vì đã có snapshot.
    const results = getEffectiveCriteriaResults(s, []);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ criterionId: "X1", result: "PASS", maxScore: 2, awardedScore: 2 });
    expect(results[1]).toMatchObject({ criterionId: "X2", result: "FAIL", maxScore: 0.5, awardedScore: 0 });
  });
});
