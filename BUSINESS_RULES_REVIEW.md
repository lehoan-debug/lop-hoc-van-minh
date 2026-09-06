# BUSINESS RULES REVIEW — Các điểm nghiệp vụ chưa thống nhất / chưa rõ ràng

> Tài liệu này liệt kê các điểm mà nội dung giữa **Kế hoạch** (`KH Lớp học văn minh.docx`) và **Bảng chấm** (`Bảng chấm LHVM - Khối 10/11/12.docx`) chưa thống nhất, hoặc chưa được quy định rõ ràng.
> Theo nguyên tắc làm việc: **không tự đoán** — chọn cách triển khai ít làm thay đổi dữ liệu nhất, và thiết kế để Admin/SUPER_ADMIN có thể cấu hình lại qua `/admin/settings` mà không cần sửa code.

---

## 1. ⚠️ Cách kết hợp điểm chấm Sáng + Chiều thành "Điểm chấm của BGK trong ngày" (QUAN TRỌNG NHẤT — CHƯA XÁC NHẬN)

**Trích KH mục III.4.a:**
> "Điểm 'Lớp học văn minh' mỗi ngày = Điểm chấm của BGK trong ngày + Điểm thưởng trong ngày (nếu có) – Điểm trừ trong ngày (nếu có)"

**Vấn đề:** Mỗi ngày có 2 lượt chấm độc lập, có nhãn rõ ràng trong tài liệu là **Buổi sáng** và **Buổi chiều** (xem mục 3 bên dưới), mỗi lượt tối đa 11 điểm. Văn bản **không nêu rõ** "Điểm chấm của BGK trong ngày" được tính bằng:

- **(A) Tổng hai buổi** (Sáng + Chiều), thang điểm ngày tối đa = 22; hay
- **(B) Trung bình hai buổi** ((Sáng + Chiều) / 2), thang điểm ngày tối đa = 11.

**Quyết định triển khai: KHÔNG tự chọn mặc định SUM hay AVERAGE.** Đây là điểm ảnh hưởng trực tiếp đến kết quả xếp hạng thi đua thật của học sinh — không có căn cứ nào trong 4 tài liệu để suy đoán, nên chọn sai còn rủi ro hơn cả việc chưa xếp hạng được.

Cấu hình `Settings.DAILY_SCORE_COMBINE_MODE` nhận 1 trong 3 giá trị:

```ts
type DailyScoreCombineMode = "SUM" | "AVERAGE" | "UNCONFIRMED";
```

- **Giá trị mặc định khi khởi tạo hệ thống: `UNCONFIRMED`.**
- Khi `combineMode = UNCONFIRMED`:
  - Điểm buổi Sáng và buổi Chiều vẫn được lưu độc lập, đầy đủ như bình thường (không ảnh hưởng việc chấm điểm hằng ngày của giám khảo).
  - Hệ thống **không tạo ra một "điểm ngày chính thức"** nào (`officialJudgeScore` / `officialDailyScore` = `null`).
  - `/admin/ranking` **không xếp hạng chính thức** khi ở trạng thái này — thay vào đó hiển thị bảng số liệu tham khảo theo từng lớp: điểm sáng, điểm chiều, tổng 2 buổi, trung bình 2 buổi (theo từng ngày và trung bình tháng), kèm banner:
    > "Công thức điểm ngày chưa được BTC xác nhận — số liệu dưới đây chỉ mang tính tham khảo, chưa dùng để xếp hạng chính thức."
  - Không có công thức chưa xác nhận nào được dùng ngầm để ra quyết định xếp hạng/trao cờ thi đua.
- Khi BTC xác nhận cách tính chính thức, **chỉ cần đổi giá trị `DAILY_SCORE_COMBINE_MODE`** thành `SUM` hoặc `AVERAGE` tại `/admin/settings` (yêu cầu quyền ADMIN/SUPER_ADMIN) — không cần sửa code, không mất dữ liệu chấm gốc theo buổi (dữ liệu Sáng/Chiều trong sheet `Scores` không bao giờ bị ghi đè hay gộp).
- Nếu một ngày chỉ có 1 trong 2 buổi được chấm: `sumScore`/`averageScore` tham khảo và `officialJudgeScore` (khi đã xác nhận SUM/AVERAGE) đều tính trên (các) buổi **đã có dữ liệu**, không coi buổi thiếu là 0 điểm (không phạt oan lớp chưa tới lượt chấm).

