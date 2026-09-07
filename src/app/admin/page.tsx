import Link from "next/link";
import { ClipboardList, School, AlertTriangle, TrendingUp, Award, ThumbsDown, FileSpreadsheet } from "lucide-react";
import { getClasses, getScores, getAdjustments, getUsers } from "@/lib/google/sheets";
import { todayVN } from "@/lib/timezone/timezone";
import { computeDashboardCards, buildClassProgress, getIncompleteClasses } from "@/lib/admin/aggregate";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { StatCard } from "@/components/admin/StatCard";
import { ProgressGrid } from "@/components/admin/ProgressGrid";
import type { Grade, Session_ } from "@/types";

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
  const session: Session_ = sessionFilter ?? "MORNING";

  const [allClasses, allJudges, scoresOfDate, adjustmentsOfDate] = await Promise.all([
    getClasses({ activeOnly: true }),
    getUsers(),
    getScores({ dateFrom: date, dateTo: date, grade, classId, judgeEmail, session: sessionFilter }),
    getAdjustments({ dateFrom: date, dateTo: date, classId }),
  ]);

  const classesInScope = allClasses.filter((c) => !grade || c.grade === grade);
  const cards = computeDashboardCards({
    classesInScope,
    scoresInScope: scoresOfDate,
    adjustmentsInScope: adjustmentsOfDate,
  });

  const progress = buildClassProgress(classesInScope, scoresOfDate);
  const incomplete = getIncompleteClasses(progress, session).slice(0, 5);
  const judges = allJudges.filter((u) => u.role === "JUDGE");

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

      {incomplete.length > 0 && (
        <div className="mt-5 rounded-[var(--radius)] border border-warning/30 bg-warning/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-warning">
              <AlertTriangle className="h-4 w-4" />
              Chưa hoàn thành — Buổi {session === "MORNING" ? "sáng" : "chiều"}
            </h2>
            <Link
              href={`/admin/results?date=${date}&session=${session}`}
              className="text-sm font-medium text-primary"
            >
              Xem chi tiết
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {incomplete.map((c) => (
              <span
                key={c.classId}
                className="rounded-full bg-card px-3 py-1 text-sm font-medium shadow-sm"
              >
                {c.className}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-[var(--radius)] border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">Tiến độ chấm điểm theo lớp</h2>
        <ProgressGrid progress={progress} session={session} />
      </div>
    </div>
  );
}
