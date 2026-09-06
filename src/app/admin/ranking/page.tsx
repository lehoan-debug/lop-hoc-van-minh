import { AlertTriangle } from "lucide-react";
import {
  getClasses,
  getScores,
  getAdjustments,
  getSettings,
  getRankingDecisions,
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

export default async function AdminRankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const yearMonth = sp.month || currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);

  const [classes, scores, adjustments, settings, decisions] = await Promise.all([
    getClasses({ activeOnly: true }),
    getScores({ dateFrom: from, dateTo: to }),
    getAdjustments({ dateFrom: from, dateTo: to }),
    getSettings(),
    getRankingDecisions({ yearMonth }),
  ]);

  const isUnconfirmed = settings.DAILY_SCORE_COMBINE_MODE === "UNCONFIRMED";

  const combineModeLabel = isUnconfirmed
    ? "Chưa xác nhận"
    : settings.DAILY_SCORE_COMBINE_MODE === "SUM"
      ? "Cộng tổng"
      : "Trung bình";

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Xếp hạng Lớp học Văn minh</h1>
      <div className="mb-4 flex items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
        <MonthPicker value={yearMonth} />
        <p className="pb-2.5 text-xs text-muted-foreground">
          Cách kết hợp điểm sáng/chiều hiện tại: <strong>{combineModeLabel}</strong> (có thể đổi tại
          Cấu hình)
        </p>
      </div>

      {isUnconfirmed ? (
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
            tab10={
              <DailyScoreReferenceTable
                summaries={computeClassDailyScoreSummary({
                  classes: classes.filter((c) => c.grade === "10"),
                  scoresOfMonth: scores,
                  yearMonth,
                })}
              />
            }
            tab11={
              <DailyScoreReferenceTable
                summaries={computeClassDailyScoreSummary({
                  classes: classes.filter((c) => c.grade === "11"),
                  scoresOfMonth: scores,
                  yearMonth,
                })}
              />
            }
            tab12={
              <DailyScoreReferenceTable
                summaries={computeClassDailyScoreSummary({
                  classes: classes.filter((c) => c.grade === "12"),
                  scoresOfMonth: scores,
                  yearMonth,
                })}
              />
            }
          />
        </>
      ) : (
        <RankingTabsShell
          tab10={
            <RankingTable
              results={computeMonthlyRankingForGrade({
                classes: classes.filter((c) => c.grade === "10"),
                scoresOfMonth: scores,
                adjustmentsOfMonth: adjustments,
                combineMode: settings.DAILY_SCORE_COMBINE_MODE,
                yearMonth,
              })}
              decisions={decisions.filter((d) => d.grade === "10")}
              yearMonth={yearMonth}
              grade="10"
            />
          }
          tab11={
            <RankingTable
              results={computeMonthlyRankingForGrade({
                classes: classes.filter((c) => c.grade === "11"),
                scoresOfMonth: scores,
                adjustmentsOfMonth: adjustments,
                combineMode: settings.DAILY_SCORE_COMBINE_MODE,
                yearMonth,
              })}
              decisions={decisions.filter((d) => d.grade === "11")}
              yearMonth={yearMonth}
              grade="11"
            />
          }
          tab12={
            <RankingTable
              results={computeMonthlyRankingForGrade({
                classes: classes.filter((c) => c.grade === "12"),
                scoresOfMonth: scores,
                adjustmentsOfMonth: adjustments,
                combineMode: settings.DAILY_SCORE_COMBINE_MODE,
                yearMonth,
              })}
              decisions={decisions.filter((d) => d.grade === "12")}
              yearMonth={yearMonth}
              grade="12"
            />
          }
        />
      )}
    </div>
  );
}
