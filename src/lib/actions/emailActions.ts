"use server";

import { z } from "zod";
import { requireUser, requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { canViewHomeroomClass } from "@/lib/auth/permissions";
import {
  getClasses,
  getScores,
  getAdjustments,
  getSettings,
  getCriteria,
  getScoringRounds,
  appendAuditLog,
} from "@/lib/google/sheets";
import { computeMonthlyRankingForGrade, computeCriteriaFailureStats, computeDashboardCards } from "@/lib/admin/aggregate";
import { getEffectiveRoundStatus, ROUND_STATUS_LABEL } from "@/lib/rounds/roundStatus";
import { isClassInRoundScope } from "@/lib/rounds/eligibility";
import { currentYearMonthVN, getMonthDateRange, todayVN, formatDateVN } from "@/lib/timezone/timezone";
import { getResendClient, getFromEmail } from "@/lib/email/resendClient";
import { buildHomeroomReportEmail, buildAdminSummaryReportEmail } from "@/lib/email/templates";

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

/** Gửi báo cáo lớp chủ nhiệm qua email — GVCN chỉ gửi được báo cáo ĐÚNG lớp
 * mình (canViewHomeroomClass), khớp nguyên tắc "GVCN không xem/gửi được
 * lớp khác" đã xác nhận trước đó. Dữ liệu tính giống hệt /homeroom/page.tsx. */
export async function sendHomeroomReportAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = sendHomeroomReportSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { classId, toEmail } = parsed.data;

    if (!canViewHomeroomClass(user, classId)) {
      return fail("Bạn không có quyền gửi báo cáo lớp này.");
    }

    const allClasses = await getClasses({ activeOnly: true });
    const classInfo = allClasses.find((c) => c.classId === classId);
    if (!classInfo) return fail("Không tìm thấy lớp.");

    const yearMonth = currentYearMonthVN();
    const { from, to } = getMonthDateRange(yearMonth);
    const today = todayVN();

    const [monthScores, monthAdjustments, settings, criteria, todayScores] = await Promise.all([
      getScores({ dateFrom: from, dateTo: to, classId }),
      getAdjustments({ dateFrom: from, dateTo: to, classId }),
      getSettings(),
      getCriteria(),
      getScores({ dateFrom: today, dateTo: today, classId }),
    ]);

    const isUnconfirmed = settings.DAILY_SCORE_COMBINE_MODE === "UNCONFIRMED";
    let ranking = null as ReturnType<typeof computeMonthlyRankingForGrade>[number] | null;
    let totalRankedInGrade = 0;
    if (!isUnconfirmed) {
      const gradeClasses = allClasses.filter((c) => c.grade === classInfo.grade);
      const gradeScores = await getScores({ dateFrom: from, dateTo: to, grade: classInfo.grade });
      const gradeAdjustments = await getAdjustments({ dateFrom: from, dateTo: to });
      const rankingList = computeMonthlyRankingForGrade({
        classes: gradeClasses,
        scoresOfMonth: gradeScores,
        adjustmentsOfMonth: gradeAdjustments,
        combineMode: settings.DAILY_SCORE_COMBINE_MODE,
        yearMonth,
      });
      ranking = rankingList.find((r) => r.classId === classId) ?? null;
      totalRankedInGrade = rankingList.length;
    }

    const failureStats = computeCriteriaFailureStats(monthScores, criteria).filter((s) => s.failCount > 0);
    const bonusTotal = monthAdjustments.filter((a) => a.type === "BONUS").reduce((sum, a) => sum + a.points, 0);
    const penaltyTotal = monthAdjustments.filter((a) => a.type === "PENALTY").reduce((sum, a) => sum + a.points, 0);
    const todayTotal = todayScores.reduce((sum, s) => sum + (s.totalScore ?? s.totalCriteriaScore), 0);
    const todayMax = todayScores.reduce((sum, s) => sum + (s.maxPossibleScore ?? 11), 0);

    const sortedScores = [...monthScores].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const email = buildHomeroomReportEmail({
      classInfo,
      yearMonthLabel: yearMonth,
      todayLabel: formatDateVN(today),
      todayTotal,
      todayMax,
      hasTodayScore: todayScores.length > 0,
      isUnconfirmed,
      ranking,
      totalRankedInGrade,
      bonusTotal,
      penaltyTotal,
      adjustments: [...monthAdjustments].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      failureStats,
      recentScores: sortedScores.map((s) => ({ ...s, formattedDate: formatDateVN(s.date) })),
    });

    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: toEmail,
      subject: email.subject,
      html: email.html,
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

const sendAdminSummarySchema = z.object({
  toEmail: z.string().email(),
});

/** Gửi báo cáo tổng hợp toàn trường qua email — chỉ ADMIN/SUPER_ADMIN. Dữ
 * liệu tính giống hệt /admin/page.tsx (Dashboard). */
export async function sendAdminSummaryReportAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = sendAdminSummarySchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { toEmail } = parsed.data;

    const date = todayVN();
    const [allClasses, scoresOfDate, adjustmentsOfDate, allRounds] = await Promise.all([
      getClasses({ activeOnly: true }),
      getScores({ dateFrom: date, dateTo: date }),
      getAdjustments({ dateFrom: date, dateTo: date }),
      getScoringRounds(),
    ]);

    const cards = computeDashboardCards({
      classesInScope: allClasses,
      scoresInScope: scoresOfDate,
      adjustmentsInScope: adjustmentsOfDate,
    });

    const now = new Date();
    const statusPriority: Record<string, number> = { OPEN: 0, SCHEDULED: 1 };
    const relevantRounds = allRounds
      .map((round) => ({ round, effectiveStatus: getEffectiveRoundStatus(round, now) }))
      .filter((r) => r.effectiveStatus === "OPEN" || r.effectiveStatus === "SCHEDULED")
      .sort((a, b) => {
        const p = statusPriority[a.effectiveStatus]! - statusPriority[b.effectiveStatus]!;
        return p !== 0 ? p : a.round.startsAt.localeCompare(b.round.startsAt);
      })
      .slice(0, 5);

    const rounds = await Promise.all(
      relevantRounds.map(async ({ round, effectiveStatus }) => {
        const classesInRoundScope = allClasses.filter((c) => isClassInRoundScope(round, c.classId, c.grade));
        const scoresOfRound = await getScores({ roundId: round.roundId });
        const doneClassIds = new Set(scoresOfRound.map((s) => s.classId));
        const notDoneClassNames = classesInRoundScope
          .filter((c) => !doneClassIds.has(c.classId))
          .map((c) => c.className);
        return {
          title: round.title,
          statusLabel: ROUND_STATUS_LABEL[effectiveStatus],
          doneCount: classesInRoundScope.length - notDoneClassNames.length,
          totalCount: classesInRoundScope.length,
          notDoneClassNames,
        };
      }),
    );

    const email = buildAdminSummaryReportEmail({
      dateLabel: formatDateVN(date),
      totalSubmissions: cards.totalSubmissions,
      classesScoredCount: cards.classesScoredCount,
      classesNotScoredCount: cards.classesNotScoredCount,
      averageScore: cards.averageScore,
      bonusTotal: cards.bonusTotal,
      penaltyTotal: cards.penaltyTotal,
      rounds,
    });

    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getFromEmail(),
      to: toEmail,
      subject: email.subject,
      html: email.html,
    });
    if (error) return fail(`Không gửi được email: ${error.message}`);

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "SEND_EMAIL_REPORT",
      entityType: "EmailReport",
      entityId: date,
      details: { type: "admin_summary", toEmail },
    });

    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}
