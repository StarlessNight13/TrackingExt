# Plan: Extension-Only TrackingExt with Direct Cloud Database Sync

**Status:** Accepted direction; ready for implementation spike

**Updated:** 2026-08-14

**Target:** TrackingExt becomes a self-contained browser extension. The Hono server, Better Auth, web dashboard, Docker deployment, and monorepo structure are removed after migration tooling and extension UI parity are complete.

---

## 1. Decision summary

TrackingExt will become an **extension-only product** with three capabilities:

1. **Local** — works without an account, server, or database.
2. **Cloud database** — synchronizes through a user-owned Turso/libSQL database.
3. **LAN** — optional direct device-to-device transport, preserved where it adds offline or low-latency value.

The cloud database is the authoritative shared store. The extension keeps a local cache and durable mutation outbox so it remains usable while the browser is offline or the database is unavailable.

The current server and dashboard are migration scaffolding, not part of the target architecture. We will not invest in a permanent hybrid architecture or extract a shared package solely to keep the old server alive.

### Settled decisions

| Decision | Choice |
|---|---|
| Product architecture | Extension-only |
| Remote provider for v1 | Turso through libSQL HTTP |
| Self-hosted database support | Compatible libSQL HTTP endpoints after Turso is proven |
| Remote source of truth | Cloud database |
| Offline behavior | IndexedDB cache plus durable outbox |
| Database schema | Slim workspace schema; no Better Auth tables or synthetic user |
| Conflict handling | Atomic conditional writes plus row revisions |
| Secrets | Database-scoped token; persistent or session-only storage option |
| Dashboard | Fully contained in the extension |
| Server and web removal | After export/import and extension UI parity |
| Repository shape | Flatten to one WXT project after old apps are removed |
| Cloud-based LAN signaling | Deferred; not required for v1 |

---

## 2. Goals and non-goals

### Goals

- Track and manage activities entirely inside the extension.
- Synchronize between Firefox and Chromium without deploying an application server.
- Let a user connect with a database URL, database-scoped token, and device name.
- Continue reading cached data and accepting mutations while offline.
- Preserve ownership/takeover behavior without race conditions.
- Provide a supported migration path for existing server users.
- Reduce the repository to one product and one build after the transition.

### Non-goals for v1

- Multi-user accounts in one database.
- A raw local `.sqlite` file selected from the browser.
- Cloudflare D1 support. D1 is not a drop-in libSQL endpoint and normally requires a Worker or administrative API credential.
- Real-time push notifications from the database. Sync is event-driven locally and best-effort polling remotely.
- End-to-end encryption of database contents. This remains a possible privacy enhancement.
- Cloud database signaling for WebRTC pairing.
- Automatic creation of Turso accounts or databases using an organization/platform API token.

---

## 3. Architecture

### Current

```text
Extension -> oRPC -> Hono/Better Auth -> Drizzle -> SQLite/Turso
Web dashboard -> oRPC -> Hono/Better Auth -> Drizzle -> SQLite/Turso
```

### Target

```text
┌──────────────── Browser extension ────────────────┐
│                                                   │
│  Popup / dashboard / background events            │
│                    │                              │
│                    ▼                              │
│              Domain services                      │
│                    │                              │
│          ┌─────────┴─────────┐                    │
│          ▼                   ▼                    │
│  IndexedDB cache       Mutation outbox             │
│          │                   │                    │
│          └─────────┬─────────┘                    │
│                    ▼                              │
│             Cloud sync engine                     │
│                    │                              │
│       optional LAN transport remains separate     │
└────────────────────┼──────────────────────────────┘
                     │ libSQL over HTTPS
                     ▼
              User-owned Turso DB
```

### Important terminology

- **Cloud database:** authoritative shared state across devices.
- **Cache:** local queryable copy used for responsive UI and offline reads.
- **Outbox:** durable ordered mutations waiting to be applied remotely.
- **Sync:** push pending mutations, then pull newer remote revisions.
- **LAN:** an optional transport, not another source of truth.

Avoid representing these as four independent booleans. Prefer explicit configuration:

```typescript
type StorageMode = "local" | "cloud";

type SyncConfiguration = {
  storageMode: StorageMode;
  lanEnabled: boolean;
};
```

This prevents unsupported combinations and dual-writer ambiguity.

---

## 4. Runtime boundaries

### Domain services

Move the useful business logic from `packages/api` into extension-owned runtime-agnostic modules:

