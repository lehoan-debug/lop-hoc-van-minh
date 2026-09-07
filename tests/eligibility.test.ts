import { describe, it, expect } from "vitest";
import {
  checkRoundEligibility,
  isClassInRoundScope,
  isClassInAssignmentScope,
} from "@/lib/rounds/eligibility";
import { zonedTimeToUtc } from "@/lib/timezone/timezone";
import type { ScoringRound, ScoringRoundAssignment } from "@/types";

function makeRound(overrides: Partial<ScoringRound> = {}): ScoringRound {
  return {
    roundId: "r1",
    title: "Đợt chấm sáng 08/09/2026",
    description: "",
    session: "MORNING",
    startsAt: zonedTimeToUtc("2026-09-08", "07:20:00").toISOString(),
    endsAt: zonedTimeToUtc("2026-09-08", "07:40:00").toISOString(),
    status: "OPEN",
    gradeIds: [],
    classIds: [],
    createdBy: "admin@fpt.edu.vn",
    createdAt: "",
    updatedAt: "",
    manuallyLockedAt: "",
    manuallyLockedBy: "",
    ...overrides,
  };
}

function makeAssignment(
  overrides: Partial<ScoringRoundAssignment> = {},
): ScoringRoundAssignment {
  return {
    assignmentId: "a1",
    roundId: "r1",
    userEmail: "judge@fpt.edu.vn",
    allowedGradeIds: [],
    allowedClassIds: [],
    active: true,
    assignedBy: "admin@fpt.edu.vn",
    assignedAt: "",
    ...overrides,
  };
}

const OPEN_NOW = zonedTimeToUtc("2026-09-08", "07:30:00");

describe("checkRoundEligibility — chỉ người được phân công mới chấm được", () => {
  it("JUDGE/ADMIN/SUPER_ADMIN chưa được phân công -> không submit được", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: null,
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOT_ASSIGNED");
  });

  it("Được phân công đúng round đang mở -> submit được", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: makeAssignment(),
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("OK");
  });

  it("Round chưa tới giờ -> không submit được (SCHEDULED)", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: makeAssignment(),
      classId: "10A1",
      grade: "10",
      now: zonedTimeToUtc("2026-09-08", "07:00:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ROUND_SCHEDULED");
  });

  it("Round hết giờ -> không submit được (LOCKED)", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: makeAssignment(),
      classId: "10A1",
      grade: "10",
      now: zonedTimeToUtc("2026-09-08", "07:41:00"),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ROUND_LOCKED");
  });

  it("Round khoá thủ công -> không submit được dù đang trong khung giờ", () => {
    const result = checkRoundEligibility({
      round: makeRound({ status: "LOCKED" }),
      assignment: makeAssignment(),
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ROUND_LOCKED");
  });

  it("Lớp ngoài phạm vi Round (round giới hạn classIds) -> từ chối", () => {
    const result = checkRoundEligibility({
      round: makeRound({ classIds: ["10A2", "10A3"] }),
      assignment: makeAssignment(),
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("OUT_OF_ROUND_SCOPE");
  });

  it("Lớp ngoài phạm vi được phân công riêng (assignment giới hạn allowedClassIds)", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: makeAssignment({ allowedClassIds: ["11A1"] }),
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("OUT_OF_ASSIGNMENT_SCOPE");
  });

  it("ADMIN được phân công vào round -> submit được (tự thêm mình vào danh sách)", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: makeAssignment({ userEmail: "admin@fpt.edu.vn" }),
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("SUPER_ADMIN cũng phải được phân công mới submit được (không bypass ngầm)", () => {
    const result = checkRoundEligibility({
      round: makeRound(),
      assignment: null,
      classId: "10A1",
      grade: "10",
      now: OPEN_NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOT_ASSIGNED");
  });
});

describe("isClassInRoundScope / isClassInAssignmentScope", () => {
  it("round rỗng cả classIds và gradeIds -> áp dụng mọi lớp", () => {
    expect(isClassInRoundScope({ classIds: [], gradeIds: [] }, "10A1", "10")).toBe(true);
  });
  it("round giới hạn theo gradeIds khi classIds rỗng", () => {
    expect(isClassInRoundScope({ classIds: [], gradeIds: ["11"] }, "10A1", "10")).toBe(false);
    expect(isClassInRoundScope({ classIds: [], gradeIds: ["10"] }, "10A1", "10")).toBe(true);
  });
  it("assignment rỗng cả 2 field -> không thu hẹp thêm", () => {
    expect(
      isClassInAssignmentScope({ allowedClassIds: [], allowedGradeIds: [] }, "10A1", "10"),
    ).toBe(true);
  });
});
