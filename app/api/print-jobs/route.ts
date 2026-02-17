// app/api/print-jobs/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

type AnyUser = {
  id?: string;
  role?: "ADMIN" | "SCHOOLADMIN" | string;
  schoolId?: string | null;
};

function normalizeExtras(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
}

function isLunch(groupName: string | null | undefined) {
  return (groupName ?? "").trim().toLowerCase() === "lunch";
}
function isSnack(groupName: string | null | undefined) {
  return (groupName ?? "").trim().toLowerCase() === "snack";
}

export const POST = auth(async (req) => {
  const user = (req as any).auth?.user as AnyUser | undefined;

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  let schoolId = searchParams.get("schoolId"); // ADMIN only
  const classroomId = searchParams.get("classroomId");

  if (!dateStr) return new Response("date required", { status: 400 });

  // --- RBAC ---
  if (user?.role === "SCHOOLADMIN") {
    schoolId = user.schoolId ?? null;
    if (!schoolId) return new Response("No school assigned", { status: 403 });
  } else if (user?.role === "ADMIN") {
    if (!schoolId || schoolId === "all") schoolId = null;
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  const day = new Date(dateStr);

  // Orders for that day + filters
  const orderWhere: any = {
    date: { gte: startOfDay(day), lte: endOfDay(day) },
  };

  if (classroomId && classroomId !== "all") {
    orderWhere.pupil = { classroomId };
  } else if (schoolId) {
    orderWhere.pupil = { classroom: { schoolId } };
  }

  // Pull orders with pupil + items + choice group name
  const orders = await prisma.lunchOrder.findMany({
    where: orderWhere,
    select: {
      pupil: {
        select: {
          id: true,
          name: true,
          classroom: { select: { id: true, name: true, schoolId: true } },
        },
      },
      items: {
        select: {
          selectedIngredients: true,
          choice: { select: { name: true, group: { select: { name: true } } } },
        },
      },
    },
    orderBy: { pupil: { name: "asc" } },
  });

  // Resolve schoolId if caller is ADMIN and passed "all" (null) and we still want to store schoolId on job:
  // - If filtering by classroom: infer via first order's classroom
  // - Else if filtering by school: it's already set
  // - Else: leave null (multi-school job)
  const inferredSchoolId =
    schoolId ??
    (classroomId && classroomId !== "all" ? orders[0]?.pupil?.classroom?.schoolId ?? null : null);

  // Build EXACTLY 2 labels per pupil: LUNCH + SNACK (even if missing)
  const labelRows: Array<{
    pupilId: string;
    pupilName: string;
    classroom: string;
    mealType: "LUNCH" | "SNACK";
    choice: string;
    extras: string[];
  }> = [];

  for (const o of orders) {
    const pupilId = o.pupil.id;
    const pupilName = o.pupil.name;
    const classroomName = o.pupil.classroom?.name ?? "Unknown";

    const lunchItem = o.items.find((it) => isLunch(it.choice.group?.name));
    const snackItem = o.items.find((it) => isSnack(it.choice.group?.name));

    labelRows.push({
      pupilId,
      pupilName,
      classroom: classroomName,
      mealType: "LUNCH",
      choice: lunchItem?.choice?.name ?? "NO LUNCH SELECTED",
      extras: normalizeExtras(lunchItem?.selectedIngredients),
    });

    labelRows.push({
      pupilId,
      pupilName,
      classroom: classroomName,
      mealType: "SNACK",
      choice: snackItem?.choice?.name ?? "NO SNACK SELECTED",
      extras: normalizeExtras(snackItem?.selectedIngredients),
    });
  }

  // Create job + items (seq = 1..N)
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.printJob.create({
      data: {
        createdById: user?.id ?? null,
        date: startOfDay(day),
        schoolId: inferredSchoolId,
        classroomId: classroomId && classroomId !== "all" ? classroomId : null,
        status: "CREATED",
        nextSeq: 1,
        totalLabels: labelRows.length,
      },
      select: { id: true, totalLabels: true, nextSeq: true },
    });

    if (labelRows.length) {
      await tx.printJobItem.createMany({
        data: labelRows.map((r, idx) => ({
          jobId: created.id,
          seq: idx + 1,
          pupilId: r.pupilId,
          pupilName: r.pupilName,
          classroom: r.classroom,
          mealType: r.mealType,
          choice: r.choice,
          extras: r.extras,
        })),
      });
    }

    return created;
  });

  return Response.json(job);
});
