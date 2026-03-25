"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  addDays,
  addWeeks,
  format,
  isBefore,
  parseISO,
  startOfWeek,
} from "date-fns";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Info } from "lucide-react";

type Pupil = {
  id: string;
  name: string;
};

type AllergenTag = {
  id: string;
  name: string;
};

type Choice = {
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
  allergens: AllergenTag[];
};

type Group = {
  id: string;
  name: string;
  maxSelections: number;
  choices: Choice[];
};

type MealOption = {
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
  allergens: AllergenTag[];
  groups: Group[];
};

type EffectiveOrder = {
  mealOptionId: string;
  items: {
    choiceId: string;
    selectedIngredients: string[];
  }[];
  source: "explicit" | "rollover" | "pattern";
} | null;

type OrderingConfig = {
  pupil: {
    id: string;
    name: string;
    schoolName: string;
  };
  availableMenus: {
    id: string;
    name: string;
  }[];
  selectedMenuId: string;
  selectedMenuName: string;
  weekStart: string;
  weekDates: string[];
  orderable: string[];
  holidays: string[];
  cutoffPassed: boolean;
  mealOptionsByDate: Record<string, MealOption[]>;
  effectiveOrders: Record<string, EffectiveOrder>;
};

type DaySelection = {
  menuId: string | null;
  mealOptionId: string | null;
  itemsByChoiceId: Record<string, { selectedIngredients: string[] }>;
};

const DATE_FMT = "yyyy-MM-dd";
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];

