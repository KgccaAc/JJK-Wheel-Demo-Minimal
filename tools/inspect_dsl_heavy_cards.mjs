import fs from 'node:fs';

const inv = JSON.parse(fs.readFileSync('reports/balance/technique-audit-inventory-2026-09-19.json', 'utf8'));
const scores = JSON.parse(fs.readFileSync('reports/balance/technique-family-strength-2026-09-19.json', 'utf8'));
const cards = inv.cards ?? [];
const families = new Map();
for (const card of cards) {
  for (const family of card.familyKeys ?? []) {
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(card);
  }
}
const toolsOf = (card) => [...new Set((card.atomicEffects ?? []).map((effect) => effect.tool).filter(Boolean))];
const complexity = (card) => (card.atomicEffects ?? []).length
  + toolsOf(card).length * 1.5
  + (JSON.stringify(card.requirements ?? {}).match(/require_|when|activationDelay|duration|stacking/g) ?? []).length * 0.5
  + (card.summon?.unitId ? 3 : 0)
  + (card.domain?.id ? 3 : 0);
const rows = [];
for (const [family, list] of families) {
  rows.push({
    family,
    cards: list.length,
    atomic: list.reduce((sum, card) => sum + (card.atomicEffects ?? []).length, 0),
    avgDsl: Number((list.reduce((sum, card) => sum + complexity(card), 0) / list.length).toFixed(2)),
    maxDsl: Math.max(...list.map(complexity)),
    summons: list.filter((card) => card.summon?.unitId || (card.atomicEffects ?? []).some((effect) => effect.tool === 'summon_unit')).length,
    domains: list.filter((card) => card.domain?.id || /domain|领域/i.test(`${card.type} ${card.name}`)).length,
    requirements: list.filter((card) => Object.keys(card.requirements ?? {}).length > 0).length,
    types: [...new Set(list.map((card) => card.type))].join('|'),
    tools: [...new Set(list.flatMap(toolsOf))].join('|'),
  });
}
rows.sort((a, b) => b.avgDsl - a.avgDsl || b.atomic - a.atomic);
console.log('TOP_DSL_FAMILIES');
console.log(JSON.stringify(rows.slice(0, 30), null, 2));
console.log('TOP_DSL_CARDS');
const topCards = cards.map((card) => ({
  id: card.id,
  name: card.name,
  families: card.familyKeys,
  complexity: Number(complexity(card).toFixed(2)),
  atomicCount: (card.atomicEffects ?? []).length,
  tools: toolsOf(card),
  requirements: card.requirements ?? {},
  summon: card.summon ?? null,
  domain: card.domain ?? null,
  effect: card.effect ?? {},
})).sort((a, b) => b.complexity - a.complexity);
console.log(JSON.stringify(topCards.slice(0, 40), null, 2));
console.log('SCORE_JOIN');
for (const row of rows.slice(0, 20)) {
  const score = scores.families.find((item) => item.familyKey === row.family);
  console.log(JSON.stringify({ ...row, score: score?.scores ?? null, diagnostics: score?.diagnostics ?? null }));
}
