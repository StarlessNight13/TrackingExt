import { createId } from "../core/ids";
import type { DatabaseClient } from "./client";
import { requiredText } from "../core/validation";
import { getCloudCredentials } from "../storage/cloud-configuration";
import { withDatabaseClient } from "../services/database-service";
import type { PrivacySettings } from "../lib/types";

async function withDatabase<T>(run: (client: DatabaseClient, workspaceId: string) => Promise<T>) {
  const credentials = await getCloudCredentials();
  if (!credentials) throw new Error("Cloud database is not connected");
  return withDatabaseClient(credentials, "management", (client) =>
    run(client, credentials.workspaceId),
  );
}

export const listCloudGroups = () =>
  withDatabase(async (client, workspaceId) => {
    const result = await client.execute({
      sql: `SELECT g.*, count(t.id) activity_count FROM "group" g
        LEFT JOIN tracked_tab t ON t.group_id = g.id AND t.deleted_at IS NULL
        WHERE g.workspace_id = ? AND g.deleted_at IS NULL
        GROUP BY g.id ORDER BY g.name`,
      args: [workspaceId],
    });
    return result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      notes: String(row.notes),
      activityCount: Number(row.activity_count),
      revision: Number(row.revision),
    }));
  });

export const saveCloudGroup = (input: {
  id?: string;
  name: string;
  notes?: string;
  revision?: number;
}) =>
  withDatabase(async (client, workspaceId) => {
    const now = Date.now();
    const name = requiredText(input.name, "Group name", 120);
    const notes = input.notes ?? "";
    if (notes.length > 4000) throw new Error("Notes must be at most 4000 characters");
    if (input.id) {
      const result = await client.execute({
        sql: `UPDATE "group" SET name = ?, notes = ?, updated_at = ?, revision = revision + 1
          WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL`,
        args: [name, notes, now, input.id, workspaceId, input.revision ?? 0],
      });
      if (result.rowsAffected !== 1)
        throw new Error("Group changed on another device; refresh and retry");
      return input.id;
    }
    const id = createId("grp");
    await client.execute({
      sql: `INSERT INTO "group" (id, workspace_id, name, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, workspaceId, name, notes, now, now],
    });
    return id;
  });

export const deleteCloudGroup = (id: string, revision: number) =>
  withDatabase(async (client, workspaceId) => {
    const now = Date.now();
    const result = await client.batch(
      [
        {
          sql: `UPDATE tracked_tab SET group_id = NULL, updated_at = ?, revision = revision + 1
            WHERE workspace_id = ? AND group_id = ? AND EXISTS (
              SELECT 1 FROM "group" WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL
            )`,
          args: [now, workspaceId, id, id, workspaceId, revision],
        },
        {
          sql: `UPDATE "group" SET deleted_at = ?, updated_at = ?, revision = revision + 1
            WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL`,
          args: [now, now, id, workspaceId, revision],
        },
      ],
      "write",
    );
    if (result[1]?.rowsAffected !== 1)
      throw new Error("Group changed on another device; refresh and retry");
  });

export const listCloudDevices = () =>
  withDatabase(async (client, workspaceId) => {
    const result = await client.execute({
      sql: "SELECT id, name, browser, last_seen_at, created_at, revision FROM device WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY last_seen_at DESC",
      args: [workspaceId],
    });
    return result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      browser: String(row.browser),
      lastSeenAt: Number(row.last_seen_at),
      createdAt: Number(row.created_at),
      revision: Number(row.revision),
    }));
  });

export const renameCloudDevice = (id: string, name: string, revision: number) =>
  withDatabase(async (client, workspaceId) => {
    const result = await client.execute({
      sql: `UPDATE device SET name = ?, updated_at = ?, revision = revision + 1
        WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL`,
      args: [requiredText(name, "Device name", 120), Date.now(), id, workspaceId, revision],
    });
    if (result.rowsAffected !== 1)
      throw new Error("Device changed on another device; refresh and retry");
  });

export const removeCloudDevice = (id: string, revision: number) =>
  withDatabase(async (client, workspaceId) => {
    const now = Date.now();
    await client.batch(
      [
        {
          sql: `UPDATE tracked_tab SET active_device_id = NULL, updated_at = ?, revision = revision + 1
            WHERE workspace_id = ? AND active_device_id = ? AND EXISTS (
              SELECT 1 FROM device WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL
            )`,
          args: [now, workspaceId, id, id, workspaceId, revision],
        },
        {
          sql: `UPDATE device SET deleted_at = ?, updated_at = ?, revision = revision + 1
            WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL`,
          args: [now, now, id, workspaceId, revision],
        },
      ],
      "write",
    );
  });

export const getCloudHistory = (tabId: string) =>
  withDatabase(async (client, workspaceId) => {
    const result = await client.execute({
      sql: `SELECT id, url, title, visited_at FROM tracked_tab_history
        WHERE workspace_id = ? AND tracked_tab_id = ? ORDER BY visited_at DESC LIMIT 200`,
      args: [workspaceId, tabId],
    });
    return result.rows.map((row) => ({
      id: String(row.id),
      url: String(row.url),
      title: row.title == null ? null : String(row.title),
      visitedAt: new Date(Number(row.visited_at)).toISOString(),
    }));
  });

export const clearCloudHistory = (tabId: string) =>
  withDatabase(async (client, workspaceId) => {
    await client.execute({
      sql: "DELETE FROM tracked_tab_history WHERE workspace_id = ? AND tracked_tab_id = ?",
      args: [workspaceId, tabId],
    });
  });

export const updateCloudSettings = (settings: PrivacySettings) =>
  withDatabase(async (client, workspaceId) => {
    const current = await client.execute({
      sql: "SELECT revision FROM workspace_settings WHERE workspace_id = ? AND deleted_at IS NULL",
      args: [workspaceId],
    });
    const revision = Number(current.rows[0]?.revision ?? 0);
    const result = await client.execute({
      sql: `UPDATE workspace_settings SET record_history = ?, strip_query_params = ?,
        strip_fragments = ?, excluded_hosts = ?, dashboard_theme_seed = ?,
        dashboard_theme_variant = ?, history_retention_days = ?, updated_at = ?, revision = revision + 1
        WHERE workspace_id = ? AND revision = ? AND deleted_at IS NULL`,
      args: [
        settings.recordHistory ? 1 : 0,
        settings.stripQueryParams ? 1 : 0,
        settings.stripFragments ? 1 : 0,
        JSON.stringify(settings.excludedHosts),
        settings.dashboardThemeSeed,
        settings.dashboardThemeVariant,
        settings.historyRetentionDays,
        Date.now(),
        workspaceId,
        revision,
      ],
    });
    if (result.rowsAffected !== 1) throw new Error("Settings changed on another device; retry");
  });

export const assignCloudTab = (tabId: string, groupId: string | null, revision: number) =>
  withDatabase(async (client, workspaceId) => {
    const result = await client.execute({
      sql: `UPDATE tracked_tab SET group_id = ?, updated_at = ?, revision = revision + 1
        WHERE id = ? AND workspace_id = ? AND revision = ? AND deleted_at IS NULL
        AND (? IS NULL OR EXISTS (SELECT 1 FROM "group" WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL))`,
      args: [groupId, Date.now(), tabId, workspaceId, revision, groupId, groupId, workspaceId],
    });
    if (result.rowsAffected !== 1) throw new Error("Activity or group changed; sync and retry");
  });