```text
src/core/
  tracked-tabs.ts
  devices.ts
  groups.ts
  settings.ts
  history.ts
  privacy.ts
  conflicts.ts
  ids.ts
  validation.ts
```

These modules must not depend on Hono, oRPC, Better Auth, browser UI components, or global server environment variables.

Do not first refactor the old server into a permanent `sync-core` consumer. Port the behavior and tests directly into the new core, using the server implementation as a behavioral reference until cutover.

### Browser database client

The spike should use browser-safe imports:

```typescript
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
```

Use HTTP rather than relying on a long-lived WebSocket. Manifest V3 service workers are suspended and restarted, so every operation must tolerate client recreation.

### Local persistence

Use **IndexedDB** for:

- cached tabs, history, groups, devices, and settings;
- the mutation outbox;
- sync cursors and tombstones;
- bounded diagnostic records.

Use `browser.storage.local` only for small extension configuration:

- database URL;
- optional persisted database token;
- device identity;
- onboarding and UI preferences.

Use `browser.storage.session` for the optional session-only token mode.

The cache is bounded and compacted. Do not keep an unbounded tab/history cache in `browser.storage.local`.

---

## 5. Cloud database schema

The extension-only schema must not include `user`, `session`, `account`, or `verification`.

### Core tables

```text
workspace
device
group
tracked_tab
tracked_tab_history
workspace_settings
schema_migration
mutation_receipt
```

### Required design properties

- A database contains one logical workspace for v1.
- The workspace row has a stable ID and creation timestamp.
- User-owned rows carry `workspace_id` for grouping and future import/profile support.
- Mutable shared rows carry an integer `revision`.
- Deletions that must propagate use `deleted_at` tombstones.
- Every outbox mutation has a globally unique `operation_id`.
- `mutation_receipt.operation_id` is unique, making retries idempotent.
- Foreign keys and indexes are declared explicitly.
- Timestamps are stored consistently as UTC milliseconds.

### Suggested shared columns

```sql
revision    INTEGER NOT NULL DEFAULT 1,
created_at  INTEGER NOT NULL,
updated_at  INTEGER NOT NULL,
deleted_at  INTEGER
```

History rows are append-only and use deterministic IDs derived from the operation ID where practical. This prevents a retried location update from creating duplicate history.

### Workspace bootstrap

On connection:

1. Validate the URL scheme and require HTTPS for non-local endpoints.
2. Execute a harmless connectivity query.
3. Read the migration table.
4. Apply any compatible pending migrations transactionally.
5. Create or load the singleton workspace.
6. Register or touch the local device.
7. Perform an initial push/pull sync.

If bootstrap fails, retain the previous configuration and local data. Never partially switch the active workspace.

---

## 6. Migrations and compatibility

Do not embed a `drizzle-kit push` equivalent in the extension. Ship ordered immutable SQL migrations:

```text
src/db/migrations/
  0001_initial.sql
  0002_add_revision.sql
  manifest.ts
```

Each migration record includes:

- numeric version;
- name;
- checksum;
- applied timestamp;
- minimum compatible extension version when necessary.

Migration rules:

- Apply migrations inside a transaction or atomic batch.
- Make initialization safe when two devices connect at the same time.
- Prefer additive schema changes.
- Support at least the current and previous released extension versions when possible.
- Refuse writes with a clear message when the schema is newer than the client can safely write.
- Do not silently downgrade or rewrite unknown schema versions.

The Phase 0 spike must verify which transaction and DDL guarantees are available through the chosen Turso/libSQL HTTP client.

---

## 7. Sync and conflict model

### Mutation flow

1. Validate the user action locally.
2. Write the optimistic result and outbox operation to IndexedDB atomically.
3. Update the UI immediately.
4. Attempt to push the operation.
5. Record the remote revision on success.
6. Pull changes newer than the local cursor.
7. Resolve or surface conflicts.

### Outbox operation

```typescript
type OutboxOperation = {
  operationId: string;
  entityType: "tab" | "history" | "group" | "device" | "settings";
  entityId: string;
  kind: string;
  baseRevision: number | null;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};
```

Every mutation type must be retryable. Location changes may be coalesced per tracked tab, but creates, deletes, ownership changes, and group changes must retain their required ordering.

### Atomic ownership

Ownership checks and writes must be one conditional database operation. Never read ownership and later update only by row ID.

Example shape:

