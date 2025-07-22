"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isAfter,
  addDays,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const COLORS = {
  TERM: "bg-green-300",
  HOLIDAY: "bg-red-300",
  TERM_DOT: "bg-green-500",
  HOLIDAY_DOT: "bg-red-500",
};

function getCalendarDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter((d) => d.getDay() >= 1 && d.getDay() <= 5); // Mon-Fri only
}

export default function AdminSchedulesPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState<string>("all");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"calendar" | "list">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarDays = getCalendarDays(calendarMonth);

  // Modal for day details
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{ date: Date | null; events: any[] }>({ date: null, events: [] });

  // Fetch schools on mount
  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools([{ id: "all", name: "All Schools" }, ...data]));
  }, []);

  // Fetch schedules whenever schoolId changes
  useEffect(() => {
    setLoading(true);
    let url = "/api/schedule";
    if (schoolId && schoolId !== "all") url += `?schoolId=${schoolId}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => setSchedules(data.error ? [] : data))
      .finally(() => setLoading(false));
  }, [schoolId]);

// Map of dateString -> [events]
// For each day, only keep the highest-priority event (HOLIDAY > TERM) per school
const eventsByDate: { [date: string]: any[] } = {};
for (const s of schedules) {
  let d = new Date(s.startDate);
  const end = new Date(s.endDate);
  while (!isAfter(d, end)) {
    const key = format(d, "yyyy-MM-dd");
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(s);
    d = addDays(d, 1);
  }
}

function getFilteredEvents(events: any[]): any[] {
  const perSchool: { [schoolId: string]: any } = {};
  for (const ev of events) {
    if (!ev.school) continue;
    const id = ev.school.id;
    if (!perSchool[id] || ev.type === "HOLIDAY") {
      perSchool[id] = ev;
    }
  }
  return Object.values(perSchool);
}


  function openDayModal(date: Date) {
    const key = format(date, "yyyy-MM-dd");
    setModalData({ date, events: eventsByDate[key] || [] });
    setModalOpen(true);
  }

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }
  if (!userRole || userRole !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <span className="text-lg font-bold text-destructive">Unauthorized</span>
        <span className="text-muted-foreground mt-2">You do not have permission to view this page.</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-8">
      <DashboardHeader
        heading="School Schedules"
        text="View all school schedules visually or in a list. Select a school to filter, or view all."
      />
      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger className="w-64 bg-[#fff]">
              <SelectValue placeholder="Select School" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
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
            {/* Legend */}
            <div className="flex items-center gap-4 mb-3">
              <span className="inline-flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1" />
                <span className="text-xs">Term</span>
              </span>
              <span className="inline-flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" />
                <span className="text-xs">Holiday</span>
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 border p-2 bg-white">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-xs font-semibold text-center pb-2">
                  {d}
                </div>
              ))}
{calendarDays.map((date) => {
  const outOfMonth = !isSameMonth(date, calendarMonth);
  const key = format(date, "yyyy-MM-dd");
  const filteredEvents = getFilteredEvents(eventsByDate[key] || []);
  return (
    <div
      key={date.toISOString()}
      className={[
        "h-16 rounded flex flex-col items-start justify-between p-1 relative transition",
        outOfMonth ? "bg-gray-100 text-gray-400" : "bg-white",
        filteredEvents.length ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "",
      ].join(" ")}
      style={{
        opacity: outOfMonth ? 0.7 : 1,
      }}
      onClick={() => filteredEvents.length && openDayModal(date)}
      title={
        filteredEvents.length
          ? filteredEvents.map(e => `${e.school?.name}: ${e.type}`).join("\n")
          : undefined
      }
    >
      <span className="text-xs">{format(date, "d")}</span>
      {/* One dot per school (color by event type) */}
    <div className="flex flex-row gap-[2px] mt-auto mb-1 flex-wrap">
      {filteredEvents.map((e, idx) => (
        <span
          key={e.school?.id ?? idx}
          className={[
            "w-2.5 h-2.5 rounded-full border border-white",
            e.type === "HOLIDAY" ? "bg-red-500" : "bg-green-500",
          ].join(" ")}
          title={e.school?.name + ": " + (e.type === "HOLIDAY" ? "Holiday" : "Term")}
        />
      ))}
    </div>

    </div>
  );
})}


            </div>
          </Card>
          {/* Modal for details */}
<Dialog open={modalOpen} onOpenChange={setModalOpen}>
  <DialogContent className="bg-white shadow-xl rounded-2xl">
    <DialogHeader>
      <DialogTitle>
        {modalData.date ? format(modalData.date, "EEEE, d MMMM yyyy") : ""}
      </DialogTitle>
    </DialogHeader>
    <div>
      {getFilteredEvents(modalData.events).length === 0 && (
        <div className="text-sm text-muted-foreground">
          No events for this day.
        </div>
      )}
      {getFilteredEvents(modalData.events).length > 0 && (
        <div className="space-y-4">
          {getFilteredEvents(modalData.events)
            .sort((a, b) => (a.school?.name || "").localeCompare(b.school?.name || ""))
            .map((e) => (
              <div
                key={e.id}
                className="border-l-4 pl-2"
                style={{
                  borderColor: e.type === "HOLIDAY" ? "#ef4444" : "#22c55e",
                }}
              >
                <div className="font-semibold">{e.school?.name}</div>
                <div className="text-xs mb-1">
                  <span
                    className={
                      "inline-block px-2 py-0.5 rounded-full font-bold text-[11px] mr-1 " +
                      (e.type === "HOLIDAY"
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-700")
                    }
                  >
                    {e.type === "HOLIDAY" ? "Holiday" : "Term"}
                  </span>
                  <span>{e.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(e.startDate), "d MMM yyyy")} –{" "}
                  {format(new Date(e.endDate), "d MMM yyyy")}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>

        </TabsContent>
        {/* ---- LIST TAB ---- */}
        <TabsContent value="list">
          {/* Mobile Card/List */}
          <div className="block md:hidden space-y-3 mt-2">
            {schedules.map((sch) => (
              <div
                key={sch.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#27364B]">{sch.school?.name ?? "-"}</span>
                  <span
                    className={
                      "inline-block px-3 py-1 rounded-full font-bold text-xs " +
                      (sch.type === "HOLIDAY"
                        ? "bg-[#FFE6E6] text-[#DC2626]"
                        : "bg-[#E7F8F0] text-[#16A34A]")
                    }
                  >
                    {sch.name}
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
                  <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl">School</th>
                  <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B]">Type</th>
                  <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl">Dates</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sch) => (
                  <tr key={sch.id} className="transition-colors hover:bg-[#E7F1FA] focus-within:bg-[#E7F8F0] bg-white">
                    <td className="py-3 px-4 text-[#27364B] font-medium">{sch.school?.name ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          "inline-block px-3 py-1 rounded-full font-bold text-xs " +
                          (sch.type === "HOLIDAY"
                            ? "bg-[#FFE6E6] text-[#DC2626]"
                            : "bg-[#E7F8F0] text-[#16A34A]")
                        }
                      >
                        {sch.name}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
