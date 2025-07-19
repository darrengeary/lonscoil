"use client";
import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Utensils } from "lucide-react";
import AddPupilModal from "@/components/parent/AddPupilModal";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

interface Pupil {
  id: string;
  name: string;
  status: string;
  classroom: { name: string } | null;
}

export default function ParentPupilsPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchPupils = async () => {
    setLoading(true);
    const res = await fetch("/api/pupils?parent=true");
    const data = await res.json();
    setPupils(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPupils();
  }, []);

  async function handleNameUpdate(pupil: Pupil) {
    if (!editName.trim()) {
      toast({ title: "Name cannot be empty.", variant: "destructive" });
      return;
    }
    const res = await fetch("/api/pupils", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pupil.id, name: editName }),
    });
    if (res.ok) {
      toast({ title: "Name updated!" });
      setEditingId(null);
      fetchPupils();
    } else {
      toast({ title: "Error updating name", variant: "destructive" });
    }
  }

  return (
    <>
      <DashboardHeader heading="Your Pupils" text="Manage your children’s profiles." />

      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Pupil
        </Button>
      </div>

      <Card className="p-0 border-muted">
        {loading ? (
          <div className="p-6 text-center">Loading…</div>
        ) : pupils.length === 0 ? (
          <div className="p-6 text-center">No pupils found.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted">
                <th className="p-2">ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Classroom</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{p.id}</td>
                  <td className="p-2">
                    {editingId === p.id ? (
                      <form
                        className="flex gap-2 items-center"
                        onSubmit={e => {
                          e.preventDefault();
                          handleNameUpdate(p);
                        }}
                      >
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                        />
                        <Button size="sm" type="submit">Save</Button>
                        <Button size="sm" type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <>
                        {p.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit Name"
                          onClick={() => {
                            setEditingId(p.id);
                            setEditName(p.name);
                          }}
                          className="ml-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </td>
                  <td className="p-2">{p.classroom?.name ?? <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="p-2">{p.status}</td>
                  <td className="p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/parent/pupils/${p.id}`}
                    >
                      <Utensils className="w-4 h-4 mr-1" />
                      Manage Lunch Orders
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddPupilModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onClaimed={fetchPupils}
      />
    </>
  );
}
