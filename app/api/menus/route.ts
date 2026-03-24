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
  const active = !!body?.active;

  if (!name) return new Response("name required", { status: 400 });

  try {
    const created = await prisma.menu.create({
      data: {
        name,
        active,
        schoolLinks: schoolIds.length
          ? {
              create: schoolIds.map((schoolId: string) => ({ schoolId })),
            }
          : undefined,
      },
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

    return NextResponse.json(mapMenu(created), { status: 201 });
  } catch (e) {
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
        data: {
          name,
          active,
        },
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