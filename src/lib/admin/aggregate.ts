import type {
  AdjustmentRecord,
  ClassConfig,
  CriterionConfig,
  Grade,
  ScoreRecord,
} from "@/types";
import {
  calculateDailyScore,
  type DailyScoreCombineMode,
} from "@/lib/scoring/dailyScore";
import {
  getEffectiveScore,
  getEffectiveMaxScore,
  getEffectiveCriteriaResults,
} from "@/lib/scoring/effectiveScore";
import { rankClasses, type ClassRankingResult, type ClassDailyResult } from "@/lib/ranking/rankClasses";

// ---------- Dashboard cards ----------

export interface DashboardCards {
  totalSubmissions: number;
  classesScoredCount: number;
  classesNotScoredCount: number;
  averageScore: number | null;
  bonusTotal: number;
  penaltyTotal: number;
}

export function computeDashboardCards(params: {
  classesInScope: ClassConfig[];
  scoresInScope: ScoreRecord[];
  adjustmentsInScope: AdjustmentRecord[];
}): DashboardCards {
  const { classesInScope, scoresInScope, adjustmentsInScope } = params;

  const scoredClassIds = new Set(scoresInScope.map((s) => s.classId));
  const averageScore =
    scoresInScope.length > 0
      ? scoresInScope.reduce((sum, s) => sum + getEffectiveScore(s), 0) /
        scoresInScope.length
      : null;

  const bonusTotal = adjustmentsInScope
    .filter((a) => a.type === "BONUS")
    .reduce((sum, a) => sum + a.points, 0);
  const penaltyTotal = adjustmentsInScope
    .filter((a) => a.type === "PENALTY")
    .reduce((sum, a) => sum + a.points, 0);

  return {
    totalSubmissions: scoresInScope.length,
    classesScoredCount: scoredClassIds.size,
    classesNotScoredCount: Math.max(classesInScope.length - scoredClassIds.size, 0),
    averageScore,
    bonusTotal,
    penaltyTotal,
  };
}

// ---------- Tiến độ theo Đợt chấm (thay cho progress theo ngày/buổi cũ —
// V1 không còn phản ánh đúng thực tế khi chấm điểm đã chuyển sang theo Đợt
// chấm (V2): 1 lớp "chưa chấm hôm nay" có thể vì chưa tới lượt trong Đợt,
// không phải vì bị bỏ sót. Xem yêu cầu: dashboard chỉ nên hiện tiến độ THEO
// ĐỢT CHẤM, không hiện lại theo ngày/buổi thô.) ----------

export interface RoundClassProgress {
  doneCount: number;
  totalCount: number;
  notDoneClasses: ClassConfig[];
}

export function computeRoundClassProgress(
  classesInRoundScope: ClassConfig[],
  scoresOfRound: ScoreRecord[],
): RoundClassProgress {
  const doneClassIds = new Set(scoresOfRound.map((s) => s.classId));
  const notDoneClasses = classesInRoundScope.filter((c) => !doneClassIds.has(c.classId));
  return {
    doneCount: classesInRoundScope.length - notDoneClasses.length,
    totalCount: classesInRoundScope.length,
    notDoneClasses,
  };
}

// ---------- Phân tích tiêu chí ----------

export interface CriterionFailureStat {
  /** Định danh ổn định của tiêu chí (V2: criterionId thật; V1: "c{n}"). */
  criterionId: string;
  /** Số thứ tự trong bộ tiêu chí hiện tại, 0 nếu không xác định được (tiêu
   * chí V2 không còn tồn tại trong danh sách Criteria hiện tại). Chỉ dùng để
   * hiển thị tham khảo, KHÔNG dùng làm khoá gộp (dùng criterionId). */
  criterionNumber: number;
  criterionName: string;
  failCount: number;
  totalCount: number;
  failRate: number;
}

/**
 * Gộp thống kê "không đạt" theo TỪNG TIÊU CHÍ trên toàn bộ `scores` truyền
 * vào, đọc đúng kết quả của cả bản ghi V1 (c1..c11) lẫn V2 (snapshot động) —
 * xem `getEffectiveCriteriaResults`. Không hard-code 11 tiêu chí.
 */
