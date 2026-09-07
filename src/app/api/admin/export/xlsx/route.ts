import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { canExport } from "@/lib/auth/permissions";
import {
  getScores,
  getAdjustments,
  getCriteria,
  getClasses,
  getSettings,
  appendAuditLog,
} from "@/lib/google/sheets";
import { getEffectiveScore, getEffectiveMaxScore } from "@/lib/scoring/effectiveScore";
import { computeMonthlyRankingForGrade } from "@/lib/admin/aggregate";
import { formatDateVN, formatDateTimeVN, getMonthDateRange } from "@/lib/timezone/timezone";
import { toErrorResponse } from "@/lib/api/errors";
import { CRITERION_KEYS, type CriterionKey, type CriterionSnapshotItem, type Grade, type Session_ } from "@/types";

const SESSION_LABEL: Record<Session_, string> = { MORNING: "Sáng", AFTERNOON: "Chiều" };

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canExport(user)) {
      return NextResponse.json({ error: "Bạn không có quyền xuất dữ liệu." }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const dateFrom = params.get("dateFrom") || params.get("date") || undefined;
    const dateTo = params.get("dateTo") || params.get("date") || undefined;
    const grade = (params.get("grade") as Grade | null) || undefined;
    const classId = params.get("classId") || undefined;
    const session = (params.get("session") as Session_ | null) || undefined;
    const judgeEmail = params.get("judgeEmail") || undefined;
    const roundId = params.get("roundId") || undefined;
    const yearMonth = params.get("yearMonth") || undefined;
    const includeRanking = params.get("includeRanking") === "1";

    const [scores, adjustments, criteria] = await Promise.all([
      getScores({ dateFrom, dateTo, grade, classId, session, judgeEmail, roundId }),
      getAdjustments({ dateFrom, dateTo, classId }),
      getCriteria(),
    ]);

    const sortedScores = [...scores].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Lớp học Văn minh";
    workbook.created = new Date();

    // ---------- Sheet 1: Tổng hợp ----------
    const summarySheet = workbook.addWorksheet("Tổng hợp");
    summarySheet.columns = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Khối", key: "grade", width: 8 },
      { header: "Lớp", key: "className", width: 12 },
      { header: "Giám khảo", key: "judge", width: 24 },
      { header: "Thời gian chấm", key: "time", width: 20 },
      { header: "Tổng điểm", key: "total", width: 12 },
      { header: "Điểm tối đa", key: "max", width: 12 },
      { header: "Tỷ lệ %", key: "pct", width: 10 },
      { header: "Trạng thái", key: "status", width: 14 },
    ];
    sortedScores.forEach((s, i) => {
      const total = getEffectiveScore(s);
      const max = getEffectiveMaxScore(s);
      summarySheet.addRow({
        stt: i + 1,
        grade: s.grade,
        className: s.className,
        judge: s.judgeName || s.judgeEmail,
        time: formatDateTimeVN(s.timestamp),
        total,
        max,
        pct: max > 0 ? Math.round((total / max) * 1000) / 10 : 0,
        status: "Đã chấm",
      });
    });
    summarySheet.getRow(1).font = { bold: true };

    // ---------- Sheet 2: Chi tiết tiêu chí ----------
    const detailSheet = workbook.addWorksheet("Chi tiết tiêu chí");
    detailSheet.columns = [
      { header: "Đợt chấm", key: "round", width: 14 },
      { header: "Ngày", key: "date", width: 12 },
      { header: "Buổi", key: "session", width: 8 },
      { header: "Lớp", key: "className", width: 12 },
      { header: "Giám khảo", key: "judge", width: 24 },
      { header: "Tiêu chí", key: "criterion", width: 45 },
      { header: "Điểm tối đa", key: "max", width: 12 },
      { header: "Kết quả", key: "result", width: 12 },
      { header: "Điểm đạt", key: "awarded", width: 10 },
      { header: "Ghi chú", key: "note", width: 30 },
    ];
    for (const s of sortedScores) {
      const rows: { name: string; max: number; result: "PASS" | "FAIL"; awarded: number; note: string }[] = [];
      if (s.roundId) {
        let snapshot: CriterionSnapshotItem[] = [];
        try {
          snapshot = JSON.parse(s.criteriaSnapshotJson || "[]");
        } catch {
          snapshot = [];
        }
        for (const item of snapshot) {
          rows.push({
            name: item.name,
            max: item.maxScore,
            result: item.result,
            awarded: item.awardedScore,
            note: item.note ?? "",
          });
        }
      } else {
        for (const key of CRITERION_KEYS) {
          const num = Number(key.replace("c", ""));
          const c = criteria.find((cc) => cc.criterionNumber === num);
          const val = s[key as CriterionKey];
          rows.push({
            name: c?.criterionName ?? `Tiêu chí ${num}`,
            max: 1,
            result: val === 1 ? "PASS" : "FAIL",
            awarded: val === 1 ? 1 : 0,
            note: "",
          });
        }
      }
      for (const r of rows) {
        detailSheet.addRow({
          round: s.roundId || "(legacy)",
          date: formatDateVN(s.date),
          session: SESSION_LABEL[s.session],
          className: s.className,
          judge: s.judgeName || s.judgeEmail,
          criterion: r.name,
          max: r.max,
          result: r.result === "PASS" ? "Đạt" : "Không đạt",
          awarded: r.awarded,
          note: r.note,
        });
      }
    }
    detailSheet.getRow(1).font = { bold: true };

    // ---------- Sheet 3: Thưởng / Trừ ----------
    if (adjustments.length > 0) {
      const adjSheet = workbook.addWorksheet("Thưởng - Trừ");
      adjSheet.columns = [
        { header: "Thời gian", key: "time", width: 20 },
        { header: "Lớp", key: "className", width: 12 },
        { header: "Loại", key: "type", width: 10 },
        { header: "Điểm", key: "points", width: 8 },
        { header: "Học sinh", key: "student", width: 20 },
        { header: "Nội dung", key: "description", width: 40 },
        { header: "Địa điểm", key: "location", width: 16 },
        { header: "Người ghi nhận", key: "recordedBy", width: 24 },
      ];
      for (const a of adjustments) {
        adjSheet.addRow({
          time: formatDateTimeVN(a.timestamp),
          className: a.className,
          type: a.type === "BONUS" ? "Điểm cộng" : "Điểm trừ",
          points: a.type === "BONUS" ? a.points : -a.points,
          student: [a.studentName, a.studentCode].filter(Boolean).join(" - "),
          description: a.description,
          location: a.location,
          recordedBy: a.recordedByName || a.recordedByEmail,
        });
      }
      adjSheet.getRow(1).font = { bold: true };
    }

    // ---------- Sheet 4: Xếp hạng ----------
    if (includeRanking && yearMonth) {
      const [classes, settings] = await Promise.all([getClasses({ activeOnly: true }), getSettings()]);
      const { from, to } = getMonthDateRange(yearMonth);
      const [rankScores, rankAdjustments] = await Promise.all([
        getScores({ dateFrom: from, dateTo: to }),
        getAdjustments({ dateFrom: from, dateTo: to }),
      ]);

      const rankSheet = workbook.addWorksheet("Xếp hạng");
      rankSheet.columns = [
        { header: "Khối", key: "grade", width: 8 },
        { header: "Hạng", key: "rank", width: 8 },
        { header: "Lớp", key: "className", width: 12 },
        { header: "Điểm TB", key: "avg", width: 10 },
        { header: "Số ngày chấm", key: "days", width: 12 },
        { header: "Điểm cộng", key: "bonus", width: 10 },
        { header: "Điểm trừ", key: "penalty", width: 10 },
        { header: "Số lần đạt điểm tối đa", key: "maxDays", width: 18 },
      ];
      (["10", "11", "12"] as Grade[]).forEach((g) => {
        const ranking = computeMonthlyRankingForGrade({
          classes: classes.filter((c) => c.grade === g),
          scoresOfMonth: rankScores,
          adjustmentsOfMonth: rankAdjustments,
          combineMode: settings.DAILY_SCORE_COMBINE_MODE,
          yearMonth,
        });
        for (const r of ranking) {
          rankSheet.addRow({
            grade: g,
            rank: r.rank,
            className: r.className,
            avg: r.averageScore !== null ? Math.round(r.averageScore * 100) / 100 : "",
            days: r.daysGraded,
            bonus: r.bonusPointsTotal,
            penalty: r.penaltyTotal,
            maxDays: r.maxScoreDaysCount,
          });
        }
      });
      rankSheet.getRow(1).font = { bold: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "EXPORT_EXCEL",
      entityType: "Export",
      entityId: roundId || `${dateFrom ?? ""}_${dateTo ?? ""}`,
      details: { dateFrom, dateTo, grade, classId, session, judgeEmail, roundId },
    });

    const fileName = `LHVM_${dateFrom ?? "all"}${dateTo && dateTo !== dateFrom ? `_${dateTo}` : ""}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
