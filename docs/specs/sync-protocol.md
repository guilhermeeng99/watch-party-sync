# Sync Protocol Spec

> **Status**: Implemented initial
> **Last updated**: 2026-06-02
> **Environment**: both
> **Coverage**: room events, playback commands, clock sync, drift correction

The sync protocol defines how extension clients and the realtime server coordinate playback.
It sends state and commands only. It never sends media content or provider credentials.

**Scope decisions**:

- **Server-scheduled commands:** clients do not apply remote controls immediately.
- **Client-side drift correction:** each client corrects its own player based on the room
  command and measured state.
- **Shared schema:** event shapes should be shared between extension and server after code is
  scaffolded.

---

## 1. Core Types

```ts
type ProviderId =
  | "youtube"
  | "generic-html5"
  | "crunchyroll"
  | "netflix"
  | "prime-video";

type MediaKey = {
  providerId: ProviderId;
  id: string;
  url?: string;
  title?: string;
};

type PlayerState = {
  mediaKey: MediaKey;
  paused: boolean;
  currentTime: number;
  duration?: number;
  playbackRate: number;
  bufferedEnd?: number;
  capturedAt: number; // client estimated server time in ms
};

type PlaybackCommand = {
  commandId: string;
  type: "play" | "pause" | "seek" | "rate" | "sync";
  mediaKey: MediaKey;
  position: number;
  playbackRate: number;
  paused: boolean;
  issuedAt: number; // server time ms
  applyAt: number;  // server time ms
  issuerMemberId: string;
  reason: "user" | "drift" | "join" | "reconnect";
};
```

---

## 2. Client To Server Events

| Event | Payload | Purpose |
|---|---|---|
| `room:create` | display name, provider, media key, mode | Create room |
| `room:join` | room code, display name, provider, media key | Join room |
| `room:leave` | room code, member id | Leave room |
| `member:ready` | ready boolean, player state | Mark ready/unready |
| `player:state` | throttled `PlayerState` | Report local playback |
| `control:request` | desired action and position | Ask server to broadcast command |
| `clock:ping` | client send timestamp | Estimate server offset |
| `room:snapshot:request` | room code | Recover after reconnect |

---

## 3. Server To Client Events

| Event | Payload | Purpose |
|---|---|---|
| `room:snapshot` | full room state | Initial join/reconnect state |
| `room:member:update` | member patch | Ready/connected/state updates |
| `control:apply` | `PlaybackCommand` | Scheduled playback command |
| `clock:pong` | client timestamp, server timestamp | Clock sync |
| `room:error` | code, message | User-facing or debug error |
| `room:closed` | reason | Room expired/host closed/server reset |

---

## 4. Business Rules

1. **Commands are idempotent** - clients ignore duplicate `commandId` values.
2. **Commands are scheduled** - `applyAt` must be in the future when emitted by the server.
3. **Media keys must match** - a command applies only to the matching provider/media key.
4. **Pause converges exactly** - when paused, clients seek to the command position if needed.
5. **Play starts from target position** - clients seek if needed, then play at `applyAt`.
6. **Small drift uses rate nudge** - avoid visible seeks for small differences.
7. **Large drift uses seek** - if drift exceeds threshold, seek to target position.
8. **User control beats auto drift** - manual play/pause/seek creates a user command according
   to room mode; drift correction should not fight a fresh user command.
9. **Late command handling** - if a command arrives after `applyAt`, apply immediately and
   calculate target position from elapsed server time.
10. **Reconnect recovers from snapshot** - after reconnect, client requests snapshot before
   applying new commands.

---

## 5. Drift Correction

Initial thresholds:

| Drift | While playing | While paused |
|---|---|---|
| `<= 250 ms` | No correction | No correction |
| `251 ms` to `1500 ms` | Temporary playback-rate nudge | Seek |
| `> 1500 ms` | Seek | Seek |

Playback-rate nudge:

- If local client is behind, temporarily use up to `1.05x`.
- If local client is ahead, temporarily use down to `0.95x`.
- Restore requested playback rate after convergence.
- Never exceed provider-supported playback-rate limits.

Target position calculation:

```text
if command.paused:
  target = command.position
else:
  target = command.position + ((nowServerMs - command.applyAt) / 1000) * command.playbackRate
```

---

## 6. Clock Sync

Use ping/pong to estimate server offset.

```text
t0 = client send local time
t1 = server receive/send server time
t2 = client receive local time
rtt = t2 - t0
offset = t1 - (t0 + rtt / 2)
```

Rules:

- Keep a rolling sample set.
- Prefer low-RTT samples.
- Recompute periodically, initially every 20 seconds.
- Recompute immediately after reconnect.
- Debug overlay may show offset and RTT when enabled.

---

## 7. Options & Defaults

| Option | Type | Default | Effect |
|---|---|---|---|
| Command delay | milliseconds | `1500` | Time between broadcast and apply |
| State report rate | Hz | `2` while playing | Server/member visibility |
| Clock sync interval | seconds | `20` | Server offset refresh |
| Small drift threshold | ms | `250` | No-op window |
| Large drift threshold | ms | `1500` | Seek window |
| Max rate nudge | number | `0.05` | `0.95x` to `1.05x` around target rate |

---

## 8. Permissions & Privacy

Protocol payloads must not include:

- Video bytes.
- Audio bytes.
- Cookies.
- Auth tokens.
- Account email/profile data.
- Payment data.
- DRM data.
- Full browser history.

Media keys should be minimal. Prefer stable provider ids over full URLs when available.

---

## 9. Edge Cases

| Scenario | Expected behavior |
|---|---|
| Client receives command for different media | Ignore and show mismatch warning |
| Command arrives late | Apply immediately using elapsed time |
| Player cannot seek yet | Queue command briefly, then error if still unavailable |
| Provider refuses playback | Report provider error; do not bypass |
| Tab goes inactive and timers throttle | Re-sync from state/snapshot when active |
| User manually seeks in friend mode | Broadcast if allowed; otherwise snap back or show forbidden state |

---

## 10. Testing Checklist

- [ ] Target position math for paused and playing states.
- [ ] Clock offset calculation.
- [ ] Duplicate command id ignored.
- [ ] Late command application.
- [ ] Drift threshold decisions.
- [ ] Friend mode control request flow.
- [ ] Host mode forbidden command flow.
- [ ] Reconnect snapshot flow.

---

## 11. Out Of Scope

- Frame-perfect synchronization.
- Audio/video capture.
- Peer-to-peer media transport.
- Voice chat.
- Chat messages.
