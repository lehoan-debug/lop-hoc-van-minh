import { describe, it, expect } from "vitest";
import { rankClasses, type ClassMonthlyInput } from "@/lib/ranking/rankClasses";

function makeClass(
  classId: string,
  overrides: Partial<ClassMonthlyInput> = {},
): ClassMonthlyInput {
  return {
    classId,
    className: classId,
    grade: "10",
    dailyResults: [],
    bonusCount: 0,
    bonusPointsTotal: 0,
    penaltyTotal: 0,
    ...overrides,
  };
}

describe("rankClasses", () => {
  it("xếp hạng theo điểm trung bình giảm dần", () => {
    const inputs: ClassMonthlyInput[] = [
      makeClass("A", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 8, judgeScore: 8, maxPossibleJudgeScore: 11 }],
      }),
      makeClass("B", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 10, judgeScore: 10, maxPossibleJudgeScore: 11 }],
      }),
    ];
    const result = rankClasses(inputs);
    expect(result[0]?.classId).toBe("B");
    expect(result[0]?.rank).toBe(1);
    expect(result[1]?.classId).toBe("A");
    expect(result[1]?.rank).toBe(2);
  });

  it("tie-break bước 1: số lần đạt điểm tối đa nhiều hơn thắng khi bằng điểm TB", () => {
    const inputs: ClassMonthlyInput[] = [
      makeClass("A", {
        dailyResults: [
          { date: "2026-09-01", dailyScore: 10, judgeScore: 10, maxPossibleJudgeScore: 11 },
          { date: "2026-09-02", dailyScore: 10, judgeScore: 10, maxPossibleJudgeScore: 11 },
        ],
      }),
      makeClass("B", {
        dailyResults: [
          { date: "2026-09-01", dailyScore: 11, judgeScore: 11, maxPossibleJudgeScore: 11 },
          { date: "2026-09-02", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 },
        ],
      }),
    ];
    // Cả 2 lớp đều có điểm TB = 10, nhưng B đạt điểm tối đa 1 lần, A không lần nào.
    const result = rankClasses(inputs);
    expect(result[0]?.classId).toBe("B");
    expect(result[0]?.rank).toBe(1);
    expect(result[1]?.classId).toBe("A");
  });

  it("tie-break bước 2: điểm trừ ít hơn thắng khi bằng điểm TB và số lần đạt tối đa", () => {
    const inputs: ClassMonthlyInput[] = [
      makeClass("A", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
        penaltyTotal: 3,
      }),
      makeClass("B", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
        penaltyTotal: 1,
      }),
    ];
    const result = rankClasses(inputs);
    expect(result[0]?.classId).toBe("B");
  });

  it("tie-break bước 3: số lượt ghi nhận hành động tốt nhiều hơn thắng", () => {
    const inputs: ClassMonthlyInput[] = [
      makeClass("A", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
        bonusCount: 1,
      }),
      makeClass("B", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
        bonusCount: 3,
      }),
    ];
    const result = rankClasses(inputs);
    expect(result[0]?.classId).toBe("B");
  });

  it("đồng hạng hoàn toàn sau cả 3 bước tie-break -> needsManualReview = true", () => {
    const inputs: ClassMonthlyInput[] = [
      makeClass("A", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
      }),
      makeClass("B", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
      }),
    ];
    const result = rankClasses(inputs);
    expect(result[0]?.needsManualReview).toBe(true);
    expect(result[1]?.needsManualReview).toBe(true);
    expect(result[0]?.rank).toBe(result[1]?.rank);
  });

  it("lớp chưa có ngày nào được chấm bị xếp cuối, không gây lỗi", () => {
    const inputs: ClassMonthlyInput[] = [
      makeClass("A", {
        dailyResults: [{ date: "2026-09-01", dailyScore: 9, judgeScore: 9, maxPossibleJudgeScore: 11 }],
      }),
      makeClass("B", { dailyResults: [] }),
    ];
    const result = rankClasses(inputs);
    expect(result[0]?.classId).toBe("A");
    expect(result[1]?.classId).toBe("B");
    expect(result[1]?.averageScore).toBeNull();
  });
});
