/**
 * Xây nội dung email báo cáo — hàm THUẦN (không gọi Resend/Google Sheets),
 * nhận dữ liệu đã tính sẵn từ nơi gọi. Tách riêng để test được độc lập với
 * việc gửi email thật.
 */
import type { ClassRankingResult } from "@/lib/ranking/rankClasses";
import type { CriterionFailureStat } from "@/lib/admin/aggregate";
import type { AdjustmentRecord, ClassConfig, ScoreRecord } from "@/types";

/** Bản tóm tắt tiến độ 1 Đợt chấm dùng cho email — đã "làm phẳng" thành
 * chuỗi/số (statusLabel, notDoneClassNames) để templates.ts không cần biết
 * gì về EffectiveRoundStatus/ClassConfig, giữ hàm build email thuần. */
export interface DashboardRoundReportItem {
  title: string;
  statusLabel: string;
  doneCount: number;
  totalCount: number;
  notDoneClassNames: string[];
}

export interface EmailContent {
  subject: string;
  html: string;
}

const BRAND_HEADER = `
  <div style="background:#0f172a;padding:16px 20px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#fff;font-size:16px;font-weight:700;">Lớp học Văn minh</p>
    <p style="margin:2px 0 0;color:#94a3b8;font-size:12px;">Trường THPT FPT Đà Nẵng</p>
  </div>
`;

const FOOTER = `
  <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;">
    Email tự động từ hệ thống Lớp học Văn minh — vui lòng không trả lời email này.
  </p>
`;

