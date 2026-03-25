"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
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
  startOfDay,
  endOfDay,
  parseISO,
  isBefore,
  isAfter,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader } from "lucide-react";

type ScheduleType = "TERM" | "HOLIDAY";

type Schedule = {
  id: string;
  name: string;
  type: ScheduleType;
  startDate: string; // ISO from API
  endDate: string; // ISO from API
  schoolId: string;
  school?: { id: string; name: string };
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function normalizeMonth(d: Date) {
  const m = startOfMonth(d);
  // keep stable vs DST weirdness
  m.setHours(12, 0, 0, 0);
  return m;
}

function getCalendarDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter((d) => d.getDay() >= 1 && d.getDay() <= 5);
}

/**
 * Treat schedules as date-only ranges (local).
 * This avoids off-by-one caused by UTC midnight parsing.
 */
function inScheduleRange(day: Date, startIso: string, endIso: string) {
  const dayLocal = startOfDay(day);
  const startLocal = startOfDay(parseISO(startIso));
  const endLocal = endOfDay(parseISO(endIso));
  return !isBefore(dayLocal, startLocal) && !isAfter(dayLocal, endLocal);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!text) throw new Error(`Empty response from ${url} (status ${res.status})`);
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${url} (status ${res.status})`);
  }
  if (!res.ok) throw new Error(data?.error || `Request failed ${res.status}`);
  return data as T;
}

export default function ParentSchedulesPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const schoolId = session?.user?.schoolId as string | undefined;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"calendar" | "list">("calendar");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => normalizeMonth(new Date()));

  const viewMonth = useMemo(() => normalizeMonth(calendarMonth), [calendarMonth]);
  const calendarDays = useMemo(() => getCalendarDays(viewMonth), [viewMonth]);

  useEffect(() => {
    if (!schoolId) return;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson<Schedule[]>("/api/schedule");
        setSchedules(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  /**
   * Color rule:
   * - Holiday => red
   * - Inside any TERM => green
   * - Outside TERM => red
   */
  function getScheduleForDay(date: Date) {
    const holiday = schedules.find(
      (s) => s.type === "HOLIDAY" && inScheduleRange(date, s.startDate, s.endDate)
    );

    const term = schedules.find(
      (s) => s.type === "TERM" && inScheduleRange(date, s.startDate, s.endDate)
    );

    if (holiday) return { kind: "HOLIDAY" as const, schedule: holiday, color: "bg-red-300" };
    if (term) return { kind: "TERM" as const, schedule: term, color: "bg-green-300" };

    // Outside term
    return { kind: "OUTSIDE_TERM" as const, schedule: null, color: "bg-red-200" };
  }

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }

  const allowed = userRole === "USER";
  if (!allowed) {
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
      <DashboardHeader heading="School Schedules" text="View your school’s schedule." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "calendar" | "list")}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                onClick={() => setCalendarMonth((m) => normalizeMonth(addMonths(m, -1)))}
              >
                ← Prev
              </Button>
              <span className="font-medium">{format(viewMonth, "MMMM yyyy")}</span>
              <Button
                variant="ghost"
                onClick={() => setCalendarMonth((m) => normalizeMonth(addMonths(m, 1)))}
              >
                Next →
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-1 border p-2 bg-white">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-xs font-semibold text-center pb-2">
                  {d}
                </div>
              ))}
{calendarDays.map((date) => {
  const outOfMonth = !isSameMonth(date, viewMonth);
  const info = getScheduleForDay(date);

  let label = "";
  if (info.kind === "HOLIDAY" && info.schedule) {
    const start = parseISO(info.schedule.startDate);
    if (isSameDay(date, start)) label = info.schedule.name;
  }

  return (
    <div
      key={format(date, "yyyy-MM-dd")}
      className={[
        "h-16 rounded flex flex-col items-start justify-between p-1 relative transition",
        info.color, // ✅ background
        outOfMonth ? "text-gray-500" : "text-gray-900",
      ].join(" ")}
      style={{ opacity: outOfMonth ? 0.65 : 1 }}
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

            {/* Optional legend */}
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-green-300 border" />
                In term
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-red-300 border" />
                Holiday / closed
              </div>
            </div>
          </Card>
        </TabsContent>

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
            <div className="hidden md:block overflow-x-auto rounded-2xl shadow-sm bg-white">
              <table className="min-w-[400px] w-full text-sm text-left rounded-2xl overflow-hidden">
                <thead>
                  <tr className="bg-[#F4F7FA]">
                    <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl">
                      Name
                    </th>
                    <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B]">
                      Type
                    </th>
                    <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl">
                      Dates
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((sch) => (
                    <tr key={sch.id} className="transition-colors hover:bg-[#E7F1FA] bg-white">
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
                          {format(new Date(sch.startDate), "EEE d MMM")} –{" "}
                          {format(new Date(sch.endDate), "EEE d MMM")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}