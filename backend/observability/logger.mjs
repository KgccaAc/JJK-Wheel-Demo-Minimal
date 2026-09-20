import { randomUUID } from 'node:crypto';

const SENSITIVE_KEY = /(token|secret|password|credential|authorization|cookie|private.?key)/i;

export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitive(item);
  return output;
}

export function createRequestContext(input = {}) {
  return {
    request_id: String(input.requestId || input.request_id || randomUUID()),
    trace_id: String(input.traceId || input.trace_id || randomUUID()),
    session_id: input.sessionId || input.session_id || undefined,
    room_id: input.roomId || input.room_id || undefined,
    battle_id: input.battleId || input.battle_id || undefined,
    revision: Number.isInteger(input.revision) ? input.revision : undefined,
  };
}

export function createError({ code, category = 'UNKNOWN', message, userMessage = message, severity = 'error', recoverable = false, retryable = false, context = {}, details = {}, cause = null } = {}) {
  if (!code || !message) throw new TypeError('error code and message are required');
  const record = {
    schema: 'jjk-error-v1', error_id: randomUUID(), timestamp: new Date().toISOString(), severity,
    source: 'worker', category, code, message, user_message: userMessage,
    recoverable: Boolean(recoverable), retryable: Boolean(retryable), ...createRequestContext(context),
    details: redactSensitive(details),
  };
  if (cause) record.cause = redactSensitive({ code: cause.code, message: cause.message, name: cause.name });
  return record;
}

export class StructuredLogger {
  constructor({ sink = (line) => process.stderr.write(`${line}\n`), service = 'jjk-worker' } = {}) { this.sink = sink; this.service = service; }
  write(level, payload) { this.sink(JSON.stringify(redactSensitive({ timestamp: new Date().toISOString(), service: this.service, level, ...payload }))); }
  info(payload) { this.write('info', payload); }
  warn(payload) { this.write('warn', payload); }
  error(payload) { this.write('error', payload); }
}

