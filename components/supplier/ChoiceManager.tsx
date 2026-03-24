"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ToggleLeft, ToggleRight, Plus, Pencil } from "lucide-react";

type Allergen = { id: string; name: string; color?: string | null };

export interface MealChoice {
  id: string;
  name: string;
  active?: boolean;
  extraSticker?: boolean;
  allergens?: Allergen[];

  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
}

interface Props {
  menuId: string;
  groupId: string;
  mealOptionId?: string;
  initialChoices?: MealChoice[];
  disabled?: boolean;
}

async function fetchMealChoices(menuId: string, groupId: string) {
  const res = await fetch(
    `/api/meal-choices?menuId=${encodeURIComponent(menuId)}&groupId=${encodeURIComponent(groupId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as MealChoice[];
}

async function fetchAllergens() {
  const res = await fetch(`/api/allergens`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Allergen[];
}

async function updateMealChoice(payload: any) {
  const res = await fetch("/api/meal-choices", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as MealChoice;
}

async function createMealChoice(payload: {
  name: string;
  groupId: string;
  menuId: string;
  mealOptionId?: string;
  active?: boolean;
}) {
  const res = await fetch("/api/meal-choices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as MealChoice;
}

function safeNumOrNull(v: string) {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function pillStyle(color?: string | null): React.CSSProperties {
  if (!color) return {};
  return { backgroundColor: color };
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-600">{label}</div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
    </div>
  );
}

export default function ChoiceManager({
  menuId,
  groupId,
  mealOptionId,
  initialChoices,
  disabled = false,
}: Props) {
  const [choices, setChoices] = useState<MealChoice[]>(initialChoices ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [allergenOptions, setAllergenOptions] = useState<Allergen[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingChoice = useMemo(
    () => choices.find((c) => c.id === editingId) ?? null,
    [choices, editingId]
  );

  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(false);
  const [editExtraSticker, setEditExtraSticker] = useState(false);
  const [editAllergens, setEditAllergens] = useState<Allergen[]>([]);
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editSugars, setEditSugars] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editSaturates, setEditSaturates] = useState("");
  const [editFibre, setEditFibre] = useState("");
  const [editSalt, setEditSalt] = useState("");

  const [addName, setAddName] = useState("");
  const [addActive, setAddActive] = useState(false);
  const [addExtraSticker, setAddExtraSticker] = useState(false);
  const [addAllergens, setAddAllergens] = useState<Allergen[]>([]);
  const [addCalories, setAddCalories] = useState("");
  const [addProtein, setAddProtein] = useState("");
  const [addCarbs, setAddCarbs] = useState("");
  const [addSugars, setAddSugars] = useState("");
  const [addFat, setAddFat] = useState("");
  const [addSaturates, setAddSaturates] = useState("");
  const [addFibre, setAddFibre] = useState("");
  const [addSalt, setAddSalt] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchMealChoices(menuId, groupId)
      .then((rows) => {
        if (!cancelled) setChoices(rows);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [menuId, groupId]);

  useEffect(() => {
    let cancelled = false;

    fetchAllergens()
      .then((rows) => {
        if (!cancelled) setAllergenOptions(rows);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  function openEdit(choice: MealChoice) {
    setEditingId(choice.id);
    setEditOpen(true);

    setEditName(choice.name);
    setEditActive(choice.active ?? false);
    setEditExtraSticker(choice.extraSticker ?? false);
    setEditAllergens(choice.allergens ?? []);
    setEditCalories(choice.caloriesKcal?.toString() ?? "");
    setEditProtein(choice.proteinG?.toString() ?? "");
    setEditCarbs(choice.carbsG?.toString() ?? "");
    setEditSugars(choice.sugarsG?.toString() ?? "");
    setEditFat(choice.fatG?.toString() ?? "");
    setEditSaturates(choice.saturatesG?.toString() ?? "");
    setEditFibre(choice.fibreG?.toString() ?? "");
    setEditSalt(choice.saltG?.toString() ?? "");
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingId(null);
  }

  function openAdd() {
    setAddOpen(true);
    setAddName("");
    setAddActive(false);
    setAddExtraSticker(false);
    setAddAllergens([]);
    setAddCalories("");
    setAddProtein("");
    setAddCarbs("");
    setAddSugars("");
    setAddFat("");
    setAddSaturates("");
    setAddFibre("");
    setAddSalt("");
  }

  function closeAdd() {
    setAddOpen(false);
  }

  async function saveEdit() {
    if (!editingChoice) return;

    try {
      setBusyId(editingChoice.id);

      const updated = await updateMealChoice({
        id: editingChoice.id,
        name: editName.trim(),
        active: editActive,
        extraSticker: editExtraSticker,
        allergenIds: editAllergens.map((a) => a.id),
        caloriesKcal: safeNumOrNull(editCalories),
        proteinG: safeNumOrNull(editProtein),
        carbsG: safeNumOrNull(editCarbs),
        sugarsG: safeNumOrNull(editSugars),
        fatG: safeNumOrNull(editFat),
        saturatesG: safeNumOrNull(editSaturates),
        fibreG: safeNumOrNull(editFibre),
        saltG: safeNumOrNull(editSalt),
      });

      setChoices((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      closeEdit();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  async function saveAdd() {
    const name = addName.trim();
    if (!name) return;

    try {
      setBusyId("__add__");

      const created = await createMealChoice({
        name,
        groupId,
        menuId,
        mealOptionId,
        active: false,
      });

      const updated = await updateMealChoice({
        id: created.id,
        active: addActive,
        extraSticker: addExtraSticker,
        allergenIds: addAllergens.map((a) => a.id),
        caloriesKcal: safeNumOrNull(addCalories),
        proteinG: safeNumOrNull(addProtein),
        carbsG: safeNumOrNull(addCarbs),
        sugarsG: safeNumOrNull(addSugars),
        fatG: safeNumOrNull(addFat),
        saturatesG: safeNumOrNull(addSaturates),
        fibreG: safeNumOrNull(addFibre),
        saltG: safeNumOrNull(addSalt),
      });

      setChoices((prev) => [...prev, { ...created, ...updated }]);
      closeAdd();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-2">
      {choices.map((choice) => {
        const isBusy = busyId === choice.id;
        const isActive = choice.active === true;

        return (
          <div key={choice.id} className="flex items-center justify-between py-2 gap-3">
            <div className="min-w-0">
              <div className="truncate">{choice.name}</div>
              <div className="text-xs text-gray-500">
                {isActive ? "Active" : "Disabled"}
                {choice.extraSticker ? " · Extra sticker" : ""}
              </div>
            </div>

            {!disabled && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => openEdit(choice)}
                disabled={isBusy}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        );
      })}

      {!disabled && (
        <Button
          variant="outline"
          className="w-full mt-4 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center gap-2"
          onClick={openAdd}
          disabled={busyId === "__add__"}
        >
          <Plus size={18} /> Add Choice
        </Button>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit();
          else setEditOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg bg-white text-slate-900 shadow-xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit choice</DialogTitle>
            <DialogDescription>
              Update name, allergens, nutrition, extra sticker and active status.
            </DialogDescription>
          </DialogHeader>

          {editingChoice && (
            <div className="space-y-4">
              <Button
                type="button"
                className={`w-full rounded-2xl py-6 text-base font-semibold ${
                  editActive
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
                onClick={() => setEditActive((v) => !v)}
                disabled={busyId === editingChoice.id}
              >
                {editActive ? (
                  <span className="inline-flex items-center gap-2">
                    <ToggleRight /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ToggleLeft /> Disabled
                  </span>
                )}
              </Button>

              <div className="space-y-2">
                <div className="text-sm font-medium">Name</div>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Choice name"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editExtraSticker}
                  onChange={(e) => setEditExtraSticker(e.target.checked)}
                />
                Extra sticker
              </label>

              <div className="space-y-2">
                <div className="text-sm font-medium">Allergens</div>
                <div className="grid grid-cols-2 gap-2 rounded-xl border p-3">
                  {allergenOptions.map((allergen) => {
                    const checked = editAllergens.some((a) => a.id === allergen.id);
                    return (
                      <label key={allergen.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditAllergens((prev) =>
                              checked ? prev.filter((a) => a.id !== allergen.id) : [...prev, allergen]
                            )
                          }
                        />
                        <span style={pillStyle(allergen.color)}>{allergen.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Nutrition (per portion)</div>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledInput label="Calories (kcal)" value={editCalories} onChange={setEditCalories} />
                  <LabeledInput label="Protein (g)" value={editProtein} onChange={setEditProtein} />
                  <LabeledInput label="Carbs (g)" value={editCarbs} onChange={setEditCarbs} />
                  <LabeledInput label="Sugars (g)" value={editSugars} onChange={setEditSugars} />
                  <LabeledInput label="Fat (g)" value={editFat} onChange={setEditFat} />
                  <LabeledInput label="Saturates (g)" value={editSaturates} onChange={setEditSaturates} />
                  <LabeledInput label="Fibre (g)" value={editFibre} onChange={setEditFibre} />
                  <LabeledInput label="Salt (g)" value={editSalt} onChange={setEditSalt} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={!editingChoice || !editName.trim() || busyId === editingChoice.id}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) closeAdd();
          else setAddOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-lg bg-white text-slate-900 shadow-xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add choice</DialogTitle>
            <DialogDescription>
              Create a new disabled choice with allergens, nutrition and optional extra sticker.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              type="button"
              className={`w-full rounded-2xl py-6 text-base font-semibold ${
                addActive
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              onClick={() => setAddActive((v) => !v)}
              disabled={busyId === "__add__"}
            >
              {addActive ? (
                <span className="inline-flex items-center gap-2">
                  <ToggleRight /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ToggleLeft /> Disabled
                </span>
              )}
            </Button>

            <div className="space-y-2">
              <div className="text-sm font-medium">Name</div>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="New choice name" />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addExtraSticker}
                onChange={(e) => setAddExtraSticker(e.target.checked)}
              />
              Extra sticker
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium">Allergens</div>
              <div className="grid grid-cols-2 gap-2 rounded-xl border p-3">
                {allergenOptions.map((allergen) => {
                  const checked = addAllergens.some((a) => a.id === allergen.id);
                  return (
                    <label key={allergen.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAddAllergens((prev) =>
                            checked ? prev.filter((a) => a.id !== allergen.id) : [...prev, allergen]
                          )
                        }
                      />
                      <span style={pillStyle(allergen.color)}>{allergen.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Nutrition (per portion)</div>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="Calories (kcal)" value={addCalories} onChange={setAddCalories} />
                <LabeledInput label="Protein (g)" value={addProtein} onChange={setAddProtein} />
                <LabeledInput label="Carbs (g)" value={addCarbs} onChange={setAddCarbs} />
                <LabeledInput label="Sugars (g)" value={addSugars} onChange={setAddSugars} />
                <LabeledInput label="Fat (g)" value={addFat} onChange={setAddFat} />
                <LabeledInput label="Saturates (g)" value={addSaturates} onChange={setAddSaturates} />
                <LabeledInput label="Fibre (g)" value={addFibre} onChange={setAddFibre} />
                <LabeledInput label="Salt (g)" value={addSalt} onChange={setAddSalt} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeAdd}>
              Cancel
            </Button>
            <Button onClick={saveAdd} disabled={!addName.trim() || busyId === "__add__"}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}