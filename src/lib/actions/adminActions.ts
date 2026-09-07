"use server";

import { revalidatePath } from "next/cache";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import { canAssignRoles } from "@/lib/auth/permissions";
import {
  createAdjustmentSchema,
  editAdjustmentSchema,
  editScoreSchema,
  updateUserSchema,
  updateSettingSchema,
  manualRankingDecisionSchema,
  createCriterionSchema,
  updateCriterionFullSchema,
} from "@/lib/validation/schemas";
import {
  createAdjustment,
  editAdjustment,
  softDeleteAdjustment,
  editScore,
  softDeleteScore,
  getScore,
  getClasses,
  getUserByEmail,
  updateUser,
  updateSetting,
  updateClassActive,
  updateCriterion,
  createCriterion,
  archiveCriterion,
  upsertRankingDecision,
  appendAuditLog,
} from "@/lib/google/sheets";
import { CRITERION_KEYS, type CriterionKey } from "@/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function handleKnownError(e: unknown): { ok: false; error: string } {
  if (e instanceof UnauthorizedError) return fail(e.message);
  if (e instanceof ForbiddenError) return fail(e.message);
  console.error("[adminAction]", e);
  return fail("Đã có lỗi xảy ra. Vui lòng thử lại.");
}

// ---------- Adjustments ----------

export async function createAdjustmentAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = createAdjustmentSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.");
    const input = parsed.data;

    const classes = await getClasses();
    const klass = classes.find((c) => c.classId === input.classId);
    if (!klass) return fail("Lớp không tồn tại.");

    const record = await createAdjustment({
      ...input,
      className: klass.className,
      recordedByEmail: user.email,
      recordedByName: user.name,
    });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: input.type === "BONUS" ? "ADD_BONUS" : "ADD_PENALTY",
      entityType: "Adjustment",
      entityId: record.adjustmentId,
      details: { classId: input.classId, points: input.points },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/adjustments");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function editAdjustmentAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = editAdjustmentSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { adjustmentId, ...updates } = parsed.data;

    const ok = await editAdjustment(adjustmentId, updates);
    if (!ok) return fail("Không tìm thấy bản ghi điểm cộng/trừ.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "EDIT_ADJUSTMENT",
      entityType: "Adjustment",
      entityId: adjustmentId,
      details: updates,
    });

    revalidatePath("/admin/adjustments");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function deleteAdjustmentAction(adjustmentId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const ok = await softDeleteAdjustment(adjustmentId);
    if (!ok) return fail("Không tìm thấy bản ghi.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "DELETE_ADJUSTMENT",
      entityType: "Adjustment",
      entityId: adjustmentId,
    });

    revalidatePath("/admin/adjustments");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

// ---------- Scores (Admin edit / soft-delete) ----------

export async function editScoreAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = editScoreSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { submissionId, notes, ...criteriaInput } = parsed.data;

    const existing = await getScore(submissionId);
    if (!existing || existing.deletedAt) return fail("Không tìm thấy kết quả chấm điểm.");

    const scores = Object.fromEntries(
      CRITERION_KEYS.map((k) => [k, criteriaInput[k]]),
    ) as Record<CriterionKey, 0 | 1>;

    const ok = await editScore(submissionId, { scores, notes });
    if (!ok) return fail("Không thể cập nhật kết quả.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "EDIT_SCORE",
      entityType: "Score",
      entityId: submissionId,
      details: { classId: existing.classId, date: existing.date, session: existing.session },
    });

    revalidatePath("/admin/results");
    revalidatePath("/admin");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function deleteScoreAction(submissionId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const existing = await getScore(submissionId);
    if (!existing) return fail("Không tìm thấy kết quả chấm điểm.");

    const ok = await softDeleteScore(submissionId);
    if (!ok) return fail("Không thể xoá kết quả.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "DELETE_SCORE",
      entityType: "Score",
      entityId: submissionId,
      details: { classId: existing.classId, date: existing.date, session: existing.session },
    });

    revalidatePath("/admin/results");
    revalidatePath("/admin");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

// ---------- Users ----------

