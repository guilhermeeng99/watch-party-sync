# Provider Connectors Spec

> **Status**: Implemented initial
> **Last updated**: 2026-06-02
> **Environment**: extension
> **Coverage**: provider adapter contract and support policy

Provider connectors translate generic sync commands into local player operations on specific
websites. They are intentionally isolated because streaming websites change often.

**Scope decisions**:

- **Adapter contract first:** sync code never talks directly to provider DOM/player details.
- **YouTube first:** stable MVP target.
- **Paid services are incremental:** Crunchyroll after YouTube; Netflix and Prime Video are
  technical spikes until proven.
- **No account/session handling:** connectors do not read or manage user login state.

---

## 1. Support Matrix

| Provider | Status | Strategy | Risk |
|---|---|---|---|
| YouTube | Implemented; public test validation ongoing | HTML5 video element; stable media key from video id; `youtube.com` and `www.youtube.com` hosts | Low |
| Generic HTML5 | Adapter implemented and wired in the registry for localhost/127.0.0.1; demo page pending | Direct `<video>` control on local test/simple pages | Low |
| Crunchyroll | Initial implementation; real-page validation pending | HTML5 video element if accessible; route detection | Medium |
| Netflix | Backlog spike | Local player control only if accessible without bypass | High |
| Prime Video | Backlog spike | Local player control only if accessible without bypass | High |

Provider support means the local official player can already play the content and the adapter
can control standard playback. It does not imply any access workaround.

---

## 2. Adapter Contract

```ts
type ProviderDetection =
  | {
      supported: true;
      providerId: ProviderId;
      mediaKey: MediaKey;
      title?: string;
    }
  | {
      supported: false;
      providerId?: ProviderId;
      reason: string;
    };

// The DOM media event (or "interval" polling) that produced a state emission.
// Lets the content script tell deliberate user actions apart from passive polling.
type PlayerEventTrigger =
  | "play"
  | "pause"
  | "seeked"
  | "ratechange"
  | "loadedmetadata"
  | "durationchange"
  | "interval";

type PlayerEvent =
  | { type: "state"; state: PlayerState; trigger: PlayerEventTrigger }
  | { type: "mediachange"; mediaKey: MediaKey }
  | { type: "error"; code: string; message: string };

interface ProviderAdapter {
  id: ProviderId;
  detect(): Promise<ProviderDetection>;
  getMediaKey(): Promise<MediaKey>;
  getState(): Promise<PlayerState>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  subscribe(listener: (event: PlayerEvent) => void): () => void;
  dispose(): void;
}
```

---

## 3. Business Rules

1. **Detection is explicit** - adapter returns supported/unsupported with a reason.
2. **Media key is stable** - use provider ids when possible; normalized URL only when no stable
   id exists.
3. **Commands are local** - adapter controls only the current tab's player.
4. **No credential reads** - never read cookies, auth tokens, account profile data, or payment
   details.
5. **No DRM interaction** - never inspect or alter DRM internals.
6. **No stream capture** - never capture, record, download, or retransmit media.
7. **Route changes emit mediachange** - SPA navigation must update media identity.
8. **Unsupported beats brittle hacks** - if a provider cannot be controlled reliably, report
   unsupported instead of simulating random UI clicks.
9. **Provider errors surface clearly** - account/device-limit/provider errors are displayed,
   not bypassed.

---

## 4. Provider Notes

### YouTube

Initial target.

- Media key: YouTube video id.
- Player: primary visible `<video>` element on watch pages.
- Host coverage: `https://youtube.com/*` and `https://www.youtube.com/*`.
- Route changes: YouTube is a SPA; observe URL/media changes.
- Known risk: ads, autoplay restrictions, miniplayer, Shorts.

### Generic HTML5

Development/testing adapter.

- Media key: normalized URL plus video `src` if available.
- Useful for deterministic local tests.
- Not intended as broad `<all_urls>` support in the MVP.

### Crunchyroll

First paid-streaming target after YouTube.

- Media key: episode id or normalized episode URL.
- Player: primary local video element if accessible.
- Must respect service plan simultaneous-stream limits.
- No profile/account/session automation.

### Netflix

Backlog technical spike.

- Support is not promised.
- Any approach must stay within the product boundary.
- If local player control is blocked or too fragile, mark unsupported.
- No household, DRM, credential, cookie, or account-limit workarounds.

### Prime Video

Backlog technical spike.

- Same policy as Netflix.
- Support depends on clean local playback control.

---

## 5. Options & Defaults

| Option | Type | Default | Effect |
|---|---|---|---|
| Provider enabled | boolean | Future option | Allows disabling fragile adapters |
| Detection timeout | ms | `10000` | Time to wait for lazy player |
| State throttle | ms | `500` | Minimum interval between state reports |
| Route debounce | ms | `300` | Avoid duplicate mediachange events |

---

## 6. Permissions & Privacy

Each provider permission must be listed in
[privacy-and-compliance.md](privacy-and-compliance.md) before implementation.

Forbidden adapter behavior:

- `chrome.cookies` usage.
- Reading auth tokens from storage.
- Reading account details from the DOM unless purely visible display name is explicitly needed
  and documented. MVP should not need it.
- Media capture APIs.
- Remote code injection.
- Download APIs for provider content.

---

## 7. Performance / Reliability

- Adapter should avoid expensive DOM scans.
- Use observers sparingly and disconnect them in `dispose`.
- State polling should be throttled.
- Provider failure should be isolated to that tab/provider.
- A fake adapter should exist for sync protocol tests.

---

## 8. Edge Cases

| Scenario | Expected behavior |
|---|---|
| Ad or preroll video is active | Adapter should not mark main content ready until stable |
| Multiple video elements exist | Pick primary visible player or report ambiguous |
| Autoplay blocked | Show user gesture required |
| Provider changes DOM | Adapter reports unsupported/error; rest of app stays healthy |
| Playback blocked by account/device limits | Show provider blocked state; no bypass |
| User changes episode | Emit mediachange and room mismatch warning |

---

## 9. Testing Checklist

- [ ] Fake provider implements the full contract.
- [ ] YouTube detection extracts stable video id.
- [ ] YouTube route changes emit mediachange.
- [ ] `getState` returns current time, paused, duration, and rate.
- [ ] play/pause/seek/rate methods update the local player.
- [ ] Unsupported provider state renders correctly.
- [ ] Forbidden fields are not read, logged, or sent.

---

## 10. Out Of Scope

- Universal support for every streaming site.
- Support that depends on account/session sharing.
- Support that depends on DRM bypass.
- Automating login flows.
- Circumventing ads.
