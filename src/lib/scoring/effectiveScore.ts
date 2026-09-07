import {
  CRITERIA_COUNT,
  CRITERION_KEYS,
  type CriterionConfig,
  type CriterionSnapshotItem,
  type ScoreRecord,
} from "@/types";

/**
 * Đọc điểm của MỘT lượt chấm bất kể là bản ghi V1 (legacy, `c1..c11` +
 * `totalCriteriaScore`) hay V2 (theo Đợt chấm, `totalScore`/`maxPossibleScore`
 * tính từ `criteriaSnapshotJson`). Toàn bộ nơi tổng hợp điểm (dailyScore,
 * ranking, dashboard, export) PHẢI dùng 2 hàm này thay vì đọc thẳng
 * `totalCriteriaScore`, để không phải viết 2 nhánh logic riêng cho mỗi loại
 * dữ liệu. Xem docs/V2_UPGRADE_ANALYSIS.md mục 3.3.
 */
export function getEffectiveScore(
  score: Pick<ScoreRecord, "totalScore" | "totalCriteriaScore">,
): number {
  return score.totalScore ?? score.totalCriteriaScore;
}

export function getEffectiveMaxScore(
  score: Pick<ScoreRecord, "maxPossibleScore">,
): number {
  return score.maxPossibleScore ?? CRITERIA_COUNT;
}

/** true nếu bản ghi đến từ luồng chấm V2 (gắn với 1 Đợt chấm). */
export function isRoundScore(score: Pick<ScoreRecord, "roundId">): boolean {
  return !!score.roundId;
}

export interface EffectiveCriterionResult {
  criterionId: string;
  criterionName: string;
  result: "PASS" | "FAIL";
  maxScore: number;
  awardedScore: number;
}

/**
 * Đọc kết quả TỪNG TIÊU CHÍ của một lượt chấm bất kể V1 (legacy, `c1..c11`
 * khớp theo `criterionNumber` trong `criteria`) hay V2 (đọc thẳng từ
 * `criteriaSnapshotJson`, khớp theo `criterionId` — đúng bản chụp tại thời
 * điểm chấm, không phụ thuộc Criteria hiện tại). Dùng hàm này ở MỌI nơi cần
 * gộp thống kê theo tiêu chí (dashboard, criteria-analysis, GVCN) thay vì tự
 * đọc `s.c1..c11` hoặc `s.criteriaSnapshotJson` rải rác.
 */
export function getEffectiveCriteriaResults(
  score: Pick<ScoreRecord, "roundId" | "criteriaSnapshotJson" | "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7" | "c8" | "c9" | "c10" | "c11">,
  criteria: CriterionConfig[],
): EffectiveCriterionResult[] {
  if (score.roundId) {
    let snapshot: CriterionSnapshotItem[] = [];
    try {
      snapshot = JSON.parse(score.criteriaSnapshotJson || "[]");
    } catch {
      snapshot = [];
    }
    return snapshot.map((item) => ({
      criterionId: item.criterionId,
      criterionName: item.name,
      result: item.result,
      maxScore: item.maxScore,
      awardedScore: item.awardedScore,
    }));
  }

  return CRITERION_KEYS.map((key, i) => {
    const number = i + 1;
    const criterion = criteria.find((c) => c.criterionNumber === number);
    const val = score[key];
    return {
      criterionId: criterion?.criterionId ?? key,
      criterionName: criterion?.criterionName ?? `Tiêu chí ${number}`,
      result: val === 1 ? "PASS" : ("FAIL" as const),
      maxScore: 1,
      awardedScore: val === 1 ? 1 : 0,
    };
  });
}
