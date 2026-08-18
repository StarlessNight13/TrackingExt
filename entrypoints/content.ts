import { addTrackedTabBadge, stripTrackedTabBadge } from "../lib/title-badge";
import {
  DASHBOARD_BRIDGE_SOURCE,
  getExtensionBridgeInfo,
} from "../lib/extension-bridge";

type TitleBadgeMessage =
  | { type: "SET_TRACKED_TITLE_BADGE"; emoji?: string | null }
  | { type: "CLEAR_TRACKED_TITLE_BADGE" };

let isTracked = false;
let trackedEmoji: string | null = null;
let applyingOwnTitleChange = false;

function withOwnTitleChange(nextTitle: string) {
  if (document.title === nextTitle) return;
  applyingOwnTitleChange = true;
  document.title = nextTitle;
  queueMicrotask(() => {
    applyingOwnTitleChange = false;
  });
}

function syncTrackedTitle() {
  if (!isTracked) return;
  withOwnTitleChange(addTrackedTabBadge(document.title, trackedEmoji));
}

function clearTrackedTitle() {
  if (!isTracked) return;
  const previousEmoji = trackedEmoji;
  isTracked = false;
  trackedEmoji = null;
  withOwnTitleChange(stripTrackedTabBadge(document.title, previousEmoji));
}

function announceToPage() {
  window.postMessage(getExtensionBridgeInfo(), window.location.origin);
}

const observer = new MutationObserver(() => {
  if (applyingOwnTitleChange || !isTracked) return;
  syncTrackedTitle();
});

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    browser.runtime.onMessage.addListener((message: TitleBadgeMessage) => {
      if (message.type === "SET_TRACKED_TITLE_BADGE") {
        isTracked = true;
        trackedEmoji = message.emoji?.trim() || null;
        syncTrackedTitle();
        return;
      }

      if (message.type === "CLEAR_TRACKED_TITLE_BADGE") {
        clearTrackedTitle();
      }
    });

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source === DASHBOARD_BRIDGE_SOURCE && data.type === "EXTENSION_PING") {
        announceToPage();
      }
    });

    syncTrackedTitle();
  },
});
