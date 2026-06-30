export interface TorrentResult {
  infoHash: string;
  name: string;
  sizeBytes: number;
  seeders: number;
  leechers: number;
  source: string;
  magnet: string;
  added?: number;
}

export interface SearchOptions {
  signal?: AbortSignal;
}
