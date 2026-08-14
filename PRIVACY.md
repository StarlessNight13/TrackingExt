# Privacy disclosure

TabTether stores only tabs that the user explicitly chooses to tether.

Local mode transmits no data. When the user enables cloud database mode, the extension sends the following to the HTTPS/libSQL endpoint chosen by that user:

- tethered URLs and domains;
- page titles;
- activity names, emoji, tags, groups, and navigation history;
- device name, browser name, and last-seen time;
- privacy, retention, and dashboard settings.

LAN mode sends tethered activity data only to explicitly paired peers. TabTether has no analytics, advertising, or error-reporting destination.

The database token is never placed in URLs, logs, diagnostics, or exports. It can be kept in browser-profile extension storage or session-only storage. Disconnecting removes it. Users can rotate a token at their database provider and enter the replacement in Settings.

Exports contain tracked data and settings but never credentials. Sensitive authentication-like URL query parameters are always stripped before storage; users may also strip all query parameters and fragments or exclude entire sites.
