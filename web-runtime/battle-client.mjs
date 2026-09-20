const requestJson = async (fetchImpl, url, options = {}) => {
  const response = await fetchImpl(url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) { const error = new Error(payload?.error || `battle_api_${response.status}`); error.status = response.status; error.payload = payload; throw error; }
  return payload;
};

export class BattleClient {
  constructor({ apiBase = '', fetchImpl = globalThis.fetch, snapshot = null, onChange = () => {} } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl_required');
    this.apiBase = apiBase.replace(/\/$/, ''); this.fetchImpl = fetchImpl; this.onChange = onChange;
    this.battleId = snapshot?.battleId || ''; this.battleRevision = Number(snapshot?.battleRevision || 0);
    this.encounterId = snapshot?.encounterId || ''; this.state = snapshot?.state || null;
  }
  apply(payload) {
    this.battleId = payload.battleId; this.battleRevision = Number(payload.battleRevision || 0);
    this.encounterId = payload.encounterId || this.encounterId; this.state = payload.state || null;
    this.onChange(this.snapshot(), payload); return payload;
  }
  async start(request) {
    const payload = await requestJson(this.fetchImpl, `${this.apiBase}/api/battles/start`, { method: 'POST', body: JSON.stringify(request) });
    return this.apply(payload);
  }
  async resume() {
    if (!this.battleId) throw new Error('battle_not_started');
    const payload = await requestJson(this.fetchImpl, `${this.apiBase}/api/battles/${encodeURIComponent(this.battleId)}`, { method: 'GET' });
    return this.apply(payload);
  }
  async submit(stage, data) {
    if (!this.battleId) throw new Error('battle_not_started');
    const payload = await requestJson(this.fetchImpl, `${this.apiBase}/api/battles/${encodeURIComponent(this.battleId)}/resolve`, { method: 'POST', body: JSON.stringify({ expectedRevision: this.battleRevision, stage, data }) });
    return this.apply(payload);
  }
  snapshot() { return this.battleId ? { battleId: this.battleId, battleRevision: this.battleRevision, encounterId: this.encounterId, state: structuredClone(this.state) } : null; }
}
