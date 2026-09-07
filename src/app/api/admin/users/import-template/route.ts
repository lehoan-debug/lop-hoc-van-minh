import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/permissions";
import { getClasses } from "@/lib/google/sheets";
import { toErrorResponse } from "@/lib/api/errors";

/**
 * File Excel mẫu cho tính năng "Nhập tài khoản từ Excel" — 4 cột đúng thứ tự
 * route import (/api/admin/users/import) đang đọc: A = Email, B = Họ tên,
 * C = Vai trò, D = Lớp chủ nhiệm (chỉ cần khi có vai trò GVCN).
 */
export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageUsers(user)) {
      return NextResponse.json({ error: "Bạn không có quyền quản lý tài khoản." }, { status: 403 });
    }

    const classes = await getClasses({ activeOnly: true });

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Tài khoản");
    sheet.columns = [
      { header: "Email", key: "email", width: 32 },
      { header: "Họ tên", key: "name", width: 24 },
      { header: "Vai trò", key: "roles", width: 28 },
      { header: "Lớp chủ nhiệm (nếu có GVCN)", key: "homeroom", width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({ email: "judge1@fpt.edu.vn", name: "Nguyễn Văn A", roles: "JUDGE", homeroom: "" });
    sheet.addRow({
      email: "gvcn1@fpt.edu.vn",
      name: "Trần Thị B",
      roles: "JUDGE, HOMEROOM_TEACHER",
      homeroom: classes[0]?.className ?? "10A1",
    });

    const refSheet = workbook.addWorksheet("Hướng dẫn");
    refSheet.columns = [
      { header: "Vai trò hợp lệ (cột Vai trò)", key: "a", width: 34 },
      { header: "", key: "b", width: 34 },
    ];
    refSheet.getRow(1).font = { bold: true };
    refSheet.addRow({ a: "JUDGE hoặc Giám khảo", b: "" });
    refSheet.addRow({ a: "HOMEROOM_TEACHER hoặc GVCN", b: "" });
    refSheet.addRow({ a: "ADMIN hoặc Quản trị viên", b: "Chỉ Quản trị viên cấp cao mới cấp được" });
    refSheet.addRow({ a: "SUPER_ADMIN hoặc Quản trị viên cấp cao", b: "Chỉ Quản trị viên cấp cao mới cấp được" });
    refSheet.addRow({ a: "", b: "" });
    refSheet.addRow({ a: "Nhiều vai trò cách nhau bởi dấu phẩy, ví dụ: JUDGE, HOMEROOM_TEACHER", b: "" });
    refSheet.addRow({ a: "Tài khoản đã tồn tại: vai trò/lớp chủ nhiệm mới sẽ CỘNG THÊM, không xoá vai trò cũ", b: "" });

    const classSheet = workbook.addWorksheet("Danh sách lớp");
    classSheet.columns = [{ header: "Tên lớp", key: "name", width: 16 }];
    classSheet.getRow(1).font = { bold: true };
    for (const c of classes.sort((a, b) => (a.grade === b.grade ? a.sortOrder - b.sortOrder : a.grade.localeCompare(b.grade)))) {
      classSheet.addRow({ name: c.className });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="mau-nhap-tai-khoan.xlsx"',
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
