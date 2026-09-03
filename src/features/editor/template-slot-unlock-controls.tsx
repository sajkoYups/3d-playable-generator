"use client";

import { Button } from "@/components/ui/button";
import { persistTemplateSlotUnlock } from "@/features/editor/template-slot-unlock";

export function TemplateSlotUnlockControls({
  slotId,
  unlocked,
}: {
  slotId: string;
  unlocked: boolean;
}) {
  return (
    <div className="space-y-1">
      {unlocked ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => void persistTemplateSlotUnlock(slotId, false)}
        >
          Use template (discards local edits)
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => void persistTemplateSlotUnlock(slotId, true)}
        >
          Customize on this playable
        </Button>
      )}
    </div>
  );
}
