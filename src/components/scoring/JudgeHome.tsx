"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GraduationCap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, isTimeWithinRange } from "@/lib/timezone/timezone";
import type { ClassConfig, Grade, Session_ } from "@/types";

interface SessionWindow {
  start: string;
  end: string;
}

interface JudgeHomeProps {
  userName: string;
  userEmail: string;
  date: string;
  classes: ClassConfig[];
  grades: Grade[];
  scoredKeys: string[];
  defaultSession: Session_;
  /** Giờ hiện tại (HH:mm, giờ Việt Nam) tại thời điểm render trang — chỉ
   * dùng để CẢNH BÁO (không chặn) khi ngoài khung giờ đề xuất. Xem
   * BUSINESS_RULES_REVIEW.md mục 4: người chấm luôn tự xác nhận buổi, hệ
   * thống không tự suy ra/khoá buổi chấm theo giờ nộp bài. */
  currentTime: string;
  sessionWindows: Record<Session_, SessionWindow>;
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
  currentTime,
  sessionWindows,
}: JudgeHomeProps) {
  const router = useRouter();
  const [session, setSession] = React.useState<Session_>(defaultSession);
  const [grade, setGrade] = React.useState<Grade | null>(grades[0] ?? null);
  const scoredSet = React.useMemo(() => new Set(scoredKeys), [scoredKeys]);

  const window_ = sessionWindows[session];
  const isOutsideWindow =
    !!window_.start &&
    !!window_.end &&
    !isTimeWithinRange(currentTime, window_.start, window_.end);

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

        {isOutsideWindow && (
          <p className="mt-2 flex items-start gap-1.5 rounded-[var(--radius)] bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Hiện tại ({currentTime}) nằm ngoài khung giờ đề xuất cho buổi {SESSION_LABEL[session]}
            {" "}({window_.start}–{window_.end}). Bạn vẫn có thể tiếp tục nếu đang chấm đúng buổi này.
          </p>
        )}
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
