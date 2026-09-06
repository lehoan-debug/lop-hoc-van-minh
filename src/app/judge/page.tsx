import { requireUser } from "@/lib/auth/session";
import { getClasses, getScores, getSettings } from "@/lib/google/sheets";
import { todayVN, currentTimeVN } from "@/lib/timezone/timezone";
import { JudgeHome } from "@/components/scoring/JudgeHome";
import type { Grade, Session_ } from "@/types";

export default async function JudgePage() {
  const user = await requireUser();
  const [allClasses, settings] = await Promise.all([
    getClasses({ activeOnly: true }),
    getSettings(),
  ]);

  const enabledGrades = settings.ENABLED_GRADES.length
    ? settings.ENABLED_GRADES
    : (["10", "11", "12"] as Grade[]);

  const visibleGrades: Grade[] = enabledGrades.filter(
    (g) => user.allowedGrades === "ALL" || user.allowedGrades.includes(g),
  );

  const classes = allClasses.filter((c) => visibleGrades.includes(c.grade));

  const date = todayVN();
  const todayScores = await getScores({ dateFrom: date, dateTo: date, judgeEmail: user.email });
  const scoredKeys = todayScores.map((s) => `${s.classId}__${s.session}`);

  const currentTime = currentTimeVN();
  const defaultSession: Session_ = currentTime < "12:00" ? "MORNING" : "AFTERNOON";

  return (
    <JudgeHome
      userName={user.name}
      userEmail={user.email}
      date={date}
      classes={classes}
      grades={visibleGrades}
      scoredKeys={scoredKeys}
      defaultSession={defaultSession}
      currentTime={currentTime}
      sessionWindows={{
        MORNING: { start: settings.MORNING_SESSION_START, end: settings.MORNING_SESSION_END },
        AFTERNOON: { start: settings.AFTERNOON_SESSION_START, end: settings.AFTERNOON_SESSION_END },
      }}
    />
  );
}
