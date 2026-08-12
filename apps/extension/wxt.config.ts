import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: {
    name: "TrackingExt — Tracked Tabs",
    description:
      "Mark tabs as persistent activities that sync across Firefox and Chromium browsers.",
    permissions: ["tabs", "storage", "alarms", "contextMenus", "notifications"],
    host_permissions: ["<all_urls>"],
    browser_specific_settings: {
      gecko: {
        id: "trackingext@trackingext.local",
        strict_min_version: "121.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
