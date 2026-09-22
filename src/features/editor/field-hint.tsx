"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FieldHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="More info"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SoundsHintLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1">
      <p className="text-[11px] text-muted">Sounds</p>
      <FieldHint text={text} />
    </div>
  );
}
