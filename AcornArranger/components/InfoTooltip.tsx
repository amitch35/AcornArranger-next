"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  /** Accessible label for screen readers (e.g. "Cleaning Window info"). */
  label: string;
  /** Tooltip body content; supports multiple paragraphs. */
  children: React.ReactNode;
  /** Optional className override for the trigger button. */
  className?: string;
  /** Tooltip side; defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** Tooltip alignment along the chosen side; defaults to "center". */
  align?: "start" | "center" | "end";
}

/**
 * InfoTooltip - small "i" info icon next to a label that reveals help text
 * on hover, keyboard focus, or touch. Mirrors the legacy `info-dialog`
 * pattern (an info-circle icon that opened a help dialog) but uses
 * shadcn/radix Tooltip for a lighter, hover-friendly UX.
 *
 * Use next to a Label when a form field benefits from optional context
 * that would clutter the layout if rendered inline.
 */
export function InfoTooltip({
  label,
  children,
  className,
  side = "top",
  align = "center",
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring align-middle",
              className
            )}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs space-y-1.5 whitespace-normal text-pretty text-xs leading-relaxed"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default InfoTooltip;
