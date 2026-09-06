import { requireUser } from "@/lib/auth/session";
import { getUsers } from "@/lib/google/sheets";
import { UsersPanel } from "@/components/admin/UsersPanel";

export default async function AdminUsersPage() {
  const currentUser = await requireUser();
  const users = await getUsers();
  const sorted = [...users].sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Quản lý tài khoản</h1>
      <UsersPanel users={sorted} currentUserRole={currentUser.role} />
    </div>
  );
}
