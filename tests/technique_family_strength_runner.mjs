import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\');
const runner = fs.readFileSync(`${root}tools\\run_technique_family_strength.ps1`, 'utf8');
const inventory = JSON.parse(fs.readFileSync(`${root}reports\\balance\\technique-audit-inventory-2026-09-19.json`, 'utf8'));

assert.match(runner, /\[int\]\$CardLimit\s*=\s*0/, 'runner must default to the full inventory');
assert.match(runner, /--limit=\$CardLimit/, 'runner must pass the explicit card limit through');
assert.doesNotMatch(runner, /--limit=88/, 'runner must not retain the old 88-card cap');
const techniqueCardCount = inventory.cards.filter((card) => (card.familyKeys ?? []).length > 0).length;
assert.ok(techniqueCardCount > 88, 'inventory must prove the old cap was incomplete');

console.log(`TECHNIQUE_FAMILY_STRENGTH_RUNNER PASS techniqueCards=${techniqueCardCount}`);
