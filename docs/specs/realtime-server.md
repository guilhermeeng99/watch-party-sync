# Realtime Server Spec

> **Status**: Implemented initial
> **Last updated**: 2026-06-02
> **Environment**: server
> **Coverage**: MVP room server, in-memory state, Socket.IO transport, validation

The realtime server coordinates rooms. It validates events, tracks members, enforces room
control policy, and relays scheduled playback commands. It does not host, proxy, inspect, or
store media.

**Scope decisions**:

- **Self-hosted first:** friends can run it locally, on a VPS, or in Docker.
- **No database in MVP:** rooms live in memory and expire.
- **Socket.IO MVP:** simple rooms, reconnect behavior, and browser-friendly transport.
- **No public SaaS:** no accounts, billing, public room directory, or long-term user data.

---

## 1. Inputs / Outputs

| Input | Output | Notes |
|---|---|---|
| `room:create` | `room:snapshot` | Creates room, caller becomes host |
| `room:join` | `room:snapshot` + member updates | Validates room code and media policy |
| `control:request` | `control:apply` or error | Enforces room mode |
| `player:state` | member state update | Throttled and validated |
| disconnect | member stale/offline update | Room expires after TTL |

---

## 2. Server State

```ts
type Room = {
  code: string;
  createdAt: number;
  expiresAt: number;
  mode: "friend" | "host";
  hostMemberId: string;
  mediaKey?: MediaKey;
  members: Map<string, RoomMember>;
  lastCommand?: PlaybackCommand;
};

type RoomMember = {
  memberId: string;
  socketId: string;
  displayName: string;
  role: "host" | "member";
  ready: boolean;
  connected: boolean;
  providerId?: ProviderId;
  mediaKey?: MediaKey;
  lastState?: PlayerState;
  joinedAt: number;
  lastSeenAt: number;
};
```

No media content, cookies, credentials, or account data may appear in server state.

---

## 3. Business Rules

1. **Room code generation** - room codes must have enough entropy for private use and avoid
   ambiguous characters if human typed.
2. **Host assignment** - the creator is host. If host leaves, MVP may either close the room or
   transfer host to the oldest connected member. The chosen behavior must be explicit before
   implementation.
3. **Room expiry** - empty rooms expire quickly; inactive rooms expire after a configurable TTL.
4. **Media lock** - first ready member or host sets the room media key. Later mismatches are
   rejected or require host confirmation.
5. **Friend mode** - any ready connected member may request play/pause/resume. Large seek and
   mode changes require host.
6. **Host mode** - only host may control playback. Members may request pause.
7. **Scheduled commands** - server fills `issuedAt` and `applyAt` before broadcasting.
8. **Validation** - malformed events are rejected and never broadcast.
9. **Rate limiting (PLANNED)** - rate-limiting of noisy state reports and repeated control
   requests per socket/member is future work; the server does **not** rate-limit today.
10. **No persistence** - MVP does not write room events to disk or database.
11. **Command reason** - the server currently issues playback commands only with reason
    `"user"`; the `drift`, `join`, and `reconnect` reason values exist in the schema but are
    reserved and not emitted server-side yet.

---

## 4. Configuration

| Option | Type | Default | Effect |
|---|---|---|---|
| `PORT` | number | `8787` | HTTP/WebSocket port |
| `ROOM_TTL_SECONDS` | number | `21600` | Maximum room lifetime |
| `EMPTY_ROOM_TTL_SECONDS` | number | `300` | Cleanup delay after last disconnect |
| `COMMAND_DELAY_MS` | number | `1500` | Default future `applyAt` delay |
| `CORS_ORIGIN` | string | `*` | Allowed clients |
| `LOG_LEVEL` | enum | `info` | Parsed but currently unused (reserved for future log-level control) |

---

## 5. Permissions & Privacy

Data received:

- Room code.
- Member id.
- Display name.
- Provider id.
- Media key.
- Playback state.
- Control events.
- Timing measurements.

Data forbidden:

- Cookies.
- Credentials.
- Auth tokens.
- Payment/account details.
- DRM material.
- Media bytes.
- Full browsing history.

Logging:

- Do not log raw socket payloads in production.
- Redact room codes in public bug reports.
- Do not log URLs unless normalized to the minimum media key.

---

## 6. Performance / Reliability

- A single small VPS should handle a private group easily.
- Room operations are in memory and should be O(members).
- Server should tolerate client reconnect by member id plus short-lived resume token.
- If a member reconnects, send `room:snapshot` before accepting player state.
- Broadcast player state changes only when useful; avoid echo storms.

---

## 7. API / Transport

Initial transport: Socket.IO namespace `/rooms`.

Events are specified in [sync-protocol.md](sync-protocol.md). Server must validate every
client event with the shared schema.

Health endpoint:

```text
GET /health -> 200 { "ok": true }
```

---

## 8. Edge Cases

| Scenario | Expected behavior |
|---|---|
| Join unknown room | Error: `room_not_found` |
| Join expired room | Error: `room_expired` |
| Malformed event | Error: `invalid_payload`, no broadcast |
| Non-host sends host-only command | Error: `forbidden` |
| Host disconnects | Apply documented host-transfer or room-close policy |
| Server restarts | Rooms are lost in MVP; clients show disconnected/room gone |

---

## 9. Testing Checklist

- [ ] Room create/join/leave lifecycle.
- [ ] Room code collision handling.
- [ ] Friend mode permissions.
- [ ] Host mode permissions.
- [ ] Media mismatch handling.
- [ ] Invalid payload rejection.
- [ ] Scheduled command timestamps.
- [ ] Room TTL cleanup.

---

## 10. Out Of Scope

- Persistent accounts.
- Database-backed room history.
- Public hosted service.
- Federation or peer-to-peer transport.
- Redis scaling before it is needed.
