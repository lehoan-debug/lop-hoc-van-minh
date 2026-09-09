import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Grade } from "@/types";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";

const GRADES: Grade[] = ["10", "11", "12"];

export function DashboardTopClasses({
  rankingsByGrade,
  yearMonth,
}: {
  rankingsByGrade: Record<Grade, ClassRankingResult[]>;
  yearMonth: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {GRADES.map((grade) => {
        const ranked = rankingsByGrade[grade].filter((r) => r.averageScore !== null);
        const top3 = ranked.slice(0, 3);
        const bottom3 = ranked.length > 3 ? [...ranked].reverse().slice(0, 3) : [];

        return (
          <div key={grade} className="rounded-[var(--radius)] border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Khối {grade}</p>
              <Link
                href={`/admin/ranking?month=${yearMonth}`}
                className="text-xs text-primary hover:underline"
              >
                Xem đầy đủ
              </Link>
            </div>

            {ranked.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có dữ liệu tháng này.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-success">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Điểm cao nhất
                  </p>
                  <ul className="space-y-1">
                    {top3.map((r) => (
                      <li key={r.classId} className="flex items-center justify-between text-sm">
                        <span>
                          <span className="text-muted-foreground">#{r.rank}</span> {r.className}
                        </span>
                        <strong className="text-success">{r.averageScore!.toFixed(1)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                {bottom3.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-destructive">
                      <TrendingDown className="h-3.5 w-3.5" />
                      Điểm thấp nhất
                    </p>
                    <ul className="space-y-1">
                      {bottom3.map((r) => (
                        <li key={r.classId} className="flex items-center justify-between text-sm">
                          <span>
                            <span className="text-muted-foreground">#{r.rank}</span> {r.className}
                          </span>
                          <strong className="text-destructive">{r.averageScore!.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
