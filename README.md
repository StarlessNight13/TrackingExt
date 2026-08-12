# TrackingExt

TrackingExt is a self-hosted cross-browser tab continuity system.

It lets a user explicitly mark a browser tab as a **tracked activity** instead of just saving a URL. Once tracked, that tab keeps the same identity as the user navigates inside it, and its latest location syncs to the user account so it can be reopened from another browser or device.

Example:

`Chapter 10 -> Chapter 11 -> Chapter 12 -> Chapter 13`

TrackingExt treats that as one logical activity, not four unrelated pages.

## What it does

TrackingExt is built around **persistent tracked tabs**:

- A user chooses **Track this tab** in the extension popup or context menu.
- That tab becomes a tracked item with its own identity.
- As the page URL or title changes, the tracked item updates instead of creating a new item.
- The latest location syncs to the backend and appears in the dashboard and other signed-in extension installs.
- Another device can open the activity and optionally **take over** ownership so only one device actively updates it.

This is different from syncing every open browser tab. Tracking is always explicit.

## Main features

- **Cross-browser extension support** for Chromium-based browsers and Firefox
- **Cross-device continuation** across multiple browsers and machines on the same account
- **Tracked-tab history** per activity, separate from normal browser history
- **Ownership / take over** flow to prevent two devices fighting over the same tracked activity
- **Reconnect after restart** when a restored browser tab can be matched back to a tracked activity
- **Privacy controls** for:
  - enabling/disabling tracked-tab history
  - stripping URL query parameters
  - stripping URL fragments
  - excluding sites from tracking
- **Self-hosted endpoint setup** in the extension popup
- **Dashboard management** for tracked tabs, devices, privacy settings, sessions, and extension install links

## Project layout

TrackingExt is a monorepo with three main app surfaces:

- `apps/server`  
  Hono + oRPC backend for auth, tracked tabs, device registration, history, and settings.

- `apps/web`  
  Browser dashboard for signing in, viewing tracked activities, managing devices/sessions, and extension setup.

- `apps/extension`  
  WXT browser extension for Firefox and Chromium that tracks tabs and syncs them to the backend.

Supporting packages live in `packages/*`:

- `packages/api` - shared API contracts and routers
- `packages/auth` - Better Auth setup
- `packages/db` - schema and database access
- `packages/env` - typed environment handling
- `packages/ui` - shared UI primitives

## How the system works

### Extension

The extension is where tracking starts.

- The popup shows the current page and whether it is tracked.
- Users can track, stop tracking, rename, view history, and take over activities.
- A context-menu action adds **Track this tab** from the right-click menu.
- Tracked tabs get a visible marker in the tab title.
- The extension syncs only tracked tabs, never general browsing activity.

### Dashboard

The dashboard is the management UI.

- View all tracked activities and their latest URLs
- Open the latest location from another device
- See which device updated an activity most recently
- Manage privacy settings
- Rename devices
- Revoke sessions
- Show install cards for Chromium and Firefox with store/download links

### Backend

The backend stores:

- users and sessions
- registered devices
- tracked tabs
- tracked-tab history
- user privacy settings

## Development

Install dependencies:

```bash
bun install
```

Apply the database schema:

```bash
bun run db:push
```

Start the web dashboard and backend:

```bash
bun run dev:server
bun run dev:web
```

Default local URLs:

- dashboard: [http://localhost:3001](http://localhost:3001)
- API/auth server: [http://localhost:3000](http://localhost:3000)

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

On first run, the extension asks for the TrackingExt server URL. After that, sign in with the same account used in the dashboard.

If your backend is on another machine, point the extension at that reachable server origin.

See `apps/extension/README.md` for extension-specific behavior.

## Self-hosting

TrackingExt is intended to be self-hosted.

For a production-style local stack:

```bash
bun run docker:build
bun run docker:up
```

Useful Docker commands:

- `bun run docker:logs`
- `bun run docker:down`

The dashboard supports env-configured browser store links and download URLs for extension packages.

## Testing and checks

- `bun run test` - run the root test suite
- `bun run build` - build all apps
- `bun run check-types` - workspace type checks
- `bun run lint` - lint checks
- `bun run format` - formatting

## Available scripts

- `bun run dev` - start all app dev scripts
- `bun run dev:web` - dashboard only
- `bun run dev:server` - backend only
- `bun run dev:extension` - Chromium extension dev
- `bun run dev:extension:firefox` - Firefox extension dev
- `bun run db:push` - push schema changes
- `bun run db:generate` - generate DB artifacts
- `bun run db:migrate` - run DB migrations
- `bun run db:studio` - open DB studio
- `bun run docker:build` - build Docker images
- `bun run docker:up` - start Docker stack
- `bun run docker:logs` - tail Docker logs
- `bun run docker:down` - stop Docker stack

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
