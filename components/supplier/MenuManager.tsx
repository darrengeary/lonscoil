"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import MealGroupManager from "@/components/supplier/MealGroupManager";
import type { MealGroup } from "@/components/supplier/MealGroupManager";

export type SchoolTag = { id: string; name: string };
export type AllergenTag = { id: string; name: string };

export type MenuDTO = {
  id: string;
  name: string;
  active: boolean;
  schools: SchoolTag[];
};

export type MealOptionDTO = {
  id: string;
  name: string;
  menuId: string;
  active: boolean;
  imageUrl: string | null;
  availStart: string | null;
  availEnd: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fatG: number | null;
  saturatesG: number | null;
  fibreG: number | null;
  saltG: number | null;
  allergens: AllergenTag[];
  groups: MealGroup[];
};

export type MenuSection = {
  menu: MenuDTO;
  mealOptions: MealOptionDTO[];
};

type SavedMealOptionResponse = MealOptionDTO;

const PLACEHOLDER_IMG = "/meal-placeholder.jpg";

function addTag<T extends { id: string }>(list: T[], v: T) {
  if (list.some((x) => x.id === v.id)) return list;
  return [...list, v];
}

function removeTagById<T extends { id: string }>(list: T[], id: string) {
  return list.filter((x) => x.id !== id);
}

function toggleTag<T extends { id: string }>(list: T[], v: T) {
  return list.some((x) => x.id === v.id) ? removeTagById(list, v.id) : addTag(list, v);
}

function schoolTagClass(id: string) {
  const n = Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
  const styles = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-green-100 text-green-800 border-green-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-amber-100 text-amber-900 border-amber-200",
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-teal-100 text-teal-800 border-teal-200",
  ];
  return styles[n];
}

async function uploadMealOptionImage(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/meal-options/upload", {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.url as string;
}

