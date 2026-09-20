(function initDuelSpecialMechanism(global) {
  "use strict";

  var MAX_SCRIPT_LENGTH = 2400;
  var MAX_OBJECT_KEYS = 64;
  var FORBIDDEN_SCRIPT_PATTERN = /\b(function|eval|Function|constructor|prototype|__proto__|window|document|globalThis|self|fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|import|require|while|for|class|this|process|WebSocket|Worker)\b|=>|<\s*script/i;
  var SUPPORTED_PHASES = new Set(["preResolve"]);

  function clonePlain(value, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 5) return undefined;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 24).map(function cloneArrayEntry(entry) {
        return clonePlain(entry, depth + 1);
      }).filter(function keepDefined(entry) {
        return entry !== undefined;
      });
    }
    if (typeof value !== "object") return undefined;
    var output = {};
    Object.keys(value).slice(0, MAX_OBJECT_KEYS).forEach(function cloneKey(key) {
      if (!key || key === "__proto__" || key === "prototype" || key === "constructor") return;
      output[key] = clonePlain(value[key], depth + 1);
    });
    return output;
  }

  function toFiniteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readText(value, maxLength) {
    if (value === undefined || value === null) return "";
    return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength || 120);
  }

  function extractJsonCompatibleSource(source) {
    var text = readText(source, MAX_SCRIPT_LENGTH);
    if (!text) throw new Error("特殊机制脚本为空。");
    if (text.length > MAX_SCRIPT_LENGTH) throw new Error("特殊机制脚本超过长度限制。");
    if (FORBIDDEN_SCRIPT_PATTERN.test(text)) {
      throw new Error("特殊机制脚本只允许返回静态对象，不能读取页面、网络、存储或执行函数。");
    }
    text = text.replace(/^\s*export\s+default\s+/, "").trim();
    if (/^return\b/.test(text)) text = text.replace(/^return\b/, "").trim();
    if (text.endsWith(";")) text = text.slice(0, -1).trim();
    if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1).trim();
    if (!text.startsWith("{") || !text.endsWith("}")) {
      throw new Error("特殊机制脚本必须是 JSON 对象、return JSON 对象，或 export default JSON 对象。");
    }
    return text;
  }

  function parseSafeSpecialMechanismScript(source) {
    var text = extractJsonCompatibleSource(source);
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("特殊机制脚本必须使用 JSON 兼容写法：键名和字符串都要加双引号，不能写函数或表达式。");
    }
    return sanitizeSpecialMechanismSpec(parsed);
  }

  function sanitizeStatus(status) {
    if (!status || typeof status !== "object") return null;
    var id = readText(status.id, 48).replace(/[^\w.-]/g, "");
    if (!id) return null;
    return {
      id: id,
      label: readText(status.label || id, 40),
      rounds: clamp(Math.round(toFiniteNumber(status.rounds, 1)), 1, 6),
      value: clamp(toFiniteNumber(status.value, 1), -10, 10)
    };
  }

  function sanitizeWeightDeltas(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    var output = {};
    Object.keys(value).slice(0, 12).forEach(function sanitizeWeightKey(key) {
      var safeKey = readText(key, 32).replace(/[^\w.-]/g, "");
      if (!safeKey) return;
      output[safeKey] = clamp(toFiniteNumber(value[key], 0), -3, 3);
    });
    return Object.keys(output).length ? output : undefined;
  }

  function sanitizeEffects(effects) {
    if (!effects || typeof effects !== "object" || Array.isArray(effects)) return {};
    var output = {};
    [
      "outgoingScale",
      "incomingHpScale",
      "incomingCeScale",
      "sureHitScale",
      "domainPressureScale",
      "manualAttackScale",
      "damageScale",
      "blockToIncomingScale",
      "consumeOutgoingScaleOnDamage"
    ].forEach(function copyScale(key) {
      if (effects[key] === undefined) return;
      output[key] = clamp(toFiniteNumber(effects[key], key === "blockToIncomingScale" || key === "consumeOutgoingScaleOnDamage" ? 0 : 1), 0, 3);
    });
    ["stabilityDelta", "domainLoadDelta", "opponentDomainLoadDelta", "hitRateModifier", "evasionBonus"].forEach(function copyDelta(key) {
      if (effects[key] === undefined) return;
      output[key] = clamp(toFiniteNumber(effects[key], 0), -100, 100);
    });
    var weightDeltas = sanitizeWeightDeltas(effects.weightDeltas);
    if (weightDeltas) output.weightDeltas = weightDeltas;
    var opponentWeightDeltas = sanitizeWeightDeltas(effects.opponentWeightDeltas);
    if (opponentWeightDeltas) output.opponentWeightDeltas = opponentWeightDeltas;
    ["selfStatuses", "opponentStatuses", "delayedSelfStatuses"].forEach(function copyStatuses(key) {
      if (!Array.isArray(effects[key])) return;
      output[key] = effects[key].slice(0, 4).map(sanitizeStatus).filter(Boolean);
    });
    return output;
  }

  function sanitizeActionPatch(patch) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
    var output = {};
    ["damageAdd", "blockAdd", "ceCostAdd", "domainLoadDeltaAdd"].forEach(function copyAdd(key) {
      if (patch[key] === undefined) return;
      output[key] = clamp(toFiniteNumber(patch[key], 0), -999, 999);
    });
    ["damageMultiplier", "blockMultiplier", "ceCostMultiplier"].forEach(function copyMultiplier(key) {
      if (patch[key] === undefined) return;
      output[key] = clamp(toFiniteNumber(patch[key], 1), 0, 5);
    });
    ["blockIgnoreRatio", "hitRateModifier"].forEach(function copyBounded(key) {
      if (patch[key] === undefined) return;
      output[key] = clamp(toFiniteNumber(patch[key], 0), key === "blockIgnoreRatio" ? 0 : -1, key === "blockIgnoreRatio" ? 0.95 : 1);
    });
    output.effects = sanitizeEffects(patch.effects || {});
    return output;
  }

  function sanitizeCounter(counter) {
    if (!counter || typeof counter !== "object") return null;
    var id = readText(counter.id, 48).replace(/[^\w.-]/g, "");
    if (!id) return null;
    return {
      id: id,
      label: readText(counter.label || id, 40),
      value: clamp(toFiniteNumber(counter.value, 0), -9999, 9999),
      format: ["number", "percent", "text"].includes(counter.format) ? counter.format : "number"
    };
  }

  function sanitizeResourceRule(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return null;
    var id = readText(rule.id || rule.resource || rule.resourceId, 48).replace(/[^\w.-]/g, "");
    var resource = readText(rule.resource || rule.resourceId || "custom", 40).replace(/[^\w.-]/g, "");
    if (!id && !resource) return null;
    return {
      id: id || resource || "custom",
      resource: resource || "custom",
      amount: clamp(toFiniteNumber(rule.amount, 0), -9999, 9999),
      ratio: clamp(toFiniteNumber(rule.ratio ?? rule.amountRatio, 0), -10, 10),
      min: clamp(toFiniteNumber(rule.min, 0), -9999, 9999),
      max: clamp(toFiniteNumber(rule.max, 9999), -9999, 9999),
      required: rule.required !== false,
      scope: ["battle", "round", "action", "unit"].includes(rule.scope) ? rule.scope : "action"
    };
  }

  function sanitizeHandInjectionRule(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return null;
    var cardId = readText(rule.cardId || rule.id || rule.actionId, 80).replace(/[^\w.\-\u4e00-\u9fa5]/g, "");
    if (!cardId) return null;
    return {
      cardId: cardId,
      timing: ["sameRound", "nextRound", "eachRound", "onSummon", "onRelease"].includes(rule.timing) ? rule.timing : "sameRound",
      mode: ["fixed", "random", "grant", "maintain"].includes(rule.mode) ? rule.mode : "grant",
      oncePerBattle: Boolean(rule.oncePerBattle),
      oncePerRound: rule.oncePerRound !== false,
      maxCopies: clamp(Math.round(toFiniteNumber(rule.maxCopies, 1)), 1, 5)
    };
  }

  function sanitizeVisibilityRules(rules) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) return {};
    return {
      hideAfterUse: Boolean(rules.hideAfterUse),
      hideAfterSummon: Boolean(rules.hideAfterSummon),
      hideAfterRelease: Boolean(rules.hideAfterRelease),
      hideWhenUnitDefeated: Boolean(rules.hideWhenUnitDefeated),
      mandatoryWhileAnyUnitTag: readText(rules.mandatoryWhileAnyUnitTag, 64).replace(/[^\w.\-\u4e00-\u9fa5]/g, "") || undefined
    };
  }

  function sanitizeCopyRules(rules) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) return {};
    return {
      allowCopy: rules.allowCopy !== false,
      ignoreSpecialResourceOnCopy: Boolean(rules.ignoreSpecialResourceOnCopy),
      copiedDamageScale: clamp(toFiniteNumber(rules.copiedDamageScale, 1), 0, 3),
      excludedTags: Array.isArray(rules.excludedTags)
        ? rules.excludedTags.slice(0, 12).map(function sanitizeTag(tag) {
          return readText(tag, 48).replace(/[^\w.\-\u4e00-\u9fa5]/g, "");
        }).filter(Boolean)
        : []
    };
  }

  function sanitizeAvoidanceRules(rules) {
    if (!rules || typeof rules !== "object" || Array.isArray(rules)) return {};
    return {
      aoeFullDodgeOnEvade: Boolean(rules.aoeFullDodgeOnEvade),
      ignoresSureHit: Boolean(rules.ignoresSureHit),
      ignoresExecution: Boolean(rules.ignoresExecution),
      ignoresWorldSlash: Boolean(rules.ignoresWorldSlash),
      excludedAttackTags: Array.isArray(rules.excludedAttackTags)
        ? rules.excludedAttackTags.slice(0, 12).map(function sanitizeTag(tag) {
          return readText(tag, 48).replace(/[^\w.\-\u4e00-\u9fa5]/g, "");
        }).filter(Boolean)
        : []
    };
  }

  function sanitizeSpecialMechanismSpec(rawSpec) {
    var raw = clonePlain(rawSpec || {});
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("特殊机制接口必须返回对象。");
    }
    var id = readText(raw.id || raw.mechanismId || "custom_special_mechanism", 56).replace(/[^\w.-]/g, "");
    if (!id) id = "custom_special_mechanism";
    var phase = readText(raw.phase || "preResolve", 32);
    if (!SUPPORTED_PHASES.has(phase)) {
      throw new Error("特殊机制 phase 目前只支持 preResolve。");
    }
    if (Array.isArray(raw.counters) && raw.counters.length) {
      throw new Error("通用特殊机制禁止创建计数器；请使用已登记且有术式归属的计数器运行时。");
    }
    return {
      version: Math.max(1, Math.round(toFiniteNumber(raw.version, 1))),
      id: id,
      label: readText(raw.label || raw.name || id, 48),
      phase: phase,
      actionPatch: sanitizeActionPatch(raw.actionPatch || raw.patch || {}),
      actorStatus: Array.isArray(raw.actorStatus) ? raw.actorStatus.slice(0, 4).map(sanitizeStatus).filter(Boolean) : [],
      opponentStatus: Array.isArray(raw.opponentStatus) ? raw.opponentStatus.slice(0, 4).map(sanitizeStatus).filter(Boolean) : [],
      counters: [],
      resourceCosts: Array.isArray(raw.resourceCosts) ? raw.resourceCosts.slice(0, 8).map(sanitizeResourceRule).filter(Boolean) : [],
      resourceCaps: Array.isArray(raw.resourceCaps) ? raw.resourceCaps.slice(0, 8).map(sanitizeResourceRule).filter(Boolean) : [],
      handInjections: Array.isArray(raw.handInjections) ? raw.handInjections.slice(0, 8).map(sanitizeHandInjectionRule).filter(Boolean) : [],
      visibilityRules: sanitizeVisibilityRules(raw.visibilityRules || {}),
      copyRules: sanitizeCopyRules(raw.copyRules || {}),
      avoidanceRules: sanitizeAvoidanceRules(raw.avoidanceRules || {}),
      log: readText(raw.log || "", 120)
    };
  }

  function readMechanismSpecsFromAction(action) {
    var specs = [];
    function addSpec(value) {
      if (!value) return;
      try {
        specs.push(typeof value === "string" ? parseSafeSpecialMechanismScript(value) : sanitizeSpecialMechanismSpec(value));
      } catch (error) {
        specs.push({ error: error?.message || "特殊机制解析失败。" });
      }
    }
    addSpec(action?.specialMechanism);
    addSpec(action?.specialMechanismSpec);
    addSpec(action?.mechanismScript);
    addSpec(action?.specialMechanismScript);
    if (action?.mechanismSpec?.specialMechanism) addSpec(action.mechanismSpec.specialMechanism);
    if (action?.mechanismSpec && typeof action.mechanismSpec === "object" && !Array.isArray(action.mechanismSpec)) addSpec(action.mechanismSpec);
    if (action?.mechanismSpec?.script) addSpec(action.mechanismSpec.script);
    return specs;
  }

  function applyPatchToAction(action, spec) {
    var patched = { ...(action || {}) };
    var patch = spec.actionPatch || {};
    if (patch.damageAdd || patch.damageMultiplier !== undefined) {
      var damage = toFiniteNumber(patched.effect?.damage ?? patched.effects?.damage ?? patched.damage, 0);
      var nextDamage = Math.max(0, Math.round(damage * toFiniteNumber(patch.damageMultiplier, 1) + toFiniteNumber(patch.damageAdd, 0)));
      patched.damage = nextDamage;
      patched.effect = { ...(patched.effect || patched.effects || {}), damage: nextDamage };
      patched.effects = { ...(patched.effects || {}), damage: nextDamage };
    }
    if (patch.blockAdd || patch.blockMultiplier !== undefined) {
      var block = toFiniteNumber(patched.effect?.block ?? patched.effects?.block ?? patched.block, 0);
      var nextBlock = Math.max(0, Math.round(block * toFiniteNumber(patch.blockMultiplier, 1) + toFiniteNumber(patch.blockAdd, 0)));
      patched.block = nextBlock;
      patched.effect = { ...(patched.effect || patched.effects || {}), block: nextBlock };
      patched.effects = { ...(patched.effects || {}), block: nextBlock };
    }
    if (patch.ceCostAdd || patch.ceCostMultiplier !== undefined) {
      var ce = toFiniteNumber(patched.cost?.ce ?? patched.ceCost, 0);
      var nextCe = Math.max(0, Math.round(ce * toFiniteNumber(patch.ceCostMultiplier, 1) + toFiniteNumber(patch.ceCostAdd, 0)));
      patched.ceCost = nextCe;
      patched.cost = { ...(patched.cost || {}), ce: nextCe };
    }
    if (patch.domainLoadDeltaAdd) {
      patched.domainLoadDelta = Math.max(0, Math.round(toFiniteNumber(patched.domainLoadDelta ?? patched.effect?.domainLoadDelta ?? patched.effects?.domainLoadDelta, 0) + patch.domainLoadDeltaAdd));
      patched.effect = { ...(patched.effect || patched.effects || {}), domainLoadDelta: patched.domainLoadDelta };
      patched.effects = { ...(patched.effects || {}), domainLoadDelta: patched.domainLoadDelta };
    }
    if (patch.blockIgnoreRatio !== undefined) {
      patched.blockIgnoreRatio = clamp(Math.max(toFiniteNumber(patched.blockIgnoreRatio, 0), patch.blockIgnoreRatio), 0, 0.95);
    }
    if (patch.hitRateModifier !== undefined) {
      patched.hitRateModifier = clamp(toFiniteNumber(patched.hitRateModifier, 0) + patch.hitRateModifier, -1, 1);
    }
    patched.effects = { ...(patched.effects || {}), ...(patch.effects || {}) };
    patched.genericSpecialMechanismRuntime = spec;
    return patched;
  }

  function appendStatuses(target, statuses) {
    if (!target || !Array.isArray(statuses) || !statuses.length) return;
    target.statusEffects = Array.isArray(target.statusEffects) ? target.statusEffects : [];
    statuses.forEach(function appendStatus(status) {
      var existing;
      if (!status?.id) return;
      existing = target.statusEffects.find(function findStatus(effect) {
        return effect?.id === status.id;
      });
      if (existing) {
        existing.value = toFiniteNumber(existing.value, 0) + toFiniteNumber(status.value, 1);
        existing.rounds = Math.max(toFiniteNumber(existing.rounds, 0), toFiniteNumber(status.rounds, 1));
        existing.label = status.label || existing.label;
        return;
      }
      target.statusEffects.push({ ...status });
    });
  }

  function writeCounters(battle, side, spec) {
    if (!battle || !side || !spec?.counters?.length) return;
    throw new Error("通用特殊机制计数器注入已禁用。");
  }

  function applyActionPatch(action, actor, opponent, battle) {
    var specs = readMechanismSpecsFromAction(action);
    var applied = [];
    var patched = action;
    specs.forEach(function applySpec(spec) {
      if (!spec || spec.error) {
        if (spec?.error && battle) {
          battle.specialMechanismErrors ||= [];
          battle.specialMechanismErrors.unshift({ actionId: action?.id || "", message: spec.error });
          battle.specialMechanismErrors = battle.specialMechanismErrors.slice(0, 8);
        }
        return;
      }
      if (spec.phase !== "preResolve") return;
      patched = applyPatchToAction(patched, spec);
      appendStatuses(actor, spec.actorStatus);
      appendStatuses(opponent, spec.opponentStatus);
      writeCounters(battle, actor?.side || "", spec);
      applied.push({
        id: spec.id,
        label: spec.label,
        phase: spec.phase,
        log: spec.log || ""
      });
    });
    return { action: patched, applied: applied };
  }

  global.JJKDuelSpecialMechanism = {
    parseSafeSpecialMechanismScript: parseSafeSpecialMechanismScript,
    sanitizeSpecialMechanismSpec: sanitizeSpecialMechanismSpec,
    sanitizeResourceRule: sanitizeResourceRule,
    sanitizeHandInjectionRule: sanitizeHandInjectionRule,
    applyActionPatch: applyActionPatch
  };
})(globalThis);
