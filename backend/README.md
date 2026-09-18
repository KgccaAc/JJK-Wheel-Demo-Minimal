# Local Worker

This zero-dependency Node service is the local implementation of the existing
`online-room-v1` transport contract. It is for local development only: it has no
authentication and must not be exposed outside the local machine.

Endpoints:

- `GET /health` reports process and protocol availability.
- `POST /online-room` accepts the packet built by `OnlineRoomGateway.gd`.

State is stored in `backend/.runtime/online-room-state.json`. The folder is ignored
because it contains local room, queue, and score data. The Worker deliberately does
not receive login-card payloads or character snapshots; a future authority API should
authenticate a player and validate the submitted `character_id` before every action.

Run `powershell -ExecutionPolicy Bypass -File backend/scripts/start-local-worker.ps1`.
Use `health-local-worker.ps1` to diagnose the service and `stop-local-worker.ps1` to
stop the process that this project started.

`preview-login-card-server.mjs` is a separate development service for the first
server feature: reading and storing normalized login-card snapshots. It runs in its
own deployment directory and port and does not replace the existing battle service.
`GET /api/login-cards/:cardId` returns the complete `canonicalV3` character snapshot.
`PUT` uses `expectedRevision` and returns 409 on conflict, so stale clients cannot
silently overwrite a newer card.

## Error and log contract

Worker failures include an `error_record` using the `jjk-error-v1` schema. The record
contains a stable category/code, user-facing message, retryability, and request/trace
context. Local worker diagnostics are emitted as structured JSONL through
`backend/observability/logger.mjs`; sensitive fields are redacted before emission.

