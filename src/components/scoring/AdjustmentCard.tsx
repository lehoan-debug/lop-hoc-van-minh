"use client";

import * as React from "react";
import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { PointStepper } from "@/components/scoring/PointStepper";

interface AdjustmentCardProps {
  kind: "BONUS" | "PENALTY";
  points: number;
  note: string;
  onPointsChange: (value: number) => void;
  onNoteChange: (note: string) => void;
}

const CONFIG = {
  BONUS: {
    title: "ĐIỂM CỘNG",
    hint: "Ghi nhận điểm thưởng nếu có.",
    tone: "success" as const,
    sign: "+" as const,
    border: "border-success/30",
    bg: "bg-success/5",
  },
  PENALTY: {
    title: "ĐIỂM TRỪ",
    hint: "Ghi nhận vi phạm nếu có.",
    tone: "warning" as const,
    sign: "-" as const,
    border: "border-warning/30",
    bg: "bg-warning/5",
  },
};

export function AdjustmentCard({
  kind,
  points,
  note,
  onPointsChange,
  onNoteChange,
}: AdjustmentCardProps) {
  const [showNote, setShowNote] = React.useState(!!note);
  const c = CONFIG[kind];

  return (
    <div className={cn("rounded-[var(--radius)] border p-4", c.border, c.bg)}>
      <p className="text-sm font-semibold text-muted-foreground">{c.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>

      <div className="my-3">
        <PointStepper
          value={points}
          onChange={(v) => {
            onPointsChange(v);
            if (v > 0) setShowNote(true);
          }}
          tone={c.tone}
          sign={c.sign}
        />
      </div>

      {showNote ? (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Ghi chú (không bắt buộc)"
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
  );
}
