/**
 * Khởi tạo cấu trúc Google Sheet cho ứng dụng "Lớp học Văn minh".
 *
 * Tạo (nếu chưa có) 8 sheet: Users, Classes, Criteria, Scores, Adjustments,
 * Settings, AuditLog, RankingDecisions kèm header đúng thứ tự cột, sau đó nạp
 * dữ liệu mẫu cho Classes / Criteria (trích nguyên văn từ 4 file Word — xem
 * src/config/) và giá trị mặc định cho Settings. KHÔNG tự sáng tác dữ liệu
 * ngoài 4 tài liệu gốc — xem docs/BUSINESS_ANALYSIS.md.
 *
 * Chạy: npm run init-sheet
 * Yêu cầu: đã cấu hình .env.local với GOOGLE_SHEETS_SPREADSHEET_ID,
 * GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, và đã
 * share spreadsheet cho service account với quyền Editor.
 * Xem docs/GOOGLE_SHEETS_SETUP.md để biết chi tiết từng bước.
 *
 * Lưu ý kỹ thuật: script chạy bằng `tsx --conditions=react-server` (xem
 * package.json) — cờ này bắt buộc vì `src/lib/google/sheetRepo.ts` import
 * "server-only" (gói đánh dấu module chỉ dùng trong React Server Component);
 * gói này chỉ resolve về bản no-op khi có export condition "react-server",
 * điều mà Next.js tự thêm khi build app nhưng Node chạy tsx trực tiếp thì
 * không — nếu thiếu cờ này, script sẽ báo lỗi ngay khi import.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { ensureSheetWithHeader, appendRows, getAllRows } from "../src/lib/google/sheetRepo";
import { SHEET_NAMES, DEFAULT_SETTINGS } from "../src/lib/google/schema";
import { SEED_CLASSES } from "../src/config/classes";
import { SEED_CRITERIA } from "../src/config/criteria";

async function seedIfEmpty(
  sheetName: (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES],
  rows: Record<string, string>[],
  label: string,
) {
  const existing = await getAllRows(sheetName, { cache: false });
  if (existing.length > 0) {
    console.log(`  → Sheet "${sheetName}" đã có ${existing.length} dòng dữ liệu — bỏ qua seed ${label}.`);
    return;
  }
  await appendRows(sheetName, rows);
  console.log(`  ✓ Đã nạp ${rows.length} dòng ${label} vào sheet "${sheetName}".`);
}

async function main() {
  console.log("Đang khởi tạo cấu trúc Google Sheet cho LỚP HỌC VĂN MINH...\n");

  for (const name of Object.values(SHEET_NAMES)) {
    await ensureSheetWithHeader(name);
    console.log(`  ✓ Sheet "${name}" đã sẵn sàng (đã ghi header).`);
  }

  console.log("\nNạp dữ liệu mẫu...");

  await seedIfEmpty(
    SHEET_NAMES.CLASSES,
    SEED_CLASSES.map((c) => ({
      classId: c.classId,
      className: c.className,
      grade: c.grade,
      active: c.active ? "TRUE" : "FALSE",
      sortOrder: String(c.sortOrder),
    })),
    "danh sách lớp",
  );

  await seedIfEmpty(
    SHEET_NAMES.CRITERIA,
    SEED_CRITERIA.map((c) => ({
      criterionId: c.criterionId,
      criterionNumber: String(c.criterionNumber),
      criterionName: c.criterionName,
      description: c.description,
      active: c.active ? "TRUE" : "FALSE",
      sortOrder: String(c.sortOrder),
      needsReview: c.needsReview ? "TRUE" : "FALSE",
      maxScore: String(c.maxScore),
      scoringType: c.scoringType,
      gradeIdsJson: JSON.stringify(c.gradeIds),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    "tiêu chí chấm điểm",
  );

  const now = new Date().toISOString();
  await seedIfEmpty(
    SHEET_NAMES.SETTINGS,
    Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value, updatedAt: now })),
    "cấu hình mặc định",
  );

  console.log(
    "\nHoàn tất!\n" +
      "Bước tiếp theo: mở sheet Users và thêm dòng tài khoản đầu tiên với role=SUPER_ADMIN, active=TRUE\n" +
      "để có thể đăng nhập và cấu hình hệ thống qua giao diện /admin.",
  );
}

main().catch((err) => {
  console.error("\nLỗi khi khởi tạo Google Sheet:", err instanceof Error ? err.message : err);
  process.exit(1);
});
