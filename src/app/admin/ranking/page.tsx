import { getClasses, getScores, getAdjustments, getSettings } from "@/lib/google/sheets";
import { currentYearMonthVN, getMonthDateRange } from "@/lib/timezone/timezone";
import { computeMonthlyRankingForGrade } from "@/lib/admin/aggregate";
import { MonthPicker } from "@/components/admin/MonthPicker";
import { RankingTabsShell } from "@/components/admin/RankingTabsShell";
import { RankingTable } from "@/components/admin/RankingTable";

export default async function AdminRankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const yearMonth = sp.month || currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);

  const [classes, scores, adjustments, settings] = await Promise.all([
    getClasses({ activeOnly: true }),
    getScores({ dateFrom: from, dateTo: to }),
    getAdjustments({ dateFrom: from, dateTo: to }),
    getSettings(),
  ]);

  const rankFor = (grade: "10" | "11" | "12") =>
    computeMonthlyRankingForGrade({
      classes: classes.filter((c) => c.grade === grade),
      scoresOfMonth: scores,
      adjustmentsOfMonth: adjustments,
      combineMode: settings.DAILY_SCORE_COMBINE_MODE,
      yearMonth,
    });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Xếp hạng Lớp học Văn minh</h1>
      <div className="mb-4 flex items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
        <MonthPicker value={yearMonth} />
        <p className="pb-2.5 text-xs text-muted-foreground">
          Cách kết hợp điểm sáng/chiều hiện tại:{" "}
          <strong>{settings.DAILY_SCORE_COMBINE_MODE === "SUM" ? "Cộng tổng" : "Trung bình"}</strong>{" "}
          (có thể đổi tại Cấu hình)
        </p>
      </div>
      <RankingTabsShell
        tab10={<RankingTable results={rankFor("10")} />}
        tab11={<RankingTable results={rankFor("11")} />}
        tab12={<RankingTable results={rankFor("12")} />}
      />
    </div>
  );
}
