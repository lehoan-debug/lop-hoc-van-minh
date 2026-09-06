"use client";

import * as React from "react";
import { useTransition } from "react";
import { ChevronDown, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { editScoreAction, deleteScoreAction } from "@/lib/actions/adminActions";
import { CRITERIA_COUNT, type CriterionKey } from "@/types";
import type { ScoreRecord, CriterionConfig, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

export function ResultsTable({
  scores,
  criteria,
}: {
  scores: ScoreRecord[];
  criteria: CriterionConfig[];
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<ScoreRecord | null>(null);
  const [deleting, setDeleting] = React.useState<ScoreRecord | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Buổi</th>
              <th className="px-3 py-2">Khối</th>
              <th className="px-3 py-2">Lớp</th>
              <th className="px-3 py-2">Người chấm</th>
              <th className="px-3 py-2">Điểm</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const open = openId === s.submissionId;
              let notes: { criterionNumber: number; note: string }[] = [];
              try {
                notes = JSON.parse(s.notesJson || "[]");
              } catch {
                notes = [];
              }
              return (
                <React.Fragment key={s.submissionId}>
                  <tr className="border-b border-border last:border-0 hover:bg-accent/50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateVN(s.date)} {formatTimeVN(s.timestamp)}
                    </td>
                    <td className="px-3 py-2">{SESSION_LABEL[s.session]}</td>
                    <td className="px-3 py-2">{s.grade}</td>
                    <td className="px-3 py-2 font-medium">{s.className}</td>
                    <td className="px-3 py-2">{s.judgeName || s.judgeEmail}</td>
                    <td className="px-3 py-2 font-semibold">
                      {s.totalCriteriaScore}/{CRITERIA_COUNT}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setOpenId(open ? null : s.submissionId)}
                          className="rounded p-1.5 hover:bg-accent"
                          title="Xem chi tiết"
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                        </button>
                        <button
                          onClick={() => setEditing(s)}
                          className="rounded p-1.5 text-primary hover:bg-accent"
                          title="Chỉnh sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="rounded p-1.5 text-destructive hover:bg-accent"
                          title="Xoá"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border bg-secondary/30">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                          {criteria.map((c) => {
                            const ck = `c${c.criterionNumber}` as CriterionKey;
                            const val = s[ck];
                            const note = notes.find((n) => n.criterionNumber === c.criterionNumber)?.note;
                            return (
                              <div key={c.criterionId} className="text-sm">
                                <span className="text-muted-foreground">C{c.criterionNumber}: </span>
                                <span className={val === 1 ? "text-success" : "text-warning"}>
                                  {val === 1 ? "Đạt" : "Không đạt"}
                                </span>
                                {note && <p className="text-xs italic text-muted-foreground">{note}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {scores.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Không có kết quả phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditScoreDialog
          score={editing}
          criteria={criteria}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <DeleteScoreDialog score={deleting} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}

function EditScoreDialog({
  score,
  criteria,
  onClose,
}: {
  score: ScoreRecord;
  criteria: CriterionConfig[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = React.useState<Record<CriterionKey, 0 | 1>>(() => {
    const init = {} as Record<CriterionKey, 0 | 1>;
    criteria.forEach((c) => {
      const ck = `c${c.criterionNumber}` as CriterionKey;
      init[ck] = score[ck];
    });
    return init;
  });

  const total = Object.values(values).reduce((sum: number, v) => sum + v, 0);

  const handleSave = () => {
    startTransition(async () => {
      const result = await editScoreAction({
        submissionId: score.submissionId,
        date: score.date,
        session: score.session,
        grade: score.grade,
        classId: score.classId,
        notes: [],
        ...values,
      });
      if (result.ok) {
        toast({ variant: "success", title: "Đã cập nhật kết quả chấm điểm." });
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
          <DialogTitle>
            Chỉnh sửa — {score.className} ({SESSION_LABEL[score.session]} {formatDateVN(score.date)})
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {criteria.map((c) => {
            const ck = `c${c.criterionNumber}` as CriterionKey;
            return (
              <div key={c.criterionId} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                <span className="text-sm">
                  {c.criterionNumber}. {c.description}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setValues((v) => ({ ...v, [ck]: 1 }))}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-semibold",
                      values[ck] === 1 ? "border-success bg-success text-success-foreground" : "border-border",
                    )}
                  >
                    Đạt
                  </button>
                  <button
                    onClick={() => setValues((v) => ({ ...v, [ck]: 0 }))}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-semibold",
                      values[ck] === 0 ? "border-warning bg-warning text-warning-foreground" : "border-border",
                    )}
                  >
                    Không đạt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-sm font-semibold">Tổng: {total}/{CRITERIA_COUNT}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteScoreDialog({ score, onClose }: { score: ScoreRecord; onClose: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteScoreAction(score.submissionId);
      if (result.ok) {
        toast({ variant: "success", title: "Đã xoá kết quả chấm điểm." });
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
          Xoá kết quả chấm điểm lớp <strong>{score.className}</strong> ({SESSION_LABEL[score.session]}{" "}
          {formatDateVN(score.date)})? Bản ghi sẽ được lưu vào nhật ký, không xoá vĩnh viễn.
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
