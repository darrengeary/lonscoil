"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ClassroomOption = {
  id: string;
  name: string;
  registeredCount: number;
  unregisteredCount: number;
};

export default function PrintRegistrationLettersModal({
  open,
  onClose,
  schoolId,
  schoolName,
  classrooms,
}: {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  schoolName: string;
  classrooms: ClassroomOption[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;

    const initial: Record<string, boolean> = {};
    for (const cls of classrooms) {
      initial[cls.id] = true;
    }
    setSelected(initial);
  }, [open, classrooms]);

  const selectedIds = useMemo(
    () => classrooms.filter((c) => selected[c.id]).map((c) => c.id),
    [classrooms, selected]
  );

  const selectedCount = selectedIds.length;

  const totalUnregistered = useMemo(() => {
    return classrooms
      .filter((c) => selected[c.id])
      .reduce((sum, c) => sum + (c.unregisteredCount || 0), 0);
  }, [classrooms, selected]);

  const toggleOne = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const cls of classrooms) next[cls.id] = true;
    setSelected(next);
  };

  const clearAll = () => {
    const next: Record<string, boolean> = {};
    for (const cls of classrooms) next[cls.id] = false;
    setSelected(next);
  };

  const handlePrint = () => {
    if (selectedIds.length === 0) return;

    const params = new URLSearchParams();
    params.set("schoolId", schoolId);
    params.set("classroomIds", selectedIds.join(","));

    window.open(`/api/reports/registration-letters/pdf?${params.toString()}`, "_blank");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="text-xl font-bold text-slate-900">Print registration letters</div>
            <div className="mt-1 text-sm text-slate-500">{schoolName}</div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Selected classes: <span className="font-semibold">{selectedCount}</span>
              {" · "}
              Unregistered pupils: <span className="font-semibold">{totalUnregistered}</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={clearAll} className="rounded-xl bg-white">
                Clear all
              </Button>
              <Button variant="outline" onClick={selectAll} className="rounded-xl bg-white">
                Select all
              </Button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200">
            {classrooms.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No classrooms found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {classrooms.map((cls) => (
                  <label
                    key={cls.id}
                    className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[cls.id]}
                        onChange={() => toggleOne(cls.id)}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{cls.name}</div>
                        <div className="text-xs text-slate-500">
                          {cls.unregisteredCount} unregistered
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      Already Registered {cls.registeredCount + cls.unregisteredCount}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} className="rounded-xl bg-white">
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={selectedIds.length === 0}
            className="rounded-xl"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print selected
          </Button>
        </div>
      </div>
    </div>
  );
}