import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  webExt: {
    binaries: {
      chrome: "/usr/bin/helium",
    },
  },
  zip: {
    // Self-hosted dashboard downloads; AMO source zip not required
    zipSources: false,
    artifactTemplate: "{{name}}-{{browser}}.zip",
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox" || browser === "firefox-android";
    const isFirefoxAndroid = browser === "firefox-android";

    return {
      name: "TrackingExt — Tracked Tabs",
      description:
        "Mark tabs as persistent activities that sync across Firefox and Chromium browsers.",
      permissions: [
        "tabs",
        "storage",
        "alarms",
        "notifications",
        // Firefox Android does not support extension context menus.
        ...(isFirefoxAndroid ? [] : ["contextMenus"]),
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
                description: "Resume a tracked activity (open & take over)",
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
