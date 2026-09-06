"use server";

import { revalidatePath } from "next/cache";
import { requireRole, UnauthorizedError, ForbiddenError } from "@/lib/auth/session";
import {
  createAdjustmentSchema,
  editAdjustmentSchema,
  editScoreSchema,
  updateUserSchema,
  updateSettingSchema,
} from "@/lib/validation/schemas";
import {
  createAdjustment,
  editAdjustment,
  softDeleteAdjustment,
  editScore,
  softDeleteScore,
  getScore,
  getClasses,
  updateUser,
  updateSetting,
  updateClassActive,
  updateCriterion,
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

    if (input.role === "SUPER_ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      return fail("Chỉ Quản trị viên cấp cao mới có thể cấp quyền này.");
    }

    await updateUser(input);

    await appendAuditLog({
      userEmail: currentUser.email,
      userName: currentUser.name,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: input.email,
      details: { role: input.role, active: input.active },
    });

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
    const ok = await updateCriterion(criterionId, { description });
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
    revalidatePath("/judge");
    return { ok: true, data: undefined };
  } catch (e) {
    return handleKnownError(e);
  }
}
