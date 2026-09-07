import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { canManageUsers, canAssignRoles } from "@/lib/auth/permissions";
import { getUsers, getClasses, bulkUpsertUsers, appendAuditLog } from "@/lib/google/sheets";
import { matchImportUserRows, type ImportUserRawRow, type ImportUserError } from "@/lib/admin/importUsers";
import { toErrorResponse, BusinessError } from "@/lib/api/errors";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if (!canManageUsers(actor)) {
      return NextResponse.json({ error: "Bạn không có quyền quản lý tài khoản." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      throw new BusinessError("Vui lòng chọn file Excel (.xlsx) để tải lên.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BusinessError("File quá lớn (tối đa 2MB).");
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BusinessError("Không đọc được file — hãy chắc chắn đây là file Excel (.xlsx) hợp lệ.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BusinessError("File không có sheet dữ liệu nào.");

    // A = Email, B = Họ tên, C = Vai trò, D = Lớp chủ nhiệm (tuỳ chọn).
    // Dòng 1 luôn coi là header, bỏ qua.
    const rows: ImportUserRawRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({
        rowIndex: rowNumber,
        emailRaw: String(row.getCell(1).value ?? "").trim(),
        nameRaw: String(row.getCell(2).value ?? "").trim(),
        rolesRaw: String(row.getCell(3).value ?? "").trim(),
        homeroomClassesRaw: String(row.getCell(4).value ?? "").trim(),
      });
    });

    if (rows.length === 0) {
      throw new BusinessError(
        "File không có dữ liệu (cần cột A: Email, B: Họ tên, C: Vai trò, D: Lớp chủ nhiệm, từ dòng 2).",
      );
    }

    const [existingUsers, classes] = await Promise.all([getUsers(), getClasses({ activeOnly: true })]);
    const existingByEmail = new Map(existingUsers.map((u) => [u.email, u]));

    const { matches, errors } = matchImportUserRows(rows, classes);

    // Chặn leo thang quyền: chỉ SUPER_ADMIN được cấp vai trò ADMIN/SUPER_ADMIN
    // qua import — kiểm tra từng dòng như khi sửa tay 1 tài khoản (mục
    // canAssignRoles), KHÔNG bỏ qua chỉ vì đây là import hàng loạt.
    const allErrors: ImportUserError[] = [...errors];
    const approved = matches.filter((m) => {
      const previousRoles = existingByEmail.get(m.email)?.roles ?? [];
      const nextRoles = Array.from(new Set([...previousRoles, ...m.roles]));
      if (canAssignRoles(actor, previousRoles, nextRoles)) return true;
      allErrors.push({
        rowIndex: m.rowIndex,
        emailRaw: m.email,
        reason: "Chỉ Quản trị viên cấp cao mới có thể cấp quyền Quản trị viên/Quản trị viên cấp cao.",
      });
      return false;
    });

    let outcome = { createdEmails: [] as string[], updatedEmails: [] as string[] };
    if (approved.length > 0) {
      outcome = await bulkUpsertUsers(
        approved.map((m) => ({
          email: m.email,
          name: m.name,
          roles: m.roles,
          homeroomClassIds: m.homeroomClassIds,
        })),
      );

      await appendAuditLog({
        userEmail: actor.email,
        userName: actor.name,
        action: "IMPORT_USERS_EXCEL",
        entityType: "User",
        entityId: "bulk-import",
        details: {
          totalRows: rows.length,
          importedCount: approved.length,
          errorCount: allErrors.length,
          createdCount: outcome.createdEmails.length,
          updatedCount: outcome.updatedEmails.length,
        },
      });
    }

    return NextResponse.json({
      totalRows: rows.length,
      importedCount: approved.length,
      errorCount: allErrors.length,
      createdCount: outcome.createdEmails.length,
      updatedCount: outcome.updatedEmails.length,
      errors: allErrors,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
