"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { CRITERIA_COUNT, type CriterionKey } from "@/types";
import type { ScoreRecord, CriterionConfig, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

export function HistoryList({
  scores,
  criteria,
}: {
  scores: ScoreRecord[];
  criteria: CriterionConfig[];
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (scores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Bạn chưa chấm điểm lượt nào.</p>
    );
  }

  return (
    <div className="space-y-2">
      {scores.map((s) => {
        const open = openId === s.submissionId;
        let notes: { criterionNumber: number; note: string }[] = [];
        try {
          notes = JSON.parse(s.notesJson || "[]");
        } catch {
          notes = [];
        }
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
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">
                  {s.totalCriteriaScore}/{CRITERIA_COUNT}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </div>
            </button>
            {open && (
              <div className="space-y-1.5 border-t border-border px-4 py-3">
                {criteria.map((c) => {
                  const ck = `c${c.criterionNumber}` as CriterionKey;
                  const val = s[ck];
                  const note = notes.find((n) => n.criterionNumber === c.criterionNumber)?.note;
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
