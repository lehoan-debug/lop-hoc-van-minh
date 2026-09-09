/**
 * Tìm lớp CHƯA CHẤM tiếp theo (theo đúng thứ tự đã sắp sẵn trong
 * `sortedClassIds`) tính từ sau lớp hiện tại — dùng cho nút "Chấm lớp tiếp
 * theo" sau khi nộp xong 1 lớp, để đưa thẳng Giám khảo sang lớp kế tiếp thay
 * vì quay lại màn chọn lớp từ đầu. Hàm THUẦN, không gọi Google Sheets.
 *
 * Duyệt vòng tròn (wrap-around) bắt đầu ngay sau lớp hiện tại — nếu không
 * còn lớp nào chưa chấm ở phía sau, tiếp tục dò từ đầu danh sách (trước
 * lớp hiện tại) trước khi kết luận "đã chấm hết".
 */
export function findNextUnscoredClass(
  sortedClassIds: string[],
  currentClassId: string,
  doneClassIds: string[],
): string | null {
  const doneSet = new Set(doneClassIds);
  const currentIndex = sortedClassIds.indexOf(currentClassId);
  const n = sortedClassIds.length;
  if (n === 0) return null;

  // Lớp hiện tại không có trong danh sách (hiếm, vd. ngoài phạm vi phân
  // công) -> vẫn cố tìm lớp chưa chấm đầu tiên trong danh sách.
  const start = currentIndex === -1 ? 0 : currentIndex;

  for (let offset = 1; offset <= n; offset++) {
    const idx = (start + offset) % n;
    const id = sortedClassIds[idx]!;
    if (id === currentClassId) continue;
    if (!doneSet.has(id)) return id;
  }
  return null;
}
