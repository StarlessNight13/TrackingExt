# Cloud database Phase 0 spike

The background worker uses `@libsql/client/web` (HTTP transport) and recreates the client during the probe. It verifies connectivity, DDL, an atomic write batch, revision-guarded updates, and a read from the recreated client. The database token is accepted only in the runtime message and is never stored or logged.

Load a development build, open an extension page's developer console, and run:

```js
await browser.runtime.sendMessage({
  type: "RUN_CLOUD_DB_SPIKE",
  url: "https://your-database.turso.io",
  authToken: "your-database-scoped-token",
});
```

The probe creates the reusable `__trackingext_phase0_probe` table and removes its temporary row. A successful response includes total latency and query count. Run it in Chromium and Firefox against the same test database, then record results below.

| Browser      |                         Build size |                     Duration | Queries | Result       |
| ------------ | ---------------------------------: | ---------------------------: | ------: | ------------ |
| Chromium MV3 | 643.28 kB total / 123.01 kB worker | pending live credential test |       8 | build passed |
| Firefox MV2  | 603.93 kB total / 122.97 kB worker | pending live credential test |       8 | build passed |

Firefox declares URLs/domains as optional `browsingActivity`, page titles as optional `websiteContent`, and browser/device metadata as optional `technicalAndInteraction`. Local mode requires no data transmission; cloud onboarding must request these permissions and obtain explicit consent before Phase 3 enables transmission.
