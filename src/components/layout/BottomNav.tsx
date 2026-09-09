"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getSectionNavItems } from "@/components/layout/sectionNav";
import type { UserRole } from "@/types";

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/** Thanh điều hướng dưới cùng — CHỈ mobile (sm:hidden). Trên desktop dùng
 * SectionTopBar thay thế (xem component đó để biết lý do cần tách riêng). */
export function BottomNav({ roles }: { roles: UserRole[] }) {
  const pathname = usePathname();
  const items = getSectionNavItems({ roles });

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card sm:hidden">
      <ul className={cn("grid", GRID_COLS[items.length] ?? "grid-cols-4")}>
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
