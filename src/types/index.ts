export type Role = "JUDGE" | "ADMIN" | "SUPER_ADMIN";

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
  | "SAVE_RANKING_DECISION";

export interface AppUser {
  email: string;
  name: string;
  role: Role;
  active: boolean;
  allowedGrades: Grade[] | "ALL";
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
}

export interface CriterionNote {
  criterionNumber: number;
  note: string;
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
  totalCriteriaScore: number;
  notesJson: string;
  deletedAt: string;
  createdAt: string;
  updatedAt: string;
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
