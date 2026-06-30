import { fetchResilient, HttpError, USER_AGENT } from "../util/net";
import { parseSize } from "../util/format";
import { buildMagnet, unescapeEntities } from "./magnet";
import type { SearchOptions, TorrentResult } from "./types";

function tag(item: string, name: string): string {
  return (
    item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "s"))?.[1]?.trim() ?? ""
  );
}

export async function searchNyaa(
  query: string,
  opts: SearchOptions = {},
): Promise<TorrentResult[]> {
  const params = new URLSearchParams({ page: "rss", q: query.trim(), c: "0_0", f: "0" });
  const res = await fetchResilient(`https://nyaa.si/?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: opts.signal,
  });
  if (!res.ok) throw new HttpError(res.status, `Nyaa returned ${res.status}`);

  const xml = await res.text();
  const out: TorrentResult[] = [];
  for (const item of xml.split("<item>").slice(1)) {
    const infoHash = tag(item, "nyaa:infoHash").toLowerCase();
    const name = unescapeEntities(tag(item, "title"));
    if (!infoHash || !name) continue;
    const dateStr = tag(item, "pubDate");
    out.push({
      infoHash,
      name,
      sizeBytes: parseSize(tag(item, "nyaa:size")),
      seeders: Number(tag(item, "nyaa:seeders")) || 0,
      leechers: Number(tag(item, "nyaa:leechers")) || 0,
      source: "nyaa",
      magnet: buildMagnet(infoHash, name),
      added: dateStr ? new Date(dateStr).getTime() / 1000 : undefined,
    });
  }
  return out;
}
