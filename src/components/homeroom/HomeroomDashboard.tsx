"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Trophy, Award, ThumbsDown, MessageSquareText, AlertTriangle } from "lucide-react";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import { sendHomeroomReportAction } from "@/lib/actions/emailActions";
import { SendReportButton } from "@/components/layout/SendReportDialog";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { ScoreHistoryList } from "@/components/scoring/ScoreHistoryList";
import { AdjustmentHistoryList } from "@/components/scoring/AdjustmentHistoryList";
import { DailyScoreSummaryCards } from "@/components/admin/DailyScoreSummaryCards";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { ClassDailyScoreSummary, CriterionFailureStat } from "@/lib/admin/aggregate";
import type {
  AdjustmentRecord,
  ClassConfig,
  CriterionConfig,
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
  roundTitleById,
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
  /** roundId -> tên Đợt chấm, hiện trong "Kết quả chi tiết" thay vì chỉ
   * ngày/giờ thô. Bản ghi V1 cũ (không gắn Đợt chấm) không có trong map này. */
  roundTitleById: Record<string, string>;
}) {
  const router = useRouter();

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
          <DailyScoreSummaryCards summary={dailySummary} />
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
          <AdjustmentHistoryList adjustments={monthAdjustments} />
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
        <ScoreHistoryList scores={monthScores} criteria={criteria} roundTitleById={roundTitleById} />
      </div>
    </div>
  );
}
