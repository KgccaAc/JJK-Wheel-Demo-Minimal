import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'data/battle/source/cards.json');
const cards = JSON.parse(fs.readFileSync(sourcePath, 'utf8')).cards;
const categories = {
  basic_attack: '基础攻击',
  high_risk_attack: '高风险攻击',
  defense_shield: '防御/护盾',
  resource_generation: '资源生成',
  status: '状态施加',
  technique_prepare: '术式准备',
  technique_payoff: '术式兑现',
  summon: '召唤',
  domain: '领域',
  counter_control: '反制/控制',
};

const asText = (value) => JSON.stringify(value ?? '').toLowerCase();
const effects = (card) => card?.effect ?? {};
const atomic = (card) => effects(card)?.special?.atomicEffects ?? [];
const text = (card) => [card.id, card.name, card.type, card.cardType, card.summary, card.damageType, ...(card.tags ?? []), card.sourceTechniqueFamily].filter(Boolean).join(' ').toLowerCase();
const atomicText = (card) => asText(atomic(card));
const risk = (card) => String(card.risk ?? '').toLowerCase();

function classify(card) {
  const t = text(card);
  const a = atomicText(card);
  const e = effects(card);
  const type = String(card.type ?? card.cardType ?? '').toLowerCase();
  if (type === 'domain' || type === 'domain_card' || /domain_activation|domain_expand|领域展开/.test(t)) return 'domain';
  if (type === 'summon' || a.includes('summon') || t.includes('召唤')) return 'summon';
  if (risk(card) === 'high' || risk(card) === 'critical' || t.includes('risk') || t.includes('高风险')) return 'high_risk_attack';
  if (a.includes('stun') || a.includes('disable') || a.includes('counter') || a.includes('selection_rule') || t.includes('反制') || t.includes('control')) return 'counter_control';
  if (Number(e.block ?? 0) > 0 || Number(e.shield ?? 0) > 0 || Number(e.healing ?? 0) > 0 || ['defense', 'guard', 'healing'].includes(type)) return 'defense_shield';
  if (type === 'resource' || t.includes('resource') || a.includes('adjust_counter') || a.includes('regenerate') || a.includes('gain_ce')) return 'resource_generation';
  if (a.includes('apply_status') || a.includes('register_counter_modifier') || (e.effects ?? []).length > 0 || t.includes('status') || t.includes('状态')) return 'status';
  if (type === 'technique_prepare' || type === 'setup' || t.includes('prepare') || t.includes('准备') || a.includes('authorize') || a.includes('technique_prepare')) return 'technique_prepare';
  if (type === 'technique' || type === 'special' || card.sourceTechniqueFamily || t.includes('technique') || t.includes('术式')) return 'technique_payoff';
  if (Number(e.damage ?? card.damage ?? 0) > 0) return 'basic_attack';
  return 'status';
}

function countPrerequisites(card) {
  let count = 0;
  for (const item of atomic(card)) {
    if ((item.when ?? []).length) count += 1;
    if (item.params?.require || item.params?.requires || item.params?.condition) count += 1;
  }
  return count;
}

function budget(card) {
  const e = effects(card);
  const a = atomic(card);
  const damage = Number(e.damage ?? card.damage ?? 0) || 0;
  const guard = (Number(e.block ?? 0) || 0) + (Number(e.shield ?? 0) || 0);
  const healing = Number(e.healing ?? 0) || 0;
  const statusCount = a.filter((x) => /apply_status|register_counter_modifier|adjust_counter|set_action_mode|selection_rule/.test(String(x.tool ?? ''))).length;
  const future = a.filter((x) => /prepare|authorize|unlock|register_counter_modifier/.test(String(x.tool ?? ''))).length;
  const combo = (card.matchTags ?? card.tags ?? []).length * 3;
  const prerequisites = countPrerequisites(card);
  const riskDiscount = ['high', 'critical'].includes(risk(card)) ? Math.max(5, damage * 0.2) : 0;
  const ce = Number(card.cost?.ce ?? 0) || 0;
  const total = damage + guard * 0.5 + healing * 0.6 + statusCount * 10 + future * 8 + combo - ce - prerequisites * 5 - riskDiscount;
  return { damage, guard, healing, statusCount, future, combo, ce, prerequisites, riskDiscount, total };
}

