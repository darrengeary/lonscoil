import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

function slugify(s: string) {
  const clean = (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return clean || "menu";
}

async function makeUniqueSlug(name: string, excludeMenuId?: string) {
  const base = slugify(name);
  let attempt = base;
  let i = 2;

  while (true) {
    const existing = await prisma.menu.findFirst({
      where: {
        slug: attempt,
        ...(excludeMenuId ? { id: { not: excludeMenuId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return attempt;
    attempt = `${base}-${i++}`;
  }
}

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const menus = await prisma.menu.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      schoolLinks: {
        select: { school: { select: { id: true, name: true } } },
        orderBy: { school: { name: "asc" } },
      },
    },
  });

  return NextResponse.json(
    menus.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      active: m.active,
      schools: m.schoolLinks.map((x) => x.school),
    }))
  );
});

export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").trim();
  const schoolIds: string[] = Array.isArray(body?.schoolIds) ? body.schoolIds : [];

  if (!name) return new Response("name required", { status: 400 });

  const slug = await makeUniqueSlug(name);

  const created = await prisma.$transaction(async (tx) => {
    const menu = await tx.menu.create({
      data: { name, slug, active: true },
      select: { id: true, name: true, slug: true, active: true },
    });

    if (schoolIds.length) {
      await tx.menuSchool.createMany({
        data: schoolIds.map((sid) => ({ menuId: menu.id, schoolId: sid })),
        skipDuplicates: true,
      });
    }

    const links = await tx.menuSchool.findMany({
      where: { menuId: menu.id },
      select: { school: { select: { id: true, name: true } } },
      orderBy: { school: { name: "asc" } },
    });

    return { ...menu, schools: links.map((l) => l.school) };
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || !isAdmin(user)) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const id = (body?.id ?? "").trim();
  const name = (body?.name ?? "").trim();
  const schoolIds: string[] = Array.isArray(body?.schoolIds) ? body.schoolIds : [];

  if (!id) return new Response("id required", { status: 400 });
  if (!name) return new Response("name required", { status: 400 });

  // Keep slug stable OR regenerate on rename — you said it doesn't matter, so regenerate is fine.
  const slug = await makeUniqueSlug(name, id);

  const updated = await prisma.$transaction(async (tx) => {
    const menu = await tx.menu.update({
      where: { id },
      data: { name, slug },
      select: { id: true, name: true, slug: true, active: true },
    });

    await tx.menuSchool.deleteMany({ where: { menuId: id } });

    if (schoolIds.length) {
      await tx.menuSchool.createMany({
        data: schoolIds.map((sid) => ({ menuId: id, schoolId: sid })),
        skipDuplicates: true,
      });
    }

    const links = await tx.menuSchool.findMany({
      where: { menuId: id },
      select: { school: { select: { id: true, name: true } } },
      orderBy: { school: { name: "asc" } },
    });

    return { ...menu, schools: links.map((l) => l.school) };
  });

  return NextResponse.json(updated);
});