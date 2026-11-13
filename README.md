# Deck tool (browser version)

A tool that turns plain content or an AI brief into a designed slide deck.
It runs entirely in the browser. It makes no network calls and keeps no
server state.

## Build

You need Node 24 or newer.

    npm ci
    npm run build:web

The output is the folder `dist-web`. Upload it to any static host, or open
`dist-web/index.html` through a local static server.

## Cloudflare Pages

Connect the repository in the Cloudflare dashboard and type these settings:

- Framework preset: None
- Build command: `npm run build:web`
- Build output directory: `dist-web`
- Environment variable: `NODE_VERSION` = `24`
- Functions: none (the site is static)

The file `public/_headers` is copied into `dist-web` by the build and sets
the security headers.

## Check

    npm run typecheck

## Licence

See the file `LICENSE`.
