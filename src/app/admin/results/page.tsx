import { Download, FileSpreadsheet } from "lucide-react";
import { getClasses, getScores, getCriteria, getUsers, getAdjustments } from "@/lib/google/sheets";
import { todayVN } from "@/lib/timezone/timezone";
import { canAccessScoring } from "@/lib/auth/permissions";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { ResultsTable } from "@/components/admin/ResultsTable";
import type { Grade, Session_ } from "@/types";

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const date = sp.date || todayVN();
  const grade = (sp.grade as Grade | undefined) || undefined;
  const classId = sp.classId || undefined;
  const judgeEmail = sp.judgeEmail || undefined;
  const session = (sp.session as Session_ | undefined) || undefined;

  const [classes, criteria, allJudges, scores, adjustments] = await Promise.all([
    getClasses({ activeOnly: true }),
    getCriteria({ activeOnly: true }),
    getUsers(),
    getScores({ dateFrom: date, dateTo: date, grade, classId, judgeEmail, session }),
    getAdjustments({ dateFrom: date, dateTo: date }),
  ]);

  const sorted = [...scores].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const judges = allJudges.filter((u) => canAccessScoring(u));

  const exportParams = new URLSearchParams();
  exportParams.set("date", date);
  if (grade) exportParams.set("grade", grade);
  if (classId) exportParams.set("classId", classId);
  if (judgeEmail) exportParams.set("judgeEmail", judgeEmail);
  if (session) exportParams.set("session", session);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Kết quả chi tiết</h1>
        <div className="flex gap-2">
          <a
            href={`/api/admin/export?${exportParams.toString()}`}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Xuất CSV
          </a>
          <a
            href={`/api/admin/export/xlsx?${exportParams.toString()}`}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất Excel
          </a>
        </div>
      </div>
      <DashboardFilters classes={classes} judges={judges} />
      <ResultsTable scores={sorted} criteria={criteria} adjustments={adjustments} />
    </div>
  );
}
