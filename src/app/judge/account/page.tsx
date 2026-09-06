import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  JUDGE: "Giám khảo",
  ADMIN: "Quản trị viên",
  SUPER_ADMIN: "Quản trị viên cấp cao",
};

export default async function JudgeAccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-4 text-lg font-bold">Tài khoản</h1>
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{user.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vai trò</span>
            <Badge>{ROLE_LABEL[user.role] ?? user.role}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Khối được phân công</span>
            <span className="font-medium">
              {user.allowedGrades === "ALL" ? "Tất cả" : user.allowedGrades.join(", ")}
            </span>
          </div>
          <SignOutButton className="mt-2 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
