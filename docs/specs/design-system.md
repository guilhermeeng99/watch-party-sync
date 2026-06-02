# Design System Spec

> **Status**: Implemented initial
> **Last updated**: 2026-06-02
> **Coverage**: Theme, colors, typography, spacing, radius, elevation, extension UI, overlay,
> accessibility
> **Source of truth**: `extension/src/styles.css` and React UI entrypoints.

Watch Party Sync uses the same foundation as Toolzy's design system: bright paper, deep
indigo text, one confident action blue, slate secondary text, soft shadows, Montserrat, and an
8px spacing grid. This project adapts that system for a compact browser extension popup and a
small in-page overlay.

**Scope decisions**:

- **Light theme only in V1.** Dark mode is backlog.
- **Montserrat replaces Gilroy.** Gilroy is commercial; Montserrat is open-source and close in
  feel.
- **Compact density for extension UI.** The popup uses smaller cards, tighter spacing, and
  stable controls.
- **No decorative gradients/orbs.** The product is an operational sync tool, so the UI should
  be quiet and scannable.
- **Tailwind v4 tokens.** Tokens live in CSS; components use utilities/tokens, not raw hex.

---

## 1. Font Decision

Toolzy keeps the token name `--font-gilroy` while loading Montserrat. Keep the same naming so
components can share vocabulary:

```css
--font-gilroy: "Montserrat", ui-sans-serif, system-ui, sans-serif;
```

Weights:

- 400 body.
- 500 secondary controls.
- 600 buttons and section titles.
- 700 high-emphasis headings.

No other type families in V1.

---

## 2. Color Tokens

Use token utilities, never raw hex in component code.

| Token | Hex | Role |
|---|---|---|
| `midnight-indigo` | `#0B3558` | Headings, primary text, icons |
| `action-blue` | `#006BFF` | Primary action, active state, focus ring |
| `glacier-blue` | `#004EBA` | Informational badge text |
| `slate-blue` | `#476788` | Secondary text, inactive icons |
| `steel-gray` | `#A6BBD1` | Disabled text and low-emphasis metadata |
| `platinum-tint` | `#D4E0ED` | Field borders, subtle dividers |
| `outline-gray` | `#E6E6E6` | Hairline borders |
| `pale-gray` | `#E7EDF6` | Badge fills, soft panels |
| `cloud-mist` | `#F8F9FB` | Popup background |
| `snow-white` | `#FFFFFF` | Card and surface background |
| `text-black` | `#0A0A0A` | Body fallback |
| `success` | `#1A7F4B` | Connected, ready, saved |
| `danger` | `#C2362F` | Error, disconnected, blocked |
| `warning` | `#A15C00` | Drift warning, provider mismatch |

Rules:

- `action-blue` is the only CTA color.
- `success`, `danger`, and `warning` are status colors only.
- Do not create a one-note blue interface. Use white, cloud, slate, and semantic colors to
  keep the UI calm.

---

## 3. Typography

| Utility | Size | Line height | Use |
|---|---|---|---|
| `text-caption` | 12px | 1.4 | metadata, status labels |
| `text-body` | 14px | 1.6 | popup default |
| `text-body-lg` | 16px | 1.55 | important labels |
| `text-subheading` | 18px | 1.45 | panel headings |
| `text-heading` | 22px | 1.25 | popup title |
| `text-heading-lg` | 28px | 1.15 | options/docs pages |

Letter spacing stays normal. Do not scale font size with viewport width.

---

## 4. Spacing

Base unit: 8px.

Common values:

- Popup outer padding: 12px.
- Popup card padding: 12px.
- Overlay padding: 8px to 12px.
- Control gap: 6px to 8px.
- Section gap: 10px to 12px.
- Options page section gap: 24px.

Avoid large marketing-page spacing inside the extension popup.

---

## 5. Radius

Cards in this project should stay at 8px or less unless a browser-native surface benefits from
a slightly larger radius.

