# Watch Party Sync — landing page

Static marketing/download page for the Watch Party Sync extension. Vite + Tailwind v4.

This is a **standalone** project (its own pnpm root), separate from the extension/server monorepo.

```bash
cd site
pnpm install
pnpm dev       # local preview
pnpm build     # outputs static site to dist/
```

Deploy `dist/` to any static host (GitHub Pages / Cloudflare Pages). `vite.config.ts` uses a
relative `base` so it works under a project subpath like `/watch-party-sync/`.
