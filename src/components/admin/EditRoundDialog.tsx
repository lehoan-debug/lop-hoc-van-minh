"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatInVN } from "@/lib/timezone/timezone";
import { updateRoundAction } from "@/lib/actions/roundActions";
import type { ClassConfig, EffectiveRoundStatus, Grade, ScoringRound, Session_ } from "@/types";

export function EditRoundDialog({
  round,
  effectiveStatus,
  classes,
  onClose,
}: {
  round: ScoringRound;
  effectiveStatus: EffectiveRoundStatus;
  classes: ClassConfig[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = React.useState(round.title);
  const [description, setDescription] = React.useState(round.description);
  const [session, setSession] = React.useState<Session_>(round.session);
  const [date, setDate] = React.useState(() => formatInVN(round.startsAt, "yyyy-MM-dd"));
  const [startTime, setStartTime] = React.useState(() => formatInVN(round.startsAt, "HH:mm"));
  const [endTime, setEndTime] = React.useState(() => formatInVN(round.endsAt, "HH:mm"));
  const [grades, setGrades] = React.useState<Grade[]>(round.gradeIds);
  const [classIds, setClassIds] = React.useState<string[]>(round.classIds);
  const [confirming, setConfirming] = React.useState(false);

  const toggleGrade = (g: Grade) => {
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };
  const toggleClass = (classId: string) => {
    setClassIds((prev) => (prev.includes(classId) ? prev.filter((x) => x !== classId) : [...prev, classId]));
  };

  const classesForGrades = grades.length === 0 ? classes : classes.filter((c) => grades.includes(c.grade));
  const isRunning = effectiveStatus === "OPEN" || effectiveStatus === "SCHEDULED";

  const doSave = () => {
    startTransition(async () => {
      const result = await updateRoundAction({
        roundId: round.roundId,
        title: title.trim(),
        description,
        session,
        date,
        startTime,
        endTime,
        gradeIds: grades,
        classIds,
      });
      if (result.ok) {
        toast({ variant: "success", title: "Đã cập nhật đợt chấm." });
        onClose();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập tên đợt chấm." });
      return;
    }
    if (isRunning && !confirming) {
      setConfirming(true);
      return;
    }
    doSave();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa đợt chấm</DialogTitle>
        </DialogHeader>

        {isRunning && (
          <div className="flex items-center gap-2 rounded-[var(--radius)] border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Đợt chấm {effectiveStatus === "OPEN" ? "đang mở" : "sắp diễn ra"} — thay đổi giờ có
            hiệu lực ngay sau khi lưu.
          </div>
        )}

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label>Tên đợt</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ngày</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Buổi</Label>
              <Select value={session} onValueChange={(v) => setSession(v as Session_)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Sáng</SelectItem>
                  <SelectItem value="AFTERNOON">Chiều</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Giờ bắt đầu</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Giờ kết thúc</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Khối (bỏ trống = tất cả khối)</Label>
            <div className="mt-1 flex gap-2">
              {(["10", "11", "12"] as Grade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    grades.includes(g) ? "border-primary bg-primary/10 font-medium text-primary" : "border-border",
                  )}
                >
                  Khối {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Lớp (bỏ trống = tất cả lớp thuộc khối đã chọn)</Label>
            <div className="mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
              {classesForGrades.map((c) => (
                <button
                  key={c.classId}
                  type="button"
                  onClick={() => toggleClass(c.classId)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium",
                    classIds.includes(c.classId) ? "border-primary bg-primary/10 text-primary" : "border-border",
                  )}
                >
                  {c.className}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirming ? "Xác nhận lưu" : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
