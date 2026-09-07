"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { School, Trophy, Award, ThumbsDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { CriterionFailureStat } from "@/lib/admin/aggregate";
import type {
  ClassConfig,
  CriterionConfig,
  CriterionSnapshotItem,
  DailyScoreCombineModeSetting,
  ScoreRecord,
} from "@/types";

export function HomeroomDashboard({
  classInfo,
  myClasses,
  combineMode,
  todayLabel,
  todayScores,
  monthScores,
  ranking,
  totalRankedInGrade,
  failureStats,
  bonusTotal,
  penaltyTotal,
  criteria,
}: {
  classInfo: ClassConfig;
  myClasses: ClassConfig[];
  combineMode: DailyScoreCombineModeSetting;
  todayLabel: string;
  todayScores: ScoreRecord[];
  monthScores: ScoreRecord[];
  ranking: ClassRankingResult | null;
  totalRankedInGrade: number;
  failureStats: CriterionFailureStat[];
  bonusTotal: number;
  penaltyTotal: number;
  criteria: CriterionConfig[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);

  const todayTotal = todayScores.reduce((sum, s) => sum + getEffectiveScore(s), 0);
  const todayMax = todayScores.reduce((sum, s) => sum + getEffectiveMaxScore(s), 0);

  return (
    <div className="mx-auto max-w-lg p-4 pb-8">
      <div className="mb-4 flex items-center gap-2">
        <School className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Lớp chủ nhiệm</h1>
      </div>

      {myClasses.length > 1 && (
        <select
          value={classInfo.classId}
          onChange={(e) => router.push(`/homeroom?classId=${e.target.value}`)}
          className="mb-4 h-10 w-full rounded-[var(--radius)] border border-input bg-background px-3 text-sm"
        >
          {myClasses.map((c) => (
            <option key={c.classId} value={c.classId}>
              {c.className}
            </option>
          ))}
        </select>
      )}

      <div className="mb-4 rounded-[var(--radius)] border border-border bg-card p-4 text-center">
        <p className="text-2xl font-bold">{classInfo.className}</p>
        <p className="text-sm text-muted-foreground">Khối {classInfo.grade}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius)] border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Điểm hôm nay ({todayLabel})</p>
          <p className="mt-1 text-xl font-bold">
            {todayScores.length > 0 ? `${todayTotal}/${todayMax}` : "Chưa có"}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Xếp hạng tháng</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold">
            <Trophy className="h-4 w-4 text-warning" />
            {ranking ? `${ranking.rank}/${totalRankedInGrade}` : "—"}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Điểm cộng tháng</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold text-success">
            <Award className="h-4 w-4" />+{bonusTotal}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Điểm trừ tháng</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold text-destructive">
            <ThumbsDown className="h-4 w-4" />-{penaltyTotal}
          </p>
        </div>
      </div>

      {combineMode === "UNCONFIRMED" && (
        <p className="mb-4 text-xs text-muted-foreground">
          * Công thức điểm ngày chưa được BTC xác nhận — điểm hiển thị mang tính tham khảo.
        </p>
      )}

      {failureStats.length > 0 && (
        <div className="mb-4 rounded-[var(--radius)] border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Tiêu chí thường không đạt (tháng này)</h2>
          <div className="space-y-1.5">
            {failureStats.slice(0, 5).map((s) => (
              <div key={s.criterionId} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate">{s.criterionName}</span>
                <span className="shrink-0 font-semibold text-warning">{s.failCount} lần</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Lịch sử chấm điểm</h2>
        <div className="space-y-2">
          {monthScores.map((s) => {
            const open = openId === s.submissionId;
            let snapshot: CriterionSnapshotItem[] = [];
            if (s.roundId) {
              try {
                snapshot = JSON.parse(s.criteriaSnapshotJson || "[]");
              } catch {
                snapshot = [];
              }
            }
            return (
              <div key={s.submissionId} className="rounded-md border border-border">
                <button
                  onClick={() => setOpenId(open ? null : s.submissionId)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                >
                  <span>
                    {formatDateVN(s.date)} · {formatTimeVN(s.timestamp)}
                  </span>
                  <span className="flex items-center gap-2">
                    <strong>
                      {getEffectiveScore(s)}/{getEffectiveMaxScore(s)}
                    </strong>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                  </span>
                </button>
                {open && (
                  <div className="space-y-1 border-t border-border px-3 py-2 text-xs">
                    {s.roundId
                      ? snapshot.map((item) => (
                          <div key={item.criterionId} className="flex items-center justify-between">
                            <span>{item.name}</span>
                            <span className={item.result === "PASS" ? "text-success" : "text-warning"}>
                              {item.result === "PASS" ? "Đạt" : "Không đạt"}
                            </span>
                          </div>
                        ))
                      : criteria.map((c) => (
                          <div key={c.criterionId} className="flex items-center justify-between">
                            <span>Tiêu chí {c.criterionNumber}</span>
                            <span
                              className={
                                s[`c${c.criterionNumber}` as "c1"] === 1 ? "text-success" : "text-warning"
                              }
                            >
                              {s[`c${c.criterionNumber}` as "c1"] === 1 ? "Đạt" : "Không đạt"}
                            </span>
                          </div>
                        ))}
                  </div>
                )}
              </div>
            );
          })}
          {monthScores.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu chấm điểm trong tháng.</p>
          )}
        </div>
      </div>
    </div>
  );
}
