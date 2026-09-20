import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const root = process.cwd();
const balanceDir = path.join(root, 'reports', 'balance');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(balanceDir, name), 'utf8'));
const scores = await readJson('technique-family-strength-2026-09-19.json');
const inventory = await readJson('technique-audit-inventory-2026-09-19.json');
const coverage = await readJson('technique-family-coverage-2026-09-19.json');
const measurement = await readJson('technique-audit-measurement-2026-09-19.json');
const source = JSON.parse(await fs.readFile(path.join(root, 'data', 'wheel', 'source', 'strength-v0.2-candidate.json'), 'utf8'));

const wb = Workbook.create();
const overview = wb.worksheets.add('总览');
const family = wb.worksheets.add('术式族评分');
const profiles = wb.worksheets.add('Source Profiles');
const cards = wb.worksheets.add('牌明细');
const samples = wb.worksheets.add('运行样本');
const actions = wb.worksheets.add('改进方案');
const method = wb.worksheets.add('口径说明');

const navy = '#1F4E78';
const blue = '#D9EAF7';
const pale = '#F4F7FA';
const amber = '#FFF2CC';
const red = '#FCE4D6';
const green = '#E2F0D9';
const gray = '#666666';
const font = 'Arial';

function baseSheet(sheet) {
  sheet.showGridLines = false;
  sheet.getUsedRange()?.format && (sheet.getUsedRange().format.font = { name: font, size: 10, color: '#222222' });
}
function title(sheet, text, subtitle) {
  sheet.getRange('A1').values = [[text]];
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A1:H1').format = { font: { name: font, size: 16, bold: true, color: navy }, rowHeight: 26 };
  if (subtitle) {
    sheet.getRange('A2:H2').merge();
    sheet.getRange('A2').values = [[subtitle]];
    sheet.getRange('A2:H2').format = { font: { name: font, size: 10, italic: true, color: gray }, wrapText: true };
  }
}
function header(sheet, range) {
  sheet.getRange(range).format = { fill: navy, font: { name: font, size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, borders: { preset: 'all', style: 'thin', color: '#FFFFFF' } };
}
function body(sheet, range) {
  sheet.getRange(range).format = { font: { name: font, size: 10, color: '#222222' }, verticalAlignment: 'center', wrapText: false };
}
function table(sheet, range, name) {
  const t = sheet.tables.add(range, true, name);
  t.style = 'TableStyleMedium2';
  t.showFilterButton = true;
  return t;
}
function fit(sheet, range, widths = {}) {
  sheet.getRange(range).format.autofitColumns();
  for (const [col, width] of Object.entries(widths)) sheet.getRange(`${col}:${col}`).format.columnWidth = width;
}

const familyRows = scores.families.map((x, i) => [
  i + 1, x.familyKey, x.name, x.classification ?? '', (x.sourceProfiles ?? []).join('、'), x.scores.overall, x.scores.attack, x.scores.defense, x.scores.sustain, x.scores.difficulty, x.scores.reliability,
  x.cardComposition.cardIds.length, x.cardComposition.preparationCount, x.cardComposition.payoffCount, x.cardComposition.attackCount, x.cardComposition.defenseCount, x.cardComposition.resourceCount, x.cardComposition.summonCount, x.cardComposition.domainCount, x.cardComposition.counterCount,
  x.diagnostics.sampleCount, x.diagnostics.successfulSamples, x.diagnostics.contentReachability, x.diagnostics.runtimeSuccessRate, x.diagnostics.lowCePlayableRate, x.diagnostics.chainConversion, x.confidence, x.usableForTuning ? '是' : '否', x.interpretation,
  x.dslMetrics?.effectCount ?? 0, x.dslMetrics?.toolCount ?? 0, x.dslMetrics?.attackPotential ?? 0, x.dslMetrics?.defensePotential ?? 0,
  x.summonMetrics?.count ?? 0, x.summonMetrics?.interceptCount ?? 0, x.summonMetrics?.averageDamage ?? 0, x.summonMetrics?.projectedDefenseValue ?? 0, x.summonMetrics?.effectiveHp ?? 0, x.summonMetrics?.averageMaintenance ?? 0, scores.popularity?.status ?? 'missing_usage_data',
]);
const familyHeaders = ['排名','familyKey','名称','分类','Source Profiles','综合分','攻击分','防御分','续航分','难度分','可靠性','牌数','准备牌','兑现牌','攻击牌','防御牌','资源牌','召唤牌','领域牌','反制牌','运行样本','成功样本','内容可达率%','运行时成功率%','低CE可行动率%','链转化%','置信度','可直接调参','结论','DSL效果数','DSL工具数','DSL攻击潜力','DSL防御潜力','召唤数','护主拦截数','召唤平均攻击','召唤预计防御','召唤有效生命','维护CE','热门度证据'];

title(overview, 'JJK 术式族全量评分与改进分析', '数据批次：2026-09-19；真实 Godot 固定种子测量 + 牌池/DSL 组成；难度分越高表示越难驾驭。');
overview.getRange('A4:B10').values = [
  ['指标','值'], ['Source profile', scores.coverage.sourceProfileCount], ['Canonical family', scores.coverage.canonicalFamilyCount], ['术式牌运行测量', 67], ['运行样本', 792], ['可直接调参族', scores.families.filter(x => x.usableForTuning).length], ['无牌组/断链族', scores.families.filter(x => !x.cardComposition.cardIds.length).length],
];
header(overview, 'A4:B4'); body(overview, 'A5:B10'); overview.getRange('A4:B10').format.borders = { preset: 'all', style: 'thin', color: '#D9E2F3' };
overview.getRange('D4:H4').values = [['综合分前十','综合分','攻击分','防御分','续航分']];
const top10 = [...scores.families].sort((a,b) => b.scores.overall - a.scores.overall).slice(0,10);
overview.getRange('D5:H14').values = top10.map(x => [x.name, x.scores.overall, x.scores.attack, x.scores.defense, x.scores.sustain]);
header(overview, 'D4:H4'); body(overview, 'D5:H14');
overview.getRange('A13:H13').merge(); overview.getRange('A13').values = [['关键判断']]; overview.getRange('A13:H13').format = { fill: amber, font: { name: font, size: 11, bold: true, color: '#7F6000' } };
overview.getRange('A14:H18').merge(); overview.getRange('A14').values = [['1. 当前 70 个族全部完成评分，但没有族满足“可直接调参”门槛；评分适合排序和定位问题，不适合直接批量改牌值。\n2. 52 个族为 missing，主要是没有可匹配牌组或没有运行时样本；这类 0 分必须按内容断链处理。\n3. 18 个族为 low 置信度；下一步应优先补牌池可达性、专属角色样本和防御/领域 after-state，再做单变量平衡。']]; overview.getRange('A14:H18').format = { fill: pale, font: { name: font, size: 10, color: '#222222' }, wrapText: true, verticalAlignment: 'top' };
fit(overview, 'A1:H18', { A: 22, B: 16, C: 3, D: 28, E: 14, F: 12, G: 12, H: 12 });
overview.getRange('F5:H14').format.numberFormat = '0.00';

title(family, '术式族完整评分表', 'v2 评分：牌组结构 + DSL 事件价值 + 召唤生命周期/护主 + 运行时证据；热门度单独标记，当前无使用日志。');
family.getRange('A4:AN4').values = [familyHeaders];
family.getRange(`A5:AN${4 + familyRows.length}`).values = familyRows;
header(family, 'A4:AN4'); body(family, `A5:AN${4 + familyRows.length}`); table(family, `A4:AN${4 + familyRows.length}`, 'TechniqueFamilyScores');
family.freezePanes.freezeRows(4); family.freezePanes.freezeColumns(3);
family.getRange(`F5:K${4 + familyRows.length}`).format.numberFormat = '0.00'; family.getRange(`W5:Z${4 + familyRows.length}`).format.numberFormat = '0.00'; family.getRange(`AF5:AM${4 + familyRows.length}`).format.numberFormat = '0.00';
family.getRange(`F5:F${4 + familyRows.length}`).conditionalFormats.add('colorScale', { colors: ['#F8696B','#FFEB84','#63BE7B'], thresholds: ['min','50','max'] });
family.getRange(`AB5:AB${4 + familyRows.length}`).conditionalFormats.add('containsText', { text: '否', format: { fill: red, font: { color: '#9C0006', bold: true } } });
fit(family, 'A1:AN80', { A: 8, B: 24, C: 24, D: 18, E: 28, F: 10, G: 10, H: 10, I: 10, J: 10, K: 10, L: 8, U: 10, V: 10, W: 12, X: 14, Y: 14, Z: 10, AA: 10, AB: 11, AC: 16, AD: 10, AE: 10, AF: 12, AG: 12, AH: 10, AI: 12, AJ: 12, AK: 12, AL: 12, AM: 10, AN: 18 });

const profileRows = Object.entries(source.techniqueProfiles).map(([key, p]) => [key, p.displayName ?? key, p.owner ?? '', p.category ?? '', p.poolCategory ?? '', p.visibleGrade ?? '', p.baseCombatBonus ?? '', p.combatRealization ?? '', (p.tags ?? []).join('、'), (p.specialHandTags ?? []).join('、'), (p.alias ?? []).join('、'), p.domainName ?? '', p.nameStatus ?? '', p.isOfficialName === false ? '否' : '是', p.sourceNote ?? '']);
const profileHeaders = ['Source Profile','展示名','Owner','Category','Pool Category','Visible Grade','Base Combat Bonus','Combat Realization','Tags','Special Hand Tags','Aliases','Domain','Name Status','Official Name','Source Note'];
title(profiles, 'Source Profiles 完整目录', '72 个原始 profile；此表用于核对转盘来源、分类边界与评分族合并。');
profiles.getRange('A4:O4').values = [profileHeaders]; profiles.getRange(`A5:O${4 + profileRows.length}`).values = profileRows; header(profiles,'A4:O4'); body(profiles,`A5:O${4+profileRows.length}`); table(profiles,`A4:O${4+profileRows.length}`,'SourceProfiles'); profiles.freezePanes.freezeRows(4); profiles.freezePanes.freezeColumns(2); fit(profiles,'A1:O80',{A:24,B:28,C:16,D:24,E:22,F:12,G:16,H:16,I:28,J:28,K:28,L:22,M:22,N:12,O:60});

const cardRows = inventory.cards.map(c => [c.id,c.name,(c.familyKeys ?? []).join('、'),(c.matchTags ?? []).join('、'),c.type,JSON.stringify(c.cost),Number(c.effect?.damage ?? 0),Number(c.effect?.block ?? 0),Number(c.effect?.shield ?? 0),Number(c.effect?.healing ?? 0),(c.atomicEffects ?? []).length,JSON.stringify(c.requirements ?? {}),JSON.stringify(c.domain ?? {}),JSON.stringify(c.summon ?? {}),c.missingReason ?? '']);
const cardHeaders = ['Card ID','牌名','Family Keys','Match Tags','Type','Cost','Damage','Block','Shield','Healing','Atomic Effects','Requirements','Domain','Summon','Missing Reason'];
title(cards, '351 张牌完整明细', '原始牌池映射、DSL 原子效果和限制字段；Missing Reason 为空表示已匹配至少一个术式族。');
cards.getRange('A4:O4').values=[cardHeaders]; cards.getRange(`A5:O${4+cardRows.length}`).values=cardRows; header(cards,'A4:O4'); body(cards,`A5:O${4+cardRows.length}`); table(cards,`A4:O${4+cardRows.length}`,'TechniqueCards'); cards.freezePanes.freezeRows(4); cards.freezePanes.freezeColumns(3); cards.getRange(`O5:O${4+cardRows.length}`).conditionalFormats.add('containsBlanks',{format:{fill:green}}); fit(cards,'A1:O360',{A:34,B:28,C:28,D:32,E:16,F:18,G:10,H:10,I:10,J:10,K:12,L:32,M:24,N:24,O:24});

const sampleRows = (measurement.rows ?? []).map(r => [r.familyKey ?? '',r.cardId ?? '',r.seed ?? '',r.ceBand ?? '',r.failureReason ?? '',Number(r.damage ?? 0),Number(r.block ?? 0),Number(r.shield ?? 0),Number(r.healing ?? 0),Number(r.statusDelta ?? 0),Number(r.summonDelta ?? 0),r.domain?.active === true ? '是' : '否',r.restrictions ?? '',r.notes ?? '',JSON.stringify(r.summonBeforeState ?? {}),JSON.stringify(r.summonAfterState ?? {}),Number(r.traceSummary?.summonTargetHits ?? 0),Number(r.traceSummary?.summonAppliedDamage ?? 0),Number(r.traceSummary?.summonSpawnEvents ?? 0)]);
const sampleHeaders = ['Family Key','Card ID','Seed','CE Band','Failure Reason','Damage','Block','Shield','Healing','Status Delta','Summon Delta','Domain Active','Restrictions','Notes','Summon Before State','Summon After State','Summon Target Hits','Summon Applied Damage','Summon Spawn Events'];
title(samples,'运行样本明细','真实 Godot 固定种子测量；失败原因是合法限制或可达性诊断，不应直接当作数值弱。');
samples.getRange('A4:S4').values=[sampleHeaders]; samples.getRange(`A5:S${4+sampleRows.length}`).values=sampleRows; header(samples,'A4:S4'); body(samples,`A5:S${4+sampleRows.length}`); table(samples,`A4:S${4+sampleRows.length}`,'TechniqueRuntimeSamples'); samples.freezePanes.freezeRows(4); samples.freezePanes.freezeColumns(2); fit(samples,'A1:S800',{A:28,B:34,C:10,D:10,E:24,F:10,G:10,H:10,I:10,J:12,K:12,L:14,M:34,N:36,O:42,P:42,Q:16,R:18,S:18});

const actionRows = [
  ['P0','注册/数据链','已完成','source profile 72 项全部注册；65 个转盘选项全部解析；展示名快照桥接已修复。','保持验收：72/72 profile、65/65 wheel item。','不改牌值'],
  ['P1','牌池可达性','待执行','10 个 canonical family 无牌组，评分为 0 但不能判定为弱。','为角色专属/支援/反领域族补最小可玩牌组或明确标记为非战斗族；再重跑测量。','优先补内容链'],
  ['P1','运行时证据','待执行','18 个族为 low 置信度；当前没有族满足 usableForTuning。','为每个有牌族补 3 档 CE、至少 6 个固定种子、成功/失败/after-state 样本。','先补测量再调数'],
  ['P1','防御评分','待执行','多个族防御分接近 75，部分来自 declared DSL projection，不是实际 after-state。','分离“声明防御分”和“实测防御分”；缺 after-state 时降低置信度，不允许直接平衡。','避免虚高'],
  ['P1','领域/召唤','待执行','领域首回合即时伤害可能为 0，单回合评分会低估两回合兑现；召唤价值也存在窗口效应。','统一使用两回合窗口：激活回合、后续回合、CE/负荷、召唤拦截和最终 HP 变化。','改评分窗口'],
  ['P2','评分呈现','待执行','综合分能排序，但难度高低与“强弱”方向不同；热门度没有使用日志。','UI/报表同时展示能力分、可靠性、难度、DSL/召唤指标和样本置信度；热门度必须接入真实选择日志后再展示。','禁止伪造热门度'],
  ['P2','牌组构成','待执行','部分牌只有 support/constraint 标签，容易被误当普通术式牌。','保持 innate / character skill / tool / anti-domain / support 分类，并在牌池筛选中显示来源类别。','保持边界'],
  ['P2','单变量调参','待执行','当前报告适合找问题，不适合批量修改生产值。','先选高样本族做费用、伤害、前置条件三类单变量实验，比较同种子 TTK、低 CE 可行动率和方差。','可回滚'],
];
title(actions,'改进方案与执行优先级','依据本批次全量评分、真实运行时样本和牌组映射生成；不把缺样本当成弱。');
actions.getRange('A4:F4').values=[['优先级','问题域','状态','证据/判断','建议动作','边界']]; actions.getRange(`A5:F${4+actionRows.length}`).values=actionRows; header(actions,'A4:F4'); body(actions,`A5:F${4+actionRows.length}`); table(actions,`A4:F${4+actionRows.length}`,'TechniqueImprovementPlan'); actions.getRange(`A5:A${4+actionRows.length}`).conditionalFormats.add('containsText',{text:'P1',format:{fill:amber,font:{bold:true,color:'#7F6000'}}}); actions.getRange(`A5:A${4+actionRows.length}`).conditionalFormats.add('containsText',{text:'P0',format:{fill:red,font:{bold:true,color:'#9C0006'}}}); fit(actions,'A1:F20',{A:10,B:16,C:12,D:48,E:60,F:24}); actions.getRange('D5:F12').format.wrapText=true; actions.getRange('D5:F12').format.verticalAlignment='top';

title(method,'评分口径与限制','用于审计、复核和后续刷新，不是生产规则本身。');
method.getRange('A4:B18').values=[['项目','说明'],['数据来源','strength-v0.2-candidate.json、cards.json、characters.json、TechniqueAuditMeasurement 实测 JSON'],['Profile 数量',72],['Canonical family 数量',70],['转盘可抽取选项',65],['运行测量牌数',67],['运行样本数',792],['综合分','攻击、防御、续航、可靠性加权，并按难度做有限折减'],['攻击分','有效 HP/资源伤害、兑现覆盖、DSL 攻击事件和召唤攻击'],['防御分','实测格挡/护盾/治疗/减伤优先；缺样本时结合召唤物护主、减伤、有效生命和维护 CE 做投影'],['续航分','低 CE 可行动率、资源牌、恢复、链转化、领域/召唤窗口'],['难度分','DSL 复杂度、前置深度、CE 压力、运行失败率和链断率'],['召唤估值','使用两回合投影：召唤攻击、护主拦截、格挡、减伤、有效生命和维护 CE'],['热门度','当前没有真实选择/重复使用日志，报告标记为 missing_usage_data，不伪造热门分'],['关键限制','usableForTuning 当前为 0；所有生产数值调整必须先补可达性与 after-state 证据']]; header(method,'A4:B4'); body(method,'A5:B18'); method.getRange('A4:B18').format.borders={preset:'all',style:'thin',color:'#D9E2F3'}; method.getRange('B5:B18').format.wrapText=true; fit(method,'A1:B18',{A:24,B:100});

for (const s of [overview,family,profiles,cards,samples,actions,method]) { s.showGridLines = false; }
wb.recalculate();
const outDir = path.join(root,'reports','balance');
await fs.mkdir(outDir,{recursive:true});
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(path.join(outDir,'technique-family-full-analysis-2026-09-19.xlsx'));
const preview = await wb.render({sheetName:'总览',autoCrop:'all',scale:1,format:'png'});
await fs.writeFile(path.join(outDir,'technique-family-full-analysis-2026-09-19-preview.png'),new Uint8Array(await preview.arrayBuffer()));
console.log(`TECHNIQUE_BALANCE_WORKBOOK PASS families=${scores.families.length} profiles=${Object.keys(source.techniqueProfiles).length} cards=${inventory.cards.length} samples=${(measurement.rows ?? []).length}`);
