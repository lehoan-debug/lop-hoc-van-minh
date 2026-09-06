# PHÂN TÍCH NGHIỆP VỤ — LỚP HỌC VĂN MINH

> Tài liệu này được trích xuất **nguyên văn** từ 4 file Word gốc bằng cách đọc trực tiếp XML của file `.docx`
> (`word/document.xml`) để tránh lỗi mất chữ / mất xuống dòng khi các công cụ parser thông thường xử lý bảng biểu.
> Nguồn:
> 1. `KH Lớp học văn minh.docx` (Kế hoạch, sau đây gọi là **KH**)
> 2. `Bảng chấm LHVM - Khối 10.docx` (**BC10**)
> 3. `Bảng chấm LHVM - Khối 11.docx` (**BC11**)
> 4. `Bảng chấm LHVM - Khối 12.docx` (**BC12**)
>
> Các điểm chưa thống nhất / chưa rõ giữa các tài liệu được liệt kê riêng tại [`BUSINESS_RULES_REVIEW.md`](../BUSINESS_RULES_REVIEW.md) — **không tự suy đoán** để lấp khoảng trống.

---

## 1. Bối cảnh

Trường TH, THCS và THPT FPT (THPT FPT Đà Nẵng) phát động phong trào **"Lớp học văn minh"** năm học 2026–2027,
triển khai từ tháng 08/2026 đến hết tháng 05/2027.

- **Tần suất chấm:** 02 lần/ngày — đầu giờ học buổi sáng và cuối giờ học buổi chiều.
- **Giờ liên quan (KH, mục II.4 lịch biểu sinh hoạt):**
  - 7h25–7h30: học sinh ổn định tại lớp, sinh hoạt đầu giờ (mốc tham chiếu buổi Sáng).
  - Buổi trưa: lớp tan 10h55 → có mặt lớp/KTX trước 11h40; lớp tan 11h45 → có mặt trước 12h30 (không phải buổi chấm, chỉ là căn cứ điểm danh bán trú, liên quan tiêu chí 9).
  - Đầu giờ chiều: lớp học tiết 12h45 → ổn định lúc 12h40; lớp học tiết 13h35 → ổn định lúc 13h30 (mốc tham chiếu buổi Chiều).
- **Thành phần giám khảo:** Đại diện Chi đoàn giáo viên, toàn thể cán bộ giáo viên nhà trường (theo phân công lịch), cùng một học sinh trong Ban chấp hành Đoàn trường/Ban chấp hành các lớp.
- **Đối tượng tham gia:** Tất cả các lớp.

## 2. Danh sách lớp (trích nguyên văn từ 3 bảng chấm — cột tiêu đề bảng)

### Khối 10 — 15 lớp (nguồn: BC10)
```
10A1, 10A2, 10A3, 10A4, 10A5, 10A6, 10A7, 10A8, 10A9, 10A10, 10A11, 10A12, 10A13, 10A14, 10A15
```

### Khối 11 — 8 lớp (nguồn: BC11)
```
11A1, 11A2, 11A3, 11A4, 11A5, 11A6, 11A7, 11A8
```

### Khối 12 — 16 lớp (nguồn: BC12)
```
12A1, 12A2a, 12A2b, 12A3, 12A4, 12A5, 12A6, 12A7, 12A8, 12A9, 12A10, 12A11, 12A12, 12A13, 12A14, 12A15
```

Lưu ý: Khối 12 có lớp `12A2a` và `12A2b` (tách đôi lớp 12A2) — đây là dữ liệu gốc, giữ nguyên, không gộp/sửa.

Tổng: 15 + 8 + 16 = **39 lớp**.

## 3. 11 tiêu chí chấm điểm (trích nguyên văn — giống hệt nhau ở cả KH, BC10, BC11, BC12)

