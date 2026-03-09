import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { addHours, parseISO, startOfDay, isValid } from "date-fns";

type AbsenceScope = "PUPIL" | "CLASSROOM";

function getSchoolIdParam(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("schoolId");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? startOfDay(d) : null;
}

function isAllowedRole(user: any) {
  return user?.role === "ADMIN" || user?.role === "SCHOOLADMIN";
}

function getEarliestAllowedDate() {
  return addHours(new Date(), 36);
}

// -------------------- GET --------------------
export const GET = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const schoolIdParam = url.searchParams.get("schoolId");
    const classroomId = url.searchParams.get("classroomId");
    const pupilId = url.searchParams.get("pupilId");

    const where: any = {};

    if (user.role === "SCHOOLADMIN") {
      if (!user.schoolId) return jsonError("No school assigned", 400);
      where.schoolId = user.schoolId;
    } else if (user.role === "ADMIN") {
      if (schoolIdParam && schoolIdParam !== "all") where.schoolId = schoolIdParam;
    } else {
      return jsonError("Unauthorized", 401);
    }

    if (classroomId && classroomId !== "all") where.classroomId = classroomId;
    if (pupilId && pupilId !== "all") where.pupilId = pupilId;

    const absences = await prisma.absence.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
      include: {
        school: { select: { id: true, name: true } },
        classroom: { select: { id: true, name: true } },
        pupil: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(absences);
  } catch (e) {
    console.error("GET /api/absences error:", e);
    return jsonError("Server error", 500);
  }
});

