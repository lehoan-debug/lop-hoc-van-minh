"use client";

import * as React from "react";
import { useTransition } from "react";
import { AlertCircle, Trophy, Gavel, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateTimeVN } from "@/lib/timezone/timezone";
import { saveManualRankingDecisionAction } from "@/lib/actions/adminActions";
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { Grade, RankingDecisionRecord } from "@/types";

export function RankingTable({
  results,
  decisions,
  yearMonth,
  grade,
}: {
  results: ClassRankingResult[];
  decisions: RankingDecisionRecord[];
  yearMonth: string;
  grade: Grade;
}) {
  const [decidingFor, setDecidingFor] = React.useState<ClassRankingResult | null>(null);
  const decisionByClass = new Map(decisions.map((d) => [d.classId, d]));

  const displayRows = [...results].sort((a, b) => {
    const rankA = decisionByClass.get(a.classId)?.manualRankingDecision ?? a.rank;
    const rankB = decisionByClass.get(b.classId)?.manualRankingDecision ?? b.rank;
    return rankA - rankB;
  });

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Hạng</th>
            <th className="px-3 py-2">Lớp</th>
            <th className="px-3 py-2">Điểm TB</th>
            <th className="px-3 py-2">Số ngày chấm</th>
            <th className="px-3 py-2">Điểm cộng</th>
            <th className="px-3 py-2">Điểm trừ</th>
            <th className="px-3 py-2">Số lần đạt điểm tối đa</th>
            <th className="px-3 py-2 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r) => {
            const decision = decisionByClass.get(r.classId);
            const displayRank = decision?.manualRankingDecision ?? r.rank;
            return (
              <tr key={r.classId} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {displayRank <= 2 && <Trophy className="h-4 w-4 text-warning" />}
                    <span className="font-semibold">{displayRank}</span>
                    {decision && (
                      <span
                        title={`Đã quyết định thủ công bởi ${decision.decidedByName || decision.decidedByEmail} lúc ${formatDateTimeVN(decision.decidedAt)}: ${decision.decisionReason}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        <Gavel className="h-3 w-3" />
                        Thủ công
                      </span>
                    )}
                    {!decision && r.needsManualReview && (
                      <span
                        title="Đồng hạng — cần Ban Tổ chức xem xét thủ công"
                        className="inline-flex items-center"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-warning" />
                      </span>
                    )}
                  </div>
                </td>
                <td className={cn("px-3 py-2 font-medium")}>{r.className}</td>
                <td className="px-3 py-2">
                  {r.averageScore !== null ? r.averageScore.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2">{r.daysGraded}</td>
                <td className="px-3 py-2 text-success">+{r.bonusPointsTotal}</td>
                <td className="px-3 py-2 text-destructive">-{r.penaltyTotal}</td>
                <td className="px-3 py-2">{r.maxScoreDaysCount}</td>
                <td className="px-3 py-2 text-right">
                  {r.needsManualReview && (
                    <Button size="sm" variant="outline" onClick={() => setDecidingFor(r)}>
                      <Gavel className="h-3.5 w-3.5" />
                      {decision ? "Sửa quyết định" : "Ghi nhận quyết định"}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {results.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                Chưa có dữ liệu chấm điểm trong khoảng thời gian này.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {results.some((r) => r.needsManualReview) && (
        <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning" />
          Các lớp có dấu đồng hạng sau khi áp dụng hết quy tắc xét ưu tiên tự động — Ban Tổ chức xem
          xét và ghi nhận quyết định thủ công theo Kế hoạch (không tự động chọn lớp thắng).
        </p>
      )}

      {decidingFor && (
        <ManualRankingDecisionDialog
          result={decidingFor}
          existing={decisionByClass.get(decidingFor.classId)}
          yearMonth={yearMonth}
          grade={grade}
          onClose={() => setDecidingFor(null)}
        />
      )}
    </div>
  );
}

function ManualRankingDecisionDialog({
  result,
  existing,
  yearMonth,
  grade,
  onClose,
}: {
  result: ClassRankingResult;
  existing?: RankingDecisionRecord;
  yearMonth: string;
  grade: Grade;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [rank, setRank] = React.useState(String(existing?.manualRankingDecision ?? result.rank));
  const [reason, setReason] = React.useState(existing?.decisionReason ?? "");

  const handleSave = () => {
    if (!reason.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập lý do quyết định." });
      return;
    }
    startTransition(async () => {
      const result_ = await saveManualRankingDecisionAction({
        yearMonth,
        grade,
        classId: result.classId,
        manualRankingDecision: Number(rank) || 1,
        decisionReason: reason,
      });
      if (result_.ok) {
        toast({ variant: "success", title: "Đã lưu quyết định xếp hạng thủ công." });
        onClose();
      } else {
        toast({ variant: "error", title: result_.error });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận quyết định xếp hạng — {result.className}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Hạng chính thức</Label>
            <Input
              type="number"
              min={1}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="mt-1 w-32"
            />
          </div>
          <div>
            <Label>Lý do quyết định</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vd: Xét kết quả thực hiện xuyên suốt các lần chấm trong tháng, lớp có tinh thần cải thiện rõ rệt hơn."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu quyết định
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
