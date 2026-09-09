import { describe, it, expect } from "vitest";
import {
  hasRole,
  hasAnyRole,
  primaryRole,
  canAccessScoring,
  canManageUsers,
  canManageAdminRoles,
  canAssignRoles,
  canViewHomeroomClass,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/types";

function roles(...r: UserRole[]): { roles: UserRole[] } {
  return { roles: r };
}

describe("multi-role user", () => {
  it("user có nhiều role — hasRole/hasAnyRole nhận diện đúng từng role", () => {
    const user = roles("JUDGE", "HOMEROOM_TEACHER");
    expect(hasRole(user, "JUDGE")).toBe(true);
    expect(hasRole(user, "HOMEROOM_TEACHER")).toBe(true);
    expect(hasRole(user, "ADMIN")).toBe(false);
    expect(hasAnyRole(user, ["ADMIN", "HOMEROOM_TEACHER"])).toBe(true);
  });

  it("primaryRole trả về role cao nhất theo thứ tự SUPER_ADMIN > ADMIN > JUDGE > HOMEROOM_TEACHER", () => {
    expect(primaryRole(["JUDGE", "HOMEROOM_TEACHER"])).toBe("JUDGE");
    expect(primaryRole(["ADMIN", "JUDGE"])).toBe("ADMIN");
    expect(primaryRole(["SUPER_ADMIN", "ADMIN"])).toBe("SUPER_ADMIN");
    expect(primaryRole([])).toBe("JUDGE");
  });
});

describe("canAccessScoring — JUDGE/ADMIN/SUPER_ADMIN vào được giao diện chấm", () => {
  it("JUDGE được vào", () => {
    expect(canAccessScoring(roles("JUDGE"))).toBe(true);
  });
  it("ADMIN được vào", () => {
    expect(canAccessScoring(roles("ADMIN"))).toBe(true);
  });
  it("SUPER_ADMIN được vào", () => {
    expect(canAccessScoring(roles("SUPER_ADMIN"))).toBe(true);
  });
  it("HOMEROOM_TEACHER thuần tuý không được vào", () => {
    expect(canAccessScoring(roles("HOMEROOM_TEACHER"))).toBe(false);
  });
});

describe("Phân quyền cấp Admin — chỉ SUPER_ADMIN được cấp/thu hồi ADMIN/SUPER_ADMIN", () => {
  const admin = roles("ADMIN");
  const superAdmin = roles("SUPER_ADMIN");

  it("ADMIN không thể tự cấp role ADMIN cho người khác", () => {
    expect(canAssignRoles(admin, ["JUDGE"], ["JUDGE", "ADMIN"])).toBe(false);
  });

  it("ADMIN không thể cấp role SUPER_ADMIN", () => {
    expect(canAssignRoles(admin, ["JUDGE"], ["SUPER_ADMIN"])).toBe(false);
  });

  it("ADMIN không thể gỡ role ADMIN của người khác", () => {
    expect(canAssignRoles(admin, ["ADMIN"], ["JUDGE"])).toBe(false);
  });

  it("SUPER_ADMIN cấp ADMIN được", () => {
    expect(canAssignRoles(superAdmin, ["JUDGE"], ["JUDGE", "ADMIN"])).toBe(true);
  });

  it("ADMIN cấp JUDGE được (không đụng tầng admin)", () => {
    expect(canAssignRoles(admin, [], ["JUDGE"])).toBe(true);
  });

  it("ADMIN cấp HOMEROOM_TEACHER được", () => {
    expect(canAssignRoles(admin, ["JUDGE"], ["JUDGE", "HOMEROOM_TEACHER"])).toBe(true);
  });

  it("ADMIN gỡ HOMEROOM_TEACHER của 1 tài khoản VỐN CŨNG LÀ ADMIN được — không đụng tầng admin (bug đã sửa)", () => {
    expect(canAssignRoles(admin, ["ADMIN", "HOMEROOM_TEACHER"], ["ADMIN"])).toBe(true);
  });

  it("ADMIN thêm HOMEROOM_TEACHER cho 1 tài khoản VỐN CŨNG LÀ ADMIN được — không đụng tầng admin (bug đã sửa)", () => {
    expect(canAssignRoles(admin, ["ADMIN"], ["ADMIN", "HOMEROOM_TEACHER"])).toBe(true);
  });

  it("ADMIN vẫn KHÔNG gỡ được ADMIN dù đồng thời đổi role khác trong cùng lượt lưu", () => {
    expect(canAssignRoles(admin, ["ADMIN", "HOMEROOM_TEACHER"], ["JUDGE"])).toBe(false);
  });

  it("canManageAdminRoles chỉ true với SUPER_ADMIN", () => {
    expect(canManageAdminRoles(admin)).toBe(false);
    expect(canManageAdminRoles(superAdmin)).toBe(true);
  });

  it("canManageUsers true với cả ADMIN và SUPER_ADMIN", () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(superAdmin)).toBe(true);
    expect(canManageUsers(roles("JUDGE"))).toBe(false);
  });
});

describe("GVCN chỉ xem lớp mình được phân công", () => {
  it("GVCN xem được lớp trong homeroomClassIds", () => {
    const teacher = { ...roles("HOMEROOM_TEACHER"), homeroomClassIds: ["10A3"] };
    expect(canViewHomeroomClass(teacher, "10A3")).toBe(true);
  });

  it("GVCN KHÔNG xem được lớp ngoài phạm vi được gán", () => {
    const teacher = { ...roles("HOMEROOM_TEACHER"), homeroomClassIds: ["10A3"] };
    expect(canViewHomeroomClass(teacher, "10A4")).toBe(false);
  });

  it("ADMIN xem được mọi lớp bất kể homeroomClassIds", () => {
    const admin = { ...roles("ADMIN"), homeroomClassIds: [] };
    expect(canViewHomeroomClass(admin, "10A9")).toBe(true);
  });

  it("JUDGE thuần tuý (không phải GVCN) không xem được trang lớp chủ nhiệm", () => {
    const judge = { ...roles("JUDGE"), homeroomClassIds: [] };
    expect(canViewHomeroomClass(judge, "10A3")).toBe(false);
  });
});
