import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET: Fetch schedules (ADMIN can see all, SCHOOLADMIN only their own)
// GET: Fetch schedules (ADMIN can see all, SCHOOLADMIN/USER only their own)
export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const schoolIdParam = url.searchParams.get("schoolId");
  let where: any = {};

  if (user.role === "ADMIN") {
    if (schoolIdParam && schoolIdParam !== "all") {
      where.schoolId = schoolIdParam;
    }
    // else show all
  } else if (user.role === "SCHOOLADMIN" || user.role === "USER") {
    if (!user.schoolId) return new Response("No school assigned", { status: 400 });
    where.schoolId = user.schoolId;
    if (schoolIdParam && schoolIdParam !== user.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  const schedules = await prisma.schedule.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: { school: { select: { id: true, name: true } } },
  });

  return NextResponse.json(schedules);
});


// POST: Create new schedule (SCHOOLADMIN only, for their own school)
export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || user.role !== "SCHOOLADMIN" || !user.schoolId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { name, startDate, endDate, type } = await req.json();
  if (!name || !startDate || !endDate || !type) {
    return new Response("Missing fields", { status: 400 });
  }

  const schedule = await prisma.schedule.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
      schoolId: user.schoolId,
    },
  });
  return NextResponse.json(schedule);
});

// PUT: Update schedule (SCHOOLADMIN only, for their own school)
export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id, name, startDate, endDate, type } = await req.json();
  if (!id) return new Response("Missing id", { status: 400 });

  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) return new Response("Not found", { status: 404 });

  if (user.role === "SCHOOLADMIN") {
    if (!user.schoolId || user.schoolId !== existing.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    // ADMIN and USER cannot edit
    return new Response("Unauthorized", { status: 401 });
  }

  const updated = await prisma.schedule.update({
    where: { id },
    data: { name, startDate: new Date(startDate), endDate: new Date(endDate), type },
  });
  return NextResponse.json(updated);
});

// DELETE: Delete schedule (SCHOOLADMIN only, for their own school)
export const DELETE = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await req.json();
  if (!id) return new Response("Missing id", { status: 400 });

  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) return new Response("Not found", { status: 404 });

  if (user.role === "SCHOOLADMIN") {
    if (!user.schoolId || user.schoolId !== existing.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    // ADMIN and USER cannot delete
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.schedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
