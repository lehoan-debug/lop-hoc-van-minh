"use client";

import * as React from "react";
import { useTransition } from "react";
import { Users, School, Search, CheckSquare, Square, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  replaceUserAssignmentsAction,
  setClassAssigneesAction,
} from "@/lib/actions/roundActions";
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
  const [tab, setTab] = React.useState<"person" | "class">("person");

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
        </div>
      </div>

      {tab === "person" ? (
        <ByPersonTab
          roundId={roundId}
          classes={classes}
          judges={judges}
          assignments={assignments}
          isRoundOpen={isRoundOpen}
          onChanged={onChanged}
        />
      ) : (
        <ByClassTab
          roundId={roundId}
          classes={classes}
          judges={judges}
          assignments={assignments}
          isRoundOpen={isRoundOpen}
          onChanged={onChanged}
        />
      )}
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
}: {
  isRoundOpen: boolean;
  isPending: boolean;
  onSave: () => void;
  label: string;
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
    <Button size="sm" onClick={() => (isRoundOpen ? setConfirming(true) : onSave())} disabled={isPending}>
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
