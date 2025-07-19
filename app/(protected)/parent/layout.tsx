// app/(protected)/parent/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return redirect("/login");
  if (user.role !== "USER") return redirect("/dashboard");

  return <>{children}</>;
}
