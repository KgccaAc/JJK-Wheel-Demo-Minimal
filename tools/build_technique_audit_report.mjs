import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const inventory = read('reports/balance/technique-audit-inventory-2026-09-19.json');
const measurement = read('reports/balance/technique-audit-measurement-2026-09-19.json');
const rowsByCard = new Map();
for (const row of measurement.rows ?? []) {
  if (!rowsByCard.has(row.cardId)) rowsByCard.set(row.cardId, []);
  rowsByCard.get(row.cardId).push(row);
}
const avg = (rows, key) => {
  const values = rows.map((row) => Number(row[key] ?? 0));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};
const rate = (rows, predicate) => rows.length ? rows.filter(predicate).length / rows.length : 0;
const classify = (card, rows) => {
  if (!rows.length) return { type: 'missing_sample', severity: '观察', reason: card.missingReason ?? 'no_runtime_rows' };
  const failures = rate(rows, (row) => Boolean(row.failureReason));
  const avgDamage = avg(rows, 'damage');
  const avgCost = avg(rows.map((row) => ({ value: Number(row.resolvedCost?.ce ?? row.resolvedCost?.costCe ?? 0) })), 'value');
  if (failures >= 0.5) return { type: 'runtime_issue', severity: 'P1', reason: 'runtime_validation_or_pool_failure', failureRate: failures };
  if (avgCost > 0 && avgDamage / avgCost < 0.5 && Number(card.effect?.damage ?? 0) > 0) return { type: 'balance_issue', severity: 'P2', reason: 'low_observed_damage_per_ce', failureRate: failures };
  return { type: 'observation', severity: '观察', reason: 'no_threshold_breach', failureRate: failures };
};

const cards = inventory.cards.map((card) => {
  const rows = rowsByCard.get(card.id) ?? [];
  const diagnosis = classify(card, rows);
  const successful = rows.filter((row) => !row.failureReason);
  return {
    cardId: card.id,
    name: card.name,
    familyKeys: card.familyKeys,
    sourceValues: {
      cost: card.cost,
      effect: card.effect,
      accuracy: card.accuracy,
      requirements: card.requirements,
      risk: card.risk,
      domain: card.domain,
      summon: card.summon,
      selection: card.selection
    },
    sampleCount: rows.length,
    seeds: [...new Set(rows.map((row) => row.seed))],
    ceBands: [...new Set(rows.map((row) => row.ceBand))],
    metrics: {
      successfulRate: rate(rows, (row) => !row.failureReason),
      averageDamage: avg(successful, 'damage'),
      averageHealing: avg(successful, 'healing'),
      averageBlock: avg(successful, 'block'),
      averageShield: avg(successful, 'shield'),
      averageStatusDelta: avg(successful, 'statusDelta'),
      averageSummonDelta: avg(successful, 'summonDelta'),
      domainActiveRate: rate(successful, (row) => row.domain?.active === true),
      failureReasons: Object.fromEntries([...new Set(rows.map((row) => row.failureReason).filter(Boolean))].map((reason) => [reason, rows.filter((row) => row.failureReason === reason).length]))
    },
    diagnosis,
    adjustmentProposal: diagnosis.type === 'balance_issue'
      ? { action: 'reduce_cost_or_increase_effect_after_replay', suggestedChange: '先做 10% 单变量 CE/效果复测，不直接改源值', expectedImpact: '两回合有效伤害/CE 提升约 5%-15%', retest: '同 seed、同角色、同敌方、低/中/高 CE' }
      : diagnosis.type === 'runtime_issue'
        ? { action: 'fix_runtime_or_pool_reachability_before_balance_change', suggestedChange: '不提出伪数值调整', expectedImpact: '先恢复真实可用率，再复测', retest: '确认特殊效果、限制、命中和召唤事件实际落地' }
        : diagnosis.type === 'missing_sample'
          ? { action: 'collect_missing_runtime_sample', suggestedChange: '不提出数值调整', expectedImpact: '补齐角色/牌池或记录明确不可达原因', retest: '加入对应角色或专属场景后复测' }
          : { action: 'keep_baseline_and_playtest', suggestedChange: '暂不改值', expectedImpact: '维持当前节奏基线', retest: '扩大 seed 后观察尾部和两回合窗口' }
  };
});

const families = inventory.families.map((family) => {
  const familyCards = cards.filter((card) => card.familyKeys.includes(family.key));
  const rows = familyCards.flatMap((card) => rowsByCard.get(card.cardId) ?? []);
  return {
    familyKey: family.key,
    name: family.name,
    power: family.power,
    domainId: family.domainId,
    characterIds: family.characterIds,
    cardIds: family.cardIds,
    cardCount: familyCards.length,
    sampleCount: rows.length,
    metrics: { averageDamage: avg(rows, 'damage'), averageHealing: avg(rows, 'healing'), averageBlock: avg(rows, 'block'), averageStatusDelta: avg(rows, 'statusDelta'), averageSummonDelta: avg(rows, 'summonDelta'), successfulRate: rate(rows, (row) => !row.failureReason) },
    chain: { preparationCards: familyCards.filter((card) => /prepare|setup|resource/i.test(JSON.stringify(card.sourceValues))).map((card) => card.cardId), payoffCards: familyCards.filter((card) => Number(card.sourceValues.effect?.damage ?? 0) > 0).map((card) => card.cardId), domainCards: familyCards.filter((card) => card.sourceValues.domain?.id || /domain/i.test(String(card.sourceValues.type))).map((card) => card.cardId) },
    limitation: rows.length ? null : family.missingReason
  };
});

