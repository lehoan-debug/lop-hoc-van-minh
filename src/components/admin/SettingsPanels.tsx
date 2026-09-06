"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  updateSettingAction,
  toggleClassActiveAction,
  toggleCriterionActiveAction,
  updateCriterionDescriptionAction,
} from "@/lib/actions/adminActions";
import type { AppSettings, ClassConfig, CriterionConfig, Grade } from "@/types";

export function SettingsPanels({
  settings,
  classes,
  criteria,
}: {
  settings: AppSettings;
  classes: ClassConfig[];
  criteria: CriterionConfig[];
}) {
  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">Chung</TabsTrigger>
        <TabsTrigger value="classes">Lớp</TabsTrigger>
        <TabsTrigger value="criteria">Tiêu chí</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <GeneralSettingsForm settings={settings} />
      </TabsContent>
      <TabsContent value="classes">
        <ClassesTogglePanel classes={classes} />
      </TabsContent>
      <TabsContent value="criteria">
        <CriteriaTogglePanel criteria={criteria} />
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
          Xem BUSINESS_RULES_REVIEW.md mục 1 — Kế hoạch chưa nêu rõ, cần BTC xác nhận.
        </p>
        <Select
          value={form.DAILY_SCORE_COMBINE_MODE}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, DAILY_SCORE_COMBINE_MODE: v as "SUM" | "AVERAGE" }))
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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

function CriteriaTogglePanel({ criteria }: { criteria: CriterionConfig[] }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [isPending, startTransition] = useTransition();

  const startEdit = (c: CriterionConfig) => {
    setEditingId(c.criterionId);
    setDraft(c.description);
  };

  const saveDescription = (criterionId: string) => {
    startTransition(async () => {
      const result = await updateCriterionDescriptionAction(criterionId, draft);
      if (result.ok) {
        toast({ variant: "success", title: "Đã cập nhật mô tả tiêu chí." });
        setEditingId(null);
      } else {
        toast({ variant: "error", title: result.error });
      }
    });
  };

  return (
    <div className="space-y-2">
      {criteria.map((c) => (
        <div key={c.criterionId} className="rounded-[var(--radius)] border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">Tiêu chí {c.criterionNumber}</p>
              {editingId === c.criterionId ? (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
              )}
            </div>
            <Switch
              checked={c.active}
              onCheckedChange={(v) => toggleCriterionActiveAction(c.criterionId, v)}
            />
          </div>
          <div className="mt-2">
            {editingId === c.criterionId ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveDescription(c.criterionId)} disabled={isPending}>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Lưu
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Huỷ
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                Sửa mô tả
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
