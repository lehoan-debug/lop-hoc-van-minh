"use client";

import { sendAdminSummaryReportAction } from "@/lib/actions/emailActions";
import { SendReportButton } from "@/components/layout/SendReportDialog";

/** Wrapper Client Component — Server Action bọc trong 1 arrow function không
 * tự động serialize được khi truyền thẳng từ Server Component, nên phải bọc
 * ở đây (Client) rồi chỉ nhận prop dạng chuỗi từ trang Server. */
export function AdminSendReportButton({ userEmail }: { userEmail: string }) {
  return (
    <SendReportButton
      defaultEmail={userEmail}
      title="Gửi báo cáo tổng hợp toàn trường"
      description="Email sẽ gồm số liệu tổng quan hôm nay và tiến độ các Đợt chấm đang diễn ra/sắp tới."
      onSend={(toEmail) => sendAdminSummaryReportAction({ toEmail })}
    />
  );
}
