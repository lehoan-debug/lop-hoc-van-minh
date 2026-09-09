"use client";

import { signOut } from "next-auth/react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  size,
}: {
  className?: string;
  size?: ButtonProps["size"];
}) {
  return (
    <Button
      variant="outline"
      size={size}
      className={cn(className)}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="h-4 w-4" />
      Đăng xuất
    </Button>
  );
}
