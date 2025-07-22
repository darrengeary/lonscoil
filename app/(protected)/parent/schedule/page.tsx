"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Loader } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const COLORS = {
  TERM: "bg-green-300",
  HOLIDAY: "bg-red-300",
};

function getCalendarDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter((d) => d.getDay() >= 1 && d.getDay() <= 5);
}
function isDateWithin(date: Date, start: Date, end: Date) {
  return (
    isSameDay(date, start) ||
    isSameDay(date, end) ||
    (isAfter(date, start) && isBefore(date, end))
  );
}

export default function UserSchedulesPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const schoolId = session?.user?.schoolId as string | undefined;
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"calendar" | "list">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarDays = getCalendarDays(calendarMonth);

  // Fetch schedules for this user's school only
  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    fetch(`/api/schedule?schoolId=${schoolId}`)
      .then(res => res.json())
      .then(data => setSchedules(data.error ? [] : data))
      .finally(() => setLoading(false));
  }, [schoolId]);

  function getScheduleForDay(date: Date) {
    const holiday = schedules.find(
      (s) =>
        s.type === "HOLIDAY" &&
        isDateWithin(date, new Date(s.startDate), new Date(s.endDate))
    );
    if (holiday) return { ...holiday, color: COLORS["HOLIDAY"] };

    const term = schedules.find(
      (s) =>
        s.type === "TERM" &&
        isDateWithin(date, new Date(s.startDate), new Date(s.endDate))
    );
    if (term) return { ...term, color: COLORS["TERM"] };

    return null;
  }

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }
  if (!userRole || userRole !== "USER" || !schoolId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <span className="text-lg font-bold text-destructive">Unauthorized</span>
        <span className="text-muted-foreground mt-2">
          You do not have permission to view this page.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-8">
      <DashboardHeader
        heading="School Schedules"
        text="View your school’s schedule."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "calendar" | "list")}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>
        {/* ---- CALENDAR TAB ---- */}
        <TabsContent value="calendar">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
              >
                ← Prev
              </Button>
              <span className="font-medium">
                {format(calendarMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              >
                Next →
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-1 border p-2 bg-white">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-xs font-semibold text-center pb-2"
                >
                  {d}
                </div>
              ))}
              {calendarDays.map((date) => {
                const outOfMonth = !isSameMonth(date, calendarMonth);
                const schedule = getScheduleForDay(date);

                let label = "";
                if (schedule) {
                  const start = new Date(schedule.startDate);
                  const end = new Date(schedule.endDate);
                  if (isSameDay(date, start) || isSameDay(date, end))
                    label = schedule.name;
                }

                return (
                  <div
                    key={date.toISOString()}
                    className={[
                      "h-16 rounded flex flex-col items-start justify-between p-1 relative transition",
                      outOfMonth ? "bg-gray-100 text-gray-400" : "",
                      schedule ? schedule.color : "",
                    ].join(" ")}
                    style={{
                      opacity: outOfMonth ? 0.7 : 1,
                      cursor: "default",
                    }}
                  >
                    <span className="text-xs">{format(date, "d")}</span>
                    {label && (
                      <span className="absolute bottom-1 left-1 right-1 bg-white/80 text-xs text-center font-bold rounded">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
        {/* ---- LIST TAB ---- */}
        <TabsContent value="list">
          {loading ? (
            <Card className="p-0 border-muted">
              <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                <Loader className="w-7 h-7 animate-spin" />
                <div className="font-medium">Loading schedules…</div>
              </div>
            </Card>
          ) : schedules.length === 0 ? (
            <Card className="p-0 border-muted">
              <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
                <div className="text-lg font-semibold">No schedules found</div>
              </div>
            </Card>
          ) : (
            <>
              {/* Mobile Card/List */}
              <div className="block md:hidden space-y-3 mt-2">
                {schedules.map((sch) => (
                  <div
                    key={sch.id}
                    className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#27364B]">{sch.name}</span>
                      <span
                        className={
                          "inline-block px-3 py-1 rounded-full font-bold text-xs " +
                          (sch.type === "HOLIDAY"
                            ? "bg-[#FFE6E6] text-[#DC2626]"
                            : "bg-[#E7F8F0] text-[#16A34A]")
                        }
                      >
                        {sch.type === "HOLIDAY" ? "Holiday" : "Term"}
                      </span>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <span className="inline-block px-4 py-1 rounded-full bg-[#F4F7FA] text-[#27364B] text-xs font-semibold">
                        {format(new Date(sch.startDate), "EEE d MMM")} – {format(new Date(sch.endDate), "EEE d MMM")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-2xl shadow-sm bg-white">
                <table className="min-w-[400px] w-full text-sm text-left rounded-2xl overflow-hidden">
                  <thead>
                    <tr className="bg-[#F4F7FA]">
                      <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl">Name</th>
                      <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B]">Type</th>
                      <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl">Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((sch) => (
                      <tr key={sch.id} className="transition-colors hover:bg-[#E7F1FA] focus-within:bg-[#E7F8F0] bg-white">
                        <td className="py-3 px-4 text-[#27364B] font-medium">{sch.name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={
                              "inline-block px-3 py-1 rounded-full font-bold text-xs " +
                              (sch.type === "HOLIDAY"
                                ? "bg-[#FFE6E6] text-[#DC2626]"
                                : "bg-[#E7F8F0] text-[#16A34A]")
                            }
                          >
                            {sch.type === "HOLIDAY" ? "Holiday" : "Term"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-block px-4 py-1 rounded-full bg-[#F4F7FA] text-[#27364B] text-xs font-semibold">
                            {format(new Date(sch.startDate), "EEE d MMM")} – {format(new Date(sch.endDate), "EEE d MMM")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
