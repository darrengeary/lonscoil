"use client";

import { Card } from "@/components/ui/card";
import ChoiceViewer, { MealChoice } from "./ChoiceViewer";

export interface MealGroup {
  id: string;
  name: string;
  maxSelections: number;
  choices?: MealChoice[];
}

interface Props {
  initialGroups?: MealGroup[];
}

// Read-only version: no add/edit UI, just lists groups and choices.
export default function MealGroupViewer({ initialGroups }: Props) {
  const groups = initialGroups ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => (
          <Card
            key={group.id}
            className="p-4 border hover:border-blue-400 transition-colors"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-md font-medium">{group.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  (Max: {group.maxSelections})
                </span>
              </div>
            </div>
            <ChoiceViewer
              groupId={group.id}
              initialChoices={group.choices}
              disabled={true}
            />
          </Card>
        ))}
        {groups.length === 0 && (
          <div className="text-sm text-muted-foreground italic col-span-2">No meal groups found.</div>
        )}
      </div>
    </div>
  );
}
