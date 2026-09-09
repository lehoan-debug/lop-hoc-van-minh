import { ClipboardCheck, History, User, School, ShieldCheck, type LucideIcon } from "lucide-react";
import { canAccessScoring, hasAnyRole, hasRole } from "@/lib/auth/permissions";
import type { UserRole } from "@/types";

export interface SectionNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Danh sách khu vực (section) mà 1 tài khoản đa vai trò có thể chuyển qua
 * lại — dùng chung cho cả BottomNav (mobile) và SectionTopBar (desktop) để
 * không lặp lại logic quyền ở 2 nơi khác nhau rồi lệch nhau.
 *
 * Thứ tự: Quản trị (nếu có) -> Lớp chủ nhiệm (nếu có, ƯU TIÊN trước Chấm
 * điểm — GVCN cần xem xếp hạng lớp mình trước, chấm điểm thì tự bấm sang
 * khi cần) -> Chấm điểm -> Lịch sử -> Tài khoản (luôn có).
 */
export function getSectionNavItems(user: { roles: UserRole[] }): SectionNavItem[] {
  return [
    hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"]) && {
      href: "/admin",
      label: "Quản trị",
      icon: ShieldCheck,
    },
    hasRole(user, "HOMEROOM_TEACHER") && {
      href: "/homeroom",
      label: "Lớp chủ nhiệm",
      icon: School,
    },
    canAccessScoring(user) && { href: "/judge", label: "Chấm điểm", icon: ClipboardCheck },
    canAccessScoring(user) && { href: "/judge/history", label: "Lịch sử", icon: History },
    { href: "/judge/account", label: "Tài khoản", icon: User },
  ].filter((x): x is SectionNavItem => !!x);
}
