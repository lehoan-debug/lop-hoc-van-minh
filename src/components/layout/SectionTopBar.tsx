"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getSectionNavItems } from "@/components/layout/sectionNav";
import { SignOutButton } from "@/components/layout/SignOutButton";
import type { UserRole } from "@/types";

/**
 * Thanh điều hướng chuyển khu vực — CHỈ desktop (hidden sm:flex). BottomNav
 * (tab dưới cùng) chỉ hiện trên mobile (sm:hidden) nên trên desktop, tài
 * khoản đa vai trò (vd. vừa GVCN vừa Giám khảo) trước đây KHÔNG CÓ CÁCH NÀO
 * chuyển qua lại giữa /homeroom và /judge — đây là màn hình để bù lại, hiện
 * ở MỌI trang trong khu vực Giám khảo/GVCN (không chỉ trang chủ), luôn thấy
 * được dù đang ở màn nào.
 */
export function SectionTopBar({ roles }: { roles: UserRole[] }) {
  const pathname = usePathname();
  const items = getSectionNavItems({ roles });

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-card px-4 py-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <Link href="/" className="flex shrink-0 items-center gap-2">
        <Image src="/logo-fpt-schools.png" alt="FPT Schools" width={110} height={48} className="h-6 w-auto" />
        <span className="text-sm font-semibold">Lớp học Văn minh</span>
      </Link>

      <nav className="flex flex-1 items-center gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/judge" ? pathname === "/judge" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <SignOutButton size="sm" />
    </header>
  );
}
