/**
 * Đối chiếu dữ liệu thô đọc từ file Excel phân công (2 cột: Người chấm, Tên
 * lớp) với danh sách người dùng/lớp thật trong hệ thống — hàm THUẦN, không
 * đụng Google Sheets, để test được độc lập với việc đọc file .xlsx.
 */
import type { AppUser, ClassConfig } from "@/types";

export interface ImportRawRow {
  /** Số dòng trong file Excel (tính cả header) — dùng để báo lỗi rõ ràng. */
  rowIndex: number;
  personRaw: string;
  classRaw: string;
}

export interface ImportMatch {
  rowIndex: number;
  userEmail: string;
  userName: string;
  classId: string;
  className: string;
}

export interface ImportError {
  rowIndex: number;
  personRaw: string;
  classRaw: string;
  reason: string;
}

export interface ImportParseResult {
  matches: ImportMatch[];
  errors: ImportError[];
}

const MAX_IMPORT_ROWS = 1000;

export function matchAssignmentRows(
  rows: ImportRawRow[],
  judges: Pick<AppUser, "email" | "name">[],
  classes: Pick<ClassConfig, "classId" | "className">[],
): ImportParseResult {
  const matches: ImportMatch[] = [];
  const errors: ImportError[] = [];

  const judgesByEmail = new Map(judges.map((j) => [j.email.trim().toLowerCase(), j]));
  const judgesByName = new Map<string, Pick<AppUser, "email" | "name">[]>();
  for (const j of judges) {
    const key = j.name.trim().toLowerCase();
    if (!key) continue;
    const list = judgesByName.get(key) ?? [];
    list.push(j);
    judgesByName.set(key, list);
  }
  const classesByName = new Map(classes.map((c) => [c.className.trim().toLowerCase(), c]));

  const limited = rows.slice(0, MAX_IMPORT_ROWS);

  for (const row of limited) {
    const personRaw = row.personRaw.trim();
    const classRaw = row.classRaw.trim();
    if (!personRaw && !classRaw) continue; // dòng trống — bỏ qua âm thầm, không tính là lỗi

    if (!personRaw || !classRaw) {
      errors.push({
        rowIndex: row.rowIndex,
        personRaw,
        classRaw,
        reason: "Thiếu người chấm hoặc tên lớp.",
      });
      continue;
    }

    let judge: Pick<AppUser, "email" | "name"> | undefined;
    if (personRaw.includes("@")) {
      judge = judgesByEmail.get(personRaw.toLowerCase());
      if (!judge) {
        errors.push({
          rowIndex: row.rowIndex,
          personRaw,
          classRaw,
          reason: `Không tìm thấy tài khoản có email "${personRaw}".`,
        });
        continue;
      }
    } else {
      const candidates = judgesByName.get(personRaw.toLowerCase()) ?? [];
      if (candidates.length === 0) {
        errors.push({
          rowIndex: row.rowIndex,
          personRaw,
          classRaw,
          reason: `Không tìm thấy người chấm tên "${personRaw}". Dùng email để chắc chắn hơn.`,
        });
        continue;
      }
      if (candidates.length > 1) {
        errors.push({
          rowIndex: row.rowIndex,
          personRaw,
          classRaw,
          reason: `Có ${candidates.length} người tên "${personRaw}" — vui lòng dùng email để phân biệt.`,
        });
        continue;
      }
      judge = candidates[0];
    }

    const klass = classesByName.get(classRaw.toLowerCase());
    if (!klass) {
      errors.push({
        rowIndex: row.rowIndex,
        personRaw,
        classRaw,
        reason: `Không tìm thấy lớp "${classRaw}".`,
      });
      continue;
    }

    if (!judge) continue; // không xảy ra (đã continue ở các nhánh trên), chỉ để TS hẹp kiểu

    matches.push({
      rowIndex: row.rowIndex,
      userEmail: judge.email.trim().toLowerCase(),
      userName: judge.name,
      classId: klass.classId,
      className: klass.className,
    });
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push({
      rowIndex: MAX_IMPORT_ROWS + 1,
      personRaw: "",
      classRaw: "",
      reason: `File có hơn ${MAX_IMPORT_ROWS} dòng — chỉ xử lý ${MAX_IMPORT_ROWS} dòng đầu tiên.`,
    });
  }

  return { matches, errors };
}

/** Gộp các match theo người để ghi 1 lần/người (union lớp) — dùng trước khi
 * ghi Google Sheets, tránh nhiều lần ghi cho cùng 1 người trong 1 lần import. */
export function groupMatchesByUser(matches: ImportMatch[]): Map<string, string[]> {
  const byUser = new Map<string, Set<string>>();
  for (const m of matches) {
    const set = byUser.get(m.userEmail) ?? new Set<string>();
    set.add(m.classId);
    byUser.set(m.userEmail, set);
  }
  const result = new Map<string, string[]>();
  for (const [email, classIds] of byUser) {
    result.set(email, Array.from(classIds));
  }
  return result;
}
