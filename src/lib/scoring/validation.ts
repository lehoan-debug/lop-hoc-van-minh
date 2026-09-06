import { CRITERION_KEYS, type ScoreRecord } from "@/types";
import type { SubmitScoreInput } from "@/lib/validation/schemas";

/** Tổng 11 tiêu chí — luôn tính lại phía server, không tin số client gửi lên. */
export function computeTotalCriteriaScore(
  input: Pick<
    ScoreRecord,
    "c1" | "c2" | "c3" | "c4" | "c5" | "c6" | "c7" | "c8" | "c9" | "c10" | "c11"
  >,
): number {
  return CRITERION_KEYS.reduce((sum, key) => sum + input[key], 0);
}

/** Kiểm tra đã chấm đủ 11 tiêu chí (0/1 hợp lệ) chưa. Zod đã ép kiểu 0|1 nên
 * hàm này chủ yếu kiểm tra tính đầy đủ khi dữ liệu đến từ nguồn không qua Zod
 * (ví dụ localStorage draft cũ). */
export function isCriteriaComplete(input: Partial<SubmitScoreInput>): boolean {
  return CRITERION_KEYS.every((key) => input[key] === 0 || input[key] === 1);
}
