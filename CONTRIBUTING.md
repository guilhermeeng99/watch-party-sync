# Contributing

Watch Party Sync is a sync controller for official players. Contributions must preserve that
boundary.

## Before Coding

1. Read [CLAUDE.md](CLAUDE.md).
2. Read the relevant spec in [docs/specs](docs/specs).
3. Update the spec first if behavior changes.

## Local Setup

```bash
pnpm install
pnpm build
pnpm test
```

Run the server:

```bash
pnpm dev:server
```

Run the extension:

```bash
pnpm dev:extension
```

Then load the generated unpacked extension from `extension/.output/chrome-mv3`.

## Rules

- Do not add streaming, downloading, media capture, cookie access, credential access, or DRM
  workarounds.
- Do not request broad host permissions without a spec update.
- Keep provider-specific code inside provider adapters.
- Validate socket payloads at runtime.
- Use the design system in [docs/specs/design-system.md](docs/specs/design-system.md).

## Checks

```bash
pnpm test
pnpm build
pnpm check
```
