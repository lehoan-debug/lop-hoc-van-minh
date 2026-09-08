/**
 * Chia các lớp CHO LIÊN TIẾP theo đúng thứ tự (không xáo trộn, không ngắt
 * quãng) cho nhiều Giám khảo — hàm THUẦN, tách khỏi Google Sheets để test
 * được. Đây KHÔNG phải chia ngẫu nhiên — `sortedClassIds` phải được người
 * gọi sắp xếp sẵn theo đúng thứ tự mong muốn (thường là sortOrder trong 1
 * khối) TRƯỚC khi truyền vào, và hàm CHỈ CẮT THÀNH TỪNG KHỐI LIÊN TIẾP theo
 * đúng thứ tự đó — không bao giờ tách 1 người thành các lớp rời rạc (vd.
 * 10A1 + 10A5), và không tự trộn nhiều khối vào 1 lần gọi (người gọi phải tự
 * tách theo khối trước — xem randomAssignAction).
 *
 * 2 chế độ:
 * - "auto" (Chia đều): K = floor(N / M); M-1 người đầu nhận đúng K lớp,
 *   người CUỐI CÙNG nhận phần dư (K + N mod M) — dùng hết toàn bộ lớp, dùng
 *   hết toàn bộ người.
 * - K cố định (số lớp/người do Admin chọn): cắt tuần tự từng khối đúng K
 *   lớp cho từng người theo thứ tự; nếu lớp dùng hết trước khi hết người,
 *   người sau không có lớp; nếu người dùng hết trước khi hết lớp, phần lớp
 *   dư KHÔNG được gán (trả riêng để báo cho Admin, không tự dồn vào ai).
 */
export interface SequentialDistribution {
  byJudge: Map<string, string[]>;
  /** Số lớp còn dư, không đủ người để nhận (chỉ xảy ra ở chế độ K cố định
   * khi số lớp vượt quá sức chứa K × số người đã chọn). */
  unassignedClassIds: string[];
}

export function distributeClassesSequentially(
  sortedClassIds: string[],
  judgeEmails: string[],
  classesPerJudge: number | "auto",
): SequentialDistribution {
  const byJudge = new Map<string, string[]>();
  for (const email of judgeEmails) byJudge.set(email, []);
  if (judgeEmails.length === 0 || sortedClassIds.length === 0) {
    return { byJudge, unassignedClassIds: [] };
  }

  if (classesPerJudge === "auto") {
    const base = Math.floor(sortedClassIds.length / judgeEmails.length);
    const remainder = sortedClassIds.length - base * judgeEmails.length;
    let cursor = 0;
    judgeEmails.forEach((email, i) => {
      const isLast = i === judgeEmails.length - 1;
      const count = base + (isLast ? remainder : 0);
      byJudge.set(email, sortedClassIds.slice(cursor, cursor + count));
      cursor += count;
    });
    return { byJudge, unassignedClassIds: [] };
  }

  let cursor = 0;
  for (const email of judgeEmails) {
    if (cursor >= sortedClassIds.length) break;
    const chunk = sortedClassIds.slice(cursor, cursor + classesPerJudge);
    byJudge.set(email, chunk);
    cursor += chunk.length;
  }
  return { byJudge, unassignedClassIds: sortedClassIds.slice(cursor) };
}
