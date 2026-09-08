"use client";

import * as React from "react";
import { Check, X, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface RoundCriterionCardProps {
  index: number;
  total: number;
  name: string;
  maxScore: number;
  value: "PASS" | "FAIL" | undefined;
  note: string;
  /** `undefined` = bỏ chọn (chưa chấm) — bấm lại nút đang chọn để bỏ chọn. */
  onChange: (value: "PASS" | "FAIL" | undefined) => void;
  onNoteChange: (note: string) => void;
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

export function RoundCriterionCard({
  index,
  total,
  name,
  maxScore,
  value,
  note,
  onChange,
  onNoteChange,
}: RoundCriterionCardProps) {
  const [showNote, setShowNote] = React.useState(!!note);

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border p-4 transition-colors",
        value === "PASS" && "border-success/40 bg-success/5",
        value === "FAIL" && "border-warning/40 bg-warning/5",
        value === undefined && "border-border bg-card",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {index} / {total}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          Điểm: {formatScore(maxScore)}
        </p>
      </div>
      <p className="mb-4 text-[15px] leading-relaxed">{name}</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(value === "PASS" ? undefined : "PASS")}
          className={cn(
            "flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius)] border text-sm font-semibold transition-colors",
            value === "PASS"
              ? "border-success bg-success text-success-foreground"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          <Check className="h-5 w-5" />
          ĐẠT
        </button>
        <button
          type="button"
          onClick={() => {
            const next = value === "FAIL" ? undefined : "FAIL";
            onChange(next);
            if (next === "FAIL") setShowNote(true);
          }}
          className={cn(
            "flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius)] border text-sm font-semibold transition-colors",
            value === "FAIL"
              ? "border-warning bg-warning text-warning-foreground"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          <X className="h-5 w-5" />
          KHÔNG ĐẠT
        </button>
      </div>

      {value === "FAIL" && (
        <div className="mt-3">
          {showNote ? (
            <Textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ghi chú / minh chứng"
              className="text-sm"
              rows={2}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="flex items-center gap-1 text-sm text-primary"
            >
              <PenLine className="h-3.5 w-3.5" />
              Ghi chú
            </button>
          )}
        </div>
      )}
    </div>
  );
}
