import type { AppUser, UserRole } from "@/types";

/**
 * Toàn bộ logic phân quyền tập trung tại đây — KHÔNG lặp lại điều kiện
 * `roles.includes(...)` rải rác ở nhiều trang/component. Mọi hàm ở đây chỉ
 * nhận dữ liệu đã xác thực (đến từ `requireUser()`/session server-side),
 * KHÔNG tự đọc session — để dùng được cả ở nơi đã có sẵn `AppUser`.
 *
 * Đây là điều kiện CẦN nhưng CHƯA ĐỦ để cho phép một hành động — Server
 * Action/route vẫn phải tự gọi các hàm này (không chỉ ẩn nút ở client).
 */

const ROLE_PRIORITY: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "JUDGE",
  "HOMEROOM_TEACHER",
];

/** Role "đại diện" cao nhất trong danh sách — dùng cho field dẫn xuất
 * `AppUser.role` và các chỗ chỉ cần biết 1 role để hiển thị/gate thô (vd.
 * middleware Edge). KHÔNG dùng cho phân quyền chi tiết multi-role. */
export function primaryRole(roles: UserRole[]): UserRole {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return "JUDGE";
}

export function hasRole(
  user: Pick<AppUser, "roles">,
  role: UserRole,
): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(
  user: Pick<AppUser, "roles">,
  roles: UserRole[],
): boolean {
  return roles.some((r) => user.roles.includes(r));
}

/** JUDGE, ADMIN, SUPER_ADMIN đều có thể VÀO giao diện chấm — nhưng có vào
 * được không KHÁC với có được SUBMIT một Đợt chấm cụ thể hay không (phải
 * được phân công qua `ScoringRoundAssignment` — xem `src/lib/rounds/`). */
export function canAccessScoring(user: Pick<AppUser, "roles">): boolean {
  return hasAnyRole(user, ["JUDGE", "ADMIN", "SUPER_ADMIN"]);
}

export function canManageUsers(user: Pick<AppUser, "roles">): boolean {
  return hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"]);
}

/** Chỉ SUPER_ADMIN được cấp/thu hồi role ADMIN hoặc SUPER_ADMIN của một tài
 * khoản bất kỳ — ADMIN không được tự nâng quyền hay cấp/gỡ ADMIN khác. */
export function canManageAdminRoles(user: Pick<AppUser, "roles">): boolean {
  return hasRole(user, "SUPER_ADMIN");
}

/** Chỉ SUPER_ADMIN được xoá tài khoản — xoá là hành động nặng (chặn đăng
 * nhập ngay), ADMIN thường chỉ được khoá/mở qua toggle "Đang hoạt động". */
export function canDeleteUsers(user: Pick<AppUser, "roles">): boolean {
  return hasRole(user, "SUPER_ADMIN");
}

/**
 * Kiểm tra một thay đổi role cụ thể (đổi roles của 1 tài khoản từ
 * `previousRoles` sang `nextRoles`) có được phép hay không. Chỉ gate theo
 * SUPER_ADMIN khi tập role ADMIN/SUPER_ADMIN THỰC SỰ THAY ĐỔI (thêm hoặc bớt)
 * — so sánh khác biệt (previous vs next), KHÔNG phải chỉ cần ADMIN/SUPER_ADMIN
 * xuất hiện ở đâu đó. Nếu chỉ xét "xuất hiện" (union) thay vì "thay đổi", một
 * ADMIN thường sẽ bị chặn nhầm khi chỉnh JUDGE/HOMEROOM_TEACHER cho 1 tài
 * khoản mà tài khoản đó tình cờ CŨNG có sẵn quyền ADMIN không đổi — đây là
 * bug thực tế đã xảy ra (báo cáo: xoá quyền GVCN bị báo lỗi "chỉ Ất ơ mới
 * xoá được quyền Admin" dù không đụng gì tới quyền Admin cả).
 * Vẫn giữ nguyên tắc gốc: một ADMIN thường không được tự CẤP hay TỰ GỠ quyền
 * ADMIN/SUPER_ADMIN của người khác (hay của chính mình) — chỉ SUPER_ADMIN
 * mới làm được, vì đó là thay đổi thực sự của tập admin-tier.
 */
export function canAssignRoles(
  actor: Pick<AppUser, "roles">,
  previousRoles: UserRole[],
  nextRoles: UserRole[],
): boolean {
  const isAdminTier = (r: UserRole) => r === "ADMIN" || r === "SUPER_ADMIN";
  const prevAdminTier = new Set(previousRoles.filter(isAdminTier));
  const nextAdminTier = new Set(nextRoles.filter(isAdminTier));
  const adminTierChanged =
    prevAdminTier.size !== nextAdminTier.size ||
    [...prevAdminTier].some((r) => !nextAdminTier.has(r));
  if (adminTierChanged) return canManageAdminRoles(actor);
  return canManageUsers(actor);
}

export function canManageCriteria(user: Pick<AppUser, "roles">): boolean {
  return hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"]);
}

export function canManageRounds(user: Pick<AppUser, "roles">): boolean {
  return hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"]);
}

export function canExport(user: Pick<AppUser, "roles">): boolean {
  return hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"]);
}

export function canViewHomeroomClass(
  user: Pick<AppUser, "roles" | "homeroomClassIds">,
  classId: string,
): boolean {
  if (hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"])) return true;
  if (!hasRole(user, "HOMEROOM_TEACHER")) return false;
  return user.homeroomClassIds.includes(classId);
}

/** Chỉ SUPER_ADMIN được phép chấm ngoài phân công (emergency override) —
 * xem `src/lib/rounds/roundStatus.ts#canScoreOutOfAssignment` cho luồng đầy
 * đủ (yêu cầu xác nhận + lý do + AuditLog), hàm này chỉ kiểm tra role. */
export function canOverrideAssignment(user: Pick<AppUser, "roles">): boolean {
  return hasRole(user, "SUPER_ADMIN");
}
