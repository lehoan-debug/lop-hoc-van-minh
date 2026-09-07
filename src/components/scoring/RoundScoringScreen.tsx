"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  ChevronRight,
  Pencil,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { submitRoundScoreAction } from "@/lib/actions/roundScoreActions";
import { RoundCriterionCard } from "@/components/scoring/RoundCriterionCard";
import type {
  ClassConfig,
  CriterionConfig,
  EffectiveRoundStatus,
  ScoreRecord,
  ScoringRound,
  Session_,
} from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

type Answers = Record<string, "PASS" | "FAIL">;
type Notes = Record<string, string>;
type Phase = "scoring" | "review" | "done";

interface RoundScoringScreenProps {
  round: ScoringRound;
  classInfo: ClassConfig;
  criteria: CriterionConfig[];
  judgeEmail: string;
  effectiveStatus: EffectiveRoundStatus;
  canSubmit: boolean;
  existingScore: ScoreRecord | null;
}

function draftKey(roundId: string, classId: string, judgeEmail: string) {
  return `lhvm-draft-v2:${roundId}:${classId}:${judgeEmail}`;
}

const SUBMIT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function RoundScoringScreen({
  round,
  classInfo,
  criteria,
  judgeEmail,
  effectiveStatus,
  canSubmit,
  existingScore,
}: RoundScoringScreenProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const key = draftKey(round.roundId, classInfo.classId, judgeEmail);

  const [answers, setAnswers] = React.useState<Answers>({});
  const [notes, setNotes] = React.useState<Notes>({});
  const [phase, setPhase] = React.useState<Phase>("scoring");
  const [submittedTotals, setSubmittedTotals] = React.useState<{
    totalScore: number;
    maxPossibleScore: number;
  } | null>(null);
  const [draftPrompt, setDraftPrompt] = React.useState<{
    answers: Answers;
    notes: Notes;
  } | null>(null);

  React.useEffect(() => {
    if (existingScore) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { answers: Answers; notes: Notes };
        if (parsed.answers && Object.keys(parsed.answers).length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDraftPrompt(parsed);
        }
      }
    } catch {
      // localStorage có thể không khả dụng — bỏ qua, không chặn chấm điểm.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = React.useCallback(
    (nextAnswers: Answers, nextNotes: Notes) => {
      try {
        localStorage.setItem(key, JSON.stringify({ answers: nextAnswers, notes: nextNotes }));
      } catch {
        // ignore
      }
    },
    [key],
  );

  const clearDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  const setAnswer = (criterionId: string, value: "PASS" | "FAIL") => {
    setAnswers((prev) => {
      const next = { ...prev, [criterionId]: value };
      saveDraft(next, notes);
      return next;
    });
  };

  const setNote = (criterionId: string, note: string) => {
    setNotes((prev) => {
      const next = { ...prev, [criterionId]: note };
      saveDraft(answers, next);
      return next;
    });
  };

  const handleQuickScore = () => {
    const next: Answers = {};
    criteria.forEach((c) => {
      next[c.criterionId] = "PASS";
    });
    setAnswers(next);
    saveDraft(next, notes);
    toast({
      variant: "info",
      title: `Đã đánh dấu ${criteria.length} tiêu chí là Đạt.`,
      description: "Vui lòng kiểm tra lại trước khi gửi.",
    });
  };

  const answeredCount = criteria.filter((c) => answers[c.criterionId] !== undefined).length;
  const isComplete = answeredCount === criteria.length && criteria.length > 0;

  const totalScore = criteria.reduce((sum, c) => {
    const a = answers[c.criterionId];
    return sum + (a === "PASS" ? c.maxScore : 0);
  }, 0);
  const maxPossibleScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  const handleSubmit = () => {
    if (!isComplete || isPending) return;

    startTransition(async () => {
      try {
        const result = await withTimeout(
          submitRoundScoreAction({
            roundId: round.roundId,
            classId: classInfo.classId,
            answers,
            notes,
          }),
          SUBMIT_TIMEOUT_MS,
        );
        if (result.ok) {
          clearDraft();
          setSubmittedTotals({ totalScore: result.totalScore, maxPossibleScore: result.maxPossibleScore });
          setPhase("done");
          toast({ variant: "success", title: `Đã lưu kết quả ${classInfo.className}.` });
        } else {
          toast({ variant: "error", title: result.error });
          // Giữ nguyên draft — không mất lựa chọn hiện tại khi request thất bại.
        }
      } catch (e) {
        const timedOut = e instanceof Error && e.message === "TIMEOUT";
        toast({
          variant: "error",
          title: timedOut
            ? "Hết thời gian chờ. Vui lòng kiểm tra kết nối mạng và thử lại."
            : "Không thể lưu kết quả. Vui lòng thử lại.",
        });
      }
    });
  };

  if (draftPrompt) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center p-6 text-center">
        <Pencil className="mb-3 h-10 w-10 text-primary" />
        <p className="text-lg font-semibold">Bạn có một lượt chấm chưa hoàn thành.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {classInfo.className} · {round.title}
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Button
            size="lg"
            onClick={() => {
              setAnswers(draftPrompt.answers);
              setNotes(draftPrompt.notes);
              setDraftPrompt(null);
            }}
          >
            Tiếp tục
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              clearDraft();
              setDraftPrompt(null);
            }}
          >
            Xoá bản nháp
          </Button>
        </div>
      </div>
    );
  }

  if (existingScore) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <BackBar roundId={round.roundId} />
        <div className="mt-4 rounded-[var(--radius)] border border-success/30 bg-success/5 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          <p className="font-semibold">Kết quả lớp này đã được ghi nhận.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {classInfo.className} · {formatDateVN(existingScore.timestamp)}{" "}
            {formatTimeVN(existingScore.timestamp)} · {existingScore.judgeName}
          </p>
          <p className="mt-2 text-2xl font-bold text-success">
            {existingScore.totalScore ?? 0}/{existingScore.maxPossibleScore ?? 0}
          </p>
        </div>
        <Button className="mt-5 w-full" onClick={() => router.push(`/judge/${round.roundId}`)}>
          Về danh sách lớp
        </Button>
      </div>
    );
  }

  if (phase === "done" && submittedTotals) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="mb-3 h-14 w-14 text-success" />
        <p className="text-lg font-semibold">Đã lưu kết quả {classInfo.className}.</p>
        <p className="mt-1 text-muted-foreground">
          Điểm: {submittedTotals.totalScore}/{submittedTotals.maxPossibleScore}
        </p>
        <Button
          size="lg"
          className="mt-6 w-full max-w-xs"
          onClick={() => router.push(`/judge/${round.roundId}`)}
        >
          Chấm lớp tiếp theo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!canSubmit || effectiveStatus !== "OPEN") {
    return (
      <div className="mx-auto max-w-lg p-4">
        <BackBar roundId={round.roundId} />
        <div className="mt-4 flex flex-col items-center gap-2 rounded-[var(--radius)] bg-warning/10 p-6 text-center">
          <Lock className="h-8 w-8 text-warning" />
          <p className="font-semibold">Không thể chấm lớp này lúc này.</p>
          <p className="text-sm text-muted-foreground">
            Đợt chấm có thể đã kết thúc, chưa mở, hoặc bạn không được phân công chấm lớp này.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="mx-auto max-w-lg pb-28">
        <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
          <button
            onClick={() => setPhase("scoring")}
            className="flex items-center gap-1 text-sm text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Sửa lại
          </button>
          <p className="mt-2 text-lg font-bold">Xem lại kết quả</p>
          <p className="text-sm text-muted-foreground">
            {classInfo.className} · {round.title}
          </p>
        </header>

        <div className="space-y-2 p-4">
          {criteria.map((c, i) => {
            const a = answers[c.criterionId];
            return (
              <div
                key={c.criterionId}
                className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="flex-1">
                  {i + 1}. {c.criterionName}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    a === "PASS" ? "text-success" : "text-warning",
                  )}
                >
                  {a === "PASS" ? "ĐẠT" : "KHÔNG ĐẠT"} · +{a === "PASS" ? c.maxScore : 0}
                </span>
              </div>
            );
          })}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-4 sm:sticky">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">TỔNG ĐIỂM</p>
              <p className="text-xl font-bold">
                {totalScore}/{maxPossibleScore}
              </p>
            </div>
            <Button size="lg" onClick={handleSubmit} disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận & Lưu
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
        <BackBar roundId={round.roundId} />
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">{classInfo.className}</p>
            <p className="text-sm text-muted-foreground">
              {round.title} · Buổi {SESSION_LABEL[round.session]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Đã chấm</p>
            <p className="text-lg font-bold">
              {answeredCount}/{criteria.length}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${criteria.length ? (answeredCount / criteria.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <div className="p-4">
        <button
          type="button"
          onClick={handleQuickScore}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary"
        >
          <Sparkles className="h-4 w-4" />
          Đánh dấu tất cả ĐẠT
        </button>

        <div className="space-y-3">
          {criteria.map((c, i) => (
            <RoundCriterionCard
              key={c.criterionId}
              index={i + 1}
              total={criteria.length}
              name={c.criterionName}
              maxScore={c.maxScore}
              value={answers[c.criterionId]}
              note={notes[c.criterionId] ?? ""}
              onChange={(v) => setAnswer(c.criterionId, v)}
              onNoteChange={(n) => setNote(c.criterionId, n)}
            />
          ))}
          {criteria.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Chưa có tiêu chí nào áp dụng cho khối này.
            </p>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-4 sm:sticky">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">TỔNG ĐIỂM</p>
            <p className="text-xl font-bold">
              {totalScore}/{maxPossibleScore}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!isComplete}
            onClick={() => setPhase("review")}
            className="flex-1"
          >
            Xem lại & Xác nhận
          </Button>
        </div>
        {!isComplete && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Bạn chưa chấm đủ tất cả tiêu chí.
          </p>
        )}
      </div>
    </div>
  );
}

function BackBar({ roundId }: { roundId: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/judge/${roundId}`)}
      className="flex items-center gap-1 text-sm text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại chọn lớp
    </button>
  );
}
