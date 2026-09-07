"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PointStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  sign?: "+" | "-";
  tone?: "success" | "warning";
}

export function PointStepper({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  sign = "+",
  tone = "success",
}: PointStepperProps) {
  const dec = () => onChange(Math.max(min, roundStep(value - step, step)));
  const inc = () => onChange(Math.min(max, roundStep(value + step, step)));

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Giảm"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground disabled:opacity-40"
      >
        <Minus className="h-5 w-5" />
      </button>
      <span
        className={cn(
          "min-w-[64px] text-center text-2xl font-bold tabular-nums",
          value > 0 && tone === "success" && "text-success",
          value > 0 && tone === "warning" && "text-warning",
        )}
      >
        {value > 0 ? `${sign}${formatNumber(value)}` : formatNumber(value)}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Tăng"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-white disabled:opacity-40",
          tone === "success" ? "border-success bg-success" : "border-warning bg-warning",
        )}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

function roundStep(n: number, step: number): number {
  if (!Number.isFinite(n)) return 0;
  const decimals = step < 1 ? String(step).split(".")[1]?.length ?? 0 : 0;
  return Number(n.toFixed(decimals));
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
