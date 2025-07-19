"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  getDay,
  isBefore,
  isSameDay,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import WeeklyDayCard from "@/components/parent/WeeklyDayCard";
import DayEditModal from "@/components/parent/DayEditModal";

const daysInWeek = 5;

export default function PupilLunchOrdersPage() {
  const { id: pupilId } = useParams();
  const [pupilName] = useState("John");
  const [classroomName] = useState("Room A");
  const [mealGroups, setMealGroups] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, Record<string, string[]>>>({});
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState("weekly");
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [daysToCopy, setDaysToCopy] = useState(4);
  const [weeksToRepeat, setWeeksToRepeat] = useState(3);

  const today = new Date();
  const weekdays = Array.from({ length: daysInWeek }, (_, i) =>
    addDays(weekStart, i)
  );
  const allCalendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
    end: endOfMonth(calendarMonth),
  });
  const calendarDays = allCalendarDays.filter(
    (date) =>
      getDay(date) !== 0 &&
      getDay(date) !== 6 &&
      !isBefore(date, today)
  );

  useEffect(() => {
    setMealGroups([
      {
        id: "sandwich",
        name: "Sandwich",
        maxSelections: 1,
        choices: [
          { id: "ham", name: "Ham & Cheese" },
          { id: "turkey", name: "Turkey" },
        ],
      },
      {
        id: "drink",
        name: "Drink",
        maxSelections: 1,
        choices: [
          { id: "milk", name: "Milk" },
          { id: "water", name: "Water" },
        ],
      },
    ]);
  }, []);

  function handleSelect(
    dateStr: string,
    groupId: string,
    choiceId: string
  ) {
    setSelections((prev) => {
      const current = prev[dateStr]?.[groupId] || [];
      const group = mealGroups.find((g) => g.id === groupId);
      const max = group?.maxSelections || 1;
      const newChoices = current.includes(choiceId)
        ? current.filter((id) => id !== choiceId)
        : current.length < max
        ? [...current, choiceId]
        : current;
      return {
        ...prev,
        [dateStr]: {
          ...prev[dateStr],
          [groupId]: newChoices,
        },
      };
    });
  }

  function replicateOrder(
    dateStr: string,
    type: "next-days" | "weekday-weeks"
  ) {
    if (!selections[dateStr]) {
      toast({ title: "Please select a meal first to copy." });
      return;
    }
    const base = new Date(dateStr);
    const newSelections = { ...selections };

    if (type === "next-days") {
      let copied = 0;
      let i = 1;
      while (copied < daysToCopy) {
        const next = addDays(base, i);
        if (
          getDay(next) !== 0 &&
          getDay(next) !== 6 &&
          !isBefore(next, today)
        ) {
          newSelections[format(next, "yyyy-MM-dd")] = {
            ...selections[dateStr],
          };
          copied++;
        }
        i++;
      }
    } else {
      for (let i = 1; i <= weeksToRepeat; i++) {
        const next = addDays(base, i * 7);
        if (!isBefore(next, today)) {
          newSelections[format(next, "yyyy-MM-dd")] = {
            ...selections[dateStr],
          };
        }
      }
    }

    setSelections(newSelections);
    toast({ title: `Copied ${format(base, "EEEE")}’s order` });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Manage {pupilName}’s Orders – {classroomName}
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              disabled={isBefore(addDays(weekStart, -7), today)}
            >
              ← Previous Week
            </Button>
            <span className="font-medium">
              {format(weekStart, "MMM d")} –{" "}
              {format(addDays(weekStart, 4), "MMM d")}
            </span>
            <Button
              variant="ghost"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Next Week →
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {weekdays.map((date) => (
              <WeeklyDayCard
                key={date.toISOString()}
                date={date}
                selections={selections}
                mealGroups={mealGroups}
                onSelect={handleSelect}
                onReplicate={replicateOrder}
                daysToCopy={daysToCopy}
                weeksToRepeat={weeksToRepeat}
                setDaysToCopy={setDaysToCopy}
                setWeeksToRepeat={setWeeksToRepeat}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setCalendarMonth(addDays(calendarMonth, -30))}
              disabled={isBefore(addDays(calendarMonth, -30), startOfMonth(today))}
            >
              ← Prev Month
            </Button>
            <span className="font-medium">
              {format(calendarMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              onClick={() => setCalendarMonth(addDays(calendarMonth, 30))}
            >
              Next Month →
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2 overflow-x-auto">
            {calendarDays.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const selection = selections[dateStr];
              return (
                <Button
                  key={dateStr}
                  variant="ghost"
                  className={`text-left h-24 w-full p-2 rounded-md ${
                    isSameDay(date, today) ? "border border-primary" : ""
                  }`}
                  onClick={() => setModalDay(dateStr)}
                >
                  <div className="text-xs font-medium mb-1">
                    {format(date, "EEE d")}
                  </div>
                  {selection ? (
                    <ul className="text-xs space-y-1">
                      {Object.entries(selection).map(([g, c]) => (
                        <li key={g}>
                          {g}: {c.join(", ")}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">
                      No order yet
                    </span>
                  )}
                </Button>
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
          onClose={() => setModalDay(null)}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
