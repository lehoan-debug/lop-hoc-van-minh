/**
 * V2: một tài khoản có thể có NHIỀU vai trò cùng lúc (vd. vừa JUDGE vừa
 * HOMEROOM_TEACHER). `Role` giữ lại làm alias cho code cũ + làm kiểu của
 * field `AppUser.role` (dẫn xuất — role cao nhất trong `roles`, xem
 * `src/lib/auth/permissions.ts#primaryRole`). Không dùng `role` đơn để phân
 * quyền chi tiết nữa — dùng `roles`/`hasRole()`/`hasAnyRole()`.
 */
export type UserRole = "JUDGE" | "HOMEROOM_TEACHER" | "ADMIN" | "SUPER_ADMIN";
export type Role = UserRole;

export type Session_ = "MORNING" | "AFTERNOON";

export type Grade = "10" | "11" | "12";

export type AdjustmentType = "BONUS" | "PENALTY";

export type AuditAction =
  | "LOGIN"
  | "SUBMIT_SCORE"
  | "EDIT_SCORE"
  | "DELETE_SCORE"
  | "ADD_BONUS"
  | "ADD_PENALTY"
  | "EDIT_ADJUSTMENT"
  | "DELETE_ADJUSTMENT"
  | "UPDATE_SETTINGS"
  | "UPDATE_USER"
  | "SAVE_RANKING_DECISION"
  | "CREATE_SCORING_ROUND"
  | "UPDATE_SCORING_ROUND"
  | "SCHEDULE_SCORING_ROUND"
  | "LOCK_SCORING_ROUND"
  | "REOPEN_SCORING_ROUND"
  | "DELETE_SCORING_ROUND"
  | "ASSIGN_JUDGE_TO_ROUND"
  | "REMOVE_JUDGE_FROM_ROUND"
  | "ASSIGN_USER_TO_CLASS"
  | "REMOVE_USER_FROM_CLASS"
  | "BULK_ASSIGN_CLASSES"
  | "REPLACE_USER_ASSIGNMENTS"
  | "IMPORT_ASSIGNMENTS_EXCEL"
  | "IMPORT_USERS_EXCEL"
  | "RANDOM_ASSIGN_CLASSES"
  | "CREATE_CRITERION"
  | "UPDATE_CRITERION"
  | "ARCHIVE_CRITERION"
  | "ADD_USER_ROLE"
  | "REMOVE_USER_ROLE"
  | "ASSIGN_HOMEROOM_CLASS"
  | "EXPORT_EXCEL"
  | "OUT_OF_ASSIGNMENT_SCORE";

