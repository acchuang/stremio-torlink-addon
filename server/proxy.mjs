/**
 * Stremio Server settings proxy.
 *
 * stremio-server advertises its LAN IP as baseUrl in /settings responses.
 * When Stremio Web connects via a remote HTTPS URL (e.g. Cloudflare Tunnel),
 * it uses baseUrl for stats polling — so seeds/speed never appear.
 *
 * This proxy sits between the Cloudflare Tunnel and stremio-server.
 * It forwards all requests unchanged except /settings, where it rewrites
 * baseUrl to the public HTTPS URL so Stremio Web can reach the stats endpoint.
 *
 * Usage:
 *   EXTERNAL_URL=https://server.example.com node proxy.mjs
 *
 * Default upstream: http://localhost:11470
 * Default proxy port: 11480
 */

import http from "http";

const UPSTREAM = process.env.UPSTREAM_URL ?? "http://localhost:11470";
const EXTERNAL = process.env.EXTERNAL_URL;
const PORT = parseInt(process.env.PORT ?? "11480", 10);

if (!EXTERNAL) {
  console.error("Error: EXTERNAL_URL is required. Usage: EXTERNAL_URL=https://your-domain.com node proxy.mjs");
  process.exit(1);
}

http
  .createServer((req, res) => {
    // stremio-server tries to verify its own SSL cert — always fails behind a tunnel.
    // Intercept and return the public URL directly so Stremio accepts the connection.
    if (req.url.startsWith("/get-https")) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(EXTERNAL);
      return;
    }

    const opts = new URL(req.url, UPSTREAM);
    const preq = http.request(opts, (pres) => {
      const headers = { ...pres.headers };
      const isSettings = req.url.startsWith("/settings");

      if (isSettings) delete headers["content-length"];

      res.writeHead(pres.statusCode, headers);

      if (!isSettings) return pres.pipe(res);

      let body = "";
      pres.on("data", (c) => (body += c));
      pres.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.baseUrl) json.baseUrl = EXTERNAL;
          if (json.values) json.values.remoteHttps = new URL(EXTERNAL).hostname;
          res.end(JSON.stringify(json));
        } catch {
          res.end(body);
        }
      });
    });

    preq.on("error", (e) => {
      res.writeHead(502);
      res.end(e.message);
    });

    req.pipe(preq);
  })
  .listen(PORT, () => console.log(`stremio-proxy → ${UPSTREAM} (external: ${EXTERNAL}) on :${PORT}`));
