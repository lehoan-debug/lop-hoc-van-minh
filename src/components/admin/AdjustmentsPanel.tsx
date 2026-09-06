"use client";

import * as React from "react";
import { useTransition } from "react";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateVN, formatDateTimeVN, todayVN } from "@/lib/timezone/timezone";
import {
  createAdjustmentAction,
  editAdjustmentAction,
  deleteAdjustmentAction,
} from "@/lib/actions/adminActions";
import type { AdjustmentRecord, ClassConfig } from "@/types";

export function AdjustmentsPanel({
  adjustments,
  classes,
}: {
  adjustments: AdjustmentRecord[];
  classes: ClassConfig[];
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdjustmentRecord | null>(null);
  const [deleting, setDeleting] = React.useState<AdjustmentRecord | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Ghi nhận điểm cộng/trừ
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Lớp</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Điểm</th>
              <th className="px-3 py-2">Nội dung</th>
              <th className="px-3 py-2">Người ghi nhận</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.adjustmentId} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTimeVN(a.timestamp)}</td>
                <td className="px-3 py-2 font-medium">{a.className}</td>
                <td className="px-3 py-2">
                  <span className={a.type === "BONUS" ? "text-success" : "text-destructive"}>
                    {a.type === "BONUS" ? "Điểm cộng" : "Điểm trừ"}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold">
                  {a.type === "BONUS" ? "+" : "-"}
                  {a.points}
                </td>
                <td className="px-3 py-2 max-w-xs truncate" title={a.description}>
                  {a.description}
                </td>
                <td className="px-3 py-2">{a.recordedByName || a.recordedByEmail}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(a)} className="rounded p-1.5 text-primary hover:bg-accent">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(a)}
                      className="rounded p-1.5 text-destructive hover:bg-accent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {adjustments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Chưa có điểm cộng/trừ nào được ghi nhận.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <AdjustmentFormDialog classes={classes} onClose={() => setCreateOpen(false)} />
      )}
      {editing && (
        <AdjustmentFormDialog
          classes={classes}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteAdjustmentDialog adjustment={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function AdjustmentFormDialog({
  classes,
  existing,
  onClose,
}: {
  classes: ClassConfig[];
  existing?: AdjustmentRecord;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = React.useState<"BONUS" | "PENALTY">(existing?.type ?? "BONUS");
  const [classId, setClassId] = React.useState(existing?.classId ?? classes[0]?.classId ?? "");
  const [points, setPoints] = React.useState(String(existing?.points ?? 1));
  const [studentName, setStudentName] = React.useState(existing?.studentName ?? "");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [location, setLocation] = React.useState(existing?.location ?? "");
  const [evidence, setEvidence] = React.useState(existing?.evidence ?? "");
  const [date] = React.useState(existing?.date ?? todayVN());

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập nội dung sự việc." });
      return;
    }
    if (!classId) {
      toast({ variant: "error", title: "Vui lòng chọn lớp." });
      return;
    }

    startTransition(async () => {
      const payload = {
        date,
        classId,
        type,
        points: Number(points) || 1,
        studentName,
        description,
        location,
        evidence,
      };
      const result = existing
        ? await editAdjustmentAction({ ...payload, adjustmentId: existing.adjustmentId })
        : await createAdjustmentAction(payload);

      if (result.ok) {
        toast({
          variant: "success",
          title: existing ? "Đã cập nhật điểm cộng/trừ." : "Đã ghi nhận điểm cộng/trừ.",
        });
        onClose();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Chỉnh sửa" : "Ghi nhận"} điểm cộng/trừ</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loại</Label>
              <Select value={type} onValueChange={(v) => setType(v as "BONUS" | "PENALTY")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BONUS">Điểm cộng (+)</SelectItem>
                  <SelectItem value="PENALTY">Điểm trừ (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Số điểm</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Lớp</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>
                    {c.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Học sinh liên quan (nếu có)</Label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>Nội dung sự việc</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Địa điểm</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Minh chứng</Label>
              <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} className="mt-1" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Ngày ghi nhận: {formatDateVN(date)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Lưu thay đổi" : "Ghi nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAdjustmentDialog({
  adjustment,
  onClose,
}: {
  adjustment: AdjustmentRecord;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAdjustmentAction(adjustment.adjustmentId);
      if (result.ok) {
        toast({ variant: "success", title: "Đã xoá bản ghi." });
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
          <DialogTitle>Xác nhận xoá</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Xoá bản ghi {adjustment.type === "BONUS" ? "điểm cộng" : "điểm trừ"} của lớp{" "}
          <strong>{adjustment.className}</strong>?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
