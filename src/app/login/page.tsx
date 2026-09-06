import { auth } from "@/lib/auth/auth";
import { GoogleSignInButton } from "@/components/layout/GoogleSignInButton";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, GraduationCap } from "lucide-react";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (session?.user?.email && !session.error) {
    redirect(callbackUrl || "/");
  }

  const accessDenied = session?.error === "ACCESS_DENIED";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Lớp học Văn minh</CardTitle>
          <CardDescription>Trường THPT FPT Đà Nẵng</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {accessDenied ? (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius)] bg-warning/10 p-4 text-center">
              <ShieldAlert className="h-8 w-8 text-warning" />
              <p className="text-sm text-foreground">
                Tài khoản <strong>{session?.user?.email}</strong> chưa được cấp
                quyền truy cập hệ thống. Vui lòng liên hệ Phòng Công tác học
                sinh / Ban Tổ chức để được cấp quyền.
              </p>
              <SignOutButton className="w-full" />
            </div>
          ) : (
            <GoogleSignInButton callbackUrl={callbackUrl} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
