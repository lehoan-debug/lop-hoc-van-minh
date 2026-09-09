import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canAccessScoring } from "@/lib/auth/permissions";
import {
  getScoringRound,
  getClasses,
  getCriteria,
  isUserAssignedToRound,
  checkDuplicateRoundScore,
  criterionAppliesToGrade,
  getScores,
} from "@/lib/google/sheets";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import {
  checkRoundEligibility,
  isCriterionInRoundScope,
  isClassInRoundScope,
  isClassInAssignmentScope,
} from "@/lib/rounds/eligibility";
import { findNextUnscoredClass } from "@/lib/rounds/nextClass";
import { RoundScoringScreen } from "@/components/scoring/RoundScoringScreen";

export default async function RoundScoringPage({
  params,
}: {
  params: Promise<{ roundId: string; classId: string }>;
}) {
  const user = await requireUser();
  if (!canAccessScoring(user)) redirect("/judge");

  const { roundId, classId } = await params;
  const round = await getScoringRound(roundId);
  if (!round) notFound();

  const classes = await getClasses({ activeOnly: true });
  const klass = classes.find((c) => c.classId === classId);
  if (!klass) notFound();

  const assignment = await isUserAssignedToRound(roundId, user.email);
  const eligibility = checkRoundEligibility({
    round,
    assignment,
    classId: klass.classId,
    grade: klass.grade,
  });

  const existingScore = await checkDuplicateRoundScore({ roundId, classId });

  const allCriteria = await getCriteria({ activeOnly: true });
  const criteria = allCriteria
    .filter((c) => criterionAppliesToGrade(c, klass.grade) && isCriterionInRoundScope(round, c.criterionId))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Danh sách lớp được phân công (đúng thứ tự khối/sortOrder) + lớp đã chấm
  // trong Đợt — dùng để nút "Chấm lớp tiếp theo" đưa thẳng sang lớp CHƯA
  // CHẤM kế tiếp thay vì quay lại màn chọn lớp từ đầu.
  let nextClass: { classId: string; className: string } | null = null;
  if (assignment) {
    const assignedClasses = classes
      .filter((c) => isClassInRoundScope(round, c.classId, c.grade) && isClassInAssignmentScope(assignment, c.classId, c.grade))
      .sort((a, b) => (a.grade === b.grade ? a.sortOrder - b.sortOrder : a.grade.localeCompare(b.grade)));
    const scores = await getScores({ roundId });
    const doneClassIds = scores.map((s) => s.classId);
    const nextClassId = findNextUnscoredClass(
      assignedClasses.map((c) => c.classId),
      classId,
      doneClassIds,
    );
    const nextClassInfo = nextClassId ? assignedClasses.find((c) => c.classId === nextClassId) : undefined;
    nextClass = nextClassInfo ? { classId: nextClassInfo.classId, className: nextClassInfo.className } : null;
  }

  return (
    <RoundScoringScreen
      round={round}
      classInfo={klass}
      criteria={criteria}
      judgeEmail={user.email}
      effectiveStatus={getEffectiveRoundStatus(round)}
      canSubmit={eligibility.ok}
      existingScore={existingScore}
      nextClass={nextClass}
    />
  );
}
