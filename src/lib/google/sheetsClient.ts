import "server-only";
import { google, sheets_v4 } from "googleapis";

/**
 * Client Google Sheets — CHỈ ĐƯỢC IMPORT TỪ CODE SERVER-SIDE
 * (Route Handlers, Server Actions, Server Components). `import "server-only"`
 * ở trên sẽ khiến build thất bại nếu module này lỡ bị import vào Client
 * Component, để tránh lộ Service Account private key ra bundle trình duyệt.
 */

let cachedClient: sheets_v4.Sheets | null = null;

function getPrivateKey(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  // Trên Vercel, biến môi trường không giữ được ký tự xuống dòng thật,
  // nên private key được lưu với "\n" dạng chuỗi — cần thay lại thành xuống dòng thật.
  return raw.replace(/\\n/g, "\n");
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = getPrivateKey();

  if (!email || !key) {
    throw new Error(
      "Thiếu cấu hình GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) {
    throw new Error("Thiếu cấu hình GOOGLE_SHEETS_SPREADSHEET_ID.");
  }
  return id;
}
