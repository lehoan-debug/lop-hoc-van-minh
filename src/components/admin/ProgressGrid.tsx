import { Check, Minus } from "lucide-react";
import type { ClassProgressItem } from "@/lib/admin/aggregate";
import type { Grade, Session_ } from "@/types";

export function ProgressGrid({
  progress,
  session,
}: {
  progress: ClassProgressItem[];
  session: Session_;
}) {
  const grades: Grade[] = ["10", "11", "12"];

  return (
    <div className="space-y-5">
      {grades.map((grade) => {
        const items = progress.filter((p) => p.grade === grade);
        if (items.length === 0) return null;
        const doneCount = items.filter((p) =>
          session === "MORNING" ? p.scoredMorning : p.scoredAfternoon,
        ).length;
        return (
          <div key={grade}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">KHỐI {grade}</h3>
              <span className="text-xs text-muted-foreground">
                {doneCount}/{items.length} lớp đã chấm
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {items.map((item) => {
                const done = session === "MORNING" ? item.scoredMorning : item.scoredAfternoon;
                return (
                  <div
                    key={item.classId}
                    className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-background px-2.5 py-1.5 text-sm"
                  >
                    <span>{item.className}</span>
                    {done ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Minus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
