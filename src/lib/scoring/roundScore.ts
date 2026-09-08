import type { CriterionConfig, CriterionSnapshotItem } from "@/types";

/**
 * Tạo bản chụp tiêu chí (snapshot) TẠI THỜI ĐIỂM chấm, từ danh sách Criteria
 * đang active + câu trả lời PASS/FAIL của người chấm. Bản chụp này được lưu
 * NGUYÊN VẸN vào `Scores.criteriaSnapshotJson` — sau này Criteria đổi (tên,
 * điểm, bật/tắt) KHÔNG được làm thay đổi kết quả của các lượt đã chấm.
 * Xem docs/V2_UPGRADE_ANALYSIS.md mục 3.3 / yêu cầu V2 mục Q.
 *
 * Tiêu chí KHÔNG có trong `answers` (người chấm bỏ trống — không áp dụng/
 * không quan sát được) bị LOẠI KHỎI snapshot hoàn toàn, không tự suy ra
 * KHÔNG ĐẠT — vừa không cộng điểm vừa không tính vào maxPossibleScore của
 * lượt chấm đó. Xem `isAnyCriterionAnswered`.
 */
export function buildCriteriaSnapshot(
  criteria: CriterionConfig[],
  answers: Record<string, "PASS" | "FAIL">,
  notes: Record<string, string> = {},
): CriterionSnapshotItem[] {
  const items: CriterionSnapshotItem[] = [];
  for (const c of criteria) {
    const result = answers[c.criterionId];
    if (result !== "PASS" && result !== "FAIL") continue;
    const awardedScore = result === "PASS" ? c.maxScore : 0;
    const note = notes[c.criterionId];
    items.push({
      criterionId: c.criterionId,
      name: c.criterionName,
      maxScore: c.maxScore,
      result,
      awardedScore,
      ...(note ? { note } : {}),
    });
  }
  return items;
}

export interface SnapshotTotals {
  totalScore: number;
  maxPossibleScore: number;
}

/** Tổng điểm đạt được / tổng điểm tối đa từ MỘT bản chụp đã lưu — không bao
 * giờ tính lại từ Criteria hiện tại (đó chính là lý do có snapshot). */
export function totalsFromSnapshot(
  snapshot: CriterionSnapshotItem[],
): SnapshotTotals {
  return {
    totalScore: snapshot.reduce((sum, item) => sum + item.awardedScore, 0),
    maxPossibleScore: snapshot.reduce((sum, item) => sum + item.maxScore, 0),
  };
}

/**
 * true nếu người chấm đã trả lời ÍT NHẤT 1 tiêu chí trong số tiêu chí áp
 * dụng cho lớp/khối/Đợt chấm đang chấm. Đợt chấm KHÔNG bắt buộc phải chấm
 * hết toàn bộ tiêu chí hiển thị (1 đợt có thể chỉ áp dụng 1 phần bộ tiêu
 * chí, và trong phần đó người chấm vẫn có thể bỏ trống tiêu chí không quan
 * sát được) — chỉ chặn trường hợp nộp mà KHÔNG chấm gì cả.
 */
export function isAnyCriterionAnswered(
  criteria: CriterionConfig[],
  answers: Record<string, "PASS" | "FAIL">,
): boolean {
  return criteria.some((c) => answers[c.criterionId] === "PASS" || answers[c.criterionId] === "FAIL");
}
