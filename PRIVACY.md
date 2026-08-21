# Privacy disclosure

TabTether stores only tabs that the user explicitly chooses to tether.

Local mode transmits no data. When the user enables cloud database mode, the extension sends the following to the HTTPS/libSQL endpoint chosen by that user:

- tethered URLs and domains;
- page titles;
- activity names, emoji, tags, groups, and navigation history;
- device name, browser name, and last-seen time;
- privacy, retention, and dashboard settings.

LAN mode sends tethered activity data only to explicitly paired peers. TabTether has no analytics, advertising, or error-reporting destination.

On Firefox, TabTether may also store the internal tethered activity id in the browser's per-tab session metadata (`sessions.setTabValue`) so a restored tab can be rebound after restart. That value is extension-private, contains no URLs, titles, credentials, or other sensitive fields, and is not sent to any server.

On Chromium (and as a Firefox fallback when session tab values are unavailable), TabTether keeps a **local-only** restore fingerprint per tethered activity—normalized URL key, title, pinned state, tab index, relative window position, and related layout hints—so duplicate URLs can be disambiguated after a restart. Fingerprints stay in this browser profile's extension storage and are never synced to cloud or LAN peers.

The database token is never placed in URLs, logs, diagnostics, or exports. It can be kept in browser-profile extension storage or session-only storage. Disconnecting removes it. Users can rotate a token at their database provider and enter the replacement in Settings.

Exports contain tracked data and settings but never credentials. Sensitive authentication-like URL query parameters are always stripped before storage; users may also strip all query parameters and fragments or exclude entire sites.
