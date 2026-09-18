export const config = Object.freeze({
  host: process.env.WORKER_HOST || process.env.LOCAL_WORKER_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.WORKER_PORT || process.env.LOCAL_WORKER_PORT || '8787', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || 'backend/runtime/logs',
  maxLogFileBytes: Number.parseInt(process.env.MAX_LOG_FILE_BYTES || '5242880', 10),
  logRetentionDays: Number.parseInt(process.env.LOG_RETENTION_DAYS || '14', 10),
  requestTimeoutMs: Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),
  dataDir: process.env.LOCAL_WORKER_DATA_DIR || 'backend/.runtime',
  checkpointPath: process.env.LOCAL_WORKER_CHECKPOINT_PATH || 'backend/.runtime/checkpoint.json',
  eventPath: process.env.LOCAL_WORKER_EVENT_PATH || 'backend/.runtime/events.jsonl',
  allowedOrigins: (process.env.PREVIEW_WORKER_ALLOWED_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean),
});

