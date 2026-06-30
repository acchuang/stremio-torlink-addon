import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { buildMagnet } from "./magnet";
import type { SearchOptions, TorrentResult } from "./types";

const API = "https://eztvx.to/api/get-torrents";

interface EztvTorrent {
  title?: string;
  filename?: string;
  hash?: string;
  magnet_url?: string;
  seeds?: number;
  peers?: number;
  size_bytes?: string | number;
  date_released_unix?: number;
}
interface EztvResponse {
  torrents?: EztvTorrent[];
}

function matchesEpisode(title: string, season: number, episode: number): boolean {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return new RegExp(`S${s}E${e}|${season}x${e}`, "i").test(title);
}

export async function searchEztv(
  imdbId: string,
  season?: number,
  episode?: number,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  // EZTV expects numeric IMDB ID without 'tt' prefix
  const id = imdbId.replace(/^tt/, "");
  const res = await fetchResilient(`${API}?imdb_id=${id}&limit=100`, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `EZTV returned ${res.status}`);

  const json = (await res.json()) as EztvResponse;
  const out: TorrentResult[] = [];
  for (const t of json.torrents ?? []) {
    const hash = (t.hash ?? "").toLowerCase();
    const name = t.title || t.filename || hash;
    const magnet = t.magnet_url || (hash ? buildMagnet(hash, name) : "");
    if (!magnet || !hash) continue;
    if (season !== undefined && episode !== undefined && !matchesEpisode(name, season, episode)) {
      continue;
    }
    out.push({
      infoHash: hash,
      name,
      sizeBytes: Number(t.size_bytes ?? 0) || 0,
      seeders: t.seeds ?? 0,
      leechers: t.peers ?? 0,
      source: "eztv",
      magnet,
      added: t.date_released_unix,
    });
  }
  return out;
}
