import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Watch Party Sync",
    short_name: "Watch Party",
    description: "Synchronize local playback with friends across official video players.",
    version: "0.1.0",
    homepage_url: "https://github.com/guilhermeeng99/watch-party-sync",
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
    permissions: ["storage", "activeTab"],
    host_permissions: [
      "https://www.youtube.com/*",
      "https://www.crunchyroll.com/*",
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
  },
});
