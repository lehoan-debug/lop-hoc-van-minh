# V2 UPGRADE ANALYSIS — Lớp học Văn minh

> Tài liệu này mô tả hiện trạng V1 (đã deploy production), phạm vi thay đổi V2, schema cũ/mới, chiến lược migration an toàn (không mất dữ liệu, backward-compatible), và các nguy cơ. Viết trước khi sửa code, theo đúng yêu cầu nâng cấp V2.

## 1. Hiện trạng V1 (đã đọc lại toàn bộ code + sheet thật)

### 1.1 Authentication / Authorization
- Auth.js v5, Google OAuth. `src/lib/auth/auth.config.ts` (edge-safe, dùng cho `src/proxy.ts`) + `src/lib/auth/auth.ts` (đầy đủ, Node runtime, gọi Google Sheets trong `signIn`/`jwt` callback).
- **1 tài khoản = 1 role duy nhất**: `AppUser.role: "JUDGE" | "ADMIN" | "SUPER_ADMIN"`. Không có `HOMEROOM_TEACHER`. Không hỗ trợ nhiều role/tài khoản.
- `allowedGrades: Grade[] | "ALL"` — giới hạn khối được phép chấm, gắn trực tiếp vào User (không theo từng đợt/lượt chấm).
- `src/lib/auth/session.ts`: `requireUser()`, `requireRole(roles)`, `canAccessGrade(user, grade)`.
- `src/proxy.ts` (Edge Runtime, matcher `/judge/:path*`, `/admin/:path*`): chặn thô theo `role` đơn (redirect `/admin` nếu không phải ADMIN/SUPER_ADMIN). Đây là **lớp chặn nhanh**, không phải biên bảo mật duy nhất — mọi Server Action/route đều tự kiểm tra lại.

### 1.2 Google Sheets (spreadsheet thật đang chạy production)
7 sheet hiện có (`src/lib/google/schema.ts`): `Users, Classes, Criteria, Scores, Adjustments, Settings, AuditLog, RankingDecisions` (RankingDecisions mới thêm ở bản vá nghiệp vụ trước, chưa có dữ liệu).

- **Users**: `email, name, role, active, allowedGrades, createdAt, updatedAt`. Hiện có đúng 1 dòng (`taithuhavn1992@gmail.com`, SUPER_ADMIN).
- **Classes**: `classId, className, grade, active, sortOrder`. 39 lớp, khớp 3 file Word gốc.
- **Criteria**: `criterionId, criterionNumber, criterionName, description, active, sortOrder, needsReview`. 11 tiêu chí cố định, PASS/FAIL ngầm định mỗi tiêu chí = 1 điểm (không có cột điểm).
- **Scores**: `submissionId, timestamp, date, session, grade, classId, className, judgeEmail, judgeName, c1..c11, totalCriteriaScore, notesJson, deletedAt, createdAt, updatedAt`. Không có khái niệm "Đợt chấm" — khoá trùng hiện tại là `(date, session, classId, judgeEmail)`. Hiện **chưa có dữ liệu Scores nào** (production mới xong phần đăng nhập, chưa ai chấm điểm thật).
- **Adjustments, Settings, AuditLog, RankingDecisions**: như thiết kế V1, không có gì cần lưu ý thêm.

