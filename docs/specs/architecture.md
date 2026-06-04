# Architecture & Decision Records

> **Status**: Living document
> **Last updated**: 2026-06-02
> Cross-cutting design and rationale. Feature-level contracts live in sibling specs.

## 1. System Shape

Watch Party Sync is a Chrome extension plus a small self-hosted realtime server.

```text
          Chrome tab with official player
                    |
                    v
      extension content script + provider adapter
                    |
                    v
       extension background service worker
                    |
              Socket.IO / WebSocket
                    |
                    v
         self-hosted realtime room server
                    |
                    v
       other members' extension clients
```

The extension runs beside the official player and controls only local playback. The server
relays validated room events and scheduled playback commands. The server never receives media
content.

Current repo shape:

```text
extension/
  entrypoints/
    background.ts       # service worker: socket connection, clock sync, room recovery (sync client lives here)
    content.ts          # provider detection, page bridge, command application
    popup/              # React popup UI
    options/            # React options UI
  src/providers/        # ProviderAdapter implementations
  src/sync/             # apply-command.ts (drift correction) + room-emit.ts (socket emit/ack helpers)
  src/ui/               # overlay.ts (vanilla shadow-root overlay only)
  src/shared/
server/
  src/index.ts
  src/config/
  src/rooms/
  src/transport/
packages/protocol/
  src/
docs/
  ROADMAP.md
  specs/
```

The realtime sync client (socket connection, clock sync, room snapshot recovery) lives in
`entrypoints/background.ts`. `src/sync/` holds only drift correction (`apply-command.ts`) and
low-level socket emit/ack helpers (`room-emit.ts`). The popup and options React UI live under
`entrypoints/popup/` and `entrypoints/options/`; `src/ui/` contains only the vanilla-DOM
shadow-root overlay (`overlay.ts`).

---

## ADRs

### ADR-001: Sync-only product boundary

**Status:** Accepted - 2026-06-02

**Context.** The problem is friends losing synchronization while each watches from home. The
tempting but wrong solution would be to stream/proxy content or share sessions.

**Decision.** The project only synchronizes playback controls on official players. It never
provides access to content.

**Consequences.**

- Keeps the project focused and technically smaller.
- Avoids handling copyrighted media, credentials, cookies, DRM, or account sharing.
- Users still need valid access to the content through the service they are using.
- Some services may remain unsupported if their player cannot be controlled cleanly.

### ADR-002: Chrome extension first

**Status:** Accepted - 2026-06-02

**Context.** YouTube can be embedded or controlled through official APIs in some contexts, but
Netflix, Prime Video, and Crunchyroll cannot be reliably embedded into a normal website.

**Decision.** Build a Chrome extension as the primary client. Chrome is the only target for
the MVP because the friend group uses Chrome.

**Consequences.**

- The extension can run on provider pages where users already watch.
- Manifest V3 service-worker lifecycle must be handled.
- Host permissions and store policy matter.
- Firefox/Edge support is deferred.

### ADR-003: WXT + TypeScript + React

**Status:** Accepted - 2026-06-02

**Decision.** Use WXT for the extension scaffold, TypeScript for all extension code, and React
for popup/options/overlay UI.

**Consequences.**

- Modern extension structure without hand-rolling build plumbing.
- Easy split between background, content scripts, popup, and options.
- React is useful for room/member status UI.
- Provider logic must remain outside React components.

### ADR-004: Self-hosted Node.js realtime server

**Status:** Accepted - 2026-06-02

**Decision.** Use Node.js + TypeScript + Socket.IO for the MVP server. Rooms are in memory.
No database in the MVP.

**Consequences.**

- Simple to run locally, on a VPS, or in Docker.
- Socket.IO gives rooms, reconnection, and fallback behavior.
- In-memory rooms are enough for private use.
- Multi-instance scaling needs Redis later.

### ADR-005: Provider adapters isolate fragile code

**Status:** Accepted - 2026-06-02

**Context.** Streaming sites change DOM/player internals. A brittle selector in one provider
must not infect the rest of the app.

**Decision.** All provider-specific playback work goes behind a `ProviderAdapter` contract.
The sync engine only talks to the contract.

**Consequences.**

- YouTube can be stable while Netflix/Prime remain experimental.
- Provider bugs are easier to disable.
- Tests can use a fake provider adapter.
- A provider can report `unsupported` without breaking the room.

### ADR-006: Scheduled commands and room clock

**Status:** Accepted - 2026-06-02

**Context.** A naive "send play now" event creates visible drift because every client receives
and applies it at a slightly different time.

**Decision.** The server emits commands with `issuedAt` and `applyAt`. Clients estimate server
time and apply commands at the scheduled local time.

**Consequences.**

- Better synchronization across different network latency.
- Requires clock sync and command buffering.
- Debug UI should show estimated drift and offset.

### ADR-007: No telemetry or accounts in MVP

**Status:** Accepted - 2026-06-02

**Decision.** No account system, analytics, or persistent room history in the MVP.

**Consequences.**

- Smaller privacy surface.
- Easier self-hosting.
- Room codes are temporary.
- Abuse controls are basic until a public service exists.

### ADR-008: GitHub release before Chrome Web Store

**Status:** Accepted - 2026-06-02

**Decision.** Validate the first versions through GitHub Release zip artifacts loaded manually
as an unpacked extension. Chrome Web Store submission is later work after public testing is
stable.

**Consequences.**

- Faster iteration.
- Store review is not a blocker for the public test release.
- Permission and privacy docs should still be written as if store review will happen.

---

## Cross-Cutting Concerns

### Permissions

Request narrow host permissions for supported providers only. Do not request `<all_urls>` for
the MVP. Add a provider only when there is a matching spec and a reason for each permission.

### Privacy

The server may receive room code, member id, display name, provider id, media key, playback
state, and control events. It must not receive cookies, credentials, auth tokens, account data,
or media bytes.

### Reliability

The extension must handle:

- Single-page app route changes.
- Player not ready yet.
- Tab reload.
- Background service worker suspension/restart.
- Socket reconnect.
- Room snapshot recovery.

### Security

Validate all socket payloads on the server. Reject commands from members who lack permission
for the current room mode. Rate-limiting of noisy events such as state reports and control
requests is **planned / not yet implemented** — the server does no per-socket or per-member
rate limiting today.

### Provider Support Policy

Provider support means "the extension can control the local official player when the user is
already authorized to watch." It does not mean the project supports account sharing, session
sharing, DRM bypass, or simultaneous-stream-limit bypass.
