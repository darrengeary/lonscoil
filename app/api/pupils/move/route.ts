// app/api/pupils/move/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { pupilIds, toClassroomId } = await req.json();

  if (!Array.isArray(pupilIds) || pupilIds.length === 0 || typeof toClassroomId !== "string") {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SCHOOLADMIN) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const toClassroom = await prisma.classroom.findUnique({
    where: { id: toClassroomId },
    select: { id: true, schoolId: true },
  });
  if (!toClassroom) return Response.json({ error: "Target classroom not found" }, { status: 404 });

  // SCHOOLADMIN: only moves within their school
  if (user.role === UserRole.SCHOOLADMIN) {
    if (toClassroom.schoolId !== user.schoolId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const from = await prisma.pupil.findMany({
      where: { id: { in: pupilIds } },
      select: { id: true, classroom: { select: { schoolId: true } } },
    });

    if (from.some((p) => p.classroom.schoolId !== user.schoolId)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await prisma.pupil.updateMany({
    where: { id: { in: pupilIds } },
    data: { classroomId: toClassroomId },
  });

  return Response.json({ success: true });
});