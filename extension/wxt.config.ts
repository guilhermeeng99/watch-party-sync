import { defineConfig } from "wxt";

// Firefox requires a stable extension id under browser_specific_settings. WXT only emits it for
// the firefox target; Chrome ignores it. Everything else is shared — the code uses wxt/browser,
// so the same source runs on both, and WXT converts the manifest (background, action, host
// permissions) to each browser's expected shape at build time.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => ({
    name: "Watch Party Sync",
    short_name: "Watch Party",
    description: "Synchronize local playback with friends across official video players.",
    version: "0.2.0",
    homepage_url: "https://github.com/guilhermeeng99/watch-party-sync",
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
    permissions: ["storage", "activeTab", "alarms"],
    host_permissions: [
      "https://www.youtube.com/*",
      "https://youtube.com/*",
      "https://www.crunchyroll.com/*",
      "https://watch-party-sync-server.onrender.com/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ],
    optional_host_permissions: ["http://*/*", "https://*/*"],
    action: {
      default_title: "Watch Party Sync",
      default_icon: {
        "16": "icons/icon-16.png",
        "32": "icons/icon-32.png",
      },
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: { id: "watch-party-sync@guilhermeeng99.github.io" },
          },
        }
      : {}),
  }),
});
