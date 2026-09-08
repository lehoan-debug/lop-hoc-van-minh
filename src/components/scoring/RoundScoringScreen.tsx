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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDateVN, formatTimeVN } from "@/lib/timezone/timezone";
import { submitRoundScoreAction } from "@/lib/actions/roundScoreActions";
import { RoundCriterionCard } from "@/components/scoring/RoundCriterionCard";
import { AdjustmentCard } from "@/components/scoring/AdjustmentCard";
import type {
  ClassConfig,
  CriterionConfig,
  EffectiveRoundStatus,
  ScoreRecord,
  ScoringRound,
  Session_,
} from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

// BottomNav (z-40) đứng cố định ở bottom:0 trên mobile — thanh CTA của màn
// chấm điểm PHẢI đứng NGAY TRÊN nó (bottom = chiều cao nav + safe-area), nếu
// không sẽ bị BottomNav đè hoàn toàn (bug từng gặp: nút "Xem lại & Xác nhận"
// mất tích trên điện thoại thật). Trên desktop (sm+) BottomNav ẩn nên CTA trở
// lại bám đáy màn hình bình thường.
const FIXED_FOOTER_CLASS =
  "fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)_+_env(safe-area-inset-bottom))] z-30 border-t border-border bg-card p-4 sm:sticky sm:bottom-0";
// Nội dung cuộn phải chừa đủ chỗ bên dưới để không bị thanh CTA phía trên che
// (chiều cao CTA ước lượng ~84px + nav + safe-area + khoảng hở 24px).
const SCROLL_CONTENT_CLASS =
  "pb-[calc(var(--bottom-nav-height)_+_env(safe-area-inset-bottom)_+_84px_+_24px)]";

type Answers = Record<string, "PASS" | "FAIL">;
type Notes = Record<string, string>;
type Phase = "scoring" | "review" | "done";

