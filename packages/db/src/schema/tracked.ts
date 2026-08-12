import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const device = sqliteTable(
  "device",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    browser: text("browser").notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("device_userId_idx").on(table.userId)],
);

export const trackedTab = sqliteTable(
  "tracked_tab",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    currentUrl: text("current_url").notNull(),
    currentTitle: text("current_title"),
    activeDeviceId: text("active_device_id").references(() => device.id, {
      onDelete: "set null",
    }),
    lastUpdatedDeviceId: text("last_updated_device_id").references(() => device.id, {
      onDelete: "set null",
    }),
    lastUpdatedAt: integer("last_updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("tracked_tab_userId_idx").on(table.userId),
    index("tracked_tab_activeDeviceId_idx").on(table.activeDeviceId),
  ],
);

export const trackedTabHistory = sqliteTable(
  "tracked_tab_history",
  {
    id: text("id").primaryKey(),
    trackedTabId: text("tracked_tab_id")
      .notNull()
      .references(() => trackedTab.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    visitedAt: integer("visited_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("tracked_tab_history_tabId_idx").on(table.trackedTabId)],
);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  recordHistory: integer("record_history", { mode: "boolean" }).default(true).notNull(),
  stripQueryParams: integer("strip_query_params", { mode: "boolean" }).default(false).notNull(),
  stripFragments: integer("strip_fragments", { mode: "boolean" }).default(true).notNull(),
  dashboardThemeSeed: text("dashboard_theme_seed").default("#6750A4").notNull(),
  dashboardThemeVariant: text("dashboard_theme_variant").default("TONAL_SPOT").notNull(),
  /** JSON array of hostnames, e.g. ["mail.google.com","bank.example"] */
  excludedHosts: text("excluded_hosts").default("[]").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const deviceRelations = relations(device, ({ one, many }) => ({
  user: one(user, {
    fields: [device.userId],
    references: [user.id],
  }),
  activeTrackedTabs: many(trackedTab, { relationName: "activeDevice" }),
  lastUpdatedTrackedTabs: many(trackedTab, { relationName: "lastUpdatedDevice" }),
}));

export const trackedTabRelations = relations(trackedTab, ({ one, many }) => ({
  user: one(user, {
    fields: [trackedTab.userId],
    references: [user.id],
  }),
  activeDevice: one(device, {
    fields: [trackedTab.activeDeviceId],
    references: [device.id],
    relationName: "activeDevice",
  }),
  lastUpdatedDevice: one(device, {
    fields: [trackedTab.lastUpdatedDeviceId],
    references: [device.id],
    relationName: "lastUpdatedDevice",
  }),
  history: many(trackedTabHistory),
}));

export const trackedTabHistoryRelations = relations(trackedTabHistory, ({ one }) => ({
  trackedTab: one(trackedTab, {
    fields: [trackedTabHistory.trackedTabId],
    references: [trackedTab.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));

/** One-time WebRTC pairing sessions (6-digit code, ~10 min TTL). */
export const lanPairing = sqliteTable(
  "lan_pairing",
  {
    code: text("code").primaryKey(),
    initiatorDeviceId: text("initiator_device_id").notNull(),
    initiatorDeviceName: text("initiator_device_name").notNull(),
    offerSdp: text("offer_sdp").notNull(),
    joinerDeviceId: text("joiner_device_id"),
    joinerDeviceName: text("joiner_device_name"),
    answerSdp: text("answer_sdp"),
    status: text("status").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("lan_pairing_expiresAt_idx").on(table.expiresAt)],
);

/** Ephemeral WebRTC signaling between paired devices. */
export const lanSignal = sqliteTable(
  "lan_signal",
  {
    id: text("id").primaryKey(),
    fromDeviceId: text("from_device_id").notNull(),
    toDeviceId: text("to_device_id").notNull(),
    kind: text("kind").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("lan_signal_toDeviceId_idx").on(table.toDeviceId)],
);
