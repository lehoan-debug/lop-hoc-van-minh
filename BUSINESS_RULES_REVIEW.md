# BUSINESS RULES REVIEW — Các điểm nghiệp vụ chưa thống nhất / chưa rõ ràng

> Tài liệu này liệt kê các điểm mà nội dung giữa **Kế hoạch** (`KH Lớp học văn minh.docx`) và **Bảng chấm** (`Bảng chấm LHVM - Khối 10/11/12.docx`) chưa thống nhất, hoặc chưa được quy định rõ ràng.
> Theo nguyên tắc làm việc: **không tự đoán** — chọn cách triển khai ít làm thay đổi dữ liệu nhất, và thiết kế để Admin/SUPER_ADMIN có thể cấu hình lại qua `/admin/settings` mà không cần sửa code.

---

## 1. ⚠️ Cách kết hợp điểm chấm Sáng + Chiều thành "Điểm chấm của BGK trong ngày" (QUAN TRỌNG NHẤT)

**Trích KH mục III.4.a:**
> "Điểm 'Lớp học văn minh' mỗi ngày = Điểm chấm của BGK trong ngày + Điểm thưởng trong ngày (nếu có) – Điểm trừ trong ngày (nếu có)"

**Vấn đề:** Mỗi ngày có 2 lượt chấm độc lập (buổi Sáng và buổi Chiều), mỗi lượt tối đa 11 điểm (bảng chấm có dòng "Tổng điểm chấm của BGK" tính riêng cho từng buổi). Văn bản không nêu rõ "Điểm chấm của BGK trong ngày" được tính bằng:

- **(A) Tổng hai buổi** (Sáng + Chiều), thang điểm ngày tối đa = 22; hay
- **(B) Trung bình hai buổi** ((Sáng + Chiều) / 2), thang điểm ngày tối đa = 11, giữ nguyên thang so sánh với từng tiêu chí; hay
- **(C) Chỉ tính khi có đủ cả 2 buổi**, nếu thiếu 1 buổi thì xử lý ra sao (tính buổi đã có, hay báo thiếu dữ liệu)?

**Giải pháp triển khai đã chọn (ít thay đổi dữ liệu nhất):**
- **Không ghi đè / gộp dữ liệu gốc.** Mỗi lượt chấm (buổi) vẫn được lưu thành 1 dòng riêng trong sheet `Scores`, đúng theo cấu trúc mỗi bảng chấm Word (1 bảng = 1 buổi = các cột `c1..c11` + `totalCriteriaScore`).
- Toàn bộ logic kết hợp được cô lập trong **một hàm duy nhất**: `calculateDailyScore()` tại `src/lib/scoring/dailyScore.ts`.
- Cách kết hợp được điều khiển bởi cấu hình trong sheet `Settings`, khóa `DAILY_SCORE_COMBINE_MODE`, nhận giá trị `SUM` hoặc `AVERAGE`.
- **Giá trị mặc định tạm thời: `SUM`** (cộng điểm chấm cả 2 buổi) — vì đây là cách diễn giải "Điểm chấm của BGK trong ngày" sát nghĩa đen nhất khi không có từ "trung bình"/"chia đôi" nào xuất hiện trong câu, và nếu chỉ chấm 1 buổi/ngày thì công thức tự nhiên rút gọn về đúng điểm buổi đó.
- Nếu ngày đó chỉ có 1 trong 2 buổi được chấm: hệ thống lấy tổng các buổi **đã có dữ liệu** (không coi buổi thiếu là 0 điểm, để không phạt oan lớp chưa tới lượt chấm) và đánh dấu rõ trên UI Admin là "chấm thiếu buổi".
- **Admin/BTC cần xác nhận lại** cách tính đúng theo thực tế triển khai (SUM hay AVERAGE) và có thể đổi giá trị `DAILY_SCORE_COMBINE_MODE` trong `/admin/settings` bất kỳ lúc nào — thay đổi này chỉ ảnh hưởng đến cách hiển thị/tính điểm ngày & xếp hạng, **không** làm mất dữ liệu chấm gốc theo buổi.

## 2. Tiêu chí 7 bị cắt cụt trong chính văn bản gốc

**Trích nguyên văn (cả KH, BC10, BC11, BC12 đều giống hệt, đã xác minh qua raw XML):**
> "Kiểm tra ngẫu nhiên tủ locker, học sinh sắp xếp đồ dùng gọn gàng, không "

Câu bị cụt ngay sau "không " — đây là lỗi có sẵn trong tài liệu Word gốc, không phải do công cụ đọc file.

**Giải pháp:** Lưu tiêu chí 7 **nguyên văn kể cả phần cụt** trong sheet `Criteria` / seed data. Không tự thêm chữ suy đoán (ví dụ không tự ý thêm "bừa bộn" hay "để đồ sai quy định"). Trường `description` của tiêu chí có thể chỉnh sửa qua `/admin/settings` để BTC tự cập nhật lại nội dung chính xác khi có bản chỉnh sửa chính thức từ nhà trường.

