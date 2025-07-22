// app/(protected)/supplier/meals/page.tsx

import { prisma } from "@/lib/db";
import MealGroupViewer from "@/components/school-admin/MealGroupViewer";

export default async function MealViewPage() {
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
      <h1 className="text-2xl font-bold">Meals &amp; Choices</h1>
      <MealGroupViewer initialGroups={initialGroups} />
    </div>
  );
}
