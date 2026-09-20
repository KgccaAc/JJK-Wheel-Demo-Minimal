export const ATOMIC_EFFECT_SCHEMA = "jjk.atomic-effect.v2";

export const ATOMIC_TRIGGERS = Object.freeze([
  "availability",
  "pre-damage",
  "on-hit",
  "on-miss",
  "post-damage",
  "before-receive-damage",
  "after-receive-damage",
  "turn-start",
  "turn-end",
  "summon-defeated",
  "shield-broken"
]);

export const ATOMIC_TARGETS = Object.freeze(["self", "opponent", "all-enemies", "all-allies"]);

const tool = (label, options = {}) => Object.freeze({
  label,
  defaultTrigger: options.defaultTrigger || "post-damage",
  triggers: Object.freeze(options.triggers || ATOMIC_TRIGGERS),
  category: options.category || "utility"
});

export const ATOMIC_TOOL_DEFINITIONS = Object.freeze({
  adjust_resource: tool("调整资源", { category: "resource" }),
  pay_hp_cost: tool("支付体力代价", { category: "resource", defaultTrigger: "pre-damage", triggers: ["pre-damage"] }),
  set_counter: tool("设定计数器", { category: "counter" }),
  adjust_counter: tool("增减计数器", { category: "counter" }),
  consume_counter: tool("消耗计数器", { category: "counter", triggers: ["post-damage"] }),
  selection_rule: tool("选牌关系", { category: "availability", defaultTrigger: "availability", triggers: ["availability", "pre-damage"] }),
  require_status: tool("要求状态", { category: "availability", defaultTrigger: "availability", triggers: ["availability", "pre-damage"] }),
  require_summon: tool("要求召唤单位", { category: "availability", defaultTrigger: "availability", triggers: ["availability", "pre-damage"] }),
  require_summon_group: tool("要求召唤物集合", { category: "availability", defaultTrigger: "availability", triggers: ["availability", "pre-damage"] }),
  require_value: tool("要求数值条件", { category: "availability", defaultTrigger: "availability", triggers: ["availability", "pre-damage"] }),
  compute_action_value: tool("计算动作数值", { category: "action", defaultTrigger: "pre-damage", triggers: ["pre-damage"] }),
  set_damage_policy: tool("设置伤害结算策略", { category: "damage", defaultTrigger: "pre-damage", triggers: ["pre-damage"] }),
  set_action_mode: tool("切换动作形态", { category: "action", defaultTrigger: "pre-damage", triggers: ["pre-damage"] }),
  register_counter_modifier: tool("登记计数器修正", { category: "counter" }),
  set_action_order: tool("设置结算顺序", { category: "action", defaultTrigger: "pre-damage", triggers: ["pre-damage"] }),
  modify_damage: tool("修改本次伤害", { category: "damage", defaultTrigger: "pre-damage", triggers: ["pre-damage", "before-receive-damage"] }),
  modify_scale: tool("修改战斗倍率", { category: "action" }),
  modify_weight: tool("修改行动权重", { category: "action" }),
  adjust_action_resource: tool("调整战斗阶段资源", { category: "resource" }),
  unlock_card_pool: tool("解锁卡牌池", { category: "hand" }),
  grant_temporary_technique_tag: tool("临时术式标签", { category: "hand", defaultTrigger: "post-damage", triggers: ["availability", "post-damage"] }),
  branch_on_value: tool("数值条件分支", { category: "control" }),
  schedule_effect: tool("预约效果", { category: "timer" }),
  advance_timer: tool("推进计时器", { category: "timer" }),
  cancel_timer: tool("取消计时器", { category: "timer" }),
  add_status: tool("添加状态", { category: "status" }),
  apply_barrier: tool("施加护盾", { category: "status", defaultTrigger: "post-damage", triggers: ["post-damage", "shield-broken", "turn-start"] }),
  add_computed_status: tool("添加公式状态", { category: "status" }),
  remove_status: tool("移除状态", { category: "status" }),
  modify_status: tool("修改状态", { category: "status" }),
  grant_card: tool("获得卡牌", { category: "hand" }),
  discard_card: tool("弃置卡牌实例", { category: "hand" }),
  remove_card: tool("移除卡牌", { category: "hand" }),
  transform_card: tool("变换卡牌", { category: "hand" }),
  summon_unit: tool("召唤单位", { category: "summon", triggers: ["post-damage"] }),
  summon_group_action: tool("召唤物集合行动", { category: "summon", defaultTrigger: "post-damage", triggers: ["post-damage", "on-hit"] }),
  update_summon: tool("修改召唤物", { category: "summon" }),
  destroy_summon: tool("消灭召唤物", { category: "summon" }),
  recall_summon: tool("收回召唤物", { category: "summon" }),
  delegate_control: tool("委托控制", { category: "control" }),
  end_delegation: tool("结束委托", { category: "control" }),
  emit_battle_event: tool("战斗事件", { category: "event" }),
  set_targeting: tool("设置目标范围", { category: "action", defaultTrigger: "pre-damage", triggers: ["pre-damage"] }),
  set_combat_range: tool("调整战斗距离", { category: "action", defaultTrigger: "pre-damage", triggers: ["pre-damage"] })
});

