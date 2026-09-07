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
} from "@/lib/google/sheets";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import { checkRoundEligibility } from "@/lib/rounds/eligibility";
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
    .filter((c) => criterionAppliesToGrade(c, klass.grade))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <RoundScoringScreen
      round={round}
      classInfo={klass}
      criteria={criteria}
      judgeEmail={user.email}
      effectiveStatus={getEffectiveRoundStatus(round)}
      canSubmit={eligibility.ok}
      existingScore={existingScore}
    />
  );
}
