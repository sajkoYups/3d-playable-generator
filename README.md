# Forge — 3D Playable Ads Generator

Visual editor for HTML5 playable ads built with Three.js. Pick a locked 3D engine, dress the start / gameplay / end screens, upload creatives, and export a single HTML file (or a zip of network-wrapped variants).

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4, Prisma 7 + Postgres, Better Auth, Zustand, Zod, Three.js 0.185, esbuild.

## Quick start

```bash
docker compose up -d
cp .env.example .env
# edit BETTER_AUTH_SECRET
npm install
npx prisma db push
npm run models:generate
npm run dev
```

Postgres is mapped to **5433** so it does not collide with the 2D editor on 5432.

Open `http://localhost:3000`. Signup is invite-only. Add your email to `PLATFORM_ADMIN_EMAILS`, then:

```bash
npm run bootstrap-admin -- you@example.com 'a-strong-password' 'Your Name'
```

Sign in, open **Admin**, create a company, and copy the owner invite link. Existing accounts were backfilled into their own company (`npm run db:backfill-organizations`).

## Templates

| Id | Game |
|---|---|
| `stack-tower` | Drop and stack blocks (procedural geometry) |
| `triple-match` | Tap matching items into a 7-slot bar |
| `lane-runner` | Swipe lanes, dodge, reach a distance |
| `parking-jam` | Drag cars out of a jammed lot |

Gameplay code is locked. Users customize overlays, colors, camera, lighting, audio, difficulty, and uploaded models/textures.

## Architecture

- `src/types/project.ts` — Zod manifest (`ProjectData`) stored as JSON
- `src/playable-runtime/` — framework-agnostic player, engines, audio, network adapters. **No React imports.**
- Editor preview mounts that runtime through a thin React wrapper
- Export runs the same files through esbuild and inlines assets as data URIs

## Export networks

Generic HTML, Google Ads (`ExitApi`), Meta (`FbPlayableAd`), AppLovin (MRAID), Unity, ironSource (dapi), Mintegral, TikTok. Size limits are enforced per adapter (2–5 MB).

## Adding an engine

See `AGENTS.md`.
