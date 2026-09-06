import "server-only";
import { auth } from "./auth";
import type { Role, Grade } from "@/types";

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
  role: Role;
  allowedGrades: Grade[] | "ALL";
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
    role: session.user.role,
    allowedGrades: session.user.allowedGrades,
  };
}

/** Kiểm tra role tại API/server action — KHÔNG được thay bằng việc ẩn nút ở FE. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

export function canAccessGrade(user: CurrentUser, grade: Grade): boolean {
  return user.allowedGrades === "ALL" || user.allowedGrades.includes(grade);
}
