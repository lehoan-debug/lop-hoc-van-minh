import { BottomNav } from "@/components/layout/BottomNav";

export default function JudgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background pb-16 sm:pb-0">
      {children}
      <BottomNav />
    </div>
  );
}
