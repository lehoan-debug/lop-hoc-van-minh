"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { Plus, Lock, Settings, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { ROUND_STATUS_LABEL } from "@/lib/rounds/roundStatus";
import { lockRoundAction } from "@/lib/actions/roundActions";
import { CreateRoundDialog } from "@/components/admin/CreateRoundDialog";
import type { AppUser, ClassConfig, EffectiveRoundStatus, ScoringRound, Session_ } from "@/types";

export interface RoundListItem {
  round: ScoringRound;
  effectiveStatus: EffectiveRoundStatus;
  assignedJudgeCount: number;
  totalClasses: number;
  assignedClassCount: number;
  doneCount: number;
}

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

const STATUS_TONE: Record<EffectiveRoundStatus, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  SCHEDULED: "bg-primary/10 text-primary",
  OPEN: "bg-success/10 text-success",
  LOCKED: "bg-secondary text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function ScoringRoundsPageClient({
  items,
  classes,
  judges,
}: {
  items: RoundListItem[];
  classes: ClassConfig[];
  judges: AppUser[];
}) {
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Tạo đợt chấm
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <RoundCard key={item.round.roundId} item={item} />
        ))}
        {items.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Chưa có đợt chấm nào. Bấm &quot;Tạo đợt chấm&quot; để bắt đầu.
          </p>
        )}
      </div>

      {creating && (
        <CreateRoundDialog classes={classes} judges={judges} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function RoundCard({ item }: { item: RoundListItem }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { round, effectiveStatus, assignedJudgeCount, totalClasses, assignedClassCount, doneCount } = item;
  const unassignedCount = totalClasses - assignedClassCount;

  const handleLock = () => {
    startTransition(async () => {
      const result = await lockRoundAction(round.roundId);
      if (result.ok) {
        toast({ variant: "success", title: "Đã khoá đợt chấm." });
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{round.title}</p>
        <span
          className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[effectiveStatus])}
        >
          {ROUND_STATUS_LABEL[effectiveStatus]}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDateVN(round.startsAt)} · {formatTimeVN(round.startsAt)}–{formatTimeVN(round.endsAt)} · Buổi{" "}
        {SESSION_LABEL[round.session]}
      </p>

      <div className="mt-3 space-y-1 text-sm">
        <p>
          Người chấm: <strong>{assignedJudgeCount}</strong>
        </p>
        <p>
          Phân công:{" "}
          <strong className={unassignedCount > 0 ? "text-warning" : undefined}>
            {assignedClassCount}
          </strong>
          /{totalClasses} lớp
        </p>
        <p>
          Đã chấm: <strong>{doneCount}</strong>/{totalClasses} lớp
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/admin/scoring-rounds/${round.roundId}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-input bg-background text-sm font-medium hover:bg-accent"
        >
          <Settings className="h-3.5 w-3.5" />
          Cấu hình
        </Link>
        <Link
          href={`/admin/scoring-rounds/${round.roundId}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-input bg-background text-sm font-medium hover:bg-accent"
        >
          <Eye className="h-3.5 w-3.5" />
          Theo dõi
        </Link>
        {effectiveStatus === "OPEN" && (
          <Button size="sm" variant="destructive" onClick={handleLock} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Khoá
          </Button>
        )}
      </div>
    </div>
  );
}
