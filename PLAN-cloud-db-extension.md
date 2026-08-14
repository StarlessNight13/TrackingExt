# Plan: Self-Contained Extension with Direct Cloud Database Sync

**Status:** Draft for evaluation  
**Date:** 2026-08-14  
**Scope:** Replace (or supplement) the self-hosted Hono server + web dashboard with a sync mode where the extension talks directly to a user-provided libSQL/SQLite database (Turso, self-hosted `sqld`, etc.).

---

## 1. Executive summary

TrackingExt today requires users who want cross-device sync to deploy (or use) a **server + web dashboard**, sign in with Better Auth, and point the extension at that API origin. The backend already stores everything in **SQLite via Drizzle + libSQL**, but the extension never touches the database — it calls oRPC over HTTP with a session token.

This plan describes how to add a **Cloud DB** sync mode where:

1. The user creates a libSQL database (Turso free tier, self-hosted `sqld`, etc.).
2. The extension stores a **database URL + auth token** and runs Drizzle queries directly.
3. The **in-extension local dashboard** becomes the primary management UI.
4. The existing **Server** mode (Hono + Better Auth + web dashboard) remains available as an optional power-user / multi-account path — unless you decide to deprecate it later.

**Recommended default path:** phased hybrid — ship Cloud DB as a fourth sync destination alongside Offline, LAN, and Server; converge Server and Cloud DB internals over time; deprecate Server only after Cloud DB reaches feature parity and migration tooling exists.

---

## 2. Goals and non-goals

### Goals

| # | Goal |
|---|------|
| G1 | Users can sync tracked tabs across devices **without running a server or opening a web dashboard**. |
| G2 | Onboarding is **URL + token + device name** — no sign-up flow for Cloud DB mode. |
| G3 | Reuse existing **Drizzle schema** and business rules (ownership, history, privacy, collections). |
| G4 | Preserve **Offline** and **LAN** modes unchanged. |
| G5 | Local extension dashboard covers day-to-day management (tabs, settings, LAN pairing, devices). |
| G6 | Support **Turso** (hosted) and **self-hosted libsql-server** (`sqld`) pointing at a SQLite file. |

### Non-goals (initial release)

| # | Non-goal | Rationale |
|---|----------|-----------|
| NG1 | Raw local `.sqlite` file picker in the extension | Browsers cannot open arbitrary filesystem paths; requires remote libSQL endpoint. |
| NG2 | Multi-user accounts on a shared Cloud DB | Token = full DB access; one DB per person is the security model. |
| NG3 | Full web dashboard parity on day one | Collections bulk ops, activity export, session management can follow in phases. |
| NG4 | End-to-end encryption of DB contents | Separate initiative; would change token/trust model significantly. |
| NG5 | Replacing LAN WebRTC with DB polling | LAN stays P2P; Cloud DB is for internet-wide sync. |

---

## 3. Current architecture (baseline)

```text
┌─────────────────┐     HTTP/oRPC + Bearer      ┌──────────────────┐
│ Extension       │ ───────────────────────────►│ apps/server      │
│ (WXT, React)    │     session token           │ Hono + Better Auth│
└────────┬────────┘                             └────────┬─────────┘
         │                                               │
         │ browser.storage.local                         │ Drizzle
         │ (cache, bindings, LAN peers)                  ▼
         │                                      ┌──────────────────┐
         │ WebRTC (LAN mode)                    │ packages/db      │
         └──────────────────────────────────────│ SQLite / Turso   │
                                                └──────────────────┘

┌─────────────────┐
│ apps/web        │ ── same API + auth ──► apps/server
│ (dashboard)     │
└─────────────────┘
```

### Sync modes today

| Mode | Storage | Cross-device | Auth |
|------|---------|--------------|------|
| **Offline** | `browser.storage.local` | No | None |
| **LAN** | Local + WebRTC P2P | Same network | None (pairing token) |
| **Server** | Remote via oRPC | Anywhere | Better Auth session |

### API surface the extension uses (`packages/api`)

