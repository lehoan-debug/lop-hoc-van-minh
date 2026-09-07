"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, History, User, School } from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessScoring, hasRole } from "@/lib/auth/permissions";
import type { UserRole } from "@/types";

export function BottomNav({ roles }: { roles: UserRole[] }) {
  const pathname = usePathname();
  const user = { roles };

  const items = [
    canAccessScoring(user) && { href: "/judge", label: "Chấm điểm", icon: ClipboardCheck },
    canAccessScoring(user) && { href: "/judge/history", label: "Lịch sử", icon: History },
    hasRole(user, "HOMEROOM_TEACHER") && {
      href: "/homeroom",
      label: "Lớp chủ nhiệm",
      icon: School,
    },
    { href: "/judge/account", label: "Tài khoản", icon: User },
  ].filter((x): x is { href: string; label: string; icon: typeof User } => !!x);

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card sm:hidden">
      <ul className={cn("grid", items.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/judge" ? pathname === "/judge" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