const report = { schema: 'jjk-technique-audit-v1', generatedAt: new Date().toISOString(), coverage: { inventoryCards: inventory.coverage.cardCount, inventoryCharacters: inventory.coverage.characterCount, registeredFamilies: inventory.coverage.registryFamilyCount, techniqueCards: cards.filter((card) => card.familyKeys.length).length, measuredCards: cards.filter((card) => card.sampleCount > 0).length, missingSampleCards: cards.filter((card) => card.sampleCount === 0).length }, families, cards, method: { runtime: 'BattleFlowSession + V3', seeds: measurement.seedSet, windows: ['low_ce_25%', 'normal_ce_60%', 'high_ce_100%', 'one_round_observed'], specialEffects: 'recorded from after-state and failure reasons; no reimplementation' } };
fs.writeFileSync(path.join(root, 'reports/balance/technique-audit-2026-09-19.json'), `${JSON.stringify(report, null, 2)}\n`);

const md = ['# 全术式审计报告', '', `生成时间：${report.generatedAt}`, '', '## 覆盖范围', '', `- 牌总数：${report.coverage.inventoryCards}`, `- 角色总数：${report.coverage.inventoryCharacters}`, `- 注册术式家族：${report.coverage.registeredFamilies}`, `- 术式牌：${report.coverage.techniqueCards}`, `- 有真实运行时样本：${report.coverage.measuredCards}`, `- 缺失运行时样本：${report.coverage.missingSampleCards}`, '', '特殊效果、出牌限制、命中分支、召唤和领域均从真实 V3 after-state/failureReason 记录；缺失样本不当作零价值。', '', '## 术式家族', '', '| 家族 | 角色数 | 牌数 | 样本 | 平均伤害 | 成功率 |', '|---|---:|---:|---:|---:|---:|'];
for (const family of families) md.push(`| ${family.name} (${family.familyKey}) | ${family.characterIds.length} | ${family.cardCount} | ${family.sampleCount} | ${family.metrics.averageDamage.toFixed(2)} | ${(family.metrics.successfulRate * 100).toFixed(1)}% |`);
md.push('', '## 单牌调整方案', '', '| 牌 | 家族 | 样本 | 诊断 | 严重度 | 建议 |', '|---|---|---:|---|---|---|');
for (const card of cards.filter((item) => item.familyKeys.length)) md.push(`| ${card.name} (${card.cardId}) | ${card.familyKeys.join(', ')} | ${card.sampleCount} | ${card.diagnosis.reason} | ${card.diagnosis.severity} | ${card.adjustmentProposal.suggestedChange} |`);
md.push('', '## 缺失样本清单', '');
for (const card of cards.filter((item) => item.sampleCount === 0)) md.push(`- ${card.name} (${card.cardId})：${card.diagnosis.reason}`);
fs.writeFileSync(path.join(root, 'reports/balance/technique-audit-2026-09-19.md'), `${md.join('\n')}\n`);

const proposals = ['# 全术式数值调整方案', '', '本文件只给出基于真实运行时证据的调整方向。运行时未生效或没有样本的术式不进行伪数值修改。', ''];
for (const card of cards.filter((item) => item.familyKeys.length)) proposals.push(`## ${card.name} (${card.cardId})`, `- 家族：${card.familyKeys.join(', ')}`, `- 样本：${card.sampleCount}；固定种子：${card.seeds.join(', ') || '无'}`, `- 当前诊断：${card.diagnosis.type} / ${card.diagnosis.severity} / ${card.diagnosis.reason}`, `- 当前观察：伤害 ${card.metrics.averageDamage.toFixed(2)}，治疗 ${card.metrics.averageHealing.toFixed(2)}，格挡 ${card.metrics.averageBlock.toFixed(2)}，护盾 ${card.metrics.averageShield.toFixed(2)}，状态变化 ${card.metrics.averageStatusDelta.toFixed(2)}，召唤变化 ${card.metrics.averageSummonDelta.toFixed(2)}`, `- 建议：${card.adjustmentProposal.suggestedChange}`, `- 复测：${card.adjustmentProposal.retest}`, '');
fs.writeFileSync(path.join(root, 'reports/balance/technique-adjustment-proposals-2026-09-19.md'), `${proposals.join('\n')}\n`);
console.log(`TECHNIQUE_AUDIT_REPORT PASS families=${families.length} cards=${cards.length} measured=${report.coverage.measuredCards} missing=${report.coverage.missingSampleCards}`);