export async function updateUserAction(raw: unknown): Promise<ActionResult> {
  try {
    const currentUser = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = updateUserSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const input = parsed.data;

    const existing = await getUserByEmail(input.email);
    const previousRoles = existing?.roles ?? [];

    if (!canAssignRoles(currentUser, previousRoles, input.roles)) {
      return fail("Chỉ Quản trị viên cấp cao mới có thể cấp/thu hồi quyền Quản trị viên.");
    }

    await updateUser(input);

    const addedRoles = input.roles.filter((r) => !previousRoles.includes(r));
    const removedRoles = previousRoles.filter((r) => !input.roles.includes(r));

    await appendAuditLog({
      userEmail: currentUser.email,
      userName: currentUser.name,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: input.email,
      details: { roles: input.roles, active: input.active, addedRoles, removedRoles },
    });
    for (const r of addedRoles) {
      await appendAuditLog({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: "ADD_USER_ROLE",
        entityType: "User",
        entityId: input.email,
        details: { role: r },
      });
    }
    for (const r of removedRoles) {
      await appendAuditLog({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: "REMOVE_USER_ROLE",
        entityType: "User",
        entityId: input.email,
        details: { role: r },
      });
    }
    if (JSON.stringify(existing?.homeroomClassIds ?? []) !== JSON.stringify(input.homeroomClassIds)) {
      await appendAuditLog({
        userEmail: currentUser.email,
        userName: currentUser.name,
        action: "ASSIGN_HOMEROOM_CLASS",
        entityType: "User",
        entityId: input.email,
        details: { homeroomClassIds: input.homeroomClassIds },
      });
    }

    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

// ---------- Settings ----------

export async function updateSettingAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = updateSettingSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");

    await updateSetting(parsed.data.key, parsed.data.value);

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE_SETTINGS",
      entityType: "Settings",
      entityId: parsed.data.key,
      details: { value: parsed.data.value },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

// ---------- Classes / Criteria (bật/tắt trong Settings) ----------

export async function toggleClassActiveAction(
  classId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const ok = await updateClassActive(classId, active);
    if (!ok) return fail("Không tìm thấy lớp.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE_SETTINGS",
      entityType: "Class",
      entityId: classId,
      details: { active },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function toggleCriterionActiveAction(
  criterionId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const ok = await updateCriterion(criterionId, { active });
    if (!ok) return fail("Không tìm thấy tiêu chí.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE_SETTINGS",
      entityType: "Criterion",
      entityId: criterionId,
      details: { active },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/criteria");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function updateCriterionDescriptionAction(
  criterionId: string,
  description: string,
): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    // Khi Admin tự cập nhật mô tả (vd. bổ sung phần bị cắt cụt của tiêu chí 7),
    // coi như đã xử lý xong — tự động tắt cờ needsReview.
    const ok = await updateCriterion(criterionId, { description, needsReview: false });
    if (!ok) return fail("Không tìm thấy tiêu chí.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE_SETTINGS",
      entityType: "Criterion",
      entityId: criterionId,
      details: { description },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/criteria");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function createCriterionAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = createCriterionSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const input = parsed.data;

    const record = await createCriterion(input);

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "CREATE_CRITERION",
      entityType: "Criterion",
      entityId: record.criterionId,
      details: input,
    });

    revalidatePath("/admin/criteria");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

export async function updateCriterionFullAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = updateCriterionFullSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const { criterionId, ...updates } = parsed.data;

    const ok = await updateCriterion(criterionId, updates);
    if (!ok) return fail("Không tìm thấy tiêu chí.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "UPDATE_CRITERION",
      entityType: "Criterion",
      entityId: criterionId,
      details: updates,
    });

    revalidatePath("/admin/criteria");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

/** "Xoá" tiêu chí = archive (active=false) — không xoá lịch sử. */
export async function archiveCriterionAction(criterionId: string): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const ok = await archiveCriterion(criterionId);
    if (!ok) return fail("Không tìm thấy tiêu chí.");

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "ARCHIVE_CRITERION",
      entityType: "Criterion",
      entityId: criterionId,
    });

    revalidatePath("/admin/criteria");
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}

// ---------- Ranking Decisions (quyết định thủ công khi đồng hạng) ----------

export async function saveManualRankingDecisionAction(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    const parsed = manualRankingDecisionSchema.safeParse(raw);
    if (!parsed.success) return fail("Dữ liệu không hợp lệ.");
    const input = parsed.data;

    const classes = await getClasses();
    const klass = classes.find((c) => c.classId === input.classId);
    if (!klass) return fail("Lớp không tồn tại.");

    await upsertRankingDecision({
      yearMonth: input.yearMonth,
      grade: input.grade,
      classId: input.classId,
      className: klass.className,
      manualRankingDecision: input.manualRankingDecision,
      decisionReason: input.decisionReason,
      decidedByEmail: user.email,
      decidedByName: user.name,
    });

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "SAVE_RANKING_DECISION",
      entityType: "RankingDecision",
      entityId: `${input.yearMonth}:${input.classId}`,
      details: {
        rank: input.manualRankingDecision,
        reason: input.decisionReason,
      },
    });

    revalidatePath("/admin/ranking");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}
