import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\');
const output = `${root}reports\\balance\\technique-audit-inventory-2026-09-19.json`;
execFileSync(process.execPath, ['tools/build_technique_audit_inventory.mjs'], { cwd: root, stdio: 'inherit' });
const report = JSON.parse(fs.readFileSync(output, 'utf8'));

assert.equal(report.coverage.cardCount, 351);
assert.equal(report.coverage.characterCount, 84);
assert.equal(report.coverage.sourceProfileCount, 72);
assert.ok(report.coverage.registryFamilyCount >= 60);
assert.equal(report.cards.length, 351);
assert.equal(report.characters.length, 84);
assert.ok(report.cards.every((card) => Array.isArray(card.matchTags)));
assert.ok(report.cards.every((card) => card.requirements && card.accuracy));
assert.ok(report.cards.every((card) => Array.isArray(card.atomicEffects)));
assert.ok(report.cards.every((card) => Object.hasOwn(card, 'missingReason')));
assert.ok(report.families.every((family) => Array.isArray(family.cardIds) && Array.isArray(family.characterIds)));
assert.ok(report.families.some((family) => family.key === 'idle_transfiguration'));
assert.ok(report.families.some((family) => family.key === 'ratio_technique'));
assert.ok(report.families.some((family) => family.key === 'boogie_woogie'));
assert.ok(report.families.every((family) => family.key.length > 0));
assert.ok(report.families.every((family) => family.cardIds.length < report.coverage.cardCount));
assert.ok(report.coverage.unmappedCardCount >= 0);
console.log(`TECHNIQUE_AUDIT_INVENTORY PASS cards=${report.cards.length} characters=${report.characters.length} families=${report.families.length}`);
