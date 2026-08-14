import { useEffect, useState, useTransition } from "react";

import { sendMessage } from "../lib/messaging";
import { M3TextArea, M3TextField } from "../entrypoints/popup/components/m3-text-field";

type CloudGroup = {
  id: string;
  name: string;
  notes: string;
  activityCount: number;
  revision: number;
};
type CloudDevice = {
  id: string;
  name: string;
  browser: string;
  lastSeenAt: number;
  createdAt: number;
  revision: number;
};

export function CloudManagementPanel({
  kind,
  currentDeviceId,
}: {
  kind: "groups" | "devices";
  currentDeviceId?: string;
}) {
  const [groups, setGroups] = useState<CloudGroup[]>([]);
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<CloudGroup | CloudDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const response = await sendMessage({
        type: kind === "groups" ? "LIST_CLOUD_GROUPS" : "LIST_CLOUD_DEVICES",
      });
      if (!response.ok) return setError(response.error);
      if (kind === "groups") setGroups((response.groups ?? []) as CloudGroup[]);
      else setDevices((response.devices ?? []) as CloudDevice[]);
    });

  useEffect(load, [kind]);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const response =
        kind === "groups"
          ? await sendMessage({
              type: "SAVE_CLOUD_GROUP",
              id: editing?.id,
              name: name.trim(),
              notes,
              revision: editing?.revision,
            })
          : editing
            ? await sendMessage({
                type: "RENAME_CLOUD_DEVICE",
                id: editing.id,
                name: name.trim(),
                revision: editing.revision,
              })
            : null;
      if (!response) return;
      if (!response.ok) return setError(response.error);
      setGroups((response.groups ?? groups) as CloudGroup[]);
      setDevices((response.devices ?? devices) as CloudDevice[]);
      setEditing(null);
      setName("");
      setNotes("");
    });

  const remove = (item: CloudGroup | CloudDevice) =>
    startTransition(async () => {
      if (!confirm(`Remove “${item.name}”?`)) return;
      const response = await sendMessage(
        kind === "groups"
          ? { type: "DELETE_CLOUD_GROUP", id: item.id, revision: item.revision }
          : { type: "REMOVE_CLOUD_DEVICE", id: item.id, revision: item.revision },
      );
      if (!response.ok) return setError(response.error);
      setGroups((response.groups ?? groups) as CloudGroup[]);
      setDevices((response.devices ?? devices) as CloudDevice[]);
    });

  const items = kind === "groups" ? groups : devices;
  return (
    <div className="stack" role="tabpanel">
      <div className="panel stack">
        <span className="section-title" style={{ margin: 0 }}>
          {kind === "groups" ? (editing ? "Edit group" : "New group") : "Rename device"}
        </span>
        {kind === "groups" || editing ? (
          <M3TextField id={`cloud-${kind}-name`} label="Name" value={name} onChange={setName} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Select a device below to rename it.
          </p>
        )}
        {kind === "groups" ? (
          <M3TextArea
            id="cloud-group-notes"
            label="Notes"
            rows={3}
            value={notes}
            onChange={setNotes}
          />
        ) : null}
        {kind === "groups" || editing ? (
          <div className="row wrap">
            <button className="btn secondary" disabled={pending || !name.trim()} onClick={save}>
              Save
            </button>
            {editing ? (
              <button
                className="btn ghost"
                onClick={() => {
                  setEditing(null);
                  setName("");
                  setNotes("");
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="empty">No {kind} yet.</div>
      ) : (
        <div className="list compact-list">
          {items.map((item) => (
            <div className={`panel cloud-management-card${"notes" in item ? " cloud-group-card" : ""}`} key={item.id}>
              <div className="row cloud-management-card__header" style={{ justifyContent: "space-between" }}>
                <span className="name cloud-management-card__name">{item.name}</span>
                <span className="pill">
                  {"activityCount" in item ? `${item.activityCount} activities` : item.browser}
                </span>
              </div>
              {"notes" in item && item.notes ? <p className="cloud-group-card__notes">{item.notes}</p> : null}
              {"lastSeenAt" in item ? (
                <p className="muted">Last seen {new Date(item.lastSeenAt).toLocaleString()}</p>
              ) : null}
              <div className="row wrap cloud-management-card__actions">
                <button
                  className="btn ghost"
                  disabled={pending}
                  onClick={() => {
                    setEditing(item);
                    setName(item.name);
                    setNotes("notes" in item ? item.notes : "");
                  }}
                >
                  Rename
                </button>
                <button
                  className="btn danger"
                  disabled={pending || item.id === currentDeviceId}
                  onClick={() => remove(item)}
                >
                  {item.id === currentDeviceId ? "Current device" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
