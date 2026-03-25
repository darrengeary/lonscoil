"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, X, User, ArrowLeft, Loader, Plus, Printer } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/use-toast";
/* ---------------- STATUS HELPERS ---------------- */

function statusLabel(status: unknown) {
  if (typeof status !== "string") return "UNKNOWN";
  const trimmed = status.trim();
  return trimmed || "UNKNOWN";
}

function statusBadgeClass(status: unknown) {
  const value = typeof status === "string" ? status.trim().toUpperCase() : "";

  if (value === "UNREGISTERED") {
    return "inline-block px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-bold";
  }

  if (value === "REGISTERED") {
    return "inline-block px-3 py-1 rounded-full bg-[#E7F8F0] text-[#56C596] text-xs font-bold";
  }

  return "inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold";
}

/* ---------------- ADD PUPILS MODAL ---------------- */

function AddPupilsModal({
  open,
  onClose,
  onSaved,
  classroomId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  classroomId: string;
}) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/classrooms/${classroomId}/add-unregistered-pupils`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });

    setLoading(false);

    if (res.ok) {
      onSaved();
      setCount(1);
      onClose();
      toast({ title: `Added ${count} pupil slot${count > 1 ? "s" : ""}` });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({
        title: err?.error || "Failed to add pupils",
        variant: "destructive",
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-muted bg-background p-6 shadow-2xl"
      >
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <User className="h-5 w-5 text-primary" />
          Add Unregistered Pupils
        </h2>

        <input
          type="number"
          min={1}
          max={100}
          className="w-full rounded-lg border bg-muted px-3 py-2"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          required
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Add"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- PARENT DETAILS MODAL ---------------- */

function ParentDetailsModal({
  open,
  onClose,
  parentId,
}: {
  open: boolean;
  onClose: () => void;
  parentId: string | null;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !parentId) return;

    (async () => {
      setLoading(true);
      const res = await fetch(`/api/parents/${parentId}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [open, parentId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-muted bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xl font-bold">Parent details</div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : data?.error ? (
          <div className="text-destructive">{data.error}</div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="font-semibold text-[#27364B]">{data?.parent?.name || "—"}</div>
              <div className="text-sm text-muted-foreground">{data?.parent?.email || "—"}</div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold">Linked pupils</div>
              <div className="space-y-2">
                {(data?.pupils || []).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.classroom?.name || "—"}
                      </div>
                    </div>
                    <div className={statusBadgeClass(p.status)}>
                      {statusLabel(p.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- MOVE PUPILS MODAL ---------------- */

function MovePupilsModal({
  open,
  onClose,
  pupilIds,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  pupilIds: string[];
  onMoved: () => void;
}) {
  const [schools, setSchools] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [toClassroomId, setToClassroomId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await fetch("/api/schools");
      const data = await res.json();
      setSchools(Array.isArray(data) ? data : []);
      setSchoolId("");
      setClassrooms([]);
      setToClassroomId("");
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !schoolId) return;
    (async () => {
      const res = await fetch(`/api/classrooms?schoolId=${schoolId}`);
      const data = await res.json();
      setClassrooms(Array.isArray(data) ? data : []);
      setToClassroomId("");
    })();
  }, [open, schoolId]);

  const submit = async () => {
    if (!toClassroomId || pupilIds.length === 0) return;

    setLoading(true);
    const res = await fetch("/api/pupils/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilIds, toClassroomId }),
    });
    setLoading(false);

    if (res.ok) {
      toast({ title: `Moved ${pupilIds.length} pupil${pupilIds.length > 1 ? "s" : ""}` });
      onMoved();
      onClose();
    } else {
      const err = await res.json().catch(() => ({}));
      toast({
        title: err?.error || "Failed to move pupils",
        variant: "destructive",
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-muted bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xl font-bold">Move pupils</div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Selected: <span className="font-semibold">{pupilIds.length}</span>
          </div>

          <div>
            <label className="text-sm font-semibold">School</label>
            <select
              className="mt-1 w-full rounded-lg border bg-muted px-3 py-2"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="">Select school…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold">Classroom</label>
            <select
              className="mt-1 w-full rounded-lg border bg-muted px-3 py-2"
              value={toClassroomId}
              onChange={(e) => setToClassroomId(e.target.value)}
              disabled={!schoolId}
            >
              <option value="">Select classroom…</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={loading || !toClassroomId || pupilIds.length === 0}>
              {loading ? "Moving…" : "Move"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- MAIN PAGE ---------------- */

export default function ClassroomPupilsPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;

  const { schoolId, classroomId } = params as {
    schoolId: string;
    classroomId: string;
  };

  const [classroom, setClassroom] = useState<any>(null);
  const [pupils, setPupils] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const [parentModalId, setParentModalId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const toggleOne = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const clearSelected = () => setSelected({});
  const selectAll = () => {
    const all: Record<string, boolean> = {};
    pupils.forEach((p) => {
      all[p.id] = true;
    });
    setSelected(all);
  };
  const deselectAll = () => setSelected({});

  const schoolName = "School Name";
  const logoUrl = "/logo.svg";

  const letterTemplate = `Dear Parent/Guardian,

Please use the following registration code to register your child on our online system.

Thank you,
${schoolName}`;

  const fetchData = async () => {
    setLoading(true);

    const [classRes, pupilsRes] = await Promise.all([
      fetch(`/api/classrooms/${classroomId}`),
      fetch(`/api/pupils?classroomId=${classroomId}`),
    ]);

    const classroomData = await classRes.json();
    const pupilsData = await pupilsRes.json();

    setClassroom(classroomData);
    setPupils(Array.isArray(pupilsData) ? pupilsData : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [classroomId]);

  if (status === "loading") {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }

  if (!userRole || userRole !== "ADMIN") {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <span className="text-lg font-bold text-destructive">Unauthorized</span>
        <span className="mt-2 text-muted-foreground">
          You do not have permission to view this page.
        </span>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader
        heading={classroom ? `${classroom.name} – Pupils` : "Pupils"}
        text="Manage and register pupils for this classroom."
      />

      <div className="mb-4 flex items-center justify-between">
        <Link href={`/admin/schools/${schoolId}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Classrooms
          </Button>
        </Link>

        <div className="flex gap-2">

          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Pupils
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => (selectedIds.length === pupils.length ? deselectAll() : selectAll())}
          disabled={loading || pupils.length === 0}
        >
          {selectedIds.length === pupils.length ? "Clear all" : "Select all"}
        </Button>

        <Button onClick={() => setShowMoveModal(true)} disabled={selectedIds.length === 0}>
          Move selected ({selectedIds.length})
        </Button>
      </div>

      <AddPupilsModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={fetchData}
        classroomId={classroomId}
      />

      <ParentDetailsModal
        open={!!parentModalId}
        onClose={() => setParentModalId(null)}
        parentId={parentModalId}
      />

      <MovePupilsModal
        open={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        pupilIds={selectedIds}
        onMoved={() => {
          clearSelected();
          fetchData();
        }}
      />

      <Card className="border-muted p-0">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader className="h-7 w-7 animate-spin" />
            <div className="font-medium">Loading pupils…</div>
          </div>
        ) : pupils.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <User className="mb-1 h-10 w-10 text-muted" />
            <div className="text-lg font-semibold">No pupils found</div>
            <div className="mb-2 text-sm">
              Click &quot;Add Pupils&quot; to create unregistered slots.
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
              <table className="min-w-[700px] w-full overflow-hidden rounded-2xl text-left text-sm">
                <thead>
                  <tr className="bg-[#F4F7FA]">
                    <th className="w-12 rounded-tl-2xl px-4 py-3 font-semibold text-[#27364B]">
                      Sel
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#27364B]">Code</th>
                    <th className="px-4 py-3 font-semibold text-[#27364B]">Name</th>
                    <th className="px-4 py-3 font-semibold text-[#27364B]">Status</th>
                    <th className="w-16 rounded-tr-2xl px-4 py-3 font-semibold text-[#27364B]">
                      Edit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pupils.map((pupil, idx) => (
                    <tr
                      key={pupil.id}
                      className={
                        (idx % 2 === 0 ? "bg-white" : "bg-[#F4F7FA]") +
                        " transition-colors hover:bg-[#E7F1FA]"
                      }
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!selected[pupil.id]}
                          onChange={() => toggleOne(pupil.id)}
                          className="h-4 w-4"
                          aria-label={`Select ${pupil.name || pupil.id}`}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-[#E7F1FA] px-3 py-1 font-mono text-xs font-bold text-[#4C9EEB]">
                          {pupil.id}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-medium text-[#27364B]">
                        {pupil.name || (
                          <span className="italic text-muted-foreground">Not set</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(pupil.status)}>
                          {statusLabel(pupil.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setParentModalId(pupil.parentId)}
                          disabled={!pupil.parentId}
                          aria-label="View parent details"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {pupils.map((pupil) => (
                <div
                  key={pupil.id}
                  className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[pupil.id]}
                        onChange={() => toggleOne(pupil.id)}
                        className="h-4 w-4"
                        aria-label={`Select ${pupil.name || pupil.id}`}
                      />
                      <span className="inline-block rounded-full bg-[#E7F1FA] px-3 py-1 font-mono text-xs font-bold text-[#4C9EEB]">
                        {pupil.id}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setParentModalId(pupil.parentId)}
                      disabled={!pupil.parentId}
                      aria-label="View parent details"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-base font-medium text-[#27364B]">
                    {pupil.name || (
                      <span className="italic text-muted-foreground">Not set</span>
                    )}
                  </div>

                  <div>
                    <span className={statusBadgeClass(pupil.status)}>
                      {statusLabel(pupil.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  );
}