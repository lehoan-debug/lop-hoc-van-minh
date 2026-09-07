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

/** Lớp có nằm trong phạm vi ĐƯỢC PHÂN CÔNG RIÊNG cho người này không.
 *
 * QUAN TRỌNG (đã sửa lỗ hổng nghiệp vụ — xem docs/CLASS_ASSIGNMENT_UPGRADE.md):
 * `allowedClassIds`/`allowedGradeIds` đều rỗng -> KHÔNG được chấm lớp nào,
 * KHÔNG PHẢI "không thu hẹp = được chấm cả Round" như trước. "Có mặt trong
 * Round" (tồn tại 1 dòng ScoringRoundAssignment active) chỉ nghĩa là người
 * đó là ứng viên chấm của Round — phải được Admin tick RÕ RÀNG từng lớp/khối
 * qua UI phân công thì mới có quyền chấm, không có mặc định ngầm nào cả. */
export function isClassInAssignmentScope(
  assignment: Pick<ScoringRoundAssignment, "allowedClassIds" | "allowedGradeIds">,
  classId: string,
  grade: Grade,
): boolean {
  if (assignment.allowedClassIds.includes(classId)) return true;
  if (assignment.allowedGradeIds.includes(grade)) return true;
  return false;
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

/** Thông báo tiếng Việt cho từng mã lỗi — dùng chung ở mọi nơi hiển thị/trả
 * lỗi quyền chấm (Server Action submit, `canScoreClassInRound`) để tránh 2
 * nguồn câu chữ khác nhau cho cùng 1 lỗi. `className` được chèn vào thông
 * báo OUT_OF_ASSIGNMENT_SCOPE cho rõ ràng (đúng mục 9 yêu cầu: "Bạn không
 * được phân công chấm lớp 10A5 trong Đợt chấm này."). */
export function eligibilityMessage(code: RoundEligibilityCode, className: string): string {
  switch (code) {
    case "OK":
      return "";
    case "ROUND_DRAFT":
      return "Đợt chấm chưa được mở.";
    case "ROUND_SCHEDULED":
      return "Đợt chấm chưa bắt đầu.";
    case "ROUND_LOCKED":
      return "Đợt chấm đã kết thúc. Kết quả chưa được lưu. Vui lòng liên hệ Quản trị viên nếu cần xử lý.";
    case "ROUND_CANCELLED":
      return "Đợt chấm đã bị huỷ.";
    case "NOT_ASSIGNED":
      return "Bạn chưa được phân công vào đợt chấm này.";
    case "OUT_OF_ROUND_SCOPE":
      return `Lớp ${className} không thuộc phạm vi của đợt chấm.`;
    case "OUT_OF_ASSIGNMENT_SCOPE":
      return `Bạn không được phân công chấm lớp ${className} trong Đợt chấm này.`;
  }
}
