// File: app/(protected)/supplier/meals/page.tsx

import { prisma } from "@/lib/db";
import MealGroupManager from "@/components/supplier/MealGroupManager";

export default async function MealsPage() {
  // Fetch all meal groups with their choices
  const initialGroups = await prisma.mealGroup.findMany({
    include: { choices: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Meals &amp; Choices Management</h1>
      <MealGroupManager initialGroups={initialGroups} />
    </div>
  );
}