// -------------------- POST --------------------
export const POST = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user || !isAllowedRole(user)) return jsonError("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Invalid JSON body", 400);

    const {
      name,
      scope,
      startDate,
      endDate,
      classroomId,
      pupilId,
      notes,
    }: {
      name?: string;
      scope?: AbsenceScope;
      startDate?: string;
      endDate?: string;
      classroomId?: string;
      pupilId?: string;
      notes?: string;
    } = body;

    if (!name?.trim()) return jsonError("Name is required", 400);
    if (scope !== "PUPIL" && scope !== "CLASSROOM") return jsonError("Invalid scope", 400);

    const sd = parseDateOnly(startDate);
    const ed = parseDateOnly(endDate);
    if (!sd || !ed) return jsonError("Invalid startDate or endDate", 400);
    if (sd > ed) return jsonError("Start date cannot be after end date", 400);

    const earliestAllowed = getEarliestAllowedDate();
    if (sd < earliestAllowed) {
      return jsonError("Absences must be created at least 36 hours in advance", 400);
    }

    let schoolId: string | null = null;

    if (user.role === "SCHOOLADMIN") {
      if (!user.schoolId) return jsonError("No school assigned", 400);
      schoolId = user.schoolId;
    } else if (user.role === "ADMIN") {
      const sid = getSchoolIdParam(req);
      if (!sid || sid === "all") return jsonError("Missing ?schoolId=...", 400);
      schoolId = sid;
    }

    if (!schoolId) return jsonError("Missing school", 400);

    if (scope === "CLASSROOM") {
      if (!classroomId) return jsonError("classroomId required for classroom absence", 400);

      const classroom = await prisma.classroom.findFirst({
        where: { id: classroomId, schoolId },
        select: { id: true },
      });
      if (!classroom) return jsonError("Invalid classroom", 400);

      const created = await prisma.absence.create({
        data: {
          name: name.trim(),
          scope,
          startDate: sd,
          endDate: ed,
          schoolId,
          classroomId,
          notes: notes?.trim() || null,
        },
        include: {
          school: { select: { id: true, name: true } },
          classroom: { select: { id: true, name: true } },
          pupil: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(created, { status: 201 });
    }

    if (!pupilId) return jsonError("pupilId required for pupil absence", 400);

    const pupil = await prisma.pupil.findFirst({
      where: {
        id: pupilId,
        classroom: { schoolId },
      },
      select: { id: true, classroomId: true },
    });
    if (!pupil) return jsonError("Invalid pupil", 400);

    const created = await prisma.absence.create({
      data: {
        name: name.trim(),
        scope,
        startDate: sd,
        endDate: ed,
        schoolId,
        pupilId,
        classroomId: pupil.classroomId,
        notes: notes?.trim() || null,
      },
      include: {
        school: { select: { id: true, name: true } },
        classroom: { select: { id: true, name: true } },
        pupil: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/absences error:", e);
    return jsonError("Server error", 500);
  }
});

// -------------------- PUT --------------------
export const PUT = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user || !isAllowedRole(user)) return jsonError("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Invalid JSON body", 400);

    const {
      id,
      name,
      scope,
      startDate,
      endDate,
      classroomId,
      pupilId,
      notes,
    }: {
      id?: string;
      name?: string;
      scope?: AbsenceScope;
      startDate?: string;
      endDate?: string;
      classroomId?: string;
      pupilId?: string;
      notes?: string;
    } = body;

    if (!id) return jsonError("Missing id", 400);

    const existing = await prisma.absence.findUnique({
      where: { id },
      select: { id: true, schoolId: true },
    });

    if (!existing) return jsonError("Not found", 404);

    if (user.role === "SCHOOLADMIN") {
      if (!user.schoolId || user.schoolId !== existing.schoolId) return jsonError("Forbidden", 403);
    } else if (user.role !== "ADMIN") {
      return jsonError("Unauthorized", 401);
    }

    const data: any = {};

    if (typeof name === "string") data.name = name.trim();
    if (typeof notes === "string") data.notes = notes.trim() || null;

    const nextScope = scope ?? undefined;
    if (nextScope && nextScope !== "PUPIL" && nextScope !== "CLASSROOM") {
      return jsonError("Invalid scope", 400);
    }
    if (nextScope) data.scope = nextScope;

    let nextStartDate: Date | null | undefined = undefined;
    let nextEndDate: Date | null | undefined = undefined;

    if (startDate) {
      const sd = parseDateOnly(startDate);
      if (!sd) return jsonError("Invalid startDate", 400);
      nextStartDate = sd;
      data.startDate = sd;
    }

    if (endDate) {
      const ed = parseDateOnly(endDate);
      if (!ed) return jsonError("Invalid endDate", 400);
      nextEndDate = ed;
      data.endDate = ed;
    }

    const effectiveStart = nextStartDate ?? null;
    if (effectiveStart) {
      if (effectiveStart < getEarliestAllowedDate()) {
        return jsonError("Absences must be updated at least 36 hours in advance", 400);
      }
    }

    if (classroomId !== undefined) data.classroomId = classroomId || null;
    if (pupilId !== undefined) data.pupilId = pupilId || null;

    const updated = await prisma.absence.update({
      where: { id },
      data,
      include: {
        school: { select: { id: true, name: true } },
        classroom: { select: { id: true, name: true } },
        pupil: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PUT /api/absences error:", e);
    return jsonError("Server error", 500);
  }
});

// -------------------- DELETE --------------------
export const DELETE = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user || !isAllowedRole(user)) return jsonError("Unauthorized", 401);

    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Invalid JSON body", 400);

    const { id } = body as { id?: string };
    if (!id) return jsonError("Missing id", 400);

    const existing = await prisma.absence.findUnique({
      where: { id },
      select: { id: true, schoolId: true, startDate: true },
    });

    if (!existing) return jsonError("Not found", 404);

    if (user.role === "SCHOOLADMIN") {
      if (!user.schoolId || user.schoolId !== existing.schoolId) return jsonError("Forbidden", 403);
    } else if (user.role !== "ADMIN") {
      return jsonError("Unauthorized", 401);
    }

    if (existing.startDate < getEarliestAllowedDate()) {
      return jsonError("Absences cannot be deleted within 36 hours", 400);
    }

    await prisma.absence.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/absences error:", e);
    return jsonError("Server error", 500);
  }
});