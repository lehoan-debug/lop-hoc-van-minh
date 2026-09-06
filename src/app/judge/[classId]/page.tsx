import { notFound, redirect } from "next/navigation";
import { requireUser, canAccessGrade } from "@/lib/auth/session";
import { getClasses, getCriteria, checkDuplicateScore } from "@/lib/google/sheets";
import { todayVN } from "@/lib/timezone/timezone";
import { ScoringScreen } from "@/components/scoring/ScoringScreen";
import type { Session_ } from "@/types";

export default async function ScoreClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await requireUser();
  const { classId } = await params;
  const { session: sessionParam } = await searchParams;

  const session: Session_ | undefined =
    sessionParam === "MORNING" || sessionParam === "AFTERNOON"
      ? sessionParam
      : undefined;

  if (!session) {
    redirect("/judge");
  }

  const [classes, criteria] = await Promise.all([
    getClasses({ activeOnly: true }),
    getCriteria({ activeOnly: true }),
  ]);

  const klass = classes.find((c) => c.classId === classId);
  if (!klass) notFound();
  if (!canAccessGrade(user, klass.grade)) {
    redirect("/judge");
  }

  const date = todayVN();
  const existing = await checkDuplicateScore({
    date,
    session,
    classId,
    judgeEmail: user.email,
  });

  return (
    <ScoringScreen
      classInfo={klass}
      criteria={criteria}
      session={session}
      date={date}
      existingScore={existing}
    />
  );
}
