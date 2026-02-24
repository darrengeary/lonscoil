//app/api/schedule/route.ts

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

type ScheduleType = "TERM" | "HOLIDAY";

function getSchoolIdParam(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("schoolId");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// -------------------- GET --------------------
export const GET = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user) return jsonError("Unauthorized", 401);

    const where: { schoolId?: string } = {};

    if (user.role === "USER" || user.role === "SCHOOLADMIN") {
      if (!user.schoolId) return jsonError("No school assigned", 400);
      // Ignore any ?schoolId= for USER/SCHOOLADMIN
      where.schoolId = user.schoolId;
    } else if (user.role === "ADMIN") {
      const sid = getSchoolIdParam(req);
      if (sid && sid !== "all") where.schoolId = sid;
      // else return all
    } else {
      return jsonError("Unauthorized", 401);
    }

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
      include: { school: { select: { id: true, name: true } } },
    });

    return NextResponse.json(schedules);
  } catch (e) {
    console.error("GET /api/schedule error:", e);
    return jsonError("Server error", 500);
  }
});

// -------------------- POST --------------------
export const POST = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user) return jsonError("Unauthorized", 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const { name, startDate, endDate, type } = body as {
      name?: string;
      startDate?: string;
      endDate?: string;
      type?: ScheduleType;
    };

    if (!name || !startDate || !endDate || !type) {
      return jsonError("Missing fields: name, startDate, endDate, type", 400);
    }

    let schoolId: string | null = null;

    if (user.role === "SCHOOLADMIN") {
      if (!user.schoolId) return jsonError("No school assigned", 400);
      schoolId = user.schoolId;
    } else if (user.role === "ADMIN") {
      const sid = getSchoolIdParam(req);
      if (!sid || sid === "all") return jsonError("Missing ?schoolId=...", 400);
      schoolId = sid;
    } else {
      return jsonError("Unauthorized", 401);
    }

    const sd = new Date(startDate);
    const ed = new Date(endDate);
    if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) {
      return jsonError("Invalid startDate or endDate (expected ISO or yyyy-MM-dd)", 400);
    }

    const schedule = await prisma.schedule.create({
      data: { name, startDate: sd, endDate: ed, type, schoolId },
      include: { school: { select: { id: true, name: true } } },
    });

    return NextResponse.json(schedule);
  } catch (e: any) {
    console.error("POST /api/schedule error:", e);

    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "A schedule with that name already exists for this school. Pick a unique name." },
        { status: 409 }
      );
    }

    return jsonError("Server error", 500);
  }
});

// -------------------- PUT --------------------
export const PUT = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user) return jsonError("Unauthorized", 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const { id, name, startDate, endDate, type } = body as {
      id?: string;
      name?: string;
      startDate?: string;
      endDate?: string;
      type?: ScheduleType;
    };

    if (!id) return jsonError("Missing id", 400);

    const existing = await prisma.schedule.findUnique({
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
    if (typeof name === "string") data.name = name;
    if (typeof type === "string") data.type = type;

    if (startDate) {
      const sd = new Date(startDate);
      if (Number.isNaN(sd.getTime())) return jsonError("Invalid startDate", 400);
      data.startDate = sd;
    }

    if (endDate) {
      const ed = new Date(endDate);
      if (Number.isNaN(ed.getTime())) return jsonError("Invalid endDate", 400);
      data.endDate = ed;
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data,
      include: { school: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PUT /api/schedule error:", e);
    return jsonError("Server error", 500);
  }
});

// -------------------- DELETE --------------------
export const DELETE = auth(async (req) => {
  try {
    const user = req.auth?.user;
    if (!user) return jsonError("Unauthorized", 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const { id } = body as { id?: string };
    if (!id) return jsonError("Missing id", 400);

    const existing = await prisma.schedule.findUnique({
      where: { id },
      select: { id: true, schoolId: true },
    });
    if (!existing) return jsonError("Not found", 404);

    if (user.role === "SCHOOLADMIN") {
      if (!user.schoolId || user.schoolId !== existing.schoolId) return jsonError("Forbidden", 403);
    } else if (user.role !== "ADMIN") {
      return jsonError("Unauthorized", 401);
    }

    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/schedule error:", e);
    return jsonError("Server error", 500);
  }
});