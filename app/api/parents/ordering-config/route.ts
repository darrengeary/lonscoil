import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import {
  addDays,
  eachDayOfInterval,
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
  const days = eachDayOfInterval({
    start: startOfDay(start),
    end: endOfDay(end),
  });
  return days.filter((d) => !isWeekend(d)).map((d) => format(d, DATE_FMT));
}

function getWeekDates(weekStart: Date) {
  return Array.from({ length: 5 }, (_, i) => format(addDays(weekStart, i), DATE_FMT));
}

function getPreviousThursdayCutoffForWeek(weekStart: Date) {
  return endOfDay(addDays(weekStart, -4));
}

type EffectiveOrder = {
  mealOptionId: string;
  items: {
    choiceId: string;
    selectedIngredients: string[];
  }[];
  source: "explicit" | "rollover" | "pattern";
} | null;

type CleanChoice = {
  id: string;
  name: string;
  imageUrl?: string | null;
  ingredients: string[];
  extraSticker: boolean;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
  allergens: { id: string; name: string }[];
};

type CleanGroup = {
  id: string;
  name: string;
  maxSelections: number;
  choices: CleanChoice[];
};

type CleanMealOption = {
  id: string;
  name: string;
  imageUrl?: string | null;
  stickerCount: number;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
  allergens: { id: string; name: string }[];
  groups: CleanGroup[];
  availStart?: Date | null;
  availEnd?: Date | null;
};

function sanitizeEffectiveOrderForMealOption(
  order: EffectiveOrder,
  meal: CleanMealOption | null | undefined,
  date: Date
): EffectiveOrder {
  if (!order || !meal) return null;
  if (!withinAvailability(date, meal.availStart, meal.availEnd)) return null;

  const validChoiceIds = new Set(meal.groups.flatMap((g) => g.choices.map((c) => c.id)));

  const validIngredientsByChoiceId = new Map<string, string[]>();
  for (const group of meal.groups) {
    for (const choice of group.choices) {
      validIngredientsByChoiceId.set(choice.id, choice.ingredients ?? []);
    }
  }

  const items = order.items
    .filter((i) => validChoiceIds.has(i.choiceId))
    .map((i) => ({
      choiceId: i.choiceId,
      selectedIngredients: (i.selectedIngredients ?? []).filter((x) =>
        (validIngredientsByChoiceId.get(i.choiceId) ?? []).includes(x)
      ),
    }));

  const itemChoiceIds = new Set(items.map((i) => i.choiceId));

  const allGroupsValid = meal.groups.every((group) => {
    const selectedCount = group.choices.filter((c) => itemChoiceIds.has(c.id)).length;
    return selectedCount <= group.maxSelections;
  });

  if (!allGroupsValid) return null;

  return {
    mealOptionId: order.mealOptionId,
    items,
    source: order.source,
  };
}

function toCleanMealOption(
  meal: {
    id: string;
    name: string;
    imageUrl: string | null;
    stickerCount: number;
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    sugarsG: number | null;
    fatG: number | null;
    saturatesG: number | null;
    fibreG: number | null;
    saltG: number | null;
    availStart: Date | null;
    availEnd: Date | null;
    allergens: { id: string; name: string }[];
    MealOptionMealGroup: {
      group: {
        id: string;
        name: string;
        maxSelections: number;
        active: boolean;
        choices: {
          id: string;
          name: string;
          imageUrl: string | null;
          ingredients: string[] | null;
          extraSticker: boolean;
          caloriesKcal: number | null;
          proteinG: number | null;
          carbsG: number | null;
          sugarsG: number | null;
          fatG: number | null;
          saturatesG: number | null;
          fibreG: number | null;
          saltG: number | null;
          allergens: { id: string; name: string }[];
        }[];
      } | null;
    }[];
  }
): CleanMealOption {
  const groups: CleanGroup[] = meal.MealOptionMealGroup.map((x) => x.group)
    .filter((group): group is NonNullable<typeof group> => !!group)
    .filter((group) => group.active)
    .map((group) => ({
      id: group.id,
      name: group.name,
      maxSelections: group.maxSelections,
      choices: group.choices.map((choice) => ({
        id: choice.id,
        name: choice.name,
        imageUrl: choice.imageUrl,
        ingredients: choice.ingredients ?? [],
        extraSticker: choice.extraSticker,
        caloriesKcal: choice.caloriesKcal,
        proteinG: choice.proteinG,
        carbsG: choice.carbsG,
        sugarsG: choice.sugarsG,
        fatG: choice.fatG,
        saturatesG: choice.saturatesG,
        fibreG: choice.fibreG,
        saltG: choice.saltG,
        allergens: choice.allergens,
      })),
    }))
    .filter((group) => group.choices.length > 0);

  return {
    id: meal.id,
    name: meal.name,
    imageUrl: meal.imageUrl,
    stickerCount: meal.stickerCount,
    caloriesKcal: meal.caloriesKcal,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    sugarsG: meal.sugarsG,
    fatG: meal.fatG,
    saturatesG: meal.saturatesG,
    fibreG: meal.fibreG,
    saltG: meal.saltG,
    allergens: meal.allergens,
    groups,
    availStart: meal.availStart,
    availEnd: meal.availEnd,
  };
}

