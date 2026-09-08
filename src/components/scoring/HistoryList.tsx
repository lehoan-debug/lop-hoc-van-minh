"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import { CRITERIA_COUNT, type CriterionKey } from "@/types";
import type { AdjustmentRecord, CriterionSnapshotItem, ScoreRecord, CriterionConfig, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

export function HistoryList({
  scores,
  criteria,
  adjustments = [],
}: {
  scores: ScoreRecord[];
  criteria: CriterionConfig[];
  adjustments?: AdjustmentRecord[];
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
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

  if (scores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Bạn chưa chấm điểm lượt nào.</p>
    );
  }

  return (
    <div className="space-y-2">
      {scores.map((s) => {
        const open = openId === s.submissionId;
        const isV2 = !!s.roundId;
        let snapshot: CriterionSnapshotItem[] = [];
        if (isV2) {
          try {
            snapshot = JSON.parse(s.criteriaSnapshotJson || "[]");
          } catch {
            snapshot = [];
          }
        }
        let legacyNotes: { criterionNumber: number; note: string }[] = [];
        if (!isV2) {
          try {
            legacyNotes = JSON.parse(s.notesJson || "[]");
          } catch {
            legacyNotes = [];
          }
        }

        const dayTotals = bonusPenaltyByDateClass.get(`${s.date}__${s.classId}`);

        return (
          <div key={s.submissionId} className="rounded-[var(--radius)] border border-border bg-card">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setOpenId(open ? null : s.submissionId)}
            >
              <div>
                <p className="font-semibold">{s.className}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateVN(s.date)} · {formatTimeVN(s.timestamp)} · {SESSION_LABEL[s.session]}
                </p>
                {dayTotals && (dayTotals.bonus > 0 || dayTotals.penalty > 0) && (
                  <p className="text-xs">
                    {dayTotals.bonus > 0 && <span className="text-success">+{dayTotals.bonus}</span>}
                    {dayTotals.bonus > 0 && dayTotals.penalty > 0 && " / "}
                    {dayTotals.penalty > 0 && <span className="text-warning">-{dayTotals.penalty}</span>}
                    <span className="text-muted-foreground"> (cộng/trừ cả ngày)</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">
                  {getEffectiveScore(s)}/{isV2 ? getEffectiveMaxScore(s) : CRITERIA_COUNT}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </div>
            </button>
            {open && (
              <div className="space-y-1.5 border-t border-border px-4 py-3">
                {isV2
                  ? snapshot.map((item, i) => (
                      <div key={item.criterionId} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span>
                            {i + 1}. {item.name}
                          </span>
                          <span className={item.result === "PASS" ? "text-success" : "text-warning"}>
                            {item.result === "PASS" ? "Đạt" : "Không đạt"} (+{item.awardedScore})
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-xs italic text-muted-foreground">Ghi chú: {item.note}</p>
                        )}
                      </div>
                    ))
                  : criteria.map((c) => {
                      const ck = `c${c.criterionNumber}` as CriterionKey;
                      const val = s[ck];
                      const note = legacyNotes.find((n) => n.criterionNumber === c.criterionNumber)?.note;
                      return (
                        <div key={c.criterionId} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span>Tiêu chí {c.criterionNumber}</span>
                            <span className={val === 1 ? "text-success" : "text-warning"}>
                              {val === 1 ? "Đạt" : "Không đạt"}
                            </span>
                          </div>
                          {note && (
                            <p className="text-xs italic text-muted-foreground">Ghi chú: {note}</p>
                          )}
                        </div>
                      );
                    })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
