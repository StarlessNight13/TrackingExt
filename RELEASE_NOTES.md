# TabTether 0.1.4

**Release date:** August 20, 2026

## Highlights

This release adds a full activity management dashboard, clearer cloud sync controls, and privacy tools for history retention and export.

### Activity management

- New **Activities** panel in the dashboard with search, filtering, and bulk actions
- **Archive** and **restore** activities without losing tether history
- **Bulk actions**: rename, move to group, archive, delete, and export selected activities
- **Activity health** badges and guidance when a tether is stale, orphaned, or needs attention
- **Group pinning** for quick access to important activity groups

### Cloud sync policy

Cloud database sync is now split into two independent controls:

- **Activity sync** — pushes structural changes immediately (create, rename, delete, archive, restore, takeover)
- **Scheduled sync** — batches navigation updates and runs on startup, reconnect, and a configurable interval (2, 5, 15, or 30 minutes)

Manual **Sync now** always runs regardless of these toggles. Existing installs with the old single “automatic sync” setting are migrated automatically.

### Privacy and data

- **History retention** picker to limit how long location history is kept locally
- **Export activities** to JSON from the dashboard for backup or migration

### Fixes and reliability

- Cloud sync policy is preserved when updating connection settings
- Settings and group changes no longer fail if a follow-up cloud sync fails after the write succeeded
- Sync policy form no longer resets while editing when unrelated snapshot data refreshes

---

## Store upload artifacts

| Target | Add-on zip | Source zip (AMO) |
|--------|------------|------------------|
| Chrome (MV3) | `.output/tabtether-chrome.zip` | `.output/tabtether-chrome-sources.zip` |
| Firefox (MV2) | `.output/tabtether-firefox.zip` | `.output/tabtether-firefox-sources.zip` |

Unpacked builds: `.output/chrome-mv3/` and `.output/firefox-mv2/`.

---

## Short store listing text

**What's new in 0.1.4**

Manage tethered activities from the dashboard: search, bulk edit, archive, export, and health diagnostics. Cloud sync now offers separate activity sync and scheduled sync controls. Set history retention limits and export your activities for backup.

---

## Previous release

**0.1.3** — Activity metadata editing, collapsible popup sections, series tethering, and multi-tab activity binding.
