"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Clock, Lock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { ROUND_STATUS_LABEL, msUntilRoundEnds } from "@/lib/rounds/roundStatus";
import type { EffectiveRoundStatus, ScoringRound, Session_ } from "@/types";

export interface RoundWithProgress {
  round: ScoringRound;
  effectiveStatus: EffectiveRoundStatus;
  assignedClassesCount: number;
  doneCount: number;
}

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

export function JudgeRoundsHome({
  userName,
  items,
  canManageRounds,
}: {
  userName: string;
  items: RoundWithProgress[];
  canManageRounds: boolean;
}) {
  const open = items.filter((i) => i.effectiveStatus === "OPEN");
  const scheduled = items.filter((i) => i.effectiveStatus === "SCHEDULED");
  const history = items.filter(
    (i) => i.effectiveStatus === "LOCKED" || i.effectiveStatus === "CANCELLED",
  );

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Image src="/logo-fpt-schools.png" alt="FPT Schools" width={110} height={48} className="h-6 w-auto" />
          <h1 className="text-base font-semibold">Lớp học Văn minh</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Xin chào, <span className="text-foreground">{userName}</span>
        </p>
      </header>

      <main className="space-y-6 p-4">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Đợt chấm đang mở</h2>
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground">Hiện không có đợt chấm nào đang mở.</p>
          )}
          <div className="space-y-3">
            {open.map((item) => (
              <RoundCard key={item.round.roundId} item={item} />
            ))}
          </div>
        </section>

        {scheduled.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Sắp diễn ra</h2>
            <div className="space-y-2">
              {scheduled.map((item) => (
                <div
                  key={item.round.roundId}
                  className="rounded-[var(--radius)] border border-border bg-card p-3"
                >
                  <p className="font-medium">{item.round.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateVN(item.round.startsAt)} · {formatTimeVN(item.round.startsAt)} –{" "}
                    {formatTimeVN(item.round.endsAt)} · Buổi {SESSION_LABEL[item.round.session]}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Đã kết thúc</h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((item) => (
                <Link
                  key={item.round.roundId}
                  href={`/judge/${item.round.roundId}`}
                  className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.round.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateVN(item.round.startsAt)} · Đã chấm {item.doneCount}/
                      {item.assignedClassesCount}
                    </p>
                  </div>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {items.length === 0 && (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Bạn chưa được phân công vào Đợt chấm nào.</p>
            {canManageRounds && (
              <Link
                href="/admin/scoring-rounds"
                className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                <Settings className="h-3.5 w-3.5" />
                Vào Đợt chấm để tự phân công cho mình
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function RoundCard({ item }: { item: RoundWithProgress }) {
  const { round, doneCount, assignedClassesCount } = item;
  const [msLeft, setMsLeft] = React.useState(() => msUntilRoundEnds(round));

  React.useEffect(() => {
    const t = setInterval(() => setMsLeft(msUntilRoundEnds(round)), 1000);
    return () => clearInterval(t);
  }, [round]);

  const complete = assignedClassesCount > 0 && doneCount >= assignedClassesCount;

  return (
    <Link
      href={`/judge/${round.roundId}`}
      className="block rounded-[var(--radius)] border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{round.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateVN(round.startsAt)} · {formatTimeVN(round.startsAt)} –{" "}
            {formatTimeVN(round.endsAt)} · Buổi {SESSION_LABEL[round.session]}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-success/10 text-success",
          )}
        >
          {ROUND_STATUS_LABEL.OPEN}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className={cn("text-sm", complete ? "text-success" : "text-foreground")}>
          Đã chấm: {doneCount}/{assignedClassesCount} lớp được phân công
        </p>
        {msLeft > 0 && (
          <p className="flex items-center gap-1 text-sm font-medium text-warning">
            <Clock className="h-3.5 w-3.5" />
            Còn {formatCountdown(msLeft)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end text-sm font-medium text-primary">
        Tiếp tục chấm
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
