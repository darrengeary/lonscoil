"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Printer } from "lucide-react";
import PrepSummaryTable, { PrepSummaryRow } from "@/components/supplier/PrepSummaryTable";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";

function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void; }) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? new Date(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"secondary"}
          className={cn("w-48 justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(selectedDate!, "yyyy-MM-dd") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={date => { if (date) onChange(format(date, "yyyy-MM-dd")); setOpen(false); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function PrepListPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(todayStr);

  // School and classroom dropdowns
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState("all");
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomId, setClassroomId] = useState("all");
  // Table data
  const [rows, setRows] = useState<PrepSummaryRow[]>([]);

  // Fetch schools on mount
  useEffect(() => {
    fetch("/api/schools")
      .then(res => res.json())
      .then(data => setSchools([{ id: "all", name: "All Schools" }, ...data]))
      .catch(() => setSchools([{ id: "all", name: "All Schools" }]));
  }, []);

  // Fetch classrooms when school changes
  useEffect(() => {
    if (schoolId === "all") {
      setClassrooms([]);
      setClassroomId("all");
      return;
    }
    fetch(`/api/classrooms?schoolId=${schoolId}`)
      .then(res => res.json())
      .then(data => setClassrooms([{ id: "all", name: "All Classrooms" }, ...data]))
      .catch(() => setClassrooms([{ id: "all", name: "All Classrooms" }]));
    setClassroomId("all");
  }, [schoolId]);

  // Fetch summary data
  const fetchData = () => {
    let url = `/api/kitchen-prep?date=${date}`;
    if (schoolId && schoolId !== "all") url += `&schoolId=${schoolId}`;
    if (classroomId && classroomId !== "all") url += `&classroomId=${classroomId}`;
    fetch(url)
      .then(res => res.json())
      .then((data) => setRows([...data].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))))
      .catch(() => setRows([]));
  };
  useEffect(fetchData, [date, schoolId, classroomId]);

  // Print handler: just call window.print()
  const handlePrint = () => {
    window.print();
  };

  // Totals
  const totalMeals = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const uniqueChoices = rows.length;

  return (
    <div className="bg-[#F4F7FA] p-6 space-y-6">
            <DashboardHeader
        heading="Order Summary"
        text="View daily lunch orders."
      />  
      {/* --- WEBPAGE ONLY --- */}
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
                {schools.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                  {classrooms.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="button" onClick={handlePrint} className="gap-2">
            <Printer size={18} /> Print
          </Button>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-3 mb-2">
          <div className="px-4 py-2 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-base flex items-center">
            Total Meals: <span className="ml-2 text-[#27364B] font-bold">{totalMeals}</span>
          </div>
          <div className="px-4 py-2 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-base flex items-center">
            Unique Choices: <span className="ml-2 text-[#27364B] font-bold">{uniqueChoices}</span>
          </div>
        </div>
        <PrepSummaryTable rows={rows} />
      </div>

      {/* --- PRINT ONLY --- */}
      <div className="hidden print:block w-full mt-6">
        <div className="text-center mb-4">
          <img src="/lunchlog.png" alt="LunchLog" style={{ height: 170, margin: "0 auto" }} />
          <div style={{ fontSize: 16, fontWeight: 600, margin: "12px 0 0 0" }}>
            Orders for: {date}
          </div>
        </div>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          marginTop: 12
        }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>Choice</th>
              <th style={{ border: "1px solid #000", padding: 8, textAlign: "left" }}>Meal Group</th>
              <th style={{ border: "1px solid #000", padding: 8, textAlign: "right" }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #000", padding: 8 }}>{row.choice}</td>
                <td style={{ border: "1px solid #000", padding: 8 }}>{row.group}</td>
                <td style={{ border: "1px solid #000", padding: 8, textAlign: "right"}}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
