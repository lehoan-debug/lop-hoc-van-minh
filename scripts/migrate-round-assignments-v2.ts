/**
 * Kiểm tra/báo cáo phân công Giám khảo theo LỚP sau khi sửa lỗ hổng nghiệp vụ
 * (xem docs/CLASS_ASSIGNMENT_UPGRADE.md). KHÔNG ghi/sửa/xoá bất kỳ dữ liệu
 * nào trên Google Sheet — đây là script READ-ONLY, an toàn chạy lại bất kỳ
 * lúc nào (idempotent theo nghĩa "không có tác dụng phụ").
 *
 * Lý do KHÔNG có bước "di trú dữ liệu" thực sự: schema `ScoringRoundAssignments`
 * không đổi (vẫn `allowedClassIdsJson`/`allowedGradeIdsJson` có sẵn từ trước).
 * Trước bản vá, mọi UI đều tạo assignment với 2 field này RỖNG — dữ liệu đó
 * KHÔNG chứa thông tin "người này định chấm lớp nào", nên không có cách nào
 * suy ra chính xác để tự động điền — đúng nguyên tắc "không tự đoán". Script
 * này chỉ LIỆT KÊ các Đợt chấm/người đang ở trạng thái "có mặt trong Round
 * nhưng chưa được tick lớp nào" để Admin biết cần vào
 * /admin/scoring-rounds/[roundId] phân công lại.
 *
 * Chạy: npm run migrate-round-assignments-v2
 */
import { existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

import { getScoringRounds, getRoundAssignments } from "../src/lib/google/sheets";

async function main() {
  console.log("=== Kiểm tra phân công theo lớp — Lớp học Văn minh ===");
  console.log("Script READ-ONLY, không ghi/sửa/xoá dữ liệu nào.\n");

  const rounds = await getScoringRounds();
  let totalOldStyle = 0;
  let totalNewStyle = 0;
  let roundsNeedingReassignment = 0;

  for (const round of rounds) {
    const assignments = await getRoundAssignments(round.roundId);
    if (assignments.length === 0) continue;

    const oldStyle = assignments.filter(
      (a) => a.allowedClassIds.length === 0 && a.allowedGradeIds.length === 0,
    );
    const newStyle = assignments.filter(
      (a) => a.allowedClassIds.length > 0 || a.allowedGradeIds.length > 0,
    );
    totalOldStyle += oldStyle.length;
    totalNewStyle += newStyle.length;

    if (oldStyle.length > 0) {
      roundsNeedingReassignment++;
      console.log(`⚠ Đợt "${round.title}" (${round.roundId})`);
      console.log(`  ${oldStyle.length} người có mặt trong Round nhưng CHƯA được phân công lớp nào:`);
      for (const a of oldStyle) {
        console.log(`    - ${a.userEmail}`);
      }
      if (newStyle.length > 0) {
        console.log(`  (${newStyle.length} người khác đã được phân công đúng lớp, không cần xử lý)`);
      }
      console.log(`  -> Vào /admin/scoring-rounds/${round.roundId} để phân công lại.\n`);
    }
  }

  console.log("--- Tổng kết ---");
  console.log(`Tổng số Đợt chấm: ${rounds.length}`);
  console.log(`Assignment kiểu cũ (chưa có lớp cụ thể): ${totalOldStyle}`);
  console.log(`Assignment kiểu mới (đã có lớp/khối cụ thể): ${totalNewStyle}`);
  console.log(`Số Đợt chấm cần Admin phân công lại: ${roundsNeedingReassignment}`);
  if (roundsNeedingReassignment === 0) {
    console.log("\n✅ Không có Đợt chấm nào cần xử lý.");
  } else {
    console.log(
      "\n⚠ Có Đợt chấm cần phân công lại — người dùng liên quan sẽ KHÔNG submit được cho tới khi Admin phân công lại theo lớp.",
    );
  }
}

main().catch((err) => {
  console.error("\n❌ Lỗi khi kiểm tra:", err instanceof Error ? err.message : err);
  process.exit(1);
});
