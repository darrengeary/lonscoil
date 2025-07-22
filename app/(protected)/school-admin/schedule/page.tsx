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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

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

export default function SchoolAdminSchedulingPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"list" | "calendar">("calendar");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarDays = getCalendarDays(calendarMonth);

  const schoolId = session?.user?.schoolId;

  useEffect(() => {
    if (schoolId) {
      fetch(`/api/schedule?schoolId=${schoolId}`)
        .then((r) => r.json())
        .then((data) => setSchedules(data.error ? [] : data));
    }
  }, [schoolId]);

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user || session.user.role !== "SCHOOLADMIN") {
    return <div className="text-red-600">Unauthorized</div>;
  }

  function openModal(sch: any | null = null) {
    setSelected(sch);
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    setSelected(null);
    setDragStart(null);
    setDragEnd(null);
  }

  async function handleSave(formData: any) {
    const payload = {
      ...selected,
      ...formData,
      schoolId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      type: formData.type,
    };
    let res = selected?.id
      ? await fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json())
      : await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json());
    toast({ title: res.error ?? (selected?.id ? "Updated!" : "Created!") });
    setSchedules(
      await fetch(`/api/schedule?schoolId=${schoolId}`).then((r) => r.json())
    );
    closeModal();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    const res = await fetch("/api/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());
    toast({ title: res.error ?? "Deleted." });
    setSchedules(
      await fetch(`/api/schedule?schoolId=${schoolId}`).then((r) => r.json())
    );
  }

  function handleCalendarMouseDown(date: Date) {
    setDragStart(date);
    setDragEnd(date);
  }
  function handleCalendarMouseEnter(date: Date) {
    if (dragStart) setDragEnd(date);
  }
  function handleCalendarMouseUp() {
    if (dragStart && dragEnd) {
      const [start, end] = [dragStart, dragEnd].sort((a, b) => +a - +b);
      openModal({
        name: "",
        startDate: format(start, "yyyy-MM-dd"),
        endDate: format(end, "yyyy-MM-dd"),
        type: "TERM",
      });
    }
    setDragStart(null);
    setDragEnd(null);
  }

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

  return (
    <div className="space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Scheduling</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "list" | "calendar")}>
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>
        {/* --- LIST VIEW --- */}
        <TabsContent value="list">
          <Button className="mb-4" onClick={() => openModal()}>
            + New Period
          </Button>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {schedules.map((sch) => (
                <tr key={sch.id}>
                  <td>{sch.name}</td>
                  <td>
                    <span className={`px-2 py-1 rounded ${COLORS[sch.type]}`}>
                      {sch.type}
                    </span>
                  </td>
                  <td>{format(new Date(sch.startDate), "yyyy-MM-dd")}</td>
                  <td>{format(new Date(sch.endDate), "yyyy-MM-dd")}</td>
                  <td className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openModal(sch)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(sch.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
        {/* --- CALENDAR VIEW --- */}
        <TabsContent value="calendar">
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
          <div
            className="grid grid-cols-5 gap-1 border p-2 bg-white"
            style={{ userSelect: "none" }}
            onMouseUp={handleCalendarMouseUp}
          >
            {/* WEEKDAY HEADERS */}
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-xs font-semibold text-center pb-2"
              >
                {d}
              </div>
            ))}
            {/* DAYS (Mon-Fri only) */}
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

              let isInDrag = false;
              if (dragStart && dragEnd) {
                const [start, end] = [dragStart, dragEnd].sort(
                  (a, b) => +a - +b
                );
                isInDrag = isDateWithin(date, start, end);
              }

              return (
                <div
                  key={date.toISOString()}
                  className={[
                    "h-16 rounded flex flex-col items-start justify-between p-1 relative transition",
                    outOfMonth ? "bg-gray-100 text-gray-400" : "",
                    schedule ? schedule.color : "",
                    isInDrag ? "border-2 border-blue-500" : "",
                  ].join(" ")}
                  style={{
                    opacity: outOfMonth ? 0.7 : 1,
                    cursor: "pointer",
                  }}
                  onMouseDown={() => handleCalendarMouseDown(date)}
                  onMouseEnter={() => handleCalendarMouseEnter(date)}
                  onClick={() => schedule && openModal(schedule)}
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
          <div className="text-xs mt-2 text-muted-foreground">
            Click & drag to add a new period.
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MODAL --- */}
      {showModal && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent>
            <DialogTitle>
              {selected?.id ? "Edit Period" : "Add New Period"}
            </DialogTitle>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(
                  new FormData(e.currentTarget)
                );
                handleSave(data);
              }}
            >
              <div>
                <label className="block mb-1">Name</label>
                <Input
                  name="name"
                  defaultValue={selected?.name || ""}
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Type</label>
                <select
                  name="type"
                  defaultValue={selected?.type || "TERM"}
                  className="w-full border rounded p-2"
                >
                  <option value="TERM">Orderable</option>
                  <option value="HOLIDAY">Holiday</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="block mb-1">Start Date</label>
                  <Input
                    type="date"
                    name="startDate"
                    defaultValue={selected?.startDate?.slice(0, 10)}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">End Date</label>
                  <Input
                    type="date"
                    name="endDate"
                    defaultValue={selected?.endDate?.slice(0, 10)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {selected?.id ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
