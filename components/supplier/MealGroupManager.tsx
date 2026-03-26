"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ChoiceManager from "./ChoiceManager";
import {
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MealChoiceListItem = {
  id: string;
  name: string;
  groupId: string;
  active?: boolean;
  extraSticker?: boolean;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
  allergens?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
};

export interface MealGroup {
  id: string;
  name: string;
  maxSelections: number;
  active: boolean;
  choices?: MealChoiceListItem[];
}

interface Props {
  menuId: string;
  mealOptionId: string;
  initialGroups?: MealGroup[];
  onGroupsChange?: (groups: MealGroup[]) => void;
}

type GroupSummary = {
  id: string;
  name: string;
};

export default function MealGroupManager({
  menuId,
  mealOptionId,
  initialGroups,
  onGroupsChange,
}: Props) {
  const [groups, setGroups] = useState<MealGroup[]>(initialGroups ?? []);
  const [allGroups, setAllGroups] = useState<GroupSummary[]>(
    () => (initialGroups ?? []).map((g) => ({ id: g.id, name: g.name }))
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupMaxSelections, setGroupMaxSelections] = useState(1);
  const [groupActive, setGroupActive] = useState(false);
  const [duplicateFromGroupId, setDuplicateFromGroupId] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<MealGroup | null>(null);

  const [showDisabledGroups, setShowDisabledGroups] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editingGroupId;

  const canSave = useMemo(
    () => groupName.trim().length >= 2 || (!!duplicateFromGroupId && !isEdit),
    [groupName, duplicateFromGroupId, isEdit]
  );

  const activeGroups = useMemo(
    () => groups.filter((group) => group.active),
    [groups]
  );

  const disabledGroups = useMemo(
    () => groups.filter((group) => !group.active),
    [groups]
  );

  function updateGroups(next: MealGroup[]) {
    setGroups(next);
    onGroupsChange?.(next);
  }

  function openCreateGroup() {
    setEditingGroupId(null);
    setGroupName("");
    setGroupMaxSelections(1);
    setGroupActive(false);
    setDuplicateFromGroupId("");
    setModalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function openEditGroup(group: MealGroup) {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupMaxSelections(group.maxSelections);
    setGroupActive(group.active);
    setDuplicateFromGroupId("");
    setModalOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGroupId(null);
    setGroupName("");
    setGroupMaxSelections(1);
    setGroupActive(false);
    setDuplicateFromGroupId("");
  }

  async function saveGroup() {
    const body = isEdit
      ? {
          id: editingGroupId,
          name: groupName.trim(),
          maxSelections: groupMaxSelections,
          active: groupActive,
        }
      : {
          name: groupName.trim(),
          maxSelections: groupMaxSelections,
          active: false,
          mealOptionId,
          duplicateFromGroupId: duplicateFromGroupId || null,
        };

    const res = await fetch("/api/mealgroups", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return;

    const saved: MealGroup = await res.json();

    if (isEdit) {
      updateGroups(groups.map((g) => (g.id === saved.id ? { ...g, ...saved } : g)));
    } else {
      updateGroups([...groups, saved]);
      setAllGroups((prev) => [...prev, { id: saved.id, name: saved.name }]);
    }

    closeModal();
  }

  async function toggleGroupActive(group: MealGroup) {
    const res = await fetch("/api/mealgroups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: group.id,
        name: group.name,
        maxSelections: group.maxSelections,
        active: !group.active,
      }),
    });

    if (!res.ok) return;

    const saved: MealGroup = await res.json();
    updateGroups(groups.map((g) => (g.id === saved.id ? { ...g, ...saved } : g)));
  }

  function askToggleGroup(group: MealGroup) {
    setPendingGroup(group);
    setConfirmOpen(true);
  }

  async function confirmToggleGroup() {
    if (!pendingGroup) return;
    await toggleGroupActive(pendingGroup);
    setConfirmOpen(false);
    setPendingGroup(null);
  }

  function renderGroupCard(group: MealGroup) {
    const isActive = group.active;

    return (
      <Card
        key={group.id}
        className={`relative flex flex-col border rounded-3xl p-7 shadow-sm transition-all duration-150 ${
          isActive ? "bg-white hover:shadow-lg" : "bg-gray-50 opacity-75"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <div className="text-xl font-bold text-[#27364B] truncate">{group.name}</div>
            <div className="text-xs text-gray-500">{isActive ? "Active" : "Disabled"}</div>
          </div>

          <div className="px-3 py-1 rounded-full bg-[#FFE6E6] text-[#DC2626] font-semibold text-sm flex items-center ml-3">
            Max:
            <span className="ml-2 font-bold">{group.maxSelections}</span>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            type="button"
            className={`rounded-xl ${
              isActive
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
            onClick={() => askToggleGroup(group)}
          >
            {isActive ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={() => openEditGroup(group)} type="button">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>

        <ChoiceManager
          menuId={menuId}
          groupId={group.id}
          mealOptionId={mealOptionId}
          initialChoices={group.choices}
          disabled={false}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button onClick={openCreateGroup} type="button">
          <Plus className="mr-2 h-4 w-4" />
          New Add On
        </Button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-md space-y-4 border">
            <h2 className="text-lg font-semibold">{isEdit ? "Edit Meal Group" : "Add Meal Group"}</h2>

            <div className="space-y-3">
              {!isEdit && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-600">Duplicate from existing group</div>
                  <select
                    value={duplicateFromGroupId}
                    onChange={(e) => setDuplicateFromGroupId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="">No duplicate</option>
                    {allGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Group name</div>
                <Input
                  ref={inputRef}
                  placeholder="e.g. Drink, Side, Sandwich Extras"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Max selections</div>
                <Input
                  type="number"
                  min={1}
                  value={groupMaxSelections}
                  onChange={(e) => setGroupMaxSelections(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>

              <Button
                type="button"
                className={`w-full rounded-2xl py-6 text-base font-semibold ${
                  groupActive
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
                onClick={() => setGroupActive((v) => !v)}
              >
                {groupActive ? (
                  <span className="inline-flex items-center gap-2">
                    <ToggleRight /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ToggleLeft /> Disabled
                  </span>
                )}
              </Button>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeModal} type="button">
                  Cancel
                </Button>
                <Button onClick={saveGroup} disabled={!canSave} type="button">
                  {isEdit ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-[1px] bg-[#F4F7FA] rounded-xl p-4 space-y-6">
        {activeGroups.length > 0 && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeGroups.map((group) => renderGroupCard(group))}
            </div>
          </div>
        )}

        {disabledGroups.length > 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70">
            <button
              type="button"
              onClick={() => setShowDisabledGroups((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className="text-sm font-semibold text-slate-700">Disabled add-ons</div>
                <div className="text-xs text-slate-500">
                  {disabledGroups.length} hidden group{disabledGroups.length === 1 ? "" : "s"}
                </div>
              </div>

              {showDisabledGroups ? (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-500" />
              )}
            </button>

            {showDisabledGroups && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {disabledGroups.map((group) => renderGroupCard(group))}
                </div>
              </div>
            )}
          </div>
        )}

        {groups.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white px-6 py-10 text-center text-sm text-slate-500">
            No add-ons created yet.
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 shadow-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm status change
            </DialogTitle>
            <DialogDescription>
              {pendingGroup
                ? `Are you sure you want to ${pendingGroup.active ? "disable" : "enable"} "${pendingGroup.name}"?`
                : "Are you sure?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmToggleGroup}
              className={
                pendingGroup?.active
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }
            >
              {pendingGroup?.active ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}