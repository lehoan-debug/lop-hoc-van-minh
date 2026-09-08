import { requireUser } from "@/lib/auth/session";
import { canViewHomeroomClass } from "@/lib/auth/permissions";
import {
  getClasses,
  getScores,
  getAdjustments,
  getSettings,
  getCriteria,
} from "@/lib/google/sheets";
import { currentYearMonthVN, getMonthDateRange, todayVN, formatDateVN } from "@/lib/timezone/timezone";
import {
  computeMonthlyRankingForGrade,
  computeCriteriaFailureStats,
  computeClassDailyScoreSummary,
} from "@/lib/admin/aggregate";
import { HomeroomDashboard } from "@/components/homeroom/HomeroomDashboard";

export default async function HomeroomPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const allClasses = await getClasses({ activeOnly: true });

  const isAdmin = user.roles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN");
  const myClassIds = isAdmin ? allClasses.map((c) => c.classId) : user.homeroomClassIds;

  if (myClassIds.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-muted-foreground">
        Bạn chưa được phân công làm Giáo viên chủ nhiệm lớp nào.
      </div>
    );
  }

  const selectedClassId =
    sp.classId && myClassIds.includes(sp.classId) ? sp.classId : myClassIds[0]!;

  if (!canViewHomeroomClass(user, selectedClassId)) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-muted-foreground">
        Bạn không có quyền xem lớp này.
      </div>
    );
  }

  const classInfo = allClasses.find((c) => c.classId === selectedClassId);
  if (!classInfo) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-muted-foreground">
        Không tìm thấy lớp.
      </div>
    );
  }

  const yearMonth = currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);
  const today = todayVN();

  const [monthScores, monthAdjustments, settings, criteria, todayScores] = await Promise.all([
    getScores({ dateFrom: from, dateTo: to, classId: selectedClassId }),
    getAdjustments({ dateFrom: from, dateTo: to, classId: selectedClassId }),
    getSettings(),
    getCriteria(),
    getScores({ dateFrom: today, dateTo: today, classId: selectedClassId }),
  ]);

  const gradeClasses = allClasses.filter((c) => c.grade === classInfo.grade);
  const isUnconfirmed = settings.DAILY_SCORE_COMBINE_MODE === "UNCONFIRMED";
  const gradeScores = await getScores({ dateFrom: from, dateTo: to, grade: classInfo.grade });

  // Công thức điểm ngày CHƯA được BTC xác nhận -> không được hiện "xếp hạng"
  // như thể là chính thức (đúng cách /admin/ranking đang xử lý — chuyển sang
  // số liệu THAM KHẢO theo buổi thay vì 1 con số xếp hạng dễ gây hiểu lầm).
  let ranking = null as ReturnType<typeof computeMonthlyRankingForGrade>[number] | null;
  let totalRankedInGrade = 0;
  let dailySummary = null as ReturnType<typeof computeClassDailyScoreSummary>[number] | null;

  if (isUnconfirmed) {
    const summaries = computeClassDailyScoreSummary({
      classes: gradeClasses,
      scoresOfMonth: gradeScores,
      yearMonth,
    });
    dailySummary = summaries.find((s) => s.classId === selectedClassId) ?? null;
  } else {
    const gradeAdjustments = await getAdjustments({ dateFrom: from, dateTo: to });
    const rankingList = computeMonthlyRankingForGrade({
      classes: gradeClasses,
      scoresOfMonth: gradeScores,
      adjustmentsOfMonth: gradeAdjustments,
      combineMode: settings.DAILY_SCORE_COMBINE_MODE,
      yearMonth,
    });
    ranking = rankingList.find((r) => r.classId === selectedClassId) ?? null;
    totalRankedInGrade = rankingList.length;
  }

  const failureStats = computeCriteriaFailureStats(monthScores, criteria).filter(
    (s) => s.failCount > 0,
  );

  const bonusTotal = monthAdjustments
    .filter((a) => a.type === "BONUS")
    .reduce((sum, a) => sum + a.points, 0);
  const penaltyTotal = monthAdjustments
    .filter((a) => a.type === "PENALTY")
    .reduce((sum, a) => sum + a.points, 0);

  return (
    <HomeroomDashboard
      classInfo={classInfo}
      myClasses={allClasses.filter((c) => myClassIds.includes(c.classId))}
      combineMode={settings.DAILY_SCORE_COMBINE_MODE}
      isUnconfirmed={isUnconfirmed}
      dailySummary={dailySummary}
      todayLabel={formatDateVN(today)}
      todayScores={todayScores}
      monthScores={[...monthScores].sort((a, b) => b.timestamp.localeCompare(a.timestamp))}
      monthAdjustments={[...monthAdjustments].sort((a, b) => b.timestamp.localeCompare(a.timestamp))}
      ranking={ranking}
      totalRankedInGrade={totalRankedInGrade}
      failureStats={failureStats}
      bonusTotal={bonusTotal}
      penaltyTotal={penaltyTotal}
      criteria={criteria}
    />
  );
}
