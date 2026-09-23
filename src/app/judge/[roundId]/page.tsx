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

  // Không phụ thuộc lẫn nhau — chạy song song thay vì 3 lượt gọi Google
  // Sheets API tuần tự (mỗi await trước đây chờ xong cái trước mới bắt đầu).
  const [assignment, allClasses, scores] = await Promise.all([
    isUserAssignedToRound(roundId, user.email),
    getClasses({ activeOnly: true }),
    getScores({ roundId }),
  ]);
  if (!assignment) {
    redirect("/judge");
  }

  const classes = allClasses.filter(
    (c) =>
      isClassInRoundScope(round, c.classId, c.grade) &&
      isClassInAssignmentScope(assignment, c.classId, c.grade),
  );

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
