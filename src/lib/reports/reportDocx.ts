import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import type { AdminSummaryReportInput, HomeroomReportInput } from "@/lib/email/templates";

const MUTED = "64748B";
const SUCCESS = "16A34A";
const DANGER = "DC2626";
const WARNING = "B45309";

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
};

function statsTable(rows: [string, string, string?][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value, color]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: CELL_BORDER,
              width: { size: 60, type: WidthType.PERCENTAGE },
              children: [new Paragraph({ children: [new TextRun({ text: label, color: MUTED })] })],
            }),
            new TableCell({
              borders: CELL_BORDER,
              width: { size: 40, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: "right",
                  children: [new TextRun({ text: value, bold: true, color: color ?? "0F172A" })],
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

function heading(text: string, options?: { pageBreakBefore?: boolean }): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    pageBreakBefore: options?.pageBreakBefore,
    children: [new TextRun({ text })],
  });
}

/** Báo cáo tổng hợp toàn trường (thẻ "Gửi báo cáo tới BGH") dạng Word — cùng
 * nội dung với `buildAdminSummaryReportEmail` (`src/lib/email/templates.ts`). */
export function buildAdminSummaryDocx(data: AdminSummaryReportInput): Document {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Báo cáo tổng hợp toàn trường" })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: `Ngày ${data.dateLabel}`, color: MUTED, italics: true })],
    }),
    statsTable([
      ["Tổng lượt chấm", String(data.totalSubmissions)],
      ["Lớp đã chấm", String(data.classesScoredCount), SUCCESS],
      ["Lớp chưa chấm", String(data.classesNotScoredCount), WARNING],
      ["Điểm TB", data.averageScore !== null ? data.averageScore.toFixed(1) : "—"],
      ["Điểm cộng", String(data.bonusTotal), SUCCESS],
      ["Điểm trừ", String(data.penaltyTotal), DANGER],
    ]),
    heading("Đợt chấm đang diễn ra / sắp tới"),
  ];

  if (data.rounds.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "Không có đợt chấm nào đang diễn ra hoặc sắp tới.", color: MUTED })] }));
  } else {
    for (const r of data.rounds) {
      children.push(
        new Paragraph({
          spacing: { before: 160 },
          children: [new TextRun({ text: r.title, bold: true }), new TextRun({ text: `  (${r.statusLabel})`, color: MUTED })],
        }),
        new Paragraph({ children: [new TextRun({ text: `${r.doneCount}/${r.totalCount} lớp đã chấm` })] }),
      );
      if (r.notDoneClassNames.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Chưa chấm: ${r.notDoneClassNames.join(", ")}`, color: WARNING })],
          }),
        );
      }
    }
  }

  return new Document({ sections: [{ children }] });
}

/** Báo cáo GVCN dạng Word — cùng nội dung với `buildHomeroomReportEmail`.
 * `items` có thể là 1 hoặc nhiều lớp; các lớp sau ngắt trang trước tiêu đề. */
export function buildHomeroomReportDocx(items: HomeroomReportInput[]): Document {
  const children: (Paragraph | Table)[] = [];

  items.forEach((item, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: index > 0,
        children: [new TextRun({ text: `Lớp ${item.classInfo.className}` })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `Báo cáo tháng ${item.yearMonthLabel} — gửi ${item.todayLabel}`, color: MUTED, italics: true }),
        ],
      }),
      statsTable([
        ["Điểm hôm nay", item.hasTodayScore ? `${item.todayTotal}/${item.todayMax}` : "Chưa có"],
        [
          "Xếp hạng tháng",
          item.isUnconfirmed ? "Chưa xác nhận công thức" : item.ranking ? `${item.ranking.rank}/${item.totalRankedInGrade}` : "—",
        ],
        ["Điểm cộng tháng", `+${item.bonusTotal}`, SUCCESS],
        ["Điểm trừ tháng", `-${item.penaltyTotal}`, DANGER],
      ]),
    );

    if (item.failureStats.length > 0) {
      children.push(heading("Tiêu chí thường không đạt (tháng này)"));
      for (const s of item.failureStats.slice(0, 5)) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `${s.criterionName}  —  ${s.failCount} lần`, color: WARNING })],
          }),
        );
      }
    }

    children.push(heading("Điểm cộng/trừ chi tiết (tháng này)"));
    if (item.adjustments.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: "Không có điểm cộng/trừ nào trong tháng.", color: MUTED })] }));
    } else {
      for (const a of item.adjustments) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: a.type === "BONUS" ? `+${a.points} điểm` : `-${a.points} điểm`, bold: true, color: a.type === "BONUS" ? SUCCESS : DANGER }),
              new TextRun({ text: `  ·  ${a.date}${a.description ? `  —  ${a.description}` : ""}` }),
            ],
          }),
        );
      }
    }

    children.push(heading("Lịch sử chấm điểm gần đây"));
    if (item.recentScores.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: "Chưa có dữ liệu chấm điểm trong tháng.", color: MUTED })] }));
    } else {
      for (const s of item.recentScores.slice(0, 10)) {
        const total = s.totalScore ?? s.totalCriteriaScore;
        const max = s.maxPossibleScore ?? 11;
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${s.formattedDate}  —  ${total}/${max}` }),
              ...(s.generalNote ? [new TextRun({ text: `  (Nhận xét: ${s.generalNote})`, color: "2563EB" })] : []),
            ],
          }),
        );
      }
    }
  });

  return new Document({ sections: [{ children }] });
}
