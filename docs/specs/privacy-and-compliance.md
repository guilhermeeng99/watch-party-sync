# Privacy & Compliance Spec

> **Status**: Draft
> **Last updated**: 2026-06-02
> **Environment**: both
> **Coverage**: data boundaries, forbidden behavior, permissions, retention, logging

This project is safe only if the product boundary stays strict: synchronize playback controls
for official players, and never provide access to content.

**Scope decisions**:

- **No media handling:** the extension and server never capture, relay, store, proxy, or
  download video/audio/subtitle content.
- **No account handling:** the extension and server never read, store, or transmit credentials,
  cookies, auth tokens, payment data, or account settings.
- **No telemetry in MVP:** no analytics or persistent usage tracking.
- **Ephemeral rooms:** room state lives in memory only in the MVP.

---

## 1. Data Classification

Allowed data:

| Data | Example | Purpose | Stored? |
|---|---|---|---|
| Room code | `ABCD12` | Join room | Memory only |
| Member id | random uuid | Identify socket/member | Memory only |
| Display name | `Gui` | Member list | Memory only |
| Provider id | `youtube` | Match adapter | Memory only |
| Media key | YouTube video id or normalized episode URL | Same-video check | Memory only |
| Playback state | time, paused, rate, duration | Sync and drift correction | Memory only |
| Timing samples | RTT, offset | Clock sync | Memory only |
| Debug errors | code/message | Troubleshooting | Console/dev logs only |

Forbidden data:

| Data | Rule |
|---|---|
| Video/audio/subtitle bytes | Never read, transmit, store, or proxy |
| Cookies | Never read or transmit |
| Auth tokens | Never read or transmit |
| Account credentials | Never read, request, store, or transmit |
| Payment/account details | Never read or transmit |
| DRM keys or internals | Never inspect or alter |
| Full browsing history | Never collect |
| Discord data | Never integrate in MVP |

---

## 2. Compliance Boundary

The project must not:

1. Stream content from one user to another.
2. Download provider content.
3. Share accounts, sessions, cookies, or credentials.
4. Bypass DRM.
5. Bypass geoblocking.
6. Bypass paywalls.
7. Bypass household rules.
8. Bypass simultaneous-stream limits.
9. Hide or suppress provider account/device-limit errors.

The project may:

1. Detect whether a supported official player exists in the current tab.
2. Read minimal local playback state from that player.
3. Control local playback with play, pause, seek, and rate.
4. Send minimal playback state and room events to a server chosen by the user.
5. Show provider errors as user-facing unsupported/blocked states.

---

## 3. Browser Permissions

MVP permission principle: narrow and explainable.

| Permission | MVP need |
|---|---|
| `storage` | Save server URL and user preferences |
| `activeTab` | Inspect/control current supported tab after user action where possible |
| Specific host permissions | Run content scripts on supported providers |
| `tabs` | Only if required for active tab routing; prefer avoiding it |

Host permissions should be added per provider:

| Provider | Permission | Status |
|---|---|---|
| YouTube | `https://www.youtube.com/*`, `https://youtube.com/*` | MVP |
| Crunchyroll | `https://www.crunchyroll.com/*` | Initial implementation |
| Hosted room server | `https://watch-party-sync-server.onrender.com/*` | Public test default |
| Local room server | `http://localhost/*`, `http://127.0.0.1/*` | Local/self-hosted testing |
| Netflix | `https://www.netflix.com/*` | Spike only |
| Prime Video | `https://www.primevideo.com/*` | Spike only |

Avoid:

- `<all_urls>`.
- `cookies`.
- `webRequest` for provider auth/content.
- `downloads` for provider content.
- Media capture permissions.

---

## 4. Server Retention

MVP:

- Room state in memory only.
- No database.
- No room replay/history.
- No analytics.
- Logs should contain operational errors only.

Future persistent features require a new spec and explicit privacy review.

---

## 5. Logging & Redaction

Allowed in development logs:

- Event names.
- Provider id.
- Drift values.
- Connection status.
- Non-sensitive error codes.

Redact or avoid:

- Room codes in shared logs.
- Full URLs when a stable media id exists.
- Display names in public bug reports.
- Raw socket payloads.
- Any forbidden data listed above.

---

## 6. User-Facing Disclosures

README, extension UI, and future store listing should state:

- This tool syncs playback only.
- Each viewer needs legitimate access to the content.
- It does not share accounts or sessions.
- It does not bypass provider restrictions.
- Room server receives playback timing and room membership data.
- Voice/chat is expected to happen elsewhere, such as Discord.

---

## 7. Edge Cases

| Scenario | Required behavior |
|---|---|
| Provider says too many devices | Show blocked/provider error; do not work around it |
| User is logged out | Show provider/login required; do not automate login |
| Different users have different catalog/region access | Show mismatch/blocked state; do not bypass |
| Provider changes DRM/player behavior | Mark unsupported if clean local control fails |
| Bug report includes logs | Redact room code, URL, display names where possible |

---

## 8. Testing Checklist

- [ ] Static review for forbidden permission requests.
- [ ] Tests verify protocol schemas contain no forbidden fields.
- [ ] Logs do not include raw payloads in production mode.
- [ ] Provider adapters do not import cookie/auth APIs.
- [ ] UI shows provider blocked state without workaround suggestions.
- [ ] README and store-copy drafts include the sync-only disclosure.

---

## 9. Out Of Scope

- Legal advice.
- Terms-of-service enforcement beyond product boundaries.
- Account sharing support.
- Anti-detection or restriction bypass.
- Public SaaS compliance program.
