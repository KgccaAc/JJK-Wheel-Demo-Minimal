import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const inventory = read('reports/balance/technique-audit-inventory-2026-09-19.json');
const audit = read('reports/balance/technique-audit-2026-09-19.json');
const measurement = read('reports/balance/technique-audit-measurement-2026-09-19.json');
const clamp = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
const avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const rate = (rows, predicate) => rows.length ? rows.filter(predicate).length / rows.length : 0;
const piecewise = (value, anchors) => {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    if (value <= anchors[i][0]) {
      const [x0, y0] = anchors[i - 1]; const [x1, y1] = anchors[i];
      return y0 + (value - x0) / (x1 - x0) * (y1 - y0);
    }
  }
  return anchors.at(-1)[1];
};
const scoreDamage = (value) => piecewise(value, [[0, 0], [5, 20], [10, 40], [20, 60], [35, 80], [60, 100]]);
const scoreUtility = (value) => piecewise(value, [[0, 0], [5, 20], [10, 40], [20, 60], [35, 80], [50, 100]]);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cardsByFamily = new Map();
for (const card of inventory.cards ?? []) for (const family of card.familyKeys ?? []) {
  if (!cardsByFamily.has(family)) cardsByFamily.set(family, []);
  cardsByFamily.get(family).push(card);
}
const rowsByFamily = new Map();
for (const row of measurement.rows ?? []) {
  if (!rowsByFamily.has(row.familyKey)) rowsByFamily.set(row.familyKey, []);
  rowsByFamily.get(row.familyKey).push(row);
}
const auditByCard = new Map((audit.cards ?? []).map((card) => [card.cardId, card]));
const allAtomicCounts = inventory.cards.map((card) => card.atomicEffects?.length ?? 0).filter(Boolean).sort((a, b) => a - b);
const percentile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] : 1;
const p10 = percentile(allAtomicCounts, 0.1); const p50 = percentile(allAtomicCounts, 0.5); const p90 = percentile(allAtomicCounts, 0.9);
const complexityScore = (cards) => {
  const raw = avg(cards.map((card) => {
    const tools = new Set((card.atomicEffects ?? []).map((effect) => effect.tool)).size;
    const triggers = new Set((card.atomicEffects ?? []).map((effect) => effect.trigger)).size;
    const branches = (JSON.stringify(card.requirements ?? '').match(/require_|when|activationDelay|duration|stacking/g) ?? []).length;
    return (card.atomicEffects?.length ?? 0) + tools * 1.5 + triggers + branches * 0.5;
  }));
  if (raw <= p10) return 10;
  if (raw <= p50) return 35 + (raw - p10) / Math.max(1, p50 - p10) * 25;
  if (raw <= p90) return 60 + (raw - p50) / Math.max(1, p90 - p50) * 25;
  return 95;
};
const rowsFor = (family) => rowsByFamily.get(family.key) ?? [];
const declaredDefensePotential = (cards) => avg(cards.map((card) => {
  const effect = card.effect ?? {};
  let value = Number(effect.block ?? 0) + Number(effect.shield ?? 0) + Number(effect.healing ?? 0);
  for (const atomic of card.atomicEffects ?? []) {
    const params = atomic.params ?? {};
    if (atomic.tool === 'register_counter_modifier' && params.field === 'incomingHpScale') value += Math.max(0, 1 - Number(params.offset ?? 1)) * 20;
    if (atomic.tool === 'compute_action_value' && params.field === 'incomingHpScale') value += Math.max(0, 1 - Number(params.multiplier ?? 1)) * 20;
    if (atomic.tool === 'summon_unit' && (params.interceptsOpponentAttacks || params.guard || params.guardRules)) value += 10;
  }
  const summonSpecs = [];
  if (card.summon?.unitId) summonSpecs.push({ ...card.summon.unit, guard: card.summon.guard, maintenance: card.summon.maintenance });
  for (const atomic of card.atomicEffects ?? []) {
    if (atomic.tool !== 'summon_unit' || !atomic.params?.summonId) continue;
    const params = atomic.params;
    if (!summonSpecs.some((spec) => spec.unitId === params.summonId)) summonSpecs.push({ ...params, unitId: params.summonId, guard: params.guardRules });
  }
  for (const summon of summonSpecs) {
    const reduction = clamp(finite(summon.damageReductionRatio) * 100);
    const hp = Math.max(0, finite(summon.maxHp ?? summon.hp));
    const block = Math.max(0, finite(summon.defense ?? summon.block));
    const maintenance = Math.max(0, finite(summon.maintenanceCeCost ?? summon.maintenance?.ceCost));
    const intercept = summon.guard?.interceptsOpponentAttacks === true || summon.guardRules?.interceptsOpponentAttacks === true;
    value += Math.min(60, block * 0.5 + hp * 0.03 + reduction * 0.2 + (intercept ? 20 : 0) - maintenance * 0.25);
  }
  return value;
}));
const summarizeSummons = (cards, rows = []) => {
  const specs = [];
  const seen = new Set();
  for (const card of cards) {
    if (card.summon?.unitId) {
      const key = `${card.id}:${card.summon.unitId}`;
      if (!seen.has(key)) { seen.add(key); specs.push({ ...card.summon.unit, unitId: card.summon.unitId, guard: card.summon.guard, maintenance: card.summon.maintenance }); }
    }
    for (const atomic of card.atomicEffects ?? []) {
      if (atomic.tool !== 'summon_unit' || !atomic.params?.summonId) continue;
      const key = `${card.id}:${atomic.params.summonId}`;
      if (!seen.has(key)) { seen.add(key); specs.push({ ...atomic.params, unitId: atomic.params.summonId, guard: atomic.params.guardRules }); }
    }
  }
  const count = specs.length;
  const interceptCount = specs.filter((spec) => spec.guard?.interceptsOpponentAttacks === true || spec.guardRules?.interceptsOpponentAttacks === true).length;
  const avgOf = (selector) => count ? specs.reduce((sum, spec) => sum + selector(spec), 0) / count : 0;
  const averageReduction = avgOf((spec) => clamp(finite(spec.damageReductionRatio)));
  const averageHp = avgOf((spec) => Math.max(0, finite(spec.maxHp ?? spec.hp)));
  const averageDamage = avgOf((spec) => Math.max(0, finite(spec.attack ?? spec.damage)));
  const averageBlock = avgOf((spec) => Math.max(0, finite(spec.defense ?? spec.block)));
  const averageMaintenance = avgOf((spec) => Math.max(0, finite(spec.maintenanceCeCost ?? spec.maintenance?.ceCost)));
  const projectedDefenseValue = count ? Math.min(60, avgOf((spec) => {
    const hp = Math.max(0, finite(spec.maxHp ?? spec.hp));
    const block = Math.max(0, finite(spec.defense ?? spec.block));
    const reduction = clamp(finite(spec.damageReductionRatio)) * 100;
    const intercept = spec.guard?.interceptsOpponentAttacks === true || spec.guardRules?.interceptsOpponentAttacks === true;
    return block * 0.5 + hp * 0.03 + reduction * 0.2 + (intercept ? 20 : 0) - Math.max(0, finite(spec.maintenanceCeCost ?? spec.maintenance?.ceCost)) * 0.25;
  })) : 0;
  const observedRows = rows.filter((row) => row.traceSummary && typeof row.traceSummary === 'object');
  const observedInterceptHits = observedRows.reduce((sum, row) => sum + Math.max(0, finite(row.traceSummary.summonTargetHits)), 0);
  const observedAppliedDamage = observedRows.length ? observedRows.reduce((sum, row) => sum + Math.max(0, finite(row.traceSummary.summonAppliedDamage)), 0) / observedRows.length : 0;
  const observedSpawnEvents = observedRows.reduce((sum, row) => sum + Math.max(0, finite(row.traceSummary.summonSpawnEvents)), 0);
  const runtimeDefenseValue = observedRows.length ? clamp((observedInterceptHits / Math.max(1, observedRows.length)) * 20 + scoreUtility(observedAppliedDamage * 0.5)) : 0;
  return {
    count,
    interceptCount,
    interceptRate: count ? interceptCount / count : 0,
    averageHp: Number(averageHp.toFixed(2)),
    effectiveHp: Number((averageReduction < 1 ? averageHp / Math.max(0.1, 1 - averageReduction) : averageHp).toFixed(2)),
    averageDamage: Number(averageDamage.toFixed(2)),
    averageBlock: Number(averageBlock.toFixed(2)),
    averageReduction: Number(averageReduction.toFixed(4)),
    averageMaintenance: Number(averageMaintenance.toFixed(2)),
    projectedDamageValue: Number(scoreDamage(averageDamage).toFixed(2)),
    projectedDefenseValue: Number(projectedDefenseValue.toFixed(2)),
    observedInterceptHits,
    observedAppliedDamage: Number(observedAppliedDamage.toFixed(2)),
    observedSpawnEvents,
    runtimeDefenseValue: Number(runtimeDefenseValue.toFixed(2)),
    runtimeEvidence: observedInterceptHits > 0 || observedAppliedDamage > 0 || observedSpawnEvents > 0,
    effectiveDefenseValue: Number((runtimeDefenseValue > 0 ? (runtimeDefenseValue * 0.65 + projectedDefenseValue * 0.35) : projectedDefenseValue).toFixed(2)),
  };
};
const summarizeDsl = (cards) => {
  const effects = cards.flatMap((card) => card.atomicEffects ?? []);
  const tools = new Set(effects.map((effect) => effect.tool).filter(Boolean));
  let attackPotential = 0; let defensePotential = 0; let resourcePotential = 0;
  for (const effect of effects) {
    const params = effect.params ?? {};
    const field = String(params.field ?? '');
    if (field === 'damage' || effect.tool === 'modify_damage') attackPotential += 8;
    if (field === 'incomingHpScale' || (effect.tool === 'modify_scale' && params.stage === 'incomingHp')) {
      const scale = finite(params.multiplier ?? params.value ?? params.offset, 1);
      defensePotential += Math.max(0, 1 - scale) * 35;
    }
    if (effect.tool === 'register_counter_modifier' && field === 'incomingHpScale') defensePotential += 12;
    if (['adjust_counter', 'consume_counter', 'set_counter', 'adjust_resource', 'adjust_action_resource'].includes(effect.tool)) resourcePotential += 5;
    if (effect.tool === 'add_status') {
      if (finite(params.incomingHpScale, 1) < 1) defensePotential += (1 - finite(params.incomingHpScale, 1)) * 25;
      if (finite(params.outgoingScale, 1) > 1) attackPotential += (finite(params.outgoingScale, 1) - 1) * 25;
    }
  }
  return {
    effectCount: effects.length,
    toolCount: tools.size,
    tools: [...tools].sort(),
    attackPotential: Number(clamp(attackPotential).toFixed(2)),
    defensePotential: Number(clamp(defensePotential).toFixed(2)),
    resourcePotential: Number(clamp(resourcePotential).toFixed(2)),
  };
};