| Router | Procedures used by extension | Purpose |
|--------|------------------------------|---------|
| `trackedTabs` | list, create, rename, updateLocation, takeOver, release, delete, history, … | Core tab sync |
| `devices` | register, touch, list, rename, remove | Device identity |
| `settings` | get, update, purgeHistory | Privacy + theme |
| `collections` | (web dashboard primarily; extension partial) | Group activities |
| `lanSync` | createPairing, getPairing, completePairing, pollPairingAnswer, postSignal, pollSignals | Server-relay LAN signaling |

### Extension sync routing (`apps/extension/lib/sync/router.ts`)

- **Offline/LAN:** `offline-store.ts` + optional LAN broadcast.
- **Server:** `getApiClient()` → oRPC → server validates session → Drizzle.
- **Local dashboard:** `local-dashboard-view.tsx` (tabs, LAN, settings); web dashboard when `syncModes.server && authenticated`.

### Database schema (`packages/db`)

**Auth tables:** `user`, `session`, `account`, `verification` (Better Auth).

**App tables:** `device`, `collection`, `tracked_tab`, `tracked_tab_history`, `user_settings`, `lan_pairing`, `lan_signal`.

All app tables are scoped by `userId` referencing `user.id`.

---

## 4. Proposed architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Extension (background service worker)                           │
│                                                                 │
│  sync/router.ts ──► SyncBackend interface                       │
│         │                    │                                  │
│         │         ┌──────────┴──────────┐                       │
│         │         ▼                     ▼                       │
│         │   OfflineBackend      CloudDbBackend                │
│         │   (storage.local)       (Drizzle + @libsql/client)    │
│         │                             │                         │
│         └─ LAN broadcast ─────────────┼── optional: CloudDb    │
│            (WebRTC, unchanged)        │   for LAN relay tables  │
└───────────────────────────────────────┼─────────────────────────┘
                                        │
                          libsql HTTP / WebSocket
                                        ▼
                              ┌──────────────────┐
                              │ Turso / sqld / D1│
                              │ (user-owned DB)  │
                              └──────────────────┘

Optional (unchanged):
  Server mode ──► apps/server ──► same DB schema
  Web dashboard ──► apps/server
```

### New sync mode: **Cloud DB**

| Field | Description |
|-------|-------------|
| `syncModes.cloudDb` | `boolean` — enable remote DB sync |
| `databaseUrl` | libSQL URL, e.g. `libsql://my-db-user.turso.io` |
| `databaseAuthToken` | Turso/sqld auth token (stored in `browser.storage.local`) |
| `workspaceId` | Optional stable ID for this user's logical workspace (see §6) |

**Auth model:** the database token *is* the credential. One Turso database per user. Same token on every device.

**No `sessionToken`, no Better Auth, no `serverUrl`** required for Cloud DB-only users.

---

## 5. Options for you to evaluate

### Option A — Cloud DB only (aggressive)

- Remove Server mode and web dashboard from the default product.
- Extension + Turso is the entire product.
- **Pros:** Simplest story, smallest codebase long-term.
- **Cons:** Loses multi-user self-hosting, web UI, LAN server-relay; large breaking change; AMO/store narrative shifts.

### Option B — Hybrid (recommended)

- Add **Cloud DB** as a peer to Offline / LAN / Server.
- Server + web dashboard remain for self-hosters who want accounts, LAN relay without Turso, and a desktop UI.
- Shared `@trackingext/sync-core` package; server becomes a thin auth wrapper around the same queries.
- **Pros:** No forced migration; validate Cloud DB with real users; incremental work.
- **Cons:** Two remote sync paths to maintain until converged.

### Option C — Cloud DB + deprecate Server later

- Same as B for v1, with a documented deprecation timeline for Server mode once Cloud DB reaches parity.
- **Pros:** Clear end state without big-bang rewrite.
- **Cons:** Migration tooling required before deprecation.

### Option D — Minimal relay server

