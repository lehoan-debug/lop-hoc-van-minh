"use server";

import { z } from "zod";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { canAccessScoring } from "@/lib/auth/permissions";
import {
  getScoringRound,
  canScoreClassInRound,
  checkDuplicateRoundScore,
  createRoundScore,
  createAdjustment,
  getClasses,
  getCriteria,
  appendAuditLog,
  type CanScoreCode,
} from "@/lib/google/sheets";
import { criterionAppliesToGrade } from "@/lib/google/sheets";
import { buildCriteriaSnapshot, isAllCriteriaAnswered, totalsFromSnapshot } from "@/lib/scoring/roundScore";
import { todayVN, formatDateTimeVN } from "@/lib/timezone/timezone";

export interface SubmitRoundScoreOk {
  ok: true;
  submissionId: string;
  totalScore: number;
  maxPossibleScore: number;
}

export interface SubmitRoundScoreErr {
  ok: false;
  error: string;
  code: CanScoreCode | "DUPLICATE" | "INVALID" | "FORBIDDEN" | "UNKNOWN";
}

// Giới hạn điểm cộng/trừ nhập trực tiếp lúc chấm — dùng chung ngưỡng với
// Adjustments do Admin tạo tay (xem createAdjustmentSchema trong
// src/lib/validation/schemas.ts) để tránh hai quy tắc khác nhau cho cùng
// một loại dữ liệu (BONUS/PENALTY).
const ADJUSTMENT_POINTS_MAX = 10;

const submitRoundScoreSchema = z.object({
  roundId: z.string().min(1),
  classId: z.string().min(1),
  answers: z.record(z.string(), z.enum(["PASS", "FAIL"])),
  notes: z.record(z.string(), z.string()).optional().default({}),
  // Điểm cộng/trừ nhập ngay khi chấm — ghi thành Adjustment (BONUS/PENALTY)
  // riêng biệt, KHÔNG lưu vào Scores, để tránh hai nguồn dữ liệu mâu thuẫn
  // (xem docs/V2_UPGRADE_ANALYSIS.md). Server luôn tự tính lại, không tin số
  // liệu client gửi lên cho bất kỳ mục đích nào khác ngoài việc tạo Adjustment.
  bonusPoints: z.number().int().min(0).max(ADJUSTMENT_POINTS_MAX).optional().default(0),
  bonusNote: z.string().max(1000).optional().default(""),
  penaltyPoints: z.number().int().min(0).max(ADJUSTMENT_POINTS_MAX).optional().default(0),
  penaltyNote: z.string().max(1000).optional().default(""),
});

export async function submitRoundScoreAction(
  raw: unknown,
): Promise<SubmitRoundScoreOk | SubmitRoundScoreErr> {
  try {
    const user = await requireUser();
    if (!canAccessScoring(user)) {
      return { ok: false, error: "Bạn không có quyền chấm điểm.", code: "FORBIDDEN" };
    }

    const parsed = submitRoundScoreSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Dữ liệu gửi lên không hợp lệ.", code: "INVALID" };
    }
    const input = parsed.data;

    const round = await getScoringRound(input.roundId);
    if (!round) {
      return { ok: false, error: "Không tìm thấy Đợt chấm.", code: "INVALID" };
    }

    const classes = await getClasses({ activeOnly: true });
    const klass = classes.find((c) => c.classId === input.classId);
    if (!klass) {
      return { ok: false, error: "Lớp không tồn tại hoặc đã ngừng chấm.", code: "INVALID" };
    }

    // Nguồn sự thật DUY NHẤT cho quyền chấm — kiểm tra lại tại thời điểm
    // SUBMIT (không phải lúc mở form), gồm cả việc user có được phân công
    // CHÍNH XÁC lớp này hay không (mục 9: không chỉ filter UI).
    const eligibility = await canScoreClassInRound(user.email, input.roundId, klass.classId);
    if (!eligibility.ok) {
      return { ok: false, error: eligibility.message, code: eligibility.code };
    }

    const dup = await checkDuplicateRoundScore({ roundId: input.roundId, classId: input.classId });
    if (dup) {
      return {
        ok: false,
        error: `Lớp ${klass.className} đã được chấm lúc ${formatDateTimeVN(dup.timestamp)} bởi ${dup.judgeName || dup.judgeEmail}.`,
        code: "DUPLICATE",
      };
    }

    const allCriteria = await getCriteria({ activeOnly: true });
    const criteria = allCriteria.filter((c) => criterionAppliesToGrade(c, klass.grade));

    if (!isAllCriteriaAnswered(criteria, input.answers)) {
      return { ok: false, error: "Bạn chưa chấm đủ tất cả tiêu chí.", code: "INVALID" };
    }

    const snapshot = buildCriteriaSnapshot(criteria, input.answers, input.notes);
    const { totalScore, maxPossibleScore } = totalsFromSnapshot(snapshot);

    const record = await createRoundScore({
      roundId: input.roundId,
      date: todayVN(),
      session: round.session,
      grade: klass.grade,
      classId: klass.classId,
      className: klass.className,
      judgeEmail: user.email,
      judgeName: user.name,
      criteriaSnapshot: snapshot,
    });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "SUBMIT_SCORE",
      entityType: "Score",
      entityId: record.submissionId,
      details: { roundId: input.roundId, classId: klass.classId, totalScore, maxPossibleScore },
    });

    // Điểm cộng/trừ nhập kèm lượt chấm -> ghi vào Adjustments (nguồn dữ liệu
    // chuẩn cho BONUS/PENALTY, dùng chung với /admin/adjustments) — không
    // lưu trùng vào Scores. points=0 thì không tạo dòng nào (không có gì để
    // ghi nhận).
    if (input.bonusPoints > 0) {
      const bonus = await createAdjustment({
        date: todayVN(),
        classId: klass.classId,
        className: klass.className,
        type: "BONUS",
        points: input.bonusPoints,
        description: input.bonusNote.trim() || "Ghi nhận khi chấm điểm Lớp học Văn minh.",
        recordedByEmail: user.email,
        recordedByName: user.name,
      });
      await appendAuditLog({
        userEmail: user.email,
        userName: user.name,
        action: "ADD_BONUS",
        entityType: "Adjustment",
        entityId: bonus.adjustmentId,
        details: { classId: klass.classId, points: input.bonusPoints, submissionId: record.submissionId },
      });
    }
    if (input.penaltyPoints > 0) {
      const penalty = await createAdjustment({
        date: todayVN(),
        classId: klass.classId,
        className: klass.className,
        type: "PENALTY",
        points: input.penaltyPoints,
        description: input.penaltyNote.trim() || "Ghi nhận khi chấm điểm Lớp học Văn minh.",
        recordedByEmail: user.email,
        recordedByName: user.name,
      });
      await appendAuditLog({
        userEmail: user.email,
        userName: user.name,
        action: "ADD_PENALTY",
        entityType: "Adjustment",
        entityId: penalty.adjustmentId,
        details: { classId: klass.classId, points: input.penaltyPoints, submissionId: record.submissionId },
      });
    }

    return { ok: true, submissionId: record.submissionId, totalScore, maxPossibleScore };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return { ok: false, error: "Phiên đăng nhập đã hết hạn.", code: "FORBIDDEN" };
    }
    if (e instanceof ForbiddenError) {
      return { ok: false, error: e.message, code: "FORBIDDEN" };
    }
    console.error("[submitRoundScoreAction]", e);
    return { ok: false, error: "Không thể lưu kết quả. Vui lòng thử lại.", code: "UNKNOWN" };
  }
}
