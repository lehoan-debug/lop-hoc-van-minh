import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import {
  getClasses,
  getScores,
  getAdjustments,
  getSettings,
  getRankingDecisions,
  getScoringRounds,
  getCriteria,
} from "@/lib/google/sheets";
import { currentYearMonthVN, getMonthDateRange } from "@/lib/timezone/timezone";
import {
  computeMonthlyRankingForGrade,
  computeClassDailyScoreSummary,
} from "@/lib/admin/aggregate";
import { MonthPicker } from "@/components/admin/MonthPicker";
import { RankingTabsShell } from "@/components/admin/RankingTabsShell";
import { RankingTable } from "@/components/admin/RankingTable";
import { DailyScoreReferenceTable } from "@/components/admin/DailyScoreReferenceTable";
import { RankingViewSwitcher } from "@/components/admin/RankingViewSwitcher";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { Grade } from "@/types";

export default async function AdminRankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const yearMonth = sp.month || currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);
  const initialView = sp.view === "detail" ? "detail" : "ranking";
  const initialClassId = sp.classId || null;

  const [classes, scores, adjustments, settings, decisions, allRounds, criteria] = await Promise.all([
    getClasses({ activeOnly: true }),
    getScores({ dateFrom: from, dateTo: to }),
    getAdjustments({ dateFrom: from, dateTo: to }),
    getSettings(),
    getRankingDecisions({ yearMonth }),
    getScoringRounds(),
    getCriteria({ activeOnly: true }),
  ]);

  const isUnconfirmed = settings.DAILY_SCORE_COMBINE_MODE === "UNCONFIRMED";

  const combineModeLabel = isUnconfirmed
    ? "Chưa xác nhận"
    : settings.DAILY_SCORE_COMBINE_MODE === "SUM"
      ? "Cộng tổng"
      : "Trung bình";

  // Tính MỘT LẦN cho cả 3 khối (thay vì lặp lại bên trong từng tab10/11/12
  // như code cũ) — dùng lại được cho cả bảng xếp hạng theo khối lẫn tab "Chi
  // tiết theo lớp" (cần tra cứu Điểm TB/Hạng hoặc số liệu tham khảo của MỘT
  // lớp bất kỳ, không phân biệt khối đang xem).
  const rankingsByGrade = {} as Record<Grade, ClassRankingResult[]>;
  if (!isUnconfirmed) {
    for (const g of ["10", "11", "12"] as Grade[]) {
      rankingsByGrade[g] = computeMonthlyRankingForGrade({
        classes: classes.filter((c) => c.grade === g),
        scoresOfMonth: scores,
        adjustmentsOfMonth: adjustments,
        combineMode: settings.DAILY_SCORE_COMBINE_MODE,
        yearMonth,
      });
    }
  }
  const dailySummaries = isUnconfirmed
    ? computeClassDailyScoreSummary({ classes, scoresOfMonth: scores, yearMonth })
    : [];

  const rankingContent = isUnconfirmed ? (
    <>
      <div className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border border-warning/30 bg-warning/5 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p>
          <strong>Công thức điểm ngày chưa được BTC xác nhận</strong> — số liệu dưới đây chỉ
          mang tính tham khảo (điểm sáng, điểm chiều, tổng và trung bình 2 buổi mỗi ngày), CHƯA
          được dùng để xếp hạng chính thức. Vào <em>Cấu hình → Chung</em> để chọn cách kết hợp
          (Cộng tổng / Trung bình) khi BTC đã quyết định.
        </p>
      </div>
      <RankingTabsShell
        tab10={<DailyScoreReferenceTable summaries={dailySummaries.filter((s) => s.grade === "10")} />}
        tab11={<DailyScoreReferenceTable summaries={dailySummaries.filter((s) => s.grade === "11")} />}
        tab12={<DailyScoreReferenceTable summaries={dailySummaries.filter((s) => s.grade === "12")} />}
      />
    </>
  ) : (
    <RankingTabsShell
      tab10={
        <RankingTable
          results={rankingsByGrade["10"]}
          decisions={decisions.filter((d) => d.grade === "10")}
          yearMonth={yearMonth}
          grade="10"
        />
      }
      tab11={
        <RankingTable
          results={rankingsByGrade["11"]}
          decisions={decisions.filter((d) => d.grade === "11")}
          yearMonth={yearMonth}
          grade="11"
        />
      }
      tab12={
        <RankingTable
          results={rankingsByGrade["12"]}
          decisions={decisions.filter((d) => d.grade === "12")}
          yearMonth={yearMonth}
          grade="12"
        />
      }
    />
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Xếp hạng Lớp học Văn minh</h1>
        {!isUnconfirmed && (
          <a
            href={`/api/admin/export/xlsx?dateFrom=${from}&dateTo=${to}&yearMonth=${yearMonth}&includeRanking=1`}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất Excel
          </a>
        )}
      </div>
      <div className="mb-4 flex items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
        <MonthPicker value={yearMonth} />
        <p className="pb-2.5 text-xs text-muted-foreground">
          Cách kết hợp điểm sáng/chiều hiện tại: <strong>{combineModeLabel}</strong> (có thể đổi tại
          Cấu hình)
        </p>
      </div>

      <RankingViewSwitcher
        initialView={initialView}
        initialClassId={initialClassId}
        rankingContent={rankingContent}
        classes={classes}
        scores={scores}
        adjustments={adjustments}
        criteria={criteria}
        allRounds={allRounds}
        rankingsByGrade={rankingsByGrade}
        dailySummaries={dailySummaries}
        isUnconfirmed={isUnconfirmed}
        combineMode={settings.DAILY_SCORE_COMBINE_MODE}
        yearMonth={yearMonth}
      />
    </div>
  );
}
