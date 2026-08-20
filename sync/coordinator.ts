import { syncCloudDatabase } from "./cloud-sync";
import type { CloudSyncTrigger } from "./sync-triggers";

export function requestCloudSync(trigger: CloudSyncTrigger) {
  return syncCloudDatabase({ trigger });
}
