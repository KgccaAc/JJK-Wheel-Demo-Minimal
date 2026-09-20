import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '').replaceAll('/', '\\');
const inventory = JSON.parse(fs.readFileSync(`${root}reports\\balance\\technique-audit-inventory-2026-09-19.json`, 'utf8'));
const measurement = JSON.parse(fs.readFileSync(`${root}reports\\balance\\technique-audit-measurement-2026-09-19.json`, 'utf8'));
const expectedCards = inventory.cards.length;
const rowCardIds = new Set((measurement.rows ?? []).map((row) => row.cardId));

assert.equal(measurement.coverage.inventoryCardCount, expectedCards);
assert.equal(measurement.coverage.attemptedCardCount, expectedCards, 'every inventory card must be attempted');
assert.equal(rowCardIds.size, expectedCards, 'missing or unmapped cards must remain visible as rows');
assert.ok(measurement.coverage.missingCardCount >= inventory.coverage.unmappedCardCount, 'unmapped cards must be explicit missing samples');

console.log(`TECHNIQUE_AUDIT_MEASUREMENT_COVERAGE PASS cards=${expectedCards} missing=${measurement.coverage.missingCardCount}`);
