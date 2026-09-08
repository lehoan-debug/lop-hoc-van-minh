import "server-only";
import { randomUUID } from "crypto";
import {
  getAllRows,
  appendRow,
  appendRows,
  updateRowWhere,
  batchUpdateRows,
  type SheetRow,
} from "./sheetRepo";
import { SHEET_NAMES, DEFAULT_SETTINGS } from "./schema";
import { nowIso } from "@/lib/timezone/timezone";
import { primaryRole } from "@/lib/auth/permissions";
import { isClassInAssignmentScope, checkRoundEligibility, eligibilityMessage } from "@/lib/rounds/eligibility";
import type {
  AppUser,
  AppSettings,
  ClassConfig,
  CriterionConfig,
  CriterionNote,
  ScoreRecord,
  AdjustmentRecord,
  AuditLogRecord,
  AuditAction,
  Grade,
  Session_,
  AdjustmentType,
  RankingDecisionRecord,
  DailyScoreCombineModeSetting,
  UserRole,
  ScoringType,
  CriterionSnapshotItem,
  ScoringRound,
  ScoringRoundAssignment,
  RoundStoredStatus,
} from "@/types";
import { CRITERION_KEYS } from "@/types";

// ---------- helpers ----------

function parseBool(v: string | undefined): boolean {
  return (v ?? "").trim().toUpperCase() === "TRUE";
}

function parseAllowedGrades(v: string | undefined): Grade[] | "ALL" {
  const s = (v ?? "").trim();
  if (s.toUpperCase() === "ALL" || s === "") return "ALL";
  return s
    .split(",")
    .map((g) => g.trim())
    .filter((g): g is Grade => g === "10" || g === "11" || g === "12");
}

function serializeAllowedGrades(g: Grade[] | "ALL"): string {
  return g === "ALL" ? "ALL" : g.join(",");
}

function parseBinary(v: string | undefined): 0 | 1 {
  return v === "1" ? 1 : 0;
}

const ALL_USER_ROLES: UserRole[] = [
  "JUDGE",
  "HOMEROOM_TEACHER",
  "ADMIN",
  "SUPER_ADMIN",
];

function isUserRole(v: unknown): v is UserRole {
  return typeof v === "string" && (ALL_USER_ROLES as string[]).includes(v);
}

