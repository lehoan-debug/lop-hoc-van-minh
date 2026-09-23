"use server";

import { z } from "zod";
import { requireUser, requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { canViewHomeroomClass } from "@/lib/auth/permissions";
import { getClasses, getUsers, appendAuditLog } from "@/lib/google/sheets";
import { todayVN } from "@/lib/timezone/timezone";
import { getResendClient, getFromEmail } from "@/lib/email/resendClient";
import { buildHomeroomReportEmail, buildAdminSummaryReportEmail, type EmailContent } from "@/lib/email/templates";
import { computeHomeroomReportData, computeAdminSummaryReportData } from "@/lib/reports/reportData";
import type { ClassConfig } from "@/types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function handleKnownError(e: unknown): { ok: false; error: string } {
  if (e instanceof UnauthorizedError) return fail(e.message);
  if (e instanceof ForbiddenError) return fail(e.message);
  console.error("[emailAction]", e);
  if (e instanceof Error && e.message.includes("RESEND_")) {
    return fail("Chưa cấu hình gửi email trên server — xem docs/EMAIL_REPORTS_SETUP.md.");
  }
  return fail("Không gửi được email. Vui lòng thử lại.");
}

const sendHomeroomReportSchema = z.object({
  classId: z.string().min(1),
  toEmail: z.string().email(),
});

/** Tính + dựng nội dung email báo cáo cho ĐÚNG 1 lớp — dùng chung cho
 * (a) GVCN tự gửi báo cáo lớp mình và (b) Admin gửi hàng loạt cho nhiều GVCN.
 * Nhận `allClasses` tuỳ chọn để nơi gọi hàng loạt không phải đọc lại Sheet
 * mỗi lớp. Dữ liệu tính giống hệt /homeroom/page.tsx. */
async function buildHomeroomReportEmailForClass(
  classId: string,
  allClassesParam?: ClassConfig[],
): Promise<{ classInfo: ClassConfig; email: EmailContent } | null> {
  const data = await computeHomeroomReportData(classId, allClassesParam);
  if (!data) return null;
  return { classInfo: data.classInfo, email: buildHomeroomReportEmail(data) };
}

/** Gửi báo cáo lớp chủ nhiệm qua email — GVCN chỉ gửi được báo cáo ĐÚNG lớp
 * mình (canViewHomeroomClass), khớp nguyên tắc "GVCN không xem/gửi được
 * lớp khác" đã xác nhận trước đó. */
export async function sendHomeroomReportAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = sendHomeroomReportSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { classId, toEmail } = parsed.data;

    if (!canViewHomeroomClass(user, classId)) {
      return fail("Bạn không có quyền gửi báo cáo lớp này.");
    }

    const built = await buildHomeroomReportEmailForClass(classId);
    if (!built) return fail("Không tìm thấy lớp.");

    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: toEmail,
      subject: built.email.subject,
      html: built.email.html,
    });
    if (error) return fail(`Không gửi được email: ${error.message}`);

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "SEND_EMAIL_REPORT",
      entityType: "EmailReport",
      entityId: classId,
      details: { type: "homeroom", classId, toEmail },
    });

    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

const sendBulkHomeroomReportsSchema = z.object({
  classIds: z.array(z.string().min(1)).min(1).max(200),
});

export interface BulkHomeroomReportSkip {
  classId: string;
  className: string;
  reason: string;
}

export interface BulkHomeroomReportResult {
  sentCount: number;
  skipped: BulkHomeroomReportSkip[];
}

/** Admin gửi hàng loạt báo cáo tới các GVCN — mỗi lớp gửi tới ĐÚNG email của
 * (các) GVCN được phân công lớp đó (tra theo `homeroomClassIds` trong danh
 * sách tài khoản), KHÔNG cho admin tự gõ email nhận. Lớp chưa có GVCN được
 * gán sẽ bị bỏ qua và báo lại trong `skipped`, không gửi nhầm cho ai khác. */
