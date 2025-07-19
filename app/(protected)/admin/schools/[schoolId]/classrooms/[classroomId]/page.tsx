"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, Printer, User, ArrowLeft, Loader } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import PrintRegistration from "@/components/supplier/PrintRegistration";

// Modal for bulk add (your original)
function AddPupilsModal({ open, onClose, onSaved, classroomId }) {
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
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
      toast({ title: "Failed to add pupils", variant: "destructive" });
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
          <User className="w-5 h-5 text-primary" />
          Add Unregistered Pupils
        </h2>
        <label className="block mb-2 font-medium">How many slots?</label>
        <input
          type="number"
          min={1}
          max={100}
          className="w-full border px-3 py-2 rounded-lg bg-muted"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          required
        />
        <div className="flex gap-2 justify-end pt-2">
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

export default function ClassroomPupilsPage() {
  const params = useParams();
  const { schoolId, classroomId } = params as { schoolId: string; classroomId: string };

  const [classroom, setClassroom] = useState<any>(null);
  const [pupils, setPupils] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Customize as needed or pull from settings
  const schoolName = "School Name";
  const logoUrl = "/logo.svg";
  const letterTemplate = `Dear Parent/Guardian,

Please use the following registration code to register your child on our online system.

Thank you,
${schoolName}`;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // classroom details
      const classRes = await fetch(`/api/classrooms/${classroomId}`);
      const classroomData = await classRes.json();
      setClassroom(classroomData);
      // all pupils in this classroom
      const pupilsRes = await fetch(`/api/pupils?classroomId=${classroomId}`);
      const pupilsData = await pupilsRes.json();
      setPupils(pupilsData);
      setLoading(false);
    }
    fetchData();
  }, [classroomId]);

  const reload = () => {
    setLoading(true);
    fetch(`/api/pupils?classroomId=${classroomId}`)
      .then(res => res.json())
      .then(data => setPupils(data))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <DashboardHeader
        heading={classroom ? `${classroom.name} – Pupils` : "Pupils"}
        text="Manage and register pupils for this classroom."
      />
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/schools/${schoolId}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Classrooms
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button onClick={() => setShowPrintModal(true)}>
            <Printer className="mr-2 h-4 w-4" /> Print Registration Letters
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Pupils
          </Button>
        </div>
      </div>
      <PrintRegistration
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        pupils={pupils}
        classroomName={classroom?.name || ""}
        schoolName={schoolName}
        letterTemplate={letterTemplate}
        logoUrl={logoUrl}
      />
      <AddPupilsModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={reload}
        classroomId={classroomId}
      />
      <Card className="p-0 border-muted">
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <Loader className="w-7 h-7 animate-spin" />
            <div className="font-medium">Loading pupils…</div>
          </div>
        ) : pupils.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <User className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No pupils found</div>
            <div className="text-sm mb-2">Click "Add Pupils" to create unregistered slots.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full table-auto border-separate border-spacing-y-1">
              <thead>
                <tr className="bg-muted/80">
                  <th className="text-left px-4 py-2 rounded-tl-2xl w-14">Edit</th>
                  <th className="text-left px-4 py-2 min-w-[120px]">Code</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2 rounded-tr-2xl">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((pupil) => (
                  <tr key={pupil.id}>
                    <td className="px-4 py-2 w-14">
                      {/* You can add an edit button here in future */}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs min-w-[120px]">{pupil.id}</td>
                    <td className="px-4 py-2">{pupil.name || <span className="italic text-muted-foreground">Not set</span>}</td>
                    <td className="px-4 py-2">
                      {pupil.status === "UNREGISTERED" ? (
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">Unregistered</span>
                      ) : (
                        <span className="bg-green-200 text-green-700 px-2 py-1 rounded text-xs">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {/* Future actions: claim, assign, delete, etc. */}
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
