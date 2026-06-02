# Publishing Guide

> Status: Ready for public testing package.
> Last updated: 2026-06-02.

This project has two release paths:

1. **GitHub public testing**: immediate. Share the source code and the generated Chrome extension
   zip through a GitHub Release.
2. **Chrome Web Store**: public distribution after Google review. Use the same generated zip, but
   submit it through the Chrome Developer Dashboard.

## 1. Build The Extension Zip

```bash
pnpm --filter @watch-party-sync/extension zip
```

Output:

```text
extension/.output/watch-party-sync-0.1.0-chrome.zip
```

The zip is the file to upload to GitHub Releases or the Chrome Web Store.

## 2. Local Unpacked Testing

```bash
pnpm --filter @watch-party-sync/extension build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `extension/.output/chrome-mv3`.

## 3. Public GitHub Release

Use this when you want friends to test before Chrome Web Store review.

```bash
git init
git add .
git commit -m "Initial public release"
gh repo create guilhermeeng99/watch-party-sync --public --source . --remote origin --push
pnpm --filter @watch-party-sync/extension zip
gh release create v0.1.0 extension/.output/watch-party-sync-0.1.0-chrome.zip --title "Watch Party Sync v0.1.0" --notes "Initial public testing release."
```

Friends can download the release zip. For manual install, they should unzip it and load the
unpacked folder in `chrome://extensions`.

## 4. Public Room Server

The extension needs a room server URL.

For same-machine testing:

```bash
pnpm dev:server
```

Use:

```text
http://localhost:8787
```

For real testing with friends outside the same computer, deploy the server somewhere reachable
over the internet, preferably behind HTTPS.

### Render Free

The repository includes a `render.yaml` Blueprint for Render Free.

Render setup:

1. Open <https://dashboard.render.com>.
2. Sign in with GitHub.
3. Click **New > Blueprint**.
4. Connect `guilhermeeng99/watch-party-sync`.
5. Keep branch `main`.
6. Confirm the service `watch-party-sync-server`.
7. Make sure the plan is **Free**.
8. Click **Deploy Blueprint**.

Render will use:

```text
Build command: pnpm install --frozen-lockfile && pnpm --filter @watch-party-sync/server build
Start command: pnpm --filter @watch-party-sync/server start
Health check: /health
```

After deploy, open:

```text
https://<your-render-service>.onrender.com/health
```

Expected response:

```json
{"ok":true}
```

Then open the extension Options page and set:

```text
https://<your-render-service>.onrender.com
```

Render Free notes:

- The server sleeps after idle time and can take around a minute to wake up.
- Room data is in memory, so rooms disappear when the free service sleeps, restarts, or redeploys.
- Active watch parties should stay awake while clients are connected and exchanging Socket.IO traffic.
- The first person joining after idle should wait for `/health` to return before creating a room.

Docker path:

```bash
docker compose up -d --build
```

Production notes:

- expose the server through a public domain, such as `https://watch-party.example.com`;
- configure reverse proxy WebSocket support;
- keep `PORT=8787` inside the container unless changed intentionally;
- set the extension Options page to the public server URL;
- when saving a non-local server URL, Chrome will ask for host access to that server.

## 5. Chrome Web Store Submission

Use the generated zip in the Chrome Developer Dashboard. The listing needs:

- extension zip;
- name, summary, description, category, language, and screenshots;
- privacy policy URL;
- single-purpose description;
- permission justifications;
- distribution visibility;
- test instructions if the reviewer needs a room server.

Suggested single purpose:

```text
Synchronize playback controls between friends watching the same video through official players.
```

Permission justifications:

| Permission | Justification |
|---|---|
| `storage` | Saves server URL, display name, member id, and debug preference locally. |
| `activeTab` | Reads the currently selected supported video tab when the user opens the popup. |
| YouTube host access | Runs the content script only on supported YouTube watch pages. |
| Crunchyroll host access | Runs the content script only on supported Crunchyroll watch pages. |
| localhost/127.0.0.1 host access | Lets users test with a self-hosted local room server. |
| optional server host access | Lets users connect to their configured self-hosted room server. |

Remote code declaration:

```text
No remote code is executed. The extension connects to the configured room server for websocket
messages only. All extension code is packaged in the submitted zip.
```

Data disclosure:

```text
The extension processes room membership, provider/media identifiers, playback timing, playback
state, and operational errors needed for synchronization. It does not collect video/audio content,
cookies, credentials, payment data, browsing history, analytics, or telemetry.
```

## 6. Release Checklist

- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm --filter @watch-party-sync/extension zip`
- [ ] Test create room on YouTube.
- [ ] Test join room from a second Chrome profile or another machine.
- [ ] Test server URL permission flow in Options.
- [ ] Confirm `PRIVACY.md` is published and linked.
- [ ] Upload zip to GitHub Release or Chrome Developer Dashboard.
