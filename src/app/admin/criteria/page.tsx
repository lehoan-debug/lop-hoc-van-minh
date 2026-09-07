import { getCriteria } from "@/lib/google/sheets";
import { CriteriaAdminPanel } from "@/components/admin/CriteriaAdminPanel";

export default async function AdminCriteriaPage() {
  const criteria = await getCriteria();
  const sorted = [...criteria].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Tiêu chí chấm điểm</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Tiêu chí là dữ liệu động — Đợt chấm mới sẽ dùng đúng bộ tiêu chí đang bật tại thời điểm tạo. Tiêu chí đã
        dùng trong lịch sử chấm điểm không bị ảnh hưởng khi bạn sửa/archive (đã lưu snapshot riêng).
      </p>
      <CriteriaAdminPanel criteria={sorted} />
    </div>
  );
}
