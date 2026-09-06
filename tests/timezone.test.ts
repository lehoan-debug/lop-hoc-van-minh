import { describe, it, expect } from "vitest";
import { formatInVN, formatDateVN, formatTimeVN, isTimeWithinRange } from "@/lib/timezone/timezone";

describe("Vietnam timezone boundary (UTC+7)", () => {
  it("23:30 UTC ngày hôm trước phải sang NGÀY HÔM SAU tại Việt Nam", () => {
    // 2026-09-05T23:30:00Z + 7h = 2026-09-06T06:30:00 giờ Việt Nam
    const utcInstant = "2026-09-05T23:30:00.000Z";
    expect(formatDateVN(utcInstant)).toBe("06/09/2026");
    expect(formatInVN(utcInstant, "yyyy-MM-dd")).toBe("2026-09-06");
    expect(formatTimeVN(utcInstant)).toBe("06:30:00");
  });

  it("17:00 UTC là mốc chuyển ngày (đúng 00:00 giờ Việt Nam)", () => {
    const utcInstant = "2026-09-05T17:00:00.000Z";
    expect(formatInVN(utcInstant, "yyyy-MM-dd")).toBe("2026-09-06");
    expect(formatTimeVN(utcInstant)).toBe("00:00:00");
  });

  it("16:59 UTC vẫn còn thuộc ngày cũ tại Việt Nam", () => {
    const utcInstant = "2026-09-05T16:59:00.000Z";
    expect(formatInVN(utcInstant, "yyyy-MM-dd")).toBe("2026-09-05");
    expect(formatTimeVN(utcInstant)).toBe("23:59:00");
  });

  it("02:00 UTC vẫn là cùng ngày dương lịch tại Việt Nam (09:00)", () => {
    const utcInstant = "2026-09-06T02:00:00.000Z";
    expect(formatInVN(utcInstant, "yyyy-MM-dd")).toBe("2026-09-06");
    expect(formatTimeVN(utcInstant)).toBe("09:00:00");
  });
});

describe("isTimeWithinRange", () => {
  it("nằm trong khung giờ (bao gồm biên)", () => {
    expect(isTimeWithinRange("07:15", "07:00", "07:45")).toBe(true);
    expect(isTimeWithinRange("07:00", "07:00", "07:45")).toBe(true);
    expect(isTimeWithinRange("07:45", "07:00", "07:45")).toBe(true);
  });

  it("ngoài khung giờ", () => {
    expect(isTimeWithinRange("06:59", "07:00", "07:45")).toBe(false);
    expect(isTimeWithinRange("07:46", "07:00", "07:45")).toBe(false);
  });
});
