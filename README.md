# TabTether

TabTether is a browser extension for persistent tethered activities. A tethered tab keeps one identity while its URL changes, so another browser can resume the latest location without syncing every open tab.

## Storage modes

- **Local** works entirely inside the browser.
- **Cloud database** synchronizes through a user-owned Turso, self-hosted libSQL HTTP database, or Cloudflare D1 Worker. The extension keeps an IndexedDB cache and durable mutation outbox for offline use.
- **LAN** optionally synchronizes paired nearby extensions over WebRTC and remains separate from cloud storage.

No TabTether application server or web dashboard is required for normal use. The local extension dashboard manages activities, history, groups, devices, privacy, database health, conflicts, and export/import.

## Cloud setup

Create a libSQL database and database-scoped token, then open extension Settings → Cloud database. A self-hosted libSQL HTTP server uses the same option. The extension tests the connection, applies its ordered schema migrations, registers the browser, and performs an initial sync. HTTPS is required except for localhost development endpoints.

For Cloudflare D1, deploy the small Worker in [`cloudflare-d1`](./cloudflare-d1), bind it to a D1 database, and enter the Worker URL and its access token in the extension. The Worker keeps the Cloudflare account token out of the extension.

Tokens can be stored for the browser profile or only for the current browser session. Disconnecting forgets the token without deleting cached or remote data.

Cloud database settings can export a JSON backup and restore it to the same workspace. A restore replaces that remote workspace after confirmation.

## Development

```bash
bun install
bunx playwright install chromium
bun run dev
bun run dev:firefox
bun run check-types
bun test
bun run test:e2e
```

E2E tests use Playwright against the Chromium MV3 build in `.output/chrome-mv3` (Chromium only).

Chrome Web Store screenshots (1280×800):

```bash
bun run screenshots
```

Files land in `store-assets/screenshots/`.

Production builds:

```bash
bun run build
bun run build:firefox
bun run zip
bun run zip:firefox
```

This repository is a single WXT extension project.

## AMO source review (Firefox)

The listed add-on is built with **WXT** (Vite), which bundles and minifies sources. Reviewers can reproduce the Firefox package from this source archive as follows.

**Environment**

- OS: Linux, macOS, or Windows
- [Bun](https://bun.sh) **1.3.6** (declared in `package.json` as `packageManager`)
- No runtime environment variables are required for the Firefox build

**Build steps**

```bash
bun install --frozen-lockfile
bun run build:firefox
```

**Output**

- Built files: `.output/firefox-mv2/`
- Add-on zip: `bun run zip:firefox` → `.output/tabtether-firefox.zip`
- Source zip for AMO review: `.output/tabtether-firefox-sources.zip`

The Firefox extension ID in `wxt.config.ts` is `trackingext@trackingext.local`.

## Privacy

Tethering is explicit. Only tabs the user chooses to tether are stored. Cloud mode sends tethered URLs, page titles, device information, and chosen settings to the database endpoint configured by the user. See [PRIVACY.md](./PRIVACY.md).
