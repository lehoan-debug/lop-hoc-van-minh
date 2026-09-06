import { describe, it, expect } from "vitest";
import { calculateDailyScore } from "@/lib/scoring/dailyScore";

describe("calculateDailyScore", () => {
  it("trả về null nếu chưa chấm buổi nào", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: null,
      afternoonCriteriaScore: null,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.judgeScore).toBeNull();
    expect(result.dailyScore).toBeNull();
    expect(result.sessionsGraded).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  it("chỉ chấm buổi sáng: không phạt lớp chưa tới lượt chấm buổi chiều", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 9,
      afternoonCriteriaScore: null,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.judgeScore).toBe(9);
    expect(result.dailyScore).toBe(9);
    expect(result.sessionsGraded).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.maxPossibleJudgeScore).toBe(11);
  });

  it("chế độ SUM: cộng tổng điểm 2 buổi", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 9,
      afternoonCriteriaScore: 11,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.judgeScore).toBe(20);
    expect(result.maxPossibleJudgeScore).toBe(22);
    expect(result.isComplete).toBe(true);
  });

  it("chế độ AVERAGE: lấy trung bình 2 buổi", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 9,
      afternoonCriteriaScore: 11,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "AVERAGE",
    });
    expect(result.judgeScore).toBe(10);
    expect(result.maxPossibleJudgeScore).toBe(11);
  });

  it("cộng điểm thưởng, trừ điểm phạt vào điểm ngày", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 10,
      afternoonCriteriaScore: 10,
      bonusTotal: 2,
      penaltyTotal: 3,
      combineMode: "SUM",
    });
    // judgeScore = 20, dailyScore = 20 + 2 - 3 = 19
    expect(result.judgeScore).toBe(20);
    expect(result.dailyScore).toBe(19);
  });

  it("đạt điểm tối đa khi judgeScore === maxPossibleJudgeScore", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 11,
      afternoonCriteriaScore: 11,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.judgeScore).toBe(result.maxPossibleJudgeScore);
  });
});