function parseJsonArray<T>(v: string | undefined, guard: (x: unknown) => x is T): T[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

// ---------- Users ----------

function rowToUser(row: SheetRow): AppUser {
  const legacyRole = (row.role as UserRole) || "JUDGE";
  const rolesFromJson = parseJsonArray(row.rolesJson, isUserRole);
  // Chưa có rolesJson (dữ liệu V1 cũ) -> fallback role đơn, đúng mục A của
  // yêu cầu V2 (role=ADMIN -> roles=["ADMIN"]). Không tin cột role cũ nếu
  // rolesJson đã có dữ liệu (rolesJson là nguồn sự thật).
  const roles = rolesFromJson.length > 0 ? rolesFromJson : [legacyRole];
  return {
    email: row.email?.trim().toLowerCase() ?? "",
    name: row.name ?? "",
    roles,
    role: primaryRole(roles),
    active: parseBool(row.active),
    allowedGrades: parseAllowedGrades(row.allowedGrades),
    homeroomClassIds: parseJsonArray(row.homeroomClassIdsJson, isString),
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? "",
  };
}

export async function getUsers(): Promise<AppUser[]> {
  const rows = await getAllRows(SHEET_NAMES.USERS);
  return rows.map(rowToUser);
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const normalized = email.trim().toLowerCase();
  const users = await getUsers();
  return users.find((u) => u.email === normalized) ?? null;
}

export async function updateUser(input: {
  email: string;
  name: string;
  roles: UserRole[];
  active: boolean;
  allowedGrades: Grade[] | "ALL";
  homeroomClassIds: string[];
}): Promise<boolean> {
  const normalized = input.email.trim().toLowerCase();
  const roles = input.roles.length > 0 ? input.roles : ["JUDGE" as UserRole];
  const patch: SheetRow = {
    name: input.name,
    role: primaryRole(roles),
    rolesJson: JSON.stringify(roles),
    active: input.active ? "TRUE" : "FALSE",
    allowedGrades: serializeAllowedGrades(input.allowedGrades),
    homeroomClassIdsJson: JSON.stringify(input.homeroomClassIds),
    updatedAt: nowIso(),
  };
  const ok = await updateRowWhere(
    SHEET_NAMES.USERS,
    (row) => row.email?.trim().toLowerCase() === normalized,
    patch,
  );
  if (!ok) {
    await appendRow(SHEET_NAMES.USERS, {
      email: normalized,
      ...patch,
      createdAt: nowIso(),
    });
  }
  return true;
}

export interface BulkImportUserRow {
  email: string;
  name: string;
  roles: UserRole[];
  homeroomClassIds: string[];
}

export interface BulkImportUserOutcome {
  createdEmails: string[];
  updatedEmails: string[];
}

/** Nhập hàng loạt (từ file Excel) — vai trò/lớp chủ nhiệm được HỢP (union)
 * vào tài khoản đã có, KHÔNG thay thế (an toàn khi import nhiều lần). Tài
 * khoản đã tồn tại giữ nguyên `active`/`allowedGrades` hiện có (import không
 * được phép âm thầm khoá/mở lại tài khoản); tài khoản mới mặc định
 * active=true, allowedGrades="ALL". Ghi theo lô giống `bulkImportAssignments`
 * — 1 lần đọc + tối đa 1 lệnh batchUpdate + 1 lệnh append. */
export async function bulkUpsertUsers(rows: BulkImportUserRow[]): Promise<BulkImportUserOutcome> {
  const outcome: BulkImportUserOutcome = { createdEmails: [], updatedEmails: [] };
  if (rows.length === 0) return outcome;

  const existingUsers = await getUsers();
  const byEmail = new Map(existingUsers.map((u) => [u.email, u]));
  const now = nowIso();

  const specs: { matcher: (row: SheetRow) => boolean; updates: Partial<SheetRow> }[] = [];
  const newRows: SheetRow[] = [];

  for (const input of rows) {
    const email = input.email.trim().toLowerCase();
    const existing = byEmail.get(email);
    if (existing) {
      const nextRoles = Array.from(new Set([...existing.roles, ...input.roles]));
      const nextHomeroom = Array.from(new Set([...existing.homeroomClassIds, ...input.homeroomClassIds]));
      specs.push({
        matcher: (row) => row.email?.trim().toLowerCase() === email,
        updates: {
          name: input.name || existing.name,
          role: primaryRole(nextRoles),
          rolesJson: JSON.stringify(nextRoles),
          homeroomClassIdsJson: JSON.stringify(nextHomeroom),
          updatedAt: now,
        },
      });
      outcome.updatedEmails.push(email);
    } else {
      newRows.push({
        email,
        name: input.name,
        role: primaryRole(input.roles),
        rolesJson: JSON.stringify(input.roles),
        active: "TRUE",
        allowedGrades: "ALL",
        homeroomClassIdsJson: JSON.stringify(input.homeroomClassIds),
        createdAt: now,
        updatedAt: now,
      });
      outcome.createdEmails.push(email);
    }
  }

  if (specs.length > 0) {
    await batchUpdateRows(SHEET_NAMES.USERS, specs);
  }
  if (newRows.length > 0) {
    await appendRows(SHEET_NAMES.USERS, newRows);
  }
  return outcome;
}

// ---------- Classes ----------

function rowToClass(row: SheetRow): ClassConfig {
  return {
    classId: row.classId ?? "",
    className: row.className ?? "",
    grade: (row.grade as Grade) ?? "10",
    active: parseBool(row.active),
    sortOrder: Number(row.sortOrder) || 0,
  };
}

export async function getClasses(opts?: { activeOnly?: boolean }): Promise<
  ClassConfig[]
> {
  const rows = await getAllRows(SHEET_NAMES.CLASSES);
  let classes = rows.map(rowToClass);
  if (opts?.activeOnly) classes = classes.filter((c) => c.active);
  return classes.sort((a, b) =>
    a.grade === b.grade ? a.sortOrder - b.sortOrder : a.grade.localeCompare(b.grade),
  );
}

export async function updateClassActive(
  classId: string,
  active: boolean,
): Promise<boolean> {
  return updateRowWhere(
    SHEET_NAMES.CLASSES,
    (row) => row.classId === classId,
    { active: active ? "TRUE" : "FALSE" },
  );
}

// ---------- Criteria ----------

function isGrade(v: unknown): v is Grade {
  return v === "10" || v === "11" || v === "12";
}

function rowToCriterion(row: SheetRow): CriterionConfig {
  // maxScore/scoringType là cột V2 — dòng Criteria V1 cũ không có, fallback
  // đúng hành vi V1 (mỗi tiêu chí Đạt = 1 điểm, PASS_FAIL). Xem
  // docs/V2_UPGRADE_ANALYSIS.md mục 3.2.
  const maxScoreRaw = row.maxScore?.trim();
  const maxScore = maxScoreRaw ? Number(maxScoreRaw) : 1;
  return {
    criterionId: row.criterionId ?? "",
    criterionNumber: Number(row.criterionNumber) || 0,
    criterionName: row.criterionName ?? "",
    description: row.description ?? "",
    active: parseBool(row.active),
    sortOrder: Number(row.sortOrder) || 0,
    needsReview: parseBool(row.needsReview),
    maxScore: Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 1,
    scoringType: (row.scoringType as ScoringType) || "PASS_FAIL",
    gradeIds: parseJsonArray(row.gradeIdsJson, isGrade),
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? "",
  };
}

export async function getCriteria(opts?: { activeOnly?: boolean }): Promise<
  CriterionConfig[]
> {
  const rows = await getAllRows(SHEET_NAMES.CRITERIA);
  let criteria = rows.map(rowToCriterion);
  if (opts?.activeOnly) criteria = criteria.filter((c) => c.active);
  return criteria.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Tiêu chí áp dụng cho 1 khối: `gradeIds` rỗng = áp dụng mọi khối (đúng
 * hành vi V1). */
export function criterionAppliesToGrade(
  criterion: CriterionConfig,
  grade: Grade,
): boolean {
  return criterion.gradeIds.length === 0 || criterion.gradeIds.includes(grade);
}

export interface CreateCriterionInput {
  criterionName: string;
  description: string;
  maxScore: number;
  gradeIds: Grade[];
  sortOrder: number;
}

export async function createCriterion(
  input: CreateCriterionInput,
): Promise<CriterionConfig> {
  const now = nowIso();
  const criteria = await getAllRows(SHEET_NAMES.CRITERIA, { cache: false });
  // criterionId mới không trùng — dùng số thứ tự tiếp theo dựa trên số dòng
  // hiện có (đơn giản, đủ dùng cho quy mô 1 trường; không cần UUID để giữ ID
  // ngắn gọn, dễ đọc trong Sheet).
  const nextNumber = criteria.length + 1;
  const record: CriterionConfig = {
    criterionId: `C${nextNumber}-${randomUUID().slice(0, 8)}`,
    criterionNumber: nextNumber,
    criterionName: input.criterionName,
    description: input.description,
    active: true,
    sortOrder: input.sortOrder,
    needsReview: false,
    maxScore: input.maxScore,
    scoringType: "PASS_FAIL",
    gradeIds: input.gradeIds,
    createdAt: now,
    updatedAt: now,
  };
  await appendRow(SHEET_NAMES.CRITERIA, {
    criterionId: record.criterionId,
    criterionNumber: String(record.criterionNumber),
    criterionName: record.criterionName,
    description: record.description,
    active: "TRUE",
    sortOrder: String(record.sortOrder),
    needsReview: "FALSE",
    maxScore: String(record.maxScore),
    scoringType: record.scoringType,
    gradeIdsJson: JSON.stringify(record.gradeIds),
    createdAt: now,
    updatedAt: now,
  });
  return record;
}

export async function updateCriterion(
  criterionId: string,
  updates: {
    criterionName?: string;
    description?: string;
    active?: boolean;
    needsReview?: boolean;
    maxScore?: number;
    gradeIds?: Grade[];
    sortOrder?: number;
  },
): Promise<boolean> {
  const patch: SheetRow = { updatedAt: nowIso() };
  if (updates.criterionName !== undefined) patch.criterionName = updates.criterionName;
  if (updates.active !== undefined) patch.active = updates.active ? "TRUE" : "FALSE";
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.needsReview !== undefined)
    patch.needsReview = updates.needsReview ? "TRUE" : "FALSE";
  if (updates.maxScore !== undefined) patch.maxScore = String(updates.maxScore);
  if (updates.gradeIds !== undefined) patch.gradeIdsJson = JSON.stringify(updates.gradeIds);
  if (updates.sortOrder !== undefined) patch.sortOrder = String(updates.sortOrder);
  return updateRowWhere(SHEET_NAMES.CRITERIA, (row) => row.criterionId === criterionId, patch);
}

/** "Xoá" tiêu chí = archive (active=false) — KHÔNG xoá dòng thật, giữ lịch
 * sử chấm điểm đã dùng tiêu chí này nguyên vẹn (snapshot đã lưu độc lập). */
export async function archiveCriterion(criterionId: string): Promise<boolean> {
  return updateCriterion(criterionId, { active: false });
}

// ---------- Settings ----------

function parseCombineMode(v: string): DailyScoreCombineModeSetting {
  if (v === "SUM" || v === "AVERAGE") return v;
  // Bất kỳ giá trị nào khác (kể cả trống/không hợp lệ) đều coi là chưa xác
  // nhận — KHÔNG mặc định về SUM để tránh áp công thức chưa được BTC duyệt.
  // Xem BUSINESS_RULES_REVIEW.md mục 1.
  return "UNCONFIRMED";
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await getAllRows(SHEET_NAMES.SETTINGS);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const get = (key: string) => map.get(key) ?? DEFAULT_SETTINGS[key] ?? "";

  return {
    DAILY_SCORE_COMBINE_MODE: parseCombineMode(get("DAILY_SCORE_COMBINE_MODE")),
    MORNING_SESSION_START: get("MORNING_SESSION_START"),
    MORNING_SESSION_END: get("MORNING_SESSION_END"),
    AFTERNOON_SESSION_START: get("AFTERNOON_SESSION_START"),
    AFTERNOON_SESSION_END: get("AFTERNOON_SESSION_END"),
    ALLOW_OUTSIDE_HOURS_SCORING: parseBool(get("ALLOW_OUTSIDE_HOURS_SCORING")),
    CURRENT_SCHOOL_YEAR: get("CURRENT_SCHOOL_YEAR"),
    ENABLED_GRADES: get("ENABLED_GRADES")
      .split(",")
      .map((g) => g.trim())
      .filter((g): g is Grade => g === "10" || g === "11" || g === "12"),
    GRADING_SCALE_ENABLED: parseBool(get("GRADING_SCALE_ENABLED")),
  };
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const ok = await updateRowWhere(SHEET_NAMES.SETTINGS, (row) => row.key === key, {
    value,
    updatedAt: nowIso(),
  });
  if (!ok) {
    await appendRow(SHEET_NAMES.SETTINGS, { key, value, updatedAt: nowIso() });
  }
}

// ---------- Scores ----------

function rowToScore(row: SheetRow): ScoreRecord {
  return {
    submissionId: row.submissionId ?? "",
    timestamp: row.timestamp ?? "",
    date: row.date ?? "",
    session: (row.session as Session_) ?? "MORNING",
    grade: (row.grade as Grade) ?? "10",
    classId: row.classId ?? "",
    className: row.className ?? "",
    judgeEmail: row.judgeEmail ?? "",
    judgeName: row.judgeName ?? "",
    c1: parseBinary(row.c1),
    c2: parseBinary(row.c2),
    c3: parseBinary(row.c3),
    c4: parseBinary(row.c4),
    c5: parseBinary(row.c5),
    c6: parseBinary(row.c6),
    c7: parseBinary(row.c7),
    c8: parseBinary(row.c8),
    c9: parseBinary(row.c9),
    c10: parseBinary(row.c10),
    c11: parseBinary(row.c11),
    totalCriteriaScore: Number(row.totalCriteriaScore) || 0,
    notesJson: row.notesJson ?? "[]",
    deletedAt: row.deletedAt ?? "",
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? "",
    // V2 — rỗng/null ở bản ghi V1 legacy. Xem docs/V2_UPGRADE_ANALYSIS.md mục 3.3.
    roundId: row.roundId ?? "",
    criteriaSnapshotJson: row.criteriaSnapshotJson ?? "[]",
    answersJson: row.answersJson ?? "{}",
    totalScore: row.totalScore ? Number(row.totalScore) : null,
    maxPossibleScore: row.maxPossibleScore ? Number(row.maxPossibleScore) : null,
  };
}

export interface ScoreFilter {
  dateFrom?: string;
  dateTo?: string;
  session?: Session_;
  grade?: Grade;
  classId?: string;
  judgeEmail?: string;
  roundId?: string;
  includeDeleted?: boolean;
}

export async function getScores(filter: ScoreFilter = {}): Promise<
  ScoreRecord[]
> {
  const rows = await getAllRows(SHEET_NAMES.SCORES, { cache: false });
  let scores = rows.map(rowToScore);
  if (!filter.includeDeleted) scores = scores.filter((s) => !s.deletedAt);
  if (filter.dateFrom) scores = scores.filter((s) => s.date >= filter.dateFrom!);
  if (filter.dateTo) scores = scores.filter((s) => s.date <= filter.dateTo!);
  if (filter.session) scores = scores.filter((s) => s.session === filter.session);
  if (filter.grade) scores = scores.filter((s) => s.grade === filter.grade);
  if (filter.classId) scores = scores.filter((s) => s.classId === filter.classId);
  if (filter.judgeEmail)
    scores = scores.filter((s) => s.judgeEmail === filter.judgeEmail);
  if (filter.roundId) scores = scores.filter((s) => s.roundId === filter.roundId);
  return scores;
}

export async function getScore(submissionId: string): Promise<ScoreRecord | null> {
  const scores = await getScores({ includeDeleted: true });
  return scores.find((s) => s.submissionId === submissionId) ?? null;
}

/** Legacy V1 — khoá trùng theo (date, session, classId, judgeEmail). Giữ
 * nguyên, không đổi hành vi. Luồng V2 (theo Đợt chấm) dùng
 * `checkDuplicateRoundScore()` bên dưới. */
export async function checkDuplicateScore(params: {
  date: string;
  session: Session_;
  classId: string;
  judgeEmail: string;
}): Promise<ScoreRecord | null> {
  const scores = await getScores({
    dateFrom: params.date,
    dateTo: params.date,
    session: params.session,
    classId: params.classId,
  });
  const normalizedEmail = params.judgeEmail.trim().toLowerCase();
  return (
    scores.find((s) => s.judgeEmail.trim().toLowerCase() === normalizedEmail) ??
    null
  );
}

/**
 * V2 — khoá trùng theo `(roundId, classId)`: mặc định MỖI LỚP CHỈ CÓ MỘT KẾT
 * QUẢ CHÍNH THỨC trong một Đợt chấm, bất kể ai chấm (xem
 * BUSINESS_RULES_REVIEW.md / docs/V2_UPGRADE_ANALYSIS.md mục 2 bảng thay
 * đổi). Nếu lớp đã có kết quả, trả về bản ghi đó để hiển thị "đã chấm lúc...
 * bởi...", không cho phép người khác ghi đè ngầm — Admin muốn sửa phải qua
 * `editScore()` (có AuditLog).
 */
export async function checkDuplicateRoundScore(params: {
  roundId: string;
  classId: string;
}): Promise<ScoreRecord | null> {
  const scores = await getScores({ roundId: params.roundId, classId: params.classId });
  return scores[0] ?? null;
}

export interface CreateScoreInput {
  date: string;
  session: Session_;
  grade: Grade;
  classId: string;
  className: string;
  judgeEmail: string;
  judgeName: string;
  scores: Record<(typeof CRITERION_KEYS)[number], 0 | 1>;
  notes: CriterionNote[];
}

export async function createScore(input: CreateScoreInput): Promise<ScoreRecord> {
  const totalCriteriaScore = CRITERION_KEYS.reduce(
    (sum, key) => sum + input.scores[key],
    0,
  );
  const timestamp = nowIso();
  const record: ScoreRecord = {
    submissionId: randomUUID(),
    timestamp,
    date: input.date,
    session: input.session,
    grade: input.grade,
    classId: input.classId,
    className: input.className,
    judgeEmail: input.judgeEmail.trim().toLowerCase(),
    judgeName: input.judgeName,
    ...input.scores,
    totalCriteriaScore,
    notesJson: JSON.stringify(input.notes ?? []),
    deletedAt: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    roundId: "",
    criteriaSnapshotJson: "[]",
    answersJson: "{}",
    totalScore: null,
    maxPossibleScore: null,
  };

  const row: SheetRow = {
    submissionId: record.submissionId,
    timestamp: record.timestamp,
    date: record.date,
    session: record.session,
    grade: record.grade,
    classId: record.classId,
    className: record.className,
    judgeEmail: record.judgeEmail,
    judgeName: record.judgeName,
    c1: String(record.c1),
    c2: String(record.c2),
    c3: String(record.c3),
    c4: String(record.c4),
    c5: String(record.c5),
    c6: String(record.c6),
    c7: String(record.c7),
    c8: String(record.c8),
    c9: String(record.c9),
    c10: String(record.c10),
    c11: String(record.c11),
    totalCriteriaScore: String(record.totalCriteriaScore),
    notesJson: record.notesJson,
    deletedAt: "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  await appendRow(SHEET_NAMES.SCORES, row);
  return record;
}

// ---------- Scores V2 (theo Đợt chấm — ScoringRound) ----------

export interface CreateRoundScoreInput {
  roundId: string;
  date: string;
  session: Session_;
  grade: Grade;
  classId: string;
  className: string;
  judgeEmail: string;
  judgeName: string;
  /** Bản chụp tiêu chí TẠI THỜI ĐIỂM chấm — không tính lại theo Criteria
   * hiện tại khi Criteria đổi sau này. Xem docs/V2_UPGRADE_ANALYSIS.md mục 3.3. */
  criteriaSnapshot: CriterionSnapshotItem[];
}

/** Ghi kết quả chấm V2 (gắn với 1 Đợt chấm cụ thể). Không đụng tới
 * c1..c11/totalCriteriaScore (để trống) — mọi nơi đọc điểm phải dùng
 * `getEffectiveScore()` (src/lib/scoring/effectiveScore.ts) để tương thích
 * cả bản ghi V1 lẫn V2. */
export async function createRoundScore(
  input: CreateRoundScoreInput,
): Promise<ScoreRecord> {
  const totalScore = input.criteriaSnapshot.reduce(
    (sum, item) => sum + item.awardedScore,
    0,
  );
  const maxPossibleScore = input.criteriaSnapshot.reduce(
    (sum, item) => sum + item.maxScore,
    0,
  );
  const answers: Record<string, "PASS" | "FAIL"> = {};
  for (const item of input.criteriaSnapshot) answers[item.criterionId] = item.result;

  const timestamp = nowIso();
  const record: ScoreRecord = {
    submissionId: randomUUID(),
    timestamp,
    date: input.date,
    session: input.session,
    grade: input.grade,
    classId: input.classId,
    className: input.className,
    judgeEmail: input.judgeEmail.trim().toLowerCase(),
    judgeName: input.judgeName,
    c1: 0,
    c2: 0,
    c3: 0,
    c4: 0,
    c5: 0,
    c6: 0,
    c7: 0,
    c8: 0,
    c9: 0,
    c10: 0,
    c11: 0,
    totalCriteriaScore: 0,
    notesJson: "[]",
    deletedAt: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    roundId: input.roundId,
    criteriaSnapshotJson: JSON.stringify(input.criteriaSnapshot),
    answersJson: JSON.stringify(answers),
    totalScore,
    maxPossibleScore,
  };

  const row: SheetRow = {
    submissionId: record.submissionId,
    timestamp: record.timestamp,
    date: record.date,
    session: record.session,
    grade: record.grade,
    classId: record.classId,
    className: record.className,
    judgeEmail: record.judgeEmail,
    judgeName: record.judgeName,
    c1: "",
    c2: "",
    c3: "",
    c4: "",
    c5: "",
    c6: "",
    c7: "",
    c8: "",
    c9: "",
    c10: "",
    c11: "",
    totalCriteriaScore: "",
    notesJson: record.notesJson,
    deletedAt: "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    roundId: record.roundId,
    criteriaSnapshotJson: record.criteriaSnapshotJson,
    answersJson: record.answersJson,
    totalScore: String(totalScore),
    maxPossibleScore: String(maxPossibleScore),
  };

  await appendRow(SHEET_NAMES.SCORES, row);
  return record;
}

export async function editScore(
  submissionId: string,
  updates: Partial<CreateScoreInput>,
): Promise<boolean> {
  const patch: SheetRow = { updatedAt: nowIso() };
  if (updates.scores) {
    CRITERION_KEYS.forEach((key) => {
      patch[key] = String(updates.scores![key]);
    });
    patch.totalCriteriaScore = String(
      CRITERION_KEYS.reduce((sum, key) => sum + updates.scores![key], 0),
    );
  }
  if (updates.notes) patch.notesJson = JSON.stringify(updates.notes);
  if (updates.className) patch.className = updates.className;

  return updateRowWhere(
    SHEET_NAMES.SCORES,
    (row) => row.submissionId === submissionId,
    patch,
  );
}

export async function softDeleteScore(submissionId: string): Promise<boolean> {
  return updateRowWhere(
    SHEET_NAMES.SCORES,
    (row) => row.submissionId === submissionId,
    { deletedAt: nowIso(), updatedAt: nowIso() },
  );
}

/**
 * Sửa lượt chấm V2 (theo Đợt chấm) — CHỈ ADMIN/SUPER_ADMIN được gọi (kiểm
 * tra ở Server Action, không tin FE). Chỉ cho sửa kết quả ĐẠT/KHÔNG ĐẠT và
 * ghi chú của TỪNG tiêu chí đã có trong snapshot gốc — KHÔNG cho thêm/bớt
 * tiêu chí hay đổi tên/maxScore, để giữ đúng bản chất "snapshot bất biến tại
 * thời điểm chấm" (đúng yêu cầu V2: sửa Criteria hiện tại không được ảnh
 * hưởng lượt chấm lịch sử — ở đây là Admin sửa lỗi nhập liệu, không phải
 * tính lại theo Criteria mới). `nextSnapshot` phải cùng bộ criterionId với
 * bản ghi hiện có — hàm không tự thêm/bớt.
 */
export async function editRoundScore(
  submissionId: string,
  nextSnapshot: CriterionSnapshotItem[],
): Promise<boolean> {
  const totalScore = nextSnapshot.reduce((sum, item) => sum + item.awardedScore, 0);
  const maxPossibleScore = nextSnapshot.reduce((sum, item) => sum + item.maxScore, 0);
  const answers: Record<string, "PASS" | "FAIL"> = {};
  for (const item of nextSnapshot) answers[item.criterionId] = item.result;

  return updateRowWhere(SHEET_NAMES.SCORES, (row) => row.submissionId === submissionId, {
    criteriaSnapshotJson: JSON.stringify(nextSnapshot),
    answersJson: JSON.stringify(answers),
    totalScore: String(totalScore),
    maxPossibleScore: String(maxPossibleScore),
    updatedAt: nowIso(),
  });
}

// ---------- Adjustments ----------

function rowToAdjustment(row: SheetRow): AdjustmentRecord {
  return {
    adjustmentId: row.adjustmentId ?? "",
    timestamp: row.timestamp ?? "",
    date: row.date ?? "",
    classId: row.classId ?? "",
    className: row.className ?? "",
    type: (row.type as AdjustmentType) ?? "BONUS",
    points: Number(row.points) || 0,
    studentName: row.studentName ?? "",
    studentCode: row.studentCode ?? "",
    description: row.description ?? "",
    location: row.location ?? "",
    evidence: row.evidence ?? "",
    recordedByEmail: row.recordedByEmail ?? "",
    recordedByName: row.recordedByName ?? "",
    deletedAt: row.deletedAt ?? "",
    createdAt: row.createdAt ?? "",
  };
}

export interface AdjustmentFilter {
  dateFrom?: string;
  dateTo?: string;
  classId?: string;
  type?: AdjustmentType;
  includeDeleted?: boolean;
}

export async function getAdjustments(
  filter: AdjustmentFilter = {},
): Promise<AdjustmentRecord[]> {
  const rows = await getAllRows(SHEET_NAMES.ADJUSTMENTS, { cache: false });
  let items = rows.map(rowToAdjustment);
  if (!filter.includeDeleted) items = items.filter((a) => !a.deletedAt);
  if (filter.dateFrom) items = items.filter((a) => a.date >= filter.dateFrom!);
  if (filter.dateTo) items = items.filter((a) => a.date <= filter.dateTo!);
  if (filter.classId) items = items.filter((a) => a.classId === filter.classId);
  if (filter.type) items = items.filter((a) => a.type === filter.type);
  return items;
}

export interface CreateAdjustmentInput {
  date: string;
  classId: string;
  className: string;
  type: AdjustmentType;
  points: number;
  studentName?: string;
  studentCode?: string;
  description: string;
  location?: string;
  evidence?: string;
  recordedByEmail: string;
  recordedByName: string;
}

export async function createAdjustment(
  input: CreateAdjustmentInput,
): Promise<AdjustmentRecord> {
  const now = nowIso();
  const record: AdjustmentRecord = {
    adjustmentId: randomUUID(),
    timestamp: now,
    date: input.date,
    classId: input.classId,
    className: input.className,
    type: input.type,
    points: Math.abs(input.points),
    studentName: input.studentName ?? "",
    studentCode: input.studentCode ?? "",
    description: input.description,
    location: input.location ?? "",
    evidence: input.evidence ?? "",
    recordedByEmail: input.recordedByEmail.trim().toLowerCase(),
    recordedByName: input.recordedByName,
    deletedAt: "",
    createdAt: now,
  };
  await appendRow(SHEET_NAMES.ADJUSTMENTS, {
    ...record,
    points: String(record.points),
  });
  return record;
}

export async function editAdjustment(
  adjustmentId: string,
  updates: Partial<CreateAdjustmentInput>,
): Promise<boolean> {
  const patch: SheetRow = {};
  if (updates.type) patch.type = updates.type;
  if (updates.points !== undefined) patch.points = String(Math.abs(updates.points));
  if (updates.studentName !== undefined) patch.studentName = updates.studentName;
  if (updates.studentCode !== undefined) patch.studentCode = updates.studentCode;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.evidence !== undefined) patch.evidence = updates.evidence;
  return updateRowWhere(
    SHEET_NAMES.ADJUSTMENTS,
    (row) => row.adjustmentId === adjustmentId,
    patch,
  );
}

export async function softDeleteAdjustment(
  adjustmentId: string,
): Promise<boolean> {
  return updateRowWhere(
    SHEET_NAMES.ADJUSTMENTS,
    (row) => row.adjustmentId === adjustmentId,
    { deletedAt: nowIso() },
  );
}

// ---------- Audit Log ----------

export async function appendAuditLog(entry: {
  userEmail: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const record: AuditLogRecord = {
    logId: randomUUID(),
    timestamp: nowIso(),
    userEmail: entry.userEmail.trim().toLowerCase(),
    userName: entry.userName,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    detailsJson: JSON.stringify(entry.details ?? {}),
  };
  await appendRow(SHEET_NAMES.AUDIT_LOG, { ...record });
}

export async function getAuditLogs(filter?: {
  userEmail?: string;
  action?: AuditAction;
  limit?: number;
}): Promise<AuditLogRecord[]> {
  const rows = await getAllRows(SHEET_NAMES.AUDIT_LOG, { cache: false });
  let logs = rows.map((row) => ({
    logId: row.logId ?? "",
    timestamp: row.timestamp ?? "",
    userEmail: row.userEmail ?? "",
    userName: row.userName ?? "",
    action: (row.action as AuditAction) ?? "LOGIN",
    entityType: row.entityType ?? "",
    entityId: row.entityId ?? "",
    detailsJson: row.detailsJson ?? "{}",
  }));
  if (filter?.userEmail)
    logs = logs.filter((l) => l.userEmail === filter.userEmail);
  if (filter?.action) logs = logs.filter((l) => l.action === filter.action);
  logs = logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (filter?.limit) logs = logs.slice(0, filter.limit);
  return logs;
}

// ---------- Ranking Decisions (quyết định thủ công khi đồng hạng) ----------

function rowToRankingDecision(row: SheetRow): RankingDecisionRecord {
  return {
    decisionId: row.decisionId ?? "",
    yearMonth: row.yearMonth ?? "",
    grade: (row.grade as Grade) ?? "10",
    classId: row.classId ?? "",
    className: row.className ?? "",
    manualRankingDecision: Number(row.manualRankingDecision) || 0,
    decisionReason: row.decisionReason ?? "",
    decidedByEmail: row.decidedByEmail ?? "",
    decidedByName: row.decidedByName ?? "",
    decidedAt: row.decidedAt ?? "",
  };
}

export async function getRankingDecisions(filter: {
  yearMonth: string;
  grade?: Grade;
}): Promise<RankingDecisionRecord[]> {
  const rows = await getAllRows(SHEET_NAMES.RANKING_DECISIONS, { cache: false });
  let decisions = rows.map(rowToRankingDecision).filter((d) => d.yearMonth === filter.yearMonth);
  if (filter.grade) decisions = decisions.filter((d) => d.grade === filter.grade);
  return decisions;
}

export interface SaveRankingDecisionInput {
  yearMonth: string;
  grade: Grade;
  classId: string;
  className: string;
  manualRankingDecision: number;
  decisionReason: string;
  decidedByEmail: string;
  decidedByName: string;
}

/** Ghi hoặc cập nhật quyết định xếp hạng thủ công cho 1 lớp trong 1 tháng —
 * khoá logic (yearMonth, classId). Không tự động chọn lớp thắng khi đồng
 * hạng, chỉ lưu lại quyết định do Admin/SUPER_ADMIN nhập. */
export async function upsertRankingDecision(
  input: SaveRankingDecisionInput,
): Promise<RankingDecisionRecord> {
  const now = nowIso();
  const record: RankingDecisionRecord = {
    decisionId: randomUUID(),
    yearMonth: input.yearMonth,
    grade: input.grade,
    classId: input.classId,
    className: input.className,
    manualRankingDecision: input.manualRankingDecision,
    decisionReason: input.decisionReason,
    decidedByEmail: input.decidedByEmail.trim().toLowerCase(),
    decidedByName: input.decidedByName,
    decidedAt: now,
  };

  const row: SheetRow = {
    yearMonth: record.yearMonth,
    grade: record.grade,
    classId: record.classId,
    className: record.className,
    manualRankingDecision: String(record.manualRankingDecision),
    decisionReason: record.decisionReason,
    decidedByEmail: record.decidedByEmail,
    decidedByName: record.decidedByName,
    decidedAt: record.decidedAt,
  };

  const updated = await updateRowWhere(
    SHEET_NAMES.RANKING_DECISIONS,
    (r) => r.yearMonth === input.yearMonth && r.classId === input.classId,
    row,
  );

  if (updated) return record;

  await appendRow(SHEET_NAMES.RANKING_DECISIONS, {
    decisionId: record.decisionId,
    ...row,
  });
  return record;
}

// ---------- ScoringRounds (V2 — Đợt chấm) ----------

function rowToScoringRound(row: SheetRow): ScoringRound {
  return {
    roundId: row.roundId ?? "",
    title: row.title ?? "",
    description: row.description ?? "",
    session: (row.session as Session_) ?? "MORNING",
    startsAt: row.startsAt ?? "",
    endsAt: row.endsAt ?? "",
    status: (row.status as RoundStoredStatus) || "DRAFT",
    gradeIds: parseJsonArray(row.gradeIdsJson, isGrade),
    classIds: parseJsonArray(row.classIdsJson, isString),
    createdBy: row.createdBy ?? "",
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? "",
    manuallyLockedAt: row.manuallyLockedAt ?? "",
    manuallyLockedBy: row.manuallyLockedBy ?? "",
  };
}

export async function getScoringRounds(): Promise<ScoringRound[]> {
  const rows = await getAllRows(SHEET_NAMES.SCORING_ROUNDS, { cache: false });
  return rows
    .map(rowToScoringRound)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export async function getScoringRound(roundId: string): Promise<ScoringRound | null> {
  const rounds = await getScoringRounds();
  return rounds.find((r) => r.roundId === roundId) ?? null;
}

export interface CreateScoringRoundInput {
  title: string;
  description?: string;
  session: Session_;
  startsAt: string;
  endsAt: string;
  gradeIds: Grade[];
  classIds: string[];
  createdBy: string;
}

export async function createScoringRound(
  input: CreateScoringRoundInput,
): Promise<ScoringRound> {
  const now = nowIso();
  const record: ScoringRound = {
    roundId: randomUUID(),
    title: input.title,
    description: input.description ?? "",
    session: input.session,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: "OPEN",
    gradeIds: input.gradeIds,
    classIds: input.classIds,
    createdBy: input.createdBy.trim().toLowerCase(),
    createdAt: now,
    updatedAt: now,
    manuallyLockedAt: "",
    manuallyLockedBy: "",
  };
  await appendRow(SHEET_NAMES.SCORING_ROUNDS, {
    roundId: record.roundId,
    title: record.title,
    description: record.description,
    session: record.session,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    status: record.status,
    gradeIdsJson: JSON.stringify(record.gradeIds),
    classIdsJson: JSON.stringify(record.classIds),
    activeCriteriaSetId: "",
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    manuallyLockedAt: "",
    manuallyLockedBy: "",
  });
  return record;
}

export async function updateScoringRound(
  roundId: string,
  updates: {
    title?: string;
    description?: string;
    session?: Session_;
    startsAt?: string;
    endsAt?: string;
    gradeIds?: Grade[];
    classIds?: string[];
    status?: RoundStoredStatus;
  },
): Promise<boolean> {
  const patch: SheetRow = { updatedAt: nowIso() };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.session !== undefined) patch.session = updates.session;
  if (updates.startsAt !== undefined) patch.startsAt = updates.startsAt;
  if (updates.endsAt !== undefined) patch.endsAt = updates.endsAt;
  if (updates.gradeIds !== undefined) patch.gradeIdsJson = JSON.stringify(updates.gradeIds);
  if (updates.classIds !== undefined) patch.classIdsJson = JSON.stringify(updates.classIds);
  if (updates.status !== undefined) patch.status = updates.status;
  return updateRowWhere(SHEET_NAMES.SCORING_ROUNDS, (row) => row.roundId === roundId, patch);
}

/** Khoá đợt chấm ngay lập tức, bất kể `endsAt`. */
export async function lockScoringRound(
  roundId: string,
  lockedByEmail: string,
): Promise<boolean> {
  return updateRowWhere(SHEET_NAMES.SCORING_ROUNDS, (row) => row.roundId === roundId, {
    status: "LOCKED" satisfies RoundStoredStatus,
    manuallyLockedAt: nowIso(),
    manuallyLockedBy: lockedByEmail.trim().toLowerCase(),
    updatedAt: nowIso(),
  });
}

/** Mở lại đợt đã khoá thủ công. Không phục hồi được đợt đã khoá do hết giờ
 * (`endsAt`) trừ khi Admin cũng dời `endsAt` — tránh mở lại "ngầm" một đợt
 * đã kết thúc theo lịch mà không ai để ý. */
export async function reopenScoringRound(roundId: string): Promise<boolean> {
  return updateRowWhere(SHEET_NAMES.SCORING_ROUNDS, (row) => row.roundId === roundId, {
    status: "OPEN" satisfies RoundStoredStatus,
    manuallyLockedAt: "",
    manuallyLockedBy: "",
    updatedAt: nowIso(),
  });
}

export async function cancelScoringRound(roundId: string): Promise<boolean> {
  return updateRowWhere(SHEET_NAMES.SCORING_ROUNDS, (row) => row.roundId === roundId, {
    status: "CANCELLED" satisfies RoundStoredStatus,
    updatedAt: nowIso(),
  });
}

// ---------- ScoringRoundAssignments (V2) ----------

function rowToAssignment(row: SheetRow): ScoringRoundAssignment {
  return {
    assignmentId: row.assignmentId ?? "",
    roundId: row.roundId ?? "",
    userEmail: row.userEmail?.trim().toLowerCase() ?? "",
    allowedGradeIds: parseJsonArray(row.allowedGradeIdsJson, isGrade),
    allowedClassIds: parseJsonArray(row.allowedClassIdsJson, isString),
    active: parseBool(row.active),
    assignedBy: row.assignedBy ?? "",
    assignedAt: row.assignedAt ?? "",
  };
}

export async function getRoundAssignments(
  roundId: string,
): Promise<ScoringRoundAssignment[]> {
  const rows = await getAllRows(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, {
    cache: false,
  });
  return rows.map(rowToAssignment).filter((a) => a.roundId === roundId && a.active);
}

/** Tất cả đợt (còn hiệu lực phân công) mà 1 user được giao — dùng cho trang
 * chủ Giám khảo/Admin-chấm-điểm để liệt kê "Đợt chấm đang được phân công". */
export async function getRoundAssignmentsForUser(
  userEmail: string,
): Promise<ScoringRoundAssignment[]> {
  const normalized = userEmail.trim().toLowerCase();
  const rows = await getAllRows(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, {
    cache: false,
  });
  return rows
    .map(rowToAssignment)
    .filter((a) => a.userEmail === normalized && a.active);
}

export async function isUserAssignedToRound(
  roundId: string,
  userEmail: string,
): Promise<ScoringRoundAssignment | null> {
  const normalized = userEmail.trim().toLowerCase();
  const assignments = await getRoundAssignments(roundId);
  return assignments.find((a) => a.userEmail === normalized) ?? null;
}

export interface AssignJudgeInput {
  roundId: string;
  userEmail: string;
  allowedGradeIds?: Grade[];
  allowedClassIds?: string[];
  assignedBy: string;
}

export async function assignJudgeToRound(
  input: AssignJudgeInput,
): Promise<ScoringRoundAssignment> {
  const normalized = input.userEmail.trim().toLowerCase();
  const now = nowIso();

  // Idempotent: nếu đã có assignment (kể cả đã inactive) cho đúng cặp
  // (roundId, userEmail), kích hoạt lại thay vì tạo dòng trùng.
  const reactivated = await updateRowWhere(
    SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS,
    (row) =>
      row.roundId === input.roundId &&
      row.userEmail?.trim().toLowerCase() === normalized,
    {
      active: "TRUE",
      allowedGradeIdsJson: JSON.stringify(input.allowedGradeIds ?? []),
      allowedClassIdsJson: JSON.stringify(input.allowedClassIds ?? []),
      assignedBy: input.assignedBy.trim().toLowerCase(),
      assignedAt: now,
    },
  );

  if (reactivated) {
    const existing = await isUserAssignedToRound(input.roundId, normalized);
    if (existing) return existing;
  }

  const record: ScoringRoundAssignment = {
    assignmentId: randomUUID(),
    roundId: input.roundId,
    userEmail: normalized,
    allowedGradeIds: input.allowedGradeIds ?? [],
    allowedClassIds: input.allowedClassIds ?? [],
    active: true,
    assignedBy: input.assignedBy.trim().toLowerCase(),
    assignedAt: now,
  };
  await appendRow(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, {
    assignmentId: record.assignmentId,
    roundId: record.roundId,
    userEmail: record.userEmail,
    allowedGradeIdsJson: JSON.stringify(record.allowedGradeIds),
    allowedClassIdsJson: JSON.stringify(record.allowedClassIds),
    active: "TRUE",
    assignedBy: record.assignedBy,
    assignedAt: record.assignedAt,
  });
  return record;
}

export async function removeJudgeFromRound(
  roundId: string,
  userEmail: string,
): Promise<boolean> {
  const normalized = userEmail.trim().toLowerCase();
  return updateRowWhere(
    SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS,
    (row) =>
      row.roundId === roundId && row.userEmail?.trim().toLowerCase() === normalized,
    { active: "FALSE" },
  );
}

// ---------- Phân công theo LỚP (xem docs/CLASS_ASSIGNMENT_UPGRADE.md) ----------
//
// Vẫn lưu 1 dòng/(roundId,userEmail) với mảng allowedClassIds — KHÔNG đổi
// cột. Các hàm dưới đây là lớp thao tác mức "lớp" trên nền dữ liệu đó, để
// UI/Server Action không phải tự merge mảng JSON thủ công ở nhiều nơi.

/** Phạm vi lớp thô (chưa giao với phạm vi Round) mà 1 người được phân công
 * riêng trong 1 Round — dùng để hiển thị checkbox đã tick ở UI Admin. */
export async function getAssignedClassesForUser(
  roundId: string,
  userEmail: string,
): Promise<{ allowedClassIds: string[]; allowedGradeIds: Grade[] }> {
  const assignment = await isUserAssignedToRound(roundId, userEmail);
  if (!assignment) return { allowedClassIds: [], allowedGradeIds: [] };
  return {
    allowedClassIds: assignment.allowedClassIds,
    allowedGradeIds: assignment.allowedGradeIds,
  };
}

/** Toàn bộ email người được phân công đúng 1 lớp cụ thể trong 1 Round (có thể
 * nhiều người cùng phụ trách 1 lớp — mục 11 yêu cầu). */
export async function getAssignedUsersForClass(
  roundId: string,
  classId: string,
  grade: Grade,
): Promise<string[]> {
  const assignments = await getRoundAssignments(roundId);
  return assignments
    .filter((a) => isClassInAssignmentScope(a, classId, grade))
    .map((a) => a.userEmail);
}

async function upsertAssignmentRow(
  roundId: string,
  userEmail: string,
  nextAllowedClassIds: string[],
  assignedBy: string,
): Promise<void> {
  const normalized = userEmail.trim().toLowerCase();
  const now = nowIso();
  const updated = await updateRowWhere(
    SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS,
    (row) => row.roundId === roundId && row.userEmail?.trim().toLowerCase() === normalized,
    {
      active: "TRUE",
      allowedClassIdsJson: JSON.stringify(nextAllowedClassIds),
      assignedBy: assignedBy.trim().toLowerCase(),
      assignedAt: now,
    },
  );
  if (updated) return;

  await appendRow(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, {
    assignmentId: randomUUID(),
    roundId,
    userEmail: normalized,
    allowedGradeIdsJson: "[]",
    allowedClassIdsJson: JSON.stringify(nextAllowedClassIds),
    active: "TRUE",
    assignedBy: assignedBy.trim().toLowerCase(),
    assignedAt: now,
  });
}

/** Thêm 1 lớp vào phạm vi của 1 người (giữ nguyên các lớp đã có trước đó). */
export async function assignUserToClass(
  roundId: string,
  userEmail: string,
  classId: string,
  assignedBy: string,
): Promise<void> {
  const current = await getAssignedClassesForUser(roundId, userEmail);
  if (current.allowedClassIds.includes(classId)) return;
  await upsertAssignmentRow(roundId, userEmail, [...current.allowedClassIds, classId], assignedBy);
}

/** Bỏ 1 lớp khỏi phạm vi của 1 người — KHÔNG xoá dòng assignment, KHÔNG đụng
 * tới Score đã submit (mục 22: bỏ phân công không xoá kết quả đã chấm). */
export async function removeUserFromClass(
  roundId: string,
  userEmail: string,
  classId: string,
  assignedBy: string,
): Promise<void> {
  const current = await getAssignedClassesForUser(roundId, userEmail);
  if (!current.allowedClassIds.includes(classId)) return;
  await upsertAssignmentRow(
    roundId,
    userEmail,
    current.allowedClassIds.filter((id) => id !== classId),
    assignedBy,
  );
}

/** Hợp (union) thêm nhiều lớp vào phạm vi của 1 người trong 1 lần ghi. */
export async function bulkAssignUserToClasses(
  roundId: string,
  userEmail: string,
  classIds: string[],
  assignedBy: string,
): Promise<void> {
  const current = await getAssignedClassesForUser(roundId, userEmail);
  const next = Array.from(new Set([...current.allowedClassIds, ...classIds]));
  await upsertAssignmentRow(roundId, userEmail, next, assignedBy);
}

/** THAY THẾ toàn bộ phạm vi lớp của 1 người (tab "Theo người" — Lưu phân
 * công). Trả về {before, after} để ghi AuditLog đúng mục 20. */
export async function replaceAssignmentsForUser(
  roundId: string,
  userEmail: string,
  classIds: string[],
  assignedBy: string,
): Promise<{ before: string[]; after: string[] }> {
  const current = await getAssignedClassesForUser(roundId, userEmail);
  const before = current.allowedClassIds;
  const after = Array.from(new Set(classIds));
  await upsertAssignmentRow(roundId, userEmail, after, assignedBy);
  return { before, after };
}

/** Tab "Theo lớp": đặt lại toàn bộ tập người phụ trách 1 lớp cùng lúc — tính
 * diff rồi ghi hàng loạt bằng `batchUpdateRows` (1 lần đọc + tối đa 1 lệnh
 * batchUpdate cho các dòng đã tồn tại, cộng 1 lệnh append cho người chưa từng
 * có assignment trong Round) thay vì gọi API riêng cho từng người. */
export async function setClassAssignees(
  roundId: string,
  classId: string,
  grade: Grade,
  userEmails: string[],
  assignedBy: string,
): Promise<void> {
  const normalizedTargets = new Set(userEmails.map((e) => e.trim().toLowerCase()));
  const allAssignments = await getRoundAssignments(roundId);
  const byUser = new Map(allAssignments.map((a) => [a.userEmail, a]));
  const now = nowIso();
  const normalizedAssignedBy = assignedBy.trim().toLowerCase();

  const specs: { matcher: (row: SheetRow) => boolean; updates: Partial<SheetRow> }[] = [];
  const newRows: SheetRow[] = [];

  for (const email of normalizedTargets) {
    const existing = byUser.get(email);
    if (existing) {
      if (isClassInAssignmentScope(existing, classId, grade)) continue; // đã có quyền qua khối/lớp khác, không cần đổi
      const nextClassIds = Array.from(new Set([...existing.allowedClassIds, classId]));
      specs.push({
        matcher: (row) => row.assignmentId === existing.assignmentId,
        updates: {
          active: "TRUE",
          allowedClassIdsJson: JSON.stringify(nextClassIds),
          assignedBy: normalizedAssignedBy,
          assignedAt: now,
        },
      });
    } else {
      newRows.push({
        assignmentId: randomUUID(),
        roundId,
        userEmail: email,
        allowedGradeIdsJson: "[]",
        allowedClassIdsJson: JSON.stringify([classId]),
        active: "TRUE",
        assignedBy: normalizedAssignedBy,
        assignedAt: now,
      });
    }
  }

  // Những người đang có lớp này nhưng KHÔNG còn trong danh sách mới -> gỡ.
  for (const a of allAssignments) {
    if (normalizedTargets.has(a.userEmail)) continue;
    if (!a.allowedClassIds.includes(classId)) continue; // chỉ gỡ khi quyền đến từ allowedClassIds trực tiếp (không gỡ quyền theo cả khối qua thao tác 1 lớp)
    const nextClassIds = a.allowedClassIds.filter((id) => id !== classId);
    specs.push({
      matcher: (row) => row.assignmentId === a.assignmentId,
      updates: { allowedClassIdsJson: JSON.stringify(nextClassIds), assignedAt: now },
    });
  }

  if (specs.length > 0) {
    await batchUpdateRows(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, specs);
  }
  if (newRows.length > 0) {
    await appendRows(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, newRows);
  }
}

export type CanScoreCode =
  | "OK"
  | "ROUND_NOT_FOUND"
  | "CLASS_NOT_FOUND"
  | "ROUND_DRAFT"
  | "ROUND_SCHEDULED"
  | "ROUND_LOCKED"
  | "ROUND_CANCELLED"
  | "NOT_ASSIGNED"
  | "OUT_OF_ROUND_SCOPE"
  | "OUT_OF_ASSIGNMENT_SCOPE";

/** Nhập hàng loạt (từ file Excel) — HỢP (union) thêm lớp vào phạm vi từng
 * người, KHÔNG thay thế những gì đã có (an toàn khi import nhiều lần/nhiều
 * file bổ sung cho nhau). `classIdsByUser` đã được gộp theo email (xem
 * `groupMatchesByUser` trong `src/lib/scoring/importAssignments.ts`). Ghi
 * theo lô: 1 lần đọc + tối đa 1 lệnh batchUpdate cho người đã có dòng, cộng 1
 * lệnh append cho người chưa từng có assignment trong Round. */
export async function bulkImportAssignments(
  roundId: string,
  classIdsByUser: Map<string, string[]>,
  assignedBy: string,
): Promise<void> {
  if (classIdsByUser.size === 0) return;

  const allAssignments = await getRoundAssignments(roundId);
  const byUser = new Map(allAssignments.map((a) => [a.userEmail, a]));
  const now = nowIso();
  const normalizedAssignedBy = assignedBy.trim().toLowerCase();

  const specs: { matcher: (row: SheetRow) => boolean; updates: Partial<SheetRow> }[] = [];
  const newRows: SheetRow[] = [];

  for (const [emailRaw, classIds] of classIdsByUser) {
    const email = emailRaw.trim().toLowerCase();
    const existing = byUser.get(email);
    if (existing) {
      const nextClassIds = Array.from(new Set([...existing.allowedClassIds, ...classIds]));
      specs.push({
        matcher: (row) => row.assignmentId === existing.assignmentId,
        updates: {
          active: "TRUE",
          allowedClassIdsJson: JSON.stringify(nextClassIds),
          assignedBy: normalizedAssignedBy,
          assignedAt: now,
        },
      });
    } else {
      newRows.push({
        assignmentId: randomUUID(),
        roundId,
        userEmail: email,
        allowedGradeIdsJson: "[]",
        allowedClassIdsJson: JSON.stringify(Array.from(new Set(classIds))),
        active: "TRUE",
        assignedBy: normalizedAssignedBy,
        assignedAt: now,
      });
    }
  }

  if (specs.length > 0) {
    await batchUpdateRows(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, specs);
  }
  if (newRows.length > 0) {
    await appendRows(SHEET_NAMES.SCORING_ROUND_ASSIGNMENTS, newRows);
  }
}

export interface CanScoreResult {
  ok: boolean;
  code: CanScoreCode;
  message: string;
}

/** Nguồn sự thật DUY NHẤT cho câu hỏi "user X có được chấm lớp Y trong Round
 * Z không" — dùng trong Server Action submit (mục 9). Không tin bất kỳ giá
 * trị nào từ client ngoài 3 tham số định danh này. */
export async function canScoreClassInRound(
  userEmail: string,
  roundId: string,
  classId: string,
): Promise<CanScoreResult> {
  const round = await getScoringRound(roundId);
  if (!round) return { ok: false, code: "ROUND_NOT_FOUND", message: "Không tìm thấy Đợt chấm." };

  const classes = await getClasses({ activeOnly: true });
  const klass = classes.find((c) => c.classId === classId);
  if (!klass) {
    return { ok: false, code: "CLASS_NOT_FOUND", message: "Lớp không tồn tại hoặc đã ngừng chấm." };
  }

  const assignment = await isUserAssignedToRound(roundId, userEmail);
  const result = checkRoundEligibility({ round, assignment, classId, grade: klass.grade });
  if (!result.ok) {
    return { ok: false, code: result.code, message: eligibilityMessage(result.code, klass.className) };
  }
  return { ok: true, code: "OK", message: "" };
}