function parseNullableDate(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseNullableNumber(v: string) {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDateInputValue(v: string | null) {
  if (!v) return "";
  try {
    return format(new Date(v), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

export default function MenuManager({
  initialSections = [],
  allAllergens,
}: {
  initialSections?: MenuSection[];
  allAllergens: AllergenTag[];
}) {
  const [sections, setSections] = useState<MenuSection[]>(initialSections);

  const [openMenuIds, setOpenMenuIds] = useState<Record<string, boolean>>(() => {
    const first = initialSections?.[0]?.menu.id;
    return first ? { [first]: true } : {};
  });

  const [openMealOptionIds, setOpenMealOptionIds] = useState<Record<string, boolean>>({});

  const [allSchools, setAllSchools] = useState<SchoolTag[]>([]);
  useEffect(() => {
    fetch("/api/schools", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((rows) => setAllSchools(rows))
      .catch(() => setAllSchools([]));
  }, []);

  const [allMenus, setAllMenus] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    setAllMenus(
      initialSections.map((s) => ({
        id: s.menu.id,
        name: s.menu.name,
      }))
    );
  }, [initialSections]);

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState("");
  const [menuActive, setMenuActive] = useState(false);
  const [duplicateFromMenuId, setDuplicateFromMenuId] = useState("");

  const [selectedSchools, setSelectedSchools] = useState<SchoolTag[]>([]);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolSuggestOpen, setSchoolSuggestOpen] = useState(false);

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [mealModalMenuId, setMealModalMenuId] = useState<string | null>(null);
  const [mealEditingId, setMealEditingId] = useState<string | null>(null);
  const [mealOptionName, setMealOptionName] = useState("");
  const [mealOptionActive, setMealOptionActive] = useState(false);
  const [mealOptionImageFile, setMealOptionImageFile] = useState<File | null>(null);
  const [mealOptionImagePreviewUrl, setMealOptionImagePreviewUrl] = useState<string | null>(null);
  const [mealOptionImageUrl, setMealOptionImageUrl] = useState<string | null>(null);
  const [mealOptionAvailStart, setMealOptionAvailStart] = useState("");
  const [mealOptionAvailEnd, setMealOptionAvailEnd] = useState("");
  const [mealOptionCaloriesKcal, setMealOptionCaloriesKcal] = useState("");
  const [mealOptionProteinG, setMealOptionProteinG] = useState("");
  const [mealOptionCarbsG, setMealOptionCarbsG] = useState("");
  const [mealOptionSugarsG, setMealOptionSugarsG] = useState("");
  const [mealOptionFatG, setMealOptionFatG] = useState("");
  const [mealOptionSaturatesG, setMealOptionSaturatesG] = useState("");
  const [mealOptionFibreG, setMealOptionFibreG] = useState("");
  const [mealOptionSaltG, setMealOptionSaltG] = useState("");
  const [mealOptionAllergens, setMealOptionAllergens] = useState<AllergenTag[]>([]);

  const menuNameRef = useRef<HTMLInputElement>(null);
  const mealOptionNameRef = useRef<HTMLInputElement>(null);

  const isEditMenu = !!editingMenuId;
  const isEditMealOption = !!mealEditingId;

  const canSaveMenu = useMemo(
    () => menuName.trim().length >= 2 || (!!duplicateFromMenuId && !isEditMenu),
    [menuName, duplicateFromMenuId, isEditMenu]
  );

  const canSaveMealOption = useMemo(() => mealOptionName.trim().length >= 2, [mealOptionName]);

  const suggestedSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    const base = allSchools.filter((s) => !selectedSchools.some((x) => x.id === s.id));
    if (!q) return base.slice(0, 10);
    return base.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [allSchools, selectedSchools, schoolQuery]);

  useEffect(() => {
    return () => {
      if (mealOptionImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(mealOptionImagePreviewUrl);
      }
    };
  }, [mealOptionImagePreviewUrl]);

  function toggleMenu(menuId: string) {
    setOpenMenuIds((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  }

  function toggleMealOption(mealOptionId: string) {
    setOpenMealOptionIds((prev) => ({ ...prev, [mealOptionId]: !prev[mealOptionId] }));
  }

  function openCreateMenu() {
    setEditingMenuId(null);
    setMenuName("");
    setMenuActive(false);
    setDuplicateFromMenuId("");
    setSelectedSchools([]);
    setSchoolQuery("");
    setSchoolSuggestOpen(false);
    setMenuModalOpen(true);
    setTimeout(() => menuNameRef.current?.focus(), 0);
  }

  function openEditMenu(menu: MenuDTO) {
    setEditingMenuId(menu.id);
    setMenuName(menu.name);
    setMenuActive(menu.active);
    setDuplicateFromMenuId("");
    setSelectedSchools(menu.schools ?? []);
    setSchoolQuery("");
    setSchoolSuggestOpen(false);
    setMenuModalOpen(true);
    setTimeout(() => menuNameRef.current?.focus(), 0);
  }

  function closeMenuModal() {
    setMenuModalOpen(false);
    setEditingMenuId(null);
  }

  async function saveMenu() {
    if (!canSaveMenu) return;

    const schoolIds = selectedSchools.map((s) => s.id);

    const res = await fetch("/api/menus", {
      method: isEditMenu ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEditMenu
          ? {
              id: editingMenuId,
              name: menuName.trim(),
              schoolIds,
              active: menuActive,
            }
          : {
              name: menuName.trim(),
              schoolIds,
              active: false,
              duplicateFromMenuId: duplicateFromMenuId || null,
            }
      ),
    });

    if (!res.ok) return;

    const saved = await res.json();

    if (isEditMenu) {
      setSections((prev) =>
        prev.map((section) =>
          section.menu.id === saved.id ? { ...section, menu: saved } : section
        )
      );
    } else {
      window.location.reload();
    }

    closeMenuModal();
  }

  async function toggleMenuActive(menu: MenuDTO) {
    const res = await fetch("/api/menus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: menu.id,
        name: menu.name,
        schoolIds: menu.schools.map((s) => s.id),
        active: !menu.active,
      }),
    });

    if (!res.ok) return;
    const saved: MenuDTO = await res.json();

    setSections((prev) =>
      prev.map((section) =>
        section.menu.id === saved.id ? { ...section, menu: saved } : section
      )
    );
  }

  function resetMealOptionForm() {
    setMealEditingId(null);
    setMealModalMenuId(null);
    setMealOptionName("");
    setMealOptionActive(false);
    setMealOptionImageFile(null);
    if (mealOptionImagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(mealOptionImagePreviewUrl);
    }
    setMealOptionImagePreviewUrl(null);
    setMealOptionImageUrl(null);
    setMealOptionAvailStart("");
    setMealOptionAvailEnd("");
    setMealOptionCaloriesKcal("");
    setMealOptionProteinG("");
    setMealOptionCarbsG("");
    setMealOptionSugarsG("");
    setMealOptionFatG("");
    setMealOptionSaturatesG("");
    setMealOptionFibreG("");
    setMealOptionSaltG("");
    setMealOptionAllergens([]);
  }

  function openCreateMealOption(menuId: string) {
    resetMealOptionForm();
    setMealModalMenuId(menuId);
    setMealModalOpen(true);
    setTimeout(() => mealOptionNameRef.current?.focus(), 0);
  }

  function openEditMealOption(mealOption: MealOptionDTO) {
    resetMealOptionForm();
    setMealEditingId(mealOption.id);
    setMealModalMenuId(mealOption.menuId);
    setMealOptionName(mealOption.name);
    setMealOptionActive(mealOption.active);
    setMealOptionImageUrl(mealOption.imageUrl);
    setMealOptionAvailStart(toDateInputValue(mealOption.availStart));
    setMealOptionAvailEnd(toDateInputValue(mealOption.availEnd));
    setMealOptionCaloriesKcal(mealOption.caloriesKcal?.toString() ?? "");
    setMealOptionProteinG(mealOption.proteinG?.toString() ?? "");
    setMealOptionCarbsG(mealOption.carbsG?.toString() ?? "");
    setMealOptionSugarsG(mealOption.sugarsG?.toString() ?? "");
    setMealOptionFatG(mealOption.fatG?.toString() ?? "");
    setMealOptionSaturatesG(mealOption.saturatesG?.toString() ?? "");
    setMealOptionFibreG(mealOption.fibreG?.toString() ?? "");
    setMealOptionSaltG(mealOption.saltG?.toString() ?? "");
    setMealOptionAllergens(mealOption.allergens);
    setMealModalOpen(true);
    setTimeout(() => mealOptionNameRef.current?.focus(), 0);
  }

  function closeMealOptionModal() {
    setMealModalOpen(false);
    resetMealOptionForm();
  }

  async function saveMealOption() {
    if (!mealModalMenuId || !canSaveMealOption) return;

    let uploadedImageUrl = mealOptionImageUrl;
    if (mealOptionImageFile) {
      uploadedImageUrl = await uploadMealOptionImage(mealOptionImageFile);
    }

    const body = isEditMealOption
      ? {
          id: mealEditingId,
          name: mealOptionName.trim(),
          active: mealOptionActive,
          imageUrl: uploadedImageUrl,
          availStart: parseNullableDate(mealOptionAvailStart),
          availEnd: parseNullableDate(mealOptionAvailEnd),
          caloriesKcal: parseNullableNumber(mealOptionCaloriesKcal),
          proteinG: parseNullableNumber(mealOptionProteinG),
          carbsG: parseNullableNumber(mealOptionCarbsG),
          sugarsG: parseNullableNumber(mealOptionSugarsG),
          fatG: parseNullableNumber(mealOptionFatG),
          saturatesG: parseNullableNumber(mealOptionSaturatesG),
          fibreG: parseNullableNumber(mealOptionFibreG),
          saltG: parseNullableNumber(mealOptionSaltG),
          allergenIds: mealOptionAllergens.map((a) => a.id),
        }
      : {
          menuId: mealModalMenuId,
          name: mealOptionName.trim(),
          active: false,
          imageUrl: uploadedImageUrl,
          availStart: parseNullableDate(mealOptionAvailStart),
          availEnd: parseNullableDate(mealOptionAvailEnd),
          caloriesKcal: parseNullableNumber(mealOptionCaloriesKcal),
          proteinG: parseNullableNumber(mealOptionProteinG),
          carbsG: parseNullableNumber(mealOptionCarbsG),
          sugarsG: parseNullableNumber(mealOptionSugarsG),
          fatG: parseNullableNumber(mealOptionFatG),
          saturatesG: parseNullableNumber(mealOptionSaturatesG),
          fibreG: parseNullableNumber(mealOptionFibreG),
          saltG: parseNullableNumber(mealOptionSaltG),
          allergenIds: mealOptionAllergens.map((a) => a.id),
        };

    const res = await fetch("/api/meal-options", {
      method: isEditMealOption ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return;

    const saved: SavedMealOptionResponse = await res.json();

    setSections((prev) =>
      prev.map((section) => {
        if (section.menu.id !== mealModalMenuId) return section;

        if (isEditMealOption) {
          return {
            ...section,
            mealOptions: section.mealOptions.map((existingMealOption) =>
              existingMealOption.id === saved.id
                ? { ...existingMealOption, ...saved, groups: existingMealOption.groups }
                : existingMealOption
            ),
          };
        }

        return {
          ...section,
          mealOptions: [...section.mealOptions, { ...saved, groups: [] }],
        };
      })
    );

    setOpenMealOptionIds((prev) => ({
      ...prev,
      [saved.id]: true,
    }));

    closeMealOptionModal();
  }

  async function toggleMealOptionActive(mealOption: MealOptionDTO) {
    const res = await fetch("/api/meal-options", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: mealOption.id,
        name: mealOption.name,
        active: !mealOption.active,
        imageUrl: mealOption.imageUrl,
        availStart: mealOption.availStart,
        availEnd: mealOption.availEnd,
        caloriesKcal: mealOption.caloriesKcal,
        proteinG: mealOption.proteinG,
        carbsG: mealOption.carbsG,
        sugarsG: mealOption.sugarsG,
        fatG: mealOption.fatG,
        saturatesG: mealOption.saturatesG,
        fibreG: mealOption.fibreG,
        saltG: mealOption.saltG,
        allergenIds: mealOption.allergens.map((a) => a.id),
      }),
    });

    if (!res.ok) return;
    const saved: SavedMealOptionResponse = await res.json();

    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        mealOptions: section.mealOptions.map((existingMealOption) =>
          existingMealOption.id === saved.id
            ? { ...existingMealOption, ...saved }
            : existingMealOption
        ),
      }))
    );
  }

  function handleMealGroupsChange(menuId: string, mealOptionId: string, groups: MealGroup[]) {
    setSections((prev) =>
      prev.map((section) =>
        section.menu.id !== menuId
          ? section
          : {
              ...section,
              mealOptions: section.mealOptions.map((mealOption) =>
                mealOption.id !== mealOptionId ? mealOption : { ...mealOption, groups }
              ),
            }
      )
    );
  }

  const mealPreviewSrc =
    mealOptionImagePreviewUrl ??
    (mealOptionImageUrl && mealOptionImageUrl.length > 0 ? mealOptionImageUrl : PLACEHOLDER_IMG);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={openCreateMenu}>
          <Plus className="mr-2 h-4 w-4" />
          New Menu
        </Button>
      </div>

      {menuModalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-md space-y-4 border">
            <h2 className="text-lg font-semibold">{isEditMenu ? "Edit Menu" : "Add Menu"}</h2>

            <div className="space-y-3">
              {!isEditMenu && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-600">Duplicate from existing menu</div>
                  <select
                    value={duplicateFromMenuId}
                    onChange={(e) => setDuplicateFromMenuId(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="">No duplicate</option>
                    {allMenus.map((menu) => (
                      <option key={menu.id} value={menu.id}>
                        {menu.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Menu name</div>
                <Input
                  ref={menuNameRef}
                  placeholder="e.g. Standard, Gluten Free"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                />
              </div>

              <Button
                type="button"
                className={`w-full rounded-2xl py-6 text-base font-semibold ${
                  menuActive ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
                }`}
                onClick={() => setMenuActive((v) => !v)}
              >
                {menuActive ? (
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
                <div className="text-sm font-medium">Schools</div>

                <div className="flex flex-wrap gap-2">
                  {selectedSchools.map((school) => (
                    <span
                      key={school.id}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
                    >
                      {school.name}
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100"
                        onClick={() =>
                          setSelectedSchools((prev) => removeTagById(prev, school.id))
                        }
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <Input
                    value={schoolQuery}
                    placeholder="Type school name and press Enter…"
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    onFocus={() => setSchoolSuggestOpen(true)}
                    onBlur={() => setTimeout(() => setSchoolSuggestOpen(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const q = schoolQuery.trim().toLowerCase();
                        if (!q) return;

                        const hit =
                          suggestedSchools.find((school) => school.name.toLowerCase() === q) ??
                          suggestedSchools[0];

                        if (hit) {
                          setSelectedSchools((prev) => addTag(prev, hit));
                          setSchoolQuery("");
                        }
                      }

                      if (e.key === "Backspace" && !schoolQuery && selectedSchools.length) {
                        setSelectedSchools((prev) => prev.slice(0, -1));
                      }
                    }}
                  />

                  {schoolSuggestOpen && suggestedSchools.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border bg-white shadow max-h-56 overflow-auto">
                      {suggestedSchools.map((school) => (
                        <button
                          key={school.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            setSelectedSchools((prev) => addTag(prev, school));
                            setSchoolQuery("");
                          }}
                        >
                          <span>{school.name}</span>
                          <span className="text-xs text-gray-400">Add</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  If you leave this empty, the menu is <span className="font-semibold">GLOBAL</span>.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeMenuModal} type="button">
                  Cancel
                </Button>
                <Button onClick={saveMenu} disabled={!canSaveMenu} type="button">
                  {isEditMenu ? "Save" : "Create Disabled"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mealModalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 overflow-y-auto p-6">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-2xl space-y-4 border max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">
              {isEditMealOption ? "Edit Meal Option" : "Add Meal Option"}
            </h2>

            <div className="space-y-4">
              <div className="w-full overflow-hidden rounded-2xl border bg-gray-100">
                <div className="h-44 sm:h-52 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mealPreviewSrc} alt="Meal preview" className="h-full w-full object-cover" />
                </div>
              </div>

              <Button
                type="button"
                className={`w-full rounded-2xl py-6 text-base font-semibold ${
                  mealOptionActive
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
                onClick={() => setMealOptionActive((v) => !v)}
              >
                {mealOptionActive ? (
                  <span className="inline-flex items-center gap-2">
                    <ToggleRight /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ToggleLeft /> Disabled
                  </span>
                )}
              </Button>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Meal option name</div>
                <Input
                  ref={mealOptionNameRef}
                  placeholder="e.g. Chicken Curry, Soup + Sandwich"
                  value={mealOptionName}
                  onChange={(e) => setMealOptionName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Image</div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-blue-700">
                  <Upload className="h-4 w-4" />
                  <span>{mealOptionImageFile ? mealOptionImageFile.name : "Choose file"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setMealOptionImageFile(f);
                      if (mealOptionImagePreviewUrl?.startsWith("blob:")) {
                        URL.revokeObjectURL(mealOptionImagePreviewUrl);
                      }
                      setMealOptionImagePreviewUrl(f ? URL.createObjectURL(f) : null);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-600">Available from</div>
                  <Input
                    type="date"
                    value={mealOptionAvailStart}
                    onChange={(e) => setMealOptionAvailStart(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-600">Available until</div>
                  <Input
                    type="date"
                    value={mealOptionAvailEnd}
                    onChange={(e) => setMealOptionAvailEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Allergens</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-xl border p-3">
                  {allAllergens.map((allergen) => {
                    const checked = mealOptionAllergens.some((a) => a.id === allergen.id);
                    return (
                      <label key={allergen.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setMealOptionAllergens((prev) => toggleTag(prev, allergen))
                          }
                        />
                        {allergen.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Nutrition (per portion)</div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Calories (kcal)" value={mealOptionCaloriesKcal} onChange={(e) => setMealOptionCaloriesKcal(e.target.value)} />
                  <Input placeholder="Protein (g)" value={mealOptionProteinG} onChange={(e) => setMealOptionProteinG(e.target.value)} />
                  <Input placeholder="Carbs (g)" value={mealOptionCarbsG} onChange={(e) => setMealOptionCarbsG(e.target.value)} />
                  <Input placeholder="Sugars (g)" value={mealOptionSugarsG} onChange={(e) => setMealOptionSugarsG(e.target.value)} />
                  <Input placeholder="Fat (g)" value={mealOptionFatG} onChange={(e) => setMealOptionFatG(e.target.value)} />
                  <Input placeholder="Saturates (g)" value={mealOptionSaturatesG} onChange={(e) => setMealOptionSaturatesG(e.target.value)} />
                  <Input placeholder="Fibre (g)" value={mealOptionFibreG} onChange={(e) => setMealOptionFibreG(e.target.value)} />
                  <Input placeholder="Salt (g)" value={mealOptionSaltG} onChange={(e) => setMealOptionSaltG(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeMealOptionModal} type="button">
                Cancel
              </Button>
              <Button onClick={saveMealOption} disabled={!canSaveMealOption} type="button">
                {isEditMealOption ? "Save" : "Create Disabled"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => {
          const isMenuOpen = !!openMenuIds[section.menu.id];
          const schools = section.menu.schools ?? [];

          return (
            <Card
              key={section.menu.id}
              className={`rounded-2xl p-4 border ${section.menu.active ? "bg-white" : "bg-gray-50 opacity-60"}`}
            >
              <div className="w-full flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleMenu(section.menu.id)}
                  className="flex items-center gap-2 min-w-0 flex-1"
                >
                  {isMenuOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}

                  <div className="text-lg font-semibold text-[#27364B] truncate">
                    {section.menu.name}
                  </div>

                  <div className="hidden sm:flex items-center gap-2 ml-2 flex-wrap min-w-0">
                    {schools.length === 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full border bg-slate-50 text-slate-700 shrink-0">
                        GLOBAL
                      </span>
                    ) : (
                      schools.map((school) => (
                        <span
                          key={school.id}
                          className={`text-xs px-2 py-1 rounded-full border ${schoolTagClass(school.id)} shrink-0`}
                          title={school.name}
                        >
                          {school.name}
                        </span>
                      ))
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => toggleMenuActive(section.menu)} type="button">
                    {section.menu.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => openEditMenu(section.menu)}
                    type="button"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>

              {isMenuOpen && (
                <div className="pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-700">Meal Options</div>
                      <div className="text-xs text-gray-500">
                        These are the meal cards parents choose first.
                      </div>
                    </div>

                    <Button size="sm" onClick={() => openCreateMealOption(section.menu.id)} type="button">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Meal
                    </Button>
                  </div>

                  {section.mealOptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-gray-50 px-4 py-6 text-sm text-gray-500">
                      No meal options yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {section.mealOptions.map((mealOption) => {
                        const isMealOpen = !!openMealOptionIds[mealOption.id];
                        const cardImg =
                          mealOption.imageUrl && mealOption.imageUrl.length > 0
                            ? mealOption.imageUrl
                            : PLACEHOLDER_IMG;

                        return (
                          <Card
                            key={mealOption.id}
                            className={`rounded-2xl border p-4 ${mealOption.active ? "bg-white" : "bg-gray-50 opacity-60"}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => toggleMealOption(mealOption.id)}
                                className="flex items-center gap-3 min-w-0 flex-1 text-left"
                              >
                                {isMealOpen ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}

                                <div className="h-16 w-16 rounded-xl bg-slate-100 border overflow-hidden shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={cardImg} alt={mealOption.name} className="h-full w-full object-cover" />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-semibold text-[#27364B] truncate">
                                    {mealOption.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {mealOption.active ? "Active" : "Disabled"} ·{" "}
                                    {mealOption.groups.length} group
                                    {mealOption.groups.length === 1 ? "" : "s"}
                                  </div>
                                </div>
                              </button>

                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => toggleMealOptionActive(mealOption)} type="button">
                                  {mealOption.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => openEditMealOption(mealOption)}
                                  type="button"
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              </div>
                            </div>

                            {isMealOpen && (
                              <div className="pt-4">
                                <MealGroupManager
                                  menuId={section.menu.id}
                                  mealOptionId={mealOption.id}
                                  initialGroups={mealOption.groups}
                                  onGroupsChange={(groups) =>
                                    handleMealGroupsChange(section.menu.id, mealOption.id, groups)
                                  }
                                />
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}