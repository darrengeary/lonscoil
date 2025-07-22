// app/(protected)/supplier/meals/page.tsx

import { prisma } from "@/lib/db";
import MealGroupManager from "@/components/supplier/MealGroupManager";
import { DashboardHeader } from "@/components/dashboard/header";

export default async function MealsPage() {
  // Fetch all meal groups with their choices (including active)
const initialGroups = await prisma.mealGroup.findMany({
  include: {
    choices: {
      select: {
        id: true,
        name: true,
        groupId: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  },
  orderBy: { name: "asc" },
});


  return (
    <div className="p-6 space-y-6">

      <DashboardHeader
              heading="Meals"
              text="View all available meals."
            /> 
      <MealGroupManager initialGroups={initialGroups} />
    </div>
  );
}
