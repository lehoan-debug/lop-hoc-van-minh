import { requireUser } from "@/lib/auth/session";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function HomeroomLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh bg-background pb-16 sm:pb-0">
      {children}
      <BottomNav roles={user.roles} />
    </div>
  );
}
