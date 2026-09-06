import { CRITERIA_COUNT } from "@/types";

export type DailyScoreCombineMode = "SUM" | "AVERAGE";

export interface DailyScoreInput {
  /** Tổng điểm 11 tiêu chí buổi Sáng (0-11), null nếu chưa chấm buổi này. */
  morningCriteriaScore?: number | null;
  /** Tổng điểm 11 tiêu chí buổi Chiều (0-11), null nếu chưa chấm buổi này. */
  afternoonCriteriaScore?: number | null;
  /** Tổng điểm thưởng ghi nhận trong ngày cho lớp. */
  bonusTotal: number;
  /** Tổng điểm trừ ghi nhận trong ngày cho lớp (số dương). */
  penaltyTotal: number;
  /**
   * Cách kết hợp điểm 2 buổi — xem BUSINESS_RULES_REVIEW.md mục 1.
   * Lấy từ Settings.DAILY_SCORE_COMBINE_MODE, KHÔNG hard-code.
   */
  combineMode: DailyScoreCombineMode;
}

export interface DailyScoreResult {
  /** Điểm chấm của BGK trong ngày (đã kết hợp sáng/chiều theo combineMode).
   * null nếu ngày đó chưa có buổi nào được chấm. */
  judgeScore: number | null;
  /** Điểm "Lớp học văn minh" của ngày = judgeScore + thưởng - trừ.
   * null nếu judgeScore null (không phạt lớp chưa tới lượt chấm). */
  dailyScore: number | null;
  /** Số buổi đã có dữ liệu chấm trong ngày (0, 1 hoặc 2). */
  sessionsGraded: 0 | 1 | 2;
  /** true nếu cả 2 buổi Sáng và Chiều đều đã được chấm. */
  isComplete: boolean;
  /** Điểm tối đa BGK có thể đạt được ứng với số buổi đã chấm + combineMode. */
  maxPossibleJudgeScore: number;
}

/**
 * Tính điểm ngày cho MỘT lớp.
 *
 * QUAN TRỌNG: Đây là hàm DUY NHẤT trong toàn hệ thống được phép kết hợp điểm
 * chấm buổi Sáng + Chiều. Không tính điểm ngày trực tiếp trong UI/route khác.
 * Xem BUSINESS_RULES_REVIEW.md mục 1 để biết lý do cần cấu hình combineMode
 * thay vì hard-code cách cộng/trung bình.
 */
export function calculateDailyScore(input: DailyScoreInput): DailyScoreResult {
  const sessionScores = [
    input.morningCriteriaScore,
    input.afternoonCriteriaScore,
  ].filter((s): s is number => s !== null && s !== undefined);

  const sessionsGraded = sessionScores.length as 0 | 1 | 2;

  if (sessionsGraded === 0) {
    return {
      judgeScore: null,
      dailyScore: null,
      sessionsGraded: 0,
      isComplete: false,
      maxPossibleJudgeScore: 0,
    };
  }

  const sum = sessionScores.reduce((a, b) => a + b, 0);
  const judgeScore =
    input.combineMode === "AVERAGE" ? sum / sessionScores.length : sum;

  const dailyScore = judgeScore + input.bonusTotal - input.penaltyTotal;

  const maxPossibleJudgeScore =
    input.combineMode === "AVERAGE"
      ? CRITERIA_COUNT
      : CRITERIA_COUNT * sessionsGraded;

  return {
    judgeScore,
    dailyScore,
    sessionsGraded,
    isComplete: sessionsGraded === 2,
    maxPossibleJudgeScore,
  };
}

/** Điểm tối đa tuyệt đối của 1 ngày chấm đầy đủ 2 buổi, dùng để xác định
 * "số lần đạt điểm tối đa trong tháng" khi xếp hạng. */
export function getFullDayMaxJudgeScore(
  combineMode: DailyScoreCombineMode,
): number {
  return combineMode === "AVERAGE" ? CRITERIA_COUNT : CRITERIA_COUNT * 2;
}
