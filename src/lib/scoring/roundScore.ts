import type { CriterionConfig, CriterionSnapshotItem } from "@/types";

/**
 * Tạo bản chụp tiêu chí (snapshot) TẠI THỜI ĐIỂM chấm, từ danh sách Criteria
 * đang active + câu trả lời PASS/FAIL của người chấm. Bản chụp này được lưu
 * NGUYÊN VẸN vào `Scores.criteriaSnapshotJson` — sau này Criteria đổi (tên,
 * điểm, bật/tắt) KHÔNG được làm thay đổi kết quả của các lượt đã chấm.
 * Xem docs/V2_UPGRADE_ANALYSIS.md mục 3.3 / yêu cầu V2 mục Q.
 */
export function buildCriteriaSnapshot(
  criteria: CriterionConfig[],
  answers: Record<string, "PASS" | "FAIL">,
  notes: Record<string, string> = {},
): CriterionSnapshotItem[] {
  return criteria.map((c) => {
    const result = answers[c.criterionId] === "PASS" ? "PASS" : "FAIL";
    const awardedScore = result === "PASS" ? c.maxScore : 0;
    const note = notes[c.criterionId];
    return {
      criterionId: c.criterionId,
      name: c.criterionName,
      maxScore: c.maxScore,
      result,
      awardedScore,
      ...(note ? { note } : {}),
    };
  });
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

/** true nếu người chấm đã trả lời đủ (PASS hoặc FAIL) cho toàn bộ tiêu chí
 * áp dụng cho lớp/khối đang chấm. */
export function isAllCriteriaAnswered(
  criteria: CriterionConfig[],
  answers: Record<string, "PASS" | "FAIL">,
): boolean {
  return criteria.every((c) => answers[c.criterionId] === "PASS" || answers[c.criterionId] === "FAIL");
}
