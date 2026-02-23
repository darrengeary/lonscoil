import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Not logged in → login
  if (!user) {
    redirect("/login");
  }

  // Role-based routing
  switch (user.role) {
    case "ADMIN":
      redirect("/admin/kitchen-prep");

    case "SCHOOLADMIN":
      redirect("/school-admin/schedule");

    case "USER":
      redirect("/parent/orders");

    default:
      // Fallback safety
      redirect("/login");
  }
}