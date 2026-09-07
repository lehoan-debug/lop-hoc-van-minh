"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowLeft,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { getEffectiveRoundStatus, ROUND_STATUS_LABEL, msUntilRoundEnds } from "@/lib/rounds/roundStatus";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import { lockRoundAction, reopenRoundAction } from "@/lib/actions/roundActions";
import { AssignmentPanel } from "@/components/admin/AssignmentPanel";
import type {
  AppUser,
  ClassConfig,
  Grade,
  ScoreRecord,
  ScoringRound,
  ScoringRoundAssignment,
} from "@/types";

interface ClassRow {
  classInfo: ClassConfig;
  assignedJudgeEmails: string[];
  score: ScoreRecord | null;
}

export function RoundDetailClient({
  round,
  classes,
  classRows,
  assignments,
  judges,
}: {
  round: ScoringRound;
  classes: ClassConfig[];
  classRows: ClassRow[];
  assignments: ScoringRoundAssignment[];
  judges: AppUser[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = React.useState(() => new Date());
  const [gradeFilter, setGradeFilter] = React.useState<Grade | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "DONE" | "PENDING">("ALL");
  const [unassignedOnly, setUnassignedOnly] = React.useState(false);
  const [reopenConfirm, setReopenConfirm] = React.useState(false);

  const effectiveStatus = getEffectiveRoundStatus(round, now);

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling refresh dữ liệu server mỗi 30s (mục V — không cần WebSocket).
  React.useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  const doneCount = classRows.filter((r) => r.score).length;
  const totalCount = classRows.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const msLeft = msUntilRoundEnds(round, now);

  const judgeByEmail = new Map(judges.map((j) => [j.email, j]));

  const assignedCount = classRows.filter((r) => r.assignedJudgeEmails.length > 0).length;
  const unassignedCount = totalCount - assignedCount;

  const filteredRows = classRows.filter((r) => {
    if (gradeFilter !== "ALL" && r.classInfo.grade !== gradeFilter) return false;
    if (statusFilter === "DONE" && !r.score) return false;
    if (statusFilter === "PENDING" && r.score) return false;
    if (unassignedOnly && r.assignedJudgeEmails.length > 0) return false;
    return true;
  });

  const handleLock = () => {
    startTransition(async () => {
      const result = await lockRoundAction(round.roundId);
      if (result.ok) {
        toast({ variant: "success", title: "Đã khoá đợt chấm." });
        router.refresh();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  const handleReopen = (reason: string) => {
    startTransition(async () => {
      const result = await reopenRoundAction(round.roundId, reason);
      if (result.ok) {
        toast({ variant: "success", title: "Đã mở lại đợt chấm." });
        setReopenConfirm(false);
        router.refresh();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <div>
      <button
        onClick={() => router.push("/admin/scoring-rounds")}
        className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Đợt chấm
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{round.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateVN(round.startsAt)} · {formatTimeVN(round.startsAt)}–{formatTimeVN(round.endsAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              effectiveStatus === "OPEN" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
            )}
          >
            {ROUND_STATUS_LABEL[effectiveStatus]}
          </span>
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <a
            href={`/api/admin/export/xlsx?roundId=${round.roundId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Xuất Excel
          </a>
          {effectiveStatus === "OPEN" && (
            <Button variant="destructive" size="sm" onClick={handleLock} disabled={isPending}>
              <Lock className="h-3.5 w-3.5" />
              Khoá ngay
            </Button>
          )}
          {effectiveStatus === "LOCKED" && round.manuallyLockedAt && (
            <Button variant="outline" size="sm" onClick={() => setReopenConfirm(true)} disabled={isPending}>
              <Unlock className="h-3.5 w-3.5" />
              Mở lại
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatBox label="Đã chấm" value={`${doneCount}/${totalCount}`} />
        <StatBox label="Tiến độ" value={`${pct}%`} />
        <StatBox
          label="Phân công"
          value={`${assignedCount}/${totalCount} lớp`}
          tone={unassignedCount > 0 ? "warning" : undefined}
        />
        <StatBox label="Người chấm" value={String(assignments.length)} />
        <StatBox
          label="Thời gian còn lại"
          value={effectiveStatus === "OPEN" && msLeft > 0 ? formatCountdown(msLeft) : "—"}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {unassignedCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-[var(--radius)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Còn {unassignedCount} lớp chưa được phân công người chấm.
          </span>
          <button
            onClick={() => setUnassignedOnly(true)}
            className="shrink-0 font-medium text-warning underline"
          >
            Xem {unassignedCount} lớp chưa phân công
          </button>
        </div>
      )}

      <div className="mb-6">
        <AssignmentPanel
          roundId={round.roundId}
          classes={classes}
          judges={judges}
          assignments={assignments}
          isRoundOpen={effectiveStatus === "OPEN"}
          onChanged={() => router.refresh()}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value as Grade | "ALL")}
          className="h-9 rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
        >
          <option value="ALL">Tất cả khối</option>
          <option value="10">Khối 10</option>
          <option value="11">Khối 11</option>
          <option value="12">Khối 12</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "DONE" | "PENDING")}
          className="h-9 rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="DONE">Đã chấm</option>
          <option value="PENDING">Chưa chấm</option>
        </select>
        <button
          onClick={() => setUnassignedOnly((v) => !v)}
          className={cn(
            "h-9 rounded-[var(--radius)] border px-3 text-sm font-medium",
            unassignedOnly ? "border-warning bg-warning/10 text-warning" : "border-input bg-background",
          )}
        >
          Chỉ hiện lớp chưa phân công
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Lớp</th>
              <th className="px-3 py-2">Người được phân công</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Người chấm</th>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Điểm</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.classInfo.classId} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{row.classInfo.className}</td>
                <td className="px-3 py-2">
                  {row.assignedJudgeEmails.length > 0 ? (
                    <span className="text-xs">
                      {row.assignedJudgeEmails
                        .map((email) => judgeByEmail.get(email)?.name || email)
                        .join(", ")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      CHƯA PHÂN CÔNG
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.score ? (
                    <span className="text-success">✓ Đã chấm</span>
                  ) : (
                    <span className="text-muted-foreground">Chưa chấm</span>
                  )}
                </td>
                <td className="px-3 py-2">{row.score?.judgeName || row.score?.judgeEmail || "—"}</td>
                <td className="px-3 py-2">{row.score ? formatTimeVN(row.score.timestamp) : "—"}</td>
                <td className="px-3 py-2">
                  {row.score ? `${getEffectiveScore(row.score)}/${getEffectiveMaxScore(row.score)}` : "—"}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Không có lớp phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reopenConfirm && (
        <ReopenConfirmDialog
          onCancel={() => setReopenConfirm(false)}
          onConfirm={handleReopen}
          isPending={isPending}
        />
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border p-3",
        tone === "warning" ? "border-warning/30 bg-warning/5" : "border-border bg-card",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1.5 text-lg font-bold",
          tone === "warning" && "text-warning",
        )}
      >
        {icon}
        {value}
      </p>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ReopenConfirmDialog({
  onCancel,
  onConfirm,
  isPending,
}: {
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xác nhận mở lại đợt chấm</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Đợt chấm đã khoá thủ công sẽ được mở lại, cho phép người chấm submit tiếp. Hành động này sẽ được ghi vào
          nhật ký.
        </p>
        <div className="mt-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do mở lại (không bắt buộc)"
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={() => onConfirm(reason)} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận mở lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
