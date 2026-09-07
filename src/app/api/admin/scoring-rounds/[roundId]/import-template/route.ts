import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { canManageRounds } from "@/lib/auth/permissions";
import { getScoringRound, getClasses, getUsers } from "@/lib/google/sheets";
import { isClassInRoundScope } from "@/lib/rounds/eligibility";
import { toErrorResponse } from "@/lib/api/errors";

/**
 * File Excel mẫu cho tính năng "Nhập phân công từ Excel" — điền sẵn dữ liệu
 * THẬT của đúng Đợt chấm này để Admin đỡ phải gõ tay:
 * - Sheet "Phân công": mỗi dòng 1 lớp thuộc phạm vi Đợt chấm (cột B điền
 *   sẵn), Admin chỉ cần điền cột A (người chấm) rồi tải lại đúng file này lên
 *   (route import-assignments đọc từ dòng 2, cột A = người chấm, cột B = lớp).
 * - Sheet "Danh sách người chấm": tên + email toàn bộ người có thể chấm, để
 *   Admin copy-paste email chính xác thay vì gõ tay dễ sai/trùng tên.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageRounds(user)) {
      return NextResponse.json({ error: "Bạn không có quyền phân công người chấm." }, { status: 403 });
    }

    const { roundId } = await params;
    const round = await getScoringRound(roundId);
    if (!round) return NextResponse.json({ error: "Không tìm thấy Đợt chấm." }, { status: 404 });

    const [allClasses, allUsers] = await Promise.all([
      getClasses({ activeOnly: true }),
      getUsers(),
    ]);
    const classesInScope = allClasses
      .filter((c) => isClassInRoundScope(round, c.classId, c.grade))
      .sort((a, b) => (a.grade === b.grade ? a.sortOrder - b.sortOrder : a.grade.localeCompare(b.grade)));
    const judges = allUsers
      .filter((u) => u.active && u.roles.some((r) => r === "JUDGE" || r === "ADMIN" || r === "SUPER_ADMIN"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet("Phân công");
    sheet.columns = [
      { header: "Người chấm (email)", key: "person", width: 32 },
      { header: "Tên lớp", key: "class", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const c of classesInScope) {
      sheet.addRow({ person: "", class: c.className });
    }
    if (classesInScope.length === 0) {
      sheet.addRow({ person: "judge1@fpt.edu.vn", class: "10A1" });
    }

    const refSheet = workbook.addWorksheet("Danh sách người chấm");
    refSheet.columns = [
      { header: "Tên", key: "name", width: 28 },
      { header: "Email", key: "email", width: 32 },
    ];
    refSheet.getRow(1).font = { bold: true };
    for (const j of judges) {
      refSheet.addRow({ name: j.name, email: j.email });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `phan-cong-${round.title.replace(/[^a-zA-Z0-9À-ỹ_ -]/g, "").trim() || roundId}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
