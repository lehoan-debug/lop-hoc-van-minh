import { requireUser } from "@/lib/auth/session";
import { canAccessScoring, canManageRounds } from "@/lib/auth/permissions";
import {
  getRoundAssignmentsForUser,
  getScoringRounds,
  getClasses,
  getScores,
} from "@/lib/google/sheets";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { JudgeRoundsHome, type RoundWithProgress } from "@/components/scoring/JudgeRoundsHome";

export default async function JudgePage() {
  const user = await requireUser();

  if (!canAccessScoring(user)) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-muted-foreground">
        Tài khoản của bạn không có quyền truy cập chức năng chấm điểm.
      </div>
    );
  }

  const [assignments, allRounds, allClasses] = await Promise.all([
    getRoundAssignmentsForUser(user.email),
    getScoringRounds(),
    getClasses({ activeOnly: true }),
  ]);

  const assignedRoundIds = new Set(assignments.map((a) => a.roundId));
  const myRounds = allRounds.filter((r) => assignedRoundIds.has(r.roundId));

  const now = new Date();
  const items: RoundWithProgress[] = await Promise.all(
    myRounds.map(async (round) => {
      const assignment = assignments.find((a) => a.roundId === round.roundId)!;
      const classesInScope = allClasses.filter(
        (c) =>
          isClassInRoundScope(round, c.classId, c.grade) &&
          isClassInAssignmentScope(assignment, c.classId, c.grade),
      );
      const scores = await getScores({ roundId: round.roundId });
      const doneClassIds = new Set(scores.map((s) => s.classId));
      const doneCount = classesInScope.filter((c) => doneClassIds.has(c.classId)).length;

      return {
        round,
        effectiveStatus: getEffectiveRoundStatus(round, now),
        assignedClassesCount: classesInScope.length,
        doneCount,
      };
    }),
  );

  items.sort((a, b) => a.round.startsAt.localeCompare(b.round.startsAt));

  return <JudgeRoundsHome userName={user.name} items={items} canManageRounds={canManageRounds(user)} />;
}
