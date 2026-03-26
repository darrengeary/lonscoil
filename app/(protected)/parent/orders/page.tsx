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
import { AnimatePresence, motion } from "motion/react";
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
  mealOptionId: string | null;
  itemsByChoiceId: Record<string, { selectedIngredients: string[] }>;
};

type PendingScrollTarget = "choices" | "meals" | null;

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

function buildSelectionFromEffectiveOrder(order: EffectiveOrder): DaySelection {
  if (!order) {
    return { mealOptionId: null, itemsByChoiceId: {} };
  }

  return {
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
  mealOptionsByDate: Record<string, MealOption[]>
) {
  return (
    dates.find((date) => !isDayComplete(selections[date], mealOptionsByDate[date] ?? [])) ??
    dates[0] ??
    null
  );
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

function sanitizeSelectionForDate(day: DaySelection, mealOptions: MealOption[]): DaySelection {
  if (!day.mealOptionId) return { mealOptionId: null, itemsByChoiceId: {} };

  const meal = mealOptions.find((m) => m.id === day.mealOptionId);
  if (!meal) {
    return { mealOptionId: null, itemsByChoiceId: {} };
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

function getChosenChoiceNamesForMeal(meal: MealOption, day: DaySelection | null | undefined) {
  if (!day) return [];

  return meal.groups.flatMap((group) =>
    group.choices
      .filter((choice) => !!day.itemsByChoiceId[choice.id])
      .map((choice) => choice.name)
  );
}

function moveMealToFront(meals: MealOption[], mealOptionId?: string | null) {
  if (!mealOptionId) return meals;
  const selected = meals.find((m) => m.id === mealOptionId);
  if (!selected) return meals;
  return [selected, ...meals.filter((m) => m.id !== mealOptionId)];
}

function possessive(name: string) {
  if (!name) return "Pupil's";
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function parseHolidayEntry(entry: string) {
  const dateMatch = entry.match(/^\d{4}-\d{2}-\d{2}/);
  const date = dateMatch?.[0] ?? "";
  let label = entry.slice(date.length).trim();

  if (label.startsWith("|") || label.startsWith(":")) {
    label = label.slice(1).trim();
  } else if (label.startsWith("-")) {
    label = label.slice(1).trim();
  }

  return {
    date,
    label: label || "Holiday",
  };
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

  const [mealOptionsByDate, setMealOptionsByDate] = useState<Record<string, MealOption[]>>({});
  const [mealOrderByDate, setMealOrderByDate] = useState<Record<string, string[]>>({});

  const [selections, setSelections] = useState<Record<string, DaySelection>>({});
const [initialSelections, setInitialSelections] = useState<Record<string, DaySelection>>({});

  const [saving, setSaving] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [mealInfo, setMealInfo] = useState<MealOption | null>(null);
  const [choiceInfo, setChoiceInfo] = useState<Choice | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<PendingScrollTarget>(null);

  const topStickyRef = useRef<HTMLDivElement | null>(null);
  const subStickyRef = useRef<HTMLDivElement | null>(null);
  const mealOptionsRef = useRef<HTMLDivElement | null>(null);
  const choicesSectionRef = useRef<HTMLDivElement | null>(null);

  const [topStickyHeight, setTopStickyHeight] = useState(0);
  const [subStickyHeight, setSubStickyHeight] = useState(0);

  useEffect(() => {
    fetchJSON<Pupil[]>("/api/pupils?parent=true", []).then((data) => {
      setPupils(data);
      if (data[0] && !selectedPupil) {
        setSelectedPupil(data[0].id);
      }
    });
  }, [selectedPupil]);

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
        setMealOptionsByDate(payload.mealOptionsByDate);

        const nextMealOrderByDate: Record<string, string[]> = {};
        for (const date of payload.weekDates) {
          const meals = payload.mealOptionsByDate[date] ?? [];
          const selectedMealId = payload.effectiveOrders[date]?.mealOptionId ?? null;
          nextMealOrderByDate[date] = moveMealToFront(meals, selectedMealId).map((m) => m.id);
        } 
        setMealOrderByDate(nextMealOrderByDate);

        const nextSelections: Record<string, DaySelection> = {};
        for (const date of payload.weekDates) {
          nextSelections[date] = sanitizeSelectionForDate(
            buildSelectionFromEffectiveOrder(payload.effectiveOrders[date] ?? null),
            payload.mealOptionsByDate[date] ?? []
          );
        }
setSelections(nextSelections);
setInitialSelections(clone(nextSelections));
setDirty(false);
setActiveDate(
  pickNextIncompleteDate(payload.orderable, nextSelections, payload.mealOptionsByDate)
);
      })
      .finally(() => setLoadingWeek(false));
  }, [selectedPupil, weekStart]);

  useEffect(() => {
    if (!selectedPupil || !selectedMenuId || !config) return;

    setLoadingMenu(true);

    const url = `/api/parents/ordering-config?pupilId=${encodeURIComponent(
      selectedPupil
    )}&weekStart=${encodeURIComponent(format(weekStart, DATE_FMT))}&menuId=${encodeURIComponent(
      selectedMenuId
    )}`;

    fetchJSON<OrderingConfig | null>(url, null)
      .then((payload) => {
        if (!payload) return;

        setMealOptionsByDate(payload.mealOptionsByDate);

        setMealOrderByDate((prev) => {
          const next: Record<string, string[]> = { ...prev };

          for (const date of payload.weekDates) {
            const meals = payload.mealOptionsByDate[date] ?? [];
            const existingOrder = prev[date] ?? [];
            const existingSet = new Set(existingOrder);

            const kept = existingOrder.filter((id) => meals.some((m) => m.id === id));
            const missing = meals.filter((m) => !existingSet.has(m.id)).map((m) => m.id);

            next[date] = [...kept, ...missing];
          }

          return next;
        });

        setSelections((prev) => {
          const next = { ...prev };
          for (const date of payload.weekDates) {
            if (!next[date]) continue;
            next[date] = sanitizeSelectionForDate(next[date], payload.mealOptionsByDate[date] ?? []);
          }
          return next;
        });
      })
      .finally(() => setLoadingMenu(false));
  }, [selectedMenuId, selectedPupil, config, weekStart]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const measure = () => {
      setTopStickyHeight(topStickyRef.current?.offsetHeight ?? 0);
      setSubStickyHeight(subStickyRef.current?.offsetHeight ?? 0);
    };

    measure();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;

    if (observer && topStickyRef.current) observer.observe(topStickyRef.current);
    if (observer && subStickyRef.current) observer.observe(subStickyRef.current);

    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dirty, loadingWeek, config, activeDate]);

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
      isDayComplete(selections[date], mealOptionsByDate[date] ?? [])
    );
  }, [config, orderableDates, selections, mealOptionsByDate]);

  const progress = useMemo(() => {
    if (!config) return { done: 0, total: 0 };
    const total = orderableDates.length;
    const done = orderableDates.filter((date) =>
      isDayComplete(selections[date], mealOptionsByDate[date] ?? [])
    ).length;
    return { done, total };
  }, [config, orderableDates, selections, mealOptionsByDate]);

  const activeMealOptions = activeDate ? mealOptionsByDate[activeDate] ?? [] : [];
  const activeSelection = activeDate ? selections[activeDate] : null;
  const activeMealOption =
    activeSelection?.mealOptionId
      ? activeMealOptions.find((m) => m.id === activeSelection.mealOptionId) ?? null
      : null;

  const orderedActiveMealOptions = useMemo(() => {
    const meals = activeMealOptions;
    const order = activeDate ? mealOrderByDate[activeDate] ?? [] : [];
    if (!order.length) return meals;

    const byId = new Map(meals.map((meal) => [meal.id, meal]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean) as MealOption[];
    const leftovers = meals.filter((meal) => !order.includes(meal.id));

    return [...ordered, ...leftovers];
  }, [activeMealOptions, activeDate, mealOrderByDate]);

  const activeOrderableIndex = activeDate ? orderableDates.indexOf(activeDate) : -1;
  const nextOrderableDate =
    activeOrderableIndex >= 0 && activeOrderableIndex < orderableDates.length - 1
      ? orderableDates[activeOrderableIndex + 1]
      : null;

  const isLastOrderableDay =
    !!activeDate &&
    orderableDates.length > 0 &&
    orderableDates[orderableDates.length - 1] === activeDate;

  const holidayLabel = config?.holidays?.[0]
    ? parseHolidayEntry(config.holidays[0]).label
    : null;

  const subStickyTop = topStickyHeight;
  const mobileScrollOffset = topStickyHeight + subStickyHeight + 12;

  function scrollToTarget(ref: React.RefObject<HTMLElement>) {
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 640) return;
    if (!ref.current) return;

    const top =
      window.scrollY + ref.current.getBoundingClientRect().top - mobileScrollOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (!pendingScrollTarget) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 640) {
      setPendingScrollTarget(null);
      return;
    }

    const targetRef =
      pendingScrollTarget === "choices" ? choicesSectionRef : mealOptionsRef;

    if (!targetRef.current) return;

    const timer = window.setTimeout(() => {
      scrollToTarget(targetRef);
      setPendingScrollTarget(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pendingScrollTarget, activeDate, activeMealOption, loadingMenu, mobileScrollOffset]);

  function handleMenuChange(nextMenuId: string) {
    if (isLocked || loadingMenu || loadingWeek || saving) return;
    if (nextMenuId === selectedMenuId) return;
    setSelectedMenuId(nextMenuId);
  }

  function setMealOption(date: string, mealOptionId: string) {
    if (isLocked) return;

    const meal = (mealOptionsByDate[date] ?? []).find((m) => m.id === mealOptionId);
    if (!meal) return;

    setSelections((prev) => ({
      ...prev,
      [date]: {
        mealOptionId,
        itemsByChoiceId: {},
      },
    }));

    setMealOrderByDate((prev) => {
      const currentOrder =
        prev[date]?.filter((id) => (mealOptionsByDate[date] ?? []).some((m) => m.id === id)) ??
        (mealOptionsByDate[date] ?? []).map((m) => m.id);

      return {
        ...prev,
        [date]: [mealOptionId, ...currentOrder.filter((id) => id !== mealOptionId)],
      };
    });

    setDirty(true);
    setPendingScrollTarget("choices");
  }

  function toggleChoice(date: string, group: Group, choiceId: string) {
    if (isLocked) return;

    setSelections((prev) => {
      const existingDay = prev[date] ?? { mealOptionId: null, itemsByChoiceId: {} };
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

      return { ...prev, [date]: day };
    });

    setDirty(true);
  }

  function toggleExtra(date: string, choiceId: string, extra: string) {
    if (isLocked) return;

    setSelections((prev) => {
      const existingDay = prev[date] ?? { mealOptionId: null, itemsByChoiceId: {} };
      const day = clone(existingDay);
      const existing = day.itemsByChoiceId[choiceId] ?? { selectedIngredients: [] };
      const has = existing.selectedIngredients.includes(extra);

      day.itemsByChoiceId[choiceId] = {
        selectedIngredients: has
          ? existing.selectedIngredients.filter((x) => x !== extra)
          : Array.from(new Set([...existing.selectedIngredients, extra])),
      };

      return { ...prev, [date]: day };
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
          menuId: selectedMenuId,
          orders,
          updateDefaultPattern: true,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        toast.error(msg || "Failed to save");
        return;
      }

      const refreshUrl = `/api/parents/ordering-config?pupilId=${encodeURIComponent(
        selectedPupil
      )}&weekStart=${encodeURIComponent(config.weekStart)}&menuId=${encodeURIComponent(
        selectedMenuId
      )}`;

      const refreshed = await fetchJSON<OrderingConfig | null>(refreshUrl, null);

      if (refreshed) {
        setConfig(refreshed);
        setMealOptionsByDate(refreshed.mealOptionsByDate);

        setMealOrderByDate((prev) => {
          const next: Record<string, string[]> = { ...prev };

          for (const date of refreshed.weekDates) {
            const meals = refreshed.mealOptionsByDate[date] ?? [];
            const existingOrder = prev[date] ?? [];
            const existingSet = new Set(existingOrder);

            const kept = existingOrder.filter((id) => meals.some((m) => m.id === id));
            const missing = meals.filter((m) => !existingSet.has(m.id)).map((m) => m.id);

            next[date] = kept.length || missing.length ? [...kept, ...missing] : meals.map((m) => m.id);
          }

          return next;
        });

        const nextSelections: Record<string, DaySelection> = {};
        for (const date of refreshed.weekDates) {
          nextSelections[date] = sanitizeSelectionForDate(
            buildSelectionFromEffectiveOrder(refreshed.effectiveOrders[date] ?? null),
            refreshed.mealOptionsByDate[date] ?? []
          );
        }
setSelections(nextSelections);
setInitialSelections(clone(nextSelections));
setDirty(false);
setActiveDate(
  pickNextIncompleteDate(
    refreshed.orderable,
    nextSelections,
    refreshed.mealOptionsByDate
  )
);
      } else {
        setDirty(false);
      }

      toast.success("Week saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function goToNextDay() {
    if (!nextOrderableDate || !activeDate) return;

    setMealOrderByDate((prev) => {
      const sourceOrder =
        prev[activeDate] ?? (mealOptionsByDate[activeDate] ?? []).map((m) => m.id);

      const nextMeals = mealOptionsByDate[nextOrderableDate] ?? [];
      const nextMealIds = new Set(nextMeals.map((m) => m.id));

      const kept = sourceOrder.filter((id) => nextMealIds.has(id));
      const missing = nextMeals.map((m) => m.id).filter((id) => !kept.includes(id));

      return {
        ...prev,
        [nextOrderableDate]: [...kept, ...missing],
      };
    });

    setActiveDate(nextOrderableDate);
    setPendingScrollTarget("meals");
  }

  const canGoPrev = !isBefore(addWeeks(weekStart, -1), minWeekStart);

  return (
    <div className="space-y-4 pb-32 md:pb-24">
      <DashboardHeader heading="Lunch Orders" text="Pick the whole week in one go." />

      <div
        ref={topStickyRef}
        className="sticky top-0 z-30 py-3"
        style={{ backgroundColor: "var(--background-color)" }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <select
                className="min-w-[220px] rounded-xl border bg-white px-3 py-3"
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
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Progress: {progress.done}/{progress.total}
              </div>
              <Button
                className="bg-sky-600 text-white hover:bg-sky-700"
                disabled={!dirty || !weekComplete || saving || isLocked}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save week"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={subStickyRef}
        className="sticky z-20 pb-2"
        style={{
          top: subStickyTop,
          backgroundColor: "var(--background-color)",
        }}
      >
        <div className="space-y-2">
          {dirty && !isLocked && (
            <div className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow-sm">
              You have unsaved changes.
            </div>
          )}

          <div className="w-full">
            <div className="grid grid-cols-5 gap-2">
              <Button
                disabled={!canGoPrev || dirty}
                onClick={() => setWeekStart(addWeeks(weekStart, -1))}
                className="h-[52px] rounded-xl bg-sky-600 text-white hover:bg-sky-700"
              >
                ← Previous
              </Button>

              <div className="col-span-3 flex h-[52px] items-center justify-center whitespace-nowrap rounded-xl border px-3 text-center text-sm font-medium bg-white">
                {format(weekStart, "MMM d")} – {format(weekEndFriday, "MMM d")}
              </div>

              <Button
                disabled={dirty}
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                className="h-[52px] rounded-xl bg-sky-600 text-white hover:bg-sky-700"
              >
                Next →
              </Button>
            </div>
          </div>

  {!loadingWeek && config && (
  <div className="overflow-x-auto sm:overflow-visible">
    <div className="grid grid-cols-5 gap-2">
      {config.weekDates.map((date, i) => {
        const isOrderable = config.orderable.includes(date);
        const active = activeDate === date;

        const effectiveOrder = config.effectiveOrders[date] ?? null;
        const source = effectiveOrder?.source ?? null;

        const emptyDay: DaySelection = { mealOptionId: null, itemsByChoiceId: {} };

        const currentSelection = selections[date] ?? emptyDay;
        const initialSelection = initialSelections[date] ?? emptyDay;

        const hasLocalEdits =
          JSON.stringify(currentSelection) !== JSON.stringify(initialSelection);
const isCustomEditedDay =
  isOrderable && (source === "explicit" || hasLocalEdits);

const isRolloverDay =
  isOrderable &&
  !hasLocalEdits &&
  (source === "rollover" || source === "pattern");

const isUneditedDay =
  isOrderable &&
  !hasLocalEdits &&
  !effectiveOrder;
const cardClasses = active
  ? "border border-sky-700 bg-sky-600 text-white"
  : !isOrderable
    ? "bg-red-100/80 text-red-800"
    : isCustomEditedDay
      ? "bg-emerald-100 text-emerald-800"
      : isRolloverDay
        ? "bg-indigo-100 text-indigo-800"
        : "border border-slate-200 bg-white text-slate-700";

const labelClasses = active
  ? "text-sky-50"
  : !isOrderable
    ? "text-red-700"
    : isCustomEditedDay
      ? "text-emerald-700"
      : isRolloverDay
        ? "text-indigo-700"
        : "text-slate-500";
        return (
          <button
            key={date}
            id={`day-${date}`}
            type="button"
            onClick={() => setActiveDate(date)}
            className={[
              "min-w-0 rounded-xl px-2 py-2 text-left shadow-sm transition-all",
              "sm:rounded-2xl sm:px-3 sm:py-3",
              cardClasses,
            ].join(" ")}
          >
            <div
              className={[
                "text-[10px] leading-none sm:text-xs",
                labelClasses,
              ].join(" ")}
            >
              {weekdayLabels[i]}
            </div>

            <div className="mt-1 text-sm font-semibold leading-none sm:text-base">
              {format(parseISO(date), "d")}
            </div>
          </button>
        );
      })}
    </div>
  </div>
)}
          {!loadingWeek && holidayLabel && (
            <div className="rounded-xl bg-red-100 px-2.5 py-2 text-xs font-medium text-red-900 shadow-sm sm:px-3 sm:text-sm">
              {holidayLabel}
            </div>
          )}
        </div>
      </div>

      {loadingWeek && <Card className="p-6">Loading…</Card>}

      {!loadingWeek && config && activeDate && config.orderable.includes(activeDate) && activeSelection && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div ref={mealOptionsRef}>
              <Card className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <h2 className="text-xl font-semibold">
                        {format(parseISO(activeDate), "EEEE, MMM d")}
                      </h2>

                      <select
                        className="min-w-[220px] rounded-xl border bg-white px-3 py-2 text-sm"
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
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Changing menu only updates the options shown below.
                    </p>
                  </div>
                </div>

                {loadingMenu ? (
                  <Card className="p-6">Loading menu options…</Card>
                ) : (
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      layout
                      className="mx-auto flex flex-col gap-3"
                      animate={{
                        maxWidth: activeSelection?.mealOptionId ? 760 : 1120,
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 30 }}
                    >
                      {orderedActiveMealOptions.map((meal) => {
                        const selected = activeSelection.mealOptionId === meal.id;
                        const chosenNames = getChosenChoiceNamesForMeal(meal, activeSelection);
                        const hasChosenNames = chosenNames.length > 0;

                        return (
                          <motion.div
                            key={meal.id}
                            layout
                            transition={{
                              layout: { type: "spring", stiffness: 360, damping: 32 },
                            }}
                            className={[
                              "overflow-hidden border bg-white",
                             selected
  ? "rounded-xl border-sky-300 bg-sky-50 ring-2 ring-sky-100"
                                : activeSelection?.mealOptionId
                                  ? "rounded-lg border-slate-200"
                                  : "rounded-2xl border-slate-200",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              onClick={() => !isLocked && setMealOption(activeDate, meal.id)}
                              disabled={isLocked}
                              className="flex w-full items-stretch gap-3 p-3 text-left"
                            >
                              <motion.div
                                layout
                                className={[
                                  "relative shrink-0 overflow-hidden bg-muted",
                                  activeSelection?.mealOptionId ? "h-20 w-20 rounded-lg" : "h-24 w-24 rounded-xl",
                                ].join(" ")}
                              >
                                {meal.imageUrl ? (
                                  <Image
                                    src={meal.imageUrl}
                                    alt={meal.name}
                                    fill
                                    className="object-cover"
                                    sizes="96px"
                                  />
                                ) : null}
                              </motion.div>

                              <motion.div layout className="min-w-0 flex-1 py-1 pr-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div
                                      className={
                                        activeSelection?.mealOptionId
                                          ? "text-base font-semibold"
                                          : "text-lg font-semibold"
                                      }
                                    >
                                      {meal.name}
                                    </div>

                                    {!hasChosenNames && (
                                      <div className="mt-1 text-sm text-muted-foreground">
                                        {meal.groups.length} option{meal.groups.length === 1 ? "" : "s"}
                                      </div>
                                    )}

                                    {hasChosenNames && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {chosenNames.map((name) => (
                                          <span
                                            key={`${meal.id}-${name}`}
className={[
  "rounded-full border px-2 py-0.5 text-[11px]",
  selected
    ? "border-sky-200 bg-sky-100 text-sky-900"
    : "border-slate-200 bg-slate-100 text-slate-700",
].join(" ")}
                                          >
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {!hasChosenNames && meal.allergens.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {meal.allergens.slice(0, 4).map((a) => (
                                          <span
                                            key={a.id}
                                            className={`rounded-full border px-2 py-px text-[10px] ${getAllergenColorClass(
                                              a.name
                                            )}`}
                                          >
                                            {a.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setMealInfo(meal);
                                    }}
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </div>
                              </motion.div>
                            </button>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>
                )}
              </Card>
            </div>

            {activeMealOption && (
              <div ref={choicesSectionRef}>
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
checked ? "border-indigo-300 bg-indigo-50" : "bg-white",
                                ].join(" ")}
                              >
                                <div onClick={() => !isLocked && toggleChoice(activeDate, group, choice.id)} className="flex items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    
                                    disabled={isLocked}
                                    className="flex-1 text-left"
                                  >
                                    <div className="font-medium">{choice.name}</div>
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
                                            className={
                                              active
                                                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                                : ""
                                            }
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
                        className="flex-1 bg-sky-600 text-white hover:bg-sky-700"
                        disabled={!dirty || !weekComplete || saving || isLocked}
                        onClick={handleSave}
                      >
                        {saving ? "Saving…" : "Save week"}
                      </Button>
                    ) : (
                      <Button
className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700"
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

          <div className="space-y-4">
            <Card className="p-5 bg-transparent shadow-none border-none">
              <div className="text-lg font-semibold">
                {possessive(config.pupil.name)} Week Summary
              </div>

              <div className="mt-4 space-y-3">
                {config.orderable.map((date) => {
                  const day = selections[date];
                  const options = mealOptionsByDate[date] ?? [];
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
  "w-full rounded-xl border p-3 text-left transition",
  "bg-slate-50/70 hover:bg-slate-100/80",
complete
  ? "border-emerald-300 bg-slate-50/70"
  : "border-slate-200 bg-slate-50/40",
].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {format(parseISO(date), "EEE, MMM d")}
                        </div>
<div className="flex items-center">
  {complete ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
      ✓
    </span>
  ) : (
<span className="inline-flex h-5 w-5 rounded-full border border-slate-300 bg-slate-50" />  )}
</div>                      </div>

<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
  {meal?.imageUrl ? (
    <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-md bg-muted">
      <Image
        src={meal.imageUrl}
        alt={meal.name}
        fill
        className="object-cover"
        sizes="20px"
      />
    </div>
  ) : null}
  <span className="truncate">{meal ? meal.name : "No meal selected"}</span>
</div>

                      {chosen.length > 0 && (
<div className="mt-2 flex flex-wrap gap-1.5">
  {chosen.map((name) => (
    <span
      key={`${date}-${name}`}
      className="rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-[11px] text-sky-900"
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