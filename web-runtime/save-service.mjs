const clone = (value) => structuredClone(value);

/** Browser-facing save adapter. Commits are serialized and a single remote
 * revision conflict is re-read and retried so rapid UI actions cannot drop
 * events just because they shared the same expected revision. */
export class SaveService {
  constructor(http, saveId = 'web-story-local', storage = globalThis.localStorage) {
    this.http = http; this.saveId = saveId; this.revision = 0; this.localKey = `jjk:${saveId}`;
    this.storage = storage; this.queue = Promise.resolve();
  }
  async load() {
    try { const result = await this.http.get(`/api/saves/${encodeURIComponent(this.saveId)}`); this.revision = Number(result.save.revision || 0); return result.save.snapshot || {}; }
    catch (error) { if (error.status !== 404) console.warn('[save] load fallback', error.message); try { return JSON.parse(this.storage?.getItem?.(this.localKey) || '{}'); } catch { return {}; } }
  }
  commit(snapshot, events) {
    const safe = clone(snapshot);
    this.queue = this.queue.then(() => this._commitNow(safe, events));
    return this.queue;
  }
  async _commitNow(safe, events) {
    this.storage?.setItem?.(this.localKey, JSON.stringify(safe));
    if (!events?.length) return { local: true, revision: this.revision };
    const body = () => ({ expectedRevision: this.revision, source: 'web_story', events, snapshot: safe });
    try { const result = await this.http.post(`/api/saves/${encodeURIComponent(this.saveId)}/events`, body()); this.revision = Number(result.revision || this.revision); return result; }
    catch (error) {
      if (error.status !== 409) { console.warn('[save] remote commit deferred', error.message); return { local: true, revision: this.revision }; }
      try {
        const latest = await this.http.get(`/api/saves/${encodeURIComponent(this.saveId)}`);
        this.revision = Number(latest.save?.revision || error.payload?.revision || this.revision);
        const result = await this.http.post(`/api/saves/${encodeURIComponent(this.saveId)}/events`, body());
        this.revision = Number(result.revision || this.revision);
        return { ...result, retried: true };
      } catch (retryError) { this.revision = Number(retryError.payload?.revision || this.revision); console.warn('[save] remote commit deferred', retryError.message); return { local: true, conflict: true, revision: this.revision }; }
    }
  }
}
