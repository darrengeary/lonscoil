"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Users } from "lucide-react";
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
          : { name, schoolId }
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
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
        {/* Only show total pupils input for edit, not add */}
        {classroom && classroom.id && (
          <input
            className="w-full border px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
            type="number"
            min={0}
            placeholder="Total pupils"
            value={totalPupils}
            required
            onChange={(e) => setTotalPupils(Number(e.target.value))}
          />
        )}
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
    <div className="w-full overflow-x-hidden"> {/* clamp any horizontal spill */}
      <DashboardHeader
        heading={school ? `${school.name} – Classrooms` : "Classrooms"}
        text="Manage all classrooms for this school."
      />

      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
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

      <Card className="p-0 border-muted overflow-hidden"> {/* contain rings/absolutes */}
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <Loader className="w-7 h-7 animate-spin" />
            <div className="font-medium">Loading classroom data…</div>
            <div className="text-xs">Hang tight, fetching records from the server.</div>
          </div>
        ) : classrooms.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <Users className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No classrooms found</div>
            <div className="text-sm mb-2">Click "Add Classroom" to create your first classroom.</div>
          </div>
        ) : (
          <div className="w-full bg-[#F4F7FA] px-4 sm:px-6"> {/* responsive padding */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {classrooms.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/school-admin/classrooms/${cls.id}`}
                  className="group relative block w-full overflow-hidden bg-white border border-transparent rounded-3xl p-7 shadow-sm hover:shadow-lg transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9E7D6]"
                  tabIndex={0}
                  aria-label={`Manage pupils for ${cls.name}`}
                >
                  {/* Keep this small so it can't push width */}
                  <div className="absolute right-6 top-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#56C596] opacity-80 group-hover:text-[#4C9EEB] transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M9 6l6 6-6 6" />
                    </svg>
                  </div>

                  <div className="flex items-center gap-2 mb-4 pr-10"> {/* padding so text doesn't touch arrow */}
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#E7F8F0] text-[#56C596]">
                      <Users className="w-5 h-5" />
                    </span>
                    <span className="text-xl font-bold text-[#27364B] truncate">{cls.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit Classroom"
                      className="ml-auto"
                      onClick={e => {
                        e.preventDefault();
                        setModalClassroom(cls);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <div className="px-3 py-1 rounded-full bg-[#E7F1FA] text-[#4C9EEB] font-semibold text-sm flex items-center">
                      Registered: <span className="ml-2 text-[#27364B] font-bold">{cls.registeredCount}</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[#FFEB99] text-[#B79B46] font-semibold text-sm flex items-center">
                      Unregistered: <span className="ml-2 text-[#27364B] font-bold">{cls.unregisteredCount}</span>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-sm flex items-center">
                      Pupils: <span className="ml-2 text-[#27364B] font-bold">{cls.registeredCount + cls.unregisteredCount}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