### 1.3 Server Actions / API
- `src/lib/actions/judgeActions.ts`: `submitScoreAction()` — validate Zod, check quyền khối (`canAccessGrade`), check lớp active, check trùng theo `(date,session,classId,judgeEmail)`, ghi `Scores`, ghi `AuditLog`.
- `src/lib/actions/adminActions.ts`: CRUD Adjustments, sửa/xoá mềm Scores, quản lý User (role đơn), Settings, bật/tắt Classes/Criteria, sửa mô tả Criteria, lưu quyết định xếp hạng thủ công (`RankingDecisions`).
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/admin/export/route.ts` (CSV, không phải xlsx).

### 1.4 Giao diện Judge
- `/judge` (`JudgeHome.tsx`): chọn buổi (Sáng/Chiều — không phải "Đợt chấm"), chọn khối, chọn lớp (card lớn, đánh dấu đã chấm). Không có khái niệm lịch/khung giờ đợt chấm theo entity riêng — chỉ có `Settings.MORNING_SESSION_START/END` làm gợi ý + cảnh báo mềm.
- `/judge/[classId]` (`ScoringScreen.tsx`): chấm 11 tiêu chí cố định (PASS/FAIL, mỗi tiêu chí luôn 1 điểm), có nút "Đánh dấu tất cả Đạt", có màn hình xác nhận (`Dialog`) trước khi gửi — **đã có bước xem lại/xác nhận**, nhưng chưa tách hẳn thành "màn hình Review" độc lập theo đúng đặc tả V2 mục M. State giữ ở React + localStorage draft (đã đúng nguyên tắc "không ghi Sheet khi bấm từng tiêu chí").
- `/judge/history`, `/judge/account`.

### 1.5 Giao diện Admin
- `/admin` (dashboard theo ngày/buổi/khối/lớp/người chấm), `/admin/results`, `/admin/ranking` (+ bảng tham khảo khi `DAILY_SCORE_COMBINE_MODE=UNCONFIRMED`), `/admin/adjustments`, `/admin/criteria-analysis`, `/admin/users` (CRUD role đơn), `/admin/settings` (bật/tắt lớp, bật/tắt + sửa mô tả tiêu chí, cấu hình chung).
- Không có `/admin/scoring-rounds`, không có giao diện chấm cho Admin, không có `/homeroom`.

### 1.6 Scoring / Criteria / Ranking
- `src/lib/scoring/dailyScore.ts`: `calculateDailyScore()` — cộng/trung bình điểm buổi Sáng+Chiều theo `Settings.DAILY_SCORE_COMBINE_MODE` (`SUM | AVERAGE | UNCONFIRMED`, mặc định `UNCONFIRMED` — xem `BUSINESS_RULES_REVIEW.md` mục 1). Hằng số `CRITERIA_COUNT = 11` hard-code ở `src/types/index.ts`, dùng để tính điểm tối đa mỗi buổi.
- `src/lib/ranking/rankClasses.ts`: xếp hạng tháng theo khối, tie-break 3 bước tự động + `needsManualReview`.
- `src/config/criteria.ts`, `src/config/classes.ts`: seed data tĩnh, KHÔNG phải nguồn dữ liệu runtime (runtime luôn đọc từ Sheet).

### 1.7 Settings / AuditLog
- `AppSettings` gồm: `DAILY_SCORE_COMBINE_MODE, MORNING/AFTERNOON_SESSION_START/END, ALLOW_OUTSIDE_HOURS_SCORING, CURRENT_SCHOOL_YEAR, ENABLED_GRADES, GRADING_SCALE_ENABLED` (cái cuối dự trù, chưa dùng).
- `AuditAction` hiện có: `LOGIN, SUBMIT_SCORE, EDIT_SCORE, DELETE_SCORE, ADD_BONUS, ADD_PENALTY, EDIT_ADJUSTMENT, DELETE_ADJUSTMENT, UPDATE_SETTINGS, UPDATE_USER, SAVE_RANKING_DECISION`.

## 2. Phạm vi thay đổi V2 (tóm tắt theo yêu cầu)

| # | Thay đổi | Mức ảnh hưởng |
|---|---|---|
| 1 | Multi-role (`roles: UserRole[]`) + role mới `HOMEROOM_TEACHER` | Đổi type + toàn bộ nơi đọc `user.role` (~20 chỗ) |
| 2 | Phân quyền cấp Admin chỉ SUPER_ADMIN được cấp/thu hồi ADMIN/SUPER_ADMIN | `adminActions.ts`, `session.ts` |
| 3 | Admin/SUPER_ADMIN có giao diện chấm, nhưng phải được **phân công vào Đợt chấm** mới submit được | Entity mới `ScoringRound` + `ScoringRoundAssignments` |
| 4 | Đợt chấm tự mở/khoá theo `startsAt/endsAt`, khoá thủ công | `getEffectiveRoundStatus()`, sheet mới |
| 5 | Tiêu chí động, có điểm (decimal), theo khối, Admin CRUD, archive không xoá | Sheet `Criteria` thêm cột, bỏ hard-code `CRITERIA_COUNT=11` |
| 6 | Snapshot tiêu chí tại thời điểm chấm (không tính lại theo tiêu chí hiện tại) | Sheet `Scores` thêm cột |
| 7 | Luồng chấm: Chấm → Xem lại → Xác nhận → Lưu (chỉ ghi Sheet ở bước cuối) | Đã có 80% ở V1 (Dialog xác nhận), cần tách rõ màn Review + gắn với Round |
| 8 | GVCN (`/homeroom`) | Route + query mới, dùng `homeroomClassIds` |
| 9 | Menu theo vai trò (không hard-code sidebar) | `AdminNav`, `BottomNav` |
| 10 | Xuất Excel (.xlsx) nhiều sheet | Thêm dependency `xlsx`, route mới |
| 11 | AuditLog mở rộng action | Thêm hằng số `AuditAction`, gọi `appendAuditLog` tại các action mới |
| 12 | Duplicate rule V2: `roundId + classId` (mặc định 1 kết quả chính thức/lớp/đợt) | Thay `checkDuplicateScore` cũ bằng `checkDuplicateRoundScore`, **giữ nguyên hàm cũ** cho tương thích |

## 3. Schema cũ → mới (chi tiết từng sheet)

Nguyên tắc chung cho MỌI sheet: **chỉ thêm cột ở cuối, không xoá/đổi tên cột cũ, không đổi thứ tự cột cũ.** `sheetRepo.ts` đọc theo tên cột (object theo header), không theo vị trí — dòng dữ liệu cũ thiếu cột mới sẽ tự nhận giá trị `""` khi đọc, không lỗi.

### 3.1 `Users`
| Cột cũ (giữ nguyên) | Cột mới (thêm cuối) |
|---|---|
| email, name, role, active, allowedGrades, createdAt, updatedAt | `rolesJson`, `homeroomClassIdsJson` |

- Đọc: nếu `rolesJson` rỗng/không parse được → fallback `roles = [role || "JUDGE"]` (đúng yêu cầu mục A). `role` (số ít) từ nay là **field dẫn xuất** = role cao nhất trong `roles` (SUPER_ADMIN > ADMIN > JUDGE > HOMEROOM_TEACHER), luôn tính lại khi đọc — không tin cột `role` cũ nếu `rolesJson` đã có.
- Ghi: luôn ghi cả `role` (dẫn xuất, để ai mở Sheet bằng mắt vẫn đọc được) **và** `rolesJson` (nguồn sự thật).
- Dòng `taithuhavn1992@gmail.com` hiện tại (`role=SUPER_ADMIN`, chưa có `rolesJson`) → đọc ra `roles=["SUPER_ADMIN"]` tự động, không cần script chạy tay, nhưng vẫn cung cấp `scripts/migrate-v2.ts` để ghi tường minh `rolesJson` vào sheet cho rõ ràng.

### 3.2 `Criteria`
| Cột cũ (giữ nguyên) | Cột mới (thêm cuối) |
|---|---|
| criterionId, criterionNumber, criterionName, description, active, sortOrder, needsReview | `maxScore`, `scoringType`, `gradeIdsJson`, `createdAt`, `updatedAt` |

- `maxScore` cột mới, dòng cũ đọc ra `""` → fallback **1** (đúng hành vi V1: mỗi tiêu chí Đạt = 1 điểm) → **không đổi kết quả tính điểm của dữ liệu đã chấm**.
- `scoringType` fallback `"PASS_FAIL"` (duy nhất loại hỗ trợ ở V2 này, đúng yêu cầu mục O).
- `gradeIdsJson` rỗng = áp dụng mọi khối (giữ hành vi cũ).
- Không đổi tên `criterionName` thành `name` (tránh phá vỡ mọi chỗ đang đọc field này) — type TypeScript vẫn dùng `criterionName`, chỉ nội bộ, không lộ ra Sheet.

### 3.3 `Scores`
| Cột cũ (giữ nguyên) | Cột mới (thêm cuối) |
|---|---|
| submissionId, timestamp, date, session, grade, classId, className, judgeEmail, judgeName, c1..c11, totalCriteriaScore, notesJson, deletedAt, createdAt, updatedAt | `roundId`, `criteriaSnapshotJson`, `answersJson`, `totalScore`, `maxPossibleScore` |

- Bản ghi **V1 (legacy)**: có `c1..c11` + `totalCriteriaScore`, KHÔNG có `roundId`. Đọc bằng `getEffectiveScore(score) = score.totalScore ?? score.totalCriteriaScore` (giữ nguyên toàn bộ logic `dailyScore.ts`/`aggregate.ts` đang chạy).
- Bản ghi **V2 (round-based)**: có `roundId`, `criteriaSnapshotJson` (mảng tiêu chí tại thời điểm chấm, gồm `criterionId, name, maxScore, result, awardedScore`), `answersJson`, `totalScore`, `maxPossibleScore`. Cột `c1..c11`/`totalCriteriaScore` để trống (không cố nhồi tiêu chí động vào 11 cột cố định — nếu về sau có round dùng đúng ≤11 tiêu chí theo đúng thứ tự cũ có thể cân nhắc điền thêm, nhưng **không bắt buộc** vì mọi chỗ đọc điểm đã chuyển sang `getEffectiveScore()`).
- **Không có script "chuyển đổi ngược"** c1..c11 → snapshot cho dữ liệu cũ vì V1 hiện **chưa có dòng Scores nào trên production** (đã kiểm tra qua Drive — sheet Scores đang trống). Rủi ro migration dữ liệu thật = 0 ở thời điểm này. Nếu sau này phát sinh dữ liệu V1 trước khi kịp deploy V2, `scripts/migrate-v2.ts` có kèm hàm `backfillLegacyScoreSnapshot()` (idempotent — bỏ qua dòng đã có `criteriaSnapshotJson`) để tạo snapshot xấp xỉ từ `c1..c11` + Criteria hiện tại, đánh dấu rõ `criteriaSnapshotJson.approximated = true`.

### 3.4 Sheet mới: `ScoringRounds`
```
roundId, title, description, session, startsAt, endsAt, status,
gradeIdsJson, classIdsJson, activeCriteriaSetId,
createdBy, createdAt, updatedAt, manuallyLockedAt, manuallyLockedBy
```
`status` lưu trạng thái **do Admin đặt** (`DRAFT/SCHEDULED/OPEN/LOCKED/CANCELLED`) — trạng thái **hiệu lực thực tế** hiển thị cho người dùng luôn tính lại bằng `getEffectiveRoundStatus(round, now)` (không tin `status` đã lưu cho việc OPEN/LOCKED theo giờ, chỉ dùng lưu `DRAFT`/`CANCELLED`/khoá thủ công).

### 3.5 Sheet mới: `ScoringRoundAssignments`
```
assignmentId, roundId, userEmail, allowedGradeIdsJson, allowedClassIdsJson,
active, assignedBy, assignedAt
```

## 4. Chiến lược Migration

1. **Không xoá, không đổi tên, không đổi thứ tự cột cũ** ở bất kỳ sheet nào (đã trình bày ở mục 3).
2. `ensureSheetWithHeader()` (đã có từ V1, `src/lib/google/sheetRepo.ts`) chỉ **ghi đè hàng header (A1:*1)** — không đụng dữ liệu từ hàng 2 trở đi — dùng lại nguyên xi cho các cột mới.
3. `scripts/migrate-v2.ts` (mới, idempotent — chạy lại nhiều lần an toàn):
   - Tạo header cho `ScoringRounds`, `ScoringRoundAssignments` (sheet trống, không có gì để mất).
   - Cập nhật header `Users`, `Criteria`, `Scores` (thêm cột mới, dữ liệu cũ nguyên vẹn).
   - Với mỗi dòng `Users` chưa có `rolesJson`: ghi `rolesJson=[role hiện tại]`, `homeroomClassIdsJson=[]`.
   - Với mỗi dòng `Criteria` chưa có `maxScore`: ghi `maxScore=1`, `scoringType=PASS_FAIL`, `gradeIdsJson=[]`, `createdAt/updatedAt=now`.
   - **Không đụng vào `Scores`** (không có dữ liệu cần backfill ở thời điểm hiện tại — xem mục 3.3).
4. Trước khi chạy migration trên sheet thật, kiểm tra lại bằng Drive `read_file_content` để xác nhận không có gì bất ngờ (đã làm ở các bước trước, sheet hiện đúng như phân tích).

## 5. Nguy cơ ảnh hưởng dữ liệu cũ & cách giảm thiểu

| Nguy cơ | Mức độ | Giảm thiểu |
|---|---|---|
| Ghi đè header làm mất dữ liệu dòng cũ | Thấp (đã dùng `ensureSheetWithHeader` an toàn từ V1, chỉ ghi hàng 1) | Không đổi hàm này, chỉ thêm tên cột vào mảng `HEADERS` |
| Code cũ đọc `user.role` (single) sau khi đổi sang `roles[]` | Trung bình (~20 chỗ) | `role` vẫn tồn tại như field dẫn xuất, tất cả chỗ cũ tiếp tục compile & chạy đúng; đổi dần sang `roles`/`hasRole()` ở nơi cần phân quyền chi tiết hơn |
| `CRITERIA_COUNT = 11` hard-code làm sai điểm tối đa khi Admin thêm/bớt tiêu chí | Cao nếu không sửa | Thay mọi chỗ dùng `CRITERIA_COUNT` cho **tính điểm** bằng tổng `maxScore` của tiêu chí thực tế trong round/snapshot; giữ `CRITERIA_COUNT` chỉ cho phần hiển thị legacy (11 tiêu chí V1) |
| Trang `/judge` V1 (chọn buổi trực tiếp, không qua Round) bị thay đổi hành vi đột ngột khi đang có người dùng thật | Thấp (chưa có ai ngoài SUPER_ADMIN dùng thật, Scores đang trống) | Vẫn triển khai thẳng luồng Round-based làm luồng chính (đúng yêu cầu), vì rủi ro dữ liệu = 0 |
| Duplicate rule đổi từ `(date,session,classId,judgeEmail)` sang `(roundId,classId)` làm lộ lỗ hổng nếu còn nơi gọi hàm cũ | Thấp | Giữ nguyên `checkDuplicateScore()` cũ (không xoá), thêm `checkDuplicateRoundScore()` mới dùng riêng cho luồng Round; `submitScoreAction` cũ (nếu còn được gọi) không đổi hành vi |

## 6. Kế hoạch triển khai

Theo đúng 14 phase đã nêu trong yêu cầu (mục AJ). Từ Phase 2 trở đi sẽ chạy `typecheck && lint && test && build` sau mỗi phase lớn, sửa lỗi trước khi sang phase kế tiếp. Chi tiết file thêm/sửa, sheet/cột mới, biến môi trường (không có biến mới), và các thao tác thủ công cần Admin thực hiện trên Google Sheets/Vercel sẽ được tổng hợp trong báo cáo cuối cùng sau khi hoàn tất Phase 14.
