"use client";

import * as React from "react";
import { useTransition } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { sendAdminSummaryReportAction } from "@/lib/actions/emailActions";

function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BGHReportCard({ defaultEmail }: { defaultEmail: string }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [raw, setRaw] = React.useState(defaultEmail);

  const emails = parseEmails(raw);
  const invalidEmails = emails.filter((e) => !EMAIL_RE.test(e));

  const handleSend = () => {
    if (emails.length === 0) {
      toast({ variant: "error", title: "Vui lòng nhập ít nhất 1 email BGH." });
      return;
    }
    if (invalidEmails.length > 0) {
      toast({ variant: "error", title: `Email không hợp lệ: ${invalidEmails.join(", ")}` });
      return;
    }
    startTransition(async () => {
      const result = await sendAdminSummaryReportAction({ toEmails: emails });
      if (result.ok) {
        const { sentCount, failedEmails } = result.data;
        if (failedEmails.length === 0) {
          toast({ variant: "success", title: `Đã gửi báo cáo tới ${sentCount} email BGH.` });
        } else {
          toast({
            variant: "error",
            title: `Đã gửi ${sentCount} email, lỗi tới: ${failedEmails.join(", ")}`,
          });
        }
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Gửi báo cáo tới BGH
        </CardTitle>
        <CardDescription>
          Báo cáo tổng hợp toàn trường (số liệu hôm nay + tiến độ các Đợt chấm đang diễn ra/sắp
          tới) — nhập email của Ban Giám hiệu, có thể nhập nhiều email cùng lúc.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label>Email người nhận (mỗi email 1 dòng, hoặc phân cách bằng dấu phẩy)</Label>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={3}
          className="mt-1"
          placeholder={"hieutruong@fpt.edu.vn\nphohieutruong@fpt.edu.vn"}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {emails.length > 0
            ? `${emails.length} email sẽ nhận báo cáo.`
            : "Chưa có email nào hợp lệ."}
        </p>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleSend} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Gửi báo cáo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
