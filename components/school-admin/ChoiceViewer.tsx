"use client";

export interface MealChoice {
  id: string;
  name: string;
}

interface Props {
  groupId: string;
  initialChoices?: MealChoice[];
  disabled?: boolean; // Not used but for API compatibility
}

// Read-only version: just list choices, no add/edit.
export default function ChoiceViewer({
  groupId,
  initialChoices,
}: Props) {
  const choices = initialChoices ?? [];
  return (
    <div className="mt-2">
      {choices.length === 0 && (
        <div className="text-sm text-muted-foreground italic">No choices found.</div>
      )}
      {choices.map((choice) => (
        <div
          key={choice.id}
          className="flex items-center justify-between py-2"
        >
          <span>{choice.name}</span>
        </div>
      ))}
    </div>
  );
}
