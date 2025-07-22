import { redirect } from "next/navigation";

import { sidebarLinks } from "@/config/dashboard";
import { getCurrentUser } from "@/lib/session";
import {
  DashboardSidebar,
  MobileSheetSidebar,
} from "@/components/layout/dashboard-sidebar";
import { UserAccountNav } from "@/components/layout/user-account-nav";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { BottomNav } from "@/components/BottomNav";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export default async function Dashboard({ children }: ProtectedLayoutProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const filteredLinks = sidebarLinks.map((section) => ({
    ...section,
    items: section.items.filter(
      ({ authorizeOnly }) => !authorizeOnly || authorizeOnly === user.role,
    ),
  }));

  return (
    <div className="relative flex w-full">
      <BottomNav links={filteredLinks} />
      <DashboardSidebar links={filteredLinks} />

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-50 flex h-14 bg-[#F4F7FA] px-4 lg:h-[60px] xl:px-8">
          <MaxWidthWrapper className="flex max-w-7xl items-center gap-x-3 px-0">
            <MobileSheetSidebar links={filteredLinks} />

            <div className="w-full flex-1">
            </div>

            <UserAccountNav />
          </MaxWidthWrapper>
        </header>

        <main className="flex-1 bg-[#F4F7FA] p-4 xl:px-8">
          <MaxWidthWrapper className="flex h-full max-w-7xl flex-col gap-4 px-0 lg:gap-6">
            {children}
          </MaxWidthWrapper>
        </main>
      </div>
    </div>
  );
}
