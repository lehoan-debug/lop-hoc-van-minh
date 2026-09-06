"use client";

import * as React from "react";
import { Check, X, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface CriterionCardProps {
  number: number;
  name: string;
  value: 0 | 1 | undefined;
  note: string;
  onChange: (value: 0 | 1) => void;
  onNoteChange: (note: string) => void;
}

export function CriterionCard({
  number,
  name,
  value,
  note,
  onChange,
  onNoteChange,
}: CriterionCardProps) {
  const [showNote, setShowNote] = React.useState(!!note);

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border p-4 transition-colors",
        value === 1 && "border-success/40 bg-success/5",
        value === 0 && "border-warning/40 bg-warning/5",
        value === undefined && "border-border bg-card",
      )}
    >
      <p className="mb-3 text-sm font-semibold text-muted-foreground">
        TIÊU CHÍ {number}
      </p>
      <p className="mb-4 text-[15px] leading-relaxed">{name}</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(1)}
          className={cn(
            "flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius)] border text-sm font-semibold transition-colors",
            value === 1
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
            onChange(0);
            setShowNote(true);
          }}
          className={cn(
            "flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius)] border text-sm font-semibold transition-colors",
            value === 0
              ? "border-warning bg-warning text-warning-foreground"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          <X className="h-5 w-5" />
          KHÔNG ĐẠT
        </button>
      </div>

      {value === 0 && (
        <div className="mt-3">
          {showNote ? (
            <Textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ghi chú / minh chứng (ví dụ: Còn 2 balo giữa lối đi.)"
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
