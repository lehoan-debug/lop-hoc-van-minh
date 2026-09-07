import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUserByEmail, appendAuditLog } from "@/lib/google/sheets";
import { authConfig } from "./auth.config";

/**
 * Cấu hình Auth.js đầy đủ — CHỈ chạy ở Node runtime (Route Handler
 * `/api/auth/[...nextauth]`, Server Component, Server Action). Không import
 * file này từ `middleware.ts` (xem `auth.config.ts` + `src/middleware.ts`).
 */

/** Thời gian tối đa giữ role/allowedGrades trong JWT trước khi đọc lại sheet
 * Users — cân bằng giữa hiệu năng (không gọi Sheets API mỗi request) và việc
 * Admin khoá tài khoản / đổi quyền có hiệu lực trong thời gian hợp lý. */
const ROLE_REFRESH_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Google],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      const appUser = await getUserByEmail(user.email);
      const allowed = !!appUser && appUser.active;
      await appendAuditLog({
        userEmail: user.email,
        userName: user.name ?? "",
        action: "LOGIN",
        entityType: "User",
        entityId: user.email,
        details: { allowed },
      });
      // Trả về true dù không hợp lệ để Auth.js vẫn tạo được phiên tạm thời;
      // việc từ chối thực sự diễn ra ở jwt/session callback + trang chờ duyệt,
      // để có thể hiển thị thông báo rõ ràng thay vì lỗi Auth.js mặc định.
      return true;
    },
    async jwt({ token }) {
      const email = token.email;
      if (!email) return token;
      const needsRefresh =
        !token.roleFetchedAt ||
        Date.now() - token.roleFetchedAt > ROLE_REFRESH_MS;
      if (needsRefresh) {
        const appUser = await getUserByEmail(email);
        if (appUser && appUser.active) {
          token.roles = appUser.roles;
          token.role = appUser.role;
          token.allowedGrades = appUser.allowedGrades;
          token.homeroomClassIds = appUser.homeroomClassIds;
          token.denied = false;
        } else {
          token.denied = true;
        }
        token.roleFetchedAt = Date.now();
      }
      return token;
    },
  },
});
