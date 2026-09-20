# 全术式审计统合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于真实 Godot V3 战斗逻辑，生成覆盖全部术式家族、术式链和单张术式牌的可复跑审计与数值调整建议。

**Architecture:** 先用 Node.js 读取源数据并建立稳定索引，再用 Godot headless 测量入口调用真实 `BattleFlowSession`/V3 解析链，最后由 Node.js 将原始 JSON 汇总为 Markdown。所有特殊效果、限制、命中分支、领域和召唤都以运行时结果记录，不在审计器中重实现战斗规则。

**Tech Stack:** Godot 4 GDScript、Node.js ESM、JSON、Markdown、固定种子测试夹具。

---

### Task 1: 建立术式覆盖索引

**Files:**
- Create: `tools/build_technique_audit_inventory.mjs`
- Create: `tests/technique_audit_inventory.mjs`
- Test output: `reports/balance/technique-audit-inventory-2026-09-19.json`

- [ ] **Step 1: Write the failing inventory assertions**

断言根数据包含 351 张牌、84 个角色；每个注册 canonical key 至少出现在索引或 `missingReason`；每张术式牌记录 `matchTags`、`requirements`、`accuracy`、`special.atomicEffects`、`domain`、`summon` 和源数值。

- [ ] **Step 2: Run the test and verify it fails**

Run: `node tests/technique_audit_inventory.mjs`

Expected: FAIL because the inventory generator does not exist.

- [ ] **Step 3: Implement the inventory generator**

读取 `data/battle/source/cards.json`、`characters.json`、`rules.json` 和 `scenes/wheel/WheelTechniqueRegistry.gd`；输出 `techniqueFamilies[]`、`techniqueCards[]`、`characters[]`、`domains[]`、`coverage`。匹配优先级固定为 canonical key、aliases、`matchTags`、角色 traits；无法映射的条目保留并写明原因。

- [ ] **Step 4: Run the test and verify it passes**

Run: `node tests/technique_audit_inventory.mjs`

Expected: `TECHNIQUE_AUDIT_INVENTORY PASS cards=351 characters=84 families>=registry`。

- [ ] **Step 5: Commit the inventory tool and test**

Run: `git add tools/build_technique_audit_inventory.mjs tests/technique_audit_inventory.mjs reports/balance/technique-audit-inventory-2026-09-19.json; git commit -m "test: inventory all technique content"`

### Task 2: 建立真实运行时测量夹具

**Files:**
- Create: `tests/godot/TechniqueAuditMeasurement.gd`
- Create: `tests/godot/TechniqueAuditMeasurementAcceptance.gd`
- Modify: `project.godot` only if the existing headless test entry requires registration
- Test output: `reports/balance/technique-audit-measurement-2026-09-19.json`

- [ ] **Step 1: Write the failing acceptance checks**

检查每个被测样本同时包含 `seed`、`familyKey`、`characterId`、`cardId`、`ceBand`、`roundsObserved`、`resolvedCost`、`requirementsChecked`、`hit/miss`、`damage/healing/block/shield/status/summon/domain`、`failureReason` 和 `runtimeVersion`。

- [ ] **Step 2: Run the acceptance check and verify it fails**

Run: `godot --headless --path . --script tests/godot/TechniqueAuditMeasurementAcceptance.gd`

Expected: FAIL because measurement output is absent.

- [ ] **Step 3: Implement measurements through shipped logic**

复用现有角色构建、发牌、`CardAvailabilityService`、`BattleFlowSession`、`ActionResolverV3` 和 `RoundResolverV3`。每个固定种子运行低 CE（上限约 25%）、正常 CE、恢复后的高 CE/领域样本；不直接计算伤害，不跳过 `requirements`，并记录被限制、无目标、未命中、状态未触发、召唤维护失败和领域延迟。

- [ ] **Step 4: Add paired baseline comparisons**

