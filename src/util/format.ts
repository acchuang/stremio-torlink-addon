const SIZE_UNITS: Record<string, number> = {
  B: 1,
  KIB: 1024,
  MIB: 1024 ** 2,
  GIB: 1024 ** 3,
  TIB: 1024 ** 4,
  KB: 1000,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
};

export function parseSize(s: string): number {
  const m = s.match(/([\d.]+)\s*([KMGT]?I?B)/i);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]!) * (SIZE_UNITS[m[2]!.toUpperCase()] ?? 1));
}

export function formatBytes(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