async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function buildSelectionFromEffectiveOrder(
  order: EffectiveOrder,
  menuId: string | null
): DaySelection {
  if (!order) {
    return { menuId, mealOptionId: null, itemsByChoiceId: {} };
  }

  return {
    menuId,
    mealOptionId: order.mealOptionId,
    itemsByChoiceId: Object.fromEntries(
      order.items.map((i) => [
        i.choiceId,
        { selectedIngredients: [...(i.selectedIngredients ?? [])].sort() },
      ])
    ),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getSelectedChoiceIdsForGroup(group: Group, day: DaySelection) {
  return group.choices.map((c) => c.id).filter((id) => !!day.itemsByChoiceId[id]);
}

function isGroupComplete(group: Group, day: DaySelection) {
  const selectedIds = getSelectedChoiceIdsForGroup(group, day);
  return selectedIds.length <= group.maxSelections;
}

function isDayComplete(day: DaySelection | undefined, mealOptions: MealOption[]) {
  if (!day?.mealOptionId) return false;
  const meal = mealOptions.find((m) => m.id === day.mealOptionId);
  if (!meal) return false;
  return meal.groups.every((g) => isGroupComplete(g, day));
}

function pickNextIncompleteDate(
  dates: string[],
  selections: Record<string, DaySelection>,
  getMealOptionsForDate: (date: string, day: DaySelection | undefined) => MealOption[]
) {
  return (
    dates.find((date) => !isDayComplete(selections[date], getMealOptionsForDate(date, selections[date]))) ??
    dates[0] ??
    null
  );
}

function normalizeDaySelection(day: DaySelection) {
  const sortedChoiceIds = Object.keys(day.itemsByChoiceId).sort();

  return {
    menuId: day.menuId,
    mealOptionId: day.mealOptionId,
    itemsByChoiceId: Object.fromEntries(
      sortedChoiceIds.map((choiceId) => [
        choiceId,
        {
          selectedIngredients: [...(day.itemsByChoiceId[choiceId]?.selectedIngredients ?? [])].sort(),
        },
      ])
    ),
  };
}

function getAllergenColorClass(name: string) {
  const key = name.toLowerCase();

  if (key.includes("milk") || key.includes("dairy")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (key.includes("egg")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (key.includes("nut") || key.includes("peanut")) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (key.includes("gluten") || key.includes("wheat")) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }
  if (key.includes("soy")) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (key.includes("fish")) {
    return "bg-cyan-100 text-cyan-800 border-cyan-200";
  }
  if (key.includes("sesame")) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function NutritionRow({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: string | number | null | undefined;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value ?? "-"}
        {value != null ? suffix : ""}
      </span>
    </div>
  );
}

function sanitizeSelectionForMeal(
  day: DaySelection,
  meal: MealOption | null
): DaySelection {
  if (!day.mealOptionId || !meal) {
    return {
      menuId: day.menuId,
      mealOptionId: day.mealOptionId,
      itemsByChoiceId: {},
    };
  }

  const validChoices = new Map<string, string[]>();
  for (const group of meal.groups) {
    for (const choice of group.choices) {
      validChoices.set(choice.id, choice.ingredients ?? []);
    }
  }

  const nextItemsByChoiceId: Record<string, { selectedIngredients: string[] }> = {};
  for (const [choiceId, cfg] of Object.entries(day.itemsByChoiceId)) {
    const ingredients = validChoices.get(choiceId);
    if (!ingredients) continue;

    nextItemsByChoiceId[choiceId] = {
      selectedIngredients: (cfg.selectedIngredients ?? []).filter((x) => ingredients.includes(x)),
    };
  }

  return {
    menuId: day.menuId,
    mealOptionId: day.mealOptionId,
    itemsByChoiceId: nextItemsByChoiceId,
  };
}

function getChosenChoiceNames(day: DaySelection | undefined, meal: MealOption | null) {
  if (!day || !meal) return [];

  return meal.groups.flatMap((group) =>
    group.choices
      .filter((choice) => !!day.itemsByChoiceId[choice.id])
      .map((choice) => choice.name)
  );
}

function possessive(name: string) {
  if (!name) return "Pupil's";
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export default function ParentOrdersPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [selectedPupil, setSelectedPupil] = useState<string>("");
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");

  const [weekStart, setWeekStart] = useState(() =>
    addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1)
  );

  const [config, setConfig] = useState<OrderingConfig | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const [mealOptionsByMenu, setMealOptionsByMenu] = useState<
    Record<string, Record<string, MealOption[]>>
  >({});

  const [selections, setSelections] = useState<Record<string, DaySelection>>({});
  const [saving, setSaving] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [mealInfo, setMealInfo] = useState<MealOption | null>(null);
  const [choiceInfo, setChoiceInfo] = useState<Choice | null>(null);

  const mealGroupsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchJSON<Pupil[]>("/api/pupils?parent=true", []).then((data) => {
      setPupils(data);
      if (data[0] && !selectedPupil) {
        setSelectedPupil(data[0].id);
      }
    });
  }, [selectedPupil]);

  function getMealOptionsForDay(date: string, day: DaySelection | undefined) {
    if (!day?.menuId) return [];
    return mealOptionsByMenu[day.menuId]?.[date] ?? [];
  }

  useEffect(() => {
    if (!selectedPupil) return;

    setLoadingWeek(true);

    const url = `/api/parents/ordering-config?pupilId=${encodeURIComponent(
      selectedPupil
    )}&weekStart=${encodeURIComponent(format(weekStart, DATE_FMT))}${
      selectedMenuId ? `&menuId=${encodeURIComponent(selectedMenuId)}` : ""
    }`;

    fetchJSON<OrderingConfig | null>(url, null)
      .then((payload) => {
        setConfig(payload);
        if (!payload) return;

        setSelectedMenuId(payload.selectedMenuId);

        setMealOptionsByMenu({
          [payload.selectedMenuId]: payload.mealOptionsByDate,
        });

        const nextSelections: Record<string, DaySelection> = {};
        for (const date of payload.weekDates) {
          const base = buildSelectionFromEffectiveOrder(
            payload.effectiveOrders[date] ?? null,
            payload.selectedMenuId
          );

          const meal =
            base.mealOptionId
              ? (payload.mealOptionsByDate[date] ?? []).find((m) => m.id === base.mealOptionId) ?? null
              : null;

          nextSelections[date] = normalizeDaySelection(
            sanitizeSelectionForMeal(base, meal)
          );
        }

        setSelections(nextSelections);
        setDirty(false);
        setActiveDate(
          pickNextIncompleteDate(payload.orderable, nextSelections, (date, day) => {
            if (day?.menuId === payload.selectedMenuId) {
              return payload.mealOptionsByDate[date] ?? [];
            }
            return getMealOptionsForDay(date, day);
          })
        );
      })
      .finally(() => setLoadingWeek(false));
  }, [selectedPupil, weekStart]);

  useEffect(() => {
    if (!selectedPupil || !selectedMenuId || !config) return;
    if (mealOptionsByMenu[selectedMenuId]) return;

    setLoadingMenu(true);

    const url = `/api/parents/ordering-config?pupilId=${encodeURIComponent(
      selectedPupil
    )}&weekStart=${encodeURIComponent(format(weekStart, DATE_FMT))}&menuId=${encodeURIComponent(
      selectedMenuId
    )}`;

    fetchJSON<OrderingConfig | null>(url, null)
      .then((payload) => {
        if (!payload) return;

        setMealOptionsByMenu((prev) => ({
          ...prev,
          [selectedMenuId]: payload.mealOptionsByDate,
        }));
      })
      .finally(() => setLoadingMenu(false));
  }, [selectedMenuId, selectedPupil, weekStart, config, mealOptionsByMenu]);

  const orderableDates = config?.orderable ?? [];
  const isLocked = !!config?.cutoffPassed;

  const weekEndFriday = useMemo(() => addDays(weekStart, 4), [weekStart]);
  const minWeekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }),
    []
  );

  const weekComplete = useMemo(() => {
    if (!config) return false;
    return orderableDates.every((date) =>
      isDayComplete(selections[date], getMealOptionsForDay(date, selections[date]))
    );
  }, [config, orderableDates, selections, mealOptionsByMenu]);

  const progress = useMemo(() => {
    if (!config) return { done: 0, total: 0 };
    const total = orderableDates.length;
    const done = orderableDates.filter((date) =>
      isDayComplete(selections[date], getMealOptionsForDay(date, selections[date]))
    ).length;
    return { done, total };
  }, [config, orderableDates, selections, mealOptionsByMenu]);

  const activeMealOptions =
    activeDate ? mealOptionsByMenu[selectedMenuId]?.[activeDate] ?? [] : [];

  const activeSelection = activeDate ? selections[activeDate] : null;

  const activeMealOption =
    activeDate && activeSelection?.mealOptionId && activeSelection?.menuId
      ? (mealOptionsByMenu[activeSelection.menuId]?.[activeDate] ?? []).find(
          (m) => m.id === activeSelection.mealOptionId
        ) ?? null
      : null;

  const activeOrderableIndex = activeDate ? orderableDates.indexOf(activeDate) : -1;
  const nextOrderableDate =
    activeOrderableIndex >= 0 && activeOrderableIndex < orderableDates.length - 1
      ? orderableDates[activeOrderableIndex + 1]
      : null;

  const isLastOrderableDay =
    !!activeDate &&
    orderableDates.length > 0 &&
    orderableDates[orderableDates.length - 1] === activeDate;

  useEffect(() => {
    if (!activeSelection?.mealOptionId) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768) return;

    const id = window.requestAnimationFrame(() => {
      mealGroupsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(id);
  }, [activeDate, activeSelection?.mealOptionId]);

  function handleMenuChange(nextMenuId: string) {
    if (isLocked || loadingMenu || loadingWeek || saving) return;
    if (nextMenuId === selectedMenuId) return;
    setSelectedMenuId(nextMenuId);
  }

  function setMealOption(date: string, mealOptionId: string) {
    if (isLocked) return;

    const meal = (mealOptionsByMenu[selectedMenuId]?.[date] ?? []).find(
      (m) => m.id === mealOptionId
    );
    if (!meal) return;

    setSelections((prev) => ({
      ...prev,
      [date]: {
        menuId: selectedMenuId,
        mealOptionId,
        itemsByChoiceId: {},
      },
    }));

    setDirty(true);
  }

  function toggleChoice(date: string, group: Group, choiceId: string) {
    if (isLocked) return;

    setSelections((prev) => {
      const existingDay = prev[date] ?? {
        menuId: selectedMenuId,
        mealOptionId: null,
        itemsByChoiceId: {},
      };
      const day = clone(existingDay);
      const selectedIds = getSelectedChoiceIdsForGroup(group, day);
      const isSelected = !!day.itemsByChoiceId[choiceId];

      if (isSelected) {
        delete day.itemsByChoiceId[choiceId];
      } else if (selectedIds.length < group.maxSelections) {
        day.itemsByChoiceId[choiceId] = {
          selectedIngredients: day.itemsByChoiceId[choiceId]?.selectedIngredients ?? [],
        };
      } else {
        const removeId = selectedIds[0];
        delete day.itemsByChoiceId[removeId];
        day.itemsByChoiceId[choiceId] = { selectedIngredients: [] };
      }

      return { ...prev, [date]: normalizeDaySelection(day) };
    });

    setDirty(true);
  }

  function toggleExtra(date: string, choiceId: string, extra: string) {
    if (isLocked) return;

    setSelections((prev) => {
      const existingDay = prev[date] ?? {
        menuId: selectedMenuId,
        mealOptionId: null,
        itemsByChoiceId: {},
      };
      const day = clone(existingDay);
      const existing = day.itemsByChoiceId[choiceId] ?? { selectedIngredients: [] };
      const has = existing.selectedIngredients.includes(extra);

      day.itemsByChoiceId[choiceId] = {
        selectedIngredients: has
          ? existing.selectedIngredients.filter((x) => x !== extra)
          : Array.from(new Set([...existing.selectedIngredients, extra])),
      };

      return { ...prev, [date]: normalizeDaySelection(day) };
    });

    setDirty(true);
  }

  async function handleSave() {
    if (!config || !selectedPupil) return;

    if (!weekComplete) {
      toast.error("Complete the full week before saving.");
      return;
    }

    setSaving(true);

    try {
      const orders = orderableDates.map((date) => {
        const day = selections[date];
        return {
          date,
          menuId: day.menuId,
          mealOptionId: day.mealOptionId!,
          items: Object.entries(day.itemsByChoiceId).map(([choiceId, cfg]) => ({
            choiceId,
            selectedIngredients: cfg.selectedIngredients ?? [],
          })),
        };
      });

      const res = await fetch("/api/lunch-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pupilId: selectedPupil,
          weekStart: config.weekStart,
          orders,
          updateDefaultPattern: true,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        toast.error(msg || "Failed to save");
        return;
      }

      toast.success("Week saved");
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function goToNextDay() {
    if (!nextOrderableDate) return;
    setActiveDate(nextOrderableDate);
  }

  const canGoPrev = !isBefore(addWeeks(weekStart, -1), minWeekStart);

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 pb-28 md:pb-24">
      <DashboardHeader heading="Lunch Orders" text="Pick the whole week in one go." />

      <div className="sticky top-0 z-20 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3">
                <select
                  className="w-full min-w-0 rounded-xl border bg-white px-3 py-3 text-sm"
                  value={selectedPupil}
                  onChange={(e) => setSelectedPupil(e.target.value)}
                  disabled={loadingWeek || saving}
                >
                  {pupils.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <Button
                    variant="outline"
                    disabled={!canGoPrev || dirty}
                    onClick={() => setWeekStart(addWeeks(weekStart, -1))}
                    className="w-full"
                  >
                    ← Previous
                  </Button>

                  <div className="col-span-1 flex items-center justify-center rounded-xl border bg-white px-2 py-3 text-center text-xs font-medium sm:min-w-[180px] sm:px-3 sm:text-sm">
                    {format(weekStart, "MMM d")} – {format(weekEndFriday, "MMM d")}
                  </div>

                  <Button
                    variant="outline"
                    disabled={dirty}
                    onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                    className="w-full"
                  >
                    Next →
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Progress: {progress.done}/{progress.total}
                </div>
                <Button
                  disabled={!dirty || !weekComplete || saving || isLocked}
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save week"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {dirty && !isLocked && (
        <div className="sticky top-[72px] z-30">
          <div className="mx-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
            You have unsaved changes.
          </div>
        </div>
      )}

      {loadingWeek && <Card className="p-6">Loading…</Card>}

      {!loadingWeek && config && (
        <>
          <Card className="min-w-0 p-2 sm:p-3">
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
              {config.weekDates.map((date, i) => {
                const isOrderable = config.orderable.includes(date);
                const active = activeDate === date;
                const complete = isOrderable
                  ? isDayComplete(selections[date], getMealOptionsForDay(date, selections[date]))
                  : false;
                const label = isOrderable ? (complete ? "Complete" : "Incomplete") : "No ordering";

                return (
                  <button
                    key={date}
                    id={`day-${date}`}
                    type="button"
                    disabled={!isOrderable}
                    onClick={() => setActiveDate(date)}
                    className={[
                      "min-w-[86px] snap-start rounded-2xl border px-2 py-3 text-left text-sm transition sm:min-w-[116px] sm:px-3",
                      active ? "ring-2 ring-primary border-primary" : "",
                      !isOrderable ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50" : "",
                      complete ? "border-green-200 bg-green-50 text-green-900" : "",
                      isOrderable && !complete ? "border-slate-200 bg-white hover:bg-muted/30" : "",
                    ].join(" ")}
                  >
                    <div className="text-[11px] text-muted-foreground sm:text-xs">{weekdayLabels[i]}</div>
                    <div className="font-semibold">{format(parseISO(date), "MMM d")}</div>
                    <div className="mt-1 text-[11px] sm:text-xs">{label}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          {activeDate && config.orderable.includes(activeDate) && activeSelection && (
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="min-w-0 space-y-4">
                <Card className="p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <h2 className="text-lg font-semibold sm:text-xl">
                        {format(parseISO(activeDate), "EEEE, MMM d")}
                      </h2>

                      <select
                        className="w-full min-w-0 rounded-xl border bg-white px-3 py-3 text-sm"
                        value={selectedMenuId}
                        onChange={(e) => handleMenuChange(e.target.value)}
                        disabled={loadingMenu || loadingWeek || saving || isLocked}
                      >
                        {config.availableMenus.map((menu) => (
                          <option key={menu.id} value={menu.id}>
                            {menu.name}
                          </option>
                        ))}
                      </select>

                      <p className="text-sm text-muted-foreground">
                        Changing menu only filters the options shown below. It does not remove meals already chosen on other menus.
                      </p>
                    </div>
                  </div>

                  {loadingMenu && !mealOptionsByMenu[selectedMenuId]?.[activeDate] ? (
                    <Card className="p-6">Loading menu options…</Card>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {activeMealOptions.map((meal) => {
                        const selected =
                          activeSelection.mealOptionId === meal.id &&
                          activeSelection.menuId === selectedMenuId;

                        return (
                          <div
                            key={meal.id}
                            className={[
                              "overflow-hidden rounded-2xl border transition",
                              selected
                                ? "ring-2 ring-primary border-primary bg-primary/5"
                                : "bg-white",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              onClick={() => !isLocked && setMealOption(activeDate, meal.id)}
                              disabled={isLocked}
                              className="w-full text-left"
                            >
                              <div className="relative h-36 bg-muted sm:h-40">
                                {meal.imageUrl ? (
                                  <Image
                                    src={meal.imageUrl}
                                    alt={meal.name}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 100vw, 400px"
                                  />
                                ) : null}
                              </div>

                              <div className="p-4">
                                <div className="text-base font-semibold sm:text-lg">{meal.name}</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {meal.groups.length} optional{meal.groups.length === 1 ? "" : "s"}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-start justify-between gap-3 px-4 pb-4">
                              <div className="min-w-0 flex-1 flex flex-wrap gap-1">
                                {meal.allergens.map((a) => (
                                  <span
                                    key={a.id}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] ${getAllergenColorClass(
                                      a.name
                                    )}`}
                                  >
                                    {a.name}
                                  </span>
                                ))}
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={() => setMealInfo(meal)}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {activeMealOptions.length === 0 && (
                        <Card className="col-span-full p-6 text-sm text-muted-foreground">
                          No meals are available for this menu on this day.
                        </Card>
                      )}
                    </div>
                  )}
                </Card>

                {activeMealOption && (
                  <div ref={mealGroupsRef}>
                    <Card className="space-y-5 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{activeMealOption.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Review each section below.
                          </p>
                        </div>
                      </div>

                      {activeMealOption.groups.map((group) => {
                        const selectedIds = getSelectedChoiceIdsForGroup(group, activeSelection);

                        return (
                          <section key={group.id} className="space-y-4 rounded-2xl border p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold">{group.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  Choose up to {group.maxSelections}
                                </div>
                              </div>

                              <div className="text-sm font-medium">
                                {selectedIds.length}/{group.maxSelections}
                              </div>
                            </div>

                            <div className="space-y-3">
                              {group.choices.map((choice) => {
                                const checked = selectedIds.includes(choice.id);
                                const extras =
                                  activeSelection.itemsByChoiceId[choice.id]?.selectedIngredients ?? [];

                                return (
                                  <div
                                    key={choice.id}
                                    className={[
                                      "rounded-2xl border p-4",
                                      checked ? "border-primary bg-primary/5" : "bg-white",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <button
                                        type="button"
                                        onClick={() => !isLocked && toggleChoice(activeDate, group, choice.id)}
                                        disabled={isLocked}
                                        className="flex-1 text-left"
                                      >
                                        <div className="font-medium">{choice.name}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                          {checked ? "Selected" : "Tap to select"}
                                        </div>
                                      </button>

                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setChoiceInfo(choice)}
                                      >
                                        <Info className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    {checked && choice.ingredients.length > 0 && (
                                      <div className="mt-4 space-y-2">
                                        <div className="text-sm font-medium">Extras</div>
                                        <div className="flex flex-wrap gap-2">
                                          {choice.ingredients.map((extra) => {
                                            const active = extras.includes(extra);

                                            return (
                                              <Button
                                                key={extra}
                                                type="button"
                                                size="sm"
                                                variant={active ? "default" : "outline"}
                                                disabled={isLocked}
                                                onClick={() =>
                                                  !isLocked && toggleExtra(activeDate, choice.id, extra)
                                                }
                                              >
                                                {extra}
                                              </Button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}

                      <div className="flex gap-2 pt-4">
                        {isLastOrderableDay ? (
                          <Button
                            className="flex-1"
                            disabled={!dirty || !weekComplete || saving || isLocked}
                            onClick={handleSave}
                          >
                            {saving ? "Saving…" : "Save week"}
                          </Button>
                        ) : (
                          <Button
                            className="flex-1"
                            disabled={!nextOrderableDate}
                            onClick={goToNextDay}
                          >
                            {nextOrderableDate
                              ? `Next day (${format(parseISO(nextOrderableDate), "EEE")})`
                              : "Last day"}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-4">
                <Card className="p-4 sm:p-5">
                  <div className="text-lg font-semibold">
                    {possessive(config.pupil.name)} Week Summary
                  </div>

                  <div className="mt-4 space-y-3">
                    {config.orderable.map((date) => {
                      const day = selections[date];
                      const options = getMealOptionsForDay(date, day);
                      const meal = day?.mealOptionId
                        ? options.find((m) => m.id === day.mealOptionId) ?? null
                        : null;
                      const chosen = getChosenChoiceNames(day, meal);
                      const complete = isDayComplete(day, options);

                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => setActiveDate(date)}
                          className={[
                            "w-full rounded-xl border p-3 text-left transition hover:bg-muted/20",
                            complete ? "border-green-200 bg-green-50/60" : "border-slate-200 bg-white",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">
                              {format(parseISO(date), "EEE, MMM d")}
                            </div>
                            <div className="text-xs">{complete ? "Complete" : "Incomplete"}</div>
                          </div>

                          <div className="mt-1 text-sm text-muted-foreground">
                            {meal ? meal.name : "No meal selected"}
                          </div>

                          {chosen.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {chosen.map((name) => (
                                <span
                                  key={`${date}-${name}`}
                                  className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!mealInfo} onOpenChange={(open) => !open && setMealInfo(null)}>
        <DialogContent className="max-w-lg bg-white">
          {mealInfo && (
            <>
              <DialogHeader>
                <DialogTitle>{mealInfo.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 bg-white">
                {mealInfo.imageUrl ? (
                  <div className="relative h-48 overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={mealInfo.imageUrl}
                      alt={mealInfo.name}
                      fill
                      className="object-cover"
                      sizes="640px"
                    />
                  </div>
                ) : null}
                <div className="space-y-2 rounded-xl border p-4">
                  <div className="font-medium">Nutrition</div>
                  <NutritionRow label="Calories" value={mealInfo.caloriesKcal} suffix=" kcal" />
                  <NutritionRow label="Protein" value={mealInfo.proteinG} suffix=" g" />
                  <NutritionRow label="Carbs" value={mealInfo.carbsG} suffix=" g" />
                  <NutritionRow label="Sugars" value={mealInfo.sugarsG} suffix=" g" />
                  <NutritionRow label="Fat" value={mealInfo.fatG} suffix=" g" />
                  <NutritionRow label="Saturates" value={mealInfo.saturatesG} suffix=" g" />
                  <NutritionRow label="Fibre" value={mealInfo.fibreG} suffix=" g" />
                  <NutritionRow label="Salt" value={mealInfo.saltG} suffix=" g" />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!choiceInfo} onOpenChange={(open) => !open && setChoiceInfo(null)}>
        <DialogContent className="max-w-lg bg-white">
          {choiceInfo && (
            <>
              <DialogHeader>
                <DialogTitle>{choiceInfo.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {choiceInfo.imageUrl ? (
                  <div className="relative h-48 overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={choiceInfo.imageUrl}
                      alt={choiceInfo.name}
                      fill
                      className="object-cover"
                      sizes="640px"
                    />
                  </div>
                ) : null}
                <div className="space-y-2 rounded-xl border p-4">
                  <div className="font-medium">Nutrition</div>
                  <NutritionRow label="Calories" value={choiceInfo.caloriesKcal} suffix=" kcal" />
                  <NutritionRow label="Protein" value={choiceInfo.proteinG} suffix=" g" />
                  <NutritionRow label="Carbs" value={choiceInfo.carbsG} suffix=" g" />
                  <NutritionRow label="Sugars" value={choiceInfo.sugarsG} suffix=" g" />
                  <NutritionRow label="Fat" value={choiceInfo.fatG} suffix=" g" />
                  <NutritionRow label="Saturates" value={choiceInfo.saturatesG} suffix=" g" />
                  <NutritionRow label="Fibre" value={choiceInfo.fibreG} suffix=" g" />
                  <NutritionRow label="Salt" value={choiceInfo.saltG} suffix=" g" />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}