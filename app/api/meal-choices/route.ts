// app/api/meal-choices/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}

export const GET = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId")?.trim() || null;
  const menuId = searchParams.get("menuId")?.trim() || null;

  if (!menuId) {
    return new Response("menuId is required", { status: 400 });
  }

  const mealChoices = await prisma.mealChoice.findMany({
    where: {
      ...(groupId ? { groupId } : {}),
      menuLinks: { some: { menuId } },
    },
    include: { allergens: true },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(mealChoices);
});

export const POST = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await req.json();

  const {
    menuId,
    mealOptionId, // 🆕 NEW
    active,
    ...safe
  } = data;

  if (!menuId) return new Response("menuId is required", { status: 400 });
  if (!safe?.groupId) return new Response("groupId is required", { status: 400 });
  if (!safe?.name || !String(safe.name).trim()) {
    return new Response("name is required", { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const mealChoice = await tx.mealChoice.create({
      data: {
        ...safe,
      },
      include: { allergens: true },
    });

    // ✅ always link to menu (existing behaviour)
    await tx.menuMealChoice.create({
      data: { menuId, choiceId: mealChoice.id },
    });

    // 🆕 OPTIONAL: ensure group is linked to meal option
    if (mealOptionId) {
      const existing = await tx.mealOptionMealGroup.findFirst({
        where: {
          mealOptionId,
          groupId: safe.groupId,
        },
      });

      if (!existing) {
        await tx.mealOptionMealGroup.create({
          data: {
            mealOptionId,
            groupId: safe.groupId,
          },
        });
      }
    }

    return mealChoice;
  });

  return Response.json(created);
});

export const PUT = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await req.json();
  const { id, allergenIds, ...rest } = data;

  const mealChoice = await prisma.mealChoice.update({
    where: { id },
    data: {
      ...rest,
      ...(Array.isArray(allergenIds)
        ? { allergens: { set: allergenIds.map((aid: string) => ({ id: aid })) } }
        : {}),
    },
    include: { allergens: true },
  });

  return Response.json(mealChoice);
});

export const DELETE = auth(async (req) => {
  if (!req.auth || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await req.json();

  await prisma.menuMealChoice.deleteMany({ where: { choiceId: id } });

  await prisma.mealChoice.delete({ where: { id } });

  return Response.json({ success: true });
});