```sql
UPDATE tracked_tab
SET current_url = ?,
    current_title = ?,
    last_updated_device_id = ?,
    updated_at = ?,
    revision = revision + 1
WHERE id = ?
  AND workspace_id = ?
  AND deleted_at IS NULL
  AND (active_device_id IS NULL OR active_device_id = ?)
  AND revision = ?;
```

Zero affected rows means stale revision, deleted/archived activity, or ownership conflict. Pull the current row and return a typed conflict rather than overwriting it.

Tab update, history insertion, device touch, and mutation receipt should commit atomically.

### Pull behavior

Pull on:

- extension startup;
- popup/dashboard open;
- successful local mutation;
- browser alarm;
- network reconnection where detectable;
- an explicit Refresh action.

Browser alarms are best effort, so the UI must not promise real-time synchronization. Set and test a target such as “normally visible on another active device within two minutes.”

### Conflict policy

| Operation | Policy |
|---|---|
| Location update | Active owner wins; reject stale/non-owner write |
| Takeover | Explicit user action wins and increments revision |
| Rename/emoji/tags | Optimistic revision check; show conflict if both changed |
| Settings | Field-aware merge where safe; otherwise latest confirmed revision |
| Delete | Tombstone wins over stale updates |
| History | Append-only, idempotent by operation ID |

---

## 8. Credentials and security

### Trust model

- One database per person/workspace.
- The database token is the credential.
- Client-side validation protects users from mistakes, not from a malicious holder of the token.
- Anyone with the runtime token can perform every action granted to that token directly against the database.

### Token requirements

- Accept only a database-scoped token, never a Turso organization/platform token.
- Never include the token in URLs, logs, exported diagnostics, error reporting, or analytics.
- Provide a visible Disconnect and Forget token action.
- Document token rotation and recovery.
- Offer persistent and session-only token storage.
- Restrict extension storage access to trusted extension contexts where the browser supports it.

### Easy and hardened setup

**Easy setup:** a database-scoped full-access token allows the extension to initialize and migrate the database.

**Hardened setup:** the user applies schema migrations separately and supplies a token restricted to required tables/actions. This is optional because it adds setup friction.

Do not promise OS keychain integration while the product remains a pure extension; that requires native messaging or another external component.

### Transport and endpoint validation

- Require HTTPS except for explicitly recognized local development endpoints.
- Treat self-hosted endpoint compatibility as tested capability, not an assumption.
- Never send tracked data to any host other than the configured database endpoint and an explicitly paired LAN peer.

---

## 9. Browser permissions and store compliance

Direct database access is part of Phase 0 because it affects store declarations and onboarding.

### Firefox

The extension transmits URLs, page titles, device information, and settings to the user-selected database. The existing `required: ["none"]` declaration must be replaced with accurate Firefox data collection/transmission categories.

At minimum, evaluate and declare:

- `browsingActivity` for tracked URLs/domains;
- `websiteContent` if page titles or other visible content qualify;
- `technicalAndInteraction` for transmitted browser/device information, following Firefox's optional-only requirements for this category.

Background synchronization requires an explicit, compliant consent experience and matching store-listing/privacy disclosures.

### Chromium and Firefox host access

The current extension already requests broad host access for tab tracking. The spike must still verify:

- fetches from extension service workers to Turso;
- behavior of user-provided self-hosted origins;
- CORS and TLS failures;
- whether optional host permissions can reduce future scope without breaking tracking.

### Store review artifacts

- Plain-language privacy disclosure.
- Exact list of transmitted fields and destination.
- Explanation that the destination is selected and controlled by the user.
- Token-storage disclosure.
- Reproducible source archive with all database client dependencies bundled locally.
- No remotely loaded executable code.

---

## 10. Extension UI scope

The local extension dashboard becomes the only management UI.

### Required before server removal

- Active, archived, and deleted activity handling.
- Search, rename, archive, restore, delete, and bulk actions.
- History viewing and clearing.
- Groups: create, rename, delete, and assign activities.
- Devices: list, rename, last seen, and remove.
- Privacy and history-retention settings.
- Database connection, health, last sync, retry, disconnect, and token rotation guidance.
- Conflict display and resolution.
- Export and import.
- Local-only mode that remains useful when cloud transmission is declined.

### Onboarding

```text
Choose Local or Cloud
  -> Cloud data-transmission disclosure and consent
  -> Database URL and token
  -> Test connection and inspect schema
  -> Device name
  -> Initial sync
  -> Done
```

Do not claim a fixed “under five minutes” setup target until tested with users who do not already have Turso or its CLI.

---

## 11. Existing-user migration

