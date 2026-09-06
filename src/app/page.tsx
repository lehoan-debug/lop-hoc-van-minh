import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.email || session.error) {
    redirect("/login");
  }
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  redirect("/judge");
}
