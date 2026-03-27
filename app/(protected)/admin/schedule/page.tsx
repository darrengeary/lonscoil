"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type ScheduleType = "TERM" | "HOLIDAY" | "HALF_DAY";

type School = { id: string; name: string };

type Schedule = {
  id: string;
  name: string;
  type: ScheduleType;
  startDate: string;
  endDate: string;
  schoolId: string;
  school?: { id: string; name: string };
};

type ScheduleForm = {
  id?: string;
  name: string;
  type: ScheduleType;
  startDate: string;
  endDate: string;
};

function getCalendarDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start, end });
  return allDays.filter((d) => d.getDay() >= 1 && d.getDay() <= 5);
}

function getPriority(type: ScheduleType) {
  switch (type) {
    case "HOLIDAY":
      return 3;
    case "HALF_DAY":
      return 2;
    case "TERM":
    default:
      return 1;
  }
}

function getScheduleLabel(type: ScheduleType) {
  switch (type) {
    case "HOLIDAY":
      return "Holiday";
    case "HALF_DAY":
      return "Half Day";
    case "TERM":
    default:
      return "Term";
  }
}

function getScheduleBadgeClass(type: ScheduleType) {
  switch (type) {
    case "HOLIDAY":
      return "bg-[#FFE6E6] text-[#DC2626]";
    case "HALF_DAY":
      return "bg-amber-100 text-amber-700";
    case "TERM":
    default:
      return "bg-[#E7F8F0] text-[#16A34A]";
  }
}

function getScheduleBorderColor(type: ScheduleType) {
  switch (type) {
    case "HOLIDAY":
      return "#ef4444";
    case "HALF_DAY":
      return "#f59e0b";
    case "TERM":
    default:
      return "#22c55e";
  }
}

function ScheduleDot({
  type,
  size = "small",
}: {
  type: ScheduleType;
  size?: "small" | "medium";
}) {
  const dotClass = size === "medium" ? "w-3 h-3" : "w-2.5 h-2.5";

  if (type === "HALF_DAY") {
    return (
      <span
        className={`inline-block ${dotClass} rounded-full border border-white overflow-hidden`}
      >
        <span className="flex w-full h-full">
          <span className="w-1/2 h-full bg-green-500" />
          <span className="w-1/2 h-full bg-red-500" />
        </span>
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-block rounded-full border border-white",
        dotClass,
        type === "HOLIDAY" ? "bg-red-500" : "bg-green-500",
      ].join(" ")}
    />
  );
}

