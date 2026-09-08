import "server-only";
import { Resend } from "resend";

/**
 * Client gửi email (Resend) — CHỈ ĐƯỢC IMPORT TỪ CODE SERVER-SIDE (Server
 * Action/Route Handler). `import "server-only"` khiến build thất bại nếu
 * lỡ import vào Client Component, tránh lộ API key ra bundle trình duyệt.
 * Xem docs/EMAIL_REPORTS_SETUP.md để biết cách lấy API key + xác minh domain.
 */

let cachedClient: Resend | null = null;

export function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Thiếu cấu hình RESEND_API_KEY — xem docs/EMAIL_REPORTS_SETUP.md.");
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/** Địa chỉ "From" — phải thuộc domain đã xác minh trên Resend, không được
 * dùng domain chưa xác minh ngoài môi trường thử nghiệm. */
export function getFromEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("Thiếu cấu hình RESEND_FROM_EMAIL — xem docs/EMAIL_REPORTS_SETUP.md.");
  }
  return from;
}