export function computeCriteriaFailureStats(
  scores: ScoreRecord[],
  criteria: CriterionConfig[],
): CriterionFailureStat[] {
  const byId = new Map<
    string,
    { name: string; number: number; fail: number; total: number }
  >();

  for (const s of scores) {
    const results = getEffectiveCriteriaResults(s, criteria);
    for (const r of results) {
      const entry = byId.get(r.criterionId) ?? {
        name: r.criterionName,
        number: criteria.find((c) => c.criterionId === r.criterionId)?.criterionNumber ?? 0,
        fail: 0,
        total: 0,
      };
      entry.total += 1;
      if (r.result === "FAIL") entry.fail += 1;
      byId.set(r.criterionId, entry);
    }
  }

  return Array.from(byId.entries())
    .map(([criterionId, v]) => ({
      criterionId,
      criterionNumber: v.number,
      criterionName: v.name,
      failCount: v.fail,
      totalCount: v.total,
      failRate: v.total > 0 ? v.fail / v.total : 0,
    }))
    .sort((a, b) => b.failCount - a.failCount);
}

export function getCriterionViolations(
  scores: ScoreRecord[],
  criterionId: string,
  criteria: CriterionConfig[],
): ScoreRecord[] {
  return scores.filter((s) =>
    getEffectiveCriteriaResults(s, criteria).some(
      (r) => r.criterionId === criterionId && r.result === "FAIL",
    ),
  );
}

// ---------- Xếp hạng tháng ----------

function ymKey(date: string): string {
  return date.slice(0, 7);
}

export function computeMonthlyRankingForGrade(params: {
  classes: ClassConfig[];
  scoresOfMonth: ScoreRecord[];
  adjustmentsOfMonth: AdjustmentRecord[];
  combineMode: DailyScoreCombineMode;
  yearMonth: string;
}): ClassRankingResult[] {
  const { classes, scoresOfMonth, adjustmentsOfMonth, combineMode, yearMonth } = params;

  const scoresByClass = new Map<string, ScoreRecord[]>();
  for (const s of scoresOfMonth) {
    if (ymKey(s.date) !== yearMonth) continue;
    const arr = scoresByClass.get(s.classId) ?? [];
    arr.push(s);
    scoresByClass.set(s.classId, arr);
  }

  const adjByClass = new Map<string, AdjustmentRecord[]>();
  for (const a of adjustmentsOfMonth) {
    if (ymKey(a.date) !== yearMonth) continue;
    const arr = adjByClass.get(a.classId) ?? [];
    arr.push(a);
    adjByClass.set(a.classId, arr);
  }

  const inputs = classes.map((klass) => {
    const classScores = scoresByClass.get(klass.classId) ?? [];
    const classAdjustments = adjByClass.get(klass.classId) ?? [];

    const dates = Array.from(new Set(classScores.map((s) => s.date))).sort();

    const dailyResults: ClassDailyResult[] = dates.map((date) => {
      const morning = classScores.find((s) => s.date === date && s.session === "MORNING");
      const afternoon = classScores.find(
        (s) => s.date === date && s.session === "AFTERNOON",
      );
      const dayAdjustments = classAdjustments.filter((a) => a.date === date);
      const bonusTotal = dayAdjustments
        .filter((a) => a.type === "BONUS")
        .reduce((sum, a) => sum + a.points, 0);
      const penaltyTotal = dayAdjustments
        .filter((a) => a.type === "PENALTY")
        .reduce((sum, a) => sum + a.points, 0);

      const result = calculateDailyScore({
        morningCriteriaScore: morning ? getEffectiveScore(morning) : null,
        morningMaxScore: morning ? getEffectiveMaxScore(morning) : null,
        afternoonCriteriaScore: afternoon ? getEffectiveScore(afternoon) : null,
        afternoonMaxScore: afternoon ? getEffectiveMaxScore(afternoon) : null,
        bonusTotal,
        penaltyTotal,
        combineMode,
      });

      return {
        date,
        dailyScore: result.officialDailyScore,
        judgeScore: result.officialJudgeScore,
        maxPossibleJudgeScore: result.maxPossibleOfficialScore,
      };
    });

    const bonusCount = classAdjustments.filter((a) => a.type === "BONUS").length;
    const bonusPointsTotal = classAdjustments
      .filter((a) => a.type === "BONUS")
      .reduce((sum, a) => sum + a.points, 0);
    const penaltyTotal = classAdjustments
      .filter((a) => a.type === "PENALTY")
      .reduce((sum, a) => sum + a.points, 0);

    return {
      classId: klass.classId,
      className: klass.className,
      grade: klass.grade,
      dailyResults,
      bonusCount,
      bonusPointsTotal,
      penaltyTotal,
    };
  });

  return rankClasses(inputs);
}

