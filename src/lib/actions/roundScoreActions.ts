"use server";

import { z } from "zod";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { canAccessScoring } from "@/lib/auth/permissions";
import {
  getScoringRound,
  isUserAssignedToRound,
  checkDuplicateRoundScore,
  createRoundScore,
  getClasses,
  getCriteria,
  appendAuditLog,
} from "@/lib/google/sheets";
import { checkRoundEligibility, type RoundEligibilityCode } from "@/lib/rounds/eligibility";
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
  code: RoundEligibilityCode | "DUPLICATE" | "INVALID" | "FORBIDDEN" | "UNKNOWN";
}

const submitRoundScoreSchema = z.object({
  roundId: z.string().min(1),
  classId: z.string().min(1),
  answers: z.record(z.string(), z.enum(["PASS", "FAIL"])),
  notes: z.record(z.string(), z.string()).optional().default({}),
});

const ELIGIBILITY_MESSAGE: Record<RoundEligibilityCode, string> = {
  OK: "",
  ROUND_DRAFT: "Đợt chấm chưa được mở.",
  ROUND_SCHEDULED: "Đợt chấm chưa bắt đầu.",
  ROUND_LOCKED: "Đợt chấm đã kết thúc. Kết quả chưa được lưu. Vui lòng liên hệ Quản trị viên nếu cần xử lý.",
  ROUND_CANCELLED: "Đợt chấm đã bị huỷ.",
  NOT_ASSIGNED: "Bạn chưa được phân công vào đợt chấm này.",
  OUT_OF_ROUND_SCOPE: "Lớp này không thuộc phạm vi của đợt chấm.",
  OUT_OF_ASSIGNMENT_SCOPE: "Bạn không được phân công chấm lớp này.",
};

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

    const assignment = await isUserAssignedToRound(input.roundId, user.email);

    // Kiểm tra tại thời điểm SUBMIT (không phải lúc mở form) — chống trường
    // hợp mở form lúc đợt còn mở nhưng bấm Submit sau khi đã hết giờ.
    const eligibility = checkRoundEligibility({
      round,
      assignment,
      classId: klass.classId,
      grade: klass.grade,
      now: new Date(),
    });
    if (!eligibility.ok) {
      return { ok: false, error: ELIGIBILITY_MESSAGE[eligibility.code], code: eligibility.code };
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
