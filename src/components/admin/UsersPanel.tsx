"use client";

import * as React from "react";
import { useTransition } from "react";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { updateUserAction } from "@/lib/actions/adminActions";
import type { AppUser, Grade, Role } from "@/types";

const ROLE_LABEL: Record<Role, string> = {
  JUDGE: "Giám khảo",
  ADMIN: "Quản trị viên",
  SUPER_ADMIN: "Quản trị viên cấp cao",
};

export function UsersPanel({
  users,
  currentUserRole,
}: {
  users: AppUser[];
  currentUserRole: Role;
}) {
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<AppUser | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Khối được phân công</th>
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
                  <Badge variant={u.role === "JUDGE" ? "secondary" : "default"}>
                    {ROLE_LABEL[u.role]}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {u.allowedGrades === "ALL" ? "Tất cả" : u.allowedGrades.join(", ")}
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
          currentUserRole={currentUserRole}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function UserFormDialog({
  existing,
  currentUserRole,
  onClose,
}: {
  existing?: AppUser;
  currentUserRole: Role;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = React.useState(existing?.email ?? "");
  const [name, setName] = React.useState(existing?.name ?? "");
  const [role, setRole] = React.useState<Role>(existing?.role ?? "JUDGE");
  const [active, setActive] = React.useState(existing?.active ?? true);
  const [allAllowed, setAllAllowed] = React.useState(existing?.allowedGrades === "ALL" || !existing);
  const [grades, setGrades] = React.useState<Grade[]>(
    existing?.allowedGrades !== "ALL" && existing?.allowedGrades ? existing.allowedGrades : [],
  );

  const toggleGrade = (g: Grade) => {
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleSubmit = () => {
    if (!email.trim() || !name.trim()) {
      toast({ variant: "error", title: "Vui lòng nhập đầy đủ email và tên." });
      return;
    }
    startTransition(async () => {
      const result = await updateUserAction({
        email: email.trim(),
        name: name.trim(),
        role,
        active,
        allowedGrades: allAllowed ? "ALL" : grades,
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
        <div className="space-y-3">
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
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JUDGE">Giám khảo</SelectItem>
                <SelectItem value="ADMIN">Quản trị viên</SelectItem>
                {currentUserRole === "SUPER_ADMIN" && (
                  <SelectItem value="SUPER_ADMIN">Quản trị viên cấp cao</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Được phép chấm tất cả khối</Label>
            <Switch checked={allAllowed} onCheckedChange={setAllAllowed} />
          </div>
          {!allAllowed && (
            <div className="flex gap-2">
              {(["10", "11", "12"] as Grade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={
                    grades.includes(g)
                      ? "rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                      : "rounded-md border border-border px-3 py-1.5 text-sm"
                  }
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
