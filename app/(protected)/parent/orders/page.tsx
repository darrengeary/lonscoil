// app/(protected)/parent/orders/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
} from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import WeeklyDayCard from "@/components/parent/WeeklyDayCard";
import DayEditModal from "@/components/parent/DayEditModal";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface Pupil { id: string; name: string; }
interface MealGroup {
  id: string;
  name: string;
  maxSelections: number;
  choices: { id: string; name: string }[];
}

// ---------- Constants & Helpers ----------
const DATE_FMT = "yyyy-MM-dd";
const ALT_FMT = "dd-MM-yyyy";
const daysInWeek = 5;
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];

async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
  fallback: T = [] as unknown as T
): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return fallback;
    const text = await res.text();
    if (!text) return fallback; // 204 or empty
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback; // HTML error or malformed JSON
    }
  } catch (e: any) {
    if (e?.name === "AbortError" || e?.code === "ABORT_ERR") return fallback;
    throw e;
  }
}

function normalizeDateString(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already yyyy-MM-dd
  const d1 = parse(s, ALT_FMT, new Date());
  if (isValid(d1)) return format(d1, DATE_FMT);
  const d2 = new Date(s);
  if (isValid(d2)) return format(d2, DATE_FMT);
  return s;
}

function safeAbort(controller?: AbortController, reason?: unknown) {
  try {
    if (controller && !controller.signal.aborted) {
      // @ts-ignore optional reason in modern runtimes
      controller.abort?.(reason);
    }
  } catch { /* ignore */ }
}

