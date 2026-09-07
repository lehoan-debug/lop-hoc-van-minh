import { describe, it, expect } from "vitest";
import { getEffectiveRoundStatus, canSubmitToRound } from "@/lib/rounds/roundStatus";
import { zonedTimeToUtc } from "@/lib/timezone/timezone";

function round(overrides: Partial<{ status: "DRAFT" | "OPEN" | "LOCKED" | "CANCELLED"; startsAt: string; endsAt: string }>) {
  return {
    status: "OPEN" as const,
    startsAt: zonedTimeToUtc("2026-09-08", "07:20:00").toISOString(),
    endsAt: zonedTimeToUtc("2026-09-08", "07:40:00").toISOString(),
    ...overrides,
  };
}

describe("getEffectiveRoundStatus — Asia/Ho_Chi_Minh", () => {
  it("trước startsAt -> SCHEDULED (sắp diễn ra)", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:00:00");
    expect(getEffectiveRoundStatus(round({}), now)).toBe("SCHEDULED");
  });

  it("trong khoảng [startsAt, endsAt) -> OPEN (đang mở)", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:30:00");
    expect(getEffectiveRoundStatus(round({}), now)).toBe("OPEN");
  });

  it("đúng thời điểm startsAt -> OPEN (bao gồm biên đầu)", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:20:00");
    expect(getEffectiveRoundStatus(round({}), now)).toBe("OPEN");
  });

  it("sau endsAt -> LOCKED (đã khoá tự động, hết giờ)", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:41:00");
    expect(getEffectiveRoundStatus(round({}), now)).toBe("LOCKED");
  });

  it("đúng thời điểm endsAt -> LOCKED (biên cuối không còn mở)", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:40:00");
    expect(getEffectiveRoundStatus(round({}), now)).toBe("LOCKED");
  });

  it("khoá thủ công luôn thắng dù đang trong khung giờ mở", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:30:00");
    expect(getEffectiveRoundStatus(round({ status: "LOCKED" }), now)).toBe("LOCKED");
  });

  it("DRAFT/CANCELLED luôn giữ nguyên bất kể giờ giấc", () => {
    const now = zonedTimeToUtc("2026-09-08", "07:30:00");
    expect(getEffectiveRoundStatus(round({ status: "DRAFT" }), now)).toBe("DRAFT");
    expect(getEffectiveRoundStatus(round({ status: "CANCELLED" }), now)).toBe("CANCELLED");
  });

  it("ranh giới múi giờ: 23:30 UTC hôm trước = 06:30 sáng hôm sau giờ VN, vẫn tính đúng SCHEDULED", () => {
    // startsAt 07:20 sáng 08/09 giờ VN = 00:20 UTC cùng ngày.
    // now = 2026-09-07T23:30:00Z = 2026-09-08T06:30 giờ VN -> vẫn trước 07:20 -> SCHEDULED.
    const now = new Date("2026-09-07T23:30:00.000Z");
    expect(getEffectiveRoundStatus(round({}), now)).toBe("SCHEDULED");
  });
});

describe("canSubmitToRound", () => {
  it("chỉ true khi effective status = OPEN", () => {
    const openNow = zonedTimeToUtc("2026-09-08", "07:30:00");
    const beforeStart = zonedTimeToUtc("2026-09-08", "07:00:00");
    const afterEnd = zonedTimeToUtc("2026-09-08", "07:41:00");
    expect(canSubmitToRound(round({}), openNow)).toBe(true);
    expect(canSubmitToRound(round({}), beforeStart)).toBe(false);
    expect(canSubmitToRound(round({}), afterEnd)).toBe(false);
  });
});
