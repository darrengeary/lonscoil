"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Printer } from "lucide-react";
import PrepSummaryTable, {
  PrepSummaryRow,
  ExtrasTotalRow,
  PrepSplitRow,
} from "@/components/supplier/PrepSummaryTable";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";

type MealGroup = { id: string; name: string };
type PrepView = "grouped" | "extras" | "student";

type StudentPrepRow = {
  pupilName: string;
  classroom: string;
  group: string;
  choice: string;
  extras: string[];
  extrasSig: string;
};

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className={cn(
            "w-48 justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(selectedDate!, "yyyy-MM-dd") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function PrepListPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(todayStr);

  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState("all");

  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomId, setClassroomId] = useState("all");

  const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
  const [mealGroupId, setMealGroupId] = useState("all");

  const [view, setView] = useState<PrepView>("grouped");

  const [rows, setRows] = useState<PrepSummaryRow[]>([]);
  const [splitRows, setSplitRows] = useState<PrepSplitRow[]>([]);
  const [extrasTotals, setExtrasTotals] = useState<ExtrasTotalRow[]>([]);
  const [studentRows, setStudentRows] = useState<StudentPrepRow[]>([]);

  const [printing, setPrinting] = useState(false);

  // ---- initial data fetch ----
  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools([{ id: "all", name: "All Schools" }, ...data]))
      .catch(() => setSchools([{ id: "all", name: "All Schools" }]));

    fetch("/api/mealgroups")
      .then((res) => res.json())
      .then((data) =>
        setMealGroups([
          { id: "all", name: "All Meal Groups" },
          ...data.map((g: any) => ({ id: g.id, name: g.name })),
        ])
      )
      .catch(() => setMealGroups([{ id: "all", name: "All Meal Groups" }]));
  }, []);

  // ---- classrooms fetch ----
  useEffect(() => {
    if (schoolId === "all") {
      setClassrooms([]);
      setClassroomId("all");
      return;
    }

    fetch(`/api/classrooms?schoolId=${schoolId}`)
      .then((res) => res.json())
      .then((data) => setClassrooms([{ id: "all", name: "All Classrooms" }, ...data]))
      .catch(() => setClassrooms([{ id: "all", name: "All Classrooms" }]));

    setClassroomId("all");
  }, [schoolId]);

  // ---- main data fetch ----
  useEffect(() => {
    const controller = new AbortController();

    let url = `/api/kitchen-prep?date=${date}&view=${view}`;
    if (schoolId && schoolId !== "all") url += `&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;
    if (mealGroupId && mealGroupId !== "all") url += `&mealGroupId=${mealGroupId}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res.json();
      })
      .then((data) => {
        const meals = [...(data.meals ?? [])].sort(
          (a: any, b: any) => (b.count ?? 0) - (a.count ?? 0)
        );
        const splits = [...(data.splitMeals ?? [])].sort(
          (a: any, b: any) => (b.count ?? 0) - (a.count ?? 0)
        );
        const students = [...(data.studentRows ?? [])];

        setRows(meals);
        setSplitRows(splits);
        setExtrasTotals(data.extrasTotals ?? []);
        setStudentRows(students);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error(err);
        setRows([]);
        setSplitRows([]);
        setExtrasTotals([]);
        setStudentRows([]);
      });

    return () => controller.abort();
  }, [date, schoolId, classroomId, mealGroupId, view]);

  const handlePrint = () => window.print();

  async function createPrintJob(): Promise<{ id: string; totalLabels: number }> {
    let url = `/api/print-jobs?date=${date}`;
    if (schoolId && schoolId !== "all") url += `&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;
    if (mealGroupId && mealGroupId !== "all") url += `&mealGroupId=${mealGroupId}`;

    // For labels, student mode usually still means regular labels.
    // If your backend supports student mode for print jobs, change this.
    const labelView = view === "student" ? "grouped" : view;
    url += `&view=${labelView}`;

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { id: string; totalLabels: number };
  }

  async function handlePrintStickersAll() {
    try {
      setPrinting(true);

      const job = await createPrintJob();

      if (!job.totalLabels || job.totalLabels <= 0) {
        alert("No labels to print for this date/filter.");
        return;
      }

      const res = await fetch(`/api/print-jobs/${job.id}/zpl?from=1&limit=${job.totalLabels}`, {
        method: "GET",
        cache: "no-store",
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const text = await res.text();
        console.error("ZPL fetch failed", res.status, text);
        alert(`ZPL fetch failed: ${res.status}`);
        return;
      }

      const zpl = await res.text();

      if (!zpl.trim()) {
        console.error("ZPL is empty", { jobId: job.id, totalLabels: job.totalLabels });
        alert("ZPL is empty (no items or server returned empty). Check console.");
        return;
      }

      if (contentType.includes("text/html")) {
        console.error("Got HTML instead of ZPL (likely auth redirect)", zpl.slice(0, 300));
        alert("Got HTML instead of ZPL (likely auth issue). Check console.");
        return;
      }

      const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `printjob_${job.id}_ALL_${job.totalLabels}labels.zpl`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Sticker print failed");
    } finally {
      setPrinting(false);
    }
  }

  const totalMeals =
    view === "student"
      ? studentRows.length
      : view === "extras"
      ? splitRows.reduce((sum, r) => sum + (r.count ?? 0), 0)
      : rows.reduce((sum, r) => sum + (r.count ?? 0), 0);

  const secondaryLabel =
    view === "student"
      ? "Students Listed"
      : view === "extras"
      ? "Unique Choice Combos"
      : "Unique Choices";

  const secondaryValue =
    view === "student" ? studentRows.length : view === "extras" ? splitRows.length : rows.length;

  return (
    <div className="bg-[#F4F7FA] p-6 space-y-6">
      <DashboardHeader heading="Order Summary" text="View daily lunch orders." />

      {/* WEB ONLY */}
      <div className="print:hidden">
        <div className="flex flex-wrap gap-4 items-end bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">School</label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger className="w-48">
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

          {schoolId !== "all" && classrooms.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Classroom</label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select Classroom" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Meal Group</label>
            <Select value={mealGroupId} onValueChange={setMealGroupId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Meal Group" />
              </SelectTrigger>
              <SelectContent>
                {mealGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">View</label>
            <Select value={view} onValueChange={(v: PrepView) => setView(v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grouped">Grouped</SelectItem>
                <SelectItem value="extras">Split by extras</SelectItem>
                <SelectItem value="student">By student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={handlePrint} className="gap-2">
            <Printer size={18} /> Print List
          </Button>

          <Button
            type="button"
            onClick={handlePrintStickersAll}
            disabled={printing}
            className="gap-2"
          >
            <Printer size={18} /> {printing ? " Preparing…" : " Print Stickers"}
          </Button>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-3 mb-2">
          <div className="px-4 py-2 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-base flex items-center">
            Total Meals: <span className="ml-2 text-[#27364B] font-bold">{totalMeals}</span>
          </div>
          <div className="px-4 py-2 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-base flex items-center">
            {secondaryLabel}:{" "}
            <span className="ml-2 text-[#27364B] font-bold">{secondaryValue}</span>
          </div>
        </div>

        {view === "student" ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Student</th>
                  <th className="text-left p-3">Classroom</th>
                  <th className="text-left p-3">Meal Group</th>
                  <th className="text-left p-3">Choice</th>
                  <th className="text-left p-3">Extras</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3">{row.pupilName}</td>
                    <td className="p-3">{row.classroom}</td>
                    <td className="p-3">{row.group}</td>
                    <td className="p-3">{row.choice}</td>
                    <td className="p-3">{row.extrasSig}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PrepSummaryTable
            rows={rows}
            splitRows={splitRows}
            extrasTotals={extrasTotals}
            mode={view === "extras" ? "split" : "grouped"}
          />
        )}
      </div>

      {/* PRINT ONLY */}
      <div className="hidden print:block w-full mt-6">
        <div className="text-center mb-4">
          <img src="/lunchlog.png" alt="LunchLog" style={{ height: 170, margin: "0 auto" }} />
          <div style={{ fontSize: 16, fontWeight: 600, margin: "12px 0 0 0" }}>
            Orders for: {date}
          </div>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            View:{" "}
            {view === "grouped"
              ? "Grouped"
              : view === "extras"
              ? "Split by extras"
              : "By student"}
          </div>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            marginTop: 12,
          }}
        >
          <thead>
            {view === "student" ? (
              <tr>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Student
                </th>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Classroom
                </th>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Choice
                </th>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Meal Group
                </th>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Extras
                </th>
              </tr>
            ) : (
              <tr>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Choice
                </th>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>
                  Meal Group
                </th>
                <th style={{ border: "1px solid #000", padding: 8, textAlign: "right" }}>
                  Quantity
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {view === "student"
              ? studentRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #000", padding: 8 }}>{row.pupilName}</td>
                    <td style={{ border: "1px solid #000", padding: 8 }}>{row.classroom}</td>
                    <td style={{ border: "1px solid #000", padding: 8 }}>{row.choice}</td>
                    <td style={{ border: "1px solid #000", padding: 8 }}>{row.group}</td>
                    <td style={{ border: "1px solid #000", padding: 8 }}>{row.extrasSig}</td>
                  </tr>
                ))
              : (view === "extras" ? splitRows : rows).map((row: any, i: number) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #000", padding: 8 }}>
                      {"extrasSig" in row && row.extrasSig
                        ? `${row.choice} — ${row.extrasSig}`
                        : row.choice}
                    </td>
                    <td style={{ border: "1px solid #000", padding: 8 }}>{row.group}</td>
                    <td
                      style={{ border: "1px solid #000", padding: 8, textAlign: "right" }}
                    >
                      {row.count}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}