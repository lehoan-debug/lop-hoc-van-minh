"use client";

import * as React from "react";
import { useTransition } from "react";
import { Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { sendBulkHomeroomReportsAction, type BulkHomeroomReportSkip } from "@/lib/actions/emailActions";
import type { Grade } from "@/types";

export interface HomeroomTeacherItem {
  email: string;
  name: string;
  classes: { classId: string; className: string; grade: Grade }[];
}

export function GVCNReportCard({ teachers }: { teachers: HomeroomTeacherItem[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [lastSkipped, setLastSkipped] = React.useState<BulkHomeroomReportSkip[]>([]);

  const allClassIds = React.useMemo(() => teachers.flatMap((t) => t.classes.map((c) => c.classId)), [teachers]);
  const allSelected = allClassIds.length > 0 && allClassIds.every((id) => selected.has(id));

  const toggleTeacher = (teacher: HomeroomTeacherItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const teacherClassIds = teacher.classes.map((c) => c.classId);
      const fullySelected = teacherClassIds.every((id) => next.has(id));
      for (const id of teacherClassIds) {
        if (fullySelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allClassIds));
  };

  const handleSend = () => {
    if (selected.size === 0) {
      toast({ variant: "error", title: "Vui lòng chọn ít nhất 1 GVCN." });
      return;
    }
    startTransition(async () => {
      const result = await sendBulkHomeroomReportsAction({ classIds: Array.from(selected) });
      if (result.ok) {
        const { sentCount, skipped } = result.data;
        setLastSkipped(skipped);
        toast({
          variant: skipped.length === 0 ? "success" : "error",
          title:
            skipped.length === 0
              ? `Đã gửi báo cáo tới ${sentCount} GVCN.`
              : `Đã gửi ${sentCount} email — bỏ qua ${skipped.length} lớp (xem chi tiết bên dưới).`,
        });
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            Gửi báo cáo tới GVCN
          </CardTitle>
          {allClassIds.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          )}
        </div>
        <CardDescription>
          Mỗi GVCN sẽ nhận đúng báo cáo lớp chủ nhiệm của mình — điểm hôm nay, xếp hạng trong khối,
          điểm cộng/trừ và nhận xét chung. Gửi thẳng tới email tài khoản GVCN, không phải email bạn
          tự nhập.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {teachers.map((teacher) => {
            const teacherClassIds = teacher.classes.map((c) => c.classId);
            const fullySelected = teacherClassIds.length > 0 && teacherClassIds.every((id) => selected.has(id));
            return (
              <button
                key={teacher.email}
                type="button"
                onClick={() => toggleTeacher(teacher)}
                className={cn(
                  "flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-sm",
                  fullySelected ? "bg-primary/10 text-primary" : "hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border",
                    fullySelected ? "border-primary bg-primary" : "border-border",
                  )}
                />
                <span>
                  <span className="font-medium">{teacher.name}</span>
                  <span className="text-muted-foreground"> ({teacher.email})</span>
                  <span className="block text-xs text-muted-foreground">
                    Lớp: {teacher.classes.map((c) => c.className).join(", ")}
                  </span>
                </span>
              </button>
            );
          })}
          {teachers.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Chưa có GVCN nào được phân công lớp chủ nhiệm.
            </p>
          )}
        </div>

        {lastSkipped.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-[var(--radius)] bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Đã bỏ qua {lastSkipped.length} lớp:</p>
              <ul className="mt-1 list-disc pl-4">
                {lastSkipped.map((s, i) => (
                  <li key={`${s.classId}-${i}`}>
                    {s.className}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Đã chọn {selected.size}/{allClassIds.length} lớp.</p>
          <Button onClick={handleSend} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Gửi báo cáo đã chọn
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
