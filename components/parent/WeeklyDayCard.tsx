"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { format, isBefore, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChevronDown, ChevronRight, MoreVertical, SlidersHorizontal } from "lucide-react";

type ChoiceConfig = { selectedIngredients: string[] };

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
  ingredients?: string[]; // extras list
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
    maxSelections: number; // "up to N"
    choices: MealChoice[];
  }[];

  onSelect: (dateStr: string, groupId: string, newChoiceIds: string[]) => void;

  onUpdateConfig: (
    dateStr: string,
    groupId: string,
    choiceId: string,
    selectedIngredients: string[]
  ) => void;

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

  // Nutrition sheet state
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [nutritionTarget, setNutritionTarget] = useState<{ groupId: string; choiceId: string } | null>(null);

  // Collapsing logic
  // expandedGroups[groupId] = true means expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [dayCollapsed, setDayCollapsed] = useState(false);

  // track if user manually expanded a complete group (so we don't keep auto-collapsing it)
  const userTouchedGroup = useRef<Record<string, boolean>>({});

  const dayData = selections[dateStr] || {};

  const groupComplete = (groupId: string) => {
    // All groups required; complete means >= 1 selection (maxSelections is "up to", not required to fill)
    const chosen = dayData?.[groupId]?.choiceIds || [];
    return chosen.length >= 1;
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

  // Initialize expandedGroups per date: expanded if incomplete, collapsed if complete
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const g of mealGroups) {
      next[g.id] = !groupComplete(g.id);
    }
    setExpandedGroups(next);
    userTouchedGroup.current = {};
    setDayCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, mealGroups.length]);

  // Auto-collapse groups as they become complete (unless user touched)
  const prevCompleteRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const prev = prevCompleteRef.current;
    const nextPrev: Record<string, boolean> = {};

    setExpandedGroups((cur) => {
      let changed = false;
      const out = { ...cur };

      for (const g of mealGroups) {
        const nowComplete = groupComplete(g.id);
        nextPrev[g.id] = nowComplete;

        const wasComplete = prev[g.id] ?? false;

        // transition incomplete -> complete, and user didn't force open: collapse
        if (!wasComplete && nowComplete && !userTouchedGroup.current[g.id]) {
          if (out[g.id] !== false) {
            out[g.id] = false;
            changed = true;
          }
        }

        // if group becomes incomplete, ensure it's expanded (so they can finish)
        if (wasComplete && !nowComplete) {
          if (out[g.id] !== true) {
            out[g.id] = true;
            changed = true;
          }
        }
      }

      return changed ? out : cur;
    });

    prevCompleteRef.current = nextPrev;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, dateStr, mealGroups]);

  // Auto-collapse day when it becomes complete
  const prevDayComplete = useRef(false);
  useEffect(() => {
    if (!prevDayComplete.current && dayComplete) {
      setDayCollapsed(true);
    }
    if (prevDayComplete.current && !dayComplete) {
      setDayCollapsed(false);
    }
    prevDayComplete.current = dayComplete;
  }, [dayComplete]);

  const hasSelection = useMemo(() => {
    const day = selections[dateStr];
    if (!day) return false;
    return Object.values(day).some((g) => (g?.choiceIds?.length ?? 0) > 0);
  }, [selections, dateStr]);

  function toggleChoice(groupId: string, choiceId: string) {
    if (disabled) return;

    const group = mealGroups.find((g) => g.id === groupId);
    if (!group) return;

    const selected = dayData?.[groupId]?.choiceIds || [];
    const max = group.maxSelections || 1;

    let next: string[];
    if (selected.includes(choiceId)) {
      next = selected.filter((id) => id !== choiceId);
    } else if (selected.length < max) {
      next = [...selected, choiceId];
    } else {
      // rotate oldest out if they exceed "up to N"
      next = [...selected.slice(1), choiceId];
    }

    onSelect(dateStr, groupId, next);
  }

  function selectedExtras(groupId: string, choiceId: string): string[] {
    return dayData?.[groupId]?.configByChoiceId?.[choiceId]?.selectedIngredients ?? [];
  }

  function toggleExtra(groupId: string, choiceId: string, extra: string) {
    if (disabled) return;
    const cur = selectedExtras(groupId, choiceId);
    const active = cur.includes(extra);
    const next = active ? cur.filter((x) => x !== extra) : [...cur, extra];
    onUpdateConfig(dateStr, groupId, choiceId, next);
  }

  function openNutrition(groupId: string, choiceId: string) {
    if (disabled) return;
    setNutritionTarget({ groupId, choiceId });
    setNutritionOpen(true);
  }

  const nutritionChoice = useMemo(() => {
    if (!nutritionTarget) return null;
    const g = mealGroups.find((x) => x.id === nutritionTarget.groupId);
    return g?.choices.find((c) => c.id === nutritionTarget.choiceId) ?? null;
  }, [nutritionTarget, mealGroups]);

  function groupSummary(groupId: string) {
    const group = mealGroups.find((g) => g.id === groupId);
    if (!group) return "—";
    const ids = dayData?.[groupId]?.choiceIds || [];
    if (!ids.length) return "Not selected";

    const parts = ids
      .map((id) => {
        const c = group.choices.find((x) => x.id === id);
        if (!c) return null;
        const ex = selectedExtras(groupId, id);
        const exText = ex.length ? ` (+${ex.slice(0, 2).join(", ")}${ex.length > 2 ? ` +${ex.length - 2}` : ""})` : "";
        return `${c.name}${exText}`;
      })
      .filter(Boolean);

    return parts.join(" · ");
  }

  const daySummary = useMemo(() => {
    return mealGroups.map((g) => `${g.name}: ${groupSummary(g.id)}`).join(" | ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealGroups, selections, dateStr]);

  return (
    <>
      <Card className={`w-full p-6 relative flex flex-col ${className ?? ""}`}>
        {/* Replicate Menu */}
        <div className="absolute top-4 right-4 z-10">
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
                <span>Apply this order for</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={daysToCopy}
                  onChange={(e) => setDaysToCopy(Number(e.target.value))}
                  className="w-12 border rounded text-center py-1 px-2 mx-1"
                />
                <span>more school day{daysToCopy > 1 ? "s" : ""}</span>
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
                <span>Apply to same weekday for</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={weeksToRepeat}
                  onChange={(e) => setWeeksToRepeat(Number(e.target.value))}
                  className="w-12 border rounded text-center py-1 px-2 mx-1"
                />
                <span>more week{weeksToRepeat > 1 ? "s" : ""}</span>
                <Button type="submit" size="sm" disabled={!hasSelection}>
                  Repeat
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        </div>

        {/* Day header */}
        <div className="mb-4 pr-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-2xl leading-tight">
              {weekday}, {format(date, "MMM d")}
            </h2>

            {dayComplete ? (
              <span className="text-xs px-2 py-1 rounded-full border bg-green-50">Complete</span>
            ) : (
              <span className="text-xs px-2 py-1 rounded-full border bg-amber-50">
                Missing: {missingGroups.slice(0, 2).join(", ")}
                {missingGroups.length > 2 ? ` +${missingGroups.length - 2}` : ""}
              </span>
            )}
          </div>

          {!dayCollapsed && (
            <div className="text-sm text-muted-foreground mt-1">
              Complete each section; it will minimise into a summary.
            </div>
          )}

          {dayCollapsed && (
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="text-sm text-muted-foreground line-clamp-2">{daySummary}</div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDayCollapsed(false)} disabled={disabled}>
                Edit day
              </Button>
            </div>
          )}
        </div>

        {/* Day body */}
        {!dayCollapsed && (
          <div className="space-y-6">
            {mealGroups.map((group) => {
              const isComplete = groupComplete(group.id);
              const isExpanded = expandedGroups[group.id] ?? true;

              const chosenIds = dayData?.[group.id]?.choiceIds || [];

              return (
                <section key={group.id} className="rounded-2xl border">
                  {/* Group header (click to toggle, but only meaningful when complete) */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-4"
                    onClick={() => {
                      if (!isComplete) return; // don't collapse incomplete groups
                      userTouchedGroup.current[group.id] = true;
                      setExpandedGroups((prev) => ({ ...prev, [group.id]: !(prev[group.id] ?? false) }));
                    }}
                    disabled={disabled}
                    aria-label={`Toggle ${group.name}`}
                  >
                    <div className="text-left">
                      <div className="font-semibold text-lg">{group.name}</div>
                      {isComplete && !isExpanded && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {groupSummary(group.id)}
                        </div>
                      )}
                      {!isComplete && (
                        <div className="text-sm text-amber-700 mt-1">Required: select at least 1</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isComplete && (
                        <span className="text-xs px-2 py-1 rounded-full border bg-green-50">Done</span>
                      )}
                      {isComplete ? (isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />) : (
                        <ChevronRight className="w-5 h-5 opacity-0" />
                      )}
                    </div>
                  </button>

                  {/* Group body */}
                  {(!isComplete || isExpanded) && (
                    <div className="px-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-3">
                        Choose up to {group.maxSelections}
                      </div>

                      <div className="space-y-4">
                        {group.choices.map((choice) => {
                          const isChecked = chosenIds.includes(choice.id);
                          const extrasAvailable = choice.ingredients ?? [];
                          const extrasSelected = selectedExtras(group.id, choice.id);

                          return (
                            <div
                              key={choice.id}
                              className={`rounded-2xl border p-4 transition ${
                                isChecked ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                              }`}
                            >
                              <div className="grid grid-cols-[140px_1fr_auto] gap-4 items-start">
                                {/* image */}
                                <button
                                  type="button"
                                  className="relative w-[140px] h-[104px] sm:h-[120px] rounded-xl overflow-hidden bg-muted"
                                  onClick={() => toggleChoice(group.id, choice.id)}
                                  disabled={disabled}
                                  aria-label={`Select ${choice.name}`}
                                >
                                  {choice.imageUrl ? (
                                    <Image
                                      src={choice.imageUrl}
                                      alt={choice.name}
                                      fill
                                      sizes="140px"
                                      className="object-cover"
                                    />
                                  ) : null}
                                </button>

                                {/* title + extras line (YOUR REQUEST: extras line lives here) */}
                                <button
                                  type="button"
                                  onClick={() => toggleChoice(group.id, choice.id)}
                                  disabled={disabled}
                                  className="text-left w-full"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="font-semibold text-lg leading-snug truncate">{choice.name}</div>
                                    {isChecked && <span className="text-xs px-2 py-0.5 rounded-full border">Selected</span>}
                                  </div>

                                  {/* Extras line goes exactly where your old “extras enabled below” text was */}
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {!isChecked
                                      ? "Extras: select meal to enable"
                                      : extrasSelected.length
                                      ? `Extras: ${extrasSelected.slice(0, 3).join(", ")}${
                                          extrasSelected.length > 3 ? ` +${extrasSelected.length - 3}` : ""
                                        }`
                                      : "Extras: none"}
                                  </div>
                                </button>

                                {/* nutrition */}
                                <div className="flex flex-col items-end gap-2">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => openNutrition(group.id, choice.id)}
                                    disabled={disabled}
                                    title="Nutrition"
                                  >
                                    <SlidersHorizontal className="w-5 h-5" />
                                  </Button>
                                  <div className="text-[11px] text-muted-foreground text-right leading-tight">
                                    Nutrition
                                  </div>
                                </div>
                              </div>

                              {/* Extras chips (on card) */}
                              {isChecked && (
                                <div className="mt-4">
                                  {extrasAvailable.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">No extras.</div>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {extrasAvailable.map((extra) => {
                                        const active = extrasSelected.includes(extra);
                                        return (
                                          <Button
                                            key={extra}
                                            type="button"
                                            size="sm"
                                            variant={active ? "default" : "outline"}
                                            disabled={disabled}
                                            onClick={() => toggleExtra(group.id, choice.id, extra)}
                                          >
                                            {extra}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
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

      {/* NUTRITION SHEET (bottom on phone, right on desktop) */}
      <Sheet
        open={nutritionOpen}
        onOpenChange={(open) => {
          setNutritionOpen(open);
          if (!open) setNutritionTarget(null);
        }}
      >
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "h-[75vh] rounded-t-3xl" : "w-full sm:max-w-md"}
        >
          <SheetHeader>
            <SheetTitle>Nutrition</SheetTitle>
            <SheetDescription>{nutritionChoice?.name ?? "Nutrition details"}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border">
              <div className="text-muted-foreground">Calories</div>
              <div className="text-lg font-semibold">{formatNum(nutritionChoice?.caloriesKcal)} kcal</div>
            </div>
            <div className="p-3 rounded-xl border">
              <div className="text-muted-foreground">Protein</div>
              <div className="text-lg font-semibold">{formatNum(nutritionChoice?.proteinG)} g</div>
            </div>
            <div className="p-3 rounded-xl border">
              <div className="text-muted-foreground">Carbs</div>
              <div className="text-lg font-semibold">{formatNum(nutritionChoice?.carbsG)} g</div>
            </div>
            <div className="p-3 rounded-xl border">
              <div className="text-muted-foreground">Fat</div>
              <div className="text-lg font-semibold">{formatNum(nutritionChoice?.fatG)} g</div>
            </div>
            <div className="p-3 rounded-xl border">
              <div className="text-muted-foreground">Sugars</div>
              <div className="text-lg font-semibold">{formatNum(nutritionChoice?.sugarsG)} g</div>
            </div>
            <div className="p-3 rounded-xl border">
              <div className="text-muted-foreground">Salt</div>
              <div className="text-lg font-semibold">{formatNum(nutritionChoice?.saltG)} g</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">Base meal nutrition.</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
