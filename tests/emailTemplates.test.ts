import { describe, it, expect } from "vitest";
import { buildHomeroomReportEmail, buildAdminSummaryReportEmail } from "@/lib/email/templates";
import type { ClassConfig, ScoreRecord } from "@/types";

function klass(overrides: Partial<ClassConfig> = {}): ClassConfig {
  return { classId: "10A1", className: "10A1", grade: "10", active: true, sortOrder: 1, ...overrides };
}

function score(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    submissionId: "s1",
    timestamp: "",
    date: "2026-09-08",
    session: "MORNING",
    grade: "10",
    classId: "10A1",
    className: "10A1",
    judgeEmail: "j@fpt.edu.vn",
    judgeName: "GK",
    c1: 1,
    c2: 1,
    c3: 1,
    c4: 1,
    c5: 1,
    c6: 1,
    c7: 1,
    c8: 1,
    c9: 1,
    c10: 1,
    c11: 1,
    totalCriteriaScore: 11,
    notesJson: "[]",
    deletedAt: "",
    createdAt: "",
    updatedAt: "",
    roundId: "round-1",
    criteriaSnapshotJson: "[]",
    answersJson: "{}",
    totalScore: 9,
    maxPossibleScore: 11,
    generalNote: "Lớp có tinh thần tốt.",
    ...overrides,
  };
}

describe("buildHomeroomReportEmail", () => {
  it("chứa đúng tên lớp, điểm hôm nay và nhận xét chung trong nội dung", () => {
    const email = buildHomeroomReportEmail({
      classInfo: klass(),
      yearMonthLabel: "2026-09",
      todayLabel: "08/09/2026",
      todayTotal: 9,
      todayMax: 11,
      hasTodayScore: true,
      isUnconfirmed: false,
      ranking: {
        rank: 2,
        classId: "10A1",
        className: "10A1",
        grade: "10",
        averageScore: 9,
        daysGraded: 5,
        bonusPointsTotal: 2,
        bonusCount: 1,
        penaltyTotal: 1,
        maxScoreDaysCount: 1,
        needsManualReview: false,
      },
      totalRankedInGrade: 15,
      bonusTotal: 2,
      penaltyTotal: 1,
      adjustments: [],
      failureStats: [],
      recentScores: [{ ...score(), formattedDate: "08/09/2026" }],
    });

    expect(email.subject).toContain("10A1");
    expect(email.html).toContain("10A1");
    expect(email.html).toContain("9/11");
    expect(email.html).toContain("2/15");
    expect(email.html).toContain("Lớp có tinh thần tốt.");
  });

  it("khi UNCONFIRMED -> không hiện số xếp hạng, có cảnh báo chưa xác nhận", () => {
    const email = buildHomeroomReportEmail({
      classInfo: klass(),
      yearMonthLabel: "2026-09",
      todayLabel: "08/09/2026",
      todayTotal: 0,
      todayMax: 0,
      hasTodayScore: false,
      isUnconfirmed: true,
      ranking: null,
      totalRankedInGrade: 0,
      bonusTotal: 0,
      penaltyTotal: 0,
      adjustments: [],
      failureStats: [],
      recentScores: [],
    });

    expect(email.html).toContain("chưa được BTC xác nhận");
    expect(email.html).not.toContain("Xếp hạng tháng");
  });

  it("escape HTML trong nhận xét chung để tránh chèn thẻ lạ vào email", () => {
    const email = buildHomeroomReportEmail({
      classInfo: klass(),
      yearMonthLabel: "2026-09",
      todayLabel: "08/09/2026",
      todayTotal: 0,
      todayMax: 0,
      hasTodayScore: false,
      isUnconfirmed: false,
      ranking: null,
      totalRankedInGrade: 0,
      bonusTotal: 0,
      penaltyTotal: 0,
      adjustments: [],
      failureStats: [],
      recentScores: [
        { ...score({ generalNote: '<script>alert(1)</script>' }), formattedDate: "08/09/2026" },
      ],
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("buildAdminSummaryReportEmail", () => {
  it("chứa đúng số liệu tổng quan và danh sách lớp chưa chấm", () => {
    const email = buildAdminSummaryReportEmail({
      dateLabel: "08/09/2026",
      totalSubmissions: 20,
      classesScoredCount: 18,
      classesNotScoredCount: 2,
      averageScore: 9.4,
      bonusTotal: 5,
      penaltyTotal: 3,
      rounds: [
        {
          title: "Đợt chấm sáng",
          statusLabel: "Đang mở",
          doneCount: 18,
          totalCount: 20,
          notDoneClassNames: ["10A5", "11A2"],
        },
      ],
    });

    expect(email.html).toContain("18/20");
    expect(email.html).toContain("10A5");
    expect(email.html).toContain("11A2");
    expect(email.html).toContain("9.4");
  });

  it("không có đợt chấm nào -> hiện thông báo rỗng", () => {
    const email = buildAdminSummaryReportEmail({
      dateLabel: "08/09/2026",
      totalSubmissions: 0,
      classesScoredCount: 0,
      classesNotScoredCount: 0,
      averageScore: null,
      bonusTotal: 0,
      penaltyTotal: 0,
      rounds: [],
    });

    expect(email.html).toContain("Không có đợt chấm nào");
  });
});
