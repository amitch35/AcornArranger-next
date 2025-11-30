import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { NavItem } from "../NavItem";
import { Home } from "lucide-react";

describe("NavItem", () => {
  const defaultProps = {
    href: "/protected/test",
    icon: Home,
    label: "Test Page",
    collapsed: false,
    active: false,
  };

  describe("Rendering", () => {
    it("renders link with correct href", () => {
      render(<NavItem {...defaultProps} />);

      const link = screen.getByRole("link", { name: /test page/i });
      expect(link).toHaveAttribute("href", "/protected/test");
    });

    it("renders icon", () => {
      const { container } = render(<NavItem {...defaultProps} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("renders label when not collapsed", () => {
      render(<NavItem {...defaultProps} collapsed={false} />);

      expect(screen.getByText("Test Page")).toBeInTheDocument();
    });

    it("hides label when collapsed", () => {
      render(<NavItem {...defaultProps} collapsed={true} />);

      // Label should not be visible in the link
      const link = screen.getByRole("link");
      expect(link.textContent).not.toContain("Test Page");
    });
  });

  describe("Active State", () => {
    it("has aria-current when active", () => {
      render(<NavItem {...defaultProps} active={true} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("aria-current", "page");
    });

    it("does not have aria-current when inactive", () => {
      render(<NavItem {...defaultProps} active={false} />);

      const link = screen.getByRole("link");
      expect(link).not.toHaveAttribute("aria-current");
    });

    it("applies active styling when active", () => {
      render(<NavItem {...defaultProps} active={true} />);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("bg-accent");
      expect(link).toHaveClass("font-medium");
    });

    it("does not apply active styling when inactive", () => {
      render(<NavItem {...defaultProps} active={false} />);

      const link = screen.getByRole("link");
      expect(link).not.toHaveClass("font-medium");
    });
  });

  describe("Collapsed State", () => {
    it("centers content when collapsed", () => {
      render(<NavItem {...defaultProps} collapsed={true} />);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("justify-center");
    });

    it("does not center content when expanded", () => {
      render(<NavItem {...defaultProps} collapsed={false} />);

      const link = screen.getByRole("link");
      expect(link).not.toHaveClass("justify-center");
    });
  });

  describe("Accessibility", () => {
    it("has proper focus styles", () => {
      render(<NavItem {...defaultProps} />);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("focus-visible:outline-none");
      expect(link).toHaveClass("focus-visible:ring-2");
    });

    it("has hover styles", () => {
      render(<NavItem {...defaultProps} />);

      const link = screen.getByRole("link");
      expect(link).toHaveClass("hover:bg-accent");
    });
  });
});

