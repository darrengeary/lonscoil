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
import {
  ToggleLeft,
  ToggleRight,
  Plus,
  Pencil,
  AlertTriangle,
  Check,
  Sticker,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

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
  disabled?: boolean; // whole group disabled
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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function pillStyle(color?: string | null): React.CSSProperties {
  if (!color) return {};
  return {
    backgroundColor: color,
    borderColor: color,
  };
}

function numberToString(v?: number | null) {
  return v === null || v === undefined ? "" : String(v);
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className="h-11 rounded-xl border-slate-200 bg-white"
      />
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function AllergenChip({
  allergen,
  selected,
  onToggle,
}: {
  allergen: Allergen;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
        selected
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
      style={!selected ? pillStyle(allergen.color) : undefined}
    >
      {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
      <span className="truncate">{allergen.name}</span>
    </button>
  );
}

function StatusBadge({
  active,
  groupDisabled,
}: {
  active: boolean;
  groupDisabled: boolean;
}) {
  if (groupDisabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          active
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-600"
        )}
      >
        {active ? "Pending active" : "Disabled"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
      )}
    >
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function ChoiceCard({
  choice,
  disabled,
  busy,
  onEdit,
  onToggle,
}: {
  choice: MealChoice;
  disabled: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const isEnabled = choice.active === true;

  return (
    <div
      className={cn(
        "rounded-2xl border transition",
        isEnabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-90"
      )}
    >
      <div className="p-4">
        <div className="space-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-900">
                {choice.name}
              </h3>

              <StatusBadge active={isEnabled} groupDisabled={disabled} />

              {choice.extraSticker ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <Sticker className="h-3.5 w-3.5" />
                  Extra sticker
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              {(choice.allergens?.length ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {choice.allergens!.map((allergen) => (
                    <span
                      key={allergen.id}
                      className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] leading-4 text-slate-600"
                      style={pillStyle(allergen.color)}
                    >
                      {allergen.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {!disabled ? (
              <div className="flex gap-2 md:shrink-0">
                <Button
                  type="button"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-xl text-white",
                    isEnabled
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  )}
                  onClick={onToggle}
                  disabled={busy}
                  title={isEnabled ? "Disable choice" : "Enable choice"}
                >
                  {isEnabled ? (
                    <ToggleRight className="h-4 w-4" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-slate-200"
                  onClick={onEdit}
                  disabled={busy}
                  title="Edit choice"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddChoiceCard({
  disabled,
  busy,
  onClick,
}: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "w-full rounded-2xl border border-dashed p-4 text-left transition",
        "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100",
        "disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
          <Plus className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {busy ? "Adding choice..." : "Add another choice"}
          </div>
        </div>
      </div>
    </button>
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
  const [loading, setLoading] = useState(!initialChoices);

  const [allergenOptions, setAllergenOptions] = useState<Allergen[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingToggleChoice, setPendingToggleChoice] = useState<MealChoice | null>(null);
  const [pendingToggleNextValue, setPendingToggleNextValue] = useState<boolean | null>(null);

  const [showDisabledChoices, setShowDisabledChoices] = useState(false);

  const editingChoice = useMemo(
    () => choices.find((c) => c.id === editingId) ?? null,
    [choices, editingId]
  );

  const activeChoices = useMemo(
    () => choices.filter((choice) => choice.active === true),
    [choices]
  );

  const disabledChoices = useMemo(
    () => choices.filter((choice) => choice.active !== true),
    [choices]
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
    setLoading(true);

    fetchMealChoices(menuId, groupId)
      .then((rows) => {
        if (!cancelled) setChoices(rows);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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
    setEditCalories(numberToString(choice.caloriesKcal));
    setEditProtein(numberToString(choice.proteinG));
    setEditCarbs(numberToString(choice.carbsG));
    setEditSugars(numberToString(choice.sugarsG));
    setEditFat(numberToString(choice.fatG));
    setEditSaturates(numberToString(choice.saturatesG));
    setEditFibre(numberToString(choice.fibreG));
    setEditSalt(numberToString(choice.saltG));
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

  function askToggleChoice(choice: MealChoice, nextValue: boolean) {
    setPendingToggleChoice(choice);
    setPendingToggleNextValue(nextValue);
    setConfirmOpen(true);
  }

  function toggleAllergen(
    list: Allergen[],
    setList: React.Dispatch<React.SetStateAction<Allergen[]>>,
    allergen: Allergen
  ) {
    setList((prev) => {
      const exists = prev.some((a) => a.id === allergen.id);
      return exists ? prev.filter((a) => a.id !== allergen.id) : [...prev, allergen];
    });
  }

  async function confirmToggleChoice() {
    if (!pendingToggleChoice || pendingToggleNextValue === null) return;

    try {
      setBusyId(pendingToggleChoice.id);

      const updated = await updateMealChoice({
        id: pendingToggleChoice.id,
        name: pendingToggleChoice.name,
        active: pendingToggleNextValue,
        extraSticker: pendingToggleChoice.extraSticker ?? false,
        allergenIds: (pendingToggleChoice.allergens ?? []).map((a) => a.id),
        caloriesKcal: pendingToggleChoice.caloriesKcal ?? null,
        proteinG: pendingToggleChoice.proteinG ?? null,
        carbsG: pendingToggleChoice.carbsG ?? null,
        sugarsG: pendingToggleChoice.sugarsG ?? null,
        fatG: pendingToggleChoice.fatG ?? null,
        saturatesG: pendingToggleChoice.saturatesG ?? null,
        fibreG: pendingToggleChoice.fibreG ?? null,
        saltG: pendingToggleChoice.saltG ?? null,
      });

      setChoices((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
      setConfirmOpen(false);
      setPendingToggleChoice(null);
      setPendingToggleNextValue(null);
    }
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
        name,
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
    <div className="mt-3 space-y-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Choices</h2>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Loading choices...
        </div>
      ) : (
        <div className="space-y-3">
          {choices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <div className="text-sm font-medium text-slate-900">No choices yet</div>
              <div className="mt-1 text-sm text-slate-500">
                Add the first choice for this Add on.
              </div>
            </div>
          ) : (
            <>
              {activeChoices.length > 0 && (
                <div className="space-y-2">
                  {activeChoices.map((choice) => (
                    <ChoiceCard
                      key={choice.id}
                      choice={choice}
                      disabled={disabled}
                      busy={busyId === choice.id}
                      onEdit={() => openEdit(choice)}
                      onToggle={() => askToggleChoice(choice, !(choice.active === true))}
                    />
                  ))}
                </div>
              )}

              {disabledChoices.length > 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70">
                  <button
                    type="button"
                    onClick={() => setShowDisabledChoices((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-700">
                        Disabled choices
                      </div>
                      <div className="text-xs text-slate-500">
                        {disabledChoices.length} hidden choice
                        {disabledChoices.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    {showDisabledChoices ? (
                      <ChevronDown className="h-5 w-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    )}
                  </button>

                  {showDisabledChoices && (
                    <div className="space-y-2 px-3 pb-3">
                      {disabledChoices.map((choice) => (
                        <ChoiceCard
                          key={choice.id}
                          choice={choice}
                          disabled={disabled}
                          busy={busyId === choice.id}
                          onEdit={() => openEdit(choice)}
                          onToggle={() => askToggleChoice(choice, !(choice.active === true))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <AddChoiceCard
            disabled={disabled}
            busy={busyId === "__add__"}
            onClick={openAdd}
          />
        </div>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEdit();
          else setEditOpen(true);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl sm:max-w-2xl">
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-slate-100 px-4 py-4 sm:px-6">
              <DialogTitle>Edit choice</DialogTitle>
              <DialogDescription>
                Update the choice details, allergens and nutrition.
              </DialogDescription>
            </DialogHeader>

            {editingChoice ? (
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                <SectionCard title="Status">
                  <Button
                    type="button"
                    className={cn(
                      "h-12 w-full rounded-2xl text-base font-semibold text-white",
                      editActive ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                    )}
                    onClick={() => setEditActive((v) => !v)}
                    disabled={busyId === editingChoice.id}
                  >
                    {editActive ? (
                      <>
                        <ToggleRight className="mr-2 h-5 w-5" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="mr-2 h-5 w-5" />
                        Disabled
                      </>
                    )}
                  </Button>
                </SectionCard>

                <SectionCard title="Basic details">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Name
                      </label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Choice name"
                        className="h-11 rounded-xl border-slate-200"
                      />
                    </div>

                    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={editExtraSticker}
                        onChange={(e) => setEditExtraSticker(e.target.checked)}
                        className="h-4 w-4"
                      />
                      Extra sticker
                    </label>
                  </div>
                </SectionCard>

                <SectionCard title="Allergens" subtitle="Tap to select or unselect">
                  <div className="flex flex-wrap gap-2">
                    {allergenOptions.map((allergen) => {
                      const selected = editAllergens.some((a) => a.id === allergen.id);
                      return (
                        <AllergenChip
                          key={allergen.id}
                          allergen={allergen}
                          selected={selected}
                          onToggle={() =>
                            toggleAllergen(editAllergens, setEditAllergens, allergen)
                          }
                        />
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Nutrition" subtitle="Per portion">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <LabeledInput label="Calories (kcal)" value={editCalories} onChange={setEditCalories} />
                    <LabeledInput label="Protein (g)" value={editProtein} onChange={setEditProtein} />
                    <LabeledInput label="Carbs (g)" value={editCarbs} onChange={setEditCarbs} />
                    <LabeledInput label="Sugars (g)" value={editSugars} onChange={setEditSugars} />
                    <LabeledInput label="Fat (g)" value={editFat} onChange={setEditFat} />
                    <LabeledInput label="Saturates (g)" value={editSaturates} onChange={setEditSaturates} />
                    <LabeledInput label="Fibre (g)" value={editFibre} onChange={setEditFibre} />
                    <LabeledInput label="Salt (g)" value={editSalt} onChange={setEditSalt} />
                  </div>
                </SectionCard>
              </div>
            ) : null}

            <DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeEdit} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={saveEdit}
                  disabled={!editingChoice || !editName.trim() || busyId === editingChoice.id}
                  className="rounded-xl"
                >
                  {busyId === editingChoice?.id ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) closeAdd();
          else setAddOpen(true);
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl sm:max-w-2xl">
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-slate-100 px-4 py-4 sm:px-6">
              <DialogTitle>Add choice</DialogTitle>
              <DialogDescription>
                Create a new choice and decide whether it is active straight away.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              <SectionCard title="Status">
                <Button
                  type="button"
                  className={cn(
                    "h-12 w-full rounded-2xl text-base font-semibold text-white",
                    addActive ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  )}
                  onClick={() => setAddActive((v) => !v)}
                  disabled={busyId === "__add__"}
                >
                  {addActive ? (
                    <>
                      <ToggleRight className="mr-2 h-5 w-5" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="mr-2 h-5 w-5" />
                      Disabled
                    </>
                  )}
                </Button>
              </SectionCard>

              <SectionCard title="Basic details">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Name
                    </label>
                    <Input
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="New choice name"
                      className="h-11 rounded-xl border-slate-200"
                    />
                  </div>

                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={addExtraSticker}
                      onChange={(e) => setAddExtraSticker(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Extra sticker
                  </label>
                </div>
              </SectionCard>

              <SectionCard title="Allergens" subtitle="Tap to select or unselect">
                <div className="flex flex-wrap gap-2">
                  {allergenOptions.map((allergen) => {
                    const selected = addAllergens.some((a) => a.id === allergen.id);
                    return (
                      <AllergenChip
                        key={allergen.id}
                        allergen={allergen}
                        selected={selected}
                        onToggle={() =>
                          toggleAllergen(addAllergens, setAddAllergens, allergen)
                        }
                      />
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Nutrition" subtitle="Per portion">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <LabeledInput label="Calories (kcal)" value={addCalories} onChange={setAddCalories} />
                  <LabeledInput label="Protein (g)" value={addProtein} onChange={setAddProtein} />
                  <LabeledInput label="Carbs (g)" value={addCarbs} onChange={setAddCarbs} />
                  <LabeledInput label="Sugars (g)" value={addSugars} onChange={setAddSugars} />
                  <LabeledInput label="Fat (g)" value={addFat} onChange={setAddFat} />
                  <LabeledInput label="Saturates (g)" value={addSaturates} onChange={setAddSaturates} />
                  <LabeledInput label="Fibre (g)" value={addFibre} onChange={setAddFibre} />
                  <LabeledInput label="Salt (g)" value={addSalt} onChange={setAddSalt} />
                </div>
              </SectionCard>
            </div>

            <DialogFooter className="sticky bottom-0 border-t border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeAdd} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={saveAdd}
                  disabled={!addName.trim() || busyId === "__add__"}
                  className="rounded-xl"
                >
                  {busyId === "__add__" ? "Creating..." : "Create choice"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingToggleChoice(null);
            setPendingToggleNextValue(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl bg-white text-slate-900 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm status change
            </DialogTitle>
            <DialogDescription>
              {pendingToggleChoice && pendingToggleNextValue !== null
                ? `Are you sure you want to ${
                    pendingToggleNextValue ? "enable" : "disable"
                  } "${pendingToggleChoice.name}"?`
                : "Are you sure?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingToggleChoice(null);
                  setPendingToggleNextValue(null);
                }}
                className="rounded-xl"
              >
                Cancel
              </Button>

              <Button
                onClick={confirmToggleChoice}
                className={cn(
                  "rounded-xl text-white",
                  pendingToggleNextValue
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                )}
              >
                {pendingToggleNextValue ? (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Enable
                  </>
                ) : (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Disable
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}