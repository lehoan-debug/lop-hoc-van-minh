import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { requireRole } from "@/lib/auth/session";
import { canExport } from "@/lib/auth/permissions";
import { getClasses, appendAuditLog } from "@/lib/google/sheets";
import { currentYearMonthVN } from "@/lib/timezone/timezone";
import { computeHomeroomReportData } from "@/lib/reports/reportData";
import { buildHomeroomReportDocx } from "@/lib/reports/reportDocx";
import { toErrorResponse, BusinessError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canExport(user)) {
      return NextResponse.json({ error: "Bạn không có quyền xuất dữ liệu." }, { status: 403 });
    }

    const classIds = (req.nextUrl.searchParams.get("classIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (classIds.length === 0) {
      throw new BusinessError("Vui lòng chọn ít nhất 1 lớp.");
    }
    if (classIds.length > 50) {
      throw new BusinessError("Chỉ tải được tối đa 50 lớp trong 1 lần.");
    }

    const allClasses = await getClasses({ activeOnly: true });
    const items = (await Promise.all(classIds.map((id) => computeHomeroomReportData(id, allClasses)))).filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );
    if (items.length === 0) {
      throw new BusinessError("Không tìm thấy lớp nào phù hợp.");
    }

    const doc = buildHomeroomReportDocx(items);
    const buffer = await Packer.toBuffer(doc);

    const yearMonth = currentYearMonthVN();
    await appendAuditLog({
      userEmail: user.email,
      userName: user.name,
      action: "EXPORT_EXCEL",
      entityType: "Export",
      entityId: `report-homeroom-${yearMonth}`,
      details: { type: "homeroom_docx", classIds: items.map((i) => i.classInfo.classId) },
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="BaoCao_Lop_${yearMonth}.docx"`,
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