const rows = Object.fromEntries(Object.keys(categories).map((key) => [key, []]));
for (const card of cards) rows[classify(card)].push(card);
const report = {
  schema: 'jjk-card-balance-inventory-v1',
  generated_at: new Date().toISOString(),
  card_count: cards.length,
  categories: {},
  budget_model: {
    formula: '即时伤害 + 0.5*防御/护盾 + 0.6*治疗 + 10*状态动作 + 8*未来价值 + 3*标签组合 - CE - 5*前置 - 命中/风险折扣',
    warning: '静态预算只用于筛选基准牌；动态 DSL、命中率、领域和召唤容量必须用 Godot 实战回放校准。',
    resource_states: {
      low: 'max CE 的 25%，观察可行动率和 CE 拒绝率',
      normal: 'max CE 的 60%，观察常规节奏和三牌组合',
      high_domain: 'max CE 的 100%，另测领域激活后的伤害/负荷/回合变化',
    },
  },
};
for (const [key, list] of Object.entries(rows)) {
  const scored = list.map((card) => ({ card, score: budget(card) }));
  const avg = (field) => scored.length ? scored.reduce((sum, item) => sum + item.score[field], 0) / scored.length : 0;
  const representatives = [...scored]
    .sort((a, b) => Math.abs(a.score.total) - Math.abs(b.score.total))
    .slice(0, 5)
    .map(({ card, score }) => ({ id: card.id, name: card.name, type: card.type, tags: card.tags ?? [], cost_ce: score.ce, static_damage: score.damage, budget_total: Number(score.total.toFixed(2)), dynamic: score.statusCount > 0 || score.future > 0 || score.prerequisites > 0 }));
  report.categories[key] = {
    label: categories[key],
    count: list.length,
    avg_ce: Number(avg('ce').toFixed(2)),
    avg_static_damage: Number(avg('damage').toFixed(2)),
    avg_guard: Number(avg('guard').toFixed(2)),
    avg_healing: Number(avg('healing').toFixed(2)),
    dynamic_card_count: scored.filter(({ score }) => score.statusCount > 0 || score.future > 0 || score.prerequisites > 0).length,
    representatives,
  };
}

const outDir = path.join(root, 'reports/balance');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'card-balance-inventory-2026-09-19.json'), `${JSON.stringify(report, null, 2)}\n`);
const lines = [
  '# 卡牌功能分类与数值预算初盘（2026-09-19）',
  '',
  `总卡牌数：${report.card_count}。这是静态筛选盘，不代表最终强度排名。`,
  '',
  '| 分类 | 数量 | 平均 CE | 平均静态伤害 | 平均防御/护盾 | 平均治疗 | 动态牌数 |',
  '|---|---:|---:|---:|---:|---:|---:|',
];
for (const [key, row] of Object.entries(report.categories)) lines.push(`| ${row.label} | ${row.count} | ${row.avg_ce} | ${row.avg_static_damage} | ${row.avg_guard} | ${row.avg_healing} | ${row.dynamic_card_count} |`);
lines.push('', '## 每类基准牌（每类 5 张）', '');
for (const row of Object.values(report.categories)) {
  lines.push(`### ${row.label}`, '', '| ID | 名称 | CE | 静态伤害 | 初盘价值 | 动态 |', '|---|---|---:|---:|---:|---|');
  for (const card of row.representatives) lines.push(`| ${card.id} | ${card.name} | ${card.cost_ce} | ${card.static_damage} | ${card.budget_total} | ${card.dynamic ? '是' : '否'} |`);
  lines.push('');
}
lines.push('## 三档资源比较', '', '- 低资源：最大 CE 的 25%；重点看 CE 拒绝率和是否还能形成有效动作。', '- 正常资源：最大 CE 的 60%；重点看三牌组合、每回合有效 HP 伤害和角色主题牌占比。', '- 高资源/领域：最大 CE 的 100%，单独记录领域激活、负荷、伤害增益和回合长度，避免把领域只当作高数值按钮。', '', '预算公式：即时伤害 + 0.5×防御/护盾 + 0.6×治疗 + 10×状态动作 + 8×未来价值 + 3×标签组合 − CE − 5×前置 − 命中/风险折扣。动态 DSL、命中率和领域必须用真实 Godot 回放校准。');
fs.writeFileSync(path.join(outDir, 'card-balance-inventory-2026-09-19.md'), `${lines.join('\n')}\n`);
console.log(`CARD_BALANCE_INVENTORY PASS cards=${cards.length} categories=${Object.keys(report.categories).length}`);
