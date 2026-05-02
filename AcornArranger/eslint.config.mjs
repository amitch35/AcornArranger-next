import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bridge legacy eslintrc configs (eslint-config-next 15.x ships them) into
// ESLint 9 flat config. Once eslint-config-next exposes flat config natively,
// this can be replaced with direct imports.
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow underscore-prefixed args/vars to signal "intentionally unused".
      // This is the standard TypeScript/ESLint convention.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Test files legitimately need `any` for mocking Supabase query chains
    // and other dynamic test scaffolding. Keep production code strict.
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/test-utils.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
