import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"

interface AuthLayoutProps {
  children: React.ReactNode
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const user = await getCurrentUser()

  if (user) {
    switch (user.role) {
      case "ADMIN":
        redirect("/admin/kitchen-prep")
      case "SCHOOLADMIN":
        redirect("/admin/kitchen-prep")
      case "TEACHER":
        redirect("/admin/kitchen-prep")
      case "USER":
      default:
        redirect("/parent/pupils")
    }
  }

  return <>{children}</>
}
