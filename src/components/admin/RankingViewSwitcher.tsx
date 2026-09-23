"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassDetailView } from "@/components/admin/ClassDetailView";
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

/** Cho phép `RankingTable`/`DailyScoreReferenceTable` (render bên trong
 * `rankingContent`, do Server Component tạo ra nhưng bản thân vẫn là Client
 * Component) yêu cầu chuyển sang tab "Chi tiết theo lớp" đúng 1 lớp khi bấm
 * vào tên lớp — không cần prop-drilling function qua ranh giới Server/Client. */
const ClassDetailContext = React.createContext<(classId: string) => void>(() => {});

export function useRequestClassDetail() {
  return React.useContext(ClassDetailContext);
}

export function RankingViewSwitcher({
  initialView,
  initialClassId,
  rankingContent,
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
}: {
  initialView: "ranking" | "detail";
  initialClassId: string | null;
  rankingContent: React.ReactNode;
  classes: ClassConfig[];
  /** Điểm/điểm cộng-trừ của CẢ THÁNG, TẤT CẢ LỚP — đã tải sẵn ở Server
   * Component, lọc lại theo lớp ngay tại client, không gọi lại Sheets. */
  scores: ScoreRecord[];
  adjustments: AdjustmentRecord[];
  criteria: CriterionConfig[];
  allRounds: ScoringRound[];
  rankingsByGrade: Record<Grade, ClassRankingResult[]>;
  dailySummaries: ClassDailyScoreSummary[];
  isUnconfirmed: boolean;
  combineMode: DailyScoreCombineModeSetting;
  yearMonth: string;
}) {
  const [view, setView] = React.useState<"ranking" | "detail">(initialView);
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(
    initialClassId ?? classes[0]?.classId ?? null,
  );

  const requestClassDetail = React.useCallback((classId: string) => {
    setSelectedClassId(classId);
    setView("detail");
  }, []);

  return (
    <ClassDetailContext.Provider value={requestClassDetail}>
      <Tabs value={view} onValueChange={(v) => setView(v as "ranking" | "detail")} className="mb-4">
        <TabsList>
          <TabsTrigger value="ranking">Bảng xếp hạng</TabsTrigger>
          <TabsTrigger value="detail">Chi tiết theo lớp</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "ranking" ? (
        rankingContent
      ) : (
        <ClassDetailView
          classes={classes}
          scores={scores}
          adjustments={adjustments}
          criteria={criteria}
          allRounds={allRounds}
          rankingsByGrade={rankingsByGrade}
          dailySummaries={dailySummaries}
          isUnconfirmed={isUnconfirmed}
          combineMode={combineMode}
          yearMonth={yearMonth}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
        />
      )}
    </ClassDetailContext.Provider>
  );
}