function wrap(bodyHtml: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
      ${BRAND_HEADER}
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px;">
        ${bodyHtml}
        ${FOOTER}
      </div>
    </div>
  `;
}

function statRow(label: string, value: string, color = "#0f172a"): string {
  return `
    <tr>
      <td style="padding:6px 0;color:#64748b;font-size:13px;">${label}</td>
      <td style="padding:6px 0;text-align:right;font-weight:700;font-size:13px;color:${color};">${value}</td>
    </tr>
  `;
}

function sectionTitle(text: string): string {
  return `<p style="margin:20px 0 8px;font-size:14px;font-weight:700;color:#0f172a;">${text}</p>`;
}

// ---------- Báo cáo GVCN (1 lớp) ----------

export interface HomeroomReportInput {
  classInfo: ClassConfig;
  yearMonthLabel: string;
  todayLabel: string;
  todayTotal: number;
  todayMax: number;
  hasTodayScore: boolean;
  isUnconfirmed: boolean;
  ranking: ClassRankingResult | null;
  totalRankedInGrade: number;
  bonusTotal: number;
  penaltyTotal: number;
  adjustments: AdjustmentRecord[];
  failureStats: CriterionFailureStat[];
  recentScores: (ScoreRecord & { formattedDate: string })[];
}

export function buildHomeroomReportEmail(input: HomeroomReportInput): EmailContent {
  const {
    classInfo,
    yearMonthLabel,
    todayLabel,
    todayTotal,
    todayMax,
    hasTodayScore,
    isUnconfirmed,
    ranking,
    totalRankedInGrade,
    bonusTotal,
    penaltyTotal,
    adjustments,
    failureStats,
    recentScores,
  } = input;

  const rankingHtml = isUnconfirmed
    ? `<p style="margin:0;font-size:12px;color:#b45309;">Công thức điểm ngày chưa được BTC xác nhận — chưa có xếp hạng chính thức.</p>`
    : statRow("Xếp hạng tháng", ranking ? `${ranking.rank}/${totalRankedInGrade}` : "—");

  const adjustmentsHtml =
    adjustments.length === 0
      ? `<p style="margin:0;font-size:13px;color:#64748b;">Không có điểm cộng/trừ nào trong tháng.</p>`
      : adjustments
          .map(
            (a) => `
        <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
          <span style="font-weight:700;color:${a.type === "BONUS" ? "#16a34a" : "#dc2626"};">
            ${a.type === "BONUS" ? "+" : "-"}${a.points} điểm
          </span>
          <span style="color:#94a3b8;"> · ${a.date}</span>
          ${a.description ? `<div style="color:#64748b;margin-top:2px;">${escapeHtml(a.description)}</div>` : ""}
        </div>
      `,
          )
          .join("");

  const failureHtml =
    failureStats.length === 0
      ? ""
      : `
        ${sectionTitle("Tiêu chí thường không đạt (tháng này)")}
        ${failureStats
          .slice(0, 5)
          .map(
            (s) => `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
            <span>${escapeHtml(s.criterionName)}</span>
            <span style="color:#b45309;font-weight:700;">${s.failCount} lần</span>
          </div>
        `,
          )
          .join("")}
      `;

  const historyHtml = recentScores
    .slice(0, 10)
    .map((s) => {
      const total = s.totalScore ?? s.totalCriteriaScore;
      const max = s.maxPossibleScore ?? 11;
      return `
        <div style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;">
          <div style="display:flex;justify-content:space-between;">
            <span>${s.formattedDate}</span>
            <strong>${total}/${max}</strong>
          </div>
          ${
            s.generalNote
              ? `<div style="margin-top:2px;color:#2563eb;">Nhận xét: ${escapeHtml(s.generalNote)}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  const body = `
    <p style="margin:0 0 4px;font-size:18px;font-weight:700;">Lớp ${escapeHtml(classInfo.className)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Báo cáo tháng ${yearMonthLabel} — gửi ${todayLabel}</p>

    <table style="width:100%;border-collapse:collapse;">
      ${statRow(`Điểm hôm nay (${todayLabel})`, hasTodayScore ? `${todayTotal}/${todayMax}` : "Chưa có")}
      ${isUnconfirmed ? "" : rankingHtml}
      ${statRow("Điểm cộng tháng", `+${bonusTotal}`, "#16a34a")}
      ${statRow("Điểm trừ tháng", `-${penaltyTotal}`, "#dc2626")}
    </table>
    ${isUnconfirmed ? `<div style="margin-top:8px;">${rankingHtml}</div>` : ""}

    ${failureHtml}

    ${sectionTitle("Điểm cộng/trừ chi tiết (tháng này)")}
    ${adjustmentsHtml}

    ${sectionTitle("Lịch sử chấm điểm gần đây")}
    ${historyHtml || `<p style="margin:0;font-size:13px;color:#64748b;">Chưa có dữ liệu chấm điểm trong tháng.</p>`}
  `;

  return {
    subject: `[Lớp học Văn minh] Báo cáo lớp ${classInfo.className} — ${todayLabel}`,
    html: wrap(body),
  };
}

// ---------- Báo cáo tổng hợp Admin ----------

export interface AdminSummaryReportInput {
  dateLabel: string;
  totalSubmissions: number;
  classesScoredCount: number;
  classesNotScoredCount: number;
  averageScore: number | null;
  bonusTotal: number;
  penaltyTotal: number;
  rounds: DashboardRoundReportItem[];
}

export function buildAdminSummaryReportEmail(input: AdminSummaryReportInput): EmailContent {
  const {
    dateLabel,
    totalSubmissions,
    classesScoredCount,
    classesNotScoredCount,
    averageScore,
    bonusTotal,
    penaltyTotal,
    rounds,
  } = input;

  const roundsHtml =
    rounds.length === 0
      ? `<p style="margin:0;font-size:13px;color:#64748b;">Không có đợt chấm nào đang diễn ra hoặc sắp tới.</p>`
      : rounds
          .map((r) => {
            const notDoneList = r.notDoneClassNames.slice(0, 10).join(", ");
            const extra = r.notDoneClassNames.length > 10 ? ` +${r.notDoneClassNames.length - 10} khác` : "";
            return `
        <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;justify-content:space-between;font-size:14px;">
            <strong>${escapeHtml(r.title)}</strong>
            <span style="color:#64748b;font-size:12px;">${r.statusLabel}</span>
          </div>
          <p style="margin:4px 0;font-size:13px;color:#0f172a;">${r.doneCount}/${r.totalCount} lớp đã chấm</p>
          ${
            notDoneList
              ? `<p style="margin:0;font-size:12px;color:#b45309;">Chưa chấm: ${escapeHtml(notDoneList)}${extra}</p>`
              : ""
          }
        </div>
      `;
          })
          .join("");

  const body = `
    <p style="margin:0 0 4px;font-size:18px;font-weight:700;">Báo cáo tổng hợp toàn trường</p>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Ngày ${dateLabel}</p>

    <table style="width:100%;border-collapse:collapse;">
      ${statRow("Tổng lượt chấm", String(totalSubmissions))}
      ${statRow("Lớp đã chấm", String(classesScoredCount), "#16a34a")}
      ${statRow("Lớp chưa chấm", String(classesNotScoredCount), "#b45309")}
      ${statRow("Điểm TB", averageScore !== null ? averageScore.toFixed(1) : "—")}
      ${statRow("Điểm cộng", String(bonusTotal), "#16a34a")}
      ${statRow("Điểm trừ", String(penaltyTotal), "#dc2626")}
    </table>

    ${sectionTitle("Đợt chấm đang diễn ra / sắp tới")}
    ${roundsHtml}
  `;

  return {
    subject: `[Lớp học Văn minh] Báo cáo tổng hợp toàn trường — ${dateLabel}`,
    html: wrap(body),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
