import fs from 'node:fs';
const inv = JSON.parse(fs.readFileSync('reports/balance/technique-audit-inventory-2026-09-19.json', 'utf8'));
const focus = ['blood_manipulation','limitless','star_rage','mythical_beast_amber','simple_domain','contract_recreation','curse_spirit_manipulation','ten_shadows','disaster_tides','disaster_flames','shrine','black_bird_manipulation'];
for (const family of focus) {
  const list = (inv.cards ?? []).filter((card) => (card.familyKeys ?? []).includes(family));
  console.log(`FAMILY ${family} cards=${list.length}`);
  for (const card of list) {
    const atomic = (card.atomicEffects ?? []).map((effect) => `${effect.tool}@${effect.trigger}`);
    const summon = card.summon?.unit ? {
      unitId: card.summon.unitId,
      name: card.summon.name,
      hp: card.summon.unit.hp,
      damage: card.summon.unit.damage,
      block: card.summon.unit.block,
      reduction: card.summon.unit.damageReductionRatio,
      intercept: Boolean(card.summon.guard?.interceptsOpponentAttacks),
      maintenance: card.summon.maintenance?.ceCost ?? null,
    } : null;
    console.log(JSON.stringify({ id: card.id, name: card.name, type: card.type, cost: card.cost, effect: card.effect, requirements: card.requirements, atomic, summon, domain: card.domain ?? null }));
  }
}
