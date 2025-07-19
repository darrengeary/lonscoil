"use client";
import { useEffect, useState } from "react";
import {
  format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, isAfter, isBefore
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

const COLORS = { TERM: "bg-green-300", HOLIDAY: "bg-red-300" };

// Fetch helpers
const fetchSchools = async () =>
  fetch("/api/schools").then(res => res.json());

const fetchSchedules = async (schoolId: string) =>
  fetch(`/api/schedules?schoolId=${schoolId}`).then(res => res.json());

const createSchedule = async (schedule: any) =>
  fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schedule) }).then(res => res.json());

const updateSchedule = async (schedule: any) =>
  fetch("/api/schedules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schedule) }).then(res => res.json());

const deleteSchedule = async (id: string) =>
  fetch("/api/schedules", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(res => res.json());

export default function AdminSchedulingPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [tab, setTab] = useState("list");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);

  // For drag-to-create (calendar)
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);

  // Calendar view state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth)
  });

  useEffect(() => {
    fetchSchools().then(data => {
      setSchools(data);
      if (data.length > 0) setSchoolId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (schoolId) fetchSchedules(schoolId).then(data => {
      setSchedules(data?.error ? [] : data);
    });
  }, [schoolId]);

  function openModal(schedule: any = null) {
    setSelected(schedule);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelected(null);
    setDragStart(null);
    setDragEnd(null);
  }

  async function handleSave(data: any) {
    const toSend = {
      ...selected,
      ...data,
      schoolId,
      startDate: data.startDate,
      endDate: data.endDate,
      type: data.type,
    };
    let res;
    if (selected?.id) {
      res = await updateSchedule({ ...toSend, id: selected.id });
      toast({ title: res?.error ? res.error : "Schedule updated!" });
    } else {
      res = await createSchedule(toSend);
      toast({ title: res?.error ? res.error : "Schedule created!" });
    }
    fetchSchedules(schoolId).then(setSchedules);
    closeModal();
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this schedule?")) {
      const res = await deleteSchedule(id);
      toast({ title: res?.error ? res.error : "Deleted." });
      fetchSchedules(schoolId).then(setSchedules);
    }
  }

  // Calendar drag-to-create: just a click & drag, very basic
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
        type: "TERM"
      });
    }
    setDragStart(null);
    setDragEnd(null);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8">
      <h1 className="text-2xl font-bold">Admin Scheduling</h1>
      <div className="mb-4">
        <label className="block mb-1">Select School</label>
        <select value={schoolId} onChange={e => setSchoolId(e.target.value)} className="border p-2 rounded">
          {schools.map(sch => (
            <option key={sch.id} value={sch.id}>{sch.name}</option>
          ))}
        </select>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <Button className="mb-4" onClick={() => openModal()}>+ New Period</Button>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(sch => (
                <tr key={sch.id}>
                  <td>{sch.name}</td>
                  <td>
                    <span className={`px-2 py-1 rounded ${COLORS[sch.type]}`}>{sch.type}</span>
                  </td>
                  <td>{format(new Date(sch.startDate), "yyyy-MM-dd")}</td>
                  <td>{format(new Date(sch.endDate), "yyyy-MM-dd")}</td>
                  <td>
                    <Button variant="outline" size="sm" onClick={() => openModal(sch)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(sch.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
        <TabsContent value="calendar">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              onClick={() => setCalendarMonth(addDays(calendarMonth, -30))}
            >← Prev</Button>
            <span className="font-medium">{format(calendarMonth, "MMMM yyyy")}</span>
            <Button
              variant="ghost"
              onClick={() => setCalendarMonth(addDays(calendarMonth, 30))}
            >Next →</Button>
          </div>
          <div
            className="grid grid-cols-7 gap-2 border p-2"
            style={{ userSelect: "none" }}
            onMouseUp={handleCalendarMouseUp}
          >
            {calendarDays.map(date => {
              const sch = schedules.find(s =>
                isWithinInterval(date, {
                  start: new Date(s.startDate),
                  end: new Date(s.endDate)
                })
              );
              let isInDrag = false;
              if (dragStart && dragEnd) {
                const [start, end] = [dragStart, dragEnd].sort((a, b) => +a - +b);
                isInDrag = isAfter(date, addDays(start, -1)) && isBefore(date, addDays(end, 1));
              }
              return (
                <div
                  key={date.toISOString()}
                  className={`h-16 rounded flex flex-col items-start justify-between p-1 cursor-pointer
                    ${sch ? COLORS[sch.type] : ""}
                    ${isInDrag ? "border-2 border-blue-500" : ""}
                  `}
                  onMouseDown={() => handleCalendarMouseDown(date)}
                  onMouseEnter={() => handleCalendarMouseEnter(date)}
                  onClick={() => sch && openModal(sch)}
                >
                  <span className="text-xs">{format(date, "d")}</span>
                  {sch && <span className="text-xs font-bold">{sch.name}</span>}
                </div>
              );
            })}
          </div>
          <div className="text-xs mt-2 text-muted-foreground">
            Drag/select to add a new period.
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      {showModal && (
        <Dialog open={showModal} onOpenChange={closeModal}>
          <DialogContent>
            <DialogTitle>{selected?.id ? "Edit Period" : "Add New Period"}</DialogTitle>
            <form className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const data = Object.fromEntries(new FormData(form));
                handleSave({ ...selected, ...data });
              }}
            >
              <div>
                <label className="block mb-1">Name</label>
                <Input name="name" defaultValue={selected?.name || ""} required />
              </div>
              <div>
                <label className="block mb-1">Type</label>
                <select name="type" defaultValue={selected?.type || "TERM"} className="w-full border rounded p-2">
                  <option value="TERM">Semester / Orderable</option>
                  <option value="HOLIDAY">Holiday / Not orderable</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="block mb-1">Start Date</label>
                  <Input type="date" name="startDate"
                    defaultValue={selected?.startDate?.slice(0, 10)} required />
                </div>
                <div>
                  <label className="block mb-1">End Date</label>
                  <Input type="date" name="endDate"
                    defaultValue={selected?.endDate?.slice(0, 10)} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{selected?.id ? "Update" : "Create"}</Button>
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
