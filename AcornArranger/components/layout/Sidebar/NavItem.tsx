"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  /** Navigation link href */
  href: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Display label */
  label: string;
  /** Whether the sidebar is collapsed (rail mode) */
  collapsed: boolean;
  /** Whether this item is currently active */
  active: boolean;
}

/**
 * NavItem - Single navigation link in the sidebar
 * 
 * Features:
 * - Shows tooltip when collapsed
 * - Active state highlighting
 * - Keyboard accessible
 * - Proper ARIA attributes
 */
export function NavItem({
  href,
  icon: Icon,
  label,
  collapsed,
  active,
}: NavItemProps) {
  const content = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 mx-2 rounded-md transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent text-accent-foreground font-medium",
        collapsed && "justify-center"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("h-5 w-5 shrink-0")} aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  // Show tooltip when collapsed
  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

