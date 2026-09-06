import type { CriterionConfig } from "@/types";

/**
 * 11 tiêu chí chấm điểm — trích NGUYÊN VĂN từ "KH Lớp học văn minh.docx"
 * (mục III.3, bảng "Tiêu chí chấm điểm"), khớp hoàn toàn với 3 bảng chấm
 * Khối 10/11/12. Đọc trực tiếp từ XML gốc, không chỉnh sửa câu chữ.
 *
 * Tiêu chí 7 bị cắt cụt ngay trong văn bản gốc ("...gọn gàng, không ") —
 * đã xác minh đây là lỗi có sẵn trong tài liệu Word, không phải lỗi khi đọc
 * file. Xem chi tiết tại BUSINESS_RULES_REVIEW.md mục 2. Mô tả tiêu chí có
 * thể chỉnh sửa qua /admin/settings khi nhà trường có bản chính thức.
 *
 * SEED DATA dùng để khởi tạo sheet `Criteria`. Sau khi khởi tạo, sheet
 * `Criteria` là nguồn dữ liệu chính thức.
 */
export const SEED_CRITERIA: CriterionConfig[] = [
  {
    criterionId: "C1",
    criterionNumber: 1,
    criterionName: "Rác được bỏ gọn vào thùng.",
    description: "Rác được bỏ gọn vào thùng.",
    active: true,
    sortOrder: 1,
  },
  {
    criterionId: "C2",
    criterionNumber: 2,
    criterionName:
      "Toàn bộ balo, cặp đặt gọn ở đúng khu vực quy định (hộc bàn/tủ locker) Không có balo, cặp đặt giữa lối đi.",
    description:
      "Toàn bộ balo, cặp đặt gọn ở đúng khu vực quy định (hộc bàn/tủ locker) Không có balo, cặp đặt giữa lối đi.",
    active: true,
    sortOrder: 2,
  },
  {
    criterionId: "C3",
    criterionNumber: 3,
    criterionName:
      "Không có dây điện, ổ cắm điện kéo dài chắn lối đi hoặc nằm trực tiếp giữa sàn.",
    description:
      "Không có dây điện, ổ cắm điện kéo dài chắn lối đi hoặc nằm trực tiếp giữa sàn.",
    active: true,
    sortOrder: 3,
  },
  {
    criterionId: "C4",
    criterionNumber: 4,
    criterionName:
      "Sách vở, dụng cụ học tập được đặt gọn gàng (trên mặt bàn/trong hộc bàn), không bừa bộn.",
    description:
      "Sách vở, dụng cụ học tập được đặt gọn gàng (trên mặt bàn/trong hộc bàn), không bừa bộn.",
    active: true,
    sortOrder: 4,
  },
  {
    criterionId: "C5",
    criterionNumber: 5,
    criterionName: "Không có đồ dùng cá nhân đặt ở sàn nhà, bệ cửa sổ",
    description: "Không có đồ dùng cá nhân đặt ở sàn nhà, bệ cửa sổ",
    active: true,
    sortOrder: 5,
  },
  {
    criterionId: "C6",
    criterionNumber: 6,
    criterionName: "Bàn giáo viên được sắp xếp gọn gàng, sạch sẽ",
    description: "Bàn giáo viên được sắp xếp gọn gàng, sạch sẽ",
    active: true,
    sortOrder: 6,
  },
  {
    criterionId: "C7",
    criterionNumber: 7,
    // Nguyên văn từ tài liệu gốc, kể cả phần bị cắt cụt — xem lưu ý ở đầu file.
    criterionName:
      "Kiểm tra ngẫu nhiên tủ locker, học sinh sắp xếp đồ dùng gọn gàng, không",
    description:
      "Kiểm tra ngẫu nhiên tủ locker, học sinh sắp xếp đồ dùng gọn gàng, không",
    active: true,
    sortOrder: 7,
  },
  {
    criterionId: "C8",
    criterionNumber: 8,
    criterionName: "Đảm bảo 100% học sinh mang đồng phục đúng quy định",
    description:
      "Đảm bảo 100% học sinh mang đồng phục đúng quy định. + HS Nam: Áo cam, quần be. Áo bỏ vào quần. Giày/Dép có quai sau. Không có tóc sáng màu. + HS nữ: Áo cam, quần/váy be. Áo bỏ vào quần/váy. Chiều dài váy chạm đầu gối. Giày/dép có quai sau. Không có tóc sáng màu.",
    active: true,
    sortOrder: 8,
  },
  {
    criterionId: "C9",
    criterionNumber: 9,
    criterionName:
      "Học sinh về sinh hoạt buổi trưa (Nội trú/Bán trú) đúng giờ quy định",
    description:
      "Học sinh về sinh hoạt buổi trưa (Nội trú/Bán trú) đúng giờ quy định",
    active: true,
    sortOrder: 9,
  },
  {
    criterionId: "C10",
    criterionNumber: 10,
    criterionName: "Xếp ghế gọn gàng trên bàn cuối mỗi buổi học (Sáng và chiều)",
    description:
      "Xếp ghế gọn gàng trên bàn cuối mỗi buổi học (Sáng và chiều)",
    active: true,
    sortOrder: 10,
  },
  {
    criterionId: "C11",
    criterionNumber: 11,
    criterionName:
      "Đầu giờ học buổi chiều, lớp ổn định nề nếp, tác phong, vệ sinh lớp học (theo các tiêu chí từ 1-8) trước khi vào tiết học.",
    description:
      "Đầu giờ học buổi chiều, lớp ổn định nề nếp, tác phong, vệ sinh lớp học (theo các tiêu chí từ 1-8) trước khi vào tiết học.",
    active: true,
    sortOrder: 11,
  },
];
