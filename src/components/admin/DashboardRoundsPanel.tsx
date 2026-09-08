import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { ROUND_STATUS_LABEL } from "@/lib/rounds/roundStatus";
import type { ClassConfig, EffectiveRoundStatus, ScoringRound, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

const STATUS_TONE: Record<EffectiveRoundStatus, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  SCHEDULED: "bg-primary/10 text-primary",
  OPEN: "bg-success/10 text-success",
  LOCKED: "bg-secondary text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export interface DashboardRoundItem {
  round: ScoringRound;
  effectiveStatus: EffectiveRoundStatus;
  doneCount: number;
  totalCount: number;
  notDoneClasses: ClassConfig[];
}

/** Thay cho card "Chưa hoàn thành — Buổi sáng/chiều" cũ (tính theo ngày/buổi
 * thô, không biết gì về Đợt chấm — dễ hiểu nhầm vì 1 lớp "chưa chấm hôm nay"
 * có thể chỉ vì chưa tới lượt trong Đợt, không phải bị bỏ sót). Bảng này chỉ
 * hiện đúng tiến độ THEO ĐỢT CHẤM đang mở/sắp diễn ra. */
export function DashboardRoundsPanel({ items }: { items: DashboardRoundItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <p>Không có đợt chấm nào đang diễn ra hoặc sắp tới.</p>
        <Link
          href="/admin/scoring-rounds"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Tạo đợt chấm
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <RoundProgressCard key={item.round.roundId} item={item} />
      ))}
    </div>
  );
}

function RoundProgressCard({ item }: { item: DashboardRoundItem }) {
  const { round, effectiveStatus, doneCount, totalCount, notDoneClasses } = item;
  const shown = notDoneClasses.slice(0, 8);
  const remaining = notDoneClasses.length - shown.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{round.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateVN(round.startsAt)} · {formatTimeVN(round.startsAt)}–{formatTimeVN(round.endsAt)} ·
            Buổi {SESSION_LABEL[round.session]}
          </p>
        </div>
        <span
          className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[effectiveStatus])}
        >
          {ROUND_STATUS_LABEL[effectiveStatus]}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Tiến độ</span>
        <span className="font-semibold">
          {doneCount}/{totalCount} lớp đã chấm
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {notDoneClasses.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Chưa chấm:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((c) => (
              <span
                key={c.classId}
                className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning"
              >
                {c.className}
              </span>
            ))}
            {remaining > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                +{remaining} khác
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 text-right">
        <Link
          href={`/admin/scoring-rounds/${round.roundId}`}
          className="text-sm font-medium text-primary"
        >
          Xem chi tiết
        </Link>
      </div>
    </div>
  );
}
