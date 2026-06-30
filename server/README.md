# Stremio Server Setup

This directory contains infrastructure for running `stremio-server` on a headless Linux machine (Proxmox LXC, VPS, etc.) so Stremio Web can reach it over HTTPS.

## Problem

`stremio-server` advertises its LAN IP as `baseUrl` in its `/settings` response. When Stremio Web connects via a public HTTPS URL (e.g. through Cloudflare Tunnel), it uses `baseUrl` for stats polling. Because that URL is an internal LAN IP, seeds/speed/peer count never appear in the player.

## Fix: settings proxy (`proxy.mjs`)

A thin Node.js HTTP proxy that forwards all requests to `stremio-server` unchanged, except `/settings` — where it rewrites `baseUrl` to the public HTTPS URL.

```
Cloudflare Tunnel (:443)
    ↓ https://server.example.com
proxy.mjs (:11480)
    ↓ http://localhost:11470
stremio-server (Docker)
```

## Deployment

### 1. Run stremio-server (Docker)

```bash
docker run -d \
  --name stremio-server \
  --network host \
  --restart unless-stopped \
  -e NO_CORS=1 \
  -v /opt/stremio-data:/root/.stremio-server \
  tsaridas/stremio-docker:latest
```

### 2. Run the proxy

```bash
# Copy proxy.mjs to the server, then:
EXTERNAL_URL=https://server.yourdomain.com node /opt/stremio-proxy/proxy.mjs
```

Or as a systemd service (`/etc/systemd/system/stremio-proxy.service`):

```ini
[Unit]
Description=Stremio Settings Proxy
After=network.target docker.service

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/stremio-proxy/proxy.mjs
Restart=always
RestartSec=3
Environment=EXTERNAL_URL=https://server.yourdomain.com

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now stremio-proxy
```

### 3. Point Cloudflare Tunnel at the proxy

In `/etc/cloudflared/config.yml`, set the service to the proxy port:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: server.yourdomain.com
    service: http://localhost:11480   # proxy, not 11470
  - service: http_status:404
```

```bash
systemctl restart cloudflared
```

### 4. Connect Stremio Web

In Stremio Web → Settings → Streaming Server, set URL to `https://server.yourdomain.com`.

You should see `baseUrl: https://server.yourdomain.com` in `/settings` and real-time seeds/speed stats in the player.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UPSTREAM_URL` | `http://localhost:11470` | stremio-server address |
| `EXTERNAL_URL` | `https://server.oilygold.xyz` | public HTTPS URL (your domain) |
| `PORT` | `11480` | port the proxy listens on |
