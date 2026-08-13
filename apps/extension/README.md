# TrackingExt extension

Cross-browser extension (Firefox + Chromium) for **tracked tabs**: persistent activities that keep their identity as the URL changes, and sync across devices through the TrackingExt backend.

## Develop

1. Start the API (from repo root):

```bash
bun run db:push
bun run dev:server
```

2. Run the extension:

```bash
# Chromium
bun run --filter extension dev

# Firefox
bun run --filter extension dev:firefox
```

Set `VITE_SERVER_URL` if the API is not at `http://localhost:3000`.

## AMO source submission and reproducible build

This extension is built from the repository root with **Bun 1.3.6** (declared in
the root `package.json`). The source archive submitted to AMO contains this
extension plus the workspace packages it imports.

```bash
# From the repository root
bun install --frozen-lockfile
bun run --filter trackingext-extension build:firefox
bun run --filter trackingext-extension build:firefox-android
```

The resulting Firefox desktop package is in
`apps/extension/.output/firefox-mv2/`; the Firefox Android package is in
`apps/extension/.output/firefox-android-mv2/`. No runtime environment variables
are required to reproduce either extension build. `VITE_SERVER_URL` is optional
and only sets the preconfigured server address shown to users.

## Behavior

- **Track this tab** from the popup or the page/tab right-click menu.
- Popup shows current page state, optional custom name, and other tracked tabs with device labels.
- URL/title updates on that tab sync only while this device owns the activity (**Take over** claims ownership).
- Closing a tab releases local binding; the tracked activity remains available on other devices.
- After browser restart, unique URL matches are reattached; ambiguous matches ask you to reconnect.
- Privacy controls: history on/off, strip query/hash, excluded hosts, always-stripped auth params.
