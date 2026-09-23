import type { ClassDailyScoreSummary } from "@/lib/admin/aggregate";

/** 4 ô số liệu THAM KHẢO (sáng/chiều/tổng/trung bình) hiển thị khi
 * `DAILY_SCORE_COMBINE_MODE` còn "UNCONFIRMED" — dùng chung cho GVCN
 * (`HomeroomDashboard`) và Admin (`ClassDetailView`). */
export function DailyScoreSummaryCards({ summary }: { summary: ClassDailyScoreSummary | null }) {
  if (!summary) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu chấm điểm trong tháng.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-md bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">TB buổi sáng</p>
        <p className="font-semibold">{summary.avgMorning !== null ? summary.avgMorning.toFixed(1) : "—"}</p>
      </div>
      <div className="rounded-md bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">TB buổi chiều</p>
        <p className="font-semibold">{summary.avgAfternoon !== null ? summary.avgAfternoon.toFixed(1) : "—"}</p>
      </div>
      <div className="rounded-md bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">TB tổng 2 buổi/ngày</p>
        <p className="font-semibold">{summary.avgOfSum !== null ? summary.avgOfSum.toFixed(1) : "—"}</p>
      </div>
      <div className="rounded-md bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">TB trung bình 2 buổi/ngày</p>
        <p className="font-semibold">{summary.avgOfAverage !== null ? summary.avgOfAverage.toFixed(1) : "—"}</p>
      </div>
    </div>
  );
}
