import type { Grade } from "@/types";

export interface ClassDailyResult {
  date: string;
  /** Điểm "Lớp học văn minh" của ngày đó (đã gồm thưởng/trừ), null nếu chưa chấm. */
  dailyScore: number | null;
  /** Điểm chấm BGK của ngày đó (chưa gồm thưởng/trừ), dùng để xác định "đạt điểm tối đa". */
  judgeScore: number | null;
  /** Điểm BGK tối đa có thể đạt trong ngày đó (phụ thuộc số buổi đã chấm + combineMode). */
  maxPossibleJudgeScore: number;
}

export interface ClassMonthlyInput {
  classId: string;
  className: string;
  grade: Grade;
  dailyResults: ClassDailyResult[];
  /** Số LƯỢT ghi nhận điểm thưởng trong tháng (đếm số bản ghi, không phải tổng điểm). */
  bonusCount: number;
  /** Tổng điểm thưởng trong tháng. */
  bonusPointsTotal: number;
  /** Tổng điểm trừ trong tháng (số dương). */
  penaltyTotal: number;
}

export interface ClassRankingResult {
  rank: number;
  classId: string;
  className: string;
  grade: Grade;
  /** Điểm xếp hạng tháng = điểm trung bình các ngày đã chấm trong tháng. null nếu chưa có ngày nào được chấm. */
  averageScore: number | null;
  daysGraded: number;
  bonusPointsTotal: number;
  bonusCount: number;
  penaltyTotal: number;
  /** Số lần đạt điểm tối đa BGK trong tháng — tie-break bước (1). */
  maxScoreDaysCount: number;
  /**
   * true nếu lớp này đồng hạng với (các) lớp khác sau khi đã áp dụng hết
   * 3 bước tie-break tự động — cần Ban Tổ chức xem xét thủ công theo đúng
   * KH mục III.4.a ("Trường hợp vẫn bằng nhau, Ban Tổ chức xem xét kết quả
   * thực hiện xuyên suốt các lần chấm trong tháng để quyết định").
   * Xem BUSINESS_RULES_REVIEW.md mục 5.
   */
  needsManualReview: boolean;
}

const EPS = 1e-9;

function roughlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

/**
 * Xếp hạng các lớp TRONG CÙNG MỘT KHỐI theo đúng quy tắc KH mục III.4.a:
 * 1) Điểm xếp hạng tháng = điểm trung bình các ngày đã chấm trong tháng (desc)
 * Khi bằng điểm, áp dụng lần lượt:
 * 2) Số lần đạt điểm tối đa trong tháng nhiều hơn (desc)
 *    ("mức xếp loại cao hơn" không có căn cứ định nghĩa trong tài liệu nên
 *    chưa triển khai — xem BUSINESS_RULES_REVIEW.md mục 4)
 * 3) Điểm trừ ít hơn (asc)
 * 4) Số lượt ghi nhận hành động tốt nhiều hơn (desc)
 * Nếu vẫn bằng nhau ở bước 4 → needsManualReview = true, KHÔNG tự chọn lớp thắng.
 *
 * Hàm thuần (pure function), không gọi Google Sheets, không chứa logic UI.
 */
export function rankClasses(inputs: ClassMonthlyInput[]): ClassRankingResult[] {
  const enriched = inputs.map((input) => {
    const gradedDays = input.dailyResults.filter(
      (d) => d.dailyScore !== null,
    );
    const averageScore =
      gradedDays.length > 0
        ? gradedDays.reduce((sum, d) => sum + (d.dailyScore as number), 0) /
          gradedDays.length
        : null;
    const maxScoreDaysCount = input.dailyResults.filter(
      (d) =>
        d.judgeScore !== null &&
        d.maxPossibleJudgeScore > 0 &&
        roughlyEqual(d.judgeScore, d.maxPossibleJudgeScore),
    ).length;

    return {
      classId: input.classId,
      className: input.className,
      grade: input.grade,
      averageScore,
      daysGraded: gradedDays.length,
      bonusPointsTotal: input.bonusPointsTotal,
      bonusCount: input.bonusCount,
      penaltyTotal: input.penaltyTotal,
      maxScoreDaysCount,
    };
  });

  const sorted = [...enriched].sort((a, b) => {
    const aScore = a.averageScore ?? -Infinity;
    const bScore = b.averageScore ?? -Infinity;
    if (!roughlyEqual(aScore, bScore)) return bScore - aScore;
    if (a.maxScoreDaysCount !== b.maxScoreDaysCount)
      return b.maxScoreDaysCount - a.maxScoreDaysCount;
    if (a.penaltyTotal !== b.penaltyTotal)
      return a.penaltyTotal - b.penaltyTotal;
    if (a.bonusCount !== b.bonusCount) return b.bonusCount - a.bonusCount;
    return 0;
  });

  const isFullyTied = (
    x: (typeof sorted)[number],
    y: (typeof sorted)[number],
  ) =>
    roughlyEqual(x.averageScore ?? -Infinity, y.averageScore ?? -Infinity) &&
    x.maxScoreDaysCount === y.maxScoreDaysCount &&
    x.penaltyTotal === y.penaltyTotal &&
    x.bonusCount === y.bonusCount;

  const result: ClassRankingResult[] = [];
  let currentRank = 0;
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const prev = i > 0 ? sorted[i - 1] : undefined;
    if (!prev || !isFullyTied(item, prev)) {
      currentRank = i + 1;
    }
    const nextItem = i < sorted.length - 1 ? sorted[i + 1] : undefined;
    const tiedWithPrev = !!prev && item.averageScore !== null && isFullyTied(item, prev);
    const tiedWithNext =
      !!nextItem && item.averageScore !== null && isFullyTied(item, nextItem);

    result.push({
      rank: currentRank,
      classId: item.classId,
      className: item.className,
      grade: item.grade,
      averageScore: item.averageScore,
      daysGraded: item.daysGraded,
      bonusPointsTotal: item.bonusPointsTotal,
      bonusCount: item.bonusCount,
      penaltyTotal: item.penaltyTotal,
      maxScoreDaysCount: item.maxScoreDaysCount,
      needsManualReview: tiedWithPrev || tiedWithNext,
    });
  }

  return result;
}