interface DraftShape {
  answers: Answers;
  notes: Notes;
  bonusPoints?: number;
  bonusNote?: string;
  penaltyPoints?: number;
  penaltyNote?: string;
  generalNote?: string;
}

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
  const [bonusPoints, setBonusPoints] = React.useState(0);
  const [bonusNote, setBonusNote] = React.useState("");
  const [penaltyPoints, setPenaltyPoints] = React.useState(0);
  const [penaltyNote, setPenaltyNote] = React.useState("");
  const [generalNote, setGeneralNote] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("scoring");
  const [submittedTotals, setSubmittedTotals] = React.useState<{
    totalScore: number;
    maxPossibleScore: number;
    finalScore: number;
  } | null>(null);
  const [draftPrompt, setDraftPrompt] = React.useState<DraftShape | null>(null);

  React.useEffect(() => {
    if (existingScore) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftShape;
        const hasAnswers = parsed.answers && Object.keys(parsed.answers).length > 0;
        const hasAdjustments = (parsed.bonusPoints ?? 0) > 0 || (parsed.penaltyPoints ?? 0) > 0;
        const hasGeneralNote = (parsed.generalNote ?? "").trim().length > 0;
        if (hasAnswers || hasAdjustments || hasGeneralNote) {
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
    (draft: DraftShape) => {
      try {
        localStorage.setItem(key, JSON.stringify(draft));
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

  // value = undefined -> bỏ chọn (trở về "chưa chấm"), đúng yêu cầu bấm lại
  // nút đang chọn để bỏ đạt/không đạt — tiêu chí không bắt buộc phải chấm hết.
  const setAnswer = (criterionId: string, value: "PASS" | "FAIL" | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[criterionId];
      } else {
        next[criterionId] = value;
      }
      saveDraft({ answers: next, notes, bonusPoints, bonusNote, penaltyPoints, penaltyNote, generalNote });
      return next;
    });
  };

  const setNote = (criterionId: string, note: string) => {
    setNotes((prev) => {
      const next = { ...prev, [criterionId]: note };
      saveDraft({ answers, notes: next, bonusPoints, bonusNote, penaltyPoints, penaltyNote, generalNote });
      return next;
    });
  };

  const handleBonusChange = (value: number) => {
    setBonusPoints(value);
    saveDraft({ answers, notes, bonusPoints: value, bonusNote, penaltyPoints, penaltyNote, generalNote });
  };
  const handleBonusNoteChange = (value: string) => {
    setBonusNote(value);
    saveDraft({ answers, notes, bonusPoints, bonusNote: value, penaltyPoints, penaltyNote, generalNote });
  };
  const handlePenaltyChange = (value: number) => {
    setPenaltyPoints(value);
    saveDraft({ answers, notes, bonusPoints, bonusNote, penaltyPoints: value, penaltyNote, generalNote });
  };
  const handlePenaltyNoteChange = (value: string) => {
    setPenaltyNote(value);
    saveDraft({ answers, notes, bonusPoints, bonusNote, penaltyPoints, penaltyNote: value, generalNote });
  };
  const handleGeneralNoteChange = (value: string) => {
    setGeneralNote(value);
    saveDraft({ answers, notes, bonusPoints, bonusNote, penaltyPoints, penaltyNote, generalNote: value });
  };

  const handleQuickScore = () => {
    const next: Answers = {};
    criteria.forEach((c) => {
      next[c.criterionId] = "PASS";
    });
    setAnswers(next);
    saveDraft({ answers: next, notes, bonusPoints, bonusNote, penaltyPoints, penaltyNote, generalNote });
    toast({
      variant: "info",
      title: `Đã đánh dấu ${criteria.length} tiêu chí là Đạt.`,
      description: "Vui lòng kiểm tra lại trước khi gửi.",
    });
  };

  const answeredCount = criteria.filter((c) => answers[c.criterionId] !== undefined).length;
  // Không bắt buộc chấm hết mọi tiêu chí hiển thị — chỉ cần chấm ít nhất 1
  // tiêu chí là được nộp (1 Đợt chấm có thể chỉ áp dụng 1 phần bộ tiêu chí,
  // và trong phần đó vẫn có thể bỏ trống tiêu chí không quan sát được).
  const isComplete = answeredCount > 0;

  const criteriaScore = criteria.reduce((sum, c) => {
    const a = answers[c.criterionId];
    return sum + (a === "PASS" ? c.maxScore : 0);
  }, 0);
  // Chỉ tính maxPossibleScore trên các tiêu chí ĐÃ CHẤM — khớp với
  // buildCriteriaSnapshot (tiêu chí bỏ trống bị loại khỏi snapshot hoàn
  // toàn, không cộng cũng không tính vào tổng tối đa).
  const maxPossibleScore = criteria.reduce(
    (sum, c) => (answers[c.criterionId] !== undefined ? sum + c.maxScore : sum),
    0,
  );
  const finalScore = criteriaScore + bonusPoints - penaltyPoints;

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
            bonusPoints,
            bonusNote,
            penaltyPoints,
            penaltyNote,
            generalNote,
          }),
          SUBMIT_TIMEOUT_MS,
        );
        if (result.ok) {
          clearDraft();
          setSubmittedTotals({
            totalScore: result.totalScore,
            maxPossibleScore: result.maxPossibleScore,
            finalScore: result.totalScore + bonusPoints - penaltyPoints,
          });
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
              setBonusPoints(draftPrompt.bonusPoints ?? 0);
              setBonusNote(draftPrompt.bonusNote ?? "");
              setPenaltyPoints(draftPrompt.penaltyPoints ?? 0);
              setPenaltyNote(draftPrompt.penaltyNote ?? "");
              setGeneralNote(draftPrompt.generalNote ?? "");
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
          {existingScore.generalNote && (
            <p className="mt-3 rounded-md bg-card px-3 py-2 text-left text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Nhận xét chung: </span>
              {existingScore.generalNote}
            </p>
          )}
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
          Điểm tiêu chí: {submittedTotals.totalScore}/{submittedTotals.maxPossibleScore}
        </p>
        {(bonusPoints > 0 || penaltyPoints > 0) && (
          <p className="text-sm text-muted-foreground">
            {bonusPoints > 0 && <span className="text-success">Cộng {bonusPoints}</span>}
            {bonusPoints > 0 && penaltyPoints > 0 && " · "}
            {penaltyPoints > 0 && <span className="text-warning">Trừ {penaltyPoints}</span>}
          </p>
        )}
        <p className="mt-1 text-2xl font-bold">Tổng điểm: {submittedTotals.finalScore}</p>
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
      <div className={cn("mx-auto max-w-lg", SCROLL_CONTENT_CLASS)}>
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
            {classInfo.className} · {round.title} · {formatDateVN(new Date())}
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
                    a === "PASS" ? "text-success" : a === "FAIL" ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {a === "PASS" ? `ĐẠT · +${c.maxScore}` : a === "FAIL" ? "KHÔNG ĐẠT · +0" : "Chưa chấm"}
                </span>
              </div>
            );
          })}
        </div>

        {generalNote && (
          <div className="px-4">
            <div className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm">
              <p className="mb-1 font-semibold">Nhận xét chung</p>
              <p className="text-muted-foreground">{generalNote}</p>
            </div>
          </div>
        )}

        <div className="px-4 pt-2">
          <div className="rounded-[var(--radius)] border border-border bg-card p-4 text-sm">
            <p className="mb-2 font-semibold">Kết quả tạm tính</p>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Điểm tiêu chí</span>
              <span className="font-medium">
                {criteriaScore} / {maxPossibleScore}
              </span>
            </div>
            {bonusPoints > 0 && (
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Điểm cộng</span>
                <span className="font-medium text-success">+{bonusPoints}</span>
              </div>
            )}
            {penaltyPoints > 0 && (
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Điểm trừ</span>
                <span className="font-medium text-warning">-{penaltyPoints}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold">TỔNG ĐIỂM</span>
              <span className="text-lg font-bold">{finalScore}</span>
            </div>
          </div>
        </div>

        <div className={FIXED_FOOTER_CLASS}>
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">TỔNG ĐIỂM</p>
              <p className="text-xl font-bold">{finalScore}</p>
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
    <div className={cn("mx-auto max-w-lg", SCROLL_CONTENT_CLASS)}>
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

        <div className="mt-4 space-y-3">
          <AdjustmentCard
            kind="BONUS"
            points={bonusPoints}
            note={bonusNote}
            onPointsChange={handleBonusChange}
            onNoteChange={handleBonusNoteChange}
          />
          <AdjustmentCard
            kind="PENALTY"
            points={penaltyPoints}
            note={penaltyNote}
            onPointsChange={handlePenaltyChange}
            onNoteChange={handlePenaltyNoteChange}
          />
        </div>

        <div className="mt-4 rounded-[var(--radius)] border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Nhận xét chung</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Ghi chú chi tiết cho cả lượt chấm (không gắn với 1 tiêu chí cụ thể) — Giáo viên chủ
            nhiệm sẽ nhìn thấy nhận xét này.
          </p>
          <Textarea
            value={generalNote}
            onChange={(e) => handleGeneralNoteChange(e.target.value)}
            placeholder="Vd: Lớp có tinh thần tốt nhưng còn vài bạn để đồ cá nhân trên bàn..."
            className="text-sm"
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="mt-4 rounded-[var(--radius)] border border-border bg-card p-4 text-sm">
          <p className="mb-2 font-semibold">Kết quả tạm tính</p>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Điểm tiêu chí</span>
            <span className="font-medium">
              {criteriaScore} / {maxPossibleScore}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Điểm cộng</span>
            <span className="font-medium text-success">+{bonusPoints}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Điểm trừ</span>
            <span className="font-medium text-warning">-{penaltyPoints}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="font-semibold">TỔNG ĐIỂM</span>
            <span className="text-lg font-bold">{finalScore}</span>
          </div>
        </div>
      </div>

      <div className={FIXED_FOOTER_CLASS}>
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">TỔNG ĐIỂM</p>
            <p className="text-xl font-bold">{finalScore}</p>
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
            Chọn ít nhất 1 tiêu chí trước khi tiếp tục.
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
