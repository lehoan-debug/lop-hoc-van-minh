import type { NextAuthConfig } from "next-auth";
import type { Role, UserRole, Grade } from "@/types";

/**
 * Cấu hình Auth.js "edge-safe" — KHÔNG được import bất kỳ module nào chạm tới
 * Google Sheets (googleapis dùng các API Node-only như `crypto`, không chạy
 * được trên Edge Runtime — nơi middleware.ts thực thi mặc định).
 *
 * File này chỉ định nghĩa phần khung (pages, session strategy, cách gắn
 * roles/allowedGrades/homeroomClassIds từ JWT đã có sẵn vào Session) để
 * middleware có thể GIẢI MÃ token hiện có và đọc role phục vụ redirect —
 * không tính toán/làm mới role.
 *
 * `auth.ts` (chạy Node runtime — Route Handler, Server Component, Server
 * Action) mở rộng cấu hình này, thêm provider Google và các callback thực sự
 * gọi Google Sheets (signIn, jwt).
 */

declare module "next-auth" {
  interface Session {
    user: {
      email: string;
      name?: string | null;
      image?: string | null;
      /** V2: nguồn sự thật cho phân quyền (multi-role). */
      roles: UserRole[];
      /** Dẫn xuất = role cao nhất trong `roles` — giữ cho middleware Edge
       * (chỉ cần biết ADMIN/SUPER_ADMIN hay không) và UI cũ. */
      role: Role;
      allowedGrades: Grade[] | "ALL";
      homeroomClassIds: string[];
    };
    error?: "ACCESS_DENIED";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    roles?: UserRole[];
    role?: Role;
    allowedGrades?: Grade[] | "ALL";
    homeroomClassIds?: string[];
    roleFetchedAt?: number;
    denied?: boolean;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  /**
   * Auth.js mặc định chỉ tự "trust" host khi phát hiện biến môi trường hệ
   * thống của Vercel/Cloudflare Pages, hoặc khi chạy `next dev`. Khi tự chạy
   * `next start` (kể cả trên Vercel trong một số trường hợp proxy/host khác
   * với dự đoán mặc định) mà thiếu điều kiện này sẽ báo lỗi "UntrustedHost"
   * (hiển thị chung chung là "problem with the server configuration").
   * Domain đã cố định (khai báo trong Google OAuth Authorized redirect URIs)
   * nên trust host ở đây là an toàn — ranh giới bảo mật thực sự nằm ở
   * middleware/role-check phía server, không phải ở bước này.
   */
  trustHost: true,
  callbacks: {
    session({ session, token }) {
      if (token.denied) {
        session.error = "ACCESS_DENIED";
      }
      session.user.roles = token.roles ?? ["JUDGE"];
      session.user.role = token.role ?? "JUDGE";
      session.user.allowedGrades = token.allowedGrades ?? "ALL";
      session.user.homeroomClassIds = token.homeroomClassIds ?? [];
      return session;
    },
  },
};
