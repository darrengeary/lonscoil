// components/supplier/ChoiceManager.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";

export interface MealChoice {
  id: string;
  name: string;
}

interface Props {
  groupId: string;
  initialChoices?: MealChoice[];
  disabled?: boolean;
}

export default function ChoiceManager({
  groupId,
  initialChoices,
  disabled = false,
}: Props) {
  const [choices, setChoices] = useState<MealChoice[]>(initialChoices ?? []);
  const [adding, setAdding] = useState(false);
  const [newChoice, setNewChoice] = useState("");

  // Add a new choice
  async function addChoice() {
    const res = await fetch(
      `/api/mealgroups/${groupId}/choices`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newChoice.trim() }),
      }
    );
    const created: MealChoice = await res.json();
    setChoices((c) => [...c, created]);
    setNewChoice("");
    setAdding(false);
  }

  return (
    <div className="mt-2">
      {choices.map((choice) => (
        <div
          key={choice.id}
          className="flex items-center justify-between py-2"
        >
          <span>
            {choice.name}
          </span>
        </div>
      ))}

      {!adding && !disabled && (
        <Button
          variant="outline"
          className="w-full mt-4 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center gap-2"
          onClick={() => setAdding(true)}
        >
          <Plus size={18} /> Add Choice
        </Button>
      )}

      {adding && !disabled && (
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="New choice name"
            value={newChoice}
            onChange={(e) => setNewChoice(e.target.value)}
          />
          <Button onClick={addChoice} disabled={!newChoice.trim()}>
            Publish
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setAdding(false);
              setNewChoice("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
