import { useEffect, useState, useTransition } from "react";

import { normalizeTags } from "@/core/validation";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import type { TrackedTab } from "@/lib/types";
import { M3Select, M3TextField } from "../entrypoints/popup/components/m3-text-field";

type CloudGroup = {
  id: string;
  name: string;
};

function parseTagsInput(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatTagsInput(tags: string[]): string {
  return tags.join(", ");
}

export function ActivityMetadataEditor({
  tracked,
  snapshot,
  onUpdate,
  onSaved,
  compact = false,
}: {
  tracked: TrackedTab;
  snapshot: PopupSnapshot;
  onUpdate: (snapshot: PopupSnapshot) => void;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const [name, setName] = useState(tracked.name);
  const [emoji, setEmoji] = useState(tracked.emoji ?? "");
  const [tagsInput, setTagsInput] = useState(formatTagsInput(tracked.tags));
  const [groupId, setGroupId] = useState(tracked.groupId ?? "");
  const [groups, setGroups] = useState<CloudGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showGroups = Boolean(snapshot.cloud.configuration);

  useEffect(() => {
    setName(tracked.name);
    setEmoji(tracked.emoji ?? "");
    setTagsInput(formatTagsInput(tracked.tags));
    setGroupId(tracked.groupId ?? "");
  }, [tracked.id, tracked.name, tracked.emoji, tracked.tags, tracked.groupId]);

  useEffect(() => {
    if (!showGroups) return;
    void sendMessage({ type: "LIST_CLOUD_GROUPS" }).then((response) => {
      if (!response.ok) return;
      setGroups((response.groups ?? []) as CloudGroup[]);
    });
  }, [showGroups, snapshot.cloud.status.lastSyncAt]);

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        const tags = normalizeTags(parseTagsInput(tagsInput));
        const res = await sendMessage({
          type: "UPDATE_TAB",
          trackedTabId: tracked.id,
          name: name.trim(),
          emoji: emoji.trim() || null,
          tags,
          groupId: groupId || null,
        });
        if (!res.ok) throw new Error(res.error);
        if (res.snapshot) onUpdate(res.snapshot);
        onSaved?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to save");
      }
    });
  };

  const dirty =
    name.trim() !== tracked.name ||
    (emoji.trim() || null) !== (tracked.emoji ?? null) ||
    formatTagsInput(normalizeTags(parseTagsInput(tagsInput))) !== formatTagsInput(tracked.tags) ||
    (groupId || null) !== (tracked.groupId ?? null);

  return (
    <div className={`stack${compact ? "" : " panel"}`}>
      {!compact ? (
        <span className="section-title" style={{ margin: 0 }}>
          Activity details
        </span>
      ) : null}
      <M3TextField id={`meta-name-${tracked.id}`} label="Name" value={name} onChange={setName} />
      <M3TextField
        id={`meta-emoji-${tracked.id}`}
        label="Emoji"
        value={emoji}
        onChange={setEmoji}
        placeholder="📖"
      />
      <M3TextField
        id={`meta-tags-${tracked.id}`}
        label="Tags"
        value={tagsInput}
        onChange={setTagsInput}
        placeholder="reading, research"
      />
      <p className="muted" style={{ margin: 0, fontSize: 11 }}>
        Comma-separated tags. Used in search and resume.
      </p>
      {showGroups ? (
        <>
          <M3Select
            label="Group"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
          >
            <option value="">No group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </M3Select>
          {groups.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Create groups in the dashboard Groups tab.
            </p>
          ) : null}
        </>
      ) : null}
      <div className="row wrap">
        <button className="btn secondary" disabled={pending || !name.trim() || !dirty} onClick={save}>
          Save details
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
