"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  School2,
  Loader2,
  X,
  Search,
  ChevronRight,
  Check,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

type SchoolRow = {
  id: string;
  name: string;
  classroomCount: number;
  registeredCount: number;
  unregisteredCount: number;
};

function AddSchoolsWithClassroomsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Array<{ name: string; classroomCount: number }>>([
    { name: "", classroomCount: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addRow = () => {
    setRows((prev) => [...prev, { name: "", classroomCount: 0 }]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const updateRow = (
    idx: number,
    patch: Partial<{ name: string; classroomCount: number }>
  ) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const cleaned = rows
    .map((r) => ({
      name: r.name.trim(),
      classroomCount: Number.isFinite(r.classroomCount)
        ? Math.max(0, Math.min(200, Math.floor(r.classroomCount)))
        : 0,
    }))
    .filter((r) => r.name.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cleaned.length === 0) {
      toast({ title: "Add at least one school name", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cleaned }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast({
          title: data?.error || "Failed to create schools",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: `Created ${cleaned.length} school${cleaned.length > 1 ? "s" : ""}`,
      });

      setRows([{ name: "", classroomCount: 0 }]);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to create schools", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <School2 className="h-5 w-5 text-slate-700" />
              Add schools
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create multiple schools at once and optionally auto-create classroom slots.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-6">
          <div className="hidden grid-cols-[minmax(280px,1fr)_160px_80px] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <div>School name</div>
            <div>Classrooms</div>
            <div />
          </div>

          <div className="max-h-[50vh] space-y-3 overflow-auto pr-1">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:grid-cols-[minmax(280px,1fr)_160px_80px] md:items-center"
              >
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(idx, { name: e.target.value })}
                  placeholder="School name"
                  className="h-11 rounded-xl border-slate-200 bg-white shadow-none"
                />

                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={row.classroomCount}
                  onChange={(e) =>
                    updateRow(idx, { classroomCount: Number(e.target.value) })
                  }
                  placeholder="0"
                  className="h-11 rounded-xl border-slate-200 bg-white shadow-none"
                />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeRow(idx)}
                    className="rounded-xl"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={addRow} className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Add row
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || cleaned.length === 0}
                className="rounded-xl"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Create ({cleaned.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [search, setSearch] = useState("");

  const loadSchools = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schools", { cache: "no-store" });
      const data = await res.json();
      setSchools(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSchools([]);
      toast({ title: "Failed to load schools", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;

    return schools.filter((school) => {
      const totalStudents = school.registeredCount + school.unregisteredCount;
      return (
        school.name.toLowerCase().includes(q) ||
        String(school.classroomCount).includes(q) ||
        String(totalStudents).includes(q) ||
        String(school.registeredCount).includes(q)
      );
    });
  }, [schools, search]);

  return (
    <div className="min-h-screen bg-[#F4F7FA] p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardHeader
          heading="Schools"
          text="Manage all schools in one place with quick search and bulk creation."
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools by name or counts..."
                className="h-11 rounded-2xl border-slate-200 bg-white pl-9 shadow-none"
              />
            </div>
          </div>

          <Button onClick={() => setShowAddModal(true)} className="rounded-2xl">
            <Plus className="mr-2 h-4 w-4" />
            Add Schools
          </Button>
        </div>

        <AddSchoolsWithClassroomsModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSaved={loadSchools}
        />

        <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">School list</h2>
                <p className="text-sm text-slate-500">
                  {loading
                    ? "Loading..."
                    : `${filteredSchools.length} school${filteredSchools.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin" />
              <div className="font-medium">Loading school data…</div>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
              <School2 className="h-10 w-10 text-slate-300" />
              <div className="text-lg font-semibold">No schools found</div>
              <div className="text-sm">Schools will appear here when added to the system.</div>
            </div>
          ) : (
            <div className="max-h-[72vh] overflow-auto">
              <div className="min-w-[980px]">
                <div className="sticky top-0 z-10 text-left grid grid-cols-[minmax(260px,1.6fr)_140px_160px_160px_100px] gap-4 border-b border-slate-100 bg-slate-50/95 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                  <div>School</div>
                  <div>Classrooms</div>
                  <div>Total Slots</div>
                  <div>Registered Students</div>
                  <div className="text-right">Open</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredSchools.map((school) => {
                    const totalStudents =
                      (school.registeredCount ?? 0) + (school.unregisteredCount ?? 0);

                    return (
                      <div
                        key={school.id}
                        className="grid grid-cols-[minmax(260px,1.6fr)_140px_160px_160px_100px] gap-4 px-5 py-4 transition hover:bg-slate-50/70"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/admin/schools/${school.id}`}
                            className="block min-w-0"
                          >
                            <div className="truncate text-[15px] font-semibold text-slate-900 hover:text-[#4C9EEB]">
                              {school.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Open school details
                            </div>
                          </Link>
                        </div>

                        <div className="flex items-center">
                          <span className="inline-flex min-w-[90px] items-center justify-center rounded-full bg-[#E7F8F0] px-3 py-1 text-xs font-semibold text-[#2F8F68]">
                            {school.classroomCount}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span className="inline-flex min-w-[110px] items-center justify-center rounded-full bg-[#E7F1FA] px-3 py-1 text-xs font-semibold text-[#2E77B8]">
                            {totalStudents}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span className="inline-flex min-w-[100px] items-center justify-center rounded-full bg-[#FFEB99] px-3 py-1 text-xs font-semibold text-[#9E7A14]">
                            {school.registeredCount}
                          </span>
                        </div>

                        <div className="flex items-center justify-end">
                          <Link href={`/admin/schools/${school.id}`}>
                            <Button size="sm" className="rounded-xl">
                              Open
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </Link>
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