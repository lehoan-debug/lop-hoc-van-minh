"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { ROUND_STATUS_LABEL } from "@/lib/rounds/roundStatus";
import type { ClassConfig, EffectiveRoundStatus, Grade, ScoringRound, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

export function RoundClassPicker({
  round,
  effectiveStatus,
  classes,
  doneClassIds,
}: {
  round: ScoringRound;
  effectiveStatus: EffectiveRoundStatus;
  classes: ClassConfig[];
  doneClassIds: string[];
}) {
  const router = useRouter();
  const doneSet = React.useMemo(() => new Set(doneClassIds), [doneClassIds]);
  const grades = React.useMemo(
    () => Array.from(new Set(classes.map((c) => c.grade))).sort() as Grade[],
    [classes],
  );
  const [grade, setGrade] = React.useState<Grade | null>(grades[0] ?? null);

  const classesOfGrade = classes
    .filter((c) => c.grade === grade)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const locked = effectiveStatus !== "OPEN";

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3 sm:top-[var(--section-topbar-height)]">
        <button
          onClick={() => router.push("/judge")}
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách đợt chấm
        </button>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">{round.title}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateVN(round.startsAt)} · {formatTimeVN(round.startsAt)}–
              {formatTimeVN(round.endsAt)} · Buổi {SESSION_LABEL[round.session]}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              effectiveStatus === "OPEN" ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground",
            )}
          >
            {ROUND_STATUS_LABEL[effectiveStatus]}
          </span>
        </div>
      </header>

      <main className="p-4">
        {locked && (
          <div className="mb-4 flex items-center gap-2 rounded-[var(--radius)] bg-warning/10 p-3 text-sm text-warning">
            <Lock className="h-4 w-4 shrink-0" />
            Đợt chấm đã khoá — bạn chỉ có thể xem lại kết quả đã chấm, không thể chấm mới.
          </div>
        )}

        {grades.length > 1 && (
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Khối</h2>
            <div className="grid grid-cols-3 gap-2">
              {grades.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className={cn(
                    "h-14 rounded-[var(--radius)] text-lg font-semibold transition-colors",
                    grade === g
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground",
                  )}
                >
                  Khối {g}
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Chọn lớp</h2>
            <span className="text-xs text-muted-foreground">
              Đã chấm {classesOfGrade.filter((c) => doneSet.has(c.classId)).length}/
              {classesOfGrade.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {classesOfGrade.map((c) => {
              const done = doneSet.has(c.classId);
              return (
                <button
                  key={c.classId}
                  onClick={() => router.push(`/judge/${round.roundId}/${c.classId}`)}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center rounded-[var(--radius)] border text-sm font-semibold transition-colors",
                    done
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border bg-card text-foreground hover:bg-accent",
                  )}
                >
                  {done && <CheckCircle2 className="absolute right-1.5 top-1.5 h-4 w-4" />}
                  {c.className}
                </button>
              );
            })}
            {classesOfGrade.length === 0 && (
              <p className="col-span-3 text-sm text-muted-foreground">
                Không có lớp nào trong phạm vi được phân công.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
