//app/api/classrooms/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function isAdmin(user: any) {
  return user && user.role === "ADMIN";
}
function isSchoolAdmin(user: any) {
  return user && user.role === "SCHOOLADMIN";
}

// GET: List classrooms for a school (admin or schooladmin)
export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || (!isAdmin(user) && !isSchoolAdmin(user))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let schoolId = searchParams.get("schoolId");

  // SchoolAdmin can ONLY query their assigned school
  if (isSchoolAdmin(user)) {
    schoolId = user.schoolId ?? null;
    if (!schoolId) return new Response("No school assigned", { status: 403 });
  }

  const where = schoolId ? { schoolId } : undefined;

  // Fetch classrooms and their pupils' statuses
  const classrooms = await prisma.classroom.findMany({
    where,
    select: {
      id: true,
      name: true,
      pupils: { select: { status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Count pupils by status
  const result = classrooms.map((cls) => {
    let registeredCount = 0, unregisteredCount = 0;
    for (const pupil of cls.pupils) {
      if (pupil.status === "REGISTERED") registeredCount++;
      else unregisteredCount++;
    }
    return {
      id: cls.id,
      name: cls.name,
      registeredCount,
      unregisteredCount,
    };
  });

  return Response.json(result);
});

// POST: Create a classroom (admin or schooladmin)
export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || (!isAdmin(user) && !isSchoolAdmin(user))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();

  // Only allow classroom creation for user's own school (schooladmin)
  if (isSchoolAdmin(user)) {
    if (data.schoolId !== user.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const classroom = await prisma.classroom.create({ data });
  return Response.json(classroom);
});

// PUT: Update a classroom (admin or schooladmin)
export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || (!isAdmin(user) && !isSchoolAdmin(user))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const data = await req.json();
  const { id, ...update } = data;

  // Schooladmin: fetch classroom, verify it's in their school!
  if (isSchoolAdmin(user)) {
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom || classroom.schoolId !== user.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const classroom = await prisma.classroom.update({ where: { id }, data: update });
  return Response.json(classroom);
});

// DELETE: Remove classroom (admin or schooladmin)
export const DELETE = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || (!isAdmin(user) && !isSchoolAdmin(user))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await req.json();

  // Schooladmin: fetch classroom, verify it's in their school!
  if (isSchoolAdmin(user)) {
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom || classroom.schoolId !== user.schoolId) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  await prisma.classroom.delete({ where: { id } });
  return Response.json({ success: true });
});
