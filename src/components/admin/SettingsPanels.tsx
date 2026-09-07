"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { Loader2, Save, SlidersHorizontal, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { updateSettingAction, toggleClassActiveAction } from "@/lib/actions/adminActions";
import type { AppSettings, ClassConfig, Grade } from "@/types";

export function SettingsPanels({
  settings,
  classes,
}: {
  settings: AppSettings;
  classes: ClassConfig[];
}) {
  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">Chung</TabsTrigger>
        <TabsTrigger value="classes">Lớp</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <Link
          href="/admin/criteria"
          className="mb-4 flex items-center justify-between rounded-[var(--radius)] border border-primary/30 bg-primary/5 p-3 text-sm text-primary"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Quản lý tiêu chí chấm điểm (thêm/sửa/điểm/archive) đã chuyển sang trang riêng
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
        <GeneralSettingsForm settings={settings} />
      </TabsContent>
      <TabsContent value="classes">
        <ClassesTogglePanel classes={classes} />
      </TabsContent>
    </Tabs>
  );
}

function GeneralSettingsForm({ settings }: { settings: AppSettings }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = React.useState(settings);

  const save = () => {
    startTransition(async () => {
      const entries: [string, string][] = [
        ["DAILY_SCORE_COMBINE_MODE", form.DAILY_SCORE_COMBINE_MODE],
        ["MORNING_SESSION_START", form.MORNING_SESSION_START],
        ["MORNING_SESSION_END", form.MORNING_SESSION_END],
        ["AFTERNOON_SESSION_START", form.AFTERNOON_SESSION_START],
        ["AFTERNOON_SESSION_END", form.AFTERNOON_SESSION_END],
        ["ALLOW_OUTSIDE_HOURS_SCORING", form.ALLOW_OUTSIDE_HOURS_SCORING ? "TRUE" : "FALSE"],
        ["CURRENT_SCHOOL_YEAR", form.CURRENT_SCHOOL_YEAR],
        ["ENABLED_GRADES", form.ENABLED_GRADES.join(",")],
      ];
      const results = await Promise.all(
        entries.map(([key, value]) => updateSettingAction({ key, value })),
      );
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        toast({ variant: "error", title: failed.error });
      } else {
        toast({ variant: "success", title: "Đã lưu cấu hình." });
      }
    });
  };

  const toggleGrade = (g: Grade) => {
    setForm((f) => ({
      ...f,
      ENABLED_GRADES: f.ENABLED_GRADES.includes(g)
        ? f.ENABLED_GRADES.filter((x) => x !== g)
        : [...f.ENABLED_GRADES, g],
    }));
  };

  return (
    <div className="max-w-xl space-y-5 rounded-[var(--radius)] border border-border bg-card p-4">
      <div>
        <Label>Cách tính điểm chấm BGK trong ngày (Sáng + Chiều)</Label>
        <p className="mb-1 text-xs text-muted-foreground">
          Kế hoạch chưa nêu rõ cách kết hợp — xem BUSINESS_RULES_REVIEW.md mục 1. Khi để
          &quot;Chưa xác nhận&quot;, hệ thống KHÔNG tạo điểm ngày/xếp hạng chính thức nào (chỉ hiển
          thị số liệu tham khảo tại Xếp hạng), tránh áp một công thức sai lên kết quả thi đua thật.
        </p>
        <Select
          value={form.DAILY_SCORE_COMBINE_MODE}
          onValueChange={(v) =>
            setForm((f) => ({
              ...f,
              DAILY_SCORE_COMBINE_MODE: v as AppSettings["DAILY_SCORE_COMBINE_MODE"],
            }))
          }
        >
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UNCONFIRMED">Chưa xác nhận (mặc định — an toàn)</SelectItem>
            <SelectItem value="SUM">Cộng tổng 2 buổi (tối đa 22)</SelectItem>
            <SelectItem value="AVERAGE">Trung bình 2 buổi (tối đa 11)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Khối đang áp dụng phong trào</Label>
        <div className="mt-1 flex gap-2">
          {(["10", "11", "12"] as Grade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGrade(g)}
              className={
                form.ENABLED_GRADES.includes(g)
                  ? "rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  : "rounded-md border border-border px-3 py-1.5 text-sm"
              }
            >
              Khối {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Giờ chấm buổi Sáng</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="time"
              value={form.MORNING_SESSION_START}
              onChange={(e) => setForm((f) => ({ ...f, MORNING_SESSION_START: e.target.value }))}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              value={form.MORNING_SESSION_END}
              onChange={(e) => setForm((f) => ({ ...f, MORNING_SESSION_END: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Giờ chấm buổi Chiều</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="time"
              value={form.AFTERNOON_SESSION_START}
              onChange={(e) => setForm((f) => ({ ...f, AFTERNOON_SESSION_START: e.target.value }))}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              value={form.AFTERNOON_SESSION_END}
              onChange={(e) => setForm((f) => ({ ...f, AFTERNOON_SESSION_END: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Cho phép chấm ngoài khung giờ</Label>
          <p className="text-xs text-muted-foreground">
            Khung giờ ở trên chỉ mang tính tham khảo/gợi ý buổi mặc định.
          </p>
        </div>
        <Switch
          checked={form.ALLOW_OUTSIDE_HOURS_SCORING}
          onCheckedChange={(v) => setForm((f) => ({ ...f, ALLOW_OUTSIDE_HOURS_SCORING: v }))}
        />
      </div>

      <div>
        <Label>Năm học hiện tại</Label>
        <Input
          value={form.CURRENT_SCHOOL_YEAR}
          onChange={(e) => setForm((f) => ({ ...f, CURRENT_SCHOOL_YEAR: e.target.value }))}
          className="mt-1 w-40"
        />
      </div>

      <Button onClick={save} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Lưu cấu hình
      </Button>
    </div>
  );
}

function ClassesTogglePanel({ classes }: { classes: ClassConfig[] }) {
  const { toast } = useToast();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handleToggle = (classId: string, next: boolean) => {
    setPendingId(classId);
    toggleClassActiveAction(classId, next).then((result) => {
      setPendingId(null);
      if (!result.ok) toast({ variant: "error", title: result.error });
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(["10", "11", "12"] as Grade[]).map((grade) => (
        <div key={grade} className="rounded-[var(--radius)] border border-border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">Khối {grade}</h3>
          <div className="space-y-1.5">
            {classes
              .filter((c) => c.grade === grade)
              .map((c) => (
                <div key={c.classId} className="flex items-center justify-between text-sm">
                  <span>{c.className}</span>
                  <Switch
                    checked={c.active}
                    disabled={pendingId === c.classId}
                    onCheckedChange={(v) => handleToggle(c.classId, v)}
                  />
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

