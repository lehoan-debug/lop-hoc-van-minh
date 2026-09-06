# HƯỚNG DẪN THIẾT LẬP GOOGLE SHEETS & GOOGLE OAUTH

Hướng dẫn này viết cho người **không chuyên lập trình**. Làm theo đúng thứ tự từng bước.

## Bước 1 — Tạo Google Cloud Project

1. Truy cập https://console.cloud.google.com/
2. Góc trên bên trái, bấm vào tên project hiện tại → **New Project**.
3. Đặt tên, ví dụ `lop-hoc-van-minh`, bấm **Create**.
4. Đợi vài giây, chọn đúng project vừa tạo ở góc trên (nếu chưa tự chuyển).

## Bước 2 — Bật Google Sheets API

1. Vào menu ☰ → **APIs & Services** → **Library**.
2. Tìm **Google Sheets API**.
3. Bấm vào kết quả → bấm **Enable**.

## Bước 3 — Tạo Service Account (tài khoản dịch vụ để app ghi dữ liệu)

1. Vào menu ☰ → **APIs & Services** → **Credentials**.
2. Bấm **Create Credentials** → **Service account**.
3. Đặt tên, ví dụ `lhvm-sheets-writer` → **Create and Continue**.
4. Phần **Grant this service account access to project**: có thể bỏ qua (Continue) — quyền thực tế sẽ cấp trực tiếp trên Google Sheet ở Bước 6.
5. Bấm **Done**.

## Bước 4 — Tạo Key (JSON) cho Service Account

1. Trong danh sách **Credentials**, bấm vào Service account vừa tạo.
2. Vào tab **Keys** → **Add Key** → **Create new key**.
3. Chọn định dạng **JSON** → **Create**. File JSON sẽ tự động tải về máy.
4. Mở file JSON này bằng Notepad, bạn sẽ thấy 2 giá trị cần dùng:
   - `client_email` → đây là `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → đây là `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

   ⚠️ **Giữ bí mật file này**, không chia sẻ, không commit lên GitHub.

## Bước 5 — Lấy email Service Account

Chính là giá trị `client_email` ở Bước 4, dạng: `lhvm-sheets-writer@ten-project.iam.gserviceaccount.com`

## Bước 6 — Tạo Google Spreadsheet và chia sẻ cho Service Account

1. Vào https://sheets.google.com/ → **Blank spreadsheet**.
2. Đặt tên, ví dụ `LopHocVanMinh - Data`.
3. Nhìn vào đường dẫn URL, ví dụ:
   `https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit`
   → Chuỗi ở giữa `d/` và `/edit` chính là `GOOGLE_SHEETS_SPREADSHEET_ID`.
4. Bấm nút **Share** (Chia sẻ) ở góc trên bên phải.
5. Dán email Service Account (Bước 5) vào ô mời, chọn quyền **Editor**, bỏ chọn "Notify people", bấm **Share/Done**.

   ⚠️ Nếu bỏ qua bước này, ứng dụng sẽ báo lỗi không đọc/ghi được dữ liệu.

6. Không cần tự tạo các tab (sheet con) — chạy lệnh `npm run init-sheet` ở Bước 9 sẽ tự tạo `Users`, `Classes`, `Criteria`, `Scores`, `Adjustments`, `Settings`, `AuditLog` kèm dữ liệu mẫu.

## Bước 7 — Tạo Google OAuth Credentials (đăng nhập bằng Google)

1. Vào menu ☰ → **APIs & Services** → **OAuth consent screen**.
   - Chọn **External** (nếu trường dùng Google Workspace nội bộ có thể chọn Internal).
   - Điền tên app: `Lớp học Văn minh`, email hỗ trợ, email liên hệ.
   - Ở phần Scopes: không cần thêm gì đặc biệt (email/profile là mặc định).
   - Thêm email của những người sẽ test (Test users) nếu app đang ở chế độ Testing.
2. Vào **Credentials** → **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Đặt tên, ví dụ `lhvm-web`.
5. Mục **Authorized redirect URIs**, thêm:
   - Khi chạy local: `http://localhost:3000/api/auth/callback/google`
   - Khi đã deploy Vercel: `https://<ten-app-cua-ban>.vercel.app/api/auth/callback/google`
6. Bấm **Create**. Bạn sẽ nhận được:
   - **Client ID** → đây là `AUTH_GOOGLE_ID`
   - **Client secret** → đây là `AUTH_GOOGLE_SECRET`

## Bước 8 — Thiết lập redirect URI (nhắc lại)

Mỗi khi thêm domain mới (ví dụ domain Vercel chính thức), quay lại **Bước 7.5** để thêm redirect URI tương ứng — nếu thiếu, đăng nhập Google sẽ báo lỗi `redirect_uri_mismatch`.

## Bước 9 — Điền Environment Variables & khởi tạo dữ liệu

1. Trong thư mục project, copy `.env.example` thành `.env.local`.
2. Điền các giá trị đã thu thập ở trên:

```env
AUTH_SECRET=            # chạy: npx auth secret (hoặc openssl rand -base64 32)
AUTH_GOOGLE_ID=         # Bước 7
AUTH_GOOGLE_SECRET=     # Bước 7
GOOGLE_SHEETS_SPREADSHEET_ID=   # Bước 6
GOOGLE_SERVICE_ACCOUNT_EMAIL=   # Bước 4/5
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

   ⚠️ **Lưu ý về `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`**: giá trị `private_key` trong file JSON có nhiều dòng, chứa các ký tự xuống dòng thật. Khi dán vào file `.env.local`, hãy **giữ nguyên trong một dòng** với các ký tự xuống dòng được viết thành `\n` (hai ký tự gạch chéo ngược + n), ví dụ:

   ```
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQ...\n-----END PRIVATE KEY-----\n"
   ```

   Ứng dụng sẽ tự động chuyển `\n` thành xuống dòng thật khi chạy (xem `src/lib/google/sheetsClient.ts`).

3. Chạy:

```bash
npm install
npm run init-sheet
```

Nếu thấy dòng `Hoàn tất!` là đã tạo xong cấu trúc sheet + nạp dữ liệu mẫu (danh sách lớp, tiêu chí, cấu hình mặc định).

## Bước 10 — Thêm tài khoản Admin đầu tiên

1. Mở lại Google Spreadsheet → tab `Users`.
2. Thêm 1 dòng dữ liệu, ví dụ:

   | email | name | role | active | allowedGrades |
   |---|---|---|---|---|
   | ten.ban@fe.edu.vn | Nguyễn Văn A | SUPER_ADMIN | TRUE | ALL |

3. Lưu lại. Bây giờ đăng nhập bằng đúng email Google này sẽ vào được `/admin`.
4. Từ giao diện `/admin/users`, bạn có thể thêm các tài khoản JUDGE/ADMIN khác mà không cần sửa trực tiếp Google Sheet nữa.

## Setup trên Vercel

Xem tiếp [`VERCEL_DEPLOY.md`](VERCEL_DEPLOY.md).
