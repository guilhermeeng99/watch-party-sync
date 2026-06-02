# Watch Party Sync - Project Conventions

Open-source Chrome extension plus a small self-hosted realtime server for synchronizing local
playback across friends. The extension controls official players already open in each user's
browser. It does not stream, proxy, download, unlock, or redistribute content.

See [README.md](README.md) for the product overview and
[docs/specs/architecture.md](docs/specs/architecture.md) for decision records.
Use [docs/specs/design-system.md](docs/specs/design-system.md) for UI decisions.

---

## Core Principles

1. **Sync playback, not content.** Only send playback state and commands. Never send media,
   cookies, credentials, account tokens, subtitles, or DRM-related data.
2. **Official players stay authoritative.** The extension may control play/pause/seek/rate on a
   page where the user is already allowed to watch. It must not bypass service access controls.
3. **Small permissions.** Request host permissions only for supported providers. Do not use
   broad permissions as a shortcut.
4. **Private by default.** No telemetry, analytics, tracking, or persistent server history in
   the MVP. Rooms are ephemeral.
5. **Provider adapters are isolated.** YouTube, Crunchyroll, Netflix, Prime Video, and generic
   HTML5 support must live behind a shared adapter contract.
6. **Sync quality is a product feature.** Playback should feel locked: scheduled commands,
   clock sync, drift correction, reconnection, and clear ready states matter.
7. **Discord remains voice.** Voice chat and chat are out of scope for the product MVP.

---

## Architecture

```text
extension/
  entrypoints/
    background.ts       # MV3 service worker: room connection, tab routing, keepalive
    content.ts          # provider detection, page bridge, overlay mount
    popup/              # create/join room, status, controls
    options/            # server URL, debug toggles, advanced settings
  src/
    providers/          # ProviderAdapter implementations
    sync/               # room client, protocol types, clock sync, drift correction
    ui/                 # React components used by popup/options/overlay
    shared/             # typed helpers, validation, logging

server/
  src/
    protocol/           # shared event schemas and validation
    rooms/              # room lifecycle, members, modes, authority
    transport/          # Socket.IO setup
    config/             # env parsing

docs/
  ROADMAP.md
  specs/
```

Layer rules:

- **Provider adapters** own provider-specific page details. Other code cannot query random DOM
  selectors or player globals directly.
- **Sync client** owns realtime connection, protocol events, clock sync, and drift correction.
- **UI** owns display and user actions only. It calls typed sync/provider APIs.
- **Server** relays and validates room events. It never sees media content and does not persist
  room history in the MVP.
- **Shared protocol types** should be generated or imported from one package once the repo is
  scaffolded. Do not duplicate event shapes manually.

---

## Provider Adapter Contract

Each provider implements the contract described in
[docs/specs/provider-connectors.md](docs/specs/provider-connectors.md).

```ts
interface ProviderAdapter {
  id: ProviderId;
  detect(): Promise<DetectionResult>;
  getMediaKey(): Promise<MediaKey>;
  getState(): Promise<PlayerState>;
  play(at?: number): Promise<void>;
  pause(at?: number): Promise<void>;
  seek(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  subscribe(listener: PlayerEventListener): Unsubscribe;
  dispose(): void;
}
```

Rules:

- Return an unsupported state when the player cannot be controlled. Do not force interaction
  through brittle UI click automation unless a spec explicitly accepts that provider risk.
- Never read or export cookies, localStorage auth values, account details, payment details, or
  DRM internals.
- Media identity should be the minimum useful key: provider plus video/episode id where
  available, or normalized URL when no stable id exists.
- Route changes in single-page apps must trigger re-detection.

---

## Sync Model

Use a room clock and scheduled commands, not "send play now".

- Client estimates server time through periodic ping/pong.
- Server emits commands with `issuedAt` and `applyAt`.
- Clients apply commands at the scheduled local time.
- Small drift is corrected by temporary playback-rate nudges.
- Large drift is corrected by seek.
- Paused state should converge exactly.

Detailed thresholds and events live in [docs/specs/sync-protocol.md](docs/specs/sync-protocol.md).

---

## Room Modes

MVP should support two policy modes:

- **Host mode:** host controls play, pause, seek, and rate. Members can mark ready and request
  pause.
- **Friend mode:** any member can pause/resume. Host still owns destructive changes such as
  large seek, media change, mode change, or host transfer.

Default for private friend usage: **Friend mode**.

---

## Code Style

- TypeScript strict mode.
- Functions: generally 5 to 25 lines.
- Files: prefer under 400 to 600 lines.
- Prefer early returns over nested branching.
- Use exact names: `roomCode`, `mediaKey`, `driftMs`, `applyAt`, `providerAdapter`.
- Avoid generic names like `data`, `manager`, `handler`, `utils` when a domain name is clearer.
- Runtime boundary data must be validated with schemas, not trusted from raw socket payloads.

---

## UI Style

- Follow [docs/specs/design-system.md](docs/specs/design-system.md).
- Use Montserrat through the `font-gilroy` token.
- Keep popup UI compact: stable 360px to 400px width, 8px radius, 40px hit targets.
- Use `action-blue` only for primary actions and focus rings.
- Use cards only for actual tool panels. Do not put cards inside cards.
- Use icons for common controls where a recognizable icon exists.
- Do not add marketing-style hero sections inside the extension.

---

## Comments

- Explain why a provider workaround exists.
- Explain timing math and drift thresholds.
- Do not narrate obvious assignments or JSX structure.
- Provider-specific fragility should be documented near the adapter and in its spec.

---

## Commands

```bash
pnpm install
pnpm dev:extension
pnpm dev:server
pnpm build
pnpm test
pnpm check
```

Load the unpacked Chrome extension from `extension/.output/chrome-mv3` after `pnpm
dev:extension` or `pnpm --filter @watch-party-sync/extension build`.

---

## Post-Change Checklist

After every behavior change:

1. Run the relevant unit tests.
2. Build the touched package.
3. Run Biome check/format.
4. If protocol changed, update [docs/specs/sync-protocol.md](docs/specs/sync-protocol.md).
5. If a provider changed, update [docs/specs/provider-connectors.md](docs/specs/provider-connectors.md).
6. If permissions changed, update [docs/specs/privacy-and-compliance.md](docs/specs/privacy-and-compliance.md).
7. If scope moved, update [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Spec-Driven Development

Every major feature needs a spec before code. Use
[docs/specs/_template.md](docs/specs/_template.md).

Required sections:

- Overview and scope decisions.
- Inputs, outputs, and event contracts.
- Business rules.
- Permissions and privacy.
- UI states.
- Edge cases.
- Testing checklist.
- Out of scope.

---

## Privacy & Security

- No telemetry in MVP.
- No server-side room history.
- No account system until there is a documented reason.
- No secrets in client code except public configuration.
- No credentials, cookies, auth headers, DRM material, or localStorage tokens may be read,
  logged, transmitted, or stored.
- Server must validate room codes, member ids, event shapes, and control permissions.
- Extension must request narrow host permissions only for supported domains.

---

## Out of Scope

- Streaming or relaying media.
- Downloading media.
- Circumventing DRM, geoblocking, paywalls, household rules, or simultaneous-stream limits.
- Sharing accounts, sessions, cookies, or credentials.
- Voice chat and text chat.
- Mobile apps.
- Browser support beyond Chrome until the Chrome MVP is stable.
