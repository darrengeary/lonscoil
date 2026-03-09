import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");
  const schoolId = searchParams.get("schoolId");

  // ---------------- ADMIN ----------------
  if (user.role === UserRole.ADMIN) {
    const where: any = {};

    if (classroomId && classroomId !== "all") {
      where.classroomId = classroomId;
    } else if (schoolId && schoolId !== "all") {
      where.classroom = { schoolId };
    }

    const pupils = await prisma.pupil.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        parentId: true,
        classroomId: true,
        classroom: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
      },
    });

    return Response.json(pupils);
  }

  // ---------------- SCHOOLADMIN ----------------
  if (user.role === UserRole.SCHOOLADMIN) {
    if (!user.schoolId) {
      return jsonError("No school assigned", 400);
    }

    const where: any = {
      classroom: {
        schoolId: user.schoolId,
      },
    };

    if (classroomId && classroomId !== "all") {
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { id: true, schoolId: true },
      });

      if (!classroom || classroom.schoolId !== user.schoolId) {
        return jsonError("Forbidden", 403);
      }

      where.classroomId = classroomId;
    }

    const pupils = await prisma.pupil.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        parentId: true,
        classroomId: true,
        classroom: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
      },
    });

    return Response.json(pupils);
  }

  // ---------------- USER / PARENT ----------------
  if (user.role === UserRole.USER) {
    const pupils = await prisma.pupil.findMany({
      where: { parentId: user.id },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        parentId: true,
        classroomId: true,
        classroom: {
          select: {
            id: true,
            name: true,
            schoolId: true,
          },
        },
      },
    });

    return Response.json(pupils);
  }

  return jsonError("Forbidden", 403);
});

export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { id, name } = await req.json().catch(() => ({}));

  if (!id || typeof name !== "string" || !name.trim()) {
    return jsonError("Invalid input", 400);
  }

  // ADMIN can edit any pupil
  if (user.role === UserRole.ADMIN) {
    const updated = await prisma.pupil.updateMany({
      where: { id },
      data: { name: name.trim() },
    });

    if (updated.count === 0) {
      return jsonError("Not found", 404);
    }

    return Response.json({ success: true });
  }

  // SCHOOLADMIN can edit pupils only in their own school
  if (user.role === UserRole.SCHOOLADMIN) {
    if (!user.schoolId) {
      return jsonError("No school assigned", 400);
    }

    const updated = await prisma.pupil.updateMany({
      where: {
        id,
        classroom: {
          schoolId: user.schoolId,
        },
      },
      data: { name: name.trim() },
    });

    if (updated.count === 0) {
      return jsonError("Not found or forbidden", 404);
    }

    return Response.json({ success: true });
  }

  // USER can edit only their own child
  if (user.role === UserRole.USER) {
    const updated = await prisma.pupil.updateMany({
      where: {
        id,
        parentId: user.id,
      },
      data: { name: name.trim() },
    });

    if (updated.count === 0) {
      return jsonError("Not found or forbidden", 404);
    }

    return Response.json({ success: true });
  }

  return jsonError("Forbidden", 403);
});