| STT | Tiêu chí (nguyên văn) |
|---|---|
| 1 | Rác được bỏ gọn vào thùng. |
| 2 | Toàn bộ balo, cặp đặt gọn ở đúng khu vực quy định (hộc bàn/tủ locker) Không có balo, cặp đặt giữa lối đi. |
| 3 | Không có dây điện, ổ cắm điện kéo dài chắn lối đi hoặc nằm trực tiếp giữa sàn. |
| 4 | Sách vở, dụng cụ học tập được đặt gọn gàng (trên mặt bàn/trong hộc bàn), không bừa bộn. |
| 5 | Không có đồ dùng cá nhân đặt ở sàn nhà, bệ cửa sổ |
| 6 | Bàn giáo viên được sắp xếp gọn gàng, sạch sẽ |
| 7 | Kiểm tra ngẫu nhiên tủ locker, học sinh sắp xếp đồ dùng gọn gàng, không |
| 8 | Đảm bảo 100% học sinh mang đồng phục đúng quy định  + HS Nam: Áo cam, quần be. Áo bỏ vào quần. Giày/Dép có quai sau. Không có tóc sáng màu. + HS nữ: Áo cam, quần/váy be. Áo bỏ vào quần/váy. Chiều dài váy chạm đầu gối. Giày/dép có quai sau. Không có tóc sáng màu. |
| 9 | Học sinh về sinh hoạt buổi trưa (Nội trú/Bán trú) đúng giờ quy định |
| 10 | Xếp ghế gọn gàng trên bàn cuối mỗi buổi học (Sáng và chiều) |
| 11 | Đầu giờ học buổi chiều, lớp ổn định nề nếp, tác phong, vệ sinh lớp học (theo các tiêu chí từ 1-8) trước khi vào tiết học. |

> ⚠️ **Tiêu chí 7 bị cắt cụt ngay trong văn bản gốc** (kết thúc bằng "...gọn gàng, không " rồi hết câu) — đã xác minh bằng cách đọc raw XML, đây **không phải lỗi parser** mà là lỗi có sẵn trong cả 4 file gốc (KH, BC10, BC11, BC12 đều giống hệt nhau). Theo đúng nguyên tắc "không tự bổ sung câu chữ theo suy đoán", tiêu chí 7 được lưu **nguyên văn kể cả phần cụt** trong cấu hình `Criteria`, và vấn đề này được ghi vào `BUSINESS_RULES_REVIEW.md` để Admin/BTC xác nhận và tự sửa lại qua trang `/admin/settings` (mô tả tiêu chí có thể chỉnh sửa được, không hard-code cứng trong source).

## 4. Nguyên tắc chấm điểm (KH mục III.2)

> "Giáo viên chỉ chấm Đạt hoặc Không đạt cho tất cả các tiêu chí."
> - **Đạt:** Đảm bảo 100% tiêu chí, không có ngoại lệ — được **1 điểm**.
> - **Không đạt:** Khi có ít nhất 1 vi phạm đối với tiêu chí — **0 điểm**.

⇒ Mỗi tiêu chí là nhị phân 0/1. Tổng điểm chấm BGK của 1 lượt chấm (1 lớp / 1 buổi) = tổng 11 tiêu chí, tối đa 11 điểm — đúng như tiêu đề bảng chấm: *"Tương ứng với mỗi tiêu chí: 100% lớp đạt tiêu chí = 1 điểm; không đạt 100% = 0 điểm"*, và dòng **"Tổng điểm chấm của BGK"** ở cuối mỗi bảng trong BC10/BC11/BC12.

## 5. Buổi chấm (Sáng / Chiều)

Mỗi bảng chấm theo khối (BC10/BC11/BC12) có **2 bảng giống hệt nhau** (cùng 11 tiêu chí, cùng danh sách lớp), tiếp nối nhau, đều có ghi chú cuối bảng: *"Lưu ý: Ban giám khảo chỉ điền cho tiêu chí từ 1 – 11 và tính tổng điểm. Mục điểm cộng/điểm trừ sẽ được BTC ghi nhận trong ngày."*

Văn bản **không có nhãn chữ "Sáng"/"Chiều"** gắn trực tiếp vào từng bảng — việc có 2 bảng/khối được suy ra từ KH mục II ("Tần suất chấm: 02 lần/ngày vào đầu giờ học buổi sáng và cuối giờ học buổi chiều"). Xem mục tương ứng trong `BUSINESS_RULES_REVIEW.md`.

