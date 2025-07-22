import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

export const GET = auth(async (req) => {
  if (!req.auth?.user || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      classrooms: {
        select: {
          id: true,
          pupils: { select: { status: true } },
        },
      },
    },
  });

  const result = schools.map((s) => {
    let registered = 0, unregistered = 0;
    for (const c of s.classrooms) {
      for (const p of c.pupils) {
        p.status === "REGISTERED" ? registered++ : unregistered++;
      }
    }
    return {
      id:               s.id,
      name:             s.name,
      registeredCount:   registered,
      unregisteredCount: unregistered,
      classroomCount:    s.classrooms.length,
    };
  });

  return NextResponse.json(result);
});

export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { name, startDate, endDate, type, schoolId: clientSchoolId } = await req.json();
  if (!name || !startDate || !endDate || !type) {
    return new Response("Missing fields", { status: 400 });
  }

  // Always determine schoolId by role
  let schoolId;
  if (user.role === "ADMIN") {
    schoolId = clientSchoolId;
    if (!schoolId) return new Response("Missing schoolId", { status: 400 });
  } else {
    schoolId = user.schoolId;
    if (!schoolId) return new Response("Missing schoolId", { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return new Response("School does not exist", { status: 400 });

  const schedule = await prisma.schedule.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
      schoolId,
    },
  });
  return NextResponse.json(schedule);
});

export const PUT = auth(async (req) => {
  if (!req.auth?.user || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id, name } = await req.json();
  if (!id || !name) return new Response("ID and Name are required", { status: 400 });

  const school = await prisma.school.update({ where: { id }, data: { name } });
  return NextResponse.json(school);
});

export const DELETE = auth(async (req) => {
  if (!req.auth?.user || !isAdmin(req.auth.user)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return new Response("ID is required", { status: 400 });

  await prisma.school.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
