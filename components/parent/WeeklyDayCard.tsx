"use client";

import { format, isBefore, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MoreVertical } from "lucide-react";

interface Props {
  date: Date;
  selections: Record<string, Record<string, string[]>>;
  mealGroups: {
    id: string;
    name: string;
    maxSelections: number;
    choices: { id: string; name: string }[];
  }[];
  onSelect: (dateStr: string, groupId: string, newChoices: string[]) => void;
  onReplicate: (dateStr: string, type: string) => void;
  daysToCopy: number;
  weeksToRepeat: number;
  setDaysToCopy: (n: number) => void;
  setWeeksToRepeat: (n: number) => void;
}

export default function WeeklyDayCard({
  date,
  selections,
  mealGroups,
  onSelect,
  onReplicate,
  daysToCopy,
  setDaysToCopy,
  weeksToRepeat,
  setWeeksToRepeat,
}: Props) {
  const dateStr = format(date, "yyyy-MM-dd");
  const weekday = format(date, "EE");
  const hasSelection = Boolean(selections[dateStr]);
  const today = startOfDay(new Date());
  const isPast = isBefore(startOfDay(date), today);

  // HIDE past dates entirely
  if (isPast) return null;

  function handleChoiceSelect(groupId: string, choiceId: string) {
    const selected = selections[dateStr]?.[groupId] || [];
    const group = mealGroups.find((g) => g.id === groupId);
    if (!group) return;
    const max = group.maxSelections || 1;
    let next: string[];
    if (selected.includes(choiceId)) {
      next = selected.filter((id) => id !== choiceId);
    } else if (selected.length < max) {
      next = [...selected, choiceId];
    } else {
      next = [...selected.slice(1), choiceId];
    }
    onSelect(dateStr, groupId, next);
  }

  return (
    <Card className="p-5 w-full relative flex flex-col min-h-[320px]">
      {/* Replicate Menu (top right) */}
      <div className="absolute top-3 right-3 z-10">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              disabled={!hasSelection}
              aria-label="Actions"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-4 rounded-2xl border shadow-md text-sm"
            side="bottom"
            align="end"
          >
            {/* Copy to future days */}
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={e => { e.preventDefault(); onReplicate(dateStr, "next-days"); }}
            >
              <span>Apply this order for</span>
              <input
                type="number"
                min={1}
                max={10}
                value={daysToCopy}
                onChange={e => setDaysToCopy(Number(e.target.value))}
                className="w-12 border rounded text-center py-1 px-2 mx-1"
                style={{ fontSize: "0.9em", boxShadow: "none" }}
              />
              <span>more school day{daysToCopy > 1 ? "s" : ""}</span>
              <Button
                type="submit"
                size="sm"
                variant="default"
                className="ml-2"
                disabled={!hasSelection}
              >
                Copy
              </Button>
            </form>

            <hr className="my-3 border-gray-200" />

            {/* Repeat for weeks */}
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={e => { e.preventDefault(); onReplicate(dateStr, "weekday-weeks"); }}
            >
              <span>Apply this order to the same weekday for</span>
              <input
                type="number"
                min={1}
                max={10}
                value={weeksToRepeat}
                onChange={e => setWeeksToRepeat(Number(e.target.value))}
                className="w-12 border rounded text-center py-1 px-2 mx-1"
                style={{ fontSize: "0.9em", boxShadow: "none" }}
              />
              <span>more week{weeksToRepeat > 1 ? "s" : ""}</span>
              <Button
                type="submit"
                size="sm"
                variant="default"
                className="ml-2"
                disabled={!hasSelection}
              >
                Repeat
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>

      <h2 className="font-semibold text-lg mb-3 pr-10">
        {weekday}, {format(date, "MMM d")}
      </h2>

      {/* Choices UI */}
      {mealGroups.map((group) => {
        const selected = selections[dateStr]?.[group.id] || [];
        return (
          <section key={group.id} className="mb-4">
            <h3 className="font-medium text-sm mb-1">
              {group.name}{" "}
              <span className="text-xs text-muted-foreground">
                (choose up to {group.maxSelections})
              </span>
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              {group.choices.map((choice) => {
                const isChecked = selected.includes(choice.id);
                return (
                  <Button
                    key={choice.id}
                    variant={isChecked ? "default" : "outline"}
                    aria-pressed={isChecked}
                    onClick={() => handleChoiceSelect(group.id, choice.id)}
                  >
                    {choice.name}
                  </Button>
                );
              })}
            </div>
          </section>
        );
      })}
    </Card>
  );
}
