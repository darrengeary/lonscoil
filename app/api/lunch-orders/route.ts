import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import {
  addDays,
  endOfDay,
  format,
  getDay,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

const DATE_FMT = "yyyy-MM-dd";

function jsonError(message: string, status = 400) {
  return new Response(message, { status });
}

function isWeekend(date: Date) {
  const d = getDay(date);
  return d === 0 || d === 6;
}

function withinAvailability(date: Date, start?: Date | null, end?: Date | null) {
  const d = startOfDay(date);
  if (start && isBefore(d, startOfDay(start))) return false;
  if (end && isAfter(d, endOfDay(end))) return false;
  return true;
}

function expandWeekdaysInclusive(start: Date, end: Date): string[] {
  const out: string[] = [];
  let current = startOfDay(start);
  const last = endOfDay(end);

  while (current <= last) {
    if (!isWeekend(current)) out.push(format(current, DATE_FMT));
    current = addDays(current, 1);
  }

  return out;
}

function getWeekDates(weekStart: Date) {
  return Array.from({ length: 5 }, (_, i) => format(addDays(weekStart, i), DATE_FMT));
}

function getPreviousThursdayCutoffForWeek(weekStart: Date) {
  return endOfDay(addDays(weekStart, -4));
}

type SavePayload = {
  pupilId: string;
  weekStart: string;
  menuId: string;
  orders: {
    date: string;
    mealOptionId: string;
    items: {
      choiceId: string;
      selectedIngredients: string[];
    }[];
  }[];
  updateDefaultPattern?: boolean;
};

type CleanChoice = {
  id: string;
  ingredients: string[];
};

type CleanGroup = {
  id: string;
  maxSelections: number;
  choices: CleanChoice[];
};

type CleanMealOption = {
  id: string;
  availStart?: Date | null;
  availEnd?: Date | null;
  groups: CleanGroup[];
};

function sanitizeItemsForMealOption(
  items: { choiceId: string; selectedIngredients: string[] }[],
  meal: CleanMealOption | null | undefined,
  date: Date
) {
  if (!meal) return null;
  if (!withinAvailability(date, meal.availStart, meal.availEnd)) return null;

  const validChoiceIds = new Set(meal.groups.flatMap((g) => g.choices.map((c) => c.id)));

  const validIngredientsByChoiceId = new Map<string, string[]>();
  for (const group of meal.groups) {
    for (const choice of group.choices) {
      validIngredientsByChoiceId.set(choice.id, choice.ingredients ?? []);
    }
  }

  const cleanedItems = (items ?? [])
    .filter((i) => validChoiceIds.has(i.choiceId))
    .map((i) => ({
      choiceId: i.choiceId,
      selectedIngredients: Array.from(
        new Set(
          (i.selectedIngredients ?? []).filter((x) =>
            (validIngredientsByChoiceId.get(i.choiceId) ?? []).includes(x)
          )
        )
      ).sort(),
    }));

  const selectedChoiceIds = new Set(cleanedItems.map((i) => i.choiceId));

  const allGroupsValid = meal.groups.every((group) => {
    const selectedCount = group.choices.filter((c) => selectedChoiceIds.has(c.id)).length;
    return selectedCount <= group.maxSelections;
  });

  if (!allGroupsValid) return null;

  return cleanedItems;
}

export const PUT = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || user.role !== UserRole.USER) {
    return jsonError("Unauthorized", 401);
  }

  let body: SavePayload;

  try {
    body = (await req.json()) as SavePayload;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { pupilId, weekStart: weekStartStr, menuId, orders, updateDefaultPattern } = body;

  if (!pupilId || !weekStartStr || !menuId || !Array.isArray(orders)) {
    return jsonError("Missing required fields", 400);
  }

  const weekStart = startOfWeek(parseISO(weekStartStr), { weekStartsOn: 1 });
  if (Number.isNaN(weekStart.getTime())) {
    return jsonError("Invalid weekStart", 400);
  }

  const weekDates = getWeekDates(weekStart);
  const weekDateSet = new Set(weekDates);

  const cutoffPassed = new Date() > getPreviousThursdayCutoffForWeek(weekStart);
  if (cutoffPassed) {
    return jsonError("Ordering cutoff has passed for this week", 400);
  }

  const pupil = await prisma.pupil.findFirst({
    where: {
      id: pupilId,
      parentId: user.id,
    },
    select: {
      id: true,
      classroom: {
        select: {
          schoolId: true,
        },
      },
    },
  });

  if (!pupil) {
    return jsonError("Invalid pupil", 401);
  }

  const availableMenus = await prisma.menu.findMany({
    where: {
      active: true,
      schoolLinks: {
        some: {
          schoolId: pupil.classroom.schoolId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  const validMenuIds = new Set(availableMenus.map((m) => m.id));
  if (!validMenuIds.has(menuId)) {
    return jsonError("Invalid menu for pupil school", 400);
  }

  const [terms, holidays, rawMealOptions] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        schoolId: pupil.classroom.schoolId,
        type: "TERM",
      },
      select: {
        startDate: true,
        endDate: true,
      },
    }),
    prisma.schedule.findMany({
      where: {
        schoolId: pupil.classroom.schoolId,
        type: "HOLIDAY",
      },
      select: {
        startDate: true,
        endDate: true,
      },
    }),
    prisma.mealOption.findMany({
      where: {
        menuId,
        active: true,
      },
      select: {
        id: true,
        availStart: true,
        availEnd: true,
        MealOptionMealGroup: {
          select: {
            group: {
              select: {
                id: true,
                maxSelections: true,
                active: true,
                choices: {
                  where: {
                    active: true,
                  },
                  select: {
                    id: true,
                    ingredients: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const termSet = new Set<string>();
  for (const t of terms) {
    if (!t.startDate || !t.endDate || isAfter(t.startDate, t.endDate)) continue;
    for (const d of expandWeekdaysInclusive(t.startDate, t.endDate)) {
      termSet.add(d);
    }
  }

  const holidaySet = new Set<string>();
  for (const h of holidays) {
    if (!h.startDate || !h.endDate || isAfter(h.startDate, h.endDate)) continue;
    for (const d of expandWeekdaysInclusive(h.startDate, h.endDate)) {
      holidaySet.add(d);
    }
  }

  const orderableDates = weekDates.filter((d) => termSet.has(d) && !holidaySet.has(d));
  const orderableDateSet = new Set(orderableDates);

  const mealOptionMap = new Map<string, CleanMealOption>(
    rawMealOptions
      .map((meal) => ({
        id: meal.id,
        availStart: meal.availStart,
        availEnd: meal.availEnd,
        groups: meal.MealOptionMealGroup.map((x) => x.group)
          .filter((group): group is NonNullable<typeof group> => !!group)
          .filter((group) => group.active)
          .map((group) => ({
            id: group.id,
            maxSelections: group.maxSelections,
            choices: group.choices.map((choice) => ({
              id: choice.id,
              ingredients: choice.ingredients ?? [],
            })),
          }))
          .filter((group) => group.choices.length > 0),
      }))
      .filter((meal) => meal.groups.length > 0)
      .map((meal) => [meal.id, meal])
  );

  if (orders.length !== orderableDates.length) {
    return jsonError("Orders must match all orderable days in the selected week", 400);
  }

  const submittedDates = new Set<string>();

  const validatedOrders: {
    date: Date;
    mealOptionId: string;
    items: {
      choiceId: string;
      selectedIngredients: string[];
    }[];
  }[] = [];

  for (const order of orders) {
    if (!order?.date || !order?.mealOptionId || !Array.isArray(order?.items)) {
      return jsonError("Each order must include date, mealOptionId and items", 400);
    }

    if (submittedDates.has(order.date)) {
      return jsonError(`Duplicate order date: ${order.date}`, 400);
    }
    submittedDates.add(order.date);

    if (!weekDateSet.has(order.date)) {
      return jsonError(`Order date is outside selected week: ${order.date}`, 400);
    }

    if (!orderableDateSet.has(order.date)) {
      return jsonError(`Date is not orderable: ${order.date}`, 400);
    }

    const date = parseISO(order.date);
    if (Number.isNaN(date.getTime())) {
      return jsonError(`Invalid order date: ${order.date}`, 400);
    }

    const meal = mealOptionMap.get(order.mealOptionId);
    if (!meal) {
      return jsonError(`Invalid meal option for date ${order.date}`, 400);
    }

    const cleanItems = sanitizeItemsForMealOption(order.items, meal, date);
    if (!cleanItems) {
      return jsonError(`Invalid meal choices for date ${order.date}`, 400);
    }

    validatedOrders.push({
      date: startOfDay(date),
      mealOptionId: order.mealOptionId,
      items: cleanItems,
    });
  }

  for (const requiredDate of orderableDates) {
    if (!submittedDates.has(requiredDate)) {
      return jsonError(`Missing order for ${requiredDate}`, 400);
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const order of validatedOrders) {
        const savedOrder = await tx.lunchOrder.upsert({
          where: {
            pupilId_date: {
              pupilId,
              date: order.date,
            },
          },
          update: {
            mealOptionId: order.mealOptionId,
          },
          create: {
            pupilId,
            date: order.date,
            mealOptionId: order.mealOptionId,
          },
          select: {
            id: true,
          },
        });

        await tx.orderItem.deleteMany({
          where: {
            orderId: savedOrder.id,
          },
        });

        if (order.items.length > 0) {
          await tx.orderItem.createMany({
            data: order.items.map((item) => ({
              orderId: savedOrder.id,
              choiceId: item.choiceId,
              selectedIngredients: item.selectedIngredients,
            })),
          });
        }
      }

      if (updateDefaultPattern) {
        for (const order of validatedOrders) {
          const weekday = getDay(order.date);

          const savedPattern = await tx.pupilMealWeekPattern.upsert({
            where: {
              pupilId_weekday: {
                pupilId,
                weekday,
              },
            },
            update: {
              mealOptionId: order.mealOptionId,
            },
            create: {
              pupilId,
              weekday,
              mealOptionId: order.mealOptionId,
            },
            select: {
              id: true,
            },
          });

          await tx.pupilMealWeekPatternItem.deleteMany({
            where: {
              patternId: savedPattern.id,
            },
          });

          if (order.items.length > 0) {
            await tx.pupilMealWeekPatternItem.createMany({
              data: order.items.map((item) => ({
                patternId: savedPattern.id,
                choiceId: item.choiceId,
                selectedIngredients: item.selectedIngredients,
              })),
            });
          }
        }
      }
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to save lunch orders", error);

    const message =
      error instanceof Error ? error.message : "Failed to save lunch orders";

    return jsonError(message, 500);
  }
});