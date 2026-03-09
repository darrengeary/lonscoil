// app/(protected)/supplier/meals/page.tsx
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import MenuManager, { MenuSection } from "@/components/supplier/MenuManager";

export default async function MealsPage() {
  const menus = await prisma.menu.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      active: true,
      schoolLinks: {
        select: { school: { select: { id: true, name: true } } },
        orderBy: { school: { name: "asc" } },
      },
    },
  });

  const sections: MenuSection[] = await Promise.all(
    menus.map(async (m) => {
      const groupLinks = await prisma.menuMealGroup.findMany({
        where: { menuId: m.id },
        include: {
          group: {
            include: {
              choices: {
                where: { menuLinks: { some: { menuId: m.id } } },
                select: {
                  id: true,
                  name: true,
                  groupId: true,
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: { name: "asc" },
              },
            },
          },
        },
        orderBy: { group: { name: "asc" } },
      });

      const groups = groupLinks.map((gl) => gl.group);

      return {
        menu: {
          id: m.id,
          name: m.name,
          active: m.active,
          schools: m.schoolLinks.map((x) => x.school),
        },
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          maxSelections: g.maxSelections,
          choices: (g.choices ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            groupId: c.groupId,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          })),
        })),
      };
    })
  );

  return (
    <div className="p-6 space-y-6">
      <DashboardHeader
        heading="Meals"
        text="Manage menus (Standard / Gluten Free / etc). Each menu has its own meal groups and choices."
      />
      <MenuManager initialSections={sections} />
    </div>
  );
}