import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canAccessScoring } from "@/lib/auth/permissions";
import { getScoringRound, getClasses, isUserAssignedToRound, getScores } from "@/lib/google/sheets";
import { getEffectiveRoundStatus } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { RoundClassPicker } from "@/components/scoring/RoundClassPicker";

export default async function RoundClassPickerPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const user = await requireUser();
  if (!canAccessScoring(user)) redirect("/judge");

  const { roundId } = await params;
  const round = await getScoringRound(roundId);
  if (!round) notFound();

  const assignment = await isUserAssignedToRound(roundId, user.email);
  if (!assignment) {
    redirect("/judge");
  }

  const allClasses = await getClasses({ activeOnly: true });
  const classes = allClasses.filter(
    (c) =>
      isClassInRoundScope(round, c.classId, c.grade) &&
      isClassInAssignmentScope(assignment, c.classId, c.grade),
  );

  const scores = await getScores({ roundId });
  const doneClassIds = scores.map((s) => s.classId);

  return (
    <RoundClassPicker
      round={round}
      effectiveStatus={getEffectiveRoundStatus(round)}
      classes={classes}
      doneClassIds={doneClassIds}
    />
  );
}
