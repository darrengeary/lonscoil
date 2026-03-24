import { prisma } from "@/lib/db";
import MenuManager, {
  type AllergenTag,
  type MenuSection,
} from "@/components/supplier/MenuManager";

export default async function AdminPage() {
  const [menus, allergens] = await Promise.all([
    prisma.menu.findMany({
      orderBy: { name: "asc" },
      include: ({
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
            allergens: {
              select: {
                id: true,
                name: true,
              },
            },
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
                        active: true,
                        extraSticker: true,
                        caloriesKcal: true,
                        proteinG: true,
                        carbsG: true,
                        sugarsG: true,
                        fatG: true,
                        saturatesG: true,
                        fibreG: true,
                        saltG: true,
                        allergens: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
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
      } as any),
    }),
    prisma.allergen.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

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
      active: mealOption.active,
      imageUrl: mealOption.imageUrl,
      availStart: mealOption.availStart?.toISOString() ?? null,
      availEnd: mealOption.availEnd?.toISOString() ?? null,
      caloriesKcal: mealOption.caloriesKcal ?? null,
      proteinG: mealOption.proteinG ?? null,
      carbsG: mealOption.carbsG ?? null,
      sugarsG: mealOption.sugarsG ?? null,
      fatG: mealOption.fatG ?? null,
      saturatesG: mealOption.saturatesG ?? null,
      fibreG: mealOption.fibreG ?? null,
      saltG: mealOption.saltG ?? null,
      allergens: mealOption.allergens.map((a) => ({
        id: a.id,
        name: a.name,
      })),
      groups: mealOption.groupLinks.map((link) => ({
        id: link.group.id,
        name: link.group.name,
        maxSelections: link.group.maxSelections,
        active: link.group.active,
        choices: link.group.choices.map((choice) => ({
          id: choice.id,
          name: choice.name,
          groupId: choice.groupId,
          active: choice.active,
          extraSticker: choice.extraSticker,
          caloriesKcal: choice.caloriesKcal ?? null,
          proteinG: choice.proteinG ?? null,
          carbsG: choice.carbsG ?? null,
          sugarsG: choice.sugarsG ?? null,
          fatG: choice.fatG ?? null,
          saturatesG: choice.saturatesG ?? null,
          fibreG: choice.fibreG ?? null,
          saltG: choice.saltG ?? null,
          allergens: choice.allergens.map((a) => ({
            id: a.id,
            name: a.name,
          })),
          createdAt: choice.createdAt.toISOString(),
          updatedAt: choice.updatedAt.toISOString(),
        })),
      })),
    })),
  }));

  const allAllergens: AllergenTag[] = allergens.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return <MenuManager initialSections={initialSections} allAllergens={allAllergens} />;
}