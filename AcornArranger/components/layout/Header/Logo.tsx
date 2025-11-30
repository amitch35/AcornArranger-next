"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Logo component - displays app branding and links to dashboard
 * 
 * Uses Next.js Link for client-side navigation and Image for optimized logo
 */
export function Logo() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80 transition-colors shrink-0"
      aria-label="Go to dashboard"
    >
      <Image
        src="/icon.png"
        alt="AcornArranger"
        width={36}
        height={36}
        className="h-9 w-9"
      />
      <span className="hidden sm:inline">AcornArranger</span>
    </Link>
  );
}

