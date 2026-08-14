import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: ["node_modules/**", "**/node_modules/**", ".output/**", ".wxt/**"],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: ["node_modules/**", "**/node_modules/**", ".output/**", ".wxt/**"],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.output/**", "**/.wxt/**", "**/coverage/**"],
    environment: "node",
    globals: false,
    passWithNoTests: false,
    // SQLite file DB is shared across suites; avoid parallel writers.
    fileParallelism: false,
  },
});
