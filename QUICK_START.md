# Quick Start

Project root:
- `C:\Users\tgkru\Documents\New project`

## Launcher
Run:
- `launcher.cmd`

Menu options:
1. Setup dependencies + Prisma + SQLite seed
2. Run public donation page
3. Run dashboard

## Direct Commands
From project root:
- `npm install`
- `npm run db:generate`
- `npm run db:push`
- `npm run db:seed`
- `npm run dev:site`
- `npm run build`

## Environment
Required files in root:
- `.env` (contains `DATABASE_URL`)
- `.env.local` (contains `NEXT_PUBLIC_PROJECT_ID`)

## Dashboard Access
Open:
- `/dashboard/login`

Default password from `.env`:
- `donatelko`

## Main Pages
- Public donate form: `/`
- Check waiting page: `/check/{id}`
- Dashboard setup: `/dashboard/setup`
- Widgets overlay: `/widget/{slug}`

## Payment Types (V1)
- `UAH` (Monobank jar link)
- `CryptoBOT` (USDT link flow)
- `TonPay` (TON link flow)
