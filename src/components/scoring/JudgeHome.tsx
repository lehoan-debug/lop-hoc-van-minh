"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN } from "@/lib/timezone/timezone";
import type { ClassConfig, Grade, Session_ } from "@/types";

interface JudgeHomeProps {
  userName: string;
  userEmail: string;
  date: string;
  classes: ClassConfig[];
  grades: Grade[];
  scoredKeys: string[];
  defaultSession: Session_;
}

const SESSION_LABEL: Record<Session_, string> = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

export function JudgeHome({
  userName,
  date,
  classes,
  grades,
  scoredKeys,
  defaultSession,
}: JudgeHomeProps) {
  const router = useRouter();
  const [session, setSession] = React.useState<Session_>(defaultSession);
  const [grade, setGrade] = React.useState<Grade | null>(grades[0] ?? null);
  const scoredSet = React.useMemo(() => new Set(scoredKeys), [scoredKeys]);

  const classesOfGrade = React.useMemo(
    () => classes.filter((c) => c.grade === grade).sort((a, b) => a.sortOrder - b.sortOrder),
    [classes, grade],
  );

  const doneCount = classesOfGrade.filter((c) =>
    scoredSet.has(`${c.classId}__${session}`),
  ).length;

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Lớp học Văn minh</h1>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          Người chấm: <span className="text-foreground">{userName}</span> · Ngày:{" "}
          <span className="text-foreground">{formatDateVN(date)}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["MORNING", "AFTERNOON"] as Session_[]).map((s) => (
            <button
              key={s}
              onClick={() => setSession(s)}
              className={cn(
                "h-11 rounded-[var(--radius)] text-sm font-medium transition-colors",
                session === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              Buổi {SESSION_LABEL[s]}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4">
        <section>
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

        {grade && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Chọn lớp — Khối {grade}
              </h2>
              <span className="text-xs text-muted-foreground">
                Đã chấm {doneCount}/{classesOfGrade.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {classesOfGrade.map((c) => {
                const done = scoredSet.has(`${c.classId}__${session}`);
                return (
                  <button
                    key={c.classId}
                    onClick={() => router.push(`/judge/${c.classId}?session=${session}`)}
                    className={cn(
                      "relative flex h-16 flex-col items-center justify-center rounded-[var(--radius)] border text-sm font-semibold transition-colors",
                      done
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-border bg-card text-foreground hover:bg-accent",
                    )}
                  >
                    {done && (
                      <CheckCircle2 className="absolute right-1.5 top-1.5 h-4 w-4" />
                    )}
                    {c.className}
                  </button>
                );
              })}
              {classesOfGrade.length === 0 && (
                <p className="col-span-3 text-sm text-muted-foreground">
                  Không có lớp nào ở khối này.
                </p>
              )}
            </div>
          </section>
        )}

        {grades.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Tài khoản của bạn chưa được phân công khối nào để chấm điểm.
          </p>
        )}
      </main>
    </div>
  );
}