Toàn bộ logic nằm trong **một hàm duy nhất**: `calculateDailyScore()` tại `src/lib/scoring/dailyScore.ts`.

## 2. Tiêu chí 7 bị cắt cụt trong chính văn bản gốc — CẦN BTC XÁC NHẬN NỘI DUNG

**Trích nguyên văn (cả KH, BC10, BC11, BC12 đều giống hệt, đã xác minh qua raw XML):**
> "Kiểm tra ngẫu nhiên tủ locker, học sinh sắp xếp đồ dùng gọn gàng, không "

Câu bị cụt ngay sau "không " — đây là lỗi có sẵn trong tài liệu Word gốc, không phải do công cụ đọc file.

**Giải pháp:** Lưu tiêu chí 7 **nguyên văn kể cả phần cụt**, không tự thêm chữ suy đoán (ví dụ không tự ý thêm "bừa bộn" hay "để đồ sai quy định"). Bổ sung cờ `needsReview = true` trên bản ghi tiêu chí này trong sheet `Criteria` (mặc định `false` cho 10 tiêu chí còn lại) để Admin nhận biết rõ ràng ngay trong `/admin/settings` rằng nội dung tiêu chí này đang chờ BTC cập nhật bản chính thức — thay vì phải tự dò tìm chỗ nào bị lỗi. Khi Admin/SUPER_ADMIN sửa lại mô tả qua `/admin/settings`, cờ `needsReview` tự động được xoá (chuyển về `false`).

## 3. Buổi Sáng / Buổi Chiều — ĐÃ XÁC ĐỊNH RÕ TRONG TÀI LIỆU GỐC (không phải suy luận)

> ⚠️ Cập nhật: mục này ban đầu ghi nhầm là "2 bảng không có nhãn Sáng/Chiều" — đây là lỗi phân tích do công cụ đọc ban đầu chỉ trích xuất `word/document.xml` mà bỏ sót phần **header** của trang (`word/header1.xml`, `word/header2.xml`). Đã đọc lại trực tiếp raw XML của các file header và xác nhận:

Cả 3 file Bảng chấm (Khối 10/11/12) đều có **header trang** ghi rõ ràng, nguyên văn:

- Header của bảng thứ nhất: `"Buổi sáng - Ngày: ______________________	Người chấm: ________________________________________			Khối {10|11|12}"`
- Header của bảng thứ hai: `"Buổi chiều - Ngày: ______________________	Người chấm: ________________________________________			Khối {10|11|12}"`

⇒ **`MORNING`/`AFTERNOON` là dữ liệu nghiệp vụ đã được xác định rõ ràng từ chính tài liệu gốc**, khớp hoàn toàn với KH mục II ("02 lần/ngày vào đầu giờ học buổi sáng và cuối giờ học buổi chiều"), không phải suy luận/giả định của người triển khai. Bảng chấm thứ nhất trong mỗi file = buổi Sáng, bảng thứ hai = buổi Chiều — không còn là điểm cần "chọn cách ít rủi ro nhất", mà là dữ kiện đã xác nhận.

Header cũng cho thấy trên giấy, mỗi buổi có ô "Người chấm" ghi riêng — khớp với thiết kế dữ liệu hiện tại (`judgeEmail`/`judgeName` gắn theo từng bản ghi `Scores`, tách riêng theo `session`).

## 4. Khung giờ Sáng/Chiều — CHỈ mang tính tham khảo, KHÔNG được dùng để tự suy ra hoặc khoá buổi chấm

KH chỉ nêu mốc "7h25–7h30" (ổn định đầu giờ sáng) và mốc ổn định đầu giờ chiều theo 2 khung tiết học (12h40 hoặc 13h30) — không có một mốc "giờ chấm buổi sáng/chiều" duy nhất áp dụng cứng cho toàn trường (các lớp có giờ vào học/tan học lệch nhau), và tài liệu cũng không quy định việc từ chối/khoá chấm điểm nếu nộp trễ giờ.

