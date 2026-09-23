import ExcelJS from "exceljs";
import type { AdminSummaryReportInput, HomeroomReportInput } from "@/lib/email/templates";

/** Tên sheet Excel: ≤31 ký tự, không chứa `\ / * ? [ ] :` (giới hạn của
 * Excel) — cắt bớt nếu tên lớp quá dài thay vì để ExcelJS ném lỗi. */
function sheetSafeName(name: string): string {
  const cleaned = name.replace(/[\\/*?[\]:]/g, " ").trim();
  return (cleaned || "Lop").slice(0, 31);
}

/** Báo cáo tổng hợp toàn trường (thẻ "Gửi báo cáo tới BGH") dạng Excel —
 * cùng số liệu với `buildAdminSummaryReportEmail` (`src/lib/email/templates.ts`). */
export function buildAdminSummaryXlsx(data: AdminSummaryReportInput): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lớp học Văn minh";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Báo cáo tổng hợp");
  sheet.columns = [
    { header: "Chỉ số", key: "label", width: 28 },
    { header: "Giá trị", key: "value", width: 20 },
  ];
  sheet.addRow({ label: `Báo cáo tổng hợp toàn trường — ${data.dateLabel}`, value: "" });
  sheet.mergeCells(1, 1, 1, 2);
  sheet.getRow(1).font = { bold: true, size: 13 };
  sheet.addRow({ label: "Tổng lượt chấm", value: data.totalSubmissions });
  sheet.addRow({ label: "Lớp đã chấm", value: data.classesScoredCount });
  sheet.addRow({ label: "Lớp chưa chấm", value: data.classesNotScoredCount });
  sheet.addRow({ label: "Điểm TB", value: data.averageScore !== null ? Math.round(data.averageScore * 10) / 10 : "—" });
  sheet.addRow({ label: "Điểm cộng", value: data.bonusTotal });
  sheet.addRow({ label: "Điểm trừ", value: data.penaltyTotal });

  sheet.addRow({});
  const roundsHeaderRow = sheet.addRow({ label: "Đợt chấm đang diễn ra / sắp tới", value: "" });
  sheet.mergeCells(roundsHeaderRow.number, 1, roundsHeaderRow.number, 2);
  roundsHeaderRow.font = { bold: true };

  const roundsTableHeaderRow = sheet.addRow(["Đợt chấm", "Trạng thái", "Đã chấm/Tổng", "Lớp chưa chấm"]);
  roundsTableHeaderRow.font = { bold: true };
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 50;

  if (data.rounds.length === 0) {
    sheet.addRow(["Không có đợt chấm nào đang diễn ra hoặc sắp tới.", "", "", ""]);
  } else {
    for (const r of data.rounds) {
      sheet.addRow([r.title, r.statusLabel, `${r.doneCount}/${r.totalCount}`, r.notDoneClassNames.join(", ")]);
    }
  }

  return workbook;
}

/** Báo cáo GVCN dạng Excel — 1 sheet/lớp, cùng số liệu với
 * `buildHomeroomReportEmail`. `items` có thể là 1 hoặc nhiều lớp (Admin chọn
 * hàng loạt GVCN ở "Trung tâm báo cáo"). */
export function buildHomeroomReportXlsx(items: HomeroomReportInput[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lớp học Văn minh";
  workbook.created = new Date();

  const usedNames = new Set<string>();
  for (const item of items) {
    let name = sheetSafeName(item.classInfo.className);
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${sheetSafeName(item.classInfo.className).slice(0, 28)}(${suffix})`;
      suffix++;
    }
    usedNames.add(name);

    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: "", key: "a", width: 24 },
      { header: "", key: "b", width: 45 },
    ];

    sheet.addRow([`Lớp ${item.classInfo.className}`, ""]);
    sheet.mergeCells(1, 1, 1, 2);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.addRow([`Báo cáo tháng ${item.yearMonthLabel} — gửi ${item.todayLabel}`, ""]);
    sheet.mergeCells(2, 1, 2, 2);
    sheet.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };

    sheet.addRow(["Điểm hôm nay", item.hasTodayScore ? `${item.todayTotal}/${item.todayMax}` : "Chưa có"]);
    sheet.addRow([
      "Xếp hạng tháng",
      item.isUnconfirmed ? "Chưa xác nhận công thức" : item.ranking ? `${item.ranking.rank}/${item.totalRankedInGrade}` : "—",
    ]);
    sheet.addRow(["Điểm cộng tháng", item.bonusTotal]);
    sheet.addRow(["Điểm trừ tháng", item.penaltyTotal]);

    if (item.failureStats.length > 0) {
      sheet.addRow([]);
      const h = sheet.addRow(["Tiêu chí thường không đạt (tháng này)", ""]);
      h.font = { bold: true };
      for (const s of item.failureStats.slice(0, 5)) {
        sheet.addRow([s.criterionName, `${s.failCount} lần`]);
      }
    }

    sheet.addRow([]);
    const adjHeader = sheet.addRow(["Điểm cộng/trừ chi tiết (tháng này)", ""]);
    adjHeader.font = { bold: true };
    if (item.adjustments.length === 0) {
      sheet.addRow(["Không có điểm cộng/trừ nào trong tháng.", ""]);
    } else {
      const adjCols = sheet.addRow(["Ngày", "Điểm", "Nội dung"]);
      adjCols.font = { bold: true };
      for (const a of item.adjustments) {
        sheet.addRow([a.date, a.type === "BONUS" ? `+${a.points}` : `-${a.points}`, a.description]);
      }
    }

    sheet.addRow([]);
    const historyHeader = sheet.addRow(["Lịch sử chấm điểm gần đây", ""]);
    historyHeader.font = { bold: true };
    if (item.recentScores.length === 0) {
      sheet.addRow(["Chưa có dữ liệu chấm điểm trong tháng.", ""]);
    } else {
      const histCols = sheet.addRow(["Ngày", "Điểm/Tối đa", "Nhận xét"]);
      histCols.font = { bold: true };
      for (const s of item.recentScores.slice(0, 10)) {
        const total = s.totalScore ?? s.totalCriteriaScore;
        const max = s.maxPossibleScore ?? 11;
        sheet.addRow([s.formattedDate, `${total}/${max}`, s.generalNote ?? ""]);
      }
    }
  }

  return workbook;
}
