"use client";

import React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarToggleProps {
  /** Whether the sidebar is currently collapsed */
  collapsed: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
}

/**
 * SidebarToggle - Hamburger button to toggle sidebar visibility
 * 
 * Provides accessible button with tooltip for collapsing/expanding the sidebar.
 */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

