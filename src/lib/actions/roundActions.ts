"use server";

import { revalidatePath } from "next/cache";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { canManageRounds } from "@/lib/auth/permissions";
import {
  createScoringRound,
  updateScoringRound,
  lockScoringRound,
  reopenScoringRound,
  cancelScoringRound,
  getScoringRound,
  assignJudgeToRound,
  removeJudgeFromRound,
  replaceAssignmentsForUser,
  setClassAssignees,
  getClasses,
  getUsers,
  getRoundAssignments,
  bulkImportAssignments,
  appendAuditLog,
} from "@/lib/google/sheets";
import { isClassInRoundScope, isClassInAssignmentScope } from "@/lib/rounds/eligibility";
import { distributeClassesSequentially } from "@/lib/rounds/sequentialAssign";
import { zonedTimeToUtc } from "@/lib/timezone/timezone";
import { z } from "zod";
import { gradeSchema, sessionSchema } from "@/lib/validation/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function handleKnownError(e: unknown): { ok: false; error: string } {
  if (e instanceof UnauthorizedError) return fail(e.message);
  if (e instanceof ForbiddenError) return fail(e.message);
  console.error("[roundAction]", e);
  return fail("Đã có lỗi xảy ra. Vui lòng thử lại.");
}

const createRoundSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tên đợt chấm"),
  description: z.string().optional().default(""),
  session: sessionSchema,
  /** Ngày dạng YYYY-MM-DD (giờ Việt Nam). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Giờ dạng HH:mm (giờ Việt Nam). */
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  gradeIds: z.array(gradeSchema).default([]),
  classIds: z.array(z.string()).default([]),
  /** Rỗng = áp dụng mọi tiêu chí phù hợp khối — xem isCriterionInRoundScope. */
  criterionIds: z.array(z.string()).default([]),
});

export async function createRoundAction(raw: unknown): Promise<ActionResult<{ roundId: string }>> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền tạo Đợt chấm.");
    const parsed = createRoundSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.");
    const input = parsed.data;

    const startsAt = zonedTimeToUtc(input.date, `${input.startTime}:00`);
    const endsAt = zonedTimeToUtc(input.date, `${input.endTime}:00`);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return fail("Giờ kết thúc phải sau giờ bắt đầu.");
    }

    const round = await createScoringRound({
      title: input.title,
      description: input.description,
      session: input.session,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      gradeIds: input.gradeIds,
      classIds: input.classIds,
      criterionIds: input.criterionIds,
      createdBy: user.email,
    });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "CREATE_SCORING_ROUND",
      entityType: "ScoringRound",
      entityId: round.roundId,
      details: { title: round.title, startsAt: round.startsAt, endsAt: round.endsAt },
    });

    revalidatePath("/admin/scoring-rounds");
    revalidatePath("/judge");
    return { ok: true, data: { roundId: round.roundId } };
  } catch (e) {
    return handleKnownError(e);
  }
}

const updateRoundSchema = createRoundSchema.partial().extend({
  roundId: z.string().min(1),
});

export async function updateRoundAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền sửa Đợt chấm.");
    const parsed = updateRoundSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { roundId, date, startTime, endTime, ...rest } = parsed.data;

    const existing = await getScoringRound(roundId);
    if (!existing) return fail("Không tìm thấy Đợt chấm.");

    const updates: Parameters<typeof updateScoringRound>[1] = { ...rest };
    if (date && startTime) {
      updates.startsAt = zonedTimeToUtc(date, `${startTime}:00`).toISOString();
    }
    if (date && endTime) {
      updates.endsAt = zonedTimeToUtc(date, `${endTime}:00`).toISOString();
    }

    // Không hạn chế sửa giờ theo trạng thái Đợt chấm (kể cả đang OPEN) — dời
    // endsAt là cách chính thức để "mở thêm giờ" (xem roundStatus.ts). Chỉ
    // chặn nếu kết quả cuối cùng vô lý (kết thúc không sau bắt đầu).
    const effectiveStartsAt = updates.startsAt ?? existing.startsAt;
    const effectiveEndsAt = updates.endsAt ?? existing.endsAt;
    if (new Date(effectiveEndsAt).getTime() <= new Date(effectiveStartsAt).getTime()) {
      return fail("Giờ kết thúc phải sau giờ bắt đầu.");
    }

    const ok = await updateScoringRound(roundId, updates);
    if (!ok) return fail("Không thể cập nhật Đợt chấm.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE_SCORING_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
      details: updates,
    });

    revalidatePath("/admin/scoring-rounds");
    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function lockRoundAction(roundId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền khoá Đợt chấm.");
    const ok = await lockScoringRound(roundId, user.email);
    if (!ok) return fail("Không tìm thấy Đợt chấm.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "LOCK_SCORING_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
    });

    revalidatePath("/admin/scoring-rounds");
    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function reopenRoundAction(
  roundId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền mở lại Đợt chấm.");
    const ok = await reopenScoringRound(roundId);
    if (!ok) return fail("Không tìm thấy Đợt chấm.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "REOPEN_SCORING_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
      details: { reason: reason ?? "" },
    });

    revalidatePath("/admin/scoring-rounds");
    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

