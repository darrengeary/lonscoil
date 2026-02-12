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
const COLORS: Record<"TERM" | "HOLIDAY", string> = {
  TERM: "bg-green-300",
  HOLIDAY: "bg-red-300",
};

function getCalendarDays(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start, end });
  // Mon–Fri only
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

  // Drag-to-create state + click suppression
  const [isSelecting, setIsSelecting] = useState(false);
  const [suppressClickUntil, setSuppressClickUntil] = useState<number>(0);
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
    setIsSelecting(false);
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
    const res = selected?.id
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

  // ----- Drag selection handlers (fixed) -----
  function handleCalendarMouseDown(date: Date) {
    setIsSelecting(true);
    setDragStart(date);
    setDragEnd(date);
  }
  function handleCalendarMouseEnter(date: Date) {
    if (isSelecting) setDragEnd(date);
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
      // Suppress the trailing click that would otherwise open an existing schedule
      setSuppressClickUntil(Date.now() + 250);
    }
    setIsSelecting(false);
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
                <div className="flex gap-2 justify-end mt-2">
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
                  <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B]">Dates</th>
                  <th className="py-3 px-4 text-right text-base font-semibold text-[#27364B] rounded-tr-2xl">Actions</th>
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
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            className="grid grid-cols-5 gap-1 border p-2 bg-white rounded-xl"
            style={{
              userSelect: "none",
              cursor: isSelecting ? "crosshair" : "pointer",
            }}
            onMouseUp={handleCalendarMouseUp}
          >
            {/* WEEKDAY HEADERS */}
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-xs font-semibold text-center pb-2">
                {d}
              </div>
            ))}

            {/* DAYS (Mon–Fri only) */}
            {calendarDays.map((date) => {
              const outOfMonth = !isSameMonth(date, calendarMonth);
              const schedule = getScheduleForDay(date);

              let label = "";
              if (schedule) {
                const start = new Date(schedule.startDate);
                const end = new Date(schedule.endDate);
                if (isSameDay(date, start) || isSameDay(date, end)) {
                  label = schedule.name;
                }
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
                  }}
                  onMouseDown={() => handleCalendarMouseDown(date)}
                  onMouseEnter={() => handleCalendarMouseEnter(date)}
                  onClick={() => {
                    // Ignore click that immediately follows a drag selection
                    if (isSelecting || Date.now() < suppressClickUntil) return;

                    if (schedule) {
                      // Edit existing period on that day
                      openModal(schedule);
                    } else {
                      // Blank day click: create single-day TERM
                      openModal({
                        name: "",
                        startDate: format(date, "yyyy-MM-dd"),
                        endDate: format(date, "yyyy-MM-dd"),
                        type: "TERM",
                      });
                    }
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

          <div className="text-xs mt-2 text-muted-foreground">
            Click & drag to add a new period. Click a day to edit or create a
            single-day period.
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MODAL --- */}
      {showModal && (
        <Dialog open onOpenChange={closeModal}>
          <DialogContent className="bg-white">
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
                  defaultValue={"HOLIDAY"}
                  className="w-full border rounded p-2"
                >
                  <option value="TERM">School Term</option>
                  <option value="HOLIDAY">Holiday</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-1">Start Date</label>
                  <Input
                    type="date"
                    name="startDate"
                    defaultValue={selected?.startDate?.slice(0, 10)}
                    required
                  />
                </div>
                <div className="flex-1">
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
