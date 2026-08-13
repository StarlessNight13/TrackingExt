# TrackingExt

TrackingExt is a self-hosted cross-browser tab continuity system.

It lets a user explicitly mark a browser tab as a **tracked activity** instead of just saving a URL. Once tracked, that tab keeps the same identity as the user navigates inside it, and its latest location syncs across the modes they enable so it can be reopened from another browser or device.

Example:

`Chapter 10 -> Chapter 11 -> Chapter 12 -> Chapter 13`

TrackingExt treats that as one logical activity, not four unrelated pages.

## What it does

TrackingExt is built around **persistent tracked tabs**:

- A user chooses **Track this tab** in the extension popup or context menu.
- That tab becomes a tracked item with its own identity.
- As the page URL or title changes, the tracked item updates instead of creating a new item.
- The latest location syncs according to the enabled modes (Offline, LAN, and/or Server).
- Another device can open the activity and optionally **take over** ownership so only one device actively updates it.

This is different from syncing every open browser tab. Tracking is always explicit.

## Main features

- **Cross-browser extension support** for Chromium-based browsers and Firefox
- **Sync modes** that can be combined:
  - **Offline** — browser-local only
  - **LAN** — same-network peer sync via WebRTC pairing
  - **Server** — account sync through this self-hosted backend
- **Cross-device continuation** across browsers and machines on the same account (Server mode)
- **Tracked-tab history** per activity, separate from normal browser history
- **Ownership / take over** flow to prevent two devices fighting over the same tracked activity
- **Reconnect after restart** when a restored browser tab can be matched back to a tracked activity
- **Privacy / settings controls** for:
  - enabling/disabling tracked-tab history
  - stripping URL query parameters
  - stripping URL fragments
  - excluding sites from tracking
  - dashboard theme preferences
- **Self-hosted endpoint setup** in the extension popup
- **Dashboard** for tracked tabs, sync guidance, devices, sessions, settings, and extension install/version status

## Project layout

TrackingExt is a monorepo with three main app surfaces:

- `apps/server`  
  Hono + oRPC backend for auth, tracked tabs, device registration, history, and settings.

- `apps/web`  
  Browser dashboard for signing in, viewing tracked activities, managing devices/sessions/settings, and extension setup/downloads.

- `apps/extension`  
  WXT browser extension for Firefox and Chromium that tracks tabs and syncs them through the chosen modes.

Supporting packages live in `packages/*`:

- `packages/api` — shared API contracts and routers
- `packages/auth` — Better Auth setup
- `packages/db` — schema and database access
- `packages/env` — typed environment handling
- `packages/ui` — shared UI primitives

## How the system works

### Extension

The extension is where tracking starts.

- The popup shows the current page and whether it is tracked.
- Users can track, stop tracking, rename, view history, and take over activities.
- A context-menu action adds **Track this tab** from the right-click menu.
- Tracked tabs get a visible marker in the tab title.
- The extension syncs only tracked tabs, never general browsing activity.
- During setup (and later in extension settings), users pick Offline, LAN, and/or Server sync.

### Dashboard

The dashboard is the management UI:

- **Tracked** — activities and their latest URLs
- **Sync** — how Offline / LAN / Server modes fit together
- **Devices** — registered extension installs
- **Sessions** — account sessions
- **Extension** — Chromium/Firefox install cards, self-hosted zip downloads, and live install/version detection in the current browser
- **Settings** — privacy controls, exclusions, and dashboard theme (sidebar footer)

### Backend

The backend stores:

- users and sessions
- registered devices
- tracked tabs
- tracked-tab history
- user settings

## Development

Install dependencies:

```bash
bun install
```

Apply the database schema:

```bash
bun run db:push
```

Start the web dashboard and backend together (no extension):

```bash
bun run dev:headless
```

Or start them separately:

```bash
bun run dev:server
bun run dev:web
```

Default local URLs:

- dashboard: [http://localhost:3001](http://localhost:3001)
- API/auth server: [http://localhost:3000](http://localhost:3000)

In local/dev, the dashboard prefers **same-origin** API calls (`/api`, `/rpc`) via the Vite proxy, so opening the dashboard by host IP or Tailscale still works without pointing the browser at `localhost` on the client machine.

Leave `VITE_SERVER_URL` unset (or empty) for that same-origin behavior. Set it only when the API is on a different public origin.

## Extension development

The extension needs a real browser, so run it on a machine with a desktop session.

Chromium:

```bash
bun run dev:extension
```

Firefox:

```bash
bun run dev:extension:firefox
```

On first run, the extension asks for the TrackingExt server URL (the public dashboard/API origin). After that, sign in with the same account used in the dashboard when Server sync is enabled.

If your backend is on another machine, point the extension at that reachable origin.

See `apps/extension/README.md` for extension-specific behavior.

Packaged builds report a **channel** (`self-hosted`, `store`, or `development`) plus version to the dashboard Extension page, so users can tell a self-built zip apart from a store install and whether it matches the package this instance serves.

## Self-hosting

TrackingExt is intended to be self-hosted behind a reverse proxy (for example Dokploy + Traefik).

Recommended production shape: **one public origin** for the dashboard. The web container’s nginx serves the SPA and proxies `/api` + `/rpc` to the internal server. Browser clients never need a separate `api.*` host.

```text
Browser → https://your.domain → Traefik → web:80
                                      ↓ (compose network)
                                   server:3000
```

Useful local Docker commands:

```bash
bun run docker:build
bun run docker:up
bun run docker:logs
bun run docker:down
```

The web image also packs Chromium and Firefox extension zips and serves them from:

- `/downloads/trackingext-chromium.zip`
- `/downloads/trackingext-firefox.zip`
- `/downloads/extension-version.json`

Typical production env (same public origin for all three):

- `VITE_SERVER_URL` — public dashboard origin (baked into the web image at build time)
- `BETTER_AUTH_URL` — same public origin
- `CORS_ORIGIN` — same public origin
- `BETTER_AUTH_SECRET` — long random secret
- `DATABASE_URL` — SQLite/Turso URL used by the server
- optional: `ALLOW_SIGN_UP`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`
- optional dashboard links: `VITE_CHROME_WEB_STORE_URL`, `VITE_FIREFOX_ADDON_URL`, custom download URLs

The included `docker-compose.yml` is oriented toward Dokploy (external `dokploy-network`, no host port binds). Adjust networks/volumes for your host if you are not using that setup.

## Testing and checks

- `bun run test` — run the root test suite
- `bun run build` — build all apps
- `bun run check-types` — workspace type checks
- `bun run lint` — lint checks
- `bun run format` — formatting

## Available scripts

- `bun run dev` — start all app dev scripts
- `bun run dev:headless` — dashboard + server only (no extension)
- `bun run dev:web` — dashboard only
- `bun run dev:server` — backend only
- `bun run dev:extension` — Chromium extension dev
- `bun run dev:extension:firefox` — Firefox extension dev
- `bun run db:push` — push schema changes
- `bun run db:generate` — generate DB artifacts
- `bun run db:migrate` — run DB migrations
- `bun run db:studio` — open DB studio
- `bun run docker:build` — build Docker images
- `bun run docker:up` — start Docker stack
- `bun run docker:logs` — tail Docker logs
- `bun run docker:down` — stop Docker stack

## Tech stack

- Bun
- TypeScript
- React
- TanStack Router
- Hono
- oRPC
- Better Auth
- Drizzle
- SQLite / Turso
- WXT
- shared UI primitives in `packages/ui`
