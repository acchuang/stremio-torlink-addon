import { fetchResilient } from "./util/net";

export interface Meta {
  name: string;
  year?: number;
}

const CINEMETA = "https://v3-cinemeta.strem.io";

export async function fetchMeta(type: string, imdbId: string): Promise<Meta | null> {
  try {
    const res = await fetchResilient(`${CINEMETA}/meta/${type}/${imdbId}.json`, { retries: 1 });
    if (!res.ok) return null;
    const json = (await res.json()) as { meta?: { name?: string; year?: number } };
    const m = json.meta;
    if (!m?.name) return null;
    return { name: m.name, year: m.year };
  } catch {
    return null;
  }
}
