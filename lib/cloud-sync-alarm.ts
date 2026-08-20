import type { CloudSyncPolicy } from "../services/database-service";

export const CLOUD_SYNC_ALARM = "trackingext-sync";

type AlarmsApi = {
  clear(name: string): Promise<boolean>;
  create(name: string, alarmInfo: { periodInMinutes: number }): void;
};

export async function scheduleCloudSyncAlarm(
  alarms: AlarmsApi,
  behavior: CloudSyncPolicy | undefined,
) {
  await alarms.clear(CLOUD_SYNC_ALARM);
  if (!behavior?.scheduledSync) return;

  alarms.create(CLOUD_SYNC_ALARM, { periodInMinutes: behavior.scheduledSyncIntervalMinutes });
}
