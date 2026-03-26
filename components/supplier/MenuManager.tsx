"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import MealGroupManager, { type MealGroup } from "./MealGroupManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AllergenTag = {
  id: string;
  name: string;
};

export type SchoolTag = {
  id: string;
  name: string;
};

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
  allergens?: AllergenTag[];
  createdAt: string;
  updatedAt: string;
};

export type MenuMealGroup = MealGroup & {
  choices?: MealChoiceListItem[];
};

export type MealOptionItem = {
  id: string;
  name: string;
  menuId: string;
  active: boolean;
  imageUrl?: string | null;
  availStart?: string | null;
  availEnd?: string | null;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
  allergens: AllergenTag[];
  groups: MenuMealGroup[];
};

export type MenuSection = {
  menu: {
    id: string;
    name: string;
    active: boolean;
    schools: SchoolTag[];
  };
  mealOptions: MealOptionItem[];
};

type MenuLibraryItem = {
  id: string;
  name: string;
  schoolIds?: string[];
};

type SavedMealOptionResponse = MealOptionItem;

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

function toDateInputValue(v: string | null | undefined) {
  if (!v) return "";
  try {
    return format(new Date(v), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

interface Props {
  initialSections: MenuSection[];
  allAllergens: AllergenTag[];
  allSchools: SchoolTag[];
}

export default function MenuManager({
  initialSections,
  allAllergens,
  allSchools,
}: Props) {
  const [sections, setSections] = useState<MenuSection[]>(initialSections);
  const [collapsedMenus, setCollapsedMenus] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialSections.map((section) => [section.menu.id, true]))
  );

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState("");
  const [menuActive, setMenuActive] = useState(true);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [duplicateFromMenuId, setDuplicateFromMenuId] = useState("");
  const [savingMenu, setSavingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

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
  const [savingMealOption, setSavingMealOption] = useState(false);
  const [mealOptionError, setMealOptionError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMenu, setPendingMenu] = useState<MenuSection["menu"] | null>(null);

  const menuNameRef = useRef<HTMLInputElement>(null);
  const mealOptionNameRef = useRef<HTMLInputElement>(null);

  const isEditMealOption = !!mealEditingId;

  const canSaveMealOption = useMemo(
    () => mealOptionName.trim().length >= 2,
    [mealOptionName]
  );

  useEffect(() => {
    setSections(initialSections);
    setCollapsedMenus((prev) => {
      const next = { ...prev };

      for (const section of initialSections) {
        if (!(section.menu.id in next)) next[section.menu.id] = true;
      }

      for (const key of Object.keys(next)) {
        if (!initialSections.some((section) => section.menu.id === key)) {
          delete next[key];
        }
      }

      return next;
    });
  }, [initialSections]);

  useEffect(() => {
    return () => {
      if (mealOptionImagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(mealOptionImagePreviewUrl);
      }
    };
  }, [mealOptionImagePreviewUrl]);

  const sortedSchools = useMemo(
    () => [...allSchools].sort((a, b) => a.name.localeCompare(b.name)),
    [allSchools]
  );

  const availableSchoolsToAdd = useMemo(
    () => sortedSchools.filter((school) => !selectedSchoolIds.includes(school.id)),
    [sortedSchools, selectedSchoolIds]
  );

  const menuLibrary = useMemo<MenuLibraryItem[]>(
    () =>
      sections.map((section) => ({
        id: section.menu.id,
        name: section.menu.name,
        schoolIds: section.menu.schools.map((school) => school.id),
      })),
    [sections]
  );

  function updateGroups(menuId: string, mealOptionId: string, nextGroups: MealGroup[]) {
    setSections((prev) =>
      prev.map((section) => {
        if (section.menu.id !== menuId) return section;

        return {
          ...section,
          mealOptions: section.mealOptions.map((mealOption) => {
            if (mealOption.id !== mealOptionId) return mealOption;
            return {
              ...mealOption,
              groups: nextGroups,
            };
          }),
        };
      })
    );
  }

  function toggleMenu(menuId: string) {
    setCollapsedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  }

  function resetMenuForm() {
    setEditingMenuId(null);
    setMenuName("");
    setMenuActive(true);
    setSelectedSchoolIds([]);
    setDuplicateFromMenuId("");
    setMenuError(null);
  }

  function closeMenuModal() {
    setMenuModalOpen(false);
    resetMenuForm();
  }

  function openCreateMenu() {
    resetMenuForm();
    setMenuModalOpen(true);
    setTimeout(() => menuNameRef.current?.focus(), 0);
  }

  function openEditMenu(section: MenuSection) {
    setEditingMenuId(section.menu.id);
    setMenuName(section.menu.name);
    setMenuActive(section.menu.active);
    setSelectedSchoolIds(section.menu.schools.map((school) => school.id));
    setDuplicateFromMenuId("");
    setMenuError(null);
    setMenuModalOpen(true);
    setTimeout(() => menuNameRef.current?.focus(), 0);
  }

  function toggleSchool(schoolId: string) {
    setSelectedSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== id && id !== schoolId) : [...prev, schoolId]
    );
  }

  async function saveMenu() {
    const name = menuName.trim();
    if (!name) {
      setMenuError("Menu name is required");
      return;
    }

    setSavingMenu(true);
    setMenuError(null);

    try {
      const body = editingMenuId
        ? {
            id: editingMenuId,
            name,
            active: menuActive,
            schoolIds: selectedSchoolIds,
          }
        : {
            name,
            active: menuActive,
            schoolIds: selectedSchoolIds,
            duplicateFromMenuId: duplicateFromMenuId || null,
          };

      const res = await fetch("/api/menus", {
        method: editingMenuId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save menu");
      }

      const savedMenu = {
        id: data.id,
        name: data.name,
        active: data.active,
        schools: data.schools ?? [],
      };

      if (editingMenuId) {
        setSections((prev) =>
          prev.map((section) =>
            section.menu.id === editingMenuId
              ? {
                  ...section,
                  menu: savedMenu,
                }
              : section
          )
        );
      } else {
        setSections((prev) => [
          {
            menu: savedMenu,
            mealOptions: [],
          },
          ...prev,
        ]);
        setCollapsedMenus((prev) => ({
          ...prev,
          [savedMenu.id]: false,
        }));
      }

      closeMenuModal();
    } catch (err: any) {
      setMenuError(err?.message || "Failed to save menu");
    } finally {
      setSavingMenu(false);
    }
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
    setMealOptionError(null);
    setSavingMealOption(false);
  }

  function openCreateMealOption(menuId: string) {
    resetMealOptionForm();
    setMealModalMenuId(menuId);
    setMealModalOpen(true);
    setTimeout(() => mealOptionNameRef.current?.focus(), 0);
  }

  function openEditMealOption(mealOption: MealOptionItem) {
    resetMealOptionForm();
    setMealEditingId(mealOption.id);
    setMealModalMenuId(mealOption.menuId);
    setMealOptionName(mealOption.name);
    setMealOptionActive(mealOption.active);
    setMealOptionImageUrl(mealOption.imageUrl ?? null);
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
    setMealOptionAllergens(mealOption.allergens ?? []);
    setMealModalOpen(true);
    setTimeout(() => mealOptionNameRef.current?.focus(), 0);
  }

  function closeMealOptionModal() {
    setMealModalOpen(false);
    resetMealOptionForm();
  }

  async function saveMealOption() {
    if (!mealModalMenuId || !canSaveMealOption) return;

    setSavingMealOption(true);
    setMealOptionError(null);

    try {
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save meal option");
      }

      const saved = data as SavedMealOptionResponse;

      setSections((prev) =>
        prev.map((section) => {
          if (section.menu.id !== mealModalMenuId) return section;

          if (isEditMealOption) {
            return {
              ...section,
              mealOptions: section.mealOptions.map((existingMealOption) =>
                existingMealOption.id === saved.id
                  ? {
                      ...existingMealOption,
                      ...saved,
                      groups: existingMealOption.groups,
                    }
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

      closeMealOptionModal();
    } catch (err: any) {
      setMealOptionError(err?.message || "Failed to save meal option");
    } finally {
      setSavingMealOption(false);
    }
  }

  async function toggleMealOptionActive(mealOption: MealOptionItem) {
    try {
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update meal option");
      }

      const saved = data as SavedMealOptionResponse;

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
    } catch {
      // no-op
    }
  }

  function askToggleMenu(menu: MenuSection["menu"]) {
    setPendingMenu(menu);
    setConfirmOpen(true);
  }

  async function confirmToggleMenu() {
    if (!pendingMenu) return;

    try {
      const res = await fetch("/api/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingMenu.id,
          name: pendingMenu.name,
          active: !pendingMenu.active,
          schoolIds: pendingMenu.schools.map((school) => school.id),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update menu");
      }

      setSections((prev) =>
        prev.map((section) =>
          section.menu.id === pendingMenu.id
            ? {
                ...section,
                menu: {
                  id: data.id,
                  name: data.name,
                  active: data.active,
                  schools: data.schools ?? [],
                },
              }
            : section
        )
      );

      setConfirmOpen(false);
      setPendingMenu(null);
    } catch {
      setConfirmOpen(false);
      setPendingMenu(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Menus</h1>
          <p className="text-sm text-slate-500">
            Create menus, manage products, and configure meal groups.
          </p>
        </div>

        <Button type="button" onClick={openCreateMenu}>
          <Plus className="mr-2 h-4 w-4" />
          Add Menu
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500">
          No menus yet.
        </div>
      ) : (
        sections.map((section) => {
          const isCollapsed = collapsedMenus[section.menu.id] ?? true;

          return (
            <div key={section.menu.id} className="rounded-2xl border bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 p-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleMenu(section.menu.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white text-slate-600 hover:bg-slate-50"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="text-2xl font-bold text-slate-900">{section.menu.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {section.menu.active ? "Active" : "Disabled"} · {section.mealOptions.length} product
                        {section.mealOptions.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {section.menu.schools.length > 0 ? (
                      section.menu.schools.map((school) => (
                        <span
                          key={school.id}
                          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                        >
                          {school.name}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                        GLOBAL
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className={
                      section.menu.active
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }
                    onClick={() => askToggleMenu(section.menu)}
                  >
                    {section.menu.active ? (
                      <>
                        <ToggleRight className="mr-2 h-4 w-4" />
                        Active
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="mr-2 h-4 w-4" />
                        Disabled
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditMenu(section)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Menu
                  </Button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="border-t bg-slate-50/50 p-6">
                  <div className="space-y-6">
                    <button
                      type="button"
                      onClick={() => openCreateMealOption(section.menu.id)}
                      className="group w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-left transition hover:border-slate-400 hover:shadow-sm"
                    >
                      <div className="flex min-h-[88px] items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 transition group-hover:bg-slate-200">
                          <Plus className="h-6 w-6 text-slate-700" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900">Add meal option</div>
                          <div className="text-sm text-slate-500">
                            Create another product in this menu.
                          </div>
                        </div>
                      </div>
                    </button>

                    {section.mealOptions.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">
                        No products in this menu yet.
                      </div>
                    ) : (
                      section.mealOptions.map((mealOption) => (
                        <div key={mealOption.id} className="rounded-2xl border bg-white p-6">
                          <div className="mb-5 flex items-start gap-4">
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border bg-slate-100">
                              {mealOption.imageUrl ? (
                                <img
                                  src={mealOption.imageUrl}
                                  alt={mealOption.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-center text-xs text-slate-400">
                                  No image
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-xl font-semibold text-slate-900">
                                {mealOption.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {mealOption.active ? "Active" : "Disabled"}
                              </div>

                              {mealOption.allergens.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {mealOption.allergens.map((allergen) => (
                                    <span
                                      key={allergen.id}
                                      className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                                    >
                                      {allergen.name}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className={
                                    mealOption.active
                                      ? "bg-green-600 text-white hover:bg-green-700"
                                      : "bg-red-600 text-white hover:bg-red-700"
                                  }
                                  onClick={() => toggleMealOptionActive(mealOption)}
                                >
                                  {mealOption.active ? (
                                    <>
                                      <ToggleRight className="mr-2 h-4 w-4" />
                                      Active
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft className="mr-2 h-4 w-4" />
                                      Disabled
                                    </>
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditMealOption(mealOption)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit option
                                </Button>
                              </div>
                            </div>
                          </div>

                          <MealGroupManager
                            menuId={section.menu.id}
                            mealOptionId={mealOption.id}
                            initialGroups={mealOption.groups}
                            onGroupsChange={(nextGroups) =>
                              updateGroups(section.menu.id, mealOption.id, nextGroups)
                            }
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <Dialog
        open={menuModalOpen}
        onOpenChange={(open) => (!open ? closeMenuModal() : setMenuModalOpen(true))}
      >
        <DialogContent className="sm:max-w-xl rounded-2xl bg-white p-0 text-slate-900 shadow-xl">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle className="text-xl">
              {editingMenuId ? "Edit menu" : "Add menu"}
            </DialogTitle>
            <DialogDescription>
              {editingMenuId
                ? "Update the menu details and school availability."
                : "Create a new menu, optionally copying from an existing one."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6">
            {!editingMenuId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Duplicate from existing menu</label>
                <select
                  value={duplicateFromMenuId}
                  onChange={(e) => setDuplicateFromMenuId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                >
                  <option value="">Start new menu</option>
                  {menuLibrary.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Menu name</label>
              <Input
                ref={menuNameRef}
                value={menuName}
                onChange={(e) => setMenuName(e.target.value)}
                placeholder="e.g. Junior Menu"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700">Schools</label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {selectedSchoolIds.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedSchoolIds.map((schoolId) => {
                      const school = sortedSchools.find((s) => s.id === schoolId);
                      if (!school) return null;

                      return (
                        <span
                          key={school.id}
                          className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                        >
                          {school.name}
                          <button
                            type="button"
                            onClick={() => toggleSchool(school.id)}
                            className="rounded-full p-0.5 hover:bg-blue-100"
                            aria-label={`Remove ${school.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mb-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                      GLOBAL
                    </span>
                  </div>
                )}

                <select
                  value=""
                  onChange={(e) => {
                    const schoolId = e.target.value;
                    if (!schoolId) return;
                    toggleSchool(schoolId);
                  }}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                >
                  <option value="">
                    {availableSchoolsToAdd.length > 0 ? "Add school..." : "All schools added"}
                  </option>
                  {availableSchoolsToAdd.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  Leave blank for a global menu available to all schools.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <button
                type="button"
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  menuActive
                    ? "border-green-200 bg-green-50 hover:bg-green-100"
                    : "border-red-200 bg-red-50 hover:bg-red-100"
                }`}
                onClick={() => setMenuActive((v) => !v)}
              >
                <div className="flex items-center gap-3">
                  {menuActive ? (
                    <ToggleRight className="h-6 w-6 text-green-700" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-red-700" />
                  )}
                  <div>
                    <div className="font-medium text-slate-900">
                      {menuActive ? "Enabled" : "Disabled"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {menuActive
                        ? "This menu will be available after saving."
                        : "This menu will be saved as disabled."}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {menuError && <div className="text-sm text-red-600">{menuError}</div>}
          </div>

          <DialogFooter className="gap-2 px-6 pb-6 pt-0">
            <Button variant="outline" onClick={closeMenuModal} type="button">
              Cancel
            </Button>
            <Button type="button" onClick={saveMenu} disabled={savingMenu}>
              {savingMenu ? "Saving..." : editingMenuId ? "Save changes" : "Create menu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mealModalOpen}
        onOpenChange={(open) => (!open ? closeMealOptionModal() : setMealModalOpen(true))}
      >
        <DialogContent className="sm:max-w-2xl rounded-2xl bg-white p-0 text-slate-900 shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle className="text-xl">
              {isEditMealOption ? "Edit meal option" : "Add meal option"}
            </DialogTitle>
            <DialogDescription>
              {isEditMealOption
                ? "Update this meal option."
                : "Create a new meal option for this menu."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 pb-6">
            <div className="w-full overflow-hidden rounded-2xl border bg-gray-100">
              <div className="h-44 w-full sm:h-52">
                <img
                  src={
                    mealOptionImagePreviewUrl ??
                    (mealOptionImageUrl && mealOptionImageUrl.length > 0
                      ? mealOptionImageUrl
                      : PLACEHOLDER_IMG)
                  }
                  alt="Meal preview"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <button
                type="button"
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  mealOptionActive
                    ? "border-green-200 bg-green-50 hover:bg-green-100"
                    : "border-red-200 bg-red-50 hover:bg-red-100"
                }`}
                onClick={() => setMealOptionActive((v) => !v)}
              >
                <div className="flex items-center gap-3">
                  {mealOptionActive ? (
                    <ToggleRight className="h-6 w-6 text-green-700" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-red-700" />
                  )}
                  <div>
                    <div className="font-medium text-slate-900">
                      {mealOptionActive ? "Enabled" : "Disabled"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {mealOptionActive
                        ? "This meal option will be available after saving."
                        : "This meal option will be saved as disabled."}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Meal option name</label>
              <Input
                ref={mealOptionNameRef}
                placeholder="e.g. Chicken Curry, Soup + Sandwich"
                value={mealOptionName}
                onChange={(e) => setMealOptionName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Image</label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-blue-700">
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Available from</label>
                <Input
                  type="date"
                  value={mealOptionAvailStart}
                  onChange={(e) => setMealOptionAvailStart(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Available until</label>
                <Input
                  type="date"
                  value={mealOptionAvailEnd}
                  onChange={(e) => setMealOptionAvailEnd(e.target.value)}
                />
              </div>
            </div>

            {allAllergens.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Allergens</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 md:grid-cols-3">
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
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nutrition (per portion)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Calories (kcal)"
                  value={mealOptionCaloriesKcal}
                  onChange={(e) => setMealOptionCaloriesKcal(e.target.value)}
                />
                <Input
                  placeholder="Protein (g)"
                  value={mealOptionProteinG}
                  onChange={(e) => setMealOptionProteinG(e.target.value)}
                />
                <Input
                  placeholder="Carbs (g)"
                  value={mealOptionCarbsG}
                  onChange={(e) => setMealOptionCarbsG(e.target.value)}
                />
                <Input
                  placeholder="Sugars (g)"
                  value={mealOptionSugarsG}
                  onChange={(e) => setMealOptionSugarsG(e.target.value)}
                />
                <Input
                  placeholder="Fat (g)"
                  value={mealOptionFatG}
                  onChange={(e) => setMealOptionFatG(e.target.value)}
                />
                <Input
                  placeholder="Saturates (g)"
                  value={mealOptionSaturatesG}
                  onChange={(e) => setMealOptionSaturatesG(e.target.value)}
                />
                <Input
                  placeholder="Fibre (g)"
                  value={mealOptionFibreG}
                  onChange={(e) => setMealOptionFibreG(e.target.value)}
                />
                <Input
                  placeholder="Salt (g)"
                  value={mealOptionSaltG}
                  onChange={(e) => setMealOptionSaltG(e.target.value)}
                />
              </div>
            </div>

            {mealOptionError && <div className="text-sm text-red-600">{mealOptionError}</div>}
          </div>

          <DialogFooter className="gap-2 px-6 pb-6 pt-0">
            <Button variant="outline" onClick={closeMealOptionModal} type="button">
              Cancel
            </Button>
            <Button
              onClick={saveMealOption}
              disabled={!canSaveMealOption || savingMealOption}
              type="button"
            >
              {savingMealOption
                ? "Saving..."
                : isEditMealOption
                  ? "Save changes"
                  : "Create meal option"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm status change
            </DialogTitle>
            <DialogDescription>
              {pendingMenu
                ? `Are you sure you want to ${pendingMenu.active ? "disable" : "enable"} "${pendingMenu.name}"?`
                : "Are you sure?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmToggleMenu}
              className={
                pendingMenu?.active
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }
            >
              {pendingMenu?.active ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}