import { AlertCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";

export function RankingTable({ results }: { results: ClassRankingResult[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Hạng</th>
            <th className="px-3 py-2">Lớp</th>
            <th className="px-3 py-2">Điểm TB</th>
            <th className="px-3 py-2">Số ngày chấm</th>
            <th className="px-3 py-2">Điểm cộng</th>
            <th className="px-3 py-2">Điểm trừ</th>
            <th className="px-3 py-2">Số lần đạt điểm tối đa</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.classId} className="border-b border-border last:border-0 hover:bg-accent/50">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {r.rank <= 2 && <Trophy className="h-4 w-4 text-warning" />}
                  <span className="font-semibold">{r.rank}</span>
                  {r.needsManualReview && (
                    <span
                      title="Đồng hạng — cần Ban Tổ chức xem xét thủ công"
                      className="inline-flex items-center"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-warning" />
                    </span>
                  )}
                </div>
              </td>
              <td className={cn("px-3 py-2 font-medium")}>{r.className}</td>
              <td className="px-3 py-2">
                {r.averageScore !== null ? r.averageScore.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2">{r.daysGraded}</td>
              <td className="px-3 py-2 text-success">+{r.bonusPointsTotal}</td>
              <td className="px-3 py-2 text-destructive">-{r.penaltyTotal}</td>
              <td className="px-3 py-2">{r.maxScoreDaysCount}</td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                Chưa có dữ liệu chấm điểm trong khoảng thời gian này.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {results.some((r) => r.needsManualReview) && (
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 text-warning" />
          Các lớp có dấu <AlertCircle className="inline h-3 w-3" /> đồng hạng sau khi áp dụng hết quy
          tắc xét ưu tiên — cần Ban Tổ chức xem xét thủ công theo Kế hoạch.
        </p>
      )}
    </div>
  );
}
