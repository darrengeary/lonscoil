import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function mapMenu(menu: any) {
  return {
    id: menu.id,
    name: menu.name,
    active: menu.active,
    schools: menu.schoolLinks.map((link: any) => ({
      id: link.school.id,
      name: link.school.name,
    })),
  };
}

export const POST = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const schoolIds = Array.isArray(body?.schoolIds) ? body.schoolIds : [];
  const duplicateFromMenuId = (body?.duplicateFromMenuId ?? "").trim() || null;

  if (!name && !duplicateFromMenuId) {
    return new Response("name or duplicateFromMenuId required", { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const menu = await tx.menu.create({
        data: {
          name: name || `Copied Menu ${Date.now()}`,
          active: false,
          schoolLinks: schoolIds.length
            ? {
                create: schoolIds.map((schoolId: string) => ({ schoolId })),
              }
            : undefined,
        },
      });

      if (duplicateFromMenuId) {
        const source = await tx.menu.findUnique({
          where: { id: duplicateFromMenuId },
          include: {
            groupLinks: true,
            choiceLinks: true,
            mealOptions: {
              include: {
                allergens: true,
                groupLinks: true,
              },
            },
          },
        });

        if (!source) throw new Error("SOURCE_MENU_NOT_FOUND");

        if (!name) {
          await tx.menu.update({
            where: { id: menu.id },
            data: { name: `${source.name} Copy` },
          });
        }

        if (!schoolIds.length) {
          const sourceSchoolLinks = await tx.menuSchool.findMany({
            where: { menuId: source.id },
            select: { schoolId: true },
          });

          if (sourceSchoolLinks.length) {
            await tx.menuSchool.createMany({
              data: sourceSchoolLinks.map((link) => ({
                menuId: menu.id,
                schoolId: link.schoolId,
              })),
              skipDuplicates: true,
            });
          }
        }

        if (source.groupLinks.length) {
          await tx.menuMealGroup.createMany({
            data: source.groupLinks.map((link) => ({
              menuId: menu.id,
              groupId: link.groupId,
              maxSelectionsOverride: link.maxSelectionsOverride,
            })),
            skipDuplicates: true,
          });
        }

        if (source.choiceLinks.length) {
          await tx.menuMealChoice.createMany({
            data: source.choiceLinks.map((link) => ({
              menuId: menu.id,
              choiceId: link.choiceId,
            })),
            skipDuplicates: true,
          });
        }

        for (const sourceMealOption of source.mealOptions) {
          const clonedMealOption = await tx.mealOption.create({
            data: {
              menuId: menu.id,
              name: sourceMealOption.name,
              imageUrl: sourceMealOption.imageUrl,
              active: false,
              availStart: sourceMealOption.availStart,
              availEnd: sourceMealOption.availEnd,
              caloriesKcal: sourceMealOption.caloriesKcal,
              proteinG: sourceMealOption.proteinG,
              carbsG: sourceMealOption.carbsG,
              sugarsG: sourceMealOption.sugarsG,
              fatG: sourceMealOption.fatG,
              saturatesG: sourceMealOption.saturatesG,
              fibreG: sourceMealOption.fibreG,
              saltG: sourceMealOption.saltG,
              allergens: sourceMealOption.allergens.length
                ? {
                    connect: sourceMealOption.allergens.map((a) => ({ id: a.id })),
                  }
                : undefined,
            },
          });

          if (sourceMealOption.groupLinks.length) {
            await tx.mealOptionMealGroup.createMany({
              data: sourceMealOption.groupLinks.map((link) => ({
                mealOptionId: clonedMealOption.id,
                groupId: link.groupId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      return tx.menu.findUnique({
        where: { id: menu.id },
        include: {
          schoolLinks: {
            include: {
              school: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(mapMenu(created), { status: 201 });
  } catch (e: any) {
    if (e?.message === "SOURCE_MENU_NOT_FOUND") {
      return new Response("source menu not found", { status: 404 });
    }

    console.error("[menus.POST]", e);
    return new Response("server error", { status: 500 });
  }
});

export const PUT = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").trim();
  const name = (body?.name ?? "").trim();
  const schoolIds = Array.isArray(body?.schoolIds) ? body.schoolIds : [];
  const active = !!body?.active;

  if (!id) return new Response("id required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.menu.update({
        where: { id },
        data: { name, active },
      });

      await tx.menuSchool.deleteMany({
        where: { menuId: id },
      });

      if (schoolIds.length) {
        await tx.menuSchool.createMany({
          data: schoolIds.map((schoolId: string) => ({
            menuId: id,
            schoolId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.menu.findUnique({
        where: { id },
        include: {
          schoolLinks: {
            include: {
              school: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(mapMenu(updated));
  } catch (e: any) {
    console.error("[menus.PUT]", e);

    if (e?.code === "P2025") {
      return new Response("menu not found", { status: 404 });
    }

    return new Response("server error", { status: 500 });
  }
});