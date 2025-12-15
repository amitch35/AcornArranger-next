import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { ProtectedLayout } from "../../ProtectedLayout";
import { SidebarToggle } from "../../Header/SidebarToggle";
import { act } from "react";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
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

  const renderSidebarWithToggle = () => {
    // Minimal header containing only the toggle, to avoid pulling in full Header dependencies
    return render(
      <ProtectedLayout
        header={<SidebarToggle collapsed={false} onToggle={() => {}} />}
        sidebar={<Sidebar />}
      >
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

      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
      expect(screen.getByRole("link", { name: /appointments/i })).toHaveAttribute("href", "/dashboard/appointments");
      expect(screen.getByRole("link", { name: /properties/i })).toHaveAttribute("href", "/dashboard/properties");
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

    it("mobile menu opens and stays open after toggle click (regression)", async () => {
      // Ensure matchMedia exists and behaves like a mobile viewport
      (window as any).matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("min-width: 1024px") ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { container } = renderSidebarWithToggle();

      // Open
      const toggle = screen.getByRole("button", { name: /toggle menu/i });
      await act(async () => {
        fireEvent.click(toggle);
      });

      // The layout should mark the sidebar as open (CSS does the rest in real browser)
      let sidebarAside = container.querySelector(".protected-layout__sidebar");
      expect(sidebarAside).toBeTruthy();
      expect(sidebarAside).toHaveClass("protected-layout__sidebar--open");

      // Wait a tick: previously, the buggy effect would immediately close it again
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      sidebarAside = container.querySelector(".protected-layout__sidebar");
      expect(sidebarAside).toHaveClass("protected-layout__sidebar--open");
    });
  });
});