const scores = (inventory.families ?? []).map((family) => {
  const cards = cardsByFamily.get(family.key) ?? [];
  const rows = rowsFor(family);
  const successes = rows.filter((row) => !row.failureReason);
  const attackCards = cards.filter((card) => Number(card.effect?.damage ?? 0) > 0 || /attack|damage|strike|blast|slash/i.test(`${card.type} ${card.name}`));
  const summonMetrics = summarizeSummons(cards, rows);
  const dslMetrics = summarizeDsl(cards);
  const defenseCards = cards.filter((card) => Number(card.effect?.block ?? 0) > 0 || Number(card.effect?.shield ?? 0) > 0 || Number(card.effect?.healing ?? 0) > 0 || /guard|defense|barrier|heal|护|防|治疗/i.test(card.name) || card.summon?.unitId || (card.atomicEffects ?? []).some((effect) => effect.tool === 'summon_unit'));
  const resourceCards = cards.filter((card) => /resource|counter|ce|charge|蓄|资源|咒力/i.test(JSON.stringify(card)));
  const prepCards = cards.filter((card) => /prepare|setup|authorize|resource|charge|准备|蓄势|蓄力/i.test(JSON.stringify(card)));
  const payoffCards = cards.filter((card) => Number(card.effect?.damage ?? 0) > 0 || /payoff|release|blast|slash|cannon|炮|斩|击/i.test(card.name));
  const domainCards = cards.filter((card) => card.domain?.id || /domain|领域/i.test(`${card.type} ${card.name}`));
  const summonCards = cards.filter((card) => card.summon?.unitId || (card.atomicEffects ?? []).some((effect) => effect.tool === 'summon_unit'));
  const counterCards = cards.filter((card) => /counter|反制|control|控制|domain|领域/i.test(JSON.stringify(card)));
  const successfulRate = rate(rows, (row) => !row.failureReason);
  const lowRows = rows.filter((row) => row.ceBand === 'low');
  const lowPlayableRate = rate(lowRows, (row) => !row.failureReason);
  const chainConversion = prepCards.length ? clamp(payoffCards.length / prepCards.length * 50 + successfulRate * 50) / 100 : successfulRate;
  const avgDamage = avg(successes.map((row) => row.damage));
  const avgBlock = avg(successes.map((row) => row.block));
  const avgShield = avg(successes.map((row) => row.shield));
  const avgHealing = avg(successes.map((row) => row.healing));
  const avgStatus = avg(successes.map((row) => row.statusDelta));
  const avgSummon = avg(successes.map((row) => row.summonDelta));
  const domainRate = rate(successes, (row) => row.domain?.active === true);
  const observedDefenseEvidence = avgBlock + avgShield + avgHealing;
  const projectedDefenseEvidence = declaredDefensePotential(defenseCards);
  const defenseEvidenceMode = observedDefenseEvidence > 0 || summonMetrics.runtimeEvidence ? 'observed_after_state' : (projectedDefenseEvidence > 0 ? 'declared_dsl_projection' : 'none');
  const attack = clamp(0.45 * scoreDamage(avgDamage) + 0.10 * scoreUtility(avgStatus) + 0.10 * scoreUtility(avgSummon) + 0.15 * clamp(payoffCards.length / Math.max(1, cards.length) * 100) + 0.10 * chainConversion * 100 + 0.10 * dslMetrics.attackPotential + 0.05 * summonMetrics.projectedDamageValue);
  const defenseBase = observedDefenseEvidence > 0
    ? (0.25 * scoreUtility(avgBlock) + 0.20 * scoreUtility(avgShield) + 0.15 * scoreUtility(avgHealing) + 0.15 * scoreUtility(summonMetrics.effectiveDefenseValue) + 0.15 * dslMetrics.defensePotential + 0.10 * scoreUtility(avgSummon))
    : (0.45 * scoreUtility(projectedDefenseEvidence) + 0.25 * scoreUtility(summonMetrics.effectiveDefenseValue) + 0.20 * dslMetrics.defensePotential + 0.10 * scoreUtility(avgSummon));
  const defense = clamp(defenseBase + 0.15 * scoreUtility(avgStatus * 0.5));
  const sustain = clamp(0.30 * lowPlayableRate * 100 + 0.20 * clamp(resourceCards.length / Math.max(1, cards.length) * 100) + 0.15 * scoreUtility(avgHealing) + 0.15 * chainConversion * 100 + 0.10 * scoreUtility(avgSummon) + 0.10 * domainRate * 100);
  const failureRate = 1 - successfulRate;
  const prerequisiteDepth = clamp(cards.reduce((total, card) => total + (card.atomicEffects ?? []).filter((effect) => String(effect.tool).startsWith('require_')).length + Object.keys(card.requirements ?? {}).filter((key) => card.requirements[key] != null).length, 0) / Math.max(1, cards.length) * 25);
  const resourcePressure = clamp(100 - lowPlayableRate * 100);
  const chainBreakRate = clamp((1 - chainConversion) * 100);
  const difficulty = clamp(0.25 * complexityScore(cards) + 0.20 * prerequisiteDepth + 0.20 * resourcePressure + 0.20 * failureRate * 100 + 0.15 * chainBreakRate);
  // A generated row is not proof that a card reached the hand: target_not_dealt
  // is an explicit pool/reachability failure and must stay separate from legal
  // restrictions such as domain_not_available.
  const contentReachabilityRate = rate(rows, (row) => row.failureReason !== 'target_not_dealt');
  const reachability = cards.length ? contentReachabilityRate : 0;
  const reliability = clamp(0.45 * successfulRate * 100 + 0.25 * reachability * 100 + 0.20 * lowPlayableRate * 100 + 0.10 * (100 - chainBreakRate));
  const power = clamp(0.35 * attack + 0.25 * defense + 0.25 * sustain + 0.15 * reliability);
  const overall = clamp(power * (0.85 + 0.15 * reliability / 100) * (1 - 0.25 * difficulty / 100));
  return {
    familyKey: family.key,
    name: family.name,
    classification: family.category ?? 'unknown',
    sourceProfiles: family.sourceProfiles ?? [],
    cardComposition: { cardIds: cards.map((card) => card.id), preparationCount: prepCards.length, payoffCount: payoffCards.length, attackCount: attackCards.length, defenseCount: defenseCards.length, resourceCount: resourceCards.length, summonCount: summonCards.length, domainCount: domainCards.length, counterCount: counterCards.length },
    scores: { overall: Number(overall.toFixed(2)), attack: Number(attack.toFixed(2)), defense: Number(defense.toFixed(2)), sustain: Number(sustain.toFixed(2)), difficulty: Number(difficulty.toFixed(2)), reliability: Number(reliability.toFixed(2)), powerBeforeDifficulty: Number(power.toFixed(2)) },
    dslMetrics,
    summonMetrics,
    diagnostics: { cardCount: cards.length, sampleCount: rows.length, successfulSamples: successes.length, contentReachability: Number((reachability * 100).toFixed(2)), runtimeSuccessRate: Number((successfulRate * 100).toFixed(2)), lowCePlayableRate: Number((lowPlayableRate * 100).toFixed(2)), chainConversion: Number((chainConversion * 100).toFixed(2)), chainBreakRate: Number(chainBreakRate.toFixed(2)), averageDamage: Number(avgDamage.toFixed(2)), averageBlock: Number(avgBlock.toFixed(2)), averageShield: Number(avgShield.toFixed(2)), averageHealing: Number(avgHealing.toFixed(2)), projectedDefenseEvidence: Number(projectedDefenseEvidence.toFixed(2)), defenseEvidenceMode, domainActiveRate: Number((domainRate * 100).toFixed(2)), failureReasons: Object.fromEntries([...new Set(rows.map((row) => row.failureReason).filter(Boolean))].map((reason) => [reason, rows.filter((row) => row.failureReason === reason).length])) },
    dimensionCoverage: { attack: successes.length > 0, defense: defenseEvidenceMode !== 'none', sustain: rows.length > 0, difficulty: cards.length > 0 },
    confidence: rows.length >= cards.length * 6 && successfulRate >= 0.5 && defenseEvidenceMode === 'observed_after_state' ? 'medium' : rows.length ? 'low' : 'missing',
    usableForTuning: rows.length > 0 && successfulRate >= 0.5 && defenseEvidenceMode === 'observed_after_state' && reachability >= 0.5,
    interpretation: overall >= 90 ? '超标' : overall >= 75 ? '强势' : overall >= 60 ? '健康' : overall >= 40 ? '偏弱' : '不可用或严重断链'
  };
});

