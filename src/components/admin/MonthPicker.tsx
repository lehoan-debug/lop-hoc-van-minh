"use client";

import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";

export function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">Tháng</label>
      <Input
        type="month"
        value={value}
        onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
        className="w-40"
      />
    </div>
  );
}
