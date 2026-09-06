import { z } from "zod";

export const gradeSchema = z.enum(["10", "11", "12"]);

export const sessionSchema = z.enum(["MORNING", "AFTERNOON"]);

/** Điểm mỗi tiêu chí CHỈ được là 0 hoặc 1 — không tin dữ liệu client gửi lên. */
export const binaryScoreSchema = z.union([z.literal(0), z.literal(1)]);

export const criterionNoteSchema = z.object({
  criterionNumber: z.number().int().min(1).max(11),
  note: z.string().max(500),
});

export const submitScoreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  session: sessionSchema,
  grade: gradeSchema,
  classId: z.string().min(1),
  c1: binaryScoreSchema,
  c2: binaryScoreSchema,
  c3: binaryScoreSchema,
  c4: binaryScoreSchema,
  c5: binaryScoreSchema,
  c6: binaryScoreSchema,
  c7: binaryScoreSchema,
  c8: binaryScoreSchema,
  c9: binaryScoreSchema,
  c10: binaryScoreSchema,
  c11: binaryScoreSchema,
  notes: z.array(criterionNoteSchema).default([]),
});

export type SubmitScoreInput = z.infer<typeof submitScoreSchema>;

export const editScoreSchema = submitScoreSchema.extend({
  submissionId: z.string().uuid(),
});

export const createAdjustmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId: z.string().min(1),
  type: z.enum(["BONUS", "PENALTY"]),
  points: z.number().int().min(1).max(10).default(1),
  studentName: z.string().max(200).optional().default(""),
  description: z.string().min(1, "Vui lòng nhập nội dung").max(1000),
  location: z.string().max(200).optional().default(""),
  evidence: z.string().max(1000).optional().default(""),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

export const editAdjustmentSchema = createAdjustmentSchema.extend({
  adjustmentId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["JUDGE", "ADMIN", "SUPER_ADMIN"]),
  active: z.boolean(),
  allowedGrades: z.union([z.literal("ALL"), z.array(gradeSchema)]),
});

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const dashboardFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  timeFrom: z.string().optional(),
  timeTo: z.string().optional(),
  session: sessionSchema.optional(),
  grade: gradeSchema.optional(),
  classId: z.string().optional(),
  judgeEmail: z.string().optional(),
});
