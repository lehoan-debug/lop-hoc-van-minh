import { describe, it, expect } from "vitest";
import { computeRoundClassProgress, computeDailyTrend } from "@/lib/admin/aggregate";
import type { ClassConfig, ScoreRecord } from "@/types";

function klass(overrides: Partial<ClassConfig>): ClassConfig {
  return {
    classId: "10A1",
    className: "10A1",
    grade: "10",
    active: true,
    sortOrder: 1,
    ...overrides,
  };
}

function score(overrides: Partial<ScoreRecord>): ScoreRecord {
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
    c3: 1,
    c4: 1,
    c5: 1,
    c6: 1,
    c7: 1,
    c8: 1,
    c9: 1,
    c10: 1,
    c11: 1,
    totalCriteriaScore: 11,
    notesJson: "[]",
    deletedAt: "",
    createdAt: "",
    updatedAt: "",
    roundId: "round-1",
    criteriaSnapshotJson: "[]",
    answersJson: "{}",
    totalScore: 8,
    maxPossibleScore: 11,
    generalNote: "",
    ...overrides,
  };
}

describe("computeRoundClassProgress", () => {
  it("lớp có điểm -> tính là đã chấm, lớp không có -> chưa chấm", () => {
    const classes = [
      klass({ classId: "10A1", className: "10A1" }),
      klass({ classId: "10A2", className: "10A2" }),
      klass({ classId: "10A3", className: "10A3" }),
    ];
    const scores = [score({ classId: "10A1" })];
    const result = computeRoundClassProgress(classes, scores);
    expect(result.doneCount).toBe(1);
    expect(result.totalCount).toBe(3);
    expect(result.notDoneClasses.map((c) => c.classId).sort()).toEqual(["10A2", "10A3"]);
  });

  it("không có lớp nào trong phạm vi -> 0/0, không lỗi", () => {
    const result = computeRoundClassProgress([], []);
    expect(result).toEqual({ doneCount: 0, totalCount: 0, notDoneClasses: [] });
  });

  it("mọi lớp đều đã chấm -> notDoneClasses rỗng", () => {
    const classes = [klass({ classId: "10A1" }), klass({ classId: "10A2" })];
    const scores = [score({ classId: "10A1" }), score({ classId: "10A2" })];
    const result = computeRoundClassProgress(classes, scores);
    expect(result.doneCount).toBe(2);
    expect(result.notDoneClasses).toEqual([]);
  });
});

describe("computeDailyTrend", () => {
  it("gộp đúng số lượt chấm + điểm TB theo từng ngày, ngày không có điểm -> 0 lượt/null", () => {
    const dates = ["2026-09-07", "2026-09-08", "2026-09-09"];
    const scores = [
      score({ classId: "10A1", date: "2026-09-08", totalScore: 8 }),
      score({ classId: "10A2", date: "2026-09-08", totalScore: 10 }),
      score({ classId: "10A1", date: "2026-09-09", totalScore: 6 }),
    ];
    const result = computeDailyTrend({ dates, scoresInRange: scores });
    expect(result).toEqual([
      { date: "2026-09-07", totalSubmissions: 0, averageScore: null },
      { date: "2026-09-08", totalSubmissions: 2, averageScore: 9 },
      { date: "2026-09-09", totalSubmissions: 1, averageScore: 6 },
    ]);
  });

  it("mảng dates rỗng -> mảng kết quả rỗng", () => {
    expect(computeDailyTrend({ dates: [], scoresInRange: [score({})] })).toEqual([]);
  });
});
