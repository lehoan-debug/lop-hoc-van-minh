"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { ClassConfig, AppUser } from "@/types";

interface DashboardFiltersProps {
  classes: ClassConfig[];
  judges: AppUser[];
  showSession?: boolean;
  showTimeRange?: boolean;
}

const ALL = "ALL";

export function DashboardFilters({
  classes,
  judges,
  showSession = true,
  showTimeRange = false,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const grade = searchParams.get("grade") ?? ALL;
  const classId = searchParams.get("classId") ?? ALL;
  const session = searchParams.get("session") ?? ALL;
  const judgeEmail = searchParams.get("judgeEmail") ?? ALL;
  const date = searchParams.get("date") ?? "";
  const timeFrom = searchParams.get("timeFrom") ?? "";
  const timeTo = searchParams.get("timeTo") ?? "";

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    if (key === "grade") params.delete("classId");
    router.push(`${pathname}?${params.toString()}`);
  };

  const classesForGrade = classes.filter((c) => grade === ALL || c.grade === grade);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-border bg-card p-3">
      <Field label="Ngày">
        <Input
          type="date"
          value={date}
          onChange={(e) => setParam("date", e.target.value)}
          className="w-40"
        />
      </Field>

      {showTimeRange && (
        <>
          <Field label="Từ giờ">
            <Input
              type="time"
              value={timeFrom}
              onChange={(e) => setParam("timeFrom", e.target.value)}
              className="w-28"
            />
          </Field>
          <Field label="Đến giờ">
            <Input
              type="time"
              value={timeTo}
              onChange={(e) => setParam("timeTo", e.target.value)}
              className="w-28"
            />
          </Field>
        </>
      )}

      {showSession && (
        <Field label="Buổi">
          <Select value={session} onValueChange={(v) => setParam("session", v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              <SelectItem value="MORNING">Sáng</SelectItem>
              <SelectItem value="AFTERNOON">Chiều</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      <Field label="Khối">
        <Select value={grade} onValueChange={(v) => setParam("grade", v)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả</SelectItem>
            <SelectItem value="10">Khối 10</SelectItem>
            <SelectItem value="11">Khối 11</SelectItem>
            <SelectItem value="12">Khối 12</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Lớp">
        <Select value={classId} onValueChange={(v) => setParam("classId", v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả</SelectItem>
            {classesForGrade.map((c) => (
              <SelectItem key={c.classId} value={c.classId}>
                {c.className}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Người chấm">
        <Select value={judgeEmail} onValueChange={(v) => setParam("judgeEmail", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tất cả</SelectItem>
            {judges.map((j) => (
              <SelectItem key={j.email} value={j.email}>
                {j.name || j.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(pathname)}
        className="h-9"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Đặt lại
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
