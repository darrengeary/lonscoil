"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/header";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type School = { id: string; name: string };
type Classroom = { id: string; name: string };
type Pupil = { id: string; name: string; classroomId: string; classroom?: { id: string; name: string } };

type AbsenceScope = "CLASSROOM" | "PUPIL";

type AbsenceRecord = {
  id: string;
  name: string;
  scope: AbsenceScope;
  startDate: string;
  endDate: string;
  notes?: string | null;
  schoolId: string;
  school?: { id: string; name: string };
  classroomId?: string | null;
  classroom?: { id: string; name: string } | null;
  pupilId?: string | null;
  pupil?: { id: string; name: string } | null;
};

type AbsenceForm = {
  id?: string;
  name: string;
  scope: AbsenceScope;
  classroomId: string;
  pupilId: string;
  startDate: string;
  endDate: string;
  notes: string;
};

export default function AdminAbsencesPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("all");

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomId, setClassroomId] = useState("all");

  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [pupilId, setPupilId] = useState("all");

  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AbsenceForm | null>(null);

  const canWrite = schoolId !== "all";

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data: School[]) => setSchools([{ id: "all", name: "All Schools" }, ...(data ?? [])]))
      .catch(() => setSchools([{ id: "all", name: "All Schools" }]));
  }, []);

  useEffect(() => {
    const url =
      schoolId !== "all" ? `/api/classrooms?schoolId=${schoolId}` : "/api/classrooms";

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setClassrooms([{ id: "all", name: "All Classrooms" }, ...arr]);
      })
      .catch(() => setClassrooms([{ id: "all", name: "All Classrooms" }]));

    setClassroomId("all");
    setPupilId("all");
  }, [schoolId]);

  useEffect(() => {
    let url = "/api/pupils";
    if (classroomId !== "all") {
      url += `?classroomId=${classroomId}`;
    } else if (schoolId !== "all") {
      url += `?schoolId=${schoolId}`;
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setPupils(arr);
      })
      .catch(() => setPupils([]));
  }, [schoolId, classroomId]);

  async function refreshAbsences() {
    setLoading(true);
    try {
      let url = "/api/absences";
      const params = new URLSearchParams();
      if (schoolId !== "all") params.set("schoolId", schoolId);
      if (classroomId !== "all") params.set("classroomId", classroomId);
      if (pupilId !== "all") params.set("pupilId", pupilId);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const data = await fetch(url).then((r) => r.json());
      setAbsences(data?.error ? [] : data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAbsences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, classroomId, pupilId]);

  function openCreate() {
    if (!canWrite) return;
    setEditing({
      name: "",
      scope: "CLASSROOM",
      classroomId: classroomId !== "all" ? classroomId : "",
      pupilId: "",
      startDate: "",
      endDate: "",
      notes: "",
    });
    setEditOpen(true);
  }

  function openEdit(a: AbsenceRecord) {
    setEditing({
      id: a.id,
      name: a.name,
      scope: a.scope,
      classroomId: a.classroomId ?? "",
      pupilId: a.pupilId ?? "",
      startDate: format(new Date(a.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(a.endDate), "yyyy-MM-dd"),
      notes: a.notes ?? "",
    });
    setEditOpen(true);
  }

  async function saveAbsence(form: AbsenceForm) {
    if (!canWrite) return;

    const method = form.id ? "PUT" : "POST";
    const url = form.id ? "/api/absences" : `/api/absences?schoolId=${schoolId}`;

    const payload: any = {
      id: form.id,
      name: form.name,
      scope: form.scope,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: form.notes,
    };

    if (form.scope === "CLASSROOM") {
      payload.classroomId = form.classroomId;
      payload.pupilId = null;
    } else {
      payload.pupilId = form.pupilId;
      payload.classroomId = form.classroomId || null;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

    if (res?.error) {
      alert(res.error);
      return;
    }

    setEditOpen(false);
    setEditing(null);
    await refreshAbsences();
  }

  async function deleteAbsence(id: string) {
    if (!confirm("Delete this absence?")) return;

    const res = await fetch("/api/absences", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());

    if (res?.error) {
      alert(res.error);
      return;
    }

    await refreshAbsences();
  }

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }

  if (!userRole || userRole !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <span className="text-lg font-bold text-destructive">Unauthorized</span>
        <span className="text-muted-foreground mt-2">
          You do not have permission to view this page.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-8">
      <DashboardHeader
        heading="Absences"
        text="Create absences for a classroom or an individual pupil. Absences must be created at least 36 hours in advance."
      />

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">School</label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger className="w-64 bg-white">
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

        <div>
          <label className="block text-sm font-medium mb-1">Classroom</label>
          <Select value={classroomId} onValueChange={setClassroomId}>
            <SelectTrigger className="w-64 bg-white">
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

        <div>
          <label className="block text-sm font-medium mb-1">Pupil</label>
          <Select value={pupilId} onValueChange={setPupilId}>
            <SelectTrigger className="w-64 bg-white">
              <SelectValue placeholder="Select Pupil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pupils</SelectItem>
              {pupils.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreate} disabled={!canWrite}>
          + New Absence
        </Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      <div className="overflow-x-auto rounded-2xl shadow-sm bg-white">
        <table className="min-w-[800px] w-full text-sm text-left rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-[#F4F7FA]">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Scope</th>
              <th className="py-3 px-4">Classroom</th>
              <th className="py-3 px-4">Pupil</th>
              <th className="py-3 px-4">Dates</th>
              <th className="py-3 px-4">Notes</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {absences.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-3 px-4 font-medium">{a.name}</td>
                <td className="py-3 px-4">{a.scope === "CLASSROOM" ? "Classroom" : "Pupil"}</td>
                <td className="py-3 px-4">{a.classroom?.name ?? "-"}</td>
                <td className="py-3 px-4">{a.pupil?.name ?? "-"}</td>
                <td className="py-3 px-4">
                  {format(new Date(a.startDate), "d MMM yyyy")} – {format(new Date(a.endDate), "d MMM yyyy")}
                </td>
                <td className="py-3 px-4">{a.notes ?? "-"}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteAbsence(a.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {absences.length === 0 && (
              <tr>
                <td className="py-6 px-4 text-muted-foreground" colSpan={7}>
                  No absences found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="bg-white shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Absence" : "New Absence"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));

                saveAbsence({
                  id: editing.id,
                  name: String(data.name ?? ""),
                  scope: data.scope as AbsenceScope,
                  classroomId: String(data.classroomId ?? ""),
                  pupilId: String(data.pupilId ?? ""),
                  startDate: String(data.startDate ?? ""),
                  endDate: String(data.endDate ?? ""),
                  notes: String(data.notes ?? ""),
                });
              }}
            >
              <div>
                <label className="block mb-1 text-sm font-medium">Name</label>
                <input
                  name="name"
                  defaultValue={editing.name}
                  required
                  className="w-full border rounded p-2"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Scope</label>
                <select
                  name="scope"
                  defaultValue={editing.scope}
                  className="w-full border rounded p-2"
                >
                  <option value="CLASSROOM">Classroom</option>
                  <option value="PUPIL">Pupil</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Classroom</label>
                <select
                  name="classroomId"
                  defaultValue={editing.classroomId}
                  className="w-full border rounded p-2"
                >
                  <option value="">Select classroom</option>
                  {classrooms
                    .filter((c) => c.id !== "all")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Pupil</label>
                <select
                  name="pupilId"
                  defaultValue={editing.pupilId}
                  className="w-full border rounded p-2"
                >
                  <option value="">Select pupil</option>
                  {pupils.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-1 text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={editing.startDate}
                    required
                    className="w-full border rounded p-2"
                  />
                </div>

                <div className="flex-1">
                  <label className="block mb-1 text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={editing.endDate}
                    required
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium">Notes</label>
                <textarea
                  name="notes"
                  defaultValue={editing.notes}
                  className="w-full border rounded p-2 min-h-[90px]"
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Absences cannot be created, updated, or deleted within 36 hours of the start date.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit">{editing.id ? "Update" : "Create"}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}