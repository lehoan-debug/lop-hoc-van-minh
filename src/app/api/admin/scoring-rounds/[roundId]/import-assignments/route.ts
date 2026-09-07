import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { canManageRounds } from "@/lib/auth/permissions";
import {
  getScoringRound,
  getUsers,
  getClasses,
  bulkImportAssignments,
  appendAuditLog,
} from "@/lib/google/sheets";
import { matchAssignmentRows, groupMatchesByUser, type ImportRawRow } from "@/lib/scoring/importAssignments";
import { toErrorResponse, BusinessError } from "@/lib/api/errors";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — đủ cho vài nghìn dòng, chặn upload bất thường

export async function POST(
  req: NextRequest,
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
    if (!sheet) {
      throw new BusinessError("File không có sheet dữ liệu nào.");
    }

    // Cột A = Người chấm (email hoặc tên), cột B = Tên lớp. Dòng 1 luôn coi
    // là header (bỏ qua), kể cả khi người dùng không đặt tiêu đề chuẩn.
    const rows: ImportRawRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const personRaw = String(row.getCell(1).value ?? "").trim();
      const classRaw = String(row.getCell(2).value ?? "").trim();
      rows.push({ rowIndex: rowNumber, personRaw, classRaw });
    });

    if (rows.length === 0) {
      throw new BusinessError("File không có dữ liệu (cần cột A: Người chấm, cột B: Tên lớp, từ dòng 2).");
    }

    const [allUsers, allClasses] = await Promise.all([
      getUsers(),
      getClasses({ activeOnly: true }),
    ]);
    const judges = allUsers.filter(
      (u) => u.active && u.roles.some((r) => r === "JUDGE" || r === "ADMIN" || r === "SUPER_ADMIN"),
    );

    const { matches, errors } = matchAssignmentRows(rows, judges, allClasses);

    if (matches.length > 0) {
      const grouped = groupMatchesByUser(matches);
      await bulkImportAssignments(roundId, grouped, user.email);

      await appendAuditLog({
        userEmail: user.email,
        userName: user.name,
        action: "IMPORT_ASSIGNMENTS_EXCEL",
        entityType: "ScoringRoundAssignment",
        entityId: roundId,
        details: {
          totalRows: rows.length,
          importedCount: matches.length,
          errorCount: errors.length,
          userCount: grouped.size,
        },
      });
    }

    return NextResponse.json({
      totalRows: rows.length,
      importedCount: matches.length,
      errorCount: errors.length,
      errors,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