## 6. Điểm thưởng / điểm trừ (KH mục III.3, bảng "Điểm thưởng | Điểm trừ")

- **Điểm thưởng:** Tập thể lớp được cộng điểm thi đua khi học sinh trong lớp có hành động tích cực, gương người tốt – việc tốt, được cán bộ giáo viên nhà trường trực tiếp ghi nhận (hành động trung thực, chủ động giúp đỡ người khác, hành động đẹp góp phần xây dựng môi trường học đường văn minh...). *"Mỗi hành động đẹp được ghi nhận sẽ giúp tập thể lớp được cộng 01 điểm của ngày."* Việc cộng điểm được xem xét theo từng trường hợp cụ thể.
- **Điểm trừ:** Tập thể lớp bị trừ điểm thi đua khi học sinh trong lớp vi phạm nội quy, có hành vi/ngôn ngữ/hình ảnh không phù hợp, được cán bộ/giáo viên/nhân viên trực tiếp phát hiện, ghi nhận. *"Mỗi học sinh có hành vi vi phạm được xác định và ghi nhận sẽ làm tập thể lớp bị trừ 01 điểm của ngày. Học sinh có vi phạm sẽ không được xếp loại hạnh kiểm Tốt trong tháng."*
- Điểm cộng/trừ mặc định là **±1 điểm mỗi lần ghi nhận** (nhiều lần ghi nhận trong ngày thì cộng dồn).
- **Bắt buộc lưu:** thời gian, địa điểm, nội dung sự việc, người ghi nhận. *"Thông tin được ghi nhận và tổng hợp tại Phòng Công tác học sinh."*
- Việc ghi nhận điểm cộng/trừ **không do người chấm (giám khảo chấm 11 tiêu chí) thực hiện trong màn hình chấm** — đây là nghiệp vụ của BTC/Phòng Công tác học sinh/Admin (ứng với role ADMIN/SUPER_ADMIN trong app), khớp với chỉ dẫn ở mục N của yêu cầu.
- "Học sinh có vi phạm sẽ không được xếp loại hạnh kiểm Tốt trong tháng" — liên quan hệ thống hạnh kiểm cá nhân học sinh, **ngoài phạm vi MVP** (app chấm theo tập thể lớp). Trường `studentName` trong `Adjustments` được lưu lại làm minh chứng nhưng không tự động đồng bộ sang hệ thống hạnh kiểm.

## 7. Điểm ngày (KH mục III.4.a)

> "Điểm 'Lớp học văn minh' mỗi ngày = Điểm chấm của BGK trong ngày + Điểm thưởng trong ngày (nếu có) – Điểm trừ trong ngày (nếu có)"

⚠️ Tài liệu dùng số ít "**Điểm chấm của BGK trong ngày**" trong khi mỗi ngày có **2 lượt chấm** (sáng + chiều) độc lập, mỗi lượt tối đa 11 điểm. Tài liệu **không nêu rõ** cách kết hợp 2 lượt chấm sáng/chiều thành một con số duy nhất (cộng tổng tối đa 22, hay lấy trung bình tối đa 11). Đây là điểm nghiệp vụ **quan trọng nhất chưa thống nhất** — xem chi tiết & giải pháp triển khai tại `BUSINESS_RULES_REVIEW.md` mục 1.

## 8. Xếp hạng tháng (KH mục III.4.a)

> "Điểm xếp hạng tháng của mỗi lớp được xác định trên cơ sở điểm bình quân các lần chấm trong tháng."
> "Điểm xếp hạng mỗi tháng = Điểm trung bình của tất cả các ngày trong tháng"

- Xếp hạng **riêng theo từng khối** (10, 11, 12).
- Mỗi tháng chọn **02 lớp/khối** (tổng 06 lớp/3 khối/tháng) đạt điểm cao + đủ điều kiện để trao cờ thi đua.
- **Tie-break khi bằng điểm xếp hạng** (áp dụng tuần tự):
  1. Lớp có **số lần đạt điểm tối đa** (hoặc mức xếp loại cao hơn) **nhiều hơn** trong tháng;
  2. Lớp có **ít điểm trừ hơn**;
  3. Lớp có **số lượt ghi nhận hành động tốt/việc tốt nhiều hơn**;
  4. Nếu vẫn bằng nhau: **Ban Tổ chức xem xét thủ công** kết quả thực hiện xuyên suốt các lần chấm trong tháng để quyết định (không thể tự động hoá hoàn toàn bước này — app sẽ đánh dấu "cần BTC quyết định thủ công" khi đến bước 4).
