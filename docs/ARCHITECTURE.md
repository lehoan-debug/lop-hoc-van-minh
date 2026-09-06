# KIẾN TRÚC HỆ THỐNG — LỚP HỌC VĂN MINH

## 1. Tổng quan

- **Framework:** Next.js 15 (App Router, TypeScript, React 19), deploy trên Vercel.
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives) + Lucide Icons. Mobile-first cho `/judge`, sidebar responsive cho `/admin`.
- **Auth:** Auth.js (NextAuth v5) + Google OAuth provider. Session dùng JWT (không cần DB session store).
- **Dữ liệu nghiệp vụ:** Google Sheets (1 spreadsheet, nhiều sheet/tab) — không dùng database riêng ở V1.
- **Validation:** Zod ở mọi boundary (API route / server action nhận input từ client).
- **Timezone:** `Asia/Ho_Chi_Minh` cho mọi hiển thị & tính toán "ngày làm việc"; lưu trữ timestamp dạng ISO 8601 (UTC instant, có offset).

## 2. Vì sao Google Sheets (không DB riêng)

Yêu cầu đề bài chọn Google Sheets làm nguồn dữ liệu chính cho V1 để nhà trường (Phòng Công tác học sinh / BTC) có thể tự xem, tự sửa, tự export dữ liệu bằng Google Sheets UI quen thuộc, không cần vận hành thêm hạ tầng DB. Đánh đổi: hiệu năng và khả năng transaction thấp hơn DB thật ⇒ thiết kế phải:

- Đọc theo batch, cache cấu hình tĩnh (`Classes`, `Criteria`, `Settings`) trong bộ nhớ tiến trình server với TTL ngắn (mặc định 60s) để tránh gọi Sheets API trên mỗi lần render.
- Ghi (append) theo từng request nhưng luôn có bước kiểm tra trùng (đọc trước khi ghi) để đảm bảo tính duy nhất logic (date+session+classId+judgeEmail).
- Không có transaction thật ⇒ chấp nhận rủi ro race condition hiếm khi 2 giám khảo submit cùng lúc cho cùng 1 lớp/buổi trong cùng vài trăm ms; mức rủi ro này chấp nhận được cho quy mô 1 trường học và được giảm thiểu bằng việc đọc lại ngay trước khi append.

## 3. Lớp trừu tượng Google Sheets

Toàn bộ truy cập Google Sheets API nằm trong `src/lib/google/`:

- `sheetsClient.ts`: khởi tạo `googleapis` client bằng Service Account (JWT), **chỉ chạy server-side** (không có `"use client"`, không export sang client bundle).
- `sheets.ts`: các hàm nghiệp vụ thuần (`getUsers`, `getUserByEmail`, `getClasses`, `getCriteria`, `createScore`, `getScores`, `checkDuplicateScore`, `createAdjustment`, `getAdjustments`, `getSettings`, `updateSetting`, `appendAuditLog`, ...). Không route/component nào được gọi Google API trực tiếp — luôn đi qua các hàm này.

Mỗi sheet ứng với 1 tab: `Users`, `Classes`, `Criteria`, `Scores`, `Adjustments`, `Settings`, `AuditLog` (chi tiết cột: xem `docs/GOOGLE_SHEETS_SETUP.md` và `scripts/init-google-sheet.ts`).

## 4. Auth & phân quyền

- Đăng nhập bắt buộc bằng Google OAuth (Auth.js). Sau khi có `email` từ Google, hệ thống tra `getUserByEmail(email)` trong sheet `Users`.
  - Không tồn tại hoặc `active=FALSE` ⇒ từ chối, hiển thị trang báo lỗi rõ ràng, ghi `AuditLog` action `LOGIN` (kèm `detailsJson: { allowed: false }`).
  - Hợp lệ ⇒ gắn `role`, `allowedGrades` vào session JWT (callback `jwt`/`session` của Auth.js), ghi `AuditLog` action `LOGIN` (`allowed: true`).
