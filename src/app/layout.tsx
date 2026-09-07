import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Lớp học Văn minh";

// Toàn bộ ứng dụng phụ thuộc phiên đăng nhập + dữ liệu Google Sheets sống động
// (không có trang tiếp thị tĩnh nào) — không static-render bất kỳ route nào.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: appName,
  description: "Ứng dụng chấm điểm phong trào Lớp học văn minh — Trường THPT FPT Đà Nẵng",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1a73c7",
  // Bắt buộc để env(safe-area-inset-bottom) trả về giá trị thật (không phải
  // luôn = 0) trên iOS Safari — cần cho .safe-bottom và các thanh CTA cố
  // định phía trên BottomNav không bị thanh cử chỉ/tai thỏ che.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
