import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { hasAnyRole, hasRole, canAccessScoring } from "@/lib/auth/permissions";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.email || session.error) {
    redirect("/login");
  }

  const user = { roles: session.user.roles };
  // Định tuyến theo TOÀN BỘ roles, không chỉ role đại diện (primaryRole) —
  // trước đây tài khoản GVCN thuần (chỉ có HOMEROOM_TEACHER, không có
  // JUDGE) bị đẩy thẳng vào /judge (vì role !== ADMIN/SUPER_ADMIN) và mắc
  // kẹt ở đó với thông báo "không có quyền chấm điểm", không có lối vào
  // /homeroom đúng của họ.
  //
  // Tài khoản vừa là GVCN vừa là Giám khảo: ưu tiên vào thẳng /homeroom (xem
  // xếp hạng lớp mình trước) — cần chấm điểm thì tự bấm sang tab "Chấm điểm"
  // (đã có sẵn trong BottomNav/AdminNav), không cần đẩy sang /judge trước.
  if (hasAnyRole(user, ["ADMIN", "SUPER_ADMIN"])) {
    redirect("/admin");
  }
  if (hasRole(user, "HOMEROOM_TEACHER")) {
    redirect("/homeroom");
  }
  if (canAccessScoring(user)) {
    redirect("/judge");
  }
  redirect("/judge");
}
