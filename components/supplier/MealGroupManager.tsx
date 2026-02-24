// components/supplier/MealGroupManager.tsx
"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ChoiceManager from "./ChoiceManager";
import { Plus } from "lucide-react";

export type PrismaMealChoice = {
  id: string;
  name: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
};

export interface MealGroup {
  id: string;
  name: string;
  maxSelections: number;
  choices?: PrismaMealChoice[];
}

interface Props {
  menuId: string;
  initialGroups?: MealGroup[];
  onGroupsChange?: (groups: MealGroup[]) => void;
}

export default function MealGroupManager({
  menuId,
  initialGroups,
  onGroupsChange,
}: Props) {
  const [groups, setGroups] = useState<MealGroup[]>(initialGroups ?? []);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateGroups(next: MealGroup[]) {
    setGroups(next);
    onGroupsChange?.(next);
  }

  async function saveGroup() {
    const payload = { name: newName.trim(), maxSelections: newMax, menuId };

    const res = await fetch("/api/mealgroups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;

    const created: MealGroup = await res.json();
    updateGroups([...groups, created]);

    setNewName("");
    setNewMax(1);
    setModalOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="space-y-4">
      {/* Menu-scoped New Group button */}
      <div className="flex justify-between items-center">
        <Button onClick={() => setModalOpen(true)} type="button">
          <Plus className="mr-2 h-4 w-4" />
          New Meal Group
        </Button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-md space-y-4 border">
            <h2 className="text-lg font-semibold">Add Meal Group</h2>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                <label
                  className="text-xs font-medium text-gray-600 min-w-[100px]"
                  htmlFor="mealgroup-name"
                >
                  Name
                </label>
                <Input
                  id="mealgroup-name"
                  ref={inputRef}
                  placeholder="e.g. Sandwich"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-white w-full"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                <label className="text-xs font-medium text-gray-600 min-w-[90px]">
                  Max Selections
                </label>
                <Input
                  type="number"
                  min={1}
                  value={newMax}
                  onChange={(e) => setNewMax(Number(e.target.value))}
                  className="bg-white w-full"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveGroup}
                  disabled={!newName.trim() || newMax <= 0}
                  type="button"
                >
                  Publish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groups grid */}
      <div className="min-h-[1px] bg-[#F4F7FA] rounded-xl p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="relative flex flex-col bg-white border border-transparent rounded-3xl p-7 shadow-sm hover:shadow-lg transition-all duration-150"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-xl font-bold text-[#27364B] truncate">
                  {group.name}
                </div>
                <div className="px-3 py-1 rounded-full bg-[#FFE6E6] text-[#DC2626] font-semibold text-sm flex items-center ml-3">
                  Max:{" "}
                  <span className="ml-2 font-bold">{group.maxSelections}</span>
                </div>
              </div>

              <ChoiceManager
                menuId={menuId}
                groupId={group.id}
                initialChoices={group.choices}
                disabled={false}
              />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}