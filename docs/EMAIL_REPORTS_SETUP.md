# Cấu hình gửi báo cáo qua email (Resend)

Tính năng "Gửi báo cáo qua email" (ở trang GVCN và Dashboard Admin) dùng
[Resend](https://resend.com) để gửi email. Chưa cấu hình thì nút vẫn hiện
nhưng bấm gửi sẽ báo lỗi rõ ràng ("Chưa cấu hình gửi email trên server"),
không làm hỏng phần còn lại của app.

## 1. Tạo tài khoản Resend

1. Đăng ký miễn phí tại https://resend.com (gói free: 3.000 email/tháng,
   100 email/ngày — đủ dùng cho quy mô 1 trường).
2. Vào **API Keys** → **Create API Key** → đặt tên (vd. "lop-hoc-van-minh
   production") → copy giá trị `re_...` (chỉ hiện 1 lần).

## 2. Xác minh domain gửi (bắt buộc để gửi email thật)

Resend **không cho gửi email tới người nhận bất kỳ** nếu domain gửi (phần
sau `@` trong địa chỉ "From") chưa được xác minh — trừ khi gửi tới đúng email
đã đăng ký tài khoản Resend (chỉ dùng để test nội bộ).

1. Vào **Domains** → **Add Domain** → nhập domain trường (vd.
   `fptschools-danang.edu.vn`, hoặc 1 subdomain riêng như
   `mail.fptschools-danang.edu.vn` nếu không muốn đụng domain chính).
2. Resend sẽ đưa ra vài bản ghi DNS (thường là SPF/DKIM dạng `TXT`/`CNAME`) —
   thêm đúng các bản ghi này vào nơi quản lý DNS của domain (Admin CNTT của
   trường thường là người có quyền này).
3. Chờ Resend xác minh xong (thường vài phút tới vài giờ tuỳ DNS).

Nếu trường chưa có domain riêng để xác minh ngay, có thể tạm dùng domain thử
nghiệm `onboarding@resend.dev` của Resend — nhưng domain này **chỉ gửi được
tới đúng email đã đăng ký tài khoản Resend**, không gửi được cho GVCN/Admin
khác. Chỉ phù hợp để tự kiểm thử, không dùng được cho người dùng thật.

## 3. Thêm biến môi trường

Trên Vercel (Project → Settings → Environment Variables), thêm:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="Lớp học Văn minh <baocao@fptschools-danang.edu.vn>"
```

`RESEND_FROM_EMAIL` phải dùng đúng domain đã xác minh ở bước 2. Sau khi thêm,
**redeploy** để biến môi trường có hiệu lực (giống các biến khác của app).

## 4. Kiểm thử

1. Vào `/homeroom` (với tài khoản GVCN hoặc Admin) → bấm "Gửi báo cáo qua
   email" → email mặc định điền sẵn là email của chính bạn → bấm Gửi.
2. Kiểm tra hộp thư — nếu chưa xác minh domain, Resend sẽ trả lỗi rõ ràng
   (hiện luôn trên giao diện, không cần xem log).
3. Tương tự với nút "Gửi báo cáo qua email" trên Dashboard Admin (`/admin`).

## Không có gì bị xoá/mất nếu chưa cấu hình

Tính năng này **không đụng tới Google Sheets** — chỉ đọc dữ liệu đã có để
tạo nội dung email, không ghi gì thêm ngoài 1 dòng AuditLog
(`SEND_EMAIL_REPORT`) sau khi gửi thành công. Nếu chưa muốn dùng, có thể bỏ
qua toàn bộ tài liệu này — app vẫn hoạt động bình thường, chỉ riêng nút "Gửi
báo cáo qua email" báo lỗi khi bấm.
