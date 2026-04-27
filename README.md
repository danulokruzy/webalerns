# Donatelko (UAH / CryptoBOT / TonPay + TikTok Runtime)

## Launcher modes

Run:
`launcher.cmd`

Options:
1. Setup (install deps + DB + env)
2. Dev public page (hot reload)
3. Dev dashboard (hot reload)
4. Build production bundle
5. Start production server
6. TikTok runtime only (events + triggers)
7. Full dev stack (site + TikTok runtime)

## TikTok in this project

No separate toolkit is required for normal workflow.
TikTok events are handled by:
`scripts/tiktok-runtime.cjs`

Runtime behavior:
- reads `tiktokUsername` from `Dashboard -> Connections`
- connects to TikTok LIVE with `tiktok-live-connector`
- forwards events to `/api/tiktok/events`
- supports `gift`, `subscribe`, `like`, chat commands starting with `!`

## Payment and dashboard

Main app still runs as Next.js + Prisma + SQLite.
Use options 2/3 for development and 4/5 for production flow.
