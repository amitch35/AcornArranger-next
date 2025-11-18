import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ProtectedLayout,
  PageContent,
  useProtectedLayout,
} from "../ProtectedLayout";

describe("ProtectedLayout", () => {
  describe("Component Rendering", () => {
    it("renders children in main content area", () => {
      render(
        <ProtectedLayout>
          <div>Main content</div>
        </ProtectedLayout>
      );

      expect(screen.getByRole("main")).toHaveTextContent("Main content");
    });

    it("renders header slot when provided", () => {
      render(
        <ProtectedLayout header={<div>Test Header</div>}>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(screen.getByText("Test Header")).toBeInTheDocument();
    });

    it("renders sidebar slot when provided", () => {
      render(
        <ProtectedLayout sidebar={<nav>Test Sidebar</nav>}>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(screen.getByText("Test Sidebar")).toBeInTheDocument();
    });

    it("renders title slot when provided", () => {
      render(
        <ProtectedLayout title={<h1>Page Title</h1>}>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(screen.getByText("Page Title")).toBeInTheDocument();
    });

    it("renders action slots when provided", () => {
      render(
        <ProtectedLayout
          primaryActions={<button>Primary</button>}
          secondaryActions={<button>Secondary</button>}
        >
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(screen.getByText("Primary")).toBeInTheDocument();
      expect(screen.getByText("Secondary")).toBeInTheDocument();
    });

    it("renders filters slot when provided", () => {
      render(
        <ProtectedLayout filters={<div>Filter controls</div>}>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(screen.getByText("Filter controls")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("includes skip-to-content link", () => {
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      const skipLink = screen.getByText("Skip to content");
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("main content has id for skip link target", () => {
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("id", "main-content");
    });

    it("main content has role=main", () => {
      render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(screen.getByRole("main")).toBeInTheDocument();
    });
  });

  describe("Layout Structure", () => {
    it("renders portal mount points", () => {
      const { container } = render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(container.querySelector("#portal-modals")).toBeInTheDocument();
      expect(container.querySelector("#portal-toasts")).toBeInTheDocument();
    });

    it("applies protected-layout class", () => {
      const { container } = render(
        <ProtectedLayout>
          <div>Content</div>
        </ProtectedLayout>
      );

      expect(
        container.querySelector(".protected-layout")
      ).toBeInTheDocument();
    });
  });

  describe("Context and State", () => {
    it("provides layout context to children", () => {
      function TestComponent() {
        const { sidebarCollapsed, toggleSidebar } = useProtectedLayout();
        return (
          <div>
            <span>Collapsed: {String(sidebarCollapsed)}</span>
            <button onClick={toggleSidebar}>Toggle</button>
          </div>
        );
      }

      render(
        <ProtectedLayout>
          <TestComponent />
        </ProtectedLayout>
      );

      expect(screen.getByText("Collapsed: false")).toBeInTheDocument();
    });

    it("toggles sidebar state when toggle is called", () => {
      function TestComponent() {
        const { sidebarCollapsed, toggleSidebar } = useProtectedLayout();
        return (
          <div>
            <span data-testid="collapsed-state">
              {String(sidebarCollapsed)}
            </span>
            <button onClick={toggleSidebar}>Toggle</button>
          </div>
        );
      }

      render(
        <ProtectedLayout>
          <TestComponent />
        </ProtectedLayout>
      );

      expect(screen.getByTestId("collapsed-state")).toHaveTextContent("false");

      fireEvent.click(screen.getByText("Toggle"));

      expect(screen.getByTestId("collapsed-state")).toHaveTextContent("true");
    });

    it("throws error when useProtectedLayout is used outside context", () => {
      function BadComponent() {
        useProtectedLayout();
        return <div>Test</div>;
      }

      // Suppress console.error for this test
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => render(<BadComponent />)).toThrow(
        "useProtectedLayout must be used within ProtectedLayout"
      );

      spy.mockRestore();
    });
  });
});

describe("PageContent", () => {
  it("renders children", () => {
    render(
      <PageContent>
        <div>Page content</div>
      </PageContent>
    );

    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <PageContent title={<h1>Title</h1>}>
        <div>Content</div>
      </PageContent>
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <PageContent
        primaryActions={<button>Primary</button>}
        secondaryActions={<button>Secondary</button>}
      >
        <div>Content</div>
      </PageContent>
    );

    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Secondary")).toBeInTheDocument();
  });

  it("renders filters when provided", () => {
    render(
      <PageContent filters={<div>Filters</div>}>
        <div>Content</div>
      </PageContent>
    );

    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <PageContent className="custom-class">
        <div>Content</div>
      </PageContent>
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});

