import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Repo has a root lockfile (e.g. task-master-ai) plus AcornArranger/package-lock.json.
// Without this, Turbopack infers the parent folder as root and SSR chunk paths break
// (Cannot find module '.../chunks/ssr/[turbopack]_runtime.js').
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
  // Lint runs as its own CI gate via `npm run lint`; we do not want
  // accumulated `any` / `no-unescaped-entities` issues in tests and legacy
  // components to block production builds on the VPS. TODO: remove this once we have a proper ESLint config or tests are fixed.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
