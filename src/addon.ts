// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addonBuilder } = require("stremio-addon-sdk");
import { getStreams } from "./streams";

const manifest = {
  id: "community.torlink-addon",
  version: "1.0.0",
  name: "TorLink",
  description: "Torrent streams via YTS, EZTV, 1337x, TPB, Nyaa — powered by torlink sources",
  resources: ["stream"],
  types: ["movie", "series", "anime"],
  idPrefixes: ["tt", "kitsu"],
  catalogs: [],
  behaviorHints: { configurable: false },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const builder = new addonBuilder(manifest) as any;

builder.defineStreamHandler(async ({ type, id }: { type: string; id: string }) => {
  console.log(`[stream] ${type} ${id}`);
  try {
    const streams = await getStreams(type, id);
    console.log(`[stream] ${type} ${id} → ${streams.length} results`);
    return { streams };
  } catch (err) {
    console.error(`[stream] ${type} ${id} error:`, err);
    return { streams: [] };
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const addonInterface: any = builder.getInterface();