export default function PupilLunchOrdersPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loadingPupils, setLoadingPupils] = useState(false);
  const [selectedPupil, setSelectedPupil] = useState<string | null>(null);

  const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
  // selections[dateStr][groupId] = string[] of choiceIds
  const [selections, setSelections] = useState<Record<string, Record<string, string[]>>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  // replicate state
  const [daysToCopy, setDaysToCopy] = useState<Record<string, number>>({});
  const [weeksToRepeat, setWeeksToRepeat] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"weekly" | "calendar">("weekly");

  // ORDERABLE & HOLIDAY days from server (normalized to yyyy-MM-dd)
  const [orderableDays, setOrderableDays] = useState<Set<string>>(new Set());
  const [holidayDays, setHolidayDays] = useState<Set<string>>(new Set());

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
    const controller = new AbortController();
    fetchJSON<MealGroup[]>("/api/mealgroups", { signal: controller.signal }, [])
      .then(setMealGroups)
      .catch(() => setMealGroups([]));
    return () => safeAbort(controller, "cleanup:mealgroups");
  }, []);

  // ---------- Fetch ORDERABLE & HOLIDAY days ----------
  useEffect(() => {
    if (!selectedPupil) return;
    const controller = new AbortController();
    fetchJSON<{ orderable: string[]; holidays: string[] }>(
      `/api/orderable-days?pupilId=${encodeURIComponent(selectedPupil)}`,
      { signal: controller.signal },
      { orderable: [], holidays: [] }
    ).then((payload) => {
      const ord = new Set(payload.orderable.map(normalizeDateString));
      const hol = new Set(payload.holidays.map(normalizeDateString));
      setOrderableDays(ord);
      setHolidayDays(hol);
    });
    return () => safeAbort(controller, "cleanup:orderable");
  }, [selectedPupil]);

  // ---------- Fetch orders for visible range ----------
  useEffect(() => {
    if (!selectedPupil) return;
    if (mealGroups.length === 0) return; // wait until groups arrive

    let start: string, end: string;
    if (activeTab === "weekly") {
      start = format(weekStart, DATE_FMT);
      end = format(addDays(weekStart, 4), DATE_FMT);
    } else {
      const mStart = startOfMonth(calendarMonth);
      const mEnd = endOfMonth(calendarMonth);
      start = format(mStart, DATE_FMT);
      end = format(mEnd, DATE_FMT);
    }

    const controller = new AbortController();

    fetchJSON<Array<{ date: string; items: Array<{ choiceId: string }> }>>(
      `/api/lunch-orders?pupilId=${encodeURIComponent(selectedPupil)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { signal: controller.signal },
      []
    ).then((orders) => {
      const sel: typeof selections = {};
      orders.forEach((order) => {
        const dateStr = normalizeDateString(order.date);
        if (!sel[dateStr]) sel[dateStr] = {};
        order.items.forEach((it) => {
          const choiceId = it.choiceId;
          const group = mealGroups.find((g) => g.choices.some((c) => c.id === choiceId));
          if (!group) return;
          sel[dateStr][group.id] = sel[dateStr][group.id] || [];
          sel[dateStr][group.id].push(choiceId);
        });
      });
      setSelections(sel);
      setDirty(false);
    });

    return () => safeAbort(controller, "cleanup:orders");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPupil, weekStart, calendarMonth, mealGroups.length, activeTab]);

  function handleSelect(dateStr: string, groupId: string, newChoices: string[]) {
    setSelections((prev) => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [groupId]: newChoices,
      },
    }));
    setDirty(true);
  }

  // ---------- Replicate respecting ORDERABLE only ----------
  function handleReplicateGuarded(dateStr: string, type: "next-days" | "weekday-weeks") {
    const base = selections[dateStr];
    if (!base) return;

    if (type === "next-days") {
      const numDays = daysToCopy[dateStr] ?? 3;
      let added = 0;
      let d = parse(dateStr, DATE_FMT, new Date());
      const updates: Record<string, typeof base> = {};
      while (added < numDays) {
        d = addDays(d, 1);
        const f = format(d, DATE_FMT);
        if (!orderableDays.has(f)) continue;
        updates[f] = JSON.parse(JSON.stringify(base));
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
        updates[f] = JSON.parse(JSON.stringify(base));
      }
      if (Object.keys(updates).length) {
        setSelections((prev) => ({ ...prev, ...updates }));
        setDirty(true);
      }
      alert(`Repeated for ${Object.keys(updates).length} future orderable week(s)!`);
    }
  }

  // ---------- Save ----------
  async function handleSaveOrders(showToast = true) {
    if (!selectedPupil) return;
    setSaving(true);
    const todayStr = format(new Date(), DATE_FMT);

    const toSave = Object.entries(selections)
      .filter(([date]) => date >= todayStr && orderableDays.has(date))
      .map(([date, groups]) => ({
        date,
        items: Object.values(groups).flatMap((arr) => arr.map((id) => ({ choiceId: id }))),
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

  // Auto-save on in-app navigation (tab/week/month change)
  const prevTab = useRef(activeTab);
  const prevWeek = useRef(weekStart);
  const prevMonth = useRef(calendarMonth);
  useEffect(() => {
    if (!dirty) {
      prevTab.current = activeTab;
      prevWeek.current = weekStart;
      prevMonth.current = calendarMonth;
      return;
    }
    let nav = false;
    if (prevTab.current !== activeTab) nav = true;
    if (activeTab === "weekly" && prevWeek.current !== weekStart) nav = true;
    if (activeTab === "calendar" && prevMonth.current !== calendarMonth) nav = true;
    if (nav) void handleSaveOrders();
    prevTab.current = activeTab;
    prevWeek.current = weekStart;
    prevMonth.current = calendarMonth;
  }, [activeTab, weekStart, calendarMonth, dirty]);

  // ----- Weekly View -----
  const weekdays = useMemo(
    () => Array.from({ length: daysInWeek }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekISO = weekdays.map((d) => format(d, DATE_FMT));
  const weekOrderableCount = weekISO.filter((d) => orderableDays.has(d)).length;
  const weekHolidayCount = weekISO.filter((d) => holidayDays.has(d)).length;
  const showHolidayWeekBanner = weekOrderableCount === 0 && weekHolidayCount === daysInWeek;
  const showPartialHolidayBanner = weekHolidayCount > 0 && weekHolidayCount < daysInWeek;

  // ----- Calendar View -----
  const firstOfMonth = startOfMonth(calendarMonth);
  const lastOfMonth = endOfMonth(calendarMonth);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
  const gridEnd = addDays(startOfWeek(lastOfMonth, { weekStartsOn: 1 }), daysInWeek - 1);
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const calendarDays = allDays.filter((d) => getDay(d) !== 0 && getDay(d) !== 6);

  // Compare by day, not time
  const today = startOfDay(new Date());

  // Safe wrappers so WeeklyDayCard doesn't need to change
  const makeSafeOnSelect = (isLocked: boolean) => (d: string, g: string, choices: string[]) => {
    if (isLocked || !orderableDays.has(d)) return;
    handleSelect(d, g, choices);
  };
  const safeOnReplicate = (d: string, type: "next-days" | "weekday-weeks") =>
    handleReplicateGuarded(d, type);

  return (
    <div className="space-y-6">
      <DashboardHeader heading="Lunch Orders" text="Manage your pupils’ lunch orders." />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <select
          className="border px-3 py-2 rounded-lg text-base bg-white shadow-sm w-full sm:w-60"
          disabled={loadingPupils}
          value={selectedPupil || ""}
          onChange={(e) => setSelectedPupil(e.target.value)}
          aria-label="Select pupil"
        >
          {pupils.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="relative">
          <Button
            className="whitespace-nowrap"
            onClick={() => handleSaveOrders()}
            disabled={!dirty || saving || !selectedPupil}
            aria-disabled={!dirty || saving || !selectedPupil}
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
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => setWeekStart(addWeeks(weekStart, -1))}
              disabled={isBefore(addWeeks(weekStart, -1), startOfWeek(today, { weekStartsOn: 1 }))}
            >
              ← Previous Week
            </Button>
            <span className="font-medium text-lg">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 4), "MMM d")}
            </span>
            <Button variant="ghost" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              Next Week →
            </Button>
          </div>

          {/* Holiday-aware banners */}
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {weekdays.map((date) => {
              const dateStr = format(date, DATE_FMT);
              const isOrderable = orderableDays.has(dateStr);
              const isHoliday = holidayDays.has(dateStr);
              const isPast = isBefore(startOfDay(date), today);
              const locked = !isOrderable || isPast;
              const holidayClass = isHoliday ? "ring-1 ring-rose-200 bg-rose-50" : "";

              return (
                <div
                  key={dateStr}
                  className={`${locked ? "opacity-60 pointer-events-none select-none" : ""} ${holidayClass} rounded-xl`}
                  title={
                    locked
                      ? (isPast ? "Past day" : isHoliday ? "School holiday" : "Not in term")
                      : undefined
                  }
                >
                  <WeeklyDayCard
                    date={date}
                    selections={selections}
                    mealGroups={mealGroups}
                    onSelect={makeSafeOnSelect(locked)}
                    onReplicate={safeOnReplicate}
                    daysToCopy={daysToCopy[dateStr] ?? 3}
                    setDaysToCopy={(n) => setDaysToCopy((prev) => ({ ...prev, [dateStr]: n }))}
                    weeksToRepeat={weeksToRepeat[dateStr] ?? 3}
                    setWeeksToRepeat={(n) => setWeeksToRepeat((prev) => ({ ...prev, [dateStr]: n }))}
                  />
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setCalendarMonth(addWeeks(calendarMonth, -4))}>
              ← Prev Month
            </Button>
            <span className="font-medium">{format(calendarMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" onClick={() => setCalendarMonth(addWeeks(calendarMonth, 4))}>
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
              const isPast = isBefore(startOfDay(date), today);
              const dateStr = format(date, DATE_FMT);
              const isOrderable = orderableDays.has(dateStr);
              const isHoliday = holidayDays.has(dateStr);
              const daySelections = selections[dateStr] || {};
              const hasSelection = Object.values(daySelections).some((arr) => arr && arr.length);
              const locked = isOverflow || isPast || !isOrderable;

              return (
                <div
                  key={dateStr}
                  className={[
                    "h-24 rounded flex flex-col items-start justify-between p-1 relative transition",
                    isOverflow ? "bg-gray-100 text-gray-400" : isHoliday ? "bg-rose-50 ring-1 ring-rose-200" : "bg-white",
                    !locked && hasSelection ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "",
                    locked && !isOverflow ? "opacity-60 pointer-events-none" : "",
                  ].join(" ")}
                  style={{
                    opacity: isOverflow ? 0.7 : locked ? 0.8 : 1,
                    cursor: locked ? "default" : hasSelection ? "pointer" : "default",
                  }}
                  onClick={() => !locked && setModalDay(dateStr)}
                  title={
                    isOverflow
                      ? undefined
                      : isHoliday
                        ? "School holiday"
                        : locked
                          ? (isPast ? "Past day" : "Not in term")
                          : hasSelection
                            ? "Tap to view or edit order"
                            : undefined
                  }
                >
                  {/* Date number */}
                  <span className="text-xs">{format(date, "d")}</span>

                  {/* Mobile (xs) indicator: green dot when there is any order */}
                  <div className="mt-auto mb-1 w-full sm:hidden">
                    {hasSelection && (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-green-500"
                        aria-label="Order placed"
                        title="Order placed"
                      />
                    )}
                  </div>

                  {/* Desktop/tablet tags (hidden on small screens) */}
                  <div className="hidden sm:flex flex-col gap-1 mt-auto mb-1 w-full">
                    {mealGroups.map((group) => {
                      const chosen = daySelections[group.id] || [];
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
          selections={selections}
          onSelect={(d, g, choices) => {
            if (!orderableDays.has(d)) return;
            handleSelect(d, g, choices);
          }}
          onClose={() => setModalDay(null)}
        />
      )}
    </div>
  );
}
