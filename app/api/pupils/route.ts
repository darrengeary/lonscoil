import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");

  // ADMIN: any classroom
  if (user.role === UserRole.ADMIN) {
    if (!classroomId) return Response.json([]);
    const pupils = await prisma.pupil.findMany({
      where: { classroomId },
      orderBy: { createdAt: "asc" },
      include: { classroom: { select: { name: true } } },
    });
    return Response.json(pupils);
  }

  // SCHOOLADMIN: only classrooms in their school
  if (user.role === UserRole.SCHOOLADMIN) {
    if (!classroomId) return Response.json([]);
    // Check that classroom belongs to their school
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { schoolId: true },
    });
    if (!classroom || classroom.schoolId !== user.schoolId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const pupils = await prisma.pupil.findMany({
      where: { classroomId },
      orderBy: { createdAt: "asc" },
      include: { classroom: { select: { name: true } } },
    });
    return Response.json(pupils);
  }

  // PARENT: only their pupils
  if (user.role === UserRole.USER) {
    const pupils = await prisma.pupil.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "asc" },
      include: { classroom: { select: { name: true } } },
    });
    return Response.json(pupils);
  }

  return Response.json({ error: "Forbidden" }, { status: 403 });
});

export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name } = await req.json();
  if (!id || typeof name !== "string") {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  // Only ADMIN can edit any pupil; USER can edit their own
  const where =
    user.role === UserRole.ADMIN
      ? { id }
      : { id, parentId: user.id };

  const updated = await prisma.pupil.updateMany({
    where,
    data: { name },
  });

  if (updated.count === 0) {
    return Response.json({ error: "Not found or forbidden" }, { status: 404 });
  }
  return Response.json({ success: true });
});
