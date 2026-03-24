"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  UtensilsCrossed,
} from "lucide-react";
import MealGroupManager from "@/components/supplier/MealGroupManager";
import type { MealGroup } from "@/components/supplier/MealGroupManager";

export type SchoolTag = { id: string; name: string };

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
  stickerCount: number;
  groups: MealGroup[];
};

export type MenuSection = {
  menu: MenuDTO;
  mealOptions: MealOptionDTO[];
};

type SavedMealOptionResponse = {
  id: string;
  name: string;
  menuId: string;
  stickerCount: number;
};

function addTag<T extends { id: string }>(list: T[], v: T) {
  if (list.some((x) => x.id === v.id)) return list;
  return [...list, v];
}

function removeTagById<T extends { id: string }>(list: T[], id: string) {
  return list.filter((x) => x.id !== id);
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

export default function MenuManager({
  initialSections = [],
}: {
  initialSections?: MenuSection[];
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState("");

  const [selectedSchools, setSelectedSchools] = useState<SchoolTag[]>([]);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolSuggestOpen, setSchoolSuggestOpen] = useState(false);

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [mealModalMenuId, setMealModalMenuId] = useState<string | null>(null);
  const [mealEditingId, setMealEditingId] = useState<string | null>(null);
  const [mealOptionName, setMealOptionName] = useState("");
  const [mealOptionStickerCount, setMealOptionStickerCount] = useState(1);

  const nameRef = useRef<HTMLInputElement>(null);
  const mealOptionNameRef = useRef<HTMLInputElement>(null);

  const isEditMenu = !!editingMenuId;
  const isEditMealOption = !!mealEditingId;

  const canSaveMenu = useMemo(() => menuName.trim().length >= 2, [menuName]);
  const canSaveMealOption = useMemo(
    () => mealOptionName.trim().length >= 2 && mealOptionStickerCount >= 1,
    [mealOptionName, mealOptionStickerCount]
  );

  const suggestedSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    const base = allSchools.filter((s) => !selectedSchools.some((x) => x.id === s.id));
    if (!q) return base.slice(0, 10);
    return base.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [allSchools, selectedSchools, schoolQuery]);

  function toggleMenu(menuId: string) {
    setOpenMenuIds((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  }

  function toggleMealOption(mealOptionId: string) {
    setOpenMealOptionIds((prev) => ({ ...prev, [mealOptionId]: !prev[mealOptionId] }));
  }

  function openCreateMenu() {
    setEditingMenuId(null);
    setMenuName("");
    setSelectedSchools([]);
    setSchoolQuery("");
    setSchoolSuggestOpen(false);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  function openEditMenu(menu: MenuDTO) {
    setEditingMenuId(menu.id);
    setMenuName(menu.name);
    setSelectedSchools(menu.schools ?? []);
    setSchoolQuery("");
    setSchoolSuggestOpen(false);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  function closeMenuModal() {
    setModalOpen(false);
    setEditingMenuId(null);
  }

  async function saveMenu() {
    if (!canSaveMenu) return;

    const name = menuName.trim();
    const schoolIds = selectedSchools.map((s) => s.id);

    const res = await fetch("/api/menus", {
      method: isEditMenu ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEditMenu ? { id: editingMenuId, name, schoolIds } : { name, schoolIds }
      ),
    });

    if (!res.ok) return;

    const saved: MenuDTO = await res.json();

    setSections((prev) => {
      if (isEditMenu) {
        return prev.map((s) => (s.menu.id === saved.id ? { ...s, menu: saved } : s));
      }

      return [...prev, { menu: saved, mealOptions: [] }];
    });

    setOpenMenuIds((prev) => ({ ...prev, [saved.id]: true }));
    closeMenuModal();
  }

  function openCreateMealOption(menuId: string) {
    setMealEditingId(null);
    setMealModalMenuId(menuId);
    setMealOptionName("");
    setMealOptionStickerCount(1);
    setMealModalOpen(true);
    setTimeout(() => mealOptionNameRef.current?.focus(), 0);
  }

  function openEditMealOption(mealOption: MealOptionDTO) {
    setMealEditingId(mealOption.id);
    setMealModalMenuId(mealOption.menuId);
    setMealOptionName(mealOption.name);
    setMealOptionStickerCount(mealOption.stickerCount);
    setMealModalOpen(true);
    setTimeout(() => mealOptionNameRef.current?.focus(), 0);
  }

  function closeMealOptionModal() {
    setMealModalOpen(false);
    setMealModalMenuId(null);
    setMealEditingId(null);
    setMealOptionName("");
    setMealOptionStickerCount(1);
  }

  async function saveMealOption() {
    if (!mealModalMenuId || !canSaveMealOption) return;

    const body = isEditMealOption
      ? {
          id: mealEditingId,
          name: mealOptionName.trim(),
          stickerCount: mealOptionStickerCount,
        }
      : {
          menuId: mealModalMenuId,
          name: mealOptionName.trim(),
          stickerCount: mealOptionStickerCount,
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
                ? {
                    ...existingMealOption,
                    name: saved.name,
                    stickerCount: saved.stickerCount,
                  }
                : existingMealOption
            ),
          };
        }

        return {
          ...section,
          mealOptions: [
            ...section.mealOptions,
            {
              id: saved.id,
              name: saved.name,
              menuId: saved.menuId,
              stickerCount: saved.stickerCount,
              groups: [],
            },
          ],
        };
      })
    );

    setOpenMealOptionIds((prev) => ({
      ...prev,
      [saved.id]: true,
    }));

    closeMealOptionModal();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={openCreateMenu}>
          <Plus className="mr-2 h-4 w-4" />
          New Menu
        </Button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-md space-y-4 border">
            <h2 className="text-lg font-semibold">{isEditMenu ? "Edit Menu" : "Add Menu"}</h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Menu name</div>
                <Input
                  ref={nameRef}
                  placeholder="e.g. Standard, Gluten Free"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                />
              </div>

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
                  {isEditMenu ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mealModalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-md space-y-4 border">
            <h2 className="text-lg font-semibold">
              {isEditMealOption ? "Edit Meal Option" : "Add Meal Option"}
            </h2>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Meal name</div>
                <Input
                  ref={mealOptionNameRef}
                  placeholder="e.g. Chicken Curry, Soup + Sandwich"
                  value={mealOptionName}
                  onChange={(e) => setMealOptionName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Sticker count</div>
                <Input
                  type="number"
                  min={1}
                  value={mealOptionStickerCount}
                  onChange={(e) =>
                    setMealOptionStickerCount(Math.max(1, Number(e.target.value) || 1))
                  }
                />
                <div className="text-xs text-gray-500">
                  Use 2 for meals like soup + sandwich that need two labels.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeMealOptionModal} type="button">
                  Cancel
                </Button>
                <Button onClick={saveMealOption} disabled={!canSaveMealOption} type="button">
                  {isEditMealOption ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => {
          const isMenuOpen = !!openMenuIds[section.menu.id];
          const schools = section.menu.schools ?? [];

          return (
            <Card key={section.menu.id} className="bg-white rounded-2xl p-4 border">
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

                  {!isMenuOpen && (
                    <div className="text-xs text-gray-500">
                      {section.mealOptions.length} meal
                      {section.mealOptions.length === 1 ? "" : "s"}
                    </div>
                  )}
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

                    <Button
                      size="sm"
                      onClick={() => openCreateMealOption(section.menu.id)}
                      type="button"
                    >
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

                        return (
                          <Card key={mealOption.id} className="rounded-2xl border bg-white p-4">
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

                                <div className="h-10 w-10 rounded-xl bg-slate-100 border flex items-center justify-center shrink-0">
                                  <UtensilsCrossed className="h-5 w-5 text-slate-600" />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-semibold text-[#27364B] truncate">
                                    {mealOption.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {mealOption.stickerCount} sticker
                                    {mealOption.stickerCount === 1 ? "" : "s"} ·{" "}
                                    {mealOption.groups.length} group
                                    {mealOption.groups.length === 1 ? "" : "s"}
                                  </div>
                                </div>
                              </button>

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