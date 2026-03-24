import { prisma } from "@/lib/db";
import MenuManager, { type MenuSection } from "@/components/supplier/MenuManager";

export default async function AdminPage() {
  const menus = await prisma.menu.findMany({
    orderBy: { name: "asc" },
    include: {
      schoolLinks: {
        include: {
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      mealOptions: {
        orderBy: { name: "asc" },
        include: {
          groupLinks: {
            include: {
              group: {
                include: {
                  choices: {
                    orderBy: { name: "asc" },
                    select: {
                      id: true,
                      name: true,
                      groupId: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const initialSections: MenuSection[] = menus.map((menu) => ({
    menu: {
      id: menu.id,
      name: menu.name,
      active: menu.active,
      schools: menu.schoolLinks.map((link) => ({
        id: link.school.id,
        name: link.school.name,
      })),
    },
    mealOptions: menu.mealOptions.map((mealOption) => ({
      id: mealOption.id,
      name: mealOption.name,
      menuId: mealOption.menuId,
      stickerCount: mealOption.stickerCount,
      groups: mealOption.groupLinks.map((link) => ({
        id: link.group.id,
        name: link.group.name,
        maxSelections: link.group.maxSelections,
        choices: link.group.choices.map((choice) => ({
          id: choice.id,
          name: choice.name,
          groupId: choice.groupId,
          createdAt: choice.createdAt.toISOString(),
          updatedAt: choice.updatedAt.toISOString(),
        })),
      })),
    })),
  }));

  return <MenuManager initialSections={initialSections} />;
}