为每个术式牌选择同角色基础攻击或同类别基准牌，在同一 seed、同一敌方和同一 CE 档位下记录两回合有效 HP 伤害、承伤、净恢复、CE 消耗和 TTK 差异。

- [ ] **Step 5: Run acceptance and verify deterministic output**

Run: `godot --headless --path . --script tests/godot/TechniqueAuditMeasurementAcceptance.gd`

Expected: `TECHNIQUE_AUDIT_MEASUREMENT PASS` and repeated execution produces identical seed-level results.

### Task 3: 生成家族、链、单牌审计报告

**Files:**
- Create: `tools/build_technique_audit_report.mjs`
- Create: `reports/balance/technique-audit-2026-09-19.json`
- Create: `reports/balance/technique-audit-2026-09-19.md`
- Create: `reports/balance/technique-adjustment-proposals-2026-09-19.md`
- Test: `tests/technique_audit_report.mjs`

- [ ] **Step 1: Write report schema tests**

报告必须覆盖每个 family、每个关联 card 和每个缺失样本；每条结论带 `sampleCount`、`seeds`、`confidence` 和 `limitation`，并区分 `balance_issue`、`runtime_issue`、`missing_sample`。

- [ ] **Step 2: Run report tests and verify failure**

Run: `node tests/technique_audit_report.mjs`

Expected: FAIL because report generation is absent.

- [ ] **Step 3: Implement the report reducer**

按三层聚合可用率、实际 CE、每点 CE 收益、两回合 TTK、前置失败率、命中/未命中、状态窗口、召唤存活/维护、领域首回合与后续回合收益；治疗按净恢复，防御按实际避免伤害，复杂特殊效果保留事件明细。

- [ ] **Step 4: Implement adjustment proposal rules**

只有样本充分且确认运行时已生效时才提出数值建议。建议字段包含严重度、当前源值、解析值、建议值/区间、理由、预期 TTK 变化、风险和复测场景；特殊效果或限制未生效时改为修复建议，不伪造数值调整。

- [ ] **Step 5: Run report tests**

Run: `node tests/technique_audit_report.mjs`

Expected: `TECHNIQUE_AUDIT_REPORT PASS families=... cards=... missing=...`。

### Task 4: 基准建议单变量复测与回归

**Files:**
- Create: `tests/godot/TechniqueAuditProposalReplay.gd`
- Create: `reports/balance/technique-adjustment-replay-2026-09-19.json`
- Modify: only the explicitly selected benchmark values after proposal review; do not batch-edit all cards

- [ ] **Step 1: Select proposals with P0/P1 evidence**

只选择样本充分、问题可复现且不是运行时缺陷的少量基准术式；保留 baseline JSON，不改变 AP 相关数据。

- [ ] **Step 2: Run paired replay for one coherent change at a time**

使用完全相同的 seed、角色、敌方、CE 档位和政策，比较可用率、两回合 TTK、资源效率、方差和前置失败率；输出每个改变的 seed-level diff。

- [ ] **Step 3: Run regression suite**

Run: `node tests/ap_cleanup_acceptance.mjs`; `godot --headless --path . --script tests/godot/HandBalanceApBudgetAcceptance.gd`; `godot --headless --path . --script tests/godot/TechniqueAuditMeasurementAcceptance.gd`。

Expected: AP cleanup and technique measurement acceptance both PASS.

- [ ] **Step 4: Commit reports and approved benchmark changes**

Run: `git add reports/balance tests/godot tools; git commit -m "feat: add full technique audit and balance proposals"`

## Self-review

- Spec coverage: family/chain/card coverage is Task 1; runtime effects and restrictions are Task 2; reporting and proposals are Task 3; controlled validation is Task 4.
- Placeholder scan: no TBD/TODO steps; every task names files, commands, and expected results.
- Type consistency: `techniqueFamilies`, `techniqueCards`, `measurements`, `sampleCount`, `seeds`, and `failureReason` are used consistently across tasks.