Migration must ship before the server and web dashboard are deleted.

### Server to cloud database

1. Export the authenticated user's tabs, history, groups, devices as appropriate, and settings from the existing server.
2. Validate and version the export format.
3. Connect and bootstrap the new cloud database.
4. Import with stable IDs where safe and deterministic remapping where required.
5. Verify record counts and checksums.
6. Switch the extension only after successful verification.
7. Keep the export file as the rollback artifact.

Passwords, sessions, accounts, and authentication tables are not migrated.

### Local-only data

When enabling cloud mode, import local activities through the same outbox rather than using a separate promotion path. Show duplicates and conflicts before destructive cleanup.

### Rollback

Before cutover, preserve:

- a tagged final server/dashboard release;
- documented export instructions;
- the versioned export schema;
- a time-limited maintenance window for migration bugs.

---

## 12. LAN scope

Preserve working local WebRTC behavior during the cloud migration, but keep it separate from the cloud database sync engine.

For v1:

- local LAN pairing remains available;
- cloud database sync does not depend on LAN;
- LAN does not become a second authoritative state store;
- database-polling-based WebRTC signaling is deferred.

Revisit cloud-assisted LAN only if it provides a demonstrated benefit such as faster large-history transfer or useful offline behavior.

---

## 13. Repository transition

Do not flatten the repository at the start. Keeping the existing apps temporarily makes migration and regression comparison safer.

### During migration

```text
apps/extension   # new implementation lands here
apps/server      # frozen except export/migration support
apps/web         # frozen except export/migration support
packages/api     # behavioral reference until parity
packages/db      # old schema reference
```

### Remove after cutover

- `apps/server`
- `apps/web`
- `packages/api`
- `packages/auth`
- server/web environment packages
- Dockerfiles, Compose, nginx, and self-hosted application documentation
- Hono, oRPC, Better Auth, and server-only database dependencies

### Final single-project layout

```text
src/
  entrypoints/
  components/
  core/
  db/
    migrations/
  sync/
  storage/
  lan/
tests/
public/
wxt.config.ts
package.json
tsconfig.json
README.md
```

Inline remaining config, schema, and UI code after they have one consumer. Preserve Git history through normal moves rather than combining structural changes with behavioral rewrites.

---

## 14. Implementation phases

### Phase 0 — Feasibility and compliance spike

- [ ] Connect from Chromium MV3 background worker using `@libsql/client/web`.
- [ ] Connect from Firefox background context.
- [ ] Test SELECT, transactional batch, conditional UPDATE, and DDL.
- [ ] Test service-worker suspension and client recreation.
- [ ] Verify Turso CORS and TLS behavior.
- [ ] Measure Chromium and Firefox bundle size.
- [ ] Measure query count, latency, and expected free-tier usage.
- [ ] Confirm Firefox data declarations and consent UX.
- [ ] Decide whether Drizzle remains worth its bundle cost versus a small typed SQL layer.

**Exit:** two extension builds can read and atomically update a test row, and the privacy/store path is understood.

### Phase 1 — New schema and domain core

- [ ] Create slim workspace schema and ordered migrations.
- [ ] Add revisions, tombstones, and mutation receipts.
- [ ] Port IDs, validation, privacy, serialization, settings, history, devices, groups, and tracked-tab behavior.
- [ ] Replace read-then-write ownership logic with atomic conditional operations.
- [ ] Port relevant API tests to domain/database integration tests.
- [ ] Test simultaneous migration/bootstrap attempts.

**Exit:** all core behavior passes against a clean and migrated libSQL database without Hono, oRPC, or Better Auth.

### Phase 2 — Local-first storage and cloud sync

- [ ] Add IndexedDB cache and outbox.
- [ ] Define versioned outbox operation schemas.
- [ ] Implement optimistic local mutations.
- [ ] Implement idempotent push, incremental pull, retries, and backoff.
- [ ] Implement ownership and revision conflict results.
- [ ] Add sync triggers for startup, UI open, mutation, alarm, reconnect, and manual refresh.
- [ ] Bound and compact cache, tombstones, receipts, and diagnostics.
- [ ] Test offline create/edit/delete/takeover sequences.

**Exit:** two browsers synchronize all supported mutations, survive offline use, and recover from repeated interruption without duplicates or silent overwrites.

### Phase 3 — Extension UI parity and migration

