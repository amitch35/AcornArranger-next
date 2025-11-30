import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { ProtectedLayout } from "../../ProtectedLayout";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  usePathname: () => "/protected",
}));

describe("Sidebar", () => {
  // Helper to render Sidebar within ProtectedLayout context
  const renderSidebar = () => {
    return render(
      <ProtectedLayout sidebar={<Sidebar />}>
        <div>Test content</div>
      </ProtectedLayout>
    );
  };

  describe("Component Rendering", () => {
    it("renders navigation with correct aria-label", () => {
      renderSidebar();

      const nav = screen.getByRole("navigation", { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("id", "app-sidebar");
    });

    it("renders all navigation items", () => {
      renderSidebar();

      // Check for main navigation items
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /appointments/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /properties/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /staff/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /schedule/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    });

    it("has correct href attributes", () => {
      renderSidebar();

      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/protected");
      expect(screen.getByRole("link", { name: /appointments/i })).toHaveAttribute("href", "/protected/appointments");
      expect(screen.getByRole("link", { name: /properties/i })).toHaveAttribute("href", "/protected/properties");
    });
  });

  describe("Active State", () => {
    it("marks current page as active with aria-current", () => {
      renderSidebar();

      const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute("aria-current", "page");
    });

    it("applies active styling to current page", () => {
      renderSidebar();

      const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
      expect(dashboardLink).toHaveClass("bg-accent");
    });

    it("does not mark inactive pages as current", () => {
      renderSidebar();

      const appointmentsLink = screen.getByRole("link", { name: /appointments/i });
      expect(appointmentsLink).not.toHaveAttribute("aria-current");
    });
  });

  describe("Accessibility", () => {
    it("has proper navigation landmark", () => {
      renderSidebar();

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAccessibleName("Main navigation");
    });

    it("nav items are keyboard accessible", () => {
      renderSidebar();

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        // Links should be focusable
        expect(link).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("icons are hidden from screen readers", () => {
      const { container } = renderSidebar();

      const icons = container.querySelectorAll("svg");
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("renders desktop sidebar", () => {
      const { container } = renderSidebar();

      // Desktop sidebar should exist
      const desktopSidebar = container.querySelector("aside");
      expect(desktopSidebar).toBeInTheDocument();
    });

    it("desktop sidebar contains navigation", () => {
      renderSidebar();

      // Navigation should be accessible
      const nav = screen.getByRole("navigation", { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
    });
  });
});

