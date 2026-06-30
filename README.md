# stremio-torlink-addon

Stremio addon that finds torrent streams for movies, TV shows, and anime. Uses the same sources as [torlink](https://github.com/baairon/torlink) — YTS, EZTV, 1337x, The Pirate Bay, and Nyaa — adapted for Stremio's IMDB-based lookup.

## Sources

| Type | Sources |
|------|---------|
| Movies | YTS, The Pirate Bay, 1337x |
| TV Series | EZTV, The Pirate Bay, 1337x |
| Anime | Nyaa |

## Requirements

- Node.js 22+
- npm

## Setup

```bash
git clone https://github.com/your-username/stremio-torlink-addon
cd stremio-torlink-addon
npm install
```

## Running

```bash
npm run dev
```

Starts on port 7000. Override with `PORT`:

```bash
PORT=7100 npm run dev
```

Output:
```
TorLink addon running at http://localhost:7000
Install URL: http://localhost:7000/manifest.json
```

## Installing in Stremio

### Desktop app (easiest)

1. Open Stremio
2. Click the puzzle icon (Addons) in the top bar
3. Click **Install by URL** (top right)
4. Paste: `http://localhost:7000/manifest.json`
5. Click Install

### Stremio Web

Stremio Web can't reach `localhost`. You need to deploy the addon publicly first (see [Deploying](#deploying)), then use the public URL.

## Deploying

Deploy anywhere that runs Node.js. The addon is a plain HTTP server — no database, no state.

### Railway

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo
4. Set `PORT` env var if needed (Railway sets it automatically)
5. Use the Railway-generated URL as your install URL: `https://your-app.railway.app/manifest.json`

### Fly.io

```bash
fly launch
fly deploy
```

Use `https://your-app.fly.dev/manifest.json` as the install URL.

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
EXPOSE 7000
```

```bash
docker build -t stremio-torlink .
docker run -p 7000:7000 stremio-torlink
```

## Building for production

```bash
npm run build    # compiles TypeScript to dist/
npm start        # runs compiled output
```

## How it works

When Stremio requests streams for a title, the addon:

1. Receives the IMDB ID (e.g. `tt0133093` for The Matrix, `tt0903747:1:1` for Breaking Bad S01E01)
2. Queries IMDB-native APIs in parallel:
   - YTS: `?query_term=tt0133093`
   - EZTV: `?imdb_id=133093` (filters results by season/episode)
3. Fetches the title from [Cinemeta](https://cinemeta.strem.io) (Stremio's free metadata service)
4. Uses the title to search The Pirate Bay and 1337x
5. Deduplicates by info hash, sorts by seeders, returns to Stremio

Stremio handles all torrent downloading and streaming internally using its built-in WebTorrent client.

## Project structure

```
src/
├── index.ts          # starts the HTTP server
├── addon.ts          # Stremio addon manifest + stream handler
├── streams.ts        # orchestrates parallel source searches
├── meta.ts           # fetches title/year from Cinemeta
├── sources/
│   ├── yts.ts        # YTS API
│   ├── eztv.ts       # EZTV API (IMDB-based, episode filtering)
│   ├── piratebay.ts  # apibay.org API
│   ├── x1337.ts      # 1337x scraper
│   ├── nyaa.ts       # Nyaa RSS
│   ├── magnet.ts     # magnet link builder + HTML entity helpers
│   └── types.ts      # shared types
└── util/
    ├── net.ts         # fetch with retry/backoff
    └── format.ts      # byte formatting + size parsing
```

## Notes

- 1337x requires scraping detail pages to extract magnet links, so it's slower than the API-based sources. Results are capped at 6 per request to keep response times reasonable.
- EZTV only returns results when a show is indexed by IMDB ID. Newer or obscure shows may return nothing.
- YTS only has movies. TV and anime results from YTS will be empty.
- This addon does not download or proxy anything. It returns magnet links; Stremio's built-in client does the rest.
