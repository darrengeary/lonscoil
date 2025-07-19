"use client";

import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  dateStr: string;
  selections: Record<string, Record<string, string[]>>;
  mealGroups: {
    id: string;
    name: string;
    maxSelections: number;
    choices: { id: string; name: string }[];
  }[];
  onClose: () => void;
  onSelect: (dateStr: string, groupId: string, choiceId: string) => void;
}

export default function DayEditModal({
  dateStr,
  onClose,
  selections,
  mealGroups,
  onSelect,
}: Props) {
  const date = new Date(dateStr);
  const weekday = format(date, "EEEE, MMM d");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Lunch – {weekday}</DialogTitle>
        </DialogHeader>

        {mealGroups.map((group) => {
          const selected = selections[dateStr]?.[group.id] || [];
          return (
            <section key={group.id} className="mb-4">
              <h3 className="font-medium text-sm mb-1">
                {group.name} (up to {group.maxSelections})
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.choices.map((choice) => {
                  const isChecked = selected.includes(choice.id);
                  const isDisabled =
                    !isChecked && selected.length >= group.maxSelections;
                  return (
                    <Button
                      key={choice.id}
                      variant={isChecked ? "default" : "outline"}
                      disabled={isDisabled}
                      onClick={() => onSelect(dateStr, group.id, choice.id)}
                    >
                      {choice.name}
                    </Button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="text-right">
          <Button variant="outline" onClick={onClose} aria-label="Done editing">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
