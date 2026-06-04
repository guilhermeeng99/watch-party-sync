# Watch Party Sync - Roadmap

> **Last updated**: 2026-06-02
> Single source of truth for what is **done**, **in progress**, and **planned**.
> Update in the same change that shifts scope (see `CLAUDE.md` -> Post-Change Checklist).

Watch Party Sync is an open-source **Chrome extension + self-hosted realtime server** for
watching videos with friends while each person uses the official player in their own browser.
The project syncs playback controls only: no media streaming, no downloads, no account/session
sharing, and no DRM or service-limit bypass.

## Legend

✅ Done · 🚧 In progress · ⬜ Planned · 💡 Backlog · ⛔ Out of scope

---

## Status at a glance

| Phase | Theme | Status |
|---|---|---|
| A | Product boundary + docs foundation | ✅ Done |
| B | Workspace + shared protocol | ✅ Done |
| C | Realtime room server | ✅ Done |
| D | Chrome extension shell | ✅ Done |
| E | YouTube MVP | 🚧 public test build released; multi-user validation ongoing |
| F | Sync quality + drift correction | ✅ Done |
| G | Private group hardening | 🚧 initial hardening done |
| H | Crunchyroll connector | 🚧 code done; real-page validation pending |
| I | Open-source readiness | 🚧 public repo/release done; store polish pending |
| J | Netflix / Prime Video technical spikes | 💡 Backlog |

---

## Detail

- ✅ **A - Product boundary + docs foundation**: product strategy, sync-only legal boundary,
  architecture, privacy/compliance, provider policy, design system, and roadmap are documented.
  Specs live in `docs/specs/`; `CLAUDE.md` defines implementation conventions.

- ✅ **B - Workspace + shared protocol**: pnpm workspace scaffolded with `extension/`, `server/`,
  and `packages/protocol/`. The protocol package owns shared Zod schemas, room/player types,
  sync timing helpers, drift classification, clock-offset math, and permission helpers. Biome,
  TypeScript strict mode, Vitest, and CI are configured.

- ✅ **C - Realtime room server**: `server/` runs Node.js + TypeScript + Socket.IO. It supports
  room create/join, ephemeral in-memory rooms, friend/host mode authorization, ready state,
  member state reports, scheduled playback commands, disconnect handling, room expiry, health
  check, Docker, and tests for core room rules.

- ✅ **D - Chrome extension shell**: `extension/` uses WXT + Manifest V3 + React. Implemented:
  background service worker, content script, popup UI, options UI, server URL settings, debug
  toggle, active-tab detection, room create/join/leave, ready state, play/pause controls,
  in-page overlay, and provider adapter lifecycle.

- 🚧 **E - YouTube MVP**: code exists for YouTube video-id detection, primary local video element
  control, playback state reads, play/pause/seek/rate operations, SPA route observation, room
  membership, and command application. Public release `v0.2.0` supports both `youtube.com` and
  `www.youtube.com`. **Remaining:** validate with two Chrome profiles or two computers on real
  YouTube pages, including join, reload, route change, pause, seek, and reconnect.

- ✅ **F - Sync quality + drift correction**: server-scheduled commands use `issuedAt` and
  `applyAt`; clients estimate server offset with ping/pong; late commands calculate target
  position from elapsed server time; small drift uses playback-rate nudges; large drift and
  paused drift use seek. The debug overlay can show server offset.

- 🚧 **G - Private group hardening**: initial hardening is done: room errors, unsupported provider
  states, stale member cleanup, in-memory TTLs, reconnect snapshot request, member list, status
  badges, and manual unpacked-extension workflow. **Remaining:** host transfer, better debug log
  export, clearer provider mismatch recovery, and real multi-user soak testing.

- 🚧 **H - Crunchyroll connector**: initial connector exists using the same local-player adapter
  model. It respects the sync-only boundary and does not touch accounts, cookies, sessions, or
  DRM. **Remaining:** validate on real Crunchyroll episode pages with normal logged-in playback
  and document any fragility.

- 🚧 **I - Open-source readiness**: initial hygiene is done: `README.md`, `CONTRIBUTING.md`,
  `SECURITY.md`, MIT license, issue templates, PR template, CI, Docker Compose, `.env.example`,
  privacy/compliance spec, design-system spec, Render deployment docs, and GitHub Release
  `v0.2.0`. **Remaining:** screenshots/GIFs, manual install guide screenshots/polish, Chrome Web
  Store listing, and final project name.

- 💡 **J - Netflix / Prime Video technical spikes**: not committed product features. Investigate
  only whether clean local playback control is possible without violating the product boundary.
  If support requires account/session handling, DRM interaction, brittle UI automation, or
  service-limit workarounds, mark unsupported.

---

## Current verification

- ✅ `pnpm test` passes.
- ✅ `pnpm build` passes.
- ✅ `pnpm check` passes.
- ✅ `pnpm --filter @watch-party-sync/extension zip` produces `watch-party-sync-0.2.0-chrome.zip`.
- ✅ GitHub Release `v0.2.0` is published with the Chrome zip artifact.
- ✅ Markdown relative links validate.
- ✅ Repo-authored text is ASCII except intentional roadmap/status icons.
- 🚧 Manual YouTube browser validation with real provider pages.
- ⬜ Multi-user test across separate machines.

---

## Next / open

- 🚧 Validate YouTube join with two Chrome profiles or two computers on `v0.2.0`.
- 🚧 Validate room sync through real play, pause, seek, reload, and reconnect flows over Render.
- 🚧 Validate Crunchyroll with normal logged-in playback.
- ⬜ Add screenshots/GIFs after real validation.
- ⬜ Polish the manual install guide with screenshots.
- ⬜ Prepare Chrome Web Store listing and review submission.
- ⬜ Choose final project name.
- ⬜ Decide whether host transfer is needed for the friend group.

## Backlog / ideas

- 💡 Host transfer when host disconnects.
- 💡 "Pause request" button for host mode.
- 💡 Provider mismatch recovery UI.
- 💡 Export redacted debug logs for bug reports.
- 💡 Richer overlay with member drift and current room mode.
- 💡 Local Generic HTML5 demo/test page.
- 💡 Firefox support after Chrome MVP is stable.
- 💡 Redis adapter for multi-instance server scaling if a public service ever exists.
- 💡 Public room directory only for non-streaming/public-domain use cases, not planned now.

## Out of scope (deliberate)

- ⛔ Streaming media between users.
- ⛔ Downloading media.
- ⛔ Capturing, recording, proxying, or retransmitting provider content.
- ⛔ Sharing accounts, credentials, cookies, auth tokens, sessions, or browser profiles.
- ⛔ Bypassing DRM, paywalls, geoblocking, household rules, or simultaneous-stream limits.
- ⛔ Automating provider login or account management.
- ⛔ Voice chat or text chat; use Discord.
- ⛔ Mobile apps.
- ⛔ Public hosted SaaS with user accounts, billing, or public rooms.
