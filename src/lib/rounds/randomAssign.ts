/**
 * Chia NGẪU NHIÊN và ĐỀU các lớp cho nhiều Giám khảo — hàm THUẦN, tách khỏi
 * Google Sheets để test được. Thuật toán: xáo ngẫu nhiên (Fisher-Yates) rồi
 * chia bài kiểu round-robin — đảm bảo chênh lệch số lớp giữa 2 người bất kỳ
 * tối đa là 1 (đều), trong khi LỚP NÀO về tay AI vẫn ngẫu nhiên.
 *
 * `rng` mặc định `Math.random` — cho phép truyền RNG xác định (test) để kết
 * quả lặp lại được. Không dùng cho mục đích bảo mật, chỉ để chia việc công
 * bằng — không cần RNG mật mã học.
 */
export function randomlyDistributeClasses(
  classIds: string[],
  judgeEmails: string[],
  rng: () => number = Math.random,
): Map<string, string[]> {
  const byJudge = new Map<string, string[]>();
  for (const email of judgeEmails) byJudge.set(email, []);
  if (judgeEmails.length === 0 || classIds.length === 0) return byJudge;

  const shuffled = shuffle(classIds, rng);
  shuffled.forEach((classId, i) => {
    const email = judgeEmails[i % judgeEmails.length]!;
    byJudge.get(email)!.push(classId);
  });
  return byJudge;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }
  return copy;
}
