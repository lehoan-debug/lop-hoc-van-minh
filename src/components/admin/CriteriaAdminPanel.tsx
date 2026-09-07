"use client";

import * as React from "react";
import { useTransition } from "react";
import { Plus, Pencil, Archive, AlertTriangle, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  createCriterionAction,
  updateCriterionFullAction,
  archiveCriterionAction,
} from "@/lib/actions/adminActions";
import type { CriterionConfig, Grade } from "@/types";

export function CriteriaAdminPanel({ criteria }: { criteria: CriterionConfig[] }) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CriterionConfig | null>(null);
  const [archiving, setArchiving] = React.useState<CriterionConfig | null>(null);

  const active = criteria.filter((c) => c.active);
  const archived = criteria.filter((c) => !c.active);
  const totalMaxScore = active.reduce((sum, c) => sum + c.maxScore, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm">
          Tổng điểm tối đa hiện tại: <strong>{totalMaxScore}</strong> ({active.length} tiêu chí đang bật)
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Thêm tiêu chí
        </Button>
      </div>

      <div className="space-y-2">
        {active.map((c) => (
          <CriterionRow key={c.criterionId} c={c} onEdit={() => setEditing(c)} onArchive={() => setArchiving(c)} />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Đã archive ({archived.length})</h2>
          <div className="space-y-2 opacity-60">
            {archived.map((c) => (
              <CriterionRow key={c.criterionId} c={c} onEdit={() => setEditing(c)} onArchive={undefined} />
            ))}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <CriterionFormDialog
          existing={editing ?? undefined}
          nextSortOrder={criteria.length + 1}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {archiving && (
        <ArchiveConfirmDialog criterion={archiving} onClose={() => setArchiving(null)} />
      )}
    </div>
  );
}

function CriterionRow({
  c,
  onEdit,
  onArchive,
}: {
  c: CriterionConfig;
  onEdit: () => void;
  onArchive?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{c.criterionName}</p>
          {c.needsReview && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              <AlertTriangle className="h-3 w-3" />
              Cần xác nhận nội dung
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
        <p className="mt-1 text-xs">
          Điểm: <strong>{c.maxScore}</strong> · Khối:{" "}
          {c.gradeIds.length === 0 ? "Tất cả" : c.gradeIds.join(", ")}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={onEdit} className="rounded p-1.5 text-primary hover:bg-accent">
          <Pencil className="h-4 w-4" />
        </button>
        {onArchive && (
          <button onClick={onArchive} className="rounded p-1.5 text-destructive hover:bg-accent">
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function CriterionFormDialog({
  existing,
  nextSortOrder,
  onClose,
}: {
  existing?: CriterionConfig;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = React.useState(existing?.criterionName ?? "");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [maxScore, setMaxScore] = React.useState(String(existing?.maxScore ?? 1));
  const [gradeIds, setGradeIds] = React.useState<Grade[]>(existing?.gradeIds ?? []);
  const [sortOrder, setSortOrder] = React.useState(String(existing?.sortOrder ?? nextSortOrder));
  const [active, setActive] = React.useState(existing?.active ?? true);

  const toggleGrade = (g: Grade) => {
    setGradeIds((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleSubmit = () => {
    const score = Number(maxScore);
    if (!name.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập tên tiêu chí." });
      return;
    }
    if (!Number.isFinite(score) || score <= 0) {
      toast({ variant: "error", title: "Điểm phải là số lớn hơn 0." });
      return;
    }
    startTransition(async () => {
      const result = existing
        ? await updateCriterionFullAction({
            criterionId: existing.criterionId,
            criterionName: name.trim(),
            description,
            maxScore: score,
            gradeIds,
            sortOrder: Number(sortOrder) || 0,
            active,
          })
        : await createCriterionAction({
            criterionName: name.trim(),
            description,
            maxScore: score,
            gradeIds,
            sortOrder: Number(sortOrder) || 0,
          });
      if (result.ok) {
        toast({ variant: "success", title: existing ? "Đã cập nhật tiêu chí." : "Đã thêm tiêu chí." });
        onClose();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Sửa tiêu chí" : "Thêm tiêu chí"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label>Tên tiêu chí</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Điểm khi ĐẠT</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Thứ tự</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Khối áp dụng (bỏ trống = tất cả khối)</Label>
            <div className="mt-1 flex gap-2">
              {(["10", "11", "12"] as Grade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    gradeIds.includes(g) ? "border-primary bg-primary/10 font-medium text-primary" : "border-border",
                  )}
                >
                  Khối {g}
                </button>
              ))}
            </div>
          </div>
          {existing && (
            <div className="flex items-center justify-between">
              <Label>Đang bật (dùng cho Đợt chấm mới)</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveConfirmDialog({
  criterion,
  onClose,
}: {
  criterion: CriterionConfig;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveCriterionAction(criterion.criterionId);
      if (result.ok) {
        toast({ variant: "success", title: "Đã archive tiêu chí." });
        onClose();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive tiêu chí?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tiêu chí <strong>{criterion.criterionName}</strong> sẽ không còn xuất hiện trong Đợt chấm mới, nhưng lịch
          sử chấm điểm đã dùng tiêu chí này vẫn giữ nguyên (đã lưu snapshot riêng). Bạn có thể bật lại bất kỳ lúc
          nào.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={handleArchive} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
