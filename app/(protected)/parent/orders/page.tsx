"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, addWeeks, isBefore, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { Button } from "@/components/ui/button";
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

const daysInWeek = 5;
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function PupilLunchOrdersPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loadingPupils, setLoadingPupils] = useState(false);
  const [selectedPupil, setSelectedPupil] = useState<string | null>(null);

  const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
  const [selections, setSelections] = useState<Record<string, Record<string, string[]>>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Per-card replicate state
  const [daysToCopy, setDaysToCopy] = useState<Record<string, number>>({});
  const [weeksToRepeat, setWeeksToRepeat] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("weekly");

  // Fetch pupils for dropdown
  useEffect(() => {
    setLoadingPupils(true);
    fetch("/api/pupils?parent=true")
      .then(res => res.json())
      .then((data: Pupil[]) => {
        setPupils(data);
        if (data.length) setSelectedPupil(data[0].id);
      })
      .finally(() => setLoadingPupils(false));
  }, []);

  // Fetch meal groups (once)
  useEffect(() => {
    fetch("/api/mealgroups")
      .then(r => r.json())
      .then(setMealGroups)
      .catch(() => setMealGroups([]));
  }, []);

  // Fetch orders for visible range
  useEffect(() => {
    if (!selectedPupil) return;
    let start, end;
    if (activeTab === "weekly") {
      start = format(weekStart, "yyyy-MM-dd");
      end = format(addDays(weekStart, 4), "yyyy-MM-dd");
    } else {
      // For calendar, fetch whole month + buffer
      const prevMonth = startOfMonth(calendarMonth);
      const nextMonth = endOfMonth(calendarMonth);
      start = format(prevMonth, "yyyy-MM-dd");
      end = format(nextMonth, "yyyy-MM-dd");
    }
    fetch(`/api/lunch-orders?pupilId=${selectedPupil}&start=${start}&end=${end}`)
      .then(r => r.json())
      .then((orders: any[]) => {
        const sel: typeof selections = {};
        orders.forEach(order => {
          const dateStr = format(new Date(order.date), "yyyy-MM-dd");
          sel[dateStr] = {};
          order.items.forEach((it: any) => {
            const choiceId = it.choiceId;
            const group = mealGroups.find(g => g.choices.some(c => c.id === choiceId));
            if (!group) return;
            sel[dateStr][group.id] = sel[dateStr][group.id] || [];
            sel[dateStr][group.id].push(choiceId);
          });
        });
        setSelections(sel);
        setDirty(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPupil, weekStart, calendarMonth, mealGroups.length, activeTab]);

  function handleSelect(dateStr: string, groupId: string, newChoices: string[]) {
    setSelections(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [groupId]: newChoices,
      },
    }));
    setDirty(true);
  }

  async function handleSaveOrders() {
    if (!selectedPupil) return;
    setSaving(true);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const toSave = Object.entries(selections)
      .filter(([date]) => date >= todayStr)
      .map(([date, groups]) => ({
        date,
        items: Object.values(groups).flatMap(arr => arr.map(id => ({ choiceId: id })))
      }));
    const res = await fetch("/api/lunch-orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: selectedPupil, orders: toSave }),
    });
    if (!res.ok) {
      alert("Failed to save: " + (await res.text()));
    } else {
      alert("Saved!");
      setDirty(false);
    }
    setSaving(false);
  }

  // Replicate logic
  function handleReplicate(dateStr: string, type: string) {
    const base = selections[dateStr];
    const baseDate = new Date(dateStr);
    if (!base) return;
    if (type === "next-days") {
      const numDays = daysToCopy[dateStr] ?? 3;
      let added = 0;
      let d = baseDate;
      const updates: Record<string, typeof base> = {};
      while (added < numDays) {
        d = addDays(d, 1);
        if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
        const f = format(d, "yyyy-MM-dd");
        updates[f] = JSON.parse(JSON.stringify(base));
        added++;
      }
      setSelections(prev => {
        const merged = { ...prev, ...updates };
        setDirty(true);
        return merged;
      });
      alert(`Copied to next ${numDays} school day(s)!`);
    }

    if (type === "weekday-weeks") {
      const numWeeks = weeksToRepeat[dateStr] ?? 3;
      const dow = baseDate.getDay();
      let d = baseDate;
      const updates: Record<string, typeof base> = {};
      for (let i = 1; i <= numWeeks; ++i) {
        d = addDays(baseDate, i * 7);
        if (d.getDay() !== dow) continue;
        const f = format(d, "yyyy-MM-dd");
        updates[f] = JSON.parse(JSON.stringify(base));
      }
      setSelections(prev => {
        const merged = { ...prev, ...updates };
        setDirty(true);
        return merged;
      });
      alert(`Repeated for ${numWeeks} future week(s)!`);
    }
  }

  // ----- Weekly View -----
  const weekdays = Array.from({ length: daysInWeek }, (_, i) => addDays(weekStart, i));
  // ----- Calendar View -----
  const firstOfMonth = startOfMonth(calendarMonth);
  const lastOfMonth = endOfMonth(calendarMonth);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
  const gridEnd = addDays(startOfWeek(lastOfMonth, { weekStartsOn: 1 }), daysInWeek - 1);
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const calendarDays = allDays.filter(d => getDay(d) !== 0 && getDay(d) !== 6);

  const today = new Date();

  return (
    <div className="space-y-6">
      <DashboardHeader heading="Lunch Orders" text="Manage your pupils lunch orders." />
      <div className="flex flex-row items-center gap-3 mb-6">
        <select
          className="border px-3 py-2 rounded-lg text-base bg-white shadow-sm w-60 max-w-full"
          disabled={loadingPupils}
          value={selectedPupil || ""}
          onChange={e => setSelectedPupil(e.target.value)}
          style={{ minWidth: 180 }}
        >
          {pupils.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Button
          className="whitespace-nowrap"
          onClick={handleSaveOrders}
          disabled={!dirty || saving || !selectedPupil}
        >
          {saving ? "Saving…" : "Save Orders"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
            <Button
              variant="ghost"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            >
              Next Week →
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {weekdays.map(date => {
              const dateStr = format(date, "yyyy-MM-dd");
              return (
                <WeeklyDayCard
                  key={dateStr}
                  date={date}
                  selections={selections}
                  mealGroups={mealGroups}
                  onSelect={handleSelect}
                  onReplicate={handleReplicate}
                  daysToCopy={daysToCopy[dateStr] ?? 3}
                  setDaysToCopy={n =>
                    setDaysToCopy(prev => ({ ...prev, [dateStr]: n }))
                  }
                  weeksToRepeat={weeksToRepeat[dateStr] ?? 3}
                  setWeeksToRepeat={n =>
                    setWeeksToRepeat(prev => ({ ...prev, [dateStr]: n }))
                  }
                />
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="calendar">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setCalendarMonth(addWeeks(calendarMonth, -4))}
            >
              ← Prev Month
            </Button>
            <span className="font-medium">{format(calendarMonth, "MMMM yyyy")}</span>
            <Button
              variant="ghost"
              onClick={() => setCalendarMonth(addWeeks(calendarMonth, 4))}
            >
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
              const isPast = isBefore(date, today);
              const dateStr = format(date, "yyyy-MM-dd");
              const daySelections = selections[dateStr] || {};
              const hasSelection = Object.values(daySelections).some((arr) => arr && arr.length);
              return (
                <div
                  key={dateStr}
                  className={[
                    "h-24 rounded flex flex-col items-start justify-between p-1 relative transition",
                    isOverflow ? "bg-gray-100 text-gray-400" : "bg-white",
                    hasSelection && !isOverflow ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "",
                    isPast && !isOverflow ? "opacity-60 pointer-events-none" : "",
                  ].join(" ")}
                  style={{
                    opacity: isOverflow ? 0.7 : isPast ? 0.7 : 1,
                    cursor: isOverflow || isPast ? "default" : hasSelection ? "pointer" : "default",
                  }}
                  onClick={() =>
                    !isOverflow && !isPast && setModalDay(dateStr)
                  }
                  title={
                    hasSelection
                      ? mealGroups
                          .map((group) => {
                            const chosen = daySelections[group.id] || [];
                            if (!chosen.length) return null;
                            const names = chosen
                              .map((id) =>
                                group.choices.find((c) => c.id === id)?.name
                              )
                              .filter(Boolean)
                              .join(", ");
                            return `${group.name}: ${names}`;
                          })
                          .filter(Boolean)
                          .join("\n")
                      : undefined
                  }
                >
                  <span className="text-xs">{format(date, "d")}</span>
                  <div className="flex flex-col gap-1 mt-auto mb-1 w-full">
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
          onSelect={handleSelect}
          onClose={() => setModalDay(null)}
        />
      )}
    </div>
  );
}
