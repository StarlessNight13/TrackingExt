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

## Behavior

- **Track this tab** from the popup or the page/tab right-click menu.
- Popup shows current page state, optional custom name, and other tracked tabs with device labels.
- URL/title updates on that tab sync only while this device owns the activity (**Take over** claims ownership).
- Closing a tab releases local binding; the tracked activity remains available on other devices.
- After browser restart, unique URL matches are reattached; ambiguous matches ask you to reconnect.
- Privacy controls: history on/off, strip query/hash, excluded hosts, always-stripped auth params.
