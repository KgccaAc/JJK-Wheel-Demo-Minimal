import { randomUUID } from 'node:crypto';

export function createRequestContext(headers = {}, seed = {}) {
  const requestId = headers['x-request-id'] || headers['X-Request-Id'] || seed.requestId || randomUUID();
  const traceId = headers['x-trace-id'] || headers['X-Trace-Id'] || seed.traceId || requestId;
  return { ...seed, requestId, traceId, startedAt: Date.now() };
}

export function finishRequestContext(ctx) {
  return { ...ctx, durationMs: Math.max(0, Date.now() - (ctx.startedAt ?? Date.now())) };
}
