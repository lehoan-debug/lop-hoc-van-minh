import type {
  AdjustmentRecord,
  ClassConfig,
  CriterionConfig,
  Grade,
  ScoreRecord,
  Session_,
} from "@/types";
import type { CriterionKey } from "@/types";
import {
  calculateDailyScore,
  type DailyScoreCombineMode,
} from "@/lib/scoring/dailyScore";
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
      ? scoresInScope.reduce((sum, s) => sum + s.totalCriteriaScore, 0) /
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

// ---------- Progress theo lớp (cho 1 ngày) ----------

export interface ClassProgressItem {
  classId: string;
  className: string;
  grade: Grade;
  scoredMorning: boolean;
  scoredAfternoon: boolean;
}

export function buildClassProgress(
  classes: ClassConfig[],
  scoresOfDate: ScoreRecord[],
): ClassProgressItem[] {
  const scoredKeys = new Set(scoresOfDate.map((s) => `${s.classId}__${s.session}`));
  return classes.map((c) => ({
    classId: c.classId,
    className: c.className,
    grade: c.grade,
    scoredMorning: scoredKeys.has(`${c.classId}__MORNING`),
    scoredAfternoon: scoredKeys.has(`${c.classId}__AFTERNOON`),
  }));
}

export function getIncompleteClasses(
  progress: ClassProgressItem[],
  session: Session_,
): ClassProgressItem[] {
  return progress.filter((p) =>
    session === "MORNING" ? !p.scoredMorning : !p.scoredAfternoon,
  );
}

// ---------- Phân tích tiêu chí ----------

export interface CriterionFailureStat {
  criterionNumber: number;
  criterionName: string;
  failCount: number;
  totalCount: number;
  failRate: number;
}

export function computeCriteriaFailureStats(
  scores: ScoreRecord[],
  criteria: CriterionConfig[],
): CriterionFailureStat[] {
  return criteria
    .map((c) => {
      const ck = `c${c.criterionNumber}` as CriterionKey;
      const failCount = scores.filter((s) => s[ck] === 0).length;
      return {
        criterionNumber: c.criterionNumber,
        criterionName: c.criterionName,
        failCount,
        totalCount: scores.length,
        failRate: scores.length > 0 ? failCount / scores.length : 0,
      };
    })
    .sort((a, b) => b.failCount - a.failCount);
}

export function getCriterionViolations(
  scores: ScoreRecord[],
  criterionNumber: number,
): ScoreRecord[] {
  const ck = `c${criterionNumber}` as CriterionKey;
  return scores.filter((s) => s[ck] === 0);
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
        morningCriteriaScore: morning?.totalCriteriaScore ?? null,
        afternoonCriteriaScore: afternoon?.totalCriteriaScore ?? null,
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
      if (morning) morningScores.push(morning.totalCriteriaScore);
      if (afternoon) afternoonScores.push(afternoon.totalCriteriaScore);
      if (morning && afternoon) {
        daysComplete++;
        sumPerDay.push(morning.totalCriteriaScore + afternoon.totalCriteriaScore);
        avgPerDay.push((morning.totalCriteriaScore + afternoon.totalCriteriaScore) / 2);
      } else if (morning) {
        sumPerDay.push(morning.totalCriteriaScore);
        avgPerDay.push(morning.totalCriteriaScore);
      } else if (afternoon) {
        sumPerDay.push(afternoon.totalCriteriaScore);
        avgPerDay.push(afternoon.totalCriteriaScore);
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