/** "Xoá" đợt chấm — thực chất là soft-delete (đặt status=CANCELLED), đúng
 * nguyên tắc xuyên suốt app: KHÔNG xoá cứng dữ liệu. Score/Assignment đã có
 * của đợt vẫn giữ nguyên trong Sheet để tra cứu/audit; đợt chỉ không còn
 * hiển thị để chấm/sử dụng được nữa (CANCELLED chặn mọi submit — xem
 * checkRoundEligibility). */
export async function deleteRoundAction(roundId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền xoá Đợt chấm.");
    const ok = await cancelScoringRound(roundId);
    if (!ok) return fail("Không tìm thấy Đợt chấm.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "DELETE_SCORING_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
    });

    revalidatePath("/admin/scoring-rounds");
    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

const assignJudgeSchema = z.object({
  roundId: z.string().min(1),
  userEmail: z.string().email(),
  allowedGradeIds: z.array(gradeSchema).optional().default([]),
  allowedClassIds: z.array(z.string()).optional().default([]),
});

export async function assignJudgeAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền phân công người chấm.");
    const parsed = assignJudgeSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const input = parsed.data;

    await assignJudgeToRound({ ...input, assignedBy: user.email });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "ASSIGN_JUDGE_TO_ROUND",
      entityType: "ScoringRound",
      entityId: input.roundId,
      details: { userEmail: input.userEmail },
    });

    revalidatePath(`/admin/scoring-rounds/${input.roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

/** Gán tất cả Giám khảo hiện có (mọi tài khoản có role JUDGE/ADMIN/SUPER_ADMIN
 * đang active) vào 1 Đợt chấm — đúng tuỳ chọn "Chọn tất cả Giám khảo" (mục J). */
export async function assignAllJudgesAction(roundId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền phân công người chấm.");

    const users = await getUsers();
    const eligible = users.filter(
      (u) => u.active && u.roles.some((r) => r === "JUDGE" || r === "ADMIN" || r === "SUPER_ADMIN"),
    );

    for (const u of eligible) {
      await assignJudgeToRound({ roundId, userEmail: u.email, assignedBy: user.email });
    }

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "ASSIGN_JUDGE_TO_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
      details: { bulk: true, count: eligible.length },
    });

    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function removeJudgeAction(
  roundId: string,
  userEmail: string,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền gỡ người chấm.");
    const ok = await removeJudgeFromRound(roundId, userEmail);
    if (!ok) return fail("Không tìm thấy phân công.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "REMOVE_JUDGE_FROM_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
      details: { userEmail },
    });

    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

const replaceUserAssignmentsSchema = z.object({
  roundId: z.string().min(1),
  userEmail: z.string().email(),
  classIds: z.array(z.string()).default([]),
});

/** Tab "Theo người" — THAY THẾ toàn bộ danh sách lớp của 1 người trong 1
 * Round (nút "Lưu phân công"). Ghi AuditLog before/after đúng mục 20. */
export async function replaceUserAssignmentsAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền phân công người chấm.");
    const parsed = replaceUserAssignmentsSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { roundId, userEmail, classIds } = parsed.data;

    const { before, after } = await replaceAssignmentsForUser(roundId, userEmail, classIds, user.email);

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "REPLACE_USER_ASSIGNMENTS",
      entityType: "ScoringRoundAssignment",
      entityId: roundId,
      details: { userEmail, before, after },
    });

    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/admin/scoring-rounds");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

const setClassAssigneesSchema = z.object({
  roundId: z.string().min(1),
  classId: z.string().min(1),
  userEmails: z.array(z.string().email()).default([]),
});

/** Tab "Theo lớp" — đặt lại toàn bộ danh sách người phụ trách 1 lớp trong 1
 * Round cùng lúc (mục 11 — 1 lớp có thể có nhiều người). */
export async function setClassAssigneesAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền phân công người chấm.");
    const parsed = setClassAssigneesSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { roundId, classId, userEmails } = parsed.data;

    const classes = await getClasses({ activeOnly: true });
    const klass = classes.find((c) => c.classId === classId);
    if (!klass) return fail("Lớp không tồn tại.");

    await setClassAssignees(roundId, classId, klass.grade, userEmails, user.email);

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "BULK_ASSIGN_CLASSES",
      entityType: "ScoringRoundAssignment",
      entityId: roundId,
      details: { classId, userEmails },
    });

    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/admin/scoring-rounds");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

const randomAssignSchema = z.object({
  roundId: z.string().min(1),
  judgeEmails: z.array(z.string().email()).min(1, "Chọn ít nhất 1 người chấm"),
  // Bắt buộc đúng 1 khối — 1 Giám khảo không được chấm 2 khối khác nhau
  // trong cùng 1 lần chia, nên không cho gộp "Tất cả khối" ở đây.
  gradeFilter: gradeSchema,
  // "auto" = chia đều (số lớp/người tự tính); số cụ thể = cố định số
  // lớp/người do Admin chọn — xem distributeClassesSequentially.
  classesPerJudge: z.union([z.literal("auto"), z.number().int().min(1).max(50)]),
});

export interface RandomAssignResult {
  assignedClassCount: number;
  perJudge: { email: string; count: number }[];
  /** Số lớp còn dư không đủ người nhận (chỉ ở chế độ số lớp/người cố định). */
  unassignedRemainingCount: number;
}

/**
 * Phân công theo LỚP LIÊN TIẾP: chia các lớp thuộc phạm vi Round + ĐÚNG 1
 * khối đã chọn, mà HIỆN CHƯA có ai phụ trách, cho những người chấm được chọn
 * — mỗi người nhận 1 khối lớp LIÊN TIẾP theo đúng thứ tự (vd. 10A1-10A3),
 * không bao giờ ngắt quãng, không bao giờ 1 người dính 2 khối. CHỈ cộng thêm
 * vào phân công hiện có (không đụng lớp đã có người phụ trách), tính toán ở
 * SERVER (không tin danh sách lớp/thứ tự từ client) — xem
 * distributeClassesSequentially.
 */
export async function randomAssignAction(
  raw: unknown,
): Promise<ActionResult<RandomAssignResult>> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) return fail("Bạn không có quyền phân công người chấm.");
    const parsed = randomAssignSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { roundId, judgeEmails, gradeFilter, classesPerJudge } = parsed.data;

    const round = await getScoringRound(roundId);
    if (!round) return fail("Không tìm thấy Đợt chấm.");

    const [allClasses, assignments] = await Promise.all([
      getClasses({ activeOnly: true }),
      getRoundAssignments(roundId),
    ]);

    const unassignedClasses = allClasses
      .filter((c) => isClassInRoundScope(round, c.classId, c.grade))
      .filter((c) => c.grade === gradeFilter)
      .filter((c) => !assignments.some((a) => isClassInAssignmentScope(a, c.classId, c.grade)))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (unassignedClasses.length === 0) {
      return fail("Không còn lớp nào chưa được phân công trong khối đã chọn.");
    }

    const sortedClassIds = unassignedClasses.map((c) => c.classId);
    const { byJudge, unassignedClassIds: leftover } = distributeClassesSequentially(
      sortedClassIds,
      judgeEmails,
      classesPerJudge,
    );
    await bulkImportAssignments(roundId, byJudge, user.email);

    const perJudge = judgeEmails.map((email) => ({
      email,
      count: byJudge.get(email)?.length ?? 0,
    }));
    const assignedClassCount = sortedClassIds.length - leftover.length;

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "RANDOM_ASSIGN_CLASSES",
      entityType: "ScoringRoundAssignment",
      entityId: roundId,
      details: {
        judgeEmails,
        gradeFilter,
        classesPerJudge,
        assignedClassCount,
        unassignedRemainingCount: leftover.length,
        perJudge,
      },
    });

    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    revalidatePath("/admin/scoring-rounds");
    revalidatePath("/judge");
    return {
      ok: true,
      data: { assignedClassCount, perJudge, unassignedRemainingCount: leftover.length },
    };
  } catch (e) {
    return handleKnownError(e);
  }
}

/** Admin tự thêm mình vào danh sách người chấm của 1 Đợt (mục D — Admin muốn
 * trực tiếp chấm thì tự thêm mình vào phân công, không bypass ngầm). */
export async function assignMyselfToRoundAction(roundId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["JUDGE", "ADMIN", "SUPER_ADMIN"]);
    await assignJudgeToRound({ roundId, userEmail: user.email, assignedBy: user.email });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "ASSIGN_JUDGE_TO_ROUND",
      entityType: "ScoringRound",
      entityId: roundId,
      details: { userEmail: user.email, selfAssigned: true },
    });

    revalidatePath("/judge");
    revalidatePath(`/admin/scoring-rounds/${roundId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}
