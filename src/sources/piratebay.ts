import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { buildMagnet } from "./magnet";
import type { SearchOptions, TorrentResult } from "./types";

const API = "https://apibay.org";
const MOVIE_CATS = new Set([201, 202, 207, 209]);
const TV_CATS = new Set([205, 208]);

interface ApibayItem {
  id?: string;
  name?: string;
  info_hash?: string;
  seeders?: string;
  leechers?: string;
  size?: string;
  added?: string;
  category?: string;
}

const ZERO_HASH = "0000000000000000000000000000000000000000";

function toResult(it: ApibayItem, source: string): TorrentResult | null {
  const infoHash = (it.info_hash ?? "").toLowerCase();
  if (!infoHash || infoHash === ZERO_HASH || it.id === "0") return null;
  const name = it.name || "Unknown";
  return {
    infoHash,
    name,
    sizeBytes: Number(it.size) || 0,
    seeders: Number(it.seeders) || 0,
    leechers: Number(it.leechers) || 0,
    source,
    magnet: buildMagnet(infoHash, name),
    added: Number(it.added) || undefined,
  };
}

async function fetchItems(url: string, opts: SearchOptions): Promise<ApibayItem[]> {
  const res = await fetchResilient(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `TPB returned ${res.status}`);
  const json = (await res.json()) as ApibayItem[];
  return Array.isArray(json) ? json : [];
}

export async function searchTpbMovies(
  query: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const items = await fetchItems(`${API}/q.php?q=${encodeURIComponent(query)}`, opts);
  return items
    .filter((it) => MOVIE_CATS.has(Number(it.category)))
    .map((it) => toResult(it, "tpb-movies"))
    .filter((r): r is TorrentResult => r !== null);
}

export async function searchTpbTv(
  query: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const items = await fetchItems(`${API}/q.php?q=${encodeURIComponent(query)}`, opts);
  return items
    .filter((it) => TV_CATS.has(Number(it.category)))
    .map((it) => toResult(it, "tpb-tv"))
    .filter((r): r is TorrentResult => r !== null);
}
