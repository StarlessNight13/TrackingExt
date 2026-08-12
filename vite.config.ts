import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/dist/**",
      "apps/web/.tanstack/**",
      "apps/web/src/routeTree.gen.ts",
      "apps/server/dist/**",
      "packages/db/dist/**",
      "packages/db/local.db*",
      "apps/extension/.output/**",
      "apps/extension/.wxt/**",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/dist/**",
      "apps/web/.tanstack/**",
      "apps/web/src/routeTree.gen.ts",
      "apps/server/dist/**",
      "packages/db/dist/**",
      "packages/db/local.db*",
      "apps/extension/.output/**",
      "apps/extension/.wxt/**",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "apps/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/coverage/**",
    ],
    environment: "node",
    globals: false,
    passWithNoTests: false,
    // SQLite file DB is shared across suites; avoid parallel writers.
    fileParallelism: false,
  },
});
