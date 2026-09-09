"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatDateVN } from "@/lib/timezone/timezone";
import type { DailyTrendPoint } from "@/lib/admin/aggregate";

export function DashboardTrendChart({ points }: { points: DailyTrendPoint[] }) {
  const data = points.map((p) => ({
    name: formatDateVN(p.date).slice(0, 5),
    "Lượt chấm": p.totalSubmissions,
    "Điểm TB": p.averageScore !== null ? Math.round(p.averageScore * 10) / 10 : null,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, "auto"]} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="Lượt chấm" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Điểm TB"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
