"use client";

import * as React from "react";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import type { CriterionConfig, CriterionSnapshotItem, ScoreRecord } from "@/types";

/** Danh sách lịch sử chấm điểm dạng accordion — bấm vào 1 lượt chấm để xem
 * chi tiết từng tiêu chí (Đạt/Không đạt) + ghi chú. Dùng chung cho màn hình
 * GVCN (`HomeroomDashboard`, `showJudge=false`) và Admin
 * (`ClassDetailView`, `showJudge=true` — BTC cần biết ai đã chấm). */
export function ScoreHistoryList({
  scores,
  criteria,
  roundTitleById,
  showJudge = false,
}: {
  scores: ScoreRecord[];
  criteria: CriterionConfig[];
  /** roundId -> tên Đợt chấm. Bản ghi V1 cũ (không gắn Đợt chấm) không có
   * trong map này. */
  roundTitleById: Record<string, string>;
  showJudge?: boolean;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (scores.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu chấm điểm trong tháng.</p>;
  }

  return (
    <div className="space-y-2">
      {scores.map((s) => {
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
              <div>
                <p className="font-medium">
                  {s.roundId ? (roundTitleById[s.roundId] ?? "Đợt chấm") : `Chấm điểm ngày ${formatDateVN(s.date)}`}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatDateVN(s.date)} · {formatTimeVN(s.timestamp)}
                  {showJudge && ` · ${s.judgeName || s.judgeEmail}`}
                </span>
                {s.generalNote && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-primary">
                    <MessageSquareText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.generalNote}</span>
                  </span>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <strong>
                  {getEffectiveScore(s)}/{getEffectiveMaxScore(s)}
                </strong>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </span>
            </button>
            {open && (
              <div className="space-y-1 border-t border-border px-3 py-2 text-xs">
                {s.generalNote && (
                  <p className="mb-1.5 rounded-md bg-secondary/50 px-2 py-1.5">
                    <span className="font-medium">Nhận xét chung: </span>
                    <span className="text-muted-foreground">{s.generalNote}</span>
                  </p>
                )}
                {s.roundId
                  ? snapshot.map((item) => (
                      <div key={item.criterionId}>
                        <div className="flex items-center justify-between">
                          <span>{item.name}</span>
                          <span className={item.result === "PASS" ? "text-success" : "text-warning"}>
                            {item.result === "PASS" ? "Đạt" : "Không đạt"}
                          </span>
                        </div>
                        {item.note && <p className="italic text-muted-foreground">Ghi chú: {item.note}</p>}
                      </div>
                    ))
                  : criteria.map((c) => (
                      <div key={c.criterionId} className="flex items-center justify-between">
                        <span>Tiêu chí {c.criterionNumber}</span>
                        <span className={s[`c${c.criterionNumber}` as "c1"] === 1 ? "text-success" : "text-warning"}>
                          {s[`c${c.criterionNumber}` as "c1"] === 1 ? "Đạt" : "Không đạt"}
                        </span>
                      </div>
                    ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
