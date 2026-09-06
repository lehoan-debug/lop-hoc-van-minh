import type { NextAuthConfig } from "next-auth";
import type { Role, Grade } from "@/types";

/**
 * Cấu hình Auth.js "edge-safe" — KHÔNG được import bất kỳ module nào chạm tới
 * Google Sheets (googleapis dùng các API Node-only như `crypto`, không chạy
 * được trên Edge Runtime — nơi middleware.ts thực thi mặc định).
 *
 * File này chỉ định nghĩa phần khung (pages, session strategy, cách gắn
 * role/allowedGrades từ JWT đã có sẵn vào Session) để middleware có thể GIẢI
 * MÃ token hiện có và đọc role phục vụ redirect — không tính toán/làm mới role.
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
      role: Role;
      allowedGrades: Grade[] | "ALL";
    };
    error?: "ACCESS_DENIED";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    allowedGrades?: Grade[] | "ALL";
    roleFetchedAt?: number;
    denied?: boolean;
  }
}

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.denied) {
        session.error = "ACCESS_DENIED";
      }
      session.user.role = token.role ?? "JUDGE";
      session.user.allowedGrades = token.allowedGrades ?? "ALL";
      return session;
    },
  },
};
