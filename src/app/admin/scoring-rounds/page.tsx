import {
  getScoringRounds,
  getClasses,
  getRoundAssignments,
  getScores,
  getUsers,
} from "@/lib/google/sheets";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { ScoringRoundsPageClient, type RoundListItem } from "@/components/admin/ScoringRoundsPageClient";

export default async function AdminScoringRoundsPage() {
  const [rounds, classes, users] = await Promise.all([
    getScoringRounds(),
    getClasses({ activeOnly: true }),
    getUsers(),
  ]);
  const judges = users.filter(
    (u) => u.active && u.roles.some((r) => r === "JUDGE" || r === "ADMIN" || r === "SUPER_ADMIN"),
  );

  const now = new Date();
  const items: RoundListItem[] = await Promise.all(
    rounds.map(async (round) => {
      const [assignments, scores] = await Promise.all([
        getRoundAssignments(round.roundId),
        getScores({ roundId: round.roundId }),
      ]);

      const classesInRoundScope = classes.filter((c) =>
        isClassInRoundScope(round, c.classId, c.grade),
      );
      // Số lớp "cần chấm" thực tế = hợp của phạm vi từng người được phân công
      // (nếu không ai bị thu hẹp thêm, bằng đúng phạm vi Round).
      const classesToScore =
        assignments.length === 0
          ? classesInRoundScope
          : classesInRoundScope.filter((c) =>
              assignments.some((a) => isClassInAssignmentScope(a, c.classId, c.grade)),
            );

      const doneClassIds = new Set(scores.map((s) => s.classId));
      const doneCount = classesToScore.filter((c) => doneClassIds.has(c.classId)).length;

      return {
        round,
        effectiveStatus: getEffectiveRoundStatus(round, now),
        assignedJudgeCount: assignments.length,
        totalClasses: classesToScore.length,
        doneCount,
      };
    }),
  );

  items.sort((a, b) => b.round.startsAt.localeCompare(a.round.startsAt));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Đợt chấm</h1>
      <ScoringRoundsPageClient items={items} classes={classes} judges={judges} />
    </div>
  );
}
