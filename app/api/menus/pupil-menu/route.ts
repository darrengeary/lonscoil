import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const pupilId = searchParams.get("pupilId")?.trim();
  if (!pupilId) return new Response("pupilId required", { status: 400 });

  const pupil = await prisma.pupil.findFirst({
    where: { id: pupilId, parentId: req.auth.user.id },
    select: {
      menuId: true,
      classroom: { select: { schoolId: true } },
    },
  });
  if (!pupil) return new Response("Invalid pupil", { status: 401 });

  const schoolId = pupil.classroom.schoolId;

  // ✅ menus allowed for this school OR global
  const menus = await prisma.menu.findMany({
    where: {
      active: true,
      OR: [
        { schoolLinks: { none: {} } },           // GLOBAL
        { schoolLinks: { some: { schoolId } } }, // linked to this school
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (!menus.length) return new Response("No menus available", { status: 404 });

  // ✅ effective menu: pupil.menuId if allowed else first allowed menu
  const effective =
    (pupil.menuId && menus.find((m) => m.id === pupil.menuId)) || menus[0];

  return NextResponse.json({
    effectiveMenu: effective,
    menus,
  });
});