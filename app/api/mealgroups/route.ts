import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function isSchoolAdmin(user: any) {
  return user?.role === "SCHOOLADMIN";
}

export const GET = auth(async (req: Request) => {
  const { user } = (req as any).auth ?? {};
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const pupilId = searchParams.get("pupilId")?.trim();
  const menuIdParam = searchParams.get("menuId")?.trim();
  let schoolId = searchParams.get("schoolId")?.trim() || null;

  if (!pupilId && !menuIdParam) {
    if (!isAdmin(user) && !isSchoolAdmin(user)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (isSchoolAdmin(user)) {
      schoolId = user.schoolId ?? null;
      if (!schoolId) return new Response("No school assigned", { status: 403 });
    }

    const menus = await prisma.menu.findMany({
      where: schoolId
        ? {
            active: true,
            OR: [{ schoolLinks: { none: {} } }, { schoolLinks: { some: { schoolId } } }],
          }
        : {
            active: true,
          },
      select: { id: true },
    });

    const menuIds = menus.map((m) => m.id);

    if (!menuIds.length) {
      return NextResponse.json([]);
    }

    const links = await prisma.menuMealGroup.findMany({
      where: {
        menuId: { in: menuIds },
      },
      orderBy: {
        group: { name: "asc" },
      },
      select: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const unique = new Map<string, { id: string; name: string }>();
    for (const link of links) {
      unique.set(link.group.id, {
        id: link.group.id,
        name: link.group.name,
      });
    }

    return NextResponse.json(
      Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  let menuId = menuIdParam ?? null;

  if (!menuId && pupilId) {
    const pupil = await prisma.pupil.findFirst({
      where: { id: pupilId, parentId: user.id },
      select: {
        menuId: true,
        classroom: { select: { schoolId: true } },
      },
    });

    if (!pupil) return new Response("Invalid pupil", { status: 401 });

    const resolvedSchoolId = pupil.classroom.schoolId;

    const allowedMenus = await prisma.menu.findMany({
      where: {
        active: true,
        OR: [{ schoolLinks: { none: {} } }, { schoolLinks: { some: { schoolId: resolvedSchoolId } } }],
      },
      orderBy: { name: "asc" },
      select: { id: true },
    });

    if (!allowedMenus.length) {
      return new Response("No active menu for school", { status: 404 });
    }

    menuId =
      (pupil.menuId && allowedMenus.some((m) => m.id === pupil.menuId)
        ? pupil.menuId
        : null) ?? allowedMenus[0].id;
  }

  if (!menuId) return new Response("Could not resolve menu", { status: 400 });

  const links = await prisma.menuMealGroup.findMany({
    where: { menuId },
    orderBy: { group: { name: "asc" } },
    select: {
      maxSelectionsOverride: true,
      group: {
        select: {
          id: true,
          name: true,
          maxSelections: true,
          choices: {
            where: {
              active: true,
              menuLinks: { some: { menuId } },
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              ingredients: true,
              imageUrl: true,
              caloriesKcal: true,
              proteinG: true,
              carbsG: true,
              sugarsG: true,
              fatG: true,
              saturatesG: true,
              fibreG: true,
              saltG: true,
            },
          },
        },
      },
    },
  });

  const groups = links.map((link) => ({
    ...link.group,
    maxSelections: link.maxSelectionsOverride ?? link.group.maxSelections,
  }));

  return NextResponse.json(groups);
});

export const POST = auth(async (req: Request) => {
  const { user } = (req as any).auth;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const mealOptionId = (body?.mealOptionId ?? "").trim();
  const maxSelections = Number(body?.maxSelections ?? 1);

  if (!mealOptionId) return new Response("mealOptionId required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });
  if (!Number.isFinite(maxSelections) || maxSelections < 1) {
    return new Response("maxSelections invalid", { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const mealOption = await tx.mealOption.findUnique({
        where: { id: mealOptionId },
        select: { id: true },
      });

      if (!mealOption) {
        throw new Error("MEAL_OPTION_NOT_FOUND");
      }

      const group = await tx.mealGroup.create({
        data: { name, maxSelections },
        select: { id: true, name: true, maxSelections: true },
      });

      await tx.mealOptionMealGroup.create({
        data: {
          mealOptionId,
          groupId: group.id,
        },
      });

      return { ...group, choices: [] };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.message === "MEAL_OPTION_NOT_FOUND") {
      return new Response("mealOption not found", { status: 404 });
    }

    console.error(e);
    return new Response("server error", { status: 500 });
  }
});