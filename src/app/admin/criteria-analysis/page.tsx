import Link from "next/link";
import { getScores, getCriteria } from "@/lib/google/sheets";
import { currentYearMonthVN, getMonthDateRange, formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { computeCriteriaFailureStats, getCriterionViolations } from "@/lib/admin/aggregate";
import { CriteriaFailureChart } from "@/components/admin/CriteriaFailureChart";
import { cn } from "@/lib/utils";
import type { CriterionSnapshotItem } from "@/types";

export default async function CriteriaAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const yearMonth = sp.month || currentYearMonthVN();
  const { from, to } = getMonthDateRange(yearMonth);
  const selectedCriterionId = sp.criterion || undefined;

  const [scores, criteria] = await Promise.all([
    getScores({ dateFrom: from, dateTo: to }),
    getCriteria(),
  ]);

  const stats = computeCriteriaFailureStats(scores, criteria);
  const violations = selectedCriterionId
    ? getCriterionViolations(scores, selectedCriterionId, criteria).sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      )
    : [];
  const selectedStat = stats.find((s) => s.criterionId === selectedCriterionId);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Phân tích tiêu chí</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Tiêu chí không đạt nhiều nhất — Tháng {yearMonth}
      </p>

      <form className="mb-4 flex items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
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
        <button
          type="submit"
          className="h-11 rounded-[var(--radius)] bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Lọc
        </button>
      </form>

      <div className="mb-4 rounded-[var(--radius)] border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">Tỷ lệ không đạt theo từng tiêu chí</h2>
        <CriteriaFailureChart stats={stats} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Xếp hạng tiêu chí vi phạm</h2>
          <ol className="space-y-2">
            {stats.map((s, i) => (
              <li key={s.criterionId}>
                <Link
                  href={`/admin/criteria-analysis?month=${yearMonth}&criterion=${encodeURIComponent(s.criterionId)}`}
                  className={cn(
                    "flex items-center justify-between rounded-[var(--radius)] border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    selectedCriterionId === s.criterionId
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <span>
                    <span className="mr-2 font-semibold text-muted-foreground">{i + 1}.</span>
                    {truncate(s.criterionName, 45)}
                  </span>
                  <span className="shrink-0 font-bold text-warning">{s.failCount} lần</span>
                </Link>
              </li>
            ))}
            {stats.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            )}
          </ol>
        </div>

        <div className="rounded-[var(--radius)] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">
            {selectedStat ? `Chi tiết vi phạm — ${truncate(selectedStat.criterionName, 40)}` : "Chọn một tiêu chí để xem chi tiết"}
          </h2>
          {selectedCriterionId ? (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto">
              {violations.map((v) => {
                let note: string | undefined;
                if (v.roundId) {
                  try {
                    const snapshot: CriterionSnapshotItem[] = JSON.parse(v.criteriaSnapshotJson || "[]");
                    note = snapshot.find((i) => i.criterionId === selectedCriterionId)?.note;
                  } catch {
                    note = undefined;
                  }
                } else {
                  try {
                    const legacyNotes: { criterionNumber: number; note: string }[] = JSON.parse(v.notesJson || "[]");
                    const num = criteria.find((c) => c.criterionId === selectedCriterionId)?.criterionNumber;
                    note = legacyNotes.find((n) => n.criterionNumber === num)?.note;
                  } catch {
                    note = undefined;
                  }
                }
                return (
                  <div key={v.submissionId} className="rounded-md border border-border p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.className}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateVN(v.date)} {formatTimeVN(v.timestamp)} ·{" "}
                        {v.session === "MORNING" ? "Sáng" : "Chiều"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Người chấm: {v.judgeName || v.judgeEmail}</p>
                    {note && <p className="text-xs italic">Ghi chú: {note}</p>}
                  </div>
                );
              })}
              {violations.length === 0 && (
                <p className="text-sm text-muted-foreground">Không có vi phạm nào.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bấm vào một tiêu chí bên trái để xem lớp/ngày/buổi/người chấm vi phạm.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
