import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

/**
 * Middleware chạy Edge Runtime — dùng `authConfig` "edge-safe" (không import
 * Google Sheets) chỉ để GIẢI MÃ JWT hiện có và đọc role đã được ghi vào token
 * từ trước (bởi auth.ts chạy Node runtime). Đây là lớp chặn đầu tiên
 * (redirect nhanh, trải nghiệm tốt hơn) — việc kiểm tra role thật sự vẫn luôn
 * được thực hiện lại ở server (Server Component/Server Action) vì middleware
 * không phải là biên bảo mật duy nhất.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user?.email && !req.auth.error;
  const role = req.auth?.user?.role;

  const isProtected =
    pathname.startsWith("/judge") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/homeroom");

  if (!isProtected) return NextResponse.next();

  if (!isAuthed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/admin") &&
    role !== "ADMIN" &&
    role !== "SUPER_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/judge", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/judge/:path*", "/admin/:path*", "/homeroom/:path*"],
};
