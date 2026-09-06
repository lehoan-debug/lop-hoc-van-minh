"use server";

import { requireUser, canAccessGrade, UnauthorizedError } from "@/lib/auth/session";
import { submitScoreSchema } from "@/lib/validation/schemas";
import {
  getClasses,
  checkDuplicateScore,
  createScore,
  appendAuditLog,
} from "@/lib/google/sheets";
import { CRITERION_KEYS, type CriterionKey } from "@/types";
import { todayVN } from "@/lib/timezone/timezone";

export interface SubmitScoreOk {
  ok: true;
  submissionId: string;
  totalCriteriaScore: number;
}
export interface SubmitScoreErr {
  ok: false;
  error: string;
  code: "DUPLICATE" | "FORBIDDEN" | "INVALID" | "UNKNOWN";
}

export async function submitScoreAction(
  raw: unknown,
): Promise<SubmitScoreOk | SubmitScoreErr> {
  try {
    const user = await requireUser();

    const parsed = submitScoreSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Bạn chưa chấm đủ 11 tiêu chí hoặc dữ liệu không hợp lệ.",
        code: "INVALID",
      };
    }
    const input = parsed.data;

    if (!canAccessGrade(user, input.grade)) {
      return {
        ok: false,
        error: "Bạn không có quyền chấm khối này.",
        code: "FORBIDDEN",
      };
    }

    if (input.date !== todayVN()) {
      return {
        ok: false,
        error: "Chỉ có thể chấm cho ngày hiện tại. Vui lòng tải lại trang.",
        code: "INVALID",
      };
    }

    const classes = await getClasses({ activeOnly: true });
    const klass = classes.find(
      (c) => c.classId === input.classId && c.grade === input.grade,
    );
    if (!klass) {
      return {
        ok: false,
        error: "Lớp không tồn tại hoặc đã ngừng chấm điểm.",
        code: "INVALID",
      };
    }

    const dup = await checkDuplicateScore({
      date: input.date,
      session: input.session,
      classId: input.classId,
      judgeEmail: user.email,
    });
    if (dup) {
      return {
        ok: false,
        error: "Bạn đã chấm lớp này trong buổi này.",
        code: "DUPLICATE",
      };
    }

    const scores = Object.fromEntries(
      CRITERION_KEYS.map((key) => [key, input[key]]),
    ) as Record<CriterionKey, 0 | 1>;

    const record = await createScore({
      date: input.date,
      session: input.session,
      grade: input.grade,
      classId: input.classId,
      className: klass.className,
      judgeEmail: user.email,
      judgeName: user.name,
      scores,
      notes: input.notes,
    });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "SUBMIT_SCORE",
      entityType: "Score",
      entityId: record.submissionId,
      details: {
        classId: input.classId,
        session: input.session,
        date: input.date,
        totalCriteriaScore: record.totalCriteriaScore,
      },
    });

    return {
      ok: true,
      submissionId: record.submissionId,
      totalCriteriaScore: record.totalCriteriaScore,
    };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return { ok: false, error: "Phiên đăng nhập đã hết hạn.", code: "FORBIDDEN" };
    }
    console.error("[submitScoreAction]", e);
    return {
      ok: false,
      error: "Không thể lưu kết quả. Vui lòng thử lại.",
      code: "UNKNOWN",
    };
  }
}
