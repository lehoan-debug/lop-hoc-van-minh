/**
 * Migration V2 — an toàn, IDEMPOTENT (chạy lại nhiều lần không gây trùng lặp
 * hay ghi đè dữ liệu đã có). KHÔNG xoá, KHÔNG đổi tên, KHÔNG đổi thứ tự cột
 * cũ ở bất kỳ sheet nào — chỉ ghi thêm header cột mới (cuối bảng) và điền dữ
 * liệu mặc định cho các dòng CHƯA có dữ liệu cột mới. Xem
 * docs/V2_UPGRADE_ANALYSIS.md mục 4 để biết đầy đủ lý do/thiết kế.
 *
 * Việc cần làm:
 * 1. Đảm bảo mọi sheet (kể cả 2 sheet mới ScoringRounds/ScoringRoundAssignments)
 *    có đúng header V2 (chỉ ghi đè hàng 1, không đụng dữ liệu từ hàng 2).
 * 2. Users: dòng nào chưa có `rolesJson` -> ghi `rolesJson=[role hiện tại]`,
 *    `homeroomClassIdsJson=[]`.
 * 3. Criteria: dòng nào chưa có `maxScore` -> ghi `maxScore=1`,
 *    `scoringType=PASS_FAIL`, `gradeIdsJson=[]`, `createdAt/updatedAt=now`.
 * 4. Scores: KHÔNG backfill hàng loạt (V1 hiện chưa có dữ liệu Scores nào
 *    trên production ở thời điểm viết migration này — đã xác minh qua Drive).
 *    Nếu sau này phát hiện có dữ liệu V1 cũ cần snapshot, chạy với cờ
 *    `--backfill-scores` để tạo snapshot XẤP XỈ từ c1..c11 + Criteria hiện
 *    tại (đánh dấu rõ `approximated: true`, KHÔNG đụng cột gốc).
 *
 * Chạy: npm run migrate-v2
 */
import { existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { ensureSheetWithHeader, getAllRows, updateRowWhere } from "../src/lib/google/sheetRepo";
import { SHEET_NAMES } from "../src/lib/google/schema";
import { nowIso } from "../src/lib/timezone/timezone";

const BACKFILL_SCORES = process.argv.includes("--backfill-scores");

async function migrateHeaders() {
  console.log("Bước 1/3 — Đảm bảo header đúng V2 cho toàn bộ sheet (không đụng dữ liệu)...");
  for (const name of Object.values(SHEET_NAMES)) {
    await ensureSheetWithHeader(name);
    console.log(`  ✓ ${name}`);
  }
}

async function migrateUsers() {
  console.log("\nBước 2/3 — Users: backfill rolesJson/homeroomClassIdsJson cho dòng cũ...");
  const rows = await getAllRows(SHEET_NAMES.USERS, { cache: false });
  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.rolesJson && row.rolesJson.trim() !== "") {
      skipped++;
      continue;
    }
    const legacyRole = row.role?.trim() || "JUDGE";
    await updateRowWhere(
      SHEET_NAMES.USERS,
      (r) => r.email?.trim().toLowerCase() === row.email?.trim().toLowerCase(),
      {
        rolesJson: JSON.stringify([legacyRole]),
        homeroomClassIdsJson: row.homeroomClassIdsJson?.trim() ? row.homeroomClassIdsJson : "[]",
      },
    );
    migrated++;
    console.log(`  ✓ ${row.email} -> roles=["${legacyRole}"]`);
  }
  console.log(`  Hoàn tất Users: ${migrated} dòng migrate, ${skipped} dòng đã có sẵn (bỏ qua).`);
}

async function migrateCriteria() {
  console.log("\nBước 3/3 — Criteria: backfill maxScore/scoringType/gradeIdsJson cho dòng cũ...");
  const rows = await getAllRows(SHEET_NAMES.CRITERIA, { cache: false });
  let migrated = 0;
  let skipped = 0;
  const now = nowIso();
  for (const row of rows) {
    if (row.maxScore && row.maxScore.trim() !== "") {
      skipped++;
      continue;
    }
    await updateRowWhere(SHEET_NAMES.CRITERIA, (r) => r.criterionId === row.criterionId, {
      maxScore: "1",
      scoringType: "PASS_FAIL",
      gradeIdsJson: row.gradeIdsJson?.trim() ? row.gradeIdsJson : "[]",
      createdAt: row.createdAt?.trim() || now,
      updatedAt: row.updatedAt?.trim() || now,
    });
    migrated++;
    console.log(`  ✓ ${row.criterionId} (${row.criterionName}) -> maxScore=1, PASS_FAIL`);
  }
  console.log(`  Hoàn tất Criteria: ${migrated} dòng migrate, ${skipped} dòng đã có sẵn (bỏ qua).`);
}

async function backfillScoresIfRequested() {
  if (!BACKFILL_SCORES) {
    console.log(
      "\n(Bỏ qua backfill Scores — không có dữ liệu V1 cần chuyển ở thời điểm viết migration. " +
        "Chạy lại với `--backfill-scores` nếu sau này cần.)",
    );
    return;
  }
  console.log("\nBackfill Scores V1 -> snapshot V2 (XẤP XỈ, đánh dấu approximated=true)...");
  const [scoreRows, criteriaRows] = await Promise.all([
    getAllRows(SHEET_NAMES.SCORES, { cache: false }),
    getAllRows(SHEET_NAMES.CRITERIA, { cache: false }),
  ]);
  const criteriaByNumber = new Map(criteriaRows.map((c) => [Number(c.criterionNumber), c]));

  let migrated = 0;
  let skipped = 0;
  for (const row of scoreRows) {
    if (row.criteriaSnapshotJson && row.criteriaSnapshotJson !== "[]") {
      skipped++;
      continue;
    }
    if (!row.totalCriteriaScore || row.totalCriteriaScore.trim() === "") {
      skipped++;
      continue;
    }
    const snapshot = [];
    let total = 0;
    for (let n = 1; n <= 11; n++) {
      const c = criteriaByNumber.get(n);
      const val = row[`c${n}`] === "1" ? 1 : 0;
      total += val;
      snapshot.push({
        criterionId: c?.criterionId ?? `C${n}`,
        name: c?.criterionName ?? `Tiêu chí ${n}`,
        maxScore: 1,
        result: val === 1 ? "PASS" : "FAIL",
        awardedScore: val,
        approximated: true,
      });
    }
    await updateRowWhere(SHEET_NAMES.SCORES, (r) => r.submissionId === row.submissionId, {
      criteriaSnapshotJson: JSON.stringify(snapshot),
      answersJson: JSON.stringify(
        Object.fromEntries(snapshot.map((s) => [s.criterionId, s.result])),
      ),
      totalScore: String(total),
      maxPossibleScore: "11",
    });
    migrated++;
  }
  console.log(`  Hoàn tất backfill Scores: ${migrated} dòng, ${skipped} dòng bỏ qua (đã có/không có dữ liệu).`);
}

async function main() {
  console.log("=== MIGRATION V2 — Lớp học Văn minh ===");
  console.log("Không xoá / không ghi đè dữ liệu cũ — chỉ thêm cột và backfill giá trị mặc định.\n");

  await migrateHeaders();
  await migrateUsers();
  await migrateCriteria();
  await backfillScoresIfRequested();

  console.log("\n✅ Migration V2 hoàn tất. Có thể chạy lại lệnh này bất kỳ lúc nào (idempotent).");
}

main().catch((err) => {
  console.error("\n❌ Lỗi khi migrate:", err instanceof Error ? err.message : err);
  process.exit(1);
});
