/**
 * Đối chiếu dữ liệu thô đọc từ file Excel "Nhập tài khoản" (4 cột: Email, Họ
 * tên, Vai trò, Lớp chủ nhiệm) — hàm THUẦN, không đụng Google Sheets, test
 * độc lập với việc đọc file .xlsx. Xem `src/lib/scoring/importAssignments.ts`
 * cho mẫu thiết kế tương tự (đối chiếu phân công theo lớp).
 */
import type { ClassConfig, UserRole } from "@/types";

export interface ImportUserRawRow {
  /** Số dòng trong file Excel (tính cả header) — dùng để báo lỗi rõ ràng. */
  rowIndex: number;
  emailRaw: string;
  nameRaw: string;
  rolesRaw: string;
  homeroomClassesRaw: string;
}

export interface ImportUserMatch {
  rowIndex: number;
  email: string;
  name: string;
  roles: UserRole[];
  homeroomClassIds: string[];
}

export interface ImportUserError {
  rowIndex: number;
  emailRaw: string;
  reason: string;
}

export interface ImportUserParseResult {
  matches: ImportUserMatch[];
  errors: ImportUserError[];
}

const MAX_IMPORT_ROWS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Chấp nhận cả mã vai trò (JUDGE) lẫn nhãn tiếng Việt (Giám khảo) — không
 * bắt Admin phải nhớ đúng mã kỹ thuật khi điền file. */
const ROLE_TOKEN_MAP: Record<string, UserRole> = {
  judge: "JUDGE",
  "giám khảo": "JUDGE",
  "giam khao": "JUDGE",
  homeroom_teacher: "HOMEROOM_TEACHER",
  gvcn: "HOMEROOM_TEACHER",
  "giáo viên chủ nhiệm": "HOMEROOM_TEACHER",
  "giao vien chu nhiem": "HOMEROOM_TEACHER",
  admin: "ADMIN",
  "quản trị viên": "ADMIN",
  "quan tri vien": "ADMIN",
  super_admin: "SUPER_ADMIN",
  "quản trị viên cấp cao": "SUPER_ADMIN",
  "quan tri vien cap cao": "SUPER_ADMIN",
};

function splitTokens(raw: string): string[] {
  return raw
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function matchImportUserRows(
  rows: ImportUserRawRow[],
  classes: Pick<ClassConfig, "classId" | "className">[],
): ImportUserParseResult {
  const matches: ImportUserMatch[] = [];
  const errors: ImportUserError[] = [];
  const classesByName = new Map(classes.map((c) => [c.className.trim().toLowerCase(), c]));

  const limited = rows.slice(0, MAX_IMPORT_ROWS);

  for (const row of limited) {
    const email = row.emailRaw.trim().toLowerCase();
    const name = row.nameRaw.trim();
    const rolesRaw = row.rolesRaw.trim();
    const homeroomRaw = row.homeroomClassesRaw.trim();

    if (!email && !name && !rolesRaw && !homeroomRaw) continue; // dòng trống — bỏ qua âm thầm

    if (!email || !EMAIL_RE.test(email)) {
      errors.push({ rowIndex: row.rowIndex, emailRaw: row.emailRaw, reason: `Email không hợp lệ: "${row.emailRaw}".` });
      continue;
    }
    if (!name) {
      errors.push({ rowIndex: row.rowIndex, emailRaw: email, reason: "Thiếu họ tên." });
      continue;
    }
    if (!rolesRaw) {
      errors.push({ rowIndex: row.rowIndex, emailRaw: email, reason: "Thiếu vai trò." });
      continue;
    }

    const roleTokens = splitTokens(rolesRaw);
    const roles: UserRole[] = [];
    let badRoleToken: string | null = null;
    for (const token of roleTokens) {
      const mapped = ROLE_TOKEN_MAP[token.toLowerCase()];
      if (!mapped) {
        badRoleToken = token;
        break;
      }
      if (!roles.includes(mapped)) roles.push(mapped);
    }
    if (badRoleToken) {
      errors.push({
        rowIndex: row.rowIndex,
        emailRaw: email,
        reason: `Vai trò không hợp lệ: "${badRoleToken}" (dùng JUDGE/HOMEROOM_TEACHER/ADMIN/SUPER_ADMIN hoặc tên tiếng Việt tương ứng).`,
      });
      continue;
    }
    if (roles.length === 0) {
      errors.push({ rowIndex: row.rowIndex, emailRaw: email, reason: "Không đọc được vai trò nào hợp lệ." });
      continue;
    }

    const homeroomClassIds: string[] = [];
    if (homeroomRaw) {
      let badClassToken: string | null = null;
      for (const token of splitTokens(homeroomRaw)) {
        const klass = classesByName.get(token.toLowerCase());
        if (!klass) {
          badClassToken = token;
          break;
        }
        if (!homeroomClassIds.includes(klass.classId)) homeroomClassIds.push(klass.classId);
      }
      if (badClassToken) {
        errors.push({
          rowIndex: row.rowIndex,
          emailRaw: email,
          reason: `Không tìm thấy lớp "${badClassToken}" trong cột Lớp chủ nhiệm.`,
        });
        continue;
      }
    }

    matches.push({ rowIndex: row.rowIndex, email, name, roles, homeroomClassIds });
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push({
      rowIndex: MAX_IMPORT_ROWS + 1,
      emailRaw: "",
      reason: `File có hơn ${MAX_IMPORT_ROWS} dòng — chỉ xử lý ${MAX_IMPORT_ROWS} dòng đầu tiên.`,
    });
  }

  return { matches, errors };
}