- **Không hard-code email/role trong source.** Mọi role đến từ sheet `Users`.
- Bảo vệ route **server-side**:
  - Route Handlers/Server Actions dưới `/api/admin/*` và `/api/judge/*` đều gọi `requireRole()` (trong `src/lib/auth/session.ts`) để kiểm tra role trước khi chạm vào Google Sheets.
  - Trang `/admin/**` dùng `middleware.ts` + kiểm tra lại trong `layout.tsx` (defense in depth) — ẩn UI không đủ, phải chặn ở server.
- 3 role: `JUDGE`, `ADMIN`, `SUPER_ADMIN` (SUPER_ADMIN có thêm quyền cấu hình hệ thống nhạy cảm, ví dụ sửa `Settings.DAILY_SCORE_COMBINE_MODE`, quản lý tài khoản role ADMIN khác).

## 5. Chống chấm trùng

Khoá logic: `(date, session, classId, judgeEmail)`. Trước khi `createScore()`:
1. `checkDuplicateScore(date, session, classId, judgeEmail)` đọc sheet `Scores`, lọc theo 4 điều kiện, loại các bản ghi đã soft-delete.
2. Nếu tồn tại ⇒ trả lỗi nghiệp vụ `DUPLICATE_SCORE`, kèm bản ghi cũ để FE hiển thị "Bạn đã chấm lớp này trong buổi này" + nút xem lại.
3. Nếu không tồn tại ⇒ append kèm `submissionId = crypto.randomUUID()`.

Admin có thể sửa (`EDIT_SCORE`, ghi đè theo `submissionId`, cập nhật `updatedAt`, ghi `AuditLog`) hoặc soft-delete (`DELETE_SCORE`, thêm cột `deletedAt`, không xoá dòng thật).

## 6. Điểm ngày & xếp hạng (business logic tách khỏi UI)

- `src/lib/scoring/dailyScore.ts` → `calculateDailyScore(scoresOfDay, adjustmentsOfDay, settings)`. Xem `BUSINESS_RULES_REVIEW.md` mục 1 về `DAILY_SCORE_COMBINE_MODE`.
- `src/lib/ranking/rankClasses.ts` → `rankClasses(dailyScoresOfMonth, classes)`, trả về danh sách đã sắp xếp + áp dụng tie-break 3 bước + cờ `needsManualReview`. Không có logic xếp hạng nào nằm trực tiếp trong component/page.
- Cả hai đều là pure function (input/output rõ ràng) ⇒ dễ unit test (xem `docs`/`tests`).

## 7. Cấu trúc thư mục

```
src/
  app/
    (public)/login/page.tsx
    judge/page.tsx
    judge/[classId]/page.tsx
    judge/history/page.tsx
    admin/layout.tsx
    admin/page.tsx
    admin/results/page.tsx
    admin/ranking/page.tsx
    admin/adjustments/page.tsx
    admin/criteria-analysis/page.tsx
    admin/users/page.tsx
    admin/settings/page.tsx
    api/auth/[...nextauth]/route.ts
    api/judge/...
    api/admin/...
  components/{scoring,admin,layout,ui}/
  lib/{auth,google,scoring,ranking,validation,timezone}/
  config/{classes.ts,criteria.ts}
  types/index.ts
scripts/init-google-sheet.ts
docs/
```

## 8. Bảo mật

- Secrets (Service Account private key, OAuth client secret, spreadsheet ID) chỉ đọc qua `process.env` trong code chạy server (Route Handlers, Server Actions, `lib/google/*`). Không import các module này vào Client Components.
- `.env.local` và mọi `.env*` (trừ `.env.example`) nằm trong `.gitignore`.
- Zod validate toàn bộ payload ở API boundary; điểm tiêu chí chỉ chấp nhận `0 | 1`.
- Không log private key/token ra console.

## 9. Khả năng mở rộng (không khoá đường nâng cấp)

- **Ảnh minh chứng:** `notesJson` trên `Scores` và `evidence` trên `Adjustments` đã là dạng chuỗi/JSON mở, có thể thêm field `photoUrl`/`photoUrls[]` sau này mà không phá schema cũ.
- **Database thật:** toàn bộ truy cập dữ liệu đi qua `src/lib/google/sheets.ts` — khi cần chuyển sang Postgres/Supabase chỉ cần viết lại implementation của lớp này, giữ nguyên chữ ký hàm.
- **PWA:** `manifest.json` + icon cơ bản, chưa cần offline submit.
