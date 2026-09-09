"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { updateUserAction } from "@/lib/actions/adminActions";
import { ImportUsersDialog } from "@/components/admin/ImportUsersDialog";
import { canManageAdminRoles } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { AppUser, ClassConfig, Grade, Role, UserRole } from "@/types";

const ROLE_LABEL: Record<UserRole, string> = {
  JUDGE: "Giám khảo",
  HOMEROOM_TEACHER: "GVCN",
  ADMIN: "Quản trị viên",
  SUPER_ADMIN: "Ất ơ",
};

const ADMIN_TIER_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export function UsersPanel({
  users,
  classes,
  currentUserRole,
}: {
  users: AppUser[];
  classes: ClassConfig[];
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<AppUser | null>(null);
  const [importing, setImporting] = React.useState(false);
  const canManageAdmins = canManageAdminRoles({ roles: [currentUserRole] });

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setImporting(true)}>
          <FileSpreadsheet className="h-4 w-4" />
          Nhập từ Excel
        </Button>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Lớp chủ nhiệm</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r} variant={r === "JUDGE" ? "secondary" : "default"}>
                        {ROLE_LABEL[r]}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {u.homeroomClassIds.length > 0 ? u.homeroomClassIds.join(", ") : "—"}
                </td>
                <td className="px-3 py-2">
                  {u.active ? (
                    <span className="text-success">Đang hoạt động</span>
                  ) : (
                    <span className="text-muted-foreground">Đã khoá</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEditing(u)} className="rounded p-1.5 text-primary hover:bg-accent">
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Chưa có tài khoản nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <UserFormDialog
          existing={editing ?? undefined}
          classes={classes}
          canManageAdmins={canManageAdmins}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {importing && (
        <ImportUsersDialog
          onClose={() => {
            setImporting(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function UserFormDialog({
  existing,
  classes,
  canManageAdmins,
  onClose,
}: {
  existing?: AppUser;
  classes: ClassConfig[];
  canManageAdmins: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = React.useState(existing?.email ?? "");
  const [name, setName] = React.useState(existing?.name ?? "");
  const [roles, setRoles] = React.useState<UserRole[]>(existing?.roles ?? ["JUDGE"]);
  const [active, setActive] = React.useState(existing?.active ?? true);
  const [allAllowed, setAllAllowed] = React.useState(existing?.allowedGrades === "ALL" || !existing);
  const [grades, setGrades] = React.useState<Grade[]>(
    existing?.allowedGrades !== "ALL" && existing?.allowedGrades ? existing.allowedGrades : [],
  );
  const [homeroomClassIds, setHomeroomClassIds] = React.useState<string[]>(
    existing?.homeroomClassIds ?? [],
  );

  const toggleRole = (r: UserRole) => {
    if (ADMIN_TIER_ROLES.includes(r) && !canManageAdmins) return;
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const toggleGrade = (g: Grade) => {
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const toggleHomeroomClass = (classId: string) => {
    setHomeroomClassIds((prev) =>
      prev.includes(classId) ? prev.filter((x) => x !== classId) : [...prev, classId],
    );
  };

  const handleSubmit = () => {
    if (!email.trim() || !name.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập đầy đủ email và tên." });
      return;
    }
    if (roles.length === 0) {
      toast({ variant: "error", title: "Vui lòng chọn ít nhất 1 vai trò." });
      return;
    }
    startTransition(async () => {
      const result = await updateUserAction({
        email: email.trim(),
        name: name.trim(),
        roles,
        active,
        allowedGrades: allAllowed ? "ALL" : grades,
        homeroomClassIds,
      });
      if (result.ok) {
        toast({ variant: "success", title: "Đã lưu tài khoản." });
        onClose();
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <Label>Email (Google)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!existing}
              placeholder="ten@fpt.edu.vn"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Họ tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Vai trò (có thể chọn nhiều)</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(["JUDGE", "HOMEROOM_TEACHER", "ADMIN", "SUPER_ADMIN"] as UserRole[]).map((r) => {
                const isAdminTier = ADMIN_TIER_ROLES.includes(r);
                const disabled = isAdminTier && !canManageAdmins;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleRole(r)}
                    title={disabled ? "Chỉ Ất ơ mới cấp được quyền này" : undefined}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium",
                      roles.includes(r)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
            {!canManageAdmins && (
              <p className="mt-1 text-xs text-muted-foreground">
                Chỉ Ất ơ mới có thể cấp/thu hồi quyền Quản trị viên.
              </p>
            )}
          </div>

          {roles.includes("HOMEROOM_TEACHER") && (
            <div>
              <Label>Lớp chủ nhiệm</Label>
              <div className="mt-1 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border p-2">
                {classes.map((c) => (
                  <button
                    key={c.classId}
                    type="button"
                    onClick={() => toggleHomeroomClass(c.classId)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium",
                      homeroomClassIds.includes(c.classId)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border",
                    )}
                  >
                    {c.className}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Được phép chấm tất cả khối (legacy)</Label>
            <Switch checked={allAllowed} onCheckedChange={setAllAllowed} />
          </div>
          {!allAllowed && (
            <div className="flex gap-2">
              {(["10", "11", "12"] as Grade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm",
                    grades.includes(g)
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border",
                  )}
                >
                  Khối {g}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Đang hoạt động</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
