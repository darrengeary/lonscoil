// app/(protected)/parent/orders/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  isBefore,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parse,
  isValid,
  startOfDay,
  endOfDay,
  subDays,
  isAfter,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import WeeklyDayCard from "@/components/parent/WeeklyDayCard";
import DayEditModal from "@/components/parent/DayEditModal";
import { DashboardHeader } from "@/components/dashboard/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Pupil {
  id: string;
  name: string;
}

type Nutrition = {
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
};

interface MealGroup {
  id: string;
  name: string;
  maxSelections: number;
  choices: ({
    id: string;
    name: string;
    imageUrl?: string | null;
    ingredients?: string[];
  } & Nutrition)[];
}

type Selections = Record<
  string,
  Record<
    string,
    {
      choiceIds: string[];
      configByChoiceId: Record<string, { selectedIngredients: string[]; extrasConfirmed?: boolean }>;
    }
  >
>;

const DATE_FMT = "yyyy-MM-dd";
const ALT_FMT = "dd-MM-yyyy";
const daysInWeek = 5;
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];

async function fetchJSON<T>(url: string, init?: RequestInit, fallback: T = [] as unknown as T): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return fallback;
    const text = await res.text();
    if (!text) return fallback;
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback;
    }
  } catch (e: any) {
    if (e?.name === "AbortError" || e?.code === "ABORT_ERR") return fallback;
    throw e;
  }
}

function normalizeDateString(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d1 = parse(s, ALT_FMT, new Date());
  if (isValid(d1)) return format(d1, DATE_FMT);
  const d2 = new Date(s);
  if (isValid(d2)) return format(d2, DATE_FMT);
  return s;
}

function isPastThursdayCutoffForDate(date: Date) {
  const wkStart = startOfWeek(date, { weekStartsOn: 1 });
  // Thu of previous week 23:59 => subDays(Mon,4) == Thu previous week
  const cutoff = endOfDay(subDays(wkStart, 4));
  return isAfter(new Date(), cutoff);
}

