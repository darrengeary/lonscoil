"use client";
import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Pupil = {
  id: string;
  name: string;
  status: string;
  classroomName?: string;
};

export default function PrintRegistration({
  open,
  onClose,
  pupils,
  classroomName,
  schoolName,
  letterTemplate,
  logoUrl,
}: {
  open: boolean;
  onClose: () => void;
  pupils: Pupil[];
  classroomName: string;
  schoolName: string;
  letterTemplate: string;
  logoUrl?: string;
}) {
  const unregistered = pupils.filter((p) => p.status === "UNREGISTERED");
  const [selected, setSelected] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSelected(unregistered.map((p) => p.id));
  }, [open, pupils]);

  const allSelected = selected.length === unregistered.length && unregistered.length > 0;
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  function printLetters(ids: string[]) {
    setSelected(ids);
    setTimeout(() => {
      if (printRef.current) window.print();
    }, 100);
  }

  useEffect(() => {
    const before = () => onClose();
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, [onClose]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Print Registration Letters (Unregistered)</DialogTitle>
        {unregistered.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            No unregistered pupils to print.
          </div>
        ) : (
          <>
            <div className="mb-2">
              <label>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? unregistered.map((p) => p.id) : []
                    )
                  }
                  className="mr-2"
                />
                Select All
              </label>
            </div>
            <div className="max-h-52 overflow-y-auto border rounded mb-2">
              {unregistered.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="flex-1">
                    {p.name || (
                      <span className="italic text-muted-foreground">
                        No Name
                      </span>
                    )}
                  </span>
                  <span className="text-xs">{classroomName}</span>
                  <span className="font-mono text-xs">Code: {p.id}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => printLetters(unregistered.map((p) => p.id))}>
                Print All ({unregistered.length})
              </Button>
              <Button
                disabled={selected.length === 0}
                onClick={() => printLetters(selected)}
              >
                Print Selected ({selected.length})
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Hidden printable letters */}
        <div className="hidden print:block absolute inset-0" ref={printRef}>
          {unregistered
            .filter((p) => selected.includes(p.id))
            .map((pupil) => (
              <div
                key={pupil.id}
                className="w-[800px] mx-auto p-12 flex flex-col items-center"
                style={{ pageBreakAfter: "always" }}
              >
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="h-16 mb-6" />
                )}
                <h2 className="text-2xl font-bold mb-6">{schoolName}</h2>
                <div className="mb-8 text-lg">
                  <div className="mb-2">
                    <span className="font-semibold">Classroom:</span> {classroomName}
                  </div>
                  <div className="mb-2">
                    <span className="font-semibold">Pupil Name:</span> {pupil.name || "__________"}
                  </div>
                  <div className="mb-4">
                    <span className="font-semibold">Registration Code:</span>{" "}
                    <span className="bg-gray-200 px-2 py-1 font-mono text-lg rounded">
                      {pupil.id}
                    </span>
                  </div>
                  <div className="mt-6 whitespace-pre-line text-base leading-relaxed max-w-xl text-left">
                    {letterTemplate ||
                      `Dear Parent/Guardian,\n
Please use the following registration code to register your child on our online system.

Thank you,
${schoolName}`}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
