import { ClipboardList, School, AlertTriangle, TrendingUp, Award, ThumbsDown, FileSpreadsheet } from "lucide-react";
import { getClasses, getScores, getAdjustments, getUsers, getScoringRounds } from "@/lib/google/sheets";
import { todayVN } from "@/lib/timezone/timezone";
import { computeDashboardCards, computeRoundClassProgress } from "@/lib/admin/aggregate";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope } from "@/lib/rounds/eligibility";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { StatCard } from "@/components/admin/StatCard";
import { DashboardRoundsPanel, type DashboardRoundItem } from "@/components/admin/DashboardRoundsPanel";
import type { Grade } from "@/types";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const date = sp.date || todayVN();
  const grade = (sp.grade as Grade | undefined) || undefined;
  const classId = sp.classId || undefined;
  const judgeEmail = sp.judgeEmail || undefined;
  const sessionFilter = sp.session === "MORNING" || sp.session === "AFTERNOON" ? sp.session : undefined;

  const [allClasses, allJudges, scoresOfDate, adjustmentsOfDate, allRounds] = await Promise.all([
    getClasses({ activeOnly: true }),
    getUsers(),
    getScores({ dateFrom: date, dateTo: date, grade, classId, judgeEmail, session: sessionFilter }),
    getAdjustments({ dateFrom: date, dateTo: date, classId }),
    getScoringRounds(),
  ]);

  const classesInScope = allClasses.filter((c) => !grade || c.grade === grade);
  const cards = computeDashboardCards({
    classesInScope,
    scoresInScope: scoresOfDate,
    adjustmentsInScope: adjustmentsOfDate,
  });

  const judges = allJudges.filter((u) => u.role === "JUDGE");

  // Chỉ hiện Đợt chấm đang mở hoặc sắp diễn ra (OPEN trước, rồi SCHEDULED
  // theo thời gian gần nhất) — không hiện lại tiến độ theo ngày/buổi thô.
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

  const roundItems: DashboardRoundItem[] = await Promise.all(
    relevantRounds.map(async ({ round, effectiveStatus }) => {
      const classesInRoundScope = allClasses.filter((c) => isClassInRoundScope(round, c.classId, c.grade));
      const scoresOfRound = await getScores({ roundId: round.roundId });
      const progress = computeRoundClassProgress(classesInRoundScope, scoresOfRound);
      return { round, effectiveStatus, ...progress };
    }),
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Tổng quan</h1>
        <a
          href={`/api/admin/export/xlsx?date=${date}${grade ? `&grade=${grade}` : ""}${classId ? `&classId=${classId}` : ""}${judgeEmail ? `&judgeEmail=${judgeEmail}` : ""}${sessionFilter ? `&session=${sessionFilter}` : ""}`}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Xuất Excel
        </a>
      </div>

      <DashboardFilters classes={allClasses} judges={judges} showTimeRange />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Tổng lượt chấm" value={cards.totalSubmissions} icon={ClipboardList} />
        <StatCard label="Lớp đã chấm" value={cards.classesScoredCount} icon={School} tone="success" />
        <StatCard
          label="Lớp chưa chấm"
          value={cards.classesNotScoredCount}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Điểm TB"
          value={cards.averageScore !== null ? cards.averageScore.toFixed(1) : "—"}
          icon={TrendingUp}
        />
        <StatCard label="Điểm cộng" value={cards.bonusTotal} icon={Award} tone="success" />
        <StatCard label="Điểm trừ" value={cards.penaltyTotal} icon={ThumbsDown} tone="destructive" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-semibold">Đợt chấm đang diễn ra / sắp tới</h2>
        <DashboardRoundsPanel items={roundItems} />
      </div>
    </div>
  );
}
