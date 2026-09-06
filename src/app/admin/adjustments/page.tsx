import { getClasses, getAdjustments } from "@/lib/google/sheets";
import { currentYearMonthVN, getMonthDateRange } from "@/lib/timezone/timezone";
import { AdjustmentsPanel } from "@/components/admin/AdjustmentsPanel";
import type { Grade } from "@/types";

export default async function AdminAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const yearMonth = sp.month || currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);
  const grade = (sp.grade as Grade | undefined) || undefined;
  const classId = sp.classId || undefined;

  const [classes, adjustments] = await Promise.all([
    getClasses({ activeOnly: true }),
    getAdjustments({ dateFrom: from, dateTo: to, classId }),
  ]);

  const classesForGrade = classes.filter((c) => !grade || c.grade === grade);
  const filtered = adjustments
    .filter((a) => !grade || classesForGrade.some((c) => c.classId === a.classId))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Điểm cộng / Điểm trừ</h1>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="month">
            Tháng
          </label>
          <input
            id="month"
            type="month"
            name="month"
            defaultValue={yearMonth}
            className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="grade">
            Khối
          </label>
          <select
            id="grade"
            name="grade"
            defaultValue={grade ?? ""}
            className="h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-sm"
          >
            <option value="">Tất cả</option>
            <option value="10">Khối 10</option>
            <option value="11">Khối 11</option>
            <option value="12">Khối 12</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-11 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Lọc
        </button>
      </form>

      <AdjustmentsPanel adjustments={filtered} classes={classes} />
    </div>
  );
}
