"use client";

import * as React from "react";
import { CalendarCheck, Trophy, TrendingUp, Award, ThumbsDown } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { DailyScoreSummaryCards } from "@/components/admin/DailyScoreSummaryCards";
import { ScoreHistoryList } from "@/components/scoring/ScoreHistoryList";
import { AdjustmentHistoryList } from "@/components/scoring/AdjustmentHistoryList";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { ClassDailyScoreSummary } from "@/lib/admin/aggregate";
import type {
  AdjustmentRecord,
  ClassConfig,
  CriterionConfig,
  DailyScoreCombineModeSetting,
  Grade,
  ScoreRecord,
  ScoringRound,
} from "@/types";

const GRADES: Grade[] = ["10", "11", "12"];

export function ClassDetailView({
  classes,
  scores,
  adjustments,
  criteria,
  allRounds,
  rankingsByGrade,
  dailySummaries,
  isUnconfirmed,
  combineMode,
  yearMonth,
  selectedClassId,
  onSelectClass,
}: {
  classes: ClassConfig[];
  scores: ScoreRecord[];
  adjustments: AdjustmentRecord[];
  criteria: CriterionConfig[];
  allRounds: ScoringRound[];
  rankingsByGrade: Record<Grade, ClassRankingResult[]>;
  dailySummaries: ClassDailyScoreSummary[];
  isUnconfirmed: boolean;
  combineMode: DailyScoreCombineModeSetting;
  yearMonth: string;
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
}) {
  const [selectedRoundId, setSelectedRoundId] = React.useState<string>("ALL");

  const selectedClass = classes.find((c) => c.classId === selectedClassId) ?? null;

  const roundTitleById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of allRounds) map[r.roundId] = r.title;
    return map;
  }, [allRounds]);

  const classScores = React.useMemo(
    () => scores.filter((s) => s.classId === selectedClassId),
    [scores, selectedClassId],
  );
  const classAdjustments = React.useMemo(
    () => adjustments.filter((a) => a.classId === selectedClassId),
    [adjustments, selectedClassId],
  );

  // Chỉ liệt kê Đợt chấm THỰC SỰ có điểm của lớp này trong tháng — đơn giản,
  // đúng mục đích lọc lại danh sách bên dưới (không cần logic phạm vi/
  // eligibility của Đợt chấm).
  const roundOptions = React.useMemo(() => {
    const ids = Array.from(new Set(classScores.map((s) => s.roundId).filter((id): id is string => !!id)));
    return ids
      .map((roundId) => ({ roundId, title: roundTitleById[roundId] ?? "Đợt chấm" }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [classScores, roundTitleById]);

  // Đổi lớp mà Đợt chấm đang lọc không còn thuộc lớp mới -> coi như "Tất cả"
  // (tính lại ngay khi render, không cần effect riêng để reset state).
  const effectiveRoundId =
    selectedRoundId !== "ALL" && !roundOptions.some((r) => r.roundId === selectedRoundId) ? "ALL" : selectedRoundId;

  const filteredScores = React.useMemo(() => {
    const list =
      effectiveRoundId === "ALL" ? classScores : classScores.filter((s) => s.roundId === effectiveRoundId);
    return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [classScores, effectiveRoundId]);

  const daysGraded = new Set(classScores.map((s) => s.date)).size;
  const bonusTotal = classAdjustments.filter((a) => a.type === "BONUS").reduce((sum, a) => sum + a.points, 0);
  const penaltyTotal = classAdjustments.filter((a) => a.type === "PENALTY").reduce((sum, a) => sum + a.points, 0);

  const ranking =
    !isUnconfirmed && selectedClass
      ? (rankingsByGrade[selectedClass.grade]?.find((r) => r.classId === selectedClassId) ?? null)
      : null;
  const totalRankedInGrade = selectedClass ? (rankingsByGrade[selectedClass.grade]?.length ?? 0) : 0;
  const dailySummary = isUnconfirmed ? (dailySummaries.find((d) => d.classId === selectedClassId) ?? null) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Lớp</label>
          <select
            value={selectedClassId ?? ""}
            onChange={(e) => onSelectClass(e.target.value)}
            className="h-9 w-40 rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
          >
            {GRADES.map((g) => {
              const inGrade = classes.filter((c) => c.grade === g);
              if (inGrade.length === 0) return null;
              return (
                <optgroup key={g} label={`Khối ${g}`}>
                  {inGrade.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.className}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Đợt chấm</label>
          <select
            value={effectiveRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            className="h-9 w-56 rounded-[var(--radius)] border border-input bg-background px-2 text-sm"
          >
            <option value="ALL">Tất cả đợt</option>
            {roundOptions.map((r) => (
              <option key={r.roundId} value={r.roundId}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedClass && (
        <>
          <h2 className="mb-3 text-lg font-bold">
            {selectedClass.className} <span className="font-normal text-muted-foreground">· Khối {selectedClass.grade}</span>
          </h2>

          {isUnconfirmed ? (
            <div className="mb-4">
              <DailyScoreSummaryCards summary={dailySummary} />
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Điểm TB tháng"
                value={ranking?.averageScore !== null && ranking?.averageScore !== undefined ? ranking.averageScore.toFixed(2) : "—"}
                icon={TrendingUp}
              />
              <StatCard
                label="Xếp hạng"
                value={ranking ? `${ranking.rank}/${totalRankedInGrade}` : "—"}
                icon={Trophy}
              />
              <StatCard label="Điểm cộng" value={`+${bonusTotal}`} icon={Award} tone="success" />
              <StatCard label="Điểm trừ" value={`-${penaltyTotal}`} icon={ThumbsDown} tone="destructive" />
            </div>
          )}
          <div className="mb-4">
            <StatCard label="Số ngày chấm trong tháng" value={daysGraded} icon={CalendarCheck} />
          </div>
          {!isUnconfirmed && (
            <p className="mb-4 text-xs text-muted-foreground">
              Cách kết hợp điểm sáng/chiều: {combineMode === "SUM" ? "Cộng tổng" : "Trung bình"}
            </p>
          )}

          {classAdjustments.length > 0 && (
            <div className="mb-4 rounded-[var(--radius)] border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Điểm cộng/trừ chi tiết (tháng {yearMonth})</h3>
              <AdjustmentHistoryList adjustments={classAdjustments} />
            </div>
          )}

          <div className="rounded-[var(--radius)] border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Kết quả chi tiết (lịch sử chấm điểm)</h3>
            <ScoreHistoryList scores={filteredScores} criteria={criteria} roundTitleById={roundTitleById} showJudge />
          </div>
        </>
      )}
    </div>
  );
}
