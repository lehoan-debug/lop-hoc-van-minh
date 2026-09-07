"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Search } from "lucide-react";
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
import { todayVN } from "@/lib/timezone/timezone";
import { useRouter } from "next/navigation";
import { createRoundAction, assignJudgeAction, assignAllJudgesAction } from "@/lib/actions/roundActions";
import type { AppUser, ClassConfig, Grade, Session_ } from "@/types";

export function CreateRoundDialog({
  classes,
  judges,
  onClose,
}: {
  classes: ClassConfig[];
  judges: AppUser[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [session, setSession] = React.useState<Session_>("MORNING");
  const [date, setDate] = React.useState(todayVN());
  const [startTime, setStartTime] = React.useState("07:20");
  const [endTime, setEndTime] = React.useState("07:40");
  const [grades, setGrades] = React.useState<Grade[]>([]);
  const [classIds, setClassIds] = React.useState<string[]>([]);
  const [judgeQuery, setJudgeQuery] = React.useState("");
  const [selectedJudges, setSelectedJudges] = React.useState<string[]>([]);
  const [allJudges, setAllJudges] = React.useState(false);

  const toggleGrade = (g: Grade) => {
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };
  const toggleClass = (classId: string) => {
    setClassIds((prev) => (prev.includes(classId) ? prev.filter((x) => x !== classId) : [...prev, classId]));
  };
  const toggleJudge = (email: string) => {
    setSelectedJudges((prev) => (prev.includes(email) ? prev.filter((x) => x !== email) : [...prev, email]));
  };

  const filteredJudges = judges.filter(
    (j) =>
      j.name.toLowerCase().includes(judgeQuery.toLowerCase()) ||
      j.email.toLowerCase().includes(judgeQuery.toLowerCase()),
  );

  const classesForGrades = grades.length === 0 ? classes : classes.filter((c) => grades.includes(c.grade));

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập tên đợt chấm." });
      return;
    }
    startTransition(async () => {
      const result = await createRoundAction({
        title: title.trim(),
        description,
        session,
        date,
        startTime,
        endTime,
        gradeIds: grades,
        classIds,
      });
      if (!result.ok) {
        toast({ variant: "error", title: result.error });
        return;
      }
      const roundId = result.data.roundId;

      if (allJudges) {
        await assignAllJudgesAction(roundId);
      } else {
        for (const email of selectedJudges) {
          await assignJudgeAction({ roundId, userEmail: email });
        }
      }

      toast({
        variant: "success",
        title: "Đã tạo đợt chấm.",
        description: "Người chấm chưa có quyền chấm lớp nào — vào trang chi tiết để phân công theo lớp.",
      });
      onClose();
      router.push(`/admin/scoring-rounds/${roundId}`);
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo đợt chấm</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label>Tên đợt</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vd: Đợt chấm sáng 08/09/2026"
              className="mt-1"
            />
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

          <div>
            <div className="flex items-center justify-between">
              <Label>Giám khảo / người chấm</Label>
              <button
                type="button"
                onClick={() => setAllJudges((v) => !v)}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium",
                  allJudges ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                Chọn tất cả Giám khảo
              </button>
            </div>
            {!allJudges && (
              <>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={judgeQuery}
                    onChange={(e) => setJudgeQuery(e.target.value)}
                    placeholder="Tìm theo tên/email"
                    className="pl-8"
                  />
                </div>
                <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto rounded-md border border-border p-1.5">
                  {filteredJudges.map((j) => (
                    <button
                      key={j.email}
                      type="button"
                      onClick={() => toggleJudge(j.email)}
                      className={cn(
                        "flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm",
                        selectedJudges.includes(j.email) ? "bg-primary/10 text-primary" : "hover:bg-accent",
                      )}
                    >
                      <span>{j.name || j.email}</span>
                      <span className="text-xs text-muted-foreground">{j.email}</span>
                    </button>
                  ))}
                  {filteredJudges.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">Không tìm thấy.</p>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đã chọn {selectedJudges.length} người.
                </p>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo & Lên lịch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