export default function AdminSchedulesPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>("all");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<"calendar" | "list">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalData, setDayModalData] = useState<{ date: Date | null; events: Schedule[] }>({
    date: null,
    events: [],
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleForm | null>(null);

  const canWrite = schoolId !== "all";

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data: School[]) => setSchools([{ id: "all", name: "All Schools" }, ...(data ?? [])]))
      .catch(() => setSchools([{ id: "all", name: "All Schools" }]));
  }, []);

  async function refreshSchedules(currentSchoolId = schoolId) {
    setLoading(true);
    try {
      let url = "/api/schedule";
      if (currentSchoolId && currentSchoolId !== "all") url += `?schoolId=${currentSchoolId}`;
      const data = await fetch(url).then((r) => r.json());
      setSchedules(data?.error ? [] : (data as Schedule[]));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const eventsByDate: Record<string, Schedule[]> = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    for (const s of schedules) {
      let d = new Date(s.startDate);
      const end = new Date(s.endDate);
      while (!isAfter(d, end)) {
        const key = format(d, "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(s);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [schedules]);

  function getFilteredEvents(events: Schedule[]): Schedule[] {
    const perSchool: Record<string, Schedule> = {};

    for (const ev of events) {
      const sid = ev.school?.id ?? ev.schoolId;
      if (!sid) continue;

      if (!perSchool[sid] || getPriority(ev.type) > getPriority(perSchool[sid].type)) {
        perSchool[sid] = ev;
      }
    }

    return Object.values(perSchool);
  }

  function openDayModal(date: Date) {
    const key = format(date, "yyyy-MM-dd");
    setDayModalData({ date, events: eventsByDate[key] || [] });
    setDayModalOpen(true);
  }

  function openCreate(defaultDate?: Date) {
    if (!canWrite) return;
    const d = defaultDate ?? new Date();
    const day = format(d, "yyyy-MM-dd");
    setEditing({ name: "", type: "TERM", startDate: day, endDate: day });
    setEditOpen(true);
  }

  function openEditFromEvent(e: Schedule) {
    if (!canWrite) return;
    setEditing({
      id: e.id,
      name: e.name ?? "",
      type: e.type,
      startDate: format(new Date(e.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(e.endDate), "yyyy-MM-dd"),
    });
    setEditOpen(true);
  }

  async function saveSchedule(form: ScheduleForm) {
    if (!canWrite) return;

    const url = form.id ? "/api/schedule" : `/api/schedule?schoolId=${schoolId}`;
    const method = form.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
      }),
    }).then((r) => r.json());

    if (res?.error) {
      alert(res.error);
      return;
    }

    setEditOpen(false);
    setEditing(null);
    await refreshSchedules();
  }

  async function deleteSchedule(id: string) {
    if (!canWrite) return;
    if (!confirm("Delete this schedule?")) return;

    const res = await fetch("/api/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());

    if (res?.error) {
      alert(res.error);
      return;
    }

    await refreshSchedules();
    if (dayModalOpen && dayModalData.date) openDayModal(dayModalData.date);
  }

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }

  if (!userRole || userRole !== "ADMIN") {
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
    <div className="space-y-8 md:px-4 md:py-8">
      <DashboardHeader
        heading="School Schedules"
        text="View all school schedules visually or in a list. Select a school to filter, or view all. Editing is enabled only when a specific school is selected."
      />

      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger className="w-64 bg-white">
              <SelectValue placeholder="Select School" />
            </SelectTrigger>
            <SelectContent>
              {schools.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => openCreate()} disabled={!canWrite}>
            + New Period
          </Button>
          {!canWrite && (
            <span className="text-xs text-muted-foreground">
              Select a specific school to create/edit.
            </span>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "calendar" | "list")}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Button variant="ghost" onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}>
                ← Prev
              </Button>
              <span className="font-medium">{format(calendarMonth, "MMMM yyyy")}</span>
              <Button variant="ghost" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                Next →
              </Button>
            </div>

            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <span className="inline-flex items-center">
                <ScheduleDot type="TERM" size="medium" />
                <span className="text-xs ml-1">Term</span>
              </span>
              <span className="inline-flex items-center">
                <ScheduleDot type="HOLIDAY" size="medium" />
                <span className="text-xs ml-1">Holiday</span>
              </span>
              <span className="inline-flex items-center">
                <ScheduleDot type="HALF_DAY" size="medium" />
                <span className="text-xs ml-1">Half Day</span>
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

                const termCount = filteredEvents.filter((e) => e.type === "TERM").length;
                const holidayCount = filteredEvents.filter((e) => e.type === "HOLIDAY").length;
                const halfDayCount = filteredEvents.filter((e) => e.type === "HALF_DAY").length;

                return (
                  <div
                    key={date.toISOString()}
                    className={[
                      "min-h-[72px] rounded flex flex-col items-start justify-between p-1 relative transition border",
                      outOfMonth ? "bg-gray-100 text-gray-400" : "bg-white",
                      filteredEvents.length ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : "",
                    ].join(" ")}
                    style={{ opacity: outOfMonth ? 0.7 : 1 }}
                    onClick={() => {
                      if (filteredEvents.length) openDayModal(date);
                      else if (canWrite) openCreate(date);
                    }}
                    title={
                      filteredEvents.length
                        ? filteredEvents
                            .map(
                              (e) =>
                                `${e.school?.name ?? e.schoolId}: ${getScheduleLabel(e.type)}`
                            )
                            .join("\n")
                        : undefined
                    }
                  >
                    <div className="w-full flex items-start justify-between gap-2">
                      <span className="text-xs">{format(date, "d")}</span>

                      {filteredEvents.length > 0 && (
                        <span className="text-[10px] text-muted-foreground text-right leading-tight">
                          {filteredEvents.length} school{filteredEvents.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    {(termCount > 0 || holidayCount > 0 || halfDayCount > 0) && (
                      <div className="w-full text-[10px] text-muted-foreground leading-tight mt-1">
                        {termCount > 0 && <div>{termCount} term</div>}
                        {holidayCount > 0 && <div>{holidayCount} holiday</div>}
                        {halfDayCount > 0 && <div>{halfDayCount} half day</div>}
                      </div>
                    )}

                    <div className="flex flex-row gap-[2px] mt-auto mb-1 flex-wrap">
                      {filteredEvents.map((e, idx) => (
                        <span
                          key={`${e.school?.id ?? e.schoolId ?? idx}-${e.type}`}
                          title={`${e.school?.name ?? "School"}: ${getScheduleLabel(e.type)}`}
                        >
                          <ScheduleDot type={e.type} />
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          {loading && <div className="text-sm text-muted-foreground mb-2">Loading…</div>}

          <div className="block md:hidden space-y-3 mt-2">
            {schedules.map((sch) => (
              <div key={sch.id} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center gap-3">
                  <span className="font-bold text-[#27364B]">{sch.name}</span>
                  <span
                    className={
                      "inline-block px-3 py-1 rounded-full font-bold text-xs " +
                      getScheduleBadgeClass(sch.type)
                    }
                  >
                    {getScheduleLabel(sch.type)}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">{sch.school?.name ?? "-"}</div>

                <div className="flex gap-2 justify-end">
                  <span className="inline-block px-4 py-1 rounded-full bg-[#F4F7FA] text-[#27364B] text-xs font-semibold">
                    {format(new Date(sch.startDate), "EEE d MMM")} –{" "}
                    {format(new Date(sch.endDate), "EEE d MMM")}
                  </span>
                </div>

                {canWrite && (
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => openEditFromEvent(sch)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteSchedule(sch.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-2xl shadow-sm bg-white">
            <table className="min-w-[500px] w-full text-sm text-left rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-[#F4F7FA]">
                  <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B] rounded-tl-2xl">
                    Schedule Name
                  </th>
                  <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B]">
                    School
                  </th>
                  <th className="py-3 px-4 text-left text-base font-semibold text-[#27364B]">
                    Type
                  </th>
                  <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B]">
                    Dates
                  </th>
                  <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sch) => (
                  <tr
                    key={sch.id}
                    className="transition-colors hover:bg-[#E7F1FA] focus-within:bg-[#E7F8F0] bg-white"
                  >
                    <td className="py-3 px-4 text-[#27364B] font-medium">{sch.name}</td>
                    <td className="py-3 px-4 text-[#27364B]">{sch.school?.name ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          "inline-block px-3 py-1 rounded-full font-bold text-xs " +
                          getScheduleBadgeClass(sch.type)
                        }
                      >
                        {getScheduleLabel(sch.type)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-block px-4 py-1 rounded-full bg-[#F4F7FA] text-[#27364B] text-xs font-semibold">
                        {format(new Date(sch.startDate), "EEE d MMM")} –{" "}
                        {format(new Date(sch.endDate), "EEE d MMM")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canWrite ? (
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => openEditFromEvent(sch)}>
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteSchedule(sch.id)}>
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Select a school</span>
                      )}
                    </td>
                  </tr>
                ))}

                {schedules.length === 0 && (
                  <tr>
                    <td className="py-6 px-4 text-muted-foreground" colSpan={5}>
                      No schedules found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
        <DialogContent className="bg-white shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {dayModalData.date ? format(dayModalData.date, "EEEE, d MMMM yyyy") : ""}
            </DialogTitle>
          </DialogHeader>

          <div>
            {getFilteredEvents(dayModalData.events).length === 0 && (
              <div className="text-sm text-muted-foreground">
                No events for this day.
                {canWrite && dayModalData.date && (
                  <div className="mt-3">
                    <Button onClick={() => openCreate(dayModalData.date!)}>+ Create period</Button>
                  </div>
                )}
              </div>
            )}

            {getFilteredEvents(dayModalData.events).length > 0 && (
              <div className="space-y-4">
                {getFilteredEvents(dayModalData.events)
                  .sort((a, b) => (a.school?.name || "").localeCompare(b.school?.name || ""))
                  .map((e) => (
                    <div
                      key={e.id}
                      className="border-l-4 pl-2"
                      style={{
                        borderColor: getScheduleBorderColor(e.type),
                      }}
                    >
                      <div className="font-semibold">{e.school?.name ?? "-"}</div>

                      <div className="text-xs mb-1 flex items-center gap-2 flex-wrap">
                        <span
                          className={
                            "inline-block px-2 py-0.5 rounded-full font-bold text-[11px] " +
                            getScheduleBadgeClass(e.type)
                          }
                        >
                          {getScheduleLabel(e.type)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ScheduleDot type={e.type} />
                          <span>{e.name}</span>
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {format(new Date(e.startDate), "d MMM yyyy")} –{" "}
                        {format(new Date(e.endDate), "d MMM yyyy")}
                      </div>

                      {canWrite && (
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditFromEvent(e)}>
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteSchedule(e.id)}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="bg-white shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Period" : "New Period"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                saveSchedule({
                  id: editing.id,
                  name: String(data.name ?? ""),
                  type: data.type as ScheduleType,
                  startDate: String(data.startDate ?? ""),
                  endDate: String(data.endDate ?? ""),
                });
              }}
            >
              <div>
                <label className="block mb-1 text-sm font-medium">Name</label>
                <input
                  name="name"
                  defaultValue={editing.name}
                  required
                  className="w-full border rounded p-2"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Type</label>
                <select name="type" defaultValue={editing.type} className="w-full border rounded p-2">
                  <option value="TERM">School Term</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="HALF_DAY">Half Day</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-1 text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={editing.startDate}
                    required
                    className="w-full border rounded p-2"
                  />
                </div>

                <div className="flex-1">
                  <label className="block mb-1 text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={editing.endDate}
                    required
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit">{editing.id ? "Update" : "Create"}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}