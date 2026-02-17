"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import PrepSummaryTable, { PrepSummaryRow, ExtrasTotalRow } from "@/components/supplier/PrepSummaryTable";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";

type MealGroup = { id: string; name: string };

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value) : undefined;

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
  // ---- state (ALL hooks at top) ----
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(todayStr);

  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState("all");

  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomId, setClassroomId] = useState("all");

  const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
  const [mealGroupId, setMealGroupId] = useState("all");

  const [rows, setRows] = useState<PrepSummaryRow[]>([]);
  const [extrasTotals, setExtrasTotals] = useState<ExtrasTotalRow[]>([]);

  const [splitByExtras, setSplitByExtras] = useState(false);

  const [printing, setPrinting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // grid preview: 9 label image URLs
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  // ---- data fetch ----
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

  const fetchData = () => {
    let url = `/api/kitchen-prep?date=${date}`;
    if (schoolId && schoolId !== "all") url += `&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;
    if (mealGroupId && mealGroupId !== "all") url += `&mealGroupId=${mealGroupId}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const meals = [...(data.meals ?? [])].sort(
          (a: any, b: any) => (b.count ?? 0) - (a.count ?? 0)
        );
        setRows(meals);
        setExtrasTotals(data.extrasTotals ?? []);
      })
      .catch(() => {
        setRows([]);
        setExtrasTotals([]);
      });
  };

  useEffect(fetchData, [date, schoolId, classroomId, mealGroupId]);

  // ---- actions ----
  const handlePrint = () => window.print();

  async function createPrintJob(): Promise<{ id: string; totalLabels: number }> {
    let url = `/api/print-jobs?date=${date}`;
    if (schoolId && schoolId !== "all") url += `&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    const job = (await res.json()) as { id: string; totalLabels: number };
    setLastJobId(job.id);
    return job;
  }

  async function handlePrintStickersTest() {
    try {
      setPrinting(true);
      const job = await createPrintJob();

      const zplRes = await fetch(`/api/print-jobs/${job.id}/zpl?from=1&limit=4`);
      if (!zplRes.ok) throw new Error(await zplRes.text());
      const zpl = await zplRes.text();

      const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = `printjob_${job.id}_test_4labels.zpl`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Sticker test print failed");
    } finally {
      setPrinting(false);
    }
  }

  // Preview 9 labels as 3x3 grid (3 wide)
  // This calls /api/print-jobs/:id/preview?from=N&limit=1&dpi=203 for each label.
  async function handlePreviewStickers() {
    try {
      setPreviewing(true);
      setPreviewImages([]);

      const job = await createPrintJob();

      const dpi = 203;
      const count = Math.min(9, job.totalLabels);

      const urls = Array.from({ length: count }, (_, i) => {
        const seq = i + 1;
        // IMPORTANT: your preview endpoint must return ONE label PNG for limit=1
        return `/api/print-jobs/${job.id}/preview?from=${seq}&limit=1&dpi=${dpi}`;
      });

      setPreviewImages(urls);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  const totalMeals = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const uniqueChoices = rows.length;

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
            <label className="block text-sm font-medium mb-1">Split by extras</label>
            <div className="flex items-center gap-3 h-10">
              <Switch checked={splitByExtras} onCheckedChange={setSplitByExtras} />
              <span className="text-sm text-muted-foreground">
                {splitByExtras ? "On" : "Off"}
              </span>
            </div>
          </div>

          <Button type="button" onClick={handlePrint} className="gap-2">
            <Printer size={18} /> Print page
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handlePrintStickersTest}
            disabled={printing}
          >
            {printing ? "Preparing…" : "Print stickers (test 4)"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handlePreviewStickers}
            disabled={previewing}
          >
            {previewing ? "Rendering…" : "Preview stickers (3×3)"}
          </Button>
        </div>

        {/* Preview area (NOT inside filter bar) */}
        {previewImages.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[#27364B]">
                Sticker preview (first {previewImages.length})
              </div>
              {lastJobId && (
                <div className="text-xs text-muted-foreground">Job: {lastJobId}</div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {previewImages.map((src, i) => (
                <div key={i} className="rounded-xl border bg-[#F4F7FA] p-2">
                  <div className="text-xs text-muted-foreground mb-1">Label {i + 1}</div>
                  <img src={src} className="w-full h-auto block" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pills */}
        <div className="flex flex-wrap gap-3 mb-2">
          <div className="px-4 py-2 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-base flex items-center">
            Total Meals: <span className="ml-2 text-[#27364B] font-bold">{totalMeals}</span>
          </div>
          <div className="px-4 py-2 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-base flex items-center">
            Unique Choices: <span className="ml-2 text-[#27364B] font-bold">{uniqueChoices}</span>
          </div>
        </div>

        <PrepSummaryTable
          rows={rows}
          extrasTotals={extrasTotals}
          mode={splitByExtras ? "split" : "grouped"}
          splitIncludeBase={true}
        />
      </div>

      {/* PRINT ONLY (keep yours) */}
      <div className="hidden print:block w-full mt-6">
        <div className="text-center mb-4">
          <img src="/lunchlog.png" alt="LunchLog" style={{ height: 170, margin: "0 auto" }} />
          <div style={{ fontSize: 16, fontWeight: 600, margin: "12px 0 0 0" }}>
            Orders for: {date}
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
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #000", padding: 8 }}>{row.choice}</td>
                <td style={{ border: "1px solid #000", padding: 8 }}>{row.group}</td>
                <td style={{ border: "1px solid #000", padding: 8, textAlign: "right" }}>
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
