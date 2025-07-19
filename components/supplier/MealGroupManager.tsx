// File: components/supplier/MealGroupManager.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ChoiceManager from "./ChoiceManager";

export interface MealChoice {
  id: string;
  name: string;
}
export interface MealGroup {
  id: string;
  name: string;
  maxSelections: number;
  choices: MealChoice[];
}

interface Props {
  initialGroups: MealGroup[];
}

export default function MealGroupManager({ initialGroups }: Props) {
  const [groups, setGroups] = useState<MealGroup[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState(1);
  const [editing, setEditing] = useState<MealGroup | null>(null);

  async function saveGroup() {
    const payload = { name: newName.trim(), maxSelections: newMax };
    if (editing) {
      // update
      const res = await fetch(`/api/mealgroups/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const updated: MealGroup = await res.json();
      setGroups((g) => g.map(gr => gr.id === updated.id ? updated : gr));
    } else {
      // create
      const res = await fetch('/api/mealgroups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const created: MealGroup = await res.json();
      setGroups((g) => [...g, created]);
    }
    setEditing(null);
    setNewName('');
    setNewMax(1);
  }

  async function removeGroup(id: string) {
    await fetch(`/api/mealgroups/${id}`, { method: 'DELETE' });
    setGroups(g => g.filter(gr => gr.id !== id));
  }

  function startEdit(group: MealGroup) {
    setEditing(group);
    setNewName(group.name);
    setNewMax(group.maxSelections);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">{editing ? 'Edit Meal Group' : 'Add Meal Group'}</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Group Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            placeholder="Max selections"
            value={newMax}
            onChange={e => setNewMax(Number(e.target.value))}
          />
          <Button onClick={saveGroup} disabled={!newName.trim()}>Save</Button>
          {editing && <Button variant="outline" onClick={() => {
            setEditing(null);
            setNewName(''); setNewMax(1);
          }}>Cancel</Button>}
        </div>
      </Card>

      {groups.map(group => (
        <Card key={group.id} className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-medium">{group.name} (Max: {group.maxSelections})</h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => startEdit(group)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => removeGroup(group.id)}>Delete</Button>
            </div>
          </div>
          <ChoiceManager
            groupId={group.id}
            initialChoices={group.choices}
            maxSelections={group.maxSelections}
          />
        </Card>
      ))}
    </div>
  );
}