export async function sendBulkHomeroomReportsAction(
  raw: unknown,
): Promise<ActionResult<BulkHomeroomReportResult>> {
  try {
    const admin = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = sendBulkHomeroomReportsSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { classIds } = parsed.data;

    const [allClasses, allUsers] = await Promise.all([getClasses({ activeOnly: true }), getUsers()]);
    const resend = getResendClient();

    const skipped: BulkHomeroomReportSkip[] = [];
    const sentDetails: { classId: string; toEmail: string }[] = [];

    for (const classId of classIds) {
      const classInfo = allClasses.find((c) => c.classId === classId);
      const className = classInfo?.className ?? classId;
      const teachers = allUsers.filter(
        (u) => u.roles.includes("HOMEROOM_TEACHER") && u.homeroomClassIds.includes(classId),
      );
      if (teachers.length === 0) {
        skipped.push({ classId, className, reason: "Chưa có GVCN được phân công lớp này." });
        continue;
      }

      const built = await buildHomeroomReportEmailForClass(classId, allClasses);
      if (!built) {
        skipped.push({ classId, className, reason: "Không tìm thấy dữ liệu lớp." });
        continue;
      }

      for (const teacher of teachers) {
        const { error } = await resend.emails.send({
          from: getFromEmail(),
          to: teacher.email,
          subject: built.email.subject,
          html: built.email.html,
        });
        if (error) {
          skipped.push({ classId, className, reason: `Gửi lỗi tới ${teacher.email}: ${error.message}` });
          continue;
        }
        sentDetails.push({ classId, toEmail: teacher.email });
      }
    }

    await appendAuditLog({
      userEmail: admin.email,
      userName: admin.name,
      action: "SEND_EMAIL_REPORT",
      entityType: "EmailReport",
      entityId: `bulk-homeroom-${classIds.length}-lop`,
      details: { type: "homeroom_bulk", sentDetails, skipped },
    });

    return { ok: true, data: { sentCount: sentDetails.length, skipped } };
  } catch (e) {
    return handleKnownError(e);
  }
}

const sendAdminSummarySchema = z.object({
  toEmails: z.array(z.string().email()).min(1).max(20),
});

export interface AdminSummarySendResult {
  sentCount: number;
  failedEmails: string[];
}

/** Gửi báo cáo tổng hợp toàn trường qua email — chỉ ADMIN/SUPER_ADMIN. Dùng
 * cho thẻ "Gửi BGH": admin tự gõ 1 hoặc nhiều email (BGH thường không có
 * tài khoản trong hệ thống), báo cáo tính 1 lần rồi gửi tới tất cả cùng lúc.
 * Dữ liệu tính giống hệt /admin/page.tsx (Dashboard). */
export async function sendAdminSummaryReportAction(
  raw: unknown,
): Promise<ActionResult<AdminSummarySendResult>> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = sendAdminSummarySchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { toEmails } = parsed.data;

    const date = todayVN();
    const data = await computeAdminSummaryReportData(date);
    const email = buildAdminSummaryReportEmail(data);

    const resend = getResendClient();
    const results = await Promise.all(
      toEmails.map((toEmail) =>
        resend.emails
          .send({ from: getFromEmail(), to: toEmail, subject: email.subject, html: email.html })
          .then((r) => ({ toEmail, error: r.error })),
      ),
    );
    const failedEmails = results.filter((r) => r.error).map((r) => r.toEmail);
    const sentCount = toEmails.length - failedEmails.length;
    if (sentCount === 0) {
      return fail(`Không gửi được email tới: ${failedEmails.join(", ")}`);
    }

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "SEND_EMAIL_REPORT",
      entityType: "EmailReport",
      entityId: date,
      details: { type: "admin_summary", toEmails, failedEmails },
    });

    return { ok: true, data: { sentCount, failedEmails } };
  } catch (e) {
    return handleKnownError(e);
  }
}
