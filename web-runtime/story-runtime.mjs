import { indexStoryPackage } from './content-loader.mjs';

const clone = (value) => structuredClone(value);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const hashUnit = (value) => {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967296;
};

/**
 * Deterministic story interpreter. It emits serialisable events and never
 * touches DOM, Godot nodes, network clients, or browser storage.
 */
export class StoryRuntime {
  constructor(packageData, snapshot = {}) {
    this.content = indexStoryPackage(packageData);
    this.maxTransitions = Number(snapshot.maxTransitions || 100);
    this.state = {
      saveId: snapshot.saveId || 'web-story-local',
      contentVersion: this.content.contentVersion,
      currentNodeId: snapshot.currentNodeId || this.content.project.entryNodeId,
      status: snapshot.status || 'running',
      revision: Number(snapshot.revision || 0),
      flags: clone(object(snapshot.flags)),
      resources: clone(object(snapshot.resources)),
      growth: clone(object(snapshot.growth)),
      relationships: clone(object(snapshot.relationships)),
      memories: clone(object(snapshot.memories)),
      inventory: clone(object(snapshot.inventory)),
      npcFlags: clone(object(snapshot.npcFlags)),
      randomSeed: String(snapshot.randomSeed || snapshot.saveId || 'web-story-local'),
      timeSlot: snapshot.timeSlot || null,
      history: Array.isArray(snapshot.history) ? clone(snapshot.history) : [],
    };
  }

  snapshot() { return clone(this.state); }
  currentNode() { return this.content.nodes[this.state.currentNodeId] || null; }

  start() {
    if (this.state.status === 'setup') this.state.status = 'running';
    return this.enterNode(this.state.currentNodeId);
  }

  enterNode(nodeId) {
    if (!nodeId || !this.content.nodes[nodeId]) return [this.fail('missing_node', nodeId)];
    this.state.currentNodeId = nodeId;
    const node = this.content.nodes[nodeId];
    const events = [{ type: 'node_entered', nodeId, nodeType: node.type, title: node.title || nodeId }];
    if (node.background || node.backgrounds || node.backgroundSequence) events.push({ type: 'change_background', background: clone(node.background || node.backgrounds || node.backgroundSequence) });
    if (node.type === 'end') {
      this.state.status = 'finished';
      events.push({ type: 'end', nodeId, reason: node.reason || 'story_end' });
    } else if (node.type === 'battle') events.push({ type: 'start_battle', nodeId, encounterId: node.encounterId, profile: clone(this.content.encounters[node.encounterId] || {}) });
    else if (node.type === 'ai_dialogue') events.push({ type: 'start_ai_dialogue', nodeId, speakerId: node.speakerId, fallbackSetId: node.fallbackSetId, maxTurns: node.maxTurns || 1 });
    else {
      const lines = Array.isArray(node.rpgLines) ? node.rpgLines.map((line) => ({ speaker: String(line?.speaker || ''), text: String(line?.text || '') })).filter((line) => line.text) : [];
      const text = String(node.dialogue || node.text || node.summary || lines[0]?.text || '');
      if (text || lines.length) events.push({ type: 'show_dialogue', nodeId, text, lines, speakerId: node.speakerId || lines[0]?.speaker || null });
      if (node.type === 'choice' || Array.isArray(node.choices) || Array.isArray(node.choiceSet)) {
        events.push({ type: 'show_choices', nodeId, timeSlots: Array.isArray(node.timeSlots) ? node.timeSlots.slice() : [], selectedTimeSlot: this.state.timeSlot, choices: this.choicesFor(node) });
      }
    }
    this.state.history.push({ type: 'node_entered', nodeId });
    this.state.revision += 1;
    return events;
  }

  choicesFor(node = this.currentNode()) {
    if (!node) return [];
    const raw = Array.isArray(node.choices) ? node.choices : Array.isArray(node.choiceSet) ? node.choiceSet : [];
    return raw.map((choice, index) => ({
      id: String(choice.id || `choice_${index}`),
      label: String(choice.label || choice.value || choice.id || `选项 ${index + 1}`),
      text: String(choice.text || ''),
      enabled: this.conditionsPass(choice) && (!Array.isArray(node.timeSlots) || !node.timeSlots.length || Boolean(this.state.timeSlot)),
      next: choice.next || node.next || null,
      timeSlots: Array.isArray(node.timeSlots) ? node.timeSlots.slice() : [],
    }));
  }

