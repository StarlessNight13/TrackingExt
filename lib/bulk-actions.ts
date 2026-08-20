import { normalizeTags } from "../core/validation";
import { clearCloudHistory } from "../db/cloud-management";
import { getCloudCredentials } from "../storage/cloud-configuration";
import {
  archiveOfflineTab,
  applyOfflineTabTags,
  clearOfflineHistory,
  moveOfflineTabToGroup,
  restoreOfflineTab,
} from "./sync/offline-store";
import {
  archiveCloudTab,
  renameCloudTab,
  restoreCloudTab,
} from "../sync/cloud-tabs";
import { findSyncedTab, persistCachedTab, syncDeleteTab } from "./sync/router";
import { releaseTrackedTabBindings } from "./tracking";

export async function archiveTrackedTabs(ids: string[]) {
  for (const id of [...new Set(ids)]) {
    if (await getCloudCredentials()) {
      const tab = await archiveCloudTab(id);
      if (tab) await persistCachedTab(tab);
    } else {
      await archiveOfflineTab(id);
    }
    await releaseTrackedTabBindings(id);
  }
}

export async function restoreTrackedTabs(ids: string[]) {
  for (const id of [...new Set(ids)]) {
    if (await getCloudCredentials()) {
      const tab = await restoreCloudTab(id);
      if (tab) await persistCachedTab(tab);
    } else {
      await restoreOfflineTab(id);
    }
  }
}

export async function deleteTrackedTabs(ids: string[]) {
  for (const id of [...new Set(ids)]) {
    await syncDeleteTab(id);
    await releaseTrackedTabBindings(id);
  }
}

export async function tagTrackedTabs(ids: string[], tags: string[], mode: "add" | "replace") {
  const normalized = normalizeTags(tags);

  for (const id of [...new Set(ids)]) {
    const existing = await findSyncedTab(id);
    if (!existing) continue;

    const nextTags =
      mode === "replace" ? normalized : [...new Set([...existing.tags, ...normalized])];

    if (await getCloudCredentials()) {
      const tab = await renameCloudTab(
        id,
        existing.name,
        existing.emoji,
        nextTags,
        existing.groupId,
        existing.isPrivate,
      );
      if (tab) await persistCachedTab({ ...tab, tags: nextTags });
    } else {
      await applyOfflineTabTags(id, normalized, mode);
    }
  }
}

export async function moveTrackedTabs(ids: string[], groupId: string | null) {
  for (const id of [...new Set(ids)]) {
    const existing = await findSyncedTab(id);
    if (!existing) continue;

    if (await getCloudCredentials()) {
      const tab = await renameCloudTab(
        id,
        existing.name,
        existing.emoji,
        existing.tags,
        groupId,
        existing.isPrivate,
      );
      if (tab) await persistCachedTab({ ...tab, groupId });
    } else {
      await moveOfflineTabToGroup(id, groupId);
    }
  }
}

export async function clearTrackedTabsHistory(ids: string[]) {
  for (const id of [...new Set(ids)]) {
    if (await getCloudCredentials()) {
      await clearCloudHistory(id);
    } else {
      await clearOfflineHistory(id);
    }
  }
}
