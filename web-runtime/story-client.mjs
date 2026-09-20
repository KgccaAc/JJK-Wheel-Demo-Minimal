import { StoryRuntime } from './story-runtime.mjs';

const json = async (fetchImpl, url, body) => {
  const response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) { const error = new Error(payload?.error || `story_api_${response.status}`); error.status = response.status; error.payload = payload; throw error; }
  return payload;
};

// The server is authoritative. Convert only its accepted deltas back into the
// platform-neutral runtime shape; never replay the model's raw proposal when a
// session or chapter cap caused part of it to be rejected.
function authoritativeProposal(response = {}) {
  if (!Array.isArray(response.appliedEffects)) return response.proposal || {};
  const proposal = { growth: {}, relationshipDelta: {}, memoryUpdates: { tags: [], softFlags: {} } };
  for (const effect of response.appliedEffects) {
    const field = String(effect?.field || '');
    if (field === 'growth.xp') proposal.growth.xp = Number(effect.value || 0);
    else if (field.startsWith('relationshipDelta.')) {
      const [, npcId, key] = field.split('.');
      if (npcId && key) (proposal.relationshipDelta[npcId] ||= {})[key] = Number(effect.value || 0);
    } else if (field === 'emotion') proposal.emotion = String(effect.value || '');
    else if (field === 'memoryTags' && effect.value) proposal.memoryUpdates.tags.push(String(effect.value));
    else if (field.startsWith('softFlags.')) proposal.memoryUpdates.softFlags[field.slice('softFlags.'.length)] = Boolean(effect.value);
  }
  if (!Object.keys(proposal.growth).length) delete proposal.growth;
  if (!Object.keys(proposal.relationshipDelta).length) delete proposal.relationshipDelta;
  if (!proposal.emotion) delete proposal.emotion;
  if (!proposal.memoryUpdates.tags.length && !Object.keys(proposal.memoryUpdates.softFlags).length) delete proposal.memoryUpdates;
  return proposal;
}

/** Small application-facing adapter. UI modules subscribe to emitted events;
 * they never need to know whether a node is backed by Godot, HTTP, or AI. */
export class StoryClient {
  constructor({ packageData, snapshot = {}, apiBase = '', fetchImpl = globalThis.fetch, onEvents = () => {} } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl_required');
    this.runtime = new StoryRuntime(packageData, snapshot);
    this.apiBase = apiBase.replace(/\/$/, ''); this.fetchImpl = fetchImpl; this.onEvents = onEvents;
    this.ai = snapshot.aiSession ? { ...snapshot.aiSession } : null;
    this.runtime.state.aiSession = this.ai ? { ...this.ai } : null;
  }
  emit(events) { if (events?.length) this.onEvents(events, this.runtime.snapshot()); return events; }
  start() { return this.emit(this.runtime.start()); }
  choose(choiceId) { return this.emit(this.runtime.choose(choiceId)); }
  continue() { return this.emit(this.runtime.continue()); }
  battleResolved(outcome, payload) { return this.emit(this.runtime.battleResolved(outcome, payload)); }
  async startAiDialogue({ saveId, nodeId, npcId, context = {} } = {}) {
    const response = await json(this.fetchImpl, `${this.apiBase}/api/ai/dialogue/session`, { saveId, nodeId, npcId, context });
    this.ai = { sessionId: response.sessionId, npcId, nodeId, saveRevision: response.saveRevision };
    this.runtime.state.aiSession = { ...this.ai };
    this.emit([{ type: 'ai_session_started', response }]);
    return response;
  }
  async sendAiTurn(playerInput, context = {}) {
    if (!this.ai) throw new Error('ai_session_not_started');
    const response = await json(this.fetchImpl, `${this.apiBase}/api/ai/dialogue/turn`, { sessionId: this.ai.sessionId, playerInput, context, expectedSaveRevision: this.ai.saveRevision });
    this.ai.saveRevision = response.saveRevision;
    if (response.sessionState === 'complete') {
      this.ai = null;
      this.runtime.state.aiSession = null;
    } else this.runtime.state.aiSession = { ...this.ai };
    this.emit(this.runtime.aiResolved({ ...response, proposal: authoritativeProposal(response) }));
    return response;
  }
  async endAiDialogue() {
    if (!this.ai) return null;
    const response = await json(this.fetchImpl, `${this.apiBase}/api/ai/dialogue/end`, { sessionId: this.ai.sessionId, expectedSaveRevision: this.ai.saveRevision });
    this.ai = null;
    this.runtime.state.aiSession = null;
    // Ending a server session is also a gameplay result: the deterministic
    // runtime must leave the AI node through its configured completion route.
    return this.emit(this.runtime.aiResolved({ ...response, sessionState: 'complete', source: response.source || 'local' }));
  }
  snapshot() { return this.runtime.snapshot(); }
}

export function createStoryClient(options) { return new StoryClient(options); }
