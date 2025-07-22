"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
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
import { Calendar as CalendarIcon, RefreshCw, Printer } from "lucide-react";
import PrepSummaryTable, { PrepSummaryRow } from "@/components/supplier/PrepSummaryTable";
import { cn } from "@/lib/utils";

// --- DatePicker Component ---
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
          variant={"secondary"}
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
          onSelect={date => {
            if (date) onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
// --- End DatePicker ---

export default function PrepListPage() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const schoolId = user?.schoolId;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(todayStr);
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomId, setClassroomId] = useState("all");
  const [rows, setRows] = useState<PrepSummaryRow[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // --- All hooks must be above any return! ---

  // Fetch classrooms for this school
  useEffect(() => {
    if (!schoolId) return;
    fetch(`/api/classrooms?schoolId=${schoolId}`)
      .then(res => res.json())
      .then(data => setClassrooms([{ id: "all", name: "All Classrooms" }, ...data]))
      .catch(() => setClassrooms([{ id: "all", name: "All Classrooms" }]));
    setClassroomId("all");
  }, [schoolId]);

  // Fetch summary data
  const fetchData = () => {
    let url = `/api/kitchen-prep?date=${date}&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;
    fetch(url)
      .then(res => res.json())
      .then((data) => {
        setRows([...data].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)));
      })
      .catch(() => setRows([]));
  };

  useEffect(fetchData, [date, schoolId, classroomId]);

  // Print handler
  const handlePrint = () => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const newWin = window.open("", "_blank");
    newWin!.document.write(`
      <html>
        <head>
          <title>Kitchen Prep List</title>
          <style>
            @media print {
              body { font-family: Arial, sans-serif; }
              button, input, .no-print { display: none; }
              table { width: 100%; border-collapse: collapse; font-size: 12pt; }
              th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            }
          </style>
        </head>
        <body>${printContents}</body>
      </html>`);
    newWin!.document.close();
    newWin!.focus();
    newWin!.print();
    newWin!.close();
  };

  // --- Permissions check below hooks only ---
  if (status === "loading") return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!user || user.role !== "SCHOOLADMIN" || !schoolId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <span className="text-lg font-bold text-destructive">Unauthorized</span>
        <span className="text-muted-foreground mt-2">You do not have permission to view this page.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lunch Orders</h1>
      <div className="flex flex-wrap gap-4 items-end no-print">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        {classrooms.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Classroom</label>
            <Select value={classroomId} onValueChange={setClassroomId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Classroom" />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="button" onClick={fetchData} className="gap-2">
          <RefreshCw size={18} /> Refresh
        </Button>
        <Button type="button" onClick={handlePrint} className="gap-2">
          <Printer size={18} /> Print
        </Button>
      </div>
      <div ref={printRef}>
        <PrepSummaryTable rows={rows} />
      </div>
    </div>
  );
}
