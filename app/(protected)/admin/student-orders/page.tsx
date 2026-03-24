"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, School2, Users, X } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type School = {
  id: string;
  name: string;
};

type Classroom = {
  id: string;
  name: string;
  schoolId: string;
};

type Student = {
  id: string;
  name: string;
  status?: string;
  classroomId: string;
  classroom?: {
    id: string;
    name: string;
    schoolId: string;
  };
};

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export default function StudentOrdersSearchPage() {
  const router = useRouter();

  const [schools, setSchools] = useState<School[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [schoolQuery, setSchoolQuery] = useState("");
  const [classroomQuery, setClassroomQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState("all");

  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const debouncedStudentQuery = useDebouncedValue(studentQuery, 300);
  const isGlobalSearch = debouncedStudentQuery.trim().length > 0;
  const hasTypedSearch = studentQuery.trim().length > 0;

  useEffect(() => {
    setLoadingSchools(true);

    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools(Array.isArray(data) ? data : []))
      .catch(() => setSchools([]))
      .finally(() => setLoadingSchools(false));
  }, []);

  useEffect(() => {
    if (isGlobalSearch) {
      setClassrooms([]);
      return;
    }

    if (!selectedSchoolId) {
      setClassrooms([]);
      setSelectedClassroomId("all");
      return;
    }

    const controller = new AbortController();
    setLoadingClassrooms(true);

    fetch(`/api/classrooms?schoolId=${encodeURIComponent(selectedSchoolId)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setClassrooms(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.name !== "AbortError") setClassrooms([]);
      })
      .finally(() => setLoadingClassrooms(false));

    return () => controller.abort();
  }, [selectedSchoolId, isGlobalSearch]);

  useEffect(() => {
    const controller = new AbortController();

    if (!isGlobalSearch && !selectedSchoolId) {
      setStudents([]);
      return () => controller.abort();
    }

    let url = `/api/pupils?take=50`;

    if (isGlobalSearch) {
      url += `&q=${encodeURIComponent(debouncedStudentQuery.trim())}`;
    } else {
      url += `&schoolId=${encodeURIComponent(selectedSchoolId)}`;

      if (selectedClassroomId && selectedClassroomId !== "all") {
        url += `&classroomId=${encodeURIComponent(selectedClassroomId)}`;
      }
    }

    setLoadingStudents(true);

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.name !== "AbortError") setStudents([]);
      })
      .finally(() => setLoadingStudents(false));

    return () => controller.abort();
  }, [selectedSchoolId, selectedClassroomId, debouncedStudentQuery, isGlobalSearch]);

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, schoolQuery]);

  const filteredClassrooms = useMemo(() => {
    const q = classroomQuery.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter((c) => c.name.toLowerCase().includes(q));
  }, [classrooms, classroomQuery]);

  const schoolNameMap = useMemo(() => {
    return new Map(schools.map((s) => [s.id, s.name]));
  }, [schools]);

  function handleViewOrders(studentId: string) {
    router.push(`/admin/student-orders/${studentId}`);
  }

  function clearGlobalSearch() {
    setStudentQuery("");
  }

  function handleSelectSchool(schoolId: string) {
    setSelectedSchoolId(schoolId);
    setSelectedClassroomId("all");
    setClassroomQuery("");
  }

  const resultLabel = loadingStudents
    ? "Searching..."
    : `${students.length} result${students.length === 1 ? "" : "s"}`;

  return (
    <div className="bg-[#F4F7FA] p-6 space-y-6">
      <DashboardHeader
        heading="Student Order Search"
        text="Search all schools for a student, or drill down by school and classroom."
      />

      {/* Global search */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#27364B]">Search all schools</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Search by student name across every school. While search is active, filters are paused.
          </p>
        </div>

        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Search student name across all schools..."
            className="pl-9 pr-24"
          />
          {hasTypedSearch && (
            <button
              type="button"
              onClick={clearGlobalSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {hasTypedSearch && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
            Global search is active. School and classroom filters are temporarily disabled until you
            clear the search.
          </div>
        )}
      </div>

      {/* Drill-down filters */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-[#27364B]">Browse by school and classroom</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Use filters to narrow to one school or classroom when you do not need a global search.
          </p>
        </div>

        <div className={isGlobalSearch ? "pointer-events-none opacity-50" : ""}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#27364B]">
                <School2 className="h-4 w-4" />
                School
              </div>

              <Input
                value={schoolQuery}
                onChange={(e) => setSchoolQuery(e.target.value)}
                placeholder="Search schools..."
                disabled={isGlobalSearch}
              />

              <div className="max-h-64 overflow-y-auto rounded-xl border bg-white">
                {loadingSchools ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">Loading schools...</div>
                ) : filteredSchools.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No schools found.</div>
                ) : (
                  filteredSchools.map((school) => (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => handleSelectSchool(school.id)}
                      disabled={isGlobalSearch}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                        selectedSchoolId === school.id ? "bg-slate-100 font-medium" : ""
                      }`}
                    >
                      {school.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#27364B]">
                <Users className="h-4 w-4" />
                Classroom
              </div>

              <Input
                value={classroomQuery}
                onChange={(e) => setClassroomQuery(e.target.value)}
                placeholder="Search classrooms..."
                disabled={!selectedSchoolId || isGlobalSearch}
              />

              <div className="max-h-64 overflow-y-auto rounded-xl border bg-white">
                <button
                  type="button"
                  onClick={() => setSelectedClassroomId("all")}
                  disabled={!selectedSchoolId || isGlobalSearch}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 ${
                    selectedClassroomId === "all" ? "bg-slate-100 font-medium" : ""
                  }`}
                >
                  All Classrooms
                </button>

                {!selectedSchoolId ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    Select a school first.
                  </div>
                ) : loadingClassrooms ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    Loading classrooms...
                  </div>
                ) : filteredClassrooms.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    No classrooms found.
                  </div>
                ) : (
                  filteredClassrooms.map((classroom) => (
                    <button
                      key={classroom.id}
                      type="button"
                      onClick={() => setSelectedClassroomId(classroom.id)}
                      disabled={isGlobalSearch}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                        selectedClassroomId === classroom.id ? "bg-slate-100 font-medium" : ""
                      }`}
                    >
                      {classroom.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#27364B]">Search Results</h2>
            <div className="text-sm text-muted-foreground">
              {isGlobalSearch
                ? "Showing global student search results"
                : selectedSchoolId
                  ? selectedClassroomId !== "all"
                    ? "Showing selected classroom"
                    : "Showing selected school"
                  : "Choose a school or search all schools"}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">{resultLabel}</div>
        </div>

        {loadingStudents ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-muted-foreground">
            Loading students...
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-muted-foreground">
            {isGlobalSearch
              ? "No students found matching that search."
              : selectedSchoolId
                ? "No students found for the current filters."
                : "Start with a student search or select a school to browse."}
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-2xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-base font-bold text-[#27364B]">{student.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Classroom: {student.classroom?.name ?? "Unknown"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    School:{" "}
                    {student.classroom?.schoolId
                      ? schoolNameMap.get(student.classroom.schoolId) ?? "Unknown"
                      : "Unknown"}
                  </div>
                  {student.status && (
                    <div className="text-sm text-muted-foreground">Status: {student.status}</div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={() => handleViewOrders(student.id)} className="gap-2">
                    View Orders <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}