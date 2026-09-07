"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Trophy,
  Award,
  BarChart3,
  Users,
  Settings,
  ClipboardCheck,
  CalendarClock,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/judge", label: "Chấm điểm", icon: ClipboardCheck },
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/scoring-rounds", label: "Đợt chấm", icon: CalendarClock },
  { href: "/admin/results", label: "Kết quả chi tiết", icon: ListChecks },
  { href: "/admin/ranking", label: "Xếp hạng", icon: Trophy },
  { href: "/admin/adjustments", label: "Điểm cộng/trừ", icon: Award },
  { href: "/admin/criteria", label: "Tiêu chí", icon: SlidersHorizontal },
  { href: "/admin/criteria-analysis", label: "Phân tích tiêu chí", icon: BarChart3 },
  { href: "/admin/users", label: "Tài khoản", icon: Users },
  { href: "/admin/settings", label: "Cấu hình", icon: Settings },
];

export function AdminNav({ variant }: { variant: "sidebar" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 sm:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-card p-3 sm:flex">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin"
            ? pathname === "/admin"
            : href === "/judge"
              ? pathname.startsWith("/judge")
              : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              href === "/judge" && "mb-2 border-b border-border pb-3",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
