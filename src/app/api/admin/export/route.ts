import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getScores } from "@/lib/google/sheets";
import { toErrorResponse } from "@/lib/api/errors";
import { formatDateVN, formatDateTimeVN } from "@/lib/timezone/timezone";
import { CRITERION_KEYS } from "@/types";
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

    const scores = await getScores({ dateFrom, dateTo, grade, classId, session, judgeEmail });

    const header = [
      "Ngày",
      "Thời gian",
      "Buổi",
      "Khối",
      "Lớp",
      "Người chấm",
      ...CRITERION_KEYS.map((_, i) => `Tiêu chí ${i + 1}`),
      "Tổng điểm",
    ];

    const rows = scores.map((s) => [
      formatDateVN(s.date),
      formatDateTimeVN(s.timestamp),
      s.session === "MORNING" ? "Sáng" : "Chiều",
      s.grade,
      s.className,
      s.judgeName || s.judgeEmail,
      ...CRITERION_KEYS.map((k) => s[k]),
      s.totalCriteriaScore,
    ]);

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