export const GET = auth(async (req) => {
  const user = req.auth?.user;
  if (!user || user.role !== UserRole.USER) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const pupilId = String(searchParams.get("pupilId") || "");
  const weekStartStr = String(searchParams.get("weekStart") || "");
  const requestedMenuId = searchParams.get("menuId");

  if (!pupilId || !weekStartStr) {
    return jsonError("Missing pupilId or weekStart", 400);
  }

  const weekStart = startOfWeek(parseISO(weekStartStr), { weekStartsOn: 1 });
  const weekDates = getWeekDates(weekStart);
  const cutoffPassed = new Date() > getPreviousThursdayCutoffForWeek(weekStart);

  const pupil = await prisma.pupil.findFirst({
    where: {
      id: pupilId,
      parentId: user.id,
    },
    select: {
      id: true,
      name: true,
      menuId: true,
      classroom: {
        select: {
          schoolId: true,
          school: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!pupil) return jsonError("Invalid pupil", 401);

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
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const validMenuIds = new Set(availableMenus.map((m) => m.id));

  const selectedMenuId =
    requestedMenuId && validMenuIds.has(requestedMenuId)
      ? requestedMenuId
      : pupil.menuId && validMenuIds.has(pupil.menuId)
        ? pupil.menuId
        : availableMenus[0]?.id ?? "";

  if (!selectedMenuId) {
    return Response.json({
      pupil: {
        id: pupil.id,
        name: pupil.name,
        schoolName: pupil.classroom.school.name,
      },
      availableMenus,
      selectedMenuId: "",
      selectedMenuName: "",
      weekStart: format(weekStart, DATE_FMT),
      weekDates,
      orderable: [],
      holidays: [],
      cutoffPassed,
      mealOptionsByDate: {},
      effectiveOrders: {},
    });
  }

  const [terms, holidays, visibleRawMealOptions, allRawMealOptions, explicitOrders, patternOrders] =
    await Promise.all([
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
          menuId: selectedMenuId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          stickerCount: true,
          caloriesKcal: true,
          proteinG: true,
          carbsG: true,
          sugarsG: true,
          fatG: true,
          saturatesG: true,
          fibreG: true,
          saltG: true,
          availStart: true,
          availEnd: true,
          allergens: {
            select: {
              id: true,
              name: true,
            },
          },
          MealOptionMealGroup: {
            select: {
              group: {
                select: {
                  id: true,
                  name: true,
                  maxSelections: true,
                  active: true,
                  choices: {
                    where: {
                      active: true,
                    },
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                      ingredients: true,
                      extraSticker: true,
                      caloriesKcal: true,
                      proteinG: true,
                      carbsG: true,
                      sugarsG: true,
                      fatG: true,
                      saturatesG: true,
                      fibreG: true,
                      saltG: true,
                      allergens: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                    orderBy: {
                      name: "asc",
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.mealOption.findMany({
        where: {
          menuId: {
            in: availableMenus.map((m) => m.id),
          },
          active: true,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          stickerCount: true,
          caloriesKcal: true,
          proteinG: true,
          carbsG: true,
          sugarsG: true,
          fatG: true,
          saturatesG: true,
          fibreG: true,
          saltG: true,
          availStart: true,
          availEnd: true,
          allergens: {
            select: {
              id: true,
              name: true,
            },
          },
          MealOptionMealGroup: {
            select: {
              group: {
                select: {
                  id: true,
                  name: true,
                  maxSelections: true,
                  active: true,
                  choices: {
                    where: {
                      active: true,
                    },
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                      ingredients: true,
                      extraSticker: true,
                      caloriesKcal: true,
                      proteinG: true,
                      carbsG: true,
                      sugarsG: true,
                      fatG: true,
                      saturatesG: true,
                      fibreG: true,
                      saltG: true,
                      allergens: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                    orderBy: {
                      name: "asc",
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.lunchOrder.findMany({
        where: {
          pupilId: pupil.id,
          date: {
            gte: startOfDay(weekStart),
            lte: endOfDay(addDays(weekStart, 4)),
          },
        },
        select: {
          date: true,
          mealOptionId: true,
          items: {
            select: {
              choiceId: true,
              selectedIngredients: true,
            },
          },
        },
      }),
      prisma.pupilMealWeekPattern.findMany({
        where: {
          pupilId: pupil.id,
          weekday: {
            gte: 1,
            lte: 5,
          },
        },
        select: {
          weekday: true,
          mealOptionId: true,
          items: {
            select: {
              choiceId: true,
              selectedIngredients: true,
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

  const orderable = weekDates.filter((d) => termSet.has(d) && !holidaySet.has(d));
  const holidaysInWeek = weekDates.filter((d) => holidaySet.has(d));

  const visibleMealOptionsByDate: Record<string, CleanMealOption[]> = {};

  for (const dateStr of weekDates) {
    const date = parseISO(dateStr);

    visibleMealOptionsByDate[dateStr] = visibleRawMealOptions
      .filter((meal) => withinAvailability(date, meal.availStart, meal.availEnd))
      .map(toCleanMealOption)
      .filter(
        (meal) => meal.groups.length > 0 && meal.groups.every((g) => g.choices.length > 0)
      );
  }

  const allMealOptionMap = new Map<string, CleanMealOption>(
    allRawMealOptions
      .map(toCleanMealOption)
      .filter(
        (meal) => meal.groups.length > 0 && meal.groups.every((g) => g.choices.length > 0)
      )
      .map((meal) => [meal.id, meal])
  );

  const explicitByDate = new Map(
    explicitOrders.map((o) => [
      format(o.date, DATE_FMT),
      {
        mealOptionId: o.mealOptionId,
        items: o.items.map((i) => ({
          choiceId: i.choiceId,
          selectedIngredients: i.selectedIngredients ?? [],
        })),
        source: "explicit" as const,
      },
    ])
  );

  const patternByWeekday = new Map(
    patternOrders.map((p) => [
      p.weekday,
      {
        mealOptionId: p.mealOptionId,
        items: p.items.map((i) => ({
          choiceId: i.choiceId,
          selectedIngredients: i.selectedIngredients ?? [],
        })),
        source: "pattern" as const,
      },
    ])
  );

  const effectiveOrders: Record<string, EffectiveOrder> = {};
  let previousValidOrder: EffectiveOrder = null;

  for (let i = 0; i < weekDates.length; i++) {
    const dateStr = weekDates[i];
    const weekday = i + 1;
    const date = parseISO(dateStr);

    let effective: EffectiveOrder = null;

    const explicit = explicitByDate.get(dateStr) ?? null;
    const cleanExplicit = sanitizeEffectiveOrderForMealOption(
      explicit,
      explicit ? allMealOptionMap.get(explicit.mealOptionId) : null,
      date
    );

    if (cleanExplicit) {
      effective = cleanExplicit;
    } else {
      const pattern = patternByWeekday.get(weekday) ?? null;
      const cleanPattern = sanitizeEffectiveOrderForMealOption(
        pattern,
        pattern ? allMealOptionMap.get(pattern.mealOptionId) : null,
        date
      );

      if (cleanPattern) {
        effective = cleanPattern;
      } else if (previousValidOrder) {
        const rolloverCandidate: EffectiveOrder = {
          mealOptionId: previousValidOrder.mealOptionId,
          items: previousValidOrder.items,
          source: "rollover",
        };

        const cleanRollover = sanitizeEffectiveOrderForMealOption(
          rolloverCandidate,
          allMealOptionMap.get(rolloverCandidate.mealOptionId),
          date
        );
        if (cleanRollover) {
          effective = cleanRollover;
        }
      }
    }

    effectiveOrders[dateStr] = effective;
    if (effective) previousValidOrder = effective;
  }

  const selectedMenuName =
    availableMenus.find((m) => m.id === selectedMenuId)?.name ?? "";

  return Response.json({
    pupil: {
      id: pupil.id,
      name: pupil.name,
      schoolName: pupil.classroom.school.name,
    },
    availableMenus,
    selectedMenuId,
    selectedMenuName,
    weekStart: format(weekStart, DATE_FMT),
    weekDates,
    orderable,
    holidays: holidaysInWeek,
    cutoffPassed,
    mealOptionsByDate: visibleMealOptionsByDate,
    effectiveOrders,
  });
});