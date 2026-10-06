import { defineConfig } from "vitest/config";

// Unit tests live in tests/ only. Playwright E2E specs (e2e/**/*.spec.ts) share
// vite/vitest's default *.spec.* glob but are run by Playwright, not vitest, so
// they must be excluded here or `vitest run` tries to execute them (and fails).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**"],
  },
});
