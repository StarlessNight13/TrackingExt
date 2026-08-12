import { addTrackedTabBadge, stripTrackedTabBadge } from "../lib/title-badge";

type TitleBadgeMessage =
  | { type: "SET_TRACKED_TITLE_BADGE"; emoji?: string | null }
  | { type: "CLEAR_TRACKED_TITLE_BADGE" };

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
  if (!trackedEmoji) return;
  withOwnTitleChange(addTrackedTabBadge(document.title, trackedEmoji));
}

function clearTrackedTitle() {
  if (!trackedEmoji) return;
  const previousEmoji = trackedEmoji;
  trackedEmoji = null;
  withOwnTitleChange(stripTrackedTabBadge(document.title, previousEmoji));
}

const observer = new MutationObserver(() => {
  if (applyingOwnTitleChange || !trackedEmoji) return;
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
        trackedEmoji = message.emoji?.trim() || null;
        syncTrackedTitle();
        return;
      }

      if (message.type === "CLEAR_TRACKED_TITLE_BADGE") {
        clearTrackedTitle();
      }
    });

    syncTrackedTitle();
  },
});
