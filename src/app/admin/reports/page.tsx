import { requireRole } from "@/lib/auth/session";
import { getUsers, getClasses } from "@/lib/google/sheets";
import { BGHReportCard } from "@/components/admin/BGHReportCard";
import { GVCNReportCard, type HomeroomTeacherItem } from "@/components/admin/GVCNReportCard";

export default async function AdminReportsPage() {
  const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  const [allUsers, allClasses] = await Promise.all([getUsers(), getClasses({ activeOnly: true })]);

  const classById = new Map(allClasses.map((c) => [c.classId, c]));

  const teachers: HomeroomTeacherItem[] = allUsers
    .filter((u) => u.roles.includes("HOMEROOM_TEACHER"))
    .map((u) => ({
      email: u.email,
      name: u.name,
      classes: u.homeroomClassIds
        .map((id) => classById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .sort((a, b) => (a.grade === b.grade ? a.sortOrder - b.sortOrder : a.grade.localeCompare(b.grade)))
        .map((c) => ({ classId: c.classId, className: c.className, grade: c.grade })),
    }))
    .filter((t) => t.classes.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Trung tâm báo cáo</h1>
        <p className="text-sm text-muted-foreground">
          Gửi báo cáo kết quả chấm điểm qua email tới Ban Giám hiệu hoặc từng Giáo viên chủ nhiệm.
        </p>
      </div>
      <BGHReportCard defaultEmail={user.email} />
      <GVCNReportCard teachers={teachers} />
    </div>
  );
}
