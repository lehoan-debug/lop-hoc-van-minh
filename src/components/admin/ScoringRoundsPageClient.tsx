"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Lock, Eye, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { ROUND_STATUS_LABEL } from "@/lib/rounds/roundStatus";
import { lockRoundAction, deleteRoundAction } from "@/lib/actions/roundActions";
import { CreateRoundDialog } from "@/components/admin/CreateRoundDialog";
import { DeleteRoundConfirmDialog } from "@/components/admin/DeleteRoundConfirmDialog";
import type { AppUser, ClassConfig, CriterionConfig, EffectiveRoundStatus, ScoringRound, Session_ } from "@/types";

type SortKey = "dateDesc" | "dateAsc" | "nameAsc" | "nameDesc";

const SORT_LABEL: Record<SortKey, string> = {
  dateDesc: "Ngày chấm (mới nhất)",
  dateAsc: "Ngày chấm (cũ nhất)",
  nameAsc: "Tên (A → Z)",
  nameDesc: "Tên (Z → A)",
};

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
  criteria,
}: {
  items: RoundListItem[];
  classes: ClassConfig[];
  judges: AppUser[];
  criteria: CriterionConfig[];
}) {
  const [creating, setCreating] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("dateDesc");
  const [showCancelled, setShowCancelled] = React.useState(false);

  const cancelledCount = items.filter((i) => i.effectiveStatus === "CANCELLED").length;

  const visibleItems = React.useMemo(() => {
    const filtered = showCancelled ? items : items.filter((i) => i.effectiveStatus !== "CANCELLED");
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "dateAsc":
          return a.round.startsAt.localeCompare(b.round.startsAt);
        case "nameAsc":
          return a.round.title.localeCompare(b.round.title);
        case "nameDesc":
          return b.round.title.localeCompare(a.round.title);
        case "dateDesc":
        default:
          return b.round.startsAt.localeCompare(a.round.startsAt);
      }
    });
    return sorted;
  }, [items, sortKey, showCancelled]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cancelledCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              {showCancelled ? "Ẩn đợt đã huỷ" : `Hiện cả đợt đã huỷ (${cancelledCount})`}
            </button>
          )}
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Tạo đợt chấm
        </Button>
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => (
          <RoundRow key={item.round.roundId} item={item} />
        ))}
        {visibleItems.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? 'Chưa có đợt chấm nào. Bấm "Tạo đợt chấm" để bắt đầu.'
              : "Không có đợt chấm nào phù hợp."}
          </p>
        )}
      </div>

      {creating && (
        <CreateRoundDialog
          classes={classes}
          judges={judges}
          criteria={criteria}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function RoundRow({ item }: { item: RoundListItem }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
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

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteRoundAction(round.roundId);
      if (result.ok) {
        toast({ variant: "success", title: "Đã xoá đợt chấm." });
        setDeleteConfirm(false);
        router.refresh();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
        effectiveStatus === "CANCELLED" && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{round.title}</p>
          <span
            className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[effectiveStatus])}
          >
            {ROUND_STATUS_LABEL[effectiveStatus]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateVN(round.startsAt)} · {formatTimeVN(round.startsAt)}–{formatTimeVN(round.endsAt)} · Buổi{" "}
          {SESSION_LABEL[round.session]}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            Người chấm: <strong className="text-foreground">{assignedJudgeCount}</strong>
          </span>
          <span>
            Phân công:{" "}
            <strong className={cn("text-foreground", unassignedCount > 0 && "text-warning")}>
              {assignedClassCount}
            </strong>
            /{totalClasses} lớp
          </span>
          <span>
            Đã chấm: <strong className="text-foreground">{doneCount}</strong>/{totalClasses} lớp
          </span>
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Link
          href={`/admin/scoring-rounds/${round.roundId}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
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
        {effectiveStatus !== "CANCELLED" && (
          <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(true)} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {deleteConfirm && (
        <DeleteRoundConfirmDialog
          roundTitle={round.title}
          doneCount={doneCount}
          assignedJudgeCount={assignedJudgeCount}
          onCancel={() => setDeleteConfirm(false)}
          onConfirm={handleDelete}
          isPending={isPending}
        />
      )}
    </div>
  );
}
