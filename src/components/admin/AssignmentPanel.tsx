"use client";

import * as React from "react";
import { useTransition } from "react";
import {
  Users,
  School,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  replaceUserAssignmentsAction,
  setClassAssigneesAction,
  randomAssignAction,
} from "@/lib/actions/roundActions";
import { isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { distributeClassesSequentially } from "@/lib/rounds/sequentialAssign";
import type { AppUser, ClassConfig, Grade, ScoringRoundAssignment } from "@/types";

const GRADES: Grade[] = ["10", "11", "12"];

export function AssignmentPanel({
  roundId,
  classes,
  judges,
  assignments,
  isRoundOpen,
  onChanged,
}: {
  roundId: string;
  classes: ClassConfig[];
  judges: AppUser[];
  assignments: ScoringRoundAssignment[];
  isRoundOpen: boolean;
  onChanged: () => void;
}) {
  const [tab, setTab] = React.useState<"person" | "class" | "random" | "excel">("person");

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4">
      {isRoundOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius)] border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Đợt chấm đang diễn ra. Thay đổi phân công sẽ có hiệu lực ngay.
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Phân công người chấm</h2>
        <div className="flex rounded-[var(--radius)] border border-border p-0.5 text-sm">
          <button
            onClick={() => setTab("person")}
            className={cn(
              "flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5",
              tab === "person" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Theo người
          </button>
          <button
            onClick={() => setTab("class")}
            className={cn(
              "flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5",
              tab === "class" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <School className="h-3.5 w-3.5" />
            Theo lớp
          </button>
          <button
            onClick={() => setTab("random")}
            className={cn(
              "flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5",
              tab === "random" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Chia liên tiếp
          </button>
          <button
            onClick={() => setTab("excel")}
            className={cn(
              "flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3 py-1.5",
              tab === "excel" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Nhập Excel
          </button>
        </div>
      </div>

      {tab === "person" && (
        <ByPersonTab
          roundId={roundId}
          classes={classes}
          judges={judges}
          assignments={assignments}
          isRoundOpen={isRoundOpen}
          onChanged={onChanged}
        />
      )}
      {tab === "class" && (
        <ByClassTab
          roundId={roundId}
          classes={classes}
          judges={judges}
          assignments={assignments}
          isRoundOpen={isRoundOpen}
          onChanged={onChanged}
        />
      )}
      {tab === "random" && (
        <RandomAssignTab
          roundId={roundId}
          classes={classes}
          judges={judges}
          assignments={assignments}
          isRoundOpen={isRoundOpen}
          onChanged={onChanged}
        />
      )}
      {tab === "excel" && <ImportExcelTab roundId={roundId} onChanged={onChanged} />}
    </div>
  );
}

/** Nút Lưu — khi Đợt chấm đang OPEN, bắt xác nhận thêm 1 bước trước khi ghi
 * (mục 21: thay đổi phân công lúc đợt đang diễn ra có hiệu lực NGAY). */
function SaveButton({
  isRoundOpen,
  isPending,
  onSave,
  label,
  disabled = false,
}: {
  isRoundOpen: boolean;
  isPending: boolean;
  onSave: () => void;
  label: string;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = React.useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs font-medium text-warning">Xác nhận áp dụng ngay?</span>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
          Huỷ
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setConfirming(false);
            onSave();
          }}
          disabled={isPending}
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Xác nhận lưu
        </Button>
      </span>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => (isRoundOpen ? setConfirming(true) : onSave())}
      disabled={isPending || disabled}
    >
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {label}
    </Button>
  );
}

// ---------- Tab: Theo người ----------

function ByPersonTab({
  roundId,
  classes,
  judges,
  assignments,
  isRoundOpen,
  onChanged,
}: {
  roundId: string;
  classes: ClassConfig[];
  judges: AppUser[];
  assignments: ScoringRoundAssignment[];
  isRoundOpen: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const assignmentByEmail = new Map(assignments.map((a) => [a.userEmail, a]));

  const [selectedEmail, setSelectedEmail] = React.useState(judges[0]?.email ?? "");
  const [gradeFilter, setGradeFilter] = React.useState<Grade | "ALL">("ALL");
  const [checked, setChecked] = React.useState<Set<string>>(
    () => new Set(assignmentByEmail.get(selectedEmail)?.allowedClassIds ?? []),
  );

  // Đổi người -> nạp lại danh sách lớp đã tick của người đó (không giữ state cũ).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(new Set(assignmentByEmail.get(selectedEmail)?.allowedClassIds ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmail]);

  const visibleClasses = classes
    .filter((c) => gradeFilter === "ALL" || c.grade === gradeFilter)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const toggleClass = (classId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setChecked((prev) => new Set([...prev, ...visibleClasses.map((c) => c.classId)]));
  };
  const clearAllVisible = () => {
    const visibleIds = new Set(visibleClasses.map((c) => c.classId));
    setChecked((prev) => new Set([...prev].filter((id) => !visibleIds.has(id))));
  };
  const clearAll = () => setChecked(new Set());

  const copyFrom = (email: string) => {
    const source = assignmentByEmail.get(email);
    if (!source) return;
    setChecked(new Set(source.allowedClassIds));
    toast({ variant: "info", title: `Đã sao chép phân công từ ${email}. Nhớ bấm Lưu.` });
  };

  const handleSave = () => {
    if (!selectedEmail) return;
    startTransition(async () => {
      const result = await replaceUserAssignmentsAction({
        roundId,
        userEmail: selectedEmail,
        classIds: Array.from(checked),
      });
      if (result.ok) {
        toast({ variant: "success", title: "Đã lưu phân công." });
        onChanged();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  if (judges.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có Giám khảo nào trong hệ thống.</p>;
  }

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Người chấm</label>
          <select
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            className="mt-1 h-9 w-full rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
          >
            {judges.map((j) => {
              const count = assignmentByEmail.get(j.email)?.allowedClassIds.length ?? 0;
              return (
                <option key={j.email} value={j.email}>
                  {j.name || j.email} ({count} lớp)
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Sao chép phân công từ</label>
          <select
            value=""
            onChange={(e) => e.target.value && copyFrom(e.target.value)}
            className="mt-1 h-9 w-full rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
          >
            <option value="">— Chọn người để sao chép —</option>
            {judges
              .filter((j) => j.email !== selectedEmail)
              .map((j) => (
                <option key={j.email} value={j.email}>
                  {j.name || j.email}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setGradeFilter("ALL")}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs font-medium",
            gradeFilter === "ALL" ? "border-primary bg-primary/10 text-primary" : "border-border",
          )}
        >
          Tất cả khối
        </button>
        {GRADES.map((g) => (
          <button
            key={g}
            onClick={() => setGradeFilter(g)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              gradeFilter === g ? "border-primary bg-primary/10 text-primary" : "border-border",
            )}
          >
            Khối {g}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          onClick={selectAllVisible}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium"
        >
          <CheckSquare className="h-3 w-3" />
          Chọn tất cả{gradeFilter !== "ALL" ? ` khối ${gradeFilter}` : ""}
        </button>
        <button
          onClick={clearAllVisible}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium"
        >
          <Square className="h-3 w-3" />
          Bỏ chọn{gradeFilter !== "ALL" ? ` khối ${gradeFilter}` : ""}
        </button>
      </div>

      <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto rounded-[var(--radius)] border border-border p-2 sm:grid-cols-5">
        {visibleClasses.map((c) => {
          const isChecked = checked.has(c.classId);
          return (
            <button
              key={c.classId}
              type="button"
              onClick={() => toggleClass(c.classId)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-medium",
                isChecked ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground",
              )}
            >
              {c.className}
            </button>
          );
        })}
        {visibleClasses.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">Không có lớp nào.</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={clearAll}
          disabled={isPending}
          className="flex items-center gap-1 text-xs font-medium text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          Xoá tất cả phân công của người này
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Đã chọn {checked.size} lớp</span>
          <SaveButton
            isRoundOpen={isRoundOpen}
            isPending={isPending}
            onSave={handleSave}
            label="Lưu phân công"
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Tab: Theo lớp ----------

function ByClassTab({
  roundId,
  classes,
  judges,
  assignments,
  isRoundOpen,
  onChanged,
}: {
  roundId: string;
  classes: ClassConfig[];
  judges: AppUser[];
  assignments: ScoringRoundAssignment[];
  isRoundOpen: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const sortedClasses = [...classes].sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedClassId, setSelectedClassId] = React.useState(sortedClasses[0]?.classId ?? "");
  const [query, setQuery] = React.useState("");

  const selectedClass = classes.find((c) => c.classId === selectedClassId);

  const assignedEmailsForClass = React.useMemo(() => {
    if (!selectedClass) return new Set<string>();
    return new Set(
      assignments
        .filter(
          (a) =>
            a.allowedClassIds.includes(selectedClass.classId) ||
            a.allowedGradeIds.includes(selectedClass.grade),
        )
        .map((a) => a.userEmail),
    );
  }, [assignments, selectedClass]);

  const [checked, setChecked] = React.useState<Set<string>>(assignedEmailsForClass);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(assignedEmailsForClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  const filteredJudges = judges.filter(
    (j) =>
      j.name.toLowerCase().includes(query.toLowerCase()) ||
      j.email.toLowerCase().includes(query.toLowerCase()),
  );

  const toggleJudge = (email: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleSave = () => {
    if (!selectedClassId) return;
    startTransition(async () => {
      const result = await setClassAssigneesAction({
        roundId,
        classId: selectedClassId,
        userEmails: Array.from(checked),
      });
      if (result.ok) {
        toast({ variant: "success", title: "Đã lưu phân công." });
        onChanged();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  if (classes.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có lớp nào trong phạm vi Đợt chấm.</p>;
  }

  return (
    <div>
      <div className="mb-3">
        <label className="text-xs font-medium text-muted-foreground">Lớp</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="mt-1 h-9 w-full rounded-[var(--radius)] border border-input bg-background px-2 text-sm sm:w-64"
        >
          {sortedClasses.map((c) => (
            <option key={c.classId} value={c.classId}>
              {c.className}
            </option>
          ))}
        </select>
      </div>

      {checked.size > 1 && (
        <p className="mb-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
          Lớp {selectedClass?.className} đang được phân công cho {checked.size} người. Người submit
          đầu tiên sẽ tạo kết quả chính thức.
        </p>
      )}

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm người chấm theo tên/email"
          className="pl-8"
        />
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-border p-2">
        {filteredJudges.map((j) => {
          const isChecked = checked.has(j.email);
          return (
            <button
              key={j.email}
              type="button"
              onClick={() => toggleJudge(j.email)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                isChecked ? "bg-primary/10 text-primary" : "hover:bg-accent",
              )}
            >
              <span>{j.name || j.email}</span>
              <span className="text-xs text-muted-foreground">{j.email}</span>
            </button>
          );
        })}
        {filteredJudges.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted-foreground">Không tìm thấy.</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">Đã chọn {checked.size} người</span>
        <SaveButton isRoundOpen={isRoundOpen} isPending={isPending} onSave={handleSave} label="Lưu" />
      </div>
    </div>
  );
}

// ---------- Tab: Chia liên tiếp theo khối ----------

type SequentialMode = "auto" | "fixed";

function RandomAssignTab({
  roundId,
  classes,
  judges,
  assignments,
  isRoundOpen,
  onChanged,
}: {
  roundId: string;
  classes: ClassConfig[];
  judges: AppUser[];
  assignments: ScoringRoundAssignment[];
  isRoundOpen: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [gradeFilter, setGradeFilter] = React.useState<Grade | null>(null);
  const [query, setQuery] = React.useState("");
  const [selectedJudges, setSelectedJudges] = React.useState<Set<string>>(new Set());
  const [mode, setMode] = React.useState<SequentialMode>("auto");
  const [fixedCount, setFixedCount] = React.useState(3);

  const unassignedClasses = React.useMemo(() => {
    if (!gradeFilter) return [];
    return classes
      .filter((c) => c.grade === gradeFilter)
      .filter((c) => !assignments.some((a) => isClassInAssignmentScope(a, c.classId, c.grade)))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [classes, assignments, gradeFilter]);

  const classNameById = React.useMemo(() => new Map(classes.map((c) => [c.classId, c.className])), [classes]);
  const judgeByEmail = React.useMemo(() => new Map(judges.map((j) => [j.email, j])), [judges]);

  const filteredJudges = judges.filter(
    (j) =>
      j.name.toLowerCase().includes(query.toLowerCase()) ||
      j.email.toLowerCase().includes(query.toLowerCase()),
  );

  const toggleJudge = (email: string) => {
    setSelectedJudges((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  // Xếp theo tên A-Z để có thứ tự CỐ ĐỊNH, dễ giải thích (người đầu tiên
  // theo tên luôn nhận các lớp đầu tiên theo thứ tự sortOrder).
  const orderedJudgeEmails = React.useMemo(
    () =>
      judges
        .filter((j) => selectedJudges.has(j.email))
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))
        .map((j) => j.email),
    [judges, selectedJudges],
  );
  const selectedCount = orderedJudgeEmails.length;

  const preview = React.useMemo(() => {
    if (selectedCount === 0 || unassignedClasses.length === 0) return null;
    return distributeClassesSequentially(
      unassignedClasses.map((c) => c.classId),
      orderedJudgeEmails,
      mode === "auto" ? "auto" : fixedCount,
    );
  }, [unassignedClasses, orderedJudgeEmails, mode, fixedCount, selectedCount]);

  const handleRun = () => {
    if (!gradeFilter || selectedCount === 0 || unassignedClasses.length === 0) return;
    startTransition(async () => {
      const result = await randomAssignAction({
        roundId,
        judgeEmails: orderedJudgeEmails,
        gradeFilter,
        classesPerJudge: mode === "auto" ? "auto" : fixedCount,
      });
      if (result.ok) {
        const extra =
          result.data.unassignedRemainingCount > 0
            ? ` Còn ${result.data.unassignedRemainingCount} lớp chưa đủ người nhận.`
            : "";
        toast({
          variant: "success",
          title: `Đã phân công ${result.data.assignedClassCount} lớp cho ${selectedCount} người.${extra}`,
        });
        setSelectedJudges(new Set());
        onChanged();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Chia các lớp <strong>CHƯA có ai phụ trách</strong> thành từng khối LIÊN TIẾP theo đúng thứ
        tự (vd. 10A1–10A3, 10A4–10A6...) cho từng người — không ngắt quãng, không đụng lớp đã có
        người phân công. Phải chọn đúng 1 khối vì 1 người không được chấm 2 khối khác nhau.
      </p>

      <div className="mb-3">
        <label className="text-xs font-medium text-muted-foreground">Khối (bắt buộc chọn 1)</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                gradeFilter === g ? "border-primary bg-primary/10 text-primary" : "border-border",
              )}
            >
              Khối {g}
            </button>
          ))}
        </div>
      </div>

      {gradeFilter && (
        <>
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground">Cách chia</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                onClick={() => setMode("auto")}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  mode === "auto" ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                Chia đều
              </button>
              <button
                onClick={() => setMode("fixed")}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  mode === "fixed" ? "border-primary bg-primary/10 text-primary" : "border-border",
                )}
              >
                Số lớp/người cố định
              </button>
            </div>
            {mode === "fixed" && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={fixedCount}
                  onChange={(e) => setFixedCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">lớp/người</span>
              </div>
            )}
          </div>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm người chấm theo tên/email"
              className="pl-8"
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-border p-2">
            {filteredJudges.map((j) => {
              const isChecked = selectedJudges.has(j.email);
              return (
                <button
                  key={j.email}
                  type="button"
                  onClick={() => toggleJudge(j.email)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                    isChecked ? "bg-primary/10 text-primary" : "hover:bg-accent",
                  )}
                >
                  <span>{j.name || j.email}</span>
                  <span className="text-xs text-muted-foreground">{j.email}</span>
                </button>
              );
            })}
            {filteredJudges.length === 0 && (
              <p className="px-2 py-2 text-sm text-muted-foreground">Không tìm thấy.</p>
            )}
          </div>

          {unassignedClasses.length === 0 && (
            <p className="mt-3 rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
              Không còn lớp nào chưa phân công trong khối {gradeFilter}.
            </p>
          )}

          {preview && (
            <div className="mt-3 space-y-1.5 rounded-[var(--radius)] border border-border p-3">
              <p className="text-xs font-semibold">
                Xem trước (thứ tự theo tên A-Z, lớp theo thứ tự {gradeFilter}A1, {gradeFilter}A2...):
              </p>
              {orderedJudgeEmails.map((email) => {
                const classIds = preview.byJudge.get(email) ?? [];
                const judge = judgeByEmail.get(email);
                return (
                  <div key={email} className="flex items-start justify-between gap-3 text-xs">
                    <span className="shrink-0">{judge?.name || email}</span>
                    <span className="text-right font-medium">
                      {classIds.length === 0
                        ? "— (0 lớp)"
                        : classIds.map((id) => classNameById.get(id) ?? id).join(", ")}
                    </span>
                  </div>
                );
              })}
              {preview.unassignedClassIds.length > 0 && (
                <p className="mt-1.5 flex items-start gap-1 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  Chưa đủ người nhận {preview.unassignedClassIds.length} lớp:{" "}
                  {preview.unassignedClassIds.map((id) => classNameById.get(id) ?? id).join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Đã chọn {selectedCount} người</span>
            <SaveButton
              isRoundOpen={isRoundOpen}
              isPending={isPending}
              onSave={handleRun}
              label="Áp dụng phân công"
              disabled={selectedCount === 0 || unassignedClasses.length === 0}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Tab: Nhập Excel ----------

interface ImportError {
  rowIndex: number;
  personRaw: string;
  classRaw: string;
  reason: string;
}

interface ImportResult {
  totalRows: number;
  importedCount: number;
  errorCount: number;
  errors: ImportError[];
}

function ImportExcelTab({ roundId, onChanged }: { roundId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/scoring-rounds/${roundId}/import-assignments`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        toast({ variant: "error", title: data.error ?? "Không thể nhập dữ liệu." });
        return;
      }
      setResult(data);
      if (data.importedCount > 0) {
        toast({ variant: "success", title: `Đã nhập ${data.importedCount} dòng phân công.` });
        onChanged();
      }
      if (data.errorCount > 0) {
        toast({
          variant: data.importedCount > 0 ? "info" : "error",
          title: `${data.errorCount} dòng lỗi, xem chi tiết bên dưới.`,
        });
      }
    } catch {
      toast({ variant: "error", title: "Lỗi kết nối. Vui lòng thử lại." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        File Excel (.xlsx) có 2 cột, bắt đầu từ dòng 2 (dòng 1 là tiêu đề): cột A = Người chấm
        (email hoặc tên), cột B = Tên lớp. Phân công mới sẽ được CỘNG THÊM vào phân công hiện có,
        không xoá gì cả.
      </p>

      <a
        href={`/api/admin/scoring-rounds/${roundId}/import-template`}
        className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
      >
        <Download className="h-3.5 w-3.5" />
        Tải file mẫu (đã điền sẵn danh sách lớp &amp; người chấm của đợt này)
      </a>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="text-sm"
        />
        <Button size="sm" onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Tải lên &amp; Nhập
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              Tổng {result.totalRows} dòng dữ liệu
            </span>
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="h-4 w-4" />
              {result.importedCount} dòng nhập thành công
            </span>
            {result.errorCount > 0 && (
              <span className="flex items-center gap-1.5 text-destructive">
                <XCircle className="h-4 w-4" />
                {result.errorCount} dòng lỗi
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-[var(--radius)] border border-destructive/30">
              <table className="w-full text-xs">
                <thead className="bg-destructive/5 text-left text-destructive">
                  <tr>
                    <th className="px-2 py-1.5">Dòng</th>
                    <th className="px-2 py-1.5">Người chấm</th>
                    <th className="px-2 py-1.5">Lớp</th>
                    <th className="px-2 py-1.5">Lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1.5">{e.rowIndex}</td>
                      <td className="px-2 py-1.5">{e.personRaw || "—"}</td>
                      <td className="px-2 py-1.5">{e.classRaw || "—"}</td>
                      <td className="px-2 py-1.5">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
