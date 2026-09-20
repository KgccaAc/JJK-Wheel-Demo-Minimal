import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('reports/balance/technique-family-strength-2026-09-19.json', 'utf8'));
for (const key of ['curse_spirit_manipulation', 'ten_shadows', 'limitless', 'star_rage', 'contract_recreation']) {
  const family = report.families.find((item) => item.familyKey === key);
  console.log(JSON.stringify({ key, scores: family?.scores, mode: family?.diagnostics?.defenseEvidenceMode, summon: family?.summonMetrics, dsl: family?.dslMetrics, samples: family?.diagnostics?.sampleCount }));
}