function safeAbort(controller?: AbortController, reason?: unknown) {
  try {
    if (controller && !controller.signal.aborted) {
      // @ts-ignore
      controller.abort?.(reason);
    }
  } catch {}
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export default function PupilLunchOrdersPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loadingPupils, setLoadingPupils] = useState(false);
  const [selectedPupil, setSelectedPupil] = useState<string | null>(null);

  const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const lastLoadedSelectionsRef = useRef<Selections>({});

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [modalDay, setModalDay] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  const [daysToCopy, setDaysToCopy] = useState<Record<string, number>>({});
  const [weeksToRepeat, setWeeksToRepeat] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"weekly" | "calendar">("weekly");

  const [orderableDays, setOrderableDays] = useState<Set<string>>(new Set());
  const [holidayDays, setHolidayDays] = useState<Set<string>>(new Set());

  // ✅ NEW: per-choice extras preference (chicken curry extras follow chicken curry everywhere)
  const [choicePrefs, setChoicePrefs] = useState<Record<string, string[]>>({});

  // Navigation guard state
  const [guardOpen, setGuardOpen] = useState(false);
  const pendingNavRef = useRef<null | (() => void)>(null);

  // ---------- Fetch pupils ----------
  useEffect(() => {
    setLoadingPupils(true);
    const controller = new AbortController();
    fetchJSON<Pupil[]>("/api/pupils?parent=true", { signal: controller.signal }, [])
      .then((data) => {
        setPupils(data);
        if (data.length) setSelectedPupil((prev) => prev ?? data[0].id);
      })
      .finally(() => setLoadingPupils(false));
    return () => safeAbort(controller, "cleanup:pupils");
  }, []);

  // ---------- Fetch meal groups ----------
  useEffect(() => {
    if (!selectedPupil) return;
    const controller = new AbortController();

    fetchJSON<MealGroup[]>(`/api/mealgroups?pupilId=${encodeURIComponent(selectedPupil)}`, { signal: controller.signal }, [])
      .then(setMealGroups)
      .catch(() => setMealGroups([]));

    return () => safeAbort(controller, "cleanup:mealgroups");
  }, [selectedPupil]);

  // ---------- Fetch ORDERABLE & HOLIDAY days ----------
  useEffect(() => {
    if (!selectedPupil) return;
    const controller = new AbortController();
    fetchJSON<{ orderable: string[]; holidays: string[] }>(
      `/api/orderable-days?pupilId=${encodeURIComponent(selectedPupil)}`,
      { signal: controller.signal },
      { orderable: [], holidays: [] }
    ).then((payload) => {
      setOrderableDays(new Set(payload.orderable.map(normalizeDateString)));
      setHolidayDays(new Set(payload.holidays.map(normalizeDateString)));
    });
    return () => safeAbort(controller, "cleanup:orderable");
  }, [selectedPupil]);

  // ----- Weekly View days -----
  const weekdays = useMemo(() => Array.from({ length: daysInWeek }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekISO = useMemo(() => weekdays.map((d) => format(d, DATE_FMT)), [weekdays]);

  // completion requires "Complete choice" for each selected choice
  const isGroupComplete = (dateStr: string, groupId: string) => {
    const group = selections[dateStr]?.[groupId];
    const ids = group?.choiceIds ?? [];
    if (ids.length < 1) return false;
    return ids.every((cid) => group?.configByChoiceId?.[cid]?.extrasConfirmed === true);
  };

  const isDayComplete = (dateStr: string) => {
    return mealGroups.length > 0 && mealGroups.every((g) => isGroupComplete(dateStr, g.id));
  };

  const weekOrderableDays = useMemo(() => weekISO.filter((d) => orderableDays.has(d)), [weekISO, orderableDays]);

  const weekComplete = useMemo(() => {
    if (activeTab !== "weekly") return true;
    if (!mealGroups.length) return false;
    return weekOrderableDays.every((d) => isDayComplete(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, weekOrderableDays, selections, mealGroups.length]);

  const incompleteWeek = dirty && activeTab === "weekly" && !weekComplete;

  function attemptNav(action: () => void) {
    if (incompleteWeek) {
      pendingNavRef.current = action;
      setGuardOpen(true);
      return;
    }
    action();
  }

  // ---------- Fetch orders for visible range ----------
  useEffect(() => {
    if (!selectedPupil) return;
    if (mealGroups.length === 0) return;

    let start: string, end: string;
    if (activeTab === "weekly") {
      start = format(weekStart, DATE_FMT);
      end = format(addDays(weekStart, 4), DATE_FMT);
    } else {
      start = format(startOfMonth(calendarMonth), DATE_FMT);
      end = format(endOfMonth(calendarMonth), DATE_FMT);
    }

    const controller = new AbortController();

    fetchJSON<Array<{ date: string; items: Array<{ choiceId: string; selectedIngredients?: string[] }> }>>(
      `/api/lunch-orders?pupilId=${encodeURIComponent(selectedPupil)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { signal: controller.signal },
      []
    ).then((orders) => {
      const sel: Selections = {};
      const prefs: Record<string, string[]> = {};

      orders.forEach((order) => {
        const dateStr = normalizeDateString(order.date);
        if (!sel[dateStr]) sel[dateStr] = {};

        order.items.forEach((it) => {
          const choiceId = it.choiceId;
          const group = mealGroups.find((g) => g.choices.some((c) => c.id === choiceId));
          if (!group) return;

          if (!sel[dateStr][group.id]) {
            sel[dateStr][group.id] = { choiceIds: [], configByChoiceId: {} };
          }

          if (!sel[dateStr][group.id].choiceIds.includes(choiceId)) {
            sel[dateStr][group.id].choiceIds.push(choiceId);
          }

          const ing = it.selectedIngredients ?? [];
          prefs[choiceId] = ing;

          // ✅ treat loaded-from-server as "already confirmed"
          sel[dateStr][group.id].configByChoiceId[choiceId] = {
            selectedIngredients: ing,
            extrasConfirmed: true,
          };
        });
      });

      setSelections(sel);
      lastLoadedSelectionsRef.current = deepClone(sel);
      setDirty(false);

      // ✅ seed preference map from saved data
      setChoicePrefs((prev) => ({ ...prev, ...prefs }));
    });

    return () => safeAbort(controller, "cleanup:orders");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPupil, weekStart, calendarMonth, mealGroups.length, activeTab]);

  function handleConfirmChoice(dateStr: string, groupId: string, choiceId: string) {
    setSelections((prev) => {
      const day = prev[dateStr] ?? {};
      const group = day[groupId] ?? { choiceIds: [], configByChoiceId: {} };

      return {
        ...prev,
        [dateStr]: {
          ...day,
          [groupId]: {
            ...group,
            configByChoiceId: {
              ...group.configByChoiceId,
              [choiceId]: {
                selectedIngredients: group.configByChoiceId?.[choiceId]?.selectedIngredients ?? choicePrefs[choiceId] ?? [],
                extrasConfirmed: true,
              },
            },
          },
        },
      };
    });
    setDirty(true);
  }

  // ---------- Selection updates ----------
  function handleSelect(dateStr: string, groupId: string, newChoiceIds: string[]) {
    setSelections((prev) => {
      const day = prev[dateStr] ?? {};
      const group = day[groupId] ?? { choiceIds: [], configByChoiceId: {} };

      const nextConfig: typeof group.configByChoiceId = {};
      for (const cid of newChoiceIds) {
        nextConfig[cid] =
          group.configByChoiceId[cid] ?? { selectedIngredients: choicePrefs[cid] ?? [], extrasConfirmed: false };
      }

      return {
        ...prev,
        [dateStr]: {
          ...day,
          [groupId]: {
            choiceIds: newChoiceIds,
            configByChoiceId: nextConfig,
          },
        },
      };
    });
    setDirty(true);
  }

  function handleUpdateConfig(dateStr: string, groupId: string, choiceId: string, selectedIngredients: string[]) {
    // ✅ update preference map so it sticks everywhere
    setChoicePrefs((prev) => ({ ...prev, [choiceId]: selectedIngredients }));

    setSelections((prev) => {
      const day = prev[dateStr] ?? {};
      const group = day[groupId] ?? { choiceIds: [], configByChoiceId: {} };

      // ensure choice exists in selection
      const nextChoiceIds = group.choiceIds.includes(choiceId) ? group.choiceIds : [...group.choiceIds, choiceId];

      return {
        ...prev,
        [dateStr]: {
          ...day,
          [groupId]: {
            choiceIds: nextChoiceIds,
            configByChoiceId: {
              ...group.configByChoiceId,
              [choiceId]: {
                selectedIngredients,
                // ✅ changing extras means you must re-confirm
                extrasConfirmed: false,
              },
            },
          },
        },
      };
    });
    setDirty(true);
  }

  // ---------- Replicate respecting ORDERABLE only ----------
  function handleReplicateGuarded(dateStr: string, type: "next-days" | "weekday-weeks") {
    const base = selections[dateStr];
    if (!base) return;

    const resetConfirm = (b: typeof base) => {
      const out: typeof base = deepClone(b);
      for (const gid of Object.keys(out)) {
        const g = out[gid];
        for (const cid of Object.keys(g.configByChoiceId || {})) {
          g.configByChoiceId[cid] = {
            selectedIngredients: g.configByChoiceId[cid]?.selectedIngredients ?? choicePrefs[cid] ?? [],
            extrasConfirmed: false,
          };
        }
      }
      return out;
    };

    if (type === "next-days") {
      const numDays = daysToCopy[dateStr] ?? 3;
      let added = 0;
      let d = parse(dateStr, DATE_FMT, new Date());
      const updates: Record<string, typeof base> = {};
      while (added < numDays) {
        d = addDays(d, 1);
        const f = format(d, DATE_FMT);
        if (!orderableDays.has(f)) continue;
        updates[f] = resetConfirm(base);
        added++;
      }
      if (Object.keys(updates).length) {
        setSelections((prev) => ({ ...prev, ...updates }));
        setDirty(true);
      }
      alert(`Copied to next ${Object.keys(updates).length} orderable day(s)!`);
    }

    if (type === "weekday-weeks") {
      const numWeeks = weeksToRepeat[dateStr] ?? 3;
      const baseDate = parse(dateStr, DATE_FMT, new Date());
      const dow = baseDate.getDay();
      const updates: Record<string, typeof base> = {};
      for (let i = 1; i <= numWeeks; ++i) {
        const d = addDays(baseDate, i * 7);
        if (d.getDay() !== dow) continue;
        const f = format(d, DATE_FMT);
        if (!orderableDays.has(f)) continue;
        updates[f] = resetConfirm(base);
      }
      if (Object.keys(updates).length) {
        setSelections((prev) => ({ ...prev, ...updates }));
        setDirty(true);
      }
      alert(`Repeated for ${Object.keys(updates).length} future orderable week(s)!`);
    }
  }

  // ✅ Auto-fill next day: if Monday is complete, auto-select same choices on next orderable day (only if empty)
  function nextOrderableDay(fromDateStr: string) {
    let d = parse(fromDateStr, DATE_FMT, new Date());
    for (let i = 0; i < 30; i++) {
      d = addDays(d, 1);
      const f = format(d, DATE_FMT);
      if (orderableDays.has(f)) return f;
    }
    return null;
  }

  useEffect(() => {
    if (activeTab !== "weekly") return;
    if (!mealGroups.length) return;
    if (!weekOrderableDays.length) return;

    const updates: Record<string, Selections[string]> = {};

    for (const dStr of weekOrderableDays) {
      if (!isDayComplete(dStr)) continue;

      const next = nextOrderableDay(dStr);
      if (!next) continue;
      if (!weekOrderableDays.includes(next)) continue;

      const baseDay = selections[dStr];
      if (!baseDay) continue;

      const targetDay = selections[next] ?? {};
      const nextDayUpdate: typeof targetDay = { ...targetDay };

      let changed = false;

      for (const g of mealGroups) {
        const srcGroup = baseDay[g.id];
        if (!srcGroup?.choiceIds?.length) continue;

        const tgtGroup = targetDay[g.id];
        const tgtHas = (tgtGroup?.choiceIds?.length ?? 0) > 0;
        if (tgtHas) continue; // never overwrite

        const copiedConfig: any = {};
        for (const cid of srcGroup.choiceIds) {
          copiedConfig[cid] = {
            selectedIngredients: srcGroup.configByChoiceId?.[cid]?.selectedIngredients ?? choicePrefs[cid] ?? [],
            extrasConfirmed: false,
          };
        }

        nextDayUpdate[g.id] = { choiceIds: [...srcGroup.choiceIds], configByChoiceId: copiedConfig };
        changed = true;
      }

      if (changed) updates[next] = nextDayUpdate;
    }

    if (Object.keys(updates).length === 0) return;

    setSelections((prev) => {
      let changed = false;
      const out: Selections = { ...prev };
      for (const [k, v] of Object.entries(updates)) {
        const existing = prev[k] ?? {};
        // ensure still empty groups before applying
        let okToApply = false;
        for (const g of mealGroups) {
          const tgtHas = (existing[g.id]?.choiceIds?.length ?? 0) > 0;
          const incomingHas = (v[g.id]?.choiceIds?.length ?? 0) > 0;
          if (!tgtHas && incomingHas) okToApply = true;
        }
        if (!okToApply) continue;

        out[k] = { ...(prev[k] ?? {}), ...v };
        changed = true;
      }
      return changed ? out : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, activeTab, weekStart, mealGroups.length, weekOrderableDays.join("|"), choicePrefs, orderableDays]);

  // ---------- Save ----------
  async function handleSaveOrders(showToast = true) {
    if (!selectedPupil) return;

    if (activeTab === "weekly" && !weekComplete) {
      if (showToast) toast.error("Please complete the week's orders before saving.");
      return;
    }

    setSaving(true);

    const todayStr = format(new Date(), DATE_FMT);

    const toSave = Object.entries(selections)
      .filter(([date]) => date >= todayStr && orderableDays.has(date))
      .map(([date, groups]) => ({
        date,
        items: Object.values(groups).flatMap((g) =>
          g.choiceIds.map((choiceId) => ({
            choiceId,
            selectedIngredients: g.configByChoiceId?.[choiceId]?.selectedIngredients ?? choicePrefs[choiceId] ?? [],
          }))
        ),
      }));

    try {
      const res = await fetch("/api/lunch-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pupilId: selectedPupil, orders: toSave }),
      });

      if (!res.ok) {
        const msg = await res.text();
        if (showToast) toast.error("Failed to save: " + (msg || res.statusText));
      } else {
        if (showToast) toast.success("Orders saved!");
        setDirty(false);
        lastLoadedSelectionsRef.current = deepClone(selections);
      }
    } catch (e: any) {
      if (showToast) toast.error("Failed to save: " + (e?.message || String(e)));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  // Warn on browser/tab close if unsaved changes
  useEffect(() => {
    mountedRef.current = true;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty]);

  // Safe wrappers for locked days
  const today = startOfDay(new Date());
  const makeSafeOnSelect = (isLocked: boolean) => (d: string, g: string, choices: string[]) => {
    if (isLocked || !orderableDays.has(d)) return;
    handleSelect(d, g, choices);
  };
  const makeSafeOnUpdate = (isLocked: boolean) => (d: string, g: string, choiceId: string, extras: string[]) => {
    if (isLocked || !orderableDays.has(d)) return;
    handleUpdateConfig(d, g, choiceId, extras);
  };
  const makeSafeOnConfirm = (isLocked: boolean) => (d: string, g: string, c: string) => {
    if (isLocked || !orderableDays.has(d)) return;
    handleConfirmChoice(d, g, c);
  };

  // Holiday banners
  const weekOrderableCount = weekISO.filter((d) => orderableDays.has(d)).length;
  const weekHolidayCount = weekISO.filter((d) => holidayDays.has(d)).length;
  const showHolidayWeekBanner = weekOrderableCount === 0 && weekHolidayCount === daysInWeek;
  const showPartialHolidayBanner = weekHolidayCount > 0 && weekHolidayCount < daysInWeek;

  // Calendar grid
  const firstOfMonth = startOfMonth(calendarMonth);
  const lastOfMonth = endOfMonth(calendarMonth);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
  const gridEnd = addDays(startOfWeek(lastOfMonth, { weekStartsOn: 1 }), daysInWeek - 1);
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const calendarDays = allDays.filter((d) => getDay(d) !== 0 && getDay(d) !== 6);

  return (
    <div className="space-y-6">
      <DashboardHeader heading="Lunch Orders" text="Manage your pupils’ lunch orders." />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <select
          className="border px-3 py-2 rounded-lg text-base bg-white shadow-sm w-full sm:w-60"
          disabled={loadingPupils}
          value={selectedPupil || ""}
          onChange={(e) => {
            const next = e.target.value;
            attemptNav(() => setSelectedPupil(next));
          }}
          aria-label="Select pupil"
        >
          {pupils.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <Button
            className="whitespace-nowrap"
            onClick={() => handleSaveOrders()}
            disabled={!dirty || saving || !selectedPupil || (activeTab === "weekly" && !weekComplete)}
            aria-disabled={!dirty || saving || !selectedPupil || (activeTab === "weekly" && !weekComplete)}
            title={activeTab === "weekly" && !weekComplete ? "Complete the week before saving" : undefined}
          >
            {saving ? "Saving…" : "Save Orders"}
            {dirty && !saving && " (unsaved)"}
          </Button>

          {dirty && !saving && (
            <span
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white shadow"
              title="You have unsaved changes"
            />
          )}
        </div>

        {activeTab === "weekly" && (
          <div className="text-sm text-muted-foreground">
            Week status: {weekComplete ? "Complete" : "Incomplete"}{" "}
            {weekOrderableDays.length ? `(${weekOrderableDays.filter(isDayComplete).length}/${weekOrderableDays.length} days)` : ""}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => attemptNav(() => setActiveTab(v as typeof activeTab))}>
        <TabsList className="mb-4">
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => attemptNav(() => setWeekStart(addWeeks(weekStart, -1)))}
              disabled={isBefore(addWeeks(weekStart, -1), startOfWeek(today, { weekStartsOn: 1 }))}
            >
              ← Previous Week
            </Button>

            <span className="font-medium text-lg">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 4), "MMM d")}
            </span>

            <Button variant="ghost" onClick={() => attemptNav(() => setWeekStart(addWeeks(weekStart, 1)))}>
              Next Week →
            </Button>
          </div>

          {showHolidayWeekBanner && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3">
              This week is a school holiday (no ordering).
            </div>
          )}
          {!showHolidayWeekBanner && weekOrderableCount === 0 && (
            <div className="text-sm text-muted-foreground bg-white border rounded-xl p-3 mb-3">
              No orderable term days this week.
            </div>
          )}
          {showPartialHolidayBanner && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
              This week includes holidays. You can only order on non-holiday days.
            </div>
          )}

          <div className="grid gap-4 grid-cols-1">
            {weekdays.map((date) => {
              const dateStr = format(date, DATE_FMT);
              const isOrderable = orderableDays.has(dateStr);
              const isHoliday = holidayDays.has(dateStr);
              const isPastDay = isBefore(startOfDay(date), today);
              const cutoffLocked = isPastThursdayCutoffForDate(date);

              const locked = !isOrderable || isPastDay || cutoffLocked;

              return (
                <div
                  key={dateStr}
                  className={[locked ? "opacity-70" : "", isHoliday ? "bg-rose-50" : ""].join(" ")}
                  title={
                    locked
                      ? isPastDay
                        ? "Past day"
                        : cutoffLocked
                        ? "Ordering closed (Thursday cutoff)"
                        : isHoliday
                        ? "School holiday"
                        : "Not in term"
                      : undefined
                  }
                >
                  <WeeklyDayCard
                    date={date}
                    className={["w-full", isHoliday ? "ring-1 ring-rose-200" : ""].join(" ")}
                    selections={selections}
                    mealGroups={mealGroups}
                    onSelect={makeSafeOnSelect(locked)}
                    onUpdateConfig={makeSafeOnUpdate(locked)}
                    onConfirmChoice={makeSafeOnConfirm(locked)}
                    onReplicate={(d, type) => handleReplicateGuarded(d, type)}
                    daysToCopy={daysToCopy[dateStr] ?? 3}
                    setDaysToCopy={(n) => setDaysToCopy((prev) => ({ ...prev, [dateStr]: n }))}
                    weeksToRepeat={weeksToRepeat[dateStr] ?? 3}
                    setWeeksToRepeat={(n) => setWeeksToRepeat((prev) => ({ ...prev, [dateStr]: n }))}
                    disabled={locked}
                  />
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => attemptNav(() => setCalendarMonth(addWeeks(calendarMonth, -4)))}>
              ← Prev Month
            </Button>
            <span className="font-medium">{format(calendarMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" onClick={() => attemptNav(() => setCalendarMonth(addWeeks(calendarMonth, 4)))}>
              Next Month →
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-1 border p-2 bg-white rounded-2xl shadow-sm">
            {weekdayLabels.map((d) => (
              <div key={d} className="text-xs font-semibold text-center pb-2">
                {d}
              </div>
            ))}

            {calendarDays.map((date) => {
              const isOverflow = date.getMonth() !== calendarMonth.getMonth();
              const isPastDay = isBefore(startOfDay(date), today);
              const dateStr = format(date, DATE_FMT);
              const isOrderable = orderableDays.has(dateStr);
              const isHoliday = holidayDays.has(dateStr);

              const daySelections = selections[dateStr] || {};
              const hasSelection = Object.values(daySelections).some((g) => (g?.choiceIds?.length ?? 0) > 0);
              const locked = isOverflow || isPastDay || !isOrderable;

              return (
                <div
                  key={dateStr}
                  className={[
                    "h-24 rounded flex flex-col items-start justify-between p-1 relative transition",
                    isOverflow ? "bg-gray-100 text-gray-400" : isHoliday ? "bg-rose-50 ring-1 ring-rose-200" : "bg-white",
                    !locked && hasSelection ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "",
                    locked && !isOverflow ? "opacity-60" : "",
                  ].join(" ")}
                  onClick={() => !locked && setModalDay(dateStr)}
                >
                  <span className="text-xs">{format(date, "d")}</span>

                  <div className="mt-auto mb-1 w-full sm:hidden">{hasSelection && <span className="inline-block h-2 w-2 rounded-full bg-green-500" />}</div>

                  <div className="hidden sm:flex flex-col gap-1 mt-auto mb-1 w-full">
                    {mealGroups.map((group) => {
                      const chosen = daySelections[group.id]?.choiceIds || [];
                      if (!chosen.length) return null;

                      const names = chosen
                        .map((id) => group.choices.find((c) => c.id === id)?.name)
                        .filter(Boolean)
                        .join(", ");

                      return (
                        <span
                          key={group.id}
                          className="inline-block rounded-full bg-gray-100 text-gray-800 border border-gray-200 px-2 py-0.5 text-xs font-semibold truncate w-full"
                        >
                          {group.name}: {names}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {modalDay && (
        <DayEditModal
          dateStr={modalDay}
          mealGroups={mealGroups}
          selections={selections as any}
          onSelect={(d, g, choices) => {
            if (!orderableDays.has(d)) return;
            handleSelect(d, g, choices);
          }}
          onUpdateConfig={(d, g, choiceId, extras) => {
            if (!orderableDays.has(d)) return;
            handleUpdateConfig(d, g, choiceId, extras);
          }}
          onClose={() => setModalDay(null)}
        />
      )}

      <AlertDialog open={guardOpen} onOpenChange={setGuardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete week orders</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes and the week is incomplete. Please complete the week’s orders or cancel your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                pendingNavRef.current = null;
              }}
            >
              Complete week
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                setSelections(deepClone(lastLoadedSelectionsRef.current));
                setDirty(false);
                setGuardOpen(false);

                const nav = pendingNavRef.current;
                pendingNavRef.current = null;
                nav?.();
              }}
            >
              Cancel changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}