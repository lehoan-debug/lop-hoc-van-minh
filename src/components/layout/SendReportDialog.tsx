"use client";

import * as React from "react";
import { useTransition } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface SendReportResult {
  ok: boolean;
  error?: string;
}

export function SendReportButton({
  defaultEmail,
  title,
  description,
  onSend,
}: {
  /** Email mặc định điền sẵn — thường là email của chính người bấm gửi. */
  defaultEmail: string;
  title: string;
  description: string;
  onSend: (toEmail: string) => Promise<SendReportResult>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Mail className="h-3.5 w-3.5" />
        Gửi báo cáo qua email
      </Button>
      {open && (
        <SendReportDialog
          defaultEmail={defaultEmail}
          title={title}
          description={description}
          onSend={onSend}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SendReportDialog({
  defaultEmail,
  title,
  description,
  onSend,
  onClose,
}: {
  defaultEmail: string;
  title: string;
  description: string;
  onSend: (toEmail: string) => Promise<SendReportResult>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = React.useState(defaultEmail);
  const [sent, setSent] = React.useState(false);

  const handleSend = () => {
    if (!email.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập email người nhận." });
      return;
    }
    startTransition(async () => {
      const result = await onSend(email.trim());
      if (result.ok) {
        setSent(true);
        toast({ variant: "success", title: `Đã gửi báo cáo tới ${email.trim()}.` });
      } else {
        toast({ variant: "error", title: result.error ?? "Không gửi được email." });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>

        {sent ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm font-medium">Đã gửi báo cáo tới {email}.</p>
          </div>
        ) : (
          <div>
            <Label>Gửi tới email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@fpt.edu.vn"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mặc định là email của bạn — có thể đổi sang email khác (vd. hiệu trưởng, phòng công
              tác học sinh) trước khi gửi.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {sent ? "Đóng" : "Huỷ"}
          </Button>
          {!sent && (
            <Button onClick={handleSend} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Gửi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