const report = { schema: 'jjk-technique-family-strength-v2', generatedAt: new Date().toISOString(), source: { inventory: 'technique-audit-inventory-2026-09-19', audit: 'technique-audit-2026-09-19', measurement: 'technique-audit-measurement-2026-09-19' }, coverage: { sourceProfileCount: inventory.coverage?.sourceProfileCount ?? 0, canonicalFamilyCount: scores.length }, popularity: { status: 'missing_usage_data', score: null, requiredFields: ['selectionRate', 'repeatRate', 'abandonRate', 'characterPreference'] }, anchors: { damage: [[0, 0], [5, 20], [10, 40], [20, 60], [35, 80], [60, 100]], utility: [[0, 0], [5, 20], [10, 40], [20, 60], [35, 80], [50, 100]], difficulty: 'DSL complexity, prerequisite depth, CE pressure, runtime failure, chain break', summon: 'two-turn projected damage, guard interception, effective HP, reduction, block, maintenance CE' }, families: scores };
fs.writeFileSync(path.join(root, 'reports/balance/technique-family-strength-2026-09-19.json'), `${JSON.stringify(report, null, 2)}\n`);
const md = ['# 术式族牌组强度评分', '', '评分来自真实牌池、固定种子和 V3 after-state；难度分越高表示越难驾驭。', '', '| 术式族 | 综合 | 攻击 | 防御 | 续航 | 难度 | 可靠性 | 样本 | 结论 |', '|---|---:|---:|---:|---:|---:|---:|---:|---|'];
for (const family of scores) md.push(`| ${family.name} (${family.familyKey}) | ${family.scores.overall} | ${family.scores.attack} | ${family.scores.defense} | ${family.scores.sustain} | ${family.scores.difficulty} | ${family.scores.reliability} | ${family.diagnostics.sampleCount} | ${family.interpretation} |`);
md.push('', '## 计算口径', '', '- 攻击分：有效 HP/资源伤害、兑现覆盖和链转化。', '- 防御分：实际格挡、护盾、治疗、减伤、召唤拦截。', '- 续航分：低 CE 可行动率、资源牌、恢复、链转化、召唤维护、领域后续。', '- 难度分：DSL 原子效果、前置深度、资源压力、真实失败率、断链率。', '- 综合分：战斗能力 × 可靠性，并对难度做有限折减。', '', '## 牌组组成与诊断', '');
for (const family of scores) md.push(`### ${family.name} (${family.familyKey})`, `- 牌数 ${family.cardComposition.cardIds.length}；准备 ${family.cardComposition.preparationCount}；兑现 ${family.cardComposition.payoffCount}；召唤 ${family.cardComposition.summonCount}；领域 ${family.cardComposition.domainCount}；反制 ${family.cardComposition.counterCount}`, `- 可达率 ${family.diagnostics.contentReachability}%；运行时成功率 ${family.diagnostics.runtimeSuccessRate}%；低 CE 可行动率 ${family.diagnostics.lowCePlayableRate}%；链转化 ${family.diagnostics.chainConversion}%`, `- 防御证据：${family.diagnostics.defenseEvidenceMode}；置信度：${family.confidence}；可直接用于调数：${family.usableForTuning ? '是' : '否'}`, '');
fs.writeFileSync(path.join(root, 'reports/balance/technique-family-strength-2026-09-19.md'), `${md.join('\n')}\n`);
console.log(`TECHNIQUE_FAMILY_SCORING PASS families=${scores.length}`);
