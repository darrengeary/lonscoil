"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileText,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";

type PrepView = "grouped" | "choices" | "individual-choices" | "student";

type MenuItem = { id: string; name: string };

type TagCount = {
  name: string;
  qty: number;
};

type GroupedMealRow = {
  meal: string;
  count: number;
  tags: TagCount[];
};

type SplitMealRow = {
  meal: string;
  tagSig: string;
  count: number;
};

type IndividualChoiceRow = {
  choice: string;
  count: number;
};

type StudentMealRow = {
  pupilName: string;
  classroom: string;
  meal: string;
  tags: string[];
  tagSig: string;
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

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

export default function PrepListPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState("all");

  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomId, setClassroomId] = useState("all");

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [menuId, setMenuId] = useState("all");

  const [view, setView] = useState<PrepView>("grouped");

  const [groupedMeals, setGroupedMeals] = useState<GroupedMealRow[]>([]);
  const [splitMeals, setSplitMeals] = useState<SplitMealRow[]>([]);
  const [individualChoiceRows, setIndividualChoiceRows] = useState<IndividualChoiceRow[]>([]);
  const [studentRows, setStudentRows] = useState<StudentMealRow[]>([]);

  const [printing, setPrinting] = useState(false);
  const [loading, setLoading] = useState(false);

  const [studentPage, setStudentPage] = useState(1);
  const STUDENT_PAGE_SIZE = 100;

  const isSingleDay = startDate === endDate;

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools([{ id: "all", name: "All Schools" }, ...data]))
      .catch(() => setSchools([{ id: "all", name: "All Schools" }]));

    fetch("/api/menus")
      .then((res) => res.json())
      .then((data) =>
        setMenus([{ id: "all", name: "All Menus" }, ...data.map((m: any) => ({ id: m.id, name: m.name }))])
      )
      .catch(() => setMenus([{ id: "all", name: "All Menus" }]));
  }, []);

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

  useEffect(() => {
    if (!isSingleDay && view === "student") {
      setView("grouped");
    }
  }, [isSingleDay, view]);

  useEffect(() => {
    setStudentPage(1);
  }, [startDate, endDate, schoolId, classroomId, menuId, view]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);

        if (!startDate || !endDate || endDate < startDate) {
          setGroupedMeals([]);
          setSplitMeals([]);
          setIndividualChoiceRows([]);
          setStudentRows([]);
          return;
        }

        const url = new URL("/api/reports/kitchen-prep/pdf", window.location.origin);
        url.searchParams.set("startDate", startDate);
        url.searchParams.set("endDate", endDate);
        url.searchParams.set("view", view);
        url.searchParams.set("format", "json");

        if (schoolId && schoolId !== "all") url.searchParams.set("schoolId", schoolId);
        if (classroomId && classroomId !== "all") url.searchParams.set("classroomId", classroomId);
        if (menuId && menuId !== "all") url.searchParams.set("menuId", menuId);

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = await res.json();

        setGroupedMeals(data.groupedMeals ?? []);
        setSplitMeals(data.splitMeals ?? []);
        setIndividualChoiceRows(data.individualChoiceRows ?? []);
        setStudentRows(data.studentRows ?? []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setGroupedMeals([]);
        setSplitMeals([]);
        setIndividualChoiceRows([]);
        setStudentRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, [startDate, endDate, schoolId, classroomId, menuId, view]);

  function handleOpenPdf() {
    if (!startDate || !endDate) {
      alert("Please choose a start date and end date.");
      return;
    }

    if (endDate < startDate) {
      alert("End date cannot be before start date.");
      return;
    }

    const url = new URL("/api/reports/kitchen-prep/pdf", window.location.origin);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("view", view);

    if (schoolId && schoolId !== "all") url.searchParams.set("schoolId", schoolId);
    if (classroomId && classroomId !== "all") url.searchParams.set("classroomId", classroomId);
    if (menuId && menuId !== "all") url.searchParams.set("menuId", menuId);

    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  async function createPrintJob(): Promise<{ id: string; totalLabels: number }> {
    let url = `/api/print-jobs?date=${startDate}`;
    if (schoolId && schoolId !== "all") url += `&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;
    if (menuId && menuId !== "all") url += `&menuId=${menuId}`;
    url += `&view=${view}`;

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { id: string; totalLabels: number };
  }

  async function handlePrintStickersAll() {
    try {
      if (!isSingleDay) {
        alert("Sticker printing is only available for a single day.");
        return;
      }

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
      : view === "choices"
      ? splitMeals.reduce((sum, r) => sum + (r.count ?? 0), 0)
      : view === "individual-choices"
      ? individualChoiceRows.reduce((sum, r) => sum + (r.count ?? 0), 0)
      : groupedMeals.reduce((sum, r) => sum + (r.count ?? 0), 0);

  const secondaryLabel =
    view === "student"
      ? "Students Listed"
      : view === "choices"
      ? "Unique Meal Tag Combos"
      : view === "individual-choices"
      ? "Unique Individual Choices"
      : "Unique Meals";

  const secondaryValue =
    view === "student"
      ? studentRows.length
      : view === "choices"
      ? splitMeals.length
      : view === "individual-choices"
      ? individualChoiceRows.length
      : groupedMeals.length;

  const totalStudentPages = Math.max(1, Math.ceil(studentRows.length / STUDENT_PAGE_SIZE));

  const visibleStudentRows = useMemo(() => {
    const start = (studentPage - 1) * STUDENT_PAGE_SIZE;
    return studentRows.slice(start, start + STUDENT_PAGE_SIZE);
  }, [studentRows, studentPage]);

  return (
    <div className="bg-[#F4F7FA] p-6 space-y-6">
      <DashboardHeader heading="Order Summary" text="View lunch orders and open report PDFs." />

      <div className="flex flex-wrap gap-4 items-end bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <DatePicker value={endDate} onChange={setEndDate} />
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
          <label className="block text-sm font-medium mb-1">Menu</label>
          <Select value={menuId} onValueChange={setMenuId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Menu" />
            </SelectTrigger>
            <SelectContent>
              {menus.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
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
              <SelectItem value="choices">Split by choices</SelectItem>
              <SelectItem value="individual-choices">Individual choices only</SelectItem>
              {isSingleDay && <SelectItem value="student">By student</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" onClick={handleOpenPdf} className="gap-2">
          <FileText size={18} /> Print Report
        </Button>

        <Button
          type="button"
          onClick={handlePrintStickersAll}
          disabled={printing || !isSingleDay}
          className="gap-2"
          title={!isSingleDay ? "Sticker printing is only available for a single day." : undefined}
        >
          <Printer size={18} /> {printing ? " Preparing…" : " Print Stickers"}
        </Button>
      </div>

      {!isSingleDay && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Multi-day range selected. Student view and Sticker printing only available on a single day
        </div>
      )}

      {endDate < startDate && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          End date cannot be before start date.
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-2">
        <div className="px-4 py-2 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-base flex items-center">
          Total Meals: <span className="ml-2 text-[#27364B] font-bold">{totalMeals}</span>
        </div>
        <div className="px-4 py-2 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-base flex items-center">
          {secondaryLabel}:{" "}
          <span className="ml-2 text-[#27364B] font-bold">{secondaryValue}</span>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center text-muted-foreground">
          Loading…
        </div>
      ) : view === "student" ? (
        <>
          <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Student</th>
                  <th className="text-left p-3">Classroom</th>
                  <th className="text-left p-3">Meal</th>
                  <th className="text-left p-3">Choice Tags</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudentRows.map((row, i) => (
                  <tr key={`${row.pupilName}-${row.meal}-${i}`} className="border-b last:border-0">
                    <td className="p-3">{row.pupilName}</td>
                    <td className="p-3">{row.classroom}</td>
                    <td className="p-3 font-medium">{row.meal}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {row.tags.length ? (
                          row.tags.map((tag) => <TagPill key={tag}>{tag}</TagPill>)
                        ) : (
                          <span className="text-muted-foreground">No tags</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleStudentRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No data found for this date/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">
              Page {studentPage} of {totalStudentPages} • {studentRows.length} total rows
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={studentPage <= 1}
                onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>

              <Button
                variant="outline"
                type="button"
                disabled={studentPage >= totalStudentPages}
                onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      ) : view === "choices" ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Meal</th>
                <th className="text-left p-3">Choice Tags</th>
                <th className="text-right p-3">Qty</th>
              </tr>
            </thead>
            <tbody>
              {splitMeals.map((row, i) => (
                <tr key={`${row.meal}-${row.tagSig}-${i}`} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.meal}</td>
                  <td className="p-3">{row.tagSig}</td>
                  <td className="p-3 text-right font-semibold">{row.count}</td>
                </tr>
              ))}
              {splitMeals.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    No data found for this date/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : view === "individual-choices" ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Choice</th>
                <th className="text-right p-3">Qty</th>
              </tr>
            </thead>
            <tbody>
              {individualChoiceRows.map((row, i) => (
                <tr key={`${row.choice}-${i}`} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.choice}</td>
                  <td className="p-3 text-right font-semibold">{row.count}</td>
                </tr>
              ))}
              {individualChoiceRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-6 text-center text-muted-foreground">
                    No individual choices found for this date/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Meal</th>
                <th className="text-left p-3">Choice Tags</th>
                <th className="text-right p-3">Qty</th>
              </tr>
            </thead>
            <tbody>
              {groupedMeals.map((row) => (
                <tr key={row.meal} className="border-b last:border-0">
                  <td className="p-3 font-medium">{row.meal}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {row.tags.length ? (
                        row.tags.map((tag) => (
                          <TagPill key={tag.name}>
                            {tag.name} × {tag.qty}
                          </TagPill>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No tags</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-semibold">{row.count}</td>
                </tr>
              ))}
              {groupedMeals.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    No data found for this date/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}