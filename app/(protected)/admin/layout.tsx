// app/(protected)/admin/layout.tsx
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
const user = await getCurrentUser()
if (!user) redirect("/login")
if (user.role !== "ADMIN") redirect("/dashboard")
  // 3) Otherwise they’re an admin – render the admin UI
  return <>{children}</>
}