export interface AppUser {
  email: string;
  name: string;
  /** Nguồn sự thật cho phân quyền (V2). */
  roles: UserRole[];
  /** Dẫn xuất = role cao nhất trong `roles` — giữ cho code/UI cũ và làm
   * field hiển thị đơn giản trong Sheet. KHÔNG dùng field này để phân quyền
   * chi tiết (multi-role) — dùng `roles`. */
  role: Role;
  active: boolean;
  /** Legacy V1 — giữ để hiển thị/tương thích. Với luồng chấm theo Đợt chấm
   * (V2), phạm vi khối/lớp được chấm do `ScoringRoundAssignment` quyết định,
   * không còn dùng field này để chặn. */
  allowedGrades: Grade[] | "ALL";
  /** V2: danh sách lớp chủ nhiệm (role HOMEROOM_TEACHER). */
  homeroomClassIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClassConfig {
  classId: string;
  className: string;
  grade: Grade;
  active: boolean;
  sortOrder: number;
}

export type ScoringType = "PASS_FAIL";

export interface CriterionConfig {
  criterionId: string;
  criterionNumber: number;
  criterionName: string;
  description: string;
  active: boolean;
  sortOrder: number;
  /** true nếu nội dung tiêu chí này chưa hoàn chỉnh trong tài liệu gốc và
   * đang chờ BTC xác nhận/cập nhật (ví dụ tiêu chí 7 bị cắt cụt câu — xem
   * BUSINESS_RULES_REVIEW.md mục 2). Tự động về false khi Admin sửa mô tả. */
  needsReview: boolean;
  /** V2: điểm khi ĐẠT (hỗ trợ số thập phân). Tiêu chí V1 không có cột này
   * trong Sheet → mặc định 1 khi đọc, giữ đúng hành vi tính điểm cũ. */
  maxScore: number;
  /** V2: hiện chỉ hỗ trợ PASS_FAIL (Đạt/Không đạt). */
  scoringType: ScoringType;
  /** V2: rỗng = áp dụng mọi khối (giữ hành vi V1). */
  gradeIds: Grade[];
  createdAt: string;
  updatedAt: string;
}

export interface CriterionNote {
  criterionNumber: number;
  note: string;
}

/** V2: 1 dòng trong `criteriaSnapshotJson` — bản chụp tiêu chí TẠI THỜI ĐIỂM
 * chấm, không tính lại theo Criteria hiện tại khi Criteria thay đổi sau này. */
export interface CriterionSnapshotItem {
  criterionId: string;
  name: string;
  maxScore: number;
  result: "PASS" | "FAIL";
  awardedScore: number;
  note?: string;
}

export interface ScoreRecord {
  submissionId: string;
  timestamp: string;
  date: string;
  session: Session_;
  grade: Grade;
  classId: string;
  className: string;
  judgeEmail: string;
  judgeName: string;
  c1: 0 | 1;
  c2: 0 | 1;
  c3: 0 | 1;
  c4: 0 | 1;
  c5: 0 | 1;
  c6: 0 | 1;
  c7: 0 | 1;
  c8: 0 | 1;
  c9: 0 | 1;
  c10: 0 | 1;
  c11: 0 | 1;
  /** Legacy V1: tổng 11 tiêu chí cố định (0-11). Bản ghi V2 để trống ("" → 0). */
  totalCriteriaScore: number;
  notesJson: string;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
  /** V2 — rỗng ở bản ghi V1 (legacy). */
  roundId: string;
  /** V2 — JSON.stringify(CriterionSnapshotItem[]). */
  criteriaSnapshotJson: string;
  /** V2 — JSON.stringify({ [criterionId]: "PASS" | "FAIL" }). */
  answersJson: string;
  /** V2 — tổng điểm đạt được (số thập phân). null ở bản ghi V1 (dùng
   * totalCriteriaScore thay thế — xem getEffectiveScore()). */
  totalScore: number | null;
  /** V2 — tổng điểm tối đa có thể đạt (tổng maxScore các tiêu chí trong
   * snapshot). null ở bản ghi V1 (dùng CRITERIA_COUNT thay thế). */
  maxPossibleScore: number | null;
}

export interface AdjustmentRecord {
  adjustmentId: string;
  timestamp: string;
  date: string;
  classId: string;
  className: string;
  type: AdjustmentType;
  points: number;
  studentName: string;
  /** Mã học sinh (tuỳ chọn) — chỗ lưu trữ dự phòng để đối chiếu/liên kết với
   * dữ liệu học sinh chính thức (vd. hệ thống FSP) sau này. Không có tích hợp
   * tự động nào ở MVP — xem BUSINESS_RULES_REVIEW.md mục 6. */
  studentCode: string;
  description: string;
  location: string;
  evidence: string;
  recordedByEmail: string;
  recordedByName: string;
  deletedAt: string;
  createdAt: string;
}

export interface RankingDecisionRecord {
  decisionId: string;
  yearMonth: string;
  grade: Grade;
  classId: string;
  className: string;
  /** Hạng chính thức do BTC quyết định thủ công cho lớp này trong tháng. */
  manualRankingDecision: number;
  decisionReason: string;
  decidedByEmail: string;
  decidedByName: string;
  decidedAt: string;
}

export interface AuditLogRecord {
  logId: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  detailsJson: string;
}

/**
 * "UNCONFIRMED" = BTC chưa xác nhận cách kết hợp điểm Sáng + Chiều — hệ thống
 * KHÔNG tạo điểm ngày/điểm xếp hạng chính thức nào cho tới khi Admin đổi
 * sang SUM hoặc AVERAGE. Đây là giá trị mặc định khi khởi tạo hệ thống.
 * Xem BUSINESS_RULES_REVIEW.md mục 1.
 */
export type DailyScoreCombineModeSetting = "SUM" | "AVERAGE" | "UNCONFIRMED";

export interface AppSettings {
  DAILY_SCORE_COMBINE_MODE: DailyScoreCombineModeSetting;
  MORNING_SESSION_START: string;
  MORNING_SESSION_END: string;
  AFTERNOON_SESSION_START: string;
  AFTERNOON_SESSION_END: string;
  ALLOW_OUTSIDE_HOURS_SCORING: boolean;
  CURRENT_SCHOOL_YEAR: string;
  ENABLED_GRADES: Grade[];
  /** Dự trù cho tiêu chí phụ "mức xếp loại cao hơn" (KH mục III.4.a) — CHƯA
   * có code nào đọc/dùng vì tài liệu không định nghĩa thang xếp loại chính
   * thức. Không tự tạo thang Tốt/Khá/Trung bình. Xem BUSINESS_RULES_REVIEW.md mục 5. */
  GRADING_SCALE_ENABLED: boolean;
}

/** Legacy V1: số tiêu chí cố định — CHỈ dùng cho phần hiển thị/tính điểm của
 * bản ghi Score V1 (không có roundId). Luồng V2 tính điểm tối đa động theo
 * tổng maxScore của tiêu chí trong round/snapshot — KHÔNG dùng hằng số này. */
export const CRITERIA_COUNT = 11;

export type CriterionKey =
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "c5"
  | "c6"
  | "c7"
  | "c8"
  | "c9"
  | "c10"
  | "c11";

export const CRITERION_KEYS: CriterionKey[] = [
  "c1",
  "c2",
  "c3",
  "c4",
  "c5",
  "c6",
  "c7",
  "c8",
  "c9",
  "c10",
  "c11",
];

// ---------- V2: Đợt chấm (ScoringRound) ----------

/** Trạng thái Admin ĐẶT (không phải trạng thái hiệu lực theo giờ — xem
 * `getEffectiveRoundStatus()` tại `src/lib/rounds/roundStatus.ts`). */
export type RoundStoredStatus = "DRAFT" | "OPEN" | "LOCKED" | "CANCELLED";

/** Trạng thái HIỆU LỰC tại một thời điểm — luôn tính lại, không đọc thẳng
 * từ Sheet cho các mốc SCHEDULED/OPEN/LOCKED theo giờ. */
export type EffectiveRoundStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "OPEN"
  | "LOCKED"
  | "CANCELLED";

export interface ScoringRound {
  roundId: string;
  title: string;
  description: string;
  session: Session_;
  /** ISO 8601 instant. */
  startsAt: string;
  /** ISO 8601 instant. */
  endsAt: string;
  status: RoundStoredStatus;
  /** Rỗng = áp dụng mọi khối đang bật (ENABLED_GRADES). */
  gradeIds: Grade[];
  /** Rỗng = áp dụng mọi lớp active thuộc gradeIds. */
  classIds: string[];
  /** Rỗng = áp dụng mọi tiêu chí active phù hợp khối (criterionAppliesToGrade).
   * Cho phép 1 Đợt chấm chỉ chấm 1 phần tiêu chí (vd. 8/11) — xem
   * isCriterionInRoundScope. Không đổi cách tính maxScore của từng tiêu chí,
   * chỉ giới hạn TẬP tiêu chí hiển thị/áp dụng cho Đợt chấm này. */
  criterionIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  manuallyLockedAt: string;
  manuallyLockedBy: string;
}

export interface ScoringRoundAssignment {
  assignmentId: string;
  roundId: string;
  userEmail: string;
  /** Rỗng = không giới hạn thêm ngoài `ScoringRound.gradeIds`. */
  allowedGradeIds: Grade[];
  /** Rỗng = không giới hạn thêm ngoài `ScoringRound.classIds`. */
  allowedClassIds: string[];
  active: boolean;
  assignedBy: string;
  assignedAt: string;
}
