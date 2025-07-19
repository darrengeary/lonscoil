"use client";

import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MoreVertical, Repeat, Copy } from "lucide-react";

interface Props {
  date: Date;
  selections: Record<string, Record<string, string[]>>;
  mealGroups: {
    id: string;
    name: string;
    maxSelections: number;
    choices: { id: string; name: string }[];
  }[];
  onSelect: (dateStr: string, groupId: string, choiceId: string) => void;
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
  weeksToRepeat,
  setDaysToCopy,
  setWeeksToRepeat,
}: Props) {
  const dateStr = format(date, "yyyy-MM-dd");
  const weekday = format(date, "EEEE");
  const hasSelection = Boolean(selections[dateStr]);

  return (
    <Card className="p-4 w-full">
      <h2 className="font-semibold text-lg mb-2">
        {weekday}, {format(date, "MMM d")}
      </h2>

      <div className="flex gap-2 mb-4">
        <Button
          variant="link"
          size="sm"
          onClick={() => onReplicate(dateStr, "next-days")}
          disabled={!hasSelection}
          aria-label={`Copy ${weekday} to rest of week`}
        >
          <Copy className="w-4 h-4" /> Rest of week
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={() => onReplicate(dateStr, "weekday-weeks")}
          disabled={!hasSelection}
          aria-label={`Repeat ${weekday} for next ${weeksToRepeat} weeks`}
        >
          <Repeat className="w-4 h-4" /> Repeat weekly
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Advanced copy options"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3">
            <div>
              <label className="text-sm font-medium">
                Copy {weekday} to next X days:
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={daysToCopy}
                  onChange={(e) => setDaysToCopy(Number(e.target.value))}
                  className="w-16 border px-2 py-1 rounded"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onReplicate(dateStr, "next-days")}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Repeat {weekday} for next X weeks:
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={weeksToRepeat}
                  onChange={(e) => setWeeksToRepeat(Number(e.target.value))}
                  className="w-16 border px-2 py-1 rounded"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onReplicate(dateStr, "weekday-weeks")}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
    </Card>
  );
}
