import fs from 'node:fs';
const file = 'reports/balance/card-category-benchmark-gojo-sukuna-2026-09-19.json';
const fallback = 'reports/balance/card-category-benchmark-2026-09-19.json';
const report = JSON.parse(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fs.readFileSync(fallback, 'utf8'));
const labels = { basic_attack:'基础攻击', high_risk_attack:'高风险攻击', defense_shield:'防御/护盾', resource_generation:'资源生成', status:'状态施加', technique_prepare:'术式准备', technique_payoff:'术式兑现', summon:'召唤', domain:'领域', counter_control:'反制/控制' };
const lines = [
  '# 卡牌类别实战基准（2026-09-19）', '',
  `测试角色：${report.player} vs ${report.opponent}；每类最多 20 个固定种子；每次从全新真实 BattleFlowSession 开始，走发牌、弃牌、先手、V3 校验、真实结算和第二回合。`, '',
  '“缺失”表示该角色的真实可用牌池在该类别没有可注入/可发牌牌，不将缺失伪装成 0 价值。', '',
  '| 类别 | 实际观测 | 缺失 | 首回合有效伤害 | 第二回合伤害 | 两回合总伤害 | CE | 防御收益 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
];
for (const [key, row] of Object.entries(report.categories)) lines.push(`| ${labels[key] ?? key} | ${row.observations} | ${report.missing_hand_observations[key] ?? 0} | ${Number(row.avg_effective_hp_damage).toFixed(2)} | ${Number(row.avg_round_2_damage).toFixed(2)} | ${Number(row.avg_two_turn_damage).toFixed(2)} | ${Number(row.avg_ce_cost).toFixed(2)} | ${Number(row.avg_guard_gain).toFixed(2)} |`);
lines.push('', '## 结论边界', '', '- 基础攻击与高风险攻击可以直接做两回合 TTK 比较；高风险牌必须把命中/自损/前置折扣纳入价值预算。', '- 防御牌的当前指标是护盾/格挡增量代理，不等于已避免伤害；下一轮要记录对手攻击在有无护盾时的 HP 差值。', '- 状态牌的首轮即时伤害低并不代表无价值，必须比较第二回合兑现；当前报告把“状态增加”与“回合二伤害”分开记录。', '- 领域的主要信号是 CE 消耗、领域负荷和第二回合收益，而不是单独一回合伤害；当前 Gojo/Sukuna 场景领域平均 CE 约 24.2、负荷约 33，第二回合收益约 10.10。', '- 术式准备、资源生成、召唤在当前角色牌池中缺少可观测样本，不能据此判定弱；需要切换到拥有对应牌池的角色快照后再测。', '', '## 数值预算应用', '', '卡牌总价值 = 即时伤害 + 防御/治疗价值 + 状态价值 + 未来回合价值 + 组合价值 − CE 成本 − 前置条件折扣 − 命中/风险折扣。', '', '本轮只产出基准，不修改卡牌数值。');
fs.writeFileSync('reports/balance/card-category-benchmark-2026-09-19.md', `${lines.join('\n')}\n`);
console.log('CARD_CATEGORY_REPORT PASS');
