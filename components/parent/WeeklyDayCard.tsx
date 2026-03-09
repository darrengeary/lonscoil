// components/parent/WeeklyDayCard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { format, isBefore, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChevronDown, ChevronRight, MoreVertical, CheckCircle2 } from "lucide-react";

type ChoiceConfig = { selectedIngredients: string[]; extrasConfirmed?: boolean };

type Nutrition = {
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  sugarsG?: number | null;
  fatG?: number | null;
  saturatesG?: number | null;
  fibreG?: number | null;
  saltG?: number | null;
};

type MealChoice = {
  id: string;
  name: string;
  imageUrl?: string | null;
  ingredients?: string[];
} & Nutrition;

interface Props {
  date: Date;
  className?: string;

  selections: Record<
    string,
    Record<
      string,
      {
        choiceIds: string[];
        configByChoiceId: Record<string, ChoiceConfig>;
      }
    >
  >;

  mealGroups: {
    id: string;
    name: string;
    maxSelections: number;
    choices: MealChoice[];
  }[];

  onSelect: (dateStr: string, groupId: string, newChoiceIds: string[]) => void;
  onUpdateConfig: (dateStr: string, groupId: string, choiceId: string, selectedIngredients: string[]) => void;
  onConfirmChoice: (dateStr: string, groupId: string, choiceId: string) => void;

  onReplicate: (dateStr: string, type: "next-days" | "weekday-weeks") => void;

  daysToCopy: number;
  weeksToRepeat: number;
  setDaysToCopy: (n: number) => void;
  setWeeksToRepeat: (n: number) => void;

  disabled?: boolean;
}

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [breakpointPx]);
  return isMobile;
}

function formatNum(n?: number | null) {
  if (n === null || n === undefined) return "—";
  const isInt = Number.isInteger(n);
  return isInt ? String(n) : n.toFixed(1);
}

