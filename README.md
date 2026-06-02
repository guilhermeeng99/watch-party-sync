# Watch Party Sync

Working title for a free, open-source browser extension that keeps friends watching the same
video in sync while each person watches through the official player on their own computer.

**The promise:** sync playback, not content. The project does not stream, download, proxy,
share accounts, share cookies, bypass DRM, or bypass a service's plan/device limits. Every
viewer must already be able to play the video in their own browser session.

> Status: public testing package in progress. The extension and server build, protocol/server
> tests pass, and YouTube/Generic HTML5/Crunchyroll adapters are scaffolded. YouTube popup
> validation has started; multi-user validation is next.

## What It Will Do

Status: Done, In progress, Planned, Backlog. See [docs/ROADMAP.md](docs/ROADMAP.md).

| Feature | Status | Notes |
|---|---|---|
| Product docs, architecture, roadmap, specs | Done | Toolzy-style documentation |
| Chrome extension shell | Done | Manifest V3, WXT, TypeScript |
| Self-hosted realtime room server | Done | Node.js, TypeScript, Socket.IO |
| YouTube sync MVP | Done | Implemented adapter; manual page validation pending |
| Generic HTML5 video sync | Done | Localhost/127.0.0.1 test adapter |
| Drift correction | Done | Rate nudge for small drift, seek for large drift |
| Friend mode pause | Done | Members can play/pause/rate; host owns seek |
| Crunchyroll connector | Done | Initial adapter; manual page validation pending |
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
  server/               # self-hosted realtime room server
    src/
      rooms/            # room lifecycle, members, permissions, control authority
      protocol/         # shared event validation
  docs/
    ROADMAP.md
    specs/
```

High-level flow:

1. A user opens a supported video page.
2. The extension detects the provider and local player.
3. A user creates or joins a room.
4. The server relays room state and scheduled playback commands.
5. Each extension applies commands to its local official player.
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
| Distribution | GitHub public test releases first; Chrome Web Store after review |
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

## Public Testing

Build the Chrome extension package:

```bash
pnpm --filter @watch-party-sync/extension zip
```

Use the generated `extension/.output/watch-party-sync-0.1.1-chrome.zip` in either:

- a GitHub Release for immediate public testing;
- the Chrome Developer Dashboard for Chrome Web Store review.

The public test build defaults to the hosted Render Free server. For a custom server, set that URL
in the extension Options page. Chrome will ask for host access to that server when the URL is saved.

See [docs/PUBLISHING.md](docs/PUBLISHING.md) and [PRIVACY.md](PRIVACY.md).

### Render Free Server

This repo includes a Render Blueprint:

```text
render.yaml
```

Use Render Dashboard > New > Blueprint, connect this repo, deploy `watch-party-sync-server`, then
put the generated `https://...onrender.com` URL in the extension Options page.

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
