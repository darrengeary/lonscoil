import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function isAdmin(user: any) {
  return user?.role === "ADMIN";
}

type BulkItem = { name: string; classroomCount?: number };

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || !isAdmin(user)) {
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
          totalPupils: true,
          pupils: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  const rows = schools.map((school) => {
    const classroomCount = school.classrooms.length;

    let registeredCount = 0;
    let unregisteredCount = 0;

    for (const classroom of school.classrooms) {
      for (const pupil of classroom.pupils) {
        if (pupil.status === "UNREGISTERED") {
          unregisteredCount += 1;
        } else {
          registeredCount += 1;
        }
      }
    }

    return {
      id: school.id,
      name: school.name,
      classroomCount,
      registeredCount,
      unregisteredCount,
    };
  });

  return NextResponse.json(rows);
});

export const POST = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const items: BulkItem[] = Array.isArray(body?.items)
    ? body.items
    : typeof body?.name === "string"
    ? [{ name: body.name, classroomCount: body.classroomCount }]
    : [];

  const cleaned = items
    .filter((it) => it && typeof it.name === "string")
    .map((it) => ({
      name: it.name.trim(),
      classroomCount:
        typeof it.classroomCount === "number"
          ? Math.max(0, Math.min(200, Math.floor(it.classroomCount)))
          : 0,
    }))
    .filter((it) => it.name.length > 0);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "Provide name or items[]" }, { status: 400 });
  }

  const seen = new Set<string>();
  const unique = cleaned.filter((it) => {
    const key = it.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  try {
    const created = await prisma.$transaction(
      unique.map((it) =>
        prisma.school.create({
          data: {
            name: it.name,
            classrooms:
              it.classroomCount > 0
                ? {
                    create: Array.from({ length: it.classroomCount }, (_, i) => ({
                      name: `Classroom ${i + 1}`,
                    })),
                  }
                : undefined,
          },
          select: { id: true, name: true },
        })
      )
    );

    return NextResponse.json({
      success: true,
      createdCount: created.length,
      created,
    });
  } catch (error: any) {
    console.error("POST /api/schools error:", error);
    return NextResponse.json({ error: "Failed to create schools" }, { status: 500 });
  }
});