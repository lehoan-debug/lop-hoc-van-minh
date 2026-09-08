import { notFound } from "next/navigation";
import {
  getScoringRound,
  getClasses,
  getRoundAssignments,
  getScores,
  getUsers,
  getAdjustments,
} from "@/lib/google/sheets";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { formatInVN } from "@/lib/timezone/timezone";
import { RoundDetailClient } from "@/components/admin/RoundDetailClient";

export default async function AdminScoringRoundDetailPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await getScoringRound(roundId);
  if (!round) notFound();

  const roundDate = formatInVN(round.startsAt, "yyyy-MM-dd");

  const [allClasses, assignments, scores, users, adjustments] = await Promise.all([
    getClasses({ activeOnly: true }),
    getRoundAssignments(roundId),
    getScores({ roundId }),
    getUsers(),
    getAdjustments({ dateFrom: roundDate, dateTo: roundDate }),
  ]);

  const classesInScope = allClasses.filter((c) => isClassInRoundScope(round, c.classId, c.grade));
  const judges = users.filter(
    (u) => u.active && u.roles.some((r) => r === "JUDGE" || r === "ADMIN" || r === "SUPER_ADMIN"),
  );

  const classRows = classesInScope.map((c) => {
    const assignedJudges = assignments.filter((a) => isClassInAssignmentScope(a, c.classId, c.grade));
    const score = scores.find((s) => s.classId === c.classId);
    const classAdjustments = adjustments.filter((a) => a.classId === c.classId);
    return {
      classInfo: c,
      assignedJudgeEmails: assignedJudges.map((a) => a.userEmail),
      score: score ?? null,
      bonusTotal: classAdjustments.filter((a) => a.type === "BONUS").reduce((sum, a) => sum + a.points, 0),
      penaltyTotal: classAdjustments.filter((a) => a.type === "PENALTY").reduce((sum, a) => sum + a.points, 0),
    };
  });

  return (
    <RoundDetailClient
      round={round}
      classes={allClasses}
      classRows={classRows}
      assignments={assignments}
      judges={judges}
    />
  );
}
