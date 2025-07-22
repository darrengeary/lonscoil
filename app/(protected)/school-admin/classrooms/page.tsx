"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Users, ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader } from "lucide-react";

// Modal for add/edit classroom
function ClassroomModal({ open, onClose, onSaved, classroom, schoolId }) {
  const [name, setName] = useState(classroom?.name || "");
  const [totalPupils, setTotalPupils] = useState(classroom?.totalPupils || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(classroom?.name || "");
    setTotalPupils(classroom?.totalPupils || 0);
  }, [classroom]);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/classrooms", {
      method: classroom && classroom.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        classroom && classroom.id
          ? { id: classroom.id, name, totalPupils, schoolId }
          : { name, totalPupils, schoolId }
      ),
    });
    setLoading(false);
    if (res.ok) {
      onSaved();
      setName("");
      setTotalPupils(0);
      onClose();
      toast({ title: classroom && classroom.id ? "Classroom updated" : "Classroom added" });
    } else {
      toast({ title: "Failed to save classroom", variant: "destructive" });
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="bg-background border border-muted p-6 rounded-2xl shadow-2xl space-y-4 w-full max-w-sm"
      >
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {classroom && classroom.id ? "Edit Classroom" : "Add Classroom"}
        </h2>
        <input
          autoFocus
          className="w-full border px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Classroom name"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full border px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          type="number"
          min={0}
          placeholder="Total pupils"
          value={totalPupils}
          required
          onChange={(e) => setTotalPupils(Number(e.target.value))}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : classroom && classroom.id
              ? "Save Changes"
              : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function SchoolClassroomsPage() {
  const { data: session, status } = useSession();
  const schoolId = session?.user?.schoolId;
  const [school, setSchool] = useState<any>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalClassroom, setModalClassroom] = useState<any | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    async function fetchData() {
      setLoading(true);
      const [schoolRes, classroomsRes] = await Promise.all([
        fetch(`/api/schools/${schoolId}`),
        fetch(`/api/classrooms?schoolId=${schoolId}`),
      ]);
      const schoolData = await schoolRes.json();
      const classroomsData = await classroomsRes.json();
      setSchool(schoolData);
      setClassrooms(classroomsData);
      setLoading(false);
    }
    fetchData();
  }, [schoolId]);

  const reload = () => {
    if (!schoolId) return;
    setLoading(true);
    fetch(`/api/classrooms?schoolId=${schoolId}`)
      .then((res) => res.json())
      .then((data) => setClassrooms(data))
      .finally(() => setLoading(false));
  };

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user || session.user.role !== "SCHOOLADMIN") {
    return <div className="text-red-600">Unauthorized</div>;
  }

  return (
    <>
      <DashboardHeader
        heading={school ? `${school.name} – Classrooms` : "Classrooms"}
        text="Manage all classrooms for this school."
      />
      <div className="flex items-center justify-between mb-4">
        {/* No admin link; could link to main school-admin home if you want */}
        {/* <Link href="/school-admin">
          <Button variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back
          </Button>
        </Link> */}
        <div />
        <Button onClick={() => setModalClassroom({ schoolId })}>
          <Plus className="mr-2 h-4 w-4" /> Add Classroom
        </Button>
      </div>
      <ClassroomModal
        open={!!modalClassroom}
        onClose={() => setModalClassroom(null)}
        onSaved={reload}
        classroom={Object.keys(modalClassroom || {}).length ? modalClassroom : null}
        schoolId={schoolId}
      />
      <Card className="p-0 border-muted">
        {loading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : classrooms.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <Users className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No classrooms found</div>
            <div className="text-sm mb-2">Click "Add Classroom" to create your first classroom.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full table-auto border-separate border-spacing-y-1">
              <thead>
                <tr className="bg-muted/80">
                  <th className="text-left px-4 py-2 rounded-tl-2xl w-14">Edit</th>
                  <th className="text-left px-4 py-2 min-w-[120px]">Name</th>
                  <th className="text-left px-4 py-2">Registered</th>
                  <th className="text-left px-4 py-2">Unregistered</th>
                  <th className="text-left px-4 py-2 rounded-tr-2xl">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((cls) => (
                  <tr key={cls.id}>
                    <td className="px-4 py-2 w-14">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit Classroom"
                        onClick={() => setModalClassroom(cls)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                    <td className="px-4 py-2 font-medium min-w-[120px]">{cls.name}</td>
                    <td className="px-4 py-2 text-sm">{cls.registeredCount}</td>
                    <td className="px-4 py-2 text-sm">{cls.unregisteredCount}</td>
                    <td className="px-4 py-2">
                      <Link href={`/school-admin/classrooms/${cls.id}`}>
                        <Button variant="outline" size="sm">
                          Manage Pupils
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
