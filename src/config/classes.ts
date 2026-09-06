import type { ClassConfig } from "@/types";

/**
 * Danh sách lớp gốc — trích nguyên văn từ tiêu đề 3 bảng chấm Word:
 * "Bảng chấm LHVM - Khối 10/11/12.docx". Đây là SEED DATA dùng để khởi tạo
 * sheet `Classes` (scripts/init-google-sheet.ts). Sau khi khởi tạo, sheet
 * `Classes` là nguồn dữ liệu chính thức — sửa lớp (bật/tắt, đổi tên) qua
 * /admin/settings, không sửa file này.
 */
export const SEED_CLASSES: ClassConfig[] = [
  ...[
    "10A1", "10A2", "10A3", "10A4", "10A5", "10A6", "10A7",
    "10A8", "10A9", "10A10", "10A11", "10A12", "10A13", "10A14", "10A15",
  ].map((className, i) => ({
    classId: className,
    className,
    grade: "10" as const,
    active: true,
    sortOrder: i + 1,
  })),
  ...[
    "11A1", "11A2", "11A3", "11A4", "11A5", "11A6", "11A7", "11A8",
  ].map((className, i) => ({
    classId: className,
    className,
    grade: "11" as const,
    active: true,
    sortOrder: i + 1,
  })),
  ...[
    "12A1", "12A2a", "12A2b", "12A3", "12A4", "12A5", "12A6", "12A7",
    "12A8", "12A9", "12A10", "12A11", "12A12", "12A13", "12A14", "12A15",
  ].map((className, i) => ({
    classId: className,
    className,
    grade: "12" as const,
    active: true,
    sortOrder: i + 1,
  })),
];