  setTimeSlot(timeSlot) {
    const node = this.currentNode();
    if (!node?.timeSlots?.includes(timeSlot)) return [this.fail('time_slot_not_found', timeSlot)];
    this.state.timeSlot = String(timeSlot);
    return [{ type: 'time_slot_selected', nodeId: node.id, timeSlot: this.state.timeSlot }, { type: 'show_choices', nodeId: node.id, timeSlots: node.timeSlots.slice(), selectedTimeSlot: this.state.timeSlot, choices: this.choicesFor(node) }];
  }

  choose(choiceId) {
    const node = this.currentNode();
    if (!node) return [this.fail('missing_current_node', this.state.currentNodeId)];
    const choices = Array.isArray(node.choices) ? node.choices : Array.isArray(node.choiceSet) ? node.choiceSet : [];
    const choice = choices.find((item) => String(item.id) === String(choiceId));
    if (!choice) return [this.fail('choice_not_found', choiceId)];
    if (Array.isArray(node.timeSlots) && node.timeSlots.length && !this.state.timeSlot) return [this.fail('time_slot_required', choiceId)];
    if (!this.conditionsPass(choice)) return [this.fail('choice_locked', choiceId)];
    const events = [{ type: 'choice_selected', nodeId: node.id, choiceId: String(choiceId) }];
    if (Array.isArray(node.outcomes) && node.outcomes.length) {
      const outcome = this.selectWeightedOutcome(node);
      if (!outcome) return [...events, this.fail('condition_outcome_missing', node.id)];
      events.push({ type: 'condition_resolved', nodeId: node.id, outcomeId: String(outcome.id || '') });
      events.push(...this.applyEffects(outcome));
      if (outcome.text) events.push({ type: 'show_dialogue', nodeId: node.id, text: String(outcome.text), lines: [{ speaker: '', text: String(outcome.text) }] });
      return this.advance(choice.next || outcome.next || node.next, events);
    }
    const outcome = object(choice.outcomes?.[this.state.timeSlot || node.timeSlots?.[0]] || choice.outcome || {});
    const effects = Object.keys(outcome).length ? outcome : choice;
    events.push(...this.applyEffects(effects));
    if (effects.text) events.push({ type: 'show_dialogue', nodeId: node.id, text: String(effects.text), lines: [{ speaker: '', text: String(effects.text) }] });
    return this.advance(choice.next || node.next, events);
  }

  selectWeightedOutcome(node) {
    const candidates = (node.outcomes || []).filter((outcome) => this.conditionsPass(outcome));
    if (!candidates.length) return null;
    const weighted = candidates.map((outcome) => {
      let weight = Math.max(0, number(outcome.weight, 1));
      for (const [flag, bonus] of Object.entries(object(outcome.weightByFlag))) if (this.state.flags[flag]) weight += Math.max(0, number(bonus));
      return { outcome, weight };
    });
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return weighted[0].outcome;
    let cursor = hashUnit(`${this.state.randomSeed}|${node.id}|${this.state.history.length}`) * total;
    for (const entry of weighted) { cursor -= entry.weight; if (cursor < 0) return entry.outcome; }
    return weighted.at(-1).outcome;
  }

  continue() {
    const node = this.currentNode();
    if (!node) return [this.fail('missing_current_node', this.state.currentNodeId)];
    return this.advance(node.next, [{ type: 'dialogue_completed', nodeId: node.id }]);
  }

  battleResolved(outcome, payload = {}) {
    const node = this.currentNode();
    if (!node || node.type !== 'battle') return [this.fail('battle_not_pending', this.state.currentNodeId)];
    const rule = object(node.battleRules?.[outcome]);
    const events = [{ type: 'battle_resolved', nodeId: node.id, outcome, payload: clone(payload) }];
    events.push(...this.applyEffects(rule));
    const next = node.outcomes?.[outcome] || (outcome === 'victory' ? node.next : node.failureNext) || node.next;
    return this.advance(next, events);
  }

