import { isFirefoxAndroid } from "./browser-capabilities";

/** Firefox Android opens browser_action pages as full tabs, not overlay popups. */
export function applyExtensionPageMode() {
  const root = document.documentElement;
  if (isFirefoxAndroid) {
    root.classList.add("extension-fullpage");
    return;
  }

  // Desktop Firefox can also open the popup document as a normal tab.
  if (root.classList.contains("extension-popup") && window.innerWidth > 340) {
    root.classList.add("extension-fullpage");
  }
}
