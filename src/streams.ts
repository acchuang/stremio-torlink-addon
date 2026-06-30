import { fetchMeta } from "./meta";
import { formatBytes } from "./util/format";
import { TRACKERS } from "./sources/magnet";
import { searchYts } from "./sources/yts";
import { searchEztv } from "./sources/eztv";
import { searchTpbMovies, searchTpbTv } from "./sources/piratebay";
import { searchX1337Movies, searchX1337Tv } from "./sources/x1337";
import { searchBitsearchMovies, searchBitsearchTv } from "./sources/bitsearch";
import { searchNyaa } from "./sources/nyaa";
import type { TorrentResult } from "./sources/types";

const SOURCE_LABELS: Record<string, string> = {
  yts: "YTS",
  eztv: "EZTV",
  "tpb-movies": "TPB",
  "tpb-tv": "TPB",
  "x1337-movies": "1337x",
  "x1337-tv": "1337x",
  "bitsearch-movies": "Bitsearch",
  "bitsearch-tv": "Bitsearch",
  nyaa: "Nyaa",
};

function dedup(results: TorrentResult[]): TorrentResult[] {
  const seen = new Set<string>();
  return results.filter((r) => r.infoHash && !seen.has(r.infoHash) && seen.add(r.infoHash));
}

function settle<T>(results: PromiseSettledResult<T[]>[]): T[] {
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export interface StremioStream {
  infoHash: string;
  title: string;
  sources: string[];
  behaviorHints?: { bingeGroup?: string };
}

export async function getStreams(type: string, id: string): Promise<StremioStream[]> {
  const parts = id.split(":");
  let imdbId: string;
  let rawSeason: string | undefined;
  let rawEpisode: string | undefined;

  if (parts[0] === "kitsu") {
    // kitsu:NNNN or kitsu:NNNN:season:episode
    imdbId = `kitsu:${parts[1] ?? ""}`;
    rawSeason = parts[2];
    rawEpisode = parts[3];
  } else {
    imdbId = parts[0] ?? "";
    rawSeason = parts[1];
    rawEpisode = parts[2];
  }

  const parsedSeason = rawSeason ? parseInt(rawSeason, 10) : NaN;
  const parsedEpisode = rawEpisode ? parseInt(rawEpisode, 10) : NaN;
  const season = !isNaN(parsedSeason) ? parsedSeason : undefined;
  const episode = !isNaN(parsedEpisode) ? parsedEpisode : undefined;

  if (!imdbId) return [];

  // Kick off meta lookup + IMDB-native searches in parallel
  const [metaSettled, ...nativeSettled] = await Promise.allSettled([
    fetchMeta(type === "movie" ? "movie" : "series", imdbId),
    ...(type === "movie"
      ? [searchYts(imdbId)]
      : type === "series"
        ? [searchEztv(imdbId, season, episode)]
        : []),
  ]);

  const meta = metaSettled.status === "fulfilled" ? metaSettled.value : null;
  const nativeResults = settle(nativeSettled as PromiseSettledResult<TorrentResult[]>[]);

  // Title-based searches with cinemeta meta
  let titleResults: TorrentResult[] = [];
  if (meta) {
    const baseQuery = meta.year ? `${meta.name} ${meta.year}` : meta.name;
    const episodeQuery =
      season !== undefined && episode !== undefined
        ? `${meta.name} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
        : baseQuery;

    const titleSearches =
      type === "movie"
        ? [searchTpbMovies(baseQuery), searchX1337Movies(baseQuery), searchBitsearchMovies(baseQuery)]
        : type === "series"
          ? [searchTpbTv(episodeQuery), searchX1337Tv(episodeQuery), searchBitsearchTv(episodeQuery)]
          : type === "anime"
            ? [searchNyaa(episodeQuery)]
            : [];

    const titleSettled = await Promise.allSettled(titleSearches);
    titleResults = settle(titleSettled);
  }

  const all = dedup([...nativeResults, ...titleResults])
    .filter((r) => r.seeders > 0)
    .sort((a, b) => b.seeders - a.seeders);

  return all.map((r) => ({
    infoHash: r.infoHash,
    ...(r.fileIdx !== undefined && { fileIdx: r.fileIdx }),
    title: [
      `[${SOURCE_LABELS[r.source] ?? r.source}] ${r.name}`,
      `👥 ${r.seeders} seeds · ${formatBytes(r.sizeBytes)}`,
    ].join("\n"),
    sources: TRACKERS.map((t) => `tracker:${t}`),
    behaviorHints: { bingeGroup: `torlink|${type}|${imdbId}` },
  }));
}
