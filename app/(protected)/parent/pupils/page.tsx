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
    <div className="ml-6 mt-6">
      <DashboardHeader heading="My Pupils" text="Manage your children’s profiles." />

      <div className="flex justify-start my-4">
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Claim Pupil
        </Button>
      </div>  </div>

      <Card className="p-0 border-muted min-h-[200px] bg-[#F4F7FA] px-6">
        {loading ? (
          <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
            <svg className="w-7 h-7 animate-spin text-muted" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="font-medium">Loading pupil data…</div>
            <div className="text-xs">Hang tight, fetching records from the server.</div>
          </div>
        ) : pupils.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <Utensils className="w-10 h-10 mb-1 text-muted" />
            <div className="text-lg font-semibold">No pupils found</div>
            <div className="text-sm mb-2">Pupils will appear here when added to your account.</div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 py-8">
            {pupils.map((pupil) => (
              <div
                key={pupil.id}
                tabIndex={0}
                className="relative flex flex-col bg-white border border-transparent rounded-3xl p-7 shadow-sm hover:shadow-lg transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-[#C9E7D6] outline-none group"
                aria-label={`Manage profile for ${pupil.name}`}
              >
                {/* Name + edit */}
                <div className="text-xl font-bold text-[#27364B] truncate mb-4 flex items-center">
                  {editingId === pupil.id ? (
                    <form
                      className="flex gap-2 items-center w-full"
                      onSubmit={e => {
                        e.preventDefault();
                        handleNameUpdate(pupil);
                      }}
                    >
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        className="max-w-[140px]"
                      />
                      <Button size="sm" type="submit">Save</Button>
                      <Button size="sm" type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <>
                      <span>{pupil.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit Name"
                        onClick={e => {
                          e.stopPropagation();
                          setEditingId(pupil.id);
                          setEditName(pupil.name);
                        }}
                        className="ml-1"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <div className="px-3 py-1 rounded-full bg-[#FFEB99] text-[#B79B46] font-semibold text-sm flex items-center font-mono">
                   {pupil.classroom?.name }
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[#E7F8F0] text-[#56C596] font-semibold text-sm flex items-center">
                   
                      {pupil.status}
                   
                  </div>
                </div>
                {/* Manage Orders */}
<div className="mt-4 flex justify-end">
  <Button
    variant="outline"
    size="sm"
    className="rounded-full font-semibold flex items-center px-4 py-3" // <-- increased vertical (py-2) and horizontal (px-4) padding
    onClick={() => window.location.href = `/parent/orders`}
  >
    <Utensils className="w-4 h-4 mr-2" />  {/* Use mr-2 for better spacing */}
    Manage Lunch Orders
  </Button>
</div>
              </div>
            ))}
          </div>
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
