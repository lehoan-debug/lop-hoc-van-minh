import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { canExport } from "@/lib/auth/permissions";
import { appendAuditLog } from "@/lib/google/sheets";
import { todayVN } from "@/lib/timezone/timezone";
import { computeAdminSummaryReportData } from "@/lib/reports/reportData";
import { buildAdminSummaryXlsx } from "@/lib/reports/reportXlsx";
import { toErrorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canExport(user)) {
      return NextResponse.json({ error: "Bạn không có quyền xuất dữ liệu." }, { status: 403 });
    }

    const date = todayVN();
    const data = await computeAdminSummaryReportData(date);
    const workbook = buildAdminSummaryXlsx(data);
    const buffer = await workbook.xlsx.writeBuffer();

    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "EXPORT_EXCEL",
      entityType: "Export",
      entityId: `report-summary-${date}`,
      details: { type: "admin_summary_xlsx" },
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="BaoCao_TongHop_${date}.xlsx"`,
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
