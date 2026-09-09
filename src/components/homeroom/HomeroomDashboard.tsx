"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trophy, Award, ThumbsDown, ChevronDown, MessageSquareText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import { sendHomeroomReportAction } from "@/lib/actions/emailActions";
import { SendReportButton } from "@/components/layout/SendReportDialog";
import { SignOutButton } from "@/components/layout/SignOutButton";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { ClassDailyScoreSummary, CriterionFailureStat } from "@/lib/admin/aggregate";
import type {
  AdjustmentRecord,
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
  isUnconfirmed,
  dailySummary,
  todayLabel,
  todayScores,
  monthScores,
  monthAdjustments,
  ranking,
  totalRankedInGrade,
  failureStats,
  bonusTotal,
  penaltyTotal,
  criteria,
  userEmail,
}: {
  classInfo: ClassConfig;
  myClasses: ClassConfig[];
  combineMode: DailyScoreCombineModeSetting;
  isUnconfirmed: boolean;
  dailySummary: ClassDailyScoreSummary | null;
  todayLabel: string;
  todayScores: ScoreRecord[];
  monthScores: ScoreRecord[];
  monthAdjustments: AdjustmentRecord[];
  ranking: ClassRankingResult | null;
  totalRankedInGrade: number;
  failureStats: CriterionFailureStat[];
  bonusTotal: number;
  penaltyTotal: number;
  criteria: CriterionConfig[];
  userEmail: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);

  const todayTotal = todayScores.reduce((sum, s) => sum + getEffectiveScore(s), 0);
  const todayMax = todayScores.reduce((sum, s) => sum + getEffectiveMaxScore(s), 0);
  const commentCount = monthScores.filter((s) => s.generalNote).length;

  return (
    <div className="mx-auto max-w-lg p-4 pb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Image src="/logo-fpt-schools.png" alt="FPT Schools" width={110} height={48} className="h-6 w-auto" />
          <h1 className="text-lg font-bold">Lớp chủ nhiệm</h1>
        </div>
        <SignOutButton size="sm" />
      </div>

      <div className="mb-4 flex justify-end">
        <SendReportButton
          defaultEmail={userEmail}
          title={`Gửi báo cáo lớp ${classInfo.className}`}
          description="Email sẽ gồm điểm hôm nay, xếp hạng tháng (nếu đã xác nhận công thức), điểm cộng/trừ chi tiết và nhận xét của Giám khảo."
          onSend={(toEmail) => sendHomeroomReportAction({ classId: classInfo.classId, toEmail })}
        />
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
            {isUnconfirmed ? "—" : ranking ? `${ranking.rank}/${totalRankedInGrade}` : "—"}
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

      {!isUnconfirmed && (
        <p className="mb-4 text-xs text-muted-foreground">
          Cách kết hợp điểm sáng/chiều: {combineMode === "SUM" ? "Cộng tổng" : "Trung bình"}
        </p>
      )}

      {isUnconfirmed && (
        <div className="mb-4 rounded-[var(--radius)] border border-warning/30 bg-warning/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Công thức điểm ngày chưa được BTC xác nhận
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Chưa có &quot;xếp hạng&quot; chính thức. Số liệu dưới đây chỉ mang tính tham khảo.
          </p>
          {dailySummary ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">TB buổi sáng</p>
                <p className="font-semibold">
                  {dailySummary.avgMorning !== null ? dailySummary.avgMorning.toFixed(1) : "—"}
                </p>
              </div>
              <div className="rounded-md bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">TB buổi chiều</p>
                <p className="font-semibold">
                  {dailySummary.avgAfternoon !== null ? dailySummary.avgAfternoon.toFixed(1) : "—"}
                </p>
              </div>
              <div className="rounded-md bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">TB tổng 2 buổi/ngày</p>
                <p className="font-semibold">
                  {dailySummary.avgOfSum !== null ? dailySummary.avgOfSum.toFixed(1) : "—"}
                </p>
              </div>
              <div className="rounded-md bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">TB trung bình 2 buổi/ngày</p>
                <p className="font-semibold">
                  {dailySummary.avgOfAverage !== null ? dailySummary.avgOfAverage.toFixed(1) : "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu chấm điểm trong tháng.</p>
          )}
        </div>
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

      {monthAdjustments.length > 0 && (
        <div className="mb-4 rounded-[var(--radius)] border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Điểm cộng/trừ chi tiết (tháng này)</h2>
          <div className="space-y-2">
            {monthAdjustments.map((a) => (
              <div key={a.adjustmentId} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-semibold",
                      a.type === "BONUS" ? "text-success" : "text-destructive",
                    )}
                  >
                    {a.type === "BONUS" ? "+" : "-"}
                    {a.points} điểm
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateVN(a.date)}</span>
                </div>
                {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
                {(a.studentName || a.studentCode) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Học sinh: {[a.studentName, a.studentCode].filter(Boolean).join(" - ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Kết quả chi tiết (lịch sử chấm điểm)</h2>
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" />
              {commentCount} nhận xét
            </span>
          )}
        </div>
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
                  <div>
                    <span>
                      {formatDateVN(s.date)} · {formatTimeVN(s.timestamp)}
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
                            {item.note && (
                              <p className="italic text-muted-foreground">Ghi chú: {item.note}</p>
                            )}
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
