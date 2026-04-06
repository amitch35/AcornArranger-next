"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ThemeSwitcherProps = {
  /** Merged onto the trigger button (e.g. footer on dark brand background). */
  className?: string;
};

const ThemeSwitcher = ({ className }: ThemeSwitcherProps = {}) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const ICON_SIZE = 16;
  const resolved = theme ?? "system";
  const trigger =
    resolved === "light" ? (
      <>
        <Sun
          size={ICON_SIZE}
          className="shrink-0 opacity-90"
          aria-hidden
        />
        <span>Light</span>
      </>
    ) : resolved === "dark" ? (
      <>
        <Moon
          size={ICON_SIZE}
          className="shrink-0 opacity-90"
          aria-hidden
        />
        <span>Dark</span>
      </>
    ) : (
      <>
        <Laptop
          size={ICON_SIZE}
          className="shrink-0 opacity-90"
          aria-hidden
        />
        <span>System</span>
      </>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 font-normal text-foreground [&_svg]:text-current",
            className,
          )}
          aria-label={`Theme: ${resolved}. Change theme`}
        >
          {trigger}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="start">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(e) => setTheme(e)}
        >
          <DropdownMenuRadioItem className="flex gap-2" value="light">
            <Sun size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex gap-2" value="dark">
            <Moon size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex gap-2" value="system">
            <Laptop size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };
