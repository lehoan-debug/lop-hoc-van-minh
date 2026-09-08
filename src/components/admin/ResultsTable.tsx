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
import { editScoreAction, editRoundScoreAction, deleteScoreAction } from "@/lib/actions/adminActions";
import {
  getEffectiveScore,
  getEffectiveMaxScore,
  getEffectiveCriteriaResults,
  isRoundScore,
} from "@/lib/scoring/effectiveScore";
import { CRITERIA_COUNT, type CriterionKey } from "@/types";
import type { AdjustmentRecord, CriterionSnapshotItem, ScoreRecord, CriterionConfig, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

export function ResultsTable({
  scores,
  criteria,
  adjustments,
}: {
  scores: ScoreRecord[];
  criteria: CriterionConfig[];
  adjustments: AdjustmentRecord[];
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<ScoreRecord | null>(null);
  const [deleting, setDeleting] = React.useState<ScoreRecord | null>(null);

  // Adjustments không gắn với 1 lượt chấm cụ thể (chỉ theo ngày + lớp) — xem
  // docs/CLASS_ASSIGNMENT_UPGRADE.md / schema Adjustments. Nếu 1 lớp có nhiều
  // lượt chấm trong cùng 1 ngày (vd. nhiều Đợt chấm), số cộng/trừ hiển thị là
  // TỔNG CẢ NGÀY của lớp đó, không tách riêng theo từng lượt — ghi rõ trong
  // nhãn cột để không gây hiểu nhầm là "điểm cộng/trừ của riêng lượt này".
  const bonusPenaltyByDateClass = React.useMemo(() => {
    const map = new Map<string, { bonus: number; penalty: number }>();
    for (const a of adjustments) {
      const key = `${a.date}__${a.classId}`;
      const entry = map.get(key) ?? { bonus: 0, penalty: 0 };
      if (a.type === "BONUS") entry.bonus += a.points;
      else entry.penalty += a.points;
      map.set(key, entry);
    }
    return map;
  }, [adjustments]);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Buổi</th>
              <th className="px-3 py-2">Khối</th>
              <th className="px-3 py-2">Lớp</th>
              <th className="px-3 py-2">Người chấm</th>
              <th className="px-3 py-2">Điểm tiêu chí</th>
              <th className="px-3 py-2">Cộng/Trừ (cả ngày)</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => {
              const open = openId === s.submissionId;
              const isV2 = isRoundScore(s);
              const results = getEffectiveCriteriaResults(s, criteria);
              const dayTotals = bonusPenaltyByDateClass.get(`${s.date}__${s.classId}`);
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
                      {getEffectiveScore(s)}/{getEffectiveMaxScore(s)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {dayTotals && (dayTotals.bonus > 0 || dayTotals.penalty > 0) ? (
                        <span>
                          {dayTotals.bonus > 0 && <span className="text-success">+{dayTotals.bonus}</span>}
                          {dayTotals.bonus > 0 && dayTotals.penalty > 0 && " / "}
                          {dayTotals.penalty > 0 && <span className="text-warning">-{dayTotals.penalty}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                          {results.map((r, i) => (
                            <div key={r.criterionId} className="text-sm">
                              <span className="text-muted-foreground">
                                {isV2 ? `${i + 1}. ${r.criterionName}` : `${r.criterionName}`}:{" "}
                              </span>
                              <span className={r.result === "PASS" ? "text-success" : "text-warning"}>
                                {r.result === "PASS" ? "Đạt" : "Không đạt"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {scores.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Không có kết quả phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && isRoundScore(editing) && (
        <EditRoundScoreDialog score={editing} onClose={() => setEditing(null)} />
      )}
      {editing && !isRoundScore(editing) && (
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

/** Sửa lượt chấm V2 — chỉ sửa Đạt/Không đạt + ghi chú của TỪNG tiêu chí đã
 * có trong snapshot gốc (tên/điểm tối đa lấy nguyên từ snapshot, không đổi
 * được ở đây), đúng nguyên tắc snapshot bất biến tại thời điểm chấm. */
function EditRoundScoreDialog({ score, onClose }: { score: ScoreRecord; onClose: () => void }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [snapshot] = React.useState<CriterionSnapshotItem[]>(() => {
    try {
      return JSON.parse(score.criteriaSnapshotJson || "[]");
    } catch {
      return [];
    }
  });
  const [results, setResults] = React.useState<Map<string, { result: "PASS" | "FAIL"; note: string }>>(
    () => new Map(snapshot.map((item) => [item.criterionId, { result: item.result, note: item.note ?? "" }])),
  );

  const total = Array.from(results.entries()).reduce((sum, [criterionId, r]) => {
    const item = snapshot.find((s) => s.criterionId === criterionId);
    return sum + (r.result === "PASS" ? (item?.maxScore ?? 0) : 0);
  }, 0);
  const max = snapshot.reduce((sum, item) => sum + item.maxScore, 0);

  const setResult = (criterionId: string, result: "PASS" | "FAIL") => {
    setResults((prev) => {
      const next = new Map(prev);
      const current = next.get(criterionId) ?? { result, note: "" };
      next.set(criterionId, { ...current, result });
      return next;
    });
  };
  const setNote = (criterionId: string, note: string) => {
    setResults((prev) => {
      const next = new Map(prev);
      const current = next.get(criterionId) ?? { result: "PASS" as const, note };
      next.set(criterionId, { ...current, note });
      return next;
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await editRoundScoreAction({
        submissionId: score.submissionId,
        results: Array.from(results.entries()).map(([criterionId, r]) => ({
          criterionId,
          result: r.result,
          note: r.note,
        })),
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
          {snapshot.map((item, i) => {
            const current = results.get(item.criterionId);
            return (
              <div key={item.criterionId} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {i + 1}. {item.name}{" "}
                    <span className="text-xs text-muted-foreground">(tối đa {item.maxScore})</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setResult(item.criterionId, "PASS")}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-semibold",
                        current?.result === "PASS"
                          ? "border-success bg-success text-success-foreground"
                          : "border-border",
                      )}
                    >
                      Đạt
                    </button>
                    <button
                      onClick={() => setResult(item.criterionId, "FAIL")}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-semibold",
                        current?.result === "FAIL"
                          ? "border-warning bg-warning text-warning-foreground"
                          : "border-border",
                      )}
                    >
                      Không đạt
                    </button>
                  </div>
                </div>
                {current?.result === "FAIL" && (
                  <input
                    value={current.note}
                    onChange={(e) => setNote(item.criterionId, e.target.value)}
                    placeholder="Ghi chú / minh chứng"
                    className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  />
                )}
              </div>
            );
          })}
          {snapshot.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Không đọc được dữ liệu tiêu chí gốc của lượt chấm này.
            </p>
          )}
        </div>
        <p className="mt-2 text-sm font-semibold">
          Tổng: {total}/{max}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={isPending || snapshot.length === 0}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
