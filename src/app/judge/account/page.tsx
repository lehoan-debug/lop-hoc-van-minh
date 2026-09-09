import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  JUDGE: "Giám khảo",
  HOMEROOM_TEACHER: "GVCN",
  ADMIN: "Quản trị viên",
  SUPER_ADMIN: "Ất ơ",
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
            <div className="flex flex-wrap justify-end gap-1">
              {user.roles.map((r) => (
                <Badge key={r}>{ROLE_LABEL[r]}</Badge>
              ))}
            </div>
          </div>
          {user.homeroomClassIds.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lớp chủ nhiệm</span>
              <span className="font-medium">{user.homeroomClassIds.join(", ")}</span>
            </div>
          )}
          <SignOutButton className="mt-2 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
