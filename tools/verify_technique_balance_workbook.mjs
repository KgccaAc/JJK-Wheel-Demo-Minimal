import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const root = process.cwd();
const file = `${root}/reports/balance/technique-family-full-analysis-2026-09-19.xlsx`;
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const names = wb.worksheets.items.map((s) => s.name);
console.log(`SHEETS ${names.join('|')}`);
const checks = [
  ['总览', 'A1:H18'],
  ['术式族评分', 'A1:AN74'],
  ['Source Profiles', 'A1:O76'],
  ['牌明细', 'A1:O355'],
  ['运行样本', 'A1:N796'],
  ['改进方案', 'A1:F12'],
  ['口径说明', 'A1:B18'],
];
for (const [sheet, range] of checks) {
  const result = await wb.inspect({ kind: 'table', range: `${sheet}!${range}`, include: 'values,formulas', tableMaxRows: 5, tableMaxCols: 8 });
  console.log(`CHECK ${sheet} ${result.ndjson.split('\n').filter(Boolean).length} lines`);
}
const errors = await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 300 }, summary: 'final formula error scan' });
console.log(`ERROR_SCAN ${errors.ndjson.trim() || 'NONE'}`);
const outDir = `${root}/reports/balance/verification-renders`;
await fs.mkdir(outDir, { recursive: true });
for (const sheet of names) {
  const blob = await wb.render({ sheetName: sheet, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(`${outDir}/${sheet}.png`, new Uint8Array(await blob.arrayBuffer()));
  console.log(`RENDER ${sheet}`);
}
