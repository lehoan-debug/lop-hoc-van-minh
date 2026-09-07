import "server-only";
import { auth } from "./auth";
import { hasAnyRole } from "./permissions";
import type { Role, UserRole, Grade } from "@/types";

export class UnauthorizedError extends Error {
  constructor(message = "Phiên đăng nhập đã hết hạn.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Bạn không có quyền thực hiện thao tác này.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface CurrentUser {
  email: string;
  name: string;
  /** V2: nguồn sự thật cho phân quyền. */
  roles: UserRole[];
  /** Dẫn xuất — role cao nhất trong `roles`. Giữ cho code cũ. */
  role: Role;
  allowedGrades: Grade[] | "ALL";
  homeroomClassIds: string[];
}

/** Lấy user hiện tại từ session server-side. Ném lỗi nếu chưa đăng nhập
 * hoặc tài khoản đã bị vô hiệu hoá/không có trong sheet Users. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.email || session.error) {
    throw new UnauthorizedError();
  }
  return {
    email: session.user.email,
    name: session.user.name ?? "",
    roles: session.user.roles,
    role: session.user.role,
    allowedGrades: session.user.allowedGrades,
    homeroomClassIds: session.user.homeroomClassIds,
  };
}

/** Kiểm tra user hiện tại có ÍT NHẤT MỘT trong các role truyền vào không —
 * KHÔNG được thay bằng việc ẩn nút ở FE. Với tài khoản multi-role, việc có
 * role X không loại trừ role Y. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasAnyRole(user, roles)) {
    throw new ForbiddenError();
  }
  return user;
}

/** Legacy V1 — chỉ còn dùng cho các chỗ hiển thị/tương thích, KHÔNG dùng để
 * chặn luồng chấm theo Đợt chấm (V2 dùng ScoringRoundAssignment). */
export function canAccessGrade(user: CurrentUser, grade: Grade): boolean {
  return user.allowedGrades === "ALL" || user.allowedGrades.includes(grade);
}
