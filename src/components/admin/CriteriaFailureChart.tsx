"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CriterionFailureStat } from "@/lib/admin/aggregate";

export function CriteriaFailureChart({ stats }: { stats: CriterionFailureStat[] }) {
  const data = [...stats]
    .sort((a, b) => a.criterionNumber - b.criterionNumber)
    .map((s) => ({
      name: `TC${s.criterionNumber}`,
      "Tỷ lệ không đạt (%)": Math.round(s.failRate * 1000) / 10,
    }));

  if (data.every((d) => d["Tỷ lệ không đạt (%)"] === 0)) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip />
          <Bar dataKey="Tỷ lệ không đạt (%)" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
