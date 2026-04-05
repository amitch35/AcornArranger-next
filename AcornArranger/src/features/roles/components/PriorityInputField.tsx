"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PriorityInputFieldProps = {
  roleId: number;
  priority: number;
  disabled?: boolean;
  className?: string;
  onCommit: (next: number) => void;
};

function clampPriority(n: number): number {
  return Math.min(2_147_483_647, Math.max(-2_147_483_648, n));
}

/**
 * Priority text input: saves on blur or when the user presses Enter.
 */
export function PriorityInputField({
  roleId,
  priority,
  disabled,
  className,
  onCommit,
}: PriorityInputFieldProps) {
  const [draft, setDraft] = React.useState(String(priority));

  React.useEffect(() => {
    setDraft(String(priority));
  }, [priority, roleId]);

  const applyCommit = () => {
    if (disabled) return;
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(priority));
      return;
    }
    const clamped = clampPriority(n);
    setDraft(String(clamped));
    if (clamped !== priority) {
      onCommit(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCommit();
    }
  };

  return (
    <Input
      id={`role-priority-${roleId}`}
      className={cn("h-9 w-[5.5rem] font-mono tabular-nums", className)}
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={applyCommit}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label="Priority"
    />
  );
}
