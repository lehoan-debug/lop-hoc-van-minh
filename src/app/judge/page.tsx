import Link from "next/link";
import { School } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { canAccessScoring, canManageRounds, hasRole } from "@/lib/auth/permissions";
import {
  getRoundAssignmentsForUser,
  getScoringRounds,
  getClasses,
  getScores,
  filterScores,
} from "@/lib/google/sheets";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { JudgeRoundsHome, type RoundWithProgress } from "@/components/scoring/JudgeRoundsHome";

export default async function JudgePage() {
  const user = await requireUser();

  if (!canAccessScoring(user)) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-muted-foreground">
        <p>Tài khoản của bạn không có quyền truy cập chức năng chấm điểm.</p>
        {hasRole(user, "HOMEROOM_TEACHER") && (
          <Link
            href="/homeroom"
            className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            <School className="h-3.5 w-3.5" />
            Vào trang Lớp chủ nhiệm
          </Link>
        )}
      </div>
    );
  }

  const [assignments, allRounds, allClasses, allScores] = await Promise.all([
    getRoundAssignmentsForUser(user.email),
    getScoringRounds(),
    getClasses({ activeOnly: true }),
    // Tải TOÀN BỘ sheet Scores đúng MỘT LẦN thay vì gọi getScores({ roundId })
    // riêng cho từng Đợt chấm được phân công (N+1 lượt gọi Google Sheets API
    // — nguyên nhân chính khiến trang chủ Giám khảo phản hồi chậm khi 1 người
    // được giao nhiều Đợt chấm). Lọc theo roundId trong JS bên dưới.
    getScores({}),
  ]);

  const assignedRoundIds = new Set(assignments.map((a) => a.roundId));
  const myRounds = allRounds.filter((r) => assignedRoundIds.has(r.roundId));

  const now = new Date();
  const items: RoundWithProgress[] = myRounds.map((round) => {
    const assignment = assignments.find((a) => a.roundId === round.roundId)!;
    const classesInScope = allClasses.filter(
      (c) =>
        isClassInRoundScope(round, c.classId, c.grade) &&
        isClassInAssignmentScope(assignment, c.classId, c.grade),
    );
    const scores = filterScores(allScores, { roundId: round.roundId });
    const doneClassIds = new Set(scores.map((s) => s.classId));
    const doneCount = classesInScope.filter((c) => doneClassIds.has(c.classId)).length;

    return {
      round,
      effectiveStatus: getEffectiveRoundStatus(round, now),
      assignedClassesCount: classesInScope.length,
      doneCount,
    };
  });

  items.sort((a, b) => a.round.startsAt.localeCompare(b.round.startsAt));

  return <JudgeRoundsHome userName={user.name} items={items} canManageRounds={canManageRounds(user)} />;
}
