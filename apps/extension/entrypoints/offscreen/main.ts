import { handleOffscreenLanMessage } from "@/lib/lan-sync/offscreen-handler";
import { isOffscreenLanMessage } from "@/lib/lan-sync/offscreen-protocol";

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOffscreenLanMessage(message)) return;

  void handleOffscreenLanMessage(message).then(sendResponse);
  return true;
});
