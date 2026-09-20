import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const failures = [];

const walk = (value, location = '$') => {
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${location}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (['ap', 'apCost', 'ap_cost'].includes(key)) failures.push(`${location}.${key}`);
      walk(child, `${location}.${key}`);
    }
  }
};

for (const relative of [
  'data/battle/source/cards.json',
  'data/battle/source/runtime/card-templates.json',
  'data/battle/source/runtime/hand-injections.json',
]) walk(readJson(relative), relative);

const flow = fs.readFileSync(path.join(root, 'battle/core/BattleFlowSession.gd'), 'utf8');
for (const token of ['DEFAULT_AP_BUDGET', 'ap_budget_exceeded', '_total_card_ap', 'card["ap"]', 'card["apCost"]']) {
  if (flow.includes(token)) failures.push(`BattleFlowSession contains ${token}`);
}

const dealer = fs.readFileSync(path.join(root, 'battle/runtime/HandDealer.gd'), 'utf8');
if (dealer.includes('apCost') && dealer.includes('"ap"'))
  failures.push('HandDealer materializes AP cost');

const runtime = fs.readFileSync(path.join(root, 'battle/data/CardTemplateRuntime.gd'), 'utf8');
if (runtime.includes('apCost') || runtime.includes('"ap"')) failures.push('CardTemplateRuntime emits AP');

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, message: 'AP legacy data and active-flow AP gates are absent' }));
