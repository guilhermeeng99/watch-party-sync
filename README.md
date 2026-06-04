# Watch Party Sync

Working title for a free, open-source browser extension that keeps friends watching the same
video in sync while each person watches through the official player on their own computer.

**The promise:** sync playback, not content. The project does not stream, download, proxy,
share accounts, share cookies, bypass DRM, or bypass a service's plan/device limits. Every
viewer must already be able to play the video in their own browser session.

> Status: public test release `v0.1.2` is published. The extension defaults to the hosted
> Render Free room server, YouTube supports both `youtube.com` and `www.youtube.com`, and
> end-to-end multi-user validation is in progress.

## What It Will Do

Status: Done, In progress, Planned, Backlog. See [docs/ROADMAP.md](docs/ROADMAP.md).

| Feature | Status | Notes |
|---|---|---|
| Product docs, architecture, roadmap, specs | Done | Toolzy-style documentation |
| Chrome extension shell | Done | Manifest V3, WXT, TypeScript |
| Self-hosted realtime room server | Done | Node.js, TypeScript, Socket.IO |
| YouTube sync MVP | Done | Public test build supports `youtube.com` and `www.youtube.com`; multi-user validation in progress |
| Generic HTML5 video sync | In progress | Adapter exists; local content-script/demo wiring pending |
| Drift correction | Done | Rate nudge for small drift, seek for large drift |
| Friend mode pause | Done | Members can play/pause/rate; host owns seek |
| Crunchyroll connector | In progress | Initial adapter; real episode validation pending |
| Netflix / Prime Video support | Backlog | Technical spikes only until proven reliable |
| Voice / chat | Out of scope | Use Discord |

## Product Boundary

This is a watch-party controller, not a streaming service.

- It only sends playback control data: play, pause, seek, playback rate, timestamps, member
  status, and provider/media identifiers.
- It never sends video bytes, audio bytes, subtitles, cookies, auth tokens, payment data, or
  account credentials.
- It does not help users get access to content. If the official player cannot play the video,
  the extension should show an unsupported/blocked state and stop.
- Shared accounts and simultaneous-stream limits remain the responsibility of the streaming
  service and the users. The project must not work around those limits.

See [docs/specs/privacy-and-compliance.md](docs/specs/privacy-and-compliance.md).

## Architecture

The project is a small two-part system:

```text
watch-party-sync/
  extension/            # Chrome extension
    entrypoints/        # WXT entrypoints: background, content scripts, popup, options
    src/
      providers/        # YouTube, Generic HTML5, Crunchyroll, experimental providers
      sync/             # room client, protocol types, drift correction
      ui/               # popup and overlay components
      shared/           # runtime messages, storage, permissions
  server/               # self-hosted realtime room server
    src/
      config/           # environment parsing
      rooms/            # room lifecycle, members, permissions, control authority
      transport/        # Socket.IO setup
  packages/
    protocol/           # shared event validation and sync timing helpers
  docs/
    ROADMAP.md
    specs/
```

High-level flow:

1. The host opens a supported video page and creates a room.
2. Friends enter the room code; the extension opens the host's video for them automatically.
3. Anyone plays, pauses, or seeks **on the video itself** — the extension forwards it as a
   control request.
4. The server relays room state and scheduled playback commands.
5. Each extension applies commands to its local official player (with drift correction).
6. Clients report state back so the room can detect readiness and drift.

See [docs/specs/architecture.md](docs/specs/architecture.md).

## Tech Stack

| Concern | Choice |
|---|---|
| Browser | Chrome first |
| Extension platform | Manifest V3 |
| Extension framework | WXT |
| Extension language | TypeScript |
| Extension UI | React for popup/options/overlay |
| Realtime | Socket.IO over WebSocket transport where available |
| Server | Node.js + TypeScript |
| Runtime validation | Zod |
| Storage | None in MVP; in-memory rooms only |
| Distribution | Manual unpacked install via GitHub Releases (no Chrome Web Store) |
| License | MIT |

## Local Development

```bash
pnpm install
pnpm test
pnpm build
pnpm check

pnpm dev:server
pnpm dev:extension
```

Server defaults:

```bash
PORT=8787
CORS_ORIGIN=*
```

Load the extension in Chrome from `extension/.output/chrome-mv3` after running the extension
dev/build command.

Extension default room server:

```text
https://watch-party-sync-server.onrender.com
```

Users can still override this in the extension Options page for local or self-hosted testing.

## Install (manual / unpacked)

The extension is **not** on the Chrome Web Store. Each user installs it manually. This is a
one-time setup and takes about a minute.

1. Download the latest `watch-party-sync-<version>-chrome.zip` from the
   [Releases page](https://github.com/guilhermeeng99/watch-party-sync/releases).
2. Unzip it anywhere (e.g. `Documents\watch-party-sync`). You should get a folder containing a
   `manifest.json`.
3. Open Chrome and go to `chrome://extensions`.
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped folder.
6. Pin the **Watch Party Sync** icon and open it on a YouTube or Crunchyroll video.

> Chrome shows "Loaded an unpacked extension" / a developer-mode warning each launch. That is
> normal for manually installed extensions and is safe to ignore.

The build defaults to the hosted Render Free server. For a custom or self-hosted server, set that
URL in the extension Options page; Chrome will ask for host access when the URL is saved.

### Building the package yourself

```bash
pnpm --filter @watch-party-sync/extension zip
```

This produces `extension/.output/watch-party-sync-<version>-chrome.zip` (the file to attach to a
GitHub Release) and the loadable folder `extension/.output/chrome-mv3`. To load straight from a
local build, point **Load unpacked** at `extension/.output/chrome-mv3`.

See [PRIVACY.md](PRIVACY.md).

### Render Free Server

This repo includes a Render Blueprint:

```text
render.yaml
```

Use Render Dashboard > New > Blueprint, connect this repo, and deploy `watch-party-sync-server`.
This project already uses `https://watch-party-sync-server.onrender.com` as the default extension
server; the Options page is only needed when testing another local or self-hosted server.

## Documentation

- [CLAUDE.md](CLAUDE.md) - project conventions for future agents and maintainers.
- [docs/ROADMAP.md](docs/ROADMAP.md) - current phase, planned phases, backlog, out of scope.
- [docs/specs/architecture.md](docs/specs/architecture.md) - system design and ADRs.
- [docs/specs/design-system.md](docs/specs/design-system.md) - visual system for extension UI.
- [docs/specs/browser-extension.md](docs/specs/browser-extension.md) - extension contract.
- [docs/specs/realtime-server.md](docs/specs/realtime-server.md) - room server contract.
- [docs/specs/sync-protocol.md](docs/specs/sync-protocol.md) - event model and sync rules.
- [docs/specs/provider-connectors.md](docs/specs/provider-connectors.md) - per-service adapters.
- [docs/specs/privacy-and-compliance.md](docs/specs/privacy-and-compliance.md) - data and legal boundaries.
- [docs/PUBLISHING.md](docs/PUBLISHING.md) - GitHub release, public server, and Chrome Web Store flow.
- [PRIVACY.md](PRIVACY.md) - public privacy policy draft.

## License

MIT. See [LICENSE](LICENSE).

## Legal Note

This project controls playback of official players that users already opened themselves. It
does not provide content, retransmit content, bypass DRM, bypass regional restrictions, bypass
account restrictions, or bypass simultaneous-stream limits. Users are responsible for following
the terms of the services they use.