- Extension → Turso for data; tiny server only for LAN signaling (or use Turso `lan_*` tables).
- **Pros:** Keeps LAN server-relay without full Hono stack.
- **Cons:** Still requires *some* server for relay users; partial complexity reduction only.

**Recommendation:** **Option B** for implementation; decide on C after Phase 3 based on adoption.

---

## 6. Schema and identity model

### 6.1 Single-user Cloud DB schema

Cloud DB installs do not need multi-user auth tables. Two approaches:

#### Approach 6.1a — Synthetic user (minimal migration)

- Keep `userId` on all app tables.
- On first connect, extension ensures a row exists: `user.id = 'default'` (or a UUID stored in extension storage).
- Auth tables (`session`, `account`, …) unused but harmless.
- **Pros:** Same schema as Server mode; server and Cloud DB can share one DB file in theory.
- **Cons:** Dead tables; slightly confusing.

#### Approach 6.1b — Slim Cloud DB schema (cleaner long-term)

- New migration path / schema variant without auth tables.
- `device`, `tracked_tab`, etc. drop `userId` or use a constant generated at DB creation.
- **Pros:** Cleaner for solo users.
- **Cons:** Two schema variants or a breaking migration; more work.

**Recommendation for Phase 1:** **6.1a (synthetic user)** — fastest path, reuses all existing queries with `userId = workspaceUserId`.

### 6.2 Workspace bootstrap

On first successful Cloud DB connection:

1. Verify connectivity (`SELECT 1` or read schema version).
2. If empty DB → run migrations (`db:push` equivalent embedded in extension or ship SQL migration bundle).
3. Insert synthetic user if missing.
4. Register this extension install as a `device` row.
5. Store `workspaceUserId` and `deviceId` in local state.

### 6.3 Schema version table

Add a small metadata table for forward compatibility:

```sql
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- row: ('version', '1')
```

Extension checks version before queries; prompts user to update extension if mismatch.

---

## 7. Package restructuring

### 7.1 New package: `packages/sync-core`

Extract server-side business logic from `packages/api` into a **runtime-agnostic** library:

```
packages/sync-core/
  src/
    client.ts          # createSyncClient(db, { userId, deviceId })
    tracked-tabs.ts    # create, updateLocation, takeOver, list, …
    devices.ts
    settings.ts
    collections.ts
    lan-sync.ts        # optional: direct DB signaling
    serialize.ts       # serializeTab, serializeDevice, health computation
    validation.ts      # URL exclusion, domain checks, zod schemas
    history-retention.ts
    ids.ts
    constants.ts       # STALE_ACTIVITY_MS, etc.
```

**Dependencies:** `@trackingext/db`, `drizzle-orm`, `zod` — **no** `hono`, `@orpc/server`, `better-auth`.

**Consumers:**

| Consumer | Usage |
|----------|-------|
| `apps/extension` | `createSyncClient(drizzleDb, ctx)` in Cloud DB backend |
| `packages/api` | Thin oRPC handlers delegate to `sync-core` |
| `apps/server` | Unchanged wiring |

### 7.2 New package: `packages/db-client` (optional split)

Wrap `@libsql/client` creation for browser vs server:

```typescript
export function createBrowserDb(url: string, authToken: string) {
  const client = createClient({ url, authToken });
  return drizzle({ client, schema });
}
```

Keeps extension bundle boundaries clear and centralizes CORS/error handling.

### 7.3 Extension dependency changes

```json
// apps/extension/package.json — add
"@trackingext/sync-core": "workspace:*",
"@trackingext/db": "workspace:*",
"@libsql/client": "^0.15.x",
"drizzle-orm": "..."
```

Remove direct `@orpc/client` usage from Cloud DB code paths (keep for Server mode until deprecated).

**Bundle size estimate:** +150–400 KB minified (libsql client + drizzle subset). Acceptable for an extension with existing React UI. Monitor with `wxt build` output.

---

## 8. Extension implementation detail

### 8.1 Local state changes (`apps/extension/lib/types.ts`)

