// app/api/print-jobs/route.ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, parseISO } from "date-fns";

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

  // FIX: avoid UTC parsing bug for YYYY-MM-DD
  const day = parseISO(dateStr);

  // Orders for that day + filters
  const orderWhere: any = {
    date: { gte: startOfDay(day), lte: endOfDay(day) },
  };

  if (classroomId && classroomId !== "all") {
    orderWhere.pupil = { classroomId };
  } else if (schoolId) {
    orderWhere.pupil = { classroom: { schoolId } };
  }

  // Pull orders with pupil + items + choice + allergens
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
          choiceId: true,
          choice: {
            select: {
              name: true,
              group: { select: { name: true } }, // you said group not needed on sticker, but OK to store internally
              allergens: { select: { name: true } }, // ✅ needed for label
            },
          },
        },
      },
    },
    orderBy: { pupil: { name: "asc" } },
  });

  // Infer schoolId for job record (single-school job when possible)
  const inferredSchoolId =
    schoolId ??
    (classroomId && classroomId !== "all"
      ? orders[0]?.pupil?.classroom?.schoolId ?? null
      : null);

  // Build ONE label per ORDER ITEM (choice) - skip missing automatically because only actual items exist
  const labelRows: Array<{
    pupilId: string;
    pupilName: string;
    classroom: string;
    choiceId: string;
    choiceName: string;
    extras: string[];
    allergens: string[];
    // store group internally if you want it for reporting/debugging, but you won't print it
    mealGroupName: string;
  }> = [];

  for (const o of orders) {
    const pupilId = o.pupil.id;
    const pupilName = o.pupil.name;
    const classroomName = o.pupil.classroom?.name ?? "Unknown";

    // Stable ordering for printing: by group then choice (or change to choice only if you prefer)
    const itemsSorted = [...o.items].sort((a, b) => {
      const ga = (a.choice.group?.name ?? "").toLowerCase();
      const gb = (b.choice.group?.name ?? "").toLowerCase();
      if (ga !== gb) return ga.localeCompare(gb);
      return (a.choice.name ?? "").localeCompare(b.choice.name ?? "");
    });

    for (const it of itemsSorted) {
      // Skip weird broken records
      if (!it.choiceId) continue;

      labelRows.push({
        pupilId,
        pupilName,
        classroom: classroomName,
        choiceId: it.choiceId,
        choiceName: it.choice.name ?? "Unknown",
        extras: normalizeExtras(it.selectedIngredients),
        allergens: (it.choice.allergens ?? []).map((a) => a.name).sort((a, b) => a.localeCompare(b)),
        mealGroupName: it.choice.group?.name ?? "Meal",
      });
    }
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

          // Keep storing group name internally if you ever want it,
          // even though you won't print it on sticker.
          mealType: r.mealGroupName,

          choiceId: r.choiceId,     // ✅ requires schema change
          choice: r.choiceName,
          extras: r.extras,
          allergens: r.allergens,   // ✅ requires schema change
        })),
      });
    }

    return created;
  });

  return Response.json(job);
});