"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">Tháng</label>
      <Input
        type="month"
        value={value}
        onChange={(e) => {
          // Giữ nguyên các searchParams khác (vd. view/classId của tab "Chi
          // tiết theo lớp") — trước đây router.push ghi đè cả URL, làm mất
          // các param này mỗi khi đổi tháng.
          const params = new URLSearchParams(searchParams.toString());
          params.set("month", e.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="w-40"
      />
    </div>
  );
}