```typescript
export type SyncModes = {
  offline: boolean;
  lan: boolean;
  server: boolean;
  cloudDb: boolean;  // NEW
};

export type LocalState = {
  // Existing
  serverUrl: string | null;
  sessionToken: string | null;
  // NEW
  databaseUrl: string | null;
  databaseAuthToken: string | null;
  workspaceUserId: string | null;
  // ... rest unchanged
};
```

**Validation rule:** at least one of `offline | lan | server | cloudDb` must be true.  
**Mutual exclusivity (recommended):** `server` and `cloudDb` should not both be active for remote sync (avoid dual-writer confusion). UI enforces radio or auto-disables one.

### 8.2 Sync backend abstraction

Replace scattered `isServerSyncActive(...)` checks with:

```typescript
interface SyncBackend {
  pullTabs(): Promise<TrackedTab[]>;
  createTab(input: CreateTabInput): Promise<TrackedTab>;
  updateLocation(input: UpdateLocationInput): Promise<TrackedTab | null>;
  // ... etc.
}

function resolveBackend(state: LocalState): SyncBackend {
  if (state.syncModes.cloudDb && state.databaseUrl && state.databaseAuthToken)
    return new CloudDbBackend(state);
  if (isServerSyncActive(...))
    return new ServerBackend(state);
  return new OfflineBackend(state);
}
```

Refactor `sync/router.ts`, `server-bridge.ts`, `history-sync.ts`, and `background.ts` to call `resolveBackend()`.

### 8.3 Cloud DB backend (`apps/extension/lib/sync/cloud-db-backend.ts`)

Responsibilities:

- Lazy-init Drizzle client (reuse connection in service worker).
- Call `sync-core` functions with `{ userId: workspaceUserId, deviceId }`.
- Handle connection errors → queue updates (reuse `location-queue.ts` pattern).
- Periodic `device.touch` via `browser.alarms` (every 5–15 min).
- Run history retention purge on alarm (port `purgeExpiredHistoryForUser`).

### 8.4 Connection setup UX

**Onboarding steps for Cloud DB mode:**

| Step | UI |
|------|-----|
| 1 | Choose sync mode → select **Cloud DB** |
| 2 | Paste **Database URL** + **Auth token** (+ link to Turso setup guide) |
| 3 | Test connection (spinner + success/error) |
| 4 | Device name |
| 5 | Done (skip auth step) |

**Settings:** edit URL/token, "Disconnect database", export local cache.

**Helper content in extension:**

- Turso: create DB → copy URL + token.
- Self-hosted: `sqld` + reverse proxy + TLS.
- Security note: token = full access; don't share.

### 8.5 Local dashboard gaps to close

Current local dashboard tabs: **Tabs | LAN | Settings**.

Web dashboard pages to port or defer:

| Web page | Priority | Notes |
|----------|----------|-------|
| Tracked tabs (list, archive, bulk) | P0 | Partially in local dashboard |
| Settings / privacy | P0 | Already in local settings panel |
| Devices | P1 | List + rename; derive from DB |
| Collections | P1 | Create/rename/move; web has richer UI |
| Sync mode explanation | P2 | Adapt `sync-settings-panel.tsx` copy |
| Activity export | P2 | Port `activity-export.ts` |
| Sessions | N/A | Drop for Cloud DB users |
| Extension install guide | P2 | Keep for Server mode only |
| Dashboard theme | P1 | Already in extension settings |

Add **Collections** and **Devices** tabs to `local-dashboard-view.tsx` when Cloud DB is active.

### 8.6 LAN + Cloud DB interaction

| LAN signaling | Behavior |
|---------------|----------|
| **Local only** | Unchanged — no DB needed |
| **Server relay** | Requires Server mode OR Cloud DB with `lan_*` table access via sync-core |

For Cloud DB users who enable LAN + relay: use the same `lanSync` sync-core functions against their Turso DB instead of oRPC.

### 8.7 Manifest / permissions

