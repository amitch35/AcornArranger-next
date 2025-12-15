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
import { useProtectedLayout } from "../ProtectedLayout";

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
 * On mobile (<1024px), opens the overlay sidebar.
 * On desktop (>=1024px), toggles collapse/expand state.
 */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const { setMobileSidebarOpen, mobileSidebarOpen } = useProtectedLayout();

  const handleClick = () => {
    // Desktop vs mobile behavior:
    // - Desktop (>= lg): collapse/expand rail
    // - Mobile (< lg): toggle overlay open/closed
    const isDesktop =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches;

    if (isDesktop) {
      onToggle();
      return;
    }

    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label="Toggle menu"
            aria-expanded={mobileSidebarOpen || !collapsed}
            aria-controls="app-sidebar"
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span className="lg:hidden">Open menu</span>
          <span className="hidden lg:inline">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

