# HƯỚNG DẪN DEPLOY LÊN VERCEL

Yêu cầu trước khi bắt đầu: đã hoàn thành [`GOOGLE_SHEETS_SETUP.md`](GOOGLE_SHEETS_SETUP.md) (có đủ giá trị cho các biến môi trường).

## Bước 1 — Đưa code lên GitHub

```bash
git init
git add .
git commit -m "Khởi tạo ứng dụng Lớp học Văn minh"
git branch -M main
git remote add origin https://github.com/<ten-tai-khoan>/<ten-repo>.git
git push -u origin main
```

> ⚠️ Kiểm tra lại `git status` trước khi commit — đảm bảo không có file `.env.local` hoặc file JSON Service Account nào bị đưa lên (đã có trong `.gitignore`, nhưng nên kiểm tra lại cho chắc).

## Bước 2 — Import repository vào Vercel

1. Truy cập https://vercel.com/ → đăng nhập bằng GitHub.
2. Bấm **Add New** → **Project**.
3. Chọn repository vừa push ở Bước 1 → **Import**.
4. Framework Preset: Vercel sẽ tự nhận diện **Next.js** — giữ nguyên.

## Bước 3 — Khai báo Environment Variables

Trong màn hình cấu hình project (hoặc sau này vào **Settings → Environment Variables**), thêm đầy đủ các biến sau (copy từ `.env.local`):

| Key | Ghi chú |
|---|---|
| `AUTH_SECRET` | |
| `AUTH_GOOGLE_ID` | |
| `AUTH_GOOGLE_SECRET` | |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Dán nguyên chuỗi có `\n`, xem lưu ý dưới |
| `NEXT_PUBLIC_APP_NAME` | `Lớp học Văn minh` |
| `NEXTAUTH_URL` | Điền sau khi có domain, ví dụ `https://lop-hoc-van-minh.vercel.app` |

⚠️ **`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` trên Vercel**: dán y nguyên chuỗi có `\n` như trong `.env.local` (KHÔNG dán private key nhiều dòng thật vào ô giá trị của Vercel — ô input của Vercel chỉ nhận 1 dòng cho mỗi biến, nên chuỗi `\n` dạng ký tự là bắt buộc). Code trong `src/lib/google/sheetsClient.ts` sẽ tự chuyển `\n` thành xuống dòng thật khi chạy.

Chọn áp dụng cho cả 3 môi trường: **Production**, **Preview**, **Development** (trừ khi bạn muốn tách riêng).

## Bước 4 — Deploy

Bấm **Deploy**. Đợi build xong (thường 1-3 phút). Vercel sẽ cấp cho bạn 1 domain dạng `https://<ten-project>.vercel.app`.

## Bước 5 — Cấu hình Google OAuth redirect URL cho production

1. Copy domain Vercel vừa nhận được.
2. Vào lại Google Cloud Console → **APIs & Services** → **Credentials** → mở OAuth Client đã tạo.
3. Thêm vào **Authorized redirect URIs**:
   ```
   https://<ten-project>.vercel.app/api/auth/callback/google
   ```
4. Lưu lại.
5. Quay lại Vercel → **Settings → Environment Variables**, cập nhật `NEXTAUTH_URL` = `https://<ten-project>.vercel.app` (nếu chưa điền ở Bước 3), rồi **Redeploy** (Vercel → Deployments → ⋯ → Redeploy) để áp dụng biến môi trường mới.

## Bước 6 — Test đăng nhập

1. Mở domain Vercel trên điện thoại hoặc máy tính.
2. Bấm **Đăng nhập bằng Google**, chọn tài khoản đã thêm vào sheet `Users` (Bước 10 của `GOOGLE_SHEETS_SETUP.md`).
3. Nếu đăng nhập thành công và vào đúng `/judge` hoặc `/admin` theo role — hoàn tất.
4. Nếu bị chuyển tới trang báo "chưa được cấp quyền" — kiểm tra lại đúng email trong sheet `Users`, cột `active` = `TRUE`.

## Bước 7 — Test ghi dữ liệu vào Google Sheet

1. Đăng nhập bằng tài khoản JUDGE, vào `/judge`, chọn buổi/khối/lớp, chấm đủ 11 tiêu chí, gửi.
2. Mở lại Google Spreadsheet → tab `Scores` → kiểm tra đã có dòng dữ liệu mới với đúng thông tin vừa chấm.
3. Nếu không thấy dữ liệu, kiểm tra:
   - Service Account đã được **Share** quyền Editor vào đúng Spreadsheet chưa (`GOOGLE_SHEETS_SETUP.md` Bước 6.4).
   - `GOOGLE_SHEETS_SPREADSHEET_ID` trên Vercel có đúng không.
   - Xem log lỗi tại Vercel → Project → **Logs** (hoặc **Functions** tab) để biết chi tiết lỗi (không hiển thị private key, chỉ hiển thị thông báo lỗi).

## Cập nhật code sau này

Mỗi lần `git push` lên nhánh `main`, Vercel sẽ tự động build & deploy lại (CI/CD có sẵn, không cần thao tác thêm).
