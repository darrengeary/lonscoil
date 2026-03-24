import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function normalizePupilName(name: string | null | undefined) {
  return name?.trim() || "Unnamed";
}

function normalizeParentName(name: string | null | undefined) {
  return name?.trim() || "Unnamed";
}

function normalizeParentEmail(email: string | null | undefined) {
  return email?.trim() || "—";
}

function buildNameFilter(q: string) {
  if (!q.trim()) return undefined;

  return {
    contains: q.trim(),
    mode: "insensitive" as const,
  };
}

function mapPupil(pupil: any) {
  return {
    ...pupil,
    name: normalizePupilName(pupil.name),
    parent: pupil.parent
      ? {
          ...pupil.parent,
          name: normalizeParentName(pupil.parent.name),
          email: normalizeParentEmail(pupil.parent.email),
        }
      : null,
  };
}

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get("classroomId");
  const schoolId = searchParams.get("schoolId");
  const q = (searchParams.get("q") ?? "").trim();
  const takeRaw = Number(searchParams.get("take") ?? "50");
  const take = Math.min(Math.max(takeRaw, 1), 100);

  const nameFilter = buildNameFilter(q);

  const select = {
    id: true,
    name: true,
    status: true,
    parentId: true,
    classroomId: true,
    parent: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    classroom: {
      select: {
        id: true,
        name: true,
        schoolId: true,
      },
    },
  } as const;

  if (user.role === UserRole.ADMIN) {
    const where: any = {};

    if (classroomId && classroomId !== "all") {
      where.classroomId = classroomId;
    } else if (schoolId) {
      where.classroom = { schoolId };
    }

    if (nameFilter) {
      where.name = nameFilter;
    }

    const pupils = await prisma.pupil.findMany({
      where,
      take,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select,
    });

    return Response.json(pupils.map(mapPupil));
  }

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

    if (nameFilter) {
      where.name = nameFilter;
    }

    const pupils = await prisma.pupil.findMany({
      where,
      take,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select,
    });

    return Response.json(pupils.map(mapPupil));
  }

  if (user.role === UserRole.USER) {
    const where: any = {
      parentId: user.id,
    };

    if (nameFilter) {
      where.name = nameFilter;
    }

    const pupils = await prisma.pupil.findMany({
      where,
      take,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select,
    });

    return Response.json(pupils.map(mapPupil));
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