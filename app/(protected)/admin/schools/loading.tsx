import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";

export default function SchoolsLoading() {
  return (
    <>
      <DashboardHeader
        heading="Schools"
        text="Check and manage your Schools."
      />
      <Skeleton className="size-full rounded-lg" />
    </>
  );
}
