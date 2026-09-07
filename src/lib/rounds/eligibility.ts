import type { Grade, ScoringRound, ScoringRoundAssignment } from "@/types";
import { getEffectiveRoundStatus } from "./roundStatus";

/** Lớp có nằm trong phạm vi khối/lớp của Đợt chấm không.
 * `classIds` rỗng -> xét theo `gradeIds` (rỗng -> mọi khối). */
export function isClassInRoundScope(
  round: Pick<ScoringRound, "classIds" | "gradeIds">,
  classId: string,
  grade: Grade,
): boolean {
  if (round.classIds.length > 0) return round.classIds.includes(classId);
  if (round.gradeIds.length > 0) return round.gradeIds.includes(grade);
  return true;
}

/** Lớp có nằm trong phạm vi ĐƯỢC PHÂN CÔNG cho riêng người này không (thu
 * hẹp thêm so với phạm vi chung của Round, nếu Admin có chỉ định).
 * `allowedClassIds`/`allowedGradeIds` đều rỗng -> không thu hẹp thêm (dùng
 * đúng phạm vi của Round). */
export function isClassInAssignmentScope(
  assignment: Pick<ScoringRoundAssignment, "allowedClassIds" | "allowedGradeIds">,
  classId: string,
  grade: Grade,
): boolean {
  if (assignment.allowedClassIds.length > 0) {
    return assignment.allowedClassIds.includes(classId);
  }
  if (assignment.allowedGradeIds.length > 0) {
    return assignment.allowedGradeIds.includes(grade);
  }
  return true;
}

export type RoundEligibilityCode =
  | "OK"
  | "ROUND_DRAFT"
  | "ROUND_SCHEDULED"
  | "ROUND_LOCKED"
  | "ROUND_CANCELLED"
  | "NOT_ASSIGNED"
  | "OUT_OF_ROUND_SCOPE"
  | "OUT_OF_ASSIGNMENT_SCOPE";

export interface RoundEligibilityResult {
  ok: boolean;
  code: RoundEligibilityCode;
}

/**
 * Kiểm tra ĐẦY ĐỦ điều kiện để 1 user được phép SUBMIT kết quả cho 1 lớp
 * trong 1 Đợt chấm — hàm thuần, dùng chung cho Server Action thật lẫn test.
 * Đây KHÔNG bao gồm việc kiểm tra `account active`/`canAccessScoring(role)`
 * (đã kiểm tra trước đó ở tầng auth) hay duplicate (kiểm tra riêng, cần đọc
 * Sheet). Xem thứ tự đầy đủ 7 bước tại docs/V2_UPGRADE_ANALYSIS.md /
 * yêu cầu V2 mục H.
 */
export function checkRoundEligibility(params: {
  round: ScoringRound;
  assignment: ScoringRoundAssignment | null;
  classId: string;
  grade: Grade;
  now?: Date;
}): RoundEligibilityResult {
  const { round, assignment, classId, grade, now = new Date() } = params;
  const status = getEffectiveRoundStatus(round, now);

  if (status === "DRAFT") return { ok: false, code: "ROUND_DRAFT" };
  if (status === "SCHEDULED") return { ok: false, code: "ROUND_SCHEDULED" };
  if (status === "LOCKED") return { ok: false, code: "ROUND_LOCKED" };
  if (status === "CANCELLED") return { ok: false, code: "ROUND_CANCELLED" };

  if (!assignment) return { ok: false, code: "NOT_ASSIGNED" };
  if (!isClassInRoundScope(round, classId, grade)) {
    return { ok: false, code: "OUT_OF_ROUND_SCOPE" };
  }
  if (!isClassInAssignmentScope(assignment, classId, grade)) {
    return { ok: false, code: "OUT_OF_ASSIGNMENT_SCOPE" };
  }
  return { ok: true, code: "OK" };
}
