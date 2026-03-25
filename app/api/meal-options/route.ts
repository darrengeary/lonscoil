import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function parseNullableNumber(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNullableDate(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapMealOption(mealOption: any) {
  return {
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
    allergens: mealOption.allergens.map((a: any) => ({
      id: a.id,
      name: a.name,
    })),
  };
}

export const GET = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const menuId = searchParams.get("menuId")?.trim();

  if (!menuId) {
    return new Response("menuId required", { status: 400 });
  }

  const mealOptions = await prisma.mealOption.findMany({
    where: { menuId },
    orderBy: { name: "asc" },
    include: {
      allergens: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(mealOptions.map(mapMealOption));
});

export const POST = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const menuId = (body?.menuId ?? "").trim();
  const name = (body?.name ?? "").trim();
  const active = !!body?.active;
  const imageUrl = body?.imageUrl?.trim() || null;
  const availStart = parseNullableDate(body?.availStart);
  const availEnd = parseNullableDate(body?.availEnd);
  const allergenIds = Array.isArray(body?.allergenIds) ? body.allergenIds : [];

  if (!menuId) return new Response("menuId required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });

  try {
    const menu = await prisma.menu.findUnique({
      where: { id: menuId },
      select: { id: true },
    });

    if (!menu) {
      return new Response("menu not found", { status: 404 });
    }

const created = await prisma.mealOption.create({
  data: {
    menuId,
    name,
    active,
    imageUrl,
    availStart,
    availEnd,
    caloriesKcal: parseNullableNumber(body?.caloriesKcal),
    proteinG: parseNullableNumber(body?.proteinG),
    carbsG: parseNullableNumber(body?.carbsG),
    sugarsG: parseNullableNumber(body?.sugarsG),
    fatG: parseNullableNumber(body?.fatG),
    saturatesG: parseNullableNumber(body?.saturatesG),
    fibreG: parseNullableNumber(body?.fibreG),
    saltG: parseNullableNumber(body?.saltG),
    ...(allergenIds.length
      ? {
          allergens: {
            connect: allergenIds.map((id: string) => ({ id })),
          },
        }
      : {}),
  },
  include: {
    allergens: {
      select: { id: true, name: true },
    },
  },
});

    return NextResponse.json(mapMealOption(created), { status: 201 });
  } catch (e) {
    console.error("[meal-options.POST]", e);
    return new Response("server error", { status: 500 });
  }
});

export const PUT = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const id = (body?.id ?? "").trim();
  const name = (body?.name ?? "").trim();
  const active = !!body?.active;
  const imageUrl = body?.imageUrl?.trim() || null;
  const availStart = parseNullableDate(body?.availStart);
  const availEnd = parseNullableDate(body?.availEnd);
  const allergenIds = Array.isArray(body?.allergenIds) ? body.allergenIds : [];

  if (!id) return new Response("id required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });

  try {
    const updated = await prisma.mealOption.update({
      where: { id },
      data: {
        name,
        active,
        imageUrl,
        availStart,
        availEnd,
        caloriesKcal: parseNullableNumber(body?.caloriesKcal),
        proteinG: parseNullableNumber(body?.proteinG),
        carbsG: parseNullableNumber(body?.carbsG),
        sugarsG: parseNullableNumber(body?.sugarsG),
        fatG: parseNullableNumber(body?.fatG),
        saturatesG: parseNullableNumber(body?.saturatesG),
        fibreG: parseNullableNumber(body?.fibreG),
        saltG: parseNullableNumber(body?.saltG),
        allergens: {
          set: allergenIds.map((id: string) => ({ id })),
        },
      },
      include: {
        allergens: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(mapMealOption(updated));
  } catch (e: any) {
    console.error("[meal-options.PUT]", e);

    if (e?.code === "P2025") {
      return new Response("meal option not found", { status: 404 });
    }

    return new Response("server error", { status: 500 });
  }
});

export const DELETE = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").trim();

  if (!id) return new Response("id required", { status: 400 });

  try {
    await prisma.mealOption.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[meal-options.DELETE]", e);

    if (e?.code === "P2025") {
      return new Response("meal option not found", { status: 404 });
    }

    return new Response("server error", { status: 500 });
  }
});