"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function DeleteRoundConfirmDialog({
  roundTitle,
  doneCount,
  assignedJudgeCount,
  onCancel,
  onConfirm,
  isPending,
}: {
  roundTitle: string;
  doneCount: number;
  assignedJudgeCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá đợt chấm &quot;{roundTitle}&quot;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Đợt chấm sẽ chuyển sang trạng thái Đã huỷ, không thể chấm điểm hay chỉnh sửa tiếp. Đây là
          thao tác an toàn — không xoá dữ liệu, chỉ cần liên hệ Quản trị viên cấp cao nếu cần khôi
          phục.
        </p>
        {(doneCount > 0 || assignedJudgeCount > 0) && (
          <div className="flex items-start gap-2 rounded-[var(--radius)] border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Đợt này đã có {doneCount} kết quả chấm điểm và {assignedJudgeCount} người được phân
              công. Các dữ liệu này KHÔNG bị xoá, vẫn tra cứu được trong Kết quả/Xuất Excel — chỉ
              đợt chấm sẽ không dùng để chấm điểm được nữa.
            </span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận xoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