**Nguyên tắc triển khai:**
- Người chấm **luôn phải tự xác nhận** đang chấm buổi Sáng hay buổi Chiều bằng thao tác chọn rõ ràng trên UI (`/judge`) — hệ thống không tự động suy ra hoặc khoá cứng buổi chấm chỉ dựa trên giờ nộp bài (`submittedAt`).
- Cấu hình khung giờ trong `/admin/settings` (`MORNING_SESSION_START/END`, `AFTERNOON_SESSION_START/END`, `ALLOW_OUTSIDE_HOURS_SCORING`) chỉ được dùng cho các mục đích sau, KHÔNG dùng để chặn submit:
  1. **Đề xuất session mặc định** khi mở `/judge` (dựa theo giờ hiện tại), người chấm vẫn có thể đổi buổi bất kỳ lúc nào trước khi chọn lớp.
  2. **Cảnh báo (không chặn)** khi giờ hiện tại nằm ngoài khung giờ của buổi đang chọn, ví dụ: `session = MORNING`, `submittedAt = 10:02` → vẫn hợp lệ, hệ thống chỉ hiển thị dòng cảnh báo nhẹ, không ngăn người dùng tiếp tục nếu họ xác nhận đúng buổi đang chấm.
  3. **Báo cáo/Audit**: Admin xem được đúng giờ nộp thực tế (`timestamp`) cạnh nhãn buổi (`session`) trong `/admin/results` để tự đối chiếu nếu cần, không cần thêm cột dữ liệu riêng.

## 5. Xếp hạng khi bằng điểm (tie-break)

**Trích KH:** "Trường hợp vẫn bằng nhau, Ban Tổ chức xem xét kết quả thực hiện xuyên suốt các lần chấm trong tháng để quyết định."

Đây là bước ra quyết định định tính, không thể mã hoá thành công thức. `rankClasses()` (`src/lib/ranking/rankClasses.ts`) áp dụng tuần tự 3 tiêu chí phụ tự động được (số lần đạt điểm tối đa → ít điểm trừ hơn → nhiều lượt ghi nhận hành động tốt hơn); nếu vẫn bằng nhau, trả về cờ `needsManualReview: true` cho các lớp đồng hạng — **không tự chọn ngẫu nhiên lớp thắng**.

Để BTC có thể lưu lại quyết định thủ công (và tra cứu lại sau này thay vì chỉ nói miệng/ghi ngoài giấy), bổ sung sheet `RankingDecisions` — Admin ghi nhận: lớp/hạng được quyết định (`manualRankingDecision`), lý do (`decisionReason`), người quyết định (`decidedBy`), thời điểm (`decidedAt`). Khi đã có quyết định thủ công cho một `(năm-tháng, khối)`, `/admin/ranking` hiển thị thứ hạng theo quyết định đã lưu thay vì thứ hạng đồng hạng tự động, kèm nhãn "Đã quyết định thủ công" và lý do.

**"Mức xếp loại cao hơn"** (KH: "(1) Lớp có số lần đạt điểm tối đa **hoặc mức xếp loại cao hơn** nhiều hơn trong tháng") — toàn bộ 4 tài liệu không định nghĩa bảng quy đổi xếp loại (Tốt/Khá/Trung bình...) nào cho điểm ngày/điểm tháng. Chưa triển khai công thức quy đổi xếp loại vì không có căn cứ. Đã dự trù chỗ cấu hình `Settings.GRADING_SCALE_ENABLED` (mặc định `FALSE`) để **bật lên trong tương lai khi BTC cung cấp thang xếp loại chính thức** — hiện tại cờ này chưa được code nào đọc/dùng, chỉ là chỗ trống dự phòng, **không tự tạo thang xếp loại**.

## 6. Điểm cộng/trừ (Adjustments) — chuẩn bị liên kết dữ liệu học sinh (không tự động hoá)

Ngoài `studentName` (tên học sinh, nhập tay), bổ sung field tuỳ chọn `studentCode` (mã học sinh) trong sheet `Adjustments` để sau này có thể đối chiếu/liên kết với dữ liệu học sinh chính thức (ví dụ hệ thống FSP của trường) — đây chỉ là chỗ lưu trữ thêm, **KHÔNG có tích hợp/đồng bộ tự động nào ở MVP**.

**Trích KH:** "Học sinh có vi phạm sẽ không được xếp loại hạnh kiểm Tốt trong tháng." — Đây là hệ quả liên quan hệ thống hạnh kiểm **cá nhân** học sinh, ngoài phạm vi ứng dụng chấm **tập thể lớp** này. MVP chỉ lưu thông tin vi phạm (kèm `studentName`/`studentCode` nếu có) làm minh chứng, **không** tự động tác động đến hệ thống xếp loại hạnh kiểm của trường.

---

*Khi Admin/BTC xác nhận cách xử lý chính thức cho mục 1 (công thức điểm ngày) hoặc mục 2 (nội dung tiêu chí 7), cập nhật trực tiếp qua `/admin/settings` — không cần sửa code.*
