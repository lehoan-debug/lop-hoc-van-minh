import { describe, it, expect } from "vitest";
import { calculateDailyScore } from "@/lib/scoring/dailyScore";

describe("calculateDailyScore", () => {
  it("trả về null nếu chưa chấm buổi nào (bất kể combineMode)", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: null,
      afternoonCriteriaScore: null,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.sumScore).toBeNull();
    expect(result.averageScore).toBeNull();
    expect(result.officialJudgeScore).toBeNull();
    expect(result.officialDailyScore).toBeNull();
    expect(result.sessionsGraded).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  describe('combineMode = "UNCONFIRMED" (BTC chưa xác nhận công thức)', () => {
    it("vẫn tính sumScore/averageScore tham khảo dù đã chấm đủ 2 buổi", () => {
      const result = calculateDailyScore({
        morningCriteriaScore: 9,
        afternoonCriteriaScore: 11,
        bonusTotal: 0,
        penaltyTotal: 0,
        combineMode: "UNCONFIRMED",
      });
      expect(result.sumScore).toBe(20);
      expect(result.averageScore).toBe(10);
      expect(result.morningCriteriaScore).toBe(9);
      expect(result.afternoonCriteriaScore).toBe(11);
    });

    it("KHÔNG tạo điểm chính thức nào (officialJudgeScore/officialDailyScore = null)", () => {
      const result = calculateDailyScore({
        morningCriteriaScore: 9,
        afternoonCriteriaScore: 11,
        bonusTotal: 2,
        penaltyTotal: 1,
        combineMode: "UNCONFIRMED",
      });
      expect(result.officialJudgeScore).toBeNull();
      expect(result.officialDailyScore).toBeNull();
      expect(result.maxPossibleOfficialScore).toBe(0);
    });
  });

  it("chỉ chấm buổi sáng: không phạt lớp chưa tới lượt chấm buổi chiều", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 9,
      afternoonCriteriaScore: null,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.officialJudgeScore).toBe(9);
    expect(result.officialDailyScore).toBe(9);
    expect(result.sessionsGraded).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.maxPossibleOfficialScore).toBe(11);
  });

  it("chế độ SUM: cộng tổng điểm 2 buổi", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 9,
      afternoonCriteriaScore: 11,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.officialJudgeScore).toBe(20);
    expect(result.maxPossibleOfficialScore).toBe(22);
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
    expect(result.officialJudgeScore).toBe(10);
    expect(result.maxPossibleOfficialScore).toBe(11);
  });

  it("cộng điểm thưởng, trừ điểm phạt vào điểm ngày chính thức", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 10,
      afternoonCriteriaScore: 10,
      bonusTotal: 2,
      penaltyTotal: 3,
      combineMode: "SUM",
    });
    // officialJudgeScore = 20, officialDailyScore = 20 + 2 - 3 = 19
    expect(result.officialJudgeScore).toBe(20);
    expect(result.officialDailyScore).toBe(19);
  });

  it("đạt điểm tối đa khi officialJudgeScore === maxPossibleOfficialScore", () => {
    const result = calculateDailyScore({
      morningCriteriaScore: 11,
      afternoonCriteriaScore: 11,
      bonusTotal: 0,
      penaltyTotal: 0,
      combineMode: "SUM",
    });
    expect(result.officialJudgeScore).toBe(result.maxPossibleOfficialScore);
  });
});