// ---------- Số liệu tham khảo khi combineMode = "UNCONFIRMED" ----------

export interface ClassDailyScoreSummary {
  classId: string;
  className: string;
  grade: Grade;
  daysWithMorning: number;
  daysWithAfternoon: number;
  daysComplete: number;
  /** Trung bình điểm buổi Sáng qua các ngày đã chấm buổi Sáng. */
  avgMorning: number | null;
  /** Trung bình điểm buổi Chiều qua các ngày đã chấm buổi Chiều. */
  avgAfternoon: number | null;
  /** Trung bình của (tổng 2 buổi mỗi ngày) — số liệu tham khảo nếu BTC chọn SUM. */
  avgOfSum: number | null;
  /** Trung bình của (trung bình 2 buổi mỗi ngày) — số liệu tham khảo nếu BTC chọn AVERAGE. */
  avgOfAverage: number | null;
}

/**
 * Số liệu điểm sáng/chiều/tổng/trung bình theo lớp trong tháng — dùng để
 * hiển thị TRÊN /admin/ranking khi `Settings.DAILY_SCORE_COMBINE_MODE`
 * còn là "UNCONFIRMED" (BTC chưa xác nhận công thức điểm ngày). Đây là số
 * liệu THAM KHẢO, không phải kết quả xếp hạng chính thức.
 * Xem BUSINESS_RULES_REVIEW.md mục 1.
 */
export function computeClassDailyScoreSummary(params: {
  classes: ClassConfig[];
  scoresOfMonth: ScoreRecord[];
  yearMonth: string;
}): ClassDailyScoreSummary[] {
  const { classes, scoresOfMonth, yearMonth } = params;

  const scoresByClass = new Map<string, ScoreRecord[]>();
  for (const s of scoresOfMonth) {
    if (ymKey(s.date) !== yearMonth) continue;
    const arr = scoresByClass.get(s.classId) ?? [];
    arr.push(s);
    scoresByClass.set(s.classId, arr);
  }

  const avg = (values: number[]): number | null =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return classes.map((klass) => {
    const classScores = scoresByClass.get(klass.classId) ?? [];
    const dates = Array.from(new Set(classScores.map((s) => s.date))).sort();

    const morningScores: number[] = [];
    const afternoonScores: number[] = [];
    const sumPerDay: number[] = [];
    const avgPerDay: number[] = [];
    let daysComplete = 0;

    for (const date of dates) {
      const morning = classScores.find((s) => s.date === date && s.session === "MORNING");
      const afternoon = classScores.find(
        (s) => s.date === date && s.session === "AFTERNOON",
      );
      const morningScore = morning ? getEffectiveScore(morning) : null;
      const afternoonScore = afternoon ? getEffectiveScore(afternoon) : null;
      if (morningScore !== null) morningScores.push(morningScore);
      if (afternoonScore !== null) afternoonScores.push(afternoonScore);
      if (morningScore !== null && afternoonScore !== null) {
        daysComplete++;
        sumPerDay.push(morningScore + afternoonScore);
        avgPerDay.push((morningScore + afternoonScore) / 2);
      } else if (morningScore !== null) {
        sumPerDay.push(morningScore);
        avgPerDay.push(morningScore);
      } else if (afternoonScore !== null) {
        sumPerDay.push(afternoonScore);
        avgPerDay.push(afternoonScore);
      }
    }

    return {
      classId: klass.classId,
      className: klass.className,
      grade: klass.grade,
      daysWithMorning: morningScores.length,
      daysWithAfternoon: afternoonScores.length,
      daysComplete,
      avgMorning: avg(morningScores),
      avgAfternoon: avg(afternoonScores),
      avgOfSum: avg(sumPerDay),
      avgOfAverage: avg(avgPerDay),
    };
  });
}
