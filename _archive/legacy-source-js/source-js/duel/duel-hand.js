(function attachDuelHand(global) {
  "use strict";

  var namespace = "JJKDuelHand";
  var version = "3.6-direct-runtime";
  var expectedExports = [
    "getDuelHandRules",
    "initializeDuelHandState",
    "buildDuelHandCandidates",
    "pickDuelHandCandidates",
    "pickDuelDomainHandCandidates",
    "getDuelHandCardViewModel",
    "buildDuelCardViewModel",
    "applyDuelHandSelection",
    "getDuelSelectedHandActions",
    "canSelectDuelHandCandidate",
    "selectDuelHandCandidate",
    "unselectDuelHandCandidate",
    "discardDuelHandCandidate",
    "autoDiscardDuelHandOverflow",
    "isHandLimitExemptCard",
    "applyDuelSelectedHandActions",
    "consumeDuelResolvedHandActions",
    "resolveDuelHandTurn",
    "clearDuelSelectedHandActions",
    "pickDuelCpuHandActions",
    "getDuelActionApCost",
    "getDuelApState",
    "spendDuelAp",
    "resetDuelApForTurn",
    "getDuelCharacterCardRules",
    "buildDuelCharacterCardProfile",
    "getDuelCharacterArchetypes",
    "isDuelCardEligibleForCharacter",
    "isDuelActionEligibleForCharacter",
    "applyDuelCharacterCardWeights",
    "filterDuelHandCandidatesByCharacter",
    "filterSukunaJogoTimelineCandidates",
    "filterSukunaMahoragaTimelineCandidates",
    "filterShibuyaMahitoSceneCandidates",
    "explainDuelCardIneligibility"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelHandRules",
    "getDuelCharacterCardRules",
    "getDuelBattle",
    "buildDuelActionPool",
    "pickDuelActionChoices",
    "getDuelCpuAction",
    "getDuelActionAvailability",
    "getDuelCardTemplateForAction",
    "buildDuelCardViewModel",
    "applyDuelActionEffect",
    "getDuelActionCost",
    "getDuelResourcePair",
    "clampDuelResource",
    "appendDuelActionLog",
    "recordDuelResourceChange"
  ];
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var handCandidateCacheStats = {
    lastInvalidatedAt: ''
  };
  var domainControlHandActionIds = new Set([
    "domain_expand",
    "domain_compress",
    "domain_force_sustain",
    "domain_release",
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ]);
  var domainControlHandTags = new Set([
    "domain_access",
    "domain_activation",
    "domain_maintenance",
    "domain_response",
    "simple_domain",
    "hollow_wicker_basket",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "领域操控",
    "领域展开",
    "领域对抗",
    "简易领域",
    "弥虚葛笼",
    "弥须葛笼",
    "落花之情",
    "必中规避"
  ]);

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

  function getDependency(name) {
    return dependencies[name];
  }

  function getOptionalFunction(name) {
    var value = getDependency(name);
    return typeof value === "function" ? value : null;
  }

  function callDependency(name, args) {
    var fn = getOptionalFunction(name);
    if (!fn) throw new Error(namespace + " dependency is not available: " + name);
    return fn.apply(null, args || []);
  }

  function getDefaultBattle() {
    var getter = getOptionalFunction("getDuelBattle");
    if (getter) return getter();
    return dependencies.state?.duelBattle || null;
  }

  function getBattle(duelState) {
    return duelState || getDefaultBattle();
  }

  function getCandidateId(candidate) {
    var action = candidate?.action || candidate;
    return candidate?.id || candidate?.actionId || action?.id || "";
  }

  function buildDuelHandCandidateCache(battle, candidates) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var sourceHandCandidates = activeBattle.handCandidates;
    var sourceActionChoices = activeBattle.actionChoices;
    var sourceDomainHandCandidates = activeBattle.domainHandCandidates;
    var items = Array.isArray(candidates)
      ? candidates
      : [].concat(activeBattle.handCandidates || activeBattle.actionChoices || [], activeBattle.domainHandCandidates || []);
    var cache = {
      schema: "jjk-battle-runtime-hand-candidate-cache",
      round: Number(activeBattle.round || 0),
      total: items.length,
      candidates: items,
      sourceHandCandidates: sourceHandCandidates,
      sourceActionChoices: sourceActionChoices,
      sourceDomainHandCandidates: sourceDomainHandCandidates,
      sourceHandCandidateCount: Array.isArray(sourceHandCandidates) ? sourceHandCandidates.length : 0,
      sourceActionChoiceCount: Array.isArray(sourceActionChoices) ? sourceActionChoices.length : 0,
      sourceDomainHandCandidateCount: Array.isArray(sourceDomainHandCandidates) ? sourceDomainHandCandidates.length : 0,
      byId: Object.create(null)
    };
    items.forEach(function indexCandidate(candidate) {
      var id = getCandidateId(candidate);
      if (id) cache.byId[id] = candidate;
    });
    activeBattle.handCandidateCache = cache;
    return cache;
  }

  function getDuelHandCandidateCache(battle) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var sourceHandCandidates = activeBattle.handCandidates;
    var sourceActionChoices = activeBattle.actionChoices;
    var sourceDomainHandCandidates = activeBattle.domainHandCandidates;
    var cache = activeBattle.handCandidateCache;
    var sourceChanged = !cache ||
      cache.sourceHandCandidates !== sourceHandCandidates ||
      cache.sourceActionChoices !== sourceActionChoices ||
      cache.sourceDomainHandCandidates !== sourceDomainHandCandidates ||
      Number(cache.sourceHandCandidateCount || 0) !== (Array.isArray(sourceHandCandidates) ? sourceHandCandidates.length : 0) ||
      Number(cache.sourceActionChoiceCount || 0) !== (Array.isArray(sourceActionChoices) ? sourceActionChoices.length : 0) ||
      Number(cache.sourceDomainHandCandidateCount || 0) !== (Array.isArray(sourceDomainHandCandidates) ? sourceDomainHandCandidates.length : 0);
    if (sourceChanged || Number(cache.round || 0) !== Number(activeBattle.round || 0)) {
      cache = buildDuelHandCandidateCache(activeBattle, [].concat(sourceHandCandidates || sourceActionChoices || [], sourceDomainHandCandidates || []));
    }
    return cache;
  }

  function getDuelHandCandidateById(battle, actionOrId) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var id = typeof actionOrId === "string" ? actionOrId : getCandidateId(actionOrId);
    if (!id) return null;
    return getDuelHandCandidateCache(activeBattle)?.byId?.[id] || null;
  }

  function invalidateDuelHandCandidateCache(battle) {
    var activeBattle = getBattle(battle);
    if (activeBattle) delete activeBattle.handCandidateCache;
    handCandidateCacheStats.lastInvalidatedAt = new Date().toISOString();
  }

  function getDuelHandRules() {
    var getter = getOptionalFunction("getDuelHandRules");
    if (getter && getter !== getDuelHandRules) return getter();
    return {
      version: "0.1.0",
      status: "CANDIDATE",
      hand: {
        defaultChoiceCount: 8,
        minChoiceCount: 3,
        maxChoiceCount: 8,
        maxHandSize: 8,
        drawPerTurn: 5,
        overflowDiscardMode: "auto_low_priority_candidate",
        discardFromRemainingAndNew: true,
        selectionMode: "multi_action_ap_beta",
        allowMultipleSelectionsPerTurn: true,
        maxSelectionsPerTurn: 3,
        disableSelectedCandidate: true,
        requireManualResolve: true
      },
      domainHand: {
        enabled: true,
        maxHandSize: 3,
        refreshEachRound: true,
        excludeFromNormalHandLimit: true,
        specialDomainWeightBonus: 2,
        domainAccessWeightBonus: 1
      },
      ap: { basePerTurn: 2, maxPerTurn: 3, carryOver: false },
      cpuDifficulty: {
        default: "normal",
        options: {
          easy: { label: "简单：陪练", beamWidth: 1, scoreNoise: 0.2, mistakeRate: 0.2 },
          normal: { label: "普通：稳定", beamWidth: 3, scoreNoise: 0, mistakeRate: 0 },
          hard: { label: "困难：强规划", beamWidth: 5, scoreNoise: 0, mistakeRate: 0 }
        }
      },
      cardLikeDisplay: {
        enabled: true,
        showApCost: true,
        showCeCost: true,
        showRisk: true,
        showTags: true,
        showCardType: true,
        showRarity: true
      },
      notes: "Hand-like candidates wrap existing duel actions only."
    };
  }

  function asList(value) {
    if (Array.isArray(value)) return value.filter(function keepValue(item) { return item != null && item !== ""; });
    if (value == null || value === "") return [];
    return [value];
  }

  function uniqueList(values) {
    return Array.from(new Set((values || []).map(function normalizeValue(value) {
      return typeof value === "string" ? value.trim() : value;
    }).filter(function keepValue(value) {
      return value != null && value !== "";
    })));
  }


  function isBattleDirectRuntimeAction(value) {
    return Boolean(value && value.effect && value.cost && Array.isArray(value.contexts));
  }

  function getBattleRuntimeActionWeight(candidate, fallback) {
    if (isBattleDirectRuntimeAction(candidate)) return Number(candidate.weight ?? fallback ?? 1);
    return Number(candidate?.weight ?? candidate?.characterWeight ?? candidate?.score ?? candidate?.weight ?? fallback ?? 1);
  }

  function getBattleRuntimeActionContexts(value, fallback) {
    if (isBattleDirectRuntimeAction(value)) return asList(value.contexts);
    return asList(value?.contexts || value?.runtimeContexts || value?.battleContexts || value?.contexts || fallback || []);
  }

  function getBattleRuntimeActionCostCe(value, fallback) {
    if (isBattleDirectRuntimeAction(value)) return Number(value.cost?.ce ?? fallback ?? 0);
    return Number(value?.cost?.ce ?? value?.ceCost ?? value?.costCe ?? value?.ceCost ?? fallback ?? 0);
  }

  function getBattleRuntimeActionDamage(value, fallback) {
    if (isBattleDirectRuntimeAction(value)) return Number(value.effect?.damage ?? fallback ?? 0);
    return Number(value?.effect?.damage ?? value?.damage ?? value?.damage ?? fallback ?? 0);
  }

  function getBattleRuntimeActionBlock(value, fallback) {
    if (isBattleDirectRuntimeAction(value)) return Number(value.effect?.block ?? fallback ?? 0);
    return Number(value?.effect?.block ?? value?.block ?? value?.block ?? fallback ?? 0);
  }

  function getBattleDirectCardSettlement(value, actor, opponent) {
    if (!isBattleDirectRuntimeAction(value) || !actor) return null;
    var settlement = global.JJKBattleDataDirect?.calculateBattleCardSettlement;
    if (typeof settlement !== "function") return null;
    try {
      return settlement(value, actor || {}, opponent || {});
    } catch (error) {
      return null;
    }
  }

  function clonePlain(value) {
    if (value == null || typeof value !== "object") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return Array.isArray(value) ? value.slice() : { ...value };
    }
  }

  function includesAny(source, targets) {
    var sourceSet = new Set(asList(source));
    return asList(targets).some(function hasTarget(target) {
      return sourceSet.has(target);
    });
  }

  function includesAll(source, targets) {
    var sourceSet = new Set(asList(source));
    return asList(targets).every(function hasTarget(target) {
      return sourceSet.has(target);
    });
  }

  var exclusiveHandTagArchetypeRules = [
    { archetype: "gojo_limitless", tokens: ["gojo_limitless", "gojo", "五条", "无下限", "无限", "不可侵", "苍", "赫", "茈", "紫", "虚式", "无限虚式", "无量空处", "limitless", "infinity", "blue", "red", "hollow_purple", "unlimited_void"] },
    { archetype: "shrine", tokens: ["sukuna", "宿傩", "两面宿傩", "御厨子", "伏魔御厨子", "捌", "斩击", "切割", "火箭", "slash", "cleave", "dismantle", "shrine", "malevolent_shrine", "open_domain"] },
    { archetype: "higuruma_trial_owner", tokens: ["higuruma_trial_owner", "日车", "审判", "裁判", "没收", "处刑人之剑", "judgeman", "confiscation", "executioner"] },
    { archetype: "hakari_jackpot_owner", tokens: ["hakari_jackpot_owner", "秤金次", "坐杀博徒", "大中奖", "jackpot", "hakari", "pachinko", "idle_death_gamble"] },
    { archetype: "ten_shadows", tokens: ["ten_shadows", "十种影法术", "十影", "玉犬", "鵺", "满象", "脱兔", "魔虚罗", "八握剑", "mahoraga", "shadow_garden"] },
    { archetype: "mahito_soul_transfiguration", tokens: ["mahito_soul_transfiguration", "真人", "无为转变", "灵魂改造", "自闭圆顿裹", "mahito", "idle_transfiguration"] },
    { archetype: "okkotsu_rika_copy", tokens: ["okkotsu_rika_copy", "乙骨", "里香", "纯爱", "复制术式", "rika", "okkotsu", "copy", "copy_technique"] },
    { archetype: "curse_spirit_manipulation_owner", tokens: ["curse_spirit_manipulation", "咒灵操术", "咒灵库存", "夏油杰", "夏油", "geto", "kenjaku_geto"] },
    { archetype: "zero_ce_heavenly_restriction", tokens: ["zero_ce_heavenly_restriction", "天与咒缚", "天与暴君", "完全体天与", "零咒力", "heavenly_restriction", "zero_ce"] },
    { archetype: "recontract_icon", tokens: ["recontract_icon", "再契象征", "契约再现", "reggie", "receipt_contract"] }
  ];

  function getExclusiveArchetypesFromHandTags(snapshot) {
    if (snapshot?.actionId === "douna_counter_cursed_energy_guard" || snapshot?.cardId === "card_douna_counter_cursed_energy_guard") {
      return [];
    }
    var exactTokens = new Set(uniqueList([]
      .concat(asList(snapshot?.tags))
      .concat(asList(snapshot?.specialHandTags))
      .concat(asList(snapshot?.exclusiveToArchetypes))
      .concat(asList(snapshot?.sourceTechniqueFamily)))
      .map(function normalizeExactHandTag(tag) { return String(tag || "").trim().toLowerCase(); })
      .filter(Boolean));
    if (!exactTokens.size) return [];
    return uniqueList(exclusiveHandTagArchetypeRules.filter(function matchesRule(rule) {
      return rule.tokens.some(function hasToken(token) {
        var normalized = String(token || "").trim().toLowerCase();
        return normalized && exactTokens.has(normalized);
      });
    }).map(function toArchetype(rule) {
      return rule.archetype;
    }));
  }

  function normalizeCharacterKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getCharacterTimelineQualifiers(value) {
    var text = normalizeCharacterKey(value);
    var qualifiers = [];
    [
      ["shibuya", /shibuya|涩谷/],
      ["shinjuku", /shinjuku|新宿/],
      ["culling_game", /culling[_\s-]?game|culling|死灭回游|死灭洄游/],
      ["volume0", /volume[_\s-]?0|0卷|零卷|百鬼夜行/],
      ["after68", /after[_\s-]?68|68年后|六十八年后/]
    ].forEach(function collectQualifier(entry) {
      if (entry[1].test(text)) qualifiers.push(entry[0]);
    });
    return uniqueList(qualifiers);
  }

  function hasConflictingCharacterTimelineQualifier(characterOrActor, ruleCharacterId) {
    var sourceQualifiers = getCharacterTimelineQualifiers([
      characterOrActor?.characterId,
      characterOrActor?.id,
      characterOrActor?.stage,
      characterOrActor?.displayName,
      characterOrActor?.name,
      characterOrActor?.profile?.characterId,
      characterOrActor?.profile?.id,
      characterOrActor?.profile?.stage,
      characterOrActor?.profile?.displayName,
      characterOrActor?.profile?.name
    ].filter(Boolean).join(" "));
    var ruleQualifiers = getCharacterTimelineQualifiers(ruleCharacterId);
    if (!sourceQualifiers.length || !ruleQualifiers.length) return false;
    return !sourceQualifiers.some(function sharesQualifier(qualifier) {
      return ruleQualifiers.includes(qualifier);
    });
  }

  function getDuelCharacterCardRules() {
    var getter = getOptionalFunction("getDuelCharacterCardRules");
    if (getter && getter !== getDuelCharacterCardRules) return getter();
    return dependencies.state?.duelCharacterCardRules || {
      schema: "jjk-battle-runtime-character-card-rules",
      version: "0.1.0",
      status: "CANDIDATE",
      defaults: { enabled: false },
      archetypes: {},
      characters: {},
      sourceActionRules: {}
    };
  }

  function getCharacterRuleEntry(characterOrActor, rules) {
    var activeRules = rules || getDuelCharacterCardRules();
    var characters = activeRules?.characters || {};
    var id = characterOrActor?.characterId || characterOrActor?.id || characterOrActor?.profile?.id || "";
    if (id && characters[id]) return { id: id, rules: characters[id] };
    var identities = uniqueList([
      id,
      characterOrActor?.displayName,
      characterOrActor?.name,
      characterOrActor?.profile?.displayName,
      characterOrActor?.profile?.name
    ].filter(Boolean).map(normalizeCharacterKey).filter(Boolean));
    return Object.entries(characters).reduce(function findMatch(match, entry) {
      if (match) return match;
      var characterId = entry[0];
      var rule = entry[1] || {};
      if (rule.requireExactCharacterId === true) return null;
      if (hasConflictingCharacterTimelineQualifier(characterOrActor, characterId)) return null;
      var aliases = uniqueList([characterId].concat(asList(rule.aliases)));
      var found = aliases.some(function aliasMatches(alias) {
        var normalized = normalizeCharacterKey(alias);
        return normalized && identities.includes(normalized);
      });
      return found ? { id: characterId, rules: rule } : null;
    }, null);
  }

  function inferCharacterTraits(source) {
    return uniqueList([]
      .concat(asList(source?.innateTraits))
      .concat(asList(source?.advancedTechniques))
      .concat(asList(source?.loadout))
      .concat(asList(source?.flags))
      .concat(asList(source?.traits))
      .concat(asList(source?.techniqueFamilies))
      .concat(asList(source?.archetypes))
      .concat(asList(source?.specialHandTags))
      .concat(asList(source?.["特殊手札"])));
  }

  function isSimpleDomainCounterpartHidden(profile, snapshot) {
    var profileTags = asList(profile?.explicitSpecialHandTags);
    var cardTags = uniqueList([])
      .concat(asList(snapshot?.specialHandTags))
      .concat(asList(snapshot?.tags))
      .concat(asList(snapshot?.sourceTechniqueFamily));
    var profileHasSwordDomain = profileTags.includes("simple_domain_sword");
    var profileHasGenericDomain = profileTags.includes("simple_domain");
    var cardIsSwordDomain = cardTags.includes("simple_domain_sword");
    if (!profileHasSwordDomain && profileHasGenericDomain && cardIsSwordDomain) return true;
    return false;
  }

  function getDuelCharacterArchetypes(characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    var entry = getCharacterRuleEntry(characterOrActor, rules);
    var source = characterOrActor?.profile || characterOrActor || {};
    return uniqueList([]
      .concat(asList(entry?.rules?.archetypes))
      .concat(asList(source?.archetypes)));
  }

  function getDeclaredCharacterSpecialHandTags(source, customCard) {
    return uniqueList([])
      .concat(asList(source?.specialHandTags))
      .concat(asList(source?.specialhandTags))
      .concat(asList(source?.["特殊手札"]))
      .concat(asList(source?.explicitSpecialHandTags))
      .concat(asList(customCard?.specialHandTags))
      .concat(asList(customCard?.specialhandTags))
      .concat(asList(customCard?.["特殊手札"]))
      .concat(asList(customCard?.explicitSpecialHandTags));
  }

  function applyProfilePatch(profile, patch) {
    if (!patch || typeof patch !== "object") return profile;
    ["hasCe", "ceLimited", "hasInnateTechnique", "hasDomainAccess", "isZeroCe", "isCurse", "isIncarnated", "usesCursedTools"].forEach(function applyFlag(key) {
      if (typeof patch[key] === "boolean") profile[key] = patch[key];
    });
    return profile;
  }

  function isMeaningfulProfileValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && !value.trim()) return false;
    if (Array.isArray(value) && !value.length) return false;
    if (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length) return false;
    return true;
  }

  function pickProfileValue(actor, key) {
    var sources = actor?.characterCardProfile
      ? [actor?.characterCardProfile, actor?.profile]
      : [actor?.profile, actor];
    for (var index = 0; index < sources.length; index += 1) {
      var value = sources[index]?.[key];
      if (isMeaningfulProfileValue(value)) return value;
    }
    return undefined;
  }

  function mergeProfileListField(actor, key) {
    return pickProfileListField(actor, key);
  }

  function pickProfileListField(actor, key) {
    var sources = actor?.characterCardProfile
      ? [actor?.characterCardProfile, actor?.profile]
      : [actor?.profile, actor];
    for (var index = 0; index < sources.length; index += 1) {
      var values = asList(sources[index]?.[key]);
      if (values.length) return uniqueList(values);
    }
    return [];
  }

  function buildProfileSource(actor) {
    var base = actor || {};
    var source = base.characterCardProfile
      ? { ...(base.profile || {}), ...(base.characterCardProfile || {}) }
      : { ...(base || {}), ...(base.profile || {}) };
    [
      "id",
      "characterId",
      "profileId",
      "name",
      "displayName",
      "technique",
      "techniqueName",
      "techniqueText",
      "techniqueDescription",
      "domainProfile",
      "domainScript",
      "externalResource",
      "notes",
      "officialGrade",
      "tier",
      "powerTier"
    ].forEach(function applyPriorityField(key) {
      var value = pickProfileValue(base, key);
      if (isMeaningfulProfileValue(value)) source[key] = value;
    });
    [
      "innateTraits",
      "advancedTechniques",
      "loadout",
      "flags",
      "traits",
      "techniqueFamilies",
      "archetypes",
      "specialHandTags",
      "specialhandTags",
      "特殊手札",
      "explicitSpecialHandTags",
      "selectedMechanisms",
      "selectedToolTags",
      "variants",
      "characterVariants"
    ].forEach(function mergeList(key) {
      source[key] = mergeProfileListField(base, key);
    });
    source.flags = pickProfileListField(base, "flags");
    source.selectedLibrary = {
      ...(base.selectedLibrary || {}),
      ...(base.profile?.selectedLibrary || {}),
      ...(base.characterCardProfile?.selectedLibrary || {})
    };
    return source;
  }

  function hasPositiveDomainDeclarationText(text) {
    return /领域展开|生得领域|开放领域|顶级领域|顶尖领域|顶格领域|最高级领域|未完成领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦|胎藏遍野|嵌合暗翳庭|domain expansion/i.test(String(text || ""));
  }

  function hasNoDomainDeclarationText(text) {
    var value = String(text || "").trim();
    if (!value) return false;
    if (/无明确领域|无领域|没有领域|不具备领域|未掌握领域|^无$|no\s+domain/i.test(value)) return true;
    return /未知|未公开/i.test(value) && !hasPositiveDomainDeclarationText(value);
  }

  function isAntiDomainOnlyText(text) {
    var value = String(text || "");
    return /简易领域|simple domain|弥虚葛笼|弥须葛笼|彌虚葛籠|彌須葛籠|落花之情|反领域|高阶反领域|领域对策/i.test(value) &&
      !hasPositiveDomainDeclarationText(value);
  }

  function buildDuelCharacterCardProfile(characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    var actor = characterOrActor || {};
    var source = buildProfileSource(actor);
    var sourceId = source?.characterId || source?.profileId || source?.id || actor?.characterId || actor?.profileId || actor?.id || "";
    var customCard = (dependencies.state?.customDuelCards || []).find(function findCustomCard(card) {
      return card?.characterId === sourceId || card?.id === sourceId;
    }) || null;
    var sourceDomainScript = source?.domainScript || customCard?.domainScript || null;
    var sourceDomainText = [
      source?.domainProfile,
      customCard?.domainProfile,
      sourceDomainScript?.domainName
    ].filter(Boolean).join(" ");
    var domainFlags = new Set(asList(source?.flags).concat(asList(customCard?.flags)));
    var antiDomainOnly = isAntiDomainOnlyText(sourceDomainText);
    var explicitDomainAccessBlocked = source?.hasDomainAccess === false && !sourceDomainScript;
    var noDomainFlagBlocks = domainFlags.has("noDomain") &&
      !sourceDomainScript &&
      source?.hasDomainAccess !== true &&
      !hasPositiveDomainDeclarationText(sourceDomainText);
    var hasDeclaredDomain = !explicitDomainAccessBlocked &&
      !noDomainFlagBlocks &&
      !antiDomainOnly &&
      !hasNoDomainDeclarationText(sourceDomainText) &&
      (Boolean(sourceDomainScript) || source?.hasDomainAccess === true || hasPositiveDomainDeclarationText(sourceDomainText));
    var entry = getCharacterRuleEntry(source, rules);
    var archetypes = getDuelCharacterArchetypes(source, { rules: rules });
    var traits = uniqueList([]
      .concat(inferCharacterTraits(source))
      .concat(asList(source?.innateTraits))
      .concat(asList(source?.advancedTechniques))
      .concat(asList(source?.loadout))
      .concat(asList(source?.flags))
      .concat(asList(source?.traits))
      .concat(asList(source?.techniqueFamilies))
      .concat(asList(customCard?.techniqueFamilies))
      .concat(asList(entry?.rules?.forceAllowTags))
      .concat(asList(entry?.rules?.techniqueFamilies))
      .concat(archetypes));
    var explicitSpecialHandTags = getDeclaredCharacterSpecialHandTags(source, customCard);
    var strictTechniqueFamilies = uniqueList([]
      .concat(asList(entry?.rules?.techniqueFamilies))
      .concat(asList(source?.techniqueFamilies))
      .concat(asList(customCard?.techniqueFamilies))
      .concat(explicitSpecialHandTags));
    var hasRctOutputAccess = strictTechniqueFamilies.includes("reverse_output");
    if (hasRctOutputAccess) {
      explicitSpecialHandTags = explicitSpecialHandTags.filter(function removeRctOutputSpecialTag(tag) {
        return !/^(反转术式外放|reverse_output|rct_output)$/i.test(String(tag || ""));
      });
    }
    var specialHandTags = uniqueList([].concat(explicitSpecialHandTags));
    var derivedAdvancedTechniques = [];
    var variants = uniqueList([]
      .concat(asList(source?.variants))
      .concat(asList(source?.characterVariants))
      .concat(asList(customCard?.variants))
      .concat(asList(entry?.rules?.variants)));
    traits = uniqueList(traits.concat(specialHandTags).concat(derivedAdvancedTechniques));
    var profile = {
      characterId: source?.characterId || source?.profileId || source?.id || entry?.id || "",
      displayName: source?.displayName || source?.name || "",
      domainProfile: source?.domainProfile || customCard?.domainProfile || "",
      domainScript: sourceDomainScript,
      traits: traits,
      advancedTechniques: uniqueList([]
        .concat(asList(source?.advancedTechniques))
        .concat(asList(customCard?.advancedTechniques))
        .concat(derivedAdvancedTechniques)),
      archetypes: archetypes,
      variants: uniqueList(variants),
      specialHandTags: specialHandTags,
      explicitSpecialHandTags: explicitSpecialHandTags,
      hasRctOutputAccess: hasRctOutputAccess,
      hasCe: typeof source?.hasCe === "boolean" ? source.hasCe : true,
      ceLimited: typeof source?.ceLimited === "boolean" ? source.ceLimited : false,
      hasInnateTechnique: typeof source?.hasInnateTechnique === "boolean" ? source.hasInnateTechnique : strictTechniqueFamilies.length > 0,
      hasDomainAccess: hasDeclaredDomain,
      isZeroCe: typeof source?.isZeroCe === "boolean" ? source.isZeroCe : false,
      isCurse: typeof source?.isCurse === "boolean" ? source.isCurse : false,
      isIncarnated: typeof source?.isIncarnated === "boolean" ? source.isIncarnated : false,
      usesCursedTools: typeof source?.usesCursedTools === "boolean" ? source.usesCursedTools : false,
      techniqueFamilies: strictTechniqueFamilies,
      ruleId: entry?.id || ""
    };
    archetypes.forEach(function applyArchetypePatch(archetypeId) {
      applyProfilePatch(profile, rules?.archetypes?.[archetypeId]?.profilePatch);
    });
    applyProfilePatch(profile, entry?.rules?.profilePatch);
    applyProfilePatch(profile, source);
    // A secondary archetype (for example Sukuna inhabiting Yuji's body) must
    // not erase a domain that the character snapshot explicitly declares.
    profile.hasDomainAccess = Boolean(hasDeclaredDomain);
    if (profile.isZeroCe) {
      profile.hasCe = false;
      profile.ceLimited = true;
      profile.hasInnateTechnique = false;
      profile.hasDomainAccess = false;
      profile.usesCursedTools = true;
    }
    profile.traits = uniqueList(profile.traits.concat(
      profile.isZeroCe ? ["zero_ce", "零咒力"] : [],
      profile.isCurse ? ["curse", "咒灵"] : [],
      profile.usesCursedTools ? ["cursed_tool", "咒具"] : [],
      profile.hasDomainAccess ? ["domain", "领域"] : []
    ));
    return global.JJKSpecialConstitution?.augmentProfile(profile, source) || profile;
  }

  function getActiveTemporaryTechniqueGrants(actor, battle) {
    var resolver = global.JJKDuelActions?.getActiveTemporaryTechniqueGrants;
    if (typeof resolver !== "function") return [];
    var grants = resolver(actor, battle);
    return Array.isArray(grants) ? grants.filter(function keepValidGrant(grant) {
      return grant?.slotId && grant?.tag;
    }) : [];
  }

  function buildDuelEffectiveCharacterCardProfile(characterOrActor, battle, rules, baseProfile) {
    var profile = baseProfile || buildDuelCharacterCardProfile(characterOrActor, { rules: rules });
    var grants = getActiveTemporaryTechniqueGrants(characterOrActor, battle);
    if (!grants.length) return profile;
    var temporaryTags = grants.map(function mapTemporaryTechniqueTag(grant) { return grant.tag; });
    return {
      ...profile,
      specialHandTags: uniqueList([].concat(asList(profile.specialHandTags), temporaryTags)),
      explicitSpecialHandTags: uniqueList([].concat(asList(profile.explicitSpecialHandTags), temporaryTags)),
      techniqueFamilies: uniqueList([].concat(asList(profile.techniqueFamilies), temporaryTags)),
      traits: uniqueList([].concat(asList(profile.traits), temporaryTags))
    };
  }

  function getActionRuleForCandidate(actionOrCandidate, rules) {
    var action = getActionFromEntry(actionOrCandidate);
    var id = actionOrCandidate?.actionId || actionOrCandidate?.id || action?.id || action?.cardId || "";
    return rules?.sourceActionRules?.[id] || rules?.sourceActionRules?.[action?.id] || {};
  }

  function getDuelCardTemplateForCandidate(actionOrCandidate) {
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    return templateGetter ? templateGetter(actionOrCandidate) : null;
  }

  function getCandidateCardRuleSnapshot(actionOrCandidate, rules) {
    var action = getActionFromEntry(actionOrCandidate) || {};
    var template = getDuelCardTemplateForCandidate(actionOrCandidate) || {};
    var actionId = actionOrCandidate?.actionId || actionOrCandidate?.id || template.actionId || action.id || "";
    var sourceRule = getActionRuleForCandidate({ ...actionOrCandidate, actionId: actionId }, rules);
    var tags = uniqueList([]
      .concat(asList(action.tags))
      .concat(asList(template.tags))
      .concat(asList(sourceRule.tags))
      .concat(asList(action.archetypeHints))
      .concat(asList(template.archetypeHints))
      .concat(asList(action.characterHints))
      .concat(asList(template.characterHints)));
    var specialHandTags = uniqueList([])
      .concat(asList(action.specialHandTags), asList(action["特殊手札"]))
      .concat(asList(template.specialHandTags), asList(template["特殊手札"]))
      .concat(asList(sourceRule.specialHandTags), asList(sourceRule["特殊手札"]));
    var specialIdentityText = [
      actionOrCandidate?.handSource,
      action?.handSource,
      template?.handSource,
      actionOrCandidate?.rarity,
      action?.rarity,
      template?.rarity,
      actionOrCandidate?.cardType,
      action?.cardType,
      template?.cardType
    ].concat(tags).join(" ");
    return {
            cardId: actionOrCandidate?.cardId || template.cardId || ("card_" + actionId),
      label: actionOrCandidate?.label || template.name || action.label || actionId,
      cardType: actionOrCandidate?.cardType || template.cardType || sourceRule.cardType || "",
      tags: tags,
      requiredTraits: uniqueList([].concat(asList(action.requiredTraits), asList(template.requiredTraits), asList(sourceRule.requiredTraits))),
      forbiddenTraits: uniqueList([].concat(asList(action.forbiddenTraits), asList(template.forbiddenTraits), asList(sourceRule.forbiddenTraits))),
      exclusiveToCharacters: uniqueList([].concat(asList(action.exclusiveToCharacters), asList(template.exclusiveToCharacters), asList(sourceRule.exclusiveToCharacters))),
      exclusiveToVariants: uniqueList([].concat(asList(action.exclusiveToVariants), asList(template.exclusiveToVariants), asList(sourceRule.exclusiveToVariants))),
      exclusiveToArchetypes: uniqueList([].concat(asList(action.exclusiveToArchetypes), asList(template.exclusiveToArchetypes), asList(sourceRule.exclusiveToArchetypes))),
      specialHandTags: specialHandTags,
      specialHandCandidate: Boolean(specialHandTags.length || /特殊手札|特色手札|special|feature-hand|fixed-injection|mahoraga-tuning-fixed|douna-ten-shadows-fixed/i.test(specialIdentityText)),
      directBattleCard: Boolean(
        (actionOrCandidate?.handSource === "battle-direct-card" || action?.handSource === "battle-direct-card" || template?.handSource === "battle-direct-card") &&
        action?.effect && action?.cost && Array.isArray(action?.contexts)
      ),
      forbiddenArchetypes: uniqueList([].concat(asList(action.forbiddenArchetypes), asList(template.forbiddenArchetypes), asList(sourceRule.forbiddenArchetypes))),
      requiresCe: Boolean(action.requiresCe || template.requiresCe || sourceRule.requiresCe),
      requiresInnateTechnique: Boolean(action.requiresInnateTechnique || template.requiresInnateTechnique || sourceRule.requiresInnateTechnique),
      requiresDomainAccess: Boolean(action.requiresDomainAccess || template.requiresDomainAccess || sourceRule.requiresDomainAccess),
      requiresCursedTool: Boolean(action.requiresCursedTool || template.requiresCursedTool || sourceRule.requiresCursedTool),
      requiresZeroCe: Boolean(action.requiresZeroCe || template.requiresZeroCe || sourceRule.requiresZeroCe),
      sourceTechniqueFamily: action.sourceTechniqueFamily || template.sourceTechniqueFamily || sourceRule.sourceTechniqueFamily || ""
    };
  }

  function getCharacterRuleAllowDeny(profile, rules) {
    var entry = getCharacterRuleEntry({ id: profile.characterId, name: profile.displayName }, rules);
    var denyTags = [];
    var denyCardTypes = [];
    var weightBoostTags = [];
    var weightPenaltyTags = [];
    var forceAllowSourceActionIds = [];
    var forceDenySourceActionIds = [];
    profile.archetypes.forEach(function collectArchetype(archetypeId) {
      var archetype = rules?.archetypes?.[archetypeId] || {};
      denyTags.push(...asList(archetype.denyTags));
      denyCardTypes.push(...asList(archetype.denyCardTypes));
      weightBoostTags.push(...asList(archetype.weightBoostTags));
      weightPenaltyTags.push(...asList(archetype.weightPenaltyTags));
      forceAllowSourceActionIds.push(...asList(archetype.forceAllowSourceActionIds));
      forceDenySourceActionIds.push(...asList(archetype.forceDenySourceActionIds));
    });
    var characterRules = entry?.rules || {};
    var characterRulePatch = characterRules.rules || {};
    denyTags.push(...asList(characterRules.denyTags), ...asList(characterRulePatch.denyTags));
    denyCardTypes.push(...asList(characterRules.denyCardTypes), ...asList(characterRulePatch.denyCardTypes));
    weightBoostTags.push(...asList(characterRules.weightBoostTags), ...asList(characterRules.forceAllowTags), ...asList(characterRulePatch.weightBoostTags), ...asList(characterRulePatch.forceAllowTags));
    weightPenaltyTags.push(...asList(characterRules.weightPenaltyTags), ...asList(characterRulePatch.weightPenaltyTags));
    forceAllowSourceActionIds.push(...asList(characterRules.forceAllowSourceActionIds), ...asList(characterRulePatch.forceAllowSourceActionIds));
    forceDenySourceActionIds.push(...asList(characterRules.forceDenySourceActionIds), ...asList(characterRulePatch.forceDenySourceActionIds));
    return {
      entry: entry,
      denyTags: uniqueList(denyTags),
      denyCardTypes: uniqueList(denyCardTypes),
      weightBoostTags: uniqueList(weightBoostTags),
      weightPenaltyTags: uniqueList(weightPenaltyTags),
      forceAllowSourceActionIds: uniqueList(forceAllowSourceActionIds),
      forceDenySourceActionIds: uniqueList(forceDenySourceActionIds)
    };
  }

  function explainDuelCardIneligibility(actionOrCandidate, characterOrActor, options) {
    var decision = getDuelCardEligibilityDecision(actionOrCandidate, characterOrActor, options);
    return decision.ok ? "" : decision.reason;
  }

  function getDuelCardEligibilityDecision(actionOrCandidate, characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    if (rules?.defaults?.enabled === false) return { ok: true, reason: "" };
    var profile = buildDuelEffectiveCharacterCardProfile(characterOrActor, options?.battle, rules, options?.profile);
    var snapshot = getCandidateCardRuleSnapshot(actionOrCandidate, rules);
    var policy = getCharacterRuleAllowDeny(profile, rules);
    var actionId = snapshot.actionId || snapshot.cardId || "";
    var forceAllowed = policy.forceAllowSourceActionIds.includes(actionId);
    var strictFamilyTokens = uniqueList(asList(snapshot.sourceTechniqueFamily));
    var strictTechniqueFamilyMatched = Boolean(strictFamilyTokens.length && includesAny(profile.techniqueFamilies, strictFamilyTokens));
    var specialHandMatched = strictTechniqueFamilyMatched;
    var action = getActionFromEntry(actionOrCandidate) || {};
    if (global.JJKSpecialConstitution?.has(profile, global.JJKSpecialConstitution.ids.PHYSICAL_HEAVENLY_RESTRICTION) &&
      global.JJKSpecialConstitution.isCursedTechniqueAction(action)) {
      return { ok: false, reason: "零咒力之躯已从发牌池移除全部咒力与生得术式牌", profile: profile, snapshot: snapshot };
    }
    var handSource = String(actionOrCandidate?.handSource || action?.handSource || "");
    // 里香武库是唯一允许临时越过原术式归属的发牌管线。必须同时带有
    // 生成来源、待处理收据和到期回合，不能只靠一个可伪造的布尔字段放行。
    var verifiedRikaArsenalGrant = Boolean(
      action?.rikaArsenalFreeUse &&
      handSource === "rika-arsenal-free-special" &&
      String(action?.rikaArsenalSourcePendingId || actionOrCandidate?.rikaArsenalSourcePendingId || "") &&
      Number.isFinite(Number(action?.rikaArsenalExpiresAfterRound ?? actionOrCandidate?.rikaArsenalExpiresAfterRound)) &&
      String(action?.generatedBy || actionOrCandidate?.generatedBy || "") === "里香武库"
    );
    // 配置中的 forceAllow 只可放宽通用牌规则；术式专属牌永远需要精确标签，
    // 唯一例外是带完整回合收据的里香武库临时复制牌。
    var specialOwnershipBypass = Boolean(specialHandMatched || verifiedRikaArsenalGrant);
    if (!forceAllowed && isSimpleDomainCounterpartHidden(profile, snapshot)) {
      return { ok: false, reason: "简易领域与新阴流简易领域候选互斥显示", profile: profile, snapshot: snapshot };
    }
    if (policy.forceDenySourceActionIds.includes(actionId)) {
      return { ok: false, reason: "不符合当前角色特性", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && snapshot.specialHandCandidate && !snapshot.specialHandTags.length) {
      return { ok: false, reason: "特殊手札缺少 sourceTechniqueFamily，禁止隐式发放", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && snapshot.specialHandCandidate && !specialHandMatched) {
      return { ok: false, reason: "sourceTechniqueFamily 未精确命中角色 techniqueFamilies", profile: profile, snapshot: snapshot };
    }
    var impliedExclusiveArchetypes = getExclusiveArchetypesFromHandTags(snapshot);
    if (!specialOwnershipBypass && impliedExclusiveArchetypes.length && !includesAny(profile.archetypes, impliedExclusiveArchetypes)) {
      return { ok: false, reason: "需要对应专属术式原型", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && snapshot.exclusiveToCharacters.length) {
      var ids = uniqueList([profile.characterId, profile.ruleId, profile.displayName]);
      if (!includesAny(ids, snapshot.exclusiveToCharacters)) return { ok: false, reason: "需要指定角色专属术式", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && snapshot.exclusiveToVariants.length && !includesAny(profile.variants, snapshot.exclusiveToVariants)) {
      return { ok: false, reason: "需要对应角色形态", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && snapshot.exclusiveToArchetypes.length && !includesAny(profile.archetypes, snapshot.exclusiveToArchetypes)) {
      return { ok: false, reason: "需要对应角色原型", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.forbiddenArchetypes.length && includesAny(profile.archetypes, snapshot.forbiddenArchetypes)) {
      return { ok: false, reason: "当前角色原型禁止此卡", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && policy.denyCardTypes.includes(snapshot.cardType)) {
      return { ok: false, reason: "当前角色不能使用该卡牌类型", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && includesAny(snapshot.tags, policy.denyTags)) {
      return { ok: false, reason: "标签不符合当前角色特性", profile: profile, snapshot: snapshot };
    }
    var traitPool = uniqueList(profile.traits.concat(profile.archetypes, profile.techniqueFamilies));
    if (!forceAllowed && snapshot.requiredTraits.length && !includesAll(traitPool, snapshot.requiredTraits)) {
      return { ok: false, reason: "缺少必要角色特质", profile: profile, snapshot: snapshot };
    }
    if (!forceAllowed && snapshot.forbiddenTraits.length && includesAny(traitPool, snapshot.forbiddenTraits)) {
      return { ok: false, reason: "角色特质与此卡冲突", profile: profile, snapshot: snapshot };
    }
    if (!specialOwnershipBypass && snapshot.requiresCe && !profile.hasCe) return { ok: false, reason: "需要正常咒力流动", profile: profile, snapshot: snapshot };
    if (!specialOwnershipBypass && snapshot.requiresInnateTechnique && !profile.hasInnateTechnique) return { ok: false, reason: "需要生得术式", profile: profile, snapshot: snapshot };
    if (!specialOwnershipBypass && snapshot.requiresDomainAccess && !profile.hasDomainAccess) return { ok: false, reason: "需要领域能力", profile: profile, snapshot: snapshot };
    if (!specialOwnershipBypass && snapshot.requiresCursedTool && !profile.usesCursedTools) return { ok: false, reason: "需要咒具适性或咒具状态", profile: profile, snapshot: snapshot };
    if (!specialOwnershipBypass && snapshot.requiresZeroCe && !profile.isZeroCe) return { ok: false, reason: "仅零咒力个体可用", profile: profile, snapshot: snapshot };
    return { ok: true, reason: "", profile: profile, snapshot: snapshot };
  }

  function isDuelCardEligibleForCharacter(actionOrCandidate, characterOrActor, options) {
    return getDuelCardEligibilityDecision(actionOrCandidate, characterOrActor, options).ok;
  }

  function isStrictHandCandidateEligible(candidate, actor, opponent, battle, rules) {
    return isDuelCardEligibleForCharacter(candidate, actor, {
      rules: rules,
      opponent: opponent,
      battle: battle
    });
  }

  function isDuelActionEligibleForCharacter(action, characterOrActor, options) {
    return isDuelCardEligibleForCharacter(action, characterOrActor, options);
  }

  function computeDuelCharacterCardWeight(candidate, profile, rules) {
    var snapshot = getCandidateCardRuleSnapshot(candidate, rules);
    var policy = getCharacterRuleAllowDeny(profile, rules);
    var defaults = rules?.defaults || {};
    var weight = getBattleRuntimeActionWeight(candidate, defaults.baseWeight ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) weight = Number(defaults.baseWeight || 1);
    var boost = 0;
    if (includesAny(snapshot.tags, policy.weightBoostTags)) boost += Number(defaults.tagBoost || 1.75);
    if (includesAny(snapshot.tags, policy.weightPenaltyTags)) boost += Number(defaults.tagPenalty || -1.1);
    if (includesAny(snapshot.exclusiveToArchetypes, profile.archetypes)) boost += Number(defaults.exclusiveBoost || 2.5);
    profile.archetypes.forEach(function addArchetypeBoost(archetypeId) {
      var archetype = rules?.archetypes?.[archetypeId] || {};
      if (includesAny(snapshot.tags, archetype.weightBoostTags)) boost += Number(defaults.archetypeBoost || 2.25);
      if (includesAny(snapshot.tags, archetype.weightPenaltyTags)) boost += Number(defaults.tagPenalty || -1.1);
    });
    var finalWeight = Math.max(Number(defaults.minimumWeight || 0.05), weight + boost);
    return Number(finalWeight.toFixed(4));
  }

  function applyDuelCharacterCardWeights(candidates, characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    var profile = buildDuelEffectiveCharacterCardProfile(characterOrActor, options?.battle, rules, options?.profile);
    return (candidates || []).map(function addWeight(candidate) {
      var weight = computeDuelCharacterCardWeight(candidate, profile, rules);
      return {
        ...candidate,
        characterWeight: weight,
        weight: weight,
        characterCardProfile: profile,
        characterCardArchetypes: profile.archetypes
      };
    });
  }

  function recordFilteredDuelHandCandidates(battle, actor, filtered) {
    if (!battle || !actor || !Array.isArray(filtered)) return;
    var side = getActorSide(actor, {});
    battle.characterCardFilterDebug ||= {};
    battle.characterCardFilterDebug[side] = filtered.slice(0, 40);
  }

  function filterDuelHandCandidatesByCharacter(candidates, characterOrActor, options) {
    var rules = options?.rules || getDuelCharacterCardRules();
    if (rules?.defaults?.enabled === false) return candidates || [];
    var profile = options?.profile || buildDuelCharacterCardProfile(characterOrActor, { rules: rules });
    var filtered = [];
    var kept = (candidates || []).filter(function keepCandidate(candidate) {
      var decision = getDuelCardEligibilityDecision(candidate, characterOrActor, { rules: rules, profile: profile, battle: options?.battle });
      if (decision.ok) return true;
      filtered.push({
        actionId: decision.snapshot?.actionId || candidate?.actionId || candidate?.id || "",
        label: decision.snapshot?.label || candidate?.label || candidate?.id || "",
        reason: decision.reason,
        characterId: profile.characterId,
        archetypes: profile.archetypes
      });
      return false;
    });
    recordFilteredDuelHandCandidates(options?.battle || getBattle(options?.duelState), characterOrActor, filtered);
    return kept;
  }

  function getCandidateCardType(candidate) {
    var action = getActionFromEntry(candidate);
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    var template = templateGetter ? templateGetter(candidate) || templateGetter(action) : null;
    return candidate?.cardType || template?.cardType || inferFallbackCardType(action);
  }

  function normalizeDomainControlToken(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getDomainControlCandidateIds(candidate) {
    var action = getActionFromEntry(candidate);
    return [
      getActionId(candidate),
            candidate?.actionId,
      candidate?.id,
      candidate?.cardId,
            action?.actionId,
      action?.id,
      action?.cardId
    ].flatMap(function expandCardId(value) {
      var token = normalizeDomainControlToken(value);
      return token.startsWith("card_") ? [token, token.slice(5)] : [token];
     }).filter(Boolean);
  }

  function getDomainControlCandidateTags(candidate) {
    var action = getActionFromEntry(candidate);
    return []
      .concat(asList(candidate?.tags))
      .concat(asList(action?.tags))
      .concat(asList(candidate?.specialHandTags), asList(candidate?.["特殊手札"]))
      .concat(asList(action?.specialHandTags), asList(action?.["特殊手札"]))
      .map(normalizeDomainControlToken)
      .filter(Boolean);
  }

  function getDomainControlCandidateContexts(candidate) {
    var action = getActionFromEntry(candidate);
    return []
      .concat(getBattleRuntimeActionContexts(candidate))
      .concat(getBattleRuntimeActionContexts(action))
      .map(normalizeDomainControlToken)
      .filter(Boolean);
  }

  function hasExclusiveDomainHandContext(contexts) {
    var set = new Set(contexts || []);
    if (set.has("normal") || set.has("trial_allowed")) return false;
    return ["domain", "domain_active", "domain_owner", "domain_profile"].some(function hasContext(context) {
      return set.has(context);
    });
  }

  function hasDomainOwnerProfileContext(contexts) {
    var set = new Set(contexts || []);
    return set.has("domain_owner") || set.has("domain_profile") || set.has("domain_active");
  }

  function isExplicitDomainControlCardType(cardType) {
    return ["domain", "domain_maintenance"].includes(cardType);
  }

  function isDomainControlHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var cardType = normalizeDomainControlToken(getCandidateCardType(candidate) || action?.cardType || action?.type || "");
    var ids = getDomainControlCandidateIds(candidate);
    var contexts = getDomainControlCandidateContexts(candidate);
    if (ids.some(function hasDomainControlId(id) { return domainControlHandActionIds.has(id); })) return true;
    if (candidate?.domainHand || action?.domainHand) return true;
    if (isExplicitDomainControlCardType(cardType) && hasExclusiveDomainHandContext(contexts)) return true;
    var hasControlTag = getDomainControlCandidateTags(candidate).some(function hasDomainControlTag(tag) {
      return domainControlHandTags.has(tag);
    });
    if (!hasControlTag) return false;
    return cardType === "domain_maintenance" ||
      ids.some(function hasDomainControlPrefix(id) {
        return /^domain_(expand|compress|force_sustain|release|clash|survival)/.test(id);
      });
  }

  function isDomainHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var cardType = normalizeDomainControlToken(getCandidateCardType(candidate) || action?.cardType || action?.type || "");
    if (["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return false;
    if (action?.rikaArsenalFreeUse || candidate?.rikaArsenalFreeUse) return false;
    if (action?.domainSpecific || candidate?.domainSpecific) return true;
    if (action?.techniqueFeatureHand && action?.normalHandOnly && !action?.effects?.activateDomain) return false;
    return isDomainControlHandCandidate(candidate);
  }

  function getActorDomainText(actor) {
    var profile = buildDuelCharacterCardProfile(actor);
    return [
      actor?.characterCardProfile?.domainProfile,
      actor?.characterCardProfile?.domainScript?.domainName,
      actor?.domainProfile,
      actor?.profile?.domainProfile,
      actor?.domainScript?.domainName,
      actor?.profile?.domainScript?.domainName,
      profile?.domainProfile,
      profile?.domainScript?.domainName
    ].filter(Boolean).join(" ");
  }

  function getDomainHandSpecialtyBonus(candidate, actor, rules) {
    var handRules = rules || getDuelHandRules();
    var text = getActorDomainText(actor);
    var id = getActionId(candidate);
    var action = getActionFromEntry(candidate);
    var profile = buildDuelCharacterCardProfile(actor);
    var hasDomainAccess = Boolean(profile?.hasDomainAccess);
    var hasNamedDomain = hasDomainAccess && !/未公开|未知|无领域|没有领域|不具备领域/.test(text);
    var bonus = hasDomainAccess ? Number(handRules.domainHand?.domainAccessWeightBonus || 1) : 0;
    if (hasNamedDomain && (id === "domain_expand" || action?.effects?.activateDomain)) {
      bonus += Number(handRules.domainHand?.specialDomainWeightBonus || 2);
    }
    if (hasNamedDomain && /domain_(compress|force_sustain|release)|domain_clash/.test(id)) {
      bonus += Number(handRules.domainHand?.specialDomainWeightBonus || 2) * 0.55;
    }
    return bonus;
  }

  function splitNormalAndDomainCandidates(candidates) {
    var normal = [];
    var domain = [];
    (candidates || []).forEach(function splitCandidate(candidate) {
      if (isDomainHandCandidate(candidate)) domain.push(candidate);
      else normal.push(candidate);
    });
    return { normal: normal, domain: domain };
  }

  function isDomainActiveForActor(actor) {
    return Boolean(actor?.domain?.active || actor?.profile?.domain?.active);
  }

  function isOpponentDomainActiveForHand(opponent) {
    return Boolean(opponent?.domain?.active || opponent?.profile?.domain?.active);
  }

  function isDomainMaintenanceHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var cardType = normalizeDomainControlToken(getCandidateCardType(candidate) || action?.cardType || action?.type || "");
    var id = getActionId(candidate);
    var contexts = getDomainControlCandidateContexts(candidate);
    // Direct cards that explicitly require an already-active domain are the
    // owner's active-domain attacks/maintenance cards.  They belong in the
    // domain hand even when they are data-driven cards rather than actions
    // generated from a domain profile state.
    if (action?.requirements?.domainActive === true || candidate?.requirements?.domainActive === true) return true;
    if (isExplicitDomainControlCardType(cardType) && hasExclusiveDomainHandContext(contexts) && hasDomainOwnerProfileContext(contexts)) return true;
    return ["domain_compress", "domain_force_sustain", "domain_release"].includes(id);
  }

  function isDomainResponseHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    return ["domain_clash", "simple_domain_guard", "hollow_wicker_basket_guard", "falling_blossom_emotion", "zero_ce_domain_bypass", "domain_survival_guard"].includes(id) ||
      Boolean(action?.requirements?.opponentDomainActive);
  }

  function isPreDomainDomainHandCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    if (action?.domainSpecific || candidate?.domainSpecific) return false;
    var id = getActionId(candidate);
    return ["domain_expand", "simple_domain_guard", "hollow_wicker_basket_guard"].includes(id);
  }

  function isActiveDomainSpecificCandidate(candidate, actor, battle) {
    var action = getActionFromEntry(candidate);
    if (!action?.domainSpecific && !candidate?.domainSpecific) return false;
    if (!actor?.side || !isDomainActiveForActor(actor)) return false;
    var stateEntry = battle?.domainProfileStates?.[actor.side] || {};
    if (!stateEntry?.ownerSide && !stateEntry?.domainId && !stateEntry?.profile?.id) return false;
    var ownerSide = action?.domainOwnerSide || candidate?.domainOwnerSide || stateEntry.ownerSide || actor.side;
    if (ownerSide && ownerSide !== actor.side) return false;
    var actionProfileId = action?.domainProfileId || candidate?.domainProfileId || "";
    var activeProfileId = stateEntry.domainId || stateEntry.profile?.id || "";
    var actionId = getActionId(candidate);
    if (actionId === "shikigami_surge" && activeProfileId !== "dagon_horizon_of_captivating_skandha") return false;
    if (actionProfileId && activeProfileId && actionProfileId !== activeProfileId) return false;
    var actionDomainName = action?.domainName || candidate?.domainName || "";
    var activeDomainNames = [
      stateEntry.domainName,
      stateEntry.profile?.domainName,
      stateEntry.profile?.label,
      stateEntry.profile?.name
    ].filter(Boolean).map(function normalizeName(name) { return String(name).trim(); });
    if (!actionProfileId) {
      if (!actionDomainName) return false;
      if (activeDomainNames.length && !activeDomainNames.includes(String(actionDomainName).trim())) return false;
    } else if (actionDomainName && activeDomainNames.length && !activeDomainNames.includes(String(actionDomainName).trim())) {
      return false;
    }
    return Boolean(actionProfileId || actionDomainName);
  }

  function filterDomainCandidatesByPhase(domainCandidates, actor, opponent, battle) {
    var candidates = domainCandidates || [];
    if (isDomainActiveForActor(actor)) {
      var opponentDomainActive = isOpponentDomainActiveForHand(opponent);
      return candidates.filter(function keepActiveDomainHand(candidate) {
        if (isActiveDomainSpecificCandidate(candidate, actor, battle)) return true;
        if (isDomainMaintenanceHandCandidate(candidate)) return true;
        if (isDomainResponseHandCandidate(candidate)) return opponentDomainActive;
        return false;
      });
    }
    return candidates.filter(isPreDomainDomainHandCandidate);
  }

  function getActiveTrialSubPhaseForActor(actor, battle) {
    var subPhase = battle?.domainSubPhase;
    if (!actor || subPhase?.type !== "trial" || subPhase.verdictResolved) return null;
    return actor.side === subPhase.owner || actor.side === subPhase.defender ? subPhase : null;
  }

  function isStrictTrialHandCandidate(candidate, actor, battle) {
    var subPhase = getActiveTrialSubPhaseForActor(actor, battle);
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    if (!subPhase) return false;
    if (!action?.domainSpecific || action.domainClass !== "rule_trial") return false;
    if (actor.side === subPhase.owner) {
      return ["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict", "object_confiscation", "tool_function_lock", "wielder_liability", "controller_redirect", "summon_suppression"].includes(id);
    }
    if (actor.side === subPhase.defender) {
      return ["defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial", "curse_argument", "distort_residue", "curse_pressure", "instinctive_struggle", "curse_fluctuation", "flee_exorcism", "proxy_denial"].includes(id);
    }
    return false;
  }

  function isRuleTrialCardLike(candidate) {
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    var text = [
      id,
      action?.label,
      action?.name,
      action?.cardType,
      action?.domainClass,
      action?.domainRole
    ].concat(asList(action?.tags), asList(action?.contexts)).filter(Boolean).join(" ");
    if (action?.domainSpecific && action.domainClass === "rule_trial") return true;
    if (["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict", "defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial", "curse_argument", "distort_residue", "curse_pressure", "instinctive_struggle", "curse_fluctuation", "flee_exorcism", "proxy_denial", "object_confiscation", "tool_function_lock", "wielder_liability", "controller_redirect", "summon_suppression"].includes(id)) return true;
    return /rule_trial|rule_defense|trial_owner|trial_defender|审判|辩护|裁定|证据|指控/.test(text);
  }

  function isJackpotSubPhaseCardLike(candidate) {
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    var text = [
      id,
      action?.label,
      action?.name,
      action?.cardType,
      action?.domainClass,
      action?.domainRole
    ].concat(asList(action?.tags), asList(action?.contexts)).filter(Boolean).join(" ");
    if (action?.domainSpecific && action.domainClass === "jackpot_rule") return true;
    if (["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot", "advance_jackpot_cycle"].includes(id)) return true;
    return /jackpot_rule|jackpot_owner|坐杀搏徒|抽奖|中奖|概率|连续演出/.test(text);
  }

  function filterInactiveRuleSubphaseCards(candidates, actor, battle) {
    var trialActive = Boolean(getActiveTrialSubPhaseForActor(actor, battle));
    var jackpotActive = Boolean(getActiveJackpotSubPhaseForActor(actor, battle));
    return (candidates || []).filter(function keepCandidate(candidate) {
      if (!trialActive && isRuleTrialCardLike(candidate)) return false;
      if (!jackpotActive && isJackpotSubPhaseCardLike(candidate)) return false;
      return true;
    });
  }

  function shouldReplaceHandWithTrialCards(actor, battle) {
    var subPhase = getActiveTrialSubPhaseForActor(actor, battle);
    if (!subPhase) return false;
    return actor.side === subPhase.owner || actor.side === subPhase.defender;
  }

  function filterStrictTrialHandCandidates(candidates, actor, battle) {
    if (!shouldReplaceHandWithTrialCards(actor, battle)) return candidates || [];
    return (candidates || []).filter(function keepTrialCandidate(candidate) {
      return isStrictTrialHandCandidate(candidate, actor, battle);
    });
  }

  function getActiveJackpotSubPhaseForActor(actor, battle) {
    var subPhase = battle?.domainSubPhase;
    if (!actor || subPhase?.type !== "jackpot" || subPhase.jackpotResolved) return null;
    return actor.side === subPhase.owner ? subPhase : null;
  }

  function isStrictJackpotHandCandidate(candidate, actor, battle) {
    var subPhase = getActiveJackpotSubPhaseForActor(actor, battle);
    var action = getActionFromEntry(candidate);
    var id = getActionId(candidate);
    if (!subPhase) return false;
    if (!action?.domainSpecific || action.domainClass !== "jackpot_rule") return false;
    return ["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot", "advance_jackpot_cycle"].includes(id);
  }

  function shouldReplaceHandWithJackpotCards(actor, battle) {
    return Boolean(getActiveJackpotSubPhaseForActor(actor, battle));
  }

  function filterStrictJackpotHandCandidates(candidates, actor, battle) {
    if (!shouldReplaceHandWithJackpotCards(actor, battle)) return candidates || [];
    return (candidates || []).filter(function keepJackpotCandidate(candidate) {
      return isStrictJackpotHandCandidate(candidate, actor, battle);
    });
  }

  function shouldReplaceHandWithRuleSubphaseCards(actor, battle) {
    return shouldReplaceHandWithTrialCards(actor, battle) || shouldReplaceHandWithJackpotCards(actor, battle);
  }

  function getCurrentTrialReplacementHandCards(actor, battle, side, rules) {
    var hand;
    if (!shouldReplaceHandWithTrialCards(actor, battle)) return [];
    hand = getPersistentHandState(battle, side || actor?.side || "left", rules);
    if (Number(hand?.round || 0) !== getTurnNumber(battle)) return [];
    return (hand.cards || []).filter(function keepTrialReplacement(card) {
      return card?.handSource === "trial-replacement" && (card?.domainClass === "rule_trial" || card?.domainSpecific);
    });
  }

  function normalizeRefreshedTrialHandAction(template, profile, subPhase, side, round) {
    var isDefender = side === subPhase?.defender;
    if (!template?.id || !profile || !subPhase) return null;
    return {
      ...template,
      action: null,
      actionId: template.id,
      status: "CANDIDATE",
      cost: template.cost || { ceRatio: 0.03, minCe: 0 },
      effects: template.effects || {},
      requirements: { ...(template.requirements || {}), domainSpecific: true },
      domainSpecific: true,
      domainProfileId: profile.id || subPhase.domainId || "",
      domainName: profile.domainName || subPhase.domainName || "",
      domainClass: profile.domainClass || "rule_trial",
      domainRole: template.role || "",
      trialEligibility: template.trialEligibility || subPhase.trialEligibility || null,
      trialSubjectType: template.trialSubjectType || subPhase.trialSubjectType || "",
      canDefend: template.canDefend ?? subPhase.canDefend,
      canRemainSilent: template.canRemainSilent ?? subPhase.canRemainSilent,
      verdictVocabulary: template.verdictVocabulary || subPhase.verdictVocabulary || null,
      tags: isDefender ? ["抗审判"] : ["审判"],
      handSource: "trial-replacement",
      drawnRound: round,
      selectedRound: 0
    };
  }

  function rebuildTrialReplacementHandCards(actor, battle, side, rules) {
    var subPhase = getActiveTrialSubPhaseForActor(actor, battle);
    var stateEntry = subPhase ? battle?.domainProfileStates?.[subPhase.owner] : null;
    var profile = stateEntry?.profile || (battle?.domainProfileState?.ownerSide === subPhase?.owner ? battle.domainProfileState.profile : null);
    var actorSide = side || actor?.side || "left";
    var templates;
    var round;
    var cards;
    var hand;
    if (!subPhase || !profile) return [];
    if (actorSide === subPhase.owner) {
      templates = profile.domainActions || [];
    } else if (actorSide === subPhase.defender) {
      templates = profile.opponentActions || [];
    } else {
      return [];
    }
    round = getTurnNumber(battle);
    cards = templates.map(function mapTrialTemplate(template) {
      return normalizeRefreshedTrialHandAction(template, profile, subPhase, actorSide, round);
     }).filter(Boolean);
    hand = getPersistentHandState(battle, actorSide, rules);
    hand.cards = cards;
    hand.round = round;
    hand.lastDrawn = cards.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
    });
    hand.lastInjected = cards.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card), source: actorSide === subPhase.defender ? "anti-trial" : "trial" };
    });
    hand.lastDiscarded = [];
    hand.pendingDiscardCount = 0;
    hand.overflowDiscardRequired = false;
    return cards;
  }

  function filterStrictRuleSubphaseHandCandidates(candidates, actor, battle) {
    if (shouldReplaceHandWithTrialCards(actor, battle)) return filterStrictTrialHandCandidates(candidates, actor, battle);
    if (shouldReplaceHandWithJackpotCards(actor, battle)) return filterStrictJackpotHandCandidates(candidates, actor, battle);
    return candidates || [];
  }

  function isTechniquePriorityHandCandidate(candidate) {
    var action = getActionFromEntry(candidate) || {};
    var cardType = String(candidate?.cardType || action.cardType || candidate?.type || action.type || "").toLowerCase();
    var tags = []
      .concat(asList(candidate?.tags), asList(action.tags))
      .concat(asList(candidate?.specialHandTags), asList(candidate?.["特殊手札"]))
      .concat(asList(action.specialHandTags), asList(action["特殊手札"]));
    var text = [
      candidate?.id,
            candidate?.cardId,
      candidate?.label,
      candidate?.name,
      action.id,
      
      action.cardId,
      action.label,
      action.name,
      action.techniqueName,
      action.sourceTechniqueFamily
    ].concat(tags).join(" ");
    if (action.techniqueFeatureHand || action.featureTechniqueHand || candidate?.techniqueFeatureHand || candidate?.featureTechniqueHand) return true;
    var profileFamilies = asList(candidate?.characterCardProfile?.techniqueFamilies);
    if (profileFamilies.length && includesAny(tags, profileFamilies)) return true;
    if ((action.specialHandCard || candidate?.specialHandCard || tags.includes("特色手札") || tags.includes("特殊手札")) && /technique|术式|術式|咒法|咒術|咒术/i.test(cardType + " " + text)) return true;
    return false;
  }

  function getTechniqueHandPriorityBonus(candidate) {
    if (!isTechniquePriorityHandCandidate(candidate)) return 0;
    return Number(getDuelCharacterCardRules()?.defaults?.techniqueHandPriorityBonus || 160);
  }

  function getDuelTechniqueHandWeightScale(resource, battle) {
    var turn = getTurnNumber(battle);
    var scale = 1;
    (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).forEach(function multiplyActiveTechniqueWeight(effect) {
      var statusScale = Number(effect?.techniqueWeightScale);
      var triggerRound = Number(effect?.triggerRound || 0);
      if (!Number.isFinite(statusScale) || statusScale <= 0 || Number(effect?.rounds || 0) <= 0) return;
      if (triggerRound && triggerRound > turn) return;
      scale *= statusScale;
    });
    return Number(Math.min(2, Math.max(0.1, scale)).toFixed(4));
  }

  function applyDuelTechniqueHandWeightScale(candidate, score, resource, battle) {
    if (!isTechniquePriorityHandCandidate(candidate)) return Number(score || 0);
    return Number((Number(score || 0) * getDuelTechniqueHandWeightScale(resource, battle)).toFixed(4));
  }

  function isSupplementalNonTechniqueHandCandidate(candidate) {
    if (isTechniquePriorityHandCandidate(candidate)) return false;
    var action = getActionFromEntry(candidate);
    var cardType = String(candidate?.cardType || action?.cardType || candidate?.type || action?.type || "").toLowerCase();
    var text = collectCandidateSearchText(candidate);
    return /simple[_\s-]?domain|domain_response|简易领域|领域应对|special[_\s-]?constitution|constitution|特殊体质|体质/.test(cardType + " " + text);
  }

  function getNormalHandPriorityBaseScore(candidate) {
    var base = getBattleRuntimeActionWeight(candidate, 0);
    if (!isSupplementalNonTechniqueHandCandidate(candidate)) return base;
    var cap = Number(getDuelCharacterCardRules()?.defaults?.supplementalHandPriorityCap || 70);
    return Math.min(base, cap);
  }

  function getInjectionHandPriorityScore(candidate, injectionWeight) {
    var base = Math.max(getNormalHandPriorityBaseScore(candidate), Number(injectionWeight || 0));
    if (!isSupplementalNonTechniqueHandCandidate(candidate)) return base;
    var cap = Number(getDuelCharacterCardRules()?.defaults?.supplementalHandPriorityCap || 70);
    return Math.min(base, cap);
  }

  function rankDuelHandCandidatesByCharacter(fullCandidates, preferredActions, actor, opponent, battle, choiceCount, options) {
    var preferredIndex = Object.create(null);
    (preferredActions || []).forEach(function indexPreferred(action, index) {
      var id = getActionId(action);
      if (id && preferredIndex[id] === undefined) preferredIndex[id] = index;
    });
    var rules = options?.rules || getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: rules });
    var filtered = filterDuelHandCandidatesByCharacter(fullCandidates, actor, { rules: rules, profile: profile, battle: battle });
    var weighted = applyDuelCharacterCardWeights(filtered, actor, { rules: rules, profile: profile, battle: battle });
    return weighted
      .map(function rankCandidate(candidate, index) {
        var id = getActionId(candidate);
        var preferred = preferredIndex[id] !== undefined;
        var pickerBonus = preferred ? Math.max(0, choiceCount + 3 - Number(preferredIndex[id] || 0) * 0.25) : 0;
        var availabilityBonus = candidate.available ? 2 : -3;
        var domainBonus = options?.domainHand ? getDomainHandSpecialtyBonus(candidate, actor, options?.handRules) : 0;
        var randomBonus = options?.randomize
          ? (battle?.mode === "online" && typeof battle?.rng === "function" ? battle.rng() : Math.random()) * Number(options.randomize || 1)
          : 0;
        var techniquePriorityBonus = options?.domainHand ? 0 : getTechniqueHandPriorityBonus(candidate);
        var baseScore = options?.domainHand ? Number(candidate.weight || candidate.characterWeight || 0) : getNormalHandPriorityBaseScore(candidate);
        var weightedHandScore = options?.domainHand
          ? baseScore + techniquePriorityBonus
          : applyDuelTechniqueHandWeightScale(candidate, baseScore + techniquePriorityBonus, actor, battle);
        var rankScore = weightedHandScore + pickerBonus + availabilityBonus + domainBonus + randomBonus - index * 0.001;
        return { candidate: candidate, rankScore: rankScore };
      })
      .sort(function sortRanked(a, b) {
        return b.rankScore - a.rankScore;
      })
      .map(function unwrap(entry) {
        return entry.candidate;
      });
  }

  function getCandidateSortScore(candidate) {
    var availableBonus = candidate?.available ? 2 : -3;
    return getNormalHandPriorityBaseScore(candidate) + availableBonus + getTechniqueHandPriorityBonus(candidate);
  }

  function normalizePersistentHandCard(candidate, round, source) {
    return {
      ...(candidate || {}),
      handSource: source || candidate?.handSource || "draw",
      drawnRound: Number(candidate?.drawnRound || round || 0),
      retained: source === "retained" || Boolean(candidate?.retained)
    };
  }

  function getAllRikaArsenalSpecialCardPool() {
    var authoritativePoolBuilder = global.JJKDuelActions?.getCopyableTechniqueCardPool;
    if (typeof authoritativePoolBuilder === "function") {
      return authoritativePoolBuilder({ attacksOnly: false });
    }
    var source = dependencies.state?.battleCards;
    var cards = Array.isArray(source?.cards) ? source.cards : (Array.isArray(source) ? source : []);
    return cards.filter(function keepRikaArsenalCandidate(card) {
      if (!card || card.playableInHandBeta === false) return false;
      if (!card.cardId && !card.id && !card.actionId) return false;
      if (card.importableFromMergedPackage === false || card.reviewStatus === "needs_merge" || card.duplicateStatus === "exact_duplicate") return false;
      var cardType = String(card.cardType || card.type || "").toLowerCase();
      if (["unit", "maintenance"].includes(cardType)) return false;
      var tags = uniqueList([].concat(asList(card.tags), asList(card.specialHandTags), asList(card["特殊手札"])));
      return tags.length > 0 && (tags.includes("特殊手札") || tags.includes("特色手札") || asList(card.specialHandTags).length > 0 || asList(card["特殊手札"]).length > 0);
    });
  }

  function pickRikaArsenalSpecialCard(battle, side, pending) {
    var pool = getAllRikaArsenalSpecialCardPool();
    if (!pool.length) return null;
    var authorizedCardId = String(pending?.drawnCardId || "");
    if (authorizedCardId) {
      var authorizedCard = pool.find(function findAuthorizedCopy(card) {
        return [card?.id, card?.cardId, card?.actionId].some(function matchesId(value) {
          return String(value || "") === authorizedCardId;
        });
      });
      if (authorizedCard) return authorizedCard;
    }
    var seedText = [
      battle?.onlineBattleSeed || battle?.battleSeed || battle?.seed,
      battle?.battleId,
      side,
      pending?.id,
      pending?.createdRound,
      pending?.triggerRound,
      pool.length
    ].filter(Boolean).join("|");
    var hash = 0;
    for (var index = 0; index < seedText.length; index += 1) {
      hash = ((hash << 5) - hash + seedText.charCodeAt(index)) | 0;
    }
    var randomIndex = seedText ? Math.abs(hash) % pool.length : Math.floor(Math.random() * pool.length);
    return pool[randomIndex] || pool[0] || null;
  }

  function isRikaArsenalSpecialResourceCopiedCard(card) {
    var text = [
      card?.id,
            card?.cardId,
      card?.name,
      card?.label,
      card?.effectSummary,
      card?.description,
      card?.cardType,
      card?.type
    ].concat(asList(card?.tags), asList(card?.specialHandTags), asList(card?.["特殊手札"])).join(" ").toLowerCase();
    if (/blood_manipulation|赤血操术|穿血|血刃|百敛|超新星|赤鳞跃动|胀相|脹相|加茂宪纪|加茂憲紀/.test(text)) return false;
    return /star_rage|星之怒|虚拟质量|black_bird_manipulation|黑鸟操术|乌羽|projection_sorcery|投射术式|投射咒法|帧率|maximum_uzumaki|极之番.*涡|咒灵操术/.test(text);
  }

  function buildRikaArsenalFreeHandCard(card, round, side, pending) {
    if (!card) return null;
    var originalCardIdentity = card.cardId || card.id || card.actionId || "";
    var freeId = ["rika_arsenal_free", side || "side", round || 0, originalCardIdentity || "card"].join("_").replace(/[^\w\u4e00-\u9fa5-]+/g, "_");
    var originalCeCost = getBattleRuntimeActionCostCe(card, 0) || 0;
    var specialResourceResolver = global.JJKDuelActions?.isCopiedTechniqueSpecialResourceCard;
    var specialResourceBypass = typeof specialResourceResolver === "function"
      ? specialResourceResolver(card)
      : isRikaArsenalSpecialResourceCopiedCard(card);
    return normalizePersistentHandCard({
      ...clonePlain(card),
      id: freeId,
      actionId: freeId,
      cardId: originalCardIdentity,
      originalCardId: card.cardId || originalCardIdentity || "",
      label: "里香武库：" + (card.name || card.cardName || originalCardIdentity || "特殊手札"),
      name: card.name || card.cardName || "特殊手札",
      description: card.effectSummary || card.shortEffect || card.description || "由里香武库临时调取。",
      effectSummary: (card.effectSummary || card.shortEffect || card.description || "") + (specialResourceBypass
        ? "（里香武库调取：本次打出不消耗咒力；非赤血特殊资源限制视为已满足，伤害减半。）"
        : "（里香武库调取：本次打出不消耗咒力。）"),
      cardType: card.cardType || card.cardIntent || "technique",
      type: "feature_technique",
      apCost: Math.max(1, Number(card.apCost || 1) || 1),
      ceCost: 0,
      costCe: 0,
      cost: { ...(clonePlain(card.cost || {})), ce: 0 },
      costType: "zero_ce",
      zeroCeCostOverride: true,
      rikaArsenalFreeUse: true,
      rikaArsenalCopiedSpecialResourceBypass: specialResourceBypass,
      rikaArsenalCopyDamageScale: specialResourceBypass ? 0.5 : 1,
      rikaArsenalOriginalCeCost: originalCeCost,
      rikaArsenalSourcePendingId: pending?.id || "",
      rikaArsenalExpiresAfterRound: round,
      expiresAfterRound: round,
      noRefresh: true,
      specialHandCard: true,
      normalHandOnly: true,
      techniqueFeatureHand: Boolean(card.techniqueFeatureHand),
      tags: uniqueList([].concat(asList(card.tags), ["里香武库调取", "免咒力"])),
      specialHandTags: uniqueList([].concat(asList(card.specialHandTags), asList(card["特殊手札"]))),
      "特殊手札": uniqueList([].concat(asList(card.specialHandTags), asList(card["特殊手札"]))),
      contexts: Array.isArray(card.contexts) ? card.contexts.slice() : ["normal"],
      requirements: clonePlain(card.requirements || {}),
      effects: {
        ...clonePlain(card.effects || {}),
        rikaArsenalFreeUse: true,
        rikaArsenalCopiedSpecialResourceBypass: specialResourceBypass,
        rikaArsenalCopyDamageScale: specialResourceBypass ? 0.5 : 1
      },
      summonSpec: clonePlain(card.summonSpec || undefined),
      mechanismSpec: clonePlain(card.mechanismSpec || undefined),
      resourceSpec: clonePlain(card.resourceSpec || undefined),
      serviceReceiptRules: clonePlain(card.serviceReceiptRules || undefined),
      massiveObjectRules: clonePlain(card.massiveObjectRules || undefined),
      objectRules: clonePlain(card.objectRules || undefined),
      unitStats: clonePlain(card.unitStats || undefined),
      projectionSorcery: clonePlain(card.projectionSorcery || undefined),
      specialResolution: clonePlain(card.specialResolution || undefined),
      mahoragaProxySpec: clonePlain(card.mahoragaProxySpec || undefined),
      damage: Math.max(0, getBattleRuntimeActionDamage(card, 0) || 0),
      block: Math.max(0, getBattleRuntimeActionBlock(card, 0) || 0),
      effect: { ...(card.effect || {}), damage: Math.max(0, getBattleRuntimeActionDamage(card, 0) || 0), block: Math.max(0, getBattleRuntimeActionBlock(card, 0) || 0) },
      baseStabilityDamage: Math.max(0, Number(card.baseStabilityDamage || 0) || 0),
      baseCeDamage: Math.max(0, Number(card.baseCeDamage || 0) || 0),
      baseDomainLoadDelta: Number(card.baseDomainLoadDelta || 0) || 0,
      baseDomainPressure: Number(card.baseDomainPressure || 0) || 0,
      baseHealing: Math.max(0, Number(card.baseHealing || 0) || 0),
      durationRounds: Math.max(0, Number(card.durationRounds || 0) || 0),
      damageType: card.damageType || "none",
      scalingProfile: card.scalingProfile || "techniquePower + control",
      accuracyProfile: card.accuracyProfile || (getBattleRuntimeActionDamage(card, 0) > 0 ? "technique_projectile" : "none"),
      evasionAllowed: card.evasionAllowed !== false && getBattleRuntimeActionDamage(card, 0) > 0,
      hitRateModifier: Number(card.hitRateModifier || 0) || 0,
      risk: card.risk || "medium",
      rarity: card.rarity || "rare",
      weight: Math.max(99, getBattleRuntimeActionWeight(card, 99) || 99),
      handSource: "rika-arsenal-free-special",
      generatedBy: "里香武库"
    }, round, "rika-arsenal-free-special");
  }

  function injectRikaArsenalPendingCards(hand, actor, battle, round) {
    var side = actor?.side || "";
    var pendingList = side ? (battle?.rikaArsenalPending?.[side] || []) : [];
    if (!pendingList.length) return [];
    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var injected = [];
    pendingList.forEach(function consumePending(pending) {
      if (!pending || pending.consumed) return;
      if (Number(pending.triggerRound || 0) > Number(round || 0)) return;
      var sourceCard = pickRikaArsenalSpecialCard(battle, side, pending);
      var freeCard = buildRikaArsenalFreeHandCard(sourceCard, round, side, pending);
      if (!freeCard) return;
      if (existingIds.has(getActionId(freeCard))) return;
      hand.cards.unshift(freeCard);
      existingIds.add(getActionId(freeCard));
      pending.consumed = true;
      pending.consumedRound = round;
      pending.drawnCardId = sourceCard?.cardId || "";
      pending.drawnCardId = sourceCard?.cardId || sourceCard?.id || "";
      pending.drawnName = sourceCard?.name || "";
      injected.push(freeCard);
    });
    if (battle?.rikaArsenalPending?.[side]) {
      battle.rikaArsenalPending[side] = battle.rikaArsenalPending[side].filter(function keepPending(pending) {
        return pending && !pending.consumed;
      });
    }
    return injected;
  }

  function isSpecialTaggedHandCard(card) {
    var action = getActionFromEntry(card) || {};
    var tags = []
      .concat(asList(card?.tags), asList(action?.tags))
      .concat(asList(card?.specialHandTags), asList(card?.["特殊手札"]))
      .concat(asList(action?.specialHandTags), asList(action?.["特殊手札"]));
    return Boolean(
      card?.specialHandCard ||
      action?.specialHandCard ||
      card?.techniqueFeatureHand ||
      action?.techniqueFeatureHand ||
      asList(card?.specialHandTags).length ||
      asList(card?.["特殊手札"]).length ||
      asList(action?.specialHandTags).length ||
      asList(action?.["特殊手札"]).length ||
      tags.includes("特殊手札") ||
      tags.includes("特色手札")
    );
  }

  function isPermanentHandCard(card) {
    if (isSpecialTaggedHandCard(card) && !card?.executionSword && !getActionFromEntry(card)?.executionSword && !card?.retainedSpecialHand && !getActionFromEntry(card)?.retainedSpecialHand) return false;
    return Boolean(card?.noRefresh || card?.retainedPermanent || card?.executionSword);
  }

  function isSummonHandCard(card) {
    var text = [
      card?.cardType,
      card?.type,
      card?.id,
            card?.cardId,
      card?.name,
      card?.label
    ].concat(asList(card?.tags), asList(card?.specialHandTags)).join(" ");
    return Boolean(card?.summonSpec || card?.mahoragaProxySpec || card?.unitStats) ||
      /summon|summon_unit|shikigami|式神|召唤|召喚|魔虚罗|魔須羅|魔须罗|mahoraga/i.test(text);
  }

  function isHandLimitExemptCard(card) {
    if (card?.doesNotCountTowardHandLimit || card?.ignoreHandSizeLimit || card?.ignoreHandLimit) return true;
    var action = getActionFromEntry(card);
    if (action?.doesNotCountTowardHandLimit || action?.ignoreHandSizeLimit || action?.ignoreHandLimit) return true;
    return isPermanentHandCard(card) && !isSummonHandCard(card) && !isSpecialTaggedHandCard(card);
  }

  function getMaintenanceSpec(card) {
    return card?.maintenanceSpec || card?.action?.maintenanceSpec || null;
  }

  function isMaintenanceUnitAlive(battle, unitCardId) {
    if (!unitCardId) return true;
    return (battle?.battlefieldUnits || []).some(function matchUnit(unit) {
      var id = unit?.cardId || unit?.id || "";
      var hp = Number(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0);
      return id === unitCardId && unit?.defeated !== true && unit?.active !== false && hp > 0;
    });
  }

  function isMaintenanceUnitWithTagAlive(battle, unitTag) {
    if (!unitTag) return true;
    return (battle?.battlefieldUnits || []).some(function matchTaggedUnit(unit) {
      var hp = Number(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0);
      var tags = []
        .concat(Array.isArray(unit?.tags) ? unit.tags : [])
        .concat(Array.isArray(unit?.unitStats?.tags) ? unit.unitStats.tags : []);
      return unit?.defeated !== true && unit?.active !== false && hp > 0 && tags.includes(unitTag);
    });
  }

  function isMahoragaProxyProtectingHandSide(battle, side) {
    var proxy = battle?.mahoragaProxy?.[side];
    if (!proxy?.active) return false;
    if (!proxy.unitId) return true;
    return (battle?.battlefieldUnits || []).some(function findProxyUnit(unit) {
      var hp = Number(unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0);
      return unit?.id === proxy.unitId && unit?.defeated !== true && unit?.active !== false && hp > 0;
    });
  }

  function isDuelActorDefeatedForExecution(actor, battle, side) {
    if (!actor) return true;
    if (Number(actor.hp || 0) > 0) return false;
    return !isMahoragaProxyProtectingHandSide(battle, side || actor.side || "");
  }

  function isMaintenanceCardCurrentlyValid(card, battle) {
    var spec = getMaintenanceSpec(card);
    if (spec?.mandatoryWhileAnyUnitTag && !isMaintenanceUnitWithTagAlive(battle, spec.mandatoryWhileAnyUnitTag)) return false;
    if (!spec?.mandatoryWhileUnitActive) return true;
    return isMaintenanceUnitAlive(battle, spec.mandatoryWhileUnitActive);
  }

  function isSkipTurnMaintenance(entry) {
    return Boolean(getMaintenanceSpec(entry)?.skipActiveTurn);
  }

  function getPersistentHandState(battle, side, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    initializeDuelHandState(activeBattle, rules);
    var actorSide = side || "left";
    activeBattle.handState ||= {};
    activeBattle.handState[actorSide] ||= {
      cards: [],
      discardPile: [],
      round: 0,
      lastDrawn: [],
      lastInjected: [],
      lastDiscarded: [],
      maxHandSize: getMaxHandSize(rules),
      drawPerTurn: getDrawPerTurn(rules)
    };
    activeBattle.handState[actorSide].maxHandSize = getMaxHandSize(rules);
    activeBattle.handState[actorSide].drawPerTurn = getDrawPerTurn(rules);
    return activeBattle.handState[actorSide];
  }

  function isOnlineAuthoritativePrivateHandSide(battle, side) {
    var actorSide = side === "right" ? "right" : "left";
    return Boolean(
      battle?.mode === "online" &&
      battle?.onlineAuthoritativePrivateHand === true &&
      battle?.onlineAuthoritativePrivateHandSide === actorSide &&
      !battle?.dounaGauntlet?.online
    );
  }

  function removeCardsFromPersistentHand(battle, side, actionIds, rules) {
    var hand = getPersistentHandState(battle, side, rules);
    if (!hand || !Array.isArray(hand.cards) || !actionIds?.length) return [];
    var ids = new Set(actionIds.filter(Boolean));
    var removed = [];
    hand.cards = hand.cards.filter(function keepCard(card) {
      var id = getActionId(card);
      if (!ids.has(id)) return true;
      if (isPermanentHandCard(card)) {
        card.retained = true;
        card.lastUsedRound = getTurnNumber(battle);
        return true;
      }
      removed.push(card);
      return false;
    });
    return removed;
  }

  function updatePersistentHandOverflow(hand, maxHandSize) {
    if (!hand) return 0;
    var protectedCards = (hand.cards || []).filter(isHandLimitExemptCard);
    var countedCards = (hand.cards || []).length - protectedCards.length;
    var overflow = Math.max(0, countedCards - Number(maxHandSize || hand.maxHandSize || 8));
    hand.pendingDiscardCount = overflow;
    hand.overflowDiscardRequired = overflow > 0;
    return overflow;
  }

  function getCountedPersistentHandSize(hand) {
    if (!hand) return 0;
    return (hand.cards || []).filter(function countCard(card) {
      return !isHandLimitExemptCard(card);
    }).length;
  }

  function canInjectSupplementalNonTechniqueCard(hand, candidate, maxHandSize) {
    if (!isSupplementalNonTechniqueHandCandidate(candidate)) return true;
    return getCountedPersistentHandSize(hand) < Number(maxHandSize || hand?.maxHandSize || 8);
  }

  function rebalanceTechniquePriorityHandCards(hand, rankedCandidates, round) {
    if (!hand || !Array.isArray(hand.cards)) return [];
    var existingIds = new Set(hand.cards.map(getActionId).filter(Boolean));
    var missingTechnique = (rankedCandidates || []).filter(function keepMissingTechnique(candidate) {
      var id = getActionId(candidate);
      return id && !existingIds.has(id) && isTechniquePriorityHandCandidate(candidate);
    });
    if (!missingTechnique.length) return [];
    var replaced = [];
    missingTechnique.forEach(function insertTechnique(candidate) {
      var replaceable = hand.cards
        .map(function mapCard(card, index) {
          return { card: card, index: index, score: getNormalHandPriorityBaseScore(card) };
        })
        .filter(function keepReplaceable(entry) {
          return !isPermanentHandCard(entry.card) &&
            !isTechniquePriorityHandCandidate(entry.card) &&
            isSupplementalNonTechniqueHandCandidate(entry.card);
        })
        .sort(function byWeakest(left, right) {
          return left.score - right.score || left.index - right.index;
        })[0];
      if (!replaceable) return;
      var card = normalizePersistentHandCard(candidate, round, "technique-priority-rebalance");
      hand.cards.splice(replaceable.index, 1, card);
      existingIds.delete(getActionId(replaceable.card));
      existingIds.add(getActionId(card));
      replaced.push({ removed: replaceable.card, added: card });
    });
    return replaced;
  }

  function isRangeAdjustmentCard(card) {
    var action = getActionFromEntry(card);
    var text = collectCandidateSearchText(card);
    return Boolean(
      action?.rangeAdjustment ||
      action?.effects?.rangeAdjustment ||
      /range_adjustment|card_range_adjustment|范围调整/.test(text)
    );
  }

  function discardDuelHandCandidate(actionOrId, actor, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor) return { discarded: false, reason: "战斗资源缺失" };
    var rules = options?.rules || getDuelHandRules();
    var side = getActorSide(actor, options);
    var hand = getPersistentHandState(battle, side, rules);
    var id = typeof actionOrId === "string" ? actionOrId : getActionId(actionOrId);
    if (!id) return { discarded: false, reason: "手札不存在" };
    var index = (hand.cards || []).findIndex(function findCard(card) {
      return getActionId(card) === id;
    });
    if (index < 0) return { discarded: false, reason: "手札不在当前手牌中" };
    if (isPermanentHandCard(hand.cards[index])) return { discarded: false, reason: "该手札为锁定常驻手札，不能弃置" };
    var removed = hand.cards.splice(index, 1)[0];
    var round = getTurnNumber(battle);
    var summary = {
      actionId: getActionId(removed),
      label: removed?.label || removed?.id || getActionId(removed),
      discardedRound: round,
      reason: "manualOverflowDiscard"
    };
    hand.lastDiscarded = [summary];
    hand.discardPile = (hand.discardPile || []).concat(summary);
    updatePersistentHandOverflow(hand, getMaxHandSize(rules));
    invalidateDuelHandCandidateCache(battle);
    return { discarded: true, reason: "", card: removed, side: side, pendingDiscardCount: hand.pendingDiscardCount };
  }

  function getDuelCpuDiscardKeepScore(candidate, actor, opponent, battle) {
    var action = getActionFromEntry(candidate);
    if (!action?.id) return -999;
    var damage = getCpuDamagePriority(candidate);
    var block = getCpuBlockPriority(candidate);
    var type = getCpuActionType(candidate);
    var text = collectCandidateSearchText(candidate);
    var score = getNormalHandPriorityBaseScore(candidate);
    score += damage * 0.9 + block * 0.55;
    if (isPermanentHandCard(candidate)) score += 9999;
    if (isTechniquePriorityHandCandidate(candidate)) score += getTechniqueHandPriorityBonus(candidate);
    if (type.includes("domain") || action.effects?.activateDomain) score += 34;
    if (action.summonSpec || action.mechanismSpec || action.resourceSpec) score += 26;
    if (action.starRageEffect || action.projectionSorcery || action.bloodConversion) score += 24;
    if (/star_rage|projection_sorcery|blood_manipulation|星之怒|投射|赤血|虚拟质量|帧率/.test(text)) score += 18;
    if (action.risk === "critical") score += 8;
    if (action.risk === "high") score += 4;
    if (!damage && !block && !type.includes("support") && !type.includes("resource")) score -= 10;
    return Number(score.toFixed(4));
  }

  function autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules, reason) {
    var hand = getPersistentHandState(battle, side, rules);
    var maxHandSize = getMaxHandSize(rules);
    var overflow = updatePersistentHandOverflow(hand, maxHandSize);
    if (!hand || overflow <= 0) return [];
    var discardable = (hand.cards || []).map(function mapDiscard(card, index) {
      return {
        card: card,
        index: index,
        score: getDuelCpuDiscardKeepScore(card, actor, opponent, battle)
      };
    }).filter(function keepDiscardable(entry) {
      return !isPermanentHandCard(entry.card);
    }).sort(function byLowKeepScore(left, right) {
      return left.score - right.score;
    }).slice(0, overflow);
    var removed = [];
    discardable.sort(function byIndexDesc(left, right) {
      return right.index - left.index;
    }).forEach(function removeEntry(entry) {
      var card = hand.cards.splice(entry.index, 1)[0];
      if (card) removed.push(card);
    });
    if (!removed.length) return [];
    var round = getTurnNumber(battle);
    var summaries = removed.reverse().map(function summarize(card) {
      return {
        actionId: getActionId(card),
        label: card?.label || card?.id || getActionId(card),
        discardedRound: round,
        reason: reason || "cpuOverflowAutoDiscard"
      };
    });
    hand.lastDiscarded = summaries;
    hand.discardPile = (hand.discardPile || []).concat(summaries);
    updatePersistentHandOverflow(hand, maxHandSize);
    invalidateDuelHandCandidateCache(battle);
    battle.cpuOverflowDiscardLog ||= {};
    battle.cpuOverflowDiscardLog[side] = {
      round: round,
      discarded: summaries,
      pendingDiscardCount: hand.pendingDiscardCount
    };
    return summaries;
  }

  function autoDiscardDuelHandOverflow(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor) return [];
    var rules = options?.rules || getDuelHandRules();
    var side = getActorSide(actor, options);
    return autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules, options?.reason || "manualOverflowAutoDiscard");
  }

  function getCandidateAction(candidate) {
    return candidate?.action || candidate || {};
  }

  function collectCandidateSearchText(candidate) {
    var action = getCandidateAction(candidate);
    var parts = [
      action.id,
      action.actionId,
      
      action.cardId,
      action.name,
      action.label,
      action.displayName,
      action.description,
      action.effectSummary,
      candidate?.id,
      candidate?.actionId,
            candidate?.cardId,
      candidate?.label,
      candidate?.name
    ];
    if (Array.isArray(action.tags)) parts = parts.concat(action.tags);
    if (Array.isArray(action.specialHandTags)) parts = parts.concat(action.specialHandTags);
    if (Array.isArray(candidate?.tags)) parts = parts.concat(candidate.tags);
    if (Array.isArray(candidate?.specialHandTags)) parts = parts.concat(candidate.specialHandTags);
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function collectCandidateIdentityText(candidate) {
    var action = getCandidateAction(candidate);
    var parts = [
      action.id,
      action.actionId,
      
      action.cardId,
      action.name,
      action.label,
      action.displayName,
      candidate?.id,
      candidate?.actionId,
            candidate?.cardId,
      candidate?.label,
      candidate?.name
    ];
    if (Array.isArray(action.tags)) parts = parts.concat(action.tags);
    if (Array.isArray(action.specialHandTags)) parts = parts.concat(action.specialHandTags);
    if (Array.isArray(candidate?.tags)) parts = parts.concat(candidate.tags);
    if (Array.isArray(candidate?.specialHandTags)) parts = parts.concat(candidate.specialHandTags);
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function getAtomicHandOpponent(actor, battle) {
    var side = getActorSide(actor, {});
    if (side === "left") return battle?.resourceState?.p2 || battle?.right || null;
    if (side === "right") return battle?.resourceState?.p1 || battle?.left || null;
    return null;
  }

  function getAtomicHandPolicy(candidate, actor, battle, opponent) {
    var policyResolver = global.JJKDuelActions?.getCustomAtomicHandPolicy;
    if (typeof policyResolver !== "function") {
      return { available: true, visible: true, guaranteed: false, removeWhenUnavailable: false, reason: "" };
    }
    var action = getCandidateAction(candidate);
    return policyResolver(action, actor, opponent || getAtomicHandOpponent(actor, battle), battle);
  }

  function filterAtomicHandCandidatesByRuntimeRules(candidates, actor, battle, opponent) {
    return (candidates || []).filter(function keepAtomicCandidate(candidate) {
      return getAtomicHandPolicy(candidate, actor, battle, opponent).visible !== false;
    });
  }

  function isTenShadowsRabbitCandidate(candidate) {
    var text = collectCandidateSearchText(candidate);
    return text.indexOf("rabbit") !== -1 || text.indexOf("脱兔") !== -1;
  }

  function isTenShadowsUniqueShikigamiCandidate(candidate) {
    var action = getCandidateAction(candidate);
    var text = collectCandidateSearchText(candidate);
    var summonSpec = action?.summonSpec || candidate?.summonSpec || {};
    var isTenShadows = text.indexOf("ten_shadows") !== -1 || text.indexOf("十种影") !== -1;
    return Boolean(summonSpec.unitCardId && isTenShadows && !isTenShadowsRabbitCandidate(candidate));
  }

  function getTenShadowsCandidateSummonKey(candidate) {
    var action = getCandidateAction(candidate);
    var summonSpec = action?.summonSpec || candidate?.summonSpec || {};
    return String(
      summonSpec.uniqueSummonKey ||
      summonSpec.unitCardId ||
      action.cardId ||
      candidate?.cardId ||
            action.actionId ||
      candidate?.actionId ||
      action.id ||
      candidate?.id ||
      ""
    );
  }

  function isTenShadowsSummonSpent(candidate, battle, side) {
    var key = getTenShadowsCandidateSummonKey(candidate);
    if (!isTenShadowsUniqueShikigamiCandidate(candidate) || !battle || !side || !key) return false;
    var state = battle.tenShadowsSummonState && battle.tenShadowsSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side || !entry.uniqueTenShadowsSummon) return false;
      return entry.unitCardId === key || entry.cardId === key || entry.actionId === key;
    });
  }

  function filterSpentTenShadowsSummons(candidates, battle, side) {
    return (candidates || []).filter(function keepCandidate(candidate) {
      return !isTenShadowsSummonSpent(candidate, battle, side);
    });
  }

  function isCurseSpiritManipulationUniqueSummonCandidate(candidate) {
    var action = getCandidateAction(candidate);
    var text = collectCandidateSearchText(candidate);
    var summonSpec = action?.summonSpec || candidate?.summonSpec || {};
    var isCurseSpiritManipulation = text.indexOf("curse_spirit_manipulation") !== -1 ||
      text.indexOf("咒灵操术") !== -1 ||
      text.indexOf("虹龙") !== -1 ||
      text.indexOf("口裂女") !== -1 ||
      text.indexOf("化身玉藻前") !== -1 ||
      text.indexOf("低级咒灵") !== -1;
    return Boolean(summonSpec.unitCardId && isCurseSpiritManipulation);
  }

  function getCurseSpiritManipulationCandidateSummonKey(candidate) {
    return getTenShadowsCandidateSummonKey(candidate);
  }

  function isCurseSpiritManipulationSummonSpent(candidate, battle, side) {
    var key = getCurseSpiritManipulationCandidateSummonKey(candidate);
    if (!isCurseSpiritManipulationUniqueSummonCandidate(candidate) || !battle || !side || !key) return false;
    var state = battle.curseSpiritSummonState && battle.curseSpiritSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side || !entry.uniqueCurseSpiritSummon) return false;
      return entry.unitCardId === key || entry.cardId === key || entry.actionId === key;
    });
  }

  function filterSpentCurseSpiritManipulationSummons(candidates, battle, side) {
    return (candidates || []).filter(function keepCandidate(candidate) {
      return !isCurseSpiritManipulationSummonSpent(candidate, battle, side);
    });
  }

  function isYutaRikaManifestationCandidate(candidate) {
    var action = getCandidateAction(candidate);
    var summonSpec = action?.summonSpec || candidate?.summonSpec || {};
    var text = collectCandidateSearchText(candidate);
    return Boolean(summonSpec.unitCardId && /yuta_rika_full_manifestation|yuta_rika_manifestation|祈本里香完全显现/.test(text));
  }

  function getYutaRikaManifestationEra(candidate) {
    var id = getActionId(candidate);
    var text = collectCandidateSearchText(candidate);
    if (/yuta_rika_modern_full_manifestation|yuta_rika_manifestation_modern|rika_modern_full_manifestation|modern_rika|正传/.test(id + " " + text)) return "modern";
    if (/yuta_rika_full_manifestation|yuta_rika_manifestation_volume0|rika_volume0_full_manifestation|volume0_rika|0卷|真里香|特级过咒怨灵-完全显现/.test(id + " " + text)) return "volume0";
    return "";
  }

  function getActorYutaRikaManifestationEra(actor, rules) {
    var profile = buildDuelCharacterCardProfile(actor, { rules: rules || getDuelCharacterCardRules() });
    var tags = uniqueList([].concat(asList(profile?.explicitSpecialHandTags), asList(profile?.specialHandTags)));
    if (tags.includes("yuta_rika_manifestation_volume0")) return "volume0";
    if (tags.includes("yuta_rika_manifestation_modern") || tags.includes("rika_ring")) return "modern";
    return "";
  }

  function isMismatchedYutaRikaManifestationCandidate(candidate, actor, battle, rules) {
    if (!isYutaRikaManifestationCandidate(candidate)) return false;
    var actorEra = getActorYutaRikaManifestationEra(actor, rules);
    var candidateEra = getYutaRikaManifestationEra(candidate);
    return Boolean(actorEra && candidateEra && actorEra !== candidateEra);
  }

  function filterMismatchedRikaManifestations(candidates, actor, battle, rules) {
    return (candidates || []).filter(function keepRikaEraCandidate(candidate) {
      return !isMismatchedYutaRikaManifestationCandidate(candidate, actor, battle, rules);
    });
  }

  function isYutaRikaManifestationSpent(candidate, battle, side) {
    var key = getTenShadowsCandidateSummonKey(candidate);
    if (!isYutaRikaManifestationCandidate(candidate) || !battle || !side || !key) return false;
    var state = battle.rikaManifestationSummonState && battle.rikaManifestationSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side || !entry.uniqueRikaManifestationSummon) return false;
      return entry.uniqueSummonKey === key || entry.unitCardId === key || entry.cardId === key || entry.actionId === key;
    });
  }

  function filterSpentRikaManifestationSummons(candidates, battle, side) {
    return (candidates || []).filter(function keepCandidate(candidate) {
      return !isYutaRikaManifestationSpent(candidate, battle, side);
    });
  }

  function reconcilePersistentHandCards(hand, fullCandidates, actor, opponent, battle, rules) {
    var byId = Object.create(null);
    (fullCandidates || []).forEach(function indexCandidate(candidate) {
      var id = getActionId(candidate);
      if (id) byId[id] = candidate;
    });
    hand.cards = (hand.cards || []).map(function refreshCard(card) {
      var id = getActionId(card);
      var refreshed = byId[id] || card;
      var identityPreservingRefresh = refreshed === card ? card : {
        ...(refreshed || {}),
        cardInstanceId: String(card?.cardInstanceId || ""),
        drawnRound: Number(card?.drawnRound || hand.round || 0),
        handSource: card?.handSource || refreshed?.handSource || "retained"
      };
      return normalizePersistentHandCard(identityPreservingRefresh, card.drawnRound || hand.round, "retained");
    }).filter(function keepExisting(card) {
      if (!isStrictHandCandidateEligible(card, actor, opponent, battle, rules)) return false;
      if (isMismatchedYutaRikaManifestationCandidate(card, actor, battle, rules)) return false;
      if (!isMaintenanceCardCurrentlyValid(card, battle)) return false;
      if (Number(card?.expiresAfterRound || 0) > 0 && Number(card.expiresAfterRound || 0) < getTurnNumber(battle)) return false;
      if (!getActiveTrialSubPhaseForActor(actor, battle) && isRuleTrialCardLike(card)) return false;
      if (!getActiveJackpotSubPhaseForActor(actor, battle) && isJackpotSubPhaseCardLike(card)) return false;
      if (isTenShadowsSummonSpent(card, battle, getActorSide(actor, {}))) return false;
      if (isCurseSpiritManipulationSummonSpent(card, battle, getActorSide(actor, {}))) return false;
      if (isYutaRikaManifestationSpent(card, battle, getActorSide(actor, {}))) return false;
      if (filterAtomicHandCandidatesByRuntimeRules([card], actor, battle, opponent).length === 0) return false;
      if (filterShibuyaMegumiTimelineCandidates([card], actor, battle).length === 0) return false;
      if (filterShibuyaMahitoSceneCandidates([card], actor, battle).length === 0) return false;
      return Boolean(getActionId(card));
    });
  }

  function removeDomainCardsFromNormalHand(hand) {
    hand.cards = (hand.cards || []).filter(function keepNormalPersistentCard(card) {
      return !isDomainHandCandidate(card);
    });
  }

  function getRandomHandInjectionsForActor(actor) {
    var characterRules = getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: characterRules });
    var entry = getCharacterRuleEntry({ id: profile.characterId, name: profile.displayName }, characterRules);
    return asList(entry?.rules?.randomHandInjections).concat(asList(entry?.rules?.rules?.randomHandInjections));
  }

  function getFixedHandInjectionsForActor(actor) {
    var characterRules = getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: characterRules });
    var entry = getCharacterRuleEntry({ id: profile.characterId, name: profile.displayName }, characterRules);
    return asList(entry?.rules?.fixedHandInjections).concat(asList(entry?.rules?.rules?.fixedHandInjections));
  }

  function getFixedActionInjectionsFromPool(fullCandidates) {
    return (fullCandidates || []).filter(function keepGuaranteed(candidate) {
      var action = candidate?.action || candidate || {};
      return Boolean(candidate?.guaranteedPerTurn || action.guaranteedPerTurn);
    }).map(function mapGuaranteed(candidate) {
      var action = candidate?.action || candidate || {};
      return {
        id: getActionId(candidate),
        actionId: getActionId(candidate),
        weight: getBattleRuntimeActionWeight(action, 999),
        retainedPermanent: action.retainedPermanent !== false,
        handSource: action.handSource || "guaranteed-per-turn"
      };
    });
  }

  function getAtomicFixedHandInjectionsForActor(fullCandidates, actor, opponent, battle, round) {
    if (Number(round || 0) !== getTurnNumber(battle)) return [];
    return (fullCandidates || []).filter(function keepGuaranteedAtomicCandidate(candidate) {
      return getAtomicHandPolicy(candidate, actor, battle, opponent).guaranteed === true;
    }).map(function mapGuaranteedAtomicCandidate(candidate) {
      var actionId = getActionId(candidate);
      return {
        id: actionId,
        actionId: actionId,
        weight: 1200,
        retainedPermanent: false,
        handSource: "atomic-policy-guarantee"
      };
    });
  }

  function shouldApplyFixedHandInjection(injection, actor, battle, round) {
    var condition = injection?.condition || injection?.conditions || {};
    if (!condition || typeof condition !== "object" || !Object.keys(condition).length) return true;
    var hpBelowRatio = Number(condition.hpBelowRatio ?? condition.requiresHpBelowRatio);
    if (Number.isFinite(hpBelowRatio)) {
      var maxHp = Number(actor?.maxHp || 0);
      if (maxHp <= 0) return false;
      var hpRatio = Number(actor?.hp || 0) / maxHp;
      if (!(hpRatio < hpBelowRatio)) return false;
    }
    var minRound = Number(condition.minRound || 0);
    if (Number.isFinite(minRound) && minRound > 0 && Number(round || 0) < minRound) return false;
    return true;
  }

  function rollRandomHandInjection(injection, actor, battle, round) {
    var chance = Number(injection?.probability ?? injection?.chance ?? 0);
    if (!Number.isFinite(chance) || chance <= 0) return false;
    if (chance >= 1) return true;
    return (battle?.mode === "online" && typeof battle?.rng === "function" ? battle.rng() : Math.random()) < chance;
  }

  function injectRandomHandCards(hand, fullCandidates, actor, battle, rules, round, maxHandSize) {
    var injections = getRandomHandInjectionsForActor(actor);
    if (!injections.length) return [];
    var byId = Object.create(null);
    (fullCandidates || []).forEach(function indexCandidate(candidate) {
      var id = getActionId(candidate);
      if (id) byId[id] = candidate;
    });
    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var injected = [];
    injections.forEach(function maybeInject(injection) {
      var id = injection?.actionId || injection?.id || injection?.cardId || "";
      if (!id || existingIds.has(id)) return;
      if (!rollRandomHandInjection(injection, actor, battle, round)) return;
      var candidate = byId[id];
      if (!candidate) return;
      if (!isStrictHandCandidateEligible(candidate, actor, getAtomicHandOpponent(actor, battle), battle, rules)) return;
      if (filterShibuyaMegumiTimelineCandidates([candidate], actor, battle).length === 0) return;
      if (isDomainHandCandidate(candidate)) return;
      if (!canInjectSupplementalNonTechniqueCard(hand, candidate, maxHandSize)) return;
      var card = normalizePersistentHandCard({
        ...(candidate || {}),
        randomHandInjection: true,
        randomHandInjectionChance: Number(injection.probability ?? injection.chance ?? 0),
        characterWeight: getInjectionHandPriorityScore(candidate, injection.weight || 99),
        weight: getInjectionHandPriorityScore(candidate, injection.weight || 99),
        handSource: injection.handSource || "random-injection"
      }, round, injection.handSource || "random-injection");
      hand.cards.push(card);
      existingIds.add(id);
      injected.push(card);
    });
    return injected;
  }

  function injectFixedHandCards(hand, fullCandidates, actor, battle, rules, round, maxHandSize) {
    var injections = getFixedHandInjectionsForActor(actor)
      .concat(getFixedActionInjectionsFromPool(fullCandidates))
      .concat(getAtomicFixedHandInjectionsForActor(fullCandidates, actor, getAtomicHandOpponent(actor, battle), battle, round));
    if (!injections.length) return [];
    var byId = Object.create(null);
    (fullCandidates || []).forEach(function indexCandidate(candidate) {
      var id = getActionId(candidate);
      if (id) byId[id] = candidate;
    });
    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var injected = [];
    injections.forEach(function injectFixed(injection) {
      var id = injection?.actionId || injection?.id || injection?.cardId || "";
      if (!id || existingIds.has(id)) return;
      if (!shouldApplyFixedHandInjection(injection, actor, battle, round)) return;
      var candidate = byId[id];
      if (!candidate) return;
      if (!isStrictHandCandidateEligible(candidate, actor, getAtomicHandOpponent(actor, battle), battle, rules)) return;
      if (filterShibuyaMegumiTimelineCandidates([candidate], actor, battle).length === 0) return;
      if (isDomainHandCandidate(candidate)) return;
      if (!canInjectSupplementalNonTechniqueCard(hand, candidate, maxHandSize)) return;
      var card = normalizePersistentHandCard({
        ...(candidate || {}),
        fixedHandInjection: true,
        retainedPermanent: injection.retainedPermanent !== false,
        characterWeight: getInjectionHandPriorityScore(candidate, injection.weight || 999),
        weight: getInjectionHandPriorityScore(candidate, injection.weight || 999),
        handSource: injection.handSource || "fixed-injection"
      }, round, injection.handSource || "fixed-injection");
      hand.cards.unshift(card);
      existingIds.add(id);
      injected.push(card);
    });
    return injected;
  }

  function isBlackBirdHandCandidate(candidate) {
    var action = candidate?.action || candidate || {};
    var text = [
      getActionId(candidate),
            candidate?.cardId,
      candidate?.label,
      candidate?.name,
            action?.cardId,
      action?.label,
      action?.name,
      action?.cardType,
      action?.type,
      action?.blackBirdSpec?.effect
    ].concat(asList(candidate?.tags), asList(candidate?.specialHandTags), asList(action?.tags), asList(action?.specialHandTags)).join(" ");
    return /black_bird_manipulation|黑鸟操术|乌羽/.test(text);
  }

  function getBlackBirdHandCategory(candidate) {
    if (!isBlackBirdHandCandidate(candidate)) return "";
    var action = candidate?.action || candidate || {};
    var effect = String(action?.blackBirdSpec?.effect || candidate?.blackBirdSpec?.effect || "").toLowerCase();
    var cardType = String(action?.cardType || candidate?.cardType || action?.type || candidate?.type || "").toLowerCase();
    var text = [
      getActionId(candidate),
      candidate?.label,
      candidate?.name,
      action?.label,
      action?.name
    ].concat(asList(candidate?.tags), asList(action?.tags)).join(" ");
    if (effect === "attack" || cardType === "attack" || /attack|攻击|疾袭|骤袭|喋血/.test(text)) return "attack";
    if (effect === "defense" || cardType === "defense" || /defense|防御|护身|傍身|奉血/.test(text)) return "defense";
    return "";
  }

  function injectBlackBirdAttackDefenseGuarantees(hand, rankedCandidates, actor, battle, rules, round) {
    if (!hand || !Array.isArray(hand.cards)) return [];
    var pool = (rankedCandidates || []).filter(function keepBlackBirdCandidate(candidate) {
      var id = getActionId(candidate);
      return id && isBlackBirdHandCandidate(candidate) && !isDomainHandCandidate(candidate);
    });
    if (!pool.length) return [];
    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var existingCategories = new Set((hand.cards || []).map(getBlackBirdHandCategory).filter(Boolean));
    var injected = [];
    ["attack", "defense"].forEach(function ensureCategory(category) {
      if (existingCategories.has(category)) return;
      var candidate = pool
        .filter(function sameCategory(item) {
          var id = getActionId(item);
          return id && !existingIds.has(id) && getBlackBirdHandCategory(item) === category;
        })
        .sort(function byScore(left, right) {
          return getCandidateSortScore(right) - getCandidateSortScore(left);
        })[0];
      if (!candidate) return;
      var card = normalizePersistentHandCard({
        ...(candidate || {}),
        blackBirdGuaranteedCategory: category,
        characterWeight: Math.max(Number(candidate.characterWeight || candidate.weight || 0), 220),
        weight: Math.max(Number(candidate.weight || candidate.characterWeight || 0), 220),
        handSource: "black-bird-guarantee"
      }, round, "black-bird-guarantee");
      hand.cards.unshift(card);
      existingIds.add(getActionId(card));
      existingCategories.add(category);
      injected.push(card);
    });
    return injected;
  }

  function updatePersistentDuelHand(actor, opponent, battle, rankedCandidates, rules, options) {
    var side = getActorSide(actor, options);
    var hand = getPersistentHandState(battle, side, rules);
    var round = getTurnNumber(battle);
    var maxHandSize = getMaxHandSize(rules);
    var drawPerTurn = getDrawPerTurn(rules);
    reconcilePersistentHandCards(hand, rankedCandidates, actor, opponent, battle, rules);
    if (!options?.strictReplaceHand) removeDomainCardsFromNormalHand(hand);
    if (Number(hand.round || 0) === round) {
      if (options?.strictReplaceHand) {
        if (!Array.isArray(hand.preTrialCards)) {
          hand.preTrialCards = (hand.cards || []).filter(function keepPreTrialCard(card) {
            return card?.handSource !== "trial-replacement" && card?.domainClass !== "rule_trial";
          });
          hand.preTrialCardsRound = round;
        }
        hand.cards = (rankedCandidates || []).slice(0, maxHandSize).map(function markTrialReplacement(candidate) {
          return normalizePersistentHandCard(candidate, round, "trial-replacement");
        });
        hand.lastDrawn = hand.cards.map(function summarize(card) {
          return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
        });
        hand.lastInjected = [];
        hand.lastDiscarded = [];
        updatePersistentHandOverflow(hand, maxHandSize);
        return hand.cards;
      }
      var fixedSameRound = injectFixedHandCards(hand, options?.fullCandidates || rankedCandidates, actor, battle, rules, round, maxHandSize);
      var blackBirdSameRound = injectBlackBirdAttackDefenseGuarantees(hand, rankedCandidates, actor, battle, rules, round);
      var rikaArsenalSameRound = injectRikaArsenalPendingCards(hand, actor, battle, round);
      var rebalancedSameRound = rebalanceTechniquePriorityHandCards(hand, rankedCandidates, round);
      updatePersistentHandOverflow(hand, maxHandSize);
      if (fixedSameRound.length || blackBirdSameRound.length || rikaArsenalSameRound.length || rebalancedSameRound.length) {
        hand.lastInjected = fixedSameRound.concat(blackBirdSameRound, rikaArsenalSameRound, rebalancedSameRound.map(function mapRebalanced(entry) { return entry.added; })).map(function summarize(card) {
          return { actionId: getActionId(card), label: card.label || card.id || getActionId(card), reason: card.rikaArsenalFreeUse ? "rika-arsenal" : (card.blackBirdGuaranteedCategory ? "black-bird-guarantee" : "fixed") };
        }).concat(hand.lastInjected || []).slice(0, 8);
      }
      return hand.cards;
    }

    if (options?.strictReplaceHand) {
      if (!Array.isArray(hand.preTrialCards)) {
        hand.preTrialCards = (hand.cards || []).filter(function keepPreTrialCard(card) {
          return card?.handSource !== "trial-replacement" && card?.domainClass !== "rule_trial";
        });
        hand.preTrialCardsRound = round;
      }
      hand.cards = (rankedCandidates || []).slice(0, maxHandSize).map(function markTrialReplacement(candidate) {
        return normalizePersistentHandCard(candidate, round, "trial-replacement");
      });
      hand.round = round;
      hand.lastDrawn = hand.cards.map(function summarize(card) {
        return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
      });
      hand.lastInjected = [];
      hand.lastDiscarded = [];
      updatePersistentHandOverflow(hand, maxHandSize);
      return hand.cards;
    }

    var existingIds = new Set((hand.cards || []).map(getActionId).filter(Boolean));
    var drawPool = (rankedCandidates || []).filter(function canDraw(candidate) {
      var id = getActionId(candidate);
      return id && !existingIds.has(id);
    });
    var drawn = drawPool.slice(0, drawPerTurn).map(function markDrawn(candidate) {
      return normalizePersistentHandCard(candidate, round, "draw");
    });
    hand.cards = (hand.cards || []).map(function markRetained(card) {
      return normalizePersistentHandCard(card, card.drawnRound || round, "retained");
    }).concat(drawn);
    var fixedInjected = injectFixedHandCards(hand, options?.fullCandidates || rankedCandidates, actor, battle, rules, round, maxHandSize);
    var randomInjected = injectRandomHandCards(hand, options?.fullCandidates || rankedCandidates, actor, battle, rules, round, maxHandSize);
    var blackBirdInjected = injectBlackBirdAttackDefenseGuarantees(hand, rankedCandidates, actor, battle, rules, round);
    var rikaArsenalInjected = injectRikaArsenalPendingCards(hand, actor, battle, round);
    var rebalancedInjected = rebalanceTechniquePriorityHandCards(hand, rankedCandidates, round);
    var injected = fixedInjected.concat(randomInjected, blackBirdInjected, rikaArsenalInjected, rebalancedInjected.map(function mapRebalanced(entry) { return entry.added; }));
    if (hand.cards.length > maxHandSize) {
      updatePersistentHandOverflow(hand, maxHandSize);
    } else {
      updatePersistentHandOverflow(hand, maxHandSize);
    }

    hand.round = round;
    hand.lastDrawn = drawn.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
    });
    hand.lastInjected = injected.map(function summarize(card) {
      return { actionId: getActionId(card), label: card.label || card.id || getActionId(card), chance: card.randomHandInjectionChance || "", reason: card.rikaArsenalFreeUse ? "rika-arsenal" : (card.blackBirdGuaranteedCategory ? "black-bird-guarantee" : (card.fixedHandInjection ? "fixed" : "random")) };
    });
    if (!hand.overflowDiscardRequired) hand.lastDiscarded = [];
    return hand.cards;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function getChoiceCount(rules, requestedCount) {
    var handRules = rules || getDuelHandRules();
    var min = Number(handRules.hand?.minChoiceCount || 3);
    var max = Number(handRules.hand?.maxChoiceCount || handRules.hand?.maxHandSize || 8);
    var fallback = Number(handRules.hand?.defaultChoiceCount || handRules.hand?.maxHandSize || 8);
    var count = requestedCount === undefined ? fallback : Number(requestedCount);
    return Math.round(clamp(count, min, max));
  }

  function getMaxHandSize(rules) {
    return 8;
  }

  function getDrawPerTurn(rules) {
    return 5;
  }

  function getDomainHandSize(rules) {
    var handRules = rules || getDuelHandRules();
    if (handRules.domainHand?.enabled === false) return 0;
    return Math.max(0, Math.round(Number(handRules.domainHand?.maxHandSize || 3)));
  }

  function getMaxSelections(rules) {
    var handRules = rules || getDuelHandRules();
    var max = Number(handRules.hand?.maxSelectionsPerTurn || 1);
    return Math.max(1, Math.min(Math.round(max), 3));
  }

  function isCurseSpiritManipulationOwner(actor, rules) {
    if (!actor) return false;
    var archetypes = getDuelCharacterArchetypes(actor, { rules: rules });
    if (archetypes.includes("curse_spirit_manipulation_owner")) return true;
    var text = [
      actor.id,
      actor.name,
      actor.label,
      actor.title,
      actor.technique,
      actor.techniqueName,
      actor.description,
      actor.notes
    ].concat(asList(actor.tags), asList(actor.specialHandTags), asList(actor.traits), asList(actor.archetypes)).filter(Boolean).join(" ");
    return /curse_spirit_manipulation|咒灵操术|咒灵库存|夏油杰|夏油|geto/i.test(text);
  }

  function isCurseSpiritPlacementHandAction(entry) {
    var action = getActionFromEntry(entry);
    var summonSpec = action?.summonSpec || entry?.summonSpec || {};
    if (!summonSpec.unitCardId) return false;
    if (summonSpec.placement && summonSpec.placement !== "shikigami_zone") return false;
    var text = collectCandidateSearchText(entry);
    return /curse_spirit_manipulation|咒灵操术|咒灵库存|虹龙|口裂女|化身玉藻前|低级咒灵|geto/i.test(text);
  }

  function getDuelSelectionMaxForActions(actor, battle, rules, selected, nextCandidate) {
    var base = getMaxSelections(rules);
    if (battle?.mode === "online") {
      var capabilities = global.JJKOnlineDuelSync?.getOnlineTurnCapabilities?.(battle.onlineRoomSnapshot || {});
      if (capabilities?.effectiveMaxActionsPerTurn) base = Number(capabilities.effectiveMaxActionsPerTurn);
    }
    base += Math.max(0, Number(global.JJKSpecialConstitution?.getSelectionBonus(actor) || 0));
    var entries = (selected || []).slice();
    if (nextCandidate) entries.push(nextCandidate);
    if (!entries.length) return base;
    var allCurseSpiritPlacements = entries.every(isCurseSpiritPlacementHandAction);
    return allCurseSpiritPlacements ? Math.max(base, 5) : base;
  }

  function getBaseAp(rules) {
    var handRules = rules || getDuelHandRules();
    var base = Number(handRules.ap?.basePerTurn || 2);
    var max = Number(handRules.ap?.maxPerTurn || base || 2);
    return Math.max(1, Math.min(base, max));
  }

  function getMaxAp(rules) {
    var handRules = rules || getDuelHandRules();
    var base = getBaseAp(handRules);
    var max = Number(handRules.ap?.maxPerTurn || base);
    return Math.max(base, max);
  }

  function getTurnNumber(battle) {
    return Number(battle?.round || 0) + 1;
  }

  function isDomainScriptNoCardLocked(battle, side) {
    var locks = battle && battle.domainScriptNoCardLocks;
    return Boolean(side && locks && Number(locks[side] || 0) === getTurnNumber(battle));
  }

  function setDomainScriptNoCardMessage(battle, side, sourceDomainName) {
    var domainName = sourceDomainName || "领域";
    var message = "由于本回合被" + domainName + "效果命中，无法行动，请直接点击锁定。";
    if (!battle || !side) return message;
    battle.handLockMessages ||= {};
    battle.handLockMessages[side] = {
      round: getTurnNumber(battle),
      message: message,
      sourceDomainName: sourceDomainName || ""
    };
    if (shouldShowHandLockMessageForSide(battle, side)) battle.actionUiMessage = message;
    return message;
  }

  function shouldShowHandLockMessageForSide(battle, side) {
    if (!battle || !side) return false;
    if (battle.mode === "online") return (battle.onlinePlayerSide || "left") === side;
    return side === "left";
  }

  function consumeDomainScriptNoCard(actor, battle, side) {
    var actorSide = side || getActorSide(actor, {});
    var round = getTurnNumber(battle);
    var effects = Array.isArray(actor?.statusEffects) ? actor.statusEffects : [];
    var consumed = false;
    var sourceDomainName = "";
    if (!actor || !battle || !actorSide) return false;
    if (isDomainScriptNoCardLocked(battle, actorSide)) {
      var lockedMessage = battle.handLockMessages?.[actorSide];
      if (lockedMessage && Number(lockedMessage.round || 0) === round && shouldShowHandLockMessageForSide(battle, actorSide)) battle.actionUiMessage = lockedMessage.message || "";
      return true;
    }
    actor.statusEffects = effects.filter(function keepEffect(effect) {
      var triggerRound;
      if (effect?.id !== "domainScriptNoCard") return true;
      triggerRound = Number(effect.triggerRound || 0);
      if (triggerRound && triggerRound > round) return true;
      consumed = true;
      sourceDomainName = effect.sourceDomainName || sourceDomainName;
      return false;
    });
    if (!consumed) return false;
    battle.domainScriptNoCardLocks ||= {};
    battle.domainScriptNoCardLocks[actorSide] = round;
    setDomainScriptNoCardMessage(battle, actorSide, sourceDomainName);
    clearDuelSelectedHandActions(battle, actorSide);
    if (getOptionalFunction("recordDuelResourceChange")) {
      callDependency("recordDuelResourceChange", [battle, {
        side: actorSide,
        title: "领域封锁手札",
        detail: (typeof global.JJKDuelPerspectiveSideLabel === "function" ? global.JJKDuelPerspectiveSideLabel(actorSide) : (actorSide === "left" ? "我方" : "对方")) + actor.name + " 被" + (sourceDomainName || "领域") + "效果封锁，本轮不能抽取或使用手札。",
        type: "domain",
        delta: { domainScriptNoCardConsumed: true }
      }]);
    }
    return true;
  }

  function initializeDuelHandState(battle, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    activeBattle.actionPoints ||= {};
    ["left", "right"].forEach(function initializeSide(side) {
      if (!activeBattle.actionPoints[side]) resetDuelApForTurn(activeBattle, side, rules);
    });
    activeBattle.handCandidates ||= [];
    activeBattle.domainHandCandidates ||= [];
    activeBattle.handState ||= {};
    activeBattle.domainHandState ||= {};
    ["left", "right"].forEach(function initializeHandSide(side) {
      activeBattle.handState[side] ||= {
        cards: [],
        discardPile: [],
        round: 0,
        lastDrawn: [],
        lastInjected: [],
        lastDiscarded: [],
        maxHandSize: getMaxHandSize(rules),
        drawPerTurn: getDrawPerTurn(rules)
      };
    });
    ["left", "right"].forEach(function initializeDomainHandSide(side) {
      activeBattle.domainHandState[side] ||= {
        cards: [],
        round: 0,
        lastRefreshed: [],
        maxHandSize: getDomainHandSize(rules)
      };
      activeBattle.domainHandState[side].maxHandSize = getDomainHandSize(rules);
    });
    ensureSelectedHandActions(activeBattle);
    return activeBattle.actionPoints;
  }

  function ensureSelectedHandActions(battle) {
    if (!battle) return null;
    battle.selectedHandActions ||= {};
    ["left", "right"].forEach(function ensureSide(side) {
      if (!Array.isArray(battle.selectedHandActions[side])) battle.selectedHandActions[side] = [];
      battle.selectedHandActions[side] = battle.selectedHandActions[side].filter(function keepCurrentRound(entry) {
        return Number(entry?.selectedRound || 0) === getTurnNumber(battle);
      });
    });
    return battle.selectedHandActions;
  }

  function beginDuelHandExecutionTracking(battle, side, entries) {
    if (!battle || !side) return;
    battle.pendingHandActions ||= {};
    battle.resolvedHandActionIds ||= {};
    battle.pendingHandActions[side] = (entries || []).slice();
    battle.resolvedHandActionIds[side] = [];
  }

  function updateDuelHandExecutionTracking(battle, side, entries, index, resolvedEntry, actionApplied) {
    if (!battle || !side) return;
    battle.pendingHandActions ||= {};
    battle.resolvedHandActionIds ||= {};
    var resolvedId = getActionId(resolvedEntry);
    if (actionApplied === true && resolvedId) battle.resolvedHandActionIds[side].push(resolvedId);
    battle.pendingHandActions[side] = (entries || []).slice(index + 1);
  }

  function finishDuelHandExecutionTracking(battle, side) {
    if (!battle?.pendingHandActions || !side) return;
    delete battle.pendingHandActions[side];
  }

  function resetDuelApForTurn(battle, side, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var actorSide = side || "left";
    var handRules = rules || getDuelHandRules();
    activeBattle.actionPoints ||= {};
    var actorResource = actorSide === "right" ? activeBattle.resourceState?.p2 : activeBattle.resourceState?.p1;
    var fourArmsBonus = Math.max(0, Number(global.JJKSpecialConstitution?.getSelectionBonus(actorResource) || 0));
    var base = getBaseAp(handRules) + fourArmsBonus;
    var max = getMaxAp(handRules) + fourArmsBonus;
    activeBattle.actionPoints[actorSide] = {
      current: base,
      max: max,
      base: base,
      spent: 0,
      round: getTurnNumber(activeBattle),
      carryOver: Boolean(handRules.ap?.carryOver)
    };
    if (activeBattle.selectedHandActions?.[actorSide]) activeBattle.selectedHandActions[actorSide] = [];
    if (activeBattle.pendingHandActions?.[actorSide]) delete activeBattle.pendingHandActions[actorSide];
    activeBattle.resolvedHandActionIds ||= {};
    activeBattle.resolvedHandActionIds[actorSide] = [];
    return activeBattle.actionPoints[actorSide];
  }

  function getDuelApState(battle, side, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) {
      var fallbackBase = getBaseAp(rules);
      return { current: fallbackBase, max: getMaxAp(rules), base: fallbackBase, spent: 0, round: 0, carryOver: false };
    }
    var actorSide = side || "left";
    initializeDuelHandState(activeBattle, rules);
    var state = activeBattle.actionPoints?.[actorSide];
    if (!state || state.round !== getTurnNumber(activeBattle)) {
      state = resetDuelApForTurn(activeBattle, actorSide, rules);
    }
    return state;
  }

  function spendDuelAp(battle, side, amount, options) {
    var activeBattle = getBattle(battle);
    var actorSide = side || "left";
    var cost = Math.max(1, Number(amount || 0));
    var state = getDuelApState(activeBattle, actorSide, options?.rules);
    if (!activeBattle || !state) return { ok: false, reason: "行动点状态缺失", current: 0, max: 0, spent: 0 };
    if (Number(state.current || 0) < cost) {
      return { ok: false, reason: "行动点不足", current: state.current, max: state.max, spent: 0 };
    }
    state.current = Number(Math.max(0, Number(state.current || 0) - cost).toFixed(3));
    state.spent = Number((Number(state.spent || 0) + cost).toFixed(3));
    return { ok: true, reason: "", current: state.current, max: state.max, spent: cost };
  }

  function refundDuelAp(battle, side, amount, rules) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return null;
    var apState = getDuelApState(activeBattle, side, rules);
    var refund = Math.max(0, Number(amount || 0));
    var cap = Number(apState.max || apState.base || 0);
    apState.current = Number(Math.min(cap, Number(apState.current || 0) + refund).toFixed(3));
    apState.spent = Number(Math.max(0, Number(apState.spent || 0) - refund).toFixed(3));
    return apState;
  }

  function getDuelActionApCost(action, actor, opponent, duelState) {
    var value = Number(action?.apCost);
    if (Number.isFinite(value) && value > 0) return Math.max(1, Math.round(value));
    var id = action?.id || "";
    if ([
      "domain_expand",
      "domain_force_sustain",
      "domain_clash",
      "request_verdict",
      "claim_jackpot"
    ].includes(id)) {
      return 2;
    }
    if (action?.effects?.activateDomain || action?.id === "domain_force_sustain") return 2;
    if (["high", "critical"].includes(action?.risk)) return 2;
    return 1;
  }

  function isZeroCeActor(actor) {
    if (!actor) return false;
    var profile = buildDuelCharacterCardProfile(actor);
    if (profile?.isZeroCe || profile?.hasCe === false || profile?.ceLimited === true) return true;
    var text = [
      actor?.id,
      actor?.characterId,
      actor?.name,
      actor?.displayName,
      actor?.profile?.id,
      actor?.profile?.characterId,
      actor?.profile?.name,
      actor?.profile?.displayName,
      actor?.profile?.notes
    ].concat(
      asList(actor?.flags),
      asList(actor?.traits),
      asList(actor?.profile?.flags),
      asList(actor?.profile?.traits)
    ).join(" ");
    return /零咒力|zero_ce|physical_heavenly_restriction|天与咒缚[（(]?肉体强化型|天与暴君型|完全体天与/i.test(text);
  }

  function isZeroCeCostAction(action) {
    var id = action?.actionId || action?.id || action?.cardId || "";
    if ([
      "zero_ce_domain_bypass",
      "zero_ce_entry",
      "sure_hit_bypass_counter",
      "cursed_tool_combo",
      "barrier_boundary_break"
    ].includes(id)) return true;
    var tags = [].concat(asList(action?.tags), asList(action?.archetypeHints), asList(action?.characterHints));
    if (includesAny(tags, ["zero_ce", "零咒力"])) return true;
    return Boolean(action?.requiresZeroCe || action?.requirements?.requiresZeroCeBypass);
  }

  function shouldUseZeroCeCost(action, actor) {
    if (action?.rikaArsenalFreeUse || action?.effects?.rikaArsenalFreeUse) return true;
    if (global.JJKSpecialConstitution?.getCostOverride(action, actor) === 0) return true;
    return isZeroCeActor(actor) && isZeroCeCostAction(action);
  }

  function withZeroCeCostOverride(action, actor) {
    if (!shouldUseZeroCeCost(action, actor)) return action;
    return {
      ...(action || {}),
      costCe: 0,
      ceCost: 0,
      zeroCeCostOverride: true,
      cost: {
        ...(action?.cost || {}),
        flatCe: 0,
        minCe: 0,
        ceRatio: 0
      }
    };
  }

  function getCeCost(action, actor) {
    if (shouldUseZeroCeCost(action, actor)) return 0;
    if (Number.isFinite(Number(action?.costCe))) return Number(action.costCe);
    var getter = getOptionalFunction("getDuelActionCost");
    if (getter) return Number(getter(action, actor) || 0);
    return 0;
  }

  function getAvailability(action, actor, opponent, battle) {
    var checkedAction = withZeroCeCostOverride(action, actor);
    var fn = getOptionalFunction("getDuelActionAvailability");
    if (fn) {
      var availability = fn(checkedAction, actor, opponent, battle) || { available: false, reason: "不可用", costCe: getCeCost(checkedAction, actor) };
      if (shouldUseZeroCeCost(checkedAction, actor)) return { ...availability, costCe: 0, ceCost: 0 };
      return availability;
    }
    var costCe = getCeCost(checkedAction, actor);
    if (actor && Number(actor.ce || 0) < costCe) return { available: false, reason: "咒力不足", costCe: costCe };
    return { available: true, reason: "", costCe: costCe };
  }

  function createEffectText(action) {
    var effects = action?.effects || {};
    var parts = [];
    if (effects.outgoingScale && effects.outgoingScale !== 1) parts.push("输出调整");
    if (effects.incomingHpScale && effects.incomingHpScale !== 1) parts.push("承伤调整");
    if (effects.evasionBonus) parts.push("闪避调整");
    if (effects.selfHpCostRatio || effects.selfHpCostFlat) parts.push("体势代价");
    if (effects.stabilityDelta) parts.push("稳定度变化");
    if (effects.domainLoadDelta || effects.domainLoadScale) parts.push("领域负荷变化");
    if (effects.opponentDomainLoadDelta) parts.push("干涉对方领域");
    if (effects.activateDomain) parts.push("展开领域");
    if (effects.releaseDomain) parts.push("解除领域");
    if (action?.exclusiveHandSelection) parts.push("单独使用");
    return parts.join(" / ") || action?.description || "调整本回合咒力节奏";
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

  function formatSignedPercent(value) {
    var numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric === 0) return "";
    var percent = Number((numeric * 100).toFixed(Math.abs(numeric) < 0.01 ? 1 : 0));
    return (percent > 0 ? "+" : "") + String(percent) + "%";
  }

  function formatScalePercent(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 1) return "";
    return formatSignedPercent(numeric - 1);
  }

  function pushKnownNumericPreview(preview, field, value) {
    if (!Number.isFinite(value)) return;
    if (field === "outgoingScale" && value !== 1) preview.riskPreview.push("输出倍率：" + formatScalePercent(value));
    if (field === "incomingHpScale" && value !== 1) preview.statusPreview.push("受到体势伤害：" + formatScalePercent(value));
    if (field === "evasionBonus" && value !== 0) preview.statusPreview.push("闪避：" + formatSignedPercent(value));
    if (field === "selfHpCostRatio" && value > 0) preview.resourcePreview.push("体势代价：最大体势 " + formatSignedPercent(value).replace(/^\+/, ""));
    if (field === "selfHpCostFlat" && value > 0) preview.resourcePreview.push("体势代价 " + formatSignedNumber(value).replace(/^\+/, ""));
    if (field === "stabilityDelta" && value !== 0) preview.statusPreview.push("稳定度：" + formatSignedPercent(value));
    if (field === "domainLoadDelta" && value !== 0) preview.resourcePreview.push("己方领域负荷 " + formatSignedNumber(value));
    if (field === "ceCost" && value > 0) preview.resourcePreview.push("消耗咒力 " + formatSignedNumber(value).replace(/^\+/, ""));
    if (field === "hpDamage" && value !== 0) preview.riskPreview.push("预计体势伤害 " + formatSignedNumber(value).replace(/^\+/, ""));
    if (field === "durationRounds" && value > 0) preview.statusPreview.push("持续 " + formatSignedNumber(value).replace(/^\+/, "") + " 回合");
  }

  function buildFallbackEffectPreview(actionOrCandidate, template, baseView, availabilityMessage) {
    var action = actionOrCandidate?.action || actionOrCandidate || {};
    var effects = action?.effects || {};
    var sources = [effects, action, baseView || {}, template || {}];
    var preview = {
      resourcePreview: [],
      statusPreview: [],
      riskPreview: [],
      conditionPreview: []
    };
    [
      "outgoingScale",
      "incomingHpScale",
      "evasionBonus",
      "selfHpCostRatio",
      "selfHpCostFlat",
      "stabilityDelta",
      "domainLoadDelta",
      "ceCost",
      "hpDamage",
      "durationRounds"
    ].forEach(function addNumericField(field) {
      var aliases = field === "ceCost" ? ["ceCost", "costCe"] : [field];
      var value = null;
      aliases.some(function findAlias(alias) {
        value = readFiniteNumber(sources, alias);
        return value !== null;
      });
      if (value !== null) pushKnownNumericPreview(preview, field, value);
    });
    if (effects.activateDomain) preview.conditionPreview.push("展开领域");
    if (effects.releaseDomain) preview.conditionPreview.push("解除领域");
    if (action.exclusiveHandSelection || template?.exclusiveHandSelection) preview.conditionPreview.push("限制：本回合只能选择此手札");
    if (isReadablePreviewText(availabilityMessage) && availabilityMessage !== "可用") preview.conditionPreview.push(availabilityMessage);
    preview.resourcePreview = cleanPreviewLines(preview.resourcePreview);
    preview.statusPreview = cleanPreviewLines(preview.statusPreview);
    preview.riskPreview = cleanPreviewLines(preview.riskPreview);
    preview.conditionPreview = cleanPreviewLines(preview.conditionPreview);
    var resolvedEffectLines = cleanPreviewLines([]
      .concat(preview.resourcePreview)
      .concat(preview.statusPreview)
      .concat(preview.riskPreview)
      .concat(preview.conditionPreview));
    var summary = baseView?.effectText || action?.description || template?.effectSummary || resolvedEffectLines[0] || "沿用既有手法效果。";
    if (!isReadablePreviewText(summary)) summary = "沿用既有手法效果。";
    var actionId = template?.actionId || template?.actionId || baseView?.actionId || action?.actionId || action?.id || "";
    var debugFields = cleanPreviewLines([
      template?.cardId || actionId ? "cardId:" + (template?.cardId || ("card_" + actionId)) : "",
      actionId ? "actionId:" + actionId : "",
      action?.id ? "actionId:" + action.id : ""
    ]);
    return {
      schema: "jjk-battle-runtime-effect-preview",
      version: "1.392-public-template-tactics",
      summary: summary,
      lines: resolvedEffectLines,
      resolvedEffectLines: resolvedEffectLines,
      resourcePreview: preview.resourcePreview,
      statusPreview: preview.statusPreview,
      riskPreview: preview.riskPreview,
      conditionPreview: preview.conditionPreview,
      debugFields: debugFields
    };
  }

  function createTags(action) {
    var tags = action?.type === "activity_tactic" && Array.isArray(action?.tags) ? action.tags.slice() : [];
    if (action?.domainSpecific) tags.push(action.domainRole || action.domainClass || "domain");
    if (action?.effects?.activateDomain || String(action?.id || "").startsWith("domain_")) tags.push("领域");
    if (action?.id === "residue_reading") tags.push("读解", "稳定");
    if (action?.id === "ce_compression") tags.push("稳定", "低消耗");
    if (action?.risk) tags.push(action.risk);
    return Array.from(new Set(tags.filter(Boolean)));
  }

  function getActorSide(actor, options) {
    return options?.side || actor?.side || "left";
  }

  function getSelectedCeCost(battle, side) {
    return getDuelSelectedHandActions(battle, side).reduce(function sumCost(total, entry) {
      return total + Number(entry?.ceCost || 0);
    }, 0);
  }

  function getActionFromEntry(entry) {
    return entry?.action || entry;
  }

  function getActionId(entry) {
    var action = getActionFromEntry(entry);
    return entry?.actionId || entry?.id || action?.id || "";
  }

  function isExclusiveDuelHandSelection(actionOrEntry) {
    var action = getActionFromEntry(actionOrEntry);
    return Boolean(action?.exclusiveHandSelection || action?.exclusiveSelection || action?.selectionMode === "exclusive");
  }

  function ignoresDuelHandSelectionLimit(actionOrEntry) {
    var action = getActionFromEntry(actionOrEntry);
    if (
      action?.selection?.ignoreLimit ||
      action?.selection?.doesNotCountTowardLimit ||
      action?.ignoreHandSelectionLimit ||
      action?.ignoreSelectionLimit ||
      action?.doesNotCountTowardSelectionLimit
    ) return true;
    if (isSpecialTaggedHandCard(actionOrEntry) && !action?.effects?.activateDomain && action?.id !== "domain_expand" && action?.cardId !== "card_domain_expand") return false;
    var text = [
      action?.id,
            action?.label,
      action?.name,
      action?.effectSummary,
      [].concat(action?.tags || [], action?.specialHandTags || []).join(" ")
    ].filter(Boolean).join(" ");
    return Boolean(
      action?.ignoreHandSelectionLimit ||
      action?.ignoreSelectionLimit ||
      action?.doesNotCountTowardSelectionLimit ||
      action?.effects?.activateDomain ||
      action?.id === "domain_expand" ||
      action?.cardId === "card_domain_expand" ||
      /mahoraga_tuning_ritual|魔虚罗调幅仪式|调幅仪式/.test(text)
    );
  }

  function getExclusiveDuelHandSelectionReason(actionOrEntry) {
    var action = getActionFromEntry(actionOrEntry);
    return action?.selectionLockReason || "该手札必须单独使用";
  }

  function isCandidateSelected(battle, side, actionId) {
    if (!battle || !actionId) return false;
    return getDuelSelectedHandActions(battle, side).some(function matchSelected(entry) {
      return getActionId(entry) === actionId;
    });
  }

  function wrapActionAsCandidate(action, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var availability = getAvailability(action, actor, opponent, battle);
    var ceCost = Number(availability.costCe ?? getCeCost(action, actor));
    var apCost = getDuelActionApCost(action, actor, opponent, battle);
    var side = getActorSide(actor, options);
    var apState = getDuelApState(battle, side, options?.rules);
    var apAvailable = Number(apState.current || 0) >= apCost;
    var selected = isCandidateSelected(battle, side, action?.id);
    var available = Boolean(availability.available) && !selected;
    var reason = availability.reason || "";
    if (selected) reason = "已选择";
    var candidate = {
      ...action,
      action: action,
      actionId: action?.id || "",
      apCost: apCost,
      ceCost: ceCost,
      costCe: ceCost,
      available: available,
      unavailableReason: available ? "" : (reason || "不可用"),
      riskLabel: action?.riskLabel || action?.risk || "风险未知",
      effectText: createEffectText(action),
      tags: createTags(action),
      source: "existing-action-pool",
      status: "CANDIDATE",
      selected: selected,
      selectionStatus: selected ? "selected" : (available ? "available" : "blocked"),
      legacyAp: {
        cost: apCost,
        current: Number(apState.current || 0),
        gating: false,
        exhausted: !apAvailable
      }
    };
    return candidate;
  }

  function isMeaningfulDuelEffectValue(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) && value !== 0 && value !== 1;
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.some(isMeaningfulDuelEffectValue);
    if (value && typeof value === "object") return Object.keys(value).some(function hasMeaningfulChild(key) {
      if (key === "id" || key === "label" || key === "name") return Boolean(String(value[key] || "").trim());
      return isMeaningfulDuelEffectValue(value[key]);
    });
    return false;
  }

  function hasMeaningfulDuelHandValues(candidate) {
    var action = candidate?.action || candidate || {};
    var effects = action.effects || {};
    var runtimeDamage = getBattleRuntimeActionDamage(action, 0);
    var runtimeBlock = getBattleRuntimeActionBlock(action, 0);
    var runtimeCost = getBattleRuntimeActionCostCe(action, 0);
    if ([runtimeDamage, runtimeBlock, runtimeCost].some(function hasRuntimeNumber(value) {
      return Number.isFinite(Number(value)) && Number(value) !== 0;
    })) return true;
    var numericFields = [
      "baseShield",
      "baseDomainPressure",
      "baseEvidencePressure",
      "baseJackpotGauge",
      "baseStabilityDamage",
      "baseStabilityRestore",
      "baseDomainLoadDelta",
      "baseHealing",
      "baseCeDamage",
      "hpDamage",
      "ceDamage"
    ];
    if (action.techniqueFeatureHand || action.featureTechniqueHand || action.specialHandCard) return true;
    if (action.effect && action.cost && Array.isArray(action.contexts)) return true;
    if (action.domainSpecific || action.domainRole || effects.activateDomain || effects.releaseDomain) return true;
    if (action.summonSpec || action.mechanismSpec || action.resourceSpec || action.serviceReceiptRules || action.massiveObjectRules) return true;
    if (action.projectionSorcery || action.starRageEffect || action.bloodConversion || action.bloodRuntime || action.starRageRuntime || action.projectionRuntime) return true;
    if (numericFields.some(function hasNumericField(field) {
      var value = Number(action[field] ?? effects[field]);
      return Number.isFinite(value) && value !== 0;
    })) return true;
    return Object.keys(effects).some(function hasMeaningfulEffect(key) {
      return isMeaningfulDuelEffectValue(effects[key]);
    });
  }

  function filterMeaningfulDuelHandCandidates(candidates) {
    return (candidates || []).filter(hasMeaningfulDuelHandValues);
  }

  function getCachedDuelActionPool(actor, opponent, battle) {
    if (!battle) return callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    var side = actor?.side || "left";
    var bloodCounterRead = global.JJKDuelCounterPipeline?.readCounter;
    var bloodCounterSnapshot = typeof bloodCounterRead === "function" ? [
      bloodCounterRead(battle, side, "blood_manipulation", "blood", { initial: 0, min: 0, max: 8 }),
      bloodCounterRead(battle, side, "blood_manipulation", "pierce", { initial: 0, min: 0, max: 6 })
    ] : [0, 0];
    var temporaryTechniqueFingerprint = getActiveTemporaryTechniqueGrants(actor, battle).map(function mapTemporaryTechniqueGrant(grant) {
      return [grant.slotId, grant.tag, grant.activationRound, grant.expiresRound].join(":");
    }).sort().join(",");
    var cacheKey = [
      battle.battleId || battle.onlineRoomId || "battle",
      side,
      getTurnNumber(battle),
      actor?.characterId || actor?.profileId || actor?.id || "",
      opponent?.characterId || opponent?.profileId || opponent?.id || "",
      Number(actor?.ce || 0).toFixed(1),
      Number(actor?.hp || 0).toFixed(1),
      bloodCounterSnapshot[0],
      bloodCounterSnapshot[1],
      temporaryTechniqueFingerprint
    ].join("|");
    battle.actionPoolCache ||= {};
    var cached = battle.actionPoolCache[side];
    if (cached?.key === cacheKey && Array.isArray(cached.pool)) return cached.pool;
    var pool = callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    battle.actionPoolCache[side] = { key: cacheKey, pool: pool };
    return pool;
  }

  function isShibuyaBasicOnlyActor(actor) {
    var sources = [actor, actor?.profile, actor?.characterCardProfile, actor?.profile?.characterCardProfile].filter(Boolean);
    var tags = sources.flatMap(function collectTags(source) {
      return [].concat(source?.cardTags || [], source?.tags || [], source?.flags || []);
    });
    return tags.includes("shibuya_basic_only");
  }

  function isShibuyaBasicHandCandidate(candidate) {
    var action = candidate?.action || candidate || {};
    var type = inferFallbackCardType(action);
    var evidence = collectCandidateSearchText(candidate);
    if (/reverse|反转术式|正能量|术式反转|领域|domain|technique/.test(evidence)) return false;
    return ["basic", "defense", "resource", "support"].includes(type);
  }

  function isTowerTojiNoCursedToolPhase(battle, side) {
    var context = battle?.activityContext;
    var mechanic = context?.bossMechanic;
    return side === "right" &&
      context?.type === "shibuya" &&
      context?.encounterId === "tail_granny_toji" &&
      Number(context?.phase || 1) >= 2 &&
      mechanic?.id === "tower_seance_toji" &&
      mechanic?.phase2?.noCursedToolAtTower === true;
  }

  function isTowerTojiCursedToolCandidate(candidate, rules) {
    var action = getCandidateAction(candidate);
    var snapshot = getCandidateCardRuleSnapshot(candidate, rules || getDuelCharacterCardRules());
    var special = action?.effect?.special || action?.effects?.special || {};
    var tags = uniqueList([]
      .concat(asList(snapshot?.tags))
      .concat(asList(action?.tags))
      .concat(asList(candidate?.tags)))
      .map(function normalizeTowerToolTag(tag) { return String(tag || "").trim().toLowerCase(); });
    var identity = [
      action?.id,
      action?.actionId,
      action?.cardId,
      action?.name,
      action?.label,
      candidate?.id,
      candidate?.cardId,
      candidate?.name,
      candidate?.label
    ].filter(Boolean).join(" ").toLowerCase();
    return Boolean(
      snapshot?.requiresCursedTool ||
      action?.requiresCursedTool ||
      action?.requirements?.requiresCursedTool ||
      special?.requiresCursedTool ||
      String(action?.kind || special?.kind || "").toLowerCase() === "cursedtool" ||
      tags.includes("咒具") ||
      tags.includes("cursed_tool") ||
      tags.includes("cursed_tool_user") ||
      /咒具|游云|遊雲|天逆鉾|天逆矛|万里锁|萬里鎖|释魂刀|釋魂刀|inverted[_-]?spear|split[_-]?soul|playful[_-]?cloud/.test(identity)
    );
  }

  function filterTowerTojiCursedToolCandidates(candidates, battle, side, rules) {
    if (!isTowerTojiNoCursedToolPhase(battle, side)) return Array.isArray(candidates) ? candidates : [];
    return (Array.isArray(candidates) ? candidates : []).filter(function keepTowerTojiBareHanded(candidate) {
      return !isTowerTojiCursedToolCandidate(candidate, rules);
    });
  }

  function filterShibuyaMegumiTimelineCandidates(candidates, actor, battle) {
    var characterId = String(
      actor?.characterId ||
      actor?.profileId ||
      actor?.battleCharacterId ||
      actor?.characterCardProfile?.characterId ||
      actor?.characterCardProfile?.id ||
      actor?.profile?.characterId ||
      actor?.profile?.id ||
      actor?.id ||
      ""
    );
    if (characterId !== "megumi_fushiguro_shibuya") return Array.isArray(candidates) ? candidates : [];
    return (Array.isArray(candidates) ? candidates : []).filter(function keepShibuyaTimelineCard(candidate) {
      var identity = collectCandidateIdentityText(candidate);
      if (/ten_shadows_(?:round_deer|piercing_ox)|card_ten_shadows_(?:round_deer|piercing_ox)|圆鹿|圓鹿|贯牛|貫牛/.test(identity)) return false;
      if (/mahoraga_tuning_ritual|ten_shadows_mahoraga|card_ten_shadows_mahoraga|魔虚罗|魔虛羅|魔須羅/.test(identity)) return false;
      return true;
    });
  }

  function isSukunaJogoGuestActor(actor, battle) {
    if (String(battle?.activityContext?.encounterId || "") !== "sukuna_jogo_challenge") return false;
    var characterId = String(
      actor?.characterId ||
      actor?.profileId ||
      actor?.battleCharacterId ||
      actor?.characterCardProfile?.characterId ||
      actor?.characterCardProfile?.id ||
      actor?.profile?.characterId ||
      actor?.profile?.id ||
      actor?.id ||
      ""
    );
    return characterId === "jogo_shibuya";
  }

  function filterSukunaJogoTimelineCandidates(candidates, actor, battle) {
    var source = Array.isArray(candidates) ? candidates : [];
    if (!isSukunaJogoGuestActor(actor, battle)) return source;
    var meteorUnlocked = getTurnNumber(battle) >= 3;
    return source.filter(function keepCanonPacedJogoCard(candidate) {
      var identity = collectCandidateIdentityText(candidate);
      if (/domain_expand|domain_activation|领域展开|領域展開|盖棺铁围山|蓋棺鐵圍山/.test(identity)) return false;
      if (!meteorUnlocked && /feature_disaster_flames_059|maximum[_ -]?meteor|极之番[·・]?陨|極之番[·・]?隕/.test(identity)) return false;
      return true;
    });
  }

  function isSukunaMahoragaGuestActor(actor, battle) {
    if (String(battle?.activityContext?.encounterId || "") !== "sukuna_death_battle") return false;
    var characterId = String(
      actor?.characterId ||
      actor?.profileId ||
      actor?.battleCharacterId ||
      actor?.characterCardProfile?.characterId ||
      actor?.characterCardProfile?.id ||
      actor?.profile?.characterId ||
      actor?.profile?.id ||
      actor?.id ||
      ""
    );
    return characterId === "sukuna_shibuya";
  }

  function filterSukunaMahoragaTimelineCandidates(candidates, actor, battle) {
    var source = Array.isArray(candidates) ? candidates : [];
    if (!isSukunaMahoragaGuestActor(actor, battle)) return source;
    var turn = getTurnNumber(battle);
    return source.filter(function keepCanonPacedSukunaCard(candidate) {
      var identity = collectCandidateIdentityText(candidate);
      if (turn < 3 && /domain_expand|domain_activation|领域展开|領域展開|伏魔御厨子/.test(identity)) return false;
      if (turn < 5 && /shrine[_ -]?furnace[_ -]?open|card_shrine_furnace|灶[·・]?开|不明火焰|(?:^|\s)开(?:$|\s)/.test(identity)) return false;
      return true;
    }).map(function lockCanonFinisherHit(candidate) {
      var identity = collectCandidateIdentityText(candidate);
      if (turn < 5 || !/shrine[_ -]?furnace[_ -]?open|card_shrine_furnace|灶[·・]?开|不明火焰|(?:^|\s)开(?:$|\s)/.test(identity)) return candidate;
      var action = getActionFromEntry(candidate) || {};
      var accuracy = {
        ...(action.accuracy || {}),
        hitRate: 1,
        modifier: 0,
        evasionAllowed: false
      };
      var canonAction = {
        ...action,
        accuracy: accuracy,
        baseHitRate: 1,
        hitRateModifier: 0,
        evasionAllowed: false,
        canonFixedOutcomeHit: true
      };
      return {
        ...(candidate || {}),
        action: canonAction,
        accuracy: accuracy,
        baseHitRate: 1,
        hitRateModifier: 0,
        evasionAllowed: false,
        canonFixedOutcomeHit: true
      };
    });
  }

  function isShibuyaMahitoSceneEnemy(actor, battle) {
    var encounterId = String(battle?.activityContext?.encounterId || "");
    if (!(encounterId === "nanami_mahito_last_stand" || encounterId === "mahito_pursuit")) return false;
    var side = String(actor?.side || "");
    var characterId = String(
      actor?.characterId ||
      actor?.profileId ||
      actor?.battleCharacterId ||
      actor?.characterCardProfile?.characterId ||
      actor?.characterCardProfile?.id ||
      actor?.profile?.characterId ||
      actor?.profile?.id ||
      actor?.id ||
      ""
    );
    return side === "right" && characterId === "mahito_shibuya";
  }

  function getShibuyaMahitoSceneCardIds(battle) {
    var encounterId = String(battle?.activityContext?.encounterId || "");
    // The Shibuya activity can resume a battle in a fresh duel instance.  Its
    // route-level offset is part of the encounter turn and must not be lost
    // when the local duel round returns to zero.
    var turn = Math.max(0, Number(battle?.activityContext?.roundOffset || 0)) + getTurnNumber(battle);
    if (encounterId === "nanami_mahito_last_stand") {
      if (turn === 1) return ["card_transfigured_swarm"];
      if (turn === 2) return ["card_soul_touch_pressure"];
      if (turn === 3) return ["card_body_morph_guard"];
      return ["card_soul_touch_pressure"];
    }
    if (encounterId === "mahito_pursuit") {
      if (turn === 1) return ["card_transfigured_swarm"];
      if (turn === 2) return ["card_soul_touch_pressure"];
      if (turn === 3) return ["card_transfigured_swarm"];
      if (turn === 4) return ["card_body_morph_guard"];
      if (turn === 5) return ["card_idle_transfiguration_013", "card_idle_transfiguration_014"];
      return ["card_idle_transfiguration_015"];
    }
    return [];
  }

  function filterShibuyaMahitoSceneCandidates(candidates, actor, battle) {
    var source = Array.isArray(candidates) ? candidates : [];
    if (!isShibuyaMahitoSceneEnemy(actor, battle)) return source;
    var withoutDomain = source.filter(function blockUnscheduledMahitoDomain(candidate) {
      var identity = collectCandidateIdentityText(candidate);
      return !/domain_expand|domain_activation|自闭圆顿裹|自閉圓頓裹|card_force_soul_touch|card_self_embodiment_pressure/.test(identity);
    });
    var intendedIds = getShibuyaMahitoSceneCardIds(battle);
    if (!intendedIds.length) return withoutDomain;
    var intended = withoutDomain.filter(function keepMahitoSceneCard(candidate) {
      var identity = collectCandidateIdentityText(candidate);
      return intendedIds.some(function matchesIntended(id) { return identity.includes(String(id || "").toLowerCase()); });
    });
    // Do not silently replace the public threat with a different retained or
    // random card.  The scene contract is strict: if its authored card is
    // missing, the hand must expose that data error instead of desynchronising
    // the telegraph and the attack that actually resolves.
    return intended;
  }

  function buildDuelHandCandidates(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var side = getActorSide(actor, options);
    var pool = getCachedDuelActionPool(actor, opponent, battle);
    var candidates = (pool || []).map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, options);
    });
    var rules = options?.characterCardRules || getDuelCharacterCardRules();
    var profile = buildDuelCharacterCardProfile(actor, { rules: rules });
    if (consumeDomainScriptNoCard(actor, battle, side)) return [];
    candidates = filterMeaningfulDuelHandCandidates(candidates);
    if (isShibuyaBasicOnlyActor(actor)) candidates = candidates.filter(isShibuyaBasicHandCandidate);
    candidates = filterTowerTojiCursedToolCandidates(candidates, battle, side, rules);
    candidates = filterShibuyaMegumiTimelineCandidates(candidates, actor, battle);
    candidates = filterSukunaJogoTimelineCandidates(candidates, actor, battle);
    candidates = filterSukunaMahoragaTimelineCandidates(candidates, actor, battle);
    candidates = filterShibuyaMahitoSceneCandidates(candidates, actor, battle);
    candidates = filterInactiveRuleSubphaseCards(candidates, actor, battle);
    candidates = filterStrictRuleSubphaseHandCandidates(candidates, actor, battle);
    candidates = filterSpentTenShadowsSummons(candidates, battle, side);
    candidates = filterSpentCurseSpiritManipulationSummons(candidates, battle, side);
    candidates = filterSpentRikaManifestationSummons(candidates, battle, side);
    candidates = filterMismatchedRikaManifestations(candidates, actor, battle, rules);
    if (isDuelCpuDounaFirstLifeSukuna(actor, battle)) {
      candidates = candidates.filter(function removeGenericDounaMahoragaTuning(candidate) {
        return !isGenericMahoragaTuningCandidate(candidate) || isDuelCpuDounaMahoragaSummon(candidate);
      });
    }
    candidates = filterAtomicHandCandidatesByRuntimeRules(candidates, actor, battle, opponent);
    var filtered = filterDuelHandCandidatesByCharacter(candidates, actor, { rules: rules, profile: profile, battle: battle });
    return applyDuelCharacterCardWeights(filtered, actor, { rules: rules, profile: profile, battle: battle }).filter(function keepNormalHand(candidate) {
      return !isDomainHandCandidate(candidate);
    });
  }

  function pickDuelHandCandidates(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var rules = getDuelHandRules();
    var choiceCount = getChoiceCount(rules, count);
    var picker = getOptionalFunction("pickDuelActionChoices");
    var side = actor?.side || "left";
    if (isOnlineAuthoritativePrivateHandSide(battle, side)) {
      var authoritativeCards = Array.isArray(battle?.handState?.[side]?.cards)
        ? battle.handState[side].cards
        : [];
      if (side === "left") {
        battle.handCandidates = authoritativeCards;
        buildDuelHandCandidateCache(battle);
      }
      return authoritativeCards;
    }
    var rawPool = getCachedDuelActionPool(actor, opponent, battle);
    var strictRuleSubphaseHand = shouldReplaceHandWithRuleSubphaseCards(actor, battle);
    var currentTrialReplacement = getCurrentTrialReplacementHandCards(actor, battle, side, rules);
    if (currentTrialReplacement.length) {
      if (battle && actor?.side === "left") {
        battle.handCandidates = currentTrialReplacement;
        buildDuelHandCandidateCache(battle);
      }
      return currentTrialReplacement;
    }
    if (shouldReplaceHandWithTrialCards(actor, battle)) {
      var rebuiltTrialReplacement = rebuildTrialReplacementHandCards(actor, battle, side, rules);
      if (battle && actor?.side === "left") {
        battle.handCandidates = rebuiltTrialReplacement;
        buildDuelHandCandidateCache(battle);
      }
      return rebuiltTrialReplacement;
    }
    if (consumeDomainScriptNoCard(actor, battle, side)) {
      initializeDuelHandState(battle, rules);
      battle.handState[side] = {
        ...(battle.handState?.[side] || {}),
        cards: [],
        round: getTurnNumber(battle),
        lastDrawn: [],
        maxHandSize: getMaxHandSize(rules),
        drawPerTurn: getDrawPerTurn(rules)
      };
      if (side === "left") {
        battle.handCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    var fullCandidates = rawPool.map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, { count: choiceCount });
    });
    fullCandidates = filterMeaningfulDuelHandCandidates(fullCandidates);
    fullCandidates = filterTowerTojiCursedToolCandidates(fullCandidates, battle, side, getDuelCharacterCardRules());
    fullCandidates = filterShibuyaMegumiTimelineCandidates(fullCandidates, actor, battle);
    fullCandidates = filterSukunaJogoTimelineCandidates(fullCandidates, actor, battle);
    fullCandidates = filterSukunaMahoragaTimelineCandidates(fullCandidates, actor, battle);
    fullCandidates = filterShibuyaMahitoSceneCandidates(fullCandidates, actor, battle);
    fullCandidates = filterInactiveRuleSubphaseCards(fullCandidates, actor, battle);
    fullCandidates = filterStrictRuleSubphaseHandCandidates(fullCandidates, actor, battle);
    fullCandidates = filterSpentTenShadowsSummons(fullCandidates, battle, side);
    fullCandidates = filterSpentCurseSpiritManipulationSummons(fullCandidates, battle, side);
    fullCandidates = filterSpentRikaManifestationSummons(fullCandidates, battle, side);
    fullCandidates = filterMismatchedRikaManifestations(fullCandidates, actor, battle, getDuelCharacterCardRules());
    fullCandidates = filterAtomicHandCandidatesByRuntimeRules(fullCandidates, actor, battle, opponent);
    var splitPool = splitNormalAndDomainCandidates(fullCandidates);
    var actions = strictRuleSubphaseHand
      ? splitPool.normal.slice(0, choiceCount)
      : picker
      ? picker(actor, opponent, battle, choiceCount)
      : splitPool.normal.slice(0, choiceCount);
    actions = (actions || []).filter(function keepNormalAction(action) {
      return !isDomainHandCandidate(action);
    });
    var candidates = rankDuelHandCandidatesByCharacter(splitPool.normal, actions, actor, opponent, battle, choiceCount, {});
    var handCards = updatePersistentDuelHand(actor, opponent, battle, candidates, rules, {
      side: actor?.side || "left",
      fullCandidates: fullCandidates,
      strictReplaceHand: strictRuleSubphaseHand
    });
    if (battle && actor?.side === "left") {
      battle.handCandidates = handCards;
      buildDuelHandCandidateCache(battle);
    }
    return handCards;
  }

  function pickDuelDomainHandCandidates(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var rules = getDuelHandRules();
    var maxDomainCards = count === undefined ? getDomainHandSize(rules) : Math.max(0, Math.round(Number(count || 0)));
    if (!battle || !maxDomainCards || rules.domainHand?.enabled === false) return [];
    initializeDuelHandState(battle, rules);
    var side = getActorSide(actor, { side: actor?.side || "left" });
    if (isOnlineAuthoritativePrivateHandSide(battle, side)) {
      var authoritativeDomainCards = Array.isArray(battle?.domainHandState?.[side]?.cards)
        ? battle.domainHandState[side].cards
        : [];
      if (side === "left") {
        battle.domainHandCandidates = authoritativeDomainCards;
        buildDuelHandCandidateCache(battle);
      }
      return authoritativeDomainCards.slice(0, maxDomainCards);
    }
    if (isSukunaJogoGuestActor(actor, battle) || isShibuyaMahitoSceneEnemy(actor, battle)) {
      battle.domainHandState ||= {};
      battle.domainHandState[side] = {
        cards: [],
        round: getTurnNumber(battle),
        lastRefreshed: [],
        maxHandSize: maxDomainCards
      };
      if (side === "left") {
        battle.domainHandCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    if (consumeDomainScriptNoCard(actor, battle, side)) {
      battle.domainHandState ||= {};
      battle.domainHandState[side] = {
        cards: [],
        round: getTurnNumber(battle),
        lastRefreshed: [],
        maxHandSize: maxDomainCards
      };
      if (side === "left") {
        battle.domainHandCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    if (shouldReplaceHandWithRuleSubphaseCards(actor, battle)) {
      battle.domainHandState ||= {};
      battle.domainHandState[side] = {
        cards: [],
        round: getTurnNumber(battle),
        lastRefreshed: [],
        maxHandSize: maxDomainCards
      };
      if (side === "left") {
        battle.domainHandCandidates = [];
        buildDuelHandCandidateCache(battle);
      }
      return [];
    }
    var domainState = battle.domainHandState?.[side] || { cards: [], round: 0, lastRefreshed: [], maxHandSize: maxDomainCards };
    var round = getTurnNumber(battle);
    if (Number(domainState.round || 0) === round && Array.isArray(domainState.cards)) {
      var cachedCards = filterSpentRikaManifestationSummons(
        filterSpentCurseSpiritManipulationSummons(
          filterSpentTenShadowsSummons(domainState.cards.slice(0, maxDomainCards), battle, side),
          battle,
          side
        ),
        battle,
        side
      );
      cachedCards = filterShibuyaMegumiTimelineCandidates(cachedCards, actor, battle);
      cachedCards = injectGuaranteedDomainExpandCandidate(cachedCards, actor, opponent, battle, side, maxDomainCards);
      cachedCards = filterSukunaMahoragaTimelineCandidates(cachedCards, actor, battle);
      if (cachedCards.length !== domainState.cards.length || cachedCards.some(function changed(card, index) {
        return getActionId(card) !== getActionId(domainState.cards[index]);
      })) {
        battle.domainHandState[side] = {
          ...domainState,
          cards: cachedCards,
          lastRefreshed: cachedCards.map(function summarize(card) {
            return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
          })
        };
      }
      return cachedCards;
    }
    var rawPool = callDependency("buildDuelActionPool", [actor, opponent, battle]) || [];
    var fullCandidates = rawPool.map(function mapAction(action) {
      return wrapActionAsCandidate(action, actor, opponent, battle, { count: maxDomainCards, side: side });
    });
    fullCandidates = filterMeaningfulDuelHandCandidates(fullCandidates);
    fullCandidates = filterShibuyaMegumiTimelineCandidates(fullCandidates, actor, battle);
    fullCandidates = filterSukunaMahoragaTimelineCandidates(fullCandidates, actor, battle);
    fullCandidates = filterInactiveRuleSubphaseCards(fullCandidates, actor, battle);
    fullCandidates = filterSpentTenShadowsSummons(fullCandidates, battle, side);
    fullCandidates = filterSpentCurseSpiritManipulationSummons(fullCandidates, battle, side);
    fullCandidates = filterSpentRikaManifestationSummons(fullCandidates, battle, side);
    var domainCandidates = filterDomainCandidatesByPhase(splitNormalAndDomainCandidates(fullCandidates).domain, actor, opponent, battle);
    var ranked = rankDuelHandCandidatesByCharacter(domainCandidates, [], actor, opponent, battle, maxDomainCards, {
      domainHand: true,
      handRules: rules,
      randomize: 1.4
    });
    var refreshed = ranked.slice(0, maxDomainCards).map(function markDomainCard(candidate) {
      return {
        ...(candidate || {}),
        handSource: "domain-refresh",
        domainHand: true,
        drawnRound: round
      };
    });
    refreshed = injectGuaranteedDomainExpandCandidate(refreshed, actor, opponent, battle, side, maxDomainCards);
    refreshed = filterSukunaMahoragaTimelineCandidates(refreshed, actor, battle);
    battle.domainHandState ||= {};
    battle.domainHandState[side] = {
      cards: refreshed,
      round: round,
      lastRefreshed: refreshed.map(function summarize(card) {
        return { actionId: getActionId(card), label: card.label || card.id || getActionId(card) };
      }),
      maxHandSize: maxDomainCards
    };
    if (side === "left") {
      battle.domainHandCandidates = refreshed;
      buildDuelHandCandidateCache(battle);
    }
    return refreshed;
  }

  function getDuelHandCardViewModel(candidate, actor, opponent, duelState) {
    var action = candidate?.action || candidate;
    var view = wrapActionAsCandidate(action, actor, opponent, duelState, { side: actor?.side || "left" });
    var baseView = {
      id: view.id,
      actionId: view.actionId || view.id,
      cardInstanceId: String(candidate?.cardInstanceId || action?.cardInstanceId || ""),
      label: view.label || view.id || "未命名手札",
      apCost: Number(view.apCost || 1),
      ceCost: Number(view.ceCost ?? view.costCe ?? 0),
      effectText: view.effectText || createEffectText(action),
      risk: view.riskLabel || view.risk || "风险未知",
      tags: view.tags || createTags(action),
      available: Boolean(view.available),
      unavailableReason: view.unavailableReason || "",
      selected: Boolean(view.selected),
      selectionStatus: view.selectionStatus || (view.selected ? "selected" : (view.available ? "available" : "blocked")),
      status: view.status || action?.status || "CANDIDATE",
      source: view.source || "existing-action-pool",
      characterWeight: view.characterWeight || action?.characterWeight || "",
      characterCardArchetypes: view.characterCardArchetypes || action?.characterCardArchetypes || [],
      characterCardProfile: candidate?.characterCardProfile || view.characterCardProfile || action?.characterCardProfile || buildDuelCharacterCardProfile(actor),
      actor: actor,
      debug: {
        actionId: view.actionId || view.id,
        effectTags: view.tags || [],
        status: view.status || action?.status || "CANDIDATE",
        source: view.source || "existing-action-pool",
        weight: view.characterWeight ?? action?.characterWeight ?? action?.weight ?? action?.score ?? "",
        characterArchetypes: view.characterCardArchetypes || action?.characterCardArchetypes || [],
        domainClass: action?.domainClass || "",
        domainRole: action?.domainRole || ""
      }
    };
    return buildDuelCardViewModel(action, baseView);
  }

  function buildDuelCardViewModel(actionOrCandidate, baseView) {
    var builder = getOptionalFunction("buildDuelCardViewModel");
    if (!builder) return buildFallbackDuelCardViewModel(actionOrCandidate, baseView);
    var cardView = builder(actionOrCandidate, baseView) || {};
    return mergeDuelCardViewModel(baseView, cardView, actionOrCandidate);
  }

  function buildFallbackDuelCardViewModel(actionOrCandidate, baseView) {
    var templateGetter = getOptionalFunction("getDuelCardTemplateForAction");
    var action = actionOrCandidate?.action || actionOrCandidate;
    var template = templateGetter ? templateGetter(actionOrCandidate) : null;
    var actionId = template?.actionId || template?.actionId || baseView?.actionId || action?.actionId || action?.id || "";
    var cardType = template?.cardType || inferFallbackCardType(action);
    var rarity = template?.rarity || inferFallbackCardRarity(action, cardType);
    var effectPreview = buildFallbackEffectPreview(actionOrCandidate, template, baseView, baseView?.unavailableReason || "");
    return mergeDuelCardViewModel(baseView, {
      cardId: template?.cardId || ("card_" + actionId),
            cardType: cardType,
      cardTypeLabel: template?.cardTypeLabel || fallbackCardTypeLabel(cardType),
      rarity: rarity,
      rarityLabel: template?.rarityLabel || rarity,
      tags: template?.tags || baseView?.tags || createTags(action),
      contexts: template?.contexts || template?.contexts || ["normal"],
      effectText: baseView?.effectText || template?.effectSummary || action?.description || "",
      status: template?.status || baseView?.status || "CANDIDATE",
      source: template ? "card-template" : "existing-action-pool",
      effectPreview: effectPreview,
      resolvedEffectLines: effectPreview.resolvedEffectLines,
      resourcePreview: effectPreview.resourcePreview,
      statusPreview: effectPreview.statusPreview,
      riskPreview: effectPreview.riskPreview,
      conditionPreview: effectPreview.conditionPreview,
      debugFields: effectPreview.debugFields,
      debug: {
        cardId: template?.cardId || ("card_" + actionId),
                contexts: template?.contexts || template?.contexts || ["normal"]
      }
    }, actionOrCandidate);
  }

  function mergeDuelCardViewModel(baseView, cardView, actionOrCandidate) {
    var action = actionOrCandidate?.action || actionOrCandidate;
    var mergedTags = Array.from(new Set([].concat(cardView?.tags || [], baseView?.tags || []).filter(Boolean)));
    var actionId = cardView?.actionId || baseView?.actionId || action?.actionId || action?.id || "";
    var cardId = cardView?.cardId || ("card_" + actionId);
    var effectPreview = cardView?.effectPreview || buildFallbackEffectPreview(actionOrCandidate, cardView, baseView, cardView?.availabilityMessage || baseView?.unavailableReason || "");
    return {
      ...(baseView || {}),
      ...(cardView || {}),
      id: baseView?.id || cardView?.id || action?.id || actionId,
      actionId: baseView?.actionId || cardView?.actionId || action?.id || actionId,
      cardInstanceId: String(baseView?.cardInstanceId || actionOrCandidate?.cardInstanceId || action?.cardInstanceId || cardView?.cardInstanceId || ""),
      label: cardView?.displayName || cardView?.label || baseView?.label || cardView?.name || action?.label || "未命名手札",
      displayName: cardView?.displayName || cardView?.label || baseView?.label || action?.label || "未命名手札",
      subtitle: cardView?.subtitle || "",
      cardId: cardId,
            cardType: cardView?.cardType || inferFallbackCardType(action),
      cardTypeLabel: cardView?.cardTypeLabel || fallbackCardTypeLabel(cardView?.cardType || inferFallbackCardType(action)),
      rarity: cardView?.rarity || inferFallbackCardRarity(action, cardView?.cardType),
      rarityLabel: cardView?.rarityLabel || cardView?.rarity || inferFallbackCardRarity(action, cardView?.cardType),
      tags: mergedTags,
      uiTags: Array.isArray(cardView?.uiTags) && cardView.uiTags.length ? cardView.uiTags.slice(0, 4) : mergedTags.slice(0, 4),
      effectText: cardView?.shortEffect || cardView?.effectText || baseView?.effectText || cardView?.effectSummary || action?.description || "沿用既有手法效果。",
      shortEffect: cardView?.shortEffect || cardView?.effectText || baseView?.effectText || cardView?.effectSummary || action?.description || "沿用既有手法效果。",
      longEffect: cardView?.longEffect || cardView?.effectSummary || action?.description || "",
      flavorLine: cardView?.flavorLine || "",
      riskLabel: cardView?.riskLabel || baseView?.riskLabel || baseView?.risk || action?.risk || "风险未知",
      availabilityMessage: cardView?.availabilityMessage || baseView?.unavailableReason || "",
      status: cardView?.status || baseView?.status || "CANDIDATE",
      source: cardView?.source || baseView?.source || "existing-action-pool",
      effectPreview: effectPreview,
      resolvedEffectLines: effectPreview.resolvedEffectLines,
      resourcePreview: effectPreview.resourcePreview,
      statusPreview: effectPreview.statusPreview,
      riskPreview: effectPreview.riskPreview,
      conditionPreview: effectPreview.conditionPreview,
      debugFields: effectPreview.debugFields,
      debug: {
        ...(baseView?.debug || {}),
        ...(cardView?.debug || {}),
        cardId: cardId,
                cardType: cardView?.cardType || inferFallbackCardType(action),
        rarity: cardView?.rarity || inferFallbackCardRarity(action, cardView?.cardType),
        contexts: cardView?.contexts || cardView?.debug?.contexts || ["normal"],
        mechanicIds: action?.mechanicIds || cardView?.mechanicIds || []
      }
    };
  }

  function inferFallbackCardType(action) {
    var id = action?.id || "";
    if (action?.type === "activity_tactic" || action?.cardType === "activity_tactic") return "activity_tactic";
    if (action?.domainSpecific) {
      if (["defend", "remain_silent", "deny_charge", "challenge_evidence", "delay_trial"].includes(id)) return "rule_defense";
      if (["advance_jackpot", "raise_probability", "risk_spin", "stabilize_cycle", "claim_jackpot"].includes(id)) return "jackpot";
      return "rule_trial";
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

  function inferFallbackCardRarity(action, cardType) {
    if (["domain", "domain_maintenance", "domain_response"].includes(cardType)) return "domain";
    if (["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return "rule";
    if (action?.risk === "critical") return "special";
    if (action?.risk === "high") return "rare";
    if (action?.risk === "medium") return "uncommon";
    return "common";
  }

  function fallbackCardTypeLabel(cardType) {
    var labels = {
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
      special: "特殊"
    };
    return labels[cardType] || cardType || "未知";
  }

  function findCandidateById(battle, actionOrId) {
    if (!battle) return null;
    var id = typeof actionOrId === "string" ? actionOrId : actionOrId?.id || actionOrId?.actionId || "";
    var cached = getDuelHandCandidateById(battle, id);
    if (cached) return cached;
    var handState = battle.handState || {};
    var handCards = [].concat(handState.left?.cards || [], handState.right?.cards || []);
    var handCard = handCards.find(function findHandMatch(item) {
      return item?.id === id || item?.actionId === id || item?.cardId === id || item?.action?.id === id;
    });
    if (handCard) return handCard;
    return [].concat(battle.handCandidates || battle.actionChoices || [], battle.domainHandCandidates || []).find(function findMatch(item) {
      return item?.id === id || item?.actionId === id || item?.action?.id === id;
    }) || null;
  }

  function getDuelSelectedHandActions(battle, side) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return [];
    ensureSelectedHandActions(activeBattle);
    var actorSide = side || "left";
    return (activeBattle.selectedHandActions?.[actorSide] || []).filter(function keepCurrentRound(entry) {
      return Number(entry?.selectedRound || 0) === getTurnNumber(activeBattle);
    });
  }

  var SHIBUYA_ACTIVITY_TACTIC_CONTRACTS = {
    "haruta-boss-tactic": {
      encounters: ["manager_hunter", "nanami_haruta"],
      mechanics: ["haruta_miracle_hunt"],
      idPrefix: "card_haruta_tactic_",
      allowedIds: ["activity_haruta_nanami_ratio_intercept"],
      identityField: "harutaTacticId"
    },
    "tower-boss-tactic": {
      encounters: ["tail_granny_toji", "awasaka"],
      mechanics: ["tower_seance_toji", "tower_inverse_puzzle"],
      idPrefix: "card_tower_tactic_",
      identityField: "towerTacticId"
    },
    "dagon-boss-tactic": {
      encounters: ["dagon_rotation"],
      mechanics: ["dagon_domain_lifeline"],
      idPrefix: "card_dagon_tactic_",
      identityField: "dagonTacticId"
    },
    "choso-boss-tactic": {
      encounters: ["choso_station"],
      mechanics: ["choso_station_canon_defeat"],
      idPrefix: "card_choso_tactic_",
      identityField: "chosoTacticId"
    },
    "megumi-toji-boss-tactic": {
      encounters: ["megumi_toji"],
      mechanics: ["megumi_toji_canon_pursuit"],
      idPrefix: "card_toji_tactic_",
      identityField: "megumiTojiTacticId"
    },
    "mahito-boss-tactic": {
      encounters: ["nanami_mahito_last_stand", "mahito_pursuit"],
      mechanics: ["nanami_mahito_last_stand", "mahito_final_canon"],
      idPrefix: "card_mahito_scene_",
      identityField: "mahitoSceneTacticId"
    }
  };

  function getShibuyaBossMechanicId(battle) {
    return String(
      battle?.activityContext?.bossMechanicId ||
      battle?.activityContext?.bossMechanic?.id ||
      ""
    );
  }

  function findAuthoritativeSelectionCandidate(battle, actionOrId, side) {
    if (!battle) return null;
    var actionId = typeof actionOrId === "string" ? actionOrId : getActionId(actionOrId);
    if (!actionId) return null;
    var actorSide = side === "right" ? "right" : "left";
    var lists = [
      battle?.handState?.[actorSide]?.cards || [],
      battle?.actionChoices || [],
      battle?.domainHandCandidates || [],
      battle?.handCandidates || []
    ];
    for (var index = 0; index < lists.length; index += 1) {
      var match = lists[index].find(function findSelectionMatch(entry) {
        return getActionId(entry) === actionId;
      });
      if (match) return match;
    }
    var cached = getDuelHandCandidateById(battle, actionId);
    return cached && getActionId(cached) === actionId ? cached : null;
  }

  function getSafeSelectedBattlefieldUnitIds(requestedAction, battle, side) {
    var requestedIds = []
      .concat(asList(requestedAction?.selectedUnitIds))
      .concat(asList(requestedAction?.maximumUzumakiSpec?.unitIds))
      .concat(asList(requestedAction?.targetPlan?.selectedUnitIds))
      .map(function normalizeSelectedUnitId(value) { return String(value || "").trim(); })
      .filter(Boolean);
    if (!requestedIds.length) return [];
    var allowedIds = new Set((battle?.battlefieldUnits || [])
      .filter(function keepOwnedActiveUnit(unit) {
        var ownerSide = String(unit?.controllerSide || unit?.ownerSide || unit?.side || "");
        var hp = Number(unit?.hp ?? unit?.currentHp ?? 0);
        return unit?.active !== false && hp > 0 && ownerSide === side;
      })
      .flatMap(function collectUnitIds(unit) {
        return [unit?.id, unit?.cardId, unit?.actionId].map(function normalizeUnitId(value) {
          return String(value || "").trim();
        }).filter(Boolean);
      }));
    return Array.from(new Set(requestedIds.filter(function keepAllowedUnitId(id) {
      return allowedIds.has(id);
    })));
  }

  function mergeSafeSelectionOverrides(authoritativeCandidate, requestedCandidate, battle, side) {
    if (!authoritativeCandidate) return null;
    var authoritativeAction = getActionFromEntry(authoritativeCandidate) || {};
    var requestedAction = getActionFromEntry(requestedCandidate) || {};
    var safeAction = { ...authoritativeAction };
    var directFields = [
      "targetId",
      "primaryTargetId",
      "targetSide",
      "primaryTargetSide",
      "targetTeamId",
      "allowUnitInterception",
      "harutaTargetChoice",
      "harutaTargetLabel"
    ];
    directFields.forEach(function copySafeDirectField(field) {
      if (Object.prototype.hasOwnProperty.call(requestedAction, field)) safeAction[field] = requestedAction[field];
    });
    var requestedPlan = requestedAction?.targetPlan;
    if (requestedPlan && typeof requestedPlan === "object") {
      var safePlan = { ...(authoritativeAction?.targetPlan || {}) };
      [
        "target",
        "targetSide",
        "primaryTargetSide",
        "primaryTargetId",
        "targetTeamId",
        "explicitTargetId",
        "allowUnitInterception",
        "selectionMode"
      ].forEach(function copySafePlanField(field) {
        if (Object.prototype.hasOwnProperty.call(requestedPlan, field)) safePlan[field] = requestedPlan[field];
      });
      safeAction.targetPlan = safePlan;
    }
    var selectedUnitIds = getSafeSelectedBattlefieldUnitIds(requestedAction, battle, side);
    if (selectedUnitIds.length) {
      safeAction.selectedUnitIds = selectedUnitIds;
      safeAction.maximumUzumakiSpec = {
        ...(authoritativeAction?.maximumUzumakiSpec || {}),
        selection: "manual",
        unitIds: selectedUnitIds
      };
      safeAction.targetPlan = {
        ...(safeAction.targetPlan || authoritativeAction?.targetPlan || {}),
        selectedUnitIds: selectedUnitIds
      };
    }
    if (authoritativeCandidate?.action) {
      var wrapped = { ...authoritativeCandidate, action: safeAction };
      directFields.forEach(function mirrorSafeDirectField(field) {
        if (Object.prototype.hasOwnProperty.call(safeAction, field)) wrapped[field] = safeAction[field];
      });
      return wrapped;
    }
    return safeAction;
  }

  function isScopedShibuyaActivityTactic(candidate, battle, side) {
    if (!candidate || !battle || side !== "left" || String(battle?.activityContext?.type || "") !== "shibuya") return false;
    var action = candidate?.action || candidate;
    if (String(action?.cardType || action?.type || candidate?.cardType || candidate?.type || "").toLowerCase() !== "activity_tactic") return false;
    if (!Boolean(candidate?.fixedHandInjection || action?.fixedHandInjection)) return false;
    var source = String(candidate?.handSource || action?.handSource || "");
    var contract = SHIBUYA_ACTIVITY_TACTIC_CONTRACTS[source];
    if (!contract) return false;
    var encounterId = String(battle?.activityContext?.encounterId || "");
    var mechanicId = getShibuyaBossMechanicId(battle);
    if (!contract.encounters.includes(encounterId) || !contract.mechanics.includes(mechanicId)) return false;
    var actionId = getActionId(candidate);
    if (!actionId || (!actionId.startsWith(contract.idPrefix) && !asList(contract.allowedIds).includes(actionId))) return false;
    if (!String(action?.[contract.identityField] || candidate?.[contract.identityField] || "")) return false;
    return (battle?.handState?.left?.cards || []).some(function matchesInjectedTactic(entry) {
      var entryAction = entry?.action || entry;
      var entrySource = String(entry?.handSource || entryAction?.handSource || "");
      return getActionId(entry) === actionId &&
        entrySource === source &&
        Boolean(entry?.fixedHandInjection || entryAction?.fixedHandInjection) &&
        String(entryAction?.[contract.identityField] || entry?.[contract.identityField] || "");
    });
  }

  function canSelectDuelHandCandidate(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) {
      return { ok: false, reason: "战斗资源缺失" };
    }
    initializeDuelHandState(battle, options?.rules);
    var side = getActorSide(actor, options);
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return { ok: false, reason: "体势已归零，无法选择手札" };
    }
    var requestedCandidate = typeof actionOrId === "string" ? findCandidateById(battle, actionOrId) : actionOrId;
    var requestedAction = requestedCandidate?.action || requestedCandidate;
    if (!requestedAction?.id) return { ok: false, reason: "手札不存在" };
    if (isTowerTojiNoCursedToolPhase(battle, side) && isTowerTojiCursedToolCandidate(requestedCandidate, options?.rules)) {
      return { ok: false, reason: "塔顶降灵出的甚尔当前只使用徒手追击，不能使用咒具牌", action: requestedAction };
    }
    var authoritativeCandidate = findAuthoritativeSelectionCandidate(battle, actionOrId, side);
    if (!authoritativeCandidate) return { ok: false, reason: "该手札不在当前可选列表", action: requestedAction };
    var candidate = mergeSafeSelectionOverrides(authoritativeCandidate, requestedCandidate, battle, side);
    var action = candidate?.action || candidate;
    // 场景临时回应牌不是角色术式。只有涩谷活动当场注入、仍真实存在
    // 于玩家手牌中的白名单牌可越过角色原型筛选；普通牌与伪造牌不放行。
    var eligibility = isScopedShibuyaActivityTactic(candidate, battle, side)
      ? { ok: true, reason: "" }
      : getDuelCardEligibilityDecision(candidate, actor, { rules: options?.rules, battle: battle });
    if (!eligibility.ok) {
      return { ok: false, reason: eligibility.reason || "当前角色不能使用该手札", action: action };
    }
    var selected = getDuelSelectedHandActions(battle, side);
    var hand = getPersistentHandState(battle, side, options?.rules);
    if (Number(hand?.pendingDiscardCount || 0) > 0) {
      return { ok: false, reason: "手牌超过上限，请先弃牌", action: action };
    }
    if (selected.some(function alreadySelected(entry) {
      return getActionId(entry) === action.id;
    })) {
      return { ok: false, reason: "本回合已选择", action: action };
    }
    var bypassSelectionLimit = ignoresDuelHandSelectionLimit(action);
    var countedSelected = selected.filter(function countSelected(entry) { return !ignoresDuelHandSelectionLimit(entry); });
    var exclusiveSelected = countedSelected.find(isExclusiveDuelHandSelection);
    if (exclusiveSelected && !bypassSelectionLimit) {
      return { ok: false, reason: getExclusiveDuelHandSelectionReason(exclusiveSelected), action: action };
    }
    if (isExclusiveDuelHandSelection(action) && countedSelected.length > 0 && !bypassSelectionLimit) {
      return { ok: false, reason: getExclusiveDuelHandSelectionReason(action), action: action };
    }
    var maxSelections = getDuelSelectionMaxForActions(actor, battle, options?.rules, countedSelected, candidate);
    if (!bypassSelectionLimit && countedSelected.length >= maxSelections) {
      return { ok: false, reason: "本回合手札选择数已达上限", action: action, maxSelections: maxSelections };
    }
    var availability = getAvailability(action, actor, opponent, battle);
    var ceCost = Number(availability.costCe ?? getCeCost(action, actor));
    var apCost = getDuelActionApCost(action, actor, opponent, battle);
    if (!availability.available) {
      return { ok: false, reason: availability.reason || "当前状态不可用", action: action, apCost: apCost, ceCost: ceCost };
    }
    if (Number(actor.ce || 0) < getSelectedCeCost(battle, side) + ceCost) {
      return { ok: false, reason: "咒力不足", action: action, apCost: apCost, ceCost: ceCost };
    }
    var apState = getDuelApState(battle, side, options?.rules);
    return {
      ok: true,
      reason: "",
      action: action,
      candidate: candidate,
      apCost: apCost,
      ceCost: ceCost,
      selectedCount: countedSelected.length,
      maxSelections: maxSelections,
      ap: apState,
      legacyAp: {
        cost: apCost,
        current: Number(apState.current || 0),
        gating: false,
        exhausted: Number(apState.current || 0) < apCost
      }
    };
  }

  function selectDuelHandCandidate(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    var check = canSelectDuelHandCandidate(actionOrId, actor, opponent, battle, options || {});
    if (!check.ok) return { selected: false, ...check };
    var side = getActorSide(actor, options);
    var apSpend = {
      ok: true,
      legacy: true,
      gating: false,
      cost: check.apCost,
      current: Number(check.ap?.current || 0),
      reason: "AP 已降级为 legacy 显示，不再阻止普通手札。"
    };
    ensureSelectedHandActions(battle);
    var cardInstanceId = String(check.candidate?.cardInstanceId || check.action?.cardInstanceId || "");
    var selectedAction = withZeroCeCostOverride(check.action, actor);
    if (cardInstanceId) selectedAction = { ...selectedAction, cardInstanceId: cardInstanceId };
    var entry = {
      id: check.action.id,
      actionId: check.action.id,
      cardInstanceId: cardInstanceId,
      label: check.action.label || check.action.id,
      action: selectedAction,
      apCost: check.apCost,
      ceCost: check.ceCost,
      source: "existing-action-pool",
      status: "CANDIDATE",
      selectedRound: getTurnNumber(battle),
      side: side
    };
    battle.selectedHandActions[side].push(entry);
    return { selected: true, reason: "", entry: entry, action: check.action, ap: apSpend, legacyAp: apSpend };
  }

  function unselectDuelHandCandidate(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle) return { unselected: false, reason: "战斗资源缺失" };
    var side = getActorSide(actor, options);
    ensureSelectedHandActions(battle);
    var id = typeof actionOrId === "string" ? actionOrId : actionOrId?.id || actionOrId?.actionId || actionOrId?.action?.id || "";
    var list = battle.selectedHandActions?.[side] || [];
    var index = list.findIndex(function findEntry(entry) {
      return getActionId(entry) === id;
    });
    if (index < 0) return { unselected: false, reason: "未选择该手札" };
    var entry = list.splice(index, 1)[0];
    var apState = getDuelApState(battle, side, options?.rules);
    return { unselected: true, reason: "", entry: entry, ap: apState, legacyAp: { cost: Number(entry?.apCost || 0), gating: false } };
  }

  function clearDuelSelectedHandActions(battle, side, options) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return { cleared: false, reason: "战斗资源缺失" };
    ensureSelectedHandActions(activeBattle);
    var sides = side ? [side] : ["left", "right"];
    var cleared = 0;
    sides.forEach(function clearSide(actorSide) {
      var list = activeBattle.selectedHandActions?.[actorSide] || [];
      cleared += list.length;
      activeBattle.selectedHandActions[actorSide] = [];
      if (activeBattle.pendingHandActions?.[actorSide]) delete activeBattle.pendingHandActions[actorSide];
      if (!options?.preserveResolved) {
        activeBattle.resolvedHandActionIds ||= {};
        activeBattle.resolvedHandActionIds[actorSide] = [];
      }
    });
    return { cleared: true, count: cleared };
  }

  function consumeDuelResolvedHandActions(battle, side, actions, options) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return { consumed: false, reason: "战斗资源缺失", removed: [] };
    var actorSide = side === "right" ? "right" : "left";
    var actionIds = (actions || []).map(getActionId).filter(function keepConsumableId(actionId) {
      return actionId && actionId !== "online_pass_turn" && actionId !== "duel_pass_turn";
    });
    var removed = removeCardsFromPersistentHand(activeBattle, actorSide, actionIds, options?.rules);
    invalidateDuelHandCandidateCache(activeBattle);
    clearDuelSelectedHandActions(activeBattle, actorSide, { refund: false, rules: options?.rules, preserveResolved: true });
    return {
      consumed: true,
      actionIds: actionIds,
      removed: removed,
      removedCount: removed.length
    };
  }

  function buildDuelHandTargetPlan(action, actor, opponent, battle, entry, options) {
    var explicitTargetId = entry?.targetId || entry?.primaryTargetId || entry?.target?.id || action?.targetId || action?.primaryTargetId || "";
    var targetSide = entry?.targetSide || entry?.primaryTargetSide || action?.targetSide || action?.primaryTargetSide || opponent?.side || "";
    return {
      source: "duel_hand_selection",
      selectionMode: explicitTargetId ? "explicit" : "guard_priority",
      actorSide: actor?.side || getActorSide(actor, options),
      primaryTargetSide: targetSide,
      primaryTargetId: explicitTargetId,
      targetTeamId: entry?.targetTeamId || action?.targetTeamId || "",
      allowUnitInterception: action?.allowUnitInterception !== false && action?.bypassGuard !== true,
      teamModeReady: true
    };
  }

  function withDuelHandTargetPlan(action, actor, opponent, battle, entry, options) {
    if (!action) return action;
    var existing = action.targetPlan || {};
    return {
      ...action,
      targetPlan: {
        ...buildDuelHandTargetPlan(action, actor, opponent, battle, entry, options),
        ...existing
      }
    };
  }

  function applyDuelSelectedHandActions(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) return { applied: false, reason: "战斗资源缺失", actions: [], results: [] };
    var side = getActorSide(actor, options);
    var selected = normalizeSelectedForExecution(options?.actions || getDuelSelectedHandActions(battle, side), actor, opponent, battle, options);
    if (!selected.length) return { applied: false, reason: "尚未选择手札", actions: [], results: [] };
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
        return { applied: false, reason: "体势已归零，无法继续行动", side: side, actions: [], results: [] };
    }
    // AP initialization may reset stale turn selections. Perform it before
    // publishing the immutable full-turn plan used by combo/resource rules.
    getDuelApState(battle, side, options?.rules);
    ensureSelectedHandActions(battle);
    // selectedHandActions is the immutable full-turn semantic view used by
    // combo, exclusivity and multiplier rules. Resource reservation reads the
    // per-action pending suffix maintained below instead.
    battle.selectedHandActions[side] = selected.slice();
    var preflight = validateDuelSelectedForExecution(actor, opponent, battle, side, selected, options);
    if (!preflight.ok) return preflight;
    selected = preflight.entries;
    var results = [];
    var appliedActions = [];
    beginDuelHandExecutionTracking(battle, side, selected);
    try {
      for (var index = 0; index < selected.length; index += 1) {
        var entry = selected[index];
        var action = getActionFromEntry(entry);
        battle.pendingHandActions[side] = selected.slice(index);
        if (!action?.id) {
          updateDuelHandExecutionTracking(battle, side, selected, index, entry, false);
          continue;
        }
        var actionForExecution = withDuelHandTargetPlan({
          ...withZeroCeCostOverride(action, actor),
          selectedCount: selected.length,
          selectedIndex: index,
          selectedLast: index === selected.length - 1
        }, actor, opponent, battle, entry, options);
        var availability = getAvailability(actionForExecution, actor, opponent, battle);
        if (!availability?.available) {
          results.push({ applied: false, reason: availability?.reason || "当前状态不可用", action: actionForExecution, result: null });
          updateDuelHandExecutionTracking(battle, side, selected, index, entry, false);
          continue;
        }
        var result = callDependency("applyDuelActionEffect", [actionForExecution, actor, opponent, battle]);
        var actionApplied = Boolean(result) && result.applied !== false && result.blocked !== true;
        results.push({ applied: actionApplied, reason: actionApplied ? "" : (result?.reason || "动作未结算"), action: actionForExecution, result: result });
        if (actionApplied) appliedActions.push(actionForExecution);
        updateDuelHandExecutionTracking(battle, side, selected, index, entry, actionApplied);
        if (isDuelActorDefeatedForExecution(actor, battle, side)) break;
      }
    } finally {
      finishDuelHandExecutionTracking(battle, side);
    }
    if (appliedActions.length && options?.clearAfter !== false) {
      removeCardsFromPersistentHand(battle, side, appliedActions.map(function mapAction(action) { return action.id; }), options?.rules);
      invalidateDuelHandCandidateCache(battle);
      clearDuelSelectedHandActions(battle, side, { refund: false, rules: options?.rules, preserveResolved: true });
    }
    return {
      applied: appliedActions.length > 0,
      reason: appliedActions.length ? "" : "没有可结算手札",
      side: side,
      actions: appliedActions,
      results: results,
      totalApCost: selected.reduce(function sumAp(total, entry) { return total + Number(entry?.apCost || 0); }, 0),
      totalCeCost: preflight.totalCeCost,
      ap: getDuelApState(battle, side, options?.rules)
    };
  }

  function normalizeSelectedForExecution(entries, actor, opponent, battle, options) {
    var normalized = (entries || []).map(function normalizeEntry(entry) {
      var action = getActionFromEntry(entry);
      var actionId = getActionId(entry);
      var actionForCost = withZeroCeCostOverride(action, actor);
      var ceCost = Number(entry?.ceCost ?? getCeCost(actionForCost, actor));
      var apCost = Number(entry?.apCost ?? getDuelActionApCost(action, actor, opponent, battle));
      return {
        ...(entry || {}),
        id: actionId,
        actionId: actionId,
        label: entry?.label || action?.label || actionId,
        action: actionForCost,
        apCost: apCost,
        ceCost: ceCost,
        selectedRound: entry?.selectedRound ?? getTurnNumber(battle),
        side: entry?.side || getActorSide(actor, options)
      };
    });
    var atomicOrdered = global.JJKDuelActions?.orderCustomAtomicActionEntries?.(normalized) || normalized;
    return atomicOrdered
      .map(function addOriginalOrder(entry, index) { return { entry: entry, index: index }; })
      .sort(function prioritizeRangeAdjustment(left, right) {
        var leftPriority = isRangeAdjustmentCard(left.entry) ? 0 : 1;
        var rightPriority = isRangeAdjustmentCard(right.entry) ? 0 : 1;
        return leftPriority - rightPriority || left.index - right.index;
      })
      .map(function removeOriginalOrder(item) { return item.entry; });
  }

  function validateDuelSelectedForExecution(actor, opponent, battle, side, entries, options) {
    var seen = new Set();
    var totalCeCost = 0;
    var results = [];
    var selectedIds = new Set(entries.map(getActionId).filter(Boolean));
    var countedEntries = entries.filter(function countEntry(entry) { return !ignoresDuelHandSelectionLimit(entry); });
    var exclusiveEntry = countedEntries.find(isExclusiveDuelHandSelection);
    var simulatedActor = actor ? {
      ...actor,
      hp: Number(actor.hp || 0),
      ce: Number(actor.ce || 0),
      maxHp: Number(actor.maxHp || 0),
      maxCe: Number(actor.maxCe || 0)
    } : actor;
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return {
        applied: false,
        ok: false,
        reason: "体势已归零，无法行动",
        side: side,
        actions: entries.map(getActionFromEntry),
        results: results,
        totalCeCost: totalCeCost
      };
    }
    if (exclusiveEntry && countedEntries.length > 1) {
      return {
        applied: false,
        ok: false,
        reason: getExclusiveDuelHandSelectionReason(exclusiveEntry),
        side: side,
        actions: entries.map(getActionFromEntry),
        results: results,
        totalCeCost: totalCeCost
      };
    }
    var maxSelections = getDuelSelectionMaxForActions(actor, battle, options?.rules, countedEntries, null);
    if (countedEntries.length > maxSelections) {
      return {
        applied: false,
        ok: false,
        reason: "本回合手札选择数已达上限",
        side: side,
        actions: entries.map(getActionFromEntry),
        results: results,
        totalCeCost: totalCeCost
      };
    }
    for (var index = 0; index < entries.length; index += 1) {
      var entry = entries[index];
      var action = getActionFromEntry(entry);
      var actionId = getActionId(entry);
      if (!action?.id || !actionId) {
        return { applied: false, ok: false, reason: "手札不存在", side: side, actions: [], results: results, totalCeCost: totalCeCost };
      }
      if (seen.has(actionId)) {
        return { applied: false, ok: false, reason: "本回合已选择", side: side, actions: entries.map(getActionFromEntry), results: results, totalCeCost: totalCeCost };
      }
      seen.add(actionId);
      if (entry.selectedRound && Number(entry.selectedRound) !== getTurnNumber(battle)) {
        return { applied: false, ok: false, reason: "手札回合已过期", side: side, actions: entries.map(getActionFromEntry), results: results, totalCeCost: totalCeCost };
      }
      var availability = getAvailability(action, simulatedActor, opponent, battle);
      var ceCost = Number(entry.ceCost ?? availability.costCe ?? getCeCost(action, actor));
      totalCeCost += ceCost;
      if (!availability.available) {
        return {
          applied: false,
          ok: false,
          reason: availability.reason || "当前状态不可用",
          side: side,
          actions: entries.map(getActionFromEntry),
          results: [{ applied: false, reason: availability.reason || "当前状态不可用", action: action }],
          totalCeCost: totalCeCost
        };
      }
      if (simulatedActor) {
        var paidCe = Math.min(Number(simulatedActor.ce || 0), ceCost);
        simulatedActor.ce = Number((Number(simulatedActor.ce || 0) - paidCe).toFixed(1));
        var hpCost = Number(action?.effects?.selfHpCostFlat ?? action?.selfHpCostFlat ?? 0);
        if (hpCost > 0) {
          var beforeHp = Number(simulatedActor.hp || 0);
          simulatedActor.hp = Number(Math.max(1, beforeHp - hpCost).toFixed(1));
          hpCost = Math.max(0, beforeHp - Number(simulatedActor.hp || 0));
        }
        if (action?.bloodConversion === "ce_to_hp") {
          simulatedActor.hp = Number((Number(simulatedActor.hp || 0) + paidCe * Number(action.bloodCeToHpEfficiency || 0.82)).toFixed(1));
        } else if (action?.bloodConversion === "hp_to_ce") {
          simulatedActor.ce = Number((Number(simulatedActor.ce || 0) + hpCost * Number(action.bloodHpToCeEfficiency || 0.76)).toFixed(1));
        }
      }
    }
    var remainingCe = Number(simulatedActor ? simulatedActor.ce : Number(actor.ce || 0));
    if (remainingCe < 0) {
      return { applied: false, ok: false, reason: "咒力不足", side: side, actions: entries.map(getActionFromEntry), results: [], totalCeCost: totalCeCost };
    }
    return { ok: true, entries: entries, totalCeCost: totalCeCost };
  }

  function isOpponentMahoragaProxyActive(battle, opponent) {
    var side = opponent?.side || "";
    return Boolean(side && battle?.mahoragaProxy?.[side]?.active);
  }

  function getCpuDamagePriority(candidate, actor, opponent) {
    var action = getActionFromEntry(candidate);
    var effects = action?.effects || {};
    var settlement = getBattleDirectCardSettlement(action, actor, opponent);
    var values = [
      settlement?.damage,
      action?.numericPreview?.finalDamage,
      getBattleRuntimeActionDamage(action, 0),
      action?.hpDamage,
      effects.hpDamage,
      effects.directDamage,
      effects.hutianBlackFlash ? 45 : 0
    ];
    return values.reduce(function maxDamage(max, value) {
      var numeric = Number(value || 0);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
  }

  function clampDuelCpuNumber(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = min;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeDuelCpuRate(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.abs(number) > 1 ? number / 100 : number;
  }

  function getDuelCpuMartialScore(resource) {
    var profile = resource?.characterCardProfile || {};
    var raw = profile.raw || {};
    var axes = profile.axes || {};
    return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? resource?.raw?.martialScore ?? resource?.axes?.body ?? 0) || 0);
  }

  function getDuelCpuHitRateFromMartialDiff(diff) {
    var rounded = Math.round(Number(diff || 0));
    if (rounded >= 4) return 0.9;
    if (rounded === 3) return 0.86;
    if (rounded === 2) return 0.8;
    if (rounded === 1) return 0.73;
    if (rounded === 0) return 0.66;
    if (rounded === -1) return 0.58;
    if (rounded === -2) return 0.49;
    if (rounded === -3) return 0.4;
    if (rounded === -4) return 0.32;
    return 0.25;
  }

  function getDuelCpuAccuracyConfig(profile) {
    var configs = {
      melee: { hitBonus: 0, min: 0.25, max: 0.9, missDamageScale: 0 },
      weapon: { hitBonus: 0.02, min: 0.25, max: 0.92, missDamageScale: 0 },
      execution_sword: { hitBonus: -0.04, min: 0.08, max: 0.86, missDamageScale: 0 },
      world_slash: { hitBonus: 0.04, min: 0.08, max: 0.92, missDamageScale: 0 },
      technique_projectile: { hitBonus: 0.08, min: 0.3, max: 0.94, missDamageScale: 0.18 },
      technique_area: { hitBonus: 0.23, min: 0.42, max: 0.95, missDamageScale: 0.45 }
    };
    return configs[profile] || null;
  }

  function getActiveDuelCpuEvasionStatusBonus(resource) {
    return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce(function addBonus(total, effect) {
      var bonus = Number(effect?.evasionBonus || 0);
      return Number.isFinite(bonus) && bonus > 0 ? total + bonus : total;
    }, 0);
  }

  function hasDuelCpuMythicalBeastAmberAoeFullDodge(resource) {
    return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).some(function hasAmberAoeDodge(effect) {
      return effect?.id === "mythicalBeastAmber" && (effect.mythicalBeastAmberAoeFullDodge === true || Number(effect.evasionBonus || 0) > 0);
    });
  }

  function shouldDuelCpuMythicalBeastAmberFullyDodgeAoe(candidate, defender) {
    var action = getActionFromEntry(candidate);
    var profile = inferDuelCpuAccuracyProfile(candidate);
    var text;
    if (String(profile || "") !== "technique_area") return false;
    if (!hasDuelCpuMythicalBeastAmberAoeFullDodge(defender)) return false;
    if (action?.domainSpecific || action?.effects?.activateDomain || action?.effects?.releaseDomain) return false;
    if (action?.evasionAllowed === false || action?.instantKillOnHit || action?.effects?.instantKillOnHit || action?.executionSword) return false;
    text = getDuelCpuTechniqueText(candidate);
    if (/领域|必中|sure[_\s-]?hit|unavoidable|不可闪避|无法闪避|世界斩|world[_\s-]?slash|处刑人之剑|execution/i.test(text)) return false;
    return true;
  }

  function inferDuelCpuAccuracyProfile(candidate) {
    var action = getActionFromEntry(candidate);
    if (!action) return "none";
    if (action.accuracyProfile) return String(action.accuracyProfile);
    var text = getDuelCpuTechniqueText(candidate);
    if (/范围|area|aoe|必中|领域|sure[_\s-]?hit/i.test(text)) return "technique_area";
    if (/远程|远距|投射|射出|projectile|beam|光束|斩击|slash|cleave|dismantle/i.test(text)) return "technique_projectile";
    if (/武器|咒具|刀|剑|weapon|sword/i.test(text)) return "weapon";
    if (getCpuDamagePriority(candidate) > 0) return "melee";
    return "none";
  }

  function getDuelCpuHitRate(candidate, actor, opponent) {
    var action = getActionFromEntry(candidate);
    var damage = getCpuDamagePriority(candidate);
    if (!action || damage <= 0) return 1;
    var explicitBase = action.baseHitRate ?? action.accuracyBaseRate;
    if (explicitBase != null && (action.evasionAllowed === false || String(action.accuracyProfile || "") === "none")) {
      return clampDuelCpuNumber(normalizeDuelCpuRate(explicitBase, 1), 0.05, 1);
    }
    if (action.evasionAllowed === false || action.effects?.activateDomain || action.domainSpecific) return 1;
    var profile = inferDuelCpuAccuracyProfile(candidate);
    var config = getDuelCpuAccuracyConfig(profile);
    if (!config) return 1;
    var martialDiff = getDuelCpuMartialScore(actor) - getDuelCpuMartialScore(opponent);
    var baseRate = normalizeDuelCpuRate(explicitBase, getDuelCpuHitRateFromMartialDiff(martialDiff));
    var modifier = normalizeDuelCpuRate(action.hitRateModifier ?? action.accuracyModifier ?? action.effects?.hitRateModifier, 0);
    return Number(clampDuelCpuNumber(baseRate + Number(config.hitBonus || 0) + modifier - getActiveDuelCpuEvasionStatusBonus(opponent), Number(config.min || 0.05), Number(config.max || 0.96)).toFixed(4));
  }

  function getDuelCpuMissDamageScale(candidate, opponent) {
    var action = getActionFromEntry(candidate);
    var profile = inferDuelCpuAccuracyProfile(candidate);
    var configured = getDuelCpuAccuracyConfig(profile);
    if (shouldDuelCpuMythicalBeastAmberFullyDodgeAoe(candidate, opponent)) return 0;
    var scale = action?.onMiss?.damageScale ?? action?.damageScaleOnMiss ?? configured?.missDamageScale ?? 0;
    return clampDuelCpuNumber(scale, 0, 1);
  }

  function getCpuExpectedDamagePriority(candidate, actor, opponent) {
    var damage = getCpuDamagePriority(candidate, actor, opponent);
    if (damage <= 0) return 0;
    var hitRate = getDuelCpuHitRate(candidate, actor, opponent);
    var missScale = getDuelCpuMissDamageScale(candidate, opponent);
    var reliability = hitRate < 0.7 ? Math.max(0.2, Math.pow(hitRate / 0.7, 1.35)) : 1;
    return Number((damage * (hitRate + (1 - hitRate) * missScale) * reliability).toFixed(4));
  }

  function getCpuBlockPriority(candidate, actor, opponent) {
    var action = getActionFromEntry(candidate);
    var effects = action?.effects || {};
    var settlement = getBattleDirectCardSettlement(action, actor, opponent);
    return [settlement?.block, action?.numericPreview?.finalBlock, action?.effect?.block ?? action?.block, effects.block, effects.incomingHpScale ? (1 - Number(effects.incomingHpScale || 1)) * 80 : 0]
      .reduce(function maxBlock(max, value) {
        var numeric = Number(value || 0);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
      }, 0);
  }

  function getCpuHealingPriority(candidate, actor, opponent) {
    var action = getActionFromEntry(candidate);
    var effects = action?.effects || {};
    var settlement = getBattleDirectCardSettlement(action, actor, opponent);
    return [
      settlement?.healing,
      action?.numericPreview?.finalHealing,
      action?.baseHealing,
      effects.healing,
      effects.hpHealing
    ].reduce(function maxHealing(max, value) {
      var numeric = Number(value || 0);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 0);
  }

  function getCpuActionType(candidate) {
    var action = getActionFromEntry(candidate);
    return String(action?.cardType || action?.type || "").toLowerCase();
  }

  function hasDuelCpuDomainAccess(resource) {
    if (!resource) return false;
    if (resource.domain?.active) return true;
    var profile = buildDuelCharacterCardProfile(resource);
    if (profile.hasDomainAccess === true) return true;
    if (profile.hasDomainAccess === false) return false;
    var text = [
      resource.name,
      resource.displayName,
      resource.characterCardProfile?.domainProfile,
      resource.characterCardProfile?.domainScript?.domainName,
      resource.domainProfile,
      resource.domain?.name,
      profile.domainProfile,
      profile.domainScript?.domainName
    ].filter(Boolean).join(" ");
    if (isAntiDomainOnlyText(text) || hasNoDomainDeclarationText(text)) return false;
    return hasPositiveDomainDeclarationText(text);
  }

  function isDuelCpuDomainExpandAction(candidate) {
    var action = getActionFromEntry(candidate);
    var type = getCpuActionType(candidate);
    var text = getDuelCpuTechniqueText(candidate);
    return Boolean(action?.effects?.activateDomain) ||
      action?.id === "domain_expand" ||
      action?.cardId === "card_domain_expand" ||
      /domain_expand|领域展开|伏魔御厨子|无量空处|嵌合暗翳庭|坐杀搏徒|诛伏赐死/i.test(type + " " + text);
  }

  function shouldDuelCpuForceDomainExpansion(actor, opponent, battle) {
    if (!actor || !opponent || actor?.side !== "right") return false;
    if (actor?.domain?.active) return false;
    if (!hasDuelCpuDomainAccess(actor) || !hasDuelCpuDomainAccess(opponent)) return false;
    if (battle?.dounaGauntlet && Number(battle.dounaGauntlet.bossLife || 1) !== 1) return false;
    return true;
  }

  function shouldGuaranteeDomainExpandHand(actor, battle) {
    if (!actor || actor?.domain?.active) return false;
    if (battle?.dounaGauntlet && actor?.side === "right" && Number(battle.dounaGauntlet.bossLife || 1) !== 1) return false;
    if (isSukunaMahoragaGuestActor(actor, battle) && getTurnNumber(battle) >= 3) {
      return !Boolean(battle?.activityContext?.sukunaMahoragaInteraction?.domainDeployed);
    }
    return hasDuelCpuDomainAccess(actor);
  }

  function buildDuelCpuPriorityDomainCandidate(actor, opponent, battle, side, sourceCandidates) {
    if (!shouldGuaranteeDomainExpandHand(actor, battle)) return null;
    var existing = (sourceCandidates || []).find(isDuelCpuDomainExpandAction);
    if (existing) return {
      ...(existing || {}),
      handSource: existing.handSource || "cpu-domain-priority",
      domainHand: true,
      domainPriority: true
    };
    var rawPool = getCachedDuelActionPool(actor, opponent, battle);
    var action = (rawPool || []).find(function findDomainExpand(item) {
      return item?.id === "domain_expand" || item?.cardId === "card_domain_expand" || Boolean(item?.effects?.activateDomain);
    });
    if (!action) return null;
    var candidate = wrapActionAsCandidate(action, actor, opponent, battle, { side: side || actor?.side || "right", count: 1 });
    if (!isDuelCpuDomainExpandAction(candidate) || candidate.available === false) return null;
    return {
      ...(candidate || {}),
      handSource: "cpu-domain-priority",
      domainHand: true,
      domainPriority: true,
      drawnRound: getTurnNumber(battle)
    };
  }

  function injectGuaranteedDomainExpandCandidate(candidates, actor, opponent, battle, side, maxCount) {
    var list = Array.isArray(candidates) ? candidates.slice() : [];
    var priority = buildDuelCpuPriorityDomainCandidate(actor, opponent, battle, side, list);
    if (!priority) return list;
    var priorityId = getActionId(priority);
    var merged = [priority].concat(list.filter(function keepNonDuplicate(candidate) {
      return getActionId(candidate) !== priorityId;
    }));
    var limit = Math.max(1, Math.round(Number(maxCount || merged.length || 1)));
    return merged.slice(0, limit);
  }

  function isDuelCpuFunctionalAction(candidate) {
    var action = getActionFromEntry(candidate);
    var type = getCpuActionType(candidate);
    var effects = action?.effects || {};
    return Boolean(action?.summonSpec || action?.resourceSpec || action?.maintenanceSpec || action?.mahoragaProxySpec) ||
      ["support", "resource", "defense", "counter", "summon", "maintenance", "trial", "healing", "rct"].some(function match(part) { return type.includes(part); }) ||
      Boolean(effects.activateDomain || effects.selfStatus || effects.selfStatuses || effects.opponentStatus || effects.opponentStatuses) ||
      Number(effects.outgoingScale || effects.damageScale || 0) > 1 ||
      Number(effects.incomingHpScale || 1) < 1 ||
      Number(effects.stabilityDelta || 0) !== 0 ||
      Number(effects.opponentStabilityDelta || 0) !== 0 ||
      Number(effects.domainLoadDelta || effects.opponentDomainLoadDelta || 0) !== 0;
  }

  function isDuelCpuTenShadowsAction(candidate) {
    var action = getActionFromEntry(candidate);
    var text = getDuelCpuTechniqueText(candidate);
    return Boolean(action?.summonSpec && /ten_shadows|十影|十种影|式神|shikigami|mahoraga|魔虚罗/i.test(text)) ||
      /ten_shadows|十种影法术|十种影|十影|嵌合暗翳庭|魔虚罗|魔须罗|mahoraga|玉犬|鵺|满象|脱兔|式神|影法术/i.test(text);
  }

  function isDuelCpuSukunaShrineAction(candidate) {
    var action = getActionFromEntry(candidate);
    var text = getDuelCpuTechniqueText(candidate);
    return action?.id === "douna_first_life_dismantle" ||
      action?.id === "douna_first_life_cleave" ||
      action?.id === "douna_first_life_furnace" ||
      /御厨子|伏魔御厨子|宿傩|解|捌|炉火开门|灶[·・]?开|斩击|shrine|dismantle|cleave|furnace/i.test(text);
  }

  function isDuelCpuDounaFirstLifeSukuna(actor, battle) {
    if (!battle?.dounaGauntlet || actor?.side !== "right") return false;
    if (Number(battle.dounaGauntlet.bossLife || 1) !== 1) return false;
    if ((actor?.statusEffects || []).some(function hasFirstLife(effect) { return effect?.id === "dounaSukunaFirstLife"; })) return true;
    return /宿傩|sukuna|御厨子/i.test(String(actor?.name || actor?.displayName || actor?.characterCardProfile?.displayName || ""));
  }

  function isGenericMahoragaTuningCandidate(candidate) {
    var action = getActionFromEntry(candidate);
    var text = getDuelCpuTechniqueText(candidate);
    return action?.id === "mahoraga_tuning_ritual" ||
      action?.id === "ten_shadows_mahoraga_tuning_ritual" ||
      action?.cardId === "card_mahoraga_tuning_ritual" ||
      action?.cardId === "card_ten_shadows_mahoraga_tuning_ritual" ||
      /mahoraga_tuning_ritual|魔虚罗调幅仪式|调幅仪式/i.test(text);
  }

  function chooseDuelCpuStrategy(actor, opponent, candidates) {
    var actorHpRatio = Number(actor?.maxHp || 0) > 0 ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    var actorCeRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    var opponentHp = Number(opponent?.hp || 0);
    var possibleDamage = (candidates || []).reduce(function sumDamage(total, candidate) {
      return total + getCpuExpectedDamagePriority(candidate, actor, opponent);
    }, 0);
    if (!actor?.domain?.active && hasDuelCpuDomainAccess(actor) && hasDuelCpuDomainAccess(opponent) && (candidates || []).some(isDuelCpuDomainExpandAction)) return "DOMAIN";
    if (opponentHp > 0 && possibleDamage >= opponentHp * 1.02) return "KILL";
    if (actorHpRatio <= 0.36) return "DEFENSE";
    if (actorCeRatio <= 0.24) return "VALUE";
    if (Number(actor?.hp || 0) - Number(opponent?.hp || 0) > 80 && actorCeRatio >= 0.45) return "TEMPO";
    return "BALANCE";
  }

  function getDuelCpuStrategyWeights(strategy) {
    return {
      KILL: { damage: 1.85, block: 0.08, ceUse: 0.22, conserve: -0.18, domain: 0.4, support: 0.05, risk: 0.05 },
      DOMAIN: { damage: 0.78, block: 0.5, ceUse: 0.22, conserve: -0.08, domain: 6.5, support: 0.82, risk: -0.08 },
      TEMPO: { damage: 1.05, block: 0.35, ceUse: 0.22, conserve: -0.05, domain: 0.45, support: 0.3, risk: -0.08 },
      DEFENSE: { damage: 0.5, block: 1.25, ceUse: 0.16, conserve: 0.08, domain: 0.25, support: 0.45, risk: -0.35 },
      VALUE: { damage: 0.72, block: 0.42, ceUse: -0.1, conserve: 0.62, domain: 0.15, support: 0.38, risk: -0.28 },
      BALANCE: { damage: 0.9, block: 0.62, ceUse: 0.14, conserve: 0.16, domain: 0.32, support: 0.28, risk: -0.12 }
    }[strategy] || { damage: 0.9, block: 0.62, ceUse: 0.14, conserve: 0.16, domain: 0.32, support: 0.28, risk: -0.12 };
  }

  function normalizeDuelCpuDifficulty(value) {
    var key = String(value || "").trim().toLowerCase();
    return ["easy", "normal", "hard"].includes(key) ? key : "normal";
  }

  function getDuelCpuDifficultyConfig(value, rules) {
    var defaults = {
      easy: { id: "easy", label: "简单：陪练", beamWidth: 1, scoreNoise: 0.2, mistakeRate: 0.2, mistakePool: 3 },
      normal: { id: "normal", label: "普通：稳定", beamWidth: 3, scoreNoise: 0, mistakeRate: 0, mistakePool: 1 },
      hard: { id: "hard", label: "困难：强规划", beamWidth: 5, scoreNoise: 0, mistakeRate: 0, mistakePool: 1 }
    };
    var id = normalizeDuelCpuDifficulty(value || rules?.cpuDifficulty?.default || "normal");
    var configured = rules?.cpuDifficulty?.options?.[id] || {};
    return { ...defaults[id], ...configured, id };
  }

  function getDuelCpuPlanningRandom(battle) {
    var value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
    return Math.max(0, Math.min(0.999999, Number(value) || 0));
  }

  function isDuelCpuSetupAction(candidate) {
    var action = getActionFromEntry(candidate);
    var type = getCpuActionType(candidate);
    var effects = action?.effects || {};
    return isDuelCpuDomainExpandAction(candidate) ||
      isDuelCpuFunctionalAction(candidate) ||
      ["support", "resource", "defense", "counter"].some(function match(part) { return type.includes(part); }) ||
      Number(effects.outgoingScale || effects.damageScale || 0) > 1 ||
      Number(effects.stabilityDelta || 0) > 0 ||
      Number(getCpuBlockPriority(candidate) || 0) > 0;
  }

  function isDuelCpuAttackAction(candidate) {
    return getCpuDamagePriority(candidate) > 0;
  }

  function getDuelCpuActorSide(actor) {
    return actor?.side || "right";
  }

  function createDuelCpuTempSelectionEntry(candidate, actor, battle) {
    var action = getActionFromEntry(candidate);
    var actionId = getActionId(candidate);
    return {
      id: actionId,
      actionId: actionId,
      label: candidate?.label || action?.label || actionId,
      action: action,
      selectedRound: getTurnNumber(battle),
      side: getDuelCpuActorSide(actor)
    };
  }

  function getDuelCpuAvailabilityForSequence(candidate, actor, opponent, battle, sequence) {
    if (!battle) return getAvailability(getActionFromEntry(candidate), actor, opponent, battle);
    var side = getDuelCpuActorSide(actor);
    var previousSelections = battle.selectedHandActions?.[side];
    battle.selectedHandActions ||= {};
    battle.selectedHandActions[side] = (sequence || []).map(function mapSequence(item) {
      return createDuelCpuTempSelectionEntry(item, actor, battle);
    });
    try {
      return getAvailability(getActionFromEntry(candidate), actor, opponent, battle);
    } finally {
      if (previousSelections) {
        battle.selectedHandActions[side] = previousSelections;
      } else if (battle.selectedHandActions) {
        delete battle.selectedHandActions[side];
      }
    }
  }

  function isDuelCpuConditionalAvailability(availability) {
    var reason = String(availability?.reason || "");
    return /需要本回合一起|需要.*一起|another card|requires another/i.test(reason);
  }

  function getDuelCpuTechniqueText(candidate) {
    return collectCandidateSearchText(candidate);
  }

  function isDuelCpuProjectionAttack(candidate) {
    var action = getActionFromEntry(candidate);
    var spec = action?.projectionSorcery || {};
    var text = getDuelCpuTechniqueText(candidate);
    return Boolean(action?.projectionRuntime?.active || action?.projectionSorcery || /projection_sorcery|投射|二十四帧|帧内闪击|破帧/.test(text)) && getCpuDamagePriority(candidate) > 0 && spec.effect !== "self_bind";
  }

  function isDuelCpuProjectionSelfBind(candidate) {
    var action = getActionFromEntry(candidate);
    var text = getDuelCpuTechniqueText(candidate);
    return action?.projectionSorcery?.effect === "self_bind" || /自缚帧|projectionSelfBindFrame/.test(text);
  }

  function isDuelCpuSequenceCompatible(candidate, sequence) {
    var action = getActionFromEntry(candidate);
    var previous = Array.isArray(sequence) ? sequence : [];
    if (!action?.id) return false;
    if (isExclusiveDuelHandSelection(action) && previous.length > 0) return false;
    if (previous.some(isExclusiveDuelHandSelection)) return false;
    if (action.starRageEffect === "black_hole" && previous.length > 0) return false;
    if (previous.some(function hasBlackHole(item) { return getActionFromEntry(item)?.starRageEffect === "black_hole"; })) return false;
    if (isDuelCpuProjectionSelfBind(candidate) && previous.some(isDuelCpuProjectionAttack)) return false;
    if (isDuelCpuProjectionAttack(candidate) && previous.some(isDuelCpuProjectionSelfBind)) return false;
    if (action?.projectionSorcery?.requiresAnotherCard && previous.length < 1) return false;
    return true;
  }

  function getDuelCpuTechniqueState(actor, battle) {
    var side = getDuelCpuActorSide(actor);
    var turn = getTurnNumber(battle);
    var readCounter = global.JJKDuelCounterPipeline?.readCounter;
    var read = typeof readCounter === "function"
      ? function readTechniqueCounter(namespaceName, counterId, options) {
          return Number(readCounter(battle, side, namespaceName, counterId, options || {}));
        }
      : function readTechniqueCounterFallback(namespaceName, counterId, options) {
          return Number(options?.initial || 0);
        };
    return {
      side: side,
      turn: turn,
      projectionFrame: read("projection_sorcery", "projectionFrame", { initial: 10, min: 0, max: 24 }),
      projectionMax: Number(global.JJKDuelCounterPipeline?.ensureCounter?.(battle, side, "projection_sorcery", "projectionFrame", { initial: 10, min: 0, max: 24 })?.max ?? 24),
      starMass: read("star_rage", "virtual_mass", { initial: 1, min: 0, max: 7 }),
      bloodPierce: read("blood_manipulation", "pierce", { initial: 0, min: 0, max: 6 }),
      bloodBoost: read("blood_manipulation", "blood", { initial: 0, min: 0, max: 8 })
    };
  }

  function scoreDuelCpuTechniqueSynergy(candidate, actor, opponent, battle, strategy, sequence) {
    var action = getActionFromEntry(candidate);
    if (!action?.id) return 0;
    var previous = Array.isArray(sequence) ? sequence : [];
    var state = getDuelCpuTechniqueState(actor, battle);
    var hpRatio = Number(actor?.maxHp || 0) > 0 ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    var ceRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    var damage = getCpuExpectedDamagePriority(candidate, actor, opponent);
    var rawDamage = getCpuDamagePriority(candidate, actor, opponent);
    var block = getCpuBlockPriority(candidate, actor, opponent);
    var healing = getCpuHealingPriority(candidate, actor, opponent);
    var score = 0;
    var type = getCpuActionType(candidate);
    var spec = action.projectionSorcery || {};
    var text = getDuelCpuTechniqueText(candidate);
    if (isDuelCpuDomainExpandAction(candidate)) {
      var opponentHasDomain = hasDuelCpuDomainAccess(opponent);
      score += opponentHasDomain ? 520 : 110;
      score += previous.length === 0 ? (opponentHasDomain ? 260 : 36) : (opponentHasDomain ? -260 : -30);
      if (actor?.domain?.active) score -= 220;
    }
    if (isDuelCpuFunctionalAction(candidate)) {
      score += previous.length === 0 ? 18 : 8;
      if (strategy === "DEFENSE" && block > 0) score += 18 + block * 0.12;
      if (healing > 0) score += hpRatio < 0.62 ? 28 + healing * 0.5 : healing * 0.18;
    }
    if (isCurseSpiritPlacementHandAction(candidate)) {
      var guardPriority = Number(action?.guardRules?.priority ?? action?.unitStats?.guardPriority ?? 0);
      score += 58;
      if (/护主|护身|防御|guard|intercept|盾|壁|墙|壳|屏障/i.test(text)) score += strategy === "DEFENSE" || hpRatio < 0.68 ? 96 : 46;
      score += Math.min(50, Math.max(0, block) * 0.9 + guardPriority * 1.4);
      if (previous.every(isCurseSpiritPlacementHandAction)) score += 28;
      if (strategy === "DEFENSE" || hpRatio < 0.5) score += 44;
    }
    if (isDuelCpuTenShadowsAction(candidate)) {
      score += 62;
      if (action.summonSpec || type.includes("summon")) score += 72;
      if (/魔虚罗|魔须罗|mahoraga/i.test(text)) score += 90;
      if (/调伏|调幅|适应|法轮|adapt/i.test(text)) score += 52;
      if (/守护|护卫|防御|guard|intercept|玉犬|鵺|满象|脱兔|式神/i.test(text)) score += strategy === "DEFENSE" || hpRatio < 0.62 ? 42 : 24;
      if (/嵌合暗翳庭|领域|domain/i.test(text)) score += 42;
      if (previous.length === 0) score += 24;
    }
    if (isDuelCpuDounaFirstLifeSukuna(actor, battle) && isDuelCpuSukunaShrineAction(candidate)) {
      score += 135;
      if (damage > 0) score += Math.min(140, damage * 0.45);
      var opponentHpNow = Number(opponent?.hp || 0);
      var opponentMaxHp = Math.max(1, Number(opponent?.maxHp || opponentHpNow || 1));
      if (/炉火开门|灶[·・]?开|furnace/i.test(text)) score += strategy === "KILL" || opponentHpNow < opponentMaxHp * 0.45 ? 95 : 24;
      if (/解|dismantle/i.test(text)) score += 42;
      if (/捌|cleave/i.test(text)) score += 54;
      if (previous.some(isDuelCpuTenShadowsAction)) score += 36;
    }
    if (action.projectionSorcery || /projection_sorcery|投射|帧/.test(text)) {
      var frameNeed = Math.max(0, state.projectionMax - state.projectionFrame);
      if (Number(spec.frameGain || 0) > 0) score += Math.min(26, Number(spec.frameGain || 0) * 5 + frameNeed * 0.7);
      if (spec.effect === "frame_shield" && (hpRatio < 0.58 || strategy === "DEFENSE")) score += 24 + block * 0.35;
      if (spec.effect === "over_frame_drive" && previous.length > 0) score += 22;
      if (spec.effect === "self_bind") score += strategy === "DEFENSE" || hpRatio < 0.5 ? 18 : -18;
      if (isDuelCpuProjectionAttack(candidate) && previous.some(function hasProjectionSetup(item) {
        var setup = getActionFromEntry(item)?.projectionSorcery || {};
        return Number(setup.frameGain || 0) > 0 || setup.effect === "over_frame_drive";
      })) score += 18;
      if (Number(spec.frameCost || 0) > 0 && state.projectionFrame - Number(spec.frameCost || 0) < 8 && strategy !== "KILL") score -= 18;
      if (state.projectionFrame >= state.projectionMax - 1 && damage > 0) score += 34;
    }
    if (action.starRageEffect || /star_rage|星之怒|虚拟质量|凰轮|黑洞/.test(text)) {
      if (action.starRageEffect === "mass_attack") score += previous.some(isDuelCpuAttackAction) ? -12 : 28;
      if (action.starRageEffect === "mass_defense") score += hpRatio < 0.55 || strategy === "DEFENSE" ? 30 : 8;
      if (action.starRageEffect === "garuda") score += state.starMass >= Number(action.starRageSummonMassCost || 0) ? 24 : -20;
      if (Number(action.starRageMassGain || 0) > 0) score += Math.max(6, 18 - state.starMass * 1.5);
      if (action.starRageEffect === "black_hole") {
        score += state.starMass >= 5 ? 50 + state.starMass * 5 : -80;
        if (hpRatio < 0.42 && strategy !== "KILL") score -= 36;
      }
    }
    if (action.bloodConversion || /blood_manipulation|赤血|咒力化血|血铸咒力|穿血|血刃/.test(text)) {
      var bloodSpec = action.bloodResource || {};
      if (action.bloodConversion === "ce_to_hp") score += hpRatio < 0.65 && ceRatio > 0.22 ? 34 : (state.bloodBoost < 3 ? 10 : -8);
      if (action.bloodConversion === "hp_to_ce") score += ceRatio < 0.42 && hpRatio > 0.52 ? 32 : (state.bloodBoost < 3 && hpRatio > 0.6 ? 12 : -24);
      if (!action.bloodConversion && damage > 0) {
        score += state.bloodPierce * 7 + state.bloodBoost * 5;
        if (previous.some(function hasBloodConversion(item) { return Boolean(getActionFromEntry(item)?.bloodConversion); })) score += 16;
      }
      if (bloodSpec.role === "blood_builder") score += state.bloodBoost < 5 ? 30 : -12;
      if (bloodSpec.role === "pierce_builder") score += state.bloodBoost >= 1 && state.bloodPierce < 4 ? 34 : -30;
      if (bloodSpec.role === "blood_burst") score += state.bloodBoost >= 3 ? 18 + state.bloodBoost * 7 : -100;
      if (bloodSpec.role === "pierce_finisher") score += state.bloodPierce >= 2 ? 22 + state.bloodPierce * 9 : -100;
      if (bloodSpec.role === "blood_guard") score += state.bloodBoost >= 2 && (hpRatio < 0.62 || strategy === "DEFENSE") ? 42 : -18;
      if (Number(action.bloodHpCostRatio || 0) > 0 && hpRatio < 0.36 && strategy !== "KILL") score -= 28;
    }
    if (action.summonSpec || type.includes("summon")) score += previous.length === 0 ? 20 : 8;
    if (action.resourceSpec || type.includes("resource")) score += ceRatio < 0.5 ? 20 : 10;
    if (rawDamage > 0) {
      var hitRate = getDuelCpuHitRate(candidate, actor, opponent);
      if (hitRate < 0.7) score -= (0.7 - hitRate) * Math.min(rawDamage, 640) * (strategy === "KILL" ? 0.75 : 1.05);
      if (hitRate >= 0.82) score += 8 + Math.min(rawDamage, 260) * 0.06;
    }
    return Number(score.toFixed(4));
  }

  function scoreDuelCpuAction(candidate, actor, opponent, battle, strategy, usedCe, sequence) {
    var action = getActionFromEntry(candidate);
    if (!action?.id) return -9999;
    var weights = getDuelCpuStrategyWeights(strategy);
    var type = getCpuActionType(candidate);
    var rawDamage = getCpuDamagePriority(candidate, actor, opponent);
    var damage = getCpuExpectedDamagePriority(candidate, actor, opponent);
    var block = getCpuBlockPriority(candidate, actor, opponent);
    var healing = getCpuHealingPriority(candidate, actor, opponent);
    var ceCost = Math.max(0, Number(getCeCost(action, actor) || 0));
    var maxCe = Math.max(1, Number(actor?.maxCe || actor?.ce || 1));
    var remainingCe = Math.max(0, Number(actor?.ce || 0) - Number(usedCe || 0) - ceCost);
    var score = 0;
    score += damage * weights.damage;
    if (rawDamage > 0) {
      var hitRate = getDuelCpuHitRate(candidate, actor, opponent);
      score += Math.min(rawDamage, 300) * 0.055 * Math.max(0.25, hitRate);
      if (hitRate < 0.7) score -= (0.7 - hitRate) * Math.min(rawDamage, 720) * (strategy === "KILL" ? 1.05 : 1.55);
      if (hitRate >= 0.8) score += 12 + Math.min(rawDamage, 260) * 0.05;
    }
    score += block * weights.block;
    if (healing > 0) {
      var missingHpRatio = Number(actor?.maxHp || 0) > 0 ? Math.max(0, Number(actor.maxHp || 0) - Number(actor.hp || 0)) / Number(actor.maxHp || 1) : 0;
      score += healing * (0.35 + missingHpRatio * 1.45);
      if (missingHpRatio > 0.32) score += 35;
    }
    score += (ceCost / maxCe) * 30 * weights.ceUse;
    score += (remainingCe / maxCe) * 18 * weights.conserve;
    if (type.includes("domain") || action.effects?.activateDomain) score += 45 * weights.domain;
    if (isDuelCpuDomainExpandAction(candidate)) {
      score += hasDuelCpuDomainAccess(opponent) && !actor?.domain?.active ? 420 : 75;
    }
    if (["support", "resource", "defense", "counter"].some(function match(part) { return type.includes(part); })) score += 12 * weights.support;
    if (isDuelCpuFunctionalAction(candidate)) score += 18 * weights.support;
    if (isDuelCpuTenShadowsAction(candidate)) score += 64;
    if (isDuelCpuDounaFirstLifeSukuna(actor, battle) && isDuelCpuSukunaShrineAction(candidate)) {
      score += 150;
      if (damage > 0) score += Math.min(180, damage * 0.52);
      if (type.includes("technique")) score += 28;
    }
    if (action.risk === "critical") score += 18 * weights.risk;
    if (action.risk === "high") score += 10 * weights.risk;
    if (Number(opponent?.hp || 0) > 0 && damage >= Number(opponent.hp || 0)) score += strategy === "KILL" ? 180 : 60;
    if (Number(actor?.hp || 0) < Number(actor?.maxHp || 0) * 0.32 && block > 0) score += 35;
    if (battle?.domainSubPhase && /trial|rule/.test(type + " " + action.id)) score += 12;
    if (isExclusiveDuelHandSelection(action) && strategy !== "KILL" && damage < Number(opponent?.hp || 0)) score -= 8;
    var previous = Array.isArray(sequence) ? sequence : [];
    var hasSetupBefore = previous.some(isDuelCpuSetupAction);
    var hasAttackBefore = previous.some(isDuelCpuAttackAction);
    if (isDuelCpuAttackAction(candidate) && hasSetupBefore) score += strategy === "KILL" ? 10 : 6;
    if (isDuelCpuSetupAction(candidate) && !hasAttackBefore) score += strategy === "DEFENSE" ? 7 : 3.5;
    if (isDuelCpuSetupAction(candidate) && hasAttackBefore && strategy !== "DEFENSE") score -= 4;
    score += scoreDuelCpuTechniqueSynergy(candidate, actor, opponent, battle, strategy, sequence);
    return Number(score.toFixed(4));
  }

  function getDuelCpuPlayableCandidates(actor, opponent, battle, ordered) {
    var used = new Set();
    return (ordered || []).filter(function keepPlayable(candidate) {
      var action = getActionFromEntry(candidate);
      var actionId = getActionId(candidate);
      if (!action?.id || !actionId || used.has(actionId)) return false;
      used.add(actionId);
      var availability = getDuelCpuAvailabilityForSequence(candidate, actor, opponent, battle, []);
      if (!availability.available && !isDuelCpuConditionalAvailability(availability)) return false;
      var ceCost = Math.max(0, Number(availability.costCe ?? getCeCost(action, actor)));
      return Number(actor?.ce || 0) >= ceCost;
    });
  }

  function getDuelCpuTargetSelectionCount(strategy, actor, playable, maxSelections) {
    var count = Math.max(0, Math.min(Number(maxSelections || 1), playable?.length || 0));
    if (count <= 1) return count;
    var ceRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    if (strategy === "KILL" || strategy === "TEMPO") return Math.min(3, count);
    if (strategy === "DOMAIN") return Math.min(3, count);
    if (strategy === "DEFENSE") return Math.min(count, playable.some(function hasBlock(candidate) { return getCpuBlockPriority(candidate) > 0; }) ? 3 : 2);
    if (strategy === "VALUE") return ceRatio < 0.12 ? 1 : Math.min(2, count);
    return ceRatio < 0.16 ? Math.min(2, count) : Math.min(3, count);
  }

  function scoreDuelCpuBeamFinal(beam, targetCount, maxSelections) {
    var length = Number(beam?.sequence?.length || 0);
    var target = Math.max(0, Number(targetCount || 0));
    var score = Number(beam?.score || 0);
    if (length > 0) score += length * 9;
    if (target > 0 && length === 0) score -= 120;
    if (target > 0 && length < target) score -= (target - length) * 28;
    if (length >= Math.min(target, maxSelections || target)) score += 10;
    return Number(score.toFixed(4));
  }

  function buildDuelCpuKillSequence(actor, opponent, battle, ordered, rules) {
    var maxSelections = getMaxSelections(rules);
    var hp = Math.max(0, Number(opponent?.hp || 0));
    if (!hp) return [];
    var usedCe = 0;
    var sequence = [];
    var candidates = (ordered || []).slice().sort(function byDamage(left, right) {
      return getCpuExpectedDamagePriority(right, actor, opponent) - getCpuExpectedDamagePriority(left, actor, opponent);
    });
    candidates.some(function addLethal(candidate) {
      var action = getActionFromEntry(candidate);
      if (!action?.id || sequence.length >= maxSelections) return true;
      if (!isDuelCpuAttackAction(candidate)) return false;
      var availability = getAvailability(action, actor, opponent, battle);
      var ceCost = Math.max(0, Number(availability.costCe ?? getCeCost(action, actor)));
      if (!availability.available || Number(actor.ce || 0) < usedCe + ceCost) return false;
      sequence.push(candidate);
      usedCe += ceCost;
      var damage = sequence.reduce(function sum(total, item) { return total + getCpuExpectedDamagePriority(item, actor, opponent); }, 0);
      return damage >= hp;
    });
    return sequence.reduce(function sum(total, item) { return total + getCpuExpectedDamagePriority(item, actor, opponent); }, 0) >= hp ? sequence : [];
  }

  function planDuelCpuHandSequence(actor, opponent, battle, ordered, options) {
    var rules = options?.rules || getDuelHandRules();
    var difficulty = getDuelCpuDifficultyConfig(options?.difficulty || battle?.cpuDifficulty || rules.cpuDifficulty?.default || "normal", rules);
    var baseMaxSelections = getMaxSelections(rules);
    var maxSelections = (ordered || []).some(isCurseSpiritPlacementHandAction) ? Math.max(baseMaxSelections, 5) : baseMaxSelections;
    var width = Math.max(1, Math.min(5, Number(options?.beamWidth || difficulty.beamWidth || rules.cpuBeamWidth || 3)));
    var strategy = chooseDuelCpuStrategy(actor, opponent, ordered);
    var playable = getDuelCpuPlayableCandidates(actor, opponent, battle, ordered);
    var priorityDomain = playable.find(isDuelCpuDomainExpandAction);
    if (priorityDomain && strategy === "DOMAIN") {
      ordered = [priorityDomain].concat((ordered || []).filter(function keepNonPriority(candidate) {
        return getActionId(candidate) !== getActionId(priorityDomain);
      }));
    }
    var targetSelections = getDuelCpuTargetSelectionCount(strategy, actor, playable, maxSelections);
    var playableCursePlacements = playable.filter(isCurseSpiritPlacementHandAction);
    if (maxSelections > baseMaxSelections && playableCursePlacements.length > baseMaxSelections) {
      targetSelections = Math.max(targetSelections, Math.min(maxSelections, playableCursePlacements.length));
    }
    var ceRatio = Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe || 1) : 1;
    if (difficulty.id === "hard" && strategy !== "VALUE" && playable.length >= 3 && maxSelections >= 3 && ceRatio >= 0.18) {
      targetSelections = Math.max(targetSelections, 3);
    }
    if (!playable.length) {
      battle.cpuPlannerLog = {
        difficulty: difficulty.id,
        difficultyLabel: difficulty.label,
        strategy: strategy,
        beamWidth: width,
        scoreNoise: Number(difficulty.scoreNoise || 0),
        score: 0,
        actionIds: [],
        playableCount: 0,
        targetSelections: 0,
        reason: "no-playable-hand-actions",
        generatedAtRound: Number(battle.round || 0) + 1
      };
      return [];
    }
    if (strategy === "KILL") {
      var killSequence = buildDuelCpuKillSequence(actor, opponent, battle, ordered, rules);
      if (killSequence.length) {
        battle.cpuPlannerLog = {
          difficulty: difficulty.id,
          difficultyLabel: difficulty.label,
          strategy: "KILL",
          beamWidth: width,
          fastPath: "lethal-confirmed",
          score: killSequence.reduce(function sum(total, item) { return total + getCpuExpectedDamagePriority(item, actor, opponent); }, 0),
          actionIds: killSequence.map(getActionId),
          playableCount: playable.length,
          targetSelections: Math.min(maxSelections, killSequence.length),
          generatedAtRound: Number(battle.round || 0) + 1
        };
        return killSequence;
      }
    }
    var beams = [{ sequence: [], score: 0, usedCe: 0, usedIds: new Set(), criticalUsed: false }];
    var steps = Math.max(1, Math.min(maxSelections, ordered.length));
    for (var step = 0; step < steps; step += 1) {
      var expanded = [];
      beams.forEach(function expandBeam(beam) {
        if (beam.sequence.length > 0) expanded.push({
          ...beam,
          score: beam.score - Math.max(0, targetSelections - beam.sequence.length) * 6
        });
        ordered.forEach(function addCandidate(candidate) {
          var action = getActionFromEntry(candidate);
          var actionId = getActionId(candidate);
          if (!action?.id || !actionId || beam.usedIds.has(actionId)) return;
          if (beam.sequence.length >= maxSelections) return;
          if (beam.criticalUsed || (action.risk === "critical" && beam.sequence.length > 0)) return;
          if (!isDuelCpuSequenceCompatible(candidate, beam.sequence)) return;
          if (beam.sequence.length >= baseMaxSelections && !beam.sequence.concat(candidate).every(isCurseSpiritPlacementHandAction)) return;
          var availability = getDuelCpuAvailabilityForSequence(candidate, actor, opponent, battle, beam.sequence);
          var ceCost = Math.max(0, Number(availability.costCe ?? getCeCost(action, actor)));
          if (!availability.available || Number(actor.ce || 0) < beam.usedCe + ceCost) return;
          var score = scoreDuelCpuAction(candidate, actor, opponent, battle, strategy, beam.usedCe, beam.sequence);
          var nextLength = beam.sequence.length + 1;
          score += 8;
          if (nextLength <= targetSelections) score += 16;
          if (targetSelections >= 3 && nextLength === 3) score += 12;
          if (strategy !== "VALUE" && nextLength < targetSelections) score += 4;
          if (difficulty.scoreNoise) {
            score += Math.abs(score || 1) * (getDuelCpuPlanningRandom(battle) * 2 - 1) * Number(difficulty.scoreNoise || 0);
          }
          var nextIds = new Set(beam.usedIds);
          nextIds.add(actionId);
          expanded.push({
            sequence: beam.sequence.concat(candidate),
            score: beam.score + score - Math.max(0, beam.sequence.length) * 1.5,
            usedCe: beam.usedCe + ceCost,
            usedIds: nextIds,
            criticalUsed: beam.criticalUsed || action.risk === "critical"
          });
        });
      });
      expanded.sort(function byScore(left, right) {
        return scoreDuelCpuBeamFinal(right, targetSelections, maxSelections) - scoreDuelCpuBeamFinal(left, targetSelections, maxSelections);
      });
      beams = expanded.slice(0, width);
      if (!beams.length) break;
    }
    var mistakeApplied = false;
    beams = (beams || []).filter(function keepNonEmpty(beam) {
      return beam?.sequence?.length > 0;
    }).sort(function byFinalScore(left, right) {
      return scoreDuelCpuBeamFinal(right, targetSelections, maxSelections) - scoreDuelCpuBeamFinal(left, targetSelections, maxSelections);
    });
    var best = beams[0] || { sequence: playable.slice(0, Math.min(targetSelections || 1, maxSelections)), score: 0 };
    if (difficulty.mistakeRate && beams.length > 1 && getDuelCpuPlanningRandom(battle) < Number(difficulty.mistakeRate || 0)) {
      var pool = Math.max(2, Math.min(beams.length, Number(difficulty.mistakePool || 2)));
      var mistakeIndex = Math.max(1, Math.min(pool - 1, 1 + Math.floor(getDuelCpuPlanningRandom(battle) * (pool - 1))));
      best = beams[mistakeIndex] || best;
      mistakeApplied = true;
    }
    battle.cpuPlannerLog = {
      difficulty: difficulty.id,
      difficultyLabel: difficulty.label,
      strategy: strategy,
      beamWidth: width,
      scoreNoise: Number(difficulty.scoreNoise || 0),
      mistakeApplied: mistakeApplied,
      score: scoreDuelCpuBeamFinal(best, targetSelections, maxSelections),
      actionIds: (best.sequence || []).map(getActionId),
      playableCount: playable.length,
      targetSelections: targetSelections,
      selectedCount: Number(best.sequence?.length || 0),
      generatedAtRound: Number(battle.round || 0) + 1
    };
    return best.sequence || [];
  }

  function selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, ordered, maxSelections, focusMahoragaProxy) {
    var failures = [];
    (ordered || []).some(function selectCandidate(candidate) {
      var action = getActionFromEntry(candidate);
      if (!action?.id) return false;
      if (getDuelSelectedHandActions(battle, side).length >= maxSelections) return true;
      if (action.risk === "critical" && getDuelSelectedHandActions(battle, side).length > 0) return false;
      var selected = selectDuelHandCandidate(candidate, actor, opponent, battle, { side: side, rules: rules });
      if (!selected.selected) {
        failures.push({ actionId: getActionId(candidate), reason: selected.reason || "select-failed" });
        if (selected.reason === "手牌超过上限，请先弃牌") {
          autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules);
          selected = selectDuelHandCandidate(candidate, actor, opponent, battle, { side: side, rules: rules });
          if (selected.selected) return false;
          failures.push({ actionId: getActionId(candidate), reason: selected.reason || "select-failed-after-discard" });
        }
      }
      if (!selected.selected && selected.reason === "咒力不足") return !focusMahoragaProxy;
      return false;
    });
    return failures;
  }

  function pickDuelCpuHandActions(actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) return [];
    var side = getActorSide(actor, { side: options?.side || actor.side || "right" });
    resetDuelApForTurn(battle, side, options?.rules);
    clearDuelSelectedHandActions(battle, side, { refund: false, rules: options?.rules });
    var rules = options?.rules || getDuelHandRules();
    var count = getChoiceCount(rules, options?.count);
    var candidates = pickDuelHandCandidates(actor, opponent, battle, count);
    var domainCandidates = pickDuelDomainHandCandidates(actor, opponent, battle, getDomainHandSize(rules));
    var discardedOverflow = autoDiscardDuelCpuOverflow(actor, opponent, battle, side, rules);
    var firstPick = null;
    var cpuPicker = getOptionalFunction("getDuelCpuAction");
    if (cpuPicker) firstPick = cpuPicker(actor, opponent, battle);
    var ordered = [];
    if (getActionId(firstPick)) ordered.push(firstPick);
    domainCandidates.concat(candidates).forEach(function addCandidate(candidate) {
      var actionId = getActionId(candidate);
      if (actionId && !ordered.some(function duplicate(item) { return getActionId(item) === actionId; })) ordered.push(candidate);
    });
    if (shouldDuelCpuForceDomainExpansion(actor, opponent, battle)) {
      var forcedDomain = ordered.find(isDuelCpuDomainExpandAction);
      if (forcedDomain) {
        selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, [forcedDomain], 1, false);
        if (getDuelSelectedHandActions(battle, side).length) {
          battle.cpuPlannerLog = {
            difficulty: normalizeDuelCpuDifficulty(options?.difficulty || battle?.cpuDifficulty || "hard"),
            strategy: "DOMAIN",
            fastPath: "forced-domain-against-domain-user",
            actionIds: [getActionId(forcedDomain)],
            playableCount: ordered.length,
            targetSelections: 1,
            finalSelectedCount: 1,
            generatedAtRound: Number(battle.round || 0) + 1
          };
          return getDuelSelectedHandActions(battle, side);
        }
      }
    }
    var focusMahoragaProxy = isOpponentMahoragaProxyActive(battle, opponent);
    if (focusMahoragaProxy) {
      ordered = ordered.slice().sort(function byDamage(left, right) {
        return getCpuExpectedDamagePriority(right, actor, opponent) - getCpuExpectedDamagePriority(left, actor, opponent);
      });
    }
    var planned = planDuelCpuHandSequence(actor, opponent, battle, ordered, { ...options, rules: rules });
    var fallbackOrdered = planned.length ? planned : ordered;
    var maxSelections = (ordered || []).some(isCurseSpiritPlacementHandAction) ? Math.max(getMaxSelections(rules), 5) : getMaxSelections(rules);
    var failures = selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, fallbackOrdered, maxSelections, focusMahoragaProxy);
    if (getDuelSelectedHandActions(battle, side).length < Math.min(maxSelections, ordered.length)) {
      failures = failures.concat(selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, ordered, maxSelections, focusMahoragaProxy));
    }
    if (!getDuelSelectedHandActions(battle, side).length) {
      var emergencyPlayable = getDuelCpuPlayableCandidates(actor, opponent, battle, ordered)
        .sort(function byEmergencyScore(left, right) {
          return scoreDuelCpuAction(right, actor, opponent, battle, chooseDuelCpuStrategy(actor, opponent, ordered), 0, []) -
            scoreDuelCpuAction(left, actor, opponent, battle, chooseDuelCpuStrategy(actor, opponent, ordered), 0, []);
        })
        .slice(0, Math.min(3, maxSelections));
      if (emergencyPlayable.length) {
        failures = failures.concat(selectDuelCpuOrderedCandidates(actor, opponent, battle, side, rules, emergencyPlayable, maxSelections, focusMahoragaProxy));
        if (battle.cpuPlannerLog) battle.cpuPlannerLog.emergencyPlayableFallback = emergencyPlayable.map(getActionId);
      }
    }
    if (battle.cpuPlannerLog) {
      battle.cpuPlannerLog.overflowAutoDiscarded = discardedOverflow;
      battle.cpuPlannerLog.selectionFailures = failures.slice(0, 8);
      battle.cpuPlannerLog.finalSelectedCount = getDuelSelectedHandActions(battle, side).length;
    }
    return getDuelSelectedHandActions(battle, side);
  }

  function getDuelHandResolutionOrder(battle, options) {
    var firstSide = options?.firstSide || options?.resolveOrder?.[0] || battle?.initiativeState?.firstSide;
    return firstSide === "right" ? ["right", "left"] : ["left", "right"];
  }

  function resolveDuelHandTurn(battle, options) {
    var activeBattle = getBattle(battle);
    if (!activeBattle?.resourceState) return { ok: false, reason: "战斗资源缺失" };
    var left = activeBattle.resourceState.p1;
    var right = activeBattle.resourceState.p2;
    if (!getDuelSelectedHandActions(activeBattle, "right").length && options?.autoPickCpu !== false) {
      pickDuelCpuHandActions(right, left, activeBattle, { side: "right", rules: options?.rules, difficulty: options?.difficulty || activeBattle.cpuDifficulty });
    }
    var results = { left: null, right: null };
    var resolutionOrder = getDuelHandResolutionOrder(activeBattle, options);
    resolutionOrder.forEach(function resolveSide(side) {
      results[side] = side === "right"
        ? applyDuelSelectedHandActions(right, left, activeBattle, { side: "right", rules: options?.rules })
        : applyDuelSelectedHandActions(left, right, activeBattle, { side: "left", rules: options?.rules });
    });
    var leftResult = results.left || { applied: false, reason: "本回合未行动", actions: [], results: [] };
    var rightResult = results.right || { applied: false, reason: "本回合未行动", actions: [], results: [] };
    activeBattle.currentActions = leftResult.actions || [];
    activeBattle.cpuActions = rightResult.actions || [];
    activeBattle.currentAction = activeBattle.currentActions[0] || null;
    activeBattle.cpuAction = activeBattle.cpuActions[0] || null;
    return {
      ok: Boolean(leftResult.applied || rightResult.applied),
      reason: leftResult.applied || rightResult.applied ? "" : (leftResult.reason || rightResult.reason || "没有可结算手札"),
      left: leftResult,
      right: rightResult,
      resolutionOrder: resolutionOrder
    };
  }

  function applyDuelHandSelection(actionOrId, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor || !opponent) {
      return { applied: false, reason: "战斗资源缺失" };
    }
    var side = getActorSide(actor, options);
    if (isDuelActorDefeatedForExecution(actor, battle, side)) {
      return { applied: false, reason: "体势已归零，无法行动" };
    }
    var candidate = typeof actionOrId === "string" ? findCandidateById(battle, actionOrId) : actionOrId;
    var action = candidate?.action || candidate;
    if (!action?.id) return { applied: false, reason: "手札不存在" };
    var availability = getAvailability(action, actor, opponent, battle);
    var ceCost = Number(availability.costCe ?? getCeCost(action, actor));
    if (!availability.available) {
      return { applied: false, reason: availability.reason || "不可执行", action: action, apCost: getDuelActionApCost(action, actor, opponent, battle), ceCost: ceCost };
    }
    if (Number(actor.ce || 0) < ceCost) {
      return { applied: false, reason: "咒力不足", action: action, apCost: getDuelActionApCost(action, actor, opponent, battle), ceCost: ceCost };
    }
    var apCost = getDuelActionApCost(action, actor, opponent, battle);
    var apSpend = {
      ok: true,
      legacy: true,
      gating: false,
      cost: apCost,
      reason: "AP 已降级为 legacy 显示，不再阻止普通手札。"
    };
    action = withDuelHandTargetPlan({
      ...withZeroCeCostOverride(action, actor),
      selectedCount: 1,
      selectedIndex: 0,
      selectedLast: true
    }, actor, opponent, battle, candidate, options);
    beginDuelHandExecutionTracking(battle, side, [candidate || action]);
    var result;
    var actionApplied = false;
    try {
      result = callDependency("applyDuelActionEffect", [action, actor, opponent, battle]);
      actionApplied = Boolean(result) && result.applied !== false && result.blocked !== true;
      updateDuelHandExecutionTracking(battle, side, [candidate || action], 0, candidate || action, actionApplied);
    } finally {
      finishDuelHandExecutionTracking(battle, side);
    }
    return {
      applied: actionApplied,
      reason: actionApplied ? "" : (result?.reason || "动作未结算"),
      action: action,
      apCost: apCost,
      ceCost: Number(result?.costCe ?? ceCost),
      ap: apSpend,
      result: result
    };
  }

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-hand",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "implementation",
      ownsBehavior: true,
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
    getDuelHandRules: getDuelHandRules,
    isTowerTojiNoCursedToolPhase: isTowerTojiNoCursedToolPhase,
    isTowerTojiCursedToolCandidate: isTowerTojiCursedToolCandidate,
    filterTowerTojiCursedToolCandidates: filterTowerTojiCursedToolCandidates,
    filterShibuyaMegumiTimelineCandidates: filterShibuyaMegumiTimelineCandidates,
    filterSukunaJogoTimelineCandidates: filterSukunaJogoTimelineCandidates,
    filterSukunaMahoragaTimelineCandidates: filterSukunaMahoragaTimelineCandidates,
    filterShibuyaMahitoSceneCandidates: filterShibuyaMahitoSceneCandidates,
    initializeDuelHandState: initializeDuelHandState,
    buildDuelHandCandidates: buildDuelHandCandidates,
    pickDuelHandCandidates: pickDuelHandCandidates,
    pickDuelDomainHandCandidates: pickDuelDomainHandCandidates,
    getDuelHandCardViewModel: getDuelHandCardViewModel,
    buildDuelCardViewModel: buildDuelCardViewModel,
    applyDuelHandSelection: applyDuelHandSelection,
    getDuelSelectedHandActions: getDuelSelectedHandActions,
    canSelectDuelHandCandidate: canSelectDuelHandCandidate,
    selectDuelHandCandidate: selectDuelHandCandidate,
    unselectDuelHandCandidate: unselectDuelHandCandidate,
    discardDuelHandCandidate: discardDuelHandCandidate,
    autoDiscardDuelHandOverflow: autoDiscardDuelHandOverflow,
    isHandLimitExemptCard: isHandLimitExemptCard,
    applyDuelSelectedHandActions: applyDuelSelectedHandActions,
    consumeDuelResolvedHandActions: consumeDuelResolvedHandActions,
    resolveDuelHandTurn: resolveDuelHandTurn,
    clearDuelSelectedHandActions: clearDuelSelectedHandActions,
    pickDuelCpuHandActions: pickDuelCpuHandActions,
    getDuelActionApCost: getDuelActionApCost,
    getDuelApState: getDuelApState,
    spendDuelAp: spendDuelAp,
    resetDuelApForTurn: resetDuelApForTurn,
    getDuelCharacterCardRules: getDuelCharacterCardRules,
    buildDuelCharacterCardProfile: buildDuelCharacterCardProfile,
    getDuelCharacterArchetypes: getDuelCharacterArchetypes,
    isDuelCardEligibleForCharacter: isDuelCardEligibleForCharacter,
    isDuelActionEligibleForCharacter: isDuelActionEligibleForCharacter,
    applyDuelCharacterCardWeights: applyDuelCharacterCardWeights,
    getDuelTechniqueHandWeightScale: getDuelTechniqueHandWeightScale,
    applyDuelTechniqueHandWeightScale: applyDuelTechniqueHandWeightScale,
    filterDuelHandCandidatesByCharacter: filterDuelHandCandidatesByCharacter,
    explainDuelCardIneligibility: explainDuelCardIneligibility,
    buildDuelHandCandidateCache: buildDuelHandCandidateCache,
    getDuelHandCandidateCache: getDuelHandCandidateCache,
    getDuelHandCandidateById: getDuelHandCandidateById,
    invalidateDuelHandCandidateCache: invalidateDuelHandCandidateCache,
    getDuelHandCandidateCacheStats: function getDuelHandCandidateCacheStats() {
      return {
        lastInvalidatedAt: handCandidateCacheStats.lastInvalidatedAt
      };
    },
    __test: Object.freeze({
      filterAtomicHandCandidatesByRuntimeRules: filterAtomicHandCandidatesByRuntimeRules,
      getAtomicFixedHandInjectionsForActor: getAtomicFixedHandInjectionsForActor,
      isExclusiveDuelHandSelection: isExclusiveDuelHandSelection,
      normalizeSelectedForExecution: normalizeSelectedForExecution,
      ignoresDuelHandSelectionLimit: ignoresDuelHandSelectionLimit,
      getDuelHandResolutionOrder: getDuelHandResolutionOrder
    })
  };

  global[namespace] = api;
})(globalThis);
