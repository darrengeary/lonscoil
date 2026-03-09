"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

type Classroom = {
  School: any;
  id: string;
  name: string;
  registeredCount: number;
  unregisteredCount: number;
};

export default function SchoolClassroomsPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const { schoolId } = params as { schoolId: string };

  const [school, setSchool] = useState<any>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [newClassroomName, setNewClassroomName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [addCounts, setAddCounts] = useState<Record<string, number>>({});
  const [bulkAdding, setBulkAdding] = useState(false);

  const fetchData = async () => {
    if (!schoolId) return;
    setLoading(true);

    try {
      const [schoolRes, classroomsRes] = await Promise.all([
        fetch(`/api/schools/${schoolId}`, { cache: "no-store" }),
        fetch(`/api/classrooms?schoolId=${schoolId}`, { cache: "no-store" }),
      ]);

      const schoolData = await schoolRes.json();
      const classroomsData = await classroomsRes.json();

      setSchool(schoolData);
      setClassrooms(Array.isArray(classroomsData) ? classroomsData : []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to load classrooms",
        variant: "destructive",
      });
      setClassrooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [schoolId]);

  useEffect(() => {
    setAddCounts((prev) => {
      const next = { ...prev };
      for (const cls of classrooms) {
        if (next[cls.id] === undefined) next[cls.id] = 0;
      }
      for (const k of Object.keys(next)) {
        if (!classrooms.some((c) => c.id === k)) delete next[k];
      }
      return next;
    });
  }, [classrooms]);

  const filteredClassrooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classrooms;

    return classrooms.filter((cls) => {
      const total = cls.registeredCount + cls.unregisteredCount;
      return (
        cls.name.toLowerCase().includes(q) ||
        String(cls.registeredCount).includes(q) ||
        String(total).includes(q)
      );
    });
  }, [classrooms, search]);

  const totalToAdd = useMemo(() => {
    return Object.values(addCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [addCounts]);

  const updateCount = (classroomId: string, value: number) => {
    const v = Number.isFinite(value) ? Math.max(0, Math.min(200, Math.floor(value))) : 0;
    setAddCounts((prev) => ({ ...prev, [classroomId]: v }));
  };

  const clearAllCounts = () => {
    const cleared: Record<string, number> = {};
    for (const cls of classrooms) cleared[cls.id] = 0;
    setAddCounts(cleared);
  };

  const startEdit = (cls: Classroom) => {
    setEditingId(cls.id);
    setEditValue(cls.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;

    try {
      setSavingEdit(true);

      const res = await fetch("/api/classrooms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: trimmed }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast({
          title: data?.error || "Failed to update classroom",
          variant: "destructive",
        });
        return;
      }

      setClassrooms((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
      );

      toast({ title: "Classroom updated" });
      cancelEdit();
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to update classroom",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const createClassroom = async () => {
    const name = newClassroomName.trim();
    if (!name) return;

    try {
      setCreating(true);

      const res = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, schoolId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast({
          title: data?.error || "Failed to add classroom",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Classroom added" });
      setNewClassroomName("");
      await fetchData();
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to add classroom",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const bulkAdd = async () => {
    const entries = Object.entries(addCounts).filter(([, n]) => (Number(n) || 0) > 0);
    if (entries.length === 0) return;

    try {
      setBulkAdding(true);

      const results = await Promise.all(
        entries.map(async ([classroomId, count]) => {
          const res = await fetch(`/api/classrooms/${classroomId}/add-unregistered-pupils`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count }),
          });

          return { classroomId, count, ok: res.ok };
        })
      );

      const ok = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      if (failed.length === 0) {
        toast({
          title: `Added ${ok.reduce((s, r) => s + r.count, 0)} pupil slots`,
        });
      } else {
        toast({
          title: `Added ${ok.reduce((s, r) => s + r.count, 0)} slots, ${failed.length} failed`,
          variant: "destructive",
        });
      }

      clearAllCounts();
      await fetchData();
    } catch (err) {
      console.error(err);
      toast({
        title: "Bulk add failed",
        variant: "destructive",
      });
    } finally {
      setBulkAdding(false);
    }
  };

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
    <div className="min-h-screen bg-[#F4F7FA] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardHeader
          heading={school ? `${school.name} – Classrooms` : "Classrooms"}
          text="Manage classrooms quickly with inline editing and bulk slot creation."
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/admin/schools">
            <Button variant="outline" className="rounded-2xl bg-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Schools
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={clearAllCounts}
              disabled={loading || totalToAdd === 0 || bulkAdding}
              className="rounded-2xl bg-white"
            >
              Clear adds
            </Button>

            <Button
              onClick={bulkAdd}
              disabled={loading || bulkAdding || totalToAdd === 0}
              className="rounded-2xl"
            >
              {bulkAdding ? "Adding…" : `Add Pupils (${totalToAdd})`}
            </Button>
          </div>
        </div>

        <Card className="rounded-3xl border-0 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 md:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid gap-4 md:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
                <div className="min-w-[280px]">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Search classrooms
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or count..."
                      className="h-11 rounded-2xl border-slate-200 pl-9 shadow-none"
                    />
                  </div>
                </div>

                <div className="min-w-[320px]">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Add classroom
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={newClassroomName}
                      onChange={(e) => setNewClassroomName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createClassroom();
                      }}
                      placeholder="e.g. Senior Infants B"
                      className="h-11 rounded-2xl border-slate-200 shadow-none"
                    />
                    <Button
                      onClick={createClassroom}
                      disabled={creating || !newClassroomName.trim()}
                      className="h-11 rounded-2xl px-5"
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-sm text-slate-500">
                {loading
                  ? "Loading..."
                  : `${filteredClassrooms.length} classroom${filteredClassrooms.length === 1 ? "" : "s"}`}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-muted-foreground">Loading…</div>
          ) : filteredClassrooms.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
              <Users className="h-10 w-10 text-slate-300" />
              <div className="text-lg font-semibold">No classrooms found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[minmax(280px,1.5fr)_140px_140px_180px_160px] gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <div>Classroom</div>
                  <div>Registered</div>
                  <div>Total</div>
                  <div>Add slots</div>
                  <div className="text-right">Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredClassrooms.map((cls) => {
                    const total = cls.registeredCount + cls.unregisteredCount;
                    const isEditing = editingId === cls.id;

                    return (
                      <div
                        key={cls.id}
                        className="grid grid-cols-[minmax(280px,1.5fr)_140px_140px_180px_160px] gap-4 px-5 py-4 transition hover:bg-slate-50/70"
                      >
                        <div className="min-w-0">
                          {!isEditing ? (
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/admin/schools/${schoolId}/classrooms/${cls.id}`}
                                className="min-w-0 flex-1"
                              >
                                <div className="truncate text-[15px] font-semibold text-slate-900 hover:text-[#4C9EEB]">
                                  {cls.name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {cls.School?.name}
                                </div>
                              </Link>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(cls.id);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                className="h-10 rounded-xl border-slate-300 shadow-none"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center">
                          <span className="inline-flex min-w-[82px] items-center justify-center rounded-full bg-[#FFEB99] px-3 py-1 text-xs font-semibold text-[#9E7A14]">
                            {cls.registeredCount}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span className="inline-flex min-w-[82px] items-center justify-center rounded-full bg-[#E7F1FA] px-3 py-1 text-xs font-semibold text-[#2E77B8]">
                            {total}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="number"
                            min={0}
                            max={200}
                            step={1}
                            value={addCounts[cls.id] ?? 0}
                            onChange={(e) => updateCount(cls.id, Number(e.target.value))}
                            className="h-10 w-24 rounded-xl border border-slate-200 bg-slate-50 px-3 text-right text-sm outline-none focus:border-slate-400"
                            aria-label={`Add unregistered pupils to ${cls.name}`}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {!isEditing ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(cls)}
                                className="rounded-xl border-slate-200 bg-white"
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>

                              <Link href={`/admin/schools/${schoolId}/classrooms/${cls.id}`}>
                                <Button size="sm" className="rounded-xl">
                                  Open
                                </Button>
                              </Link>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => saveEdit(cls.id)}
                                disabled={savingEdit || !editValue.trim()}
                                className="rounded-xl"
                              >
                                {savingEdit ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Save
                                  </>
                                )}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="rounded-xl border-slate-200"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}