- "Mức xếp loại cao hơn" trong tie-break (1) không có bảng quy đổi xếp loại (A/B/C...) nào được định nghĩa trong toàn bộ 4 tài liệu ⇒ chỉ triển khai phần **"số lần đạt điểm tối đa"**, phần "mức xếp loại" được ghi chú TODO chờ bổ sung sau (xem review doc).

## 9. Xét chọn cuối năm (KH mục III.4.b)

> "Điểm xét chọn cuối năm = Điểm bình quân kết quả thực hiện các tháng trong năm học." (đã bao gồm điểm chấm, điểm thưởng, điểm trừ theo tháng)

- Chọn riêng theo từng khối, mỗi khối 02 lớp ⇒ tổng 06 lớp toàn trường/năm học, danh hiệu **"TẬP THỂ LỚP HỌC VĂN MINH NĂM HỌC ..."**

## 10. Nguyên tắc công khai, minh bạch (KH mục III.4.c)

- Toàn bộ tiêu chí, cách tính điểm, điểm thưởng, điểm trừ, điều kiện xét chọn phải công bố trước khi triển khai.
- Kết quả chấm điểm phải được lưu trữ theo **từng ngày, từng tháng, từng học kỳ**.

## 11. Quy định về người chấm (KH mục III.1, IV.3)

- Giám khảo = đại diện Chi đoàn GV + toàn thể CBGV (phân công theo lịch) + 1 học sinh BCH Đoàn trường/BCH lớp.
- Cán bộ giáo viên: làm gương, phối hợp nhắc nhở HS, ghi nhận hành động tốt/vi phạm đúng quy trình do BTC quy định.
- Giáo viên chủ nhiệm: phổ biến tiêu chí, theo dõi kết quả chấm của lớp mình, tổ chức HS tự rà soát trước khi chấm.
- Không có quy định nào giới hạn 1 giám khảo chỉ được chấm 1 khối cố định trong văn bản — việc giới hạn `allowedGrades` theo tài khoản (mục C/D của yêu cầu) là cơ chế **quản trị vận hành do nhà trường tự cấu hình qua sheet `Users`**, không mâu thuẫn với tài liệu gốc.

## 12. Kinh phí (KH mục V) — không liên quan đến logic phần mềm, chỉ tham khảo.

## 13. Tóm tắt luồng nghiệp vụ (workflow)

```
Giám khảo đăng nhập (Google OAuth, phải có trong sheet Users, active=TRUE)
  → chọn Buổi (Sáng/Chiều) — mặc định theo giờ hệ thống, cho phép chọn lại
  → chọn Khối (chỉ hiện khối trong allowedGrades)
  → chọn Lớp (chỉ hiện lớp active, đánh dấu lớp đã/chưa chấm buổi này)
  → chấm 11 tiêu chí (Đạt/Không đạt, ghi chú khi Không đạt)
  → xem tổng điểm tự động (x/11)
  → xác nhận & gửi
  → hệ thống kiểm tra trùng (date+session+classId+judgeEmail)
  → ghi vào sheet Scores, ghi AuditLog(SUBMIT_SCORE)

BTC/Admin ghi nhận điểm cộng/trừ (ngoài luồng chấm 11 tiêu chí) → sheet Adjustments, AuditLog(ADD_BONUS/ADD_PENALTY)

Admin xem dashboard: điểm ngày = f(điểm BGK trong ngày, tổng thưởng ngày, tổng trừ ngày) — theo calculateDailyScore() cấu hình được
Admin xem xếp hạng tháng/năm theo rankClasses() với tie-break đúng thứ tự trên
```

## 14. Danh sách vấn đề nghiệp vụ chưa thống nhất

→ Xem đầy đủ tại [`BUSINESS_RULES_REVIEW.md`](../BUSINESS_RULES_REVIEW.md).
