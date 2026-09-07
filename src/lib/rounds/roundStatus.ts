import type { EffectiveRoundStatus, ScoringRound } from "@/types";

/**
 * Trạng thái HIỆU LỰC của một Đợt chấm tại thời điểm `now` — luôn tính lại,
 * không tin thẳng `round.status` cho các mốc theo giờ (SCHEDULED/OPEN/LOCKED
 * tự động). `round.status` trong Sheet chỉ lưu 1 trong 4 giá trị:
 * - "DRAFT"/"CANCELLED": luôn thắng, bất kể giờ giấc.
 * - "LOCKED": khoá THỦ CÔNG (Admin bấm "Khoá ngay") — luôn thắng, bất kể
 *   `endsAt` chưa tới. Không tự động phục hồi theo giờ.
 * - "OPEN": trạng thái "bình thường", hiệu lực thực tế suy ra từ
 *   `startsAt`/`endsAt` so với `now` — có thể là SCHEDULED, OPEN hoặc LOCKED
 *   (hết giờ tự nhiên).
 *
 * "Mở lại" một đợt (`reopenScoringRound`) chỉ xoá cờ khoá thủ công, đưa
 * status về "OPEN" — nếu `endsAt` đã trôi qua tự nhiên, đợt sẽ NGAY LẬP TỨC
 * hiệu lực LOCKED trở lại (đây là chủ đích: muốn chấm được tiếp sau khi hết
 * giờ tự nhiên thì Admin phải dời `endsAt` qua `updateScoringRound`, không
 * phải qua "mở lại" — 2 hành động khác nhau).
 *
 * Timezone: `startsAt`/`endsAt` lưu dạng ISO 8601 instant (tuyệt đối) nên so
 * sánh bằng `Date#getTime()` là chính xác bất kể timezone máy chủ chạy ở
 * đâu. Việc quy đổi "07:20 08/09/2026" (giờ Việt Nam, Admin nhập trên form)
 * sang instant UTC để LƯU phải dùng `zonedTimeToUtc()`
 * (`src/lib/timezone/timezone.ts`) tại nơi tạo/sửa Đợt chấm.
 */
export function getEffectiveRoundStatus(
  round: Pick<ScoringRound, "status" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): EffectiveRoundStatus {
  if (round.status === "CANCELLED") return "CANCELLED";
  if (round.status === "DRAFT") return "DRAFT";
  if (round.status === "LOCKED") return "LOCKED";

  const nowMs = now.getTime();
  const startsMs = new Date(round.startsAt).getTime();
  const endsMs = new Date(round.endsAt).getTime();
  if (Number.isNaN(startsMs) || Number.isNaN(endsMs)) return "DRAFT";

  if (nowMs < startsMs) return "SCHEDULED";
  if (nowMs >= endsMs) return "LOCKED";
  return "OPEN";
}

export function canSubmitToRound(
  round: Pick<ScoringRound, "status" | "startsAt" | "endsAt">,
  now: Date = new Date(),
): boolean {
  return getEffectiveRoundStatus(round, now) === "OPEN";
}

export const ROUND_STATUS_LABEL: Record<EffectiveRoundStatus, string> = {
  DRAFT: "Bản nháp",
  SCHEDULED: "Sắp diễn ra",
  OPEN: "Đang mở",
  LOCKED: "Đã khoá",
  CANCELLED: "Đã huỷ",
};

/** Số mili-giây còn lại tới `endsAt` — âm nếu đã qua. Dùng cho đếm ngược UI. */
export function msUntilRoundEnds(
  round: Pick<ScoringRound, "endsAt">,
  now: Date = new Date(),
): number {
  return new Date(round.endsAt).getTime() - now.getTime();
}