- [ ] Finish activities, history, groups, devices, and settings dashboard views.
- [ ] Add database setup, health, consent, disconnect, and credential modes.
- [ ] Add conflict and retry UI.
- [ ] Add versioned export/import.
- [ ] Add Server -> Cloud DB export and verified import.
- [ ] Update Chromium/Firefox privacy declarations and store copy.
- [ ] Run migration QA with realistic existing datasets.

**Exit:** a user can install, operate, troubleshoot, export, import, and migrate without opening the old web dashboard for daily use.

### Phase 4 — Product cutover

- [ ] Make extension-only architecture the default.
- [ ] Publish migration instructions and final server release.
- [ ] Remove server sync and authentication code from the extension.
- [ ] Remove old server, web, auth, and API code after the maintenance window.
- [ ] Remove unused dependencies and infrastructure files.
- [ ] Update README, store listings, architecture docs, and release notes.

**Exit:** production builds contain no dependency on a TrackingExt application server.

### Phase 5 — Flatten the repository

- [ ] Move `apps/extension` to the repository root.
- [ ] Inline remaining single-consumer packages.
- [ ] Simplify scripts to one WXT application.
- [ ] Verify clean install, typecheck, tests, builds, source archive, and store zips.
- [ ] Remove obsolete workspace configuration.

**Exit:** TrackingExt is a clean single-project extension repository.

---

## 15. Testing strategy

### Unit tests

- Validation and privacy rules.
- Outbox ordering and coalescing.
- Conflict classification.
- Serialization and versioned import/export.
- Cache compaction and retention.

### Database integration tests

- Fresh bootstrap and every migration path.
- Concurrent bootstrap/migration.
- Conditional ownership updates.
- Revision conflicts.
- Transaction rollback.
- Idempotent mutation replay.
- Tombstone propagation.
- History retention.

### Browser integration and manual QA

| Scenario | Expected result |
|---|---|
| Fresh Turso database | Extension initializes and registers device |
| Two active browsers | Mutations synchronize within documented latency |
| Old owner writes after takeover | Atomic conflict; no overwrite |
| Offline create/rename/delete | Ordered replay without duplication |
| Worker suspended mid-sync | Safe retry after restart |
| Token revoked/expired | Cached UI works; actionable credential error |
| Schema newer than extension | Reads/writes blocked according to compatibility rules |
| Simultaneous first connection | One valid schema/workspace |
| Firefox consent declined | Local-only mode remains usable |
| Extension update | Previous client remains compatible where promised |
| Import interrupted | Safe retry or rollback, with original export preserved |

Run Chromium and Firefox tests separately. Include Firefox Android only for features currently supported there.

---

## 16. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Browser client or Drizzle bundle is unsuitable | High | Phase 0 spike; fall back to small typed SQL-over-HTTP layer |
| Persisted token is stolen from browser profile | High | Clear disclosure, database-scoped token, session-only option, rotation guidance |
| Direct clients race on ownership | High | Atomic conditional SQL, transactions, revisions |
| Offline replay duplicates or resurrects data | High | Operation IDs, receipts, tombstones, ordering tests |
| Staggered extension updates break schema | High | Immutable migrations and explicit reader/writer compatibility |
| Firefox store rejection | High | Treat declarations and consent as Phase 0 work |
| Turso-specific behavior blocks self-hosted libSQL | Medium | Turso-first support; provider compatibility suite before claims |
| Polling feels slow or uses excessive quota | Medium | Event-driven sync, bounded alarm polling, measure query volume |
| Migration loses existing data | High | Versioned export, verification, rollback artifact, maintenance window |
| Repo flatten obscures functional regressions | Medium | Flatten only after cutover and in a separate phase |

---

## 17. Release success criteria

- No TrackingExt server or web dashboard is required for any supported workflow.
- Local-only mode works without accepting cloud transmission.
- Cloud setup uses only a database URL and database-scoped credential.
- All supported mutations survive offline use and idempotent replay.
- Ownership races cannot silently overwrite a newer owner.
- Firefox and Chromium declarations accurately describe transmitted data.
- Existing server users have a tested export/import path.
- Extension bundle size, polling volume, and sync latency are measured and documented.
- Final repository builds and packages from a clean install as one WXT project.

---

## 18. Immediate next action

Implement only the Phase 0 spike first. Do not begin repository flattening, delete the old apps, or commit to Drizzle in the browser until the spike proves:

1. browser runtime compatibility;
2. transactional and conditional-write behavior;
3. acceptable bundle size and query cost;
4. a viable Firefox consent/store path.

Once those four points pass, Phase 1 can begin with the extension-only schema and domain core.
