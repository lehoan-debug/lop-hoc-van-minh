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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CriterionCard } from "@/components/scoring/CriterionCard";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDateVN } from "@/lib/timezone/timezone";
import { submitScoreAction } from "@/lib/actions/judgeActions";
import { CRITERION_KEYS, CRITERIA_COUNT, type CriterionKey } from "@/types";
import type { ClassConfig, CriterionConfig, ScoreRecord, Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = {
  MORNING: "Buổi sáng",
  AFTERNOON: "Buổi chiều",
};

interface ScoringScreenProps {
  classInfo: ClassConfig;
  criteria: CriterionConfig[];
  session: Session_;
  date: string;
  existingScore: ScoreRecord | null;
}

type ScoresState = Partial<Record<CriterionKey, 0 | 1>>;
type NotesState = Partial<Record<CriterionKey, string>>;

function draftKey(classId: string, session: Session_, date: string) {
  return `lhvm-draft-${classId}-${session}-${date}`;
}

const SUBMIT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("TIMEOUT")),
      ms,
    );
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

export function ScoringScreen({
  classInfo,
  criteria,
  session,
  date,
  existingScore,
}: ScoringScreenProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [scores, setScores] = React.useState<ScoresState>({});
  const [notes, setNotes] = React.useState<NotesState>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<{ total: number } | null>(
    null,
  );

  const key = draftKey(classInfo.classId, session, date);

  React.useEffect(() => {
    if (existingScore) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { scores: ScoresState; notes: NotesState };
        // Đọc draft từ localStorage (hệ thống ngoài React) chỉ có ở client — không thể
        // dùng lazy initializer vì sẽ lệch với HTML render từ server (hydration mismatch).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScores(parsed.scores ?? {});
        setNotes(parsed.notes ?? {});
      }
    } catch {
      // localStorage có thể không khả dụng (chế độ ẩn danh) — bỏ qua, không chặn chấm điểm.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = React.useCallback(
    (nextScores: ScoresState, nextNotes: NotesState) => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ scores: nextScores, notes: nextNotes }),
        );
      } catch {
        // bỏ qua nếu không lưu được draft
      }
    },
    [key],
  );

  const setCriterion = (ck: CriterionKey, value: 0 | 1) => {
    setScores((prev) => {
      const next = { ...prev, [ck]: value };
      saveDraft(next, notes);
      return next;
    });
  };

  const setNote = (ck: CriterionKey, note: string) => {
    setNotes((prev) => {
      const next = { ...prev, [ck]: note };
      saveDraft(scores, next);
      return next;
    });
  };

  const handleQuickScore = () => {
    const next: ScoresState = {};
    CRITERION_KEYS.forEach((k) => {
      next[k] = 1;
    });
    setScores(next);
    saveDraft(next, notes);
    toast({
      variant: "info",
      title: "Đã đánh dấu 11 tiêu chí là Đạt.",
      description: "Vui lòng kiểm tra lại trước khi gửi.",
    });
  };

  const answeredCount = CRITERION_KEYS.filter((k) => scores[k] !== undefined).length;
  const totalScore = CRITERION_KEYS.reduce((sum, k) => sum + (scores[k] ?? 0), 0);
  const isComplete = answeredCount === CRITERIA_COUNT;

  const handleSubmit = () => {
    if (!isComplete || isPending) return;

    const notesArray = CRITERION_KEYS.filter((k) => scores[k] === 0 && notes[k]?.trim()).map(
      (k) => ({
        criterionNumber: Number(k.replace("c", "")),
        note: notes[k]!.trim(),
      }),
    );

    const payload = {
      date,
      session,
      grade: classInfo.grade,
      classId: classInfo.classId,
      ...(Object.fromEntries(CRITERION_KEYS.map((k) => [k, scores[k]])) as Record<
        CriterionKey,
        0 | 1
      >),
      notes: notesArray,
    };

    startTransition(async () => {
      try {
        const result = await withTimeout(submitScoreAction(payload), SUBMIT_TIMEOUT_MS);
        if (result.ok) {
          try {
            localStorage.removeItem(key);
          } catch {
            // ignore
          }
          setConfirmOpen(false);
          setSubmitted({ total: result.totalCriteriaScore });
          toast({
            variant: "success",
            title: `Đã lưu kết quả ${classInfo.className}.`,
          });
        } else {
          setConfirmOpen(false);
          toast({ variant: "error", title: result.error });
        }
      } catch (e) {
        setConfirmOpen(false);
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

  if (existingScore) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <BackBar />
        <div className="mt-4 rounded-[var(--radius)] border border-success/30 bg-success/5 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          <p className="font-semibold">Kết quả lớp này đã được ghi nhận.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {classInfo.className} · {SESSION_LABEL[session]} · {formatDateVN(date)}
          </p>
          <p className="mt-2 text-2xl font-bold text-success">
            {existingScore.totalCriteriaScore}/{CRITERIA_COUNT}
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {criteria.map((c) => {
            const ck = `c${c.criterionNumber}` as CriterionKey;
            const val = existingScore[ck];
            return (
              <div
                key={c.criterionId}
                className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm"
              >
                <span>Tiêu chí {c.criterionNumber}</span>
                <span className={val === 1 ? "text-success" : "text-warning"}>
                  {val === 1 ? "Đạt" : "Không đạt"}
                </span>
              </div>
            );
          })}
        </div>
        <Button className="mt-5 w-full" onClick={() => router.push("/judge")}>
          Về trang chấm điểm
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="mb-3 h-14 w-14 text-success" />
        <p className="text-lg font-semibold">Đã lưu kết quả {classInfo.className}.</p>
        <p className="mt-1 text-muted-foreground">
          Điểm: {submitted.total}/{CRITERIA_COUNT} · {SESSION_LABEL[session]}
        </p>
        <Button size="lg" className="mt-6 w-full max-w-xs" onClick={() => router.push("/judge")}>
          Chấm lớp tiếp theo
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3">
        <BackBar />
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">{classInfo.className}</p>
            <p className="text-sm text-muted-foreground">
              {SESSION_LABEL[session]} · {formatDateVN(date)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Đã chấm</p>
            <p className="text-lg font-bold">
              {answeredCount}/{CRITERIA_COUNT}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(answeredCount / CRITERIA_COUNT) * 100}%` }}
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
          {criteria.map((c) => {
            const ck = `c${c.criterionNumber}` as CriterionKey;
            return (
              <CriterionCard
                key={c.criterionId}
                number={c.criterionNumber}
                name={c.description}
                value={scores[ck]}
                note={notes[ck] ?? ""}
                onChange={(v) => setCriterion(ck, v)}
                onNoteChange={(n) => setNote(ck, n)}
              />
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-4 sm:sticky">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">TỔNG ĐIỂM</p>
            <p className="text-xl font-bold">
              {totalScore}/{CRITERIA_COUNT}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!isComplete}
            onClick={() => setConfirmOpen(true)}
            className="flex-1"
          >
            Xác nhận & Gửi
          </Button>
        </div>
        {!isComplete && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Bạn chưa chấm đủ 11 tiêu chí.
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !isPending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận gửi</DialogTitle>
            <DialogDescription>
              Kiểm tra lại thông tin trước khi gửi kết quả chấm điểm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 rounded-[var(--radius)] bg-secondary p-3 text-sm">
            <Row label="Lớp" value={classInfo.className} />
            <Row label="Ngày" value={formatDateVN(date)} />
            <Row label="Buổi" value={SESSION_LABEL[session]} />
            <Row label="Điểm" value={`${totalScore}/${CRITERIA_COUNT}`} bold />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Quay lại
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="w-full sm:w-auto">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận gửi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(bold && "text-base font-bold")}>{value}</span>
    </div>
  );
}

function BackBar() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/judge")}
      className="flex items-center gap-1 text-sm text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Quay lại chọn lớp
    </button>
  );
}
