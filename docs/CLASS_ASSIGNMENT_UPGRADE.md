# Nâng cấp: Phân công Giám khảo theo LỚP (không còn theo cả Đợt chấm)

## 1. Lỗi nghiệp vụ hiện tại (đã xác nhận trong code)

`ScoringRoundAssignment` (sheet `ScoringRoundAssignments`) **đã có sẵn** 2 cột
`allowedGradeIdsJson`/`allowedClassIdsJson` để thu hẹp phạm vi chấm của từng
người — thiết kế đúng ngay từ V2. Nhưng có 2 lỗ hổng khiến nó KHÔNG hoạt động
đúng như tên gọi:

1. **`isClassInAssignmentScope()`** (`src/lib/rounds/eligibility.ts`): khi cả
   `allowedClassIds` và `allowedGradeIds` đều rỗng → trả về `true` ("không thu
   hẹp thêm" = được chấm MỌI lớp trong phạm vi Round). Đây là hành vi ngầm định
   sai nghiệp vụ: "có mặt trong Round" bị hiểu thành "được chấm cả Round".
2. **Không UI nào từng ghi `allowedClassIds`.** `CreateRoundDialog.tsx`,
   `RoundDetailClient.tsx` (AddJudgeDialog), `assignAllJudgesAction`,
   `assignMyselfToRoundAction` đều gọi `assignJudgeToRound({ roundId,
   userEmail })` **không có** `allowedClassIds` → luôn rơi vào lỗ hổng (1).

Kết quả thực tế trên production: mọi người được thêm vào một Đợt chấm (kể cả
qua "Chọn tất cả Giám khảo") đều có quyền chấm **tất cả** lớp thuộc Đợt đó —
đúng như báo cáo của BTC.

## 2. Quyết định thiết kế: GIỮ schema hiện tại, sửa logic + thêm UI

Yêu cầu nâng cấp cho phép giữ mô hình `allowedClassIdsJson` (1 dòng =
1 người + 1 round, chứa mảng lớp) **nếu đảm bảo hiệu lực quyền tương đương**
với mô hình "1 dòng = 1 người + 1 lớp". Chọn giữ nguyên vì:

- Không cần đổi cấu trúc cột, không cần di trú dữ liệu tốn kém.
- `assignmentId` vẫn ổn định theo (roundId, userEmail) — không phá vỡ
  `isUserAssignedToRound`, trang Judge, test hiện có.
- Ghi/đọc phân công cho 1 người = 1 lần đọc + 1 lần ghi (mảng lớp trong 1 ô),
  hiệu quả hơn để tách thành N dòng riêng.
- Về mặt kết quả: `allowedClassIds: ["10A1","10A2"]` trên 1 dòng và 2 dòng
  riêng `10A1`/`10A2` cho cùng người tạo ra **quyền giống hệt nhau** khi đã sửa
  lỗ hổng (1).

**Thay đổi cốt lõi (breaking, có chủ đích):**

```
allowedClassIds RỖNG và allowedGradeIds RỖNG  →  KHÔNG được chấm lớp nào
(trước đây: được chấm MỌI lớp trong phạm vi Round)
```

Một dòng assignment tồn tại (`active=true`) nhưng chưa được Admin tick lớp nào
= người đó "có mặt" trong Đợt (xuất hiện trong danh sách để phân công tiếp)
nhưng CHƯA có quyền chấm bất kỳ lớp nào — đúng yêu cầu "phải cấu hình chủ
động, không mặc định".

## 3. Xử lý dữ liệu cũ (KHÔNG suy đoán quyền)

Các dòng assignment đã tạo trước bản vá này (qua `assignAllJudgesAction`,
`assignMyselfToRoundAction`, `CreateRoundDialog`, `AddJudgeDialog` cũ) đều có
`allowedClassIds=[]`. Theo đúng mục 17 của yêu cầu: **không tự suy đoán** dòng
đó "được quyền cả Round" — sau bản vá, các dòng này lập tức về đúng trạng thái
"chưa phân công lớp nào" (an toàn hơn, không phải lỗ hổng bảo mật ngược).
Không xoá, không sửa dữ liệu các dòng này — Admin phải chủ động phân công lại
qua UI mới. `scripts/migrate-round-assignments-v2.ts` là **script kiểm tra
(read-only)**, liệt kê Đợt/người nào đang ở trạng thái này để Admin biết cần
xử lý — không có gì để "di trú" vì dữ liệu cũ không chứa thông tin lớp để suy
ra chính xác.

**Rủi ro dữ liệu**: nếu có Đợt chấm đang `OPEN` tại thời điểm deploy bản vá,
toàn bộ người chấm hiện có (assignment cũ, allowedClassIds rỗng) sẽ NGAY LẬP
TỨC mất quyền submit cho tới khi Admin phân công lại theo lớp. Đây là thay đổi
có chủ đích (đúng nghiệp vụ), không phải lỗi — nhưng cần thông báo trước khi
deploy nếu đang có Đợt chấm thật đang diễn ra.

## 4. Các hàm data-access mới (`src/lib/google/sheets.ts`)

Thêm trên nền dữ liệu hiện tại (không đổi cột):

- `getAssignedClassesForUser(roundId, userEmail)` — trả về scope thô của 1 người.
- `getAssignedUsersForClass(roundId, classId, grade)` — quét toàn bộ assignment
  active của Round, lọc bằng `isClassInAssignmentScope` đã sửa.
- `assignUserToClass` / `removeUserFromClass` — thêm/bớt 1 lớp khỏi mảng của 1 người.
- `bulkAssignUserToClasses` — hợp (union) nhiều lớp vào mảng của 1 người.
- `replaceAssignmentsForUser` — THAY THẾ toàn bộ mảng lớp của 1 người (dùng cho
  nút "Lưu phân công" ở tab Theo người).
- `setClassAssignees(roundId, classId, grade, userEmails)` — tính diff rồi ghi
  hàng loạt (dùng cho tab Theo lớp: nhiều người cho 1 lớp), qua
  `batchUpdateRows` mới (1 lần đọc + 1 lần `values.batchUpdate` cho toàn bộ
  thay đổi, không gọi API riêng từng dòng).
- `canScoreClassInRound(userEmail, roundId, classId)` — helper tổng hợp
  round + assignment + class + `checkRoundEligibility`, dùng trong
  `submitRoundScoreAction` (nguồn sự thật DUY NHẤT cho quyền submit).

`src/lib/google/sheetRepo.ts` thêm `batchUpdateRows()` — đọc 1 lần, ghi nhiều
dòng trong 1 lệnh `spreadsheets.values.batchUpdate`, tránh N round-trip khi
lưu phân công nhiều người/nhiều lớp cùng lúc.

## 5. UI Admin

`RoundDetailClient.tsx`: thay khối "Người được phân công" (chip + nút Thêm)
bằng `AssignmentPanel.tsx` (2 tab: **Theo người** / **Theo lớp**, đọc/ghi
chung 1 nguồn dữ liệu). Bảng danh sách lớp hiện thêm cột "Người được phân
công" với badge "⚠ CHƯA PHÂN CÔNG" nổi bật, filter "chỉ lớp chưa phân công".
Card ở `/admin/scoring-rounds` hiện thêm dòng "Phân công: X/Y lớp".

## 6. Judge UI

`isClassInAssignmentScope` đã sửa → `RoundClassPicker`/`JudgePage` (vốn đã
lọc đúng bằng hàm này) tự động chỉ hiện lớp thực sự được phân công, không cần
sửa cấu trúc — chỉ chỉnh câu chữ tiến độ ("Đã chấm: 3/5 lớp được phân công").

## 7. Không đổi

- `checkDuplicateRoundScore`, cơ chế Score/Adjustments, Criteria snapshot.
- Cột Google Sheet — không thêm/bớt cột nào.
- `assignmentId` vẫn 1-1 với (roundId, userEmail).
