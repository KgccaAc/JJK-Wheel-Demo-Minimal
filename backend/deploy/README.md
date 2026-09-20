# Preview Room deployment

This package is intentionally separate from the legacy Node services and the
existing preview login-card service.

- App: `/opt/jjk-preview-room/preview-room-server.mjs`
- Data: `/opt/jjk-preview-room/data/room.sqlite`
- Loopback listener: `127.0.0.1:8789`
- Public reverse-proxy path: `/preview-room-api/`
- systemd unit: `jjk-preview-room.service`

Install only after checking the server has Node 24+ (`node:sqlite` is used).
Copy `jjk-preview-room.service` to `/etc/systemd/system/`, include
`preview-room.nginx.conf` inside the existing HTTPS `server` block, run
`nginx -t`, then reload Nginx.  Do not modify or restart legacy 8787/8790
services or `jjk-preview-login-card.service`.

The service runs the `online-battle-v3` authority protocol. It stores a single
V3 battle checkpoint in SQLite and accepts only stage intent, then returns a
recipient-filtered projection. Do not deploy `preview-worker-gateway.mjs` for
this path: it is the retired V1 compatibility bridge and would reintroduce
client receipt synchronization.

