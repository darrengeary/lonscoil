import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
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
    select: {
      id: true,
      name: true,
      menuId: true,
      stickerCount: true,
    },
  });

  return NextResponse.json(mealOptions);
});

export const POST = auth(async (req: Request) => {
  const user = (req as any).auth?.user;
  if (!user || !isAdmin(user)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const menuId = (body?.menuId ?? "").trim();
  const name = (body?.name ?? "").trim();
  const stickerCount = Number(body?.stickerCount ?? 1);

  if (!menuId) return new Response("menuId required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });
  if (!Number.isFinite(stickerCount) || stickerCount < 1) {
    return new Response("stickerCount invalid", { status: 400 });
  }

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
        stickerCount,
      },
      select: {
        id: true,
        name: true,
        menuId: true,
        stickerCount: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
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
  const stickerCount = Number(body?.stickerCount ?? 1);

  if (!id) return new Response("id required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });
  if (!Number.isFinite(stickerCount) || stickerCount < 1) {
    return new Response("stickerCount invalid", { status: 400 });
  }

  try {
    const updated = await prisma.mealOption.update({
      where: { id },
      data: {
        name,
        stickerCount,
      },
      select: {
        id: true,
        name: true,
        menuId: true,
        stickerCount: true,
      },
    });

    return NextResponse.json(updated);
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