| Element | Value | Utility intent |
|---|---|---|
| Small controls | 4px | compact inputs, badges |
| Buttons | 8px | primary/secondary controls |
| Popup cards | 8px | room/member panels |
| Overlay | 8px | in-player surface |
| Pills/badges | 999px | short statuses only |

This intentionally differs from Toolzy desktop cards (`rounded-2xl`) because extension UI is a
compact tool surface, not a landing page or broad desktop canvas.

---

## 6. Elevation

Use restrained shadows:

| Intent | Shadow |
|---|---|
| Popup card | `0 8px 24px rgba(71, 103, 136, 0.14)` |
| Overlay | `0 10px 28px rgba(11, 53, 88, 0.22)` |
| Hover lift | `0 6px 18px rgba(71, 103, 136, 0.18)` |

Do not stack cards inside cards. Use section dividers inside a single panel when needed.

---

## 7. Components

### Button

Primary:

- Background `action-blue`.
- Text `snow-white`.
- 8px radius.
- 40px minimum hit target.
- Icon plus text when the action benefits from quick recognition.

Secondary:

- White background.
- `platinum-tint` border.
- `midnight-indigo` text.

Icon button:

- 36px square minimum.
- Use lucide icons when React UI is scaffolded.
- Tooltip/title for ambiguous icons.

### Card / Panel

Use cards for actual framed tool surfaces only:

- Popup root sections.
- Room status.
- Member list.
- Error panel.

Do not put a card inside another card.

### Badge

Compact, status-specific:

- Ready: success text with pale success background.
- Waiting: slate text with pale-gray background.
- Error: danger text with pale danger background.
- Drift: warning text with pale warning background.

### Input

- 40px height.
- 8px radius.
- `platinum-tint` border.
- Focus ring `action-blue`.
- Room code text may use tabular numbers.

---

## 8. Popup Layout

Popup target width: 360px to 380px. Max height should stay around 560px so the extension does
not feel like a clipped page in Chrome's popup surface.

```text
Header: logo/name + connection badge
Provider panel: current site/video + ready state
Room panel: create/join/leave, room code, mode
Members: compact rows with ready/host/connected status
Controls: play/pause/seek only when useful and allowed
Footer: server URL shortcut/debug toggle
```

State should be visible at a glance:

- Not connected.
- Connected, no supported tab.
- Supported tab, no room.
- In room, waiting for members.
- Synced.
- Reconnecting.
- Provider blocked/unsupported.

---

## 9. Overlay Layout

Overlay should be small and avoid covering player controls.

Default position: top-right with a draggable/future-position option deferred.

Content:

- Room code or synced label.
- Member readiness count.
- Paused-by marker.
- Debug drift/RTT only when debug mode is on.

Overlay must not include long instructional text.

---

## 10. Options Page Layout

The options page can use Toolzy's more spacious desktop layout:

- Centered max-width around 900px.
- White panels on `cloud-mist`.
- Sections for server URL, providers, debug, privacy note.
- No landing-page hero.

---

## 11. Accessibility

- Hit targets at least 40px except dense status-only chips.
- `focus-visible` ring for every interactive element.
- Do not rely on color alone; pair status color with label/icon.
- Body text uses high-contrast `midnight-indigo` or `text-black`.
- `steel-gray` is disabled-only.
- Overlay must not trap focus or block keyboard controls of the player.

---

## 12. Do / Don't

Do:

- Use Montserrat through `font-gilroy`.
- Keep extension UI dense, stable, and scannable.
- Use icons in control buttons.
- Keep status labels short.
- Prefer clear error states over silent failure.

Don't:

- Build a marketing landing page as the product UI.
- Use broad decorative gradients, orbs, or illustration-heavy panels.
- Use cards inside cards.
- Use large hero type inside popup panels.
- Use raw hex directly in components.

---

## 13. Out Of Scope

- Dark theme.
- Motion/animation system beyond small transitions.
- Full brand identity package.
- Landing page design beyond basic open-source documentation.
