"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/judge", label: "Chấm điểm", icon: ClipboardCheck },
  { href: "/judge/history", label: "Lịch sử", icon: History },
  { href: "/judge/account", label: "Tài khoản", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card sm:hidden">
      <ul className="grid grid-cols-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/judge" ? pathname === "/judge" : pathname.startsWith(href);
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
