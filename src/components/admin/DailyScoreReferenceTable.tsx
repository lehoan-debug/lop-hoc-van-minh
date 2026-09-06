import type { ClassDailyScoreSummary } from "@/lib/admin/aggregate";

const fmt = (v: number | null) => (v !== null ? v.toFixed(2) : "—");

export function DailyScoreReferenceTable({
  summaries,
}: {
  summaries: ClassDailyScoreSummary[];
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Lớp</th>
            <th className="px-3 py-2">Số ngày có chấm Sáng</th>
            <th className="px-3 py-2">Số ngày có chấm Chiều</th>
            <th className="px-3 py-2">TB điểm Sáng</th>
            <th className="px-3 py-2">TB điểm Chiều</th>
            <th className="px-3 py-2">TB (nếu chọn Cộng tổng)</th>
            <th className="px-3 py-2">TB (nếu chọn Trung bình)</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => (
            <tr key={s.classId} className="border-b border-border last:border-0 hover:bg-accent/50">
              <td className="px-3 py-2 font-medium">{s.className}</td>
              <td className="px-3 py-2">{s.daysWithMorning}</td>
              <td className="px-3 py-2">{s.daysWithAfternoon}</td>
              <td className="px-3 py-2">{fmt(s.avgMorning)}</td>
              <td className="px-3 py-2">{fmt(s.avgAfternoon)}</td>
              <td className="px-3 py-2">{fmt(s.avgOfSum)}</td>
              <td className="px-3 py-2">{fmt(s.avgOfAverage)}</td>
            </tr>
          ))}
          {summaries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                Chưa có dữ liệu chấm điểm trong khoảng thời gian này.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
