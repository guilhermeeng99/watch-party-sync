# Browser Extension Spec

> **Status**: Implemented initial
> **Last updated**: 2026-06-02
> **Environment**: extension
> **Coverage**: Chrome MVP shell, popup, content script, provider bridge, overlay, permissions

The browser extension is the user's local client. It detects a supported player, joins a room,
applies scheduled playback commands, reports local state, and exposes a small UI for room
actions.

**Scope decisions**:

- **Chrome first:** only Chrome is supported in the MVP.
- **Manifest V3:** use a background service worker, not a persistent background page.
- **WXT scaffold:** use WXT to organize entrypoints and builds.
- **No account data:** the extension must not read or transmit auth/session data from provider
  pages.

---

## 1. Inputs / Outputs

| Input | Output | Notes |
|---|---|---|
| User opens supported video page | Provider detection result | Includes provider id and media key |
| User creates room | Room code and host membership | Server-generated code |
| User joins room | Member status and room snapshot | Requires same media or explicit warning |
| Server playback command | Local player action | Applied at scheduled local time |
| Local player event | Throttled state report | Sent to server |

---

## 2. Extension Components

```text
background service worker
  - Socket.IO connection
  - room state cache
  - tab routing
  - command scheduling
  - reconnect/snapshot recovery

content script
  - provider detection
  - provider adapter lifecycle
  - local player event subscription
  - overlay mount

page bridge
  - optional injected script for providers that require page-world access
  - narrow message channel back to the content script

popup UI
  - create room
  - join room
  - leave room
  - copy room code
  - member status
  - host/friend mode controls

options UI
  - server URL
  - debug mode
  - future provider enable/disable toggles
```

---

## 3. Contract

```ts
type ExtensionRuntimeState = {
  connected: boolean;
  activeTabId?: number;
  room?: RoomSnapshot;
  provider?: ProviderDetection;
  player?: PlayerState;
};

type ProviderDetection = {
  providerId: ProviderId;
  supported: boolean;
  reason?: string;
  mediaKey?: MediaKey;
};
```

Layer ownership:

- Background owns socket connection and room state.
- Content script owns provider lifecycle for one tab.
- Popup reads background state and dispatches user intents.
- Provider adapters own page-specific player access.

---

## 4. Business Rules

1. **No auto-join** - opening a video page never joins a room by itself.
2. **No auto-control before ready** - remote commands are ignored until the provider adapter
   reports a controllable player and the member has joined the room.
3. **Same media check** - joining a room with a different `mediaKey` should warn or block
   according to room policy.
4. **One active tab per room member** - if multiple supported tabs are open, the popup must let
   the user choose or use the active tab only.
5. **Route changes re-detect** - provider adapters must handle single-page navigation.
6. **Unsupported provider is explicit** - show a clear unsupported state, not a broken room UI.
7. **No credential access** - adapter code must not read cookies, auth headers, DRM internals,
   localStorage tokens, or account details.
8. **Local controls still work** - if a user presses pause in the official player, the adapter
   reports it and room policy decides whether to broadcast it.

---

## 5. Options & Defaults

| Option | Type | Values / range | Default | Effect |
|---|---|---|---|---|
| Server URL | string URL | http(s)/ws(s) | `https://watch-party-sync-server.onrender.com` | Realtime endpoint |
| Room mode | enum | `friend`, `host` | `friend` | Who can control playback |
| Debug overlay | boolean | true/false | false | Shows drift, offset, provider state |
| Provider enabled | boolean per provider | true/false | Future option | Allows disabling fragile adapters |

---

## 6. Permissions & Privacy

Initial host permissions are narrow:

| Provider | Host permission | Status |
|---|---|---|
| YouTube | `https://www.youtube.com/*`, `https://youtube.com/*` | MVP |
| Generic test pages | Local/dev only | Adapter exists; content-script wiring pending |
| Crunchyroll | `https://www.crunchyroll.com/*` | Initial implementation |
| Netflix | `https://www.netflix.com/*` | Experimental spike only |
| Prime Video | `https://www.primevideo.com/*` | Experimental spike only |

Forbidden:

- `<all_urls>` in MVP.
- Reading cookies or auth headers.
- Exporting localStorage/sessionStorage values.
- Capturing media streams.
- Injecting remote scripts.
- Downloading provider content.

---

## 7. Performance / Reliability

- Player state reports should be throttled, initially around 2 to 5 events per second while
  playing and lower while paused.
- Reconnect should request a fresh room snapshot before applying new commands.
- Background service worker keepalive must be handled for active WebSocket sessions.
- Content script should recover after page route changes and lazy player creation.
- Overlay should never block official player controls.

---

## 8. UI States

```text
No supported tab
  -> Supported tab, not connected
  -> Connected, no room
  -> In room, not ready
  -> Ready and synced
  -> Reconnecting
  -> Error
```

Popup should show:

- Provider and video identity.
- Room code.
- Member list.
- Ready state per member.
- Connection state.
- Current mode.
- Leave room.

Overlay should be optional and compact:

- Ready/member status.
- Paused-by marker.
- Drift/debug values only when debug mode is on.

---

## 9. Edge Cases

| Scenario | Expected behavior |
|---|---|
| Player appears after page load | Adapter waits/retries and then reports ready |
| User navigates to another episode | Adapter emits media change; room warns or leaves |
| Tab reloads | Background keeps room state; content reattaches |
| Socket reconnects | Request snapshot before applying commands |
| Provider blocks playback due account/plan limit | Show provider error; do not bypass |
| Multiple video elements exist | Adapter picks the primary visible player or reports ambiguous |

---

## 10. Testing Checklist

- [ ] Fake provider adapter can drive the sync client in unit tests.
- [ ] Popup renders disconnected, connected, in-room, ready, and error states.
- [ ] Content script handles delayed player creation.
- [ ] Route change re-detects media key.
- [ ] No forbidden fields are logged or sent.
- [ ] Manual YouTube create/join/play/pause/seek.

---

## 11. Out Of Scope

- Firefox and Safari.
- Mobile browsers.
- Chrome Web Store review/submission until public testing stabilizes.
- Voice or chat.
- Provider account management.
