
// File: components/supplier/ChoiceManager.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MealChoice {
  id: string;
  name: string;
}

interface Props {
  groupId: string;
  initialChoices: MealChoice[];
  maxSelections: number;
}

  export default function ChoiceManager({
    groupId,
    initialChoices = [],
    maxSelections,
  }: Props) {
    // ensure choices always starts as an array
    const [choices, setChoices] = useState<MealChoice[]>(initialChoices || []);
  const [newChoice, setNewChoice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function saveChoice() {
    const payload = { name: newChoice.trim(), groupId };
    if (editingId) {
      const res = await fetch(`/api/mealgroups/${groupId}/choices/${editingId}`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: editingName.trim() })
      });
      const updated: MealChoice = await res.json();
      setChoices(c => c.map(ch => ch.id === updated.id ? updated : ch));
    } else {
      const res = await fetch(`/api/mealgroups/${groupId}/choices`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
      });
      const created: MealChoice = await res.json();
      setChoices(c => [...c, created]);
    }
    cancelEdit();
  }

  async function removeChoice(id: string) {
    await fetch(`/api/mealgroups/${groupId}/choices/${id}`, { method: 'DELETE' });
    setChoices(c => c.filter(ch => ch.id !== id));
  }

  function startEdit(ch: MealChoice) {
    setEditingId(ch.id);
    setEditingName(ch.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setNewChoice("");
    setEditingName("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        <Input
          placeholder={editingId ? "Edit choice name" : "New choice name"}
          value={editingId ? editingName : newChoice}
          onChange={e => editingId ? setEditingName(e.target.value) : setNewChoice(e.target.value)}
        />
        <Button onClick={saveChoice} disabled={!(editingId ? editingName.trim() : newChoice.trim())}>
          {editingId ? 'Update' : 'Add'}
        </Button>
        {editingId && <Button variant="outline" onClick={cancelEdit}>Cancel</Button>}
      </div>
      <ul className="space-y-1">
        {choices.map(ch => (
          <li key={ch.id} className="flex justify-between items-center">
            <span>{ch.name}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => startEdit(ch)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => removeChoice(ch.id)}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
