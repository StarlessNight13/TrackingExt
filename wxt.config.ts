import { defineConfig } from "wxt";
import { platform } from "node:process";

const chromiumBinary =
  platform === "win32"
    ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    : platform === "linux"
      ? "/usr/bin/helium"
      : undefined;

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: chromiumBinary
    ? {
        binaries: {
          chrome: chromiumBinary,
        },
      }
    : undefined,
  zip: {
    // AMO needs the built zip plus a source archive for minified WXT output.
    zipSources: true,
    artifactTemplate: "{{name}}-{{browser}}.zip",
    sourcesTemplate: "{{name}}-{{browser}}-sources.zip",
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox" || browser === "firefox-android";
    const isFirefoxAndroid = browser === "firefox-android";

    return {
      name: "TabTether",
      description:
        "Tether tabs as persistent activities that sync across Firefox and Chromium browsers.",
      permissions: [
        "tabs",
        "storage",
        "alarms",
        "notifications",
        // Firefox Android does not support extension context menus.
        ...(isFirefoxAndroid ? [] : ["contextMenus"]),
        // Per-tab session values (setTabValue) exist on Firefox only; Chromium
        // has sessions.getRecentlyClosed but not tab session metadata.
        ...(isFirefox ? ["sessions"] : []),
        // The LAN/WebRTC transport relies on Chromium's offscreen API.
        ...(isFirefox ? [] : ["offscreen"]),
      ],
      host_permissions: ["<all_urls>"],
      ...(isFirefoxAndroid
        ? {}
        : {
            commands: {
              "resume-activity": {
                suggested_key: {
                  default: "Alt+Shift+R",
                  mac: "Alt+Shift+R",
                },
                description: "Resume a tethered activity (open & take over)",
              },
            },
          }),
      browser_specific_settings: {
        gecko: {
          id: "trackingext@trackingext.local",
          strict_min_version: "140.0",
          data_collection_permissions: {
            required: ["none"],
            optional: ["browsingActivity", "websiteContent", "technicalAndInteraction"],
          },
        },
        gecko_android: {
          strict_min_version: "142.0",
        },
      },
    };
  },
});
