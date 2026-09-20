(function attachDuelCardTemplate(global) {
  "use strict";

  var namespace = "JJKDuelCardTemplate";
  var version = "1.392-public-template-tactics";
  var expectedExports = [
    "getDuelCardTemplateRules",
    "getDuelCardTemplates",
    "getDuelCardTemplateForAction",
    "normalizeDuelCardTemplate",
    "buildDuelCardViewModel",
    "buildDuelCardEffectPreview",
    "getDuelCardCopyRules",
    "getDuelCardCopyForAction",
    "normalizeDuelCardCopy",
    "mergeDuelCardTemplateWithCopy",
    "buildDuelCardDisplayModel",
    "getDuelCardRiskLabel",
    "getDuelCardTypeDisplayLabel",
    "getDuelCardAvailabilityMessage",
    "getDuelCardTypeLabel",
    "getDuelCardRarityLabel",
    "auditDuelCardTemplateDrift",
    "getDuelCardTemplateCoverage",
    "getDuelCardTemplateForActionStrict",
    "validateDuelCardTemplateSchema",
    "getDuelCardTemplateFallbackStats",
    "getDuelCharacterCombatStats",
    "getDuelRankMultiplier",
    "getDuelEfficiencyCostMultiplier",
    "getDuelCardScalingProfile",
    "calculateDuelCardBaseEffect",
    "calculateDuelCardFinalPreview",
    "calculateDuelCardCeCost",
    "calculateDuelDamageFromCard",
    "calculateDuelBlockFromCard",
    "calculateDuelHealingFromCard",
    "calculateDuelDomainPressureFromCard",
    "buildDuelCardNumericPreview",
    "buildDuelCardTemplateIndexes",
    "getDuelCardTemplateIndex",
    "getDuelCardTemplateByActionId",
    "warmDuelCardTemplateCache",
    "invalidateDuelCardTemplateCache",
    "getDuelCardTemplateCacheStats"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelCardTemplateRules",
    "getDuelCardCopyRules"
  ];
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var cardTemplateIndexCache = null;
  var cardTemplateCacheStats = {
    lastInvalidatedAt: ""
  };

  var defaultTypeLabels = {
    basic: "基础",
    defense: "防御",
    technique: "术式",
    domain: "领域",
    domain_response: "领域应对",
    domain_maintenance: "领域维持",
    rule_trial: "审判推进",
    rule_defense: "审判防御",
    jackpot: "坐杀搏徒",
    resource: "资源",
    support: "支援",
    activity_tactic: "战术互动",
    healing: "治疗",
    curse_tool: "咒具",
    special: "特殊"
  };

  var defaultRarityLabels = {
    common: "common",
    uncommon: "uncommon",
    rare: "rare",
    special: "special",
    domain: "domain",
    rule: "rule"
  };
  var requiredTemplateFields = [
    "cardId",
    "actionId",
    "name",
    "cardType",
    "apCost",
    "ceCostMode",
    "tags",
    "rarity",
    "weight",
    "contexts",
    "effectSummary",
    "risk",
    "status"
  ];
  var forbiddenEffectFields = [
    "effects",
    "requirements",
    "cost",
    "costCe",
    "applyEffect",
    "resolver",
    "resourceDelta",
    "hpDelta",
    "ceDelta",
    "outcome",
    "combatOverride"
  ];
  var allowedTemplateStatuses = ["CANDIDATE", "CONFIRMED"];
  var rankMultipliers = Object.freeze({
    "E-": 0.40,
    E: 0.55,
    D: 0.60,
    C: 0.80,
    B: 1.00,
    A: 1.35,
    S: 1.85,
    SS: 2.05,
    SSS: 2.35,
    "EX-": 2.95,
    EX: 3.50
  });
  var tenShadowsDamageBalance = Object.freeze({
    ceControlMultiplierScale: 0.35,
    ceControlMaxMultiplier: 1.85,
    damageMultiplier: 1.12,
    damageFlat: 2
  });
  var efficiencyCostMultipliers = Object.freeze({
    "E-": 1.32,
    E: 1.24,
    D: 1.16,
    C: 1.08,
    B: 1.00,
    A: 0.92,
    S: 0.824,
    SS: 0.728,
    SSS: 0.616,
    "EX-": 0.504,
    EX: 0.36
  });
  var rankScores = Object.freeze({
    "E-": 0.5,
    E: 1,
    D: 2,
    C: 3,
    B: 4,
    A: 5,
    S: 6.2,
    SS: 7.4,
    SSS: 8.8,
    "EX-": 10.2,
    EX: 12
  });

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function assertExpected(name) {
    if (!expectedExports.includes(name)) {
      throw new Error(namespace + " cannot bind unexpected export: " + name);
    }
  }

  function bind(name, value) {
    assertExpected(name);
    if (typeof value !== "function") {
      throw new Error(namespace + "." + name + " must be a function.");
    }
    bindings[name] = value;
  }

  function register(map) {
    Object.keys(map || {}).forEach(function bindExport(name) {
      bind(name, map[name]);
    });
  }

  function hasBinding(name) {
    if (name === undefined) {
      return expectedExports.every(function hasExport(exportName) {
        return hasOwn(bindings, exportName);
      });
    }
    return hasOwn(bindings, name);
  }

  function get(name) {
    assertExpected(name);
    if (hasOwn(bindings, name)) return bindings[name];
    if (typeof api?.[name] === "function") return api[name];
    throw new Error(namespace + "." + name + " is not bound.");
  }

  function getBinding(name) {
    return get(name);
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasBinding(name);
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
  }

  function registerDependencies(map) {
    Object.keys(map || {}).forEach(function bindDependency(name) {
      if (!expectedDependencyNames.includes(name)) {
        throw new Error(namespace + " received unexpected dependency: " + name);
      }
      dependencies[name] = map[name];
    });
  }

  function configure(map) {
    registerDependencies(map);
  }

  function hasDependency(name) {
    return hasOwn(dependencies, name);
  }

  function listDependencies() {
    return expectedDependencyNames.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = hasDependency(name);
      return snapshot;
    }, {});
  }

  function clearDependencies() {
    expectedDependencyNames.forEach(function clearName(name) {
      delete dependencies[name];
    });
  }

  function getOptionalFunction(name) {
    var value = dependencies[name];
    return typeof value === "function" ? value : null;
  }

  function getDuelCardTemplateRules() {
    var getter = getOptionalFunction("getDuelCardTemplateRules");
    if (getter && getter !== getDuelCardTemplateRules) return getter();
    return dependencies.state?.duelCardTemplateRules || {
      version: "0.1.0",
      status: "CANDIDATE",
      cards: [],
      cardTypeLabels: defaultTypeLabels,
      rarityLabels: defaultRarityLabels
    };
  }

  function getDuelCardTemplates() {
    var rules = getDuelCardTemplateRules();
    return Array.isArray(rules?.cards) ? rules.cards : [];
  }

  function getDuelCardCopyRules() {
    var getter = getOptionalFunction("getDuelCardCopyRules");
    if (getter && getter !== getDuelCardCopyRules) return getter();
    return dependencies.state?.duelCardCopyRules || {
      schema: "jjk-battle-runtime-card-copy",
      version: "0.1.0",
      status: "CANDIDATE",
      copy: []
    };
  }

  function getDuelCardCopyList() {
    var rules = getDuelCardCopyRules();
    return Array.isArray(rules?.copy) ? rules.copy : [];
  }

  function sanitizeDisplayText(value, fallback) {
    var text = typeof value === "string" ? value.trim() : "";
    return text || fallback || "";
  }

  function normalizeDisplayTags(value, fallback) {
    var source = Array.isArray(value) && value.length ? value : (Array.isArray(fallback) ? fallback : []);
    return Array.from(new Set(source.map(function normalizeTag(tag) {
      return typeof tag === "string" ? tag.trim() : "";
    }).filter(Boolean))).slice(0, 4);
  }

  function getDuelCardCopyForAction(actionOrCandidate, template) {
    var actionId = getActionId(actionOrCandidate) || template?.actionId || template?.actionId || "";
    var cardId = actionOrCandidate?.cardId || template?.cardId || "";
    return getDuelCardCopyList().find(function matchCopy(copy) {
      return Boolean(copy) && (
        (actionId && (copy.actionId === actionId || copy.actionId === actionId)) ||
        (cardId && copy.cardId === cardId)
      );
    }) || null;
  }

  function normalizeDuelCardCopy(copy, actionOrCandidate, template) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var fallbackName = template?.name || action.label || action.id || "未命名手札";
    var fallbackShortEffect = template?.effectSummary || action.description || "按当前手法规则结算。";
    return {
      actionId: copy?.actionId || copy?.actionId || template?.actionId || template?.actionId || action.id || "",
      cardId: copy?.cardId || template?.cardId || "",
      displayName: sanitizeDisplayText(copy?.displayName, fallbackName),
      subtitle: sanitizeDisplayText(copy?.subtitle, ""),
      shortEffect: sanitizeDisplayText(copy?.shortEffect, fallbackShortEffect),
      longEffect: sanitizeDisplayText(copy?.longEffect, fallbackShortEffect),
      flavorLine: sanitizeDisplayText(copy?.flavorLine, ""),
      uiTags: normalizeDisplayTags(copy?.uiTags, template?.tags || action.tags || []),
      tone: sanitizeDisplayText(copy?.tone, "direct"),
      status: copy?.status || template?.status || "CANDIDATE"
    };
  }

  function mergeDuelCardTemplateWithCopy(actionOrCandidate, template, copy) {
    var normalizedCopy = normalizeDuelCardCopy(copy, actionOrCandidate, template);
    return {
      ...(template || {}),
      displayName: normalizedCopy.displayName,
      subtitle: normalizedCopy.subtitle,
      shortEffect: normalizedCopy.shortEffect,
      longEffect: normalizedCopy.longEffect,
      flavorLine: normalizedCopy.flavorLine,
      uiTags: normalizedCopy.uiTags,
      copyStatus: normalizedCopy.status,
      copyTone: normalizedCopy.tone
    };
  }

  function getDuelCardRiskLabel(risk) {
    var labels = {
      low: "低风险",
      medium: "中风险",
      normal: "中风险",
      high: "高风险",
      critical: "极高风险"
    };
    return labels[risk] || risk || "风险待判定";
  }

  function getDuelCardTypeDisplayLabel(cardType) {
    return getDuelCardTypeLabel(cardType);
  }

  function getDuelCardAvailabilityMessage(reason, available, selected) {
    if (selected) return "已选择，本回合将执行";
    if (available) return "可用";
    var text = typeof reason === "string" ? reason : "";
    var lower = text.toLowerCase();
    if (text.includes("行动点") || lower.includes("ap")) return "行动点不足";
    if (text.includes("咒力") || lower.includes("ce")) return "咒力不足";
    if (text.includes("己方领域") || text.includes("领域未展开") || lower.includes("domainactive")) return "需要己方领域处于展开状态";
    if (text.includes("对方领域") || text.includes("领域威胁") || lower.includes("opponentdomain")) return "需要对方领域威胁存在";
    if (text.includes("审判") || lower.includes("trial")) return "当前审判程序不适用";
    if (text.includes("中奖") || text.includes("jackpot") || lower.includes("jackpot")) return "中奖结算尚未就绪";
    if (text.includes("零咒力") || lower.includes("zero")) return "仅零咒力个体可用";
    if (text.includes("咒具") || lower.includes("tool")) return "需要咒具状态或咒具适性";
    if (text.includes("没收") || lower.includes("confiscat")) return "术式被暂时没收";
    if (text.includes("暴力") || lower.includes("violence")) return "审判规则限制直接暴力";
    if (text.includes("领域负荷") || text.includes("熔断") || lower.includes("load")) return "领域负荷过高，继续维持可能领域崩解并触发术式烧断";
    return text || "当前状态不可用";
  }

  function formatSignedPercent(value) {
    var numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric === 0) return "";
    var percent = Number((numeric * 100).toFixed(Math.abs(numeric) < 0.01 ? 1 : 0));
    return (percent > 0 ? "+" : "") + percent + "%";
  }

  function formatScalePercent(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 1) return "";
    return formatSignedPercent(numeric - 1);
  }

  function formatPlainNumber(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    return String(Number(numeric.toFixed(Math.abs(numeric) < 10 ? 2 : 0)));
  }

  function addPreviewLine(list, line) {
    if (!Array.isArray(list) || typeof line !== "string") return;
    var text = sanitizeDisplayText(line.trim(), "");
    if (!text || /undefined|null|TODO|NaN/i.test(text)) return;
    if (!list.includes(text)) list.push(text);
  }

  function getActionEffects(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    return action.effects || action.effectPatch || {};
  }

  function getActionRequirements(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    return action.requirements || action.availability || {};
  }

  function getMechanicIds(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    return Array.from(new Set([]
      .concat(actionOrCandidate?.mechanicIds || [])
      .concat(action?.mechanicIds || [])
      .filter(Boolean)));
  }

  function buildStatusLine(status, ownerText) {
    if (!status || typeof status !== "object") return "";
    var label = status.label || status.id || "状态候选";
    var rounds = Number(status.rounds || status.durationRounds || 0);
    var duration = rounds > 0 ? "，持续 " + rounds + " 回合" : "";
    return ownerText + "：" + label + duration + "。";
  }

  function getDuelSummonedUnitTemplate(summonSpec) {
    var unitCardId = summonSpec?.unitCardId || summonSpec?.unitId || "";
    if (!unitCardId) return null;
    var rules = getDuelCardTemplateRules();
    var cards = Array.isArray(rules?.cards) ? rules.cards : [];
    return cards.find(function findSummonedUnit(card) {
      return card?.cardId === unitCardId;
    }) || null;
  }

  function getDuelSummonControlLabel(control) {
    var labels = {
      player_controlled: "友方控制",
      temporary_player_controlled: "临时友方控制",
      neutral_uncontrolled: "中立失控",
      neutral_berserk: "中立狂暴"
    };
    return labels[control] || control || "未指定";
  }

  function getDuelSummonPlacementLabel(summonSpec, unitStats, summonedUnit) {
    var zoneLabel = summonSpec?.zoneLabel || unitStats?.zoneLabel || summonedUnit?.unitStats?.zoneLabel || "";
    if (zoneLabel) return String(zoneLabel);
    var placement = String(summonSpec?.placement || unitStats?.placement || summonedUnit?.unitStats?.placement || "");
    var text = [
      placement,
      summonSpec?.summonLane,
      unitStats?.summonLane,
      summonSpec?.unitCardId,
      summonSpec?.unitName,
      summonedUnit?.cardId,
            summonedUnit?.name
    ].concat(Array.isArray(summonedUnit?.tags) ? summonedUnit.tags : []).filter(Boolean).join(" ");
    if (/curse_spirit_manipulation|咒灵操术|咒灵|虹龙|口裂女|化身玉藻前/i.test(text)) {
      return placement === "shikigami_zone" ? "咒灵式神区" : "咒灵式神区 / " + (placement || "战场");
    }
    if (placement === "shikigami_zone" || /ten_shadows|十影|十种影|式神|shadow_/i.test(text)) return "式神区";
    return placement || "未指定";
  }

  var disasterResourcePreviewDefinitions = Object.freeze({
    flameHeat: Object.freeze({ label: "火焰热度", max: 6 }),
    curseSeeds: Object.freeze({ label: "咒种", max: 6 }),
    seaLayers: Object.freeze({ label: "海潮层数", max: 6 }),
    poxCountdown: Object.freeze({ label: "疱疮倒计时", max: 3 })
  });

  var tacticalResourcePreviewDefinitions = Object.freeze({
    ratioWeakpoint: Object.freeze({ label: "十划弱点", max: 4 }),
    throatStrain: Object.freeze({ label: "咒言喉咙负担", max: 6 }),
    boogieTempo: Object.freeze({ label: "不义游戏节奏", max: 5 }),
    constructionMaterial: Object.freeze({ label: "构筑材料", max: 6 }),
    nailMarks: Object.freeze({ label: "钉痕", max: 5 }),
    iceLayers: Object.freeze({ label: "冰凝层数", max: 6 }),
    skyFold: Object.freeze({ label: "天空折叠", max: 6 }),
    graniteCharge: Object.freeze({ label: "花岗岩蓄力", max: 6 }),
    cursedObjectSediment: Object.freeze({ label: "咒物沉积", max: 6 }),
    pandaCoreCharge: Object.freeze({ label: "熊猫核心充能", max: 5 }),
    rikaManifestSustain: Object.freeze({ label: "完全显现维持", max: 5 }),
    miracleStockpile: Object.freeze({ label: "奇迹储备", max: 3 })
  });

  function addDuelResourcePreview(lines, action, options) {
    var kind = String(action?.[options.kindField] || "");
    var definition = options.definitions[kind];
    if (!definition) return;
    var cost = Math.max(0, Number(action?.[options.costField] || 0));
    var gain = Math.max(0, Number(action?.[options.gainField] || 0));
    var configuredMax = Math.max(0, Number(action?.[options.maxField] || 0));
    var maximum = configuredMax > 0 ? configuredMax : Math.max(0, Number(definition.max || 0));
    if (cost > 0) addPreviewLine(lines, "消耗：" + definition.label + " " + formatPlainNumber(cost) + "。");
    if (gain > 0) {
      var gainTiming = action?.resourceGainTiming === "onHit" ? "命中后获得" : "发动时获得";
      addPreviewLine(lines, gainTiming + "：" + definition.label + " +" + formatPlainNumber(gain) + "。");
    }
    if (maximum > 0) addPreviewLine(lines, definition.label + "上限：" + formatPlainNumber(maximum) + "。");
  }

  function buildDuelCardEffectPreview(actionOrCandidate, template, display, baseView) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var effects = getActionEffects(actionOrCandidate);
    var requirements = getActionRequirements(actionOrCandidate);
    var id = getActionId(actionOrCandidate) || template?.actionId || template?.actionId || action?.id || "";
    var cardType = template?.cardType || inferCardType(action);
    var tags = Array.from(new Set([].concat(template?.tags || [], action?.tags || [], baseView?.tags || []).filter(Boolean)));
    var tagText = tags.join(" ");
    var lower = (id + " " + cardType + " " + tagText).toLowerCase();
    var preview = {
      summary: "",
      resourceLines: [],
      combatLines: [],
      statusLines: [],
      conditionLines: [],
      riskLines: []
    };
    var ceCost = Number(baseView?.ceCost ?? baseView?.costCe ?? 0);
    var numericPreview = buildDuelCardNumericPreview(actionOrCandidate, baseView?.actor || baseView?.characterCardProfile || actionOrCandidate?.characterCardProfile || {});
    addPreviewLine(preview.resourceLines, "消耗：咒力 " + formatPlainNumber(ceCost || numericPreview.cost?.finalCost || 0) + "。");
    addDuelResourcePreview(preview.resourceLines, action, {
      kindField: "disasterResourceKind",
      costField: "disasterResourceCost",
      gainField: "disasterResourceGain",
      maxField: "disasterResourceMax",
      definitions: disasterResourcePreviewDefinitions
    });
    addDuelResourcePreview(preview.resourceLines, action, {
      kindField: "tacticalResourceKind",
      costField: "tacticalResourceCost",
      gainField: "tacticalResourceGain",
      maxField: "tacticalResourceMax",
      definitions: tacticalResourcePreviewDefinitions
    });
    (numericPreview.lines || []).forEach(function addNumericLine(line) {
      addPreviewLine(/^领域负荷[:：]/.test(String(line || "")) ? preview.resourceLines : preview.combatLines, line);
    });

    var outgoing = formatScalePercent(effects.outgoingScale);
    if (outgoing) addPreviewLine(preview.combatLines, "输出倍率：" + outgoing + "。");
    var incomingHp = formatScalePercent(effects.incomingHpScale);
    if (incomingHp) addPreviewLine(preview.combatLines, "受到体势伤害：" + incomingHp + "。");
    var incomingCe = formatScalePercent(effects.incomingCeScale);
    if (incomingCe) addPreviewLine(preview.combatLines, "受到咒力消耗压力：" + incomingCe + "。");
    var evasionBonus = formatSignedPercent(effects.evasionBonus);
    if (evasionBonus) addPreviewLine(preview.combatLines, "闪避：" + evasionBonus + "。");
    var selfHpCostRatio = Number(effects.selfHpCostRatio);
    if (Number.isFinite(selfHpCostRatio) && selfHpCostRatio > 0) {
      addPreviewLine(preview.resourceLines, "体势代价：最大体势 " + formatSignedPercent(selfHpCostRatio).replace(/^\+/, "") + "。");
    }
    var selfHpCostFlat = Number(effects.selfHpCostFlat);
    if (Number.isFinite(selfHpCostFlat) && selfHpCostFlat > 0) {
      addPreviewLine(preview.resourceLines, "体势代价：" + formatPlainNumber(selfHpCostFlat) + "。");
    }
    var sureHit = formatScalePercent(effects.sureHitScale);
    if (sureHit) addPreviewLine(preview.combatLines, "必中组件影响：" + sureHit + "。");
    var domainPressure = formatScalePercent(effects.domainPressureScale);
    if (domainPressure) addPreviewLine(preview.combatLines, "领域压制影响：" + domainPressure + "。");
    var manualAttack = formatScalePercent(effects.manualAttackScale);
    if (manualAttack) addPreviewLine(preview.combatLines, "手动攻击影响：" + manualAttack + "。");
    var hpDamage = Number(effects.hpDamage ?? effects.flatHpDamage);
    if (Number.isFinite(hpDamage) && hpDamage) addPreviewLine(preview.combatLines, "预计体势伤害：" + formatPlainNumber(hpDamage) + "。");
    var stability = formatSignedPercent(effects.stabilityDelta);
    if (stability) addPreviewLine(preview.resourceLines, "稳定度：" + stability + "。");
    var opponentStability = formatSignedPercent(effects.opponentStabilityDelta);
    if (opponentStability) addPreviewLine(preview.combatLines, "对手稳定度：" + opponentStability + "。");
    var domainLoadDelta = Number(effects.domainLoadDelta);
    if (Number.isFinite(domainLoadDelta) && domainLoadDelta && !(isDirectSchemaBattleCard(action) && Number.isFinite(Number(numericPreview.finalDomainLoad)))) {
      addPreviewLine(preview.resourceLines, "领域负荷：" + (domainLoadDelta > 0 ? "+" : "") + formatPlainNumber(domainLoadDelta) + "。");
    }
    var opponentDomainLoadDelta = Number(effects.opponentDomainLoadDelta);
    if (Number.isFinite(opponentDomainLoadDelta) && opponentDomainLoadDelta) addPreviewLine(preview.combatLines, "对手领域负荷：" + (opponentDomainLoadDelta > 0 ? "+" : "") + formatPlainNumber(opponentDomainLoadDelta) + "。");
    var domainLoadScale = formatScalePercent(effects.domainLoadScale);
    if (domainLoadScale) addPreviewLine(preview.resourceLines, "领域负荷增长：" + domainLoadScale + "。");
    if (effects.activateDomain) addPreviewLine(preview.statusLines, "状态变化：展开己方领域，并开始计算领域负荷。");
    if (effects.releaseDomain) addPreviewLine(preview.statusLines, "状态变化：解除己方领域，降低领域崩解风险。");
    var summonSpec = action.summonSpec || template?.summonSpec;
    if (summonSpec) {
      var summonedUnit = getDuelSummonedUnitTemplate(summonSpec);
      var unitStats = summonedUnit?.unitStats || template?.unitStats || action.unitStats || {};
      var unitName = summonedUnit?.name || summonSpec.unitName || summonSpec.unitCardId || "召唤单位";
      var placement = getDuelSummonPlacementLabel(summonSpec, unitStats, summonedUnit);
      var control = summonSpec.control || unitStats.control || "";
      var previewGuardRules = summonedUnit?.guardRules || action.guardRules || unitStats.guardRules || {};
      var durationRounds = Number(summonSpec.durationRounds || unitStats.durationRounds || template?.durationRounds || action.durationRounds || 0);
      addPreviewLine(preview.statusLines, "召唤：" + unitName + "，位置：" + placement + "，控制：" + getDuelSummonControlLabel(control) + (durationRounds > 0 ? "，持续 " + formatPlainNumber(durationRounds) + " 回合" : "") + "。");
      if (Number(unitStats.maxHp || 0) > 0) {
        addPreviewLine(
          preview.combatLines,
          "召唤单位：体势 " + formatPlainNumber(unitStats.maxHp) +
            "，基础伤害 " + formatPlainNumber(unitStats.damage || summonedUnit?.damage || summonedUnit?.effect?.damage || 0) +
            "，防御 " + formatPlainNumber(unitStats.block || 0) +
            "，减伤 " + formatPlainNumber(Number(unitStats.damageReductionRatio || 0) * 100) + "%" +
            "，穿透 " + formatPlainNumber(Number(unitStats.blockIgnoreRatio || 0) * 100) + "%" +
            "。"
        );
      }
      if (summonedUnit?.targetingRules?.neverCountsAsGuard || control === "neutral_berserk") addPreviewLine(preview.riskLines, "目标规则：该召唤物为狂暴 / 非守护单位，不会替任何一方承担攻击。");
      if (previewGuardRules.interceptsOpponentAttacks) addPreviewLine(preview.statusLines, "守护规则：存活期间可优先承接对手攻击判定。");
      var maintenanceCeCost = Math.max(0, Number(summonSpec.maintenanceCeCost ?? unitStats.maintenanceCeCost ?? 0));
      if (maintenanceCeCost > 0) addPreviewLine(preview.resourceLines, "召唤维持：每回合咒力 " + formatPlainNumber(maintenanceCeCost) + "。");
      if (summonSpec.requiresMaintenanceCardId) addPreviewLine(preview.conditionLines, "维持：生成或要求维持牌 " + summonSpec.requiresMaintenanceCardId + "。");
    }
    addPreviewLine(preview.statusLines, buildStatusLine(effects.selfStatus, "可能获得"));
    addPreviewLine(preview.statusLines, buildStatusLine(effects.opponentStatus, "可能施加给对手"));
    [].concat(effects.selfStatuses || []).forEach(function addSelfStatusPreview(status) {
      addPreviewLine(preview.statusLines, buildStatusLine(status, "可能获得"));
    });
    [].concat(effects.opponentStatuses || []).forEach(function addOpponentStatusPreview(status) {
      addPreviewLine(preview.statusLines, buildStatusLine(status, "可能施加给对手"));
    });
    var duration = Number(effects.durationRounds || effects.rounds || effects.duration || 0);
    if (Number.isFinite(duration) && duration > 0) addPreviewLine(preview.statusLines, "持续：" + formatPlainNumber(duration) + " 回合。");
    if (Array.isArray(effects.delayedSelfStatuses)) {
      effects.delayedSelfStatuses.forEach(function addDelayedStatusPreview(status) {
        if (!status?.id) return;
        var triggerDelayTurns = Math.max(0, Number(status.triggerDelayTurns || 0));
        var scale = Number(status.outgoingScale ?? status.value ?? 1);
        if (status.id === "loaned_next_shot_boost" && Number.isFinite(scale) && scale > 1) {
          addPreviewLine(preview.statusLines, "延迟爆发：" + (triggerDelayTurns <= 1 ? "下一回合" : triggerDelayTurns + " 回合后") + "输出倍率 +" + formatPlainNumber(Math.round((scale - 1) * 100)) + "%。");
        }
        if (status.id === "loaned_shot_debt" && Number.isFinite(scale) && scale > 0 && scale < 1) {
          addPreviewLine(preview.riskLines, "后续负担：" + (triggerDelayTurns <= 1 ? "下一回合起" : triggerDelayTurns + " 回合后") + "输出倍率 -" + formatPlainNumber(Math.round((1 - scale) * 100)) + "%。");
        }
      });
    }

    if (Array.isArray(template?.contexts) && template.contexts.length) {
      addPreviewLine(preview.conditionLines, "适用：" + template.contexts.join(" / ") + "。");
    }
    if (action.exclusiveHandSelection || template?.exclusiveHandSelection) {
      addPreviewLine(preview.conditionLines, "限制：本回合只能选择此手札。");
    }
    if (requirements.domainActive === true) addPreviewLine(preview.conditionLines, "条件：需要己方领域处于展开状态。");
    if (requirements.domainActive === false) addPreviewLine(preview.conditionLines, "条件：需要己方尚未展开领域。");
    if (requirements.opponentDomainActive) addPreviewLine(preview.conditionLines, "条件：需要对方领域威胁存在。");
    if (requirements.requiresDomainAccess) addPreviewLine(preview.conditionLines, "条件：需要角色具备领域能力。");
    if (requirements.requiresZeroCeBypass || /zero_ce|零咒力/.test(lower)) {
      addPreviewLine(preview.resourceLines, "咒力消耗：0；依靠零咒力和体术路线。");
      addPreviewLine(preview.conditionLines, "条件：仅零咒力 / 天与咒缚路线适用。");
      addPreviewLine(preview.combatLines, "可规避必中捕捉，但不能免疫开放领域压制或手动攻击。");
    }
    if (requirements.blocksOnTechniqueImbalance) addPreviewLine(preview.conditionLines, "不适用：术式被没收、失衡或无法稳定输出时。");
    if (requirements.requiresSimpleDomain) addPreviewLine(preview.conditionLines, "条件：需要简易领域或等价反必中防线。");
    if (requirements.requiresHollowWickerBasket) addPreviewLine(preview.conditionLines, "条件：需要弥虚葛笼架势。");

    if (/trial|judgment|evidence|verdict|审判|证据|判决|没收/.test(lower)) {
      addPreviewLine(preview.combatLines, "审判关系：推进证据压力、辩护压力或判决准备，不直接重写胜负。");
      if (/verdict|判决/.test(lower)) addPreviewLine(preview.conditionLines, "判决准备：需审判程序推进到可申请判决的状态。");
      if (/confisc|没收/.test(lower)) addPreviewLine(preview.statusLines, "状态变化：可能联动术式没收或咒具没收候选。");
    }
    if (/jackpot|reach|probability|中奖|演出|期待/.test(lower)) {
      addPreviewLine(preview.combatLines, "jackpot 关系：影响期待度、演出稳定或中奖结算准备。");
      addPreviewLine(preview.conditionLines, "结算：期待度达到阈值后才可进入中奖结算。");
    }
    if (/black_flash|黑闪|impact_timing_window|爆发窗口/.test(lower)) {
      addPreviewLine(preview.statusLines, "建立 1 回合 strike 爆发窗口；这不是主动发动黑闪。");
      addPreviewLine(preview.conditionLines, "触发：下一次 strike / 近身打击类动作才可能吃到窗口修正。");
    }

    if (!preview.combatLines.length) addPreviewLine(preview.combatLines, "效果强度：随当前资源、体势、领域和审判状态动态结算。");
    if (!preview.statusLines.length) addPreviewLine(preview.statusLines, "状态变化：无固定状态；按当前手札效果结算。");
    if (!preview.conditionLines.length) addPreviewLine(preview.conditionLines, "适用：按当前手札可用性、资源和场上状态判断。");
    addPreviewLine(preview.riskLines, "风险：" + getDuelCardRiskLabel(baseView?.risk || template?.risk || action?.risk || "medium") + "。连续使用可能增加资源、稳定度或领域负荷压力。");

    var baseSummary = sanitizeDisplayText(display?.shortEffect || template?.effectSummary || action?.description, "按当前手法规则结算。");
    preview.summary = sanitizeDisplayText(baseSummary, "效果会根据当前战斗状态结算。");
    return preview;
  }

  function addIndexedItem(index, key, value) {
    if (!key) return;
    index[key] ||= [];
    index[key].push(value);
  }

  function buildDuelCardTemplateIndexes(rulesOrCards) {
    var rules = Array.isArray(rulesOrCards) ? { cards: rulesOrCards } : (rulesOrCards || getDuelCardTemplateRules());
    var cards = Array.isArray(rules?.cards) ? rules.cards : [];
    var index = {
      schema: "jjk-battle-runtime-card-template-index",
      version: rules?.version || "",
      total: cards.length,
      cards: cards,
      cardById: Object.create(null),
      cardByActionId: Object.create(null),
      cardsByType: Object.create(null),
      cardsByTag: Object.create(null),
      cardsByContext: Object.create(null),
      cardsByCharacterHint: Object.create(null)
    };
    cards.forEach(function indexCard(card) {
      if (!card) return;
      if (card.cardId) index.cardById[card.cardId] = card;
      var actionId = card.actionId || card.actionId || "";
      if (actionId && card.playableInHandBeta !== false && !card.futureTemplate) {
        index.cardByActionId[actionId] = card;
      }
      addIndexedItem(index.cardsByType, card.cardType, card);
      (card.tags || []).forEach(function indexTag(tag) {
        addIndexedItem(index.cardsByTag, tag, card);
      });
      (card.contexts || []).forEach(function indexContext(context) {
        addIndexedItem(index.cardsByContext, context, card);
      });
      [].concat(card.characterHints || card.characterIds || []).forEach(function indexCharacter(characterHint) {
        addIndexedItem(index.cardsByCharacterHint, characterHint, card);
      });
    });
    return index;
  }

  function getCardTemplateRulesStamp(rules) {
    var activeRules = rules || getDuelCardTemplateRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.cards) ? activeRules.cards.length : 0
    ].join("|");
  }

  function getDuelCardTemplateIndex() {
    var rules = getDuelCardTemplateRules();
    var stamp = getCardTemplateRulesStamp(rules);
    if (!cardTemplateIndexCache || cardTemplateIndexCache.stamp !== stamp) {
      cardTemplateIndexCache = buildDuelCardTemplateIndexes(rules);
      cardTemplateIndexCache.stamp = stamp;
    }
    return cardTemplateIndexCache;
  }

  function warmDuelCardTemplateCache() {
    return getDuelCardTemplateIndex();
  }

  function invalidateDuelCardTemplateCache() {
    cardTemplateIndexCache = null;
    cardTemplateCacheStats.lastInvalidatedAt = new Date().toISOString();
  }

  function getDuelCardTemplateByActionId(actionId) {
    if (!actionId) return null;
    return getDuelCardTemplateIndex().cardByActionId[actionId] || null;
  }


  function getActionId(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    return actionOrCandidate?.actionId || actionOrCandidate?.id || actionOrCandidate?.cardId || action?.id || action?.cardId || "";
  }

  function toNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function roundPreviewNumber(value, digits) {
    return Number(toNumber(value, 0).toFixed(Number.isFinite(Number(digits)) ? Number(digits) : 2));
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function normalizeDuelRank(value, fallback) {
    var normalized = String(value || "").trim().toUpperCase();
    if (hasOwn(rankMultipliers, normalized)) return normalized;
    return fallback || "B";
  }

  function getDuelRankMultiplier(rank) {
    return rankMultipliers[normalizeDuelRank(rank, "B")] || 1;
  }

  function compressDuelPanelAttackMultiplier(value) {
    var raw = Math.max(0.01, Number(value || 1));
    if (!Number.isFinite(raw)) return 1;
    if (raw <= 1) return Math.max(0.55, Math.min(1, raw));
    return Math.max(1, Math.min(2.05, 1 + (Math.sqrt(raw) - 1) * 1.05));
  }

  function getDuelEfficiencyCostMultiplier(rankOrStats) {
    var rank = typeof rankOrStats === "object"
      ? rankOrStats?.ceEfficiency
      : rankOrStats;
    var canonical = globalThis.JJKBattleDataDirect?.getBattleEfficiencyCostMultiplier;
    if (typeof canonical === "function") {
      return canonical(
        { characterCardProfile: { baseStats: { efficiency: normalizeDuelRank(rank, "B") } } },
        { efficiencyCostPerRank: 0.08, efficiencyCostMin: 0.35, efficiencyCostMax: 1.55 }
      );
    }
    return efficiencyCostMultipliers[normalizeDuelRank(rank, "B")] || 1;
  }

  function getDuelRankScore(rank, fallbackRank) {
    return rankScores[normalizeDuelRank(rank, fallbackRank || "B")] ?? rankScores.B;
  }

  function scoreToDuelRank(score) {
    var value = toNumber(score, 4);
    if (value >= 11.1) return "EX";
    if (value >= 9.5) return "EX-";
    if (value >= 8.3) return "SSS";
    if (value >= 7.0) return "SS";
    if (value >= 5.8) return "S";
    if (value >= 4.7) return "A";
    if (value >= 3.3) return "B";
    if (value >= 2.3) return "C";
    if (value >= 1.3) return "D";
    if (value >= 0.7) return "E";
    return "E-";
  }

  function stepDuelRank(rank, steps) {
    var ladder = ["E-", "E", "D", "C", "B", "A", "S", "SS", "SSS", "EX-", "EX"];
    var current = ladder.indexOf(normalizeDuelRank(rank, "B"));
    if (current < 0) current = ladder.indexOf("B");
    return ladder[Math.max(0, Math.min(ladder.length - 1, current + Math.max(0, Number(steps) || 0)))];
  }

  function rankFromVisibleGrade(value) {
    var text = String(value || "").toLowerCase();
    if (/特级|special|ex/.test(text)) return "SS";
    if (/1|一级|grade\s*1|semi.?grade\s*1/.test(text)) return "A";
    if (/2|二级|grade\s*2/.test(text)) return "B";
    if (/3|三级|grade\s*3/.test(text)) return "C";
    if (/4|四级|grade\s*4/.test(text)) return "D";
    return "B";
  }

  function getDuelCharacterCombatStats(characterOrActor) {
    var source = characterOrActor?.characterCardProfile || characterOrActor?.profile || characterOrActor || {};
    var baseStats = source.baseStats || {};
    var raw = source.raw || {};
    var axes = source.axes || {};
    var text = [
      source.characterId,
      source.id,
      source.displayName,
      source.name,
      source.visibleGrade,
      source.officialGrade,
      source.notes,
      source.techniqueText,
      source.domainProfile,
      asArray(source.innateTraits).join(" "),
      asArray(source.advancedTechniques).join(" "),
      asArray(source.flags).join(" "),
      asArray(source.traits).join(" "),
      asArray(source.archetypes).join(" "),
      asArray(source.tags).join(" "),
      asArray(source.techniqueFamilies).join(" ")
    ].filter(Boolean).join(" ");
    var baseRank = rankFromVisibleGrade(source.visibleGrade || source.officialGrade || source.grade || "");
    var flags = new Set(asArray(source.flags));
    var antiDomainOnly = /简易领域|simple domain|弥虚葛笼|彌虚葛籠|落花之情|反领域/i.test(text) &&
      !/领域展开|生得领域|开放领域|顶级领域|顶尖领域|顶格领域|最高级领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦|domain expansion/i.test(text);
    var hasTrueDomainAccess = !flags.has("noDomain") && !antiDomainOnly && Boolean(source.hasDomainAccess || /领域展开|domain expansion|伏魔御厨子|无量空处|诛伏赐死|坐杀搏徒|自闭圆顿裹|真赝相爱|嵌合暗翳庭/i.test(text));
    var stats = {
      cePool: normalizeDuelRank(source.cePool || source.maxCeRank || source.cursedEnergy || baseStats.cursedEnergy || baseRank, baseRank),
      ceOutput: normalizeDuelRank(source.ceOutput || source.cursedEnergyOutput || source.output || baseStats.cursedEnergy || baseRank, baseRank),
      ceControl: normalizeDuelRank(source.ceControl || source.control || baseStats.control || baseRank, baseRank),
      ceEfficiency: normalizeDuelRank(source.ceEfficiency || source.efficiency || baseStats.efficiency || baseRank, baseRank),
      techniquePower: normalizeDuelRank(source.techniquePower || source.technique || baseRank, baseRank),
      physicalPower: normalizeDuelRank(source.physicalPower || source.body || source.physical || baseStats.body || baseRank, baseRank),
      speed: normalizeDuelRank(source.speed || source.mobility || baseStats.martial || baseRank, baseRank),
      weaponMastery: normalizeDuelRank(source.weaponMastery || source.cursedToolMastery || "C", "C"),
      domainSkill: normalizeDuelRank(source.domainSkill || source.domainRank || (hasTrueDomainAccess ? baseRank : "C"), hasTrueDomainAccess ? baseRank : "C"),
      isZeroCe: Boolean(source.isZeroCe || source.hasCe === false || /zero_ce|零咒力|physical_heavenly_restriction|天与咒缚[（(]?肉体强化型|天与暴君型|完全体天与/i.test(text)),
      hasCe: source.hasCe === undefined ? !/zero_ce|零咒力|physical_heavenly_restriction|天与咒缚[（(]?肉体强化型|天与暴君型|完全体天与/i.test(text) : Boolean(source.hasCe),
      hasInnateTechnique: source.hasInnateTechnique === undefined ? !/无术式|no_innate_technique|零咒力/i.test(text) : Boolean(source.hasInnateTechnique),
      hasDomainAccess: hasTrueDomainAccess,
      usesCursedTools: Boolean(source.usesCursedTools || /咒具|cursed_tool|释魂刀|天逆|游云|黑绳|万里锁/i.test(text))
    };
    if (/zero_ce|零咒力|physical_heavenly_restriction|天与咒缚[（(]?肉体强化型|天与暴君型|完全体天与/i.test(text)) {
      Object.assign(stats, { cePool: "E", ceOutput: "E", ceControl: "E", ceEfficiency: "E", techniquePower: "E", physicalPower: "SS", speed: "S", weaponMastery: "SS", domainSkill: "E", isZeroCe: true, hasCe: false, hasInnateTechnique: false, hasDomainAccess: false, usesCursedTools: true });
    }
    var cePoolScore = Number.isFinite(Number(raw.cursedEnergyScore)) ? Number(raw.cursedEnergyScore) : getDuelRankScore(stats.cePool);
    var ceControlScore = Number.isFinite(Number(raw.controlScore)) ? Number(raw.controlScore) : getDuelRankScore(stats.ceControl);
    var ceEfficiencyScore = Number.isFinite(Number(raw.efficiencyScore)) ? Number(raw.efficiencyScore) : getDuelRankScore(stats.ceEfficiency);
    var techniqueScore = getDuelRankScore(stats.techniquePower);
    var axisBoost = Math.max(0, toNumber(axes.jujutsu, cePoolScore) - cePoolScore) * 0.14;
    var specialBoost = 0;
    if (/石流|granite blast|最大出力|最大输出|純愛砲|纯爱炮|茈|虚式|world slash|世界斩/i.test(text)) specialBoost += 0.65;
    if (/六眼/i.test(text) && !/无下限|limitless|五条|gojo/i.test(text)) specialBoost += 0.12;
    var ceMaxOutputScore = Math.min(12, cePoolScore * 0.45 + ceControlScore * 0.25 + ceEfficiencyScore * 0.10 + techniqueScore * 0.20 + axisBoost + specialBoost);
    stats.ceMaxOutput = normalizeDuelRank(source.ceMaxOutput || source.maxCeOutput || scoreToDuelRank(ceMaxOutputScore), scoreToDuelRank(ceMaxOutputScore));
    return {
      characterId: source.characterId || source.id || "",
      displayName: source.displayName || source.name || "",
      ...stats,
      ceMaxOutputScore: roundPreviewNumber(ceMaxOutputScore, 2),
      multipliers: {
        cePool: getDuelRankMultiplier(stats.cePool),
        ceOutput: getDuelRankMultiplier(stats.ceOutput),
        ceMaxOutput: getDuelRankMultiplier(stats.ceMaxOutput),
        ceControl: getDuelRankMultiplier(stats.ceControl),
        ceEfficiency: getDuelRankMultiplier(stats.ceEfficiency),
        techniquePower: getDuelRankMultiplier(stats.techniquePower),
        physicalPower: getDuelRankMultiplier(stats.physicalPower),
        speed: getDuelRankMultiplier(stats.speed),
        weaponMastery: getDuelRankMultiplier(stats.weaponMastery),
        domainSkill: getDuelRankMultiplier(stats.domainSkill)
      },
      source: "combat-stat-profile-candidate"
    };
  }

  function getDuelCardScalingProfile(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var declared = action.scalingProfile || template?.scalingProfile || "";
    var tags = [].concat(action.tags || [], template?.tags || []).join(" ").toLowerCase();
    if (declared) {
      var normalized = normalizeScalingProfile(declared);
      if (normalized) return normalized;
    }
    if (action.requiresZeroCe || /zero_ce|零咒力|heavenly/.test(tags)) return "zero_ce";
    if (action.requiresCursedTool || /cursed_tool|咒具|tool/.test(tags)) return "cursed_tool";
    if (/domain|领域|barrier/.test(tags) || template?.cardType === "domain") return "domain";
    if (/trial|evidence|verdict|审判|证据|判决/.test(tags) || template?.cardType === "rule_trial") return "trial_rule";
    if (/jackpot|reach|probability|坐杀|中奖|演出/.test(tags) || template?.cardType === "jackpot") return "jackpot_rule";
    if (/反转术式|rct|reverse|healing|治疗|疗伤|正能量/.test(tags) || template?.cardType === "healing") return "healing";
    if (/defense|guard|防御|守势/.test(tags) || template?.cardType === "defense") return "defense";
    if (/physical|melee|strike|体术|近身|打击/.test(tags)) return "physical";
    if (/burst|爆发/.test(action.id || "")) return "ce_burst";
    if (/technique|术式|blue|red|limitless|slash|shrine/.test(tags + " " + (action.id || ""))) return "technique";
    return "balanced";
  }

  function normalizeScalingProfile(value) {
    var key = String(value || "").toLowerCase();
    if (!key) return "";
    if (["ce_burst", "burst", "output_burst"].includes(key)) return "ce_burst";
    if (["domain", "domain_pressure", "domain_sustain", "domain_control"].includes(key)) return "domain";
    if (["trial", "trial_rule", "rule_trial", "evidence"].includes(key)) return "trial_rule";
    if (["jackpot", "jackpot_rule", "probability"].includes(key)) return "jackpot_rule";
    if (["healing", "rct", "rct_healing", "reverse", "reverse_cursed_technique", "reverse_cursed_technique_heal"].includes(key)) return "healing";
    if (["zero_ce", "heavenly_restriction"].includes(key)) return "zero_ce";
    if (["cursed_tool", "tool"].includes(key)) return "cursed_tool";
    if (["guard", "defense", "shield", "block"].includes(key)) return "defense";
    if (["melee", "strike", "physical"].includes(key)) return "physical";
    if (["technique", "innate_technique"].includes(key)) return "technique";
    if (["balanced", "support", "resource"].includes(key)) return key;
    return key;
  }

  function calculateDuelCardBaseEffect(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var actionForPreview = action;
    var rawEffect = action.effect || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    if (isDirectSchemaBattleCard(action)) {
      var directEffect = action.effect;
      return {
        damage: toNumber(directEffect.damage, 0),
        block: toNumber(directEffect.block, 0),
        shield: toNumber(directEffect.shield, 0),
        ceDamage: toNumber(directEffect.ceDamage, 0),
        stabilityDamage: toNumber(directEffect.stabilityDamage, 0),
        domainLoad: toNumber(directEffect.domainLoad, 0),
        domainPressure: toNumber(directEffect.domainPressure, 0),
        healing: toNumber(directEffect.healing, 0),
        damageType: directEffect.damageType || null
      };
    }
    function pick(field) {
      return toNumber(action[field] ?? template?.[field], 0);
    }
    var damage = toNumber(action.effect?.damage ?? action.damage ?? template?.effect?.damage ?? template?.damage ?? action.damage ?? template?.damage, 0);
    if (shouldBoostTenShadowsDamageReference(actionOrCandidate, damage)) {
      damage = roundPreviewNumber(damage * tenShadowsDamageBalance.damageMultiplier + tenShadowsDamageBalance.damageFlat, 1);
    }
    return {
      damage: damage,
      block: toNumber(action.effect?.block ?? action.block ?? template?.effect?.block ?? template?.block ?? action.block ?? template?.block, 0),
      shield: pick("baseShield"),
      baseCePoolScale: pick("baseCePoolScale"),
      baseCeControlScale: pick("baseCeControlScale"),
      basePhysicalScale: pick("basePhysicalScale"),
      baseStabilityDamage: pick("baseStabilityDamage") || toNumber(actionForPreview.stabilityDamage ?? rawEffect.stabilityDamage, 0),
      baseStabilityRestore: pick("baseStabilityRestore"),
      baseCeDamage: pick("baseCeDamage") || toNumber(actionForPreview.ceDamage ?? rawEffect.ceDamage, 0),
      baseDomainPressure: pick("baseDomainPressure") || toNumber(actionForPreview.domainPressure ?? rawEffect.domainPressure, 0),
      baseDomainLoadDelta: pick("baseDomainLoadDelta") || toNumber(actionForPreview.domainLoadDelta ?? actionForPreview.domainLoad ?? rawEffect.domainLoad, 0),
      baseHealing: pick("baseHealing") || toNumber(actionForPreview.healing ?? rawEffect.healing, 0),
      baseEvidencePressure: pick("baseEvidencePressure"),
      baseDefensePressure: pick("baseDefensePressure"),
      baseJackpotGauge: pick("baseJackpotGauge"),
      durationRounds: pick("durationRounds"),
      damageType: action.effect?.damageType || action.damageType || template?.effect?.damageType || template?.damageType || "dynamic",
      scalingProfile: getDuelCardScalingProfile(actionOrCandidate)
    };
  }

  function getRiskCostMultiplier(risk) {
    return { low: 0.95, medium: 1, high: 1.08, critical: 1.18 }[String(risk || "medium")] || 1;
  }

  function isSpecialHandDamageCorrectionCard(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var specialHandTags = []
      .concat(asArray(action.specialHandTags))
      .concat(asArray(action.specialhandTag))
      .concat(asArray(action.specialHandTag))
      .concat(asArray(template?.specialHandTags))
      .concat(asArray(template?.specialhandTag))
      .concat(asArray(template?.specialHandTag));
    var text = [
      action.source,
      action.handSource,
      action.cardSource,
      action.poolType,
      action.cardType,
      template?.source,
      template?.handSource,
      template?.cardSource,
      template?.poolType,
      template?.cardType,
      asArray(action.tags).join(" "),
      asArray(template?.tags).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
    return Boolean(
      action.specialHandCard ||
      action.techniqueFeatureHand ||
      action.featureTechniqueHand ||
      action.aiSpecialHand ||
      action.customSpecialHand ||
      specialHandTags.length ||
      /duel-special-card|special_hand|specialhand|special-card|特色手札|特殊手札/.test(text)
    );
  }

  function isTenShadowsCard(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var text = [
      action.id,
      action.cardId,
      action.label,
      action.name,
      action.cardType,
      action.scalingProfile,
      template?.cardId,
      template?.name,
      template?.cardType,
      template?.scalingProfile
    ].concat(
      asArray(action.tags),
      asArray(action.specialHandTags),
      asArray(template?.tags),
      asArray(template?.specialHandTags)
    ).filter(Boolean).join(" ").toLowerCase();
    return /ten_shadows|十影|十种影|十種影|式神/.test(text);
  }

  function shouldBoostTenShadowsDamageReference(actionOrCandidate, damage) {
    if (!isTenShadowsCard(actionOrCandidate)) return false;
    if (!(Number(damage || 0) > 0)) return false;
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var id = String(action.id || action.cardId || template?.actionId || template?.cardId || "");
    var scaling = String(action.scalingProfile || template?.scalingProfile || "").toLowerCase();
    if (/^unit_/.test(id) || /mahoraga_(unattuned|tuned).*unit/.test(scaling)) return false;
    return true;
  }

  function isBlackBirdManipulationCard(action, template) {
    return asArray(action?.specialHandTags || template?.specialHandTags).includes("black_bird_manipulation") ||
      Boolean(action?.blackBirdSpec || template?.blackBirdSpec);
  }

  function getBlackBirdControlScale(action, template) {
    return Math.max(0, Math.min(1, toNumber(
      action?.blackBirdCeControlDamageScale ??
        template?.blackBirdCeControlDamageScale ??
        action?.blackBirdSpec?.controlScale ??
        template?.blackBirdSpec?.controlScale,
      0.18
    )));
  }

  function getScaledStarRagePreviewMultiplier(rawMultiplier, scale, cap) {
    var multiplier = Math.max(0.1, toNumber(rawMultiplier, 1));
    var normalizedScale = Math.max(0, toNumber(scale, 0));
    var maxMultiplier = Math.max(1, toNumber(cap, 1));
    if (!normalizedScale) return 1;
    return Math.min(maxMultiplier, 1 + (multiplier - 1) * normalizedScale);
  }

  function getDuelStandardValueScaleWeights(base) {
    var cePool = normalizeDuelBaseValueCoefficient(base?.baseCePoolScale);
    var ceControl = normalizeDuelBaseValueCoefficient(base?.baseCeControlScale);
    var physical = normalizeDuelBaseValueCoefficient(base?.basePhysicalScale);
    return {
      cePool: cePool !== null ? cePool : 0,
      ceControl: ceControl !== null ? ceControl : 0,
      physical: physical !== null ? physical : 0
    };
  }

  function normalizeDuelBaseValueCoefficient(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, numeric);
  }

  function pushDuelStandardValueFactor(factors, label, rawValue, weight, coefficientField) {
    var coefficient = Math.max(0, Number(weight || 0));
    if (!coefficient) return;
    var panelMultiplier = Number(rawValue);
    if (!Number.isFinite(panelMultiplier)) return;
    var multiplier = 1 + (panelMultiplier - 1) * coefficient;
    multiplier = Math.max(0.35, multiplier);
    if (!Number.isFinite(multiplier)) return;
    factors.push({
      label: label,
      value: roundPreviewNumber(panelMultiplier, 3),
      rawValue: roundPreviewNumber(rawValue, 3),
      coefficient: roundPreviewNumber(coefficient, 3),
      coefficientField: coefficientField,
      multiplier: roundPreviewNumber(multiplier, 3)
    });
  }

  function buildDuelStandardValueModifierBreakdown(base, stats, target) {
    var m = stats?.multipliers || {};
    var weights = getDuelStandardValueScaleWeights(base);
    var factors = [];
    pushDuelStandardValueFactor(factors, "角色咒力总量", compressDuelPanelAttackMultiplier(m.cePool), weights.cePool, "cePool");
    pushDuelStandardValueFactor(factors, "角色咒力操纵", compressDuelPanelAttackMultiplier(m.ceControl), weights.ceControl, "ceControl");
    pushDuelStandardValueFactor(factors, "角色体术", compressDuelPanelAttackMultiplier(m.physicalPower), weights.physical, "physicalPower");
    var totalMultiplier = factors.reduce(function multiply(total, factor) {
      return total * Number(factor.multiplier || 1);
    }, 1);
    return {
      factors: factors,
      totalMultiplier: roundPreviewNumber(totalMultiplier, 3),
      weights: {
        cePool: roundPreviewNumber(weights.cePool, 3),
        ceControl: roundPreviewNumber(weights.ceControl, 3),
        physical: roundPreviewNumber(weights.physical, 3)
      },
      source: "standardized-output-base-character-value-modifier"
    };
  }

  function calculateDuelStandardFinalValue(baseValue, base, stats, target) {
    if (!(baseValue > 0)) return 0;
    var breakdown = buildDuelStandardValueModifierBreakdown(base, stats, target);
    return roundPreviewNumber(baseValue * breakdown.totalMultiplier, 1);
  }

  function isZeroCeCostCard(actionOrCandidate, actorStats) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var text = [
      action.costType,
      template?.costType,
      action.scalingProfile,
      template?.scalingProfile,
      asArray(action.tags).join(" "),
      asArray(template?.tags).join(" ")
    ].join(" ").toLowerCase();
    return Boolean(action.requiresZeroCe || template?.requiresZeroCe || text.includes("zero_ce") || text.includes("零咒力"));
  }

  function calculateDuelCardCeCost(actionOrCandidate, characterOrActor) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    if (action.effect && action.cost && Array.isArray(action.contexts)) {
      var settlement = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
      var directCost = typeof settlement === "function"
        ? Number(settlement(action, characterOrActor || {}).cost?.ce || 0)
        : Math.max(0, toNumber(action.cost?.ce, 0));
      return { finalCost: directCost };
    }
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || actionOrCandidate?.actor || actionOrCandidate?.characterCardProfile || {});
    if (isZeroCeCostCard(actionOrCandidate, stats)) {
      return { baseCost: 0, finalCost: 0, efficiencyCostMultiplier: 1, costType: "zero_ce", source: "1.390A-zero-ce" };
    }
    var cost = action.cost || {};
    var rawBaseCost = action.cost?.ce ?? action.cost?.flatCe ?? template?.cost?.ce ?? template?.cost?.flatCe ?? action.costCe ?? action.ceCost;
    var baseCost = Number(rawBaseCost);
    if (!Number.isFinite(baseCost)) {
      baseCost = Math.max(
        toNumber(cost.flatCe, 0),
        toNumber(cost.minCe, 0),
        toNumber(characterOrActor?.maxCe, 0) * toNumber(cost.ceRatio, 0)
      );
    }
    var efficiency = getDuelEfficiencyCostMultiplier(stats.ceEfficiency);
    var risk = getRiskCostMultiplier(action.risk || template?.risk || "medium");
    var finalCost = baseCost <= 0 ? 0 : Math.max(1, Math.round(baseCost * efficiency * risk));
    return {
      baseCost: roundPreviewNumber(Math.max(0, baseCost), 1),
      finalCost: finalCost,
      efficiencyCostMultiplier: efficiency,
      riskCostMultiplier: risk,
      costType: action.costType || template?.costType || "ce",
      source: "1.390A-ce-efficiency"
    };
  }

  function calculateDuelStandardDamageFromCard(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    void options;
    return Math.round(calculateDuelStandardFinalValue(base.damage, base, stats, "damage"));
  }

  function isDirectSchemaBattleCard(action) {
    return Boolean(
      action &&
      action.effect &&
      action.cost &&
      Array.isArray(action.contexts) &&
      action.scaling &&
      typeof action.scaling === "object"
    );
  }

  function calculateDuelDamageFromCard(actionOrCandidate, characterOrActor, options) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var settlement = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
    if (isDirectSchemaBattleCard(action) && typeof settlement === "function") return Number(settlement(action, characterOrActor || {}).damage || 0);
    return calculateDuelStandardDamageFromCard(actionOrCandidate, characterOrActor || {}, options || {});
  }

  function pushDuelCardModifierFactor(factors, label, value, exponent, options) {
    var baseValue = Math.max(0.01, Number(value || 1));
    var power = Number(exponent ?? 1);
    var multiplier = Math.pow(baseValue, power);
    if (options?.minOne) multiplier = Math.pow(Math.max(1, Number(value || 1)), power);
    if (!Number.isFinite(multiplier) || Math.abs(multiplier - 1) < 0.005) return;
    factors.push({
      label: label,
      value: roundPreviewNumber(value, 3),
      exponent: roundPreviewNumber(power, 3),
      multiplier: roundPreviewNumber(multiplier, 3)
    });
  }

  function buildDuelCardValueModifierBreakdown(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var directAction = actionOrCandidate?.action || actionOrCandidate || {};
    if (isDirectSchemaBattleCard(directAction)) {
      var directValue = Math.max(base.damage, base.block, base.shield, base.domainPressure);
      var directSettlement = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
      var directFinal = directValue;
      if (typeof directSettlement === "function") {
        var settlement = directSettlement(directAction, characterOrActor || {});
        directFinal = Math.max(Number(settlement.damage || 0), Number(settlement.block || 0), Number(settlement.healing || 0), Number(settlement.domainPressure || 0));
      }
      return { target: "", baseValue: roundPreviewNumber(directValue, 1), finalValue: roundPreviewNumber(directFinal, 1), totalMultiplier: directValue > 0 ? roundPreviewNumber(directFinal / directValue, 3) : 0, factors: [], weights: {}, source: "direct-card" };
    }
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var target = "";
    var baseValue = 0;
    var finalValue = 0;
    if (base.damage > 0) {
      target = "伤害";
      baseValue = base.damage;
      finalValue = calculateDuelStandardDamageFromCard(actionOrCandidate, characterOrActor || {}, options || {});
    } else if (Math.max(base.block, base.shield) > 0) {
      target = "防御";
      baseValue = Math.max(base.block, base.shield);
      finalValue = calculateDuelBlockFromCard(actionOrCandidate, characterOrActor || {}, options || {});
    } else if (base.domainPressure > 0) {
      target = "领域";
      baseValue = base.domainPressure;
      finalValue = calculateDuelDomainPressureFromCard(actionOrCandidate, characterOrActor || {});
    }
    var standard = buildDuelStandardValueModifierBreakdown(base, stats, target || "value");
    var totalMultiplier = baseValue > 0 ? finalValue / baseValue : 0;
    return {
      target: target,
      baseValue: roundPreviewNumber(baseValue, 1),
      finalValue: roundPreviewNumber(finalValue, 1),
      totalMultiplier: roundPreviewNumber(totalMultiplier, 3),
      factors: standard.factors,
      weights: standard.weights,
      source: standard.source
    };
  }

  function calculateDuelBlockFromCard(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    if (isDirectSchemaBattleCard(action)) {
      var directSettlement = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
      if (typeof directSettlement === "function") {
        var settledDefense = directSettlement(action, characterOrActor || {});
        return Math.max(Number(settledDefense.block || 0), Number(settledDefense.shield || 0));
      }
      return Math.max(base.block, base.shield);
    }
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var raw = Math.max(base.block, base.shield);
    void options;
    return calculateDuelStandardFinalValue(raw, base, stats, "defense");
  }

  function calculateDuelHealingFromCard(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    if (!base.healing) return 0;
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    if (isDirectSchemaBattleCard(action)) {
      var directSettlement = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
      return typeof directSettlement === "function" ? Number(directSettlement(action, characterOrActor || {}).healing || 0) : base.healing;
    }
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    void options;
    return calculateDuelStandardFinalValue(base.healing, base, stats, "healing");
  }

  function calculateDuelDomainPressureFromCard(actionOrCandidate, characterOrActor) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    if (isDirectSchemaBattleCard(action)) {
      var directSettlement = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
      return typeof directSettlement === "function" ? Number(directSettlement(action, characterOrActor || {}).domainPressure || 0) : base.domainPressure;
    }
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    return calculateDuelStandardFinalValue(base.domainPressure, base, stats, "domain");
  }

  function calculateDuelCardFinalPreview(actionOrCandidate, characterOrActor, options) {
    var base = calculateDuelCardBaseEffect(actionOrCandidate);
    var directAction = actionOrCandidate?.action || actionOrCandidate || {};
    var isDirectCard = isDirectSchemaBattleCard(directAction);
    if (isDirectCard) {
      var directSettlementApi = globalThis.JJKBattleDataDirect?.calculateBattleCardSettlement;
      var directSettlement = typeof directSettlementApi === "function"
        ? directSettlementApi(directAction, characterOrActor || {}, options?.opponent || {}, {
            ...(options?.settlementOptions || {}),
            domainActionRuntime: directAction.directDomainActionRuntime || options?.settlementOptions?.domainActionRuntime || null
          })
        : null;
      return {
        base: base,
        cost: directSettlement?.cost ? { finalCost: Number(directSettlement.cost.ce || 0) } : calculateDuelCardCeCost(actionOrCandidate, characterOrActor || {}),
        finalDamage: directSettlement ? Number(directSettlement.damage || 0) : calculateDuelDamageFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
        finalBlock: directSettlement ? Math.max(Number(directSettlement.block || 0), Number(directSettlement.shield || 0)) : calculateDuelBlockFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
        finalHealing: directSettlement ? Number(directSettlement.healing || 0) : calculateDuelHealingFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
        finalDomainPressure: directSettlement ? Number(directSettlement.domainPressure || 0) : calculateDuelDomainPressureFromCard(actionOrCandidate, characterOrActor || {}),
        finalDomainLoad: directSettlement ? Number(directSettlement.domainLoad || 0) : Number(base.domainLoad || 0),
        domainActionLoadDelta: Number(directSettlement?.domainActionLoadDelta || directAction.directDomainActionRuntime?.domainLoadDelta || 0),
        settlement: directSettlement || undefined,
        previewOnly: true
      };
    }
    var stats = getDuelCharacterCombatStats(characterOrActor || {});
    var cost = calculateDuelCardCeCost(actionOrCandidate, characterOrActor || {});
    var valueModifierBreakdown = buildDuelCardValueModifierBreakdown(actionOrCandidate, characterOrActor || {}, options || {});
    return {
      base: base,
      stats: stats,
      cost: cost,
      valueModifierBreakdown: valueModifierBreakdown,
      finalDamage: calculateDuelDamageFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
      finalBlock: calculateDuelBlockFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
      finalHealing: calculateDuelHealingFromCard(actionOrCandidate, characterOrActor || {}, options || {}),
      finalDomainPressure: calculateDuelDomainPressureFromCard(actionOrCandidate, characterOrActor || {}),
      finalEvidencePressure: isDirectCard ? base.evidencePressure : roundPreviewNumber(base.evidencePressure * getDuelRankMultiplier(stats.techniquePower), 1),
      finalDefensePressure: isDirectCard ? base.baseDefensePressure : roundPreviewNumber(base.baseDefensePressure * getDuelRankMultiplier(stats.ceControl), 1),
      finalJackpotGauge: isDirectCard ? base.baseJackpotGauge : roundPreviewNumber(base.baseJackpotGauge * Math.max(getDuelRankMultiplier(stats.domainSkill), getDuelRankMultiplier(stats.ceEfficiency)), 1),
      previewOnly: true,
      source: isDirectCard ? "direct-card" : "1.390A-combat-preview"
    };
  }

  function formatDuelCoefficientPercent(value) {
    var numeric = Number(value || 0) * 100;
    return (numeric > 0 ? "+" : "") + formatPlainNumber(numeric) + "%";
  }

  function formatDuelReductionPercent(value) {
    var numeric = Number(value || 0) * 100;
    return numeric > 0 ? ("-" + formatPlainNumber(numeric) + "%") : "0%";
  }

  function buildDirectCardCoefficientPreview(action) {
    var scaling = action?.scaling;
    if (!scaling || typeof scaling !== "object") return [];
    var rows = [];
    var coreWeights = globalThis.JJKBattleDataDirect?.getBattleCardCoreWeights?.(action) || { martial: 0, technique: 0 };
    var coreLabel = coreWeights.martial > 0 && coreWeights.technique > 0
      ? "体术" + formatPlainNumber(coreWeights.martial * 100) + "% + 术式（咒力操控）" + formatPlainNumber(coreWeights.technique * 100) + "%"
      : coreWeights.martial > 0
        ? "体术100%"
        : coreWeights.technique > 0
          ? "术式（咒力操控）100%"
          : "无攻击核心";
    rows.push("伤害系数：基础×" + formatPlainNumber(scaling.baseDamageMultiplier) +
      "；核心乘区 " + coreLabel +
      "；体术每级" + formatDuelCoefficientPercent(scaling.martialDamagePerRank) +
      "，体质每级" + formatDuelCoefficientPercent(scaling.bodyDamagePerRank) +
      "，咒力操纵每级" + formatDuelCoefficientPercent(scaling.techniqueDamagePerRank) +
      "，咒力量每级" + formatDuelCoefficientPercent(scaling.cursedEnergyDamagePerRank) +
      "；天赋每级" + formatDuelCoefficientPercent(scaling.talentDamagePerRank) +
      "；咒力高于 " + formatPlainNumber(Number(scaling.highCeThreshold || 0) * 100) + "% 时×" + formatPlainNumber(scaling.highCeDamageMultiplier) + "。");
    rows.push("命中系数：操控基准×" + formatPlainNumber(scaling.controlAccuracyBase) +
      "；操控每级" + formatDuelCoefficientPercent(scaling.controlAccuracyPerRank) +
      "；对手体术每级" + formatDuelReductionPercent(scaling.martialEvasionPerRank) +
      "；最终范围 " + formatPlainNumber(scaling.accuracyMin) + "～" + formatPlainNumber(scaling.accuracyMax) + "。");
    var defensePenetration = Math.max(0, Math.min(0.9, Math.max(
      Number(action?.effect?.special?.blockIgnoreRatio || 0),
      Number(action?.blockIgnoreRatio || 0),
      String(scaling.source || "") === "穿透攻击" ? 0.25 : 0
    )));
    if (String(scaling.source || "") === "穿透攻击" && defensePenetration > 0) {
      rows.push("攻击类型：穿透攻击；体质抗性与单位格挡穿透：" + formatPlainNumber(defensePenetration * 100) + "%（仅保留20%防御效果）。");
    }
    var effectiveEfficiencyRate = globalThis.JJKBattleDataDirect?.getBattleEfficiencyCostPerPoint?.(scaling) ??
      Math.max(0.08, Number(scaling.efficiencyCostPerRank || 0));
    var effectiveEfficiencyMin = Math.min(0.35, Number(scaling.efficiencyCostMin ?? 0.35));
    var effectiveEfficiencyMax = Math.max(1.55, Number(scaling.efficiencyCostMax ?? 1.55));
    rows.push("消耗与回复系数：效率每真实数值点" + formatDuelReductionPercent(effectiveEfficiencyRate) +
      " 消耗（B=4 为标准）；消耗倍率范围 " + formatPlainNumber(effectiveEfficiencyMin) + "～" + formatPlainNumber(effectiveEfficiencyMax) +
      "；回复每级" + formatDuelCoefficientPercent(scaling.efficiencyRecoveryPerRank) + "。");
    rows.push("防御系数：基础体质抗性 " + formatPlainNumber(Number(scaling.bodyResistanceBase || 0) * 100) +
      "%；体质每级" + formatDuelCoefficientPercent(scaling.bodyResistancePerRank) +
      "；抗性范围 " + formatPlainNumber(Number(scaling.bodyResistanceMin || 0) * 100) + "%～" + formatPlainNumber(Number(scaling.bodyResistanceMax || 0) * 100) +
      "%；天赋每级格挡" + formatDuelCoefficientPercent(scaling.talentBlockPerRank) +
      "；天赋每级治疗" + formatDuelCoefficientPercent(scaling.talentHealingPerRank) + "。");
    rows.push("衍生效果系数：咒力伤害×" + formatPlainNumber(scaling.ceDamageMultiplier) +
      "，操控每级" + formatDuelCoefficientPercent(scaling.ceDamageControlPerRank) +
      "；稳定伤害×" + formatPlainNumber(scaling.stabilityDamageMultiplier) +
      "，操控每级" + formatDuelCoefficientPercent(scaling.stabilityDamageControlPerRank) +
      "；领域负荷×" + formatPlainNumber(scaling.domainLoadMultiplier) +
      "，效率每级" + formatDuelReductionPercent(scaling.domainLoadEfficiencyPerRank) +
      "；领域压力×" + formatPlainNumber(scaling.domainPressureMultiplier) +
      "，操控每级" + formatDuelCoefficientPercent(scaling.domainPressureControlPerRank) + "。");
    return rows;
  }

  function buildDuelCardNumericPreview(actionOrCandidate, characterOrActor, options) {
    var actionForPreview = actionOrCandidate?.action || actionOrCandidate || {};
    var rawEffect = actionForPreview.effect || actionForPreview.effects || {};
    var preview = calculateDuelCardFinalPreview(actionOrCandidate, characterOrActor || {}, options || {});
    var lines = [];
    if (Array.isArray(actionForPreview?.bloodRuntime?.previewLines)) {
      actionForPreview.bloodRuntime.previewLines.forEach(function addBloodRuntimeLine(line) {
        if (isReadablePreviewText(line)) lines.push(line);
      });
    }
    var base = preview.base;
    var summonEntryDamageDisabled = Boolean(
      actionForPreview.summonEntryDamageDisabled ||
      actionForPreview.summonSpec?.entryDamageDisabled
    );
    // 纯召唤牌的 effect.damage 用来初始化召唤物攻击力，不是入场即时伤害。
    // 数值预览只在下方的“召唤单位”行展示它，避免向玩家承诺并不存在的直伤。
    if (base.damage && !summonEntryDamageDisabled) lines.push("基础伤害：" + formatPlainNumber(base.damage) + "，最终预估：" + formatPlainNumber(preview.finalDamage) + "。");
    if (base.block || base.shield) lines.push("基础防御：" + formatPlainNumber(Math.max(base.block, base.shield)) + "，最终防御：" + formatPlainNumber(preview.finalBlock) + "。");
    if (base.healing) lines.push("基础治疗：" + formatPlainNumber(base.healing) + "，最终恢复：" + formatPlainNumber(preview.finalHealing) + "。");
    if (base.domainPressure) lines.push("基础领域压制：" + formatPlainNumber(base.domainPressure) + "，最终领域压制：" + formatPlainNumber(preview.finalDomainPressure) + "。");
    if (preview.stats === undefined) {
      if (Number(base.domainLoad || 0) || Number(preview.domainActionLoadDelta || 0) || Number(preview.finalDomainLoad || 0)) {
        var domainActionLoadLabel = Number(preview.domainActionLoadDelta || 0)
          ? "，领域动作 " + (Number(preview.domainActionLoadDelta) > 0 ? "+" : "") + formatPlainNumber(preview.domainActionLoadDelta)
          : "";
        lines.push("领域负荷：牌面 " + (Number(base.domainLoad || 0) > 0 ? "+" : "") + formatPlainNumber(base.domainLoad || 0) + domainActionLoadLabel + "，系数结算后净变化 " + (Number(preview.finalDomainLoad || 0) > 0 ? "+" : "") + formatPlainNumber(preview.finalDomainLoad || 0) + "。");
      }
      lines.push("咒力消耗：" + formatPlainNumber(preview.cost.finalCost) + "。");
      buildDirectCardCoefficientPreview(actionForPreview).forEach(function addCoefficientLine(line) {
        lines.push(line);
      });
      return Object.assign({}, preview, { lines: cleanPreviewLines(lines) });
    }
    if (base.evidencePressure) lines.push("证据压力：" + formatPlainNumber(base.evidencePressure) + " → " + formatPlainNumber(preview.finalEvidencePressure) + "。");
    if (base.baseJackpotGauge) lines.push("jackpot 期待度：" + formatPlainNumber(base.baseJackpotGauge) + " → " + formatPlainNumber(preview.finalJackpotGauge) + "。");
    if (base.baseStabilityDamage) lines.push("稳定冲击：" + formatPlainNumber(base.baseStabilityDamage) + "。");
    if (base.baseStabilityRestore) lines.push("稳定恢复：" + formatPlainNumber(base.baseStabilityRestore) + "。");
    if (base.baseDomainLoadDelta) lines.push("领域负荷变化：" + (base.baseDomainLoadDelta > 0 ? "+" : "") + formatPlainNumber(base.baseDomainLoadDelta) + "。");
    if (preview.valueModifierBreakdown?.factors?.length) {
      lines.push("修正倍率：" + preview.valueModifierBreakdown.factors.map(function formatFactor(factor) {
        if (factor.coefficient !== undefined) {
          return factor.label + "×" + (factor.coefficientField || "系数") + "(" + formatPlainNumber(factor.value) + "×" + formatPlainNumber(factor.coefficient) + ")=×" + formatPlainNumber(factor.multiplier);
        }
        return factor.label + "×" + formatPlainNumber(factor.multiplier);
      }).join(" × ") + " = 总倍率×" + formatPlainNumber(preview.valueModifierBreakdown.totalMultiplier) + "。");
    }
    lines.push("基础咒力消耗：" + formatPlainNumber(preview.cost.baseCost) + "，效率修正后：" + formatPlainNumber(preview.cost.finalCost) + "。");
    lines.push("属性修正：" + [
      "咒力总量 " + preview.stats.cePool,
      "咒力操控 " + preview.stats.ceControl,
      "体术 " + preview.stats.physicalPower
    ].join(" / ") + "。");
    return { ...preview, lines: cleanPreviewLines(lines) };
  }

  function inferCardType(action) {
    var id = action?.id || "";
    if (action?.type === "activity_tactic" || action?.cardType === "activity_tactic") return "activity_tactic";
    if (action?.domainSpecific) {
      if (["defend", "remain_silent", "deny_charge", "challenge_evidence", "delay_trial"].includes(id)) return "rule_defense";
      if (["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict"].includes(id)) return "rule_trial";
      if (["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot"].includes(id)) return "jackpot";
      return "special";
    }
    if (id === "domain_expand") return "domain";
    if (["domain_compress", "domain_force_sustain", "domain_release"].includes(id)) return "domain_maintenance";
    if (id.includes("domain") || id.includes("basket") || id.includes("blossom") || id.includes("bypass")) return "domain_response";
    if (id === "defensive_frame") return "defense";
    if (id === "ce_compression") return "resource";
    if (id === "residue_reading") return "support";
    if (id.includes("technique") || id.includes("forced")) return "technique";
    return "basic";
  }

  function inferRarity(action, cardType) {
    if (["domain", "domain_maintenance", "domain_response"].includes(cardType)) return "domain";
    if (["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return "rule";
    if (action?.risk === "critical") return "special";
    if (action?.risk === "high") return "rare";
    if (action?.risk === "medium") return "uncommon";
    return "common";
  }

  function inferTags(action, cardType) {
    var tags = cardType === "activity_tactic" && Array.isArray(action?.tags) ? action.tags.slice() : [];
    if (cardType.includes("domain")) tags.push("领域");
    if (cardType.includes("rule")) tags.push("审判");
    if (cardType === "jackpot") tags.push("坐杀搏徒");
    if (cardType === "resource") tags.push("咒力");
    if (cardType === "defense") tags.push("防御");
    if (cardType === "technique") tags.push("术式");
    if (action?.risk) tags.push(action.risk);
    return Array.from(new Set(tags.filter(Boolean)));
  }

  function normalizeDuelCardTemplate(template, action) {
    var activeAction = action || {};
    var actionId = template?.actionId || template?.actionId || activeAction.id || "";
    var cardType = template?.cardType || inferCardType(activeAction);
    var rarity = template?.rarity || inferRarity(activeAction, cardType);
    return {
      cardId: template?.cardId || ("card_" + actionId),
      actionId: actionId,
      name: template?.name || activeAction.label || actionId || "未命名卡牌",
      cardType: cardType,
      apCost: Number(template?.apCost || activeAction.apCost || 1),
      ceCostMode: template?.ceCostMode || "from_action",
      tags: Array.isArray(template?.tags) && template.tags.length ? template.tags.slice() : inferTags(activeAction, cardType),
      rarity: rarity,
      weight: Number(template?.weight ?? activeAction.weight ?? 1),
      contexts: Array.isArray(template?.contexts) ? template.contexts.slice() : (Array.isArray(template?.contexts) ? template.contexts.slice() : ["normal"]),
      effectSummary: template?.effectSummary || activeAction.description || activeAction.summary || "沿用既有手法效果。",
      risk: template?.risk || activeAction.risk || "medium",
      status: template?.status || "CANDIDATE"
    };
  }

  function getDuelCardTemplateForAction(actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var actionId = getActionId(actionOrCandidate);
    var template = getDuelCardTemplateByActionId(actionId) ||
      getDuelCardTemplateByActionId(action?.id);
    return normalizeDuelCardTemplate(template, action || { id: actionId });
  }

  function getDuelCardTypeLabel(cardType) {
    var rules = getDuelCardTemplateRules();
    return rules?.cardTypeLabels?.[cardType] || defaultTypeLabels[cardType] || cardType || "未知";
  }

  function getDuelCardRarityLabel(rarity) {
    var rules = getDuelCardTemplateRules();
    return rules?.rarityLabels?.[rarity] || defaultRarityLabels[rarity] || rarity || "common";
  }

  function isReadablePreviewText(value) {
    if (typeof value !== "string") return false;
    var text = value.trim();
    return Boolean(text) && !/(undefined|null|TODO|NaN)/i.test(text);
  }

  function cleanPreviewLines(lines) {
    return Array.from(new Set((lines || []).filter(isReadablePreviewText)));
  }

  function readFiniteNumber(sources, key) {
    for (var index = 0; index < sources.length; index += 1) {
      var source = sources[index];
      if (!source || !hasOwn(source, key)) continue;
      var value = Number(source[key]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }

  function formatSignedNumber(value) {
    var rounded = Number(value.toFixed(4));
    return (rounded > 0 ? "+" : "") + String(rounded);
  }

  function formatScaleNumber(value) {
    return Number(value.toFixed(2)).toString();
  }

  function pushKnownNumericPreview(preview, field, value) {
    if (!Number.isFinite(value)) return;
    if (field === "outgoingScale" && value !== 1) {
      preview.riskPreview.push("输出倍率：" + formatScalePercent(value));
      return;
    }
    if (field === "incomingHpScale" && value !== 1) {
      preview.statusPreview.push("受到体势伤害：" + formatScalePercent(value));
      return;
    }
    if (field === "evasionBonus" && value !== 0) {
      preview.statusPreview.push("闪避：" + formatSignedPercent(value));
      return;
    }
    if (field === "selfHpCostRatio" && value > 0) {
      preview.resourcePreview.push("体势代价：最大体势 " + formatSignedPercent(value).replace(/^\+/, ""));
      return;
    }
    if (field === "selfHpCostFlat" && value > 0) {
      preview.resourcePreview.push("体势代价 " + formatSignedNumber(value).replace(/^\+/, ""));
      return;
    }
    if (field === "stabilityDelta" && value !== 0) {
      preview.statusPreview.push("稳定度：" + formatSignedPercent(value));
      return;
    }
    if (field === "domainLoadDelta" && value !== 0) {
      preview.resourcePreview.push("己方领域负荷 " + formatSignedNumber(value));
      return;
    }
    if (field === "ceCost" && value > 0) {
      preview.resourcePreview.push("消耗咒力 " + formatSignedNumber(value).replace(/^\+/, ""));
      return;
    }
    if (field === "hpDamage" && value !== 0) {
      preview.riskPreview.push("预计体势伤害 " + formatSignedNumber(value).replace(/^\+/, ""));
      return;
    }
    if (field === "durationRounds" && value > 0) {
      preview.statusPreview.push("持续 " + formatSignedNumber(value).replace(/^\+/, "") + " 回合");
    }
  }

  function isBloodManipulationCardAction(action, template, display) {
    var text = [
      action?.id,
      action?.actionId,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      template?.cardId,
      template?.name,
      template?.effectSummary,
      display?.displayName,
      display?.shortEffect
    ].concat(
      [].concat(action?.tags || []),
      [].concat(action?.specialHandTags || []),
      [].concat(template?.tags || []),
      [].concat(template?.specialHandTags || [])
    ).filter(Boolean).join(" ");
    return /blood_manipulation|赤血操术|穿血|血刃|百敛|超新星|赤鳞跃动|胀相|脹相|加茂宪纪|加茂憲紀/i.test(text);
  }

  function isProjectionSorceryCardAction(action, template, display) {
    var text = [
      action?.id,
      action?.actionId,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      template?.cardId,
      template?.name,
      template?.effectSummary,
      display?.displayName,
      display?.shortEffect
    ].concat(
      [].concat(action?.tags || []),
      [].concat(action?.specialHandTags || []),
      [].concat(template?.tags || []),
      [].concat(template?.specialHandTags || [])
    ).filter(Boolean).join(" ");
    return /projection_sorcery|投射术式|投射咒法|二十四帧|帧内闪击|破帧刹那/i.test(text);
  }

  function isZeroCeHeavenlyRestrictionCardAction(action, template, display) {
    var text = [
      action?.id,
      action?.actionId,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      action?.scalingProfile,
      template?.cardId,
      template?.name,
      template?.effectSummary,
      template?.scalingProfile,
      display?.displayName,
      display?.shortEffect
    ].concat(
      [].concat(action?.tags || []),
      [].concat(action?.specialHandTags || []),
      [].concat(template?.tags || []),
      [].concat(template?.specialHandTags || [])
    ).filter(Boolean).join(" ");
    return /zero_ce_heavenly_restriction|零咒力|physical_heavenly_restriction|天与咒缚[（(]?肉体强化型|天与暴君型|完全体天与/i.test(text) ||
      Boolean(action?.requiresZeroCe || template?.requiresZeroCe);
  }

  function formatBloodCostPercent(ratio) {
    var numeric = Number(ratio || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return "0%";
    var percent = numeric * 100;
    var rounded = Math.abs(percent - Math.round(percent)) < 0.01 ? Math.round(percent) : Number(percent.toFixed(1));
    return String(rounded) + "%";
  }

  function getBloodManipulationCostRatios(action) {
    var conversion = action?.bloodConversion || "";
    var ceDefault = conversion === "hp_to_ce" ? 0 : 0.08;
    var hpDefault = conversion === "ce_to_hp" ? 0 : 0.055;
    return {
      ceRatio: Number(action?.bloodCeCostRatio ?? ceDefault) || 0,
      hpRatio: Number(action?.bloodHpCostRatio ?? hpDefault) || 0
    };
  }

  function appendBloodManipulationCostCopy(text, action, template, display) {
    var base = sanitizeDisplayText(text, "");
    if (!isBloodManipulationCardAction(action, template, display)) return base;
    // v2 赤血卡的卡面已明确列出资源门槛、生成/消费及失血折算；
    // 再追加旧版“系数实时结算”管线会制造重复且互相矛盾的说明。
    if (action?.bloodResource || action?.bloodRuntime?.resourceModelVersion === "blood-core-v2") return base;
    if (/消耗(?:咒力|当前体势)\s*\d+(?:\.\d+)?%.*(?:实际扣除|转化|当前体势|体势上限|咒力上限)/.test(base)) return base;
    var ratios = getBloodManipulationCostRatios(action);
    var copy;
    if (action?.bloodConversion === "ce_to_hp") {
      copy = "消耗咒力 " + formatBloodCostPercent(ratios.ceRatio) + "，按实际消耗咒力转化体势；体势可超过上限。";
    } else if (action?.bloodConversion === "hp_to_ce") {
      copy = "消耗当前体势 " + formatBloodCostPercent(ratios.hpRatio) + "，按实际消耗体势转化咒力；咒力可超过上限。";
    } else {
      copy = "消耗咒力 " + formatBloodCostPercent(ratios.ceRatio) + "、当前体势 " + formatBloodCostPercent(ratios.hpRatio) + "；伤害按实际扣除数值实时结算。";
    }
    return base ? base.replace(/[。；;,\s]*$/, "。") + copy : copy;
  }

  function buildEffectPreview(actionOrCandidate, template, baseView, display, availabilityMessage) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var richPreview = buildDuelCardEffectPreview(actionOrCandidate, template, display, baseView);
    var numericPreview = buildDuelCardNumericPreview(
      actionOrCandidate,
      baseView?.actor || baseView?.characterCardProfile || actionOrCandidate?.characterCardProfile || {}
    );
    var preview = {
      resourcePreview: cleanPreviewLines(richPreview.resourceLines || []),
      statusPreview: cleanPreviewLines([].concat(richPreview.combatLines || []).concat(richPreview.statusLines || [])),
      riskPreview: cleanPreviewLines(richPreview.riskLines || []),
      conditionPreview: cleanPreviewLines(richPreview.conditionLines || []),
      debugFields: []
    };
    if (isReadablePreviewText(availabilityMessage) && availabilityMessage !== "可用") {
      preview.conditionPreview = cleanPreviewLines(preview.conditionPreview.concat([availabilityMessage]));
    }
    var resolvedEffectLines = cleanPreviewLines([]
      .concat(preview.resourcePreview)
      .concat(preview.statusPreview)
      .concat(preview.riskPreview)
      .concat(preview.conditionPreview));
    var summary = richPreview.summary || display?.shortEffect || template?.effectSummary || action?.description || resolvedEffectLines[0] || "沿用既有手法效果。";
    summary = appendBloodManipulationCostCopy(summary, action, template, display);
    if (!isReadablePreviewText(summary)) summary = "沿用既有手法效果。";
    preview.debugFields = cleanPreviewLines([
      template?.cardId ? "cardId:" + template.cardId : "",
      template?.actionId || template?.actionId || action?.id ? "actionId:" + (template?.actionId || template?.actionId || action?.id) : "",
      action?.id ? "actionId:" + action.id : ""
    ]);
    return {
      schema: "jjk-battle-runtime-effect-preview",
      version: "1.392-public-template-tactics",
      summary: summary,
      lines: resolvedEffectLines,
      resolvedEffectLines: resolvedEffectLines,
      combatPreview: cleanPreviewLines(richPreview.combatLines || []),
      resourcePreview: preview.resourcePreview,
      statusPreview: preview.statusPreview,
      statusChanges: cleanPreviewLines(richPreview.statusLines || []),
      riskPreview: preview.riskPreview,
      conditionPreview: preview.conditionPreview,
      debugFields: preview.debugFields,
      numericPreview: numericPreview
    };
  }

  function buildDuelCardViewModel(actionOrCandidate, baseView) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var template = getDuelCardTemplateForAction(actionOrCandidate);
    var copy = getDuelCardCopyForAction(actionOrCandidate, template);
    var display = mergeDuelCardTemplateWithCopy(actionOrCandidate, template, copy);
    var tags = Array.from(new Set([].concat(template.tags || [], baseView?.tags || []).filter(Boolean)));
    var uiTags = normalizeDisplayTags(display.uiTags, tags);
    var displayName = display.displayName || template.name;
    var shortEffect = display.shortEffect || template.effectSummary;
    shortEffect = appendBloodManipulationCostCopy(shortEffect, action, template, display);
    var availabilityMessage = getDuelCardAvailabilityMessage(
      baseView?.unavailableReason || baseView?.reason || "",
      Boolean(baseView?.available),
      Boolean(baseView?.selected)
    );
    var effectPreview = buildEffectPreview(actionOrCandidate, template, baseView, display, availabilityMessage);
    var finalPreview = effectPreview.numericPreview || buildDuelCardNumericPreview(actionOrCandidate, baseView?.actor || baseView?.characterCardProfile || {});
    return {
      ...template,
      id: baseView?.id || action?.id || template.actionId || template.cardId,
      actionId: baseView?.actionId || action?.id || template.actionId || template.cardId,
      label: displayName,
      name: template.name,
      displayName: displayName,
      subtitle: display.subtitle || "",
      apCost: Number(baseView?.apCost ?? template.apCost ?? 1),
      ceCost: Number(baseView?.ceCost ?? baseView?.costCe ?? 0),
      effectText: shortEffect,
      shortEffect: shortEffect,
      longEffect: display.longEffect || shortEffect,
      flavorLine: display.flavorLine || "",
      risk: baseView?.risk || template.risk,
      riskLabel: getDuelCardRiskLabel(baseView?.risk || template.risk),
      tags: tags,
      uiTags: uiTags,
      cardTypeLabel: getDuelCardTypeDisplayLabel(template.cardType),
      rarityLabel: getDuelCardRarityLabel(template.rarity),
      status: template.status || baseView?.status || "CANDIDATE",
      availabilityMessage: availabilityMessage,
      copyStatus: display.copyStatus || "CANDIDATE",
      effectPreview: effectPreview,
      numericPreview: finalPreview,
      finalPreview: finalPreview,
      previewCeCost: finalPreview.cost,
      scalingProfile: finalPreview.base?.scalingProfile || getDuelCardScalingProfile(actionOrCandidate),
      resolvedEffectLines: effectPreview.resolvedEffectLines,
      resourcePreview: effectPreview.resourcePreview,
      statusPreview: effectPreview.statusPreview,
      riskPreview: effectPreview.riskPreview,
      conditionPreview: effectPreview.conditionPreview,
      debugFields: effectPreview.debugFields,
      source: "card-template"
    };
  }

  function buildDuelCardDisplayModel(actionOrCandidate, baseView) {
    return buildDuelCardViewModel(actionOrCandidate, baseView);
  }

  function getDuelCardTemplateForActionStrict(actionOrCandidate, options) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var actionId = getActionId(actionOrCandidate);
    var cards = Array.isArray(options?.cards) ? options.cards : null;
    var template = cards
      ? cards.find(function findCard(item) {
        return item?.actionId === actionId || item?.actionId === actionId || item?.actionId === action?.id || item?.actionId === action?.id;
      })
      : (getDuelCardTemplateByActionId(actionId) || getDuelCardTemplateByActionId(action?.id));
    if (!template) {
      return {
        found: false,
        reason: "missing_card_template",
        actionId: actionId || action?.id || "",
        template: null
      };
    }
    return {
      found: true,
      reason: "",
      actionId: template.actionId || actionId || action?.id || "",
      template: normalizeDuelCardTemplate(template, action || { id: actionId })
    };
  }

  function validateDuelCardTemplateSchema(cardRulesOrCards, options) {
    var cards = Array.isArray(cardRulesOrCards)
      ? cardRulesOrCards
      : (Array.isArray(cardRulesOrCards?.cards) ? cardRulesOrCards.cards : getDuelCardTemplates());
    var requiredFields = Array.isArray(options?.requiredFields) ? options.requiredFields : requiredTemplateFields;
    var forbiddenFields = Array.isArray(options?.forbiddenFields) ? options.forbiddenFields : forbiddenEffectFields;
    var missingFields = [];
    var forbiddenFieldHits = [];
    var statusIssues = [];
    cards.forEach(function validateCard(card, index) {
      requiredFields.forEach(function checkField(field) {
        if (!hasRequiredCardField(card, field)) {
          missingFields.push({
            cardId: card?.cardId || "",
            actionId: card?.actionId || card?.actionId || "",
            index: index,
            field: field
          });
        }
      });
      forbiddenFields.forEach(function checkForbidden(field) {
        if (hasOwn(card || {}, field)) {
          forbiddenFieldHits.push({
            cardId: card?.cardId || "",
            actionId: card?.actionId || card?.actionId || "",
            index: index,
            field: field
          });
        }
      });
      if (!allowedTemplateStatuses.includes(card?.status)) {
        statusIssues.push({
          cardId: card?.cardId || "",
          actionId: card?.actionId || card?.actionId || "",
          index: index,
          status: card?.status || ""
        });
      }
    });
    return {
      ok: missingFields.length === 0 && forbiddenFieldHits.length === 0 && statusIssues.length === 0,
      totalCards: cards.length,
      requiredFields: requiredFields.slice(),
      forbiddenFields: forbiddenFields.slice(),
      missingFields: missingFields,
      forbiddenFieldHits: forbiddenFieldHits,
      statusIssues: statusIssues
    };
  }

  function getDuelCardTemplateCoverage(options) {
    var cards = Array.isArray(options?.cards) ? options.cards : getDuelCardTemplates();
    var playableCards = cards.filter(function keepPlayable(card) {
      return card?.futureTemplate !== true && card?.playableInHandBeta !== false;
    });
    var sourceActions = collectDuelCardAuditActions(options);
    var actionIds = new Set(sourceActions.map(function getId(action) { return action.id; }).filter(Boolean));
    var cardActionIds = playableCards.map(function getAction(card) { return card?.actionId || card?.actionId || ""; }).filter(Boolean);
    var cardIdDuplicates = findDuplicateValues(cards.map(function getCardId(card) { return card?.cardId || ""; }).filter(Boolean));
    var actionIdDuplicates = findDuplicateValues(cardActionIds);
    var missingCardTemplates = sourceActions
      .filter(function missingAction(action) { return !cardActionIds.includes(action.id); })
      .map(compactAuditAction);
    var orphanCardTemplates = playableCards
      .filter(function orphanCard(card) { var id = card?.actionId || card?.actionId || ""; return id && !actionIds.has(id); })
      .map(function mapOrphan(card) {
        return {
          cardId: card.cardId || "",
          actionId: card.actionId || card.actionId || "",
          name: card.name || ""
        };
      });
    var matchedActionIds = cardActionIds.filter(function isMatched(id) { return actionIds.has(id); });
    return {
      actionTemplateTotal: sourceActions.length,
      cardTemplateTotal: cards.length,
      matchedActionIdCount: matchedActionIds.length,
      matchedActionIds: matchedActionIds,
      missingCardTemplates: missingCardTemplates,
      orphanCardTemplates: orphanCardTemplates,
      duplicateCardIds: cardIdDuplicates,
      duplicateActionIds: actionIdDuplicates,
      sourceActions: sourceActions.map(compactAuditAction),
      ok: missingCardTemplates.length === 0 &&
        orphanCardTemplates.length === 0 &&
        cardIdDuplicates.length === 0 &&
        actionIdDuplicates.length === 0
    };
  }

  function getDuelCardTemplateFallbackStats(actionsOrOptions, maybeOptions) {
    var options = Array.isArray(actionsOrOptions)
      ? { ...(maybeOptions || {}), actions: actionsOrOptions }
      : (actionsOrOptions || {});
    var actions = Array.isArray(options.actions) ? options.actions : collectDuelCardAuditActions(options);
    var threshold = Number.isFinite(Number(options.maxFallbackRatio)) ? Number(options.maxFallbackRatio) : 0.05;
    var fallbackActionIds = [];
    actions.forEach(function checkAction(action) {
      var strict = getDuelCardTemplateForActionStrict(action, options);
      if (!strict.found) fallbackActionIds.push(action?.id || "");
    });
    var totalActions = actions.length;
    var fallbackCount = fallbackActionIds.filter(Boolean).length;
    var fallbackRatio = totalActions ? Number((fallbackCount / totalActions).toFixed(4)) : 0;
    return {
      totalActions: totalActions,
      explicitTemplateCount: Math.max(0, totalActions - fallbackCount),
      fallbackCount: fallbackCount,
      fallbackRatio: fallbackRatio,
      fallbackActionIds: fallbackActionIds.filter(Boolean),
      maxFallbackRatio: threshold,
      overThreshold: fallbackRatio > threshold
    };
  }

  function auditDuelCardTemplateDrift(options) {
    var cardRules = options?.cardRules || getDuelCardTemplateRules();
    var cards = Array.isArray(options?.cards) ? options.cards : (Array.isArray(cardRules?.cards) ? cardRules.cards : getDuelCardTemplates());
    var auditOptions = { ...(options || {}), cards: cards };
    var schema = validateDuelCardTemplateSchema(cards, auditOptions);
    var coverage = getDuelCardTemplateCoverage(auditOptions);
    var fallback = getDuelCardTemplateFallbackStats({
      ...auditOptions,
      actions: coverage.sourceActions
    });
    var highRiskMappings = findHighRiskCardMappings(cards, coverage.sourceActions);
    var blockingDrift = []
      .concat(coverage.missingCardTemplates.map(function asIssue(item) { return { type: "missing_template", actionId: item.id, name: item.label || "" }; }))
      .concat(coverage.orphanCardTemplates.map(function asIssue(item) { return { type: "orphan_template", actionId: item.actionId, cardId: item.cardId }; }))
      .concat(coverage.duplicateCardIds.map(function asIssue(id) { return { type: "duplicate_cardId", cardId: id }; }))
      .concat(coverage.duplicateActionIds.map(function asIssue(id) { return { type: "duplicate_actionId", actionId: id }; }))
      .concat(schema.missingFields.map(function asIssue(item) { return { type: "missing_field", cardId: item.cardId, field: item.field }; }))
      .concat(schema.forbiddenFieldHits.map(function asIssue(item) { return { type: "forbidden_field", cardId: item.cardId, field: item.field }; }))
      .concat(schema.statusIssues.map(function asIssue(item) { return { type: "status_not_candidate", cardId: item.cardId, status: item.status }; }));
    if (fallback.overThreshold) {
      blockingDrift.push({
        type: "fallback_overuse",
        fallbackCount: fallback.fallbackCount,
        fallbackRatio: fallback.fallbackRatio,
        maxFallbackRatio: fallback.maxFallbackRatio
      });
    }
    return {
      version: version,
      status: "CANDIDATE",
      ok: blockingDrift.length === 0,
      result: blockingDrift.length ? "DRIFT_FOUND" : "NO_BLOCKING_DRIFT",
      cardRulesVersion: cardRules?.version || "",
      coverage: coverage,
      schema: schema,
      fallback: fallback,
      highRiskMappings: highRiskMappings,
      blockingDrift: blockingDrift,
      notes: blockingDrift.length ? "Review blocking drift before expanding card templates." : "No blocking drift found."
    };
  }

  function hasRequiredCardField(card, field) {
    if (!hasOwn(card || {}, field)) return false;
    var value = card[field];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== null && value !== undefined;
  }

  function collectDuelCardAuditActions(options) {
    var state = dependencies.state || {};
    var actionRules = options?.actionRules || options?.duelActionRules || state.duelActionRules || {};
    var domainRules = options?.domainRules || options?.duelDomainProfiles || state.duelDomainProfiles || {};
    var trialRules = options?.trialRules || options?.duelTrialTargetRules || state.duelTrialTargetRules || {};
    var sourceActions = [];
    appendAuditActions(sourceActions, actionRules.templates || options?.actionTemplates || [], "action_template");
    (domainRules.profiles || options?.domainProfiles || []).forEach(function collectProfile(profile) {
      appendAuditActions(sourceActions, profile?.domainActions || [], "domain_profile");
      appendAuditActions(sourceActions, profile?.opponentActions || [], "domain_profile");
    });
    (trialRules.targetClassProfiles || options?.targetClassProfiles || []).forEach(function collectTarget(profile) {
      appendAuditActions(sourceActions, profile?.choices || [], "trial_target");
    });
    return dedupeAuditActions(sourceActions);
  }

  function appendAuditActions(target, actions, source) {
    (actions || []).forEach(function appendAction(action) {
      if (!action?.id || !action?.label) return;
      target.push({
        id: action.id,
        label: action.label,
        risk: action.risk || "",
        role: action.role || action.domainRole || "",
        source: source,
        action: action
      });
    });
  }

  function dedupeAuditActions(actions) {
    var seen = new Set();
    var result = [];
    actions.forEach(function keepFirst(action) {
      if (!action?.id || seen.has(action.id)) return;
      seen.add(action.id);
      result.push(action);
    });
    return result;
  }

  function compactAuditAction(item) {
    return {
      id: item.id || "",
      label: item.label || "",
      risk: item.risk || "",
      role: item.role || "",
      source: item.source || ""
    };
  }

  function findDuplicateValues(values) {
    var seen = new Set();
    var duplicates = new Set();
    values.forEach(function inspectValue(value) {
      if (!value) return;
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    });
    return Array.from(duplicates);
  }

  function findHighRiskCardMappings(cards, sourceActions) {
    var actionMap = sourceActions.reduce(function buildMap(map, action) {
      map[action.id] = action;
      return map;
    }, {});
    return (cards || []).reduce(function collectRisk(issues, card) {
      var action = actionMap[card?.actionId || card?.actionId];
      if (!action) return issues;
      if (action.risk && card.risk && action.risk !== card.risk) {
        issues.push({
          type: "risk_mismatch",
          cardId: card.cardId || "",
          actionId: card.actionId || card.actionId || "",
          actionRisk: action.risk,
          cardRisk: card.risk
        });
      }
      if (["domain", "domain_maintenance", "domain_response", "rule_trial", "rule_defense", "jackpot", "curse_tool"].includes(card.cardType) && (!Array.isArray(card.contexts) || !card.contexts.length)) {
        issues.push({
          type: "context_gap",
          cardId: card.cardId || "",
          actionId: card.actionId || card.actionId || "",
          cardType: card.cardType || ""
        });
      }
      return issues;
    }, []);
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-card-template",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "metadata",
      ownsBehavior: false,
      status: "CANDIDATE"
    }),
    expectedExports: Object.freeze(expectedExports.slice()),
    expectedDependencies: Object.freeze(expectedDependencyNames.slice()),
    bind: bind,
    register: register,
    hasBinding: hasBinding,
    get: get,
    getBinding: getBinding,
    listBindings: listBindings,
    clearBindings: clearBindings,
    registerDependencies: registerDependencies,
    configure: configure,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelCardTemplateRules: getDuelCardTemplateRules,
    getDuelCardTemplates: getDuelCardTemplates,
    getDuelCardTemplateForAction: getDuelCardTemplateForAction,
    normalizeDuelCardTemplate: normalizeDuelCardTemplate,
    buildDuelCardViewModel: buildDuelCardViewModel,
    buildDuelCardEffectPreview: buildDuelCardEffectPreview,
    getDuelCardCopyRules: getDuelCardCopyRules,
    getDuelCardCopyForAction: getDuelCardCopyForAction,
    normalizeDuelCardCopy: normalizeDuelCardCopy,
    mergeDuelCardTemplateWithCopy: mergeDuelCardTemplateWithCopy,
    buildDuelCardDisplayModel: buildDuelCardDisplayModel,
    getDuelCardRiskLabel: getDuelCardRiskLabel,
    getDuelCardTypeDisplayLabel: getDuelCardTypeDisplayLabel,
    getDuelCardAvailabilityMessage: getDuelCardAvailabilityMessage,
    getDuelCardTypeLabel: getDuelCardTypeLabel,
    getDuelCardRarityLabel: getDuelCardRarityLabel,
    auditDuelCardTemplateDrift: auditDuelCardTemplateDrift,
    getDuelCardTemplateCoverage: getDuelCardTemplateCoverage,
    getDuelCardTemplateForActionStrict: getDuelCardTemplateForActionStrict,
    validateDuelCardTemplateSchema: validateDuelCardTemplateSchema,
    getDuelCardTemplateFallbackStats: getDuelCardTemplateFallbackStats,
    getDuelCharacterCombatStats: getDuelCharacterCombatStats,
    getDuelRankMultiplier: getDuelRankMultiplier,
    getDuelEfficiencyCostMultiplier: getDuelEfficiencyCostMultiplier,
    getDuelCardScalingProfile: getDuelCardScalingProfile,
    calculateDuelCardBaseEffect: calculateDuelCardBaseEffect,
    calculateDuelCardFinalPreview: calculateDuelCardFinalPreview,
    calculateDuelCardCeCost: calculateDuelCardCeCost,
    calculateDuelDamageFromCard: calculateDuelDamageFromCard,
    calculateDuelBlockFromCard: calculateDuelBlockFromCard,
    calculateDuelHealingFromCard: calculateDuelHealingFromCard,
    calculateDuelDomainPressureFromCard: calculateDuelDomainPressureFromCard,
    buildDuelCardNumericPreview: buildDuelCardNumericPreview,
    buildDuelCardTemplateIndexes: buildDuelCardTemplateIndexes,
    getDuelCardTemplateIndex: getDuelCardTemplateIndex,
    getDuelCardTemplateByActionId: getDuelCardTemplateByActionId,
    warmDuelCardTemplateCache: warmDuelCardTemplateCache,
    invalidateDuelCardTemplateCache: invalidateDuelCardTemplateCache,
    getDuelCardTemplateCacheStats: function getDuelCardTemplateCacheStats() {
      return {
        cardIndexReady: Boolean(cardTemplateIndexCache),
        lastInvalidatedAt: cardTemplateCacheStats.lastInvalidatedAt
      };
    }
  };

  global[namespace] = api;
})(globalThis);
