// components/parent/DayEditModal.tsx
"use client";

import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ChoiceConfig = { selectedIngredients: string[]; extrasConfirmed?: boolean };

type MealChoice = {
  id: string;
  name: string;
  ingredients?: string[];
};

type Selections = Record<
  string,
  Record<
    string,
    {
      choiceIds: string[];
      configByChoiceId: Record<string, ChoiceConfig>;
    }
  >
>;

interface Props {
  dateStr: string;
  selections: Selections;
  mealGroups: {
    id: string;
    name: string;
    maxSelections: number;
    choices: MealChoice[];
  }[];
  onClose: () => void;
  onSelect: (dateStr: string, groupId: string, newChoiceIds: string[]) => void;
  onUpdateConfig: (dateStr: string, groupId: string, choiceId: string, selectedIngredients: string[]) => void;
}

export default function DayEditModal({ dateStr, onClose, selections, mealGroups, onSelect, onUpdateConfig }: Props) {
  const date = new Date(dateStr);
  const weekday = format(date, "EEEE, MMM d");

  const dayData = selections[dateStr] ?? {};

  const selectedExtras = (groupId: string, choiceId: string): string[] => {
    return dayData?.[groupId]?.configByChoiceId?.[choiceId]?.selectedIngredients ?? [];
  };

  const confirmNoExtras = (groupId: string, choiceId: string) => {
    onUpdateConfig(dateStr, groupId, choiceId, selectedExtras(groupId, choiceId));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Lunch – {weekday}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {mealGroups.map((group) => {
            const selectedIds = dayData?.[group.id]?.choiceIds ?? [];

            return (
              <section key={group.id} className="space-y-2">
                <h3 className="font-medium text-sm">
                  {group.name} (up to {group.maxSelections})
                </h3>

                <div className="flex flex-wrap gap-2">
                  {group.choices.map((choice) => {
                    const isChecked = selectedIds.includes(choice.id);

                    return (
                      <Button
                        key={choice.id}
                        type="button"
                        variant={isChecked ? "default" : "outline"}
                        onClick={() => {
                          let next: string[];
                          if (isChecked) next = selectedIds.filter((id) => id !== choice.id);
                          else if (selectedIds.length < group.maxSelections) next = [...selectedIds, choice.id];
                          else next = [...selectedIds.slice(1), choice.id];
                          onSelect(dateStr, group.id, next);
                        }}
                      >
                        {choice.name}
                      </Button>
                    );
                  })}
                </div>

                {selectedIds.map((choiceId) => {
                  const choice = group.choices.find((c) => c.id === choiceId);
                  const extras = choice?.ingredients ?? [];
                  if (!extras.length) return null;

                  const cur = selectedExtras(group.id, choiceId);

                  return (
                    <div key={choiceId} className="mt-2 rounded-xl border p-3">
                      <div className="text-xs font-semibold mb-2">Extras for: {choice?.name ?? "Selected item"}</div>

                      <div className="flex flex-wrap gap-2">
                        {extras.map((extra) => {
                          const active = cur.includes(extra);
                          return (
                            <Button
                              key={extra}
                              type="button"
                              size="sm"
                              variant={active ? "default" : "outline"}
                              onClick={() => {
                                const next = active ? cur.filter((x) => x !== extra) : [...cur, extra];
                                onUpdateConfig(dateStr, group.id, choiceId, next);
                              }}
                            >
                              {extra}
                            </Button>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <Button type="button" size="sm" variant="outline" onClick={() => confirmNoExtras(group.id, choiceId)}>
                          No extras
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <div className="text-right mt-4">
          <Button variant="outline" onClick={onClose} aria-label="Done editing">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}