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
  | "UPDATE_USER";

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
  description: string;
  location: string;
  evidence: string;
  recordedByEmail: string;
  recordedByName: string;
  deletedAt: string;
  createdAt: string;
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

export interface AppSettings {
  DAILY_SCORE_COMBINE_MODE: "SUM" | "AVERAGE";
  MORNING_SESSION_START: string;
  MORNING_SESSION_END: string;
  AFTERNOON_SESSION_START: string;
  AFTERNOON_SESSION_END: string;
  ALLOW_OUTSIDE_HOURS_SCORING: boolean;
  CURRENT_SCHOOL_YEAR: string;
  ENABLED_GRADES: Grade[];
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
