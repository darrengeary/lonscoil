import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET schedules for a school
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    if (!schoolId) {
      return NextResponse.json({ error: "Missing schoolId" }, { status: 400 });
    }
    const schedules = await prisma.schedule.findMany({
      where: { schoolId },
      orderBy: { startDate: "asc" },
    });
    return NextResponse.json(schedules);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// CREATE schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, startDate, endDate, type, schoolId } = body;

    if (!name || !startDate || !endDate || !type || !schoolId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!["TERM", "HOLIDAY"].includes(type)) {
      return NextResponse.json({ error: "Invalid schedule type" }, { status: 400 });
    }
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: "School does not exist" }, { status: 400 });
    }

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
  } catch (e) {
    console.error('Schedule Create Error:', e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// UPDATE schedule
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, startDate, endDate, type } = body;

    if (!id || !name || !startDate || !endDate || !type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!["TERM", "HOLIDAY"].includes(type)) {
      return NextResponse.json({ error: "Invalid schedule type" }, { status: 400 });
    }
    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
      },
    });
    return NextResponse.json(schedule);
  } catch (e) {
    console.error('Schedule Update Error:', e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE schedule
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Schedule Delete Error:', e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
