// app/(protected)/supplier/meals/page.tsx
import { prisma } from "@/lib/db";
import MealGroupManager, {
  MealGroup,
  PrismaMealChoice,
} from "@/components/supplier/MealGroupManager";
import { DashboardHeader } from "@/components/dashboard/header";

export default async function MealsPage() {
  // Fetch meal groups + choices (Dates -> ISO strings for client safety)
  const groups = await prisma.mealGroup.findMany({
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

  const initialGroups: MealGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    maxSelections: g.maxSelections,
    choices: g.choices.map<PrismaMealChoice>((c) => ({
      id: c.id,
      name: c.name,
      groupId: c.groupId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="p-6 space-y-6">
      <DashboardHeader heading="Meals" text="View all available meals." />
      <MealGroupManager initialGroups={initialGroups} />
    </div>
  );
}