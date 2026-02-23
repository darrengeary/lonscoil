import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, parseISO } from "date-fns";

type AnyUser = { role?: "ADMIN" | "SCHOOLADMIN" | string; schoolId?: string | null };

function normalizeExtras(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  // de-dupe + stable sort
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
  const splitByExtras = searchParams.get("splitByExtras") === "1";

  if (!date) return new Response("Date required", { status: 400 });

  // --- RBAC ---
  if (user?.role === "SCHOOLADMIN") {
    schoolId = user.schoolId ?? null;
    if (!schoolId) return new Response("No school assigned", { status: 403 });
  } else if (user?.role === "ADMIN") {
    if (!schoolId || schoolId === "all") schoolId = null;
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  // FIX: avoid Date("YYYY-MM-DD") UTC parsing bugs
  const day = parseISO(date);

  // Orders on that day, plus optional school/classroom constraints
  const orderWhere: any = {
    date: { gte: startOfDay(day), lte: endOfDay(day) },
  };

  if (classroomId && classroomId !== "all") {
    orderWhere.pupil = { classroomId };
  } else if (schoolId) {
    orderWhere.pupil = { classroom: { schoolId } };
  }

  // Optional: filter to a meal group (restrict choices)
  let filterChoiceIds: string[] | undefined;
  if (mealGroupId && mealGroupId !== "all") {
    const group = await prisma.mealGroup.findUnique({
      where: { id: mealGroupId },
      select: { choices: { select: { id: true } } },
    });
    filterChoiceIds = group?.choices.map((c) => c.id) ?? [];
  }

  // Pull order items for the filtered orders/day
  const items = await prisma.orderItem.findMany({
    where: {
      order: orderWhere,
      ...(filterChoiceIds ? { choiceId: { in: filterChoiceIds } } : {}),
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
    },
  });

  // Base meal counts (grouped)
  const mealCount = new Map<string, number>();
  const label = new Map<string, { group: string; choice: string }>();

  // Extras totals across all meals (occurrences, NOT meals)
  const extrasTotals = new Map<string, number>();
  // Extras per choice breakdown (occurrences, grouped display)
  const extrasByChoice = new Map<string, Map<string, number>>();

  // Split-by-extras buckets (meals grouped by extras signature; 1 meal increments exactly 1 bucket)
  const splitCount = new Map<string, number>(); // key: `${choiceId}||${sig}`

  for (const it of items) {
    // grouped count
    mealCount.set(it.choiceId, (mealCount.get(it.choiceId) ?? 0) + 1);

    if (!label.has(it.choiceId)) {
      label.set(it.choiceId, {
        group: it.choice.group?.name ?? "Unknown",
        choice: it.choice.name ?? "Unknown",
      });
    }

    const extras = normalizeExtras(it.selectedIngredients);

    // extras occurrences
    for (const ex of extras) {
      extrasTotals.set(ex, (extrasTotals.get(ex) ?? 0) + 1);

      if (!extrasByChoice.has(it.choiceId)) extrasByChoice.set(it.choiceId, new Map());
      const m = extrasByChoice.get(it.choiceId)!;
      m.set(ex, (m.get(ex) ?? 0) + 1);
    }

    // split bucket (meals)
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
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  const extrasTotalsArr = Array.from(extrasTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => ({ name, qty }));

  if (!splitByExtras) {
    return Response.json({ meals, extrasTotals: extrasTotalsArr });
  }

  // Build splitMeals for client rendering
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

  // ---- Invariant check (fixes your TS error by using Map<string, number>) ----
  const groupedByChoice = new Map<string, number>();
  for (const m of meals) groupedByChoice.set(`${m.group}||${m.choice}`, m.count);

  const splitSums = new Map<string, number>();
  for (const r of splitMeals) {
    const k = `${r.group}||${r.choice}`; // k is string, map expects string -> ok
    splitSums.set(k, (splitSums.get(k) ?? 0) + r.count);
  }

  for (const [k, sum] of splitSums.entries()) {
    const base = groupedByChoice.get(k) ?? 0; // no template literal typing issue now
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