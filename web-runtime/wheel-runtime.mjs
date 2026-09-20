const clone = (value) => structuredClone(value);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, fallback = '') => String(value ?? fallback);

/** Platform-neutral port of the data part of WheelFlowSession.gd. It does not
 * render UI or mutate a page; the Web shell consumes currentTask/events. */
export class WheelFlowRuntime {
  constructor({ flow = {}, strength = {}, optionEffects = {}, wheels = {}, seed = 1, snapshot = {} } = {}) {
    this.flow = clone(flow); this.strength = clone(strength); this.optionEffects = clone(optionEffects);
    const wheelList = Array.isArray(wheels) ? wheels : wheels.wheels;
    this.wheels = new Map((wheelList || []).filter(Boolean).map((wheel) => [Number(wheel.dbId), clone(wheel)]));
    this.seed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 1;
    this.index = Number(snapshot.index || 0); this.answers = clone(snapshot.answers || {}); this.flags = clone(snapshot.flags || { skipPeriods: {} });
    this.skipped = clone(snapshot.skipped || []); this.effectLedger = clone(snapshot.effectLedger || []); this.grade = clone(snapshot.grade || null); this.currentTask = snapshot.currentTask || null;
    this.timelineQueue = clone(snapshot.timelineQueue || []);
  }
  start() { if (!this.currentTask) this.currentTask = this.nextTask(); return clone(this.currentTask); }
  nextTask() {
    while (this.timelineQueue.length) {
      const queued = this.timelineQueue.shift();
      if (this.flags.skipPeriods?.[queued.timeline_period]) { this.skipped.push({ nodeId: queued.node_id, reason: 'timeline_period_skipped' }); continue; }
      if (!this.matches(queued.condition)) { this.skipped.push({ nodeId: queued.node_id, reason: 'condition_false', condition: queued.condition }); continue; }
      return this.taskFromRaw(queued.node_id, queued);
    }
    const mainFlow = Array.isArray(this.flow.mainFlow) ? this.flow.mainFlow : [];
    const nodes = object(this.flow.nodes);
    while (this.index < mainFlow.length) {
      const nodeId = text(mainFlow[this.index++]); const node = object(nodes[nodeId]);
      if (!Object.keys(node).length) { this.skipped.push({ nodeId, reason: 'node_missing' }); continue; }
      if (!this.matches(node.condition)) { this.skipped.push({ nodeId, reason: 'condition_false', condition: node.condition }); continue; }
      if (node.type === 'timelineSubflow') { this.enqueueTimeline(); continue; }
      const task = this.taskFromRaw(nodeId, node);
      if (task) return task;
      this.skipped.push({ nodeId, reason: 'non_interactive_branch' });
    }
    return { type: 'end', nodeId: 'complete', title: '流程完成' };
  }
  taskFromRaw(nodeId, node) {
    const type = text(node.type, 'wheel');
    if (type === 'computedGrade') return { type: 'computed_grade', nodeId, title: node.title || '等级判定' };
    if (type === 'customChoice' || type === 'binaryChoice') {
      const custom = (this.flow.customNodes || []).find((entry) => entry.id === node.customNodeId) || node;
      return { type: 'choice', nodeId, title: node.title || custom.title || '选择', options: clone(custom.options || []) };
    }
    if (type === 'wheel') {
      const wheel = this.wheels.get(Number(node.wheelId)) || {};
      return { type: 'wheel', nodeId, wheelId: Number(node.wheelId), title: node.title || wheel.title || '转盘', items: clone(wheel.items || node.options || []) };
    }
    if (type === 'dynamicWheel') {
      const selected = (node.wheelSelection || []).find((entry) => this.whenMatches(entry.when)) || {};
      const wheel = this.wheels.get(Number(selected.wheelId)) || {};
      return { type: 'wheel', nodeId, wheelId: Number(selected.wheelId), title: node.title || wheel.title || '转盘', items: clone(wheel.items || []) };
    }
    if (type === 'multiDraw' || type === 'subflow') {
      const ids = Array.isArray(node.wheels) ? node.wheels : [];
      const wheel = this.wheels.get(Number(node.contentWheelId));
      return { type: 'multi_wheel', nodeId, wheelIds: ids, wheelId: Number(node.contentWheelId), count: this.answerCount(node.countFrom), title: node.title || wheel?.title || '多选转盘', items: clone(wheel?.items || []) };
    }
    return null;
  }
  roll() {
    const task = this.currentTask || this.start();
    if (!['wheel', 'multi_wheel'].includes(task.type)) return '';
    const pick = (items) => {
      const list = Array.isArray(items) ? items : []; if (!list.length) return '';
      const total = list.reduce((sum, item) => sum + Math.max(0, Number(item.weight ?? 1)), 0); if (total <= 0) return '';
      let target = this.random() * total;
      for (const item of list) { target -= Math.max(0, Number(item.weight ?? 1)); if (target <= 0) return text(item.text ?? item.label); }
      return text(list[list.length - 1].text ?? list[list.length - 1].label);
    };
    if (task.type === 'multi_wheel') {
      const outputs = [];
      if (task.wheelIds?.length) for (const id of task.wheelIds) outputs.push(pick(this.wheels.get(Number(id))?.items || []));
      else for (let i = 0; i < Math.max(1, task.count || 1); i += 1) outputs.push(pick(task.items));
      return outputs.filter(Boolean).join('、');
    }
    return pick(task.items || task.options);
  }
  accept(result) {
    const task = this.currentTask || this.start(); const value = text(result).trim();
    if (task.type === 'computed_grade') {
      this.grade = this.grade || this.computeGrade(); this.answers[task.nodeId] = this.grade.grade_label; this.currentTask = this.nextTask();
      return { currentTask: clone(this.currentTask), events: [{ type: 'grade_computed', nodeId: task.nodeId, grade: clone(this.grade) }] };
    }
    if (!value || task.type === 'end') return { currentTask: clone(task), events: [] };
    this.answers[task.nodeId] = value; this.applyEffects(task.wheelId, value);
    this.currentTask = this.nextTask();
    return { currentTask: clone(this.currentTask), events: [{ type: 'wheel_result', nodeId: task.nodeId, value }] };
  }
  computeGrade() {
    const ranks = object(this.strength.rankScale); const keys = ['cursedEnergy', 'control', 'efficiency', 'body', 'martial', 'talent'];
    const values = keys.map((key) => Number(ranks[this.extractRank(this.answers[key]) ] || 0)).sort((a, b) => b - a);
    const score = Math.min(100, (values[0] || 0) * 3.8 + (values[1] || 0) * 2.4 + (values[2] || 0) * 1.6);
    const ranges = object(this.strength.deterministicGradeRanges).ranges || [{ grade: 'support', min: 0 }, { grade: 'grade4', min: 13 }, { grade: 'grade3', min: 22 }, { grade: 'grade2', min: 40 }, { grade: 'semiGrade1', min: 45 }, { grade: 'grade1', min: 57 }, { grade: 'semiSpecialGrade1', min: 67 }, { grade: 'specialGradeLow', min: 78 }, { grade: 'specialGrade', min: 83 }, { grade: 'specialGradeHigh', min: 90 }];
    let selected = ranges[0] || { grade: 'support', min: 0 }; for (const range of ranges) if (score >= Number(range.min || 0)) selected = range;
    const labels = { support: '辅助', grade4: '四级', grade3: '三级', grade2: '二级', semiGrade1: '准一级', grade1: '一级', semiSpecialGrade1: '超一级', specialGradeLow: '下位特级', specialGrade: '标准特级', specialGradeHigh: '上位特级' };
    this.grade = { key: text(selected.grade, 'support'), grade_label: labels[selected.grade] || text(selected.grade), score: Math.round(score * 10) / 10, source: 'source-strength-v0.2' };
    return clone(this.grade);
  }
  snapshot() { return { index: this.index, answers: clone(this.answers), flags: clone(this.flags), skipped: clone(this.skipped), effectLedger: clone(this.effectLedger), grade: clone(this.grade), currentTask: clone(this.currentTask), timelineQueue: clone(this.timelineQueue), seed: this.seed }; }
  random() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 0x100000000; }
  matches(expression) {
    const source = text(expression).trim(); if (!source) return true;
    return source.split(' or ').some((orTerm) => orTerm.split(' and ').every((term) => this.termMatches(term.trim())));
  }
  termMatches(term) {
    if (!term || term === 'default') return true;
    if (term.endsWith(' unset')) return !(term.slice(0, -6).trim() in this.answers);
    if (term.includes(' includes ')) { const [key, value] = term.split(' includes '); return text(this.valueFor(key.trim())).includes(value.trim()); }
    for (const op of [' != ', ' == ']) if (term.includes(op)) { const [key, expected] = term.split(op); const actual = text(this.valueFor(key.trim())); return op.trim() === '==' ? actual === expected.trim() : actual !== expected.trim(); }
    return false;
  }
  valueFor(key) { return this.flags[key] ?? this.answers[key] ?? ''; }
  whenMatches(value) { if (text(value, 'default') === 'default') return true; const stats = this.stats(); const rank = Number(this.strength.rankScale?.[stats.talent] || 0); if (value === 'highTalent') return rank >= 5; if (value === 'weakPower') return Object.values(stats).reduce((sum, item) => sum + Number(this.strength.rankScale?.[item] || 0), 0) <= 10; return false; }
  answerCount(value) { const match = text(this.answers[text(value)] || value || '1').match(/\d+/); return Math.max(1, Math.min(8, Number(match?.[0] || 1))); }
  stats() { return Object.fromEntries(['cursedEnergy', 'control', 'efficiency', 'body', 'martial', 'talent'].map((key) => [key, this.extractRank(this.answers[key])])); }
  extractRank(value) { const normalized = text(value).toUpperCase().replaceAll(' ', ''); return ['EX-', 'EX', 'SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E-', 'E'].find((rank) => normalized.includes(rank)) || 'E-'; }
  applyEffects(wheelId, optionText) {
    const id = `W${String(Number(wheelId)).padStart(3, '0')}`;
    for (const record of this.optionEffects.records || []) if (text(record.wheelId) === id && text(record.optionText) === optionText) for (const effect of record.effects || []) {
      this.effectLedger.push({ wheelId, optionText, effect: clone(effect) }); const type = text(effect.type);
      if (type === 'setFlag') this.flags[text(effect.flag)] = effect.value ?? true;
      else if (type === 'skipPeriod') (this.flags.skipPeriods ||= {})[text(effect.value)] = true;
      else if (type === 'deathOutcome') this.flags.dead = true;
      else if (type === 'battleResult') this.flags[text(effect.target, 'battleResult')] = effect.value;
      else if (['hiddenStrengthEligibility', 'factionOutcome', 'playerContribution'].includes(type)) { const list = this.flags[type] ||= []; if (!list.includes(effect.value)) list.push(effect.value); }
      else if (type === 'storyBenefit' || type === 'storyRisk') this.flags[type] = Number(this.flags[type] || 0) + Number(effect.value || 0);
    }
  }
  enqueueTimeline() {
    const timeline = object(this.flow.timeline); const periods = object(timeline.periods); const order = ['ancient', 'hiddenInventory', 'volume0', 'mainStart', 'shibuya', 'cullingGame', 'shinjuku', 'after68'];
    for (const period of order) for (const item of periods[period] || []) this.timelineQueue.push({ type: item.countFrom ? 'multi_wheel' : 'wheel', node_id: item.nodeId || `timeline-${period}-${item.wheelId || item.contentWheelId}`, title: item.title || '剧情事件', condition: item.condition || '', timeline_period: period, wheelId: Number(item.wheelId ?? item.contentWheelId), items: item.options || this.wheels.get(Number(item.wheelId ?? item.contentWheelId))?.items || [], count: this.answerCount(item.countFrom) });
  }
}
