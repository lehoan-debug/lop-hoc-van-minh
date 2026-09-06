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
};

/** Giá trị mặc định cho sheet Settings — dùng khi khởi tạo và khi sheet
 * thiếu key (fallback an toàn thay vì crash). Xem BUSINESS_RULES_REVIEW.md. */
export const DEFAULT_SETTINGS: Record<string, string> = {
  DAILY_SCORE_COMBINE_MODE: "SUM",
  MORNING_SESSION_START: "07:00",
  MORNING_SESSION_END: "07:45",
  AFTERNOON_SESSION_START: "12:30",
  AFTERNOON_SESSION_END: "17:15",
  ALLOW_OUTSIDE_HOURS_SCORING: "TRUE",
  CURRENT_SCHOOL_YEAR: "2026-2027",
  ENABLED_GRADES: "10,11,12",
};
