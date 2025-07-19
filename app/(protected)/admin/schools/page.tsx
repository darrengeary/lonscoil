"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Eye, Pencil, School2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader } from "lucide-react";

function SchoolModal({ open, onClose, onSaved, school }) {
  const [name, setName] = useState(school?.name || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(school?.name || "");
  }, [school]);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/schools", {
      method: school && school.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(school && school.id ? { id: school.id, name } : { name }),
    });
    setLoading(false);
    if (res.ok) {
      onSaved();
      setName("");
      onClose();
      toast({ title: school && school.id ? "School updated" : "School added" });
    } else {
      toast({ title: "Failed to save school", variant: "destructive" });
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
          <School2 className="w-5 h-5 text-primary" />
          {school && school.id ? "Edit School" : "Add School"}
        </h2>
        <input
          autoFocus
          className="w-full border px-3 py-2 rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="School name"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : school && school.id
              ? "Save Changes"
              : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSchool, setModalSchool] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools(data))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => {
    setLoading(true);
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data) => setSchools(data))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <DashboardHeader
        heading="Schools"
        text="Manage all schools you supply."
      />
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalSchool({})}>
          <Plus className="mr-2 h-4 w-4" /> Add School
        </Button>
      </div>
      <SchoolModal
        open={!!modalSchool}
        onClose={() => setModalSchool(null)}
        onSaved={reload}
        school={Object.keys(modalSchool || {}).length ? modalSchool : null}
      />
      <Card className="p-0 border-muted">
        {loading ? (
        <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <Loader className="w-7 h-7 animate-spin" />
            <div className="font-medium">Loading school data…</div>
            <div className="text-xs">Hang tight, fetching records from the server.</div>
        </div>
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <School2 className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No schools found</div>
            <div className="text-sm mb-2">Click "Add School" to create your first school.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl">
        <table className="w-full table-auto border-separate border-spacing-y-1">
        <thead>
        <tr className="bg-muted/80">
            <th className="text-left px-4 py-2 rounded-tl-2xl w-14">Edit</th>
            <th className="text-left px-4 py-2 min-w-[120px]">Name</th>
            <th className="text-left px-4 py-2">Created</th>
            <th className="text-left px-4 py-2 rounded-tr-2xl">Actions</th>
        </tr>
        </thead>
        <tbody>
        {schools.map((school) => (
            <tr key={school.id}>
            <td className="px-4 py-2 w-14">
                <Button
                variant="ghost"
                size="icon"
                aria-label="Edit School"
                onClick={() => setModalSchool(school)}
                >
                <Pencil className="w-4 h-4" />
                </Button>
            </td>
            <td className="px-4 py-2 font-medium min-w-[120px]">{school.name}</td>
            <td className="px-4 py-2 text-sm">
                {school.createdAt?.substring(0, 10)}
            </td>
            <td className="px-4 py-2">
                <Link href={`/admin/schools/${school.id}`}>
                <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Manage Classrooms
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
