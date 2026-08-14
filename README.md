# TrackingExt

TrackingExt is a browser extension for persistent tracked activities. A tracked tab keeps one identity while its URL changes, so another browser can resume the latest location without syncing every open tab.

## Storage modes

- **Local** works entirely inside the browser.
- **Cloud database** synchronizes through a user-owned Turso, self-hosted libSQL HTTP database, or Cloudflare D1 Worker. The extension keeps an IndexedDB cache and durable mutation outbox for offline use.
- **LAN** optionally synchronizes paired nearby extensions over WebRTC and remains separate from cloud storage.

No TrackingExt application server or web dashboard is required for normal use. The local extension dashboard manages activities, history, groups, devices, privacy, database health, conflicts, and export/import.

## Cloud setup

Create a libSQL database and database-scoped token, then open extension Settings → Cloud database. A self-hosted libSQL HTTP server uses the same option. The extension tests the connection, applies its ordered schema migrations, registers the browser, and performs an initial sync. HTTPS is required except for localhost development endpoints.

For Cloudflare D1, deploy the small Worker in [`cloudflare-d1`](./cloudflare-d1), bind it to a D1 database, and enter the Worker URL and its access token in the extension. The Worker keeps the Cloudflare account token out of the extension.

Tokens can be stored for the browser profile or only for the current browser session. Disconnecting forgets the token without deleting cached or remote data.

## Development

```bash
bun install
bun run dev
bun run dev:firefox
bun run check-types
bun test
```

Production builds:

```bash
bun run build
bun run build:firefox
bun run zip
bun run zip:firefox
```

This repository is a single WXT extension project.

## Privacy

Tracking is explicit. Only marked activities are stored. Cloud mode sends tracked URLs, page titles, device information, and chosen settings to the database endpoint configured by the user. See [PRIVACY.md](./PRIVACY.md).
