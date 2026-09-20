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

The local preview server also exposes the optional story dialogue bridge:

- `GET /api/ai/status` reports whether `DEEPSEEK_API_KEY` is configured.
- `POST /api/ai/dialogue/session` opens a persisted dialogue session.
- `POST /api/ai/dialogue/turn` generates a structured DeepSeek turn when configured,
  otherwise uses deterministic local text. The request must include the current
  `saveRevision`; concurrent stale writes return 409.
- `POST /api/ai/dialogue/end` closes the session and appends the final ledger event.

Set `DEEPSEEK_API_KEY` (or `DEEPSEEK_KEY_FILE`; local Windows development also checks the user's Desktop `KEY.txt`), `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`),
and `DEEPSEEK_MODEL` (default `deepseek-flash`) in the process environment. The
provider is instructed to return JSON, then the server strips unknown fields and
allows only 0..2 XP, small current-NPC affection/trust/alertness/respect changes,
temporary emotion, and bounded memory tags/soft flags. Resource, core-growth,
inventory, battle, and routing effects are rejected and recorded in
`rejectedEffects` before the event ledger is persisted. The key is never written
to session data or logs.

The same local preview server exposes the story/content boundary:

- `GET /api/story/packages/latest` and `GET /api/story/packages/:version` return the immutable canonical package.
- `GET /api/story/chapters/:id`, `POST /api/story/validate`, and `POST /api/story/preview` support editor preview and checks.
- `GET /api/saves/:id` and `POST /api/saves/:id/events` append revisioned local save events; stale `expectedRevision` writes return 409.

These routes are preview-only storage adapters. They do not replace or write to the official `/preview-room-api` battle authority.

## Web story shell

Start `node backend/local-preview-server.mjs`, then open `http://127.0.0.1:8089/`.
The root is the Web App Shell (`web-preview/`); `/story-editor/` remains the
content workbench and `/web-runtime/` serves the platform-neutral runtime modules.
The shell's story page uses `StoryClient`, the same `story-package.v1` loaded by
the editor. Use `/?save=<save-id>` to select an isolated preview save slot. The
turn-wheel, battle, and online routes intentionally expose integration status
until their Web presentation modules replace the Godot screens; they do not
claim authority over combat or the official room service.

## Error and log contract

Worker failures include an `error_record` using the `jjk-error-v1` schema. The record
contains a stable category/code, user-facing message, retryability, and request/trace
context. Local worker diagnostics are emitted as structured JSONL through
`backend/observability/logger.mjs`; sensitive fields are redacted before emission.

