import { cn } from "@/lib/utils";
import { formatDateVN } from "@/lib/timezone/timezone";
import type { AdjustmentRecord } from "@/types";

/** Danh sách điểm cộng/trừ chi tiết của 1 lớp trong 1 khoảng thời gian (thường
 * là 1 tháng) — dùng chung cho màn hình GVCN và Admin. */
export function AdjustmentHistoryList({ adjustments }: { adjustments: AdjustmentRecord[] }) {
  if (adjustments.length === 0) return null;

  return (
    <div className="space-y-2">
      {adjustments.map((a) => (
        <div key={a.adjustmentId} className="rounded-md border border-border px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className={cn("font-semibold", a.type === "BONUS" ? "text-success" : "text-destructive")}>
              {a.type === "BONUS" ? "+" : "-"}
              {a.points} điểm
            </span>
            <span className="text-xs text-muted-foreground">{formatDateVN(a.date)}</span>
          </div>
          {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
          {(a.studentName || a.studentCode) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Học sinh: {[a.studentName, a.studentCode].filter(Boolean).join(" - ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
