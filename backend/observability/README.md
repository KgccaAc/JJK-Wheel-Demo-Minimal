# Observability

Backend errors use the `jjk-error-v1` envelope and are emitted as structured JSONL.
`logger.mjs` provides sensitive-field redaction, request/trace context, stable error
records, and a small logger abstraction that can write to stderr or a rotating sink.

Production deployments must set `LOG_LEVEL`, `LOG_DIR`, and retention limits through
environment configuration. Access tokens, credentials, login-card secrets, complete
character snapshots, and hidden hands must never be logged.

