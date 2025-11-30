"use client";

import React from "react";
import { useProtectedLayout } from "../ProtectedLayout";
import { SidebarToggle } from "./SidebarToggle";
import { Logo } from "./Logo";
import { Breadcrumbs } from "./Breadcrumbs";
import { ProfileMenu } from "./ProfileMenu";

/**
 * Header component for the protected layout
 * 
 * Provides a sticky header bar with:
 * - Sidebar toggle (left)
 * - Logo and breadcrumbs (center-left)
 * - Profile menu (right)
 * 
 * Uses the layout context to control sidebar state.
 */
export function Header() {
  const { sidebarCollapsed, toggleSidebar } = useProtectedLayout();

  return (
    <div className="h-full flex items-center px-4 lg:px-6 gap-4">
      {/* Left section: Sidebar toggle */}
      <SidebarToggle
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />

      {/* Center-left section: Logo and breadcrumbs */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <Logo />
        <Breadcrumbs />
      </div>

      {/* Right section: Profile menu */}
      <ProfileMenu />
    </div>
  );
}