export const ATOMIC_TOOL_IDS = Object.freeze(Object.keys(ATOMIC_TOOL_DEFINITIONS));
const LEGACY_TOOL_ALIASES = Object.freeze({ bind_counter_modifier: "register_counter_modifier" });

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeConditions(effect) {
  if (Array.isArray(effect?.when)) return clone(effect.when);
  if (effect?.condition && typeof effect.condition === "object") return [clone(effect.condition)];
  return [];
}

export function normalizeAtomicEffect(raw, options = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const toolId = LEGACY_TOOL_ALIASES[String(source.tool || "")] || String(source.tool || "");
  const definition = ATOMIC_TOOL_DEFINITIONS[toolId];
  const params = clone(source.params && typeof source.params === "object" && !Array.isArray(source.params) ? source.params : {});
  if (source.tool === "bind_counter_modifier") delete params.statusId;
  if (["set_counter", "adjust_counter", "consume_counter", "register_counter_modifier"].includes(toolId) && !params.namespace) {
    params.legacyCustomCounter = true;
  }
  return {
    schema: ATOMIC_EFFECT_SCHEMA,
    id: String(source.id || options.fallbackId || `${toolId || "effect"}-${options.index || 0}`),
    tool: toolId,
    trigger: String(source.trigger || source.timing || definition?.defaultTrigger || "post-damage"),
    target: ATOMIC_TARGETS.includes(source.target) ? source.target : "self",
    when: normalizeConditions(source),
    params
  };
}

export function normalizeAtomicEffects(rawEffects) {
  return (Array.isArray(rawEffects) ? rawEffects : []).slice(0, 24).map((effect, index) => normalizeAtomicEffect(effect, { index }));
}

function validateCondition(condition, path, errors) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    errors.push({ path, code: "invalid-condition", message: "条件必须是对象" });
    return;
  }
  if (!condition.source) errors.push({ path: `${path}.source`, code: "missing-source", message: "条件缺少 source" });
  if (condition.threshold !== undefined && !Number.isFinite(Number(condition.threshold))) {
    errors.push({ path: `${path}.threshold`, code: "invalid-number", message: "条件阈值必须是有限数值" });
  }
}

