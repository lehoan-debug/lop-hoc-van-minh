import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { canManageRounds } from "@/lib/auth/permissions";
import { toErrorResponse } from "@/lib/api/errors";

/** File Excel mẫu cho tính năng "Nhập phân công từ Excel" — 2 cột đúng thứ
 * tự route import (import-assignments) đang đọc: A = Người chấm, B = Tên lớp. */
export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) {
      return NextResponse.json({ error: "Bạn không có quyền phân công người chấm." }, { status: 403 });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Phân công");
    sheet.columns = [
      { header: "Người chấm (email hoặc tên)", key: "person", width: 32 },
      { header: "Tên lớp", key: "class", width: 16 },
    ];
    sheet.addRow({ person: "judge1@fpt.edu.vn", class: "10A1" });
    sheet.addRow({ person: "judge1@fpt.edu.vn", class: "10A2" });
    sheet.addRow({ person: "judge2@fpt.edu.vn", class: "10A3" });
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="mau-phan-cong.xlsx"',
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
