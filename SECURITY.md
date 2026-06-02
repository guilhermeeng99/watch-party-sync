# Security Policy

## Product Boundary

Watch Party Sync synchronizes playback controls only. Security reports involving media
capture, cookie/session sharing, credential handling, DRM bypass, account-limit bypass, or
content downloading are treated as out-of-scope feature requests unless they expose a bug in
the existing sync-only implementation.

## Report A Vulnerability

Open a private report if the repository host supports it, or contact the maintainer directly.
Include:

- Affected version or commit.
- Browser and OS.
- Steps to reproduce.
- Expected and actual behavior.
- Any logs with room codes, names, and URLs redacted.

## Sensitive Data

The extension and server should never collect:

- Cookies.
- Credentials.
- Auth tokens.
- Payment/account details.
- DRM material.
- Video/audio/subtitle bytes.
