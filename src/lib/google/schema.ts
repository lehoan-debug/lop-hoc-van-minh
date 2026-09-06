/**
 * Định nghĩa tên sheet & thứ tự cột — dùng chung bởi lib/google/sheets.ts
 * (đọc/ghi runtime) và scripts/init-google-sheet.ts (khởi tạo header/seed).
 * Đây KHÔNG chứa secret, an toàn import ở cả server lẫn script Node thường.
 */

export const SHEET_NAMES = {
  USERS: "Users",
  CLASSES: "Classes",
  CRITERIA: "Criteria",
  SCORES: "Scores",
  ADJUSTMENTS: "Adjustments",
  SETTINGS: "Settings",
  AUDIT_LOG: "AuditLog",
  RANKING_DECISIONS: "RankingDecisions",
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

export const HEADERS: Record<SheetName, readonly string[]> = {
  [SHEET_NAMES.USERS]: [
    "email",
    "name",
    "role",
    "active",
    "allowedGrades",
    "createdAt",
    "updatedAt",
  ],
  [SHEET_NAMES.CLASSES]: ["classId", "className", "grade", "active", "sortOrder"],
  [SHEET_NAMES.CRITERIA]: [
    "criterionId",
    "criterionNumber",
    "criterionName",
    "description",
    "active",
    "sortOrder",
    "needsReview",
  ],
  [SHEET_NAMES.SCORES]: [
    "submissionId",
    "timestamp",
    "date",
    "session",
    "grade",
    "classId",
    "className",
    "judgeEmail",
    "judgeName",
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
    "totalCriteriaScore",
    "notesJson",
    "deletedAt",
    "createdAt",
    "updatedAt",
  ],
  [SHEET_NAMES.ADJUSTMENTS]: [
    "adjustmentId",
    "timestamp",
    "date",
    "classId",
    "className",
    "type",
    "points",
    "studentName",
    "studentCode",
    "description",
    "location",
    "evidence",
    "recordedByEmail",
    "recordedByName",
    "deletedAt",
    "createdAt",
  ],
  [SHEET_NAMES.SETTINGS]: ["key", "value", "updatedAt"],
  [SHEET_NAMES.AUDIT_LOG]: [
    "logId",
    "timestamp",
    "userEmail",
    "userName",
    "action",
    "entityType",
    "entityId",
    "detailsJson",
  ],
  [SHEET_NAMES.RANKING_DECISIONS]: [
    "decisionId",
    "yearMonth",
    "grade",
    "classId",
    "className",
    "manualRankingDecision",
    "decisionReason",
    "decidedByEmail",
    "decidedByName",
    "decidedAt",
  ],
};

/**
 * Giá trị mặc định cho sheet Settings — dùng khi khởi tạo và khi sheet
 * thiếu key (fallback an toàn thay vì crash).
 *
 * `DAILY_SCORE_COMBINE_MODE = "UNCONFIRMED"`: KH không nêu rõ cách kết hợp
 * điểm buổi Sáng + Chiều thành điểm ngày (cộng tổng hay trung bình) — KHÔNG
 * tự chọn SUM làm mặc định để tránh áp một công thức chưa được BTC xác nhận
 * lên kết quả xếp hạng thật. Xem BUSINESS_RULES_REVIEW.md mục 1.
 *
 * `GRADING_SCALE_ENABLED = "FALSE"`: dự trù cho tiêu chí phụ "mức xếp loại
 * cao hơn" (KH mục III.4.a) — chưa có thang xếp loại chính thức nên chưa có
 * code nào đọc/dùng cờ này. Xem BUSINESS_RULES_REVIEW.md mục 5.
 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  DAILY_SCORE_COMBINE_MODE: "UNCONFIRMED",
  MORNING_SESSION_START: "07:00",
  MORNING_SESSION_END: "07:45",
  AFTERNOON_SESSION_START: "12:30",
  AFTERNOON_SESSION_END: "17:15",
  ALLOW_OUTSIDE_HOURS_SCORING: "TRUE",
  CURRENT_SCHOOL_YEAR: "2026-2027",
  ENABLED_GRADES: "10,11,12",
  GRADING_SCALE_ENABLED: "FALSE",
};