- `host_permissions: ["<all_urls>"]` already present — covers libsql HTTPS endpoints.
- Document that user-provided DB URLs may require store review explanation (data goes to user-chosen host only).
- No new permissions required for libsql HTTP client.

---

## 9. Server and web dashboard (hybrid path)

### 9.1 Refactor server to use sync-core

Each `protectedProcedure` in `packages/api` becomes:

```typescript
create: protectedProcedure.input(schema).handler(async ({ context, input }) => {
  return syncCore.trackedTabs.create(context.db, {
    userId: context.session.user.id,
    ...input,
  });
});
```

Server retains: Better Auth, CORS, session middleware, LAN public endpoints.

### 9.2 Web dashboard

No immediate changes required for Option B.  
Long-term: mark web dashboard as **"Self-hosted server mode"** in docs; Cloud DB users live entirely in extension.

---

## 10. Security model

### 10.1 Threat comparison

| Aspect | Server mode | Cloud DB mode |
|--------|-------------|---------------|
| Credential | Session cookie/token | DB auth token |
| Scope | Per-user via auth middleware | Entire database |
| Revocation | Sign out, invalidate session | Rotate token in Turso dashboard |
| Leak impact | One user's data | All data in that DB |
| Multi-tenant | Yes (one server, many users) | No (one DB per user) |

### 10.2 Mitigations

1. **Document:** one database per person; treat token like a password.
2. **Storage:** keep token in `browser.storage.local` (not synced by browser sync).
3. **Optional Phase 4:** support read-only token for pull-only devices (Turso supports scoped tokens if available).
4. **No token in URLs** — only in storage and HTTPS headers.
5. **Connection test** does not log token.

### 10.3 Concurrency

SQLite/libsql handles low-frequency writes well. Rules (already in API):

- `updateLocation` rejected if another device owns the tab (`activeDeviceId` conflict).
- Last-write-wins on `lastUpdatedAt` for merges.
- Extension continues to queue failed updates (`queuedLocationUpdates`).

**Risk:** two devices with stale cache could conflict more often without server as single writer.  
**Mitigation:** pull before push on popup open; alarm-based periodic pull; optimistic UI with conflict toast.

---

## 11. User-facing hosting guide (to ship in docs)

### Turso (recommended for most users)

