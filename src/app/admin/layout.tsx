import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { GraduationCap } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/judge");
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span className="font-semibold">Lớp học Văn minh · Quản trị</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.name} ({user.role === "SUPER_ADMIN" ? "Quản trị cấp cao" : "Quản trị viên"})
          </span>
          <SignOutButton />
        </div>
      </header>
      <AdminNav variant="mobile" />
      <div className="flex">
        <AdminNav variant="sidebar" />
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
