import { toZonedTime, fromZonedTime, format } from "date-fns-tz";

export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Trả về thời điểm hiện tại dưới dạng Date, nhưng các phép format sau đó
 * phải luôn truyền APP_TIMEZONE để không bị lệch sang giờ UTC/giờ máy chủ. */
export function nowInVietnam(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

/** Ngày hiện tại theo giờ Việt Nam, dạng YYYY-MM-DD — dùng làm khoá logic
 * (date) cho Scores/Adjustments. Không dùng new Date().toISOString() trực
 * tiếp vì sẽ lấy nhầm ngày UTC (lệch múi giờ có thể sang ngày khác so với
 * Việt Nam, đặc biệt từ 00:00–07:00 UTC = 07:00–14:00 giờ VN của NGÀY ĐÓ,
 * và từ 17:00–23:59 UTC = 00:00–06:59 giờ VN của NGÀY HÔM SAU). */
export function todayVN(): string {
  return formatInVN(new Date(), "yyyy-MM-dd");
}

/** Định dạng một Date/ISO-string bất kỳ theo giờ Việt Nam. */
export function formatInVN(date: Date | string, pattern: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(toZonedTime(d, APP_TIMEZONE), pattern, {
    timeZone: APP_TIMEZONE,
  });
}

/** Hiển thị chuẩn DD/MM/YYYY HH:mm:ss theo giờ Việt Nam. */
export function formatDateTimeVN(date: Date | string): string {
  return formatInVN(date, "dd/MM/yyyy HH:mm:ss");
}

export function formatDateVN(date: Date | string): string {
  return formatInVN(date, "dd/MM/yyyy");
}

export function formatTimeVN(date: Date | string): string {
  return formatInVN(date, "HH:mm:ss");
}

/** Chuyển một "giờ địa phương VN" (vd: chọn ngày trên UI) thành Date UTC
 * chính xác, dùng khi cần so sánh mốc thời gian tuyệt đối. */
export function zonedTimeToUtc(dateStr: string, timeStr = "00:00:00"): Date {
  return fromZonedTime(`${dateStr}T${timeStr}`, APP_TIMEZONE);
}

/** ISO 8601 instant hiện tại (dùng để lưu timestamp/createdAt/updatedAt). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Giờ hiện tại theo VN dạng "HH:mm" — dùng để so sánh với khung giờ Settings. */
export function currentTimeVN(): string {
  return formatInVN(new Date(), "HH:mm");
}

/** Tháng hiện tại theo giờ Việt Nam, dạng YYYY-MM. */
export function currentYearMonthVN(): string {
  return formatInVN(new Date(), "yyyy-MM");
}

/** Khoảng ngày đầu-cuối của một tháng (YYYY-MM) dạng YYYY-MM-DD, dùng để lọc
 * dữ liệu tháng khi xếp hạng. */
export function getMonthDateRange(yearMonth: string): { from: string; to: string } {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${yearMonth}-01`,
    to: `${yearMonth}-${pad(lastDay)}`,
  };
}

/** So sánh "HH:mm" <= "HH:mm" (chuỗi cùng định dạng, so sánh từ điển là đủ). */
export function isTimeWithinRange(
  current: string,
  start: string,
  end: string,
): boolean {
  return current >= start && current <= end;
}