export function validateAtomicEffects(rawEffects) {
  const effects = normalizeAtomicEffects(rawEffects);
  const errors = [];
  const ids = new Set();
  effects.forEach((effect, index) => {
    const path = `atomicEffects[${index}]`;
    if (!effect.id) errors.push({ path: `${path}.id`, code: "missing-id", message: "原子效果缺少 id" });
    if (ids.has(effect.id)) errors.push({ path: `${path}.id`, code: "duplicate-id", message: `重复的原子效果 id：${effect.id}` });
    ids.add(effect.id);
    const definition = ATOMIC_TOOL_DEFINITIONS[effect.tool];
    if (!definition) errors.push({ path: `${path}.tool`, code: "unknown-tool", message: `未知原子工具：${effect.tool || "(empty)"}` });
    if (!ATOMIC_TRIGGERS.includes(effect.trigger)) errors.push({ path: `${path}.trigger`, code: "unknown-trigger", message: `未知触发器：${effect.trigger}` });
    if (definition && !definition.triggers.includes(effect.trigger)) {
      errors.push({ path: `${path}.trigger`, code: "unsupported-tool-trigger", message: `${effect.tool} 不允许在 ${effect.trigger} 触发` });
    }
    if (!ATOMIC_TARGETS.includes(effect.target)) errors.push({ path: `${path}.target`, code: "unknown-target", message: `未知目标：${effect.target}` });
    effect.when.forEach((condition, conditionIndex) => validateCondition(condition, `${path}.when[${conditionIndex}]`, errors));
    if (["set_counter", "adjust_counter", "consume_counter", "register_counter_modifier"].includes(effect.tool)) {
      if (!effect.params.counterId) errors.push({ path: `${path}.params.counterId`, code: "missing-counter-id", message: "计数器工具缺少 counterId" });
      if (!effect.params.namespace && effect.params.legacyCustomCounter !== true) {
        errors.push({ path: `${path}.params.namespace`, code: "missing-counter-namespace", message: "正式计数器缺少 namespace" });
      }
    }
    if (effect.tool === "grant_temporary_technique_tag") {
      if (!["formal-random", "opponent"].includes(String(effect.params.source || ""))) {
        errors.push({ path: `${path}.params.source`, code: "invalid-temporary-technique-source", message: "临时术式标签 source 必须是 formal-random 或 opponent" });
      }
      if (String(effect.params.poolPolicy || "") !== "formal-technique-v1") {
        errors.push({ path: `${path}.params.poolPolicy`, code: "invalid-temporary-technique-pool", message: "临时术式标签必须使用 formal-technique-v1 池" });
      }
      if (!String(effect.params.slotId || "").trim()) {
        errors.push({ path: `${path}.params.slotId`, code: "missing-temporary-technique-slot", message: "临时术式标签缺少 slotId" });
      }
      if (!Number.isFinite(Number(effect.params.durationRounds)) || Number(effect.params.durationRounds) <= 0) {
        errors.push({ path: `${path}.params.durationRounds`, code: "invalid-temporary-technique-duration", message: "临时术式标签 durationRounds 必须是正数" });
      }
    }
    if (effect.tool === "require_summon") {
      if (!String(effect.params.summonId || "").trim()) {
        errors.push({ path: `${path}.params.summonId`, code: "missing-required-summon-id", message: "要求召唤单位缺少 summonId" });
      }
      if (!['self', 'opponent'].includes(String(effect.params.owner || 'self'))) {
        errors.push({ path: `${path}.params.owner`, code: "invalid-required-summon-owner", message: "要求召唤单位 owner 必须是 self 或 opponent" });
      }
      if (!['present', 'absent'].includes(String(effect.params.presence || 'present'))) {
        errors.push({ path: `${path}.params.presence`, code: "invalid-required-summon-presence", message: "要求召唤单位 presence 必须是 present 或 absent" });
      }
    }
    if (effect.tool === "require_summon_group") {
      if (!String(effect.params.tag || "").trim()) errors.push({ path: `${path}.params.tag`, code: "missing-summon-group-tag", message: "召唤物集合缺少 tag" });
      if (!["self", "opponent"].includes(String(effect.params.owner || "self"))) errors.push({ path: `${path}.params.owner`, code: "invalid-summon-group-owner", message: "召唤物集合 owner 必须是 self 或 opponent" });
      if (!["present", "absent"].includes(String(effect.params.presence || "present"))) errors.push({ path: `${path}.params.presence`, code: "invalid-summon-group-presence", message: "召唤物集合 presence 必须是 present 或 absent" });
      if (!Number.isInteger(Number(effect.params.minCount)) || Number(effect.params.minCount) < 0 || Number(effect.params.minCount) > 99) errors.push({ path: `${path}.params.minCount`, code: "invalid-summon-group-count", message: "召唤物集合 minCount 必须是 0 到 99 的整数" });
    }
    if (effect.tool === "apply_barrier") {
      if (!Number.isFinite(Number(effect.params.amount)) || Number(effect.params.amount) <= 0 || Number(effect.params.amount) > 99999) errors.push({ path: `${path}.params.amount`, code: "invalid-barrier-amount", message: "护盾 amount 必须是 1 到 99999" });
      if (!["self", "all-allies"].includes(String(effect.params.scope || "self"))) errors.push({ path: `${path}.params.scope`, code: "invalid-barrier-scope", message: "护盾 scope 必须是 self 或 all-allies" });
      if (!["one-hit-or-until-empty"].includes(String(effect.params.consumeMode || "one-hit-or-until-empty"))) errors.push({ path: `${path}.params.consumeMode`, code: "invalid-barrier-mode", message: "护盾 consumeMode 不受支持" });
    }
    if (effect.tool === "summon_group_action" && !String(effect.params.tag || "").trim()) errors.push({ path: `${path}.params.tag`, code: "missing-summon-group-tag", message: "召唤物集合行动缺少 tag" });
    if (effect.tool === "set_damage_policy" && !["target-defense-only", "ignore-target-defense"].includes(String(effect.params.policy || ""))) {
      errors.push({ path: `${path}.params.policy`, code: "invalid-damage-policy", message: "伤害策略必须是 target-defense-only 或 ignore-target-defense" });
    }
  });
  return { ok: errors.length === 0, schema: ATOMIC_EFFECT_SCHEMA, effects, errors };
}

export function describeAtomicEffects(rawEffects) {
  const validation = validateAtomicEffects(rawEffects);
  return {
    ...validation,
    tools: validation.effects.map((effect, index) => ({
      id: effect.id,
      tool: effect.tool,
      label: ATOMIC_TOOL_DEFINITIONS[effect.tool]?.label || "未知工具",
      category: ATOMIC_TOOL_DEFINITIONS[effect.tool]?.category || "unknown",
      trigger: effect.trigger,
      target: effect.target,
      params: clone(effect.params),
      schema: effect.schema,
      valid: !validation.errors.some((error) => error.path.startsWith(`atomicEffects[${index}]`))
    }))
  };
}

const api = Object.freeze({
  schema: ATOMIC_EFFECT_SCHEMA,
  triggers: ATOMIC_TRIGGERS,
  targets: ATOMIC_TARGETS,
  tools: ATOMIC_TOOL_DEFINITIONS,
  toolIds: ATOMIC_TOOL_IDS,
  normalizeAtomicEffect,
  normalizeAtomicEffects,
  validateAtomicEffects,
  describeAtomicEffects
});

globalThis.JJKDuelAtomicProtocol = api;
export default api;