## 3. Hai bảng chấm giống hệt nhau trong mỗi file Bảng chấm — không có nhãn "Sáng"/"Chiều" tường minh

Mỗi file `Bảng chấm LHVM - Khối X.docx` chứa **2 bảng liên tiếp**, cấu trúc và nội dung giống hệt nhau (cùng 11 tiêu chí, cùng danh sách lớp). Không có đoạn text nào trong file gắn nhãn "Buổi sáng" cho bảng 1 và "Buổi chiều" cho bảng 2.

**Giải pháp:** Suy luận hợp lý duy nhất khớp với KH (chấm 2 lần/ngày: đầu giờ sáng, cuối giờ chiều) là bảng thứ nhất tương ứng buổi Sáng, bảng thứ hai tương ứng buổi Chiều — theo đúng thứ tự liệt kê trong KH. Về mặt kỹ thuật, hai bảng chỉ khác nhau ở giá trị `session` (`MORNING`/`AFTERNOON`) của cùng một bộ 11 tiêu chí, không phát sinh thêm cấu trúc dữ liệu nào khác nên thứ tự này không ảnh hưởng tới tính đúng đắn của hệ thống — Admin có thể đổi nhãn hiển thị buổi trong `/admin/settings` (giờ bắt đầu/kết thúc mỗi buổi) mà không cần đổi code.

## 4. "Mức xếp loại cao hơn" trong tiêu chí tie-break (1) khi xếp hạng tháng

**Trích KH mục III.4.a:** "(1) Lớp có số lần đạt điểm tối đa **hoặc mức xếp loại cao hơn** nhiều hơn trong tháng"

Toàn bộ 4 tài liệu không định nghĩa bảng quy đổi "mức xếp loại" (ví dụ Tốt/Khá/Trung bình...) nào cho điểm ngày hay điểm tháng — chỉ có điểm số thuần tuý (0–11 mỗi buổi).

**Giải pháp:** `rankClasses()` (tại `src/lib/ranking/rankClasses.ts`) hiện chỉ triển khai tiêu chí phụ **"số lần đạt điểm tối đa trong tháng"**. Phần "mức xếp loại" được để dưới dạng `TODO` có cấu hình sẵn chỗ mở rộng (hàm nhận tham số `gradingScaleFn?` tuỳ chọn) nhưng không kích hoạt logic quy đổi xếp loại vì chưa có căn cứ dữ liệu — chờ BTC bổ sung thang xếp loại chính thức.

## 5. Bước tie-break cuối cùng cần quyết định thủ công

**Trích KH:** "Trường hợp vẫn bằng nhau, Ban Tổ chức xem xét kết quả thực hiện xuyên suốt các lần chấm trong tháng để quyết định."

Đây là bước ra quyết định định tính, không thể mã hoá thành công thức. `rankClasses()` sẽ trả về các lớp đồng hạng kèm cờ `needsManualReview: true` khi đã áp dụng hết 3 tiêu chí phụ (1)(2)(3) mà vẫn bằng nhau, để Admin tự quyết định trên `/admin/ranking` (không tự động chọn ngẫu nhiên một lớp "thắng").

## 6. Khung giờ chấm Sáng/Chiều chính xác

KH chỉ nêu mốc "7h25–7h30" (ổn định đầu giờ sáng) và mốc ổn định đầu giờ chiều theo 2 khung tiết học (12h40 hoặc 13h30), không có một mốc "giờ chấm buổi sáng/chiều" duy nhất áp dụng cho toàn trường (vì các lớp có giờ vào học/tan học lệch nhau).

**Giải pháp:** `/admin/settings` cho phép cấu hình khung giờ Sáng/Chiều (giờ bắt đầu – kết thúc) mang tính **tham khảo/mặc định** dùng để (a) gợi ý buổi chấm hiện tại cho giám khảo, (b) tuỳ chọn "cho phép chấm ngoài khung giờ" (bật/tắt). Việc chấm ngoài khung giờ mặc định là **được phép** (không chặn cứng) vì tài liệu không quy định chế tài từ chối chấm trễ giờ.

## 7. "Học sinh vi phạm không được xếp loại hạnh kiểm Tốt trong tháng"

Đây là hệ quả liên quan đến hệ thống quản lý hạnh kiểm **cá nhân** học sinh, nằm ngoài phạm vi ứng dụng chấm **tập thể lớp** này. Trường `studentName` trong `Adjustments` lưu lại tên học sinh (nếu giám khảo/BTC cung cấp) làm minh chứng, nhưng ứng dụng **không** tự động đồng bộ/ảnh hưởng đến hệ thống xếp loại hạnh kiểm của trường (ngoài phạm vi MVP, xem mục AO của yêu cầu gốc).

---

*Khi Admin/BTC xác nhận cách xử lý chính thức cho các mục trên, cập nhật giá trị tương ứng trong sheet `Settings` (mục 1, 6) hoặc trong `Criteria` (mục 2) — không cần sửa code.*
