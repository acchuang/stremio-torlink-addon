export const USER_AGENT = "stremio-torlink-addon/1.0";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
  }
}

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const FETCH_TIMEOUT_MS = 15_000;

function backoffMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 10000) * (0.5 + Math.random() * 0.5);
}

export async function fetchResilient(
  url: string,
  init: RequestInit & { retries?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const { retries = 3, signal, ...rest } = init;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new HttpError(0, "aborted");
    const attemptSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
      : AbortSignal.timeout(FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...rest, signal: attemptSignal });
      if (!RETRY_STATUS.has(res.status)) return res;
      if (attempt >= retries) throw new HttpError(res.status, `${url} returned ${res.status}`);
      await new Promise((r) => setTimeout(r, backoffMs(attempt)));
    } catch (e) {
      if (signal?.aborted) throw e;
      lastError = e;
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, backoffMs(attempt)));
    }
  }
  throw lastError ?? new HttpError(0, "fetchResilient exhausted");
}
