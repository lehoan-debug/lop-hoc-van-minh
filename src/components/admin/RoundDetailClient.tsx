"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowLeft,
  Lock,
  Unlock,
  RefreshCw,
  UserPlus,
  X,
  Loader2,
  Clock,
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  lockRoundAction,
  reopenRoundAction,
  assignJudgeAction,
  removeJudgeAction,
} from "@/lib/actions/roundActions";
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
  classes: _classes,
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
  void _classes;
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = React.useState(() => new Date());
  const [gradeFilter, setGradeFilter] = React.useState<Grade | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "DONE" | "PENDING">("ALL");
  const [addingJudge, setAddingJudge] = React.useState(false);
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

  const filteredRows = classRows.filter((r) => {
    if (gradeFilter !== "ALL" && r.classInfo.grade !== gradeFilter) return false;
    if (statusFilter === "DONE" && !r.score) return false;
    if (statusFilter === "PENDING" && r.score) return false;
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

  const handleRemoveJudge = (email: string) => {
    startTransition(async () => {
      const result = await removeJudgeAction(round.roundId, email);
      if (result.ok) {
        toast({ variant: "success", title: "Đã gỡ người chấm." });
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

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Đã chấm" value={`${doneCount}/${totalCount}`} />
        <StatBox label="Tiến độ" value={`${pct}%`} />
        <StatBox label="Người chấm" value={String(assignments.length)} />
        <StatBox
          label="Thời gian còn lại"
          value={effectiveStatus === "OPEN" && msLeft > 0 ? formatCountdown(msLeft) : "—"}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="mb-6 rounded-[var(--radius)] border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Người được phân công</h2>
          <Button size="sm" variant="outline" onClick={() => setAddingJudge(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Thêm
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {assignments.map((a) => {
            const j = judgeByEmail.get(a.userEmail);
            return (
              <span
                key={a.assignmentId}
                className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-3 pr-1.5 text-sm"
              >
                {j?.name || a.userEmail}
                <button
                  onClick={() => handleRemoveJudge(a.userEmail)}
                  disabled={isPending}
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa phân công người chấm nào.</p>
          )}
        </div>
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
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Lớp</th>
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
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Không có lớp phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addingJudge && (
        <AddJudgeDialog
          roundId={round.roundId}
          judges={judges}
          assignedEmails={assignments.map((a) => a.userEmail)}
          onClose={() => {
            setAddingJudge(false);
            router.refresh();
          }}
        />
      )}

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
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-bold">
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

function AddJudgeDialog({
  roundId,
  judges,
  assignedEmails,
  onClose,
}: {
  roundId: string;
  judges: AppUser[];
  assignedEmails: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = React.useState("");
  const assignedSet = new Set(assignedEmails);
  const candidates = judges.filter(
    (j) =>
      !assignedSet.has(j.email) &&
      (j.name.toLowerCase().includes(query.toLowerCase()) ||
        j.email.toLowerCase().includes(query.toLowerCase())),
  );

  const handleAdd = (email: string) => {
    startTransition(async () => {
      const result = await assignJudgeAction({ roundId, userEmail: email });
      if (result.ok) {
        toast({ variant: "success", title: "Đã thêm người chấm." });
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm người chấm</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên/email" className="pl-8" />
        </div>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {candidates.map((j) => (
            <button
              key={j.email}
              disabled={isPending}
              onClick={() => handleAdd(j.email)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span>{j.name || j.email}</span>
              <span className="text-xs text-muted-foreground">{j.email}</span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="px-2 py-2 text-sm text-muted-foreground">Không còn ai để thêm.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
