import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getScores, getCriteria } from "@/lib/google/sheets";
import { getEffectiveScore, getEffectiveMaxScore, getEffectiveCriteriaResults } from "@/lib/scoring/effectiveScore";
import { toErrorResponse } from "@/lib/api/errors";
import { formatDateVN, formatDateTimeVN } from "@/lib/timezone/timezone";
import type { Grade, Session_ } from "@/types";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);

    const params = req.nextUrl.searchParams;
    const dateFrom = params.get("dateFrom") || params.get("date") || undefined;
    const dateTo = params.get("dateTo") || params.get("date") || undefined;
    const grade = (params.get("grade") as Grade | null) || undefined;
    const classId = params.get("classId") || undefined;
    const session = (params.get("session") as Session_ | null) || undefined;
    const judgeEmail = params.get("judgeEmail") || undefined;

    const [scores, criteria] = await Promise.all([
      getScores({ dateFrom, dateTo, grade, classId, session, judgeEmail }),
      getCriteria(),
    ]);

    // Đọc điểm qua getEffectiveScore/getEffectiveMaxScore/getEffectiveCriteriaResults
    // (không đọc thẳng totalCriteriaScore/c1..c11) — bắt buộc để CSV hiện đúng
    // số cho cả lượt chấm V1 (legacy) lẫn V2 (theo Đợt chấm, tiêu chí động),
    // tránh lặp lại lỗi từng khiến CSV hiện 0 điểm cho mọi lượt chấm V2.
    const header = [
      "Ngày",
      "Thời gian",
      "Buổi",
      "Khối",
      "Lớp",
      "Người chấm",
      "Điểm tiêu chí",
      "Điểm tối đa",
      "Chi tiết tiêu chí",
    ];

    const rows = scores.map((s) => {
      const results = getEffectiveCriteriaResults(s, criteria);
      const detail = results
        .map((r) => `${r.criterionName}: ${r.result === "PASS" ? "Đạt" : "Không đạt"}`)
        .join("; ");
      return [
        formatDateVN(s.date),
        formatDateTimeVN(s.timestamp),
        s.session === "MORNING" ? "Sáng" : "Chiều",
        s.grade,
        s.className,
        s.judgeName || s.judgeEmail,
        getEffectiveScore(s),
        getEffectiveMaxScore(s),
        detail,
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    // Thêm BOM để Excel mở tiếng Việt UTF-8 đúng.
    const body = "﻿" + csv;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ket-qua-lhvm-${dateFrom ?? "all"}.csv"`,
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
