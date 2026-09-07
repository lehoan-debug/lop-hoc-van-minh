import { CRITERIA_COUNT } from "@/types";
import type { DailyScoreCombineModeSetting } from "@/types";

export type DailyScoreCombineMode = DailyScoreCombineModeSetting;

export interface DailyScoreInput {
  /** Tổng điểm tiêu chí buổi Sáng, null nếu chưa chấm buổi này. */
  morningCriteriaScore?: number | null;
  /** Điểm tối đa có thể đạt của buổi Sáng (V2: tổng maxScore tiêu chí thực tế
   * trong snapshot; bỏ trống -> mặc định CRITERIA_COUNT, đúng hành vi V1). */
  morningMaxScore?: number | null;
  /** Tổng điểm tiêu chí buổi Chiều, null nếu chưa chấm buổi này. */
  afternoonCriteriaScore?: number | null;
  /** Điểm tối đa có thể đạt của buổi Chiều — tương tự morningMaxScore. */
  afternoonMaxScore?: number | null;
  /** Tổng điểm thưởng ghi nhận trong ngày cho lớp. */
  bonusTotal: number;
  /** Tổng điểm trừ ghi nhận trong ngày cho lớp (số dương). */
  penaltyTotal: number;
  /**
   * Cách kết hợp điểm 2 buổi, lấy từ Settings.DAILY_SCORE_COMBINE_MODE —
   * KHÔNG hard-code. "UNCONFIRMED" nghĩa là BTC chưa xác nhận công thức.
   * Xem BUSINESS_RULES_REVIEW.md mục 1.
   */
  combineMode: DailyScoreCombineMode;
}

export interface DailyScoreResult {
  morningCriteriaScore: number | null;
  afternoonCriteriaScore: number | null;
  /** Số buổi đã có dữ liệu chấm trong ngày (0, 1 hoặc 2). */
  sessionsGraded: 0 | 1 | 2;
  /** true nếu cả 2 buổi Sáng và Chiều đều đã được chấm. */
  isComplete: boolean;
  /**
   * Tổng điểm 2 buổi (tham khảo) — LUÔN được tính bất kể combineMode, để
   * Admin có số liệu tham khảo ngay cả khi công thức chính thức chưa được
   * xác nhận. null nếu chưa buổi nào được chấm.
   */
  sumScore: number | null;
  /** Trung bình điểm 2 buổi (tham khảo) — tương tự sumScore. */
  averageScore: number | null;
  /**
   * Điểm chấm BGK "CHÍNH THỨC" của ngày theo combineMode đã cấu hình.
   * `null` khi combineMode = "UNCONFIRMED" (BTC chưa xác nhận công thức) hoặc
   * khi chưa có buổi nào được chấm — đây là giá trị DUY NHẤT được phép dùng
   * để tính điểm ngày/xếp hạng chính thức, không dùng sumScore/averageScore
   * trực tiếp cho mục đích đó.
   */
  officialJudgeScore: number | null;
  /** Điểm "Lớp học văn minh" CHÍNH THỨC của ngày = officialJudgeScore + thưởng
   * - trừ. `null` nếu officialJudgeScore là null. */
  officialDailyScore: number | null;
  /** Điểm BGK tối đa có thể đạt ứng với officialJudgeScore. 0 nếu combineMode
   * = "UNCONFIRMED" hoặc chưa có buổi nào được chấm. Động theo tổng maxScore
   * tiêu chí thực tế của (các) buổi đã chấm (V2), không hard-code 11. */
  maxPossibleOfficialScore: number;
}

/**
 * Tính điểm ngày cho MỘT lớp.
 *
 * QUAN TRỌNG: Đây là hàm DUY NHẤT trong toàn hệ thống được phép kết hợp điểm
 * chấm buổi Sáng + Chiều thành điểm chính thức. Khi combineMode chưa được
 * BTC xác nhận ("UNCONFIRMED"), hàm vẫn trả về đầy đủ số liệu tham khảo
 * (sumScore, averageScore) nhưng KHÔNG trả về điểm chính thức nào — tránh để
 * một công thức chưa xác nhận bị dùng ngầm cho xếp hạng thật.
 * Xem BUSINESS_RULES_REVIEW.md mục 1.
 */
export function calculateDailyScore(input: DailyScoreInput): DailyScoreResult {
  const morning = input.morningCriteriaScore ?? null;
  const afternoon = input.afternoonCriteriaScore ?? null;
  // V1 không truyền max theo buổi -> mặc định CRITERIA_COUNT (11), giữ đúng
  // hành vi cũ. V2 luôn truyền max thực tế (tổng maxScore tiêu chí áp dụng).
  const morningMax = morning !== null ? (input.morningMaxScore ?? CRITERIA_COUNT) : null;
  const afternoonMax = afternoon !== null ? (input.afternoonMaxScore ?? CRITERIA_COUNT) : null;

  const sessionScores = [morning, afternoon].filter(
    (s): s is number => s !== null,
  );
  const sessionMaxes = [morningMax, afternoonMax].filter(
    (s): s is number => s !== null,
  );
  const sessionsGraded = sessionScores.length as 0 | 1 | 2;

  const sumScore =
    sessionsGraded > 0 ? sessionScores.reduce((a, b) => a + b, 0) : null;
  const averageScore =
    sessionsGraded > 0 ? (sumScore as number) / sessionsGraded : null;
  const sumMax = sessionMaxes.length > 0 ? sessionMaxes.reduce((a, b) => a + b, 0) : 0;
  const averageMax = sessionMaxes.length > 0 ? sumMax / sessionMaxes.length : 0;

  let officialJudgeScore: number | null = null;
  let maxPossibleOfficialScore = 0;

  if (sessionsGraded > 0) {
    if (input.combineMode === "SUM") {
      officialJudgeScore = sumScore;
      maxPossibleOfficialScore = sumMax;
    } else if (input.combineMode === "AVERAGE") {
      officialJudgeScore = averageScore;
      maxPossibleOfficialScore = averageMax;
    }
    // combineMode === "UNCONFIRMED" -> giữ nguyên null/0, không tạo điểm chính thức.
  }

  const officialDailyScore =
    officialJudgeScore !== null
      ? officialJudgeScore + input.bonusTotal - input.penaltyTotal
      : null;

  return {
    morningCriteriaScore: morning,
    afternoonCriteriaScore: afternoon,
    sessionsGraded,
    isComplete: sessionsGraded === 2,
    sumScore,
    averageScore,
    officialJudgeScore,
    officialDailyScore,
    maxPossibleOfficialScore,
  };
}