  aiResolved(response = {}) {
    const node = this.currentNode();
    if (!node || node.type !== 'ai_dialogue') return [this.fail('ai_not_pending', this.state.currentNodeId)];
    const events = [{ type: 'ai_dialogue_resolved', nodeId: node.id, source: response.mode || response.source || 'fallback', message: response.message || response.text || '' }];
    events.push(...this.applyEffects(response.proposal || response.appliedEffects || response));
    const state = response.sessionState || response.conversation_state;
    if (state === 'complete') return this.advance(node.completionRoutes?.normal || node.next, events);
    return events;
  }

  conditionsPass(value) {
    const item = object(value);
    for (const flag of item.requiresFlags || []) if (!this.state.flags[flag]) return false;
    for (const flag of item.excludesFlags || []) if (this.state.flags[flag]) return false;
    for (const [key, min] of Object.entries(object(item.minResources))) if (number(this.state.resources[key]) < number(min)) return false;
    for (const condition of item.conditions || []) {
      const key = String(condition.key || condition.path || '');
      const actual = key.startsWith('flags.') ? this.state.flags[key.slice(7)] : this.state.resources[key];
      if (condition.op === '>=' && !(number(actual) >= number(condition.value))) return false;
      if (condition.op === '>' && !(number(actual) > number(condition.value))) return false;
      if (condition.op === '==' && actual !== condition.value) return false;
      if (condition.op === '!=' && actual === condition.value) return false;
    }
    return true;
  }

  applyEffects(effects = {}) {
    const item = object(effects);
    const events = [];
    const resourceEffects = { ...object(item.resources || item.resourceDelta) };
    for (const key of ['xp', 'stability', 'hp', 'ce', 'money']) if (item[key] !== undefined) resourceEffects[key] = item[key];
    for (const [key, delta] of Object.entries(resourceEffects)) {
      const next = number(this.state.resources[key]) + number(delta);
      this.state.resources[key] = next;
      events.push({ type: 'apply_effect', effectType: 'resource', key, delta: number(delta), value: next });
    }
    for (const [key, delta] of Object.entries(object(item.growth || item.growthDelta))) {
      const next = number(this.state.growth[key]) + number(delta);
      this.state.growth[key] = next;
      events.push({ type: 'apply_effect', effectType: 'growth', key, delta: number(delta), value: next });
    }
    for (const [key, value] of Object.entries(object(item.storyFlags || item.flags))) {
      this.state.flags[key] = value;
      events.push({ type: 'apply_effect', effectType: 'flag', key, value });
    }
    for (const [npcId, changes] of Object.entries(object(item.relationshipDelta || item.relationships))) {
      this.state.relationships[npcId] = { ...object(this.state.relationships[npcId]), ...Object.fromEntries(Object.entries(object(changes)).map(([key, delta]) => [key, number(this.state.relationships[npcId]?.[key]) + number(delta)])) };
      events.push({ type: 'apply_effect', effectType: 'relationship', npcId, changes: clone(changes) });
    }
    for (const memory of item.memoryUpdates || item.memories || []) if (typeof memory === 'string' || memory?.tag) {
      const tag = typeof memory === 'string' ? memory : memory.tag;
      this.state.memories[tag] = true;
      events.push({ type: 'apply_effect', effectType: 'memory', tag });
    }
    for (const [key, delta] of Object.entries(object(item.inventoryDelta || item.inventory))) {
      const next = number(this.state.inventory[key]) + number(delta);
      this.state.inventory[key] = next;
      events.push({ type: 'apply_effect', effectType: 'inventory', key, delta: number(delta), value: next });
    }
    for (const [npcId, values] of Object.entries(object(item.npcFlags))) {
      this.state.npcFlags[npcId] = { ...object(this.state.npcFlags[npcId]), ...clone(object(values)) };
      events.push({ type: 'apply_effect', effectType: 'npc_flag', npcId, values: clone(values) });
    }
    if (item.emotion) events.push({ type: 'emotion', emotion: String(item.emotion) });
    if (events.length) this.state.revision += 1;
    return events;
  }

  advance(target, events = []) {
    if (!target) return [...events, this.fail('missing_next', this.state.currentNodeId)];
    if (this.state.history.length > this.maxTransitions) return [...events, this.fail('transition_limit', this.state.currentNodeId)];
    return [...events, ...this.enterNode(String(target))];
  }

  fail(code, detail) { return { type: 'runtime_error', code, detail: String(detail || '') }; }
}

export function createStoryRuntime(packageData, snapshot) { return new StoryRuntime(packageData, snapshot); }
