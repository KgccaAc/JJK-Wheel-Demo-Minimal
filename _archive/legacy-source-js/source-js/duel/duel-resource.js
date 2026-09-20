(function (global) {
  "use strict";

  var namespace = "JJKDuelResource";
  var expectedExports = [
    "initializeDuelResourceState",
    "deriveDuelResourcesFromProfile",
    "getDuelResourcePair",
    "clampDuelResource",
    "applyDuelRoundResourceRegen",
    "updateDuelDomainLoad",
    "triggerDuelDomainMeltdown",
    "getDuelTrialViolenceScale"
  ];
  var expectedDependencies = [
    "getDuelResourceRules",
    "duelRankValue",
    "hasDuelDomainAccess",
    "getCurrentDuelBattle",
    "getDuelDomainBarrierModifiers",
    "applyDuelDomainProfileOnActivation",
    "updateDuelDomainTrialContext",
    "invalidateDuelActionChoices",
    "applyDuelStandardDamageToTarget"
  ];
  var dependencyModules = {
    getDuelDomainBarrierModifiers: { namespace: "JJKDuelDomainProfile", getter: "getBinding" },
    applyDuelDomainProfileOnActivation: { namespace: "JJKDuelDomainProfile", getter: "getBinding" },
    updateDuelDomainTrialContext: { namespace: "JJKDuelRuleSubphase", getter: "getBinding" },
    invalidateDuelActionChoices: { namespace: "JJKDuelActions", getter: "get" },
    applyDuelStandardDamageToTarget: { namespace: "JJKDuelActions", getter: "get" }
  };
  var bindings = Object.create(null);
  var dependencies = Object.create(null);

  var DEFAULT_DUEL_RESOURCE_RULES = {
    status: "CANDIDATE",
    hp: { base: 118, bodyScale: 15.5, martialScale: 10.5, visibleGradeScale: 18, combatUnitScale: 0.012, zeroCeBodyBonus: 22, physicalTagBonus: 14, min: 80, max: 460 },
    ce: { base: 82, cursedEnergyScale: 20, techniqueScale: 9, visibleGradeScale: 22, jujutsuAxisScale: 7.5, zeroCeCap: 32, min: 36, max: 560 },
    regen: { baseRatio: 0.04, controlScale: 0.0025, efficiencyScale: 0.0035, talentScale: 0.0015, efficiencyLockBonus: 0.01, minRatio: 0.025, maxRatio: 0.12 },
    stability: { base: 0.38, controlScale: 0.034, efficiencyScale: 0.028, talentScale: 0.018, topDomainBonus: 0.055, efficiencyLockBonus: 0.045, haxVolatilityPenalty: 0.055, min: 0.2, max: 0.96 },
    domain: { baseThreshold: 58, controlScale: 5.5, efficiencyScale: 4, talentScale: 3.2, visibleGradeScale: 7, topDomainBonus: 24, openDomainBonus: 32, customDomainBonus: 12, domainSustainBonus: 14, activationLoad: 16, eventLoad: 18, maintainLoad: 8, oppositionLoad: 10, lowCeLoad: 8, stabilityRelief: 9, meltdownCeLossRatio: 0.28, meltdownStabilityPenalty: 0.08 },
    events: {
      initiative: { actorCeCost: 5, targetHpDamage: 7, targetCeDamage: 2 },
      technique: { actorCeCost: 15, targetHpDamage: 14, targetCeDamage: 4 },
      melee: { actorCeCost: 4, actorHpRecoil: 2, targetHpDamage: 13, targetCeDamage: 1 },
      resource: { actorCeCost: 9, targetHpDamage: 10, targetCeDamage: 8, targetRegenInterference: 0.18 },
      domain: { actorCeCost: 24, targetHpDamage: 11, targetCeDamage: 8 },
      counter: { actorCeCost: 8, targetHpDamage: 8, targetCeDamage: 13, domainLoadInterference: 12 },
      finisher: { actorCeCost: 22, actorHpRecoil: 4, targetHpDamage: 21, targetCeDamage: 6 },
      backfire: { actorCeCost: 5, targetHpDamage: 12, targetCeDamage: 9 },
      neutral: { actorCeCost: 0, targetHpDamage: 0, targetCeDamage: 0 }
    },
    statusEffects: {
      techniqueImbalance: { label: "术式失衡", rounds: 2, weightPenalty: 1.45, outputScale: 0.72, affectedEvents: ["technique", "domain", "finisher"] },
      ceRegenBlocked: { label: "咒力回流断裂", rounds: 1, regenScale: 0 }
    },
    limits: { minHp: 0, minCe: 0 }
  };

  var DUEL_LOG_CATEGORY_LABELS = {
    resource: "资源变化",
    action: "手法选择",
    domain: "领域变化",
    response: "领域应对",
    subphase: "规则子阶段",
    trialTarget: "审判对象",
    verdict: "裁定结果",
    exorcismRuling: "祓除裁定",
    objectConfiscation: "对象没收",
    controllerRedirect: "操控链裁定",
    meltdown: "领域崩解 / 术式烧断",
    aiNarrative: "AI 叙事",
    system: "系统提示"
  };

  var DUEL_DOMAIN_RESPONSE_ACTION_IDS = {
    domain_clash: true,
    simple_domain_guard: true,
    hollow_wicker_basket_guard: true,
    falling_blossom_emotion: true,
    zero_ce_domain_bypass: true,
    domain_survival_guard: true
  };

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isExpected(name) {
    return expectedExports.indexOf(name) !== -1;
  }

  function isExpectedDependency(name) {
    return expectedDependencies.indexOf(name) !== -1;
  }

  function assertExpected(name) {
    if (!isExpected(name)) {
      throw new Error(namespace + ": unexpected export '" + name + "'");
    }
  }

  function assertExpectedDependency(name) {
    if (!isExpectedDependency(name)) {
      throw new Error(namespace + ": unexpected dependency '" + name + "'");
    }
  }

  function assertFunction(name, value) {
    if (typeof value !== "function") {
      throw new TypeError(namespace + ": binding '" + name + "' must be a function");
    }
  }

  function bind(name, value) {
    assertExpected(name);
    assertFunction(name, value);
    bindings[name] = value;
    return api;
  }

  function bindDependency(name, value) {
    assertExpectedDependency(name);
    assertFunction(name, value);
    dependencies[name] = value;
    return api;
  }

  function register(map) {
    if (!map || typeof map !== "object") return api;
    registerDependencies(map);
    return api;
  }

  function registerDependencies(map) {
    if (!map || typeof map !== "object") return api;
    expectedDependencies.forEach(function (name) {
      if (hasOwn(map, name) && map[name] != null) {
        bindDependency(name, map[name]);
      }
    });
    return api;
  }

  function configure(map) {
    return registerDependencies(map);
  }

  function hasBinding(name) {
    if (typeof name === "undefined") {
      return expectedExports.every(function (exportName) {
        return typeof bindings[exportName] === "function";
      });
    }
    return isExpected(name) && typeof bindings[name] === "function";
  }

  function get(name) {
    assertExpected(name);
    return bindings[name];
  }

  function getBinding(name) {
    return get(name);
  }

  function resolveModuleDependency(name) {
    var moduleInfo = dependencyModules[name];
    var moduleApi;
    var value;

    if (!moduleInfo) return undefined;
    moduleApi = global[moduleInfo.namespace];
    if (!moduleApi) return undefined;

    try {
      if (moduleInfo.getter === "getBinding" && typeof moduleApi.getBinding === "function") {
        value = moduleApi.getBinding(name);
      } else if (moduleInfo.getter === "get" && typeof moduleApi.get === "function") {
        value = moduleApi.get(name);
      }
    } catch (error) {
      value = undefined;
    }

    if (typeof value !== "function" && hasOwn(moduleApi, name)) value = moduleApi[name];
    return typeof value === "function" ? value : undefined;
  }

  function resolveDependency(name) {
    assertExpectedDependency(name);
    return dependencies[name] || resolveModuleDependency(name);
  }

  function requireDependency(name) {
    var value = resolveDependency(name);
    if (typeof value !== "function") {
      throw new Error(namespace + ": missing dependency '" + name + "'");
    }
    return value;
  }

  function hasDependency(name) {
    if (typeof name === "undefined") {
      return expectedDependencies.every(function (dependencyName) {
        return typeof resolveDependency(dependencyName) === "function";
      });
    }
    return isExpectedDependency(name) && typeof resolveDependency(name) === "function";
  }

  function getDependency(name) {
    return resolveDependency(name);
  }

  function listBindings() {
    return expectedExports.reduce(function (snapshot, name) {
      snapshot[name] = typeof bindings[name] === "function";
      return snapshot;
    }, {});
  }

  function listDependencies() {
    return expectedDependencies.reduce(function (snapshot, name) {
      snapshot[name] = typeof resolveDependency(name) === "function";
      return snapshot;
    }, {});
  }

  function missingDependencies(names) {
    return (names || expectedDependencies).filter(function (name) {
      return isExpectedDependency(name) && typeof resolveDependency(name) !== "function";
    });
  }

  function clearBindings() {
    expectedExports.forEach(function (name) {
      delete bindings[name];
    });
    return api;
  }

  function clearDependencies() {
    expectedDependencies.forEach(function (name) {
      delete dependencies[name];
    });
    return api;
  }

  function cloneDefaultResourceRules() {
    return JSON.parse(JSON.stringify(DEFAULT_DUEL_RESOURCE_RULES));
  }

  function getDuelResourceRulesSafe() {
    var getRules = resolveDependency("getDuelResourceRules");
    var rules = typeof getRules === "function" ? getRules() : null;
    return rules || cloneDefaultResourceRules();
  }

  function getCurrentDuelBattle() {
    var getBattle = resolveDependency("getCurrentDuelBattle");
    return typeof getBattle === "function" ? getBattle() : null;
  }

  function getBattlefieldUnitHp(unit) {
    var hp = Number(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0);
    return Number.isFinite(hp) ? Math.max(0, hp) : 0;
  }

  function isMahoragaProxyProtectingSide(battle, side) {
    var proxy = battle?.mahoragaProxy?.[side];
    if (!proxy?.active) return false;
    if (!proxy.unitId) return true;
    return (Array.isArray(battle?.battlefieldUnits) ? battle.battlefieldUnits : []).some(function findProxyUnit(unit) {
      return unit?.id === proxy.unitId && unit.active !== false && unit.defeated !== true && getBattlefieldUnitHp(unit) > 0;
    });
  }

  function isDuelResourceDefeated(resource, battle, side) {
    if (!resource) return true;
    if (Number(resource.hp || 0) > 0) return false;
    return !isMahoragaProxyProtectingSide(battle, side || resource.side || "");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatNumber(value) {
    if (!Number.isFinite(Number(value))) return "0";
    return Number(value).toFixed(4).replace(/\.?0+$/, "");
  }

  function formatSignedDuelDelta(value) {
    var number = Number(value || 0);
    if (Math.abs(number) < 0.05) return "+0";
    return "" + (number > 0 ? "+" : "") + formatNumber(Number(number.toFixed(1)));
  }

  var DUEL_VISIBLE_GRADE_CATEGORY_RANKS = Object.freeze({
    support: 0,
    grade4: 1,
    grade3: 2,
    grade2: 3,
    semiGrade1: 3.5,
    grade1: 4,
    semiSpecialGrade1: 4.5,
    specialGradeLow: 5.5,
    specialGrade: 6,
    specialGradeHigh: 6.5
  });

  // Character JSON uses canonical machine keys for custom cards, while older
  // official cards often store a Chinese display label (or "无") in
  // visibleGrade.  Resource derivation must normalize both shapes before the
  // visible-grade HP/CE term is applied; otherwise custom cards receive the
  // term and official cards silently fall back to zero.
  var DUEL_POWER_TIER_GRADE_RANKS = Object.freeze({
    noncombat_support: 0,
    civilianOrSupport: 0,
    support_preparation: 0,
    strategic_support: 0,
    grade4_mobility: 1,
    grade4_trickster: 1,
    grade3: 2,
    grade3_utility: 2,
    grade3_survival: 2,
    grade3_defense: 2,
    grade3_conditional: 2,
    grade2: 3,
    grade2Plus: 3,
    grade2_brawler: 3,
    grade2_counter: 3,
    grade2_support: 3,
    support_grade2: 3,
    semiGrade1: 3.5,
    grade1: 4,
    grade1Plus: 4,
    grade1Candidate: 4,
    grade1_support: 4,
    grade1_shikigami: 4,
    support_grade1: 4,
    specialGrade1: 4.5,
    specialGrade1_high: 5,
    topTierMinus: 4,
    specialGradeLow: 5.5,
    specialGrade: 6,
    specialGradeCurse: 5.5,
    specialGrade_curse: 5.5,
    cursedSpiritSpecial: 5.5,
    disasterCurse: 5.5,
    topTier: 4,
    topTierPhysical: 4,
    topTierSustain: 4,
    newGenerationTop: 4,
    sendaiTop: 4,
    supportHax: 3,
    specialGradeHigh: 6.5,
    canonCeiling: 6.5,
    postCanonCeiling: 6.5,
    postCanonException: 6.5,
    haxException: 4
  });

  function parseVisibleGradeCategoryRank(value, allowPowerTier) {
    var raw = String(value || "").trim();
    var normalized;
    if (!raw || /^(?:无|未知|未记录|无法判定|none|unknown|n\/a)$/i.test(raw)) return NaN;
    if (hasOwn(DUEL_VISIBLE_GRADE_CATEGORY_RANKS, raw)) return DUEL_VISIBLE_GRADE_CATEGORY_RANKS[raw];
    if (allowPowerTier && hasOwn(DUEL_POWER_TIER_GRADE_RANKS, raw)) return DUEL_POWER_TIER_GRADE_RANKS[raw];

    normalized = raw.replace(/[\s_\-／/()（）]/g, "").toLowerCase();
    if (/^(?:辅助|支援|非战斗|support)$/.test(normalized)) return 0;
    if (/特别一级|特別一級|specialgrade1|specialfirstgrade/.test(normalized)) return 4.5;
    if (/准一级|準一級|semi(?:grade)?1|semifirstgrade/.test(normalized)) return 3.5;
    if (/准特级|準特級|semispecialgrade/.test(normalized)) return 5.5;
    if (/(?:特级|特級).*(?:咒灵|咒靈)|specialgrade(?:curse|cursedspirit)/.test(normalized)) return 5.5;
    if (/特级|特級|specialgrade/.test(normalized)) return 6;
    if (/四级|四級|grade4|fourthgrade/.test(normalized)) return 1;
    if (/三级|三級|grade3|thirdgrade/.test(normalized)) return 2;
    if (/二级|二級|grade2|secondgrade/.test(normalized)) return 3;
    if (/一级|一級|grade1|firstgrade/.test(normalized)) return 4;
    return NaN;
  }

  function visibleGradeCategoryRank(grade, profile) {
    var directCandidates = [
      grade,
      profile && profile.officialGrade,
      profile && profile.grade
    ];
    var tierCandidates = [
      profile && profile.powerTier,
      profile && profile.tier,
      profile && profile.pool
    ];
    var index;
    var value;

    for (index = 0; index < directCandidates.length; index += 1) {
      value = parseVisibleGradeCategoryRank(directCandidates[index], false);
      if (Number.isFinite(value)) return value;
    }
    for (index = 0; index < tierCandidates.length; index += 1) {
      value = parseVisibleGradeCategoryRank(tierCandidates[index], true);
      if (Number.isFinite(value)) return value;
    }
    return NaN;
  }

  function getDuelResourceSideLabel(side) {
    if (typeof global.JJKDuelPerspectiveSideLabel === "function") {
      return global.JJKDuelPerspectiveSideLabel(side);
    }
    return side === "left" ? "我方" : side === "right" ? "对方" : "战场";
  }

  function getDuelStatusEffectValue(resource, id) {
    var effects = resource && resource.statusEffects;
    var max = 0;

    if (!effects || !effects.length) return 0;
    effects.forEach(function (effect) {
      var value;
      if (effect.id !== id) return;
      value = Number(effect.value || 1);
      if (value > max) max = value;
    });
    return max;
  }

  function upsertDuelResourceStatus(resource, status) {
    if (!resource || !status || !status.id) return null;
    resource.statusEffects ||= [];
    var existing = resource.statusEffects.find(function findEffect(effect) {
      return effect && effect.id === status.id;
    });
    if (existing) {
      existing.value = status.value !== undefined ? Math.max(Number(existing.value || 0), Number(status.value || 0)) : existing.value;
      existing.rounds = Math.max(Number(existing.rounds || 0), Number(status.rounds || 1));
      Object.keys(status).forEach(function copyField(key) {
        if (key === "id" || key === "value" || key === "rounds") return;
        existing[key] = status[key];
      });
      return existing;
    }
    resource.statusEffects.push({ ...status, rounds: Math.max(1, Number(status.rounds || 1)), value: status.value === undefined ? 1 : status.value });
    return status;
  }

  function applyMythicalBeastAmberRoundCost(actor, battle, side) {
    var active = getDuelStatusEffectValue(actor, "mythicalBeastAmber") > 0;
    var maxHp;
    var fracture;
    var ratio;
    var beforeHp;
    var damage;
    if (!active || isDuelResourceDefeated(actor, battle, side)) return null;
    maxHp = Math.max(0, Number(actor.maxHp || 0));
    if (!maxHp) return null;
    fracture = Math.max(0, Number(global.JJKDuelCounterPipeline?.readCounter?.(battle, side || actor.side || "left", "mythical_beast_amber", "fracture", {
      label: "琥珀裂解", initial: 0, min: 0, max: 9, format: "number"
    }) || 0));
    ratio = Math.min(0.14, 0.035 + fracture * 0.02);
    beforeHp = Number(actor.hp || 0);
    damage = Math.max(1, Number((maxHp * ratio).toFixed(1)));
    actor.hp = Math.max(1, Number((beforeHp - damage).toFixed(1)));
    if ((actor.hp > 0 && actor.hp <= maxHp * 0.18) || fracture >= 5) {
      upsertDuelResourceStatus(actor, {
        id: "mythicalBeastAmberCollapse",
        label: "肉体崩坏",
        rounds: 999,
        value: 1,
        outgoingScale: 0.88,
        incomingHpScale: 1.1
      });
    }
    recordDuelResourceChange(battle, {
      side: side,
      title: "幻兽琥珀自损",
      detail: getDuelResourceSideLabel(side) + actor.name + " 承受幻兽琥珀的肉体术式化损耗，体势 -" + formatNumber(damage) + "（裂解 " + formatNumber(fracture) + "层）；当前 " + formatNumber(actor.hp) + " / " + formatNumber(actor.maxHp) + "。",
      type: "resource",
      delta: { hp: -damage, mythicalBeastAmberSelfDamage: damage, fracture: fracture }
    });
    return { damage: damage, fracture: fracture, ratio: ratio };
  }

  function createEmptyDuelActionContext() {
    return {
      outgoingScale: 1,
      incomingHpScale: 1,
      incomingCeScale: 1,
      sureHitScale: 1,
      domainPressureScale: 1,
      manualAttackScale: 1,
      domainLoadScale: 1,
      weightDeltas: {},
      actionLabels: []
    };
  }

  function getDuelActionContext(battle, side) {
    var context = battle && battle.actionContext && battle.actionContext[side];
    return context || createEmptyDuelActionContext();
  }

  function inferDuelLogCategory(entry) {
    var explicit;
    var title;
    var detail;
    var actionId;

    entry = entry || {};
    explicit = entry.type || entry.category || (entry.delta && (entry.delta.type || entry.delta.category));
    if (explicit && DUEL_LOG_CATEGORY_LABELS[explicit]) return explicit;

    title = String(entry.title || "");
    detail = String(entry.detail || "");
    actionId = String((entry.delta && entry.delta.actionId) || "");
    if (/熔断|崩解/.test(title + detail)) return "meltdown";
    if (DUEL_DOMAIN_RESPONSE_ACTION_IDS[actionId] || /领域应对|简易领域|弥虚葛笼|落花之情|零咒力必中规避|域内求生/.test(title + detail)) return "response";
    if (/裁定结果|判决形成|判决未形成|判决倾向/.test(title + detail)) return "verdict";
    if (/审判对象|审判目标|目标类型/.test(title + detail)) return "trialTarget";
    if (/审判|判决|证据|辩护|坐杀|jackpot|规则子阶段/.test(title + detail)) return "subphase";
    if (/领域|domain/i.test(title + detail) || (entry.delta && (entry.delta.domainLoad || entry.delta.domainActive || entry.delta.domainProfile))) return "domain";
    if (/AI|叙事/.test(title + detail)) return "aiNarrative";
    if (/阈值|互相试探|系统/.test(title + detail)) return "system";
    return "resource";
  }

  function recordDuelResourceChange(battle, entry) {
    var category;
    var normalized;

    if (!battle || !battle.resourceState) return;
    category = inferDuelLogCategory(entry);
    normalized = {
      round: entry.round != null ? entry.round : battle.round,
      side: entry.side || "",
      title: entry.title || "资源变化",
      detail: entry.detail || "",
      type: category,
      category: category,
      categoryLabel: DUEL_LOG_CATEGORY_LABELS[category] || "记录",
      delta: entry.delta || {},
      battleId: battle.battleId,
      seed: battle.seed
    };
    battle.resourceState.resourceLog.unshift(normalized);
    battle.resourceState.residualLog.unshift(normalized);
    battle.resourceLog = battle.resourceState.resourceLog;
    battle.residualLog = battle.resourceState.residualLog;
  }

  function initializeDuelResourceState(duelState) {
    var p1 = deriveDuelResourcesFromProfile(duelState.left, null, "left");
    var p2 = deriveDuelResourcesFromProfile(duelState.right, null, "right");
    var resourceLog = [];
    var residualLog = [];
    return {
      schema: "jjk-battle-runtime-resource-state",
      version: "0.1.0-candidate",
      status: "CANDIDATE",
      battleId: duelState.battleId,
      seed: duelState.seed,
      replayKey: duelState.replayKey || "",
      round: duelState.round || 0,
      p1: p1,
      p2: p2,
      resourceLog: resourceLog,
      residualLog: residualLog
    };
  }

  function appendDuelTraitEvidence(target, value) {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach(function appendArrayEntry(entry) {
        appendDuelTraitEvidence(target, entry);
      });
      return;
    }
    if (typeof value === "object") {
      Object.keys(value).forEach(function appendEnabledFlag(key) {
        if (value[key]) target.push(key);
      });
      return;
    }
    target.push(String(value));
  }

  function collectDuelTraitEvidence(profile, card) {
    var evidence = [];
    var sources = [profile, card, profile && profile.raw, profile && profile.characterCardProfile, profile && profile.profile];
    var fields = [
      "id", "characterId", "displayName", "name", "notes", "techniqueName", "techniqueText",
      "flags", "traits", "innateTraits", "archetypes", "tags", "matchTags", "specialHandTags",
      "explicitSpecialHandTags", "特殊手札", "techniqueFamilies", "selectedMechanisms"
    ];
    sources.forEach(function collectSource(source) {
      if (!source || typeof source !== "object") return;
      fields.forEach(function collectField(field) {
        appendDuelTraitEvidence(evidence, source[field]);
      });
    });
    return evidence;
  }

  function hasExplicitZeroCeHeavenlyTyrantTrait(profile, card) {
    var sources = [profile, card, profile && profile.raw, profile && profile.characterCardProfile, profile && profile.profile];
    if (sources.some(function hasExplicitBoolean(source) {
      return Boolean(source && (
        source.isZeroCe === true ||
        source.hasCe === false ||
        source.flags && typeof source.flags === "object" && !Array.isArray(source.flags) &&
          (source.flags.isZeroCe === true || source.flags.hasCe === false)
      ));
    })) return true;
    var text = collectDuelTraitEvidence(profile, card).join(" ");
    return /zero[_\s-]?ce|zero_ce_heavenly_restriction|physical_heavenly_restriction|零咒力|咒力消失|天与咒缚[（(]?肉体强化型|天与暴君型|天與暴君型|完全体天与|完全體天與/i.test(text);
  }

  function hasExplicitCeResource(profile, card) {
    var sources = [profile, card, profile && profile.raw, profile && profile.characterCardProfile, profile && profile.profile];
    return sources.some(function hasExplicitBoolean(source) {
      return Boolean(source && (
        source.hasCe === true ||
        source.isZeroCe === false ||
        source.flags && typeof source.flags === "object" && !Array.isArray(source.flags) &&
          (source.flags.hasCe === true || source.flags.isZeroCe === false)
      ));
    });
  }

  function parseDuelResourceScore(value) {
    var numeric;
    var ranked;
    if (value === undefined || value === null || value === "") return NaN;
    numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.max(0, numeric);
    ranked = Number(requireDependency("duelRankValue")(value));
    return Number.isFinite(ranked) ? Math.max(0, ranked) : NaN;
  }

  function resolveDuelCursedEnergyScore(profile, card) {
    var raw = profile && profile.raw || {};
    var axes = profile && profile.axes || {};
    var sources = [
      raw.cursedEnergyScore,
      profile && profile.cursedEnergyScore,
      card && card.cursedEnergyScore,
      profile && profile.baseStats && profile.baseStats.cursedEnergy,
      profile && profile.stats && profile.stats.cursedEnergy,
      card && card.baseStats && card.baseStats.cursedEnergy,
      card && card.stats && card.stats.cursedEnergy,
      profile && profile.cePool,
      card && card.cePool,
      profile && profile.cursedEnergy,
      card && card.cursedEnergy,
      axes.jujutsu
    ];
    var index;
    var score;
    for (index = 0; index < sources.length; index += 1) {
      score = parseDuelResourceScore(sources[index]);
      if (Number.isFinite(score)) return score;
    }
    return 0;
  }

  function deriveDuelResourcesFromProfile(profile, card, side) {
    var rules = getDuelResourceRulesSafe();
    var source = card || profile || {};
    var raw = profile && profile.raw || {};
    var axes = profile && profile.axes || {};
    var normalizedFlags = [];
    appendDuelTraitEvidence(normalizedFlags, profile && profile.flags);
    var flags = new Set(normalizedFlags);
    var visibleRank = Math.max(0, visibleGradeCategoryRank(profile && profile.visibleGrade, profile) || 0);
    var combatUnit = Number(profile && profile.combatPowerUnit && profile.combatPowerUnit.value || 0);
    var bodyScore = Number(raw.bodyScore || axes.body || 0);
    var martialScore = Number(raw.martialScore || axes.body || 0);
    var cursedEnergyScore = resolveDuelCursedEnergyScore(profile, card);
    var controlScore = Number(raw.controlScore || 0);
    var efficiencyScore = Number(raw.efficiencyScore || 0);
    var talentScore = Number(raw.talentScore || axes.insight || 0);
    var techniqueScore = requireDependency("duelRankValue")(source.techniquePower || "B");
    var explicitCe = hasExplicitCeResource(profile, card);
    var zeroCe = flags.has("zeroCE") || hasExplicitZeroCeHeavenlyTyrantTrait(profile, card);
    if (explicitCe && !hasExplicitZeroCeHeavenlyTyrantTrait(profile, card) && !flags.has("zeroCE")) zeroCe = false;
    var innateTraits = profile && profile.innateTraits || [];
    var physicalTag = flags.has("domainSureHitInvalid") || flags.has("physicalScaling") || /天与|甚尔|真希/.test(innateTraits.join(" "));
    var maxHp = (rules.hp && rules.hp.base || 118) +
      bodyScore * (rules.hp && rules.hp.bodyScale || 0) +
      martialScore * (rules.hp && rules.hp.martialScale || 0) +
      visibleRank * (rules.hp && rules.hp.visibleGradeScale || 0) +
      Math.sqrt(Math.max(combatUnit, 0)) * (rules.hp && rules.hp.combatUnitScale || 0);
    var maxCe;
    var regenRatio;
    var ceRegen;
    var stability;
    var hasDomain;
    var threshold = 0;
    var resource;

    side = side || "";

    if (zeroCe) maxHp += Number(rules.hp && rules.hp.zeroCeBodyBonus || 0);
    if (physicalTag) maxHp += Number(rules.hp && rules.hp.physicalTagBonus || 0);
    maxHp = Math.round(clamp(maxHp, rules.hp && rules.hp.min || 1, rules.hp && rules.hp.max || 9999));

    maxCe = (rules.ce && rules.ce.base || 82) +
      cursedEnergyScore * (rules.ce && rules.ce.cursedEnergyScale || 0) +
      techniqueScore * (rules.ce && rules.ce.techniqueScale || 0) +
      visibleRank * (rules.ce && rules.ce.visibleGradeScale || 0) +
      Number(axes.jujutsu || 0) * (rules.ce && rules.ce.jujutsuAxisScale || 0);
    maxCe = zeroCe ? 0 : maxCe;
    maxCe = Math.round(clamp(maxCe, zeroCe ? 0 : (rules.ce && rules.ce.min || 1), zeroCe ? 0 : (rules.ce && rules.ce.max || 9999)));

    regenRatio = (rules.regen && rules.regen.baseRatio || 0.04) +
      controlScore * (rules.regen && rules.regen.controlScale || 0) +
      efficiencyScore * (rules.regen && rules.regen.efficiencyScale || 0) +
      talentScore * (rules.regen && rules.regen.talentScale || 0);
    if (flags.has("efficiencyLock")) regenRatio += Number(rules.regen && rules.regen.efficiencyLockBonus || 0);
    regenRatio = zeroCe ? 0 : clamp(regenRatio, rules.regen && rules.regen.minRatio || 0.01, rules.regen && rules.regen.maxRatio || 0.3);
    ceRegen = Math.max(0, Number((maxCe * regenRatio).toFixed(1)));

    stability = (rules.stability && rules.stability.base || 0.38) +
      controlScore * (rules.stability && rules.stability.controlScale || 0) +
      efficiencyScore * (rules.stability && rules.stability.efficiencyScale || 0) +
      talentScore * (rules.stability && rules.stability.talentScale || 0);
    if (flags.has("topDomain") || flags.has("openDomainExecution")) stability += Number(rules.stability && rules.stability.topDomainBonus || 0);
    if (flags.has("efficiencyLock")) stability += Number(rules.stability && rules.stability.efficiencyLockBonus || 0);
    if (flags.has("haxLimitedCombat") || flags.has("supportHax")) stability -= Number(rules.stability && rules.stability.haxVolatilityPenalty || 0);
    stability = Number(clamp(stability, rules.stability && rules.stability.min || 0, rules.stability && rules.stability.max || 1).toFixed(4));

    hasDomain = requireDependency("hasDuelDomainAccess")(profile);
    if (hasDomain) {
      threshold = (rules.domain && rules.domain.baseThreshold || 58) +
        controlScore * (rules.domain && rules.domain.controlScale || 0) +
        efficiencyScore * (rules.domain && rules.domain.efficiencyScale || 0) +
        talentScore * (rules.domain && rules.domain.talentScale || 0) +
        visibleRank * (rules.domain && rules.domain.visibleGradeScale || 0);
      if (flags.has("topDomain")) threshold += Number(rules.domain && rules.domain.topDomainBonus || 0);
      if (flags.has("openDomainExecution")) threshold += Number(rules.domain && rules.domain.openDomainBonus || 0);
      if (flags.has("customDomain") || flags.has("domainCapableAssumption")) threshold += Number(rules.domain && rules.domain.customDomainBonus || 0);
      if (flags.has("domainSustainEngine")) threshold += Number(rules.domain && rules.domain.domainSustainBonus || 0);
    }

    resource = {
      side: side,
      profileId: profile && profile.id || "",
      name: profile && profile.name || "",
      characterCardProfile: profile || null,
      specialHandTags: Array.isArray(profile && profile.specialHandTags) ? profile.specialHandTags.slice() : [],
      "特殊手札": Array.isArray(profile && profile["特殊手札"]) ? profile["特殊手札"].slice() : [],
      explicitSpecialHandTags: Array.isArray(profile && profile.explicitSpecialHandTags) ? profile.explicitSpecialHandTags.slice() : [],
      hp: maxHp,
      maxHp: maxHp,
      ce: maxCe,
      maxCe: maxCe,
      ceRegen: ceRegen,
      regenRatio: Number(regenRatio.toFixed(4)),
      isZeroCe: zeroCe,
      hasCe: !zeroCe,
      stability: stability,
      domain: {
        active: false,
        load: 0,
        threshold: Math.round(threshold),
        meltdownRisk: 0,
        turnsActive: 0
      },
      statusEffects: []
    };
    return global.JJKSpecialConstitution?.initializeResource(resource, profile) || resource;
  }

  function getDuelResourcePair(battle, side) {
    if (!battle || !battle.resourceState) return null;
    if (side === "left") return battle.resourceState.p1;
    if (side === "right") return battle.resourceState.p2;
    return null;
  }

  function getDuelTemporaryResourceCap(resource, key, maxKey) {
    var max = Math.max(0, Number(resource?.[maxKey] || 0));
    var extra = Math.max(0, Number(resource?.[key] || 0));
    return max + extra;
  }

  function isYutaRikaManifestedUnit(unit) {
    var text = [
      unit?.id,
      unit?.cardId,
      unit?.actionId,
      unit?.name,
      unit?.label,
      unit?.summonLane,
      unit?.zoneLabel
    ].concat(
      Array.isArray(unit?.tags) ? unit.tags : [],
      Array.isArray(unit?.unitStats?.tags) ? unit.unitStats.tags : []
    ).filter(Boolean).join(" ");
    return /rika_full_manifestation|yuta_rika_manifestation|祈本里香/.test(text);
  }

  function getActiveYutaRikaManifestationUnit(battle, side) {
    if (!battle || !side || !Array.isArray(battle.battlefieldUnits)) return null;
    return battle.battlefieldUnits.find(function findRikaUnit(unit) {
      if (!unit?.active || unit.defeated) return false;
      if ((unit.controllerSide || unit.ownerSide || unit.side || "") !== side) return false;
      return isYutaRikaManifestedUnit(unit);
    }) || null;
  }

  function hasActiveYutaRikaManifestation(battle, side) {
    return Boolean(getActiveYutaRikaManifestationUnit(battle, side));
  }

  function syncDuelTemporaryResourceCap(resource, valueKey, maxKey, capKey) {
    var max = Math.max(0, Number(resource?.[maxKey] || 0));
    var value = Math.max(0, Number(resource?.[valueKey] || 0));
    if (value > max) {
      resource[capKey] = Number((value - max).toFixed(1));
    } else {
      delete resource[capKey];
    }
  }

  function clampDuelResource(resource) {
    if (!resource) return;
    if (resource.isZeroCe || resource.hasCe === false) {
      resource.ce = 0;
      resource.maxCe = 0;
      resource.ceRegen = 0;
      resource.regenRatio = 0;
      delete resource.temporaryCeOverCap;
    }
    resource.hp = Number(clamp(resource.hp, 0, getDuelTemporaryResourceCap(resource, "temporaryHpOverCap", "maxHp")).toFixed(1));
    resource.ce = Number(clamp(resource.ce, 0, getDuelTemporaryResourceCap(resource, "temporaryCeOverCap", "maxCe")).toFixed(1));
    syncDuelTemporaryResourceCap(resource, "hp", "maxHp", "temporaryHpOverCap");
    syncDuelTemporaryResourceCap(resource, "ce", "maxCe", "temporaryCeOverCap");
    if (resource.domain && resource.domain.threshold > 0) {
      resource.domain.load = Number(Math.max(0, resource.domain.load || 0).toFixed(1));
      resource.domain.meltdownRisk = Number(clamp(resource.domain.load / resource.domain.threshold, 0, 1.5).toFixed(4));
    } else if (resource.domain) {
      resource.domain.load = 0;
      resource.domain.meltdownRisk = 0;
    }
  }

  function resolveDuelRoundStatusEffects(actor, battle, side) {
    actor.statusEffects = (actor.statusEffects || [])
      .filter(function resolveStrictDomainPendingDamage(effect) {
        var damage;
        var triggerRound;
        var sourceDomainName;
        var sourceSide;
        var sourceActor;
        var damageApplication;
        var actualDamage;
        if (effect.id !== "domainScriptPendingDamage") return true;
        damage = Math.max(0, Number(effect.value || 0));
        triggerRound = Number(effect.triggerRound || 0);
        if (!damage || (triggerRound && triggerRound > Number(battle.round || 0))) return true;
        sourceDomainName = effect.sourceDomainName || "领域";
        sourceSide = effect.sourceSide || (side === "left" ? "right" : "left");
        sourceActor = getDuelResourcePair(battle, sourceSide);
        damageApplication = requireDependency("applyDuelStandardDamageToTarget")({
          type: "character",
          resource: actor,
          id: actor.id || side,
          name: actor.name || side,
          side: side
        }, damage, battle, {
          actor: sourceActor,
          opponent: actor,
          action: {
            id: effect.sourceActionId || "domain_script_pending_damage",
            label: sourceDomainName + "·后续伤害",
            cardType: "domain"
          },
          sourceKind: "domain",
          source: "domain-script-pending",
          sourceLabel: sourceDomainName + "·后续伤害",
          blockIgnoreRatio: Math.max(0, Number(effect.blockIgnoreRatio || 0)),
          applyAttackerScales: Boolean(sourceActor)
        });
        actualDamage = Math.max(0, Number(damageApplication?.applied || 0));
        recordDuelResourceChange(battle, {
          side: side,
          title: "领域后续伤害",
          detail: getDuelResourceSideLabel(side) + actor.name + " 受到「" + sourceDomainName + "」的后续领域效果，结算前 " + formatNumber(damage) + " 点，防御后体势 -" + formatNumber(actualDamage) + "；当前 " + formatNumber(actor.hp) + " / " + formatNumber(actor.maxHp) + "。",
          type: "domain",
          delta: {
            hp: -actualDamage,
            domainPendingDamageResolved: true,
            sourceDomainName: sourceDomainName,
            sourceSide: sourceSide,
            incomingBeforeDefense: Number(damageApplication?.damageMitigation?.incomingBeforeDefense || damage),
            totalPrevented: Number(damageApplication?.damageMitigation?.totalPrevented || 0)
          }
        });
        return false;
      })
      .map(function tickDuelStatusEffect(effect) {
        var copy = {};
        var currentTurn = Number(battle.round || 0) + 1;
        var explicitExpiresRound = Number(effect.expiresRound || effect.expiresAfterRound || 0);
        Object.keys(effect).forEach(function (key) {
          copy[key] = effect[key];
        });
        // An explicit expiry is authoritative.  In R66 the same lifecycle is
        // called before actions to provide turn-start CE regeneration; blindly
        // decrementing `rounds: 1` here deleted the status before its final
        // advertised action round.  Derive the visible count from the absolute
        // boundary and remove it only after that boundary has passed.
        if (explicitExpiresRound > 0) {
          copy.rounds = currentTurn <= explicitExpiresRound
            ? Math.max(1, explicitExpiresRound - currentTurn + 1)
            : 0;
          return copy;
        }
        // A status applied while resolving the current turn must remain active
        // for its advertised number of complete turns. Previously a one-turn
        // status was created and immediately removed by this same turn's
        // lifecycle (notably Angel's technique suppression).
        if (Number(effect.appliedTurn || 0) >= currentTurn) {
          return copy;
        }
        copy.rounds = Math.max(0, Number(effect.rounds || 0) - 1);
        return copy;
      })
      .filter(function keepActiveDuelStatusEffect(effect) {
        return effect.rounds > 0;
      });
  }

  function applyDuelRoundResourceRegen(actor, battle, side) {
    var rules;
    var before;
    var beforeHp;
    var regenBlocked;
    var jackpotState;
    var regenPenalty = 0;
    var regenBonus = 0;
    var regenOverride = 1;
    var blockedConfig;
    var regenScale;
    var activeRikaUnit = null;
    var rikaRegenMultiplier = 1;
    var rikaHpRegenMaxRatio = 0;
    var rikaHpHeal = 0;
    var actualRikaHpHeal = 0;
    var rikaCeCost = 0;
    var actualRikaCeCost = 0;
    var rikaWeaknessApplied = false;
    var mythicalBeastAmberCollapse = 0;
    var mythicalBeastAmberRoundCost = null;
    var amount;
    var jackpotHeal;
    var actualJackpotHeal = 0;
    var actual;
    var constitutionPassive;

    if (typeof battle === "undefined") battle = getCurrentDuelBattle();
    if (typeof side === "undefined") side = actor && actor.side;
    if (!actor || !battle) return 0;
    global.JJKDuelActions?.dispatchCustomAtomicTrigger?.("turn-start", actor, getDuelResourcePair(battle, side === "left" ? "right" : "left"), battle, { source: "turn-start" });
    if (isDuelResourceDefeated(actor, battle, side)) {
      clampDuelResource(actor);
      return 0;
    }
    constitutionPassive = global.JJKSpecialConstitution?.applyRoundPassive(actor, battle) || null;
    if (constitutionPassive?.amount > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "咒灵躯体恢复",
        detail: getDuelResourceSideLabel(side) + actor.name + " 以咒灵之躯恢复 " + formatNumber(constitutionPassive.amount) + " 体势（咒力总量50% + 咒力操纵20% + 咒力效率30%）；当前 " + formatNumber(actor.hp) + " / " + formatNumber(actor.maxHp) + "。",
        type: "resource",
        delta: { hp: constitutionPassive.amount, curseSpiritBodyRegen: true, formulaAmount: constitutionPassive.formulaAmount }
      });
    }
    if (actor.isZeroCe || actor.hasCe === false) {
      resolveDuelRoundStatusEffects(actor, battle, side);
      clampDuelResource(actor);
      return 0;
    }

    rules = getDuelResourceRulesSafe();
    before = Number(actor.ce || 0);
    beforeHp = Number(actor.hp || 0);
    regenBlocked = getDuelStatusEffectValue(actor, "ceRegenBlocked");
    jackpotState = getDuelStatusEffectValue(actor, "jackpotStateCandidate");
    mythicalBeastAmberCollapse = getDuelStatusEffectValue(actor, "mythicalBeastAmberCollapse");
    (actor.statusEffects || []).forEach(function (effect) {
      var value;
      var triggerRound;
      triggerRound = Number(effect.triggerRound || 0);
      if (triggerRound && triggerRound > Number(battle.round || 0)) return;
      if (effect.id !== "ceRegenInterference") return;
      value = Number(effect.value || 0);
      if (value > regenPenalty) regenPenalty = value;
    });
    (actor.statusEffects || []).forEach(function (effect) {
      var value;
      var triggerRound;
      triggerRound = Number(effect.triggerRound || 0);
      if (triggerRound && triggerRound > Number(battle.round || 0)) return;
      if (effect.id !== "ceRegenBoost") return;
      value = Number(effect.value ?? effect.regenScaleBonus ?? 0);
      if (value > regenBonus) regenBonus = value;
    });
    (actor.statusEffects || []).forEach(function (effect) {
      var triggerRound = Number(effect.triggerRound || 0);
      if (triggerRound && triggerRound > Number(battle.round || 0)) return;
      if (effect.regenScale == null) return;
      regenOverride = Math.max(regenOverride, Math.max(0, Number(effect.regenScale || 0)));
    });
    blockedConfig = rules.statusEffects && rules.statusEffects.ceRegenBlocked || {};
    regenScale = regenBlocked > 0
      ? Number(blockedConfig.regenScale != null ? blockedConfig.regenScale : 0)
      : clamp(1 - regenPenalty + regenBonus + jackpotState * 1.35, 0.25, 2.8);
    if (mythicalBeastAmberCollapse > 0) regenScale = Number((regenScale * 0.8).toFixed(4));
    regenScale = Number((regenScale * regenOverride).toFixed(4));
    activeRikaUnit = getActiveYutaRikaManifestationUnit(battle, side);
    rikaRegenMultiplier = activeRikaUnit
      ? Math.max(1, Number(activeRikaUnit?.yutaRikaCeRegenMultiplier ?? activeRikaUnit?.unitStats?.yutaRikaCeRegenMultiplier ?? 2))
      : 1;
    rikaHpRegenMaxRatio = activeRikaUnit
      ? clamp(Number(activeRikaUnit?.yutaRikaHpRegenMaxRatio ?? activeRikaUnit?.unitStats?.yutaRikaHpRegenMaxRatio ?? 0.05), 0, 1)
      : 0;
    amount = Number((actor.ceRegen * regenScale * rikaRegenMultiplier).toFixed(1));
    actor.ce = Math.min(getDuelTemporaryResourceCap(actor, "temporaryCeOverCap", "maxCe"), before + amount);
    jackpotHeal = jackpotState > 0 ? Number((actor.maxHp * 0.045 * jackpotState).toFixed(1)) : 0;
    if (jackpotHeal > 0 && !isDuelResourceDefeated(actor, battle, side)) {
      actor.hp = Math.min(getDuelTemporaryResourceCap(actor, "temporaryHpOverCap", "maxHp"), Number(actor.hp || 0) + jackpotHeal);
      actualJackpotHeal = Math.max(0, Number((Number(actor.hp || 0) - beforeHp).toFixed(1)));
    }
    if (rikaRegenMultiplier > 1 && !isDuelResourceDefeated(actor, battle, side)) {
      var beforeRikaHp = Number(actor.hp || 0);
      rikaHpHeal = Number((Math.max(0, Number(actor.maxHp || 0)) * rikaHpRegenMaxRatio).toFixed(1));
      if (rikaHpHeal > 0) {
        actor.hp = Math.min(getDuelTemporaryResourceCap(actor, "temporaryHpOverCap", "maxHp"), beforeRikaHp + rikaHpHeal);
        actualRikaHpHeal = Math.max(0, Number((Number(actor.hp || 0) - beforeRikaHp).toFixed(1)));
      }
      // 完全显现只应用牌面声明的回流与恢复，不再暗扣最大咒力或附加隐藏虚弱。
      rikaCeCost = 0;
      actualRikaCeCost = 0;
      rikaWeaknessApplied = false;
    }
    mythicalBeastAmberRoundCost = applyMythicalBeastAmberRoundCost(actor, battle, side);
    resolveDuelRoundStatusEffects(actor, battle, side);
    if (rikaRegenMultiplier > 1) {
      actor.statusEffects = (actor.statusEffects || []).filter(function removeRikaWeakness(effect) {
        return effect?.id !== "yutaRikaManifestWeakness";
      });
      if (rikaWeaknessApplied) {
        actor.statusEffects.push({
          id: "yutaRikaManifestWeakness",
          label: "虚弱",
          rounds: 2,
          value: 1,
          outgoingScale: 0.62,
          incomingHpScale: 1.3
        });
      }
    }
    clampDuelResource(actor);
    actual = Number((actor.ce - before).toFixed(1));
    if (regenBlocked > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "咒力回流断裂",
        detail: getDuelResourceSideLabel(side) + actor.name + " 受领域崩解 / 术式烧断反噬，本次咒力回流被压断；当前 " + formatNumber(actor.ce) + " / " + formatNumber(actor.maxCe) + "。",
        type: "resource",
        delta: { ce: 0, regenBlocked: true }
      });
    } else if (actual > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "咒力回流",
        detail: getDuelResourceSideLabel(side) + actor.name + " 回流 " + formatNumber(actual) + " 咒力" + (regenBonus > 0 ? "（咒力流淌 +" + formatNumber(regenBonus * 100) + "%）" : "") + (rikaRegenMultiplier > 1 ? "（祈本里香完全显现 x" + formatNumber(rikaRegenMultiplier) + "）" : "") + "；当前 " + formatNumber(actor.ce) + " / " + formatNumber(actor.maxCe) + "。",
        type: "resource",
        delta: { ce: actual, regenBoost: regenBonus > 0 ? Number(regenBonus.toFixed(4)) : undefined, rikaManifestRegenMultiplier: rikaRegenMultiplier > 1 ? rikaRegenMultiplier : undefined }
      });
    }
    if (actualJackpotHeal > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "jackpot 回流",
        detail: getDuelResourceSideLabel(side) + actor.name + " 的 jackpot 状态候选扩大回流，体势恢复 " + formatNumber(actualJackpotHeal) + "，咒力回流倍率 " + formatNumber(regenScale) + "。",
        type: "subphase",
        delta: { hp: actualJackpotHeal, jackpotRegenScale: Number(regenScale.toFixed(2)) }
      });
    }
    if (actualRikaHpHeal > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "祈本里香守护回势",
        detail: getDuelResourceSideLabel(side) + actor.name + " 在祈本里香完全显现期间恢复满体势 " + formatNumber(rikaHpRegenMaxRatio * 100) + "%，体势 +" + formatNumber(actualRikaHpHeal) + "；当前 " + formatNumber(actor.hp) + " / " + formatNumber(actor.maxHp) + "。",
        type: "summon",
        delta: { hp: actualRikaHpHeal, rikaManifestHpRegenRatio: rikaHpRegenMaxRatio }
      });
    }
    if (actualRikaCeCost > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "祈本里香显现代价",
        detail: getDuelResourceSideLabel(side) + actor.name + " 为维持祈本里香完全显现消耗最大咒力 15%，咒力 -" + formatNumber(actualRikaCeCost) + "；当前 " + formatNumber(actor.ce) + " / " + formatNumber(actor.maxCe) + (rikaWeaknessApplied ? "，咒力归零并进入“虚弱”状态。" : "。"),
        type: "summon",
        delta: { ce: -actualRikaCeCost, rikaManifestCeCostRatio: 0.15, rikaManifestWeakness: rikaWeaknessApplied || undefined }
      });
    }
    return actual;
  }

  function getDuelTrialViolenceScale(battle, kind, actorSide) {
    var subPhase = battle && battle.domainSubPhase;
    if (!subPhase || subPhase.type !== "trial" || !subPhase.violenceRestricted || subPhase.verdictResolved) return 1;
    if (["technique", "melee", "domain", "finisher", "backfire"].indexOf(kind) === -1) return 1;
    return actorSide === subPhase.owner ? 0.72 : 0.58;
  }

  function updateDuelDomainLoad(actor, opponent, context) {
    var battle;
    var rules;
    var add = 0;
    var side;
    var profileState;
    var barrierModifiers;

    context = context || {};
    battle = context.battle || getCurrentDuelBattle();
    if (!actor || !actor.domain || actor.domain.threshold <= 0 || !battle) return 0;
    if (!context.domainEvent && !actor.domain.active) return 0;

    rules = getDuelResourceRulesSafe();
    side = actor.side || context.side;
    if (context.domainEvent) {
      if (!actor.domain.active) {
        actor.domain.active = true;
        actor.domain.turnsActive = 0;
        add += Number(rules.domain && rules.domain.activationLoad || 0);
        recordDuelResourceChange(battle, {
          round: battle.round + 1,
          side: actor.side,
          title: "领域展开",
          detail: getDuelResourceSideLabel(actor.side) + actor.name + " 展开领域，领域负荷启动 +" + formatNumber(rules.domain && rules.domain.activationLoad || 0) + "。",
          type: "domain",
          delta: { domainLoad: Number(rules.domain && rules.domain.activationLoad || 0) }
        });
      }
      add += Number(rules.domain && rules.domain.eventLoad || 0);
    } else if (actor.domain.active) {
      add += Number(rules.domain && rules.domain.maintainLoad || 0);
    }
    if (actor.domain.active && opponent && opponent.domain && opponent.domain.active) add += Number(rules.domain && rules.domain.oppositionLoad || 0);
    if (actor.domain.active && actor.maxCe > 0 && actor.ce / actor.maxCe < 0.24) add += Number(rules.domain && rules.domain.lowCeLoad || 0);

    profileState = battle.domainProfileStates && battle.domainProfileStates[side];
    if (!context.domainEvent && profileState && profileState.profile && profileState.profile.resourceRules) {
      add += Number(profileState.profile.resourceRules.domainLoadGrowth || 0) * (profileState.weakened ? 0.7 : 1);
    }
    add = Math.max(0, add - Number(actor.stability || 0) * Number(rules.domain && rules.domain.stabilityRelief || 0));

    barrierModifiers = profileState && profileState.profile
      ? requireDependency("getDuelDomainBarrierModifiers")(profileState.profile, actor, opponent, battle)
      : null;
    if (barrierModifiers) add *= Number(barrierModifiers.domainLoadScale || 1);
    add *= Number(getDuelActionContext(battle, side).domainLoadScale || 1);

    actor.domain.load += add;
    if (actor.domain.active) actor.domain.turnsActive += 1;
    if (context.domainEvent && actor.domain.active && !(battle.domainProfileStates && battle.domainProfileStates[actor.side])) {
      requireDependency("applyDuelDomainProfileOnActivation")(actor, opponent, battle, { action: { id: "domain_event", effects: { activateDomain: true } } });
    }
    clampDuelResource(actor);
    if (!context.domainEvent && add > 0) {
      recordDuelResourceChange(battle, {
        side: actor.side,
        title: "领域维持",
        detail: getDuelResourceSideLabel(actor.side) + actor.name + " 维持领域，领域负荷 +" + formatNumber(add) + "（" + formatNumber(actor.domain.load) + " / " + formatNumber(actor.domain.threshold) + "）。",
        type: "domain",
        delta: { domainLoad: Number(add.toFixed(1)) }
      });
    }
    return add;
  }

  function triggerDuelDomainMeltdown(actor, battle, side) {
    var rules;
    var ceLoss;
    var techniqueConfig;
    var regenConfig;

    if (typeof battle === "undefined") battle = getCurrentDuelBattle();
    if (typeof side === "undefined") side = actor && actor.side;
    if (!actor || !actor.domain || !actor.domain.active || !battle) return false;

    rules = getDuelResourceRulesSafe();
    ceLoss = Math.min(actor.ce, Math.max(8, actor.maxCe * Number(rules.domain && rules.domain.meltdownCeLossRatio || 0.25)));
    actor.ce -= ceLoss;
    actor.domain.active = false;
    actor.domain.load = Math.max(actor.domain.threshold, actor.domain.load);
    if (battle.domainProfileStates && battle.domainProfileStates[side]) delete battle.domainProfileStates[side];
    if (battle.domainSubPhase && battle.domainSubPhase.owner === side) {
      battle.domainSubPhase.verdictResolved = true;
      battle.domainSubPhase.endedByMeltdown = true;
      battle.domainSubPhase.trialEndReason = "domainMeltdown";
      battle.domainSubPhase.trialStatus = "resolved";
      requireDependency("updateDuelDomainTrialContext")(battle, {
        trialStatus: "resolved",
        trialEndReason: "domainMeltdown"
      });
      requireDependency("invalidateDuelActionChoices")(battle);
    }
    actor.stability = Number(clamp(actor.stability - Number(rules.domain && rules.domain.meltdownStabilityPenalty || 0.08), 0, 1).toFixed(4));
    techniqueConfig = rules.statusEffects && rules.statusEffects.techniqueImbalance || {};
    regenConfig = rules.statusEffects && rules.statusEffects.ceRegenBlocked || {};
    actor.statusEffects.push({
      id: "techniqueImbalance",
      label: techniqueConfig.label || "术式失衡",
      rounds: Number(techniqueConfig.rounds || 2),
      value: 1
    });
    actor.statusEffects.push({
      id: "techniqueBurnout",
      label: "术式烧断",
      rounds: Number(techniqueConfig.rounds || 2),
      value: 1
    });
    actor.statusEffects.push({
      id: "ceRegenBlocked",
      label: regenConfig.label || "咒力回流断裂",
      rounds: Number(regenConfig.rounds || 1),
      value: 1
    });
    clampDuelResource(actor);
    recordDuelResourceChange(battle, {
      side: side,
      title: "领域崩解 / 术式烧断",
      detail: getDuelResourceSideLabel(side) + actor.name + " 的领域负荷达到阈值，领域过载崩解，咒力 " + formatSignedDuelDelta(-ceLoss) + "，进入术式烧断，并出现咒力回流断裂。",
      type: "meltdown",
      delta: { ce: Number((-ceLoss).toFixed(1)), domainActive: false, domainCollapse: true, techniqueBurnout: true, status: "术式烧断", regenBlocked: true }
    });
    return true;
  }

  var ownedExports = {
    initializeDuelResourceState: initializeDuelResourceState,
    deriveDuelResourcesFromProfile: deriveDuelResourcesFromProfile,
    getDuelResourcePair: getDuelResourcePair,
    clampDuelResource: clampDuelResource,
    applyDuelRoundResourceRegen: applyDuelRoundResourceRegen,
    updateDuelDomainLoad: updateDuelDomainLoad,
    triggerDuelDomainMeltdown: triggerDuelDomainMeltdown,
    getDuelTrialViolenceScale: getDuelTrialViolenceScale
  };

  function useOwnedImplementations() {
    expectedExports.forEach(function (name) {
      bindings[name] = ownedExports[name];
    });
    return api;
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: "1.386E-resource-action-extraction",
      layer: "duel-resource",
      moduleFormat: "classic-script-iife",
      behavior: "owned-implementation",
      ownsBehavior: true,
      dependencyContract: "registerDependencies",
      registerBehavior: "dependencies-only",
      helperExports: [
        "getDuelStatusEffectValue",
        "recordDuelResourceChange",
        "getDuelResourceSideLabel",
        "formatNumber",
        "formatSignedDuelDelta",
        "getDuelActionContext",
        "clamp"
      ]
    }),
    expectedExports: Object.freeze(expectedExports.slice()),
    expectedDependencies: Object.freeze(expectedDependencies.slice()),
    bind: bind,
    bindDependency: bindDependency,
    register: register,
    configure: configure,
    registerDependencies: registerDependencies,
    hasBinding: hasBinding,
    hasDependency: hasDependency,
    get: get,
    getBinding: getBinding,
    getDependency: getDependency,
    listBindings: listBindings,
    listDependencies: listDependencies,
    missingDependencies: missingDependencies,
    clearBindings: clearBindings,
    clearDependencies: clearDependencies,
    useOwnedImplementations: useOwnedImplementations,
    initializeDuelResourceState: initializeDuelResourceState,
    deriveDuelResourcesFromProfile: deriveDuelResourcesFromProfile,
    getDuelResourcePair: getDuelResourcePair,
    clampDuelResource: clampDuelResource,
    applyDuelRoundResourceRegen: applyDuelRoundResourceRegen,
    updateDuelDomainLoad: updateDuelDomainLoad,
    triggerDuelDomainMeltdown: triggerDuelDomainMeltdown,
    getDuelTrialViolenceScale: getDuelTrialViolenceScale,
    getDuelStatusEffectValue: getDuelStatusEffectValue,
    recordDuelResourceChange: recordDuelResourceChange,
    getDuelResourceSideLabel: getDuelResourceSideLabel,
    formatNumber: formatNumber,
    formatSignedDuelDelta: formatSignedDuelDelta,
    getDuelActionContext: getDuelActionContext,
    clamp: clamp
  };

  useOwnedImplementations();
  global[namespace] = api;
})(globalThis);
