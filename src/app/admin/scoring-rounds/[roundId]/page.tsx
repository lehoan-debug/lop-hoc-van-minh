import { notFound } from "next/navigation";
import {
  getScoringRound,
  getClasses,
  getRoundAssignments,
  getScores,
  getUsers,
} from "@/lib/google/sheets";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { RoundDetailClient } from "@/components/admin/RoundDetailClient";

export default async function AdminScoringRoundDetailPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const round = await getScoringRound(roundId);
  if (!round) notFound();

  const [allClasses, assignments, scores, users] = await Promise.all([
    getClasses({ activeOnly: true }),
    getRoundAssignments(roundId),
    getScores({ roundId }),
    getUsers(),
  ]);

  const classesInScope = allClasses.filter((c) => isClassInRoundScope(round, c.classId, c.grade));
  const judges = users.filter(
    (u) => u.active && u.roles.some((r) => r === "JUDGE" || r === "ADMIN" || r === "SUPER_ADMIN"),
  );

  const classRows = classesInScope.map((c) => {
    const assignedJudges = assignments.filter((a) => isClassInAssignmentScope(a, c.classId, c.grade));
    const score = scores.find((s) => s.classId === c.classId);
    return {
      classInfo: c,
      assignedJudgeEmails: assignedJudges.map((a) => a.userEmail),
      score: score ?? null,
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
