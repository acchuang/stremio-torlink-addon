import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { buildMagnet } from "./magnet";
import type { SearchOptions, TorrentResult } from "./types";

const API = "https://bitsearch.eu/api/v1/search";
const MOVIE_CAT = 2;
const TV_CAT = 1;

interface BitsearchItem {
  infohash?: string;
  title?: string;
  size?: number;
  category?: number;
  seeders?: number;
  leechers?: number;
}

interface BitsearchResponse {
  results?: BitsearchItem[];
}

function toResult(item: BitsearchItem, source: string): TorrentResult | null {
  const infoHash = (item.infohash ?? "").toLowerCase();
  if (!infoHash) return null;
  const name = item.title || "Unknown";
  return {
    infoHash,
    name,
    sizeBytes: item.size ?? 0,
    seeders: item.seeders ?? 0,
    leechers: item.leechers ?? 0,
    source,
    magnet: buildMagnet(infoHash, name),
  };
}

async function fetchItems(query: string, opts: SearchOptions): Promise<BitsearchItem[]> {
  const params = new URLSearchParams({ q: query.trim(), fuv: "true" });
  const res = await fetchResilient(`${API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `Bitsearch returned ${res.status}`);
  const json = (await res.json()) as BitsearchResponse;
  return Array.isArray(json.results) ? json.results : [];
}

export async function searchBitsearchMovies(
  query: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const items = await fetchItems(query, opts);
  return items
    .filter((r) => r.category === MOVIE_CAT)
    .map((r) => toResult(r, "bitsearch-movies"))
    .filter((r): r is TorrentResult => r !== null);
}

export async function searchBitsearchTv(
  query: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const items = await fetchItems(query, opts);
  return items
    .filter((r) => r.category === TV_CAT)
    .map((r) => toResult(r, "bitsearch-tv"))
    .filter((r): r is TorrentResult => r !== null);
}
