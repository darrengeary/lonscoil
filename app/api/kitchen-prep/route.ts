import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, parseISO, isValid } from "date-fns";

type AnyUser = {
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

function extrasSignature(extras: string[]): string {
  return extras.length ? extras.join(" + ") : "No extras";
}

export const GET = auth(async (req) => {
  const user = (req as any).auth?.user as AnyUser | undefined;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  let schoolId = searchParams.get("schoolId"); // ADMIN only
  const classroomId = searchParams.get("classroomId");
  const mealGroupId = searchParams.get("mealGroupId");
  const view = searchParams.get("view") ?? "grouped"; // grouped | extras | student

  if (!date) return new Response("Date required", { status: 400 });

  const day = parseISO(date);
  if (!isValid(day)) {
    return new Response("Invalid date", { status: 400 });
  }

  // --- RBAC ---
  if (user?.role === "SCHOOLADMIN") {
    schoolId = user.schoolId ?? null;
    if (!schoolId) return new Response("No school assigned", { status: 403 });
  } else if (user?.role === "ADMIN") {
    if (!schoolId || schoolId === "all") schoolId = null;
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  // Orders on that day
  const orderWhere: any = {
    date: { gte: startOfDay(day), lte: endOfDay(day) },
  };

  // Compose classroom + school together to avoid scope bypass
  const pupilWhere: any = {};

  if (classroomId && classroomId !== "all") {
    pupilWhere.classroomId = classroomId;
  }

  if (schoolId) {
    pupilWhere.classroom = { schoolId };
  }

  if (Object.keys(pupilWhere).length > 0) {
    orderWhere.pupil = pupilWhere;
  }

  // Optional: restrict to meal group
  let filterChoiceIds: string[] | undefined;
  if (mealGroupId && mealGroupId !== "all") {
    const group = await prisma.mealGroup.findUnique({
      where: { id: mealGroupId },
      select: { choices: { select: { id: true } } },
    });

    if (!group) {
      return new Response("Meal group not found", { status: 404 });
    }

    filterChoiceIds = group.choices.map((c) => c.id);
  }

  // Pull order items once; reuse for all views
  const items = await prisma.orderItem.findMany({
    where: {
      order: orderWhere,
      ...(filterChoiceIds !== undefined ? { choiceId: { in: filterChoiceIds } } : {}),
    },
    select: {
      id: true,
      choiceId: true,
      selectedIngredients: true,
      choice: {
        select: {
          name: true,
          group: { select: { name: true } },
        },
      },
      order: {
        select: {
          pupil: {
            select: {
              name: true,
              classroom: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // ----------------------------
  // STUDENT VIEW
  // ----------------------------
  if (view === "student") {
    const studentRows = items
      .map((it) => {
        const extras = normalizeExtras(it.selectedIngredients ?? []);
        return {
          pupilName: it.order.pupil.name ?? "Unknown",
          classroom: it.order.pupil.classroom?.name ?? "Unknown",
          group: it.choice.group?.name ?? "Unknown",
          choice: it.choice.name ?? "Unknown",
          extras,
          extrasSig: extrasSignature(extras),
        };
      })
      .sort((a, b) => {
        if (a.classroom !== b.classroom) return a.classroom.localeCompare(b.classroom);
        if (a.pupilName !== b.pupilName) return a.pupilName.localeCompare(b.pupilName);
        if (a.group !== b.group) return a.group.localeCompare(b.group);
        return a.choice.localeCompare(b.choice);
      });

    return Response.json({ studentRows });
  }

  // ----------------------------
  // GROUPED / EXTRAS VIEW
  // ----------------------------
  const mealCount = new Map<string, number>();
  const label = new Map<string, { group: string; choice: string }>();

  const extrasTotals = new Map<string, number>();
  const extrasByChoice = new Map<string, Map<string, number>>();

  const splitCount = new Map<string, number>(); // key: `${choiceId}||${sig}`

  for (const it of items) {
    mealCount.set(it.choiceId, (mealCount.get(it.choiceId) ?? 0) + 1);

    if (!label.has(it.choiceId)) {
      label.set(it.choiceId, {
        group: it.choice.group?.name ?? "Unknown",
        choice: it.choice.name ?? "Unknown",
      });
    }

    const extras = normalizeExtras(it.selectedIngredients ?? []);

    // extras occurrences
    for (const ex of extras) {
      extrasTotals.set(ex, (extrasTotals.get(ex) ?? 0) + 1);

      if (!extrasByChoice.has(it.choiceId)) {
        extrasByChoice.set(it.choiceId, new Map());
      }

      const m = extrasByChoice.get(it.choiceId)!;
      m.set(ex, (m.get(ex) ?? 0) + 1);
    }

    // split bucket
    const sig = extrasSignature(extras);
    const key = `${it.choiceId}||${sig}`;
    splitCount.set(key, (splitCount.get(key) ?? 0) + 1);
  }

  const meals = Array.from(mealCount.entries())
    .map(([choiceId, count]) => {
      const meta = label.get(choiceId) ?? { group: "Unknown", choice: "Unknown" };
      const perChoice = extrasByChoice.get(choiceId);

      return {
        group: meta.group,
        choice: meta.choice,
        count,
        extras: perChoice
          ? Array.from(perChoice.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([name, qty]) => ({ name, qty }))
          : [],
      };
    })
    .sort((a, b) => b.count - a.count);

  const extrasTotalsArr = Array.from(extrasTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => ({ name, qty }));

  if (view === "grouped") {
    return Response.json({
      meals,
      extrasTotals: extrasTotalsArr,
    });
  }

  // extras view
  const splitMeals = Array.from(splitCount.entries())
    .map(([key, count]) => {
      const sep = key.indexOf("||");
      const choiceId = sep >= 0 ? key.slice(0, sep) : key;
      const sig = sep >= 0 ? key.slice(sep + 2) : "No extras";

      const meta = label.get(choiceId) ?? { group: "Unknown", choice: "Unknown" };

      return {
        group: meta.group,
        choice: meta.choice,
        extrasSig: sig,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  // invariant check
  const groupedByChoice = new Map<string, number>();
  for (const m of meals) {
    groupedByChoice.set(`${m.group}||${m.choice}`, m.count);
  }

  const splitSums = new Map<string, number>();
  for (const r of splitMeals) {
    const k = `${r.group}||${r.choice}`;
    splitSums.set(k, (splitSums.get(k) ?? 0) + r.count);
  }

  for (const [k, sum] of splitSums.entries()) {
    const base = groupedByChoice.get(k) ?? 0;
    if (sum !== base) {
      console.warn("SPLIT MISMATCH", { k, base, sum });
    }
  }

  return Response.json({
    meals,
    splitMeals,
    extrasTotals: extrasTotalsArr,
  });
});