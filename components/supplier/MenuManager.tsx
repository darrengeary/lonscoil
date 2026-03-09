"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import MealGroupManager, { MealGroup } from "@/components/supplier/MealGroupManager";

export type SchoolTag = { id: string; name: string };

export type MenuDTO = {
  id: string;
  name: string;
  active: boolean;
  schools: SchoolTag[];
};

export type MenuSection = {
  menu: MenuDTO;
  groups: MealGroup[];
};

function addTag<T extends { id: string }>(list: T[], v: T) {
  if (list.some((x) => x.id === v.id)) return list;
  return [...list, v];
}
function removeTagById<T extends { id: string }>(list: T[], id: string) {
  return list.filter((x) => x.id !== id);
}

// stable tag color from id (no DB needed)
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

export default function MenuManager({ initialSections }: { initialSections: MenuSection[] }) {
  const [sections, setSections] = useState<MenuSection[]>(initialSections);

  // collapsed/expanded per menu
  const [openMenuIds, setOpenMenuIds] = useState<Record<string, boolean>>(() => {
    const first = initialSections[0]?.menu.id;
    return first ? { [first]: true } : {};
  });

  // schools available for tag input
  const [allSchools, setAllSchools] = useState<SchoolTag[]>([]);
  useEffect(() => {
    fetch("/api/schools", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((rows) => setAllSchools(rows))
      .catch(() => setAllSchools([]));
  }, []);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

  const [menuName, setMenuName] = useState("");

  const [selectedSchools, setSelectedSchools] = useState<SchoolTag[]>([]);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolSuggestOpen, setSchoolSuggestOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editingMenuId;

  const canSave = useMemo(() => {
    const n = menuName.trim();
    return n.length >= 2;
  }, [menuName]);

  const suggestedSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    const base = allSchools.filter((s) => !selectedSchools.some((x) => x.id === s.id));
    if (!q) return base.slice(0, 10);
    return base.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 10);
  }, [allSchools, selectedSchools, schoolQuery]);

  function toggleMenu(menuId: string) {
    setOpenMenuIds((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  }

  function openCreate() {
    setEditingMenuId(null);
    setMenuName("");
    setSelectedSchools([]);
    setSchoolQuery("");
    setSchoolSuggestOpen(false);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  function openEdit(menu: MenuDTO) {
    setEditingMenuId(menu.id);
    setMenuName(menu.name);
    setSelectedSchools(menu.schools ?? []);
    setSchoolQuery("");
    setSchoolSuggestOpen(false);
    setModalOpen(true);
    setTimeout(() => nameRef.current?.focus(), 0);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingMenuId(null);
  }

  async function saveMenu() {
    if (!canSave) return;

    const name = menuName.trim();
    const schoolIds = selectedSchools.map((s) => s.id);

    const res = await fetch("/api/menus", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: editingMenuId, name, schoolIds } : { name, schoolIds }),
    });

    if (!res.ok) return;

    const saved: MenuDTO = await res.json();

    setSections((prev) => {
      if (isEdit) {
        return prev.map((s) => (s.menu.id === saved.id ? { ...s, menu: saved } : s));
      }
      return [...prev, { menu: saved, groups: [] }];
    });

    setOpenMenuIds((prev) => ({ ...prev, [saved.id]: true }));
    closeModal();
  }

  return (
    <div className="space-y-6">
      {/* Top bar: New Menu */}
      <div className="flex justify-between items-center">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Menu
        </Button>
      </div>

      {/* Create/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 min-w-[320px] w-full max-w-md space-y-4 border">
            <h2 className="text-lg font-semibold">{isEdit ? "Edit Menu" : "Add Menu"}</h2>

            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-600">Menu name</div>
                <Input
                  ref={nameRef}
                  placeholder="e.g. Standard, Gluten Free"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                />
              </div>

              {/* Schools tag input */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Schools</div>

                <div className="flex flex-wrap gap-2">
                  {selectedSchools.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
                    >
                      {s.name}
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100"
                        onClick={() => setSelectedSchools((prev) => removeTagById(prev, s.id))}
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
                          suggestedSchools.find((s) => s.name.toLowerCase() === q) ?? suggestedSchools[0];

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
                      {suggestedSchools.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            setSelectedSchools((prev) => addTag(prev, s));
                            setSchoolQuery("");
                          }}
                        >
                          <span>{s.name}</span>
                          <span className="text-xs text-gray-400">Add</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  If you leave this empty, the menu is <span className="font-semibold">GLOBAL</span> (available to all schools).
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeModal} type="button">
                  Cancel
                </Button>
                <Button onClick={saveMenu} disabled={!canSave} type="button">
                  {isEdit ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const isOpen = !!openMenuIds[section.menu.id];
          const schools = section.menu.schools ?? [];

          return (
            <Card key={section.menu.id} className="bg-white rounded-2xl p-4 border">
              <div className="w-full flex items-center justify-between gap-3">
                {/* Left group: chevron + name + tags */}
                <button
                  type="button"
                  onClick={() => toggleMenu(section.menu.id)}
                  className="flex items-center gap-2 min-w-0 flex-1"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}

                  <div className="text-lg font-semibold text-[#27364B] truncate">
                    {section.menu.name}
                  </div>

                  {/* tags live between name and the right-side buttons */}
                  <div className="hidden sm:flex items-center gap-2 ml-2 flex-wrap min-w-0">
                    {schools.length === 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full border bg-slate-50 text-slate-700 shrink-0">
                        GLOBAL
                      </span>
                    ) : (
                      schools.map((s) => (
                        <span
                          key={s.id}
                          className={`text-xs px-2 py-1 rounded-full border ${schoolTagClass(s.id)} shrink-0`}
                          title={s.name}
                        >
                          {s.name}
                        </span>
                      ))
                    )}
                  </div>
                </button>

                {/* Right group: edit + count */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => openEdit(section.menu)}
                    type="button"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>

                  {!isOpen && (
                    <div className="text-xs text-gray-500">
                      {section.groups.length} group{section.groups.length === 1 ? "" : "s"}
                    </div>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="pt-4">
                  <MealGroupManager menuId={section.menu.id} initialGroups={section.groups} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}