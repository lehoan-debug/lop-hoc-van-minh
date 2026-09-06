# Lớp học Văn minh

Ứng dụng chấm điểm phong trào **"Lớp học văn minh"** — Trường THPT FPT Đà Nẵng.

Xây dựng bằng Next.js (App Router) + TypeScript + Tailwind CSS, dữ liệu nghiệp vụ lưu trên Google Sheets, đăng nhập bằng Google OAuth (Auth.js), deploy trên Vercel.

## Tài liệu liên quan

- [`docs/BUSINESS_ANALYSIS.md`](docs/BUSINESS_ANALYSIS.md) — Phân tích nghiệp vụ, trích nguyên văn từ 4 file Word gốc (danh sách lớp, 11 tiêu chí, quy tắc chấm điểm, xếp hạng...).
- [`BUSINESS_RULES_REVIEW.md`](BUSINESS_RULES_REVIEW.md) — Các điểm nghiệp vụ chưa thống nhất giữa Kế hoạch và Bảng chấm, cách xử lý và cấu hình.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Kiến trúc hệ thống.
- [`docs/GOOGLE_SHEETS_SETUP.md`](docs/GOOGLE_SHEETS_SETUP.md) — Hướng dẫn tạo Google Cloud Project, Service Account, OAuth, Spreadsheet.
- [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md) — Hướng dẫn deploy lên Vercel.

## Bắt đầu nhanh (phát triển local)

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị thật, xem docs/GOOGLE_SHEETS_SETUP.md
npm run init-sheet           # tạo header + seed dữ liệu Classes/Criteria/Settings vào Google Sheet
npm run dev                  # http://localhost:3000
```

Sau khi chạy `init-sheet`, vào Google Sheet → tab `Users` → thêm dòng đầu tiên với `role=SUPER_ADMIN`, `active=TRUE` để có thể đăng nhập và cấu hình hệ thống.

## Các lệnh chính

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run build` | Build production |
| `npm run start` | Chạy bản build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Kiểm tra kiểu TypeScript (`tsc --noEmit`) |
| `npm run test` | Chạy unit test (Vitest) cho các business rule quan trọng |
| `npm run init-sheet` | Khởi tạo cấu trúc + seed dữ liệu Google Sheet |

## Vai trò người dùng

- **JUDGE** (Giám khảo): chấm 11 tiêu chí cho lớp được phân công, xem lịch sử chấm của bản thân.
- **ADMIN**: xem dashboard, kết quả, xếp hạng; quản lý điểm cộng/trừ; sửa/xoá (soft-delete) kết quả khi cần; quản lý tài khoản; quản lý cấu hình.
- **SUPER_ADMIN**: toàn quyền như ADMIN, thêm quyền cấp tài khoản ADMIN/SUPER_ADMIN khác.

Vai trò được lấy từ sheet `Users`, **không hard-code** trong source code.

## Cấu trúc thư mục chính

```
src/
  app/            # Next.js App Router — trang & API routes
  components/     # UI components (scoring/, admin/, layout/, ui/)
  lib/            # business logic: auth/, google/, scoring/, ranking/, validation/, timezone/, actions/
  config/         # seed data (classes.ts, criteria.ts) — trích nguyên văn từ Word gốc
  types/          # type dùng chung
scripts/          # script khởi tạo Google Sheet
docs/             # tài liệu
tests/            # unit test (Vitest)
```

## Lưu ý bảo mật

- Google Service Account private key và OAuth client secret **chỉ** được đọc trong code server-side (`src/lib/google/`, Route Handlers, Server Actions) — không bao giờ lộ ra client bundle (`import "server-only"` chặn việc này ở build time).
- `.env.local` không được commit — đã có trong `.gitignore`.
