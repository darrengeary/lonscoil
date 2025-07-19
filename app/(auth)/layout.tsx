// app/(auth)/layout.tsx
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"

interface AuthLayoutProps {
  children: React.ReactNode
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const user = await getCurrentUser()

  // if you’re already signed in, don’t show any auth pages — send you on
  if (user) {
    if (user.role === "ADMIN") {
      // admin users go straight into the admin panel
      redirect("/admin")
    }
    // everyone else just goes to the normal dashboard
    redirect("/dashboard")
  }

  // only unsigned users fall through to /login, /register, etc.
  return <>{children}</>
}
