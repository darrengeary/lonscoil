"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import PrepSummaryTable, { PrepSummaryRow } from "@/components/supplier/PrepSummaryTable";

export default function PrepListPage() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(todayStr);

  // School and classroom dropdowns
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [classroomId, setClassroomId] = useState("");

  // Table data
  const [rows, setRows] = useState<PrepSummaryRow[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch schools on mount
  useEffect(() => {
    fetch("/api/schools")
      .then(res => res.json())
      .then(data => setSchools([{ id: "", name: "All Schools" }, ...data]))
      .catch(() => setSchools([{ id: "", name: "All Schools" }]));
  }, []);

  // Fetch classrooms when school changes
  useEffect(() => {
    if (!schoolId) {
      setClassrooms([]);
      setClassroomId("");
      return;
    }
    fetch(`/api/classrooms?schoolId=${schoolId}`)
      .then(res => res.json())
      .then(data => setClassrooms([{ id: "", name: "All Classrooms" }, ...data]))
      .catch(() => setClassrooms([{ id: "", name: "All Classrooms" }]));
    setClassroomId(""); // reset classroom when school changes
  }, [schoolId]);

  // Fetch summary data
  const fetchData = () => {
    let url = `/api/kitchen-prep?date=${date}`;
    if (schoolId) url += `&schoolId=${schoolId}`;
    if (classroomId) url += `&classroomId=${classroomId}`;
    fetch(url)
      .then(res => res.json())
      .then(setRows)
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

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Kitchen Prep List</h1>
      <div className="flex flex-wrap gap-4 items-end no-print">
        <div>
          <label className="block text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border px-2 py-1 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">School</label>
          <select
            value={schoolId}
            onChange={e => setSchoolId(e.target.value)}
            className="border px-2 py-1 rounded"
          >
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Classroom</label>
          <select
            value={classroomId}
            onChange={e => setClassroomId(e.target.value)}
            className="border px-2 py-1 rounded"
            disabled={!schoolId || classrooms.length === 0}
          >
            {classrooms.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <Button onClick={fetchData}>🔍 Refresh</Button>
        <Button onClick={handlePrint}>🖨️ Print</Button>
      </div>
      <div ref={printRef}>
        <PrepSummaryTable rows={rows} />
      </div>
    </div>
  );
}
