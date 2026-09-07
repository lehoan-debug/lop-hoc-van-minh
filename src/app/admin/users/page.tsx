import { requireUser } from "@/lib/auth/session";
import { getUsers, getClasses } from "@/lib/google/sheets";
import { UsersPanel } from "@/components/admin/UsersPanel";

export default async function AdminUsersPage() {
  const currentUser = await requireUser();
  const [users, classes] = await Promise.all([
    getUsers(),
    getClasses({ activeOnly: true }),
  ]);
  const sorted = [...users].sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Quản lý tài khoản</h1>
      <UsersPanel users={sorted} classes={classes} currentUserRole={currentUser.role} />
    </div>
  );
}
