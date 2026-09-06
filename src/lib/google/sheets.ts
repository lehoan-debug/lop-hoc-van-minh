import "server-only";
import { randomUUID } from "crypto";
import {
  getAllRows,
  appendRow,
  updateRowWhere,
  type SheetRow,
} from "./sheetRepo";
import { SHEET_NAMES, DEFAULT_SETTINGS } from "./schema";
import { nowIso } from "@/lib/timezone/timezone";
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

// ---------- Users ----------

function rowToUser(row: SheetRow): AppUser {
  return {
    email: row.email?.trim().toLowerCase() ?? "",
    name: row.name ?? "",
    role: (row.role as AppUser["role"]) || "JUDGE",
    active: parseBool(row.active),
    allowedGrades: parseAllowedGrades(row.allowedGrades),
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
  role: AppUser["role"];
  active: boolean;
  allowedGrades: Grade[] | "ALL";
}): Promise<boolean> {
  const normalized = input.email.trim().toLowerCase();
  const ok = await updateRowWhere(
    SHEET_NAMES.USERS,
    (row) => row.email?.trim().toLowerCase() === normalized,
    {
      name: input.name,
      role: input.role,
      active: input.active ? "TRUE" : "FALSE",
      allowedGrades: serializeAllowedGrades(input.allowedGrades),
      updatedAt: nowIso(),
    },
  );
  if (!ok) {
    await appendRow(SHEET_NAMES.USERS, {
      email: normalized,
      name: input.name,
      role: input.role,
      active: input.active ? "TRUE" : "FALSE",
      allowedGrades: serializeAllowedGrades(input.allowedGrades),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  return true;
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

function rowToCriterion(row: SheetRow): CriterionConfig {
  return {
    criterionId: row.criterionId ?? "",
    criterionNumber: Number(row.criterionNumber) || 0,
    criterionName: row.criterionName ?? "",
    description: row.description ?? "",
    active: parseBool(row.active),
    sortOrder: Number(row.sortOrder) || 0,
    needsReview: parseBool(row.needsReview),
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

export async function updateCriterion(
  criterionId: string,
  updates: { active?: boolean; description?: string; needsReview?: boolean },
): Promise<boolean> {
  const patch: SheetRow = {};
  if (updates.active !== undefined) patch.active = updates.active ? "TRUE" : "FALSE";
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.needsReview !== undefined)
    patch.needsReview = updates.needsReview ? "TRUE" : "FALSE";
  return updateRowWhere(SHEET_NAMES.CRITERIA, (row) => row.criterionId === criterionId, patch);
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
  };
}

export interface ScoreFilter {
  dateFrom?: string;
  dateTo?: string;
  session?: Session_;
  grade?: Grade;
  classId?: string;
  judgeEmail?: string;
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
  return scores;
}

export async function getScore(submissionId: string): Promise<ScoreRecord | null> {
  const scores = await getScores({ includeDeleted: true });
  return scores.find((s) => s.submissionId === submissionId) ?? null;
}

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
