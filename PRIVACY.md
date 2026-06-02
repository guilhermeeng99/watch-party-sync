# Privacy Policy

Last updated: 2026-06-02

Watch Party Sync synchronizes playback controls for official video players. It does not provide,
stream, download, proxy, capture, or redistribute video, audio, subtitles, accounts, sessions,
cookies, credentials, auth tokens, payment data, DRM data, or browsing history.

## Data Processed

When a user joins a room, the extension and the selected room server process only the data needed
to synchronize playback:

- room code;
- random member id;
- display name chosen by the user;
- supported provider id, such as `youtube` or `crunchyroll`;
- media identifier for same-video matching;
- playback state, including current time, paused/playing state, playback rate, duration, and
  timing samples used for clock/drift correction;
- operational error messages needed to show connection or provider failures.

## Storage

The Chrome extension stores local preferences in Chrome storage, including server URL, display
name, random member id, and debug preference.

The self-hosted MVP room server stores room state in memory only. It does not use a database,
analytics system, or persistent room history.

## Network

Users choose the room server URL. Playback metadata is sent only to that configured server and to
other members in the same room through that server.

## Data Not Collected

Watch Party Sync does not collect or transmit:

- video, audio, or subtitle content;
- cookies or browser sessions;
- usernames, passwords, or account credentials;
- payment information;
- DRM keys or private player internals;
- full browsing history;
- Discord data.

## User Responsibility

Each viewer must have legitimate access to the content in their own browser session. Watch Party
Sync does not bypass paywalls, DRM, geoblocking, household rules, account restrictions, device
limits, or simultaneous-stream limits.

## Contact

For issues or privacy questions, open an issue in the public repository:
https://github.com/guilhermeeng99/watch-party-sync
