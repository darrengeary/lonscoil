"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Plus, Upload, Pencil, ToggleLeft, ToggleRight } from "lucide-react";

type Allergen = { id: string; name: string; color?: string | null };

export interface MealChoice {
  id: string;
  name: string;
  imageUrl?: string | null;
  active?: boolean;

  allergens?: Allergen[];
  ingredients?: string[];

  availStart?: string | null; // ISO from API
  availEnd?: string | null;

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
  groupId: string;
  initialChoices?: MealChoice[];
  disabled?: boolean;
}

const PLACEHOLDER_IMG = "/meal-placeholder.jpg";

async function fetchMealChoices(groupId: string) {
  const res = await fetch(`/api/meal-choices?groupId=${groupId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as MealChoice[];
}

async function fetchAllergens() {
  const res = await fetch(`/api/allergens`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Allergen[];
}

async function uploadMealChoiceImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/meal-choices/upload", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.url as string;
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

async function createMealChoice(payload: { name: string; groupId: string; active?: boolean }) {
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

function addTag(list: string[], raw: string) {
  const v = raw.trim();
  if (!v) return list;
  if (list.includes(v)) return list;
  return [...list, v];
}

function removeTag(list: string[], v: string) {
  return list.filter((x) => x !== v);
}

export default function ChoiceManager({ groupId, initialChoices, disabled = false }: Props) {
  const [choices, setChoices] = useState<MealChoice[]>(initialChoices ?? []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [allergenOptions, setAllergenOptions] = useState<Allergen[]>([]);

  // ---------- modals ----------
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingChoice = useMemo(
    () => choices.find((c) => c.id === editingId) ?? null,
    [choices, editingId]
  );

  // ---------- EDIT state ----------
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);

  const [editAllergens, setEditAllergens] = useState<Allergen[]>([]);
  const [editAllergenQuery, setEditAllergenQuery] = useState("");
  const [editAllergenOpen, setEditAllergenOpen] = useState(false);

  const [editIngredients, setEditIngredients] = useState<string[]>([]);
  const [editIngredientInput, setEditIngredientInput] = useState("");

  const [editAvailStart, setEditAvailStart] = useState<Date | undefined>(undefined);
  const [editAvailEnd, setEditAvailEnd] = useState<Date | undefined>(undefined);

  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editSugars, setEditSugars] = useState("");
  const [editFat, setEditFat] = useState("");
  const [editSaturates, setEditSaturates] = useState("");
  const [editFibre, setEditFibre] = useState("");
  const [editSalt, setEditSalt] = useState("");

  // ---------- ADD state ----------
  const [addName, setAddName] = useState("");
  const [addActive, setAddActive] = useState(true);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addPreviewUrl, setAddPreviewUrl] = useState<string | null>(null);

  const [addAllergens, setAddAllergens] = useState<Allergen[]>([]);
  const [addAllergenQuery, setAddAllergenQuery] = useState("");
  const [addAllergenOpen, setAddAllergenOpen] = useState(false);

  const [addIngredients, setAddIngredients] = useState<string[]>([]);
  const [addIngredientInput, setAddIngredientInput] = useState("");

  const [addAvailStart, setAddAvailStart] = useState<Date | undefined>(undefined);
  const [addAvailEnd, setAddAvailEnd] = useState<Date | undefined>(undefined);

  const [addCalories, setAddCalories] = useState("");
  const [addProtein, setAddProtein] = useState("");
  const [addCarbs, setAddCarbs] = useState("");
  const [addSugars, setAddSugars] = useState("");
  const [addFat, setAddFat] = useState("");
  const [addSaturates, setAddSaturates] = useState("");
  const [addFibre, setAddFibre] = useState("");
  const [addSalt, setAddSalt] = useState("");

  // Load meal choices (fresh on refresh)
  useEffect(() => {
    let cancelled = false;

    fetchMealChoices(groupId)
      .then((rows) => {
        if (!cancelled) setChoices(rows);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Load allergen suggestions (with colors)
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

  // Cleanup preview object URLs
  useEffect(() => {
    return () => {
      if (editPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(editPreviewUrl);
      if (addPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(addPreviewUrl);
    };
  }, [editPreviewUrl, addPreviewUrl]);

  function openEdit(choice: MealChoice) {
    setEditingId(choice.id);
    setEditOpen(true);

    setEditName(choice.name);
    setEditActive(choice.active ?? true);
    setEditFile(null);
    setEditPreviewUrl(null);

    setEditAllergens(choice.allergens ?? []);
    setEditAllergenQuery("");
    setEditAllergenOpen(false);

    setEditIngredients(choice.ingredients ?? []);
    setEditIngredientInput("");

    setEditAvailStart(choice.availStart ? new Date(choice.availStart) : undefined);
    setEditAvailEnd(choice.availEnd ? new Date(choice.availEnd) : undefined);

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
    setEditFile(null);
    if (editPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(editPreviewUrl);
    setEditPreviewUrl(null);
  }

  function openAdd() {
    setAddOpen(true);

    setAddName("");
    setAddActive(true);
    setAddFile(null);
    if (addPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(addPreviewUrl);
    setAddPreviewUrl(null);

    setAddAllergens([]);
    setAddAllergenQuery("");
    setAddAllergenOpen(false);

    setAddIngredients([]);
    setAddIngredientInput("");

    setAddAvailStart(undefined);
    setAddAvailEnd(undefined);

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
    setAddFile(null);
    if (addPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(addPreviewUrl);
    setAddPreviewUrl(null);
  }

  async function saveEdit() {
    if (!editingChoice) return;

    try {
      setBusyId(editingChoice.id);

      // Upload first if needed, and show immediately
      let imageUrl: string | null | undefined = editingChoice.imageUrl ?? null;
      if (editFile) {
        const url = await uploadMealChoiceImage(editFile);
        imageUrl = url;

        // update UI immediately
        setChoices((prev) => prev.map((c) => (c.id === editingChoice.id ? { ...c, imageUrl: url } : c)));
        setEditPreviewUrl(url);
      }

      const updated = await updateMealChoice({
        id: editingChoice.id,
        name: editName.trim(),
        active: editActive,
        imageUrl,

        ingredients: editIngredients,
        availStart: editAvailStart ? editAvailStart.toISOString() : null,
        availEnd: editAvailEnd ? editAvailEnd.toISOString() : null,

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

      // 1) create to get ID
      const created = await createMealChoice({ name, groupId, active: addActive });

      // 2) persist fields (1 PUT)
      let updated = await updateMealChoice({
        id: created.id,
        active: addActive,
        ingredients: addIngredients,
        availStart: addAvailStart ? addAvailStart.toISOString() : null,
        availEnd: addAvailEnd ? addAvailEnd.toISOString() : null,
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

      // 3) optional upload image, show immediately
      if (addFile) {
        const url = await uploadMealChoiceImage(addFile);
        updated = await updateMealChoice({ id: created.id, imageUrl: url });
      }

      setChoices((prev) => [...prev, { ...created, ...updated }]);
      closeAdd();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  // ---------- Render helpers ----------
  const editHeroSrc =
    editPreviewUrl ??
    (editingChoice?.imageUrl && editingChoice.imageUrl.length > 0 ? editingChoice.imageUrl : PLACEHOLDER_IMG);

  const addHeroSrc = addPreviewUrl ?? PLACEHOLDER_IMG;

  return (
    <div className="mt-2">
      {/* List */}
      {choices.map((choice) => {
        const isBusy = busyId === choice.id;
        const isActive = choice.active === true;

        const src = choice.imageUrl && choice.imageUrl.length > 0 ? choice.imageUrl : PLACEHOLDER_IMG;

        return (
          <div key={choice.id} className="flex items-center justify-between py-2 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-xl overflow-hidden bg-gray-100 border shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={choice.name} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0">
                <div className="truncate">{choice.name}</div>
                <div className="text-xs text-gray-500">{isActive ? "Active" : "Disabled"}</div>
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

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={(v) => (v ? null : closeEdit())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit choice</DialogTitle>
            <DialogDescription>Update image, allergens, ingredients, availability, and nutrition.</DialogDescription>
          </DialogHeader>

          {editingChoice && (
            <div className="space-y-4">
              {/* HERO IMAGE */}
              <div className="w-full overflow-hidden rounded-2xl border bg-gray-100">
                <div className="h-44 sm:h-52 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editHeroSrc} alt={editingChoice.name} className="h-full w-full object-cover" />
                </div>
              </div>

              {/* ACTIVE prominent */}
              <Button
                type="button"
                className={`w-full rounded-2xl py-6 text-base font-semibold ${
                  editActive ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
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

              {/* Name */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Name</div>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Choice name" />
              </div>

              {/* Replace image (preview immediately) */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Replace image</div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-blue-700">
                  <Upload className="h-4 w-4" />
                  <span>{editFile ? editFile.name : "Choose file"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={busyId === editingChoice.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setEditFile(f);
                      if (editPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(editPreviewUrl);
                      setEditPreviewUrl(f ? URL.createObjectURL(f) : null);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Allergens (dropdown shows all on focus) */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Allergens</div>

                <div className="flex flex-wrap gap-2">
                  {editAllergens.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm border"
                      style={pillStyle(a.color)}
                    >
                      {a.name}
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100"
                        onClick={() => setEditAllergens((prev) => prev.filter((x) => x.id !== a.id))}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <Input
                    value={editAllergenQuery}
                    onChange={(e) => setEditAllergenQuery(e.target.value)}
                    placeholder="Search allergens…"
                    onFocus={() => setEditAllergenOpen(true)}
                    onBlur={() => setTimeout(() => setEditAllergenOpen(false), 120)}
                  />

                  {editAllergenOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow max-h-56 overflow-auto">
                      {allergenOptions
                        .filter((a) =>
                          editAllergenQuery.trim()
                            ? a.name.toLowerCase().includes(editAllergenQuery.trim().toLowerCase())
                            : true
                        )
                        .map((a) => {
                          const already = editAllergens.some((x) => x.id === a.id);
                          return (
                            <button
                              type="button"
                              key={a.id}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-between"
                              disabled={already}
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                setEditAllergens((prev) => [...prev, a]);
                                setEditAllergenQuery("");
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full border" style={pillStyle(a.color)} />
                                {a.name}
                              </span>
                              <span className="text-xs text-gray-400">{already ? "Added" : ""}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Ingredients (no colour) */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Ingredients</div>

                <div className="flex flex-wrap gap-2">
                  {editIngredients.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                      {t}
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100"
                        onClick={() => setEditIngredients((prev) => removeTag(prev, t))}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <Input
                  value={editIngredientInput}
                  placeholder="Type ingredient and press Enter…"
                  onChange={(e) => setEditIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setEditIngredients((prev) => addTag(prev, editIngredientInput));
                      setEditIngredientInput("");
                    }
                    if (e.key === "Backspace" && !editIngredientInput && editIngredients.length) {
                      setEditIngredients((prev) => prev.slice(0, -1));
                    }
                  }}
                />
              </div>

              {/* Availability (calendar popover) */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Availability</div>

                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full rounded-2xl justify-between">
                        {editAvailStart ? format(editAvailStart, "EEE dd MMM") : "Select date"}
                        <span className="text-xs text-gray-500">Start</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editAvailStart} onSelect={setEditAvailStart} />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full rounded-2xl justify-between">
                        {editAvailEnd ? format(editAvailEnd, "EEE dd MMM") : "Select date"}
                        <span className="text-xs text-gray-500">End</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editAvailEnd} onSelect={setEditAvailEnd} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Nutrition */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Nutrition (per portion)</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Calories (kcal)" value={editCalories} onChange={(e) => setEditCalories(e.target.value)} />
                  <Input placeholder="Protein (g)" value={editProtein} onChange={(e) => setEditProtein(e.target.value)} />
                  <Input placeholder="Carbs (g)" value={editCarbs} onChange={(e) => setEditCarbs(e.target.value)} />
                  <Input placeholder="Sugars (g)" value={editSugars} onChange={(e) => setEditSugars(e.target.value)} />
                  <Input placeholder="Fat (g)" value={editFat} onChange={(e) => setEditFat(e.target.value)} />
                  <Input placeholder="Saturates (g)" value={editSaturates} onChange={(e) => setEditSaturates(e.target.value)} />
                  <Input placeholder="Fibre (g)" value={editFibre} onChange={(e) => setEditFibre(e.target.value)} />
                  <Input placeholder="Salt (g)" value={editSalt} onChange={(e) => setEditSalt(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!editingChoice || !editName.trim() || busyId === editingChoice.id}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD MODAL */}
      <Dialog open={addOpen} onOpenChange={(v) => (v ? null : closeAdd())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add choice</DialogTitle>
            <DialogDescription>Create a new choice with optional image, allergens, availability, and nutrition.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* HERO IMAGE */}
            <div className="w-full overflow-hidden rounded-2xl border bg-gray-100">
              <div className="h-44 sm:h-52 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={addHeroSrc} alt="New choice" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* ACTIVE prominent */}
            <Button
              type="button"
              className={`w-full rounded-2xl py-6 text-base font-semibold ${
                addActive ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
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

            {/* Name */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Name</div>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="New choice name" />
            </div>

            {/* Image (preview immediately) */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Image (optional)</div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-blue-700">
                <Upload className="h-4 w-4" />
                <span>{addFile ? addFile.name : "Choose file"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={busyId === "__add__"}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAddFile(f);
                    if (addPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(addPreviewUrl);
                    setAddPreviewUrl(f ? URL.createObjectURL(f) : null);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {/* Allergens */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Allergens</div>

              <div className="flex flex-wrap gap-2">
                {addAllergens.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm border"
                    style={pillStyle(a.color)}
                  >
                    {a.name}
                    <button
                      type="button"
                      className="opacity-60 hover:opacity-100"
                      onClick={() => setAddAllergens((prev) => prev.filter((x) => x.id !== a.id))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              <div className="relative">
                <Input
                  value={addAllergenQuery}
                  onChange={(e) => setAddAllergenQuery(e.target.value)}
                  placeholder="Search allergens…"
                  onFocus={() => setAddAllergenOpen(true)}
                  onBlur={() => setTimeout(() => setAddAllergenOpen(false), 120)}
                />

                {addAllergenOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow max-h-56 overflow-auto">
                    {allergenOptions
                      .filter((a) =>
                        addAllergenQuery.trim()
                          ? a.name.toLowerCase().includes(addAllergenQuery.trim().toLowerCase())
                          : true
                      )
                      .map((a) => {
                        const already = addAllergens.some((x) => x.id === a.id);
                        return (
                          <button
                            type="button"
                            key={a.id}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-between"
                            disabled={already}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => {
                              setAddAllergens((prev) => [...prev, a]);
                              setAddAllergenQuery("");
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <span className="inline-block h-3 w-3 rounded-full border" style={pillStyle(a.color)} />
                              {a.name}
                            </span>
                            <span className="text-xs text-gray-400">{already ? "Added" : ""}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Ingredients</div>

              <div className="flex flex-wrap gap-2">
                {addIngredients.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                    {t}
                    <button
                      type="button"
                      className="opacity-60 hover:opacity-100"
                      onClick={() => setAddIngredients((prev) => removeTag(prev, t))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              <Input
                value={addIngredientInput}
                placeholder="Type ingredient and press Enter…"
                onChange={(e) => setAddIngredientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setAddIngredients((prev) => addTag(prev, addIngredientInput));
                    setAddIngredientInput("");
                  }
                  if (e.key === "Backspace" && !addIngredientInput && addIngredients.length) {
                    setAddIngredients((prev) => prev.slice(0, -1));
                  }
                }}
              />
            </div>

            {/* Availability */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Availability</div>

              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full rounded-2xl justify-between">
                      {addAvailStart ? format(addAvailStart, "EEE dd MMM") : "Select date"}
                      <span className="text-xs text-gray-500">Start</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={addAvailStart} onSelect={setAddAvailStart} />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full rounded-2xl justify-between">
                      {addAvailEnd ? format(addAvailEnd, "EEE dd MMM") : "Select date"}
                      <span className="text-xs text-gray-500">End</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={addAvailEnd} onSelect={setAddAvailEnd} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Nutrition */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Nutrition (per portion)</div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Calories (kcal)" value={addCalories} onChange={(e) => setAddCalories(e.target.value)} />
                <Input placeholder="Protein (g)" value={addProtein} onChange={(e) => setAddProtein(e.target.value)} />
                <Input placeholder="Carbs (g)" value={addCarbs} onChange={(e) => setAddCarbs(e.target.value)} />
                <Input placeholder="Sugars (g)" value={addSugars} onChange={(e) => setAddSugars(e.target.value)} />
                <Input placeholder="Fat (g)" value={addFat} onChange={(e) => setAddFat(e.target.value)} />
                <Input placeholder="Saturates (g)" value={addSaturates} onChange={(e) => setAddSaturates(e.target.value)} />
                <Input placeholder="Fibre (g)" value={addFibre} onChange={(e) => setAddFibre(e.target.value)} />
                <Input placeholder="Salt (g)" value={addSalt} onChange={(e) => setAddSalt(e.target.value)} />
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