1. Create account at [turso.tech](https://turso.tech).
2. Create a database (e.g. `trackingext`).
3. Create an auth token with read/write access.
4. Copy `libsql://…` URL and token into extension onboarding.

**Free tier:** typically sufficient for personal tab tracking (low write volume).

### Self-hosted libsql-server

1. Run `sqld` against a SQLite file on a VPS or home server.
2. Expose via HTTPS (Caddy, Traefik, nginx).
3. Configure CORS for extension origins if needed.
4. Extension points at `https://your-host.example.com` with sqld auth token.

**Cross-device from home lab:** Tailscale, Cloudflare Tunnel, or public HTTPS.

### What does NOT work

- Selecting a `.sqlite` file on disk from the extension.
- Google Drive / Dropbox sync of a SQLite file (corruption risk).
- Shared family DB without accepting shared-token security model.

---

## 12. Migration paths

### 12.1 New users

Default onboarding offers four modes. Cloud DB is the **recommended** path for "sync without self-hosting."

### 12.2 Existing Server mode users

No forced migration. Optional future tool:

1. Export data via web dashboard or API.
2. Import into new Turso DB via extension "Import" wizard.
3. Switch sync mode from Server → Cloud DB.

### 12.3 Local state migration

```typescript
// If user had serverUrl + sessionToken only — unchanged
// If user opts into cloudDb:
//   - clear sessionToken (optional)
//   - promote cachedTabs via sync-core create/import
```

---

## 13. Implementation phases

### Phase 0 — Decision and spike (1–2 days)

- [ ] Choose Option A/B/C/D (default: **B**).
- [ ] Choose schema approach 6.1a vs 6.1b (default: **6.1a**).
- [ ] Spike: `@libsql/client` + Drizzle in WXT service worker against Turso dev DB.
- [ ] Verify CORS from Chromium + Firefox extension contexts.
- [ ] Measure extension bundle size delta.

**Exit criteria:** successful `list tracked tabs` from background script.

---

### Phase 1 — sync-core extraction (3–5 days)

- [ ] Create `packages/sync-core` with tests ported from `packages/api` router tests.
- [ ] Move: `serializeTab`, ownership checks, URL exclusion, history retention, IDs.
- [ ] Refactor `packages/api` routers to delegate to sync-core (no behavior change).
- [ ] All existing `bun run test` passes.

**Exit criteria:** server mode behavior identical; zero regression in integration tests.

---

### Phase 2 — Cloud DB backend in extension (5–8 days)

- [ ] Add `databaseUrl`, `databaseAuthToken`, `workspaceUserId`, `syncModes.cloudDb` to local state + migration.
- [ ] Implement `CloudDbBackend` using sync-core.
- [ ] Refactor `sync/router.ts` to backend abstraction.
- [ ] Connection test + bootstrap (synthetic user, device register).
- [ ] Update onboarding wizard: Cloud DB path (no auth step).
- [ ] Update `sync-modes.ts` validation and descriptions.
- [ ] Queue/retry logic for offline periods (reuse location queue).
- [ ] Device touch + history purge alarms.

**Exit criteria:** two browsers with same Turso token sync track/rename/takeover.

---

### Phase 3 — Local dashboard parity (4–6 days)

- [ ] Devices tab (list, rename, last seen).
- [ ] Collections tab (list, create, assign tabs).
- [ ] Archive / bulk actions on tracked tabs.
- [ ] Activity export (port from web).
- [ ] `open-dashboard.ts`: Cloud DB → always local dashboard.
- [ ] Remove auth panel requirement when Cloud DB-only.

**Exit criteria:** Cloud DB user never needs web dashboard for daily use.

---

### Phase 4 — LAN relay via Cloud DB (2–3 days)

- [ ] Wire `lan-sync` sync-core to Cloud DB backend.
- [ ] Update LAN pairing panel: relay via Cloud DB when Server mode off.
- [ ] Drop server URL requirement for LAN+Cloud DB relay.

**Exit criteria:** LAN pairing works with Turso as signaling store, no Hono server.

---

### Phase 5 — Polish, docs, release (3–5 days)

- [ ] User docs: Turso setup, self-hosted sqld, security FAQ.
- [ ] Update root README and extension README.
- [ ] Onboarding error messages (bad token, schema mismatch, network).
- [ ] Optional: CLI script `bun run db:provision-turso` for power users.
- [ ] Store listing copy update (Firefox AMO, Chrome).

**Exit criteria:** release notes + docs complete; manual QA checklist passed.

---

### Phase 6 — Optional deprecation (future)

- [ ] Migration tool Server → Cloud DB.
- [ ] Deprecation notice for self-hosted server.
- [ ] Reduce `apps/web` + `apps/server` to maintenance mode or remove.

---

## 14. Testing strategy

### Unit tests

- All sync-core functions (port from existing API tests in `packages/api`).
- `mergeTabsByRecency`, location queue, backend resolver.
- Schema bootstrap and synthetic user creation.

### Integration tests

- Vitest + in-memory libsql or file DB against sync-core.
- Mock `@libsql/client` for extension unit tests.

### Manual QA checklist

| # | Scenario |
|---|----------|
| 1 | Fresh Turso DB → onboard → track tab → see on second device |
| 2 | Update URL on owned tab → syncs |
| 3 | Take over from second device → first device stops updating |
| 4 | Offline → reconnect → queued updates flush |
| 5 | LAN local pairing without Cloud DB |
| 6 | LAN relay via Cloud DB `lan_*` tables |
| 7 | Invalid token → clear error, no crash |
| 8 | Schema version mismatch → blocking message |
| 9 | Firefox + Chromium cross-browser |
| 10 | Server mode still works (regression) |

---

## 15. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| libsql client fails in MV3 service worker | Medium | High | Phase 0 spike; fallback to offscreen document if needed |
| Token leak from extension storage | Low | High | Document rotation; optional OS keychain later |
| Bundle size rejection (AMO) | Low | Medium | Measure early; code-split drizzle |
| Concurrent write conflicts | Medium | Medium | Existing ownership model; pull-before-push |
| User expects file picker | High | Low | Clear copy: "Database URL", not "file" |
| Turso outage | Low | Medium | Cached tabs + queue; offline mode still works |
| Two remote modes enabled | Medium | High | UI mutual exclusion |
| Schema drift extension vs server | Medium | Medium | `schema_meta` version table |

---

## 16. Open decisions (for you)

Record your choices before implementation starts:

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Overall strategy | A / **B** / C / D | **B — Hybrid** |
| D2 | Schema variant | **6.1a synthetic user** / 6.1b slim | **6.1a** first |
| D3 | Server + Cloud DB together | Allow both / **mutually exclusive** | **Mutually exclusive** |
| D4 | Default sync mode for new installs | Offline / **Cloud DB** / ask | **Ask in onboarding** |
| D5 | Rename `server` mode in UI | Keep "Server" / rename "Self-hosted" | Rename for clarity |
| D6 | LAN relay default for Cloud DB users | Local / **Cloud DB relay** | **Cloud DB relay** if LAN+Cloud enabled |
| D7 | Deprecate web dashboard timeline | Never / after Phase 3 / immediate | **After Phase 3** evaluate |
| D8 | Embedded migrations vs remote push | Ship SQL in extension / require CLI setup | **Ship SQL in extension** |

---

## 17. Effort summary

| Phase | Duration | Depends on |
|-------|----------|------------|
| 0 Spike | 1–2 days | — |
| 1 sync-core | 3–5 days | Phase 0 |
| 2 Cloud DB backend | 5–8 days | Phase 1 |
| 3 Dashboard parity | 4–6 days | Phase 2 |
| 4 LAN relay | 2–3 days | Phase 2 |
| 5 Polish | 3–5 days | Phase 3 |
| **Total** | **~18–29 days** | Single developer, approximate |

Phases 3 and 4 can overlap partially.

---

## 18. Success metrics

- New user can go from install → Turso → synced tab in **under 5 minutes** without a terminal.
- **Zero** server deployment required for Cloud DB path.
- Server mode regression tests pass throughout.
- Extension bundle size increase **< 500 KB** gzipped.
- Support burden: hosting docs answer 80%+ of setup questions without issues.

---

## 19. References in this repo

| Path | Relevance |
|------|-----------|
| `packages/db/src/schema/` | Schema to reuse |
| `packages/api/src/routers/` | Logic to extract to sync-core |
| `apps/extension/lib/sync/router.ts` | Main refactor point |
| `apps/extension/lib/sync/server-bridge.ts` | Merge/pull patterns |
| `apps/extension/components/local-dashboard-view.tsx` | Primary UI going forward |
| `apps/extension/lib/open-dashboard.ts` | Web vs local routing |
| `apps/extension/lib/sync-modes.ts` | Mode validation |
| `packages/api/src/lib/history-retention.ts` | Client-side purge candidate |
| `README.md` | Self-hosting docs to update |

---

## 20. Appendix: sync mode comparison (target state)

| | Offline | LAN | Cloud DB | Server (self-hosted) |
|---|---------|-----|----------|----------------------|
| **Setup** | None | Pair devices | URL + token | Deploy stack + account |
| **Cross-device** | No | Same LAN | Internet | Internet |
| **Auth** | None | Pairing | DB token | Email/password |
| **UI** | Popup + local dashboard | + LAN panel | Local dashboard | + Web dashboard |
| **Multi-user** | — | — | No | Yes |
| **Cost** | Free | Free | Turso free tier | VPS/hosting |
| **Privacy** | Local only | Local P2P | Your Turso account | Your server |

---

*End of plan. Update this document as decisions are made (§16) before starting Phase 0.*
