# 术式族牌组评分系统设计

## 目标

为每个注册术式族生成可解释、可复跑的五维评分：综合分、攻击分、防御分、续航分、难度分。评分必须基于真实牌组组成、真实 V3 运行时结果和 DSL/特殊效果结构，而不是把静态伤害简单相加。

## 输入边界

- 牌组组成来自 `CardAvailabilityService` 可用牌池和术式审计索引，而不是只读 `matchTags`。
- 运行时价值来自 `BattleFlowSession`、`validate_play`、`ActionResolverV3`、`RoundResolverV3` 的真实样本。
- 特殊效果从 `atomicEffects`、after-state 和 failure reason 读取；评分器不重实现 DSL。
- 当前无 AP 机制，评分只使用 CE、牌数上限、出牌限制、命中和领域/召唤规则。

## 评分对象

每个 `familyKey` 按角色牌组分别计算，再汇总为术式族分数：

```text
TechniqueDeck(familyKey, characterId) =
  eligible normal cards
  + technique preparation/payoff cards
  + summon cards
  + domain cards
  + counter/maintenance cards
```

角色的 CE、效率、体术和领域能力保留在牌组上下文中；缺失样本不静默当作零伤害，而是单独进入可达性和置信度指标。

## 五维指标

### 攻击分（0-100）

使用成功样本的有效 HP 伤害、CE 伤害、稳定性伤害、兑现牌比例和两回合链路收益。静态 `effect.damage` 只用于识别攻击类别，不作为最终数值。

```text
attack_raw =
  0.55 × observed_hp_damage_score
+ 0.10 × observed_ce_damage_score
+ 0.10 × observed_stability_damage_score
+ 0.15 × payoff_coverage_score
+ 0.10 × chain_conversion_score
```

### 防御分（0-100）

使用实际格挡、护盾、治疗、incoming damage modifier、召唤拦截和领域减伤的 after-state 差值。领域和状态的防御收益只在两回合窗口计入，避免把“写入状态”误当即时防御。

```text
defense_raw =
  0.30 × observed_block_score
+ 0.25 × observed_shield_score
+ 0.20 × observed_healing_score
+ 0.15 × damage_reduction_score
+ 0.10 × summon_intercept_score
```

### 续航分（0-100）

衡量牌组能否持续行动并完成术式链：低 CE 可行动率、资源生成、治疗/恢复、召唤存活/维护、领域后续窗口、准备牌到兑现牌转化率。

```text
sustain_raw =
  0.30 × low_ce_playable_rate
+ 0.20 × resource_generation_score
+ 0.15 × healing_recovery_score
+ 0.15 × chain_conversion_score
+ 0.10 × summon_maintenance_score
+ 0.10 × domain_followup_score
```

### 难度分（0-100，越高越难）

难度不是强度惩罚的替代物，而是玩家完成有效牌组循环所需的操作和理解成本：

```text
difficulty =
  0.25 × DSL_complexity
+ 0.20 × prerequisite_depth
+ 0.20 × resource_pressure
+ 0.20 × observed_failure_rate
+ 0.15 × chain_break_rate
```

其中 DSL 复杂度按原子效果数量、不同 tool 数量、trigger 数量、状态/召唤/领域分支计分；前置深度按 `require_*`、counter、summon、domainActive 和 unlock 链计分。实际失败率来自运行时，不从静态标签猜测。

### 综合分（0-100）

先计算不含难度的战斗能力，再用可靠性和难度折减：

```text
reliability =
  0.45 × successful_runtime_rate
+ 0.25 × content_reachability
+ 0.20 × low_ce_playable_rate
+ 0.10 × (1 - chain_break_rate)

power =
  0.35 × attack
+ 0.25 × defense
+ 0.25 × sustain
+ 0.15 × reliability × 100

overall = clamp(power × (0.85 + 0.15 × reliability) × (1 - 0.25 × difficulty / 100), 0, 100)
```

难度只造成有限折减，避免高难度术式因为有技巧上限而被完全判弱；报告同时保留未折减 `power`、`reliability` 和 `difficulty`。

## 归一化锚点

所有可观测数值先使用固定锚点和分位数裁剪到 0-100：

- 有效 HP 伤害：0、5、10、20、35、60 对应 0、20、40、60、80、100。
- 防御/治疗/护盾：0、5、10、20、35、50 对应 0、20、40、60、80、100。
- 成功率、可行动率、兑现率、可达率：直接乘 100。
- DSL/前置复杂度：按全术式族 P10/P50/P90 分位数归一化。

锚点写入报告，不能在不同批次中悄悄改变。

## 置信度和缺失样本

每个术式族必须输出：角色数、牌数、运行时样本数、成功样本数、可达率、失败原因、置信度。缺少真实样本时：

- 不给出伪造的攻击/防御价值。
- 综合分标记 `low_confidence`。
- 只把缺失可达性反映到 reliability，不把缺失当作 0 伤害。

## 输出

生成：

- `reports/balance/technique-family-strength-2026-09-19.json`
- `reports/balance/technique-family-strength-2026-09-19.md`

每个术式族包含牌组组成、五维评分、未折减 power、可靠性、可达率、失败原因、DSL 复杂度、准备/兑现/召唤/领域/反制牌数量和置信度。

## 验收

- 12 个注册术式族全部有一行评分记录。
- 每个评分字段均在 0-100，难度明确为越高越难。
- 同一输入 JSON 重跑得到相同评分（生成时间除外）。
- 报告能区分运行时不可达、资源不足、前置失败和数值收益。
- AP 清理回归继续通过。
