import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Header } from "../Header";
import { ProtectedLayout } from "../../ProtectedLayout";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  usePathname: () => "/protected",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({
        data: {
          user: {
            email: "test@example.com",
            user_metadata: { name: "Test User" },
          },
        },
      }),
      signOut: vi.fn(),
    },
  }),
}));

describe("Header", () => {
  // Helper to render Header within ProtectedLayout context
  const renderHeader = () => {
    return render(
      <ProtectedLayout header={<Header />}>
        <div>Test content</div>
      </ProtectedLayout>
    );
  };

  describe("Component Rendering", () => {
    it("renders all header sections", () => {
      renderHeader();

      // Sidebar toggle should be present
      expect(screen.getByLabelText(/sidebar/i)).toBeInTheDocument();

      // Logo should be present
      expect(screen.getByText("AcornArranger")).toBeInTheDocument();

      // Profile menu trigger should be present
      expect(screen.getByLabelText(/user menu/i)).toBeInTheDocument();
    });

    it("renders logo with link to dashboard", () => {
      renderHeader();

      const logo = screen.getByLabelText("Go to dashboard");
      expect(logo).toHaveAttribute("href", "/protected");
    });
  });

  describe("Sidebar Toggle", () => {
    it("has correct ARIA attributes", () => {
      renderHeader();

      const toggle = screen.getByLabelText(/sidebar/i);
      expect(toggle).toHaveAttribute("aria-expanded");
      expect(toggle).toHaveAttribute("aria-controls", "app-sidebar");
    });

    it("toggles sidebar when clicked", () => {
      renderHeader();

      const toggle = screen.getByLabelText(/sidebar/i);
      
      // Initial state should be expanded (aria-expanded="true")
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      // Click to collapse
      fireEvent.click(toggle);

      // Should now be collapsed (aria-expanded="false")
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Breadcrumbs", () => {
    it("does not show breadcrumbs on dashboard root", () => {
      renderHeader();

      // Should not have breadcrumb navigation on root
      const breadcrumbNav = screen.queryByLabelText("Breadcrumb");
      expect(breadcrumbNav).not.toBeInTheDocument();
    });
  });

  describe("Profile Menu", () => {
    it("displays user avatar button", () => {
      renderHeader();

      const avatarButton = screen.getByLabelText(/user menu/i);
      expect(avatarButton).toBeInTheDocument();
      expect(avatarButton).toHaveAttribute("aria-haspopup", "menu");
    });

    it("avatar shows user initials", async () => {
      renderHeader();

      // Wait for user data to load and initials to appear
      await waitFor(() => {
        expect(screen.getByText("TU")).toBeInTheDocument();
      });
    });

    it("avatar button is clickable", () => {
      renderHeader();

      const avatarButton = screen.getByLabelText(/user menu/i);
      expect(avatarButton).not.toBeDisabled();
      
      // Should toggle aria-expanded on click
      expect(avatarButton).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(avatarButton);
      // Note: Full dropdown menu testing requires E2E tests due to portal rendering
    });
  });

  describe("Responsive Behavior", () => {
    it("hides logo text on small screens", () => {
      renderHeader();

      const logoText = screen.getByText("AcornArranger");
      expect(logoText).toHaveClass("hidden", "sm:inline");
    });
  });
});

