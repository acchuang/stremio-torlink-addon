import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { parseSize } from "../util/format";
import { unescapeEntities } from "./magnet";
import type { SearchOptions, TorrentResult } from "./types";

const HOSTS = ["1337x.to", "1337x.st", "x1337x.ws", "1337xx.to"];
const MAX_DETAILS = 6;

interface Row {
  name: string;
  path: string;
  seeders: number;
  leechers: number;
  sizeBytes: number;
}

function parseRows(html: string): Row[] {
  const start = html.indexOf("table-list");
  if (start < 0) return [];
  const out: Row[] = [];
  for (const tr of html.slice(start).split(/<tr[\s>]/i).slice(1)) {
    const link = tr.match(/href="(\/torrent\/[^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (!link) continue;
    const size = tr.match(/class="coll-4 size[^"]*">\s*([\d.]+\s*[KMGT]i?B)/i)?.[1] ?? "";
    out.push({
      name: unescapeEntities(link[2]!.trim()),
      path: link[1]!,
      seeders: Number(tr.match(/class="coll-2 seeds[^"]*">\s*(\d+)/i)?.[1] ?? 0),
      leechers: Number(tr.match(/class="coll-3 leeches[^"]*">\s*(\d+)/i)?.[1] ?? 0),
      sizeBytes: parseSize(size),
    });
  }
  return out;
}

async function fetchText(url: string, opts: SearchOptions, retries: number): Promise<string> {
  const res = await fetchResilient(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
    retries,
  });
  if (!res.ok) throw new HttpError(res.status, `1337x returned ${res.status}`);
  return res.text();
}

async function detailMagnet(base: string, path: string, opts: SearchOptions): Promise<string | null> {
  try {
    const html = await fetchText(`${base}${path}`, opts, 1);
    const raw = html.match(/magnet:\?xt=urn:btih:[^"'<>\s]+/i)?.[0];
    return raw ? unescapeEntities(raw) : null;
  } catch {
    return null;
  }
}

async function search(
  query: string,
  cat: "Movies" | "TV",
  source: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const q = query.trim();
  const path = q
    ? `/category-search/${encodeURIComponent(q).replace(/%20/g, "+")}/${cat}/1/`
    : `/popular-${cat === "Movies" ? "movies" : "tv"}`;

  let base = "";
  let html = "";
  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const candidate = `https://${host}`;
      html = await fetchText(`${candidate}${path}`, opts, 2);
      base = candidate;
      break;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      lastError = e;
    }
  }
  if (!base) throw lastError ?? new Error("1337x unreachable");

  // Require ALL meaningful query tokens to appear in the result name
  const STOP = new Set(["the", "a", "an", "of", "and", "or", "to"]);
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const need = tokens.filter((t) => !STOP.has(t));

  const rows = parseRows(html)
    .filter((r) => {
      if (!need.length) return true;
      const n = r.name.toLowerCase();
      return need.every((t) => n.includes(t));
    })
    .sort((a, b) => b.seeders - a.seeders)
    .slice(0, MAX_DETAILS);

  const settled = await Promise.all(
    rows.map(async (row): Promise<TorrentResult | null> => {
      const magnet = await detailMagnet(base, row.path, opts);
      const infoHash = magnet?.match(/urn:btih:([a-zA-Z0-9]+)/i)?.[1]?.toLowerCase();
      if (!magnet || !infoHash) return null;
      return {
        infoHash,
        name: row.name,
        sizeBytes: row.sizeBytes,
        seeders: row.seeders,
        leechers: row.leechers,
        source,
        magnet,
      };
    }),
  );
  return settled.filter((r): r is TorrentResult => r !== null);
}

export const searchX1337Movies = (query: string, opts?: SearchOptions) =>
  search(query, "Movies", "x1337-movies", opts);

export const searchX1337Tv = (query: string, opts?: SearchOptions) =>
  search(query, "TV", "x1337-tv", opts);
