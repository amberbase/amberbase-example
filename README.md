# amberbase-example

Repository to showcase the Amberbase realtime database in real-life examples.

## Requirements

- Node.js 22.22.2 or newer
- MariaDB 10.6 or newer

## Development

This repo is a pnpm workspace covering `backend` and `ui`. Both link the Amberbase packages from a sibling checkout, so clone [amberbase](https://github.com/amberbase/amberbase) next to this repo and build it first (`pnpm install && pnpm -r run build` in the amberbase repo). Then:

- `pnpm install` at the repo root installs both packages.
- `pnpm -r run build` builds the UI into `backend/dist/static` and the backend into `backend/dist`.
- `Mariadb_user=<user> Mariadb_password=<password> pnpm --filter ./backend start` starts the app on <http://localhost:3000>. The Amberbase UI is available under `/amber/ui`, with a bootstrapped admin account (`admin` / `password`).
- `bash scripts/package.sh rebuild` creates the deployable `app.zip` for Uberspace.
