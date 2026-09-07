import { requireUser } from "@/lib/auth/session";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh bg-background pb-[calc(var(--bottom-nav-height)_+_env(safe-area-inset-bottom))] sm:pb-0">
      {children}
      <BottomNav roles={user.roles} />
    </div>
  );
}