export default function WeeklyDayCard({
  date,
  className,
  selections,
  mealGroups,
  onSelect,
  onUpdateConfig,
  onConfirmChoice,
  onReplicate,
  daysToCopy,
  weeksToRepeat,
  setDaysToCopy,
  setWeeksToRepeat,
  disabled,
}: Props) {
  const dateStr = format(date, "yyyy-MM-dd");
  const weekday = format(date, "EE");
  const today = startOfDay(new Date());
  const isPast = isBefore(startOfDay(date), today);
  if (isPast) return null;

  const isMobile = useIsMobile(640);

  // Scroll so DAY header hits top of screen
  const dayCardRef = useRef<HTMLDivElement | null>(null);
  function scrollDayToTop() {
    if (!dayCardRef.current) return;
    const TOP_OFFSET = 8;
    const y = dayCardRef.current.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y - TOP_OFFSET, behavior: "smooth" });
  }

  const dayData = selections[dateStr] || {};

  function isChoiceConfirmed(groupId: string, choiceId: string) {
    return !!dayData?.[groupId]?.configByChoiceId?.[choiceId]?.extrasConfirmed;
  }

  function selectedExtras(groupId: string, choiceId: string): string[] {
    return dayData?.[groupId]?.configByChoiceId?.[choiceId]?.selectedIngredients ?? [];
  }

  const groupComplete = (groupId: string) => {
    const chosen = dayData?.[groupId]?.choiceIds || [];
    if (!chosen.length) return false;
    return chosen.every((cid) => isChoiceConfirmed(groupId, cid));
  };

  const dayComplete = useMemo(() => {
    if (!mealGroups.length) return false;
    return mealGroups.every((g) => groupComplete(g.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealGroups, selections, dateStr]);

  const missingGroups = useMemo(() => {
    return mealGroups.filter((g) => !groupComplete(g.id)).map((g) => g.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealGroups, selections, dateStr]);

  const progress = useMemo(() => {
    const total = mealGroups.length || 0;
    const done = mealGroups.filter((g) => groupComplete(g.id)).length;
    const left = Math.max(0, total - done);
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, left, pct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealGroups, selections, dateStr]);

  const hasSelection = useMemo(() => {
    const day = selections[dateStr];
    if (!day) return false;
    return Object.values(day).some((g) => (g?.choiceIds?.length ?? 0) > 0);
  }, [selections, dateStr]);

  // Expand/collapse groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const userTouchedGroup = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const g of mealGroups) {
        if (userTouchedGroup.current[g.id]) continue;
        next[g.id] = !groupComplete(g.id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, selections, mealGroups.length]);

  // Day minimisation when complete
  const [dayMinimized, setDayMinimized] = useState(false);
  const userTouchedDay = useRef(false);
  useEffect(() => {
    if (dayComplete && !userTouchedDay.current) setDayMinimized(true);
    if (!dayComplete) setDayMinimized(false);
  }, [dayComplete]);

  // ---------- Details sheet ----------
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<{ groupId: string; choiceId: string } | null>(null);

  function openDetails(groupId: string, choiceId: string) {
    if (disabled) return;

    // ensure it is selected; if not, select it
    const selected = dayData?.[groupId]?.choiceIds || [];
    if (!selected.includes(choiceId)) {
      const group = mealGroups.find((g) => g.id === groupId);
      const max = group?.maxSelections || 1;
      let next: string[];
      if (selected.length < max) next = [...selected, choiceId];
      else next = [...selected.slice(1), choiceId];
      onSelect(dateStr, groupId, next);
    }

    setSheetTarget({ groupId, choiceId });
    setSheetOpen(true);
  }

  const sheetGroup = useMemo(() => {
    if (!sheetTarget) return null;
    return mealGroups.find((g) => g.id === sheetTarget.groupId) ?? null;
  }, [sheetTarget, mealGroups]);

  const sheetChoice = useMemo(() => {
    if (!sheetTarget) return null;
    const g = mealGroups.find((x) => x.id === sheetTarget.groupId);
    return g?.choices.find((c) => c.id === sheetTarget.choiceId) ?? null;
  }, [sheetTarget, mealGroups]);

  function toggleExtra(groupId: string, choiceId: string, extra: string) {
    if (disabled) return;
    const cur = selectedExtras(groupId, choiceId);
    const active = cur.includes(extra);
    const next = active ? cur.filter((x) => x !== extra) : [...cur, extra];
    onUpdateConfig(dateStr, groupId, choiceId, next);
  }

  function groupSummary(groupId: string) {
    const group = mealGroups.find((g) => g.id === groupId);
    if (!group) return "—";
    const ids = dayData?.[groupId]?.choiceIds || [];
    if (!ids.length) return "Not selected";

    return ids
      .map((id) => {
        const c = group.choices.find((x) => x.id === id);
        if (!c) return null;
        const ex = selectedExtras(groupId, id);
        const ok = isChoiceConfirmed(groupId, id) ? " ✓" : "";
        const exText = ex.length ? ` (+${ex.slice(0, 2).join(", ")}${ex.length > 2 ? ` +${ex.length - 2}` : ""})` : "";
        return `${c.name}${exText}${ok}`;
      })
      .filter(Boolean)
      .join(" · ");
  }

  const daySummary = useMemo(() => {
    return mealGroups.map((g) => `${g.name}: ${groupSummary(g.id)}`).join(" | ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealGroups, selections, dateStr]);

  return (
    <>
      <Card
        ref={dayCardRef}
        className={["w-full relative flex flex-col rounded-2xl", "p-4 sm:p-6", className ?? ""].join(" ")}
      >
        {/* Replicate Menu */}
        <div className="absolute top-3 right-3 z-10">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!hasSelection}
                aria-label="Actions"
                title={hasSelection ? "Actions" : "Select at least one item first"}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 rounded-2xl border shadow-md text-sm" side="bottom" align="end">
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onReplicate(dateStr, "next-days");
                }}
              >
                <span>Apply for</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={daysToCopy}
                  onChange={(e) => setDaysToCopy(Number(e.target.value))}
                  className="w-12 border rounded text-center py-1 px-2 mx-1"
                />
                <span>more day{daysToCopy > 1 ? "s" : ""}</span>
                <Button type="submit" size="sm" disabled={!hasSelection}>
                  Copy
                </Button>
              </form>

              <hr className="my-3" />

              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onReplicate(dateStr, "weekday-weeks");
                }}
              >
                <span>Repeat for</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={weeksToRepeat}
                  onChange={(e) => setWeeksToRepeat(Number(e.target.value))}
                  className="w-12 border rounded text-center py-1 px-2 mx-1"
                />
                <span>week{weeksToRepeat > 1 ? "s" : ""}</span>
                <Button type="submit" size="sm" disabled={!hasSelection}>
                  Repeat
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        </div>

        {/* Day header */}
        <div className="mb-3 pr-12">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-xl sm:text-2xl leading-tight">
                {weekday}, {format(date, "MMM d")}
              </h2>

              {/* Progress bar */}
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${progress.pct}%` }} />
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {progress.left === 0 ? "Done 🎉" : `${progress.left} left`}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  userTouchedDay.current = true;
                  setDayMinimized((v) => !v);
                }}
                disabled={disabled}
              >
                {dayMinimized ? "Expand" : "Minimise"}
              </Button>

              {dayComplete ? (
                <span className="text-xs px-2 py-1 rounded-full border bg-green-50">Complete</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full border bg-amber-50">
                  Missing: {missingGroups.slice(0, 2).join(", ")}
                  {missingGroups.length > 2 ? ` +${missingGroups.length - 2}` : ""}
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mt-2 line-clamp-2">{daySummary}</div>
        </div>

        {/* Day body */}
        {!dayMinimized && (
          <div className="space-y-4">
            {mealGroups.map((group) => {
              const isComplete = groupComplete(group.id);
              const isExpanded = expandedGroups[group.id] ?? true;
              const chosenIds = dayData?.[group.id]?.choiceIds || [];

              return (
                <section key={group.id} className="rounded-2xl border bg-background overflow-hidden">
                  {/* Group header */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3"
                    onClick={() => {
                      userTouchedGroup.current[group.id] = true;
                      setExpandedGroups((prev) => ({ ...prev, [group.id]: !(prev[group.id] ?? true) }));
                    }}
                    disabled={disabled}
                    aria-label={`Toggle ${group.name}`}
                  >
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-base sm:text-lg">{group.name}</div>
                        {isComplete && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-green-50">
                            <CheckCircle2 className="w-4 h-4" /> Done
                          </span>
                        )}
                      </div>

                      {!isExpanded && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{groupSummary(group.id)}</div>
                      )}
                    </div>

                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="space-y-2">
                        {group.choices.map((choice) => {
                          const isChecked = chosenIds.includes(choice.id);
                          const extrasSelected = selectedExtras(group.id, choice.id);
                          const confirmed = isChoiceConfirmed(group.id, choice.id);
                          const extrasAvailable = (choice.ingredients ?? []).length > 0;

                          return (
                            // ✅ whole row opens the sheet (and selects if needed)
                            <div
                              key={choice.id}
                              role="button"
                              tabIndex={disabled ? -1 : 0}
                              onClick={() => openDetails(group.id, choice.id)}
                              onKeyDown={(e) => {
                                if (disabled) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openDetails(group.id, choice.id);
                                }
                              }}
                              className={[
                                "w-full text-left",
                                "rounded-2xl border",
                                "px-3 py-3",
                                "transition",
                                "active:scale-[0.99]",
                                "cursor-pointer select-none",
                                isChecked ? "border-primary/40 bg-primary/5" : "bg-background",
                                disabled ? "opacity-70 pointer-events-none" : "hover:bg-muted/40",
                              ].join(" ")}
                              aria-label={`${choice.name} details`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Thumb */}
                                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0 mt-0.5">
                                  {choice.imageUrl ? (
                                    <Image src={choice.imageUrl} alt={choice.name} fill sizes="48px" className="object-cover" />
                                  ) : null}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-base leading-snug break-words">{choice.name}</div>

                                  {isChecked && (
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white">
                                        {confirmed ? "Confirmed ✓" : "Selected"}
                                      </span>

                                      {extrasAvailable && (
                                        <span className="text-xs text-muted-foreground">
                                          {extrasSelected.length ? `Extras: ${extrasSelected.join(", ")}` : "Extras: none"}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Right-side actions when extras selected: Looks good + Edit extras */}
{/* Right-side actions when selected but not confirmed:
    - Always show "Looks good" (even if no extras chosen yet)
    - Show "Edit extras" only when extras exist for this choice */}
{isChecked && !confirmed && (
  <div className="shrink-0 flex items-center gap-2">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onConfirmChoice(dateStr, group.id, choice.id);

        if (!userTouchedGroup.current[group.id]) {
          setExpandedGroups((prev) => ({ ...prev, [group.id]: false }));
        }

        scrollDayToTop();
        setSheetOpen(false);
      }}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold",
        "shadow-sm transition active:scale-[0.98]",
        "bg-green-600 text-white hover:bg-green-700",
        disabled ? "opacity-60 pointer-events-none" : "",
      ].join(" ")}
      aria-label="Complete choice"
      title="Confirm this meal & extras"
    >
      Looks good <span aria-hidden>✅</span>
    </button>

    {extrasAvailable && (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          openDetails(group.id, choice.id);
        }}
        disabled={disabled}
      >
        Edit extras
      </Button>
    )}
  </div>
)}
                                {/* If confirmed, show tiny badge on right */}
                                {isChecked && confirmed && (
                                  <span className="shrink-0 text-[11px] px-2 py-1 rounded-full border bg-green-50 text-green-800">
                                    Done ✓
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>

      {/* DETAILS SHEET */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSheetTarget(null);
        }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "h-[82vh] rounded-t-3xl" : "w-full sm:max-w-md"}
        >
          <SheetHeader>
            <SheetTitle>{sheetChoice?.name ?? "Details"}</SheetTitle>
            <SheetDescription>{sheetGroup ? sheetGroup.name : "Meal"}</SheetDescription>
          </SheetHeader>

          {sheetTarget && sheetChoice && sheetGroup && (
            <div className="mt-4 bg-white space-y-5">
              {/* Extras */}
              <div className="rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Extras</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedExtras(sheetGroup.id, sheetChoice.id).length} selected
                  </div>
                </div>

                <div className="mt-3">
                  {(sheetChoice.ingredients ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No extras.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(sheetChoice.ingredients ?? []).map((extra) => {
                        const active = selectedExtras(sheetGroup.id, sheetChoice.id).includes(extra);
                        return (
                          <Button
                            key={extra}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "outline"}
                            disabled={disabled}
                            onClick={() => toggleExtra(sheetGroup.id, sheetChoice.id, extra)}
                            className={active ? "ring-2 ring-green-200" : ""}
                          >
                            {active ? "✓ " : ""}
                            {extra}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Confirm (always available in sheet) */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">Confirm to lock it in.</div>

                  {!isChoiceConfirmed(sheetGroup.id, sheetChoice.id) ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onConfirmChoice(dateStr, sheetGroup.id, sheetChoice.id);

                        if (!userTouchedGroup.current[sheetGroup.id]) {
                          setExpandedGroups((prev) => ({ ...prev, [sheetGroup.id]: false }));
                        }

                        setSheetOpen(false);
                        scrollDayToTop();
                      }}
                      className={[
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
                        "shadow-sm transition active:scale-[0.98]",
                        "bg-green-600 text-white hover:bg-green-700",
                        disabled ? "opacity-60 pointer-events-none" : "",
                      ].join(" ")}
                      aria-label="Complete choice"
                      title="Confirm this meal & extras"
                    >
                      Looks good <span aria-hidden>✅</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold bg-green-100 text-green-800 border border-green-200">
                      Complete <span aria-hidden>✓</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Nutrition */}
              <div className="rounded-2xl border p-4">
                <div className="font-semibold">Nutrition</div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-xl border">
                    <div className="text-muted-foreground">Calories</div>
                    <div className="text-lg font-semibold">{formatNum(sheetChoice.caloriesKcal)} kcal</div>
                  </div>
                  <div className="p-3 rounded-xl border">
                    <div className="text-muted-foreground">Protein</div>
                    <div className="text-lg font-semibold">{formatNum(sheetChoice.proteinG)} g</div>
                  </div>
                  <div className="p-3 rounded-xl border">
                    <div className="text-muted-foreground">Carbs</div>
                    <div className="text-lg font-semibold">{formatNum(sheetChoice.carbsG)} g</div>
                  </div>
                  <div className="p-3 rounded-xl border">
                    <div className="text-muted-foreground">Fat</div>
                    <div className="text-lg font-semibold">{formatNum(sheetChoice.fatG)} g</div>
                  </div>
                  <div className="p-3 rounded-xl border">
                    <div className="text-muted-foreground">Sugars</div>
                    <div className="text-lg font-semibold">{formatNum(sheetChoice.sugarsG)} g</div>
                  </div>
                  <div className="p-3 rounded-xl border">
                    <div className="text-muted-foreground">Salt</div>
                    <div className="text-lg font-semibold">{formatNum(sheetChoice.saltG)} g</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">Base meal nutrition.</div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}