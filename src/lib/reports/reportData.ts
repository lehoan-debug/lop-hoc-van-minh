import "server-only";
import {
  getClasses,
  getScores,
  getAdjustments,
  getSettings,
  getCriteria,
  getScoringRounds,
} from "@/lib/google/sheets";
import { computeMonthlyRankingForGrade, computeCriteriaFailureStats, computeDashboardCards } from "@/lib/admin/aggregate";
import { getEffectiveRoundStatus, ROUND_STATUS_LABEL } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope } from "@/lib/rounds/eligibility";
import { currentYearMonthVN, getMonthDateRange, todayVN, formatDateVN } from "@/lib/timezone/timezone";
import type { HomeroomReportInput, AdminSummaryReportInput } from "@/lib/email/templates";
import type { ClassConfig } from "@/types";

/**
 * Tính dữ liệu báo cáo cho ĐÚNG 1 lớp — hàm THUẦN tính toán, không dựng HTML/
 * Excel/Word (xem `src/lib/email/templates.ts` cho HTML, `reportXlsx.ts`/
 * `reportDocx.ts` cho file tải về). Tách khỏi `emailActions.ts` để 1 lần tính
 * dùng được cho cả gửi email lẫn tải file — không tính lại ranking/thống kê
 * nhiều nơi. Nhận `allClasses` tuỳ chọn để nơi gọi hàng loạt (nhiều lớp/
 * nhiều GVCN) không phải đọc lại Sheet Classes mỗi lớp.
 */
export async function computeHomeroomReportData(
  classId: string,
  allClassesParam?: ClassConfig[],
): Promise<HomeroomReportInput | null> {
  const allClasses = allClassesParam ?? (await getClasses({ activeOnly: true }));
  const classInfo = allClasses.find((c) => c.classId === classId);
  if (!classInfo) return null;

  const yearMonth = currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);
  const today = todayVN();

  const [monthScores, monthAdjustments, settings, criteria, todayScores] = await Promise.all([
    getScores({ dateFrom: from, dateTo: to, classId }),
    getAdjustments({ dateFrom: from, dateTo: to, classId }),
    getSettings(),
    getCriteria(),
    getScores({ dateFrom: today, dateTo: today, classId }),
  ]);

  const isUnconfirmed = settings.DAILY_SCORE_COMBINE_MODE === "UNCONFIRMED";
  let ranking = null as ReturnType<typeof computeMonthlyRankingForGrade>[number] | null;
  let totalRankedInGrade = 0;
  if (!isUnconfirmed) {
    const gradeClasses = allClasses.filter((c) => c.grade === classInfo.grade);
    const gradeScores = await getScores({ dateFrom: from, dateTo: to, grade: classInfo.grade });
    const gradeAdjustments = await getAdjustments({ dateFrom: from, dateTo: to });
    const rankingList = computeMonthlyRankingForGrade({
      classes: gradeClasses,
      scoresOfMonth: gradeScores,
      adjustmentsOfMonth: gradeAdjustments,
      combineMode: settings.DAILY_SCORE_COMBINE_MODE,
      yearMonth,
    });
    ranking = rankingList.find((r) => r.classId === classId) ?? null;
    totalRankedInGrade = rankingList.length;
  }

  const failureStats = computeCriteriaFailureStats(monthScores, criteria).filter((s) => s.failCount > 0);
  const bonusTotal = monthAdjustments.filter((a) => a.type === "BONUS").reduce((sum, a) => sum + a.points, 0);
  const penaltyTotal = monthAdjustments.filter((a) => a.type === "PENALTY").reduce((sum, a) => sum + a.points, 0);
  const todayTotal = todayScores.reduce((sum, s) => sum + (s.totalScore ?? s.totalCriteriaScore), 0);
  const todayMax = todayScores.reduce((sum, s) => sum + (s.maxPossibleScore ?? 11), 0);

  const sortedScores = [...monthScores].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    classInfo,
    yearMonthLabel: yearMonth,
    todayLabel: formatDateVN(today),
    todayTotal,
    todayMax,
    hasTodayScore: todayScores.length > 0,
    isUnconfirmed,
    ranking,
    totalRankedInGrade,
    bonusTotal,
    penaltyTotal,
    adjustments: [...monthAdjustments].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    failureStats,
    recentScores: sortedScores.map((s) => ({ ...s, formattedDate: formatDateVN(s.date) })),
  };
}

/**
 * Tính dữ liệu báo cáo tổng hợp toàn trường (thẻ "Gửi báo cáo tới BGH") — hàm
 * THUẦN tính toán, tách khỏi `emailActions.ts` cùng lý do như
 * `computeHomeroomReportData`. Giống hệt số liệu ở `/admin/page.tsx`
 * (Dashboard) cho `date` được truyền vào (mặc định hôm nay).
 */
export async function computeAdminSummaryReportData(date: string = todayVN()): Promise<AdminSummaryReportInput> {
  const [allClasses, scoresOfDate, adjustmentsOfDate, allRounds] = await Promise.all([
    getClasses({ activeOnly: true }),
    getScores({ dateFrom: date, dateTo: date }),
    getAdjustments({ dateFrom: date, dateTo: date }),
    getScoringRounds(),
  ]);

  const cards = computeDashboardCards({
    classesInScope: allClasses,
    scoresInScope: scoresOfDate,
    adjustmentsInScope: adjustmentsOfDate,
  });

  const now = new Date();
  const statusPriority: Record<string, number> = { OPEN: 0, SCHEDULED: 1 };
  const relevantRounds = allRounds
    .map((round) => ({ round, effectiveStatus: getEffectiveRoundStatus(round, now) }))
    .filter((r) => r.effectiveStatus === "OPEN" || r.effectiveStatus === "SCHEDULED")
    .sort((a, b) => {
      const p = statusPriority[a.effectiveStatus]! - statusPriority[b.effectiveStatus]!;
      return p !== 0 ? p : a.round.startsAt.localeCompare(b.round.startsAt);
    })
    .slice(0, 5);

  // Đã có `scoresOfDate` (getAllRows fetch toàn bộ sheet Scores không lọc
  // theo ngày) — nhưng tiến độ theo Đợt chấm cần TOÀN BỘ điểm của Đợt đó
  // (có thể trải nhiều ngày), không chỉ ngày `date`, nên vẫn cần gọi
  // `getScores({roundId})` riêng cho từng đợt — chạy song song, không tuần tự.
  const rounds = await Promise.all(
    relevantRounds.map(async ({ round, effectiveStatus }) => {
      const classesInRoundScope = allClasses.filter((c) => isClassInRoundScope(round, c.classId, c.grade));
      const scoresOfRound = await getScores({ roundId: round.roundId });
      const doneClassIds = new Set(scoresOfRound.map((s) => s.classId));
      const notDoneClassNames = classesInRoundScope
        .filter((c) => !doneClassIds.has(c.classId))
        .map((c) => c.className);
      return {
        title: round.title,
        statusLabel: ROUND_STATUS_LABEL[effectiveStatus],
        doneCount: classesInRoundScope.length - notDoneClassNames.length,
        totalCount: classesInRoundScope.length,
        notDoneClassNames,
      };
    }),
  );

  return {
    dateLabel: formatDateVN(date),
    totalSubmissions: cards.totalSubmissions,
    classesScoredCount: cards.classesScoredCount,
    classesNotScoredCount: cards.classesNotScoredCount,
    averageScore: cards.averageScore,
    bonusTotal: cards.bonusTotal,
    penaltyTotal: cards.penaltyTotal,
    rounds,
  };
}
