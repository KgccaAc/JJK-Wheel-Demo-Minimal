(function attachDuelActions(global) {
  "use strict";

  var namespace = "JJKDuelActions";
  var version = "1.413-ai-character-dsl-upgrade";
  var expectedExports = [
    "getDuelActionTemplates",
    "buildDuelActionPool",
    "pickDuelActionChoices",
    "getDuelActionCost",
    "getDuelActionAvailability",
    "normalizeDuelDomainState",
    "getCustomAtomicHandPolicy",
    "applyDuelActionEffect",
    "applyDuelStandardDamageToTarget",
    "getDuelRoundDamageScale",
    "primeDuelLockedDefenseActions",
    "getDuelMiracleStockpile",
    "setDuelMiracleStockpile",
    "applyDuelMiracleLethalPrevention",
    "resolveDuelMiracleLethalPreventionForBattle",
    "getDuelCpuAction",
    "buildDuelDomainSpecificActions",
    "getActiveTemporaryTechniqueGrants",
    "invalidateDuelActionChoices"
  ];
  var expectedDependencyNames = [
    "state",
    "getDuelActionRules",
    "getDuelMechanicTemplateRules",
    "getDuelCardTemplateIndex",
    "getDuelBattle",
    "getDuelActionCost",
    "getDuelProfileForSide",
    "getDuelDomainResponseProfile",
    "isDuelOpponentDomainThreat",
    "hasDuelDomainCounterAccess",
    "getDuelStatusEffectValue",
    "hashDuelSeed",
    "clamp",
    "syncDuelTrialSubPhaseLifecycle",
    "updateDuelDomainTrialContext",
    "normalizeDuelDomainSpecificAction",
    "applyDuelDomainSpecificAction",
    "applyDuelTrialAction",
    "applyDuelJackpotAction",
    "getDuelTrialOwnerActionTemplates",
    "getDuelTrialDefenderActionTemplates",
    "getDuelResourcePair",
    "clampDuelResource",
    "appendDuelActionLog",
    "recordDounaActionDamage",
    "recordDuelResourceChange",
    "getDuelResourceSideLabel",
    "formatSignedDuelDelta",
    "DUEL_DOMAIN_RESPONSE_ACTION_IDS",
  ];
  var dependencySources = {
    getDuelDomainResponseProfile: ["JJKDuelDomainResponse", "getDuelDomainResponseProfile"],
    isDuelOpponentDomainThreat: ["JJKDuelDomainResponse", "isDuelOpponentDomainThreat"],
    hasDuelDomainCounterAccess: ["JJKDuelDomainResponse", "hasDuelDomainCounterAccess"],
    getDuelCardTemplateIndex: ["JJKDuelCardTemplate", "getDuelCardTemplateIndex"],
    getDuelResourcePair: ["JJKDuelResource", "getDuelResourcePair"],
    clampDuelResource: ["JJKDuelResource", "clampDuelResource"],
    syncDuelTrialSubPhaseLifecycle: ["JJKDuelRuleSubphase", "syncDuelTrialSubPhaseLifecycle"],
    updateDuelDomainTrialContext: ["JJKDuelRuleSubphase", "updateDuelDomainTrialContext"],
    applyDuelTrialAction: ["JJKDuelRuleSubphase", "applyDuelTrialAction"],
    applyDuelJackpotAction: ["JJKDuelRuleSubphase", "applyDuelJackpotAction"],
    DUEL_DOMAIN_RESPONSE_ACTION_IDS: ["JJKDuelDomainResponse", "DUEL_DOMAIN_RESPONSE_ACTION_IDS"]
  };
  var domainResponseActionIds = new Set([
    "domain_clash",
    "simple_domain_guard",
    "hollow_wicker_basket_guard",
    "falling_blossom_emotion",
    "zero_ce_domain_bypass",
    "domain_survival_guard"
  ]);
  var domainControlActionIds = new Set([
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
  var commonBattleCardOwnershipTags = new Set([
    "public_baseline",
    "domain_access",
    "trial_defender_common"
  ]);
  var bindings = Object.create(null);
  var dependencies = Object.create(null);
  var actionTemplateIndexCache = null;
  var mechanicTemplateIndexCache = null;
  var BLACK_ROPE_DEFAULT_LENGTH = 5;
  var BLACK_ROPE_ACTION_COSTS = Object.freeze({
    black_rope_restraint: 1,
    black_rope_technique_break: 2
  });
  var CONTRACT_TICKET_DEFAULT_MAX = 8;
  var CONTRACT_TICKET_ACTION_COSTS = Object.freeze({
    recontract_santana_sedan: 2,
    recontract_excavator: 3,
    recontract_kitchen_knife: 1,
    recontract_detached_house: 5,
    recontract_five_star_resort_week: 4
  });
  var CONTRACT_TICKET_ACTION_GAINS = Object.freeze({
    recontract_receipt_stock: 3
  });
  var COMEDIAN_DEFAULT_HUMOR_MAX = 6;
  var COMEDIAN_DEFAULT_COLD_MAX = 4;
  var KUSAKABE_DEFAULT_STANCE_MAX = 5;
  var DISASTER_RESOURCE_DEFAULT_MAX = 6;
  var TACTICAL_HUMAN_RESOURCE_DEFAULT_MAX = 5;
  // A completed, uncontested domain must be an immediately visible advantage.
  // 1.20 was technically present but was routinely hidden by ordinary mitigation.
  var UNOPPOSED_DOMAIN_DAMAGE_SCALE = 1.35;
  var performanceCacheStats = {
    actionLastInvalidatedAt: "",
    mechanicLastInvalidatedAt: ""
  };
  var FEATURE_TECHNIQUE_ALIASES = Object.freeze({
    ten_shadows: ["十种影法术", "十种影", "十影", "伏黑惠", "megumi", "嵌合暗翳庭", "魔虚罗", "魔须罗", "mahoraga"],
    limitless: ["无下限术式", "无下限", "五条悟", "五条", "无量空处", "limitless"],
    blood_manipulation: ["赤血操术", "胀相", "加茂宪纪", "虎杖悠仁", "blood"],
    curse_spirit_manipulation: ["咒灵操术", "夏油杰", "夏油", "羂索", "咒灵群"],
    idle_transfiguration: ["无为转变", "真人", "自闭圆顿裹", "灵魂"],
    higuruma_trial_owner: ["诛伏赐死", "日车", "日车宽见", "审判", "裁判", "证据", "罪状", "判决", "没收", "处刑人之剑", "judgeman", "higuruma", "trial"],
    yuji_soul_melee: ["灵魂打击", "虎杖", "虎杖悠仁", "逕庭拳", "径庭拳", "黑闪", "itadori", "yuji", "soul"],
    yuji_after68_black_flash: ["虎天帝", "68年后虎杖", "虎杖悠仁（68年后）", "随意黑闪", "稳定黑闪", "咒物沉淀", "yuji_after68", "after68_yuji"],
    high_level_anti_domain: ["高阶反领域", "领域对策", "反领域能力", "68年后虎杖", "虎天帝", "high_level_anti_domain"],
    jacobs_ladder: ["雅各布天梯", "术式消灭", "術式消滅", "天使术式", "天使術式", "jacobs_ladder", "jacobs ladder", "technique_extinguishment", "technique extinguishment"],
    contract_recreation: ["再契象", "收据", "收據", "票据", "票據", "契约再现", "契約再現", "实物具现", "服务收据", "服務收據", "receipt", "recontract"],
    recontract_icon: ["再契象", "雷吉", "收据", "契约再现", "实物具现", "服务收据", "reggie", "receipt", "recontract", "contract_recreation"],
    gojo_limitless: ["无下限术式", "无下限", "五条悟", "五条", "无量空处", "limitless", "gojo"],
    ratio_technique: ["十划咒法", "七海建人", "七海", "七三"],
    cursed_speech: ["咒言", "狗卷棘", "狗卷"],
    boogie_woogie: ["不义游戏", "东堂葵", "东堂"],
    rct_support: ["反转术式医师", "反转治疗", "战场急救", "稳定治疗", "医师分诊", "healer", "rct_support"],
    panda_core_shift: ["咒骸", "三核心", "熊猫核", "猩猩核", "姐姐核", "panda_core"],
    black_bird_manipulation: ["黑鸟操术", "冥冥"],
    projection_sorcery: ["投射咒法", "禅院直哉", "直哉", "直毘人", "时胞月宫殿"],
    construction: ["构筑术式", "万", "真依", "真球", "三重疾苦"],
    puppet_manipulation: ["傀儡操术", "机械丸", "与幸吉", "究极机械丸", "傀儡"],
    tool_manipulation: ["付丧操术", "西宫桃", "扫帚", "咒具操控", "器物牵引"],
    seance_technique: ["降灵术", "参拜婆", "降灵", "肉体降灵", "依代"],
    straw_doll_technique: ["刍灵咒法", "钉崎野蔷薇", "钉崎", "共鸣"],
    star_rage: ["星之怒", "九十九由基", "九十九", "凰轮"],
    ice_formation: ["冰凝咒法", "里梅"],
    rika_independent_unit: ["祈本里香完全显现", "完全显现里香", "独立里香", "特级过咒怨灵", "完全显现式神", "rika_independent"],
    immortality_tengen: ["不死术式", "天元", "不死与结界维护", "immortality_tengen"],
    miracles: ["奇迹", "重面春太", "命数", "幸运"],
    disaster_flames: ["漏瑚", "盖棺铁围山", "火山", "熔灾"],
    disaster_plants: ["花御", "朶颐光海", "咒植"],
    disaster_tides: ["陀艮", "荡蕴平线", "潮灾"],
    smallpox_deity_countdown: ["疱疮神", "瘟柩三刻", "棺材锁定", "三刻倒计时", "smallpox"],
    gakuganji_music: ["乐岩寺", "咒力音波", "电吉他", "音波"],
    solo_forbidden_area: ["单独禁区", "庵歌姬", "神乐", "祝词", "奉纳"],
    solo_solo_forbidden_area: ["单独禁区", "庵歌姬", "神乐", "祝词", "奉纳"],
    heart_catch: ["心身掌握", "拉鲁", "可爱蜜糖", "巨手", "注意牵引"],
    prayer_song: ["祈祷之歌", "米格尔", "黑绳"],
    cockroach_swarm: ["黑沐死", "蟑螂", "腐蠊胎巢", "烂生刀", "虫群"],
    rot_technique: ["蚀烂术式", "坏相", "血涂", "朽血", "翅王"],
    ganesh_obstacle_removal: ["伽尼萨", "伽内什", "障碍移除", "象神", "移障"],
    ganesha_obstacle_removal: ["伽尼萨", "伽内什", "障碍移除", "象神", "移障"],
    body_hopping: ["夺舍", "羂索", "脑核转移", "身体交换", "brain transplant"],
    idle_death_gamble: ["赌运显法", "秤金次", "秤", "坐杀搏徒", "jackpot"],
    comedian: ["超人术式", "超人", "笑点", "冷场", "包袱", "comedy", "comedian"],
    simple_domain_sword: ["新阴流简易领域", "新阴流", "拔刀", "拔刀防御", "simple_domain_sword", "simple domain sword"],
    kusakabe_guard: ["简易领域", "新阴流", "拔刀", "保护同伴", "守护", "kusakabe_guard"],
    copy: ["模仿", "复制术式", "copy", "copy technique", "乙骨忧太", "乙骨", "里香", "真赝相爱"],
    sky_manipulation: ["天空术式", "乌鹭亨子", "乌鹭"],
    granite_blast: ["龙髓炮", "石流龙", "石流", "咒力大炮", "花岗岩"],
    anti_gravity_system: ["反重力机构", "羂索", "虎杖香织", "重力"],
    mythical_beast_amber: ["幻兽琥珀", "鹿紫云一", "鹿紫云"],
    kashimo_mythical_beast: ["幻兽琥珀", "鹿紫云一", "鹿紫云"],
    shrine: ["御厨子", "伏魔御厨子", "两面宿傩", "宿傩", "虎杖悠仁", "解", "捌", "斩击"],
    embodied_killing_intent_light: ["光", "具象化杀意", "达布拉", "达布拉卡拉巴"],
    chaos_and_harmony: ["混沌与调和", "玛鲁", "马鲁", "克罗斯"],
    modulo_copy_lightweight: ["Modulo复制", "真剑复制"],
    explosive_body: ["黄栌折", "爆炸肉体", "断齿", "眼球投爆", "hazel"],
    hazel: ["黄栌折", "爆炸肉体", "断齿", "眼球投爆", "hazel"],
    inverse: ["强弱颠倒", "inverse", "粟坂二良", "强攻击变弱", "弱攻击"],
    star_travel: ["星间飞行", "南十字", "星序", "love rendezvous", "标记"],
    spatial_transference: ["忧忧", "空间转移", "箱门", "魂位训练", "传送"],
    ui_ui: ["忧忧", "空间转移", "箱门", "魂位训练", "传送"],
    nitta: ["新田新", "痛苦杀手", "创口暂停", "伤势保留"],
    pain_killer: ["新田新", "痛苦杀手", "创口暂停", "伤势保留"],
    hanyu_jet_hair: ["羽生", "喷气背包头发", "喷翼", "飞行"],
    haba_helicopter_hair: ["羽场", "直升机头发", "旋翼", "飞行"],
    jinichi_fist: ["禅院甚一", "甚一", "巨大咒力拳", "铁拳", "咒像"],
    zenin_jinichi: ["禅院甚一", "甚一", "巨大咒力拳", "铁拳", "咒像"],
    ranta_eye_bind: ["禅院兰太", "兰太", "视线拘束", "睨视", "瞳压"],
    zenin_ranta: ["禅院兰太", "兰太", "视线拘束", "睨视", "瞳压"],
    chojuro_earth_hand: ["禅院长寿郎", "长寿郎", "土掌术式", "岩掌", "地裂"],
    zenin_chojuro_earth_hand: ["禅院长寿郎", "长寿郎", "土掌术式", "岩掌", "地裂"],
    auspicious_beasts: ["来访瑞兽", "猪野琢真", "猪野", "獬豸", "灵龟", "麒麟"],
    remi_hair: ["丽美", "蝎尾头发", "尾刺", "头发扎人"],
    remi_scorpion_hair: ["丽美", "蝎尾头发", "尾刺", "头发扎人"],
    photo_manipulation: ["照片操控", "枷场菜菜子", "菜菜子", "影像", "底片"],
    mimiko_doll: ["美美子", "玩偶术式", "枷场美美子", "玩偶", "缢线"],
    dhruv_shikigami: ["杜鲁布", "式神轨迹领域", "轨迹领土", "巡行"],
    moon_dregs: ["淀月", "吉野顺平", "顺平"],
    clone_technique: ["分身", "神秘纸袋男", "五影散身", "伪身"],
    manga_artist: ["漫画家", "查理", "贝尔纳"]
  });
  var FEATURE_TECHNIQUE_ARCHETYPE_REQUIREMENTS = Object.freeze({
    limitless: ["gojo_limitless"],
    gojo_limitless: ["gojo_limitless"],
    shrine: ["shrine"],
    ten_shadows: ["ten_shadows"],
    higuruma_trial_owner: ["higuruma_trial_owner"],
    yuji_soul_melee: ["yuji_soul_melee"],
    recontract_icon: ["recontract_icon"],
    idle_death_gamble: ["hakari_jackpot_owner"],
    copy: ["okkotsu_rika_copy"],
    idle_transfiguration: ["mahito_soul_transfiguration"]
  });
  var RCT_CHARACTER_IDS = new Set([
    "gojo_satoru_shinjuku",
    "sukuna_heian_or_shinjuku",
    "yuta_okkotsu_volume0_true_rika",
    "yuta_okkotsu_shinjuku",
    "shoko_ieiri_support_candidate",
    "kenjaku_geto_body",
    "yuki_tsukumo_culling",
    "yuji_itadori_shinjuku",
    "yuji_itadori_after68",
    "higuruma_hiromi_culling",
    "hazel"
  ]);
  var RCT_OUTPUT_CHARACTER_IDS = new Set([
    "sukuna_heian_or_shinjuku",
    "yuta_okkotsu_volume0_true_rika",
    "yuta_okkotsu_shinjuku",
    "rika_orimoto_volume0_full",
    "rika_orimoto_modern_full",
    "shoko_ieiri_support_candidate"
  ]);
  var KASHIMO_MYTHICAL_BEAST_RELEASE_ACTION_ID = "kashimo_mythical_beast_release";
  var KASHIMO_MYTHICAL_BEAST_NORMAL_ACTION_IDS = new Set([
    "kashimo_charge_cursed_energy",
    "kashimo_thunder_charge_build"
  ]);
  var KASHIMO_MYTHICAL_BEAST_RELEASED_ACTION_IDS = new Set([
    "kashimo_emp_released",
    "kashimo_lightning_body_overload",
    "kashimo_electromagnetic_annihilation"
  ]);

  function getDuelCounterPipeline() {
    var pipeline = global.JJKDuelCounterPipeline;
    if (!pipeline || typeof pipeline.createCounterView !== "function") {
      throw new Error("JJKDuelCounterPipeline must load before duel-actions");
    }
    return pipeline;
  }

  function createDuelCounterView(battle, side, namespaceName, definitions) {
    return getDuelCounterPipeline().createCounterView(battle, side, namespaceName, definitions);
  }

  function readDuelCounter(battle, side, namespaceName, counterId, options) {
    return getDuelCounterPipeline().readCounter(battle, side, namespaceName, counterId, options || {});
  }

  function setDuelCounter(battle, side, namespaceName, counterId, value, options) {
    return getDuelCounterPipeline().setCounter(battle, side, namespaceName, counterId, value, options || {});
  }

  function adjustDuelCounter(battle, side, namespaceName, counterId, delta, options) {
    return getDuelCounterPipeline().adjustCounter(battle, side, namespaceName, counterId, delta, options || {});
  }

  function consumeDuelCounter(battle, side, namespaceName, counterId, amount, options) {
    return getDuelCounterPipeline().consumeCounter(battle, side, namespaceName, counterId, amount, options || {});
  }

  function removeDuelCounter(battle, side, namespaceName, counterId) {
    return getDuelCounterPipeline().removeCounter(battle, side, namespaceName, counterId);
  }

  function resetDuelCounterNamespace(battle, side, namespaceName) {
    return getDuelCounterPipeline().resetCounterNamespace(battle, side, namespaceName);
  }

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isExpected(name) {
    return expectedExports.indexOf(name) !== -1;
  }

  function isExpectedDependency(name) {
    return expectedDependencyNames.indexOf(name) !== -1;
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

  function register(map) {
    if (!map || typeof map !== "object") return api;
    expectedExports.forEach(function bindExport(name) {
      if (hasOwn(map, name) && map[name] != null) {
        bind(name, map[name]);
      }
    });
    return api;
  }

  function bindDependency(name, value) {
    assertExpectedDependency(name);
    if (name === "state") {
      dependencies[name] = value;
      return api;
    }
    if (name === "DUEL_DOMAIN_RESPONSE_ACTION_IDS") {
      dependencies[name] = normalizeActionIdSet(value);
      return api;
    }
    assertFunction(name, value);
    dependencies[name] = value;
    return api;
  }

  function configure(map) {
    if (!map || typeof map !== "object") return api;
    Object.keys(map).forEach(function bindEntry(name) {
      if (isExpectedDependency(name) && map[name] != null) {
        bindDependency(name, map[name]);
      }
    });
    return api;
  }

  function registerDependencies(map) {
    return configure(map);
  }

  function hasBinding(name) {
    if (typeof name === "undefined") {
      return expectedExports.every(function hasExport(exportName) {
        return typeof get(exportName) === "function";
      });
    }
    return isExpected(name) && typeof get(name) === "function";
  }

  function get(name) {
    assertExpected(name);
    return bindings[name] || implementations[name];
  }

  function getBinding(name) {
    assertExpected(name);
    return bindings[name] || null;
  }

  function listBindings() {
    return expectedExports.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = typeof get(name) === "function";
      return snapshot;
    }, {});
  }

  function clearBindings() {
    expectedExports.forEach(function clearName(name) {
      delete bindings[name];
    });
    return api;
  }

  function hasDependency(name) {
    return isExpectedDependency(name) && Boolean(getOptionalDependency(name));
  }

  function listDependencies() {
    return expectedDependencyNames.reduce(function buildSnapshot(snapshot, name) {
      snapshot[name] = Boolean(getOptionalDependency(name));
      return snapshot;
    }, {});
  }

  function clearDependencies() {
    expectedDependencyNames.forEach(function clearName(name) {
      delete dependencies[name];
    });
    return api;
  }

  function getNamespaceBinding(namespaceName, exportName) {
    var target = global[namespaceName];
    if (!target) return null;
    if (typeof target.getBinding === "function") {
      var binding = target.getBinding(exportName);
      if (binding != null) return binding;
    }
    if (typeof target.get === "function") {
      try {
        var value = target.get(exportName);
        if (value != null) return value;
      } catch (error) {
        return null;
      }
    }
    if (hasOwn(target, exportName) && target[exportName] != null) return target[exportName];
    return null;
  }

  function getOptionalDependency(name) {
    if (hasOwn(dependencies, name)) return dependencies[name];
    var source = dependencySources[name];
    if (!source) return null;
    return getNamespaceBinding(source[0], source[1]);
  }

  function requireDependency(name) {
    var dependency = getOptionalDependency(name);
    if (dependency == null) {
      throw new Error(namespace + ": missing dependency '" + name + "'");
    }
    return dependency;
  }

  function callDependency(name, args) {
    return requireDependency(name).apply(null, args || []);
  }

  function getDefaultBattle() {
    var getter = getOptionalDependency("getDuelBattle");
    if (typeof getter === "function") return getter();
    var appState = getOptionalDependency("state");
    return appState?.duelBattle || null;
  }

  function getBattle(duelState) {
    return duelState || getDefaultBattle();
  }

  function normalizeDuelDomainState(actor) {
    var source = actor && typeof actor === "object" ? actor : null;
    if (!source) return { ok: false, code: "DOMAIN_STATE_MISSING", state: null };
    var raw = source.domainState || source.domain || {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, code: "DOMAIN_STATE_INVALID", state: null };
    }
    var hasLegacyLoad = Object.prototype.hasOwnProperty.call(source, "domainLoad");
    var hasLegacyThreshold = Object.prototype.hasOwnProperty.call(source, "domainThreshold");
    var hasLegacyPressure = Object.prototype.hasOwnProperty.call(source, "domainPressure");
    var load = raw.load ?? (hasLegacyLoad ? source.domainLoad : 0);
    var threshold = raw.threshold ?? (hasLegacyThreshold ? source.domainThreshold : 0);
    var pressure = raw.pressure ?? (hasLegacyPressure ? source.domainPressure : 0);
    var numeric = [load, threshold, pressure].map(Number);
    if (numeric.some(function invalid(value) { return !Number.isFinite(value) || value < 0; })) {
      return { ok: false, code: "DOMAIN_STATE_INVALID", state: null };
    }
    if (numeric[1] > 0 && numeric[0] > numeric[1]) {
      return { ok: false, code: "DOMAIN_STATE_INVALID", state: null };
    }
    var state = {
      active: raw.active === true,
      load: numeric[0],
      threshold: numeric[1],
      pressure: numeric[2],
      domainId: String(raw.domainId || raw.id || source.domainId || ""),
      status: String(raw.status || (raw.active === true ? "active" : "inactive"))
    };
    source.domainState = state;
    source.domain = state;
    source.domainLoad = state.load;
    return { ok: true, state: state };
  }

  function getDuelActionRules() {
    return callDependency("getDuelActionRules", []);
  }

  function getDuelActionTemplates() {
    return getDuelActionRules().templates || [];
  }

  function getDuelDomainControlActionTemplates() {
    return [
      {
        id: "domain_expand",
        label: "领域展开",
        status: "CONFIRMED",
        description: "展开领域进入高压结界。",
        cardType: "domain",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "领域展开", "domain_activation", "展开"],
        cost: { ceRatio: 0.18, minCe: 34 },
        requirements: { requiresDomainAccess: true, domainActive: false, blocksOnTechniqueImbalance: true },
        effects: { activateDomain: true, domainLoadDelta: 18, weightDeltas: { domain: 2.4, technique: 0.7 }, outgoingScale: 1.12, stabilityDelta: -0.018 },
        ignoreHandSelectionLimit: true,
        damage: 12,
        domainLoadDelta: 18,
        domainPressure: 24,
        ceCost: 34,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "high",
        weight: 8.4,
        logTemplate: "你展开领域，结界压制启动，领域负荷同步上升。"
      },
      {
        id: "domain_compress",
        label: "压缩领域",
        status: "CONFIRMED",
        description: "主动收束领域边界。",
        cardType: "domain_maintenance",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_maintenance", "收束", "稳定"],
        cost: { ceRatio: 0.045, minCe: 10 },
        requirements: { domainActive: true },
        effects: { domainLoadDelta: -10, domainLoadScale: 0.45, outgoingScale: 0.88, stabilityDelta: 0.03, weightDeltas: { domain: -0.5, sustain: 1 } },
        stabilityRestore: 30,
        domainLoadDelta: -10,
        domainPressure: 16,
        defensePressure: 5,
        ceCost: 10,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "low",
        weight: 7.2,
        logTemplate: "你主动收束领域边界，换取负荷回落。"
      },
      {
        id: "domain_force_sustain",
        label: "强行维持领域",
        status: "CONFIRMED",
        description: "不顾负荷继续扩大领域压制。",
        cardType: "domain_maintenance",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_maintenance", "维持", "领域崩解风险"],
        cost: { ceRatio: 0.13, minCe: 24 },
        requirements: { domainActive: true },
        effects: { domainLoadDelta: 16, domainLoadScale: 1.45, outgoingScale: 1.2, stabilityDelta: -0.038, weightDeltas: { domain: 1.8, finisher: 0.6 } },
        damage: 20,
        domainLoadDelta: 16,
        domainPressure: 16,
        ceCost: 24,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "critical",
        weight: 0.55,
        logTemplate: "你强行维持领域压制，领域收益提高，但负荷逼近熔断线。"
      },
      {
        id: "domain_release",
        label: "主动解除领域",
        status: "CONFIRMED",
        description: "主动撤去领域避免熔断。",
        cardType: "domain_maintenance",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_maintenance", "解除", "回稳"],
        cost: { ceRatio: 0, minCe: 0 },
        requirements: { domainActive: true },
        effects: { releaseDomain: true, stabilityDelta: 0.035, domainLoadDelta: -8, weightDeltas: { sustain: 0.75, domain: -1.4 } },
        stabilityRestore: 35,
        domainLoadDelta: -8,
        domainPressure: 16,
        defensePressure: 4,
        ceCost: 0,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "low",
        weight: 7.2,
        logTemplate: "你主动解除领域，避免领域熔断。"
      },
      {
        id: "domain_clash",
        label: "领域对抗",
        status: "CONFIRMED",
        description: "以真正领域展开或高阶领域干涉正面对撞对方领域。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "domain_access", "领域", "domain_response", "领域对抗", "domain_activation", "领域应对"],
        cost: { ceRatio: 0.14, minCe: 28 },
        requirements: { opponentDomainActive: true, requiresDomainClash: true },
        effects: { weightDeltas: { counter: 1.1, domain: 1.05 }, opponentWeightDeltas: { domain: -1.35, technique: -0.35 }, opponentDomainLoadDelta: 16, domainLoadDelta: 8, sureHitScale: 0.46, domainPressureScale: 0.72, manualAttackScale: 0.92, stabilityDelta: -0.024, lowStabilityHpRecoil: 5 },
        shield: 54,
        domainLoadDelta: 8,
        domainPressure: 16,
        defensePressure: 6,
        ceCost: 28,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "high",
        weight: 6.8,
        logTemplate: "你以领域或高阶结界干涉正面对抗对方领域，推高对方领域负荷，但自身也承受领域负担。"
      },
      {
        id: "simple_domain_guard",
        label: "简易领域防御",
        status: "CONFIRMED",
        description: "以简易领域削弱必中，拖住对方领域压制。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "simple_domain", "简易领域", "领域应对", "必中削弱", "防御"],
        cost: { ceRatio: 0.065, minCe: 12 },
        requirements: { opponentDomainActive: true, requiresSimpleDomain: true },
        effects: { sureHitScale: 0.35, domainPressureScale: 0.72, manualAttackScale: 0.95, incomingHpScale: 0.82, incomingCeScale: 0.9, opponentWeightDeltas: { domain: -0.35 }, opponentDomainLoadDelta: 2, stabilityDelta: -0.006, selfStatus: { id: "simpleDomainWearing", label: "简易领域磨损", rounds: 1, value: 1 } },
        block: 18,
        shield: 65,
        domainPressure: 2,
        ceCost: 12,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "medium",
        weight: 6.2,
        logTemplate: "你展开简易领域削弱必中，结界边界被对方领域持续压缩并开始磨损。"
      },
      {
        id: "hollow_wicker_basket_guard",
        label: "弥虚葛笼",
        status: "CONFIRMED",
        description: "以弥虚葛笼抵消必中，但行动和输出受到明显限制。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "hollow_wicker_basket", "弥虚葛笼", "领域应对", "必中抵消", "架势限制"],
        cost: { ceRatio: 0.055, minCe: 10 },
        requirements: { opponentDomainActive: true, requiresHollowWickerBasket: true },
        effects: { sureHitScale: 0.28, domainPressureScale: 0.78, manualAttackScale: 1, incomingHpScale: 0.86, outgoingScale: 0.68, weightDeltas: { technique: -0.7, finisher: -0.8, melee: -0.35 }, opponentDomainLoadDelta: 1, selfStatus: { id: "hollowWickerBasketPosture", label: "弥虚葛笼架势受限", rounds: 1, value: 1 } },
        block: 14,
        shield: 72,
        domainPressure: 1,
        ceCost: 10,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "medium",
        weight: 6.1,
        logTemplate: "你维持弥虚葛笼抵消必中，架势被迫固定，输出和机动同步受限。"
      },
      {
        id: "falling_blossom_emotion",
        label: "落花之情",
        status: "CONFIRMED",
        description: "以自动迎击削弱必中，是预留的反必中防线而非领域对撞。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "falling_blossom_emotion", "落花之情", "领域应对", "自动迎击"],
        cost: { ceRatio: 0.05, minCe: 10 },
        requirements: { opponentDomainActive: true, requiresFallingBlossomEmotion: true },
        effects: { sureHitScale: 0.48, domainPressureScale: 0.82, manualAttackScale: 0.95, incomingHpScale: 0.88, weightDeltas: { counter: 0.4 }, stabilityDelta: -0.004 },
        block: 12,
        shield: 48,
        domainPressure: 1,
        ceCost: 10,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "medium",
        weight: 5.8,
        logTemplate: "你以落花之情自动迎击必中，削弱命中伤害，但这不是领域对撞。"
      },
      {
        id: "zero_ce_domain_bypass",
        label: "零咒力必中规避",
        status: "CANDIDATE",
        description: "零咒力个体不被领域必中正常捕捉，但仍会承受领域压制和手动攻击。",
        cardType: "domain_response",
        domainHand: true,
        tags: ["领域操控", "zero_ce", "零咒力", "领域应对", "必中规避", "天与咒缚"],
        cost: { ceRatio: 0, minCe: 0 },
        requirements: { opponentDomainActive: true, requiresZeroCeBypass: true },
        effects: { sureHitScale: 0.08, domainPressureScale: 0.82, manualAttackScale: 1, incomingHpScale: 0.88, outgoingScale: 1.02, weightDeltas: { melee: 0.9, initiative: 0.55, counter: 0.35 } },
        block: 10,
        shield: 58,
        domainPressure: 1,
        ceCost: 0,
        durationRounds: 1,
        damageType: "domain",
        scalingProfile: "domain_pressure",
        risk: "low",
        weight: 5.9,
        logTemplate: "零咒力个体不被领域必中正常捕捉，转而寻找近身突入、破坏结界锚点或脱出的机会。"
      }
    ];
  }

  function mergeDuelDomainControlActionTemplates(templates) {
    var merged = Array.isArray(templates) ? templates.slice() : [];
    var existingIds = new Set(merged.map(function collectId(template) {
      return String(template?.id || template?.actionId || "").trim();
    }).filter(Boolean));
    getDuelDomainControlActionTemplates().forEach(function addFallbackDomainControl(template) {
      var id = String(template?.id || "").trim();
      if (!id || existingIds.has(id)) return;
      merged.push(template);
      existingIds.add(id);
    });
    return merged;
  }

  function getDuelMechanicTemplateRules() {
    var getter = getOptionalDependency("getDuelMechanicTemplateRules");
    if (typeof getter === "function" && getter !== getDuelMechanicTemplateRules) return getter();
    var appState = getOptionalDependency("state");
    return appState?.duelMechanicRules || {
      schema: "jjk-battle-runtime-mechanic-templates",
      version: "0.1.0-candidate",
      status: "CANDIDATE",
      mechanics: []
    };
  }

  function getDuelMechanicTemplates() {
    var rules = getDuelMechanicTemplateRules();
    return Array.isArray(rules?.mechanics) ? rules.mechanics : [];
  }

  function addIndexedItem(index, key, value) {
    if (!key) return;
    index[key] ||= [];
    index[key].push(value);
  }

  function readActionContexts(action) {
    var contexts = []
      .concat(action?.contexts || [])
      .concat(action?.availability?.contexts || []);
    if (action?.requirements?.domainActive === true) contexts.push("domain_active");
    if (action?.requirements?.opponentDomainActive) contexts.push("opponent_domain");
    if (!contexts.length) contexts.push("normal");
    return Array.from(new Set(contexts.filter(Boolean)));
  }

  function buildDuelActionTemplateIndexes(rules) {
    var activeRules = rules || getDuelActionRules();
    var templates = Array.isArray(activeRules?.templates) ? activeRules.templates : [];
    var index = {
      schema: "jjk-battle-runtime-action-template-index",
      version: activeRules?.version || "",
      templateCount: templates.length,
      templates: templates,
      actionById: Object.create(null),
      actionsByTag: Object.create(null),
      actionsByContext: Object.create(null)
    };
    templates.forEach(function indexAction(action) {
      if (!action?.id) return;
      index.actionById[action.id] = action;
      (action.tags || []).forEach(function indexTag(tag) {
        addIndexedItem(index.actionsByTag, tag, action);
      });
      readActionContexts(action).forEach(function indexContext(context) {
        addIndexedItem(index.actionsByContext, context, action);
      });
    });
    return index;
  }

  function getActionRulesStamp(rules) {
    var activeRules = rules || getDuelActionRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.templates) ? activeRules.templates.length : 0
    ].join("|");
  }

  function getDuelActionTemplateIndex() {
    var rules = getDuelActionRules();
    var stamp = getActionRulesStamp(rules);
    if (!actionTemplateIndexCache || actionTemplateIndexCache.stamp !== stamp) {
      actionTemplateIndexCache = buildDuelActionTemplateIndexes(rules);
      actionTemplateIndexCache.stamp = stamp;
    }
    return actionTemplateIndexCache;
  }

  function warmDuelActionTemplateCache() {
    return getDuelActionTemplateIndex();
  }

  function invalidateDuelActionTemplateCache() {
    actionTemplateIndexCache = null;
    performanceCacheStats.actionLastInvalidatedAt = new Date().toISOString();
  }

  function collectStatusEffectIds(effectPatch) {
    var statuses = []
      .concat(effectPatch?.selfStatus ? [effectPatch.selfStatus] : [])
      .concat(effectPatch?.opponentStatus ? [effectPatch.opponentStatus] : [])
      .concat(effectPatch?.selfStatuses || [])
      .concat(effectPatch?.opponentStatuses || []);
    return statuses.map(function mapStatus(status) { return status?.id || ""; }).filter(Boolean);
  }

  function buildDuelMechanicTemplateIndexes(rules) {
    var activeRules = rules || getDuelMechanicTemplateRules();
    var mechanics = Array.isArray(activeRules?.mechanics) ? activeRules.mechanics : [];
    var index = {
      schema: "jjk-battle-runtime-mechanic-template-index",
      version: activeRules?.version || "",
      mechanicCount: mechanics.length,
      mechanics: mechanics,
      mechanicById: Object.create(null),
      mechanicsByTrigger: Object.create(null),
      mechanicsByActionId: Object.create(null),
      mechanicsByStatusEffect: Object.create(null)
    };
    mechanics.forEach(function indexMechanic(mechanic) {
      if (!mechanic?.id) return;
      index.mechanicById[mechanic.id] = mechanic;
      addIndexedItem(index.mechanicsByTrigger, mechanic.trigger, mechanic);
      (mechanic.actionIds || []).forEach(function indexActionId(actionId) {
        addIndexedItem(index.mechanicsByActionId, actionId, mechanic);
      });
      collectStatusEffectIds(mechanic.effectPatch || {}).forEach(function indexStatus(statusId) {
        addIndexedItem(index.mechanicsByStatusEffect, statusId, mechanic);
      });
    });
    return index;
  }

  function getMechanicRulesStamp(rules) {
    var activeRules = rules || getDuelMechanicTemplateRules();
    return [
      activeRules?.version || "",
      Array.isArray(activeRules?.mechanics) ? activeRules.mechanics.length : 0
    ].join("|");
  }

  function getDuelMechanicTemplateIndex() {
    var rules = getDuelMechanicTemplateRules();
    var stamp = getMechanicRulesStamp(rules);
    if (!mechanicTemplateIndexCache || mechanicTemplateIndexCache.stamp !== stamp) {
      mechanicTemplateIndexCache = buildDuelMechanicTemplateIndexes(rules);
      mechanicTemplateIndexCache.stamp = stamp;
    }
    return mechanicTemplateIndexCache;
  }

  function warmDuelMechanicTemplateCache() {
    return getDuelMechanicTemplateIndex();
  }

  function invalidateDuelMechanicTemplateCache() {
    mechanicTemplateIndexCache = null;
    performanceCacheStats.mechanicLastInvalidatedAt = new Date().toISOString();
  }

  function getDuelMechanicTemplateById(mechanicId) {
    return getDuelMechanicTemplateIndex().mechanicById[mechanicId] || null;
  }

  function normalizeDuelMechanicIds(action) {
    var normalized = [];
    var seen = new Set();
    function append(value) {
      [].concat(value || []).forEach(function appendMechanicId(entry) {
        var id = String(entry || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        normalized.push(id);
      });
    }
    append(action?.mechanicIds);
    append(action?.mechanicId);
    append(action?.effect?.special?.mechanicIds);
    append(action?.effect?.special?.mechanicId);
    return normalized;
  }

  function getDuelMechanicActionAliases(action) {
    var aliases = [];
    var seen = new Set();
    function append(value) {
      var id = String(value || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      aliases.push(id);
      if (id.indexOf("card_") === 0) append(id.slice(5));
    }
    append(action?.id);
    append(action?.actionId);
    append(action?.cardId);
    append(action?.sourceCardId);
    return aliases;
  }

  function collectDuelMechanicsForAction(action) {
    if (!action) return [];
    var index = getDuelMechanicTemplateIndex();
    var collected = [];
    var seen = new Set();
    function pushMechanic(mechanic) {
      if (!mechanic?.id || seen.has(mechanic.id)) return;
      seen.add(mechanic.id);
      collected.push(mechanic);
    }
    normalizeDuelMechanicIds(action).forEach(function addExplicit(id) {
      pushMechanic(index.mechanicById[id]);
    });
    getDuelMechanicActionAliases(action).forEach(function addActionAlias(id) {
      (index.mechanicsByActionId[id] || []).forEach(pushMechanic);
    });
    return collected;
  }

  function addEffectMap(target, source) {
    Object.entries(source || {}).forEach(function addEntry(entry) {
      var key = entry[0];
      var value = entry[1];
      target[key] = Number((Number(target[key] || 0) + Number(value || 0)).toFixed(3));
    });
  }

  function pushStatusEffects(target, value) {
    if (!value) return;
    [].concat(value || []).forEach(function pushStatus(status) {
      if (status?.id) target.push({ ...status });
    });
  }

  function mergeDuelMechanicEffects(baseEffects, mechanics) {
    var effects = { ...(baseEffects || {}) };
    var scaleKeys = [
      "outgoingScale",
      "incomingHpScale",
      "incomingCeScale",
      "sureHitScale",
      "domainPressureScale",
      "manualAttackScale",
      "domainLoadScale",
      "damageScale"
    ];
    var additiveKeys = [
      "stabilityDelta",
      "domainLoadDelta",
      "opponentDomainLoadDelta",
      "opponentStabilityDelta",
      "opponentRegenInterference",
      "lowStabilityHpRecoil",
      "selfHpCostFlat",
      "selfHpCostRatio",
      "evasionBonus"
    ];
    effects.weightDeltas = { ...(effects.weightDeltas || {}) };
    effects.opponentWeightDeltas = { ...(effects.opponentWeightDeltas || {}) };
    effects.selfStatuses = [].concat(effects.selfStatus ? [effects.selfStatus] : [], effects.selfStatuses || []);
    effects.opponentStatuses = [].concat(effects.opponentStatus ? [effects.opponentStatus] : [], effects.opponentStatuses || []);
    mechanics.forEach(function mergeMechanic(mechanic) {
      var patch = mechanic?.effectPatch || {};
      scaleKeys.forEach(function mergeScale(key) {
        if (patch[key] !== undefined) effects[key] = Number((Number(effects[key] || 1) * Number(patch[key] || 1)).toFixed(4));
      });
      additiveKeys.forEach(function mergeAdditive(key) {
        if (patch[key] !== undefined) effects[key] = Number((Number(effects[key] || 0) + Number(patch[key] || 0)).toFixed(4));
      });
      if (patch.activateDomain) effects.activateDomain = true;
      if (patch.releaseDomain) effects.releaseDomain = true;
      addEffectMap(effects.weightDeltas, patch.weightDeltas);
      addEffectMap(effects.opponentWeightDeltas, patch.opponentWeightDeltas);
      pushStatusEffects(effects.selfStatuses, patch.selfStatus);
      pushStatusEffects(effects.selfStatuses, patch.selfStatuses);
      pushStatusEffects(effects.opponentStatuses, patch.opponentStatus);
      pushStatusEffects(effects.opponentStatuses, patch.opponentStatuses);
    });
    return effects;
  }

  function getCustomAtomicState(battle) {
    if (!battle) return null;
    battle.customAtomicState ||= {
      schema: "jjk.duel.custom-atomic-state.v1",
      counters: { left: {}, right: {}, neutral: {} },
      counterModifiers: { left: {}, right: {}, neutral: {} },
      timers: [],
      turnEndEffects: [],
      triggerEffects: { "turn-start": [], "before-receive-damage": [], "after-receive-damage": [], "summon-defeated": [], "shield-broken": [] },
      delegations: {},
      temporaryTechniqueTags: { left: {}, right: {}, neutral: {} },
      events: []
    };
    battle.customAtomicState.counters ||= { left: {}, right: {}, neutral: {} };
    battle.customAtomicState.counterModifiers ||= { left: {}, right: {}, neutral: {} };
    battle.customAtomicState.timers ||= [];
    battle.customAtomicState.turnEndEffects ||= [];
    battle.customAtomicState.triggerEffects ||= {};
    ["turn-start", "before-receive-damage", "after-receive-damage", "summon-defeated", "shield-broken"].forEach(function ensureTriggerBucket(trigger) {
      battle.customAtomicState.triggerEffects[trigger] ||= [];
    });
    battle.customAtomicState.delegations ||= {};
    battle.customAtomicState.temporaryTechniqueTags ||= { left: {}, right: {}, neutral: {} };
    ["left", "right", "neutral"].forEach(function ensureTemporaryTechniqueSide(side) {
      battle.customAtomicState.temporaryTechniqueTags[side] ||= {};
    });
    battle.customAtomicState.events ||= [];
    return battle.customAtomicState;
  }

  var FORMAL_COPY_TECHNIQUE_TAG_EXCLUSIONS = new Set([
    "copy", "copy_candidate", "rika", "rika_ring", "rika_independent_unit",
    "yuta_rika_manifestation_volume0", "yuta_rika_manifestation_modern",
    "public_baseline", "domain_access", "trial_defender_common", "reverse_output",
    "zero_ce", "heavenly_restriction", "cursed_tool", "cursed_tool_user",
    "physical", "domain", "summon", "resource", "common", "none"
  ]);

  function isFormalCopyTechniqueTag(tag) {
    var value = String(tag || "").trim().toLowerCase();
    if (!value || FORMAL_COPY_TECHNIQUE_TAG_EXCLUSIONS.has(value)) return false;
    return !(/^(?:card_|feature_|yuta_|rika_|okkotsu_|modulo_|ranked_|public_|domain_|trial_|reverse_|zero_|cursed_tool)/.test(value));
  }

  function getFormalCopyTechniqueTagPool() {
    var appState = getOptionalDependency("state") || {};
    var characterSource = appState.battleCharacters || appState.duelCharacterV2 || [];
    var characters = Array.isArray(characterSource?.characters) ? characterSource.characters : (Array.isArray(characterSource) ? characterSource : []);
    var declaredCharacterTags = new Set(characters.flatMap(function collectDeclaredCharacterTechniqueTags(character) {
      return []
        .concat(toFeatureList(character?.cardTags))
        .concat(toFeatureList(character?.specialHandTags))
        .concat(toFeatureList(character?.explicitSpecialHandTags))
        .concat(toFeatureList(character?.techniqueFamilies));
    }).map(function normalizeDeclaredTechniqueTag(tag) { return String(tag || "").toLowerCase(); }));
    return uniqueFeatureList(getRawDuelSpecialCards().flatMap(function collectFormalTechniqueTags(card) {
      if (!isDirectBattleCard(card) || card.playableInHandBeta === false) return [];
      var contexts = toFeatureList(card.contexts).map(function normalizeContext(value) { return String(value || "").toLowerCase(); });
      if (!contexts.includes("normal")) return [];
      return getDuelBattleCardOwnershipTags(card);
    }).filter(function keepOwnedFormalTechniqueTag(tag) {
      return isFormalCopyTechniqueTag(tag) && declaredCharacterTags.has(String(tag || "").toLowerCase());
    })).sort();
  }

  function getTemporaryTechniqueSlot(battle, side, slotId) {
    return getCustomAtomicState(battle)?.temporaryTechniqueTags?.[side || "left"]?.[String(slotId || "")] || null;
  }

  function isTemporaryTechniqueSlotActive(entry, battle) {
    if (!entry?.tag) return false;
    var round = getDuelActionTurnNumber(battle);
    return (!Number(entry.activationRound || 0) || round >= Number(entry.activationRound)) &&
      (!Number(entry.expiresRound || 0) || round <= Number(entry.expiresRound));
  }

  function getActiveTemporaryTechniqueGrants(actor, battle) {
    if (!actor?.side || !battle) return [];
    cleanupExpiredTemporaryTechniqueTags(actor, battle);
    var slots = getCustomAtomicState(battle)?.temporaryTechniqueTags?.[actor.side] || {};
    return Object.entries(slots).map(function mapTemporaryTechniqueGrant(entry) {
      var slotId = String(entry[0] || "");
      var grant = entry[1] || {};
      return {
        slotId: slotId,
        tag: String(grant.tag || ""),
        activationRound: Number(grant.activationRound || 0),
        expiresRound: Number(grant.expiresRound || 0)
      };
    }).filter(function keepActiveTemporaryTechniqueGrant(grant) {
      return Boolean(grant.slotId && grant.tag && isTemporaryTechniqueSlotActive(grant, battle));
    });
  }

  function invalidateTemporaryTechniqueDerivedState(battle, side) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return;
    if (activeBattle.actionPoolCache?.[side || "left"]) delete activeBattle.actionPoolCache[side || "left"];
    global.JJKDuelHand?.invalidateDuelHandCandidateCache?.(activeBattle);
    invalidateDuelActionChoices(activeBattle);
  }

  function removeTemporaryTechniqueSlot(battle, side, slotId, actor) {
    var state = getCustomAtomicState(battle);
    var slots = state?.temporaryTechniqueTags?.[side || "left"];
    var entry = slots?.[String(slotId || "")];
    if (!entry) return null;
    delete slots[String(slotId || "")];
    if (actor) {
      actor.statusEffects = (actor.statusEffects || []).filter(function keepNonTemporaryTechniqueStatus(status) {
        return status?.id !== "customAtomicTechniqueTag:" + String(slotId || "");
      });
    }
    var hand = battle?.handState?.[side || "left"];
    if (hand?.cards) hand.cards = hand.cards.filter(function removeTemporaryTechniqueCard(card) {
      return String(card?.temporaryTechniqueSlot || "") !== String(slotId || "");
    });
    if (Array.isArray(battle?.selectedHandActions?.[side || "left"])) {
      battle.selectedHandActions[side || "left"] = battle.selectedHandActions[side || "left"].filter(function removeSelectedTemporaryTechniqueCard(entry) {
        return String((entry?.action || entry)?.temporaryTechniqueSlot || "") !== String(slotId || "");
      });
    }
    invalidateTemporaryTechniqueDerivedState(battle, side);
    return entry;
  }

  function cleanupExpiredTemporaryTechniqueTags(actor, battle) {
    if (!actor?.side || !battle) return [];
    var slots = getCustomAtomicState(battle)?.temporaryTechniqueTags?.[actor.side] || {};
    return Object.keys(slots).filter(function findExpiredSlot(slotId) {
      var entry = slots[slotId];
      return entry && Number(entry.expiresRound || 0) > 0 && getDuelActionTurnNumber(battle) > Number(entry.expiresRound);
    }).map(function removeExpiredSlot(slotId) {
      return removeTemporaryTechniqueSlot(battle, actor.side, slotId, actor);
    }).filter(Boolean);
  }

  function selectTemporaryTechniqueTag(effect, actor, opponent, battle) {
    var params = effect?.params || {};
    var source = String(params.source || "");
    var slot = getTemporaryTechniqueSlot(battle, actor?.side || "left", params.slotId);
    var pool = source === "opponent"
      ? uniqueFeatureList(toFeatureList(getActorFeatureSnapshot(opponent, battle)?.baseExplicitSpecialHandTags).filter(isFormalCopyTechniqueTag)).sort()
      : getFormalCopyTechniqueTagPool();
    if (params.excludeCurrentWhenPossible !== false && slot?.tag && pool.length > 1) {
      pool = pool.filter(function excludeCurrent(tag) { return tag !== slot.tag; });
    }
    if (!pool.length) return { tag: "", pool: [] };
    var seed = [battle?.seed, battle?.onlineBattleSeed, battle?.battleId, actor?.side, effect?.id, getDuelActionTurnNumber(battle), pool.join(",")].filter(Boolean).join("|");
    return { tag: pool[hashCopySelectionSeed(seed) % pool.length] || pool[0], pool: pool };
  }

  function getCustomAtomicEffects(action) {
    // Merge every authored source.  An empty normalized `effectTools` array
    // must not mask atoms still stored under effect.special/canonicalCard.
    var effects = [].concat(
      Array.isArray(action?.effectTools) ? action.effectTools : [],
      Array.isArray(action?.canonicalCard?.effects) ? action.canonicalCard.effects : [],
      Array.isArray(action?.effect?.special?.atomicEffects) ? action.effect.special.atomicEffects : [],
      Array.isArray(action?.special?.atomicEffects) ? action.special.atomicEffects : []
    );
    var filtered = dedupeAtomicEffectsStable(effects.filter(function keepAtomicEffect(effect) {
      return effect && typeof effect === "object" && effect.tool;
    })).slice(0, 24);
    // Generic compatibility compiler for cards whose authored resource
    // contract still uses tacticalResource* fields. Once opted into
    // resourceSystemDslOnly, resource writes/consumption are synthesized as
    // formal counter atoms; the legacy tactical-resource resolver is disabled.
    if (action?.resourceSystemDslOnly === true) {
      var resourceKind = String(action?.tacticalResourceKind || "");
      var resourceGain = Math.max(0, Number(action?.tacticalResourceGain || 0));
      var resourceCost = Math.max(0, Number(action?.tacticalResourceCost || 0));
      var address = resourceKind === "rikaManifestSustain"
        ? { namespace: "rika_manifestation", counterId: "sustain", label: "完全显现维持", max: 5 }
        : (resourceKind === "miracleStockpile"
          ? { namespace: "miracles", counterId: "stockpile", label: "奇迹", max: 3 }
          : { namespace: "tactical_resource", counterId: resourceKind, label: resourceKind, max: 6 });
      var hasResourceAtom = filtered.some(function hasResourceAtom(effect) {
        return ["adjust_counter", "consume_counter", "set_counter"].includes(effect.tool)
          && String(effect.params?.namespace || "") === address.namespace
          && String(effect.params?.counterId || "") === address.counterId;
      });
      if (resourceKind && !hasResourceAtom) {
        var generated = [];
        if (resourceCost > 0) generated.push({ schema: "jjk.atomic-effect.v2", id: String(action.id || action.actionId || "card") + "-resource-consume", tool: "consume_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: address.namespace, counterId: address.counterId, label: address.label, amount: resourceCost, hideWhenUnavailable: true, removeWhenUnavailable: true } });
        if (resourceGain > 0) generated.push({ schema: "jjk.atomic-effect.v2", id: String(action.id || action.actionId || "card") + "-resource-gain", tool: "adjust_counter", trigger: action.resourceGainTiming === "onHit" ? "on-hit" : "post-damage", target: "self", when: [], params: { namespace: address.namespace, counterId: address.counterId, label: address.label, amount: resourceGain, max: address.max } });
        filtered = dedupeAtomicEffectsStable(filtered.concat(generated)).slice(0, 24);
      }
    }
    // Contract-recreation cards use the same formal counter pipeline. This
    // keeps ticket checks/consumption transactional with other atomic costs
    // and disables the legacy contract-ticket mutator for opted-in cards.
    if (action?.contractRecreationDslOnly === true) {
      var ticketCost = Math.max(0, Number(action?.contractTicketCost || 0));
      var ticketGain = Math.max(0, Number(action?.contractTicketGain || 0));
      var hasTicketAtom = filtered.some(function hasTicketAtom(effect) {
        return ["adjust_counter", "consume_counter", "set_counter"].includes(effect.tool)
          && String(effect.params?.namespace || "") === "contract_recreation"
          && String(effect.params?.counterId || "") === "tickets";
      });
      if (!hasTicketAtom && (ticketCost > 0 || ticketGain > 0)) {
        var ticketAtoms = [];
        if (ticketCost > 0) ticketAtoms.push({ schema:"jjk.atomic-effect.v2", id:String(action.id || action.actionId || "card")+"-ticket-consume", tool:"consume_counter", trigger:"post-damage", target:"self", when:[], params:{namespace:"contract_recreation", counterId:"tickets", label:"契约票据", amount:ticketCost, hideWhenUnavailable:true, removeWhenUnavailable:true} });
        if (ticketGain > 0) ticketAtoms.push({ schema:"jjk.atomic-effect.v2", id:String(action.id || action.actionId || "card")+"-ticket-gain", tool:"adjust_counter", trigger:"post-damage", target:"self", when:[], params:{namespace:"contract_recreation", counterId:"tickets", label:"契约票据", amount:ticketGain, max:8} });
        filtered = dedupeAtomicEffectsStable(filtered.concat(ticketAtoms)).slice(0, 24);
      }
    }
    if (action?.blackBirdDslOnly === true) {
      var bird = action.blackBirdSpec || {};
      var birdNs = "black_bird_manipulation";
      var birdBase = String(action.id || action.actionId || "card");
      var birdAtoms = [];
      var hasBirdAuthoredAtoms = filtered.some(function hasBirdAuthoredAtoms(effect) { return String(effect.id || "").indexOf(birdBase) === 0; });
      if (hasBirdAuthoredAtoms) { filtered = filtered.concat([]); }
      else {
      if (bird.effect === "gain") {
        birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-feather-gain", tool: "adjust_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: birdNs, counterId: "feathers", label: "乌羽", amount: Number(bird.gain || 0), max: 16 } });
      } else if (bird.effect === "attack" || bird.effect === "defense") {
        var featherCost = Math.max(0, Number(bird.featherCost || 0));
        if (Number(bird.maxFeatherCost || 0) > 0) birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-feather-limit", tool: "adjust_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: birdNs, counterId: "feathers", label: "乌羽", amount: 0, maxDelta: -Number(bird.maxFeatherCost || 0) } });
        if (featherCost > 0) birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-feather-require", tool: "require_value", trigger: "availability", target: "self", when: [], params: { source: "counter", namespace: birdNs, counterId: "feathers", operator: ">=", threshold: featherCost, reason: "乌羽数量不足" } });
        if (featherCost > 0) birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-feather-consume", tool: "consume_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: birdNs, counterId: "feathers", label: "乌羽", amount: featherCost, hideWhenUnavailable: true, removeWhenUnavailable: true } });
        if (bird.effect === "defense") birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-defense-scale", tool: "modify_scale", trigger: "pre-damage", target: "self", when: [], params: { stage: "incomingHp", value: Math.max(0, 1 - Number(bird.defenseRatio || 0)), stacking: "multiply" } });
        if (bird.effect === "defense" && Number(bird.reductionCap || 0) > 0) birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-defense-cap", tool: "adjust_action_resource", trigger: "pre-damage", target: "self", when: [], params: { resource: "incomingHpReductionCap", amount: Number(bird.reductionCap || 0) } });
      } else if (bird.effect === "damage_redirect") {
        var redirectCost = Math.max(0, Number(bird.featherCost || 0));
        if (redirectCost > 0) {
          birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-redirect-require", tool: "require_value", trigger: "availability", target: "self", when: [], params: { source: "counter", namespace: birdNs, counterId: "feathers", operator: ">=", threshold: redirectCost, reason: "乌羽数量不足" } });
          birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-redirect-consume", tool: "consume_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: birdNs, counterId: "feathers", label: "乌羽", amount: redirectCost, hideWhenUnavailable: true, removeWhenUnavailable: true } });
        }
        birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-redirect-cap", tool: "adjust_action_resource", trigger: "pre-damage", target: "self", when: [], params: { resource: "incomingHpReductionCap", amount: Number(bird.reductionCap || 95) } });
        birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-redirect-scale", tool: "modify_scale", trigger: "pre-damage", target: "self", when: [], params: { stage: "incomingHp", value: 0, stacking: "multiply" } });
      } else if (bird.effect === "boost") {
        birdAtoms.push({ schema: "jjk.atomic-effect.v2", id: birdBase + "-boost-status", tool: "add_status", trigger: "post-damage", target: "self", when: [], params: { statusId: "blackBirdBoost", label: "乌羽助力", value: Number(bird.effectMultiplier || 2), outgoingScale: Number(bird.effectMultiplier || 2), appliesToTag: "black_bird_manipulation", rounds: 1, stacking: "refresh" } });
      }
      filtered = dedupeAtomicEffectsStable(filtered.concat(birdAtoms)).slice(0, 24);
      }
    }
    var protocol = global.JJKDuelAtomicProtocol;
    return typeof protocol?.normalizeAtomicEffects === "function"
      ? protocol.normalizeAtomicEffects(filtered)
      : filtered;
  }

  function getCustomAtomicResolvePriority(entry) {
    var action = entry?.action || entry?.candidate?.action || entry?.card || entry;
    var directPriority = Number(action?.atomicResolvePriority);
    if (Number.isFinite(directPriority)) return directPriority;
    var orderEffect = getCustomAtomicEffects(action).find(function findAtomicOrder(effect) {
      return effect?.tool === "set_action_order";
    });
    var declaredPriority = Number(orderEffect?.params?.priority);
    return Number.isFinite(declaredPriority) ? declaredPriority : 0;
  }

  function orderCustomAtomicActionEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(function preserveAtomicOrder(entry, index) { return { entry: entry, index: index }; })
      .sort(function compareAtomicOrder(left, right) {
        return getCustomAtomicResolvePriority(left.entry) - getCustomAtomicResolvePriority(right.entry) || left.index - right.index;
      })
      .map(function restoreAtomicOrder(item) { return item.entry; });
  }

  function getCustomAtomicActionId(action) {
    return String(action?.id || action?.actionId || action?.cardId || "");
  }

  function getCustomAtomicActionTags(action) {
    var values = [
      action?.id,
      action?.actionId,
      action?.cardId,
      action?.label,
      action?.name
    ].concat(action?.tags || [], action?.matchTags || [], action?.specialHandTags || []);
    return new Set(values.map(function normalizeAtomicTag(value) {
      return String(value || "").trim().toLowerCase();
    }).filter(Boolean));
  }

  function customAtomicActionHasTag(action, tag) {
    var requested = String(tag || "").trim().toLowerCase();
    return Boolean(requested && getCustomAtomicActionTags(action).has(requested));
  }

  function getCustomAtomicSelectedActions(battle, side) {
    return (battle?.selectedHandActions?.[side] || []).map(function unwrapAtomicSelected(entry) {
      return entry?.action || entry;
    }).filter(Boolean);
  }

  function getCustomAtomicSelectionCount(battle, side, action) {
    var selected = getCustomAtomicSelectedActions(battle, side);
    if (selected.length) return selected.length;
    return Math.max(1, Number(action?.selectedCount || 1));
  }

  function getCustomAtomicRankScore(actor, field, fallback) {
    var profile = actor?.characterCardProfile || actor?.duelProfileSnapshot || actor?.profile || {};
    var raw = actor?.raw || profile.raw || {};
    var rawFields = {
      cursedEnergy: ["cursedEnergyScore", "cePoolScore"],
      control: ["controlScore", "ceControlScore"],
      efficiency: ["efficiencyScore", "ceEfficiencyScore"],
      martial: ["martialScore", "speedScore", "bodyScore"]
    };
    for (var rawField of rawFields[field] || []) {
      var direct = Number(raw[rawField] ?? actor?.[rawField] ?? profile?.[rawField]);
      if (Number.isFinite(direct)) return Math.min(12, Math.max(0, direct));
    }
    var baseStats = actor?.baseStats || profile.baseStats || {};
    var rank = field === "cursedEnergy"
      ? (actor?.cursedEnergy || baseStats.cursedEnergy)
      : field === "control"
        ? (actor?.control || baseStats.control)
        : field === "efficiency"
          ? (actor?.efficiency || baseStats.efficiency)
          : (actor?.martial || baseStats.martial || baseStats.body);
    var rankScores = { "E-": 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, "EX-": 10, EX: 12 };
    return Number(rankScores[String(rank || "").toUpperCase()] ?? fallback ?? 4);
  }

  function getCustomAtomicControlLevel(actor, fallback) {
    var profile = actor?.characterCardProfile || actor?.duelProfileSnapshot || actor?.profile || {};
    var baseStats = actor?.baseStats || profile.baseStats || {};
    var rank = String(actor?.control || baseStats.control || "").trim().toUpperCase();
    var rankLevels = { "E-": 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6, SS: 7, SSS: 8, "EX-": 9, EX: 10 };
    if (Object.prototype.hasOwnProperty.call(rankLevels, rank)) return rankLevels[rank];
    var raw = actor?.raw || profile.raw || {};
    var baseRaw = Number(raw.baseControlScore ?? raw.controlScore ?? actor?.baseControlScore ?? actor?.controlScore);
    if (Number.isFinite(baseRaw)) return Math.round(clamp(baseRaw, 0, 10));
    return Math.round(clamp(Number(fallback ?? 4), 0, 10));
  }

  function getCustomAtomicSelectionRules(action) {
    return getCustomAtomicEffects(action).filter(function keepSelectionRule(effect) {
      return effect?.tool === "selection_rule";
    }).map(function normalizeSelectionRule(effect) {
      return {
        mode: String(effect?.params?.mode || "solo"),
        groupId: String(effect?.params?.groupId || "custom_conflict_group"),
        reason: String(effect?.params?.reason || "所选手牌存在冲突")
      };
    });
  }

  function hasCustomAtomicConflictPermit(actions, groupId) {
    return (actions || []).some(function findConflictPermit(action) {
      return getCustomAtomicSelectionRules(action).some(function matchPermit(rule) {
        return rule.mode === "permit-conflict-group" && rule.groupId === groupId;
      });
    });
  }

  function findActiveCustomAtomicStatus(target, statusId, battle) {
    var turn = Number(battle?.round || 0) + 1;
    return (target?.statusEffects || []).find(function findAtomicStatus(status) {
      if (status?.id !== String(statusId || "") || Number(status?.rounds ?? 1) <= 0) return false;
      var triggerRound = Number(status?.triggerRound || 0);
      var expiresRound = Number(status?.expiresRound || status?.expiresAfterRound || 0);
      return (!triggerRound || turn >= triggerRound) && (!expiresRound || turn <= expiresRound);
    }) || null;
  }

  function getActiveCustomAtomicCounterEntry(battle, side, counterId) {
    var entry = getCustomAtomicState(battle)?.counters?.[side || "left"]?.[counterId] || null;
    if (!entry) return null;
    var round = Number(battle?.round || 0) + 1;
    var activationRound = Number(entry.activationRound || 0);
    var expiresRound = Number(entry.expiresRound || 0);
    if (activationRound > 0 && round < activationRound) return null;
    if (expiresRound > 0 && round > expiresRound) return null;
    return entry;
  }

  function getActiveCustomAtomicCounterValue(battle, side, counterId) {
    return Number(getActiveCustomAtomicCounterEntry(battle, side, counterId)?.value || 0);
  }

  function readAtomicCounterValue(battle, side, params, fallbackCounterId) {
    var namespaceName = String(params?.namespace || "");
    var counterId = String(params?.counterId || fallbackCounterId || "");
    if (namespaceName) return Number(readDuelCounter(battle, side || "left", namespaceName, counterId) || 0);
    return getActiveCustomAtomicCounterValue(battle, side || "left", counterId);
  }

  function uniqueAtomicEffects(effects, maxItems = 24) {
    var seen = new Set();
    return [].concat(effects || []).filter(function keepUniqueAtomicEffect(effect, index) {
      if (!effect || typeof effect !== "object" || !effect.tool) return false;
      var key = String(effect.id || (effect.tool + ":" + String(effect.target || "self") + ":" + index));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, Math.max(1, Number(maxItems) || 24));
  }

  function buildAtomicEffectFallbackKey(effect) {
    function stable(value) {
      if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
      if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(function mapKey(key) { return JSON.stringify(key) + ":" + stable(value[key]); }).join(",") + "}";
      return JSON.stringify(value);
    }
    return [effect?.tool, effect?.target || "self", effect?.trigger || "", stable(effect?.params || {})].join("|");
  }

  function dedupeAtomicEffectsStable(effects) {
    var seen = new Set();
    return (Array.isArray(effects) ? effects : []).filter(function keep(effect) {
      var key = String(effect?.id || buildAtomicEffectFallbackKey(effect) || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function readCustomAtomicConditionValue(source, actor, opponent, battle, action, counterId, counterNamespace) {
    if (source === "self.ce") return Math.max(0, Number(actor?.ce || 0));
    if (source === "self.maxCe") return Math.max(0, Number(actor?.maxCe || 0));
    if (source === "self.maxHp") return Math.max(0, Number(actor?.maxHp || 0));
    if (source === "self.hpRatio") return Number(actor?.maxHp || 0) > 0 ? Number(actor.hp || 0) / Number(actor.maxHp) : 0;
    if (source === "self.ceRatio") return Number(actor?.maxCe || 0) > 0 ? Number(actor.ce || 0) / Number(actor.maxCe) : 0;
    if (source === "opponent.hpRatio") return Number(opponent?.maxHp || 0) > 0 ? Number(opponent.hp || 0) / Number(opponent.maxHp) : 0;
    if (source === "opponent.ceRatio") return Number(opponent?.maxCe || 0) > 0 ? Number(opponent.ce || 0) / Number(opponent.maxCe) : 0;
    if (source === "round") return Number(battle?.round || 0) + 1;
    if (source === "selection.count") return getCustomAtomicSelectionCount(battle, actor?.side || "left", action);
    if (source === "self.cursedEnergyScore") return getCustomAtomicRankScore(actor, "cursedEnergy", 4);
    if (source === "self.controlScore") return getCustomAtomicRankScore(actor, "control", 4);
    if (source === "self.controlLevel") return getCustomAtomicControlLevel(actor, 4);
    if (source === "self.efficiencyScore") return getCustomAtomicRankScore(actor, "efficiency", 4);
    if (source === "self.martialScore") return getCustomAtomicRankScore(actor, "martial", 4);
    if (source === "self.counter" || source === "counter") {
      return readAtomicCounterValue(battle, actor?.side || "left", { namespace: counterNamespace, counterId: counterId }, counterId);
    }
    if (source === "summon.present" || source === "self.summon.present") {
      return findCustomAtomicSummon(battle, actor, String(counterId || "")) ? 1 : 0;
    }
    if (source === "summon.count" || source === "self.summon.count" || source === "summon.actionableCount" || source === "self.summon.actionableCount") {
      var ownerSide = actor?.side || "left";
      var groupTag = String(counterId || "");
      var actionableOnly = source.endsWith("actionableCount");
      return getDuelBattlefieldUnits(battle).filter(function countSummon(unit) {
        if (!unit?.active || String(unit.ownerSide || unit.side || "") !== ownerSide) return false;
        var tags = [].concat(unit.tags || [], unit.unitStats?.tags || []).map(String);
        if (groupTag && !tags.includes(groupTag)) return false;
        return !actionableOnly || unit.cannotAct !== true;
      }).length;
    }
    if (source === "constant" || !source) return 1;
    if (String(source || "").indexOf("counter:") === 0) {
      var counterId = String(source).slice(8);
      return getActiveCustomAtomicCounterValue(battle, actor?.side || "left", counterId);
    }
    return 0;
  }

  function passesCustomAtomicCondition(condition, actor, opponent, battle, action) {
    if (!condition?.source) return true;
    var value = readCustomAtomicConditionValue(
      condition.source,
      actor,
      opponent,
      battle,
      action,
      condition.counterId || condition.tag,
      condition.namespace
    );
    var threshold = Number(condition.threshold || 0);
    if (condition.operator === ">") return value > threshold;
    if (condition.operator === "<=") return value <= threshold;
    if (condition.operator === "<") return value < threshold;
    if (condition.operator === "==") return Math.abs(value - threshold) < 1e-9;
    return value >= threshold;
  }

  function passesCustomAtomicEffectConditions(effect, actor, opponent, battle, action) {
    var conditions = Array.isArray(effect?.when)
      ? effect.when
      : (effect?.condition ? [effect.condition] : []);
    return conditions.every(function passAtomicCondition(condition) {
      return passesCustomAtomicCondition(condition, actor, opponent, battle, action);
    });
  }

  function evaluateCustomAtomicFormula(params, actor, opponent, battle, action) {
    var sourceA = Math.max(0, readCustomAtomicConditionValue(params?.sourceA || "constant", actor, opponent, battle, action, params?.sourceACounterId, params?.sourceANamespace));
    var sourceB = Math.max(0, readCustomAtomicConditionValue(params?.sourceB || "constant", actor, opponent, battle, action, params?.sourceBCounterId, params?.sourceBNamespace));
    if (params?.sourceAMax !== undefined) sourceA = Math.min(sourceA, Math.max(0, Number(params.sourceAMax)));
    if (params?.sourceBMax !== undefined) sourceB = Math.min(sourceB, Math.max(0, Number(params.sourceBMax)));
    var exponentA = Number(params?.sourceAExponent ?? 1);
    var exponentB = Number(params?.sourceBExponent ?? 1);
    var factorA = Math.pow(sourceA, Number.isFinite(exponentA) ? exponentA : 1);
    var factorB = Math.pow(sourceB, Number.isFinite(exponentB) ? exponentB : 1);
    var growth = 1;
    if (params?.growthSource && params.growthSource !== "none") {
      var growthExponent = readCustomAtomicConditionValue(params.growthSource, actor, opponent, battle, action, params?.growthCounterId, params?.growthNamespace);
      growth = Math.pow(Math.max(0, Number(params.growthBase ?? 1)), growthExponent);
    }
    var value = Number(params?.offset || 0) + Number(params?.multiplier ?? 1) * factorA * factorB * growth;
    var minimum = Number(params?.minimum ?? 0);
    var maximum = Number(params?.maximum ?? 99999);
    if (!Number.isFinite(value)) value = 0;
    return clamp(value, Number.isFinite(minimum) ? minimum : 0, Number.isFinite(maximum) ? maximum : 99999);
  }

  function getCustomAtomicActionField(action, field) {
    if (field === "costCe") return Number(action?.costCe ?? action?.cost?.ce ?? action?.ceCost ?? 0);
    if (field === "apCost") return Number(action?.apCost ?? action?.cost?.ap ?? 0);
    if (field === "damage") return Number(action?.effect?.damage ?? action?.damage ?? 0);
    if (field === "block") return Number(action?.effect?.block ?? action?.block ?? 0);
    if (field === "evasionBonus") return Number(action?.effects?.evasionBonus || 0);
    if (field === "hitRateModifier") return Number(action?.hitRateModifier || 0);
    if (field === "incomingHpScale") return Number(action?.effects?.incomingHpScale ?? 1);
    if (field === "blockIgnoreRatio") return Number(action?.blockIgnoreRatio || 0);
    if (field === "selfHpCostRatio") return Number(action?.effects?.selfHpCostRatio || 0);
    return 0;
  }

  function combineCustomAtomicActionValue(current, computed, mode) {
    if (mode === "multiply") return current * computed;
    if (mode === "add") return current + computed;
    if (mode === "min") return Math.min(current, computed);
    if (mode === "max") return Math.max(current, computed);
    return computed;
  }

  function neutralizeCustomAtomicPanelScaling(action) {
    action.scaling = {
      ...(action.scaling || {}),
      baseDamageMultiplier: 1,
      martialDamagePerRank: 0,
      bodyDamagePerRank: 0,
      techniqueDamagePerRank: 0,
      cursedEnergyDamagePerRank: 0,
      sourceDamageMin: 1,
      sourceDamageMax: 1,
      talentDamagePerRank: 0,
      highCeDamageMultiplier: 1,
      talentBlockPerRank: 0
    };
  }

  function writeCustomAtomicActionField(action, params, computed) {
    var field = String(params?.field || "");
    var value = combineCustomAtomicActionValue(getCustomAtomicActionField(action, field), computed, String(params?.mode || "set"));
    if (!Number.isFinite(value)) value = 0;
    if (field === "costCe") {
      action.cost ||= {};
      action.cost.ce = value;
      action.cost.flatCe = value;
      action.cost.affectedByEfficiency = params?.affectedByEfficiency === true;
      action.cost.affectedByGlobalModifiers = params?.applyGlobalCostModifiers !== false;
      action.costCe = value;
      action.ceCost = value;
    } else if (field === "apCost") {
      action.cost ||= {};
      action.cost.ap = value;
      action.apCost = value;
    } else if (field === "damage") {
      action.effect ||= {};
      action.effect.damage = value;
      action.damage = value;
    } else if (field === "block") {
      action.effect ||= {};
      action.effect.block = value;
      action.block = value;
    } else if (field === "healing") {
      action.effect ||= {};
      action.effect.healing = value;
      action.healing = value;
    } else if (field === "evasionBonus") {
      action.effects ||= {};
      action.effects.evasionBonus = value;
    } else if (field === "hitRateModifier") {
      action.hitRateModifier = value;
    } else if (field === "incomingHpScale") {
      action.effects ||= {};
      action.effects.incomingHpScale = value;
    } else if (field === "blockIgnoreRatio") {
      action.blockIgnoreRatio = clamp(value, 0, 0.9);
    } else if (field === "selfHpCostRatio") {
      action.effects ||= {};
      action.effects.selfHpCostRatio = Math.max(0, value);
    }
    if (params?.finalFormula === true && (field === "damage" || field === "block")) {
      neutralizeCustomAtomicPanelScaling(action);
    }
    return value;
  }

  function applyCustomAtomicActionTransforms(action, actor, opponent, battle) {
    if (!action) return action;
    syncCustomAtomicCounterModifiers(battle, actor);
    syncCustomAtomicCounterModifiers(battle, opponent);
    var effects = getCustomAtomicEffects(action);
    if (!effects.length) return action;
    var base = action.customAtomicTransformBase || {
      cost: { ...(action.cost || {}) },
      effect: { ...(action.effect || {}) },
      effects: { ...(action.effects || {}) },
      scaling: { ...(action.scaling || {}) },
      costCe: action.costCe,
      ceCost: action.ceCost,
      apCost: action.apCost,
      damage: action.damage,
      block: action.block,
      hitRateModifier: action.hitRateModifier,
      atomicTargeting: action.atomicTargeting ? { ...action.atomicTargeting } : undefined,
      type: action.type,
      cardType: action.cardType,
      accuracy: action.accuracy ? { ...action.accuracy } : undefined,
      accuracyProfile: action.accuracyProfile,
      evasionAllowed: action.evasionAllowed,
      atomicResolvePriority: action.atomicResolvePriority,
      atomicDamagePolicy: action.atomicDamagePolicy
    };
    var next = {
      ...action,
      cost: { ...(base.cost || {}) },
      effect: { ...(base.effect || {}) },
      effects: { ...(base.effects || {}) },
      scaling: { ...(base.scaling || {}) },
      costCe: base.costCe,
      ceCost: base.ceCost,
      apCost: base.apCost,
      damage: base.damage,
      block: base.block,
      hitRateModifier: base.hitRateModifier,
      atomicTargeting: base.atomicTargeting ? { ...base.atomicTargeting } : undefined,
      type: base.type,
      cardType: base.cardType,
      accuracy: base.accuracy ? { ...base.accuracy } : undefined,
      accuracyProfile: base.accuracyProfile,
      evasionAllowed: base.evasionAllowed,
      atomicResolvePriority: base.atomicResolvePriority,
      atomicDamagePolicy: base.atomicDamagePolicy,
      customAtomicTransformBase: base,
      customAtomicTransformsApplied: []
    };
    effects.forEach(function applyAtomicTransform(effect) {
      var transformId = String(effect?.id || effect?.tool || "");
      if (!passesCustomAtomicEffectConditions(effect, actor, opponent, battle, next)) return;
      var params = effect.params || {};
      if (effect.tool === "compute_action_value") {
        writeCustomAtomicActionField(next, params, evaluateCustomAtomicFormula(params, actor, opponent, battle, next));
      } else if (effect.tool === "set_targeting") {
        next.atomicTargeting = {
          scope: String(params.scope || "single"),
          damageScale: Math.max(0, Number(params.damageScale ?? 1)),
          sourceEffectId: String(effect.id || "")
        };
      } else if (effect.tool === "set_action_mode") {
        var nextCardType = String(params.cardType || "support");
        var nextDamage = Math.max(0, Number(params.damage || 0));
        next.type = nextCardType;
        next.cardType = nextCardType;
        next.damage = nextDamage;
        next.effect ||= {};
        next.effect.damage = nextDamage;
        next.accuracy = {
          ...(next.accuracy || {}),
          profile: String(params.accuracyProfile || (nextCardType === "attack" ? "technique_projectile" : "none")),
          evasionAllowed: params.evasionAllowed === true
        };
        next.accuracyProfile = next.accuracy.profile;
        next.evasionAllowed = next.accuracy.evasionAllowed;
      } else if (effect.tool === "set_action_order") {
        next.atomicResolvePriority = Number.isFinite(Number(params.priority)) ? Number(params.priority) : 0;
      } else if (effect.tool === "set_damage_policy") {
        next.atomicDamagePolicy = String(params.policy || "");
      }
      if (transformId && ["compute_action_value", "set_targeting", "set_action_mode", "set_action_order", "set_damage_policy"].includes(effect.tool)) {
        next.customAtomicTransformsApplied.push(transformId);
      }
    });
    return next;
  }

  function ensureCustomAtomicActionTransforms(action, actor, opponent, battle) {
    // Transforms are derived from live battle state. Rebuild from the stored
    // immutable base every time so an earlier card in the same locked batch can
    // change a later card's conditional mode without compounding formulas.
    return applyCustomAtomicActionTransforms(action, actor, opponent, battle);
  }

  function getCustomAtomicTarget(effect, actor, opponent) {
    return effect?.target === "opponent" || effect?.target === "all-enemies" ? opponent : actor;
  }

  function isCustomCharacterAtomicAction(action) {
    return Boolean(
      action &&
      (action.source === "custom-character-v3-projector" || action.canonicalCard?.schema === "jjk.card.v3") &&
      getCustomAtomicEffects(action).length
    );
  }

  function getCustomAtomicActionAvailability(action, actor, opponent, battle) {
    syncCustomAtomicCounterModifiers(battle, actor);
    syncCustomAtomicCounterModifiers(battle, opponent);
    var effects = getCustomAtomicEffects(action);
    if (!effects.length) return { available: true, reason: "" };
    var actorBlockedStatus = (actor?.statusEffects || []).find(function findCannotActStatus(status) {
      return isDuelStatusEffectActive(status, battle) && status?.cannotAct === true;
    });
    if (actorBlockedStatus) return { available: false, reason: String(actorBlockedStatus.label || "当前状态下无法行动"), statusId: actorBlockedStatus.id };
    var side = actor?.side || "left";
    var selected = getCustomAtomicSelectedActions(battle, side);
    var actionId = getCustomAtomicActionId(action);
    var selectedOthers = selected.filter(function excludeSameAction(entry) {
      return getCustomAtomicActionId(entry) !== actionId;
    });
    var candidateRules = getCustomAtomicSelectionRules(action);
    var selectedRules = selectedOthers.flatMap(getCustomAtomicSelectionRules);
    var allForPermit = selectedOthers.concat([action]);
    var candidateSolo = candidateRules.find(function findSolo(rule) { return rule.mode === "solo"; });
    if (candidateSolo && selectedOthers.length) {
      return { available: false, reason: candidateSolo.reason || "该手札必须单独使用" };
    }
    var selectedSolo = selectedRules.find(function findSelectedSolo(rule) { return rule.mode === "solo"; });
    if (selectedSolo) {
      return { available: false, reason: selectedSolo.reason || "已选择的手札必须单独使用" };
    }
    var conflictGroups = new Set(candidateRules
      .filter(function keepConflict(rule) { return rule.mode === "conflict-group"; })
      .map(function mapConflict(rule) { return rule.groupId; }));
    selectedRules.filter(function keepSelectedConflict(rule) {
      return rule.mode === "conflict-group";
    }).forEach(function addSelectedConflict(rule) {
      if (candidateRules.some(function candidateSharesConflict(candidateRule) {
        return candidateRule.mode === "conflict-group" && candidateRule.groupId === rule.groupId;
      })) conflictGroups.add(rule.groupId);
    });
    for (var groupId of conflictGroups) {
      var peerConflict = selectedOthers.some(function selectedSharesGroup(entry) {
        return getCustomAtomicSelectionRules(entry).some(function matchConflict(rule) {
          return rule.mode === "conflict-group" && rule.groupId === groupId;
        });
      });
      if (peerConflict && !hasCustomAtomicConflictPermit(allForPermit, groupId)) {
        var conflictReason = candidateRules.find(function findReason(rule) {
          return rule.mode === "conflict-group" && rule.groupId === groupId;
        })?.reason;
        return { available: false, reason: conflictReason || "所选手牌存在冲突", conflictGroup: groupId };
      }
    }
    for (var requiredEffect of effects.filter(function keepStatusRequirement(effect) { return effect?.tool === "require_status"; })) {
      var requiredTarget = getCustomAtomicTarget(requiredEffect, actor, opponent);
      var requiredStatusId = String(requiredEffect?.params?.statusId || "");
      if (!findActiveCustomAtomicStatus(requiredTarget, requiredStatusId, battle)) {
        return {
          available: false,
          reason: String(requiredEffect?.params?.reason || "前置状态未满足"),
          statusId: requiredStatusId
        };
      }
    }
    for (var requiredSummonEffect of effects.filter(function keepSummonRequirement(effect) { return effect?.tool === "require_summon"; })) {
      var summonParams = requiredSummonEffect.params || {};
      var summonOwner = String(summonParams.owner || "self") === "opponent" ? opponent : actor;
      var activeSummon = findCustomAtomicSummon(battle, summonOwner, String(summonParams.summonId || ""));
      var needsPresent = String(summonParams.presence || "present") === "present";
      if (needsPresent !== Boolean(activeSummon)) {
        return {
          available: false,
          reason: String(summonParams.reason || (needsPresent ? "所需召唤单位未在场" : "所需召唤单位已在场")),
          summonId: String(summonParams.summonId || ""),
          presence: needsPresent ? "present" : "absent"
        };
      }
    }
    for (var requiredGroupEffect of effects.filter(function keepSummonGroupRequirement(effect) { return effect?.tool === "require_summon_group"; })) {
      var groupParams = requiredGroupEffect.params || {};
      var groupOwner = String(groupParams.owner || "self") === "opponent" ? opponent : actor;
      var groupTag = String(groupParams.tag || "");
      var groupUnits = getDuelBattlefieldUnits(battle).filter(function matchGroupUnit(unit) {
        if (!unit?.active || String(unit.ownerSide || unit.side || "") !== String(groupOwner?.side || "")) return false;
        var tags = [].concat(unit.tags || [], unit.unitStats?.tags || []).map(String);
        if (groupTag && !tags.includes(groupTag)) return false;
        if (groupParams.aliveOnly !== false && Number(unit.currentHp ?? unit.hp ?? unit.unitStats?.currentHp ?? 0) <= 0) return false;
        if (groupParams.actionableOnly === true && unit.cannotAct === true) return false;
        return true;
      });
      var groupCount = groupUnits.length;
      var groupPresent = String(groupParams.presence || "present") === "present";
      var groupPass = groupPresent ? groupCount >= Number(groupParams.minCount || 1) : groupCount < Number(groupParams.minCount || 1);
      if (!groupPass) return { available: false, reason: String(groupParams.reason || "召唤物集合条件未满足"), tag: groupTag, count: groupCount };
    }
    for (var requiredValueEffect of effects.filter(function keepValueRequirement(effect) { return effect?.tool === "require_value"; })) {
      var valueParams = requiredValueEffect.params || {};
      var valueCondition = {
        source: valueParams.source || "round",
        operator: valueParams.operator || ">=",
        threshold: Number(valueParams.threshold || 0),
        counterId: valueParams.counterId,
        namespace: valueParams.namespace
      };
      if (!passesCustomAtomicCondition(valueCondition, actor, opponent, battle, action)) {
        return {
          available: false,
          reason: String(valueParams.reason || "数值条件未满足"),
          source: valueCondition.source,
          requiredValue: valueCondition.threshold
        };
      }
    }
    for (var temporaryTechniqueEffect of effects.filter(function keepTemporaryTechniqueRequirement(effect) { return effect?.tool === "grant_temporary_technique_tag"; })) {
      if (String(temporaryTechniqueEffect?.params?.source || "") !== "opponent") continue;
      var temporaryTechniqueCandidate = selectTemporaryTechniqueTag(temporaryTechniqueEffect, actor, opponent, battle);
      if (!temporaryTechniqueCandidate.tag) {
        return { available: false, reason: String(temporaryTechniqueEffect?.params?.emptySourceReason || "对手没有可复制的正式术式") };
      }
    }
    var requiredByCounter = new Map();
    effects.forEach(function collectCounterRequirement(effect) {
      if (effect?.tool !== "consume_counter" || !passesCustomAtomicEffectConditions(effect, actor, opponent, battle, action)) return;
      var params = effect.params || {};
      var target = getCustomAtomicTarget(effect, actor, opponent);
      var side = target?.side || actor?.side || "left";
      var namespaceName = String(params.namespace || "");
      var counterId = String(params.counterId || "custom_counter");
      var key = side + ":" + namespaceName + ":" + counterId;
      var previous = requiredByCounter.get(key) || {
        side: side,
        namespace: namespaceName,
        counterId: counterId,
        label: String(params.label || counterId || "自定义层数"),
        amount: 0
      };
      previous.amount += params.amountSource === "counter" ? 0 : Math.max(1, Number(params.amount || 1));
      requiredByCounter.set(key, previous);
    });
    for (var requirement of requiredByCounter.values()) {
      var current = readAtomicCounterValue(battle, requirement.side, requirement, requirement.counterId);
      if (current + 1e-9 < requirement.amount) {
        return {
          available: false,
          reason: requirement.label + "不足（需要 " + requirement.amount + "，当前 " + current + "）",
          namespace: requirement.namespace,
          counterId: requirement.counterId,
          required: requirement.amount,
          current: current
        };
      }
    }
    return { available: true, reason: "" };
  }

  function getCustomAtomicHandPolicy(action, actor, opponent, battle) {
    var candidate = isDirectBattleCard(action) ? prepareDirectBattleCardRuntimeAction(action) : action;
    syncCustomAtomicCounterModifiers(battle, actor);
    syncCustomAtomicCounterModifiers(battle, opponent);
    var effects = getCustomAtomicEffects(candidate);
    var gates = effects.filter(function keepHandGate(effect) {
      return ["require_status", "require_summon", "require_value", "consume_counter"].includes(effect?.tool);
    });
    var availability = getCustomAtomicActionAvailability(candidate, actor, opponent, battle);
    var hideWhenUnavailable = gates.some(function hasHiddenGate(effect) { return effect?.params?.hideWhenUnavailable === true; });
    var guaranteedWhenAvailable = gates.some(function hasGuaranteedGate(effect) { return effect?.params?.guaranteedWhenAvailable === true; });
    var removeWhenUnavailable = gates.some(function hasRemovalGate(effect) { return effect?.params?.removeWhenUnavailable === true; });
    return {
      available: availability.available,
      reason: availability.reason || "",
      visible: availability.available || !hideWhenUnavailable,
      guaranteed: availability.available && guaranteedWhenAvailable,
      removeWhenUnavailable: !availability.available && removeWhenUnavailable
    };
  }

  function prepareCustomAtomicRuntime(action, baseEffects, actor, opponent, battle) {
    var transformedAction = ensureCustomAtomicActionTransforms(action, actor, opponent, battle);
    var atomicEffects = getCustomAtomicEffects(transformedAction);
    var effects = { ...(baseEffects || {}) };
    // Atomic compilation must be pure. Mutating the authoritative hand card
    // here would leak one target's status-based penetration into later turns.
    var patchedAction = { ...(transformedAction || {}) };
    var runtime = { effects: atomicEffects, applied: [], skipped: [], pre: [], onHit: [], onMiss: [], post: [], turnStart: [], beforeReceiveDamage: [], afterReceiveDamage: [], summonDefeated: [], shieldBroken: [], turnEnd: [], blocked: false, reason: "" };
    var availability = getCustomAtomicActionAvailability(patchedAction, actor, opponent, battle);
    if (!availability.available) {
      runtime.blocked = true;
      runtime.reason = availability.reason;
      runtime.counterId = availability.counterId;
      runtime.required = availability.required;
      runtime.current = availability.current;
      return { action: patchedAction, effects: effects, runtime: runtime };
    }
    // Effects sharing an exclusiveGroup form a priority ladder: only the
    // highest-priority effect whose conditions pass is compiled. This is a
    // generic DSL control primitive for threshold tiers (not technique-specific).
    var exclusiveWinners = new Map();
    atomicEffects.forEach(function selectExclusiveWinner(effect, index) {
      var group = String(effect?.params?.exclusiveGroup || "");
      if (!group || !passesCustomAtomicEffectConditions(effect, actor, opponent, battle, patchedAction)) return;
      var priority = Number(effect?.params?.priority ?? 0);
      var previous = exclusiveWinners.get(group);
      if (!previous || priority > previous.priority || (priority === previous.priority && index < previous.index)) {
        exclusiveWinners.set(group, { priority: priority, index: index });
      }
    });
    atomicEffects.forEach(function compileAtomicEffect(effect, effectIndex) {
      var exclusiveGroup = String(effect?.params?.exclusiveGroup || "");
      if (exclusiveGroup && exclusiveWinners.get(exclusiveGroup)?.index !== effectIndex) {
        runtime.skipped.push({ id: effect.id || "", tool: effect.tool, reason: "exclusive-group" });
        return;
      }
      if (!passesCustomAtomicEffectConditions(effect, actor, opponent, battle, patchedAction)) {
        runtime.skipped.push({ id: effect.id || "", tool: effect.tool, reason: "condition-false" });
        return;
      }
      var params = effect.params || {};
      var target = getCustomAtomicTarget(effect, actor, opponent);
      if (["selection_rule", "require_value", "compute_action_value", "set_targeting", "set_action_mode", "set_action_order"].includes(effect.tool)) {
        runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: "availability" });
        return;
      }
      var requestedTiming = ["pre-damage", "post-damage", "turn-end"].includes(effect.trigger) ? effect.trigger : "post-damage";
      var forcedTiming = ["pay_hp_cost", "modify_damage"].includes(effect.tool)
        ? "pre-damage"
        : (["consume_counter", "summon_unit"].includes(effect.tool) ? "post-damage" : "");
      if (!forcedTiming && effect.trigger === "on-hit") {
        runtime.onHit.push(effect);
        runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: "on-hit" });
        return;
      }
      if (!forcedTiming && effect.trigger === "on-miss") {
        runtime.onMiss.push(effect);
        runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: "on-miss" });
        return;
      }
      var triggerBucket = { "turn-start": "turnStart", "before-receive-damage": "beforeReceiveDamage", "after-receive-damage": "afterReceiveDamage", "summon-defeated": "summonDefeated", "shield-broken": "shieldBroken" }[effect.trigger];
      if (!forcedTiming && triggerBucket) {
        runtime[triggerBucket].push(effect);
        runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: effect.trigger });
        return;
      }
      var effectiveTiming = forcedTiming || requestedTiming;
      if (!forcedTiming && effectiveTiming === "turn-end") {
        runtime.turnEnd.push(effect);
        runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: effectiveTiming });
        return;
      }
      if (!forcedTiming && effectiveTiming === "pre-damage") {
        var preResult = applyCustomAtomicPostOperation(effect, actor, opponent, battle, { missed: false, timing: "pre-damage", action: patchedAction });
        runtime.pre.push({ id: effect.id || "", tool: effect.tool, result: preResult });
        runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: effectiveTiming });
        return;
      }
      if (effect.tool === "pay_hp_cost") {
        effects.selfHpCostFlat = Number(effects.selfHpCostFlat || 0) + Math.max(0, Number(params.amount || 0));
        effects.selfHpCostRatio = Number(effects.selfHpCostRatio || 0) + Math.max(0, Number(params.ratio || 0));
        if (params.nonlethal !== false) effects.selfHpCostNonlethal = true;
      } else if (effect.tool === "modify_scale") {
        var stageKey = String(params.stage || "");
        var stageMap = { outgoing: "outgoingScale", incomingHp: "incomingHpScale", incomingCe: "incomingCeScale", evasion: "evasionBonus", hitRate: "hitRateModifier" };
        var effectKey = stageMap[stageKey];
        if (stageKey === "blockIgnore") {
          var currentIgnore = Number(patchedAction.blockIgnoreRatio || 0);
          var ignoreValue = Number(params.value ?? 0);
          patchedAction.blockIgnoreRatio = String(params.stacking || "replace") === "max"
            ? Math.max(currentIgnore, ignoreValue)
            : (String(params.stacking || "replace") === "add" ? currentIgnore + ignoreValue : ignoreValue);
          patchedAction.blockIgnoreRatio = clamp(patchedAction.blockIgnoreRatio, 0, 0.95);
        } else if (effectKey) {
          var scaleValue = Number(params.value ?? 1);
          var existingValue = Number(effects[effectKey] ?? (stageKey === "evasion" || stageKey === "hitRate" ? 0 : 1));
          effects[effectKey] = String(params.stacking || "replace") === "multiply" ? existingValue * scaleValue : (String(params.stacking || "replace") === "add" ? existingValue + scaleValue : scaleValue);
        }
      } else if (effect.tool === "adjust_action_resource") {
        if (params.resource === "incomingHpReductionCap") effects.incomingHpReductionCap = Number(effects.incomingHpReductionCap || 0) + Number(params.amount || 0);
        if (params.resource === "evidencePressure") effects.evidencePressureDelta = Number(effects.evidencePressureDelta || 0) + Number(params.amount || 0);
      } else if (effect.tool === "modify_damage") {
        var requiredTargetStatusId = String(params.requiredTargetStatusId || "");
        if (requiredTargetStatusId && !findActiveCustomAtomicStatus(target, requiredTargetStatusId, battle)) {
          runtime.skipped.push({ id: effect.id || "", tool: effect.tool, reason: "required-target-status-missing", statusId: requiredTargetStatusId });
          return;
        }
        var multiplier = Math.max(0, Number(params.multiplier ?? 1));
        effects.damageScale = Number(effects.damageScale || 1) * multiplier;
        var flat = Number(params.flat || 0);
        if (flat) {
          var nextDamage = Math.max(0, Number(patchedAction.effect?.damage ?? patchedAction.damage ?? 0) + flat);
          patchedAction = {
            ...patchedAction,
            damage: nextDamage,
            effect: { ...(patchedAction.effect || {}), damage: nextDamage }
          };
        }
        var basePenetration = Number(patchedAction.blockIgnoreRatio || 0);
        var minimumPenetration = Number(params.penetrationRatio || 0);
        var penetrationAdd = Math.max(0, Number(params.penetrationAdd || 0));
        if (minimumPenetration > 0 || penetrationAdd > 0) {
          patchedAction.blockIgnoreRatio = clamp(Math.max(basePenetration, minimumPenetration) + penetrationAdd, 0, 0.9);
        }
      } else if (effect.tool === "summon_unit" && !patchedAction.summonSpec) {
        var summonId = String(params.summonId || "custom_summon");
        var atomicSummonTags = uniqueFeatureList(["custom_atomic_summon", "召唤物"].concat(Array.isArray(params.tags) ? params.tags : []));
        patchedAction = {
          ...patchedAction,
          summonSpec: {
            unitCardId: summonId,
            unitName: String(params.name || "自定义召唤物"),
            ownerSide: target?.side || actor?.side || "left",
            control: "player_controlled",
            placement: String(params.placement || "shikigami_zone"),
            summonLane: "custom",
            zoneLabel: "召唤物区",
            durationRounds: Math.max(0, Number(params.durationRounds || 0)),
            uniqueSummonKey: String(params.uniqueKey || params.uniqueSummonKey || summonId),
            maintenanceCeCost: Math.max(0, Number(params.maintenanceCeCost || 0)),
            maintenanceResource: String(params.maintenanceResource || ""),
            maintenanceResourceNamespace: String(params.maintenanceResourceNamespace || ""),
            maintenanceResourceCounterId: String(params.maintenanceResourceCounterId || ""),
            maintenanceResourceAmount: Math.max(0, Number(params.maintenanceResourceAmount || 0)),
            unitStats: {
              customAtomicSummonId: summonId,
              maxHp: Math.max(1, Number(params.maxHp || 100)),
              damage: Math.max(0, Number(params.attack || 0)),
              block: Math.max(0, Number(params.defense || 0)),
              damageReductionRatio: clamp(Number(params.damageReductionRatio || 0), 0, 0.95),
              blockIgnoreRatio: clamp(Number(params.blockIgnoreRatio || 0), 0, 0.9),
              damageType: String(params.damageType || "shikigami_melee"),
              accuracyProfile: String(params.accuracyProfile || "melee"),
              uniqueSummonKey: String(params.uniqueKey || params.uniqueSummonKey || summonId),
              tags: atomicSummonTags,
              guardRules: params.guardRules || undefined
            }
          },
          unitStats: {
            customAtomicSummonId: summonId,
            maxHp: Math.max(1, Number(params.maxHp || 100)),
            damage: Math.max(0, Number(params.attack || 0)),
            block: Math.max(0, Number(params.defense || 0)),
            damageReductionRatio: clamp(Number(params.damageReductionRatio || 0), 0, 0.95),
            blockIgnoreRatio: clamp(Number(params.blockIgnoreRatio || 0), 0, 0.9),
            damageType: String(params.damageType || "shikigami_melee"),
            accuracyProfile: String(params.accuracyProfile || "melee"),
            uniqueSummonKey: String(params.uniqueKey || params.uniqueSummonKey || summonId),
            maintenanceResource: String(params.maintenanceResource || ""),
            maintenanceResourceNamespace: String(params.maintenanceResourceNamespace || ""),
            maintenanceResourceCounterId: String(params.maintenanceResourceCounterId || ""),
            maintenanceResourceAmount: Math.max(0, Number(params.maintenanceResourceAmount || 0)),
            tags: atomicSummonTags,
            guardRules: params.guardRules || undefined
          }
        };
      } else runtime.post.push(effect);
      runtime.applied.push({ id: effect.id || "", tool: effect.tool, target: effect.target || "self", timing: effectiveTiming, forcedTiming: forcedTiming && forcedTiming !== requestedTiming ? true : undefined });
    });
    return { action: patchedAction, effects: effects, runtime: runtime };
  }

  function updateCustomAtomicCounterStatus(target, entry) {
    if (!target || !entry) return;
    var statusId = "customAtomicCounter:" + entry.id;
    if (Number(entry.value || 0) <= 0) {
      target.statusEffects = (target.statusEffects || []).filter(function keepStatus(status) { return status?.id !== statusId; });
      return;
    }
    upsertDuelStatusEffect(target, {
      id: statusId,
      label: String(entry.label || "自定义层数"),
      value: Number(entry.value || 0),
      max: Number(entry.max || 999),
      rounds: 999,
      category: "资源状态",
      displayOnly: true
    });
  }

  function syncCustomAtomicCounterModifiers(battle, target, counterId) {
    if (!battle || !target?.side) return [];
    var state = getCustomAtomicState(battle);
    var side = target.side || "left";
    var bindings = state.counterModifiers?.[side] || {};
    var synced = [];
    Object.values(bindings).forEach(function syncCounterBinding(binding) {
      if (!binding || (counterId && String(binding.counterId || "") !== String(counterId))) return;
      var activeValue = readAtomicCounterValue(battle, side, binding, String(binding.counterId || ""));
      var modifierId = String(binding.modifierId || binding.id || "customCounterModifier");
      if (activeValue <= 0 && binding.inactiveWhenZero !== false) {
        synced.push({ modifierId: modifierId, namespace: binding.namespace || "", counterId: binding.counterId, value: activeValue, inactive: true });
        return;
      }
      var minimum = Number.isFinite(Number(binding.minimum)) ? Number(binding.minimum) : 0;
      var maximum = Number.isFinite(Number(binding.maximum)) ? Number(binding.maximum) : 5;
      var modifierValue = clamp(
        Number(binding.offset || 0) + Number(binding.perCounter || 0) * activeValue,
        minimum,
        maximum
      );
      var field = ["outgoingScale", "incomingHpScale", "hitRateModifier", "evasionBonus"].includes(binding.field)
        ? binding.field
        : "incomingHpScale";
      synced.push({
        modifierId: modifierId,
        namespace: binding.namespace || "",
        counterId: binding.counterId,
        value: activeValue,
        field: field,
        modifierValue: modifierValue
      });
    });
    return synced;
  }

  function getCustomAtomicCounterModifierValue(battle, target, field) {
    if (!battle || !target?.side) return field === "outgoingScale" || field === "incomingHpScale" ? 1 : 0;
    var values = syncCustomAtomicCounterModifiers(battle, target).filter(function keepAtomicCounterField(entry) {
      return entry?.field === field && entry?.inactive !== true && Number.isFinite(Number(entry.modifierValue));
    });
    if (field === "outgoingScale" || field === "incomingHpScale") {
      return values.reduce(function multiplyAtomicCounterScale(total, entry) {
        return total * Math.max(0, Number(entry.modifierValue));
      }, 1);
    }
    return values.reduce(function addAtomicCounterModifier(total, entry) {
      return total + Number(entry.modifierValue);
    }, 0);
  }

  function findCustomAtomicSummon(battle, target, summonId) {
    var targetSide = target?.side || "";
    return getDuelBattlefieldUnits(battle).find(function findUnit(unit) {
      if (!unit?.active) return false;
      var matchesId = [unit.id, unit.cardId, unit.actionId, unit.uniqueSummonKey, unit.unitStats?.customAtomicSummonId].map(String).includes(String(summonId || ""));
      return matchesId && (!targetSide || unit.ownerSide === targetSide || unit.side === targetSide);
    });
  }

  function recordCustomAtomicEvent(battle, side, label, delta) {
    var state = getCustomAtomicState(battle);
    var entry = { round: Number(battle?.round || 0) + 1, side: side || "", label: String(label || "特殊效果发动"), delta: { ...(delta || {}) } };
    state.events.unshift(entry);
    state.events = state.events.slice(0, 40);
    callDependency("recordDuelResourceChange", [battle, { side: side || "", title: "原子效果", detail: entry.label, type: "special", delta: entry.delta }]);
    return entry;
  }

  function applyCustomAtomicPostOperation(effect, actor, opponent, battle, options) {
    var params = effect?.params || {};
    var target = getCustomAtomicTarget(effect, actor, opponent);
    var targetSide = target?.side || actor?.side || "left";
    if ((effect.target === "opponent" || effect.target === "all-enemies") && options?.missed && params.applyOnMiss !== true) {
      return { skipped: true, reason: "missed" };
    }
    var state = getCustomAtomicState(battle);
    if (effect.tool === "apply_barrier") {
      var barrierAmount = Math.max(1, Number(params.amount || 0));
      var barrierScope = String(params.scope || "self");
      state.barriers ||= { left: [], right: [] };
      var barrierSide = targetSide;
      var barrier = { id: String(params.barrierId || effect.id || "custom_barrier"), value: barrierAmount, max: barrierAmount, consumeMode: String(params.consumeMode || "one-hit-or-until-empty"), rounds: Math.max(1, Number(params.rounds || 1)), createdRound: Number(battle?.round || 0) + 1, breakEventId: String(params.breakEventId || "shield_broken"), scope: barrierScope, ownerSide: barrierSide };
      state.barriers[barrierSide] ||= [];
      state.barriers[barrierSide] = state.barriers[barrierSide].filter(function keepBarrier(entry) { return entry.id !== barrier.id; });
      state.barriers[barrierSide].push(barrier);
      var barrierTargets = [];
      if (barrierScope !== "all-allies") upsertDuelStatusEffect(target, { id: "customAtomicBarrier:" + barrier.id, label: String(params.label || "护盾"), value: barrierAmount, rounds: barrier.rounds, duelShield: true, barrierId: barrier.id, category: "防御状态" });
      return { tool: effect.tool, barrierId: barrier.id, scope: barrierScope, amount: barrierAmount, targets: barrierTargets.length };
    }
    if (effect.tool === "adjust_resource") {
      var amount = Number(params.amount || 0);
      var ratio = Number(params.ratio || 0);
      var basis = String(params.basis || "flat");
      var resourceKey = String(params.resource || "");
      if (Number.isFinite(ratio) && ratio !== 0 && ["hp", "ce"].includes(resourceKey)) {
        var basisValue = basis === "current"
          ? Number(target?.[resourceKey] || 0)
          : (basis === "max" ? Number(target?.[resourceKey === "hp" ? "maxHp" : "maxCe"] || 0) : 0);
        amount += basisValue * ratio;
      }
      var beforeResource = Number(target?.[resourceKey] || 0);
      if (params.resource === "hp") target.hp = Number(target.hp || 0) + amount;
      if (params.resource === "ce") target.ce = Number(target.ce || 0) + amount;
      if (params.resource === "stability") target.stability = clamp(Number(target.stability || 0) + amount, 0, 1);
      if (params.resource === "domainLoad") {
        if (target.domain) target.domain.load = Math.max(0, Number(target.domain.load || 0) + amount);
        else target.domainLoad = Math.max(0, Number(target.domainLoad || 0) + amount);
      }
      clampDuelResource(target);
      // Keep the actual applied delta available to later atomic operations in
      // the same card. This prevents percentage resource conversions from
      // using max/current capacity when the real payment was clamped.
      var afterResource = Number(target?.[resourceKey] || 0);
      var appliedDelta = Number((afterResource - beforeResource).toFixed(3));
      options ||= {};
      options.atomicResourceLedger ||= {};
      options.atomicResourceLedger[resourceKey] = {
        before: beforeResource,
        after: afterResource,
        delta: appliedDelta,
        spent: Math.max(0, Number((-appliedDelta).toFixed(3))),
        gained: Math.max(0, Number(appliedDelta.toFixed(3)))
      };
      return { tool: effect.tool, resource: params.resource, amount: appliedDelta, requestedAmount: Number(amount.toFixed(3)), basis: basis, ratio: ratio };
    }
    if (effect.tool === "grant_temporary_technique_tag") {
      var selectedTechnique = selectTemporaryTechniqueTag(effect, actor, opponent, battle);
      if (!selectedTechnique.tag) {
        return { tool: effect.tool, granted: false, reason: String(params.emptySourceReason || "没有可复制的正式术式") };
      }
      var slotId = String(params.slotId || "copy_technique");
      if (params.replaceExisting !== false) removeTemporaryTechniqueSlot(battle, targetSide, slotId, target);
      var currentRound = getDuelActionTurnNumber(battle);
      var activationRound = params.durationStartsNextRound === true ? currentRound + 1 : currentRound;
      var durationRounds = Math.max(1, Number(params.durationRounds || 1));
      var entry = {
        tag: selectedTechnique.tag,
        source: String(params.source || "formal-random"),
        sourceSide: opponent?.side || "",
        grantedRound: currentRound,
        activationRound: activationRound,
        expiresRound: activationRound + durationRounds - 1,
        slotId: slotId,
        effectId: String(effect.id || "")
      };
      state.temporaryTechniqueTags[targetSide] ||= {};
      state.temporaryTechniqueTags[targetSide][slotId] = entry;
      upsertDuelStatusEffect(target, {
        id: "customAtomicTechniqueTag:" + slotId,
        label: "复制术式：" + selectedTechnique.tag,
        value: 1,
        rounds: 999,
        triggerRound: activationRound,
        expiresRound: entry.expiresRound,
        category: "术式状态",
        displayOnly: true
      });
      invalidateTemporaryTechniqueDerivedState(battle, targetSide);
      recordCustomAtomicEvent(battle, targetSide, "获得临时术式标签：" + selectedTechnique.tag, { tag: selectedTechnique.tag, expiresRound: entry.expiresRound });
      return { tool: effect.tool, granted: true, tag: selectedTechnique.tag, activationRound: activationRound, expiresRound: entry.expiresRound, poolSize: selectedTechnique.pool.length };
    }
    if (effect.tool === "add_status") {
      var statusRounds = Math.max(1, Number(params.rounds || 1));
      if (options?.missed && params.applyOnMiss === true) {
        statusRounds = Math.max(1, Number(params.roundsOnMiss || statusRounds));
      } else if (params.opponentSelectedTag) {
        var selectedTagMatched = getCustomAtomicSelectedActions(battle, targetSide).some(function matchOpponentSelectionTag(action) {
          return customAtomicActionHasTag(action, params.opponentSelectedTag);
        });
        if (selectedTagMatched) statusRounds = Math.max(1, Number(params.roundsOnOpponentSelected || statusRounds));
      }
      var statusId = String(params.statusId || effect.id || "customAtomicStatus");
      var statusPayload = {
        id: statusId,
        label: String(params.label || "自定义状态"),
        value: Math.max(0, Number(params.value ?? 1)),
        rounds: statusRounds,
        outgoingScale: Math.max(0, Number(params.outgoingScale ?? 1)),
        appliesToTag: String(params.appliesToTag || ""),
        incomingHpScale: Math.max(0, Number(params.incomingHpScale ?? 1)),
        hitRateModifier: Number(params.hitRateModifier || 0),
        evasionBonus: Number(params.evasionBonus || 0),
        regenScale: params.regenScale == null ? undefined : Math.max(0, Number(params.regenScale)),
        cannotAct: params.cannotAct === true,
        removeOnReceiveDamage: params.removeOnReceiveDamage === true,
        stabilityImmune: params.stabilityImmune === true,
        category: target === actor ? "增益状态" : "减益状态"
      };
      // Preserve declarative, generic status metadata used by downstream
      // evasion/settlement rules.  These fields are intentionally opt-in and
      // do not alter the common status schema for unrelated cards.
      if (params.mythicalBeastAmberAoeFullDodge === true) statusPayload.mythicalBeastAmberAoeFullDodge = true;
      if (params.incomingCeScale != null) statusPayload.incomingCeScale = Math.max(0, Number(params.incomingCeScale));
      if (params.techniqueWeightScale != null) statusPayload.techniqueWeightScale = Math.max(0, Number(params.techniqueWeightScale));
      if (params.domainLoadScale != null) statusPayload.domainLoadScale = Math.max(0, Number(params.domainLoadScale));
      var activationDelayRounds = Math.max(0, Number(params.activationDelayRounds || 0));
      if (activationDelayRounds > 0) {
        statusPayload.triggerRound = Number(battle?.round || 0) + 1 + activationDelayRounds;
      }
      var expiresAfterRounds = Math.max(0, Number(params.expiresAfterRounds || 0));
      if (expiresAfterRounds > 0) {
        statusPayload.expiresRound = Number(battle?.round || 0) + 1 + expiresAfterRounds;
      } else if (params.durationStartsNextRound === true) {
        // The status is created after this turn's action, so its advertised
        // duration belongs to the following complete action rounds.  R66
        // performs CE regeneration (and legacy status ticking) before actions;
        // an explicit expiry prevents the final valid round from being removed
        // at that pre-action boundary.
        statusPayload.expiresRound = Number(battle?.round || 0) + 1 + statusRounds;
      }
      var stacking = String(params.stacking || "refresh");
      var existingStatus = findDuelStatusEffect(target, statusId);
      var addedStatus;
      if (existingStatus && stacking === "refresh") {
        Object.assign(existingStatus, statusPayload);
        addedStatus = existingStatus;
      } else {
        addedStatus = upsertDuelStatusEffect(target, statusPayload, { addValue: stacking === "add" });
      }
      return { tool: effect.tool, statusId: addedStatus?.id || "" };
    }
    if (effect.tool === "summon_group_action") {
      var actionOwner = String(params.owner || "self") === "opponent" ? opponent : actor;
      var actionTag = String(params.tag || "");
      var actionUnits = getDuelBattlefieldUnits(battle).filter(function selectGroupUnit(unit) {
        if (!unit?.active || String(unit.ownerSide || unit.side || "") !== String(actionOwner?.side || "")) return false;
        var tags = [].concat(unit.tags || [], unit.unitStats?.tags || []).map(String);
        if (actionTag && !tags.includes(actionTag)) return false;
        if (params.actionableOnly !== false && unit.cannotAct === true) return false;
        return Number(unit.currentHp ?? unit.hp ?? unit.unitStats?.currentHp ?? 0) > 0;
      }).sort(function stableSummonOrder(a, b) { return String(a.id || a.cardId || "").localeCompare(String(b.id || b.cardId || "")); });
      var attackTarget = effect.target === "self" || effect.target === "all-allies" ? actor : opponent;
      var attackResults = actionUnits.map(function applyGroupAttack(unit) {
        return callDependency("applyDuelStandardDamageToTarget", [{ type: "character", resource: attackTarget, id: attackTarget?.id || attackTarget?.side || "", name: attackTarget?.name || "目标", side: attackTarget?.side || "" }, Number(params.damage || unit.damage || unit.unitStats?.damage || 0), battle, { actor: actionOwner, opponent: attackTarget, sourceKind: "summon", sourceLabel: unit.name || unit.label || "召唤物", action: { id: effect.id || "summon_group_action", label: unit.name || "召唤物集合攻击", cardType: "attack" }, applyAttackerScales: true }]);
      });
      return { tool: effect.tool, tag: actionTag, count: actionUnits.length, results: attackResults };
    }
    if (effect.tool === "add_computed_status") {
      var computedStatusField = String(params.field || "incomingHpScale");
      var computedStatusValue = evaluateCustomAtomicFormula(params, actor, opponent, battle, options?.action);
      var computedStatusPayload = {
        id: String(params.statusId || effect.id || "customAtomicComputedStatus"),
        label: String(params.label || "动态状态"),
        value: computedStatusField === "value"
          ? Math.max(0, Number(computedStatusValue || 0))
          : Math.max(0, Number(params.value ?? 1)),
        rounds: Math.max(1, Number(params.rounds || 1)),
        category: target === actor ? "增益状态" : "减益状态"
      };
      if (["outgoingScale", "incomingHpScale", "hitRateModifier", "evasionBonus"].includes(computedStatusField)) {
        computedStatusPayload[computedStatusField] = computedStatusValue;
      }
      var computedActivationDelay = Math.max(0, Number(params.activationDelayRounds || 0));
      if (computedActivationDelay > 0) {
        computedStatusPayload.triggerRound = Number(battle?.round || 0) + 1 + computedActivationDelay;
      }
      var computedExpiresAfter = Math.max(0, Number(params.expiresAfterRounds || 0));
      if (computedExpiresAfter > 0) {
        computedStatusPayload.expiresRound = Number(battle?.round || 0) + 1 + computedExpiresAfter;
      }
      var computedExisting = findDuelStatusEffect(target, computedStatusPayload.id);
      var computedStacking = String(params.stacking || "refresh");
      var computedStatus;
      if (computedExisting && computedStacking === "refresh") {
        Object.assign(computedExisting, computedStatusPayload);
        computedStatus = computedExisting;
      } else {
        computedStatus = upsertDuelStatusEffect(target, computedStatusPayload, { addValue: computedStacking === "add" });
      }
      return { tool: effect.tool, statusId: computedStatus?.id || "", field: computedStatusField, value: computedStatusValue };
    }
    if (effect.tool === "require_status") {
      var requiredStatusId = String(params.statusId || "");
      var requiredStatus = findActiveCustomAtomicStatus(target, requiredStatusId, battle);
      if (requiredStatus && params.consumeAfterUse === true) {
        target.statusEffects = (target.statusEffects || []).filter(function keepRequiredStatus(status) {
          return status !== requiredStatus;
        });
      }
      return { tool: effect.tool, statusId: requiredStatusId, found: Boolean(requiredStatus), consumed: Boolean(requiredStatus && params.consumeAfterUse === true) };
    }
    if (effect.tool === "branch_on_value") {
      var branchCondition = { source: params.source || "round", operator: params.operator || ">=", threshold: Number(params.threshold || 0) };
      var branchMatched = passesCustomAtomicCondition(branchCondition, actor, opponent, battle, options?.action);
      state.branches ||= {};
      state.branches[effect.id || "custom_branch"] = { matched: branchMatched, round: Number(battle?.round || 0) + 1, condition: branchCondition };
      return { tool: effect.tool, matched: branchMatched, condition: branchCondition };
    }
    if (effect.tool === "register_counter_modifier") {
      var bindingCounterId = String(params.counterId || "custom_counter");
      var bindingModifierId = String(effect.id || params.modifierId || "customCounterModifier");
      state.counterModifiers[targetSide] ||= {};
      state.counterModifiers[targetSide][bindingModifierId] = {
        modifierId: bindingModifierId,
        namespace: String(params.namespace || ""),
        counterId: bindingCounterId,
        label: String(params.label || "计数器修正"),
        hook: String(params.hook || "persistent"),
        field: String(params.field || "incomingHpScale"),
        offset: Number(params.offset || 0),
        perCounter: Number(params.perCounter || 0),
        minimum: Number(params.minimum ?? 0),
        maximum: Number(params.maximum ?? 5),
        inactiveWhenZero: params.inactiveWhenZero !== false
      };
      var bindingSync = syncCustomAtomicCounterModifiers(battle, target, bindingCounterId);
      return { tool: effect.tool, namespace: params.namespace || "", counterId: bindingCounterId, modifierId: bindingModifierId, synced: bindingSync };
    }
    if (["set_counter", "adjust_counter", "consume_counter"].includes(effect.tool)) {
      var counterId = String(params.counterId || "custom_counter");
      var counterNamespace = String(params.namespace || "");
      if (counterNamespace) {
        var ratioAmount = Number(params.ratio || 0) * (String(params.basis || "") === "current" ? Number(target?.ce || 0) : Number(target?.maxCe || 0));
        if (params.amountSource === "actualResourceDelta" || params.basis === "actualResourceDelta") {
          var ledgerEntry = options?.atomicResourceLedger?.[String(params.resource || "ce")];
          // actualResourceDelta is an absolute, same-card payment basis.  It
          // must use the amount actually deducted by an earlier resource atom,
          // never the card's nominal cost or max-resource ratio a second time.
          ratioAmount = Number(params.ratio || 0) * Math.max(0, Number(ledgerEntry?.spent ?? (-Number(ledgerEntry?.delta || 0))));
        }
      var amountFromActualHp = params.amountSource === "actualHpStep"
          ? Math.floor(Math.max(0, Number(options?.hpCost || 0)) / Math.max(1, Number(params.step || 10)))
          : 0;
        var ceStep = Number(params.step || 1);
        if (ceStep > 0 && ceStep < 1) ceStep *= Math.max(1, Number(target?.maxCe || actor?.maxCe || 1));
        var amountFromActualCe = params.amountSource === "actualCeStep"
          ? Math.floor(Math.max(0, Number(options?.ceCost || 0)) / Math.max(1, ceStep))
          : 0;
        var adjustedAmount = Number(params.amount || 0) + ratioAmount + amountFromActualHp + amountFromActualCe;
        var counterOptions = {
          source: String(effect.id || "atomic-effect"),
          activationDelayRounds: Math.max(0, Number(params.activationDelayRounds || 0)),
          durationRounds: Math.max(0, Number(params.durationRounds || 0))
        };
        if (params.maxDelta !== undefined) counterOptions.maxDelta = Number(params.maxDelta || 0);
        var consumeAmount = params.amountSource === "counter"
          ? Math.min(Number(params.maxAmount ?? Infinity), Number(readDuelCounter(battle, targetSide, counterNamespace, counterId) || 0))
          : (params.amountSource === "actualHpStep"
            ? Math.floor(Math.max(0, Number(options?.hpCost || 0)) / Math.max(1, Number(params.step || 10)))
            : (params.amountSource === "actualCeStep"
              ? Math.floor(Math.max(0, Number(options?.ceCost || 0)) / Math.max(1, (Number(params.step || 1) < 1 ? Number(params.step || 1) * Math.max(1, Number(target?.maxCe || actor?.maxCe || 1)) : Number(params.step || 1))))
              : Math.max(1, Number(params.amount || 1))));
        var counterChange = effect.tool === "set_counter"
          ? setDuelCounter(battle, targetSide, counterNamespace, counterId, Number(params.value || 0), counterOptions)
          : (effect.tool === "adjust_counter"
            ? adjustDuelCounter(battle, targetSide, counterNamespace, counterId, adjustedAmount, counterOptions)
            : consumeDuelCounter(battle, targetSide, counterNamespace, counterId, consumeAmount, { ...counterOptions, allowPartial: false }));
        syncCustomAtomicCounterModifiers(battle, target, counterId);
        var settledCounterEntry = getDuelCounterPipeline().ensureCounter(battle, targetSide, counterNamespace, counterId);
        updateCustomAtomicCounterStatus(target, settledCounterEntry);
        return {
          tool: effect.tool,
          namespace: counterNamespace,
          counterId: counterId,
          value: Number(counterChange?.after ?? readDuelCounter(battle, targetSide, counterNamespace, counterId)),
          ok: counterChange?.ok !== false
        };
      }
      state.counters[targetSide] ||= {};
      var previous = state.counters[targetSide][counterId] || { id: counterId, label: String(params.label || "自定义层数"), value: 0, max: Math.max(1, Number(params.max || 999)) };
      var ratioAmount = Number(params.ratio || 0) * (String(params.basis || "") === "current" ? Number(target?.ce || 0) : Number(target?.maxCe || 0));
      var nextValue = effect.tool === "set_counter"
        ? Number(params.value || 0)
        : Number(previous.value || 0) + (effect.tool === "consume_counter" ? -(params.amountSource === "counter" ? Number(previous.value || 0) : Math.max(1, Number(params.amount || 1))) : Number(params.amount || 0) + ratioAmount);
      previous.value = clamp(nextValue, 0, Math.max(1, Number(params.max || previous.max || 999)));
      previous.max = Math.max(1, Number(params.max || previous.max || 999));
      previous.label = String(params.label || previous.label || "自定义层数");
      if (effect.tool !== "consume_counter") {
        var counterActivationDelay = Math.max(0, Number(params.activationDelayRounds || 0));
        var counterDurationRounds = Math.max(0, Number(params.durationRounds || 0));
        previous.activationRound = Number(battle?.round || 0) + 1 + counterActivationDelay;
        previous.expiresRound = counterDurationRounds > 0
          ? previous.activationRound + counterDurationRounds - 1
          : 0;
      }
      state.counters[targetSide][counterId] = previous;
      updateCustomAtomicCounterStatus(target, previous);
      syncCustomAtomicCounterModifiers(battle, target, counterId);
      return { tool: effect.tool, counterId: counterId, value: previous.value };
    }
    if (effect.tool === "remove_status") {
      target.statusEffects = (target.statusEffects || []).filter(function keepStatus(status) { return status?.id !== String(params.statusId || ""); });
      return { tool: effect.tool, statusId: params.statusId };
    }
    if (effect.tool === "modify_status") {
      var existingStatus = (target.statusEffects || []).find(function findStatus(status) { return status?.id === String(params.statusId || ""); });
      if (existingStatus) {
        existingStatus.value = Math.max(0, Number(existingStatus.value || 0) + Number(params.amount || 0));
        existingStatus.rounds = Math.max(Number(existingStatus.rounds || 1), Number(params.rounds || 1));
      }
      return { tool: effect.tool, statusId: params.statusId, found: Boolean(existingStatus) };
    }
    if (effect.tool === "schedule_effect") {
      var timer = {
        id: String(params.timerId || effect.id || "custom_timer"),
        ownerSide: actor?.side || "left",
        target: effect.target || "self",
        triggerRound: Number(battle?.round || 0) + 1 + Math.max(1, Number(params.delayRounds || 1)),
        effect: {
          id: String(params.timerId || effect.id || "custom_timer") + ":payload",
          tool: String(params.scheduledTool || "emit_battle_event"),
          target: effect.target || "self",
          params: params.scheduledTool === "adjust_resource"
            ? { resource: String(params.resource || "hp"), amount: Number(params.amount || 0) }
            : (params.scheduledTool === "add_status"
              ? { statusId: String(params.resource || "custom_status"), label: String(params.label || "预约状态"), value: Number(params.amount || 1), rounds: 2 }
              : { eventId: String(params.timerId || "custom_event"), label: String(params.label || "预约效果发动") })
        }
      };
      state.timers = state.timers.filter(function keepTimer(existing) { return !(existing.id === timer.id && existing.ownerSide === timer.ownerSide); });
      state.timers.push(timer);
      upsertDuelStatusEffect(actor, {
        id: "customAtomicTimer:" + timer.id,
        label: String(params.label || timer.id || "预约效果") + "（" + Math.max(1, Number(params.delayRounds || 1)) + "回合）",
        value: Math.max(1, Number(params.delayRounds || 1)),
        rounds: 999,
        category: "倒计时",
        displayOnly: true
      });
      return { tool: effect.tool, timerId: timer.id, triggerRound: timer.triggerRound };
    }
    if (effect.tool === "advance_timer" || effect.tool === "cancel_timer") {
      var timerId = String(params.timerId || "custom_timer");
      if (effect.tool === "cancel_timer") {
        state.timers = state.timers.filter(function keepTimer(timer) { return !(timer.id === timerId && timer.ownerSide === (actor?.side || "left")); });
        actor.statusEffects = (actor.statusEffects || []).filter(function keepStatus(status) { return status?.id !== "customAtomicTimer:" + timerId; });
      } else {
        state.timers.forEach(function advance(timer) {
          if (timer.id !== timerId || timer.ownerSide !== (actor?.side || "left")) return;
          timer.triggerRound -= Math.max(1, Number(params.amount || 1));
          var remaining = Math.max(0, Number(timer.triggerRound || 0) - (Number(battle?.round || 0) + 1));
          upsertDuelStatusEffect(actor, { id: "customAtomicTimer:" + timerId, label: timerId + "（" + remaining + "回合）", value: remaining, rounds: 999, category: "倒计时", displayOnly: true });
        });
      }
      return { tool: effect.tool, timerId: timerId };
    }
    if (effect.tool === "grant_card") {
      var card = getDuelCardTemplateByCardId(String(params.cardId || ""));
      return { tool: effect.tool, cardId: params.cardId, granted: Boolean(card && injectDuelGeneratedHandCard(battle, targetSide, card, { id: effect.id })) };
    }
    if (effect.tool === "discard_card") {
      var discardInstanceId = String(params.cardInstanceId || "");
      if (!discardInstanceId) return { tool: effect.tool, discarded: false, reason: "cardInstanceId-required" };
      var discardHand = battle.handState?.[targetSide];
      var discardIndex = (discardHand?.cards || []).findIndex(function findDiscardInstance(card) {
        return String(card?.cardInstanceId || "") === discardInstanceId;
      });
      if (discardIndex < 0) return { tool: effect.tool, discarded: false, reason: "cardInstanceId-not-in-hand", cardInstanceId: discardInstanceId };
      var discardCandidate = discardHand.cards[discardIndex];
      if (discardCandidate?.retainedPermanent === true || discardCandidate?.permanent === true) {
        return { tool: effect.tool, discarded: false, reason: "permanent-card", cardInstanceId: discardInstanceId };
      }
      var discardedCard = discardHand.cards.splice(discardIndex, 1)[0];
      var discardSummary = {
        actionId: String(discardedCard?.actionId || discardedCard?.cardId || discardedCard?.id || ""),
        cardInstanceId: discardInstanceId,
        label: String(discardedCard?.label || discardedCard?.name || discardedCard?.id || "手牌"),
        discardedRound: Number(battle?.round || 0),
        reason: "atomic-discard-card",
        sourceEffectId: String(effect.id || "")
      };
      discardHand.lastDiscarded = [discardSummary];
      discardHand.discardPile = (discardHand.discardPile || []).concat(discardSummary);
      global.JJKDuelHand?.invalidateDuelHandCandidateCache?.(battle);
      return { tool: effect.tool, discarded: true, cardInstanceId: discardInstanceId, actionId: discardSummary.actionId };
    }
    if (effect.tool === "remove_card" || effect.tool === "transform_card") {
      var hand = battle.handState?.[targetSide];
      var cardId = String(params.cardId || "");
      var beforeCount = hand?.cards?.length || 0;
      if (hand) hand.cards = (hand.cards || []).filter(function keepCard(card) { return ![card.id, card.actionId, card.cardId].map(String).includes(cardId); });
      if (effect.tool === "transform_card") {
        var replacement = getDuelCardTemplateByCardId(String(params.replacementCardId || ""));
        if (replacement) injectDuelGeneratedHandCard(battle, targetSide, replacement, { id: effect.id });
      }
      return { tool: effect.tool, cardId: cardId, removed: beforeCount - Number(hand?.cards?.length || 0) };
    }
    if (["update_summon", "destroy_summon", "recall_summon"].includes(effect.tool)) {
      var selectedUnits = String(params.selectorTag || "").trim()
        ? getDuelBattlefieldUnits(battle).filter(function selectTaggedUnit(unit) {
          if (!unit?.active || String(unit.ownerSide || unit.side || "") !== String(target?.side || "")) return false;
          return [].concat(unit.tags || [], unit.unitStats?.tags || []).map(String).includes(String(params.selectorTag));
        })
        : [findCustomAtomicSummon(battle, target, params.summonId)].filter(Boolean);
      var unit = selectedUnits[0];
      if (selectedUnits.length && effect.tool === "update_summon") {
        selectedUnits.forEach(function updateSelectedUnit(unit) {
        var nextUnitHp = clamp(Number(unit.currentHp ?? unit.hp ?? 0) + Number(params.hpDelta || 0), 0, Number(unit.maxHp || unit.unitStats?.maxHp || 99999));
        unit.hp = nextUnitHp;
        if (unit.currentHp !== undefined) unit.currentHp = nextUnitHp;
        if (unit.unitStats?.currentHp !== undefined) unit.unitStats.currentHp = nextUnitHp;
        unit.damage = Math.max(0, Number(unit.damage || 0) + Number(params.attackDelta || 0));
        unit.unitStats ||= {};
        var nextUnitBlock = Math.max(0, Number(unit.block ?? unit.unitStats.block ?? 0) + Number(params.defenseDelta || 0));
        unit.unitStats.block = nextUnitBlock;
        unit.block = nextUnitBlock;
        });
      } else if (selectedUnits.length) {
        selectedUnits.forEach(function removeSelectedUnit(unit) {
        unit.active = false;
        unit.hp = 0;
        if (unit.currentHp !== undefined) unit.currentHp = 0;
        if (unit.unitStats?.currentHp !== undefined) unit.unitStats.currentHp = 0;
        unit.removedReason = effect.tool === "recall_summon" ? "custom-atomic-recall" : "custom-atomic-destroy";
        });
      }
      return { tool: effect.tool, summonId: params.summonId, selectorTag: params.selectorTag || "", found: Boolean(selectedUnits.length), count: selectedUnits.length };
    }
    if (effect.tool === "delegate_control") {
      var requestedControllerSide = String(params.controllerSide || "self");
      var controllerSide = requestedControllerSide === "opponent"
        ? (opponent?.side || (actor?.side === "left" ? "right" : "left"))
        : (requestedControllerSide === "neutral" ? "neutral" : (actor?.side || "left"));
      state.delegations[targetSide] = {
        controllerSide: controllerSide,
        expiresRound: Number(battle?.round || 0) + Math.max(1, Number(params.rounds || 1)),
        sourceEffectId: effect.id || ""
      };
      upsertDuelStatusEffect(target, { id: "customAtomicDelegation", label: "控制权委托", value: 1, rounds: Math.max(1, Number(params.rounds || 1)), category: "规则状态" });
      return { tool: effect.tool, delegation: { ...state.delegations[targetSide] } };
    }
    if (effect.tool === "end_delegation") {
      delete state.delegations[targetSide];
      target.statusEffects = (target.statusEffects || []).filter(function keepStatus(status) { return status?.id !== "customAtomicDelegation"; });
      return { tool: effect.tool };
    }
    if (effect.tool === "set_combat_range") {
      var nextRange = String(params.range || "medium").trim().toLowerCase();
      var allowedRanges = new Set(["close", "medium", "far"]);
      if (!allowedRanges.has(nextRange)) nextRange = "medium";
      var fromRange = getExplicitDuelDistanceRange(battle, actor, opponent) || String(battle?.distanceState?.range || "unknown");
      var clearStatusIds = Array.isArray(params.clearStatusIds)
        ? params.clearStatusIds.map(String)
        : String(params.clearStatusIds || "").split(",").map(function trimStatusId(id) { return id.trim(); }).filter(Boolean);
      var clearSet = new Set(clearStatusIds);
      var clearedStatusIds = [];
      target.statusEffects = (Array.isArray(target.statusEffects) ? target.statusEffects : []).filter(function clearRangeStatus(status) {
        var statusId = String(status?.id || "");
        if (!clearSet.has(statusId)) return true;
        clearedStatusIds.push(statusId);
        return false;
      });
      battle.distanceState = {
        range: nextRange,
        changedRound: getDuelActionTurnNumber(battle),
        sourceActionId: options?.action?.id || options?.action?.actionId || effect.id || "",
        sourceSide: actor?.side || "left"
      };
      battle.engagementRange = nextRange;
      battle.combatRange = nextRange;
      return {
        tool: effect.tool,
        fromRange: fromRange,
        toRange: nextRange,
        clearedStatusIds: uniqueFeatureList(clearedStatusIds)
      };
    }
    if (effect.tool === "emit_battle_event") {
      var eventId = String(params.eventId || effect.id || "custom_event");
      if (eventId === "instant_victory" && actor?.side) {
        battle.winnerSide = actor.side;
        battle.endReason = String(params.endReason || "atomic_instant_victory");
      }
      return { tool: effect.tool, event: recordCustomAtomicEvent(battle, targetSide, params.label || "特殊效果发动", { eventId: eventId, winnerSide: battle.winnerSide || "" }) };
    }
    return { tool: effect.tool, stored: true };
  }

  function settleCustomAtomicDelegations(actor, opponent, battle) {
    var state = getCustomAtomicState(battle);
    var currentRound = Number(battle?.round || 0) + 1;
    Object.keys(state.delegations || {}).forEach(function expireDelegation(side) {
      var delegation = state.delegations[side];
      if (Number(delegation?.expiresRound || 0) >= currentRound) return;
      delete state.delegations[side];
      var resource = actor?.side === side ? actor : (opponent?.side === side ? opponent : null);
      if (resource) resource.statusEffects = (resource.statusEffects || []).filter(function keepStatus(status) { return status?.id !== "customAtomicDelegation"; });
    });
    return state.delegations;
  }

  function getCustomAtomicControllerSide(battle, side) {
    var state = getCustomAtomicState(battle);
    var delegation = state?.delegations?.[side];
    var currentRound = Number(battle?.round || 0) + 1;
    if (!delegation || Number(delegation.expiresRound || 0) < currentRound) return side;
    return delegation.controllerSide || side;
  }

  function queueCustomAtomicTurnEndEffects(runtime, actor, opponent, battle, options) {
    if (!runtime?.turnEnd?.length) return [];
    var state = getCustomAtomicState(battle);
    return runtime.turnEnd.map(function queueEffect(effect) {
      if ((effect.target === "opponent" || effect.target === "all-enemies") && options?.missed && effect?.params?.applyOnMiss !== true) {
        return { id: effect.id || "", tool: effect.tool, queued: false, skipped: true, reason: "missed" };
      }
      var queued = {
        id: String(effect.id || effect.tool || "custom_turn_end"),
        ownerSide: actor?.side || "left",
        queuedRound: Number(battle?.round || 0) + 1,
        effect: { ...effect, params: { ...(effect.params || {}) } }
      };
      state.turnEndEffects.push(queued);
      return { id: queued.id, tool: effect.tool, queued: true, timing: "turn-end" };
    });
  }

  function settleCustomAtomicTurnEndEffects(actor, opponent, battle) {
    var state = getCustomAtomicState(battle);
    if (!state?.turnEndEffects?.length) return [];
    var ownerSide = actor?.side || "left";
    var due = state.turnEndEffects.filter(function isDue(entry) { return entry.ownerSide === ownerSide; });
    state.turnEndEffects = state.turnEndEffects.filter(function keepEntry(entry) { return entry.ownerSide !== ownerSide; });
    return due.map(function settleEntry(entry) {
      var result = applyCustomAtomicPostOperation(entry.effect, actor, opponent, battle, { missed: false, timing: "turn-end" });
      recordCustomAtomicEvent(battle, ownerSide, `回合结束效果「${entry.id}」发动。`, { effectId: entry.id, tool: entry.effect?.tool || "" });
      return { id: entry.id, tool: entry.effect?.tool || "", result: result };
    });
  }

  function settleCustomAtomicTimers(actor, opponent, battle) {
    var state = getCustomAtomicState(battle);
    settleCustomAtomicDelegations(actor, opponent, battle);
    if (!state?.timers?.length) return [];
    var round = Number(battle?.round || 0) + 1;
    var due = state.timers.filter(function isDue(timer) { return Number(timer.triggerRound || 0) <= round; });
    state.timers = state.timers.filter(function keepTimer(timer) { return Number(timer.triggerRound || 0) > round; });
    return due.map(function settleTimer(timer) {
      var owner = timer.ownerSide === actor?.side ? actor : opponent;
      var other = owner === actor ? opponent : actor;
      if (owner) owner.statusEffects = (owner.statusEffects || []).filter(function keepStatus(status) { return status?.id !== "customAtomicTimer:" + timer.id; });
      var result = applyCustomAtomicPostOperation(timer.effect, owner, other, battle, { missed: false, timer: true });
      recordCustomAtomicEvent(battle, timer.ownerSide, `预约效果「${timer.id}」发动。`, { timerId: timer.id });
      return { timerId: timer.id, result: result };
    });
  }

  function applyCustomAtomicPostRuntime(runtime, actor, opponent, battle, options) {
    if (!runtime) return [];
    var triggerState = getCustomAtomicState(battle);
    [
      ["turnStart", "turn-start"],
      ["beforeReceiveDamage", "before-receive-damage"],
      ["afterReceiveDamage", "after-receive-damage"],
      ["summonDefeated", "summon-defeated"],
      ["shieldBroken", "shield-broken"]
    ].forEach(function registerRuntimeTrigger(pair) {
      var effects = runtime[pair[0]] || [];
      effects.forEach(function registerEffect(effect) {
        triggerState.triggerEffects[pair[1]].push({ effect: effect, ownerSide: actor?.side || "left" });
      });
    });
    var triggered = options?.missed ? (runtime.onMiss || []) : (runtime.onHit || []);
    var results = triggered.concat(runtime.post || []).map(function applyOperation(effect) {
      return { id: effect.id || "", tool: effect.tool, result: applyCustomAtomicPostOperation(effect, actor, opponent, battle, options) };
    });
    results.push(...queueCustomAtomicTurnEndEffects(runtime, actor, opponent, battle, options));
    settleCustomAtomicTimers(actor, opponent, battle);
    return results;
  }

  function dispatchCustomAtomicTrigger(trigger, actor, opponent, battle, options) {
    expireCustomAtomicBarriers(battle);
    var state = getCustomAtomicState(battle);
    var queue = state?.triggerEffects?.[trigger] || [];
    if (!queue.length) return [];
    state.triggerEffects[trigger] = [];
    return queue.map(function dispatch(entry) {
      var owner = entry.ownerSide === actor?.side ? actor : (entry.ownerSide === opponent?.side ? opponent : actor);
      var other = owner === actor ? opponent : actor;
      var result = applyCustomAtomicPostOperation(entry.effect, owner, other, battle, { ...(options || {}), trigger: trigger });
      if (entry.effect?.tool === "modify_damage" && options && options.amount != null) {
        options.amount = Math.max(0, Number(options.amount) * Math.max(0, Number(entry.effect?.params?.multiplier ?? 1)) + Number(entry.effect?.params?.flat || 0));
      }
      return { id: entry.effect?.id || "", tool: entry.effect?.tool || "", result: result };
    });
  }

  function expireCustomAtomicBarriers(battle) {
    var state = getCustomAtomicState(battle);
    if (!state?.barriers) return;
    var currentTurn = Number(battle?.round || 0) + 1;
    ["left", "right"].forEach(function expireSide(side) {
      state.barriers[side] = (state.barriers[side] || []).filter(function keepBarrier(barrier) {
        return Number(barrier.createdRound || currentTurn) + Math.max(1, Number(barrier.rounds || 1)) > currentTurn && Number(barrier.value || 0) > 0;
      });
    });
  }

  function ensureBloodConversionAtomicResourceGain(runtime, action) {
    if (!runtime || !action?.bloodConversion) return;
    var exists = (runtime.post || []).some(function hasBloodGain(effect) {
      return effect?.tool === "adjust_counter" && String(effect.params?.namespace || "") === "blood_manipulation" && String(effect.params?.counterId || "") === "blood";
    });
    if (exists) return;
    runtime.post ||= [];
    runtime.post.push({
      schema: "jjk.atomic-effect.v2",
      id: "blood-conversion-resource-gain",
      tool: "adjust_counter",
      trigger: "post-damage",
      target: "self",
      when: [],
      params: action.bloodConversion === "ce_to_hp"
        ? { namespace: "blood_manipulation", counterId: "blood", label: "血", amountSource: "actualCeStep", step: 0.08, max: BLOOD_MANIPULATION_BLOOD_MAX }
        : { namespace: "blood_manipulation", counterId: "blood", label: "血", amountSource: "actualHpStep", step: 10, max: BLOOD_MANIPULATION_BLOOD_MAX }
    });
  }

  function getDuelProfileForSide(battle, side) {
    if (side === "left" && battle?.left) return battle.left;
    if (side === "right" && battle?.right) return battle.right;
    var dependency = getOptionalDependency("getDuelProfileForSide");
    if (dependency && dependency !== getDuelProfileForSide) return dependency(battle, side);
    return null;
  }

  function isDirectBattleCard(action) {
    // The strict direct-card schema always carries its coefficient object.
    // Legacy runtime card templates also expose effect/cost/contexts, but do
    // not carry `scaling`; sending those through calculateBattleCardSettlement
    // deliberately returns the safe zero fallback and used to erase all
    // common-card damage.
    return Boolean(
      action &&
      action.effect &&
      action.cost &&
      Array.isArray(action.contexts) &&
      action.scaling &&
      typeof action.scaling === "object"
    );
  }

  function applyDirectBattleEffectScale(effects, actionPatch, operation) {
    var stage = String(operation?.stage || "");
    var stacking = String(operation?.stacking || "replace");
    var value = finiteDuelNumber(operation?.value, stage === "blockIgnore" ? 0 : 1);
    var effectKey = {
      outgoing: "outgoingScale",
      incomingHp: "incomingHpScale",
      incomingCe: "incomingCeScale",
      sureHit: "sureHitScale",
      domainPressure: "domainPressureScale",
      domainLoad: "domainLoadScale",
      cardOutput: "damageScale"
    }[stage];
    if (stage === "blockIgnore") {
      var currentIgnore = finiteDuelNumber(actionPatch.blockIgnoreRatio, 0);
      actionPatch.blockIgnoreRatio = stacking === "add"
        ? currentIgnore + value
        : (stacking === "max" ? Math.max(currentIgnore, value) : value);
      actionPatch.blockIgnoreRatio = clamp(actionPatch.blockIgnoreRatio, 0, 0.95);
      return;
    }
    if (stage === "evasion") {
      effects.evasionBonus = finiteDuelNumber(effects.evasionBonus, 0) + value;
      return;
    }
    if (stage === "hitRate") {
      actionPatch.hitRateModifier = finiteDuelNumber(actionPatch.hitRateModifier, 0) + value;
      return;
    }
    if (stage === "ceRegen") {
      if (operation?.target === "opponent") {
        effects.opponentRegenInterference = Math.max(finiteDuelNumber(effects.opponentRegenInterference, 0), clamp(1 - value, 0, 1));
      } else {
        effects.selfCeRegenBoost = Math.max(finiteDuelNumber(effects.selfCeRegenBoost, 0), Math.max(0, value - 1));
      }
      return;
    }
    if (stage === "rangeAdjustment") {
      effects.rangeAdjustment = Boolean(value);
      effects.rangeAdjustmentDamageScale = finiteDuelNumber(operation?.rangeAdjustmentDamageScale, 0.6);
      return;
    }
    if (!effectKey) return;
    if (effects[effectKey] === undefined || effects[effectKey] === null) {
      effects[effectKey] = value;
      return;
    }
    var current = finiteDuelNumber(effects[effectKey], 1);
    if (stacking === "multiply") effects[effectKey] = current * value;
    else if (stacking === "add") effects[effectKey] = current + value;
    else if (stacking === "max") effects[effectKey] = Math.max(current, value);
    else effects[effectKey] = value;
  }

  function buildDirectBattleRuntimeEffects(card) {
    var effects = { ...(card?.effect || {}) };
    // Only cards whose declared role is defensive convert their block preview
    // into incoming-damage mitigation. Attack/support block values still feed
    // their own authored mechanics, but no longer grant an undisclosed guard.
    // Summon cards reuse `effect.block` to derive unit durability; treating
    // that same number as an extra shield on the summoner created an
    // undisclosed defense stack every time a unit entered play.
    var directCardRole = String(card?.type || card?.cardType || "").toLowerCase();
    var directCardTags = toFeatureList(card?.tags).map(function normalizeDirectDefenseTag(tag) { return String(tag || "").toLowerCase(); });
    var isDeclaredDefenseCard = directCardRole === "defense" || directCardTags.includes("defense") || directCardTags.includes("防御") || directCardTags.includes("guard");
    if (isDeclaredDefenseCard && finiteDuelNumber(card?.effect?.block, 0) > 0 && !card?.summon?.unitId) effects.blockToIncomingScale = true;
    var actionPatch = {};
    var authoredAtomicOperations = Array.isArray(card?.effect?.special?.atomicEffects)
      ? card.effect.special.atomicEffects
      : [];
    authoredAtomicOperations.forEach(function mapAuthoredAtomicCompatibilityOperation(effect) {
      if (!effect || typeof effect !== "object") return;
      var params = effect.params && typeof effect.params === "object" ? effect.params : {};
      var target = effect.target === "opponent" ? "opponent" : "self";
      if (effect.tool === "modify_scale") {
        applyDirectBattleEffectScale(effects, actionPatch, { ...params, target: target });
        return;
      }
      if (effect.tool === "modify_weight" && params.family) {
        var weightKey = target === "opponent" ? "opponentWeightDeltas" : "weightDeltas";
        effects[weightKey] = { ...(effects[weightKey] || {}) };
        effects[weightKey][params.family] = finiteDuelNumber(effects[weightKey][params.family], 0) + finiteDuelNumber(params.delta, 0);
        return;
      }
      if (effect.tool === "adjust_action_resource") {
        var amount = finiteDuelNumber(params.amount, 0);
        if (params.resource === "incomingHpReductionCap" && target === "self") {
          effects.incomingHpReductionCap = finiteDuelNumber(effects.incomingHpReductionCap, 0) + amount;
        } else if (params.resource === "incomingHpReductionCapFromBloodHpCost" && target === "self") {
          effects.incomingHpReductionCapFromBloodHpCostMultiplier = finiteDuelNumber(effects.incomingHpReductionCapFromBloodHpCostMultiplier, 0) + amount;
        } else if (params.resource === "evidencePressure") {
          effects.evidencePressureDelta = finiteDuelNumber(effects.evidencePressureDelta, 0) + amount;
        } else if (params.resource === "defensePressure") {
          effects.defensePressureDelta = finiteDuelNumber(effects.defensePressureDelta, 0) + amount;
        } else if (params.resource === "jackpotGauge") {
          effects.jackpotGaugeDelta = finiteDuelNumber(effects.jackpotGaugeDelta, 0) + amount;
        }
        return;
      }
      if (effect.tool === "unlock_card_pool") {
        var cardIds = Array.isArray(params.cardIds)
          ? params.cardIds
          : String(params.cardIds || "").split(",").map(function trimUnlockedCardId(value) { return value.trim(); }).filter(Boolean);
        if (card?.summon?.unitId && cardIds.length) {
          effects.grantHandCardsOnSummon = uniqueFeatureList([].concat(effects.grantHandCardsOnSummon || [], cardIds));
        }
        if (params.pool === "specialHand") {
          effects.rikaArsenalNextTurnSpecialHand = true;
          effects.rikaArsenalFreeUse = params.freeUse === true;
        }
      }
    });
    var operations = Array.isArray(card?.effect?.effects) ? card.effect.effects : [];
    var reusableAtomicEffects = [];
    var migratedOperationIndexes = new Set();
    operations.forEach(function migrateReusableLegacyOperation(operation, index) {
      if (!operation || operation.op !== "modifyResource" || operation.resource !== "hpCost" || operation.target === "opponent") return;
      reusableAtomicEffects.push({
        id: "legacy-hp-cost-" + String(card?.id || card?.cardId || index),
        tool: "pay_hp_cost",
        timing: "pre-damage",
        target: "self",
        params: {
          amount: Math.max(0, finiteDuelNumber(operation.delta ?? operation.value, 0)),
          ratio: Math.max(0, finiteDuelNumber(operation.ratio, 0)),
          nonlethal: operation.nonlethal !== false
        }
      });
      migratedOperationIndexes.add(index);
    });
    operations.forEach(function mapDirectEffectOperation(operation, operationIndex) {
      if (!operation || typeof operation !== "object") return;
      if (migratedOperationIndexes.has(operationIndex)) return;
      var target = operation.target === "opponent" ? "opponent" : "self";
      if (operation.op === "addStatus" && operation.status) {
        var status = {
          ...operation.status,
          id: operation.status.id || operation.statusId || "directCardStatus",
          rounds: Math.max(1, Number(operation.status.rounds || operation.duration || 1))
        };
        var statusKey = target === "opponent" ? "opponentStatuses" : "selfStatuses";
        effects[statusKey] = (effects[statusKey] || []).concat([status]);
        return;
      }
      if (operation.op === "modifyWeight" && operation.family) {
        var weightKey = target === "opponent" ? "opponentWeightDeltas" : "weightDeltas";
        effects[weightKey] = { ...(effects[weightKey] || {}) };
        effects[weightKey][operation.family] = finiteDuelNumber(effects[weightKey][operation.family], 0) + finiteDuelNumber(operation.delta, 0);
        return;
      }
      if (operation.op === "modifyScale") {
        applyDirectBattleEffectScale(effects, actionPatch, operation);
        return;
      }
      if (operation.op === "modifyResource") {
        var delta = finiteDuelNumber(operation.delta ?? operation.value, 0);
        if (operation.resource === "angelPurification") {
          var angelOwnerTags = [].concat(card?.tags || [], card?.matchTags || []).map(function normalizeAngelTag(tag) { return String(tag || "").toLowerCase(); });
          if (!angelOwnerTags.includes("angel_technique") && !angelOwnerTags.includes("jacobs_ladder")) {
            throw new Error("非天使术式卡牌禁止写入净化层数：" + String(card?.id || "unknown-card"));
          }
          var counterKey = target === "opponent" ? "opponentCounterOperations" : "selfCounterOperations";
          effects[counterKey] = (effects[counterKey] || []).concat([{
            namespace: "angel_extinguishment",
            counterId: "purification",
            label: "净化层数",
            delta: delta,
            min: 0,
            max: 5,
            format: "number"
          }]);
        } else if (operation.resource === "stability") {
          var stabilityKey = target === "opponent" ? "opponentStabilityDelta" : "stabilityDelta";
          effects[stabilityKey] = finiteDuelNumber(effects[stabilityKey], 0) + delta;
        } else if (operation.resource === "domainLoad") {
          var domainKey = target === "opponent" ? "opponentDomainLoadDelta" : "domainLoadDelta";
          effects[domainKey] = finiteDuelNumber(effects[domainKey], 0) + delta;
        } else if (operation.resource === "ce" && target === "self" && delta > 0) {
          effects.selfCeRestoreFlat = finiteDuelNumber(effects.selfCeRestoreFlat, 0) + delta;
        } else if (operation.resource === "incomingHpReductionCap" && target === "self") {
          effects.incomingHpReductionCap = finiteDuelNumber(effects.incomingHpReductionCap, 0) + delta;
        } else if (operation.resource === "incomingHpReductionCapFromBloodHpCost" && target === "self") {
          effects.incomingHpReductionCapFromBloodHpCostMultiplier = finiteDuelNumber(effects.incomingHpReductionCapFromBloodHpCostMultiplier, 0) + delta;
        } else if (operation.resource === "hpCost" && target === "self") {
          effects.selfHpCostFlat = finiteDuelNumber(effects.selfHpCostFlat, 0) + Math.max(0, delta);
          effects.selfHpCostRatio = finiteDuelNumber(effects.selfHpCostRatio, 0) + Math.max(0, finiteDuelNumber(operation.ratio, 0));
          if (operation.nonlethal) effects.selfHpCostNonlethal = true;
        } else if (operation.resource === "evidencePressure") {
          effects.evidencePressureDelta = finiteDuelNumber(effects.evidencePressureDelta, 0) + delta;
        } else if (operation.resource === "defensePressure") {
          effects.defensePressureDelta = finiteDuelNumber(effects.defensePressureDelta, 0) + delta;
        } else if (operation.resource === "jackpotGauge") {
          effects.jackpotGaugeDelta = finiteDuelNumber(effects.jackpotGaugeDelta, 0) + delta;
        }
        return;
      }
      if (operation.op === "unlockCard") {
        if (operation.sourceField) {
          var sourceKey = String(operation.sourceField).split(".").filter(Boolean).pop();
          if (sourceKey) effects[sourceKey] = true;
        }
        if (card?.summon?.unitId && Array.isArray(operation.cardIds) && operation.cardIds.length) {
          effects.grantHandCardsOnSummon = uniqueFeatureList([].concat(effects.grantHandCardsOnSummon || [], operation.cardIds));
        }
      }
    });
    if (card?.effect?.special?.effects && typeof card.effect.special.effects === "object" && !Array.isArray(card.effect.special.effects)) {
      effects = { ...effects, ...card.effect.special.effects };
    }
    return { effects: effects, actionPatch: actionPatch, operations: operations.slice(), reusableAtomicEffects: reusableAtomicEffects };
  }

  function prepareDirectBattleDomainActionRuntime(card, effects) {
    var resolver = global.JJKBattleDataDirect?.resolveBattleCardDomainActionRuntime;
    var sourceState = dependencies.state || {};
    var runtime = typeof resolver === "function"
      ? resolver(card, sourceState.battleDomains || sourceState.duelDomainProfiles || {})
      : null;
    if (!runtime) return null;
    effects.domainLoadDelta = finiteDuelNumber(effects.domainLoadDelta, 0) + finiteDuelNumber(runtime.domainLoadDelta, 0);
    effects.jackpotGaugeDelta = finiteDuelNumber(effects.jackpotGaugeDelta, 0) + finiteDuelNumber(runtime.jackpotGaugeDelta, 0);
    effects.jackpotRoundDelta = finiteDuelNumber(effects.jackpotRoundDelta, 0) + finiteDuelNumber(runtime.jackpotRoundDelta, 0);
    if (runtime.jackpotProgress) effects.jackpotProgress = true;
    if (runtime.claimJackpot) effects.claimJackpot = true;
    if (runtime.selfStatus?.id) effects.selfStatuses = [].concat(effects.selfStatuses || [], [{ ...runtime.selfStatus }]);
    if (runtime.opponentStatus?.id) effects.opponentStatuses = [].concat(effects.opponentStatuses || [], [{ ...runtime.opponentStatus }]);
    effects.weightDeltas = { ...(effects.weightDeltas || {}) };
    Object.entries(runtime.weightDeltas || {}).forEach(function addDomainActionWeight(entry) {
      effects.weightDeltas[entry[0]] = finiteDuelNumber(effects.weightDeltas[entry[0]], 0) + finiteDuelNumber(entry[1], 0);
    });
    return runtime;
  }

  function applyDirectBattleCounterOperations(operations, battle, target) {
    if (!battle || !target || !Array.isArray(operations) || !operations.length) return [];
    return operations.map(function applyDirectCounterOperation(operation) {
      var pipeline = getDuelCounterPipeline();
      var side = target.side || "left";
      var namespaceName = String(operation.namespace || "direct_card");
      var counterId = String(operation.counterId || "value");
      if (typeof pipeline.isRegisteredCounter !== "function" || !pipeline.isRegisteredCounter(namespaceName, counterId)) {
        throw new Error("直接卡牌尝试写入未登记计数器：" + namespaceName + ":" + counterId);
      }
      return {
        namespace: namespaceName,
        counterId: counterId,
        ...pipeline.adjustCounter(battle, side, namespaceName, counterId, Number(operation.delta || 0), {
          label: operation.label || counterId,
          min: operation.min ?? 0,
          max: operation.max,
          format: operation.format || "number",
          source: "direct-battle-card"
        })
      };
    });
  }

  function getDirectBattleSummonZone(card) {
    var text = [card?.id, card?.name, card?.summon?.unitId, card?.summon?.name]
      .concat(Array.isArray(card?.tags) ? card.tags : [])
      .join(" ");
    if (/curse_spirit_manipulation|咒灵操术|咒灵|ten_shadows|十种影|式神/i.test(text)) {
      return {
        placement: "shikigami_zone",
        zoneLabel: /curse_spirit_manipulation|咒灵操术|咒灵/i.test(text) ? "咒灵式神区" : "式神区"
      };
    }
    return { placement: "battlefield", zoneLabel: "战场" };
  }

  function buildDirectBattleSummonRuntime(card) {
    var summon = card?.summon;
    if (!summon?.unitId) return { summonSpec: undefined, unitStats: undefined, guardRules: undefined };
    var stored = summon.unit && typeof summon.unit === "object" ? summon.unit : {};
    var special = card?.effect?.special && typeof card.effect.special === "object" ? card.effect.special : {};
    var effectDamage = Math.max(0, finiteDuelNumber(card?.effect?.damage, 0));
    var effectBlock = Math.max(0, finiteDuelNumber(card?.effect?.block, 0));
    var storedHp = Math.max(0, finiteDuelNumber(stored.hp ?? stored.maxHp, 0));
    var storedDamage = Math.max(0, finiteDuelNumber(stored.damage, 0));
    var storedBlock = Math.max(0, finiteDuelNumber(stored.block, 0));
    var hasStoredCombatStats = storedHp > 0 || storedDamage > 0 || storedBlock > 0;
    var maxHp = hasStoredCombatStats
      ? Math.max(1, Math.round(storedHp || storedBlock * 4.5 + storedDamage * 3.5))
      : Math.max(1, Math.round(effectBlock * 4.5 + effectDamage * 3.5));
    var zone = getDirectBattleSummonZone(card);
    var tags = uniqueFeatureList(["summoned_unit", "召唤单位"]
      .concat(Array.isArray(card?.tags) ? card.tags : [])
      .concat(zone.placement === "shikigami_zone" ? ["shikigami", "式神"] : []));
    var unitStats = {
      ...stored,
      maxHp: maxHp,
      currentHp: maxHp,
      damage: hasStoredCombatStats ? storedDamage : Number(effectDamage.toFixed(3)),
      block: hasStoredCombatStats ? storedBlock : Number(effectBlock.toFixed(3)),
      damageReductionRatio: clamp(finiteDuelNumber(stored.damageReductionRatio, 0), 0, 0.9),
      blockIgnoreRatio: clamp(finiteDuelNumber(stored.blockIgnoreRatio, 0), 0, 0.9),
      accuracyProfile: stored.accuracyProfile && stored.accuracyProfile !== "none"
        ? stored.accuracyProfile
        : (card?.accuracy?.profile && card.accuracy.profile !== "none" ? card.accuracy.profile : "melee"),
      damageType: stored.damageType && stored.damageType !== "summon" ? stored.damageType : (card?.effect?.damageType || "summon"),
      placement: zone.placement,
      summonLane: summon.lane || "",
      zoneLabel: zone.zoneLabel,
      control: "player_controlled",
      tags: tags,
      yutaRikaDamageScale: Math.max(1, finiteDuelNumber(special.yutaRikaDamageScale, 1)),
      yutaRikaCeRegenMultiplier: Math.max(1, finiteDuelNumber(special.yutaRikaCeRegenMultiplier, 1)),
      yutaRikaHpRegenMaxRatio: clamp(finiteDuelNumber(special.yutaRikaHpRegenMaxRatio, 0), 0, 1),
      attackProfile: {
        accuracyProfile: stored.accuracyProfile && stored.accuracyProfile !== "none" ? stored.accuracyProfile : "melee",
        hitRateModifier: finiteDuelNumber(card?.accuracy?.modifier, 0),
        damageScale: 1,
        attackType: stored.damageType && stored.damageType !== "summon" ? stored.damageType : (card?.effect?.damageType || "summon")
      }
    };
    var summonSpec = {
      unitCardId: summon.unitId,
      unitName: summon.name || card?.name || summon.unitId,
      placement: zone.placement,
      summonLane: summon.lane || "",
      zoneLabel: zone.zoneLabel,
      control: "player_controlled",
      uniqueSummonKey: summon.uniqueKey || undefined,
      entryDamageDisabled: Boolean(summon.entryDamageDisabled),
      durationRounds: Math.max(0, Math.round(finiteDuelNumber(
        special.durationRounds ?? special.yutaRikaManifestationDurationRounds,
        0
      ))),
      unitStats: unitStats,
      maintenanceCeCost: Math.max(0, finiteDuelNumber(summon.maintenance?.ceCost, 0))
    };
    return {
      summonSpec: summonSpec,
      unitStats: unitStats,
      guardRules: summon.guard && typeof summon.guard === "object" ? { ...summon.guard } : undefined
    };
  }

  function prepareDirectBattleCardRuntimeAction(card) {
    if (!isDirectBattleCard(card)) return card;
    if (card.directRuntimePreparedVersion === "v3.6-r10" && card.legacyAtomicMigrationVersion === "v1") return card;
    var effectRuntime = buildDirectBattleRuntimeEffects(card);
    var domainActionRuntime = prepareDirectBattleDomainActionRuntime(card, effectRuntime.effects);
    var summonRuntime = buildDirectBattleSummonRuntime(card);
    var special = card.effect?.special && typeof card.effect.special === "object" ? card.effect.special : {};
    var constitutionHandTags = toFeatureList(card.tags).filter(function keepConstitutionHandTag(value) {
      return /^special_constitution_/i.test(String(value || ""));
    });
    var mechanicIds = normalizeDuelMechanicIds(card);
    // Direct battle cards store their authored special-effect contract under
    // effect.special.  The duel resolver consumes RCT output from the canonical
    // action/effects fields, so carry those fields across during preparation.
    // Without this bridge, Shoko's cards looked correct in JSON and previews but
    // silently resolved as ordinary self-healing/attacks.
    var rctOutputExternal = Boolean(
      special.rctOutputExternal ||
      special.rctOutput ||
      effectRuntime.effects.rctOutputExternal
    );
    var rctOutputHealScale = Math.max(0, finiteDuelNumber(
      special.rctOutputHealScale ?? effectRuntime.effects.rctOutputHealScale,
      0.8
    ));
    var domainAction = String(card.domain?.action || "");
    var cardSummary = String(card.summary || "").trim() || "暂无效果说明。";
    var directCardContexts = toFeatureList(card.contexts).map(function normalizeDirectCardContext(value) {
      return String(value || "").trim().toLowerCase();
    });
    var pressureIsSubphaseOnly = !directCardContexts.includes("normal") && Boolean(
      Number(effectRuntime.effects.evidencePressureDelta || 0) ||
      Number(effectRuntime.effects.defensePressureDelta || 0) ||
      Number(effectRuntime.effects.jackpotGaugeDelta || 0)
    );
    var directAtomicEffects = getCustomAtomicEffects({ effectTools: [].concat(card.effectTools || [], special.atomicEffects || [], effectRuntime.reusableAtomicEffects || []) });
    var atomicSelectionRules = directAtomicEffects.filter(function keepAtomicSelectionRule(effect) {
      return effect?.tool === "selection_rule";
    });
    var atomicIgnoreSelectionLimit = atomicSelectionRules.some(function hasAtomicIgnoreSelectionLimit(effect) {
      return effect?.params?.ignoreSelectionLimit === true;
    });
    var atomicDoesNotCountTowardSelectionLimit = atomicSelectionRules.some(function hasAtomicSelectionExemption(effect) {
      return effect?.params?.doesNotCountTowardSelectionLimit === true;
    });
    return {
      ...card,
      ...special,
      ...effectRuntime.actionPatch,
      directRuntimePreparedVersion: "v3.6-r10",
      legacyAtomicMigrationVersion: "v1",
      effectTools: uniqueAtomicEffects(directAtomicEffects),
      mechanicId: mechanicIds[0] || undefined,
      mechanicIds: mechanicIds,
      id: card.id || card.actionId || card.cardId,
      actionId: card.actionId || card.id || card.cardId,
      cardId: card.cardId || card.id || card.actionId,
      label: card.label || card.name || card.id,
      name: card.name || card.label || card.id,
      specialHandTags: uniqueFeatureList([].concat(card.specialHandTags || [], constitutionHandTags)),
      guaranteedPerTurn: Boolean(card.guaranteedPerTurn || card.selection?.guaranteed),
      retainedPermanent: card.retainedPermanent !== undefined ? Boolean(card.retainedPermanent) : card.selection?.retention === "permanent",
      ignoreHandSelectionLimit: Boolean(card.ignoreHandSelectionLimit || card.selection?.ignoreLimit || atomicIgnoreSelectionLimit),
      doesNotCountTowardSelectionLimit: Boolean(card.doesNotCountTowardSelectionLimit || card.selection?.doesNotCountTowardLimit || atomicDoesNotCountTowardSelectionLimit),
      cardType: card.cardType || card.type || "technique",
      description: cardSummary,
      effectSummary: cardSummary,
      flavorSummary: cardSummary,
      apCost: Math.max(0, finiteDuelNumber(card.cost?.ap, 1)),
      ceCost: Math.max(0, finiteDuelNumber(card.cost?.ce, 0)),
      damage: Math.max(0, finiteDuelNumber(card.effect?.damage, 0)),
      block: Math.max(0, finiteDuelNumber(card.effect?.block, 0)),
      healing: Math.max(0, finiteDuelNumber(card.effect?.healing, 0)),
      stabilityDamage: Math.max(0, finiteDuelNumber(card.effect?.stabilityDamage, 0)),
      ceDamage: Math.max(0, finiteDuelNumber(card.effect?.ceDamage, 0)),
      domainLoadDelta: finiteDuelNumber(card.effect?.domainLoad, 0),
      domainPressure: finiteDuelNumber(card.effect?.domainPressure, 0),
      blockIgnoreRatio: clamp(Math.max(
        finiteDuelNumber(special.blockIgnoreRatio, 0),
        finiteDuelNumber(effectRuntime.actionPatch.blockIgnoreRatio, 0),
        String(card?.scaling?.source || "") === "穿透攻击" ? 0.25 : 0
      ), 0, 0.9),
      damageType: card.effect?.damageType || "none",
      accuracyProfile: card.accuracy?.profile || "none",
      baseHitRate: card.accuracy?.hitRate,
      hitRateModifier: finiteDuelNumber(effectRuntime.actionPatch.hitRateModifier ?? card.accuracy?.modifier, 0),
      evasionAllowed: card.accuracy?.evasionAllowed !== false,
      onMiss: card.accuracy?.onMiss ? { ...card.accuracy.onMiss } : undefined,
      effects: {
        ...effectRuntime.effects,
        ...(rctOutputExternal ? {
          rctOutputExternal: true,
          rctOutputHealScale: rctOutputHealScale,
          rctOutputInstantKillCurses: special.rctOutputInstantKillCurses !== false
        } : {}),
        activateDomain: domainAction === "expand" || effectRuntime.effects.activateDomain,
        releaseDomain: domainAction === "release" || effectRuntime.effects.releaseDomain
      },
      rctOutput: rctOutputExternal,
      rctOutputExternal: rctOutputExternal,
      rctOutputHealScale: rctOutputExternal ? rctOutputHealScale : undefined,
      domainSpecific: Boolean(
        ["rule_trial", "rule_defense", "jackpot"].includes(String(card.type || card.cardType || "")) ||
        domainActionRuntime?.domainType === "jackpot_rule" ||
        pressureIsSubphaseOnly
      ),
      domainProfileId: domainActionRuntime?.domainId || card.domain?.id || undefined,
      domainName: domainActionRuntime?.domainName || undefined,
      domainClass: domainActionRuntime?.domainType || undefined,
      domainActionId: domainActionRuntime?.actionId || undefined,
      directDomainActionRuntime: domainActionRuntime || undefined,
      directEffectOperations: effectRuntime.operations,
      summonSpec: summonRuntime.summonSpec,
      unitStats: summonRuntime.unitStats,
      guardRules: summonRuntime.guardRules,
      summonEntryDamageDisabled: Boolean(card.summon?.entryDamageDisabled)
    };
  }

  function getDirectBattleCardLabel(action) {
    return action?.name || action?.label || action?.id || "未命名手札";
  }

  function getDirectBattleCardEffectNumber(action, key) {
    var number = Number(action?.effect?.[key] || 0);
    return Number.isFinite(number) ? number : 0;
  }


  function isCursedToolDuelAction(action) {
    var tags = []
      .concat(Array.isArray(action?.tags) ? action.tags : [])
      .concat(Array.isArray(action?.matchTags) ? action.matchTags : [])
      .map(function normalizeCursedToolMarker(value) { return String(value || "").trim().toLowerCase(); });
    if (tags.includes("higuruma_trial_owner")) return false;
    var markers = tags.concat([
      action?.cardType,
      action?.damageType,
      action?.effect?.damageType,
      action?.effect?.special?.kind
    ].map(function normalizeCursedToolField(value) { return String(value || "").trim().toLowerCase(); }));
    return markers.some(function isCursedToolMarker(value) {
      return value === "咒具" || /^(?:curse|cursed)[_-]?tool$/.test(value) || value === "cursedtool";
    });
  }

  function isWeaponInventoryCurseCycleAction(action) {
    var text = collectDuelActionSearchText(action);
    return /card_weapon_inventory_curse_cycle|weapon_inventory_curse_cycle|武器库咒灵换装/.test(text);
  }

  function getWeaponInventoryCurseCatalog(action) {
    var authored = action?.weaponInventoryCurse?.inventory || action?.effect?.special?.weaponInventoryCurse?.inventory;
    var entries = Array.isArray(authored) && authored.length ? authored : [
      { id: "playful_cloud", label: "游云", bonusKind: "damageScale", value: 1.18 },
      { id: "soul_split_katana", label: "释魂刀", bonusKind: "blockIgnoreRatio", value: 0.25 },
      { id: "inverted_spear_of_heaven", label: "天逆鉾", bonusKind: "hitRateModifier", value: 0.18 }
    ];
    return entries.slice(0, 3).map(function normalizeInventoryEntry(entry, index) {
      return {
        id: String(entry?.id || "inventory_tool_" + index),
        label: String(entry?.label || entry?.name || "咒具" + (index + 1)),
        bonusKind: ["damageScale", "blockIgnoreRatio", "hitRateModifier"].includes(String(entry?.bonusKind || ""))
          ? String(entry.bonusKind)
          : "damageScale",
        value: Number(entry?.value || (index === 0 ? 1.18 : 0.18))
      };
    });
  }

  function findDuelUniqueSummonUnit(battle, ownerSide, uniqueSummonKey) {
    return getDuelBattlefieldUnits(battle).find(function findUniqueUnit(unit) {
      if (!unit) return false;
      if ((unit.ownerSide || unit.controllerSide || unit.side || "") !== ownerSide) return false;
      return String(unit.uniqueSummonKey || unit.unitStats?.uniqueSummonKey || "") === String(uniqueSummonKey || "");
    }) || null;
  }

  function applyWeaponInventoryCurseCycle(action, actor, battle) {
    if (!isWeaponInventoryCurseCycleAction(action) || !actor || !battle) return null;
    var side = actor.side || "";
    var uniqueSummonKey = "weapon_inventory_curse_unit";
    var unit = findDuelUniqueSummonUnit(battle, side, uniqueSummonKey);
    var created = false;
    if (!unit) {
      var summonAction = {
        id: action.id || "card_weapon_inventory_curse_cycle",
        actionId: action.actionId || action.id || "card_weapon_inventory_curse_cycle",
        cardId: action.cardId || action.id || "card_weapon_inventory_curse_cycle",
        label: action.label || action.name || "武器库咒灵换装",
        tags: uniqueFeatureList(["weapon_inventory_curse", "curse_spirit", "咒灵", "武器库"]),
        summonSpec: {
          unitCardId: "card_unit_weapon_inventory_curse",
          unitName: "武器库咒灵",
          placement: "shikigami_zone",
          summonLane: "inventory_support",
          zoneLabel: "咒灵式神区",
          control: "player_controlled",
          uniqueSummonKey: uniqueSummonKey,
          durationRounds: 0,
          maintenanceCeCost: 0
        },
        unitStats: {
          maxHp: 80,
          currentHp: 80,
          damage: 0,
          block: 12,
          damageReductionRatio: 0.08,
          maintenanceCeCost: 0,
          placement: "shikigami_zone",
          summonLane: "inventory_support",
          zoneLabel: "咒灵式神区",
          control: "player_controlled",
          uniqueSummonKey: uniqueSummonKey,
          tags: ["weapon_inventory_curse", "curse_spirit", "inventory_support"]
        },
        guardRules: { neverCountsAsGuard: true },
        targetingRules: { neverCountsAsGuard: true }
      };
      unit = applyDuelSummonAction(summonAction, actor, battle)?.unit || null;
      created = Boolean(unit);
    }
    battle.weaponInventoryCurseState ||= {};
    var previous = battle.weaponInventoryCurseState[side] || {};
    var inventory = getWeaponInventoryCurseCatalog(action);
    var previousIndex = Number.isInteger(Number(previous.equippedIndex)) ? Number(previous.equippedIndex) : -1;
    var equippedIndex = inventory.length ? (previousIndex + 1) % inventory.length : -1;
    var equipped = equippedIndex >= 0 ? inventory[equippedIndex] : null;
    var unitActive = Boolean(unit?.active && !unit?.defeated);
    var state = {
      ownerSide: side,
      unitId: unit?.id || previous.unitId || "",
      uniqueSummonKey: uniqueSummonKey,
      inventory: inventory.map(function cloneEntry(entry) { return { ...entry }; }),
      equippedIndex: equippedIndex,
      equipped: equipped ? { ...equipped } : null,
      pendingUses: unitActive && equipped ? 1 : 0,
      maxPendingUses: 1,
      cycleCount: Math.max(0, Number(previous.cycleCount || 0)) + 1,
      lastCycledRound: Number(battle.round || 0) + 1,
      active: unitActive
    };
    battle.weaponInventoryCurseState[side] = state;
    battle.actionUiMessage = unitActive && equipped
      ? "武器库咒灵换装：" + equipped.label + "；下一张咒具牌获得对应增益。"
      : "武器库咒灵已无法继续换装。";
    return {
      created: created,
      unitId: state.unitId,
      inventorySize: state.inventory.length,
      equipped: state.equipped ? { ...state.equipped } : null,
      pendingUses: state.pendingUses,
      cycleCount: state.cycleCount,
      active: state.active
    };
  }

  function prepareWeaponInventoryCurseLoadoutAction(action, actor, battle) {
    if (!action || !actor || !battle || isWeaponInventoryCurseCycleAction(action) || !isCursedToolDuelAction(action)) return action;
    var state = battle.weaponInventoryCurseState?.[actor.side || ""];
    if (!state?.active || Number(state.pendingUses || 0) <= 0 || !state.equipped) return action;
    var unit = findDuelUniqueSummonUnit(battle, actor.side || "", state.uniqueSummonKey || "weapon_inventory_curse_unit");
    if (!unit?.active || unit?.defeated) return action;
    var equipped = state.equipped;
    var nextEffects = { ...(action.effects || action.effect || {}) };
    var nextEffect = { ...(action.effect || {}) };
    var next = {
      ...action,
      effects: nextEffects,
      effect: nextEffect,
      weaponInventoryLoadoutRuntime: {
        stateSide: actor.side || "",
        unitId: unit.id || "",
        equippedId: equipped.id,
        equippedLabel: equipped.label,
        bonusKind: equipped.bonusKind,
        value: Number(equipped.value || 0)
      }
    };
    if (equipped.bonusKind === "damageScale") {
      var damageScale = Math.max(1, Number(equipped.value || 1));
      nextEffects.damageScale = Number((Number(nextEffects.damageScale || 1) * damageScale).toFixed(4));
      nextEffect.damageScale = nextEffects.damageScale;
    } else if (equipped.bonusKind === "blockIgnoreRatio") {
      next.blockIgnoreRatio = clamp(Number(next.blockIgnoreRatio || 0) + Math.max(0, Number(equipped.value || 0)), 0, 0.9);
    } else if (equipped.bonusKind === "hitRateModifier") {
      next.hitRateModifier = clamp(Number(next.hitRateModifier || 0) + Math.max(0, Number(equipped.value || 0)), -0.5, 0.5);
    }
    return next;
  }

  function consumeWeaponInventoryCurseLoadout(action, battle) {
    var runtime = action?.weaponInventoryLoadoutRuntime;
    if (!runtime || !battle) return null;
    var state = battle.weaponInventoryCurseState?.[runtime.stateSide];
    if (!state || Number(state.pendingUses || 0) <= 0) return null;
    state.pendingUses = Math.max(0, Number(state.pendingUses || 0) - 1);
    state.lastConsumedRound = Number(battle.round || 0) + 1;
    state.lastConsumedBy = action.id || action.actionId || action.cardId || "";
    return {
      unitId: runtime.unitId,
      equippedId: runtime.equippedId,
      equippedLabel: runtime.equippedLabel,
      bonusKind: runtime.bonusKind,
      value: runtime.value,
      pendingUses: state.pendingUses,
      consumed: true
    };
  }

  function isDhruvOrbitDomainAction(action) {
    return /card_dhruv_lakdawalla_sendai_shikigami_orbit_domain|shikigami_orbit_domain/.test(collectDuelActionSearchText(action));
  }

  function isDhruvTrackingScreenAction(action) {
    return /card_dhruv_lakdawalla_sendai_shikigami_tracking_screen|shikigami_tracking_screen/.test(collectDuelActionSearchText(action));
  }

  function getActiveDhruvOrbitTracks(battle, side) {
    var state = battle?.dhruvOrbitState?.[side];
    if (!state || !Array.isArray(state.tracks)) return [];
    var currentRound = Number(battle.round || 0) + 1;
    return state.tracks.filter(function keepActiveTrack(track) {
      var unit = getDuelBattlefieldUnits(battle).find(function findTrackUnit(candidate) {
        return candidate?.id === track.unitId;
      });
      var active = Boolean(
        track?.active !== false &&
        (!Number(track?.expiresAfterRound || 0) || currentRound <= Number(track.expiresAfterRound)) &&
        unit?.active && !unit?.defeated
      );
      if (!active && track) track.active = false;
      return active;
    });
  }

  function prepareDhruvTrackingScreenRuntimeAction(action, actor, battle) {
    if (!isDhruvTrackingScreenAction(action) || !actor || !battle) return action;
    var activeTracks = getActiveDhruvOrbitTracks(battle, actor.side || "");
    var activeTrackCount = Math.min(2, activeTracks.length);
    if (!activeTrackCount) {
      return {
        ...action,
        dhruvTrackingScreenRuntime: { activeTrackCount: 0, blockBonus: 0, zoneControlApplied: false }
      };
    }
    var blockBonus = activeTrackCount * 8;
    var baseBlock = Math.max(0, Number(action.effect?.block ?? action.block ?? 0));
    var nextEffect = { ...(action.effect || {}), block: baseBlock + blockBonus };
    var nextEffects = { ...(action.effects || {}), block: baseBlock + blockBonus };
    if (activeTrackCount >= 2) {
      nextEffects.opponentStatuses = (nextEffects.opponentStatuses || []).concat([{
        id: "dhruvOrbitZoneControl",
        label: "式神轨迹封锁",
        rounds: 2,
        value: 1,
        outgoingScale: 0.9
      }]);
    }
    return {
      ...action,
      block: baseBlock + blockBonus,
      effect: nextEffect,
      effects: nextEffects,
      dhruvTrackingScreenRuntime: {
        activeTrackCount: activeTrackCount,
        trackIds: activeTracks.map(function mapTrack(track) { return track.id; }),
        blockBonus: blockBonus,
        zoneControlApplied: activeTrackCount >= 2
      }
    };
  }

  function applyDhruvOrbitRuntime(action, actor, battle) {
    if (!isDhruvOrbitDomainAction(action) || !actor || !battle) return null;
    var side = actor.side || "";
    var round = Number(battle.round || 0) + 1;
    var durationRounds = Math.max(1, Math.min(4, Number(action?.dhruvOrbit?.durationRounds || action?.effect?.special?.dhruvOrbit?.durationRounds || 3)));
    var unitDefinitions = [
      {
        uniqueSummonKey: "dhruv_ground_orbit_shikigami",
        unitCardId: "card_unit_dhruv_ground_orbit_shikigami",
        name: "杜鲁夫·巡地式神",
        trackId: "dhruv_ground_orbit_track",
        trackLabel: "巡地轨迹",
        maxHp: 96,
        damage: 31,
        block: 18,
        accuracyProfile: "melee"
      },
      {
        uniqueSummonKey: "dhruv_aerial_orbit_shikigami",
        unitCardId: "card_unit_dhruv_aerial_orbit_shikigami",
        name: "杜鲁夫·巡空式神",
        trackId: "dhruv_aerial_orbit_track",
        trackLabel: "巡空轨迹",
        maxHp: 84,
        damage: 34,
        block: 14,
        accuracyProfile: "technique_projectile"
      }
    ];
    var createdUnits = [];
    var tracks = unitDefinitions.map(function ensureDhruvUnit(definition) {
      var unit = findDuelUniqueSummonUnit(battle, side, definition.uniqueSummonKey);
      if (!unit) {
        var summonAction = {
          id: action.id || "card_dhruv_lakdawalla_sendai_shikigami_orbit_domain",
          actionId: action.actionId || action.id || "card_dhruv_lakdawalla_sendai_shikigami_orbit_domain",
          cardId: action.cardId || action.id || "card_dhruv_lakdawalla_sendai_shikigami_orbit_domain",
          label: action.label || action.name || "杜鲁夫·式神轨道领域",
          tags: ["dhruv_shikigami", "shikigami", "式神", "orbit"],
          summonSpec: {
            unitCardId: definition.unitCardId,
            unitName: definition.name,
            placement: "shikigami_zone",
            summonLane: "orbit_control",
            zoneLabel: "式神区",
            control: "player_controlled",
            uniqueSummonKey: definition.uniqueSummonKey,
            durationRounds: 0,
            maintenanceCeCost: 0
          },
          unitStats: {
            maxHp: definition.maxHp,
            currentHp: definition.maxHp,
            damage: definition.damage,
            block: definition.block,
            damageReductionRatio: 0.1,
            maintenanceCeCost: 0,
            accuracyProfile: definition.accuracyProfile,
            damageType: "technique",
            placement: "shikigami_zone",
            summonLane: "orbit_control",
            zoneLabel: "式神区",
            control: "player_controlled",
            uniqueSummonKey: definition.uniqueSummonKey,
            tags: ["dhruv_shikigami", "shikigami", "orbit", definition.trackId],
            attackProfile: {
              accuracyProfile: definition.accuracyProfile,
              hitRateModifier: 0,
              damageScale: 1,
              attackType: "technique"
            }
          },
          guardRules: { neverCountsAsGuard: true },
          targetingRules: { neverCountsAsGuard: true }
        };
        unit = applyDuelSummonAction(summonAction, actor, battle)?.unit || null;
        if (unit) createdUnits.push(unit);
      }
      return {
        id: definition.trackId,
        label: definition.trackLabel,
        unitId: unit?.id || "",
        unitUniqueKey: definition.uniqueSummonKey,
        startedRound: round,
        durationRounds: durationRounds,
        expiresAfterRound: round + durationRounds - 1,
        active: Boolean(unit?.active && !unit?.defeated)
      };
    });
    battle.dhruvOrbitState ||= {};
    var previous = battle.dhruvOrbitState[side] || {};
    battle.dhruvOrbitState[side] = {
      ownerSide: side,
      sourceActionId: action.id || action.actionId || "",
      startedRound: Number(previous.startedRound || round),
      lastRefreshedRound: round,
      durationRounds: durationRounds,
      expiresAfterRound: round + durationRounds - 1,
      tracks: tracks,
      activeTrackCount: tracks.filter(function countActive(track) { return track.active; }).length
    };
    battle.actionUiMessage = "两类式神巡行成域；轨迹持续" + durationRounds + "轮。";
    return {
      createdUnitIds: createdUnits.map(function mapUnit(unit) { return unit.id; }),
      unitIds: tracks.map(function mapTrack(track) { return track.unitId; }).filter(Boolean),
      trackIds: tracks.map(function mapTrack(track) { return track.id; }),
      activeTrackCount: battle.dhruvOrbitState[side].activeTrackCount,
      durationRounds: durationRounds,
      expiresAfterRound: battle.dhruvOrbitState[side].expiresAfterRound
    };
  }

  function duelActionRequiresCursedToolHolder(action) {
    return Boolean(
      action?.requiresCursedTool ||
      action?.requirements?.requiresCursedTool ||
      action?.effects?.requiresCursedTool ||
      action?.effect?.special?.requiresCursedTool
    );
  }

  function actorHasCursedToolHolderQualification(actor, battle) {
    if (!actor) return false;
    var profile = getDuelProfileForSide(battle, actor.side || "") || actor.characterCardProfile || actor.profile || {};
    var snapshot = getActorFeatureSnapshot(actor, battle);
    var flags = profile?.flags && typeof profile.flags === "object" && !Array.isArray(profile.flags)
      ? profile.flags
      : {};
    var hasExplicitHolderTag = ["cursed_tool_user", "cursed_tool", "curse_tool", "咒具"]
      .some(function hasHolderTag(tag) { return hasActorExplicitSpecialHandTag(snapshot, tag); });
    var hasEquippedToolStatus = (Array.isArray(actor.statusEffects) ? actor.statusEffects : [])
      .some(function hasEquippedTool(effect) {
        if (!effect || effect.active === false || Number(effect.rounds ?? 1) <= 0) return false;
        return /equipped[_-]?(?:cursed)?[_-]?tool|cursed[_-]?tool[_-]?equipped|已装备咒具/i.test(String(effect.id || "") + " " + String(effect.label || ""));
      });
    return Boolean(
      actor.usesCursedTools === true ||
      actor.flags?.usesCursedTools === true ||
      actor.characterCardProfile?.usesCursedTools === true ||
      actor.profile?.usesCursedTools === true ||
      profile.usesCursedTools === true ||
      flags.usesCursedTools === true ||
      hasExplicitHolderTag ||
      hasEquippedToolStatus
    );
  }

  function isSoulSplitKatanaDuelAction(action) {
    // Qualification must follow the card's machine identity.  Descriptions
    // such as the weapon-inventory catalogue may mention 释魂刀 without the
    // current card actually being a Soul Split Katana attack.
    var text = collectDuelActionIdentityText(action);
    return /soul[_-]?split[_-]?katana|释魂刀|釈魂刀/i.test(text);
  }

  function actorHasSoulSplitKatanaQualification(actor, battle) {
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (hasActorExplicitSpecialHandTag(snapshot, "soul_split_katana")) return true;
    return /soul[_\s-]?(?:split[_\s-]?katana|perception|awareness)|释魂刀|釈魂刀|灵魂感知|靈魂感知|灵魂观测|靈魂觀測/i.test(String(snapshot?.text || ""));
  }

  function isChainOfThousandMilesDuelAction(action) {
    return /chain[_-]?of[_-]?thousand[_-]?miles|万里锁|萬里鎖/i.test(collectDuelActionSearchText(action));
  }

  function getExplicitDuelDistanceRange(battle, actor, opponent) {
    var state = battle?.distanceState;
    var candidates = [
      state?.range,
      state?.currentRange,
      state?.distance,
      state?.[actor?.side || ""]?.range,
      state?.[opponent?.side || ""]?.range,
      battle?.engagementRange,
      battle?.combatRange
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      var value = String(candidates[index] || "").trim().toLowerCase();
      if (!value) continue;
      if (/^(?:close|near|melee|point[_-]?blank|近|近距离|近身)$/.test(value)) return "close";
      if (/^(?:mid|medium|middle|中|中距离|中距離)$/.test(value)) return "medium";
      if (/^(?:far|long|ranged|distance|远|遠|远距离|遠距離)$/.test(value)) return "far";
    }
    return "";
  }

  function isVerifiedRikaArsenalOwnershipBypass(action) {
    return Boolean(
      action?.rikaArsenalFreeUse &&
      String(action?.handSource || "") === "rika-arsenal-free-special" &&
      String(action?.rikaArsenalSourcePendingId || "") &&
      Number.isFinite(Number(action?.rikaArsenalExpiresAfterRound)) &&
      String(action?.generatedBy || "") === "里香武库"
    );
  }

  function getDuelOwnershipAndRangeAvailability(action, actor, opponent, battle) {
    var authorizedOwnershipBypass = isVerifiedRikaArsenalOwnershipBypass(action);
    if (action?.temporaryTechniqueSlot) {
      var temporaryTechniqueEntry = getTemporaryTechniqueSlot(battle, actor?.side || "left", action.temporaryTechniqueSlot);
      if (!isTemporaryTechniqueSlotActive(temporaryTechniqueEntry, battle) || temporaryTechniqueEntry?.tag !== action.temporaryTechniqueTag) {
        return { available: false, reason: "复制术式标签已经失效" };
      }
    }
    if (!authorizedOwnershipBypass && duelActionRequiresCursedToolHolder(action) && !actorHasCursedToolHolderQualification(actor, battle)) {
      return { available: false, reason: "需要咒具持有者资格或已装备咒具" };
    }
    if (!authorizedOwnershipBypass && isSoulSplitKatanaDuelAction(action) && !actorHasSoulSplitKatanaQualification(actor, battle)) {
      return { available: false, reason: "需要灵魂感知能力与释魂刀合格持有者资格" };
    }
    if (isChainOfThousandMilesDuelAction(action) && getExplicitDuelDistanceRange(battle, actor, opponent) === "close") {
      return { available: false, reason: "当前为近身距离，需先拉开距离才能展开万里锁" };
    }
    return { available: true, reason: "" };
  }

  function getFlatDuelCeCost(value, fallback) {
    var source = value;
    var numeric;
    if (source && typeof source === "object") {
      source = source.value ?? source.flat ?? source.amount ?? source.ce;
    }
    numeric = Number(source);
    if (!Number.isFinite(numeric)) return Math.max(0, Number(fallback || 0));
    return Math.max(0, numeric);
  }

  function getBattleRuntimeActionCostCe(action, actor) {
    if (isCursedToolDuelAction(action)) return 0;
    if (isDirectBattleCard(action)) return getFlatDuelCeCost(action.cost?.ce, 0);
    var cost = action?.cost || {};
    var percentageRatio = Number(cost.ceRatio ?? action?.ceCostRatio ?? 0);
    if (action?.costType === "percentage" || percentageRatio > 0) {
      return Number(Math.max(
        Number(cost.flatCe || 0),
        Number(cost.minCe || 0),
        Number(actor?.maxCe || 0) * Math.max(0, percentageRatio)
      ).toFixed(1));
    }
    if (Number.isFinite(Number(action?.ceCost))) return Math.max(0, Number(action.ceCost));
    if (Number.isFinite(Number(action?.costCe))) return Math.max(0, Number(action.costCe));
    if (cost.ce !== undefined && cost.ce !== null) return getFlatDuelCeCost(cost.ce, 0);
    var ratioCost = Number(actor?.maxCe || 0) * Number(cost.ceRatio || 0);
    return Number(Math.max(Number(cost.flatCe || 0), Number(cost.minCe || 0), ratioCost).toFixed(1));
  }

  function getBattleRuntimeActionContexts(action) {
    if (isDirectBattleCard(action)) return toFeatureList(action.contexts);
    return toFeatureList(action?.contexts || action?.runtimeContexts || action?.battleContexts || action?.contexts);
  }

  function getBattleRuntimeActionDamage(action) {
    if (isDirectBattleCard(action)) return getDirectBattleCardEffectNumber(action, "damage");
    return Number(action?.effect?.damage ?? action?.damage ?? 0);
  }

  function getDuelTacticActionModifiers(action, actor, opponent, battle) {
    var resolver = global.JJKDuelTactics?.resolveActionModifiers;
    if (typeof resolver !== "function") {
      return { damageScale: 1, ceCostScale: 1, healingScale: 1, blockScale: 1, hitRateBonus: 0, domainLoadScale: 1, domainPressureScale: 1, initiativeCostScale: 1 };
    }
    return resolver(battle || getBattle(), actor?.side || "left", action, actor, opponent) || {};
  }

  function getDuelTacticDefenseModifiers(opponent, battle) {
    var resolver = global.JJKDuelTactics?.resolveDefenseModifiers;
    if (typeof resolver !== "function") return { incomingDamageScale: 1, evasionBonus: 0, initiativeDefenseScale: 1 };
    return resolver(battle || getBattle(), opponent?.side || "right") || {};
  }

  function applyDuelTacticCostScale(cost, action, actor, opponent, battle) {
    if (action?.rikaArsenalFreeUse || action?.effects?.rikaArsenalFreeUse) return 0;
    var modifiers = getDuelTacticActionModifiers(action, actor, opponent, battle);
    return Number((Math.max(0, Number(cost || 0)) * Math.max(0, Number(modifiers.ceCostScale || 1))).toFixed(3));
  }

  function calculateDirectBattleCardSettlementWithTactics(action, actor, opponent, battle) {
    var directSettlement = global.JJKBattleDataDirect?.calculateBattleCardSettlement;
    if (typeof directSettlement !== "function") throw new Error("Direct battle card settlement API is unavailable");
    var modifiers = getDuelTacticActionModifiers(action, actor, opponent, battle);
    var adjustedCost = Number((getFlatDuelCeCost(action?.cost?.ce, 0) * Math.max(0, Number(modifiers.ceCostScale || 1))).toFixed(3));
    var adjustedAction = {
      ...action,
      cost: { ...(action?.cost || {}), ce: adjustedCost, flatCe: adjustedCost }
    };
    var settlement = directSettlement(adjustedAction, actor, opponent || {});
    if (settlement && typeof settlement === "object") {
      settlement.tacticModifiers = { ...modifiers };
    }
    return settlement;
  }

  function getDuelActionCost(action, actor, duelState) {
    var constitutionCost = global.JJKSpecialConstitution?.getCostOverride(action, actor);
    if (constitutionCost != null && Number.isFinite(Number(constitutionCost))) return Math.max(0, Number(constitutionCost));
    if (isCursedToolDuelAction(action)) return 0;
    var battle = getBattle(duelState);
    var opponent = actor?.side === "right" ? battle?.resourceState?.p1 : battle?.resourceState?.p2;
    var dependency = getOptionalDependency("getDuelActionCost");
    if (dependency && dependency !== getDuelActionCost) return normalizeDuelActionCost(applyDuelTacticCostScale(dependency(action, actor, battle), action, actor, opponent, battle));
    if (isDirectBattleCard(action)) {
      return normalizeDuelActionCost(Number(calculateDirectBattleCardSettlementWithTactics(action, actor, opponent, battle).cost?.ce || 0));
    }
    if (action?.rikaArsenalFreeUse || action?.effects?.rikaArsenalFreeUse) return 0;
    var bloodRuntime = getBloodManipulationRuntimeConfig(action, actor, getBattle());
    if (bloodRuntime?.active && Number.isFinite(Number(bloodRuntime.ceCost))) {
      return normalizeDuelActionCost(applyDuelTacticCostScale(Math.max(0, Number(bloodRuntime.ceCost)), action, actor, opponent, battle));
    }
    var costPreview = global.JJKDuelCardTemplate?.calculateDuelCardCeCost;
    if (typeof costPreview === "function") {
      var preview = costPreview(action, actor || {});
      if (Number.isFinite(Number(preview?.finalCost))) return normalizeDuelActionCost(applyDuelTacticCostScale(Number(preview.finalCost), action, actor, opponent, battle));
    }
    if (action?.costType === "zero_ce" || action?.zeroCeCostOverride) return normalizeDuelActionCost(0);
    return normalizeDuelActionCost(applyDuelTacticCostScale(getBattleRuntimeActionCostCe(action, actor), action, actor, opponent, battle));
  }

  function isDomainLockedAction(action) {
    if (!action || action.effects?.activateDomain || action.id === "domain_expand" || action.actionId === "domain_expand") return false;
    var cardType = String(action.cardType || action.type || "").toLowerCase();
    var contexts = getBattleRuntimeActionContexts(action).map(function normalizeContext(context) {
      return String(context || "").trim().toLowerCase();
    });
    var contextSet = new Set(contexts);
    var hasExclusiveDomainContext = !contextSet.has("normal") && !contextSet.has("trial_allowed") && contexts.some(function hasDomainContext(context) {
      return ["domain", "domain_active", "domain_owner", "domain_profile"].includes(context);
    });
    if (["domain", "domain_maintenance"].includes(cardType) && hasExclusiveDomainContext) return true;
    return hasExclusiveDomainContext && contexts.some(function hasDomainOwnerContext(context) {
      return ["domain_active", "domain_owner", "domain_profile"].includes(context);
    });
  }

  function getDuelDomainResponseProfile(profile, actor, opponent, battle) {
    return callDependency("getDuelDomainResponseProfile", [profile, actor, opponent, battle]);
  }

  function isDuelOpponentDomainThreat(opponent, actor, battle) {
    return callDependency("isDuelOpponentDomainThreat", [opponent, actor, battle]);
  }

  function hasDuelDomainCounterAccess(profile) {
    return callDependency("hasDuelDomainCounterAccess", [profile]);
  }

  function syncDuelTrialSubPhaseLifecycle(battle) {
    return callDependency("syncDuelTrialSubPhaseLifecycle", [battle]);
  }

  function updateDuelDomainTrialContext(battle, patch) {
    return callDependency("updateDuelDomainTrialContext", [battle, patch]);
  }

  function getDuelResourcePair(battle, side) {
    return callDependency("getDuelResourcePair", [battle, side]);
  }

  function clampDuelResource(resource) {
    return callDependency("clampDuelResource", [resource]);
  }

  function getDuelActionTemporaryResourceCap(resource, valueKey, maxKey, overCapKey) {
    var max = Math.max(0, Number(resource?.[maxKey] || 0));
    var overCap = Math.max(0, Number(resource?.[overCapKey] || 0));
    var current = Math.max(0, Number(resource?.[valueKey] || 0));
    return Math.max(max, current, max + overCap);
  }

  function getDuelStatusEffectValue(resource, id) {
    var dependency = getOptionalDependency("getDuelStatusEffectValue");
    if (dependency) return dependency(resource, id);
    if (!resource?.statusEffects?.length) return 0;
    return Math.max(0, ...resource.statusEffects
      .filter(function filterEffect(effect) {
        return effect.id === id;
      })
      .map(function mapEffect(effect) {
        return Number(effect.value || 1);
      }));
  }

  function findDuelStatusEffect(resource, id) {
    return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).find(function findEffect(effect) {
      return effect?.id === id;
    }) || null;
  }

  function upsertDuelStatusEffect(resource, status, options) {
    if (!resource || !status?.id) return null;
    resource.statusEffects ||= [];
    var getCurrentBattle = getOptionalDependency("getDuelBattle");
    var currentBattle = getCurrentBattle ? getCurrentBattle() : null;
    var appliedTurn = Math.max(0, Number(options?.appliedTurn || (currentBattle ? getDuelActionTurnNumber(currentBattle) : 0)));
    var existing = findDuelStatusEffect(resource, status.id);
    if (existing) {
      if (options?.addValue) {
        existing.value = Math.max(0, Number(existing.value || 0) + Number(status.value || 0));
      } else if (status.value !== undefined) {
        existing.value = Math.max(Number(existing.value || 0), Number(status.value || 0));
      }
      existing.rounds = Math.max(Number(existing.rounds || 0), Number(status.rounds || 1));
      Object.keys(status).forEach(function copyStatusField(key) {
        if (key === "id" || key === "value" || key === "rounds") return;
        existing[key] = status[key];
      });
      if (appliedTurn) existing.appliedTurn = appliedTurn;
      return existing;
    }
    var copy = { ...status };
    copy.rounds = Math.max(1, Number(copy.rounds || 1));
    if (copy.value === undefined) copy.value = 1;
    if (appliedTurn) copy.appliedTurn = appliedTurn;
    resource.statusEffects.push(copy);
    return copy;
  }

  function showHighCeSaturationStatus(resource, resolution) {
    if (!resource || resolution?.highCeActive !== true) return null;
    var multiplier = Number(resolution?.multipliers?.highCe || 1);
    var bonusPercent = Math.max(0, Math.round((multiplier - 1) * 100));
    return upsertDuelStatusEffect(resource, {
      id: "highCeSaturation",
      label: "充盈（伤害提高" + bonusPercent + "%）",
      // 回合结算结束会统一递减一次；设为 2 才能在触发后的状态栏保留到下一次清理。
      rounds: 2,
      value: bonusPercent,
      category: "增益状态",
      displayOnly: true
    });
  }

  function hasActiveMythicalBeastAmber(actor) {
    return getDuelStatusEffectValue(actor, "mythicalBeastAmber") > 0;
  }

  function hasUsedMythicalBeastAmber(actor) {
    return hasActiveMythicalBeastAmber(actor) || getDuelStatusEffectValue(actor, "mythicalBeastAmberUsed") > 0;
  }

  function getMythicalBeastAmberFractureLevel(actor, battle) {
    if (!actor || !battle) return 0;
    return Math.max(0, readDuelCounter(battle, actor.side || "left", "mythical_beast_amber", "fracture", {
      label: "琥珀裂解", initial: 0, min: 0, max: 9, format: "number"
    }));
  }

  function getDuelActionTurnNumber(battle) {
    return Number(battle?.round || 0) + 1;
  }

  function isDuelStatusEffectActive(effect, battle) {
    var triggerRound = Number(effect?.triggerRound || 0);
    var expiresRound = Number(effect?.expiresRound || effect?.expiresAfterRound || 0);
    var turn = getDuelActionTurnNumber(battle);
    return (!triggerRound || turn >= triggerRound) && (!expiresRound || turn <= expiresRound);
  }

  function getActiveDuelOutgoingStatusScale(resource, battle, action) {
    var statusScale = (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce(function multiplyScale(total, effect) {
      if (!isDuelStatusEffectActive(effect, battle)) return total;
      if (effect.appliesToTag && !getCustomAtomicActionTags(action).includes(String(effect.appliesToTag))) return total;
      var scale = Number(effect.outgoingScale ?? (effect.id === "loaned_shot_debt" ? effect.value : 1));
      return Number.isFinite(scale) && scale >= 0 ? total * scale : total;
    }, 1);
    return statusScale * getCustomAtomicCounterModifierValue(battle, resource, "outgoingScale");
  }

  function getActiveDuelIncomingHpStatusScale(resource, battle) {
    var statusScale = (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce(function multiplyScale(total, effect) {
      if (!isDuelStatusEffectActive(effect, battle)) return total;
      var scale = Number(effect.incomingHpScale ?? 1);
      return Number.isFinite(scale) && scale >= 0 ? total * scale : total;
    }, 1);
    var amberFracture = getMythicalBeastAmberFractureLevel(resource, battle);
    return statusScale *
      getCustomAtomicCounterModifierValue(battle, resource, "incomingHpScale") *
      Math.min(1.32, 1 + amberFracture * 0.04);
  }

  function getActiveDuelEvasionStatusBonus(resource, battle) {
    var statusBonus = (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce(function addBonus(total, effect) {
      if (!isDuelStatusEffectActive(effect, battle)) return total;
      var bonus = Number(effect.evasionBonus || 0);
      return Number.isFinite(bonus) && bonus > 0 ? total + bonus : total;
    }, 0);
    return statusBonus + getCustomAtomicCounterModifierValue(battle, resource, "evasionBonus");
  }

  function getActiveDuelHitRateStatusModifier(resource, battle) {
    var statusModifier = (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce(function addModifier(total, effect) {
      if (!isDuelStatusEffectActive(effect, battle) || Number(effect?.rounds ?? 1) <= 0) return total;
      var modifier = Number(effect.hitRateModifier || 0);
      return Number.isFinite(modifier) ? total + modifier : total;
    }, 0);
    return statusModifier + getCustomAtomicCounterModifierValue(battle, resource, "hitRateModifier");
  }

  function normalizeDuelInverseDamageCurveSpec(raw) {
    if (!raw || typeof raw !== "object") return null;
    var lowMax = Math.max(0, Number(raw.lowMax ?? 35));
    var mediumMax = Math.max(lowMax, Number(raw.mediumMax ?? 79));
    var lowScale = clamp(Number(raw.lowScale ?? 1.25), 0.05, 3);
    var mediumScale = clamp(Number(raw.mediumScale ?? 0.78), 0.05, 3);
    var highScale = clamp(Number(raw.highScale ?? 0.42), 0.05, 3);
    if (![lowMax, mediumMax, lowScale, mediumScale, highScale].every(Number.isFinite)) return null;
    return {
      statusId: String(raw.statusId || "inverse_damage_curve_status"),
      lowMax: Number(lowMax.toFixed(3)),
      mediumMax: Number(mediumMax.toFixed(3)),
      lowScale: Number(lowScale.toFixed(4)),
      mediumScale: Number(mediumScale.toFixed(4)),
      highScale: Number(highScale.toFixed(4))
    };
  }

  function activateDuelInverseDamageCurve(action, actor, battle) {
    var spec = normalizeDuelInverseDamageCurveSpec(action?.inverseDamageCurve || action?.effect?.special?.inverseDamageCurve);
    var side = actor?.side || "";
    if (!spec || !battle || !side) return null;
    battle.inverseDamageCurve ||= {};
    var state = {
      schema: "jjk.duel.inverse-damage-curve.v1",
      side: side,
      sourceCardId: String(action?.cardId || action?.id || action?.actionId || ""),
      activatedRound: getDuelActionTurnNumber(battle),
      ...spec
    };
    battle.inverseDamageCurve[side] = state;
    return { ...state };
  }

  function getActiveDuelInverseDamageCurve(defender, battle) {
    var side = defender?.side || "";
    var state = side && battle?.inverseDamageCurve?.[side];
    if (!state) return null;
    var status = (Array.isArray(defender?.statusEffects) ? defender.statusEffects : []).find(function findInverseStatus(effect) {
      return effect?.id === state.statusId && Number(effect?.rounds ?? 1) > 0 && isDuelStatusEffectActive(effect, battle);
    });
    return status ? state : null;
  }

  function resolveDuelInverseDamageCurve(amount, defender, battle, options) {
    var damageBefore = Math.max(0, Number(amount || 0));
    var state = getActiveDuelInverseDamageCurve(defender, battle);
    if (!state || damageBefore <= 0) return null;
    var tier = damageBefore <= Number(state.lowMax)
      ? "low"
      : (damageBefore <= Number(state.mediumMax) ? "medium" : "high");
    var scale = tier === "low"
      ? Number(state.lowScale)
      : (tier === "medium" ? Number(state.mediumScale) : Number(state.highScale));
    var damageAfter = Number(Math.max(0, damageBefore * scale).toFixed(1));
    var result = {
      schema: state.schema,
      applied: true,
      tier: tier,
      statusId: state.statusId,
      sourceCardId: state.sourceCardId,
      damageBefore: Number(damageBefore.toFixed(1)),
      damageAfter: damageAfter,
      scale: Number(scale.toFixed(4)),
      prevented: Number(Math.max(0, damageBefore - damageAfter).toFixed(1)),
      amplified: Number(Math.max(0, damageAfter - damageBefore).toFixed(1))
    };
    var logger = getOptionalDependency("recordDuelResourceChange");
    if (typeof logger === "function") {
      var tierLabel = tier === "low" ? "弱攻放大" : (tier === "medium" ? "中段削减" : "强攻反转");
      logger(battle, {
        side: defender?.side || "",
        title: "反比例术式·" + tierLabel,
        detail: "来袭结算伤害 " + result.damageBefore.toFixed(1) + "→" + result.damageAfter.toFixed(1) + "（×" + result.scale.toFixed(2) + "）。",
        type: "special",
        delta: {
          sourceKind: options?.sourceKind || "direct-card",
          sourceActionId: options?.action?.id || options?.action?.actionId || "",
          inverseTier: tier,
          inverseDamageBefore: result.damageBefore,
          inverseDamageAfter: result.damageAfter,
          inverseScale: result.scale
        }
      });
    }
    return result;
  }

  function activateDuelBodyHoppingState(action, actor, battle) {
    var spec = action?.bodyHoppingSpec || action?.effect?.special?.bodyHoppingSpec;
    if (!spec || spec.action !== "prepare_transfer" || !actor || !battle) return null;
    var side = actor.side || "left";
    var profile = actor.characterCardProfile || actor.profile || {};
    var maxCe = Math.max(0, Number(actor.maxCe || 0));
    var preserveCeRatio = clamp(Number(spec.preserveCeRatio ?? 0.6), 0, 1);
    var currentHostId = String(actor.characterId || actor.profileId || actor.id || profile.characterId || profile.id || side);
    var currentHostName = String(actor.name || profile.name || profile.displayName || currentHostId);
    var techniqueTags = uniqueFeatureList([]
      .concat(actor.techniqueFamilies || [], actor.cardTags || [], actor.traits || [])
      .concat(profile.cardTags || [], profile.specialHandTags || [], profile.traits || []));
    var state = {
      schema: "jjk.duel.body-hopping-state.v1",
      side: side,
      currentHost: {
        id: currentHostId,
        name: currentHostName,
        maxHp: Math.max(0, Number(actor.maxHp || 0)),
        maxCe: maxCe
      },
      transferPrepared: true,
      preparedRound: getDuelActionTurnNumber(battle),
      sourceCardId: String(action.cardId || action.id || action.actionId || ""),
      preservedResource: {
        ce: Number(Math.min(Math.max(0, Number(actor.ce || 0)), maxCe * preserveCeRatio).toFixed(3)),
        ceRatioCap: Number(preserveCeRatio.toFixed(4)),
        stability: Number(clamp(Number(actor.stability || 0), 0, 1).toFixed(4)),
        domainLoad: Number(Math.max(0, Number(actor.domain?.load ?? actor.domainLoad ?? 0)).toFixed(3)),
        counters: cloneDuelPlain(battle.counterState?.sides?.[side] || {})
      },
      techniqueSnapshot: {
        sourceHostId: currentHostId,
        techniqueTags: techniqueTags,
        domainId: String(actor.domain?.id || profile.domainId || profile.domainProfile || ""),
        hasInnateTechnique: profile.hasInnateTechnique !== false
      },
      switchCost: {
        ap: Math.max(0, Number(spec.switchApCost ?? 1)),
        ce: Math.max(0, Number(spec.switchCeCost ?? action.cost?.ce ?? action.ceCost ?? 0)),
        hpRatio: clamp(Number(spec.switchHpRatio || 0), 0, 1)
      }
    };
    battle.bodyHoppingState ||= {};
    battle.bodyHoppingState[side] = state;
    upsertDuelStatusEffect(actor, {
      id: "bodyHoppingTransferPrepared",
      label: "宿体转移准备",
      rounds: 999,
      value: 1
    });
    var logger = getOptionalDependency("recordDuelResourceChange");
    if (typeof logger === "function") {
      logger(battle, {
        side: side,
        title: "脑核转移准备",
        detail: "已记录宿体「" + currentHostName + "」与术式快照，保留咒力 " + state.preservedResource.ce.toFixed(1) + "。",
        type: "special",
        delta: {
          bodyHoppingTransferPrepared: true,
          currentHostId: currentHostId,
          preservedCe: state.preservedResource.ce,
          switchCeCost: state.switchCost.ce
        }
      });
    }
    return cloneDuelPlain(state);
  }

  function isDuelResourceDefeated(resource, battle) {
    if (!resource) return true;
    if (Number(resource.hp || 0) > 0) return false;
    return !isMahoragaProxyProtectingSide(battle, resource.side || "");
  }

  function getCustomAtomicHpCostConfig(action, actor, battle) {
    var opponent = actor?.side === "right"
      ? (battle?.resourceState?.p1 || battle?.left)
      : (battle?.resourceState?.p2 || battle?.right);
    return getCustomAtomicEffects(action).filter(function keepHpCost(effect) {
      return effect.tool === "pay_hp_cost" && passesCustomAtomicEffectConditions(effect, actor, opponent, battle);
    }).reduce(function sumHpCost(config, effect) {
      config.flat += Math.max(0, Number(effect.params?.amount || 0));
      config.ratio += Math.max(0, Number(effect.params?.ratio || 0));
      if (effect.params?.nonlethal === false) config.nonlethal = false;
      config.count += 1;
      return config;
    }, { flat: 0, ratio: 0, nonlethal: true, count: 0 });
  }

  function getDuelActionHpCost(action, actor, duelState) {
    var battle = getBattle(duelState);
    var bloodRuntime = getBloodManipulationRuntimeConfig(action, actor, battle);
    var effects = action?.effects || {};
    var atomicCost = getCustomAtomicHpCostConfig(action, actor, battle);
    var bloodFlat = bloodRuntime?.active && Number.isFinite(Number(bloodRuntime.hpCost)) ? Math.max(0, Number(bloodRuntime.hpCost)) : 0;
    var flat = bloodFlat + (bloodRuntime?.active ? 0 : Math.max(0, Number(effects.selfHpCostFlat ?? action?.selfHpCostFlat ?? 0))) + atomicCost.flat;
    var ratio = (bloodRuntime?.active ? 0 : Math.max(0, Number(effects.selfHpCostRatio ?? action?.selfHpCostRatio ?? 0))) + atomicCost.ratio;
    var maxHp = Math.max(0, Number(actor?.maxHp || 0));
    return Number((flat + maxHp * ratio).toFixed(1));
  }

  function applyDuelActionHpCost(action, actor, duelState) {
    var battle = getBattle(duelState);
    var cost = getDuelActionHpCost(action, actor, battle);
    if (!cost || !actor) return 0;
    var effects = action?.effects || {};
    var atomicCost = getCustomAtomicHpCostConfig(action, actor, battle);
    var minimumHp = effects.selfHpCostNonlethal === false || action?.selfHpCostNonlethal === false || atomicCost.nonlethal === false ? 0 : 1;
    var beforeHp = Number(actor.hp || 0);
    actor.hp = Number(Math.max(minimumHp, beforeHp - cost).toFixed(1));
    return Number(Math.max(0, beforeHp - Number(actor.hp || 0)).toFixed(1));
  }

  function recordDuelResourceChange(battle, entry) {
    return callDependency("recordDuelResourceChange", [battle, entry]);
  }

  function getDuelResourceSideLabel(side) {
    var dependency = getOptionalDependency("getDuelResourceSideLabel");
    if (dependency) return dependency(side);
    if (typeof global.JJKDuelPerspectiveSideLabel === "function") return global.JJKDuelPerspectiveSideLabel(side);
    return side === "left" ? "我方" : side === "right" ? "对方" : "战场";
  }

  function formatSignedDuelDelta(value) {
    var dependency = getOptionalDependency("formatSignedDuelDelta");
    if (dependency) return dependency(value);
    var number = Number(value || 0);
    return number >= 0 ? "+" + number : String(number);
  }

  function clamp(value, min, max) {
    var dependency = getOptionalDependency("clamp");
    if (dependency && dependency !== clamp) return dependency(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function finiteDuelNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function hashDuelSeed(value) {
    var dependency = getOptionalDependency("hashDuelSeed");
    if (dependency && dependency !== hashDuelSeed) return dependency(value);
    var hash = 2166136261;
    var text = String(value || "duel-seed");
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalizeActionIdSet(value) {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value);
    if (value && typeof value.has === "function") return value;
    return domainResponseActionIds;
  }

  function getDomainResponseActionIds() {
    return normalizeActionIdSet(getOptionalDependency("DUEL_DOMAIN_RESPONSE_ACTION_IDS"));
  }

  function buildDuelDomainSpecificActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!battle?.resourceState || !actor || !opponent) return [];
    var states = battle.domainProfileStates || {};
    var actions = [];
    var subPhase = syncDuelTrialSubPhaseLifecycle(battle) || battle.domainSubPhase;
    if (subPhase?.type === "trial" && !subPhase.verdictResolved) {
      var trialStateEntry = states[subPhase.owner];
      var trialProfile = trialStateEntry?.profile;
      var templates = actor.side === subPhase.owner
        ? callDependency("getDuelTrialOwnerActionTemplates", [trialProfile, subPhase])
        : callDependency("getDuelTrialDefenderActionTemplates", [trialProfile, subPhase]);
      actions.push(...templates.map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, trialProfile, actor, opponent, trialStateEntry, battle);
      }));
    }
    if (subPhase?.type === "jackpot" && !subPhase.jackpotResolved && actor.side === subPhase.owner) {
      var jackpotStateEntry = states[subPhase.owner];
      var jackpotProfile = jackpotStateEntry?.profile;
      actions.push(...(jackpotProfile?.domainActions || []).map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, jackpotProfile, actor, opponent, jackpotStateEntry, battle);
      }));
    }
    Object.values(states).forEach(function addStateActions(stateEntry) {
      if (!stateEntry?.profile || stateEntry.domainId === subPhase?.domainId || stateEntry.ownerSide !== actor.side) return;
      if (!getDuelResourcePair(battle, actor.side)?.domain?.active) return;
      actions.push(...(stateEntry.profile.domainActions || []).map(function normalizeTemplate(template) {
        return normalizeDuelDomainSpecificAction(template, stateEntry.profile, actor, opponent, stateEntry, battle);
      }));
    });
    return actions;
  }

  function normalizeDuelDomainSpecificAction(template, profile, actor, opponent, stateEntry, duelState) {
    return callDependency("normalizeDuelDomainSpecificAction", [template, profile, actor, opponent, stateEntry, duelState]);
  }

  function invalidateDuelActionChoices(battle) {
    var activeBattle = getBattle(battle);
    if (!activeBattle) return;
    activeBattle.actionChoices = [];
    activeBattle.actionRound = 0;
  }

  function getDuelActionAvailability(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (isDirectBattleCard(action)) action = prepareDirectBattleCardRuntimeAction(action);
    action = ensureCustomAtomicActionTransforms(action, actor, opponent, battle);
    action = getSixEyesRuntimeAction(action, actor);
    var side = actor?.side || "";
    var profile = getDuelProfileForSide(battle, side);
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var requirements = action.requirements || {};
    var costCe = getDuelActionCost(action, actor, battle);
    var hpCost = getDuelActionHpCost(action, actor, battle);
    if (!actor || !opponent) return { available: false, reason: "资源状态缺失", costCe: costCe };
    var constitutionAvailability = global.JJKSpecialConstitution?.getActionAvailability(action, actor, battle);
    if (constitutionAvailability && !constitutionAvailability.available) {
      return { available: false, reason: constitutionAvailability.reason, costCe: costCe };
    }
    if (isDuelResourceDefeated(actor, battle)) return { available: false, reason: "体势已归零，无法行动", costCe: costCe };
    var cannotActStatus = (actor.statusEffects || []).find(function findCannotAct(status) { return isDuelStatusEffectActive(status, battle) && status?.cannotAct === true; });
    if (cannotActStatus) return { available: false, reason: String(cannotActStatus.label || "当前状态下无法行动"), costCe: costCe };
    if (actor.ce < costCe) return { available: false, reason: "咒力不足", costCe: costCe };
    if (hpCost > 0 && Number(actor.hp || 0) <= 1) return { available: false, reason: "体势不足以支付代价", costCe: costCe };
    var ownershipAndRangeAvailability = getDuelOwnershipAndRangeAvailability(action, actor, opponent, battle);
    if (!ownershipAndRangeAvailability.available) {
      return { available: false, reason: ownershipAndRangeAvailability.reason, costCe: costCe };
    }
    var customCharacterAtomicAction = isCustomCharacterAtomicAction(action);
    var customAtomicAvailability = getCustomAtomicActionAvailability(action, actor, opponent, battle);
    if (!customAtomicAvailability.available) {
      return { available: false, reason: customAtomicAvailability.reason, costCe: costCe, customAtomic: customAtomicAvailability };
    }
    var bloodResourceAvailability = getBloodManipulationResourceAvailability(action, actor, battle);
    if (!bloodResourceAvailability.available) {
      return { available: false, reason: bloodResourceAvailability.reason, costCe: costCe };
    }
    if (!customCharacterAtomicAction) {
    if (isYutaTruePureLoveCannonAction(action) && !hasActiveYutaRikaManifestation(battle, side)) {
      return { available: false, reason: "祈本里香尚未完全显现，无法使用真-纯爱大炮", costCe: costCe };
    }
    // Blood manipulation access via DSL availability
    var bloodDslResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
    if (bloodDslResult && !bloodDslResult.available && (bloodDslResult.reason || "").indexOf("赤血") >= 0) return bloodDslResult;
    if (isTenShadowsUniqueShikigamiAction(action) && hasTenShadowsShikigamiBeenSummoned(battle, side, action)) {
      return { available: false, reason: "该十种影式神本场已经召唤过", costCe: costCe };
    }
    if (isYutaRikaFullManifestationAction(action) && hasActiveYutaRikaManifestation(battle, side)) {
      return { available: false, reason: "祈本里香已经完全显现", costCe: costCe };
    }
    if (isYutaRikaFullManifestationAction(action) && hasYutaRikaManifestationBeenSummoned(battle, side, action)) {
      return { available: false, reason: "祈本里香本场已经显现过", costCe: costCe };
    }
    if (isCurseSpiritManipulationUniqueSummonAction(action) && hasCurseSpiritManipulationSummonBeenUsed(battle, side, action)) {
      return { available: false, reason: "该咒灵库存本场已经放出过", costCe: costCe };
    }
    if (isCurseSpiritManipulationUniqueSummonAction(action) && getActiveCurseSpiritManipulationUnitCount(battle, side) >= 3) {
      return { available: false, reason: "咒灵式神区已满（最多同时维持3只）；需先让咒灵退场或投入“涡”", costCe: costCe };
    }
    if (isMaximumUzumakiAction(action) && !isRikaArsenalCopiedSpecialResourceAction(action)) {
      var maximumUzumakiSpec = action?.maximumUzumakiSpec || {};
      var maximumUzumakiCandidates = getMaximumUzumakiCandidateUnits(battle, side, action);
      var maximumUzumakiMinUnits = Math.max(1, Math.round(Number(maximumUzumakiSpec.minUnits || 1)));
      var maximumUzumakiCooldown = getMaximumUzumakiCooldownState(battle, side, action);
      if (maximumUzumakiCandidates.length < maximumUzumakiMinUnits) {
        return {
          available: false,
          reason: maximumUzumakiSpec.requiresPriorRoundUnits
            ? "极之番-涡至少需要" + maximumUzumakiMinUnits + "只在本回合开始前已入场的咒灵"
            : "极之番-涡至少需要投入" + maximumUzumakiMinUnits + "只场上咒灵",
          costCe: costCe
        };
      }
      if (maximumUzumakiCooldown.remainingRounds > 0) {
        return { available: false, reason: "极之番-涡仍在冷却（剩余" + maximumUzumakiCooldown.remainingRounds + "回合）", costCe: costCe };
      }
    }
    if (isReverseCursedTechniqueOutputAction(action) && !hasReverseCursedTechniqueOutputTarget(action, actor, opponent, battle)) {
      return { available: false, reason: "当前没有可外放的咒灵目标或需要治疗的目标", costCe: costCe };
    }
    // Star rage & black bird availability via DSL
    var starRageDslResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
    if (starRageDslResult && !starRageDslResult.available && 
        (starRageDslResult.reason || "").indexOf("星之怒") >= 0) return starRageDslResult;
    var blackBirdDslResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
    if (blackBirdDslResult && !blackBirdDslResult.available && 
        (blackBirdDslResult.reason || "").indexOf("乌羽") >= 0) return blackBirdDslResult;
    // Projection availability via DSL
    var projectionDslResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
    if (projectionDslResult && !projectionDslResult.available && 
        (projectionDslResult.reason || "").indexOf("手牌被") >= 0) return projectionDslResult;
    // All technique availability checks via DSL
    var resourceDslResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
    if (resourceDslResult && !resourceDslResult.available) return resourceDslResult;

    var smallpoxDomainAvailability = getSmallpoxDomainAvailability(action, actor, battle);
    if (!smallpoxDomainAvailability.available) return { available: false, reason: smallpoxDomainAvailability.reason, costCe: costCe };
    var disasterAvailability = getDisasterResourceAvailability(action, actor, battle);
    if (!disasterAvailability.available) return { available: false, reason: disasterAvailability.reason, costCe: costCe };
    var tacticalAvailability = getTacticalHumanResourceAvailability(action, actor, battle);
    if (!tacticalAvailability.available) return { available: false, reason: tacticalAvailability.reason, costCe: costCe };
    var blackRopeAvailability = getBlackRopeActionAvailability(action, actor, battle);
    if (!blackRopeAvailability.available) return { available: false, reason: blackRopeAvailability.reason, costCe: costCe };
    var contractTicketAvailability = getContractTicketActionAvailability(action, actor, battle);
    if (!contractTicketAvailability.available) return { available: false, reason: contractTicketAvailability.reason, costCe: costCe };
    var comedianAvailability = getComedianActionAvailability(action, actor, battle);
    if (!comedianAvailability.available) return { available: false, reason: comedianAvailability.reason, costCe: costCe };
    var kusakabeAvailability = getKusakabeActionAvailability(action, actor, battle);
    if (!kusakabeAvailability.available) return { available: false, reason: kusakabeAvailability.reason, costCe: costCe };
    var starRageAvailability = getStarRageActionAvailability(action, actor, battle);
    if (!starRageAvailability.available) return { available: false, reason: starRageAvailability.reason, costCe: costCe };
    var blackBirdAvailability = getBlackBirdActionAvailability(action, actor, battle);
    if (!blackBirdAvailability.available) return { available: false, reason: blackBirdAvailability.reason, costCe: costCe };
    var projectionAvailability = getProjectionActionAvailability(action, actor, battle);
    if (!projectionAvailability.available) return { available: false, reason: projectionAvailability.reason, costCe: costCe };
    }
    if (requirements.blocksOnHardClosePressure && isActorUnderHardClosePressure(actor)) {
      return { available: false, reason: "被强近身压制，暂时无法完整调用该手段", costCe: costCe };
    }
    if (requirements.requiresMissingHp && actor.maxHp && Number(actor.hp || 0) >= Number(actor.maxHp || 0) - 0.5) {
      return { available: false, reason: "当前没有需要反转治疗的伤势", costCe: costCe };
    }
    if (isDomainLockedAction(action) && !actor.domain?.active) return { available: false, reason: "当前未展开领域", costCe: costCe };
    if (requirements.domainActive === true && !actor.domain?.active) return { available: false, reason: "当前未展开领域", costCe: costCe };
    if (requirements.domainActive === false && actor.domain?.active) return { available: false, reason: "领域已展开", costCe: costCe };
    if ((action.effects?.activateDomain || action.id === "domain_expand" || action.id === "card_domain_expand") && !domainResponse.canExpandDomain) {
      return { available: false, reason: "当前角色不具备领域条件", costCe: costCe };
    }
    if (requirements.requiresDomainAccess && !domainResponse.canExpandDomain) return { available: false, reason: "当前角色不具备领域条件", costCe: costCe };
    if (requirements.opponentDomainActive && !isDuelOpponentDomainThreat(opponent, actor, battle)) {
      if (!getDomainResponseActionIds().has(action.id)) return { available: false, reason: "对方未展开领域", costCe: costCe };
    }
    if (requirements.requiresDomainClash && !domainResponse.allowedDomainResponseActions.includes("domain_clash")) return { available: false, reason: "缺少真正领域对抗条件", costCe: costCe };
    if (requirements.requiresSimpleDomain && !domainResponse.allowedDomainResponseActions.includes("simple_domain_guard")) return { available: false, reason: "缺少简易领域防线", costCe: costCe };
    if (requirements.requiresHollowWickerBasket && !domainResponse.allowedDomainResponseActions.includes("hollow_wicker_basket_guard")) return { available: false, reason: "缺少弥虚葛笼", costCe: costCe };
    if (requirements.requiresFallingBlossomEmotion && !domainResponse.allowedDomainResponseActions.includes("falling_blossom_emotion")) return { available: false, reason: "缺少落花之情", costCe: costCe };
    if (requirements.requiresZeroCeBypass && !domainResponse.allowedDomainResponseActions.includes("zero_ce_domain_bypass")) return { available: false, reason: "不具备零咒力必中规避", costCe: costCe };
    if (requirements.requiresNoDomainResponse && !domainResponse.allowedDomainResponseActions.includes("domain_survival_guard")) return { available: false, reason: "已有更合适的领域应对", costCe: costCe };
    if (requirements.requiresDomainCounter && !hasDuelDomainCounterAccess(profile || {})) return { available: false, reason: "缺少领域对抗手段", costCe: costCe };
    if (requirements.blocksOnTechniqueImbalance && (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0 || getDuelStatusEffectValue(actor, "techniqueBurnout") > 0)) return { available: false, reason: "术式烧断中", costCe: costCe };
    var subPhase = battle?.domainSubPhase;
    if (subPhase?.type === "trial" && actor?.side === subPhase.defender && !subPhase.verdictResolved) {
      if (["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id) && subPhase.canDefend === false) {
        return { available: false, reason: "当前审判目标类型不能有效辩护", costCe: costCe };
      }
      if (action.id === "remain_silent" && subPhase.canRemainSilent === false) {
        return { available: false, reason: "当前审判目标类型不能主张沉默", costCe: costCe };
      }
    }
    if (action.id === "request_verdict" && subPhase?.type === "trial" && !subPhase.verdictResolved) {
      var selfIncriminationScale = subPhase.hasSelfAwareness === false ? 0.12 : 0.25;
      var targetPressureScale = {
        full: 1,
        partial: 0.92,
        exorcism_ruling: 0.88,
        redirect_to_controller: 0.82,
        object_confiscation: 0.78
      }[subPhase.trialEligibility] ?? 0.9;
      var adjustedPressure = (
        Number(subPhase.evidencePressure || 0) -
        Number(subPhase.defensePressure || 0) * 0.35 +
        Number(subPhase.heavyVerdictRisk || 0) * 0.45 -
        Number(subPhase.selfIncriminationRisk || 0) * selfIncriminationScale
      ) * targetPressureScale;
      if (!subPhase.verdictReady && adjustedPressure < 4.2) return { available: false, reason: "判决尚未成熟", costCe: costCe };
    }
    // Jackpot availability via DSL
    if (!customCharacterAtomicAction) {
      var jackpotAvailResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
      if (jackpotAvailResult && !jackpotAvailResult.available) return jackpotAvailResult;
      // Technique/tool confiscation & burnout handled by DSL availability entries
      var confiscationResult = getSpecialAvailabilityResult(action, actor, opponent, battle, costCe);
      if (confiscationResult && !confiscationResult.available && (confiscationResult.reason || "").includes("没收")) return confiscationResult;
    }
    return { available: true, reason: "", costCe: costCe };
  }

  function collectDuelActionSearchText(action) {
    if (!action) return "";
    var parts = [
      action.id,
      action.actionId,
      action.actionId,
      action.cardId,
      action.name,
      action.label,
      action.displayName,
      action.description,
      action.effectSummary
    ];
    if (Array.isArray(action.tags)) parts = parts.concat(action.tags);
    if (Array.isArray(action.specialHandTags)) parts = parts.concat(action.specialHandTags);
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function collectDuelActionIdentityText(action) {
    if (!action) return "";
    var parts = [
      action.id,
      action.actionId,
      action.actionId,
      action.cardId,
      action.name,
      action.label,
      action.displayName
    ];
    if (Array.isArray(action.tags)) parts = parts.concat(action.tags);
    if (Array.isArray(action.specialHandTags)) parts = parts.concat(action.specialHandTags);
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function hasSixEyesRuntime(actor) {
    var sources = [actor, actor?.characterCardProfile, actor?.duelProfileSnapshot, actor?.profile].filter(Boolean);
    var text = sources.map(function collect(source) {
      return [
        source.id,
        source.characterId,
        source.name,
        source.displayName,
        source.techniqueName,
        source.techniqueText,
        ...(Array.isArray(source.tags) ? source.tags : []),
        ...(Array.isArray(source.traits) ? source.traits : []),
        ...(Array.isArray(source.innateTraits) ? source.innateTraits : []),
        ...(Array.isArray(source.specialHandTags) ? source.specialHandTags : []),
        ...(Array.isArray(source.cardTags) ? source.cardTags : [])
      ].filter(Boolean).join(" ");
    }).join(" ").toLowerCase();
    return /six[_\s-]?eyes|六眼/.test(text);
  }

  function getSixEyesRuntimeAction(action, actor) {
    if (!action || action.sixEyesRuntime?.applied || !hasSixEyesRuntime(actor)) return action;
    var next = {
      ...action,
      cost: { ...(action.cost || {}), affectedByEfficiency: false },
      effects: { ...(action.effects || {}) },
      sixEyesRuntime: { applied: true, hitRateModifier: 0.2, ceCostScale: 0.9 }
    };
    next.hitRateModifier = Number((Number(next.hitRateModifier || 0) + 0.2).toFixed(4));
    var originalCost = Number.isFinite(Number(next.costCe))
      ? Number(next.costCe)
      : Number(next.cost?.ce ?? next.ceCost ?? 0);
    if (originalCost > 0 && next.cost?.affectedByGlobalModifiers !== false) {
      var discounted = Number((originalCost * 0.9).toFixed(3));
      next.costCe = discounted;
      next.ceCost = discounted;
      next.cost.ce = discounted;
    }
    return next;
  }

  function getBattleSpecialAbilitiesForRuntime() {
    var appState = getOptionalDependency("state");
    var source = appState?.battleSpecialAbilities || appState?.specialAbilities || null;
    return Array.isArray(source?.abilities) ? source.abilities : (Array.isArray(source) ? source : []);
  }

  function getSpecialAvailabilityResult(action, actor, opponent, battle, costCe) {
    var runner = global.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
    if (typeof runner !== "function" || !battle || !actor || !action) return null;
    var result = global.JJKBattleSpecialRuntime.runBattleSpecialEntry("availability", {
      abilities: getBattleSpecialAbilitiesForRuntime(),
      battle: battle,
      side: actor.side || "",
      actor: actor,
      opponent: opponent,
      action: action,
      card: action,
      turn: getDuelActionTurnNumber(battle)
    });
    if (result?.availability?.available === false) {
      return { available: false, reason: result.availability.reason || result.availability.reasonId || "special availability blocked", costCe: costCe };
    }
    return null;
  }

  function isTenShadowsRabbitAction(action) {
    var text = collectDuelActionSearchText(action);
    return text.indexOf("rabbit") !== -1 || text.indexOf("脱兔") !== -1;
  }

  function isTenShadowsUniqueShikigamiAction(action) {
    var text = collectDuelActionSearchText(action);
    var isTenShadows = text.indexOf("ten_shadows") !== -1 || text.indexOf("十种影") !== -1;
    return Boolean(action && action.summonSpec && action.summonSpec.unitCardId && isTenShadows && !isTenShadowsRabbitAction(action));
  }

  function isCurseSpiritManipulationUniqueSummonAction(action) {
    if (action?.curseSpiritDslOnly !== true) {
    var text = collectDuelActionSearchText(action);
    var isCurseSpiritManipulation = text.indexOf("curse_spirit_manipulation") !== -1 ||
      text.indexOf("咒灵操术") !== -1 ||
      text.indexOf("虹龙") !== -1 ||
      text.indexOf("口裂女") !== -1 ||
      text.indexOf("化身玉藻前") !== -1;
    return Boolean(action && action.summonSpec && action.summonSpec.unitCardId && isCurseSpiritManipulation);
    }
    return Boolean(action?.summonSpec?.unitCardId);
  }

  function stripCurseSpiritSummonEntryDamage(action) {
    var entryDamageDisabled = Boolean(
      action?.summonEntryDamageDisabled ||
      action?.summonSpec?.entryDamageDisabled ||
      isCurseSpiritManipulationUniqueSummonAction(action)
    );
    if (!entryDamageDisabled) return action;
    return {
      ...action,
      damage: 0,
      stabilityDamage: 0,
      ceDamage: 0,
      effect: { ...(action.effect || action.effects || {}), damage: 0, stabilityDamage: 0, ceDamage: 0 },
      damageType: action.damageType === "summon_entry" ? "none" : action.damageType,
      accuracyProfile: getRuntimeActionNumber(action, "block") > 0 ? action.accuracyProfile : "none",
      evasionAllowed: false,
      summonEntryDamageDisabled: true
    };
  }

  function isMaximumUzumakiAction(action) {
    if (!action) return false;
    if (action.maximumUzumakiSpec || action.effects?.maximumUzumakiConsumeCurseSpirits) return true;
    var text = collectDuelActionSearchText(action);
    return text.indexOf("maximum_uzumaki") !== -1 || (text.indexOf("极之番") !== -1 && text.indexOf("涡") !== -1);
  }

  function getTenShadowsSummonKey(action) {
    if (!action) return "";
    return String(
      (action.summonSpec && action.summonSpec.uniqueSummonKey) ||
      (action.summonSpec && action.summonSpec.unitCardId) ||
      action.cardId ||
      action.actionId ||
      action.actionId ||
      action.id ||
      ""
    );
  }

  function hasTenShadowsShikigamiBeenSummoned(battle, side, action) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key) return false;
    var state = battle.tenShadowsSummonState && battle.tenShadowsSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side || !entry.uniqueTenShadowsSummon) return false;
      return entry.unitCardId === key || entry.cardId === key || entry.actionId === key;
    });
  }

  function hasYutaRikaManifestationBeenSummoned(battle, side, action) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key || !isYutaRikaFullManifestationAction(action)) return false;
    var state = battle.rikaManifestationSummonState && battle.rikaManifestationSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side || !entry.uniqueRikaManifestationSummon) return false;
      return entry.uniqueSummonKey === key || entry.unitCardId === key || entry.cardId === key || entry.actionId === key;
    });
  }

  function hasCurseSpiritManipulationSummonBeenUsed(battle, side, action) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key) return false;
    var state = battle.curseSpiritSummonState && battle.curseSpiritSummonState[side];
    if (state && state[key]) return true;
    var logs = Array.isArray(battle.summonLog) ? battle.summonLog : [];
    return logs.some(function matchSummon(entry) {
      if (!entry || entry.actorSide !== side || !entry.uniqueCurseSpiritSummon) return false;
      return entry.unitCardId === key || entry.cardId === key || entry.actionId === key;
    });
  }

  function getActiveCurseSpiritManipulationUnitCount(battle, side) {
    if (!battle || !side) return 0;
    return getDuelBattlefieldUnits(battle).filter(function countControlledCurseSpirit(unit) {
      return isMaximumUzumakiConsumableUnit(unit, side);
    }).length;
  }

  function markTenShadowsShikigamiSummoned(battle, side, action, unit) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key || !isTenShadowsUniqueShikigamiAction(action)) return;
    if (!battle.tenShadowsSummonState || typeof battle.tenShadowsSummonState !== "object") battle.tenShadowsSummonState = {};
    if (!battle.tenShadowsSummonState[side] || typeof battle.tenShadowsSummonState[side] !== "object") battle.tenShadowsSummonState[side] = {};
    battle.tenShadowsSummonState[side][key] = {
      unitId: unit && unit.id ? unit.id : "",
      unitName: unit && unit.name ? unit.name : "",
      actionId: action && (action.actionId || action.id) ? (action.actionId || action.id) : "",
      cardId: action && action.cardId ? action.cardId : "",
      round: battle.round || 0
    };
  }

  function markYutaRikaManifestationSummoned(battle, side, action, unit) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key || !isYutaRikaFullManifestationAction(action)) return;
    if (!battle.rikaManifestationSummonState || typeof battle.rikaManifestationSummonState !== "object") battle.rikaManifestationSummonState = {};
    if (!battle.rikaManifestationSummonState[side] || typeof battle.rikaManifestationSummonState[side] !== "object") battle.rikaManifestationSummonState[side] = {};
    battle.rikaManifestationSummonState[side][key] = {
      unitId: unit && unit.id ? unit.id : "",
      unitName: unit && unit.name ? unit.name : "",
      actionId: action && (action.actionId || action.id) ? (action.actionId || action.id) : "",
      cardId: action && action.cardId ? action.cardId : "",
      unitCardId: action && action.summonSpec && action.summonSpec.unitCardId ? action.summonSpec.unitCardId : "",
      uniqueSummonKey: key,
      round: Number(battle.round || 0) + 1,
      oneShotManifestation: true
    };
  }

  function markCurseSpiritManipulationSummoned(battle, side, action, unit) {
    var key = getTenShadowsSummonKey(action);
    if (!battle || !side || !key || !isCurseSpiritManipulationUniqueSummonAction(action)) return;
    if (!battle.curseSpiritSummonState || typeof battle.curseSpiritSummonState !== "object") battle.curseSpiritSummonState = {};
    if (!battle.curseSpiritSummonState[side] || typeof battle.curseSpiritSummonState[side] !== "object") battle.curseSpiritSummonState[side] = {};
    battle.curseSpiritSummonState[side][key] = {
      unitId: unit && unit.id ? unit.id : "",
      unitName: unit && unit.name ? unit.name : "",
      actionId: action && (action.actionId || action.id) ? (action.actionId || action.id) : "",
      cardId: action && action.cardId ? action.cardId : "",
      round: Number(battle.round || 0) + 1,
      oneShotStock: true
    };
  }

  function toFeatureList(value) {
    if (Array.isArray(value)) return value.filter(function keepValue(item) { return item !== undefined && item !== null && item !== ""; });
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function uniqueFeatureList(values) {
    var seen = new Set();
    var output = [];
    (values || []).forEach(function addValue(value) {
      var text = String(value || "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      output.push(text);
    });
    return output;
  }

  function normalizeFeatureText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\s"'`.,，。；;：:、/／\\|!?！？()（）\[\]【】{}《》<>·・_\-—~]+/g, "");
  }

  function normalizeFeatureTag(value) {
    return String(value || "").trim();
  }

  function hasStrictFeatureSpecialHandTagMatch(tags, tag) {
    var normalizedTags = new Set(toFeatureList(tags).map(function normalizeTag(value) {
      return String(value || "").trim().toLowerCase();
    }).filter(Boolean));
    return normalizedTags.has(String(tag || "").trim().toLowerCase());
  }

  function hasFeatureSpecialHandTagMatch(tags, tag) {
    return hasStrictFeatureSpecialHandTagMatch(tags, tag);
  }

  function hasActorExplicitSpecialHandTag(snapshot, tag) {
    return hasFeatureSpecialHandTagMatch(snapshot?.explicitSpecialHandTags || [], tag);
  }

  function getTechniqueFeatureHandCards() {
    var appState = getOptionalDependency("state");
    var directSource = appState?.battleCards;
    var source = directSource || appState?.duelSpecialCards;
    var cards = Array.isArray(source?.cards) ? source.cards : (Array.isArray(source) ? source : []);
    return cards.filter(function keepFeatureCard(card) {
      if (card?.actionId === "reverse_cursed_technique_output" || card?.cardId === "card_reverse_cursed_technique_output") return false;
      return !isCommonDuelBattleCardDefinition(card) &&
        card?.playableInHandBeta !== false &&
        card?.importableFromMergedPackage !== false &&
        card?.reviewStatus !== "needs_merge" &&
        card?.duplicateStatus !== "exact_duplicate" &&
        card?.draftRole !== "conflict_only";
    });
  }

  function getRawDuelSpecialCards() {
    var appState = getOptionalDependency("state");
    var directSource = appState?.battleCards;
    var source = directSource || appState?.duelSpecialCards;
    return Array.isArray(source?.cards) ? source.cards : (Array.isArray(source) ? source : []);
  }

  function isDirectBattleCardDefinition(card) {
    return Boolean(card && card.effect && card.cost && Array.isArray(card.contexts) && card.effect && card.cost);
  }

  function getDuelBattleCardOwnershipTags(card) {
    return uniqueFeatureList([].concat(toFeatureList(card?.matchTags)));
  }

  function isCommonDuelBattleCardDefinition(card) {
    return getDuelBattleCardOwnershipTags(card).some(function isCommonOwnershipTag(tag) {
      return commonBattleCardOwnershipTags.has(String(tag || "").trim().toLowerCase());
    });
  }

  function getCanonicalDirectBattleCardActionId(card) {
    var explicitActionId = String(card?.actionId || "").trim();
    if (explicitActionId) return explicitActionId;
    var sourceId = String(card?.id || card?.cardId || "").trim();
    if (isCommonDuelBattleCardDefinition(card) && sourceId.indexOf("card_") === 0) {
      return sourceId.slice(5);
    }
    return sourceId;
  }

  function prepareDirectBattleCardHandAction(card) {
    if (!isDirectBattleCardDefinition(card)) return card;
    var directApi = globalThis.JJKBattleDataDirect;
    var commonCard = isCommonDuelBattleCardDefinition(card);
    var mechanicIds = normalizeDuelMechanicIds(card);
    var matchTags = typeof directApi?.getBattleCardMatchTags === "function"
      ? directApi.getBattleCardMatchTags(card)
      : getDuelBattleCardOwnershipTags(card);
    var actionId = getCanonicalDirectBattleCardActionId(card);
    var cardId = String(card?.cardId || card?.id || actionId).trim();
    var techniqueTags = commonCard ? [] : matchTags;
    return prepareDirectBattleCardRuntimeAction({
      ...card,
      ...(card.effect?.special || {}),
      mechanicId: mechanicIds[0] || undefined,
      mechanicIds: mechanicIds,
      id: actionId,
      actionId: actionId,
      cardId: cardId,
      sourceCardId: card?.id || cardId,
      label: card.name || cardId,
      cardType: card.type,
      specialHandCard: !commonCard,
      techniqueFeatureHand: !commonCard,
      sourceTechniqueFamily: commonCard ? "" : String(card?.sourceTechniqueFamily || techniqueTags[0] || "").trim(),
      specialHandTags: techniqueTags,
      "特殊手札": techniqueTags,
      handSource: commonCard ? "battle-direct-common-card" : "battle-direct-card"
    });
  }

  function buildDirectBattleCardActions(actor, battle) {
    var snapshot = getActorFeatureSnapshot(actor, battle);
    var directApi = globalThis.JJKBattleDataDirect;
    if (!directApi || typeof directApi.getBattleCardCandidates !== "function") return [];
    var battleData = { cards: getRawDuelSpecialCards().filter(isDirectBattleCardDefinition) };
    var candidateCharacter = {
      id: actor?.id,
      characterId: actor?.characterId,
      profileId: actor?.profileId,
      profile: actor?.profile || null,
      domainId: actor?.domainId || actor?.profile?.domainId || actor?.domain?.id || actor?.domainProfileId || "",
      domain: actor?.domain || null,
      flags: actor?.flags || actor?.profile?.flags || {},
      cardTags: uniqueFeatureList([].concat(
        toFeatureList(actor?.cardTags),
        toFeatureList(actor?.profile?.cardTags),
        toFeatureList(actor?.characterCardProfile?.cardTags),
        toFeatureList(actor?.duelProfileSnapshot?.cardTags),
        toFeatureList(snapshot?.explicitSpecialHandTags),
        toFeatureList(snapshot?.specialHandTags)
      ))
    };
    return directApi.getBattleCardCandidates(battleData, candidateCharacter, {
      context: "normal",
      includeDomainContext: true,
      actorSnapshot: snapshot
    }).filter(function keepTechniqueOwnedDirectCard(card) {
      // 通用基础牌、领域控制牌与审判防御牌各有独立运行管线；不得再次包装成术式特色手札。
      return !isCommonDuelBattleCardDefinition(card);
    }).map(prepareDirectBattleCardHandAction);
  }

  function getDuelSpecialCardByCardId(cardId) {
    var normalized = String(cardId || "").trim();
    if (!normalized) return null;
    return getRawDuelSpecialCards().find(function findSpecialCard(card) {
      return card?.cardId === normalized || card?.actionId === normalized || card?.id === normalized;
    }) || null;
  }

  function getTechniqueFeatureHandSourceActionIds() {
    var ids = new Set();
    getTechniqueFeatureHandCards().forEach(function collectSpecialSourceId(card) {
      [
        card?.actionId,
        card?.id,
        card?.draftCardId
      ].forEach(function addId(value) {
        var id = String(value || "").trim();
        if (domainControlActionIds.has(id)) return;
        if (id) ids.add(id);
      });
    });
    return ids;
  }

  function isActionTemplateShadowedBySpecialHand(template, specialSourceActionIds) {
    if (!template || !specialSourceActionIds?.size) return false;
    var id = String(template.id || template.actionId || "").trim();
    return Boolean(id && specialSourceActionIds.has(id));
  }

  function pushFeatureTextParts(parts, source) {
    if (!source || typeof source !== "object") return;
    [
      "id",
      "characterId",
      "profileId",
      "name",
      "displayName",
      "stage",
      "technique",
      "techniqueName",
      "techniqueText",
      "techniqueDescription",
      "domainProfile",
      "notes",
      "sourceLayer",
      "officialGrade",
      "visibleGrade",
      "powerTier",
      "externalResource"
    ].forEach(function pushField(field) {
      if (source[field]) parts.push(source[field]);
    });
    if (source.domainScript) {
      parts.push(source.domainScript.id, source.domainScript.domainName, source.domainScript.effectSummary, source.domainScript.scriptType);
      parts.push(...toFeatureList(source.domainScript.effectTags));
    }
    [
      "traits",
      "innateTraits",
      "advancedTechniques",
      "loadout",
      "flags",
      "cardTags",
      "specialHandTags",
      "特殊手札",
      "techniqueFamilies",
      "archetypes"
    ].forEach(function pushList(field) {
      parts.push(...toFeatureList(source[field]));
    });
  }

  function getExplicitFeatureHandTags(source) {
    var explicit = toFeatureList(source?.explicitSpecialHandTags);
    if (explicit.length) return explicit;
    return [].concat(toFeatureList(source?.specialHandTags), toFeatureList(source?.["特殊手札"]));
  }

  function pushFeatureTechniqueEvidenceParts(parts, source) {
    if (!source || typeof source !== "object") return;
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
      "notes",
      "externalResource"
    ].forEach(function pushField(field) {
      if (source[field]) parts.push(source[field]);
    });
    if (source.domainScript) {
      parts.push(source.domainScript.id, source.domainScript.domainName, source.domainScript.effectSummary);
    }
    [
      "traits",
      "innateTraits",
      "advancedTechniques",
      "loadout",
      "flags",
      "specialHandTags",
      "特殊手札",
      "selectedMechanisms",
      "selectedToolTags"
    ].forEach(function pushList(field) {
      parts.push(...toFeatureList(source[field]));
    });
    var selectedLibrary = source.selectedLibrary || {};
    parts.push(...toFeatureList(selectedLibrary.techniques));
    parts.push(...toFeatureList(selectedLibrary.domains));
    parts.push(...toFeatureList(selectedLibrary.advanced));
    parts.push(...toFeatureList(selectedLibrary.resources));
    parts.push(...toFeatureList(selectedLibrary.tools));
    parts.push(...toFeatureList(selectedLibrary.cursedTools));
  }

  function hasFeatureConstructionTechniqueEvidence(text) {
    var value = String(text || "");
    return /构筑术式|真球|液态金属|昆虫铠甲|三重疾苦|禅院真依|真依|yorozu|construction\s+sorcery/i.test(value) ||
      /(^|[\s、，,;；|/／])万($|[\s、，,;；|/／])/i.test(value);
  }

  function stripNegatedFeatureTechniqueOwnershipClauses(value) {
    return String(value || "").replace(
      /(?:并未继承|不继承|未继承|并不具备|不具备|未掌握|没有掌握|不能使用|无法使用|不可使用|不拥有|未拥有|没有)[ \t]*(?:(?![\s。；;!?！？]).){0,120}/gi,
      " "
    );
  }

  function hasFeatureBloodTechniqueEvidence(text) {
    return /赤血操术|穿血|血刃|赤鳞跃动|超新星|苅祓|百敛|胀相|脹相|加茂宪纪|加茂憲紀|blood[_\s-]+manipulation/i.test(stripNegatedFeatureTechniqueOwnershipClauses(text));
  }

  function hasFeatureRikaRingEvidence(text) {
    return /里香戒指|乙骨戒指|里香资源|rika[_\s-]?ring|rika[_\s-]?resource/i.test(String(text || ""));
  }

  function collectFeatureRikaResourceEvidence(source) {
    if (!source || typeof source !== "object") return [];
    var selectedLibrary = source.selectedLibrary || {};
    return []
      .concat(toFeatureList(source.externalResource))
      .concat(toFeatureList(source.selectedToolTags))
      .concat(toFeatureList(selectedLibrary.resources))
      .concat(toFeatureList(selectedLibrary.tools))
      .concat(toFeatureList(selectedLibrary.cursedTools));
  }

  function hasFeatureVolume0TrueRikaEvidence(text) {
    var value = String(text || "");
    if (/不使用0卷真里香|不使用.*真里香|非0卷真里香|不是0卷真里香/i.test(value)) return false;
    return /真里香|0卷[^，。；;|]*里香|volume0[_\s-]?rika|特级过咒怨灵-完全显现/i.test(value);
  }

  function hasFeatureModernYutaRikaEvidence(text) {
    var value = String(text || "");
    if (hasFeatureVolume0TrueRikaEvidence(value)) return false;
    return hasFeatureRikaRingEvidence(value);
    var isYuta = /乙骨忧?太|乙骨|okkotsu|yuta/i.test(value);
    var isModernCue = /正传|新宿|死灭|仙台|真赝相爱|复制术式|复制|copy|authentic[_\s-]?mutual[_\s-]?love/i.test(value);
    return Boolean(isYuta && isModernCue);
  }

  function hasFeatureRctOutputEvidence(text) {
    var value = String(text || "");
    if (/无反转术式外放|没有反转术式外放|不具备反转术式外放|不能反转术式外放|no\s+reverse[_\s-]?output/i.test(value)) return false;
    return /反转术式外放|正能量外放|反转输出|输出反转|reverse[_\s-]?output|rct[_\s-]?output/i.test(value);
  }

  function sanitizeFeatureSpecialHandTags(tags, evidenceText) {
    var normalized = uniqueFeatureList(tags);
    return normalized.filter(function keepTag(tag) {
      if (tag === "construction") return hasFeatureConstructionTechniqueEvidence(evidenceText);
      if (tag === "blood_manipulation") return hasFeatureBloodTechniqueEvidence(evidenceText);
      if (tag === "ten_shadows") return /伏黑惠|megumi|十种影法术|十种影|十影|ten[_\s-]?shadows|嵌合暗翳庭|魔虚罗|魔须罗|mahoraga/i.test(String(evidenceText || ""));
      if (tag === "projection_sorcery") return /投射术式|投射咒法|二十四帧|帧率|直哉|直毘人|projection\s+sorcery/i.test(String(evidenceText || ""));
      if (tag === "star_rage") return /星之怒|虚拟质量|凰轮|黑洞|九十九由基|star\s+rage/i.test(String(evidenceText || ""));
      if (tag === "limitless") return /无下限|五条|苍|赫|茈|limitless|infinity/i.test(String(evidenceText || ""));
      if (tag === "shrine") return /御厨子|伏魔御厨子|宿傩|捌|斩击|shrine|cleave|dismantle/i.test(String(evidenceText || ""));
      return true;
    });
  }

  function getActorFeatureSnapshot(actor, battle) {
    var appState = getOptionalDependency("state");
    var actorId = actor?.profileId || actor?.characterId || actor?.id || "";
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var customCard = Array.isArray(appState?.customDuelCards)
      ? appState.customDuelCards.find(function findCustomCard(card) {
        return card?.characterId === actorId || card?.id === actorId;
      })
      : null;
    var handProfile = null;
    try {
      var handProfileGetter = global.JJKDuelHand?.get?.("buildDuelCharacterCardProfile");
      if (typeof handProfileGetter === "function") handProfile = handProfileGetter(actor) || null;
    } catch (error) {
      handProfile = null;
    }
    var hasLockedIdentityProfile = Boolean(actor?.characterCardProfile || actor?.profile);
    var identitySources = hasLockedIdentityProfile
      ? [actor?.characterCardProfile, actor?.profile, handProfile, customCard]
      : [actor, profile, handProfile, customCard];
    var parts = [];
    identitySources.forEach(function pushIdentityText(source) { pushFeatureTextParts(parts, source); });
    var techniqueEvidenceParts = [];
    identitySources.forEach(function pushIdentityTechniqueEvidence(source) { pushFeatureTechniqueEvidenceParts(techniqueEvidenceParts, source); });
    var techniqueEvidenceText = uniqueFeatureList(techniqueEvidenceParts).join(" ");
    var specialHandTags = uniqueFeatureList(identitySources.flatMap(function collectIdentitySpecialTags(source) {
      return toFeatureList(source?.specialHandTags).concat(toFeatureList(source?.["特殊手札"]));
    }));
    var explicitSpecialHandTags = uniqueFeatureList(identitySources.flatMap(function collectIdentityExplicitTags(source) {
      return getExplicitFeatureHandTags(source);
    }));
    var baseExplicitSpecialHandTags = explicitSpecialHandTags.slice();
    var hasRctOutputAccess = hasFeatureRctOutputEvidence(techniqueEvidenceText);
    if (hasRctOutputAccess) {
      specialHandTags = specialHandTags.filter(function removeRctOutputSpecialTag(tag) {
        return !/^(反转术式外放|reverse_output|rct_output)$/i.test(String(tag || ""));
      });
      explicitSpecialHandTags = explicitSpecialHandTags.filter(function removeExplicitRctOutputSpecialTag(tag) {
        return !/^(反转术式外放|reverse_output|rct_output)$/i.test(String(tag || ""));
      });
    }
    var rikaResourceEvidenceText = uniqueFeatureList([].concat(identitySources.flatMap(function collectIdentityRikaEvidence(source) {
      return collectFeatureRikaResourceEvidence(source);
    }))).join(" ");
    var rikaEvidenceText = [techniqueEvidenceText, rikaResourceEvidenceText, parts.join(" ")].filter(Boolean).join(" ");
    if (hasFeatureVolume0TrueRikaEvidence(rikaEvidenceText)) {
      specialHandTags = specialHandTags.filter(function removeModernRikaTag(tag) {
        return !/^(?:yuta_rika_manifestation_modern|rika_ring)$/i.test(String(tag || ""));
      });
      explicitSpecialHandTags = explicitSpecialHandTags.filter(function removeExplicitModernRikaTag(tag) {
        return !/^(?:yuta_rika_manifestation_modern|rika_ring)$/i.test(String(tag || ""));
      });
      specialHandTags = uniqueFeatureList(specialHandTags.concat(["yuta_rika_manifestation_volume0"]));
      explicitSpecialHandTags = uniqueFeatureList(explicitSpecialHandTags.concat(["yuta_rika_manifestation_volume0"]));
    } else if (hasFeatureModernYutaRikaEvidence(rikaEvidenceText)) {
      specialHandTags = uniqueFeatureList(specialHandTags.concat(["yuta_rika_manifestation_modern", "rika_ring"]));
      explicitSpecialHandTags = uniqueFeatureList(explicitSpecialHandTags.concat(["yuta_rika_manifestation_modern", "rika_ring"]));
    }
    var temporaryTechniqueGrants = getActiveTemporaryTechniqueGrants(actor, battle);
    var temporaryTechniqueTags = temporaryTechniqueGrants.map(function mapTemporaryTechniqueTag(grant) { return grant.tag; });
    if (temporaryTechniqueTags.length) {
      specialHandTags = uniqueFeatureList(specialHandTags.concat(temporaryTechniqueTags));
      explicitSpecialHandTags = uniqueFeatureList(explicitSpecialHandTags.concat(temporaryTechniqueTags));
    }
    parts.push(...specialHandTags);
    var domainEvidenceText = uniqueFeatureList([].concat(identitySources.flatMap(function collectIdentityDomainEvidence(source) {
      return collectActorDomainEvidenceParts(source);
    }))).join(" ");
    var ids = uniqueFeatureList([
      actorId,
      actor?.characterId,
      actor?.profileId,
      actor?.id,
      actor?.name,
      actor?.displayName,
      actor?.profile?.characterId,
      actor?.profile?.id,
      actor?.profile?.displayName,
      profile?.characterId,
      profile?.id,
      profile?.displayName,
      handProfile?.characterId,
      handProfile?.ruleId,
      handProfile?.displayName,
      customCard?.characterId,
      customCard?.id,
      customCard?.displayName
    ]);
    var rawText = uniqueFeatureList(parts).join(" ");
    return {
      ids: ids,
      specialHandTags: specialHandTags,
      explicitSpecialHandTags: explicitSpecialHandTags,
      baseExplicitSpecialHandTags: baseExplicitSpecialHandTags,
      temporaryTechniqueTags: temporaryTechniqueTags,
      temporaryTechniqueGrants: temporaryTechniqueGrants,
      hasRctOutputAccess: hasRctOutputAccess,
      domainText: domainEvidenceText,
      normalizedDomainText: normalizeFeatureText(domainEvidenceText),
      text: rawText,
      normalizedText: normalizeFeatureText(rawText),
      hasInnateTechnique: handProfile?.hasInnateTechnique !== false && !/零咒力|无术式|no_innate_technique/i.test(rawText)
    };
  }

  function splitFeatureOwnerAliases(value) {
    return uniqueFeatureList(String(value || "")
      .split(/[;；、,/／|和与及]+/g)
      .map(function trimAlias(alias) { return alias.replace(/后也使用|继承使用|占据.*后使用|夺取.*后也使用/g, "").trim(); })
      .filter(Boolean));
  }

  function getFeatureCardAliases(card) {
    var family = getFeatureCardFamily(card);
    var configuredAliases = uniqueFeatureList([]
      .concat(toFeatureList(FEATURE_TECHNIQUE_ALIASES[card?.techniqueId]))
      .concat(toFeatureList(FEATURE_TECHNIQUE_ALIASES[family])));
    var techniqueNameAliases = toFeatureList(card?.techniqueName).filter(function keepTechniqueNameAlias(alias) {
      return normalizeFeatureText(alias).length >= 3 || configuredAliases.includes(alias);
    });
    return uniqueFeatureList([]
      .concat(toFeatureList(family))
      .concat(toFeatureList(card?.techniqueId))
      .concat(toFeatureList(card?.sourceTechniqueFamily))
      .concat(toFeatureList(card?.specialHandTags))
      .concat(toFeatureList(card?.["特殊手札"]))
      .concat(techniqueNameAliases)
      .concat(toFeatureList(card?.domainName))
      .concat(splitFeatureOwnerAliases(card?.ownerOrRepresentative))
      .concat(configuredAliases));
  }

  function getFeatureCardFamily(card) {
    return toFeatureList(card?.specialHandTags)[0] ||
      toFeatureList(card?.["特殊手札"])[0] ||
      card?.sourceTechniqueFamily ||
      card?.techniqueFamily ||
      card?.techniqueId ||
      "";
  }

  function getFeatureCardSpecialHandTags(card) {
    return uniqueFeatureList([]
      .concat(toFeatureList(card?.specialHandTags))
      .concat(toFeatureList(card?.["特殊手札"])));
  }

  function getFeatureCardSearchText(card) {
    return [
      card?.cardId,
      card?.actionId,
      card?.id,
      card?.name,
      card?.cardName,
      card?.cardType,
      card?.techniqueId,
      card?.techniqueName,
      card?.domainName,
      card?.effectSummary,
      card?.mechanicId
    ].concat(
      toFeatureList(card?.tags),
      toFeatureList(card?.specialHandTags),
      toFeatureList(card?.["特殊手札"]),
      toFeatureList(card?.contexts)
    ).filter(Boolean).join(" ");
  }

  function isFeatureCardDomainLocked(card) {
    var cardType = String(card?.cardType || card?.type || "").toLowerCase();
    var contexts = toFeatureList(card?.contexts).map(function normalizeContext(context) {
      return String(context || "").trim().toLowerCase();
    });
    var contextSet = new Set(contexts);
    var hasExclusiveDomainContext = !contextSet.has("normal") && !contextSet.has("trial_allowed") && contexts.some(function hasDomainContext(context) {
      return ["domain", "domain_active", "domain_owner", "domain_profile"].includes(context);
    });
    if (card?.actionId === "domain_expand") return false;
    if (["domain", "domain_maintenance"].includes(cardType) && hasExclusiveDomainContext) return true;
    return hasExclusiveDomainContext && contexts.some(function hasDomainOwnerContext(context) {
      return ["domain_active", "domain_owner", "domain_profile"].includes(context);
    });
  }

  function collectActorDomainEvidenceParts(source) {
    if (!source || typeof source !== "object") return [];
    var parts = [];
    ["domainProfile", "domainName"].forEach(function pushField(field) {
      if (source[field]) parts.push(source[field]);
    });
    if (source.domain?.name) parts.push(source.domain.name);
    if (source.domainScript) {
      parts.push(source.domainScript.id, source.domainScript.domainName, source.domainScript.effectSummary, source.domainScript.scriptType);
      parts.push(...toFeatureList(source.domainScript.effectTags));
    }
    return parts;
  }

  function doesDomainLockedFeatureCardMatchActorDomain(card, snapshot) {
    if (!isFeatureCardDomainLocked(card)) return true;
    var domainText = String(snapshot?.domainText || "");
    var normalizedDomainText = normalizeFeatureText(domainText);
    if (!normalizedDomainText || /无领域|没有领域|不具备领域|无明确领域|未公开|未知|no\s*domain/i.test(domainText)) return false;
    var cardText = getFeatureCardSearchText(card);
    var normalizedCardText = normalizeFeatureText(cardText);
    if (/嵌合暗翳庭|shadowgarden|ten[_\s-]?shadows|十种影|十影|伏黑惠|megumi/i.test(cardText)) {
      return /嵌合暗翳庭|shadowgarden|十种影|十影|伏黑惠|megumi/i.test(domainText);
    }
    if (/伏魔御厨子|malevolentshrine|open[_\s-]?domain|开放领域|御厨子|shrine/i.test(cardText)) {
      return /伏魔御厨子|malevolentshrine|开放领域|御厨子|shrine/i.test(domainText);
    }
    if (/无量空处|unlimitedvoid|limitless|五条/i.test(cardText)) return /无量空处|unlimitedvoid|五条/i.test(domainText);
    if (/自闭圆顿裹|idletransfiguration|真人|mahito/i.test(cardText)) return /自闭圆顿裹|idletransfiguration|真人|mahito/i.test(domainText);
    if (/诛伏赐死|deadlysentencing|日车|higuruma/i.test(cardText)) return /诛伏赐死|deadlysentencing|日车|higuruma/i.test(domainText);
    if (/坐杀搏徒|idledeathgamble|jackpot|秤/i.test(cardText)) return /坐杀搏徒|idledeathgamble|秤|jackpot/i.test(domainText);
    if (/真赝相爱|authenticmutuallove|乙骨|okkotsu/i.test(cardText)) return /真赝相爱|authenticmutuallove|乙骨|okkotsu/i.test(domainText);
    if (/荡蕴平线|horizon|captivating|skandha|陀艮|dagon/i.test(cardText)) return /荡蕴平线|horizon|captivating|skandha|陀艮|dagon/i.test(domainText);
    if (toFeatureList(card?.domainName).some(function matchDomainName(name) {
      return normalizeFeatureText(name) && normalizedDomainText.includes(normalizeFeatureText(name));
    })) return true;
    return normalizedCardText && normalizedDomainText.includes(normalizedCardText);
  }

  function getFeatureCardArchetypeRequirements() {
    return [];
  }

  function isFeatureAliasMatch(snapshot, alias) {
    var normalized = normalizeFeatureText(alias);
    if (!normalized) return false;
    var isAscii = /^[a-z0-9]+$/i.test(normalized);
    if (isAscii && normalized.length < 4) return false;
    if (!isAscii && normalized.length < 2 && !["万"].includes(alias)) return false;
    return snapshot.normalizedText.includes(normalized);
  }

  function doesFeatureCardMatchActor(card, snapshot) {
    var cardSpecialHandTags = getFeatureCardSpecialHandTags(card);
    if (!cardSpecialHandTags.length) return false;
    if (!doesDomainLockedFeatureCardMatchActorDomain(card, snapshot)) return false;
    var actorSpecialHandTags = uniqueFeatureList(toFeatureList(snapshot?.explicitSpecialHandTags));
    if (!actorSpecialHandTags.length) return false;
    return cardSpecialHandTags.some(function hasStrictSpecialHandTag(tag) {
      return hasStrictFeatureSpecialHandTagMatch(actorSpecialHandTags, tag);
    });
  }

  function getMythicalBeastAmberActionId(cardOrAction) {
    return String(cardOrAction?.actionId || cardOrAction?.id || cardOrAction?.cardId || "");
  }

  function getMythicalBeastAmberStateRequirement(cardOrAction) {
    return String(cardOrAction?.requirements?.mythicalBeastAmberState || cardOrAction?.mythicalBeastAmberState || "").trim();
  }

  function isMythicalBeastAmberTagged(cardOrAction) {
    var tags = []
      .concat(toFeatureList(cardOrAction?.specialHandTags))
      .concat(toFeatureList(cardOrAction?.["特殊手札"]))
      .concat(toFeatureList(cardOrAction?.tags));
    return tags.includes("mythical_beast_amber") || tags.includes("kashimo_mythical_beast");
  }

  function shouldIncludeMythicalBeastAmberCard(card, actor) {
    if (!isMythicalBeastAmberTagged(card)) return true;
    var id = getMythicalBeastAmberActionId(card);
    var state = getMythicalBeastAmberStateRequirement(card);
    var active = hasActiveMythicalBeastAmber(actor);
    var used = hasUsedMythicalBeastAmber(actor);
    if (id === KASHIMO_MYTHICAL_BEAST_RELEASE_ACTION_ID || state === "release_available") return !used;
    if (KASHIMO_MYTHICAL_BEAST_NORMAL_ACTION_IDS.has(id) || state === "normal") return !active;
    if (KASHIMO_MYTHICAL_BEAST_RELEASED_ACTION_IDS.has(id) || state === "released") return active;
    return true;
  }

  function decorateMythicalBeastAmberAction(action, actor) {
    if (!isMythicalBeastAmberTagged(action)) return action;
    if (action.actionId === "kashimo_lightning_flash_movement" && hasActiveMythicalBeastAmber(actor)) {
      setRuntimeActionEffectNumber(action, "damage", getRuntimeActionNumber(action, "damage") + 6);
      action.hitRateModifier = Number((Number(action.hitRateModifier || 0) + 0.06).toFixed(4));
      action.effects = {
        ...(action.effects || {}),
        evasionBonus: Math.max(Number(action.effects?.evasionBonus || 0), 0.24),
        mythicalBeastAmberFractureDelta: Math.max(1, Number(action.effects?.mythicalBeastAmberFractureDelta || 0))
      };
      action.effectSummary = (action.effectSummary || "") + " 幻兽琥珀解放中：身法强化，但叠加1层琥珀裂解。";
    }
    return action;
  }

  function mapFeatureCardType(intent) {
    var key = String(intent || "").toLowerCase();
    if ([
      "technique",
      "defense",
      "resource",
      "support",
      "summon",
      "domain",
      "rule",
      "basic",
      "special",
      "rule_trial",
      "rule_defense",
      "domain_maintenance",
      "domain_response",
      "curse_tool",
      "jackpot",
      "healing"
    ].includes(key)) return key;
    if (key === "defense") return "defense";
    if (key === "resource") return "resource";
    if (key === "support") return "support";
    if (key === "mobility") return "technique";
    if (key === "summon") return "technique";
    if (key === "soul") return "technique";
    if (key === "control" || key === "rule" || key === "domain") return "technique";
    return "technique";
  }

  function mapFeatureScalingProfile(card, stats) {
    var text = [
      card?.scalingProfile,
      card?.cardIntent,
      card?.cardType,
      card?.mechanicSubtype,
      card?.futureCardType,
      card?.techniqueId,
      card?.techniqueName
    ].concat(toFeatureList(card?.mechanicTags)).join(" ").toLowerCase();
    if (/咒具|cursed_tool|tool/.test(text)) return "cursed_tool";
    if (/体术|physical|melee|strike/.test(text)) return "physical";
    if (/防御|defense|guard|block/.test(text)) return "defense";
    if (/jackpot|赌|坐杀|概率|中奖/.test(text)) return "jackpot_rule";
    if (/审判|trial|verdict|evidence/.test(text)) return "trial_rule";
    if (/领域|domain|barrier/.test(text) && Number(stats?.damage ?? stats?.effect?.damage ?? 0) <= 0) return "domain";
    if (/burst|最大输出|炮|blast/.test(text)) return "ce_burst";
    return "technique";
  }

  function addFeatureNumericDelta(effects, key, delta) {
    var value = Number(delta || 0);
    if (!Number.isFinite(value) || value === 0) return;
    effects[key] = Number((Number(effects[key] || 0) + value).toFixed(4));
  }

  function buildFeatureCardEffects(card, stats) {
    var effects = {
      ...(stats?.proposedEffectFields || {}),
      ...(card?.effects || {})
    };
    var runtimeBlock = Number(stats?.block ?? card?.effect?.block ?? card?.block ?? 0);
    var controlValue = Number(stats?.controlValue ?? card?.controlValue ?? card?.baseStabilityDamage ?? 0);
    var soulDamage = Number(stats?.soulDamage ?? card?.soulDamage ?? card?.baseCeDamage ?? 0);
    var domainLoadDelta = Number(stats?.domainLoadDelta ?? card?.baseDomainLoadDelta ?? card?.domainLoadDelta ?? 0);
    var durationRounds = Math.max(0, Number(stats?.durationRounds ?? card?.durationRounds ?? 0));
    if (runtimeBlock > 0) {
      effects.incomingHpScale = Math.min(
        Number(effects.incomingHpScale || 1),
        Number(clamp(1 - runtimeBlock / 120, 0.62, 0.94).toFixed(4))
      );
      addFeatureNumericDelta(effects, "stabilityDelta", clamp(runtimeBlock / 950, 0.012, 0.052));
    }
    if (controlValue > 0) {
      addFeatureNumericDelta(effects, "opponentStabilityDelta", -clamp(controlValue / 950, 0.008, 0.072));
      effects.opponentStatuses ||= [];
      effects.opponentStatuses.push({
        id: "featureControlPressure",
        label: "特色术式压制",
        rounds: Math.max(1, durationRounds || 1),
        value: controlValue
      });
    }
    if (soulDamage > 0) {
      effects.opponentStatuses ||= [];
      effects.opponentStatuses.push({
        id: "soulPressure",
        label: "灵魂受扰",
        rounds: Math.max(1, durationRounds || 1),
        value: soulDamage
      });
    }
    if (domainLoadDelta) addFeatureNumericDelta(effects, "domainLoadDelta", domainLoadDelta);
    if (durationRounds > 0 && !effects.durationRounds) effects.durationRounds = durationRounds;
    if (!effects.weightDeltas && (card?.cardIntent === "resource" || card?.cardIntent === "support" || card?.cardType === "resource" || card?.cardType === "support")) {
      effects.weightDeltas = { ce_compression: 0.35, defensive_frame: 0.2 };
    }
    return effects;
  }

  function toFeatureNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }

  function buildTechniqueFeatureHandAction(card, actor, snapshot) {
    var stats = card?.balancedRuntimeStats || card?.originalCandidateRuntimeStats || {};
    var family = getFeatureCardFamily(card);
    var displayName = card?.name || card?.cardName || card?.actionId || card?.cardId || "特色手札";
    var actionId = card?.actionId || card?.actionId || card?.draftCardId || card?.cardId || ("feature_" + family + "_" + displayName);
    var damage = toFeatureNumber(stats.damage ?? card?.effect?.damage ?? card?.damage, 0);
    var block = toFeatureNumber(stats.block ?? card?.effect?.block ?? card?.block, 0);
    var controlValue = toFeatureNumber(stats.controlValue ?? card?.controlValue ?? card?.baseStabilityDamage, 0);
    var soulDamage = toFeatureNumber(stats.soulDamage ?? card?.soulDamage ?? card?.baseCeDamage, 0);
    var domainLoadDelta = toFeatureNumber(stats.domainLoadDelta ?? card?.baseDomainLoadDelta ?? card?.domainLoadDelta, 0);
    var baseDomainPressure = toFeatureNumber(stats.baseDomainPressure ?? card?.baseDomainPressure, 0);
    var specialHandTags = getFeatureCardSpecialHandTags(card);
    var isRctOutputCard = Boolean(card?.rctOutput || card?.effects?.rctOutputExternal);
    var domainLocked = isFeatureCardDomainLocked(card);
    var tags = uniqueFeatureList([
      "特色手札",
      "术式",
      "technique_feature",
      family,
      card?.techniqueId,
      card?.techniqueName,
      card?.cardIntent,
      card?.cardType,
      card?.mechanicSubtype
    ].concat(toFeatureList(card?.tags), toFeatureList(card?.mechanicTags)));
    if (card?.soulRelated || soulDamage > 0) tags.push("灵魂");
    if (card?.summonRelated) tags.push("式神");
    if (card?.antiDomainRelated) tags.push("领域应对");
    var summonSpec = card?.summon?.unitId ? {
      unitCardId: card.summon.unitId,
      unitName: card.summon.name,
      placement: card.summon.lane || undefined,
      summonLane: card.summon.lane || undefined,
      zoneLabel: card.summon.name || undefined,
      control: "player_controlled",
      maintenanceCeCost: card.summon.maintenance?.mandatoryWhileAnyUnitTag ? 1 : 0
    } : undefined;
    if (summonSpec?.unitCardId && !summonSpec.unitName) {
      var unitCard = getDuelSpecialCardByCardId(summonSpec.unitCardId);
      summonSpec.unitName = unitCard?.name || card?.unitName || displayName;
    }
    var ceCost = Math.max(0, toFeatureNumber(stats.cost?.ce ?? stats.ceCost ?? card?.cost?.ce ?? card?.ceCost, 0));
    var featureEffect = {
      ...buildFeatureCardEffects(card, stats),
      ...(card?.effect || {}),
      damage: Math.max(0, damage),
      block: Math.max(0, block),
      stabilityDamage: controlValue > 0 ? Math.max(1, Math.round(controlValue)) : 0,
      ceDamage: soulDamage > 0 ? Math.max(1, Math.round(soulDamage)) : 0,
      domainLoadDelta: domainLoadDelta,
      domainPressure: Math.max(0, baseDomainPressure),
      healing: Math.max(0, toFeatureNumber(stats.healing ?? stats.baseHealing ?? card?.effect?.healing ?? card?.healing ?? card?.baseHealing, 0))
    };
    var action = {
      id: actionId,
      actionId: actionId,
      cardId: card?.cardId || ("card_" + actionId),
      label: displayName,
      name: displayName,
      description: card?.effectSummary || card?.summary || card?.shortEffect || card?.effectDraft || card?.longEffect || "按特色术式手札规则结算。",
      cardType: mapFeatureCardType(card?.cardType || card?.cardIntent),
      type: "feature_technique",
      techniqueFeatureHand: !isRctOutputCard,
      specialHandCard: true,
      normalHandOnly: !domainLocked,
      draftCardId: card?.draftCardId || "",
      sourceTechniqueFamily: family,
      techniqueName: card?.techniqueName || "",
      ownerOrRepresentative: card?.ownerOrRepresentative || "",
      tags: tags,
      specialHandTags: specialHandTags,
      "特殊手札": specialHandTags,
      exclusiveToArchetypes: [],
      exclusiveToCharacters: uniqueFeatureList([].concat(toFeatureList(card?.exclusiveToCharacters))),
      exclusiveToVariants: uniqueFeatureList([].concat(toFeatureList(card?.exclusiveToVariants))),
      requiresCe: card?.requiresCe !== false,
      requiresInnateTechnique: !isRctOutputCard && card?.requiresInnateTechnique !== false,
      requiresDomainAccess: Boolean(card?.requiresDomainAccess),
      requiresCursedTool: Boolean(card?.requiresCursedTool || card?.requirements?.requiresCursedTool),
      requiresZeroCe: Boolean(card?.requiresZeroCe || card?.requirements?.requiresZeroCe),
      requirements: {
        domainActive: domainLocked ? true : "any",
        ...(card?.requiresCursedTool || card?.requirements?.requiresCursedTool ? { requiresCursedTool: true } : {}),
        ...(card?.requiresZeroCe || card?.requirements?.requiresZeroCe ? { requiresZeroCe: true } : {}),
        ...(card?.blackRopeCost ? { blackRopeCost: card.blackRopeCost } : {}),
        ...(card?.contractTicketCost ? { contractTicketCost: card.contractTicketCost } : {}),
        ...(card?.contractTicketGain ? { contractTicketGain: card.contractTicketGain } : {}),
        ...(card?.contractTicketMax ? { contractTicketMax: card.contractTicketMax } : {}),
        ...(card?.requirements || {}),
        ...(domainLocked ? { domainActive: true } : {}),
        blocksOnTechniqueImbalance: !isRctOutputCard
      },
      contexts: Array.isArray(card?.contexts) ? card.contexts.slice() : ["normal"],
      apCost: Math.max(1, toFeatureNumber(stats.apCost ?? card?.apCost, 1)),
      cost: { ...(card?.cost || {}), ce: ceCost },
      ceCost: ceCost,
      damage: Math.max(0, damage),
      block: Math.max(0, block),
      baseCePoolScale: Math.max(0, toFeatureNumber(card?.baseCePoolScale, 0)),
      baseCeControlScale: Math.max(0, toFeatureNumber(card?.baseCeControlScale, 0)),
      basePhysicalScale: Math.max(0, toFeatureNumber(card?.basePhysicalScale, ["physical", "zero_ce", "cursed_tool"].includes(card?.scalingProfile || mapFeatureScalingProfile(card, stats)) ? 1 : 0)),
      stabilityDamage: featureEffect.stabilityDamage,
      ceDamage: featureEffect.ceDamage,
      baseShield: Math.max(0, toFeatureNumber(card?.baseShield, 0)),
      baseDefensePressure: Math.max(0, toFeatureNumber(card?.baseDefensePressure, 0)),
      baseEvidencePressure: Math.max(0, toFeatureNumber(card?.baseEvidencePressure, 0)),
      baseStabilityRestore: Math.max(0, toFeatureNumber(card?.baseStabilityRestore, 0)),
      baseCeRestore: Math.max(0, toFeatureNumber(card?.baseCeRestore, 0)),
      baseHpRestore: Math.max(0, toFeatureNumber(card?.baseHpRestore, 0)),
      baseHealing: Math.max(0, toFeatureNumber(stats.baseHealing ?? card?.baseHealing, 0)),
      blackRopeCost: card?.blackRopeCost,
      contractTicketCost: card?.contractTicketCost,
      contractTicketGain: card?.contractTicketGain,
      contractTicketMax: card?.contractTicketMax,
      comedianHumorCost: card?.comedianHumorCost,
      comedianHumorGain: card?.comedianHumorGain,
      comedianColdGain: card?.comedianColdGain,
      comedianColdReduce: card?.comedianColdReduce,
      comedianTabooGain: card?.effect?.special?.comedianTabooGain,
      comedianHumorMax: card?.effect?.special?.comedianHumorMax,
      comedianColdMax: card?.effect?.special?.comedianColdMax,
      kusakabeStanceCost: card?.effect?.special?.kusakabeStanceCost,
      kusakabeStanceGain: card?.effect?.special?.kusakabeStanceGain,
      kusakabeStanceMax: card?.effect?.special?.kusakabeStanceMax,
      disasterResourceKind: card?.effect?.special?.disasterResourceKind,
      disasterResourceCost: card?.effect?.special?.disasterResourceCost ?? 0,
      disasterResourceGain: card?.effect?.special?.disasterResourceGain ?? 0,
      disasterResourceMax: card?.effect?.special?.disasterResourceMax ?? 0,
      tacticalResourceKind: card?.effect?.special?.tacticalResourceKind,
      tacticalResourceCost: card?.effect?.special?.tacticalResourceCost ?? 0,
      tacticalResourceGain: card?.effect?.special?.tacticalResourceGain ?? 0,
      tacticalResourceMax: card?.effect?.special?.tacticalResourceMax ?? 0,
      resourceGainTiming: card?.effect?.special?.resourceGainTiming || "onUse",
      tacticalResourceStrain: Boolean(Boolean(card?.effect?.special?.tacticalResourceStrain)),
      resourceSystemDslOnly: card?.effect?.special?.resourceSystemDslOnly === true,
      contractRecreationDslOnly: card?.contractRecreationDslOnly === true || card?.effect?.special?.contractRecreationDslOnly === true,
      domainLoadDelta: domainLoadDelta,
      domainPressure: Math.max(0, baseDomainPressure),
      durationRounds: Math.max(0, toFeatureNumber(stats.durationRounds ?? card?.durationRounds, 0)),
      damageType: card?.damageType || card?.effect?.damageType || "none",
      scaling: card?.scaling ? { ...card.scaling } : undefined,
      scalingProfile: card?.scalingProfile || mapFeatureScalingProfile(card, stats),
      accuracyProfile: stats.accuracyProfile || card?.accuracyProfile || (damage > 0 ? "technique_projectile" : "none"),
      evasionAllowed: card?.evasionAllowed ?? (stats.evasionAllowed !== false && damage > 0),
      hitRateModifier: toFeatureNumber(stats.hitRateModifier ?? card?.hitRateModifier, 0),
      effect: featureEffect,
      effects: featureEffect,
      // Feature-hand cards author their DSL atoms under effect.special just
      // like direct battle cards.  Preserve them on the normalized action so
      // the common atomic compiler can execute resource/damage effects.
      effectTools: uniqueAtomicEffects([].concat(
        card?.effectTools || [],
        card?.effect?.special?.atomicEffects || []
      )),
      risk: card?.risk || (card?.riskTags?.includes("high") || card?.powerHint === "extreme" ? "high" : (card?.suggestedRarity === "rare" ? "medium" : "low")),
      rarity: card?.rarity || card?.suggestedRarity || "uncommon",
      weight: Number(card?.weight || (card?.cardIntent === "finisher" ? 4.5 : 5.25)),
      guaranteedPerTurn: Boolean(card?.guaranteedPerTurn),
      retainedPermanent: card?.retainedPermanent !== false,
      ignoreHandSelectionLimit: Boolean(card?.ignoreHandSelectionLimit || card?.ignoreSelectionLimit || card?.doesNotCountTowardSelectionLimit),
      doesNotCountTowardSelectionLimit: Boolean(card?.doesNotCountTowardSelectionLimit || card?.ignoreHandSelectionLimit || card?.ignoreSelectionLimit),
      handSource: card?.handSource || "",
      characterHints: [],
      effectSummary: card?.effectSummary || card?.shortEffect || card?.effectDraft || "",
      costType: card?.costType || "",
      ceCostMode: card?.ceCostMode || "",
      mechanicId: card?.mechanicId || "",
      summonSpec: summonSpec,
      mechanismSpec: card?.mechanismSpec ? { ...card.mechanismSpec } : undefined,
      resourceSpec: card?.resourceSpec ? { ...card.resourceSpec } : undefined,
      serviceReceiptRules: card?.serviceReceiptRules ? { ...card.serviceReceiptRules } : undefined,
      massiveObjectRules: card?.massiveObjectRules ? { ...card.massiveObjectRules } : undefined,
      objectRules: card?.objectRules ? { ...card.objectRules } : undefined,
      unitStats: card?.unitStats ? { ...card.unitStats } : undefined,
      blockIgnoreRatio: Math.max(0, Math.min(0.9, Number(card?.blockIgnoreRatio || 0))),
      disableCeControlDamageCorrection: Boolean(card?.disableCeControlDamageCorrection),
      starRageEffect: card?.starRageEffect ?? card?.effect?.special?.starRageEffect ?? card?.effect?.special?.legacy?.starRageEffect,
      starRageDslOnly: card?.starRageDslOnly === true,
      starRageMassCost: card?.starRageMassCost,
      starRageSummonMassCost: card?.starRageSummonMassCost,
      starRageRecallMassCost: card?.starRageRecallMassCost,
      starRageRecallMassGain: card?.starRageRecallMassGain,
      starRageMassGain: card?.starRageMassGain,
      starRageOutgoingScale: card?.starRageOutgoingScale,
      starRageIncomingScale: card?.starRageIncomingScale ?? card?.effect?.special?.starRageIncomingScale,
      starRageIncomingReductionCap: card?.starRageIncomingReductionCap ?? card?.effect?.special?.starRageIncomingReductionCap,
      starRageDamageReductionCap: card?.starRageDamageReductionCap,
      starRageConsumeAllMass: card?.starRageConsumeAllMass ?? card?.effect?.special?.legacy?.starRageConsumeAllMass,
      starRageBlackHoleBaseDamagePerMass: card?.starRageBlackHoleBaseDamagePerMass ?? card?.effect?.special?.legacy?.starRageBlackHoleBaseDamagePerMass,
      starRageBlackHoleBlockIgnorePerMass: card?.starRageBlackHoleBlockIgnorePerMass ?? card?.effect?.special?.legacy?.starRageBlackHoleBlockIgnorePerMass,
      starRageBlackHoleBlockIgnoreOffset: card?.starRageBlackHoleBlockIgnoreOffset ?? card?.effect?.special?.legacy?.starRageBlackHoleBlockIgnoreOffset,
      starRageBlackHoleSelfHpCostBaseRatio: card?.starRageBlackHoleSelfHpCostBaseRatio ?? card?.effect?.special?.legacy?.starRageBlackHoleSelfHpCostBaseRatio,
      starRageBlackHoleSelfHpCostPerMassRatio: card?.starRageBlackHoleSelfHpCostPerMassRatio ?? card?.effect?.special?.legacy?.starRageBlackHoleSelfHpCostPerMassRatio,
      starRageBlackHoleSelfHpCostOffsetRatio: card?.starRageBlackHoleSelfHpCostOffsetRatio ?? card?.effect?.special?.legacy?.starRageBlackHoleSelfHpCostOffsetRatio,
      starRageCeControlDamageScale: card?.starRageCeControlDamageScale,
      starRageCeControlDamageScaleLimit: card?.starRageCeControlDamageScaleLimit,
      starRageCeControlMaxMultiplier: card?.starRageCeControlMaxMultiplier,
      starRageCePoolDamageScale: card?.starRageCePoolDamageScale,
      starRageCePoolMaxMultiplier: card?.starRageCePoolMaxMultiplier,
      starRageMartialDamageScale: card?.starRageMartialDamageScale,
      starRageMartialMaxMultiplier: card?.starRageMartialMaxMultiplier,
      bloodCeCostRatio: card?.bloodCeCostRatio ?? card?.effect?.special?.bloodCeCostRatio,
      bloodHpCostRatio: card?.bloodHpCostRatio ?? card?.effect?.special?.bloodHpCostRatio,
      bloodCeCostReduction: card?.bloodCeCostReduction ?? card?.effect?.special?.bloodCeCostReduction,
      bloodCeControlDamageScale: card?.bloodCeControlDamageScale ?? card?.effect?.special?.bloodCeControlDamageScale,
      bloodCeToBaseDamageScale: card?.bloodCeToBaseDamageScale ?? card?.effect?.special?.bloodCeToBaseDamageScale,
      bloodHpToBaseDamageScale: card?.bloodHpToBaseDamageScale ?? card?.effect?.special?.bloodHpToBaseDamageScale,
      bloodHpCostContributesDamage: card?.bloodHpCostContributesDamage ?? card?.effect?.special?.bloodHpCostContributesDamage,
      bloodOriginalBaseDamageScale: card?.bloodOriginalBaseDamageScale ?? card?.effect?.special?.bloodOriginalBaseDamageScale,
      bloodBoostDamageScale: card?.bloodBoostDamageScale ?? card?.effect?.special?.bloodBoostDamageScale,
      bloodResource: card?.effect?.special?.bloodResource ? { ...card.effect.special.bloodResource } : (card?.bloodResource ? { ...card.bloodResource } : undefined),
      bloodDslOnly: card?.bloodDslOnly === true,
      mythicalBeastAmberDslOnly: card?.mythicalBeastAmberDslOnly === true || card?.effect?.special?.mythicalBeastAmberDslOnly === true,
      mythicalBeastAmberAoeFullDodge: card?.effect?.special?.mythicalBeastAmberAoeFullDodge === true,
      blackBirdDslOnly: card?.blackBirdDslOnly === true,
      curseSpiritDslOnly: card?.curseSpiritDslOnly === true,
      tenShadowsDslOnly: card?.tenShadowsDslOnly === true,
      projectionSorceryDslOnly: card?.projectionSorceryDslOnly === true || card?.effect?.special?.projectionSorceryDslOnly === true,
      genericMechanicDslOnly: card?.genericMechanicDslOnly === true || card?.effect?.special?.genericMechanicDslOnly === true,
      reverseOutputDslOnly: card?.reverseOutputDslOnly === true || card?.effect?.special?.reverseOutputDslOnly === true,
      starRageGarudaUnit: card?.starRageGarudaUnit ? { ...card.starRageGarudaUnit } : undefined,
      projectionSorcery: card?.effect?.special?.projectionSorcery ? { ...card.effect.special.projectionSorcery } : undefined,
      blackBirdSpec: card?.effect?.special?.blackBirdSpec ? { ...card.effect.special.blackBirdSpec } : undefined,
      blackBirdCeControlDamageScale: card?.blackBirdCeControlDamageScale,
      rctOutput: isRctOutputCard,
      specialResolution: card?.specialResolution ? { ...card.specialResolution } : undefined,
      mahoragaProxySpec: card?.mahoragaProxySpec ? { ...card.mahoragaProxySpec } : undefined,
      status: card?.status || "CANDIDATE_RUNTIME_IMPORT"
    };
    var temporaryGrant = (snapshot?.temporaryTechniqueGrants || []).find(function findTemporaryTechniqueGrant(grant) {
      return grant?.tag === family;
    });
    if (temporaryGrant && !toFeatureList(snapshot?.baseExplicitSpecialHandTags).includes(family)) {
      action.temporaryTechniqueSlot = temporaryGrant.slotId;
      action.temporaryTechniqueTag = family;
    }
    if (card?.cardIntent === "finisher") action.risk = action.risk === "high" ? "critical" : "high";
    return action;
  }

  function getFeatureCardRuntimeNumber(card, stats, statKey, fieldKey) {
    return toFeatureNumber(stats?.[statKey] ?? card?.[fieldKey], 0);
  }

  function getFeatureCardSemanticDedupeKey(card) {
    var stats = card?.balancedRuntimeStats || card?.originalCandidateRuntimeStats || {};
    var displayName = card?.name || card?.cardName || card?.actionId || card?.actionId || card?.cardId || "";
    var normalizedName = normalizeFeatureText(displayName);
    if (!normalizedName) return "";
    return [
      normalizedName,
      mapFeatureCardType(card?.cardType || card?.cardIntent),
      toFeatureNumber(stats?.damage ?? card?.effect?.damage ?? card?.damage, 0),
      toFeatureNumber(stats?.block ?? card?.effect?.block ?? card?.block, 0),
      toFeatureNumber(stats?.cost?.ce ?? stats?.ceCost ?? card?.cost?.ce ?? card?.ceCost, 0),
      getFeatureCardRuntimeNumber(card, stats, "baseCePoolScale", "baseCePoolScale"),
      getFeatureCardRuntimeNumber(card, stats, "baseCeControlScale", "baseCeControlScale"),
      getFeatureCardRuntimeNumber(card, stats, "basePhysicalScale", "basePhysicalScale"),
      getFeatureCardRuntimeNumber(card, stats, "controlValue", "baseStabilityDamage"),
      getFeatureCardRuntimeNumber(card, stats, "soulDamage", "baseCeDamage"),
      getFeatureCardRuntimeNumber(card, stats, "domainLoadDelta", "baseDomainLoadDelta"),
      getFeatureCardRuntimeNumber(card, stats, "domainPressure", "baseDomainPressure"),
      getFeatureCardRuntimeNumber(card, stats, "durationRounds", "durationRounds"),
      card?.damageType || "",
      card?.scalingProfile || "",
      card?.accuracyProfile || "",
      normalizeFeatureText(card?.effectSummary || card?.shortEffect || card?.effectDraft || card?.longEffect || "")
    ].join("|");
  }

  function buildTechniqueFeatureHandActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!snapshot?.normalizedText) return [];
    var matched = [];
    var seen = new Set();
    getTechniqueFeatureHandCards().forEach(function collectFeatureCard(card) {
      var family = getFeatureCardFamily(card);
      if (!family || !doesFeatureCardMatchActor(card, snapshot)) return;
      if (!shouldIncludeMythicalBeastAmberCard(card, actor)) return;
      var actionId = card.actionId || card.actionId || card.draftCardId || card.cardId || "";
      var semanticKey = getFeatureCardSemanticDedupeKey(card);
      if (!actionId || seen.has("id:" + actionId) || (semanticKey && seen.has("semantic:" + semanticKey))) return;
      seen.add("id:" + actionId);
      if (semanticKey) seen.add("semantic:" + semanticKey);
      matched.push(decorateMythicalBeastAmberAction(buildTechniqueFeatureHandAction(card, actor, snapshot), actor));
    });
    return matched;
  }

  function applyMythicalBeastAmberRuntimeEffects(action, actor, opponent, battle) {
    if (!isMythicalBeastAmberTagged(action)) return null;
    if (action?.mythicalBeastAmberDslOnly === true) return null;
    var runner = global.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
    if (typeof runner !== "function") return null;
    var result = global.JJKBattleSpecialRuntime.runBattleSpecialEntry("afterCardResolved", {
      abilities: getBattleSpecialAbilitiesForRuntime(),
      battle: battle,
      side: actor?.side || "",
      actor: actor,
      opponent: opponent,
      action: action,
      card: action,
      turn: getDuelActionTurnNumber(battle)
    });
    if (!result?.operations?.length) return null;
    var summary = {};
    result.operations.forEach(function summarizeAmberOperation(operation) {
      if (operation.op === "addStatus" && operation.statusId === "mythicalBeastAmber") summary.released = true;
      if (operation.op === "adjustCounter" && operation.namespace === "mythical_beast_amber" && operation.counterId === "fracture") {
        summary.fractureBefore = operation.valueBefore;
        summary.fractureAfter = operation.valueAfter;
      }
    });
    return Object.keys(summary).length ? summary : { specialRuntime: true };
  }


  function applyMythicalBeastAmberChargeDamage(action, opponent, damage, actor, battle) {
    var runner = global.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
    if (typeof runner !== "function" || !(damage > 0)) return null;
    var result = global.JJKBattleSpecialRuntime.runBattleSpecialEntry("damageModifier", {
      abilities: getBattleSpecialAbilitiesForRuntime(),
      battle: battle,
      side: actor?.side || "",
      actor: actor,
      opponent: opponent,
      action: action,
      card: action,
      damage: damage,
      turn: getDuelActionTurnNumber(battle)
    });
    return result?.damage || null;
  }

  function isCursedSpiritActor(actor, battle, snapshot) {
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var text = [
      snapshot?.text,
      actor?.name,
      actor?.displayName,
      actor?.characterId,
      actor?.officialGrade,
      actor?.powerTier,
      actor?.notes,
      actor?.profile?.officialGrade,
      actor?.profile?.powerTier,
      actor?.profile?.notes,
      actor?.characterCardProfile?.officialGrade,
      actor?.characterCardProfile?.powerTier,
      actor?.characterCardProfile?.notes,
      profile?.officialGrade,
      profile?.powerTier,
      profile?.notes
    ].concat(
      toFeatureList(actor?.specialHandTags),
      toFeatureList(actor?.["特殊手札"]),
      toFeatureList(actor?.profile?.specialHandTags),
      toFeatureList(actor?.profile?.["特殊手札"]),
      toFeatureList(actor?.characterCardProfile?.specialHandTags),
      toFeatureList(actor?.characterCardProfile?.["特殊手札"]),
      toFeatureList(profile?.specialHandTags),
      toFeatureList(profile?.["特殊手札"])
    ).join(" ");
    return /特级咒灵|低级咒灵|咒灵之躯|咒灵，|咒灵\)|咒灵）|（咒灵|\(咒灵|cursed_spirit|cursedspirit|disaster_curse|disastercurse|low_grade_curse|lowgradecurse/i.test(text);
  }

  function getDuelActionIdentityText(action) {
    return [
      action?.id,
      action?.actionId,
      action?.cardId,
      action?.label,
      action?.name,
      action?.description,
      action?.cardType,
      action?.type,
      action?.scalingProfile,
      action?.sourceTechniqueFamily,
      action?.techniqueName,
      action?.ownerOrRepresentative,
      action?.mechanicId
    ].concat(
      toFeatureList(action?.tags),
      toFeatureList(action?.specialHandTags),
      toFeatureList(action?.["特殊手札"]),
      toFeatureList(action?.mechanicIds)
    ).join(" ");
  }

  function hasCopyBlockingRequirement(card) {
    var requirements = card?.requirements;
    if (!requirements || typeof requirements !== "object") return false;
    return Object.values(requirements).some(function hasRequirement(value) {
      if (value == null || value === false || value === "") return false;
      if (typeof value === "number") return Number.isFinite(value) && value > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value).length > 0;
      return Boolean(value);
    });
  }

  function isCopyableTechniqueCard(card, options) {
    if (!isDirectBattleCard(card) || card.playableInHandBeta === false) return false;
    if (card.importableFromMergedPackage === false || card.reviewStatus === "needs_merge" || card.duplicateStatus === "exact_duplicate") return false;
    var identity = getDuelActionIdentityText(card).toLowerCase();
    var tags = uniqueFeatureList([]
      .concat(toFeatureList(card.tags), toFeatureList(card.matchTags), toFeatureList(card.specialHandTags), toFeatureList(card["特殊手札"]))
    ).map(function normalizeCopyTag(tag) { return String(tag || "").toLowerCase(); });
    if (/card_copy_08[56]|feature_copy_08[56]|复制刀抽取|里香武库|rika[_\s-]?arsenal|random_blade/.test(identity)) return false;
    if (tags.some(function isCommonTag(tag) { return ["public_baseline", "domain_access", "trial_defender_common"].includes(tag); })) return false;
    var contexts = toFeatureList(card.contexts).map(function normalizeCopyContext(value) { return String(value || "").toLowerCase(); });
    if (!contexts.includes("normal")) return false;
    var cardType = String(card.type || card.cardType || "").toLowerCase();
    if (["unit", "maintenance", "domain", "domain_maintenance", "rule_trial", "rule_defense", "jackpot"].includes(cardType)) return false;
    if (card?.domain?.action || card?.summon?.unitId || card?.summonSpec?.unitCardId) return false;
    if (hasCopyBlockingRequirement(card)) return false;
    var effect = card.effect || {};
    var numericPayload = ["damage", "ceDamage", "stabilityDamage", "domainLoad", "domainPressure", "healing", "block", "shield"]
      .some(function hasCopyNumber(key) { return Number(effect[key] || 0) !== 0; });
    var operationPayload = toFeatureList(effect.effects).some(function hasCopyOperation(operation) {
      return operation && !["modifyWeight", "unlockCard"].includes(String(operation.op || ""));
    });
    var specialPayload = Boolean(effect.special && typeof effect.special === "object" && Object.keys(effect.special).length);
    if (!numericPayload && !operationPayload && !specialPayload) return false;
    if (options?.attacksOnly && Number(effect.damage || 0) <= 0) return false;
    return true;
  }

  function getCopyableTechniqueCardPool(options) {
    return getRawDuelSpecialCards().filter(function keepCopyableCard(card) {
      return isCopyableTechniqueCard(card, options || {});
    });
  }

  function hashCopySelectionSeed(value) {
    var text = String(value || "copy-technique");
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function pickCopyableTechniqueCard(battle, side, token, options) {
    var pool = getCopyableTechniqueCardPool(options || {});
    if (!pool.length) return null;
    var poolIdentity = pool.map(function mapCopyId(card) { return card.id || card.cardId || card.actionId || ""; }).join(",");
    var seed = [battle?.seed, battle?.onlineBattleSeed, battle?.battleId, side, token, getDuelActionTurnNumber(battle), poolIdentity].filter(Boolean).join("|");
    return pool[hashCopySelectionSeed(seed) % pool.length] || pool[0] || null;
  }

  function isCopiedTechniqueSpecialResourceCard(card) {
    var text = getDuelActionIdentityText(card).toLowerCase();
    if (/blood_manipulation|赤血操术|穿血|血刃|百敛|超新星|赤鳞跃动|胀相|脹相|加茂宪纪|加茂憲紀/.test(text)) return false;
    return /star_rage|星之怒|虚拟质量|black_bird_manipulation|黑鸟操术|乌羽|projection_sorcery|投射术式|投射咒法|帧率|maximum_uzumaki|极之番.*涡|咒灵操术/.test(text);
  }

  function isCopyBladeDrawAction(action) {
    return Boolean(action?.legacyCopyBladeDraw === true && !action.copyBladeResolvedTechnique);
  }

  function buildCopyBladeResolvedAction(action, actor, battle) {
    var sourceCard = pickCopyableTechniqueCard(battle, actor?.side || "", action?.id || action?.actionId || "copy_blade", { attacksOnly: true });
    if (!sourceCard) return null;
    var prepared = prepareDirectBattleCardRuntimeAction(cloneDuelPlain(sourceCard));
    var sourceCost = Math.max(0, getBattleRuntimeActionCostCe(action, actor));
    var sourceHpCost = Math.max(0, Number(action?.cost?.hp || action?.hpCost || 0));
    var specialResourceBypass = isCopiedTechniqueSpecialResourceCard(prepared);
    return {
      ...prepared,
      copyBladeResolvedTechnique: true,
      copyBladeCopiedTechnique: true,
      copyBladeSourceActionId: action?.id || action?.actionId || "card_copy_086",
      copyBladeOriginalCardId: sourceCard.id || sourceCard.cardId || sourceCard.actionId || "",
      generatedBy: "复制刀抽取",
      label: "复制刀·" + (sourceCard.name || prepared.label || prepared.id),
      name: "复制刀·" + (sourceCard.name || prepared.name || prepared.id),
      apCost: Math.max(0, Number(action?.apCost ?? action?.cost?.ap ?? 2)),
      ceCost: sourceCost,
      costCe: sourceCost,
      baseCeCost: sourceCost,
      cost: { ...(prepared.cost || {}), ap: Math.max(0, Number(action?.apCost ?? action?.cost?.ap ?? 2)), ce: sourceCost, hp: sourceHpCost },
      rikaArsenalCopiedSpecialResourceBypass: specialResourceBypass,
      rikaArsenalCopyDamageScale: specialResourceBypass ? 0.5 : 1,
      effects: {
        ...(prepared.effects || {}),
        rikaArsenalCopiedSpecialResourceBypass: specialResourceBypass,
        rikaArsenalCopyDamageScale: specialResourceBypass ? 0.5 : 1
      }
    };
  }

  function isRikaArsenalAction(action) {
    if (isRikaArsenalCopiedAction(action)) return false;
    if (action?.effects?.rikaArsenalNextTurnSpecialHand || action?.rikaArsenalNextTurnSpecialHand) return true;
    return /里香武库|rika[_\s-]?arsenal/i.test(getDuelActionIdentityText(action));
  }

  function isRikaArsenalCopiedAction(action) {
    if (!action) return false;
    if (action.copyBladeCopiedTechnique || action.effects?.copyBladeCopiedTechnique) return true;
    if (action.rikaArsenalFreeUse || action.effects?.rikaArsenalFreeUse) return true;
    return action.handSource === "rika-arsenal-free-special" || action.generatedBy === "里香武库" || /rika_arsenal_free/.test(String(action.id || action.actionId || ""));
  }

  function isRikaArsenalCopiedSpecialResourceAction(action) {
    if (!isRikaArsenalCopiedAction(action) || isBloodManipulationAction(action)) return false;
    return Boolean(
      action.rikaArsenalCopiedSpecialResourceBypass ||
      isStarRageAction(action) ||
      isBlackBirdManipulationAction(action) ||
      isProjectionSorceryAction(action) ||
      isMaximumUzumakiAction(action)
    );
  }

  function getRikaArsenalCopyDamageScale(action) {
    return isRikaArsenalCopiedSpecialResourceAction(action) ? 0.5 : 1;
  }

  function scheduleRikaArsenalDraw(action, actor, battle) {
    if (!action || !actor || !battle) return null;
    var side = actor.side || "";
    if (!side) return null;
    var currentRound = getDuelActionTurnNumber(battle);
    var triggerRound = currentRound + 1;
    battle.rikaArsenalPending ||= {};
    battle.rikaArsenalPending[side] ||= [];
    var pending = {
      id: ["rika_arsenal", side, currentRound, battle.rikaArsenalPending[side].length + 1].join("_"),
      side: side,
      createdRound: currentRound,
      triggerRound: triggerRound,
      actionId: action.actionId || action.id || "",
      label: "里香武库",
      consumed: false
    };
    var drawnCard = pickCopyableTechniqueCard(battle, side, pending.id, { attacksOnly: false });
    if (drawnCard) {
      pending.drawnCardId = drawnCard.id || drawnCard.cardId || drawnCard.actionId || "";
      pending.drawnName = drawnCard.name || drawnCard.label || pending.drawnCardId;
      pending.authorizationId = [pending.id, pending.drawnCardId, triggerRound].join(":");
      pending.expiresAfterRound = triggerRound;
    }
    battle.rikaArsenalPending[side].push(pending);
    actor.statusEffects ||= [];
    actor.statusEffects.push({
      id: "rikaArsenalPending",
      label: "里香武库待展开",
      rounds: 1,
      value: 1,
      triggerRound: triggerRound,
      actionId: action.actionId || action.id || ""
    });
    battle.actionUiMessage = "里香武库已经打开：下个回合将随机调取一张全角色特殊手札，且本次打出不消耗咒力。";
    return pending;
  }

  function normalizeDuelActionCost(cost) {
    return Number.isFinite(Number(cost)) ? Math.max(0, Number(cost)) : 0;
  }

  function isReverseCursedTechniqueAction(action) {
    if (action?.rctHealing) return true;
    if (String(action?.specialConstitutionEffect || action?.effect?.special?.specialConstitutionEffect || "") === "curse_positive_energy_shell") return false;
    var text = getDuelActionIdentityText(action).toLowerCase();
    if (/curse_regen|咒灵再生/.test(text)) return false;
    return /反转术式|rct|reverse_output|reverse_cursed_technique|正能量|疗伤|治疗/.test(text);
  }

  function isReverseCursedTechniqueOutputAction(action) {
    if (action?.rctOutput || action?.rctOutputExternal || action?.effects?.rctOutputExternal) return true;
    if (action?.summonSpec?.unitCardId || String(action?.cardType || action?.type || "").toLowerCase() === "summon") return false;
    if (isDirectBattleCard(action)) return false;
    var text = getDuelActionIdentityText(action).toLowerCase();
    return /reverse_output|rct_output|反转输出|反转术式外放|正能量外放|输出反转/.test(text);
  }

  function isCurseRegenerationAction(action) {
    var text = getDuelActionIdentityText(action).toLowerCase();
    return /curse_regen|咒灵再生/.test(text) || (/咒灵/.test(text) && /再生/.test(text));
  }

  function isTenShadowsSpecialHandAction(action) {
    var tags = uniqueFeatureList([]
      .concat(toFeatureList(action?.specialHandTags))
      .concat(toFeatureList(action?.["特殊手札"])));
    if (hasFeatureSpecialHandTagMatch(tags, "ten_shadows")) return true;
    var idText = [
      action?.id,
      action?.actionId,
      action?.cardId
    ].filter(Boolean).join(" ");
    return /mahoraga_tuning_ritual|ten_shadows_mahoraga|unit_mahoraga/i.test(idText);
  }

  function isBlackRopeAction(action) {
    var id = String(action?.actionId || action?.id || action?.cardId || "");
    if (BLACK_ROPE_ACTION_COSTS[id]) return true;
    var text = getDuelActionIdentityText(action);
    return /black_rope|黑绳|黒縄/.test(text);
  }

  function getBlackRopeCost(action) {
    var id = String(action?.actionId || action?.id || action?.cardId || "");
    return Math.max(0, Number(BLACK_ROPE_ACTION_COSTS[id] || action?.blackRopeCost || action?.requirements?.blackRopeCost || 0));
  }

  function getBlackRopeState(battle, side) {
    if (!battle || !side) return { length: BLACK_ROPE_DEFAULT_LENGTH, maxLength: BLACK_ROPE_DEFAULT_LENGTH };
    var state = createDuelCounterView(battle, side, "black_rope", {
      length: { counterId: "length", initial: BLACK_ROPE_DEFAULT_LENGTH, min: 0, max: BLACK_ROPE_DEFAULT_LENGTH, label: "黑绳长度" },
      maxLength: { counterId: "length", field: "max", initial: BLACK_ROPE_DEFAULT_LENGTH, min: 0, max: BLACK_ROPE_DEFAULT_LENGTH, label: "黑绳长度" }
    });
    state.maxLength = Math.max(0, Number(state.maxLength || BLACK_ROPE_DEFAULT_LENGTH));
    state.length = Math.max(0, Math.min(state.maxLength, Number(state.length ?? state.maxLength)));
    return state;
  }

  function getBlackRopeActionAvailability(action, actor, battle) {
    if (!isBlackRopeAction(action)) return { available: true, reason: "" };
    var cost = getBlackRopeCost(action);
    if (cost <= 0) return { available: true, reason: "" };
    var state = getBlackRopeState(battle, actor?.side || "");
    if (Number(state.length || 0) < cost) return { available: false, reason: "黑绳长度不足" };
    return { available: true, reason: "" };
  }

  function consumeBlackRopeForAction(action, actor, battle) {
    if (!isBlackRopeAction(action)) return null;
    var cost = getBlackRopeCost(action);
    if (cost <= 0) return null;
    var state = getBlackRopeState(battle, actor?.side || "");
    var before = Number(state.length || 0);
    state.length = Math.max(0, before - cost);
    return {
      lengthBefore: before,
      lengthAfter: state.length,
      cost: cost,
      maxLength: Number(state.maxLength || BLACK_ROPE_DEFAULT_LENGTH)
    };
  }

  function isContractTicketAction(action) {
    var id = String(action?.actionId || action?.id || action?.cardId || "");
    if (CONTRACT_TICKET_ACTION_COSTS[id] || CONTRACT_TICKET_ACTION_GAINS[id]) return true;
    if (Number(action?.contractTicketCost || action?.requirements?.contractTicketCost || 0) > 0) return true;
    if (Number(action?.contractTicketGain || action?.requirements?.contractTicketGain || 0) > 0) return true;
    var text = getDuelActionIdentityText(action);
    return /contract_recreation|recontract_icon|再契象|收据|收據|票据|票據|服务收据|服務收據|receipt|recontract/i.test(text);
  }

  function getContractTicketCost(action) {
    var id = String(action?.actionId || action?.id || action?.cardId || "");
    return Math.max(0, Number(CONTRACT_TICKET_ACTION_COSTS[id] || action?.contractTicketCost || action?.requirements?.contractTicketCost || 0));
  }

  function getContractTicketGain(action) {
    var id = String(action?.actionId || action?.id || action?.cardId || "");
    return Math.max(0, Number(CONTRACT_TICKET_ACTION_GAINS[id] || action?.contractTicketGain || action?.requirements?.contractTicketGain || 0));
  }

  function getContractTicketMax(action, state) {
    return Math.max(1, Number(action?.contractTicketMax || action?.requirements?.contractTicketMax || state?.maxTickets || CONTRACT_TICKET_DEFAULT_MAX));
  }

  function getContractTicketState(battle, side) {
    if (!battle || !side) return { tickets: 0, maxTickets: CONTRACT_TICKET_DEFAULT_MAX };
    var state = createDuelCounterView(battle, side, "contract_recreation", {
      tickets: { counterId: "tickets", initial: 0, min: 0, max: CONTRACT_TICKET_DEFAULT_MAX, label: "契约票据" },
      maxTickets: { counterId: "tickets", field: "max", initial: 0, min: 0, max: CONTRACT_TICKET_DEFAULT_MAX, label: "契约票据" }
    });
    state.maxTickets = Math.max(1, Number(state.maxTickets || CONTRACT_TICKET_DEFAULT_MAX));
    state.tickets = Math.max(0, Math.min(state.maxTickets, Number(state.tickets || 0)));
    return state;
  }

  function getContractTicketActionAvailability(action, actor, battle) {
    if (action?.contractRecreationDslOnly === true) return { available: true, reason: "" };
    if (!isContractTicketAction(action)) return { available: true, reason: "" };
    var state = getContractTicketState(battle, actor?.side || "");
    var cost = getContractTicketCost(action);
    if (cost > 0 && Number(state.tickets || 0) < cost) return { available: false, reason: "契约票据不足" };
    return { available: true, reason: "" };
  }

  function applyContractTicketsForAction(action, actor, battle) {
    if (action?.contractRecreationDslOnly === true) return null;
    if (!isContractTicketAction(action)) return null;
    var side = actor?.side || "";
    var state = getContractTicketState(battle, side);
    var maxTickets = getContractTicketMax(action, state);
    state.maxTickets = Math.max(state.maxTickets, maxTickets);
    var before = Number(state.tickets || 0);
    var cost = Math.min(before, getContractTicketCost(action));
    var afterCost = Math.max(0, before - cost);
    var gain = getContractTicketGain(action);
    state.tickets = Math.max(0, Math.min(state.maxTickets, afterCost + gain));
    var result = {
      ticketsBefore: before,
      ticketsAfter: state.tickets,
      cost: cost,
      gain: gain,
      maxTickets: Number(state.maxTickets || CONTRACT_TICKET_DEFAULT_MAX)
    };
    if (cost > 0 || gain > 0) {
      recordDuelResourceChange(battle, {
        side: side,
        title: "契约票据",
        detail: (action.label || action.name || action.id || "再契象") + "：" + (cost > 0 ? ("消耗 " + cost + " 张") : "") + (cost > 0 && gain > 0 ? "，" : "") + (gain > 0 ? ("补充 " + gain + " 张") : "") + "，当前 " + state.tickets + "/" + state.maxTickets + "。",
        type: "resource",
        delta: { contractTickets: Number((state.tickets - before).toFixed(1)), before: before, after: state.tickets }
      });
    }
    return result;
  }

  function applyDirectDomainActionRuntime(action, actor, opponent, battle, directResolution) {
    var runtime = action?.directDomainActionRuntime;
    if (!runtime || !actor || !opponent || !battle) return null;
    var result = {
      domainId: runtime.domainId || "",
      actionId: runtime.actionId || "",
      selfStabilityDelta: 0,
      automaticDamage: 0,
      automaticDamageApplied: 0
    };
    var selfStabilityDelta = finiteDuelNumber(runtime.selfStabilityDelta, 0);
    if (selfStabilityDelta) {
      var stabilityBefore = finiteDuelNumber(actor.stability, 0);
      actor.stability = Number(clamp(stabilityBefore + selfStabilityDelta, 0, 1).toFixed(4));
      result.selfStabilityDelta = Number((actor.stability - stabilityBefore).toFixed(4));
    }
    var automaticDamageScale = Math.max(0, finiteDuelNumber(runtime.automaticDamageScale, 0));
    var automaticDamage = automaticDamageScale > 0 && Number.isFinite(Number(directResolution?.domainPressure))
      ? Math.max(0, Number(directResolution.domainPressure) * automaticDamageScale)
      : Math.max(0, finiteDuelNumber(runtime.automaticDamage, 0));
    if (automaticDamage > 0) {
      var damageTarget = resolveDuelDamageTarget(action, actor, opponent, battle, {
        damage: automaticDamage,
        summonUnitAttack: true
      });
      var damageApplication = applyDuelStandardDamageToTarget(damageTarget, automaticDamage, battle, {
        actor: actor,
        opponent: opponent,
        action: action,
        sourceKind: "summon",
        sourceLabel: runtime.actionLabel || action.label || action.name || "式神自动攻击"
      });
      result.automaticDamage = Number(automaticDamage.toFixed(3));
      result.automaticDamageApplied = Number(damageApplication?.applied || 0);
      result.damageApplication = damageApplication || undefined;
    }
    var logger = getOptionalDependency("recordDuelResourceChange");
    if (typeof logger === "function" && (result.selfStabilityDelta || result.automaticDamageApplied)) {
      logger(battle, {
        side: actor.side || "left",
        title: runtime.actionLabel || runtime.domainName || "领域手法",
        detail: (result.automaticDamageApplied ? ("式神自动攻击造成 " + result.automaticDamageApplied.toFixed(1) + " 点伤害") : "")
          + (result.automaticDamageApplied && result.selfStabilityDelta ? "；" : "")
          + (result.selfStabilityDelta ? ("未完成领域使自身稳定 " + result.selfStabilityDelta.toFixed(4)) : "") + "。",
        type: "domain",
        delta: {
          automaticDamage: result.automaticDamageApplied,
          selfStability: result.selfStabilityDelta,
          domainActionId: result.actionId
        }
      });
    }
    return result;
  }

  function isActorUnderHardClosePressure(actor) {
    if (!actor) return false;
    var closePressureIds = [
      "closeQuartersLocked",
      "trackedByZeroCe",
      "chainBound",
      "delayedByGrapple",
      "hardClosePressure",
      "meleePressure",
      "forcedCloseRange",
      "zeroCePursuit"
    ];
    return closePressureIds.some(function hasClosePressure(id) {
      return getDuelStatusEffectValue(actor, id) > 0;
    });
  }

  function isAngelTechniqueAction(action) {
    var text = getDuelActionIdentityText(action);
    return /jacobs_ladder|雅各布天梯|术式消灭|術式消滅|净化照射|淨化照射|天使之翼|结界破坏|結界破壞/i.test(text);
  }

  function isAngelVulnerableTarget(target, battle) {
    if (!target) return false;
    if (isDuelCurseTarget(target)) return true;
    var targetProfiles = [
      target,
      target.characterCardProfile,
      target.duelProfileSnapshot,
      target.profile,
      target.snapshot
    ].filter(Boolean);
    if (targetProfiles.some(function hasAngelVulnerableFlag(profile) {
      var flags = profile?.flags || {};
      return profile?.isIncarnated === true
        || profile?.isCurse === true
        || profile?.isCursedObject === true
        || flags.isIncarnated === true
        || flags.isCurse === true
        || flags.isCurseSpirit === true
        || flags.isCursedObject === true;
    })) return true;
    var text = [
      target.characterId,
      target.id,
      target.name,
      target.displayName,
      target.officialGrade,
      target.powerTier,
      target.techniqueName,
      target.techniqueText,
      target.techniqueDescription,
      target.externalResource,
      target.notes,
      target.domain?.name,
      target.domainProfile
    ].concat(
      toFeatureList(target.specialHandTags),
      toFeatureList(target["特殊手札"]),
      toFeatureList(target.innateTraits),
      toFeatureList(target.traits),
      toFeatureList(target.loadout)
    ).filter(Boolean).join(" ");
    if (/受肉|incarnat|咒物|呪物|宿傩|宿儺|sukuna|curse[_\s-]?object|cursed[_\s-]?object|咒灵|呪霊/i.test(text)) return true;
    return getDuelBattlefieldUnitsForSide(battle, target.side || "").length > 0;
  }

  function isAngelTechniqueTarget(target) {
    if (!target) return false;
    var profiles = [
      target,
      target.characterCardProfile,
      target.duelProfileSnapshot,
      target.profile,
      target.snapshot
    ].filter(Boolean);
    if (profiles.some(function hasTechniqueEvidence(profile) {
      var flags = profile?.flags || {};
      return profile?.hasInnateTechnique === true
        || flags.hasInnateTechnique === true
        || Boolean(profile?.techniqueName || profile?.techniqueText || profile?.techniqueDescription)
        || Boolean(profile?.domain?.name || profile?.domainProfile);
    })) return true;
    return (target.statusEffects || []).some(function isTechniqueStatus(status) {
      return /technique|術式|术式|domain|領域|领域/i.test(String(status?.id || "") + " " + String(status?.label || ""));
    });
  }

  function getRuntimeActionNumber(action, key) {
    if (!action) return 0;
    if (key === "damage") return Number(action.effect?.damage ?? action.damage ?? 0);
    if (key === "block") return Number(action.effect?.block ?? action.block ?? 0);
    if (key === "stabilityDamage") return Number(action.effect?.stabilityDamage ?? action.stabilityDamage ?? 0);
    if (key === "domainPressure") return Number(action.effect?.domainPressure ?? action.domainPressure ?? 0);
    if (key === "ceDamage") return Number(action.effect?.ceDamage ?? action.ceDamage ?? 0);
    if (key === "healing") return Number(action.effect?.healing ?? action.healing ?? 0);
    return Number(action[key] ?? 0);
  }

  function setRuntimeActionEffectNumber(action, key, value) {
    if (!action) return action;
    action.effect = { ...(action.effect || {}) };
    var number = Math.max(0, Number(value || 0));
    action.effect[key] = number;
    if (key === "damage" || key === "block") action[key] = number;
    else action[key] = number;
    return action;
  }

  function scaleRuntimeActionEffectNumber(action, key, multiplier) {
    var current = getRuntimeActionNumber(action, key);
    if (current > 0) setRuntimeActionEffectNumber(action, key, Math.round(current * Number(multiplier || 1)));
  }

  function getAngelRuntimeAction(action, actor, opponent, battle) {
    if (!isAngelTechniqueAction(action)) return action;
    var next = { ...action, effects: { ...(action.effects || {}) } };
    var vulnerable = isAngelVulnerableTarget(opponent, battle);
    var techniqueTarget = isAngelTechniqueTarget(opponent);
    var isExtinguishmentAction = /jacobs_ladder|angel_purifying|angel_barrier|雅各布天梯|术式剥离|術式剥離|净化照射|结界破坏|結界破壞/i.test(String(next.id || "") + " " + String(next.actionId || "") + " " + String(next.label || ""));
    if (vulnerable && isExtinguishmentAction) {
      scaleRuntimeActionEffectNumber(next, "damage", 1.16);
      next.hitRateModifier = Number((Number(next.hitRateModifier || 0) + 0.08).toFixed(4));
      setRuntimeActionEffectNumber(next, "domainPressure", getRuntimeActionNumber(next, "domainPressure") + 12);
    }
    if (techniqueTarget && isExtinguishmentAction) {
      next.effects.opponentStatuses = (next.effects.opponentStatuses || []).concat([{
        id: "angelTargetSuppressed",
        label: "术式消灭压制",
        rounds: 1,
        value: 1,
        techniqueWeightScale: 0.78,
        domainLoadScale: 1.12
      }]);
    }
    next.angelRuntime = {
      active: true,
      vulnerable: vulnerable,
      techniqueTarget: techniqueTarget,
      enhanced: vulnerable && isExtinguishmentAction
    };
    if (/angel_wing_retreat|天使之翼撤离/.test(String(next.id || "") + " " + String(next.label || "")) && isActorUnderHardClosePressure(actor)) {
      scaleRuntimeActionEffectNumber(next, "block", 0.58);
      next.effects.evasionBonus = Number((Number(next.effects.evasionBonus || 0) * 0.55).toFixed(4));
      next.effectSummary = (next.effectSummary || next.description || "") + "（被强近身压制时撤离收益下降。）";
    }
    return next;
  }

  function isComedianAction(action) {
    if (!action) return false;
    var idText = String(action.actionId || action.id || action.cardId || "");
    var tagText = toFeatureList(action.specialHandTags).concat(toFeatureList(action["特殊手札"]), toFeatureList(action.tags)).join(" ");
    return /comedian/i.test(idText) || /(?:^|\s)comedian(?:\s|$)|超人术式|笑点/i.test(tagText);
  }

  function getComedianState(battle, side) {
    if (!battle || !side) return { humor: 0, cold: 0, taboo: 0, humorMax: COMEDIAN_DEFAULT_HUMOR_MAX, coldMax: COMEDIAN_DEFAULT_COLD_MAX };
    var state = createDuelCounterView(battle, side, "comedian", {
      humor: { counterId: "humor", initial: 0, min: 0, max: COMEDIAN_DEFAULT_HUMOR_MAX, label: "笑点" },
      humorMax: { counterId: "humor", field: "max", initial: 0, min: 0, max: COMEDIAN_DEFAULT_HUMOR_MAX, label: "笑点" },
      cold: { counterId: "cold", initial: 0, min: 0, max: COMEDIAN_DEFAULT_COLD_MAX, label: "冷场负担" },
      coldMax: { counterId: "cold", field: "max", initial: 0, min: 0, max: COMEDIAN_DEFAULT_COLD_MAX, label: "冷场负担" },
      taboo: { counterId: "taboo", initial: 0, min: 0, label: "禁忌负担" }
    });
    state.humorMax = Math.max(1, Number(state.humorMax || COMEDIAN_DEFAULT_HUMOR_MAX));
    state.coldMax = Math.max(1, Number(state.coldMax || COMEDIAN_DEFAULT_COLD_MAX));
    state.humor = clamp(Number(state.humor || 0), 0, state.humorMax);
    state.cold = clamp(Number(state.cold || 0), 0, state.coldMax);
    state.taboo = Math.max(0, Number(state.taboo || 0));
    return state;
  }

  function getComedianActionAvailability(action, actor, battle) {
    if (!isComedianAction(action)) return { available: true };
    var cost = Math.max(0, Number(action?.comedianHumorCost || action?.requirements?.comedianHumorCost || 0));
    if (!cost) return { available: true };
    var state = getComedianState(battle, actor?.side || "");
    if (Number(state.humor || 0) < cost) return { available: false, reason: "笑点不足" };
    return { available: true };
  }

  function applyComedianForAction(action, actor, battle) {
    if (!isComedianAction(action)) return null;
    var state = getComedianState(battle, actor?.side || "");
    var before = { humor: Number(state.humor || 0), cold: Number(state.cold || 0), taboo: Number(state.taboo || 0) };
    if (Number(action?.comedianHumorMax || 0) > 0) state.humorMax = Math.max(state.humorMax, Number(action.comedianHumorMax));
    if (Number(action?.comedianColdMax || 0) > 0) state.coldMax = Math.max(state.coldMax, Number(action.comedianColdMax));
    state.humor = clamp(
      Number(state.humor || 0) - Math.max(0, Number(action?.comedianHumorCost || 0)) + Math.max(0, Number(action?.comedianHumorGain || 0)),
      0,
      Number(state.humorMax || COMEDIAN_DEFAULT_HUMOR_MAX)
    );
    state.cold = clamp(
      Number(state.cold || 0) + Math.max(0, Number(action?.comedianColdGain || 0)) - Math.max(0, Number(action?.comedianColdReduce || 0)),
      0,
      Number(state.coldMax || COMEDIAN_DEFAULT_COLD_MAX)
    );
    state.taboo = Math.max(0, Number(state.taboo || 0) + Number(action?.comedianTabooGain || 0));
    return {
      before: before,
      after: { humor: Number(state.humor || 0), cold: Number(state.cold || 0), taboo: Number(state.taboo || 0) },
      delta: {
        humor: Number((Number(state.humor || 0) - before.humor).toFixed(1)),
        cold: Number((Number(state.cold || 0) - before.cold).toFixed(1)),
        taboo: Number((Number(state.taboo || 0) - before.taboo).toFixed(1))
      }
    };
  }

  function getComedianRuntimeAction(action, actor, battle) {
    if (!isComedianAction(action)) return action;
    var state = getComedianState(battle, actor?.side || "");
    var humor = Number(state.humor || 0);
    var cold = Number(state.cold || 0);
    var next = { ...action, effects: { ...(action.effects || {}) } };
    var damageScale = Math.max(0.68, 1 + humor * 0.06 - cold * 0.08);
    var blockScale = Math.max(0.72, 1 + humor * 0.05 - cold * 0.07);
    scaleRuntimeActionEffectNumber(next, "damage", damageScale);
    scaleRuntimeActionEffectNumber(next, "block", blockScale);
    scaleRuntimeActionEffectNumber(next, "stabilityDamage", Math.max(0.78, 1 + humor * 0.04 - cold * 0.05));
    if (cold >= 3) {
      next.hitRateModifier = Number((Number(next.hitRateModifier || 0) - 0.08).toFixed(4));
      next.effectSummary = (next.effectSummary || next.description || "") + "（冷场过高，成功率下降。）";
    }
    return next;
  }

  function isKusakabeAction(action) {
    if (!action) return false;
    var idText = String(action.actionId || action.id || action.cardId || "");
    var tagText = toFeatureList(action.specialHandTags).concat(toFeatureList(action["特殊手札"]), toFeatureList(action.tags)).join(" ");
    return /kusakabe_/i.test(idText) || /simple_domain_sword|kusakabe_guard/i.test(tagText);
  }

  function getKusakabeState(battle, side) {
    if (!battle || !side) return { stance: 0, maxStance: KUSAKABE_DEFAULT_STANCE_MAX };
    var state = createDuelCounterView(battle, side, "kusakabe", {
      stance: { counterId: "stance", initial: 0, min: 0, max: KUSAKABE_DEFAULT_STANCE_MAX, label: "新阴流架势" },
      maxStance: { counterId: "stance", field: "max", initial: 0, min: 0, max: KUSAKABE_DEFAULT_STANCE_MAX, label: "新阴流架势" }
    });
    state.maxStance = Math.max(1, Number(state.maxStance || KUSAKABE_DEFAULT_STANCE_MAX));
    state.stance = clamp(Number(state.stance || 0), 0, state.maxStance);
    return state;
  }

  function getKusakabeActionAvailability(action, actor, battle) {
    if (!isKusakabeAction(action)) return { available: true };
    var cost = Math.max(0, Number(action?.kusakabeStanceCost || action?.requirements?.kusakabeStanceCost || 0));
    if (!cost) return { available: true };
    var state = getKusakabeState(battle, actor?.side || "");
    if (Number(state.stance || 0) < cost) return { available: false, reason: "架势稳定不足" };
    return { available: true };
  }

  function applyKusakabeForAction(action, actor, battle) {
    if (!isKusakabeAction(action)) return null;
    var state = getKusakabeState(battle, actor?.side || "");
    var before = Number(state.stance || 0);
    if (Number(action?.kusakabeStanceMax || 0) > 0) state.maxStance = Math.max(state.maxStance, Number(action.kusakabeStanceMax));
    state.stance = clamp(
      Number(state.stance || 0) - Math.max(0, Number(action?.kusakabeStanceCost || 0)) + Math.max(0, Number(action?.kusakabeStanceGain || 0)),
      0,
      Number(state.maxStance || KUSAKABE_DEFAULT_STANCE_MAX)
    );
    return {
      before: before,
      after: Number(state.stance || 0),
      delta: Number((Number(state.stance || 0) - before).toFixed(1))
    };
  }

  function getKusakabeRuntimeAction(action, actor, opponent, battle) {
    if (!isKusakabeAction(action)) return action;
    var state = getKusakabeState(battle, actor?.side || "");
    var stance = Number(state.stance || 0);
    var next = { ...action, effects: { ...(action.effects || {}) } };
    scaleRuntimeActionEffectNumber(next, "block", 1 + stance * 0.045);
    scaleRuntimeActionEffectNumber(next, "damage", 1 + stance * 0.04);
    if (opponent?.domain?.active || isDuelOpponentDomainThreat(opponent, actor, battle)) {
      if (/simple_domain|简易领域|kusakabe_simple_domain_guard/i.test(String(next.id || "") + " " + String(next.label || ""))) {
        scaleRuntimeActionEffectNumber(next, "block", 1.18);
        setRuntimeActionEffectNumber(next, "domainPressure", getRuntimeActionNumber(next, "domainPressure") + 10);
        next.effects.sureHitScale = Math.min(Number(next.effects.sureHitScale || 0.62), 0.42);
      }
    }
    return next;
  }

  function isDisasterEnvironmentAction(action) {
    if (!action) return false;
    if (action.disasterResourceKind || action.disasterResourceCost || action.disasterResourceGain) return true;
    var tags = toFeatureList(action.specialHandTags).concat(toFeatureList(action["特殊手札"]), toFeatureList(action.tags)).join(" ");
    return /disaster_flames|disaster_plants|disaster_tides|smallpox_deity_countdown/i.test(tags);
  }

  function normalizeDisasterResourceKind(kind) {
    var value = String(kind || "").trim();
    if (["flameHeat", "curseSeeds", "seaLayers", "poxCountdown"].includes(value)) return value;
    return "";
  }

  function getDisasterResourceMaxForKind(kind) {
    if (kind === "poxCountdown") return 3;
    return DISASTER_RESOURCE_DEFAULT_MAX;
  }

  function isSmallpoxCountdownAction(action) {
    if (!action) return false;
    if (normalizeDisasterResourceKind(action.disasterResourceKind) === "poxCountdown") return true;
    var tags = toFeatureList(action.specialHandTags).concat(toFeatureList(action["特殊手札"]), toFeatureList(action.tags)).join(" ");
    return /smallpox_deity_countdown/i.test(tags);
  }

  function getSmallpoxDomainAvailability(action, actor, battle) {
    if (!isSmallpoxCountdownAction(action)) return { available: true };
    var side = actor?.side || "";
    var state = battle?.domainProfileStates?.[side];
    if (!actor?.domain?.active) return { available: false, reason: "疱疮神领域尚未展开" };
    var domainClass = String(state?.domainClass || state?.profile?.domainClass || state?.profile?.type || state?.profile?.domainScript?.scriptType || "");
    if (state?.ownerSide !== side || domainClass !== "countdown_execution") {
      return { available: false, reason: "当前领域不是疱疮神的三刻处刑领域" };
    }
    if (state.specialEffectEffective !== true) {
      return { available: false, reason: "疱疮神领域效果已被反制" };
    }
    return { available: true };
  }

  function getDisasterResourceState(battle, side, kind, action) {
    kind = normalizeDisasterResourceKind(kind);
    if (!battle || !side || !kind) return { amount: 0, max: getDisasterResourceMaxForKind(kind) };
    var maximum = getDisasterResourceMaxForKind(kind);
    var state = createDuelCounterView(battle, side, "disaster", {
      amount: { counterId: kind, initial: 0, min: 0, max: maximum, label: kind },
      max: { counterId: kind, field: "max", initial: 0, min: 0, max: maximum, label: kind }
    });
    state.amount = clamp(Number(state.amount || 0), 0, state.max);
    return state;
  }

  function getDisasterResourceAvailability(action, actor, battle) {
    if (!isDisasterEnvironmentAction(action)) return { available: true };
    var kind = normalizeDisasterResourceKind(action?.disasterResourceKind);
    if (action?.disasterResourceKind && !kind) return { available: false, reason: "灾害资源类型无效" };
    var cost = Math.max(0, Number(action?.disasterResourceCost || action?.requirements?.disasterResourceCost || 0));
    if (!kind || !cost) return { available: true };
    var state = getDisasterResourceState(battle, actor?.side || "", kind, action);
    if (Number(state.amount || 0) < cost) return { available: false, reason: "灾害资源不足" };
    return { available: true };
  }

  function applyDisasterResourceForAction(action, actor, battle) {
    if (!isDisasterEnvironmentAction(action)) return null;
    var kind = normalizeDisasterResourceKind(action?.disasterResourceKind);
    if (!kind) return null;
    var state = getDisasterResourceState(battle, actor?.side || "", kind, action);
    var before = Number(state.amount || 0);
    var cost = Math.max(0, Number(action?.disasterResourceCost || 0));
    var gain = Math.max(0, Number(action?.disasterResourceGain || 0));
    var gainTiming = action?.resourceGainTiming === "onHit" ? "onHit" : "onUse";
    var appliedGain = gainTiming === "onHit" ? 0 : gain;
    state.amount = clamp(before - cost + appliedGain, 0, Number(state.max || getDisasterResourceMaxForKind(kind)));
    return {
      kind: kind,
      cost: cost,
      gain: gain,
      gainTiming: gainTiming,
      appliedGain: appliedGain,
      pendingGain: gainTiming === "onHit" ? gain : 0,
      before: before,
      after: Number(state.amount || 0),
      max: Number(state.max || getDisasterResourceMaxForKind(kind)),
      delta: Number((Number(state.amount || 0) - before).toFixed(1))
    };
  }

  function settleDeferredDisasterResourceGain(result, actor, battle) {
    if (!result || result.gainTiming !== "onHit" || Number(result.pendingGain || 0) <= 0) return result;
    var state = getDisasterResourceState(battle, actor?.side || "", result.kind, null);
    var beforeGain = Number(state.amount || 0);
    state.amount = clamp(beforeGain + Number(result.pendingGain || 0), 0, Number(result.max || state.max || getDisasterResourceMaxForKind(result.kind)));
    result.appliedGain = Number((Number(state.amount || 0) - beforeGain).toFixed(1));
    result.pendingGain = 0;
    result.after = Number(state.amount || 0);
    result.delta = Number((result.after - Number(result.before || 0)).toFixed(1));
    return result;
  }

  function applyDuelLifeDrainAfterDamage(action, actor, opponent, damageTarget, damageApplication, battle) {
    var hpRatio = Math.max(0, finiteDuelNumber(action?.lifeDrainHpRatio ?? action?.effects?.lifeDrainHpRatio, 0));
    var hpCap = Math.max(0, finiteDuelNumber(action?.lifeDrainHpCap ?? action?.effects?.lifeDrainHpCap, 0));
    var ceRestore = Math.max(0, finiteDuelNumber(action?.lifeDrainCeRestore ?? action?.effects?.lifeDrainCeRestore, 0));
    if (hpRatio <= 0 && ceRestore <= 0) return null;
    var damageApplied = damageTarget?.type === "character" ? Math.max(0, finiteDuelNumber(damageApplication?.applied, 0)) : 0;
    var result = {
      active: true,
      triggered: false,
      damageApplied: Number(damageApplied.toFixed(1)),
      hpRatio: Number(hpRatio.toFixed(4)),
      hpCap: Number(hpCap.toFixed(1)),
      hpRestored: 0,
      ceRestored: 0,
      reason: ""
    };
    if (damageApplied <= 0) {
      result.reason = damageTarget?.type === "character" ? "no_applied_damage" : "non_character_target";
      return result;
    }
    if (isDuelResourceDefeated(actor, battle)) {
      result.reason = "actor_defeated";
      return result;
    }
    var hpBefore = Number(actor?.hp || 0);
    var ceBefore = Number(actor?.ce || 0);
    var requestedHp = damageApplied * hpRatio;
    if (hpCap > 0) requestedHp = Math.min(requestedHp, hpCap);
    if (requestedHp > 0 && Number(actor?.maxHp || 0) > 0) {
      actor.hp = Number(clamp(
        hpBefore + requestedHp,
        0,
        getDuelActionTemporaryResourceCap(actor, "hp", "maxHp", "temporaryHpOverCap")
      ).toFixed(1));
    }
    if (ceRestore > 0 && Number(actor?.maxCe || 0) > 0) {
      actor.ce = Number(clamp(
        ceBefore + ceRestore,
        0,
        getDuelActionTemporaryResourceCap(actor, "ce", "maxCe", "temporaryCeOverCap")
      ).toFixed(1));
    }
    result.triggered = true;
    result.hpRestored = Math.max(0, Number((Number(actor?.hp || 0) - hpBefore).toFixed(1)));
    result.ceRestored = Math.max(0, Number((Number(actor?.ce || 0) - ceBefore).toFixed(1)));
    result.reason = "damage_drain";
    upsertDuelStatusEffect(opponent, {
      id: "lifeDrained",
      label: "生命吸收",
      rounds: 1,
      value: 1
    });
    recordDuelResourceChange(battle, {
      side: actor?.side || "",
      title: "生命吸收",
      detail: getDuelResourceSideLabel(actor?.side || "") + (actor?.name || "施术者") +
        "从 " + Number(damageApplied.toFixed(1)) + " 点实际伤害中恢复体势 " + result.hpRestored +
        "、咒力 " + result.ceRestored + "。",
      type: "special",
      delta: {
        lifeDrainDamageApplied: result.damageApplied,
        lifeDrainHpRestored: result.hpRestored,
        lifeDrainCeRestored: result.ceRestored
      }
    });
    return result;
  }

  function getDisasterRuntimeAction(action, actor, opponent, battle) {
    if (!isDisasterEnvironmentAction(action)) return action;
    var next = { ...action, effects: { ...(action.effects || {}) } };
    if (actor?.domain?.active && /disaster_tides|smallpox_deity_countdown|disaster_flames|disaster_plants/.test(toFeatureList(next.specialHandTags).join(" "))) {
      scaleRuntimeActionEffectNumber(next, "domainPressure", 1.14);
      if (getRuntimeActionNumber(next, "damage") > 0 && /domain|sure/i.test(String(next.damageType || "") + " " + String(next.accuracyProfile || ""))) {
        scaleRuntimeActionEffectNumber(next, "damage", 1.08);
      }
    }
    if (next.disasterResourceKind === "flameHeat") {
      var heat = Number(getDisasterResourceState(battle, actor?.side || "", "flameHeat", next).amount || 0);
      scaleRuntimeActionEffectNumber(next, "damage", 1 + heat * 0.025);
    }
    if (next.disasterResourceKind === "curseSeeds") {
      var seeds = Number(getDisasterResourceState(battle, actor?.side || "", "curseSeeds", next).amount || 0);
      scaleRuntimeActionEffectNumber(next, "block", 1 + seeds * 0.025);
      scaleRuntimeActionEffectNumber(next, "healing", 1 + seeds * 0.035);
    }
    return next;
  }

  function isTacticalHumanResourceAction(action) {
    if (action?.resourceSystemDslOnly === true) return false;
    return Boolean(action?.tacticalResourceKind || action?.tacticalResourceCost || action?.tacticalResourceGain);
  }

  function normalizeTacticalHumanResourceKind(kind) {
    var text = String(kind || "").trim();
    return Object.prototype.hasOwnProperty.call(TACTICAL_HUMAN_RESOURCE_MAXIMA, text) ? text : "";
  }

  var TACTICAL_HUMAN_RESOURCE_MAXIMA = Object.freeze({
    ratioWeakpoint: 4,
    throatStrain: 6,
    boogieTempo: 5,
    constructionMaterial: 6,
    nailMarks: 5,
    iceLayers: 6,
    skyFold: 6,
    graniteCharge: 6,
    cursedObjectSediment: 6,
    pandaCoreCharge: 5,
    rikaManifestSustain: 5,
    miracleStockpile: 3
  });

  function getTacticalHumanResourceMax(action, kind) {
    var normalizedKind = normalizeTacticalHumanResourceKind(kind || action?.tacticalResourceKind);
    return TACTICAL_HUMAN_RESOURCE_MAXIMA[normalizedKind] || TACTICAL_HUMAN_RESOURCE_DEFAULT_MAX;
  }

  function getTacticalHumanCounterAddress(kind) {
    if (kind === "rikaManifestSustain") return { namespace: "rika_manifestation", counterId: "sustain", label: "完全显现维持" };
    if (kind === "miracleStockpile") return { namespace: "miracles", counterId: "stockpile", label: "奇迹储备" };
    return { namespace: "tactical_resource", counterId: kind, label: kind };
  }

  function getTacticalHumanResourceState(battle, side, kind, action) {
    var normalizedKind = normalizeTacticalHumanResourceKind(kind);
    if (!battle || !side || !normalizedKind) return { amount: 0, max: getTacticalHumanResourceMax(action, normalizedKind) };
    var maximum = getTacticalHumanResourceMax(action, normalizedKind);
    var address = getTacticalHumanCounterAddress(normalizedKind);
    var state = createDuelCounterView(battle, side, address.namespace, {
      amount: { counterId: address.counterId, initial: 0, min: 0, max: maximum, label: address.label },
      max: { counterId: address.counterId, field: "max", initial: 0, min: 0, max: maximum, label: address.label }
    });
    state.amount = clamp(Number(state.amount || 0), 0, state.max);
    return state;
  }

  function getDuelHarutaBossMechanic(battle) {
    var context = battle?.activityContext || {};
    var mechanic = context.bossMechanic && typeof context.bossMechanic === "object"
      ? context.bossMechanic
      : null;
    if (String(context.bossMechanicId || mechanic?.id || "") !== "haruta_miracle_hunt") return null;
    return mechanic || { id: "haruta_miracle_hunt" };
  }

  function isDuelHarutaBossResource(resource, battle) {
    return Boolean(resource && resource.side === "right" && getDuelHarutaBossMechanic(battle));
  }

  function getDuelMiracleStockpile(battle, side) {
    return Number(getTacticalHumanResourceState(battle, side, "miracleStockpile", null).amount || 0);
  }

  function setDuelMiracleStockpile(battle, side, amount) {
    var state = getTacticalHumanResourceState(battle, side, "miracleStockpile", null);
    state.amount = clamp(Number(amount || 0), 0, Number(state.max || TACTICAL_HUMAN_RESOURCE_MAXIMA.miracleStockpile));
    return Number(state.amount || 0);
  }

  function canDuelResourceConsumeMiracle(resource, battle) {
    if (!resource || Number(resource.hp || 0) > 0) return false;
    var snapshot = getActorFeatureSnapshot(resource, battle);
    var hasMiracleTechnique = hasActorExplicitSpecialHandTag(snapshot, "miracles");
    if (!hasMiracleTechnique && !isDuelHarutaBossResource(resource, battle)) return false;
    return getDuelMiracleStockpile(battle, resource.side || "") > 0;
  }

  function applyDuelMiracleLethalPrevention(resource, battle, metadata) {
    if (!canDuelResourceConsumeMiracle(resource, battle)) return null;
    var side = resource.side || metadata?.side || "";
    var beforeStock = getDuelMiracleStockpile(battle, side);
    var afterStock = setDuelMiracleStockpile(battle, side, beforeStock - 1);
    var attemptedHp = Number(resource.hp || 0);
    var preventedLethalDamage = Math.max(0, Number((1 - attemptedHp).toFixed(1)));
    var mechanic = getDuelHarutaBossMechanic(battle) || {};
    var incomingScale = Math.max(1, Number(mechanic.miracleShockIncomingHpScale || 1.35));
    var outgoingScale = clamp(Number(mechanic.miracleShockOutgoingScale || 0.75), 0.05, 1);
    resource.hp = 1;
    resource.statusEffects = (Array.isArray(resource.statusEffects) ? resource.statusEffects : []).filter(function removePreviousMiracleDisplay(effect) {
      return !["harutaMiracleShock", "harutaMiraclesExhausted"].includes(effect?.id);
    });
    resource.statusEffects.push({
      id: "harutaMiracleShock",
      label: "惊魂未定（承伤提高" + Math.round((incomingScale - 1) * 100) + "%、伤害降低" + Math.round((1 - outgoingScale) * 100) + "%）",
      category: "负面状态",
      rounds: 2,
      value: 1,
      incomingHpScale: incomingScale,
      outgoingScale: outgoingScale,
      stacks: 1,
      miracleFollowupWindow: true
    });
    if (afterStock <= 0) {
      resource.statusEffects.push({
        id: "harutaMiraclesExhausted",
        label: "幸运耗尽（下一次致死伤害将正常生效）",
        category: "机制状态",
        rounds: 999,
        value: 1,
        stacks: 1
      });
    }
    var result = {
      triggered: true,
      side: side,
      beforeStock: beforeStock,
      afterStock: afterStock,
      hpBeforeDamage: Number(metadata?.beforeHp || 0),
      attemptedDamage: Math.max(0, Number(metadata?.damage || 0)),
      attemptedHp: attemptedHp,
      hpAfter: 1,
      preventedLethalDamage: preventedLethalDamage
    };
    battle.miracleLog ||= [];
    battle.miracleLog.unshift({
      round: Number(battle.round || 0) + 1,
      ...result,
      source: String(metadata?.source || "damage-packet")
    });
    recordDuelResourceChange(battle, {
      side: side,
      title: "奇迹改写致死",
      detail: getDuelResourceSideLabel(side) + (resource.name || "目标") + "的奇迹储备 " + beforeStock + "→" + afterStock + "；本应降至 " + Number(attemptedHp.toFixed(1)) + " 点体势的结果被改写为 1，并暴露追击破绽。",
      type: "special",
      delta: {
        miracleStockBefore: beforeStock,
        miracleStockAfter: afterStock,
        preventedLethalDamage: preventedLethalDamage,
        hpAfter: 1
      }
    });
    showDuelFloatingCombatText(battle, "奇迹 " + beforeStock + "→" + afterStock, "special", side);
    return result;
  }

  function resolveDuelMiracleLethalPreventionForBattle(battle) {
    if (!battle) return [];
    var resources = [battle?.resourceState?.p1 || battle.left, battle?.resourceState?.p2 || battle.right].filter(Boolean);
    return resources.map(function preventLethalBypass(resource) {
      return applyDuelMiracleLethalPrevention(resource, battle, {
        side: resource.side || "",
        beforeHp: Math.max(0, Number(resource.hp || 0)),
        damage: Math.max(0, 1 - Number(resource.hp || 0)),
        source: "battle-end-safety-net"
      });
    }).filter(Boolean);
  }

  function getDuelActivityBossMechanicDamageScale(action, actor, opponent, battle) {
    var mahoragaResolver = global.JJKShibuyaIncident?.getSukunaMahoragaAdaptationDamageScale;
    if (typeof mahoragaResolver === "function") {
      var mahoragaAdjustment = mahoragaResolver(action, actor, opponent, battle);
      if (mahoragaAdjustment?.applied) {
        return {
          scale: Math.max(0, Number(mahoragaAdjustment.scale || 1)),
          reason: String(mahoragaAdjustment.reason || "mahoraga_phenomenon_adapted"),
          phenomenon: String(mahoragaAdjustment.phenomenon || ""),
          phenomenonLabel: String(mahoragaAdjustment.phenomenonLabel || "")
        };
      }
    }
    var mechanic = getDuelHarutaBossMechanic(battle);
    if (!mechanic || !actor || !opponent) return { scale: 1, reason: "" };
    if (actor.side === "right") {
      var threshold = clamp(Number(mechanic.weakTargetThreshold || 0), 0, 1);
      var hpRatio = Number(opponent.maxHp || 0) > 0 ? Number(opponent.hp || 0) / Number(opponent.maxHp || 1) : 1;
      if (threshold > 0 && hpRatio <= threshold) {
        return {
          scale: Math.max(1, Number(mechanic.weakTargetDamageMultiplier || 1)),
          reason: "haruta_weak_target_hunt"
        };
      }
    }
    if (actor.side === "left" && String(battle?.activityContext?.actorId || "") === "nanami") {
      var targetHasShock = (Array.isArray(opponent.statusEffects) ? opponent.statusEffects : []).some(function hasMiracleShock(effect) {
        return effect?.id === "harutaMiracleShock" && isDuelStatusEffectActive(effect, battle);
      });
      var actionText = [action?.id, action?.actionId, action?.cardId, action?.label, action?.name]
        .concat(toFeatureList(action?.tags), toFeatureList(action?.specialHandTags))
        .filter(Boolean).join(" ");
      if (targetHasShock && /ratio|十划|十劃|七三|七：三|七:三/i.test(actionText)) {
        return {
          scale: Math.max(1, Number(mechanic.nanamiRatioFollowupMultiplier || 1)),
          reason: "nanami_ratio_miracle_followup"
        };
      }
    }
    return { scale: 1, reason: "" };
  }

  function getTacticalHumanResourceAvailability(action, actor, battle) {
    if (!isTacticalHumanResourceAction(action)) return { available: true };
    var kind = normalizeTacticalHumanResourceKind(action.tacticalResourceKind);
    if (!kind) return { available: false, reason: "战术资源类型无效" };
    var harutaMechanic = getDuelHarutaBossMechanic(battle);
    if (kind === "miracleStockpile" && isDuelHarutaBossResource(actor, battle) && harutaMechanic?.finiteMiracles !== false && harutaMechanic?.disableActiveMiracleCards) {
      return { available: false, reason: "本场奇迹库存固定，仅在致死时自动消耗" };
    }
    var state = getTacticalHumanResourceState(battle, actor?.side || "", kind, action);
    var amount = Number(state.amount || 0);
    var cost = Math.max(0, Number(action.tacticalResourceCost || 0));
    var gain = Math.max(0, Number(action.tacticalResourceGain || 0));
    if (cost > amount) {
      var shortageReason = kind === "cursedObjectSediment"
        ? "沉淀咒物不足（需要" + cost + "层，当前" + amount + "层）"
        : (kind === "pandaCoreCharge"
          ? "核心资源不足（需要" + cost + "层，当前" + amount + "层）"
          : "战术资源不足");
      return { available: false, reason: shortageReason };
    }
    if (action.tacticalResourceStrain && gain > 0 && amount + gain > Number(state.max || 0)) {
      return { available: false, reason: "负荷过高，无法继续强行使用" };
    }
    return { available: true };
  }

  function applyTacticalHumanResourceForAction(action, actor, battle) {
    if (!isTacticalHumanResourceAction(action)) return null;
    var kind = normalizeTacticalHumanResourceKind(action.tacticalResourceKind);
    if (!kind) return null;
    var state = getTacticalHumanResourceState(battle, actor?.side || "", kind, action);
    var before = Number(state.amount || 0);
    var cost = Math.max(0, Number(action.tacticalResourceCost || 0));
    var gain = Math.max(0, Number(action.tacticalResourceGain || 0));
    var gainTiming = action?.resourceGainTiming === "onHit" ? "onHit" : "onUse";
    var appliedGain = gainTiming === "onHit" ? 0 : gain;
    state.amount = clamp(before - cost + appliedGain, 0, Number(state.max || getTacticalHumanResourceMax(action, kind)));
    return {
      kind: kind,
      cost: cost,
      gain: gain,
      gainTiming: gainTiming,
      appliedGain: appliedGain,
      pendingGain: gainTiming === "onHit" ? gain : 0,
      before: before,
      after: Number(state.amount || 0),
      delta: Number((Number(state.amount || 0) - before).toFixed(1)),
      max: Number(state.max || 0)
    };
  }

  function settleDeferredTacticalHumanResourceGain(result, actor, battle) {
    if (!result || result.gainTiming !== "onHit" || Number(result.pendingGain || 0) <= 0) return result;
    var state = getTacticalHumanResourceState(battle, actor?.side || "", result.kind, null);
    var beforeGain = Number(state.amount || 0);
    state.amount = clamp(beforeGain + Number(result.pendingGain || 0), 0, Number(result.max || state.max || getTacticalHumanResourceMax(null, result.kind)));
    result.appliedGain = Number((Number(state.amount || 0) - beforeGain).toFixed(1));
    result.pendingGain = 0;
    result.after = Number(state.amount || 0);
    result.delta = Number((result.after - Number(result.before || 0)).toFixed(1));
    return result;
  }

  function getTacticalHumanRuntimeAction(action, actor, opponent, battle) {
    if (!isTacticalHumanResourceAction(action)) return action;
    var kind = normalizeTacticalHumanResourceKind(action.tacticalResourceKind);
    var state = getTacticalHumanResourceState(battle, actor?.side || "", kind, action);
    var amount = Number(state.amount || 0);
    var next = { ...action, effects: { ...(action.effects || {}) } };
    if (kind === "ratioWeakpoint" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.055);
      next.blockIgnoreRatio = Math.max(Number(next.blockIgnoreRatio || 0), Math.min(0.35, amount * 0.06));
    }
    if (kind === "nailMarks" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "ceDamage", 1 + amount * 0.08);
      if (getRuntimeActionNumber(next, "damage") > 0 && /soul/i.test(String(next.damageType || "") + String(next.label || ""))) {
        scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.06);
      }
    }
    if (kind === "boogieTempo" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "block", 1 + amount * 0.045);
      next.hitRateModifier = Number(next.hitRateModifier || 0) + Math.min(0.12, amount * 0.02);
    }
    if (kind === "pandaCoreCharge" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.04);
      scaleRuntimeActionEffectNumber(next, "block", 1 + amount * 0.04);
    }
    if (kind === "constructionMaterial" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.06);
      scaleRuntimeActionEffectNumber(next, "block", 1 + amount * 0.035);
      if (/真球|perfect|sphere/i.test(String(next.label || "") + String(next.name || ""))) {
        next.blockIgnoreRatio = Math.max(Number(next.blockIgnoreRatio || 0), Math.min(0.55, 0.18 + amount * 0.07));
      }
    }
    if (kind === "skyFold" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "block", 1 + amount * 0.055);
      next.hitRateModifier = Number(next.hitRateModifier || 0) + Math.min(0.14, amount * 0.025);
      next.effects.evasionBonus = Math.max(Number(next.effects.evasionBonus || 0), Math.min(0.22, amount * 0.04));
    }
    if (kind === "graniteCharge" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.075);
      scaleRuntimeActionEffectNumber(next, "stabilityDamage", 1 + amount * 0.055);
    }
    if (kind === "iceLayers" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "stabilityDamage", 1 + amount * 0.065);
      scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.045);
      next.hitRateModifier = Number(next.hitRateModifier || 0) + Math.min(0.14, amount * 0.025);
    }
    if (kind === "rikaManifestSustain" && amount > 0) {
      scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.055);
      scaleRuntimeActionEffectNumber(next, "block", 1 + amount * 0.035);
    }
    if (kind === "cursedObjectSediment" && amount > 0) {
      if (getRuntimeActionNumber(next, "damage") > 0) scaleRuntimeActionEffectNumber(next, "damage", 1 + amount * 0.065);
      scaleRuntimeActionEffectNumber(next, "block", 1 + amount * 0.04);
      if (/黑闪|black[_\s-]?flash/i.test(String(next.damageType || "") + String(next.label || "") + String(next.name || ""))) {
        next.hitRateModifier = Number(next.hitRateModifier || 0) + Math.min(0.1, amount * 0.02);
      }
      if (/反领域|anti[_\s-]?domain/i.test(String(next.damageType || "") + String(next.label || "") + String(next.name || ""))) {
        setRuntimeActionEffectNumber(next, "domainPressure", getRuntimeActionNumber(next, "domainPressure") + amount * 2);
      }
    }
    return next;
  }

  function isDuelActionAllowedByActorIdentity(action, actor, battle) {
    if (!actor || !action) return true;
    if (isTenShadowsSpecialHandAction(action) && !hasTenShadowsMahoragaAccess(actor, battle)) {
      return false;
    }
    if (action.specialHandCard || action.techniqueFeatureHand) return true;
    if (!isReverseCursedTechniqueAction(action) && !isCurseRegenerationAction(action)) return true;
    var snapshot = getActorFeatureSnapshot(actor, battle);
    var cursedSpirit = isCursedSpiritActor(actor, battle, snapshot);
    if (isReverseCursedTechniqueAction(action)) {
      if (cursedSpirit) return false;
      if (isReverseCursedTechniqueOutputAction(action)) return hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot);
      return hasReverseCursedTechniqueAccess(actor, battle, snapshot);
    }
    if (isCurseRegenerationAction(action)) return cursedSpirit;
    return true;
  }

  function hasTenShadowsMahoragaAccess(actor, battle) {
    var snapshot = getActorFeatureSnapshot(actor, battle);
    return hasActorExplicitSpecialHandTag(snapshot, "ten_shadows") || hasAdjustedMahoragaAccess(actor, battle);
  }

  function hasReverseCursedTechniqueAccess(actor, battle, snapshot) {
    var ids = snapshot?.ids || [];
    if (ids.some(function hasKnownRctId(id) { return RCT_CHARACTER_IDS.has(String(id || "")); })) return true;
    var text = snapshot?.text || "";
    return /反转术式|反转输出|正能量外放|rct_user|rct_output|reverse_output|reverse_cursed_technique|healer|self_repair|反转恢复|疗伤/i.test(text);
  }

  function hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot) {
    if (snapshot?.hasRctOutputAccess) return true;
    var ids = snapshot?.ids || [];
    if (ids.some(function hasKnownRctOutputId(id) { return RCT_OUTPUT_CHARACTER_IDS.has(String(id || "")); })) return true;
    var text = snapshot?.text || "";
    return /反转输出|反转术式外放|正能量外放|rct_output|reverse_output|healer/i.test(text);
  }

  function buildReverseCursedTechniqueActions(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!snapshot?.normalizedText || isCursedSpiritActor(actor, battle, snapshot)) return [];
    if (!hasReverseCursedTechniqueAccess(actor, battle, snapshot)) return [];
    var hpRatio = actor?.maxHp ? Number(actor.hp || 0) / Number(actor.maxHp || 1) : 1;
    var actions = [];
    var missingHp = Math.max(0, Number(actor?.maxHp || 0) - Number(actor?.hp || 0));
    var baseHealing = missingHp > 90 ? 24 : (missingHp > 45 ? 20 : 16);
    if (hpRatio < 0.985) actions.push({
      id: "reverse_cursed_technique_heal",
      actionId: "reverse_cursed_technique_heal",
      label: "反转术式疗伤",
      description: "将咒力反转为正向能量修复自身伤势，治疗量按角色咒力操控、效率、术式能力和输出修正。",
      cardType: "healing",
      type: "rct_healing",
      rctHealing: true,
      normalHandOnly: true,
      tags: ["反转术式", "rct", "正能量", "疗伤", "治疗", "支援", "resource"],
      exclusiveToCharacters: snapshot.ids || [],
      requiresCe: true,
      requirements: {
        domainActive: "any",
        requiresMissingHp: true
      },
      apCost: 1,
      cost: { ce: 20 },
      ceCost: 20,
      healing: baseHealing,
      block: 8,
      stabilityRestore: 20,
      durationRounds: 1,
      damageType: "none",
      scalingProfile: "healing",
      accuracyProfile: "none",
      evasionAllowed: false,
      effect: {
        healing: baseHealing,
        block: 8,
        stabilityRestore: 20,
        incomingHpScale: 0.9,
        stabilityDelta: 0.024,
      },
      effects: {
        healing: baseHealing,
        block: 8,
        stabilityRestore: 20,
        incomingHpScale: 0.9,
        stabilityDelta: 0.024,
        weightDeltas: {
          sustain: 0.8,
          support: 0.65,
          resource: 0.35
        },
        selfStatus: {
          id: "rctRecovery",
          label: "反转治疗",
          rounds: 1,
          value: 1
        }
      },
      risk: "medium",
      rarity: "uncommon",
      weight: hpRatio < 0.45 ? 8.4 : 6.1,
      effectSummary: "按基础治疗值与角色属性修正恢复体势。",
      logTemplate: "你使用反转术式疗伤，把咒力转为正向能量修复伤势。"
    });
    if (hasReverseCursedTechniqueOutputAccess(actor, battle, snapshot)) {
      actions.push({
        id: "reverse_cursed_technique_output",
        actionId: "reverse_cursed_technique_output",
        label: "反转术式外放",
        name: "反转术式外放",
        description: "把反转术式作为正向能量外放。可指定治疗自己或友方召唤物；对敌方咒灵目标会直接祓除。",
        cardType: "healing",
        type: "rct_output",
        rctOutput: true,
        normalHandOnly: true,
        guaranteedPerTurn: true,
        retainedPermanent: true,
        tags: ["反转术式", "正能量", "治疗", "祓除咒灵", "reverse_output", "rct_output"],
        exclusiveToCharacters: snapshot.ids || [],
        requiresCe: true,
        requirements: { domainActive: "any" },
        apCost: 1,
        cost: { ce: 36 },
        ceCost: 36,
        damage: 0,
        block: 0,
        healing: 26,
        stabilityRestore: 10,
        durationRounds: 0,
        damageType: "reverse_cursed_technique",
        scalingProfile: "healing",
        accuracyProfile: "none",
        evasionAllowed: false,
        effect: {
          healing: 26,
          stabilityRestore: 10,
          rctOutputExternal: true,
          rctOutputHealScale: 0.8,
          rctOutputInstantKillCurses: true,
          weightDeltas: { support: 0.6, sustain: 0.4, exorcism: 1.2 }
        },
        effects: {
          healing: 26,
          stabilityRestore: 10,
          rctOutputExternal: true,
          rctOutputHealScale: 0.8,
          rctOutputInstantKillCurses: true,
          weightDeltas: { support: 0.6, sustain: 0.4, exorcism: 1.2 }
        },
        risk: "medium",
        rarity: "template",
        weight: 5.8,
        effectSummary: "对人类目标按反转术式基础治疗值 ×0.8×属性加成恢复体势；对咒灵目标判定为必杀。",
        logTemplate: "你将正向能量外放，治疗人类目标或祓除咒灵目标。"
      });
    }
    return actions;
  }

  function hasBloodManipulationAccess(actor, battle, snapshot) {
    var activeSnapshot = snapshot || getActorFeatureSnapshot(actor, battle);
    return hasFeatureBloodTechniqueEvidence(activeSnapshot?.text || "");
  }

  function isBloodManipulationAction(action) {
    var text = [
      action?.id,
      action?.actionId,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      action?.cardType,
      action?.scalingProfile
    ].concat(
      toFeatureList(action?.tags),
      toFeatureList(action?.specialHandTags)
    ).join(" ");
    return /blood_manipulation|赤血操术|穿血|血刃|百敛|超新星|赤鳞跃动|胀相|脹相|加茂宪纪|加茂憲紀/i.test(text);
  }

  var BLOOD_MANIPULATION_MODEL_VERSION = "blood-core-v2";
  var BLOOD_MANIPULATION_BLOOD_MAX = 8;
  var BLOOD_MANIPULATION_PIERCE_MAX = 6;

  function getBloodManipulationResourceSpec(action) {
    var explicit = action?.bloodResource || action?.effect?.special?.bloodResource || action?.effects?.special?.bloodResource;
    if (explicit && typeof explicit === "object") return { ...explicit };
    var identity = [action?.id, action?.actionId, action?.cardId, action?.name, action?.label].filter(Boolean).join(" ");
    if (/blood_ce_to_hp|咒力化血/.test(identity)) {
      return { role: "blood_stock", gainBloodFromCeStepRatio: 0.08, gainBloodMax: 3 };
    }
    if (/blood_hp_to_ce|血铸咒力/.test(identity)) {
      return { role: "blood_stock", gainBloodFromHpStepRatio: 0.025, gainBloodMax: 4 };
    }
    if (/blood_manipulation_007|超新星/.test(identity)) {
      return { role: "blood_burst", minBlood: 3, consumeBloodMax: 6, damagePerBlood: 8, hpDamageSoftCap: 90 };
    }
    if (/blood_manipulation_008|百敛穿血/.test(identity)) {
      return { role: "pierce_finisher", minPierce: 2, consumePierceMax: 4, damagePerPierce: 7, blockIgnoreBase: 0.15, blockIgnorePerPierce: 0.15, armorBreakPerPierce: 0.04, hpDamageSoftCap: 90 };
    }
    if (/blood_manipulation_009|血刃缠臂/.test(identity)) {
      return { role: "blood_builder", gainBloodPerHpStep: 10, hpDamageSoftCap: 90 };
    }
    if (/blood_manipulation_010|赤鳞跃动/.test(identity)) {
      return { role: "blood_guard", minBlood: 2, consumeBloodMax: 3, guardOutgoingPerBlood: 0.08, guardIncomingBase: 0.7, guardIncomingPerBlood: 0.1, guardReductionCapBase: 2, guardReductionCapPerBlood: 1 };
    }
    if (/blood_manipulation_011|苅祓/.test(identity)) {
      return { role: "pierce_builder", minBlood: 1, consumeBloodMax: 1, gainPierce: 2, damagePerBlood: 5, hpDamageSoftCap: 90 };
    }
    return { role: "legacy_blood_action", hpDamageSoftCap: 90 };
  }

  function buildBloodManipulationCoreActions(actor, duelState) {
    var battle = getBattle(duelState);
    var snapshot = getActorFeatureSnapshot(actor, battle);
    if (!hasBloodManipulationAccess(actor, battle, snapshot)) return [];
    return [{
      id: "blood_ce_to_hp",
      actionId: "blood_ce_to_hp",
      label: "咒力化血",
      name: "咒力化血",
      description: "消耗20%咒力并按实际支付量回复体势；每实际支付8%最大咒力生成1层「血」，最多生成3层。",
      cardType: "resource",
      type: "blood_manipulation_conversion",
      normalHandOnly: true,
      guaranteedPerTurn: true,
      retainedPermanent: true,
      tags: ["赤血操术", "blood_manipulation", "咒力化血", "resource"],
      specialHandTags: ["blood_manipulation"],
      exclusiveToCharacters: snapshot.ids || [],
      apCost: 1,
      cost: { ce: 0 },
      ceCost: 0,
      damage: 0,
      block: 0,
      damageType: "none",
      scalingProfile: "blood_conversion",
      bloodConversion: "ce_to_hp",
      bloodCeCostRatio: 0.2,
      bloodCeCostRatio: 0.2,
      bloodCeToHpEfficiency: 0.65,
      bloodConversionGainCapRatio: 0.18,
      bloodResource: { role: "blood_stock", gainBloodFromCeStepRatio: 0.08, gainBloodMax: 3 },
      effectTools: [{ schema: "jjk.atomic-effect.v2", id: "blood-ce-to-hp-gain", tool: "adjust_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: "blood_manipulation", counterId: "blood", label: "血", amountSource: "actualCeStep", step: 0.08, max: BLOOD_MANIPULATION_BLOOD_MAX } }],
      accuracyProfile: "none",
      evasionAllowed: false,
      risk: "medium",
      rarity: "special",
      weight: 99,
      effect: { weightDeltas: { resource: 0.8, sustain: 0.35 } },
      effects: { weightDeltas: { resource: 0.8, sustain: 0.35 } },
      effectSummary: "消耗20%咒力，按实际支付量的65%回复体势（最多回复最大体势18%），并生成至多3层「血」。"
    }, {
      id: "blood_hp_to_ce",
      actionId: "blood_hp_to_ce",
      label: "血铸咒力",
      name: "血铸咒力",
      description: "牺牲10%当前体势并按实际失血回复咒力；每实际失去2.5%最大体势生成1层「血」，最多生成4层。",
      cardType: "resource",
      type: "blood_manipulation_conversion",
      normalHandOnly: true,
      guaranteedPerTurn: true,
      retainedPermanent: true,
      tags: ["赤血操术", "blood_manipulation", "血铸咒力", "resource"],
      specialHandTags: ["blood_manipulation"],
      exclusiveToCharacters: snapshot.ids || [],
      apCost: 1,
      cost: { ce: 0 },
      ceCost: 0,
      damage: 0,
      block: 0,
      damageType: "none",
      scalingProfile: "blood_conversion",
      bloodConversion: "hp_to_ce",
      bloodHpCostRatio: 0.1,
      bloodHpCostRatio: 0.1,
      bloodHpToCeEfficiency: 0.65,
      bloodConversionGainCapRatio: 0.18,
      bloodResource: { role: "blood_stock", gainBloodFromHpStepRatio: 0.025, gainBloodMax: 4 },
      effectTools: [{ schema: "jjk.atomic-effect.v2", id: "blood-hp-to-ce-gain", tool: "adjust_counter", trigger: "post-damage", target: "self", when: [], params: { namespace: "blood_manipulation", counterId: "blood", label: "血", amountSource: "actualHpStep", step: 10, max: BLOOD_MANIPULATION_BLOOD_MAX } }],
      selfHpCostNonlethal: true,
      accuracyProfile: "none",
      evasionAllowed: false,
      risk: "medium",
      rarity: "special",
      weight: 99,
      effect: { selfHpCostNonlethal: true, weightDeltas: { resource: 0.8, attack: 0.3 } },
      effects: { selfHpCostNonlethal: true, weightDeltas: { resource: 0.8, attack: 0.3 } },
      effectSummary: "消耗10%当前体势，按实际失血的65%回复咒力（最多回复最大咒力18%），并生成至多4层「血」。"
    }];
  }

  function getBloodManipulationResourceState(battle, side) {
    if (!battle || !side) return { pierce: 0, blood: 0, round: 0 };
    var round = getDuelActionTurnNumber(battle);
    var state = createDuelCounterView(battle, side, "blood_manipulation", {
      pierce: { counterId: "pierce", label: "穿", initial: 0, min: 0, max: BLOOD_MANIPULATION_PIERCE_MAX, format: "number" },
      blood: { counterId: "blood", label: "血", initial: 0, min: 0, max: BLOOD_MANIPULATION_BLOOD_MAX, format: "number" },
      round: { counterId: "_round", initial: round, visible: false }
    });
    state.round = round;
    return state;
  }

  function getBloodManipulationLayerGain(actualCost, maximum, flatGain, ratioStep, gainMax, absoluteStep) {
    var actual = Math.max(0, Number(actualCost || 0));
    if (!(actual > 0)) return 0;
    var gain = Math.max(0, Math.round(Number(flatGain || 0)));
    var maxValue = Math.max(1, Number(maximum || 0));
    var step = Math.max(0, Number(ratioStep || 0));
    if (step > 0) gain += Math.floor(actual / maxValue / step + 0.0000001);
    var absolute = Math.max(0, Number(absoluteStep || 0));
    if (absolute > 0) gain += Math.floor(actual / absolute + 0.0000001);
    var cap = Math.max(0, Math.round(Number(gainMax || gain || 0)));
    return Math.max(0, Math.min(cap, gain));
  }

  function getBloodManipulationResourceAvailability(action, actor, battle) {
    if (!isBloodManipulationAction(action) || !actor || !battle) return { available: true, reason: "" };
    var spec = getBloodManipulationResourceSpec(action);
    var state = getBloodManipulationResourceState(battle, actor.side || "left");
    var minBlood = Math.max(0, Math.round(Number(spec.minBlood || 0)));
    var minPierce = Math.max(0, Math.round(Number(spec.minPierce || 0)));
    if (Number(state.blood || 0) < minBlood) {
      return { available: false, reason: "赤血资源不足：至少需要" + minBlood + "层「血」（当前" + Number(state.blood || 0) + "层）" };
    }
    if (Number(state.pierce || 0) < minPierce) {
      return { available: false, reason: "赤血资源不足：至少需要" + minPierce + "层「穿」（当前" + Number(state.pierce || 0) + "层）" };
    }
    return { available: true, reason: "" };
  }

  function getBloodManipulationRuntimeConfig(action, actor, battle, overrides) {
    if (!action || !actor) return null;
    var isBlood = isBloodManipulationAction(action);
    if (!isBlood) return null;
    if (!action.bloodConversion && !hasBloodManipulationAccess(actor, battle)) return null;
    var maxCe = Math.max(0, Number(actor.maxCe || 0));
    var maxHp = Math.max(0, Number(actor.maxHp || 0));
    var currentCe = Math.max(0, Number(actor.ce || 0));
    var currentHp = Math.max(0, Number(actor.hp || 0));
    var ceCostBase = Math.max(maxCe, currentCe);
    var hasExplicitCeRatio = action.bloodCeCostRatio !== undefined && action.bloodCeCostRatio !== null;
    var ceRatio = Number(action.bloodCeCostRatio ?? (action.bloodConversion === "hp_to_ce" ? 0 : 0.08));
    var hpRatio = Number(action.bloodHpCostRatio ?? (action.bloodConversion === "ce_to_hp" ? 0 : 0.055));
    var ceReduction = Math.max(0, Number(action.bloodCeCostReduction ?? 0));
    var directCardCeCost = isDirectBattleCard(action) && !hasExplicitCeRatio
      ? Math.max(0, Number(action.cost?.ce ?? action.ceCost ?? 0))
      : null;
    var ceCost = directCardCeCost !== null
      ? directCardCeCost
      : (ceCostBase > 0 && ceRatio > 0 ? Math.max(1, Math.round(ceCostBase * ceRatio - ceReduction)) : 0);
    var hpCost = currentHp > 0 && hpRatio > 0 ? Math.max(1, Number((currentHp * hpRatio).toFixed(1))) : 0;
    var usesActualCeCost = Boolean(overrides && Number.isFinite(Number(overrides.actualCeCost)));
    var usesActualHpCost = Boolean(overrides && Number.isFinite(Number(overrides.actualHpCost)));
    if (usesActualCeCost) ceCost = Math.max(0, Number(overrides.actualCeCost));
    if (usesActualHpCost) hpCost = Math.max(0, Number(overrides.actualHpCost));
    var hpCostForDamage = action.bloodHpCostContributesDamage === false ? 0 : hpCost;
    var resourceSpec = getBloodManipulationResourceSpec(action);
    var state = getBloodManipulationResourceState(battle, actor.side || "left");
    var resourceBefore = {
      blood: Math.max(0, Math.round(Number(state.blood || 0))),
      pierce: Math.max(0, Math.round(Number(state.pierce || 0)))
    };
    var minBlood = Math.max(0, Math.round(Number(resourceSpec.minBlood || 0)));
    var minPierce = Math.max(0, Math.round(Number(resourceSpec.minPierce || 0)));
    var resourceAvailable = resourceBefore.blood >= minBlood && resourceBefore.pierce >= minPierce;
    var consumedBlood = resourceAvailable ? Math.min(resourceBefore.blood, Math.max(0, Math.round(Number(resourceSpec.consumeBloodMax || 0)))) : 0;
    var consumedPierce = resourceAvailable ? Math.min(resourceBefore.pierce, Math.max(0, Math.round(Number(resourceSpec.consumePierceMax || 0)))) : 0;
    var gainedBlood = getBloodManipulationLayerGain(
      hpCost,
      maxHp,
      resourceSpec.gainBloodOnActualHp,
      resourceSpec.gainBloodFromHpStepRatio,
      resourceSpec.gainBloodMax,
      resourceSpec.gainBloodPerHpStep
    ) + getBloodManipulationLayerGain(
      ceCost,
      maxCe,
      resourceSpec.gainBloodOnActualCe,
      resourceSpec.gainBloodFromCeStepRatio,
      resourceSpec.gainBloodMax
    );
    gainedBlood = Math.min(BLOOD_MANIPULATION_BLOOD_MAX, gainedBlood);
    var gainedPierce = resourceAvailable ? Math.max(0, Math.round(Number(resourceSpec.gainPierce || 0))) : 0;
    var resourceAfterPreview = {
      blood: Math.max(0, Math.min(BLOOD_MANIPULATION_BLOOD_MAX, resourceBefore.blood - consumedBlood + gainedBlood)),
      pierce: Math.max(0, Math.min(BLOOD_MANIPULATION_PIERCE_MAX, resourceBefore.pierce - consumedPierce + gainedPierce))
    };
    var ceToDamageScale = Math.max(0, Number(action.bloodCeToDamageScale ?? action.bloodCeToBaseDamageScale ?? 0.56));
    var hpToDamageScale = Math.max(0, Number(action.bloodHpToDamageScale ?? action.bloodHpToBaseDamageScale ?? 0.45));
    var originalDamageScale = Math.max(0, Number(action.bloodOriginalDamageScale ?? action.bloodOriginalBaseDamageScale ?? 0.55));
    var hpDamageSoftCap = Math.max(1, Number(resourceSpec.hpDamageSoftCap || 90));
    var effectiveHpCost = hpCostForDamage > 0 ? hpDamageSoftCap * (1 - Math.exp(-hpCostForDamage / hpDamageSoftCap)) : 0;
    var damageFromCeCost = Math.max(0, ceCost * ceToDamageScale);
    var damageFromHpCost = Math.max(0, effectiveHpCost * hpToDamageScale);
    var damageFromBlood = consumedBlood * Math.max(0, Number(resourceSpec.damagePerBlood || 0));
    var damageFromPierce = consumedPierce * Math.max(0, Number(resourceSpec.damagePerPierce || 0));
    // Runtime actions are evaluated once for preview and again after costs are
    // paid. Never feed the first dynamic result back in as the card's base
    // damage: that made the second pass compound a pseudo-fixed value and
    // obscured changes in the HP actually deducted by the non-lethal clamp.
    var originalDamage = Math.max(0, Number(
      action.bloodOriginalBaseDamage ?? action.bloodRuntime?.originalBaseDamage ?? getRuntimeActionNumber(action, "damage")
    ));
    var dynamicDamage = Math.max(0, damageFromCeCost + damageFromHpCost + damageFromBlood + damageFromPierce + originalDamage * originalDamageScale);
    var blockIgnoreRatio = Math.min(0.9, Math.max(0, Number(resourceSpec.blockIgnoreBase || 0)) + consumedPierce * Math.max(0, Number(resourceSpec.blockIgnorePerPierce || 0)));
    var armorBreakRatio = Math.min(0.4, consumedPierce * Math.max(0, Number(resourceSpec.armorBreakPerPierce || 0)));
    var previewLines = [
      "赤血资源｜「血」" + resourceBefore.blood + "层/" + BLOOD_MANIPULATION_BLOOD_MAX + "，「穿」" + resourceBefore.pierce + "层/" + BLOOD_MANIPULATION_PIERCE_MAX,
      "资源变化｜血：" + resourceBefore.blood + " → " + resourceAfterPreview.blood + "；穿：" + resourceBefore.pierce + " → " + resourceAfterPreview.pierce
    ];
    if (!action.bloodConversion && hpCost > 0) previewLines.push("失血折算｜预计实际失血" + Number(hpCost.toFixed(1)) + "，软上限折算" + Number(effectiveHpCost.toFixed(1)));
    if (blockIgnoreRatio > 0) previewLines.push("穿透预览｜无视格挡" + Math.round(blockIgnoreRatio * 100) + "%");
    return {
      active: true,
      resourceModelVersion: BLOOD_MANIPULATION_MODEL_VERSION,
      resourceRole: String(resourceSpec.role || "legacy_blood_action"),
      resourceAvailable: resourceAvailable,
      unavailableReason: !resourceAvailable
        ? (resourceBefore.blood < minBlood ? "至少需要" + minBlood + "层「血」" : "至少需要" + minPierce + "层「穿」")
        : "",
      ceCost: ceCost,
      hpCost: hpCost,
      hpCostForDamage: Number(hpCostForDamage.toFixed(1)),
      effectiveHpCost: Number(effectiveHpCost.toFixed(3)),
      hpDamageSoftCap: Number(hpDamageSoftCap.toFixed(3)),
      ceCostBase: Number(ceCostBase.toFixed(1)),
      hpCostBase: Number(currentHp.toFixed(1)),
      temporaryCeOverCap: Math.max(0, Number((currentCe - maxCe).toFixed(1))),
      temporaryHpOverCap: Math.max(0, Number((currentHp - maxHp).toFixed(1))),
      bloodCeToDamageScale: Number(ceToDamageScale.toFixed(4)),
      bloodHpToDamageScale: Number(hpToDamageScale.toFixed(4)),
      originalBaseDamage: Number(originalDamage.toFixed(3)),
      damageFromCeCost: Number(damageFromCeCost.toFixed(3)),
      damageFromHpCost: Number(damageFromHpCost.toFixed(3)),
      damageFromBlood: Number(damageFromBlood.toFixed(3)),
      damageFromPierce: Number(damageFromPierce.toFixed(3)),
      settledFromActualCeCost: usesActualCeCost,
      settledFromActualHpCost: usesActualHpCost,
      resourceBefore: resourceBefore,
      resourceCost: { blood: consumedBlood, pierce: consumedPierce },
      resourceGain: { blood: gainedBlood, pierce: gainedPierce },
      resourceAfterPreview: resourceAfterPreview,
      pierceGain: gainedPierce,
      bloodGain: gainedBlood,
      bloodPierceRatio: Number(blockIgnoreRatio.toFixed(4)),
      bloodBoostRatio: Number((consumedBlood / BLOOD_MANIPULATION_BLOOD_MAX).toFixed(4)),
      dynamicDamage: action.bloodConversion ? 0 : Number(dynamicDamage.toFixed(1)),
      blockIgnoreRatio: Number(blockIgnoreRatio.toFixed(4)),
      armorBreakRatio: Number(armorBreakRatio.toFixed(4)),
      previewLines: previewLines
    };
  }

  function getBloodManipulationRuntimeAction(action, actor, battle, overrides) {
    var runtime = getBloodManipulationRuntimeConfig(action, actor, battle, overrides);
    if (!runtime?.active) return action;
    var runtimeEffects = {
      ...(action.effects || {}),
      damage: runtime.dynamicDamage,
      selfHpCostRatio: 0,
      selfHpCostFlat: runtime.hpCost,
      selfHpCostNonlethal: action.selfHpCostNonlethal !== false
    };
    if (runtime.resourceRole === "blood_guard") {
      var guardSpec = getBloodManipulationResourceSpec(action);
      var guardBlood = Number(runtime.resourceCost?.blood || 0);
      runtimeEffects.outgoingScale = Number((1 + guardBlood * Number(guardSpec.guardOutgoingPerBlood || 0)).toFixed(4));
      runtimeEffects.incomingHpScale = Number(Math.max(0.2, Number(guardSpec.guardIncomingBase || 0.7) - guardBlood * Number(guardSpec.guardIncomingPerBlood || 0.1)).toFixed(4));
      runtimeEffects.incomingHpReductionCapFromBloodHpCostMultiplier = Math.max(0, Number(guardSpec.guardReductionCapBase || 0) + guardBlood * Number(guardSpec.guardReductionCapPerBlood || 0));
    }
    if (runtime.armorBreakRatio > 0) {
      runtimeEffects.opponentStatuses = [].concat(runtimeEffects.opponentStatuses || []).filter(function removeStaleBloodArmorBreak(status) {
        return status?.id !== "bloodArmorBreak";
      }).concat([{
        id: "bloodArmorBreak",
        label: "血线破防（承伤+" + Math.round(runtime.armorBreakRatio * 100) + "%）",
        rounds: 2,
        value: Number(runtime.armorBreakRatio.toFixed(4)),
        incomingHpScale: Number((1 + runtime.armorBreakRatio).toFixed(4)),
        category: "减益状态"
      }]);
    }
    return {
      ...action,
      cost: { ...(action.cost || {}), ce: runtime.ceCost },
      ceCost: runtime.ceCost,
      damage: runtime.dynamicDamage,
      bloodOriginalBaseDamage: runtime.originalBaseDamage,
      effect: { ...(action.effect || action.effects || {}), damage: runtime.dynamicDamage },
      bloodCeControlDamageScale: Number(action.bloodCeControlDamageScale ?? 0.32),
      bloodRuntime: runtime,
      bloodPierceRatio: runtime.bloodPierceRatio,
      bloodBoostRatio: runtime.bloodBoostRatio,
      blockIgnoreRatio: runtime.blockIgnoreRatio,
      effects: runtimeEffects
    };
  }

  function applyBloodManipulationConversion(action, actor, costCe, hpCost) {
    if (!action?.bloodConversion || !actor) return null;
    var beforeHp = Number(actor.hp || 0);
    var beforeCe = Number(actor.ce || 0);
    if (action.bloodConversion === "ce_to_hp") {
      var hpGainCap = Math.max(0, Number(actor.maxHp || 0) * Number(action.bloodConversionGainCapRatio || 0.18));
      var hpGain = Number(Math.min(Number(costCe || 0) * Number(action.bloodCeToHpEfficiency || 0.65), hpGainCap).toFixed(1));
      actor.hp = Number((Number(actor.hp || 0) + hpGain).toFixed(1));
      actor.temporaryHpOverCap = Math.max(0, Number((Number(actor.hp || 0) - Number(actor.maxHp || 0)).toFixed(1)));
      if (!actor.temporaryHpOverCap) delete actor.temporaryHpOverCap;
      return { type: "ce_to_hp", hpGain: hpGain, ceGain: 0, ceSpent: Number(costCe || 0), hpSpent: 0, beforeHp: beforeHp, beforeCe: beforeCe, afterHp: actor.hp, afterCe: actor.ce, allowOverCap: true };
    }
    if (action.bloodConversion === "hp_to_ce") {
      var ceGainCap = Math.max(0, Number(actor.maxCe || 0) * Number(action.bloodConversionGainCapRatio || 0.18));
      var ceGain = Number(Math.min(Number(hpCost || 0) * Number(action.bloodHpToCeEfficiency || 0.65), ceGainCap).toFixed(1));
      actor.ce = Number((Number(actor.ce || 0) + ceGain).toFixed(1));
      actor.temporaryCeOverCap = Math.max(0, Number((Number(actor.ce || 0) - Number(actor.maxCe || 0)).toFixed(1)));
      if (!actor.temporaryCeOverCap) delete actor.temporaryCeOverCap;
      return { type: "hp_to_ce", hpGain: 0, ceGain: ceGain, ceSpent: 0, hpSpent: Number(hpCost || 0), beforeHp: beforeHp, beforeCe: beforeCe, afterHp: actor.hp, afterCe: actor.ce, allowOverCap: true };
    }
    return null;
  }

  function syncBloodManipulationTemporaryOverCap(actor) {
    if (!actor) return;
    var hpOverCap = Math.max(0, Number((Number(actor.hp || 0) - Number(actor.maxHp || 0)).toFixed(1)));
    var ceOverCap = Math.max(0, Number((Number(actor.ce || 0) - Number(actor.maxCe || 0)).toFixed(1)));
    if (hpOverCap > 0) actor.temporaryHpOverCap = hpOverCap;
    else delete actor.temporaryHpOverCap;
    if (ceOverCap > 0) actor.temporaryCeOverCap = ceOverCap;
    else delete actor.temporaryCeOverCap;
  }

  function recordBloodManipulationConversionChange(battle, side, actor, conversion) {
    if (!battle || !actor || !conversion?.type) return;
    var sideLabel = getDuelResourceSideLabel(side);
    if (conversion.type === "ce_to_hp") {
      recordDuelResourceChange(battle, {
        side: side,
        title: "咒力化血",
        detail: sideLabel + actor.name + " 将咒力转化为体势，咒力 " + formatSignedDuelDelta(-Number(conversion.ceSpent || 0)) + "，体势 +" + Number(conversion.hpGain || 0).toFixed(1) + "；当前 " + Number(conversion.afterHp || 0).toFixed(1) + " / " + Number(actor.maxHp || 0).toFixed(1) + "。",
        type: "resource",
        delta: { ce: -Number(conversion.ceSpent || 0), hp: Number(conversion.hpGain || 0), bloodConversion: "ce_to_hp", allowOverCap: true }
      });
      return;
    }
    if (conversion.type === "hp_to_ce") {
      recordDuelResourceChange(battle, {
        side: side,
        title: "血铸咒力",
        detail: sideLabel + actor.name + " 将体势转化为咒力，体势 " + formatSignedDuelDelta(-Number(conversion.hpSpent || 0)) + "，咒力 +" + Number(conversion.ceGain || 0).toFixed(1) + "；当前 " + Number(conversion.afterCe || 0).toFixed(1) + " / " + Number(actor.maxCe || 0).toFixed(1) + "。",
        type: "resource",
        delta: { hp: -Number(conversion.hpSpent || 0), ce: Number(conversion.ceGain || 0), bloodConversion: "hp_to_ce", allowOverCap: true }
      });
    }
  }

  function settleBloodManipulationResources(battle, side, runtime) {
    if (!runtime?.active || !battle || !side) return null;
    if (!runtime.resourceAvailable) return { blocked: true, reason: runtime.unavailableReason || "赤血资源不足" };
    var consumedBlood = consumeDuelCounter(battle, side, "blood_manipulation", "blood", Number(runtime.resourceCost?.blood || 0), { allowPartial: false });
    var consumedPierce = consumeDuelCounter(battle, side, "blood_manipulation", "pierce", Number(runtime.resourceCost?.pierce || 0), { allowPartial: false });
    if (!consumedBlood.ok || !consumedPierce.ok) return { blocked: true, reason: "赤血资源在结算前发生变化" };
    var bloodGain = adjustDuelCounter(battle, side, "blood_manipulation", "blood", Number(runtime.resourceGain?.blood || 0));
    var pierceGain = adjustDuelCounter(battle, side, "blood_manipulation", "pierce", Number(runtime.resourceGain?.pierce || 0));
    var state = getBloodManipulationResourceState(battle, side);
    return {
      before: { ...runtime.resourceBefore },
      after: { blood: Number(state.blood || 0), pierce: Number(state.pierce || 0) },
      consumedBlood: Number(consumedBlood.consumed || 0),
      consumedPierce: Number(consumedPierce.consumed || 0),
      gainedBlood: Number(bloodGain.delta || 0),
      gainedPierce: Number(pierceGain.delta || 0),
      persistentAcrossRounds: true
    };
  }

  function isStarRageAction(action) {
    if (action?.starRageDslOnly === true) return false;
    var text = collectDuelActionSearchText(action);
    return text.indexOf("star_rage") !== -1 || text.indexOf("星之怒") !== -1 || Boolean(action?.starRageEffect);
  }

  function hasExplicitTechniqueOwnershipTag(actor, battle, ownerTag) {
    if (!actor) return false;
    var profile = getDuelProfileForSide(battle, actor.side || "") || actor.characterCardProfile || {};
    var tags = uniqueFeatureList([]
      .concat(toFeatureList(actor.explicitSpecialHandTags))
      .concat(toFeatureList(actor.characterCardProfile?.explicitSpecialHandTags))
      .concat(toFeatureList(profile.explicitSpecialHandTags)));
    var wanted = String(ownerTag || "").trim().toLowerCase();
    return tags.some(function hasExactTag(tag) {
      return String(tag || "").trim().toLowerCase() === wanted;
    });
  }

  function hasStarRageAccess(actor, battle) {
    return hasExplicitTechniqueOwnershipTag(actor, battle, "star_rage");
  }

  function hasStrictCounterOwnerTag(battle, side, ownerTag) {
    var profile = battle?.[side] || getDuelProfileForSide(battle, side);
    if (!profile || typeof profile !== "object") return true;
    var tags = uniqueFeatureList([]
      .concat(toFeatureList(profile.specialHandTags))
      .concat(toFeatureList(profile["特殊手札"]))
      .concat(toFeatureList(profile.explicitSpecialHandTags))
      .concat(toFeatureList(profile.techniqueFamilies))
      .concat(toFeatureList(profile.traits))
      .concat(toFeatureList(profile.cardTags)));
    var wanted = String(ownerTag || "").trim().toLowerCase();
    return tags.some(function hasStrictOwner(tag) { return String(tag || "").trim().toLowerCase() === wanted; });
  }

  function isDuelCounterAllowedForSide(battle, side, namespaceName, counterId) {
    var pipeline = getDuelCounterPipeline();
    return typeof pipeline.isCounterAllowedForSide === "function" && pipeline.isCounterAllowedForSide(battle, side, namespaceName, counterId);
  }

  function getStarRageMassState(battle, side) {
    if (!battle || !side) return { mass: 1, round: 0, base: 1, autoProgress: 0 };
    if (!isDuelCounterAllowedForSide(battle, side, "star_rage", "virtual_mass")) return { mass: 1, round: getDuelActionTurnNumber(battle), base: 1, autoProgress: 0, transient: true };
    var starRageRound = getDuelActionTurnNumber(battle);
    var round = starRageRound;
    var state = createDuelCounterView(battle, side, "star_rage", {
      mass: { counterId: "virtual_mass", label: "虚拟质量", initial: 1, min: 0, max: 7, format: "number" },
      round: { counterId: "_round", initial: round, visible: false },
      base: { counterId: "_base", initial: 1, visible: false },
      autoProgress: { counterId: "_auto_progress", initial: 0, visible: false },
      singleCardBonusRound: { counterId: "_single_card_bonus_round", initial: 0, visible: false }
    });
    if (Number(state.round || 0) !== round) {
      var delta = Math.max(0, round - Number(state.round || 0));
      var autoProgress = Math.max(0, Number(state.autoProgress || 0)) + delta;
      var autoGain = Math.floor(autoProgress / 2);
      var massAfterUpkeep = Math.max(0, Number(state.mass || 0));
      state.round = round;
      state.autoProgress = autoProgress % 2;
      state.mass = Math.min(7, massAfterUpkeep + autoGain);
    } else if (state.autoProgress === undefined) {
      state.autoProgress = 0;
    }
    return state;
  }

  function updateStarRageMassCounter(battle, side, state) {
    if (!battle || !side || !state) return;
    setDuelCounter(battle, side, "star_rage", "virtual_mass", Number(state.mass || 0), {
      label: "虚拟质量", min: 0, max: 7, format: "number"
    });
  }

  function grantStarRageSingleCardTurnBonus(battle, side, state) {
    if (!battle || !side || !state) return 0;
    var round = getDuelActionTurnNumber(battle);
    if (Number(state.singleCardBonusRound || 0) === round) return 0;
    state.singleCardBonusRound = round;
    var before = Number(state.mass || 0);
    state.mass = Math.min(7, before + 1);
    return Number(Math.max(0, state.mass - before).toFixed(1));
  }

  function getStarRageActionAvailability(action, actor, battle) {
    if (!isStarRageAction(action)) return { available: true, reason: "" };
    var rikaArsenalCopiedSpecialResourceBypass = isRikaArsenalCopiedSpecialResourceAction(action);
    if (!hasStarRageAccess(actor, battle) && !rikaArsenalCopiedSpecialResourceBypass) return { available: false, reason: "需要星之怒特殊手札" };
    var state = getStarRageMassState(battle, actor?.side || "");
    var mass = Number(state.mass || 0);
    var isGarudaRecall = action.starRageEffect === "garuda" && Boolean(findStarRageGarudaUnit(battle, actor?.side || ""));
    if (action.starRageEffect === "black_hole" && mass < 5 && !rikaArsenalCopiedSpecialResourceBypass) return { available: false, reason: "黑洞终局需要虚拟质量至少 5" };
    var selectedForSide = battle?.selectedHandActions?.[actor?.side || ""] || [];
    var selectedIds = selectedForSide.map(function mapSelected(entry) { return typeof entry === "string" ? entry : (entry?.actionId || entry?.id || entry?.action?.id || ""); });
    if (action.starRageEffect === "black_hole" && selectedForSide.length > 0 && !(selectedForSide.length === 1 && selectedIds.includes(action.id))) {
      return { available: false, reason: "黑洞终局本回合不能与其他手札并用" };
    }
    var required = Math.max(0, Number(
      isGarudaRecall
        ? (action.requirements?.minRecallVirtualMass ?? action.starRageRecallMassCost ?? 0)
        : (action.requirements?.minVirtualMass ?? action.starRageSummonMassCost ?? action.starRageMassCost ?? 0)
    ));
    if (required > 0 && mass < required && !rikaArsenalCopiedSpecialResourceBypass) return { available: false, reason: "虚拟质量不足" };
    return { available: true, reason: "" };
  }

  function getStarRageRuntimeAction(action, actor, battle) {
    if (action?.starRageRuntime?.active) return action;
    var rikaArsenalCopiedSpecialResourceBypass = isRikaArsenalCopiedSpecialResourceAction(action);
    if (!isStarRageAction(action) || (!hasStarRageAccess(actor, battle) && !rikaArsenalCopiedSpecialResourceBypass)) return action;
    var state = getStarRageMassState(battle, actor?.side || "");
    var mass = Math.max(0, Number(state.mass || 0));
    var isGarudaRecall = action.starRageEffect === "garuda" && Boolean(findStarRageGarudaUnit(battle, actor?.side || ""));
    var rawMassCost = Math.max(0, Number(
      isGarudaRecall
        ? (action.starRageRecallMassCost ?? 0)
        : (action.starRageSummonMassCost ?? action.starRageMassCost ?? 0)
    ));
    var requiredMass = Math.max(0, Number(
      isGarudaRecall
        ? (action.requirements?.minRecallVirtualMass ?? action.starRageRecallMassCost ?? 0)
        : (action.requirements?.minVirtualMass ?? action.starRageSummonMassCost ?? action.starRageMassCost ?? 0)
    ));
    var effectiveMass = rikaArsenalCopiedSpecialResourceBypass
      ? Math.max(mass, requiredMass, rawMassCost, action.starRageEffect === "black_hole" ? 5 : 0)
      : mass;
    var runtime = {
      active: true,
      massBefore: mass,
      massEffective: effectiveMass,
      massCost: rikaArsenalCopiedSpecialResourceBypass ? 0 : rawMassCost,
      massGain: rikaArsenalCopiedSpecialResourceBypass ? 0 : Math.max(0, Number(
        isGarudaRecall
          ? (action.starRageRecallMassGain ?? action.starRageMassGain ?? 0)
          : (action.starRageMassGain ?? 0)
      )),
      garudaRecall: isGarudaRecall,
      consumeAllMass: Boolean(action.starRageConsumeAllMass),
      blackHoleN: action.starRageEffect === "black_hole" ? effectiveMass : 0,
      rikaArsenalCopiedSpecialResourceBypass: rikaArsenalCopiedSpecialResourceBypass
    };
    var next = {
      ...action,
      starRageRuntime: runtime,
      starRageCeControlDamageScale: Number(action.starRageCeControlDamageScale ?? 0.26),
      starRageCeControlDamageScaleLimit: Number(action.starRageCeControlDamageScaleLimit ?? 1),
      starRageCeControlMaxMultiplier: Number(action.starRageCeControlMaxMultiplier ?? 1.55),
      effects: { ...(action.effects || {}) }
    };
    if (action.starRageEffect === "black_hole") {
      var damagePerMass = Math.max(0, Number(action.starRageBlackHoleBaseDamagePerMass ?? 7));
      var ignorePerMass = Math.max(0, Number(action.starRageBlackHoleBlockIgnorePerMass ?? 0.1));
      var ignoreOffset = Number(action.starRageBlackHoleBlockIgnoreOffset ?? 0.2);
      if (!Number.isFinite(ignoreOffset)) ignoreOffset = 0.2;
      var selfCostBase = Math.max(0, Number(action.starRageBlackHoleSelfHpCostBaseRatio ?? 0.1));
      var selfCostPerMass = Math.max(0, Number(action.starRageBlackHoleSelfHpCostPerMassRatio ?? 0.1));
      var selfCostOffset = Number(action.starRageBlackHoleSelfHpCostOffsetRatio);
      // 黑洞是严格的 N 动态公式。静态 effect.damage 仅供旧数据占位，
      // 不能成为 floor，否则 N=5~7 时卡面写 10N、实际却恒定走旧值。
      setRuntimeActionEffectNumber(next, "damage", damagePerMass * runtime.blackHoleN);
      next.blockIgnoreRatio = Number(clamp(ignoreOffset + runtime.blackHoleN * ignorePerMass, 0, 0.9).toFixed(4));
      next.effects.selfHpCostRatio = Number(Math.max(0, Number.isFinite(selfCostOffset)
        ? (runtime.blackHoleN * selfCostPerMass + selfCostOffset)
        : (selfCostBase + runtime.blackHoleN * selfCostPerMass)).toFixed(4));
      next.effects.selfHpCostNonlethal = action.selfHpCostNonlethal !== false;
    }
    return next;
  }

  function findStarRageGarudaUnit(battle, side) {
    return getDuelBattlefieldUnits(battle).find(function findGaruda(unit) {
      return unit?.active !== false && unit.ownerSide === side && (unit.starRageGaruda || unit.name === "凰轮" || unit.cardId === "star_rage_garuda_unit");
    }) || null;
  }

  function summonStarRageGaruda(battle, side, action) {
    var round = Number(battle?.round || 0) + 1;
    var spec = action?.starRageGarudaUnit || {};
    var maxHp = Math.max(1, Number(spec.maxHp ?? 150));
    var damage = Math.max(0, Number(spec.damage ?? 100));
    var block = Math.max(0, Number(spec.block ?? 50));
    var damageReductionRatio = Number(clamp(Number(spec.damageReductionRatio ?? 0.5), 0, 0.95).toFixed(4));
    var blockIgnoreRatio = Number(clamp(Number(spec.blockIgnoreRatio ?? 0), 0, 0.9).toFixed(4));
    var cePoolDamageScale = Math.max(0, Number(spec.cePoolDamageScale ?? spec.starRageCePoolDamageScale ?? action?.starRageCePoolDamageScale ?? 0));
    var cePoolMaxMultiplier = Math.max(1, Number(spec.cePoolMaxMultiplier ?? spec.starRageCePoolMaxMultiplier ?? action?.starRageCePoolMaxMultiplier ?? 1));
    var martialDamageScale = Math.max(0, Number(spec.martialDamageScale ?? spec.starRageMartialDamageScale ?? action?.starRageMartialDamageScale ?? 0));
    var martialMaxMultiplier = Math.max(1, Number(spec.martialMaxMultiplier ?? spec.starRageMartialMaxMultiplier ?? action?.starRageMartialMaxMultiplier ?? 1));
    battle.starRageGarudaSeq = Math.max(0, Number(battle.starRageGarudaSeq || 0)) + 1;
    var unit = {
      id: ["star_rage_garuda_unit", side || "neutral", round, battle.starRageGarudaSeq].join("_"),
      cardId: spec.cardId || "star_rage_garuda_unit",
      actionId: action?.actionId || action?.id || "star_rage_garuda_unit",
      name: spec.name || "凰轮",
      label: spec.label || spec.name || "凰轮",
      side: side,
      ownerSide: side,
      controllerSide: side,
      control: spec.control || "player_controlled",
      placement: spec.placement || "shikigami_zone",
      tags: Array.isArray(spec.tags) && spec.tags.length ? spec.tags.slice() : ["星之怒", "凰轮", "式神", "star_rage", "shikigami"],
      unitStats: { maxHp: maxHp, currentHp: maxHp, damage: damage, block: block, damageReductionRatio: damageReductionRatio, blockIgnoreRatio: blockIgnoreRatio, cePoolDamageScale: cePoolDamageScale, cePoolMaxMultiplier: cePoolMaxMultiplier, martialDamageScale: martialDamageScale, martialMaxMultiplier: martialMaxMultiplier, damageType: spec.damageType || "shikigami_melee", accuracyProfile: spec.accuracyProfile || "melee" },
      hp: maxHp,
      maxHp: maxHp,
      damage: damage,
      block: block,
      damageReductionRatio: damageReductionRatio,
      blockIgnoreRatio: blockIgnoreRatio,
      cePoolDamageScale: cePoolDamageScale,
      cePoolMaxMultiplier: cePoolMaxMultiplier,
      martialDamageScale: martialDamageScale,
      martialMaxMultiplier: martialMaxMultiplier,
      damageType: spec.damageType || "shikigami_melee",
      guardRules: spec.guardRules || { protectOwner: true, interceptsOpponentAttacks: true, priority: 24 },
      targetingRules: spec.targetingRules || {},
      maintenanceCeCost: Math.max(0, Number(spec.maintenanceCeCost ?? 1)),
      active: true,
      starRageGaruda: true,
      spawnedBy: action?.id || action?.actionId || "",
      spawnedRound: round,
      durationRounds: 0,
      expiresAfterRound: 0
    };
    getDuelBattlefieldUnits(battle).push(unit);
    battle.summonLog ||= [];
    battle.summonLog.unshift({ round: round, actorSide: side, actionId: action?.id || "", cardId: action?.cardId || "", unitCardId: unit.cardId, unitId: unit.id, unitName: unit.name, control: unit.control, reason: "star-rage-garuda-summon" });
    return { unit: unit, recalled: false };
  }

  function recallStarRageGaruda(battle, side, actor, action) {
    var unit = findStarRageGarudaUnit(battle, side);
    if (!unit) return null;
    unit.active = false;
    unit.recalledRound = Number(battle?.round || 0) + 1;
    battle.summonLog ||= [];
    battle.summonLog.unshift({ round: unit.recalledRound, actorSide: side, actionId: action?.id || "", unitId: unit.id, unitName: unit.name, reason: "star-rage-garuda-recall" });
    return { unit: unit, recalled: true };
  }

  function applyStarRageResolution(action, actor, battle, actorContext) {
    var runtime = action?.starRageRuntime;
    if (!runtime?.active || !battle || !actor) return null;
    var side = actor.side || "";
    var state = getStarRageMassState(battle, side);
    var beforeMass = Number(state.mass || 0);
    var consumed = runtime.consumeAllMass ? beforeMass : Math.min(beforeMass, Number(runtime.massCost || 0));
    state.mass = Math.max(0, beforeMass - consumed);
    var garuda = null;
    var garudaBuff = null;
    if (action.starRageEffect === "mass_attack") {
      var massAttackScale = Number(action.starRageOutgoingScale || 1.25);
      actorContext.outgoingScale *= massAttackScale;
      var activeGaruda = findStarRageGarudaUnit(battle, side);
      if (activeGaruda) {
        activeGaruda.attackProfile = { ...(activeGaruda.attackProfile || activeGaruda.unitStats?.attackProfile || {}) };
        var previousScale = Math.max(0, Number(activeGaruda.attackProfile.damageScale || 1));
        activeGaruda.starRageMassAttackBuffRound = Number(battle?.round || 0) + 1;
        activeGaruda.starRageMassAttackBuffScale = massAttackScale;
        garudaBuff = {
          unitId: activeGaruda.id || "",
          unitName: activeGaruda.name || activeGaruda.label || "凰轮",
          previousDamageScale: Number(previousScale.toFixed(4)),
          damageScale: Number((previousScale * massAttackScale).toFixed(4))
        };
      }
    }
    if (action.starRageEffect === "mass_defense") {
      actorContext.incomingHpScale *= Number(action.starRageIncomingScale || 0.8);
      actorContext.incomingHpReductionCap += Math.max(0, Number(action.starRageIncomingReductionCap || action.starRageDamageReductionCap || 100));
    }
    if (action.starRageEffect === "garuda") {
      var existing = findStarRageGarudaUnit(battle, side);
      if (existing) {
        garuda = recallStarRageGaruda(battle, side, actor, action);
        actorContext.incomingHpScale *= 0.8;
      } else {
        garuda = summonStarRageGaruda(battle, side, action);
      }
    }
    state.mass = Math.min(7, state.mass + Number(runtime.massGain || 0));
    var singleCardBonus = Number(action.selectedCount || 0) === 1 && !runtime.consumeAllMass && action.starRageEffect !== "garuda"
      ? grantStarRageSingleCardTurnBonus(battle, side, state)
      : 0;
    updateStarRageMassCounter(battle, side, state);
    return {
      massBefore: beforeMass,
      massAfter: state.mass,
      consumed: consumed,
      gained: Number(runtime.massGain || 0),
      singleCardBonus: singleCardBonus,
      blackHoleN: runtime.blackHoleN || undefined,
      blockIgnoreRatio: action.starRageEffect === "black_hole" ? Number(action.blockIgnoreRatio || 0) : undefined,
      garudaBuff: garudaBuff || undefined,
      garuda: garuda ? { recalled: Boolean(garuda.recalled), unitId: garuda.unit?.id || "", unitName: garuda.unit?.name || "凰轮" } : undefined
    };
  }

  function isBlackBirdManipulationAction(action) {
    if (action?.blackBirdDslOnly === true) return false;
    if (action?.blackBirdSpec) return true;
    var text = collectDuelActionSearchText(action);
    return text.indexOf("black_bird_manipulation") !== -1 || text.indexOf("黑鸟操术") !== -1 || text.indexOf("乌羽") !== -1;
  }

  function hasBlackBirdManipulationAccess(actor, battle) {
    return hasExplicitTechniqueOwnershipTag(actor, battle, "black_bird_manipulation");
  }

  function getBlackBirdSpec(action) {
    return action?.blackBirdSpec || {};
  }

  function updateBlackBirdCounter(battle, side, state) {
    if (!battle || !side || !state) return;
    setDuelCounter(battle, side, "black_bird_manipulation", "feathers", Number(state.feathers || 0), {
      label: "乌羽", min: 0, maxOverride: Math.max(0, Number(state.maxFeathers || 0)), format: "number"
    });
  }

  function getBlackBirdState(battle, side) {
    if (!battle || !side) return { feathers: 16, maxFeathers: 16 };
    var state = createDuelCounterView(battle, side, "black_bird_manipulation", {
      feathers: { counterId: "feathers", label: "乌羽", initial: 16, min: 0, max: 16, format: "number" },
      maxFeathers: { counterId: "feathers", field: "max", initial: 16, min: 0, max: 16, format: "number" },
      initialFeathers: { counterId: "_initial_feathers", initial: 16, min: 0, visible: false }
    });
    state.maxFeathers = Math.max(0, Math.min(16, Math.floor(Number(getDuelCounterPipeline().ensureCounter(battle, side, "black_bird_manipulation", "feathers").max ?? 16))));
    state.feathers = Math.max(0, Math.min(state.maxFeathers, Math.floor(Number(state.feathers ?? state.maxFeathers))));
    state.initialFeathers = Math.max(0, Math.floor(Number(state.initialFeathers ?? 16)));
    updateBlackBirdCounter(battle, side, state);
    return state;
  }

  function getBlackBirdActionId(action) {
    return String(action?.id || action?.actionId || action?.actionId || action?.cardId || "");
  }

  function getSelectedBlackBirdActions(battle, side) {
    return (battle?.selectedHandActions?.[side] || []).map(function unwrap(entry) {
      return entry?.action || entry;
    }).filter(Boolean);
  }

  function getPendingBlackBirdActions(battle, side) {
    var source = Array.isArray(battle?.pendingHandActions?.[side])
      ? battle.pendingHandActions[side]
      : (battle?.selectedHandActions?.[side] || []);
    return source.map(function unwrapPending(entry) {
      return entry?.action || entry;
    }).filter(Boolean);
  }

  function isBlackBirdCommandOrSummonAction(action) {
    var spec = getBlackBirdSpec(action);
    if (spec.effect === "gain") return true;
    var id = getBlackBirdActionId(action);
    return id === "feature_black_bird_command" || id === "feature_black_bird_summon" || /乌羽号令|乌羽号召/.test(String(action?.label || action?.name || ""));
  }

  function isBlackBirdBoostAction(action) {
    return getBlackBirdSpec(action).effect === "boost" || getBlackBirdActionId(action) === "feature_black_bird_boost_one";
  }

  function getBlackBirdBoostMultiplier(action) {
    return Math.max(1, Number(getBlackBirdSpec(action).effectMultiplier || 2));
  }

  function getSelectedBlackBirdBoostMultiplier(battle, side, exceptAction) {
    var exceptId = getBlackBirdActionId(exceptAction);
    return getSelectedBlackBirdActions(battle, side).reduce(function maxBoost(max, action) {
      var id = getBlackBirdActionId(action);
      if (exceptId && id === exceptId) return max;
      return isBlackBirdBoostAction(action) ? Math.max(max, getBlackBirdBoostMultiplier(action)) : max;
    }, 1);
  }

  function hasBlackBirdBoostSelected(battle, side, exceptAction) {
    var exceptId = getBlackBirdActionId(exceptAction);
    return getSelectedBlackBirdActions(battle, side).some(function hasBoost(action) {
      var id = getBlackBirdActionId(action);
      if (exceptId && id === exceptId) return false;
      return isBlackBirdBoostAction(action);
    });
  }

  function hasBlackBirdCommandOrSummonSelected(battle, side, exceptAction) {
    var exceptId = getBlackBirdActionId(exceptAction);
    return getSelectedBlackBirdActions(battle, side).some(function hasGainAction(action) {
      var id = getBlackBirdActionId(action);
      if (exceptId && id === exceptId) return false;
      return isBlackBirdCommandOrSummonAction(action);
    });
  }

  function getBlackBirdRuntimeMultiplier(action, battle, side, forceBoost) {
    if (!isBlackBirdManipulationAction(action) || isBlackBirdBoostAction(action) || isBlackBirdCommandOrSummonAction(action)) return 1;
    if (getBlackBirdSpec(action).effect !== "attack") return 1;
    if (forceBoost) return getBlackBirdBoostMultiplier(action);
    return getSelectedBlackBirdBoostMultiplier(battle, side, action);
  }

  function getBlackBirdRequiredResource(action, battle, side, options) {
    var spec = getBlackBirdSpec(action);
    var multiplier = getBlackBirdRuntimeMultiplier(action, battle, side, options?.forceBoost);
    return {
      featherCost: Math.max(0, Math.ceil(Number(spec.featherCost || 0) * multiplier)),
      maxFeatherCost: Math.max(0, Math.ceil(Number(spec.maxFeatherCost || 0) * multiplier)),
      effectMultiplier: multiplier
    };
  }

  function getReservedBlackBirdResourceCost(battle, side, currentAction, options) {
    var currentId = getBlackBirdActionId(currentAction);
    return getPendingBlackBirdActions(battle, side).reduce(function sumReserved(total, selectedAction) {
      if (!isBlackBirdManipulationAction(selectedAction)) return total;
      var selectedId = getBlackBirdActionId(selectedAction);
      if (currentId && selectedId === currentId) return total;
      var required = getBlackBirdRequiredResource(selectedAction, battle, side, options);
      total.featherCost += Number(required.featherCost || 0);
      total.maxFeatherCost += Number(required.maxFeatherCost || 0);
      return total;
    }, { featherCost: 0, maxFeatherCost: 0 });
  }

  function getBlackBirdActionAvailability(action, actor, battle) {
    if (!isBlackBirdManipulationAction(action)) return { available: true, reason: "" };
    var rikaArsenalCopiedSpecialResourceBypass = isRikaArsenalCopiedSpecialResourceAction(action);
    if (!hasBlackBirdManipulationAccess(actor, battle) && !rikaArsenalCopiedSpecialResourceBypass) return { available: false, reason: "需要黑鸟操术特殊手札" };
    var side = actor?.side || "";
    var state = getBlackBirdState(battle, side);
    if (isBlackBirdBoostAction(action) && hasBlackBirdCommandOrSummonSelected(battle, side, action)) {
      return { available: false, reason: "乌羽助力不能与乌羽号令、乌羽号召并用" };
    }
    if (isBlackBirdCommandOrSummonAction(action) && hasBlackBirdBoostSelected(battle, side, action)) {
      return { available: false, reason: "乌羽助力不能与乌羽号令、乌羽号召并用" };
    }
    var required = getBlackBirdRequiredResource(action, battle, side);
    var reserved = getReservedBlackBirdResourceCost(battle, side, action, { forceBoost: isBlackBirdBoostAction(action) });
    var totalFeatherCost = required.featherCost + reserved.featherCost;
    var totalMaxFeatherCost = required.maxFeatherCost + reserved.maxFeatherCost;
    if (rikaArsenalCopiedSpecialResourceBypass) return { available: true, reason: "" };
    if (totalMaxFeatherCost > 0 && Number(state.maxFeathers || 0) < totalMaxFeatherCost) return { available: false, reason: "乌羽上限不足" };
    var effectiveFeathersAfterMaxCost = Math.min(Number(state.feathers || 0), Math.max(0, Number(state.maxFeathers || 0) - totalMaxFeatherCost));
    if (totalFeatherCost > 0 && effectiveFeathersAfterMaxCost < totalFeatherCost) return { available: false, reason: "乌羽数量不足" };
    return { available: true, reason: "" };
  }

  function getBlackBirdRuntimeAction(action, actor, battle) {
    if (action?.blackBirdRuntime?.active) return action;
    var rikaArsenalCopiedSpecialResourceBypass = isRikaArsenalCopiedSpecialResourceAction(action);
    if (!isBlackBirdManipulationAction(action) || (!hasBlackBirdManipulationAccess(actor, battle) && !rikaArsenalCopiedSpecialResourceBypass)) return action;
    var side = actor?.side || "";
    var spec = getBlackBirdSpec(action);
    var state = getBlackBirdState(battle, side);
    var required = getBlackBirdRequiredResource(action, battle, side);
    var multiplier = Math.max(1, Number(required.effectMultiplier || 1));
    if (rikaArsenalCopiedSpecialResourceBypass) {
      required = { ...required, featherCost: 0, maxFeatherCost: 0 };
    }
    var next = {
      ...action,
      blackBirdOriginalEffects: action.blackBirdOriginalEffects ? { ...action.blackBirdOriginalEffects } : { ...(action.effects || {}) },
      blackBirdDamageOriginal: Number(action.blackBirdDamageOriginal ?? action.effect?.damage ?? action.damage ?? 0),
      blackBirdStabilityDamageOriginal: Number(action.blackBirdStabilityDamageOriginal ?? action.effect?.stabilityDamage ?? action.stabilityDamage ?? action.baseStabilityDamage ?? 0),
      blackBirdDomainPressureOriginal: Number(action.blackBirdDomainPressureOriginal ?? action.effect?.domainPressure ?? action.domainPressure ?? action.baseDomainPressure ?? 0),
      blackBirdRuntime: {
        active: true,
        effect: spec.effect || "",
        feathersBefore: Number(state.feathers || 0),
        maxFeathersBefore: Number(state.maxFeathers || 0),
        featherCost: required.featherCost,
        maxFeatherCost: required.maxFeatherCost,
        effectMultiplier: multiplier,
        rikaArsenalCopiedSpecialResourceBypass: rikaArsenalCopiedSpecialResourceBypass
      },
      blackBirdCeControlDamageScale: Number(spec.controlScale ?? action.blackBirdCeControlDamageScale ?? 0),
      effects: { ...(action.blackBirdOriginalEffects || action.effects || {}) }
    };
    if (spec.effect === "attack" && Number(next.blackBirdDamageOriginal || 0) > 0) {
      setRuntimeActionEffectNumber(next, "damage", Math.max(0, Number(next.blackBirdDamageOriginal || 0) * multiplier));
      setRuntimeActionEffectNumber(next, "stabilityDamage", Math.max(0, Number(next.blackBirdStabilityDamageOriginal || 0) * multiplier));
      setRuntimeActionEffectNumber(next, "domainPressure", Math.max(0, Number(next.blackBirdDomainPressureOriginal || 0) * multiplier));
    }
    if (spec.effect === "defense") {
      var defenseRatio = Math.min(1, Math.max(0, Number(spec.defenseRatio || 0) * multiplier));
      next.effects.incomingHpScale = Math.min(Number(next.effects.incomingHpScale ?? 1), Number(Math.max(0, 1 - defenseRatio).toFixed(4)));
      next.effects.incomingHpReductionCap = Math.max(Number(next.effects.incomingHpReductionCap || 0), Math.max(0, Number(spec.reductionCap || 0) * multiplier));
    }
    if (spec.effect === "boost") {
      next.effects.selfStatuses = (next.effects.selfStatuses || []).concat([{
        id: "blackBirdBoost",
        label: "乌羽助力",
        rounds: 1,
        value: Number(spec.effectMultiplier || 2)
      }]);
    }
    return next;
  }

  function applyBlackBirdResolution(action, actor, battle) {
    var runtime = action?.blackBirdRuntime;
    if (!runtime?.active || !battle || !actor) return null;
    var side = actor.side || "";
    var state = getBlackBirdState(battle, side);
    var beforeFeathers = Number(state.feathers || 0);
    var beforeMax = Number(state.maxFeathers || 0);
    var spec = getBlackBirdSpec(action);
    var consumed = Math.min(beforeFeathers, Math.max(0, Number(runtime.featherCost || 0)));
    var maxConsumed = Math.min(beforeMax, Math.max(0, Number(runtime.maxFeatherCost || 0)));
    if (consumed > 0) state.feathers = Math.max(0, beforeFeathers - consumed);
    if (maxConsumed > 0) {
      state.maxFeathers = Math.max(0, beforeMax - maxConsumed);
      state.feathers = Math.min(Number(state.feathers || 0), state.maxFeathers);
    }
    var gained = 0;
    if (spec.effect === "gain") {
      var gain = Math.max(0, Math.floor(Number(spec.gain || 0)));
      var beforeGain = Number(state.feathers || 0);
      state.feathers = Math.min(Number(state.maxFeathers || 0), beforeGain + gain);
      gained = Math.max(0, Number(state.feathers || 0) - beforeGain);
    }
    updateBlackBirdCounter(battle, side, state);
    if (spec.effect === "boost") {
      actor.statusEffects ||= [];
      actor.statusEffects.push({
        id: "blackBirdBoost",
        label: "乌羽助力",
        rounds: 1,
        value: Number(spec.effectMultiplier || 2),
        source: "black_bird_manipulation"
      });
    }
    if (consumed > 0 || maxConsumed > 0 || gained > 0 || spec.effect === "boost") {
      var sideLabel = getDuelResourceSideLabel(side);
      var detail = sideLabel + actor.name + " 使用 " + (action.label || action.name || "黑鸟操术") + "：乌羽 " +
        beforeFeathers + " -> " + Number(state.feathers || 0) + "，上限 " + beforeMax + " -> " + Number(state.maxFeathers || 0) + "。";
      recordDuelResourceChange(battle, {
        side: side,
        title: "黑鸟操术",
        detail: detail,
        type: "resource",
        delta: {
          blackBirdFeathers: Number(state.feathers || 0) - beforeFeathers,
          blackBirdMaxFeathers: Number(state.maxFeathers || 0) - beforeMax,
          consumed: consumed,
          maxConsumed: maxConsumed,
          gained: gained
        }
      });
    }
    return {
      effect: spec.effect || "",
      feathersBefore: beforeFeathers,
      feathersAfter: Number(state.feathers || 0),
      maxFeathersBefore: beforeMax,
      maxFeathersAfter: Number(state.maxFeathers || 0),
      consumed: consumed,
      maxConsumed: maxConsumed,
      gained: gained,
      effectMultiplier: Number(runtime.effectMultiplier || 1)
    };
  }

  function isProjectionSorceryAction(action) {
    var text = collectDuelActionSearchText(action);
    return text.indexOf("projection_sorcery") !== -1 || text.indexOf("投射术式") !== -1 || text.indexOf("投射咒法") !== -1 || Boolean(action?.projectionSorcery);
  }

  function hasProjectionSorceryAccess(actor, battle) {
    return hasExplicitTechniqueOwnershipTag(actor, battle, "projection_sorcery");
  }

  function getProjectionSpec(action) {
    return action?.projectionSorcery || {};
  }

  function getProjectionFrameState(battle, side) {
    if (!battle || !side) return { frame: 10, min: 0, base: 10, max: 24, round: 0, turnDamage: 0 };
    if (!isDuelCounterAllowedForSide(battle, side, "projection_sorcery", "projectionFrame")) return { frame: 10, min: 0, base: 10, max: 24, round: getDuelActionTurnNumber(battle), turnDamage: 0, transient: true };
    var round = getDuelActionTurnNumber(battle);
    var state = createDuelCounterView(battle, side, "projection_sorcery", {
      frame: { counterId: "projectionFrame", label: "帧率", initial: 10, min: 0, max: 24, format: "number" },
      min: { counterId: "projectionFrame", field: "min", initial: 10, min: 0, max: 24, visible: false },
      max: { counterId: "projectionFrame", field: "max", initial: 10, min: 0, max: 24, visible: false },
      base: { counterId: "_base", initial: 10, min: 0, visible: false },
      round: { counterId: "_round", initial: round, visible: false },
      lockoutUntilRound: { counterId: "projectionFrameLockUntil", initial: 0, min: 0, visible: false },
      turnDamage: { counterId: "_turn_damage", initial: 0, min: 0, visible: false },
      turnDamageRound: { counterId: "_turn_damage_round", initial: 0, min: 0, visible: false },
      settledRound: { counterId: "_settled_round", initial: 0, min: 0, visible: false },
      overdriveRound: { counterId: "_overdrive_round", initial: 0, min: 0, visible: false },
      overdriveDamageThreshold: { counterId: "_overdrive_damage_threshold", initial: 200, min: 0, visible: false },
      overdriveFrameGain: { counterId: "_overdrive_frame_gain", initial: 3, min: 0, visible: false }
    });
    state.round = round;
    state.min = Math.max(0, Number(state.min ?? 0));
    state.base = Math.max(0, Number(state.base ?? 10));
    state.max = Math.max(state.base, Number(state.max ?? 24));
    state.frame = Math.max(state.min, Math.min(state.max, Number(state.frame ?? state.base)));
    updateProjectionFrameCounter(battle, side, state);
    return state;
  }

  function updateProjectionFrameCounter(battle, side, state) {
    if (!battle || !side || !state) return;
    setDuelCounter(battle, side, "projection_sorcery", "projectionFrame", Number(state.frame || 0), {
      label: "帧率", min: Number(state.min || 0), max: Number(state.max || 24), format: "number"
    });
  }

  function upsertProjectionOutOfFrameStatus(actor, scale, rounds) {
    if (!actor) return;
    actor.statusEffects ||= [];
    actor.statusEffects = actor.statusEffects.filter(function keepStatus(effect) {
      return effect?.id !== "projectionOutOfFrameMoment";
    });
    actor.statusEffects.push({
      id: "projectionOutOfFrameMoment",
      label: "出框时刻",
      category: "异常状态",
      statusType: "abnormal",
      rounds: Math.max(1, Number(rounds || 1)),
      value: Number(scale || 1.5),
      source: "projection_sorcery"
    });
  }

  function clampProjectionFrameForLock(state, round) {
    var locked = Number(state.lockoutUntilRound || 0) >= Number(round || 0);
    var maxFrame = locked ? Math.max(0, Number(state.max || 24) - 1) : Number(state.max || 24);
    state.frame = Math.max(Number(state.min || 0), Math.min(maxFrame, Number(state.frame || 0)));
    return state.frame;
  }

  function addProjectionFrames(battle, side, delta) {
    if (!battle || !side) return null;
    var state = getProjectionFrameState(battle, side);
    var before = Number(state.frame || 0);
    var round = getDuelActionTurnNumber(battle);
    state.frame = Number((before + Number(delta || 0)).toFixed(3));
    clampProjectionFrameForLock(state, round);
    updateProjectionFrameCounter(battle, side, state);
    return { before, delta: Number(delta || 0), after: state.frame, frame: state.frame, lockoutUntilRound: state.lockoutUntilRound || 0 };
  }

  function getProjectionActionId(action) {
    return String(action?.id || action?.actionId || action?.actionId || action?.cardId || "");
  }

  function getProjectionHandSealForAction(battle, side, action) {
    var id = getProjectionActionId(action);
    if (!battle || !side || !id) return null;
    var seal = battle.projectionSorcerySeals?.[side]?.[id];
    if (!seal) return null;
    if (Number(seal.expiresRound || 0) && Number(seal.expiresRound || 0) < getDuelActionTurnNumber(battle)) return null;
    return seal;
  }

  function applyProjectionRandomHandSeal(battle, sourceSide, targetSide) {
    if (!battle || !targetSide) return null;
    var handCards = (battle.handState?.[targetSide]?.cards || []).filter(function keepSealTarget(card) {
      var id = getProjectionActionId(card?.action || card);
      return id && !getProjectionHandSealForAction(battle, targetSide, card?.action || card);
    });
    if (!handCards.length) return null;
    var round = getDuelActionTurnNumber(battle);
    var sequence = Math.max(0, Number(battle.projectionSealSequence || 0)) + 1;
    battle.projectionSealSequence = sequence;
    var seed = hashDuelSeed([battle.seed || "projection", round, sourceSide, targetSide, sequence].join(":"));
    var picked = handCards[Math.abs(seed) % handCards.length];
    var action = picked?.action || picked;
    var id = getProjectionActionId(action);
    var seal = {
      actionId: id,
      label: action?.label || action?.name || id,
      sourceSide: sourceSide,
      round: round,
      expiresRound: round,
      message: "本手牌被对方效果封锁"
    };
    battle.projectionSorcerySeals ||= {};
    battle.projectionSorcerySeals[targetSide] ||= {};
    battle.projectionSorcerySeals[targetSide][id] = seal;
    picked.projectionSeal = { ...seal };
    return seal;
  }

  function isProjectionAttackAction(action) {
    var type = String(action?.cardType || action?.type || "").toLowerCase();
    return getRuntimeActionNumber(action, "damage") > 0 || ["attack", "technique", "strike"].includes(type);
  }

  function getSelectedProjectionActions(battle, side) {
    return (battle?.selectedHandActions?.[side] || []).map(function unwrap(entry) {
      return entry?.action || entry;
    }).filter(Boolean);
  }

  function getProjectionActionAvailability(action, actor, battle) {
    var seal = getProjectionHandSealForAction(battle, actor?.side || "", action);
    if (seal) return { available: false, reason: seal.message || "本手牌被对方效果封锁" };
    if (!isProjectionSorceryAction(action)) return { available: true, reason: "" };
    var rikaArsenalCopiedSpecialResourceBypass = isRikaArsenalCopiedSpecialResourceAction(action);
    if (!hasProjectionSorceryAccess(actor, battle) && !rikaArsenalCopiedSpecialResourceBypass) return { available: false, reason: "需要投射术式特殊手札" };
    var side = actor?.side || "";
    var state = getProjectionFrameState(battle, side);
    var spec = getProjectionSpec(action);
    var selected = getSelectedProjectionActions(battle, side);
    var selectedHasSelfBind = selected.some(function hasSelfBind(entry) { return getProjectionSpec(entry).effect === "self_bind"; });
    var selectedHasAttack = selected.some(isProjectionAttackAction);
    if (spec.effect === "self_bind" && selectedHasAttack) return { available: false, reason: "自缚帧本回合不能与攻击牌并用" };
    if (spec.effect !== "self_bind" && isProjectionAttackAction(action) && selectedHasSelfBind) return { available: false, reason: "自缚帧已限制本回合攻击牌" };
    var minFrame = Math.max(0, Number(spec.minFrame ?? action.requirements?.minFrame ?? 0));
    if (minFrame > 0 && Number(state.frame || 0) < minFrame && !rikaArsenalCopiedSpecialResourceBypass) return { available: false, reason: "帧率不足" };
    if (spec.requiresAnotherCard && selected.length < 1) return { available: false, reason: "过帧驱动需要本回合一起打出另一张牌" };
    return { available: true, reason: "" };
  }

  function getProjectionRuntimeAction(action, actor, battle) {
    if (action?.projectionRuntime?.active) return action;
    var rikaArsenalCopiedSpecialResourceBypass = isRikaArsenalCopiedSpecialResourceAction(action);
    if (!isProjectionSorceryAction(action) || (!hasProjectionSorceryAccess(actor, battle) && !rikaArsenalCopiedSpecialResourceBypass)) return action;
    var state = getProjectionFrameState(battle, actor?.side || "");
    var selected = getSelectedProjectionActions(battle, actor?.side || "");
    var spec = getProjectionSpec(action);
    var selectedCount = Number(action.selectedCount || 0);
    if (!selectedCount) {
      selectedCount = selected.length ? Math.max(1, selected.some(function sameSelected(entry) { return getProjectionActionId(entry) === getProjectionActionId(action); }) ? selected.length : selected.length + 1) : 1;
    }
    var next = {
      ...action,
      projectionRuntime: {
        active: true,
        frameBefore: Number(state.frame || 0),
        selectedCount: selectedCount,
        effect: spec.effect || "",
        rikaArsenalCopiedSpecialResourceBypass: rikaArsenalCopiedSpecialResourceBypass
      },
      effects: { ...(action.effects || {}) }
    };
    if (spec.uniqueOnlyBaseDamageBonus && selectedCount === 1 && action?.projectionSorceryDslOnly !== true) {
      setRuntimeActionEffectNumber(next, "damage", getRuntimeActionNumber(next, "damage") + Number(spec.uniqueOnlyBaseDamageBonus || 0));
    }
    if (spec.nonUniqueBaseDamageBonus && selectedCount > 1 && action?.projectionSorceryDslOnly !== true) {
      setRuntimeActionEffectNumber(next, "damage", getRuntimeActionNumber(next, "damage") + Number(spec.nonUniqueBaseDamageBonus || 0));
    }
    if (spec.blockIgnoreRatio != null) next.blockIgnoreRatio = Math.max(0, Math.min(0.9, Number(spec.blockIgnoreRatio || 0)));
    return next;
  }

  function triggerProjectionOutOfFrameIfReady(action, actor, opponent, battle, actorContext) {
    if (!action?.projectionRuntime?.active || !isDuelCounterAllowedForSide(battle, actor?.side || "", "projection_sorcery", "projectionFrame")) return null;
    var side = actor.side || "";
    var state = getProjectionFrameState(battle, side);
    var round = getDuelActionTurnNumber(battle);
    if (Number(state.frame || 0) < Number(state.max || 24) || Number(state.lockoutUntilRound || 0) >= round) return null;
    var scale = Number(getProjectionSpec(action).outOfFrameDamageScale ?? 1.5);
    actorContext.outgoingScale *= Math.max(0, scale);
    state.frame = Number(getProjectionSpec(action).outOfFrameResetFrame ?? 10);
    state.lockoutUntilRound = round;
    updateProjectionFrameCounter(battle, side, state);
    upsertProjectionOutOfFrameStatus(actor, scale, 1);
    return { triggered: true, effect: "out_of_frame_moment", damageScale: scale, frameBefore: Number(state.max || 24), frameAfter: state.frame, round: round };
  }

  function applyProjectionImmediateEffects(action, actor, battle, actorContext) {
    if (!action?.projectionRuntime?.active || !battle || !actor) return null;
    if (!isDuelCounterAllowedForSide(battle, actor.side || "", "projection_sorcery", "projectionFrame")) return { specialRuntime: true, transient: true };
    var spec = getProjectionSpec(action);
    var effect = String(spec.effect || action.projectionRuntime.effect || "");
    var side = actor.side || "";
    var state = getProjectionFrameState(battle, side);
    var frameBefore = Number(state.frame || 0);
    var result = { specialRuntime: true, effect: effect, frameBefore: frameBefore };
    if (effect === "frame_break") {
      var frameCost = Math.max(0, Number(spec.frameCost || 0));
      result.frameChange = addProjectionFrames(battle, side, -frameCost);
      result.frameCost = frameCost;
    } else if (effect === "self_bind") {
      actorContext.incomingHpScale *= Math.max(0, Number(spec.incomingHpScale ?? 0.65));
      actorContext.incomingHpReductionCap += Math.max(0, Number(spec.incomingHpReductionCap || 0));
      actor.statusEffects ||= [];
      actor.statusEffects = actor.statusEffects.filter(function replaceProjectionSelfBind(status) {
        return status?.id !== "projectionSelfBindFrame";
      });
      actor.statusEffects.push({
        id: "projectionSelfBindFrame",
        label: "自缚帧",
        rounds: 1,
        value: 1,
        frameGainPerDamage: Math.max(1, Number(spec.frameGainPerDamage || 40)),
        maxFrameGain: Math.max(0, Number(spec.maxFrameGainOnDamage || 3)),
        gainedFrame: 0,
        source: "projection_sorcery"
      });
      result.incomingHpScale = Number(spec.incomingHpScale ?? 0.65);
      result.incomingHpReductionCap = Math.max(0, Number(spec.incomingHpReductionCap || 0));
    } else if (effect === "frame_shield") {
      var shieldValue = Math.max(0, Number(actor.maxHp || 0) * Math.max(0, Number(spec.shieldMaxHpRatio || 0)));
      actor.statusEffects ||= [];
      actor.statusEffects = actor.statusEffects.filter(function replaceProjectionFrameShield(status) {
        return status?.id !== "projectionFrameShield";
      });
      actor.statusEffects.push({
        id: "projectionFrameShield",
        label: "帧盾",
        rounds: Math.max(1, Number(spec.shieldRounds || 2)),
        value: Number(shieldValue.toFixed(1)),
        reflectTrueDamageRatio: Math.max(0, Number(spec.reflectTrueDamageRatio || 0)),
        source: "projection_sorcery"
      });
      result.frameChange = addProjectionFrames(battle, side, Math.max(0, Number(spec.frameGain || 0)));
      result.shield = Number(shieldValue.toFixed(1));
    } else if (effect === "sync") {
      result.frameChange = addProjectionFrames(battle, side, Math.max(0, Number(spec.frameGain || 0)));
      actorContext.outgoingScale *= Math.max(0, Number(spec.damageScale || 1));
      result.damageScale = Math.max(0, Number(spec.damageScale || 1));
    } else if (effect === "overdrive") {
      state.overdriveRound = getDuelActionTurnNumber(battle);
      state.overdriveDamageThreshold = Math.max(0, Number(spec.extraFrameIfTurnDamageOver || 200));
      state.overdriveFrameGain = Math.max(0, Number(spec.extraFrameGain || 3));
      result.overdriveDamageThreshold = state.overdriveDamageThreshold;
      result.overdriveFrameGain = state.overdriveFrameGain;
    }
    result.frameAfter = Number(getProjectionFrameState(battle, side).frame || 0);
    return result;
  }
  function recordProjectionTurnDamage(battle, side, amount) {
    if (!battle || !side || Number(amount || 0) <= 0) return;
    var state = getProjectionFrameState(battle, side);
    state.turnDamageRound = getDuelActionTurnNumber(battle);
    state.turnDamage = Number((Number(state.turnDamage || 0) + Number(amount || 0)).toFixed(1));
  }

  function settleProjectionTurnFrameGain(actor, battle) {
    if (!hasProjectionSorceryAccess(actor, battle)) return null;
    var side = actor.side || "";
    var state = getProjectionFrameState(battle, side);
    var round = getDuelActionTurnNumber(battle);
    if (Number(state.settledRound || 0) === round) return null;
    var damage = Number(state.turnDamageRound || 0) === round ? Math.max(0, Number(state.turnDamage || 0)) : 0;
    var delta = damage <= 0 ? -1 : (damage <= 100 ? 4 : (damage <= 300 ? 6 : (damage <= 600 ? 9 : 12)));
    if (Number(state.overdriveRound || 0) === round && damage > Number(state.overdriveDamageThreshold || 200)) {
      delta += Number(state.overdriveFrameGain || 3);
    }
    var before = Number(state.frame || 0);
    addProjectionFrames(battle, side, delta);
    if (Number(state.frame || 0) >= Number(state.max || 24) && Number(state.lockoutUntilRound || 0) < round) {
      upsertProjectionOutOfFrameStatus(actor, 1.5, 2);
    }
    state.settledRound = round;
    state.turnDamage = 0;
    state.turnDamageRound = 0;
    state.overdriveRound = 0;
    updateProjectionFrameCounter(battle, side, state);
    return { frameBefore: before, frameAfter: state.frame, damage: damage, delta: delta, lockoutUntilRound: state.lockoutUntilRound || 0 };
  }

  function applyProjectionDamageTakenFrameGain(target, battle, appliedDamage) {
    var resource = target?.resource;
    var side = resource?.side || target?.side || "";
    if (!battle || !resource || !side || Number(appliedDamage || 0) <= 0) return null;
    var status = (resource.statusEffects || []).find(function findStatus(effect) {
      return effect?.id === "projectionSelfBindFrame";
    });
    if (!status) return null;
    var already = Math.max(0, Number(status.gainedFrame || 0));
    var maxGain = Math.max(0, Number(status.maxFrameGain ?? 3));
    var unit = Math.max(1, Number(status.frameGainPerDamage ?? 100));
    var gain = Math.min(maxGain - already, Math.floor(Number(appliedDamage || 0) / unit));
    if (gain <= 0) return null;
    status.gainedFrame = already + gain;
    return addProjectionFrames(battle, side, gain);
  }

  function applyProjectionFrameShieldReflect(defender, attacker, battle, appliedDamage) {
    if (!battle || !defender || !attacker || Number(appliedDamage || 0) <= 0) return null;
    var status = (defender.statusEffects || []).find(function findShield(effect) {
      return effect?.id === "projectionFrameShield" && Number(effect.reflectTrueDamageRatio || 0) > 0;
    });
    if (!status) return null;
    var reflected = Math.max(0, Math.round(Number(appliedDamage || 0) * Number(status.reflectTrueDamageRatio || 0)));
    if (!reflected) return null;
    var beforeHp = Number(attacker.hp || 0);
    attacker.hp = Number((beforeHp - reflected).toFixed(1));
    recordProjectionTurnDamage(battle, defender.side || "", reflected);
    return { reflected: reflected, beforeHp: beforeHp, afterHp: Number(attacker.hp || 0), source: "projection_frame_shield" };
  }

  function isDounaSukunaFirstLifeActor(actor, battle) {
    if (!battle?.dounaGauntlet || actor?.side !== "right") return false;
    if (Number(battle.dounaGauntlet.bossLife || 1) !== 1) return false;
    if ((Array.isArray(actor?.statusEffects) ? actor.statusEffects : []).some(function hasFirstLife(effect) {
      return effect?.id === "dounaSukunaFirstLife";
    })) return true;
    return /宿傩|sukuna|御厨子/.test(String(actor?.name || actor?.characterCardProfile?.displayName || ""));
  }

  function hasDounaSubduedMahoragaUnit(battle, side) {
    return getDuelBattlefieldUnits(battle).some(function findUnit(unit) {
      var unitText = [
        unit?.id,
        unit?.cardId,
        unit?.actionId,
        unit?.name,
        unit?.label,
        ...(Array.isArray(unit?.tags) ? unit.tags : [])
      ].filter(Boolean).join(" ");
      return unit?.ownerSide === side && unit?.active !== false && !unit?.defeated && getDuelUnitHp(unit) > 0 &&
        /douna_subdued_mahoraga|adjusted_mahoraga|已调伏(?:的)?魔虚罗|魔虚罗已调幅|已调幅(?:的)?魔[须須虚]罗|協同魔虚罗|协同魔虚罗/i.test(unitText);
    });
  }

  function hasAdjustedMahoragaAccess(actor, battle) {
    var profile = getDuelProfileForSide(battle, actor?.side || "") || {};
    var traitSources = [
      actor,
      actor?.characterCardProfile,
      actor?.duelProfileSnapshot,
      actor?.profile,
      profile,
      profile?.characterCardProfile,
      profile?.duelProfileSnapshot,
      profile?.profile
    ];
    var traits = uniqueFeatureList(traitSources.flatMap(function collectAdjustedMahoragaTraits(source) {
      return toFeatureList(source?.innateTraits).concat(toFeatureList(source?.traits));
    }));
    return traits.some(function hasAdjustedMahoragaTrait(trait) {
      var normalized = String(trait || "").replace(/[\s·・]/g, "");
      return /^已调幅(?:的)?魔[须須虚虛]罗$/i.test(normalized);
    });
  }

  function buildAdjustedMahoragaActions(actor, battle) {
    if (!hasAdjustedMahoragaAccess(actor, battle)) return [];
    var side = actor?.side || "left";
    if (hasDounaSubduedMahoragaUnit(battle, side)) return [];
    var template = getDuelHandInjectionV2Template("mahoraga_wheel_adjusted_summon");
    if (!template) return [];
    return [{
      ...template,
      id: "adjusted_mahoraga_card",
      actionId: "adjusted_mahoraga_card",
      cardId: "card_adjusted_mahoraga",
      label: "八握剑·异戒神将·魔虚罗",
      name: "八握剑·异戒神将·魔虚罗",
      tags: mergeUniqueTextList(template.tags, ["魔虚罗已调幅", "已调幅", "友方式神"]),
      guaranteedPerTurn: true,
      retainedPermanent: true,
      handSource: "mahoraga-wheel-adjusted",
      summonSpec: {
        ...(template.summonSpec || {}),
        unitCardId: "mahoraga_wheel_adjusted_unit",
        unitName: "八握剑·异戒神将·魔虚罗（调幅）",
        uniqueSummonKey: "mahoraga_wheel_adjusted_unit",
        control: "player_controlled"
      },
      unitStats: {
        ...(template.unitStats || {}),
        tags: mergeUniqueTextList(template.unitStats?.tags, ["魔虚罗已调幅", "已调幅"])
      },
      effectSummary: "转盘抽中调幅成功后，打出魔虚罗·调幅召唤会直接召唤友方式神，不接管角色、不锁手牌。",
      logTemplate: "你打出魔虚罗·调幅召唤，转盘调幅后的魔虚罗加入战场。"
    }];
  }

  function hasDounaSubduedAgitoUnit(battle, side) {
    return getDuelBattlefieldUnits(battle).some(function findUnit(unit) {
      var unitText = [
        unit?.id,
        unit?.cardId,
        unit?.actionId,
        unit?.name,
        unit?.label,
        ...(Array.isArray(unit?.tags) ? unit.tags : [])
      ].filter(Boolean).join(" ");
      return unit?.ownerSide === side && unit?.active !== false && !unit?.defeated && getDuelUnitHp(unit) > 0 &&
        /douna_subdued_agito|嵌合兽顎吐|嵌合獸顎吐|顎吐|颚吐|agito/i.test(unitText);
    });
  }

  function buildDounaSubduedAgitoActions(actor, battle) {
    if (!isDounaSukunaFirstLifeActor(actor, battle)) return [];
    var side = actor?.side || "right";
    if (hasDounaSubduedAgitoUnit(battle, side)) return [];
    var template = getDuelHandInjectionV2Template("douna_subdued_agito_summon");
    return template ? [{ ...template, fixedEvasionRate: 0, evasionRate: 0, guaranteedPerTurn: true, retainedPermanent: true }] : [];
  }

  function getDounaFirstLifeHpRatio(actor, battle) {
    var hp = Math.max(0, Number(actor?.hp || 0));
    var maxHp = Math.max(1, Number(actor?.maxHp || battle?.dounaGauntlet?.firstLifeMaxHp || hp || 1));
    return Math.max(0, Math.min(1, hp / maxHp));
  }

  function getDounaFirstLifeShrineRoundScale(battle) {
    var round = Math.max(1, Number(battle?.round || battle?.turn || battle?.duelRound || 1));
    if (round <= 3) return 0.42;
    if (round <= 6) return 0.5;
    if (round <= 8) return 0.58;
    if (round <= 10) return 0.66;
    if (round <= 12) return 0.74;
    return 0.82;
  }

  function getDounaFirstLifeShrineHpScale(actor, battle) {
    var ratio = getDounaFirstLifeHpRatio(actor, battle);
    if (ratio >= 0.82) return 0.72;
    if (ratio >= 0.58) return 0.88;
    if (ratio >= 0.32) return 1;
    if (ratio >= 0.18) return 0.74;
    return 0.55;
  }

  function getDounaFirstLifeShrineDamageScale(actor, battle) {
    var roundScale = getDounaFirstLifeShrineRoundScale(battle);
    var hpScale = getDounaFirstLifeShrineHpScale(actor, battle);
    return roundScale * hpScale;
  }

  function buildDounaFirstLifeShrineActions(actor, opponent, battle) {
    if (!isDounaSukunaFirstLifeActor(actor, battle)) return [];
    var targetHp = Math.max(1, Number(opponent?.hp || opponent?.maxHp || 1));
    var shrineScale = getDounaFirstLifeShrineDamageScale(actor, battle);
    var dismantleDamage = Math.round(Math.max(22, Math.min(96, Math.round(targetHp * 0.16 * shrineScale))) * 1.2);
    var cleaveDamage = Math.round(Math.max(30, Math.min(120, Math.round(targetHp * 0.21 * shrineScale))) * 1.2);
    var furnaceDamage = Math.round(Math.max(42, Math.min(170, Math.round(targetHp * 0.28 * shrineScale))) * 2);
    return [
      {
        id: "douna_first_life_dismantle",
        actionId: "dismantle_pressure",
        label: "解",
        name: "解",
        cardType: "technique",
        type: "douna_first_life_shrine",
        tags: ["御厨子", "伏魔御厨子", "宿傩", "解", "斩击", "shrine", "dismantle"],
        specialHandTags: ["shrine"],
        apCost: 1,
        cost: { ce: 64 },
        ceCost: 64,
        costType: "flat",
        damage: dismantleDamage,
        stabilityDamage: 8,
        effect: { damage: dismantleDamage, stabilityDamage: 8 },
        effects: { damage: dismantleDamage, stabilityDamage: 8 },
        damageType: "technique",
        scalingProfile: "burst",
        accuracyProfile: "technique_projectile",
        evasionAllowed: true,
        baseHitRate: 0.84,
        risk: "medium",
        weight: 760,
        effectSummary: "斗傩第一命御厨子「解」：前6回合伤害至少减半，随后逐步回升；伤害仍随宿傩血量呈中段较高、开局与残血较低的分布，CE消耗进一步提高以避免连续复读。",
        logTemplate: "宿傩以「解」切开挑战者的防线。",
        status: "CONFIRMED"
      },
      {
        id: "douna_first_life_cleave",
        actionId: "cleave_adaptation",
        label: "捌",
        name: "捌",
        cardType: "technique",
        type: "douna_first_life_shrine",
        tags: ["御厨子", "伏魔御厨子", "宿傩", "捌", "斩击", "shrine", "cleave"],
        specialHandTags: ["shrine"],
        apCost: 1,
        cost: { ce: 82 },
        ceCost: 82,
        costType: "flat",
        damage: cleaveDamage,
        stabilityDamage: 12,
        effect: { damage: cleaveDamage, stabilityDamage: 12 },
        effects: { damage: cleaveDamage, stabilityDamage: 12 },
        damageType: "technique",
        scalingProfile: "burst",
        accuracyProfile: "technique_projectile",
        evasionAllowed: true,
        baseHitRate: 0.78,
        risk: "high",
        weight: 735,
        effectSummary: "斗傩第一命御厨子「捌」：前6回合伤害至少减半，随后逐步回升；伤害仍随宿傩血量呈中段较高、开局与残血较低的分布，CE消耗进一步提高以避免连续复读。",
        logTemplate: "宿傩以「捌」贴合咒力强度落下斩击。",
        status: "CONFIRMED"
      },
      {
        id: "douna_first_life_furnace",
        actionId: "feature_shrine_119",
        label: "灶·开",
        name: "灶·开",
        cardType: "technique",
        type: "douna_first_life_shrine",
        tags: ["御厨子", "伏魔御厨子", "宿傩", "灶·开", "灶开", "火炎", "shrine", "furnace"],
        specialHandTags: ["shrine"],
        apCost: 2,
        cost: { ce: 82 },
        ceCost: 82,
        costType: "flat",
        damage: furnaceDamage,
        stabilityDamage: 16,
        domainPressure: 10,
        effect: { damage: furnaceDamage, stabilityDamage: 16, domainPressure: 10 },
        effects: { damage: furnaceDamage, stabilityDamage: 16, domainPressure: 10 },
        damageType: "domain",
        scalingProfile: "techniquePower + control",
        accuracyProfile: "technique_area",
        evasionAllowed: true,
        baseHitRate: 0.58,
        hitRateModifier: -0.08,
        risk: "critical",
        weight: 780,
        effectSummary: "斗傩第一命御厨子「灶·开」：前6回合伤害至少减半，随后逐步回升；一阶段高热爆发仍在中段博弈期更强，开局与残血阶段更低。",
        logTemplate: "宿傩开炉，火炎吞向挑战者。",
        status: "CONFIRMED"
      }
    ];
  }

  function buildDounaWorldSlashActions(actor, opponent, battle) {
    var gauntlet = battle?.dounaGauntlet;
    if (!gauntlet || actor?.side !== "right") return [];
    if (gauntlet.bossLife === 1 && gauntlet.worldSlashGranted && !gauntlet.worldSlashUsed) {
      return [{
        id: "douna_world_slash",
        actionId: "douna_world_slash",
        label: "世界斩",
        name: "世界斩",
        cardType: "technique",
        type: "douna_world_slash",
        tags: ["World Slash", "斩击", "终结"],
        specialHandTags: ["World Slash"],
        apCost: 1,
        cost: { ce: 0 },
        ceCost: 0,
        damage: Math.max(999, Number(opponent?.hp || 0) + 999),
        costType: "flat",
        damageType: "hp",
        scalingProfile: "none",
        accuracyProfile: "world_slash",
        evasionAllowed: true,
        instantKillOnHit: true,
        effect: { damage: Math.max(999, Number(opponent?.hp || 0) + 999), instantKillOnHit: true, dounaImmediateWorldSlash: true },
        effects: { damage: Math.max(999, Number(opponent?.hp || 0) + 999), instantKillOnHit: true, dounaImmediateWorldSlash: true },
        logTemplate: "宿傩挥出世界斩。",
        risk: "critical",
        rarity: "legendary",
        weight: 999,
        effectSummary: "强制击杀当前挑战者。",
        status: "CONFIRMED"
      }];
    }
    var turn = Number(battle?.round || 0) + 1;
    var shouldOfferBoundWorldSlash = !gauntlet.pendingBoundWorldSlash && (
      (gauntlet.bossLife === 2 && Number(gauntlet.boundWorldSlashLastRound || -99) <= turn - 2) ||
      (gauntlet.bossLife === 1 && gauntlet.worldSlashUsed)
    );
    if (shouldOfferBoundWorldSlash) {
      return [{
        id: "douna_bound_world_slash",
        actionId: "douna_bound_world_slash",
        label: "束缚世界斩",
        name: "束缚世界斩",
        cardType: "technique",
        type: "douna_bound_world_slash",
        tags: ["World Slash", "束缚", gauntlet.bossLife === 2 ? "即时终结" : "延迟终结"],
        specialHandTags: ["World Slash"],
        apCost: 1,
        cost: { ce: 0 },
        ceCost: 0,
        damage: Math.max(999, Number(opponent?.hp || 0) + 999),
        costType: "flat",
        damageType: "hp",
        scalingProfile: "none",
        accuracyProfile: "world_slash",
        evasionAllowed: true,
        baseHitRate: 0.7,
        instantKillOnHit: gauntlet.bossLife === 2,
        effect: gauntlet.bossLife === 2
          ? { damage: Math.max(999, Number(opponent?.hp || 0) + 999), instantKillOnHit: true, dounaImmediateWorldSlash: true, dounaSecondLifeBoundWorldSlash: true }
          : { damage: Math.max(999, Number(opponent?.hp || 0) + 999), dounaBoundWorldSlash: true },
        effects: gauntlet.bossLife === 2
          ? { damage: Math.max(999, Number(opponent?.hp || 0) + 999), instantKillOnHit: true, dounaImmediateWorldSlash: true, dounaSecondLifeBoundWorldSlash: true }
          : { damage: Math.max(999, Number(opponent?.hp || 0) + 999), dounaBoundWorldSlash: true },
        logTemplate: gauntlet.bossLife === 2 ? "宿傩以束缚世界斩斩断目标。" : "宿傩摆出了世界斩的手势。",
        risk: "critical",
        rarity: "legendary",
        weight: 980,
        effectSummary: gauntlet.bossLife === 2
          ? "第二命束缚世界斩：本回合立即结算，至少间隔一回合才能再次使用。"
          : "本回合摆出世界斩手势；下一回合以 70% 命中率强制击杀当前挑战者。",
        status: "CONFIRMED"
      }];
    }
    return [];
  }

  function getDuelActionYutaRikaManifestationEra(action) {
    var text = collectDuelActionSearchText(action);
    var id = String(action?.id || action?.actionId || action?.cardId || "");
    if (/yuta_rika_modern_full_manifestation|yuta_rika_manifestation_modern|rika_modern_full_manifestation|modern_rika|正传/.test(id + " " + text)) return "modern";
    if (/yuta_rika_full_manifestation|yuta_rika_manifestation_volume0|rika_volume0_full_manifestation|volume0_rika|0卷|真里香|特级过咒怨灵-完全显现/.test(id + " " + text)) return "volume0";
    return "";
  }

  function isDuelActionYutaRikaManifestation(action) {
    return Boolean(action?.summonSpec?.unitCardId && /yuta_rika_full_manifestation|yuta_rika_manifestation|祈本里香完全显现/.test(collectDuelActionSearchText(action)));
  }

  function getActorYutaRikaManifestationEra(actor, battle) {
    var snapshot = getActorFeatureSnapshot(actor, battle);
    var tags = uniqueFeatureList([].concat(toFeatureList(snapshot?.explicitSpecialHandTags), toFeatureList(snapshot?.specialHandTags)));
    if (tags.includes("yuta_rika_manifestation_volume0")) return "volume0";
    if (tags.includes("yuta_rika_manifestation_modern") || tags.includes("rika_ring")) return "modern";
    return "";
  }

  function filterMismatchedYutaRikaManifestationActions(actions, actor, battle) {
    var actorEra = getActorYutaRikaManifestationEra(actor, battle);
    if (!actorEra) return actions || [];
    return (actions || []).filter(function keepRikaEraAction(action) {
      if (!isDuelActionYutaRikaManifestation(action)) return true;
      var actionEra = getDuelActionYutaRikaManifestationEra(action);
      return !actionEra || actionEra === actorEra;
    });
  }

  function buildDuelActionPool(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var dounaFirstLifeSukuna = isDounaSukunaFirstLifeActor(actor, battle);
    var adjustedMahoragaAccess = hasAdjustedMahoragaAccess(actor, battle);
    var specialSourceActionIds = getTechniqueFeatureHandSourceActionIds();
    var baseActionTemplates = mergeDuelDomainControlActionTemplates(getDuelActionTemplateIndex().templates).filter(function removeSpecialShadowedTemplate(template) {
      return !isActionTemplateShadowedBySpecialHand(template, specialSourceActionIds);
    });
    var templates = [
      ...baseActionTemplates,
      ...buildCustomDuelSpecialActions(actor),
      ...buildDirectBattleCardActions(actor, battle),
      ...buildBloodManipulationCoreActions(actor, battle),
      ...buildReverseCursedTechniqueActions(actor, opponent, battle),
      ...buildTechniqueFeatureHandActions(actor, opponent, battle),
      ...buildDounaFirstLifeShrineActions(actor, opponent, battle),
      ...buildAdjustedMahoragaActions(actor, battle),
      ...buildDounaSubduedAgitoActions(actor, battle),
      ...buildDounaWorldSlashActions(actor, opponent, battle),
      ...buildDuelDomainSpecificActions(actor, opponent, battle)
    ];
    if (dounaFirstLifeSukuna || adjustedMahoragaAccess) {
      templates = templates.filter(function removeUnavailableTuningRitual(template) {
        return !isMahoragaTuningRitualAction(template);
      });
    }
    var existingIds = new Set(templates.map(function mapTemplateId(template) {
      return template?.id || template?.actionId || "";
    }).filter(Boolean));
    buildDuelCardTemplateHandActions().forEach(function addCardTemplateAction(action) {
      var id = action?.id || action?.actionId || "";
      if (!id || existingIds.has(id)) return;
      if ((dounaFirstLifeSukuna || adjustedMahoragaAccess) && isMahoragaTuningRitualAction(action)) return;
      templates.push(action);
      existingIds.add(id);
    });
    // 旧版本会在这里手动补一张魔虚罗调幅仪式；现在以正式 V2 牌库为唯一来源，避免同名重复发放。
    var hasMahoragaTuningRitual = templates.some(isMahoragaTuningRitualAction) ||
      existingIds.has("mahoraga_tuning_ritual") ||
      existingIds.has("ten_shadows_mahoraga_tuning_ritual") ||
      existingIds.has("card_ten_shadows_mahoraga_tuning_ritual");
    var actorCanUseTenShadows = hasActorExplicitSpecialHandTag(getActorFeatureSnapshot(actor, battle), "ten_shadows");
    if (!dounaFirstLifeSukuna && !adjustedMahoragaAccess && actorCanUseTenShadows && !hasMahoragaTuningRitual) {
      templates.push({
        id: "mahoraga_tuning_ritual",
        actionId: "mahoraga_tuning_ritual",
        label: "魔虚罗调幅仪式",
        name: "魔虚罗调幅仪式",
        cardType: "summon",
        type: "ten_shadows_ritual",
        normalHandOnly: true,
        tags: ["十影", "魔虚罗", "调幅仪式", "召唤", "式神", "仪式"],
        specialHandTags: ["ten_shadows"],
        exclusiveToArchetypes: [],
        requiresCe: true,
        requirements: { domainActive: "any" },
        apCost: 2,
        cost: { ce: 0 },
        ceCost: 0,
        damage: 0,
        effect: { damage: 0 },
        costType: "percentage",
        ceCostRatio: 0.5,
        risk: "critical",
        effects: {
          activateDomain: false,
          summonMahoragaProxy: true,
          stabilityDelta: 0,
          weightDeltas: { ten_shadows_ritual: 5 }
        },
        effectSummary: "召来未调幅魔虚罗强制接手战斗。魔虚罗存活期间保护召唤者；魔虚罗死亡时召唤者落败。",
        status: "CONFIRMED"
      });
      existingIds.add("mahoraga_tuning_ritual");
    }
    templates = filterMismatchedYutaRikaManifestationActions(templates, actor, battle).filter(function keepManifestationGrantedCards(template) {
      // This finisher is injected exactly once by the manifestation summon;
      // keeping it in the random pool would create duplicate/repeat copies.
      return !isYutaTruePureLoveCannonAction(template);
    });
    var identityFilteredTemplates = templates.filter(function filterIdentityScopedAction(template) {
      return isDuelActionAllowedByActorIdentity(template, actor, battle);
    });
    return identityFilteredTemplates.map(function mapTemplate(template) {
      var runtimeTemplate = getTacticalHumanRuntimeAction(getDisasterRuntimeAction(getProjectionRuntimeAction(getBlackBirdRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(template, actor, battle), actor, battle), actor, battle), actor, battle), actor, opponent, battle), actor, opponent, battle);
      if (runtimeTemplate.domainSpecific && runtimeTemplate.available !== undefined) return runtimeTemplate;
      var availability = getDuelActionAvailability(runtimeTemplate, actor, opponent, battle);
      return {
        ...runtimeTemplate,
        costCe: availability.costCe,
        available: availability.available,
        unavailableReason: availability.reason,
        riskLabel: getDuelActionRiskLabel(runtimeTemplate, actor, opponent)
      };
    });
  }

  function buildCustomDuelSpecialActions(actor) {
    var appState = getOptionalDependency("state");
    var actorId = actor?.profileId || actor?.characterId || actor?.id || "";
    if (!actorId || !Array.isArray(appState?.customDuelCards)) return [];
    var card = appState.customDuelCards.find(function findCustomCard(item) {
      return item?.characterId === actorId || item?.id === actorId;
    });
    if (!card || !Array.isArray(card.customHandCards)) return [];
    var seenCustomActionIds = new Set();
    return card.customHandCards.filter(function keepOwnedCustomHand(action) {
      if (!action || typeof action !== "object") return false;
      var identityCandidates = uniqueFeatureList([
        action.sourceCardId,
        action.cardId,
        action.actionId,
        action.id
      ]);
      // Old login cards could preserve canonical battle cards inside
      // customHandCards and then overwrite their ownership tags with the
      // custom character tag. Canonical cards already enter through the
      // ownership-aware direct-card pool, so replaying them here only creates
      // duplicates and lets foreign summons bypass technique isolation.
      var canonicalReplay = identityCandidates.some(function isCanonicalReplay(identity) {
        return Boolean(getDuelSpecialCardByCardId(identity));
      });
      if (canonicalReplay) return false;
      var stableId = String(action.id || action.actionId || action.cardId || "").trim();
      if (stableId && seenCustomActionIds.has(stableId)) return false;
      if (stableId) seenCustomActionIds.add(stableId);
      return true;
    }).map(function mapCustomHand(action) {
      return normalizeOwnedCustomDuelSpecialAction(action, actorId);
    });
  }

  function buildCustomDuelOwnerTechniqueFamily(characterId) {
    var ownerId = String(characterId || "").trim();
    return ownerId ? "custom_character_" + ownerId.replace(/[^\w-]+/g, "_") : "";
  }

  function normalizeOwnedCustomDuelSpecialAction(action, ownerId) {
    var characterId = String(ownerId || action?.customCharacterId || "").trim();
    var ownerFamily = buildCustomDuelOwnerTechniqueFamily(characterId);
    var specialHandTags = uniqueFeatureList([].concat(
      action?.specialHandTags || [],
      action?.["特殊手札"] || [],
      ownerFamily ? [ownerFamily] : []
    ));
    return {
      ...action,
      customDuelCard: true,
      customCharacterId: characterId,
      sourceTechniqueFamily: ownerFamily || String(action?.sourceTechniqueFamily || "").trim(),
      specialHandTags: specialHandTags,
      "特殊手札": specialHandTags,
      specialHandCard: Boolean(ownerFamily || specialHandTags.length),
      exclusiveToCharacters: characterId ? [characterId] : [],
      tags: uniqueFeatureList([].concat(action?.tags || [], ownerFamily ? ["特殊手札", ownerFamily] : [])),
      available: true
    };
  }

  function buildCardTemplateRuntimeEffects(card) {
    var effects = { ...(card?.effects || {}) };
    [
      "outgoingScale",
      "damageScale",
      "incomingHpScale",
      "incomingCeScale",
      "sureHitScale",
      "domainPressureScale",
      "manualAttackScale",
      "domainLoadScale",
      "selfHpCostRatio",
      "selfHpCostFlat",
      "evasionBonus"
    ].forEach(function copyRuntimeNumber(key) {
      if (card?.[key] === undefined) return;
      var value = Number(card[key]);
      if (Number.isFinite(value)) effects[key] = value;
    });
    if (card?.selfHpCostNonlethal !== undefined) {
      effects.selfHpCostNonlethal = card.selfHpCostNonlethal !== false;
    }
    if (card?.blockToIncomingScale !== undefined) {
      effects.blockToIncomingScale = Boolean(card.blockToIncomingScale);
    }
    if (card?.consumeOutgoingScaleOnDamage !== undefined) {
      effects.consumeOutgoingScaleOnDamage = card.consumeOutgoingScaleOnDamage !== false;
    }
    if (card?.rangeAdjustment || effects.rangeAdjustment) {
      effects.rangeAdjustment = true;
      effects.rangeAdjustmentDamageScale = Math.max(0, Number(card?.rangeAdjustmentDamageScale ?? effects.rangeAdjustmentDamageScale ?? 0.6));
    }
    if (Array.isArray(card?.delayedSelfStatuses)) {
      effects.delayedSelfStatuses = card.delayedSelfStatuses.map(function cloneDelayedStatus(status) {
        return { ...(status || {}) };
      });
    }
    return effects;
  }

  function buildDuelCardTemplateHandAction(card) {
    if (!card?.actionId || card.playableInHandBeta === false || card.futureTemplate) return null;
    if (card.actionId === "forced_output" || card.cardId === "card_forced_output" || card.name === "强制输出") return null;
    var actionId = card.actionId || card.actionId || card.id;
    var ceCost = Number(card.cost?.ce ?? card.ceCost ?? 0);
    var damage = Number(card.effect?.damage ?? card.damage ?? 0);
    var block = Number(card.effect?.block ?? card.block ?? 0);
    var effect = {
      ...buildCardTemplateRuntimeEffects(card),
      ...(card.effect || {}),
      damage: damage,
      block: block,
      domainLoadDelta: Number(card.effect?.domainLoadDelta ?? card.domainLoadDelta ?? card.baseDomainLoadDelta ?? 0)
    };
    return {
      id: actionId,
      actionId: actionId,
      cardId: card.cardId || ("card_" + actionId),
      label: card.name || actionId,
      name: card.name || actionId,
      description: card.effectSummary || card.summary || "",
      cardType: card.cardType || "technique",
      type: "card_template_runtime",
      tags: Array.isArray(card.tags) ? card.tags.slice() : [],
      specialHandTags: Array.isArray(card.specialHandTags) ? card.specialHandTags.slice() : [],
      "特殊手札": Array.isArray(card["特殊手札"]) ? card["特殊手札"].slice() : (Array.isArray(card.specialHandTags) ? card.specialHandTags.slice() : []),
      contexts: Array.isArray(card.contexts) ? card.contexts.slice() : ["normal"],
      requirements: { ...(card.requirements || {}) },
      requiredTraits: Array.isArray(card.requiredTraits) ? card.requiredTraits.slice() : [],
      forbiddenTraits: Array.isArray(card.forbiddenTraits) ? card.forbiddenTraits.slice() : [],
      exclusiveToCharacters: Array.isArray(card.exclusiveToCharacters) ? card.exclusiveToCharacters.slice() : [],
      exclusiveToVariants: Array.isArray(card.exclusiveToVariants) ? card.exclusiveToVariants.slice() : [],
      exclusiveToArchetypes: Array.isArray(card.exclusiveToArchetypes) ? card.exclusiveToArchetypes.slice() : [],
      forbiddenArchetypes: Array.isArray(card.forbiddenArchetypes) ? card.forbiddenArchetypes.slice() : [],
      requiresCe: Boolean(card.requiresCe),
      requiresInnateTechnique: Boolean(card.requiresInnateTechnique),
      requiresDomainAccess: Boolean(card.requiresDomainAccess),
      requiresCursedTool: Boolean(card.requiresCursedTool || card.requirements?.requiresCursedTool),
      requiresZeroCe: Boolean(card.requiresZeroCe || card.requirements?.requiresZeroCe),
      apCost: Number(card.apCost || 1),
      cost: { ...(card.cost || {}), ce: ceCost },
      ceCost: ceCost,
      damage: damage,
      block: block,
      baseCePoolScale: Number(card.baseCePoolScale || 0),
      baseCeControlScale: Number(card.baseCeControlScale || 0),
      basePhysicalScale: Number(card.basePhysicalScale || 0),
      blockIgnoreRatio: Math.max(0, Math.min(0.9, Number(card.blockIgnoreRatio || 0))),
      disableCeControlDamageCorrection: Boolean(card.disableCeControlDamageCorrection),
      baseDomainLoadDelta: Number(card.baseDomainLoadDelta || 0),
      durationRounds: Number(card.durationRounds || 0),
      damageType: card.damageType || "none",
      scalingProfile: card.scalingProfile || "card_template_runtime",
      accuracyProfile: card.accuracyProfile || "none",
      evasionAllowed: card.evasionAllowed,
      hitRateModifier: Number(card.hitRateModifier || 0),
      effect: effect,
      effects: effect,
      risk: card.risk || "medium",
      rarity: card.rarity || "common",
      weight: Number(card.weight || card.weight || 1),
      guaranteedPerTurn: Boolean(card.guaranteedPerTurn),
      retainedPermanent: card.retainedPermanent !== undefined ? card.retainedPermanent !== false : undefined,
      handSource: card.handSource || "",
      effectSummary: card.effectSummary || "",
      exclusiveHandSelection: Boolean(card.exclusiveHandSelection),
      ignoreHandSelectionLimit: Boolean(card.ignoreHandSelectionLimit || card.ignoreSelectionLimit || card.doesNotCountTowardSelectionLimit),
      doesNotCountTowardSelectionLimit: Boolean(card.doesNotCountTowardSelectionLimit || card.ignoreHandSelectionLimit || card.ignoreSelectionLimit),
      selectionLockReason: card.selectionLockReason || "",
      consumeOutgoingScaleOnDamage: card.consumeOutgoingScaleOnDamage,
      dounaCounterFor: card.dounaCounterFor || "",
      blockToIncomingScale: Boolean(card.blockToIncomingScale),
      specialHandCeControlDamageScale: card.specialHandCeControlDamageScale,
      bloodCeCostRatio: card.bloodCeCostRatio ?? card.effect?.special?.bloodCeCostRatio,
      bloodHpCostRatio: card.bloodHpCostRatio ?? card.effect?.special?.bloodHpCostRatio,
      bloodCeCostReduction: card.bloodCeCostReduction ?? card.effect?.special?.bloodCeCostReduction,
      bloodCeControlDamageScale: card.bloodCeControlDamageScale ?? card.effect?.special?.bloodCeControlDamageScale,
      bloodCeToBaseDamageScale: card.bloodCeToBaseDamageScale ?? card.effect?.special?.bloodCeToBaseDamageScale,
      bloodHpToBaseDamageScale: card.bloodHpToBaseDamageScale ?? card.effect?.special?.bloodHpToBaseDamageScale,
      bloodHpCostContributesDamage: card.bloodHpCostContributesDamage ?? card.effect?.special?.bloodHpCostContributesDamage,
      bloodOriginalBaseDamageScale: card.bloodOriginalBaseDamageScale ?? card.effect?.special?.bloodOriginalBaseDamageScale,
      bloodBoostDamageScale: card.bloodBoostDamageScale ?? card.effect?.special?.bloodBoostDamageScale,
      bloodResource: card.effect?.special?.bloodResource ? { ...card.effect.special.bloodResource } : (card.bloodResource ? { ...card.bloodResource } : undefined),
      bloodDslOnly: card.bloodDslOnly === true,
      mythicalBeastAmberDslOnly: card.mythicalBeastAmberDslOnly === true || card.effect?.special?.mythicalBeastAmberDslOnly === true,
      mythicalBeastAmberAoeFullDodge: card.effect?.special?.mythicalBeastAmberAoeFullDodge === true,
      blackBirdDslOnly: card.blackBirdDslOnly === true,
      curseSpiritDslOnly: card.curseSpiritDslOnly === true,
      tenShadowsDslOnly: card.tenShadowsDslOnly === true,
      projectionSorceryDslOnly: card.projectionSorceryDslOnly === true || card.effect?.special?.projectionSorceryDslOnly === true,
      genericMechanicDslOnly: card.genericMechanicDslOnly === true || card.effect?.special?.genericMechanicDslOnly === true,
      blackBirdSpec: card.blackBirdSpec ? { ...card.blackBirdSpec } : undefined,
      blackBirdCeControlDamageScale: card.blackBirdCeControlDamageScale ?? card.blackBirdSpec?.controlScale,
      blackRopeCost: card.blackRopeCost,
      contractTicketCost: card.contractTicketCost,
      contractTicketGain: card.contractTicketGain,
      contractTicketMax: card.contractTicketMax,
      contractRecreationDslOnly: card.contractRecreationDslOnly === true || card.effect?.special?.contractRecreationDslOnly === true,
      reverseOutputDslOnly: card.reverseOutputDslOnly === true || card.effect?.special?.reverseOutputDslOnly === true,
      starRageEffect: card.starRageEffect,
      starRageDslOnly: card.starRageDslOnly === true,
      starRageMassCost: card.starRageMassCost,
      starRageSummonMassCost: card.starRageSummonMassCost,
      starRageRecallMassCost: card.starRageRecallMassCost,
      starRageRecallMassGain: card.starRageRecallMassGain,
      starRageMassGain: card.starRageMassGain,
      starRageOutgoingScale: card.starRageOutgoingScale,
      starRageIncomingScale: card.starRageIncomingScale,
      starRageIncomingReductionCap: card.starRageIncomingReductionCap,
      starRageDamageReductionCap: card.starRageDamageReductionCap,
      starRageConsumeAllMass: card.starRageConsumeAllMass,
      starRageBlackHoleBaseDamagePerMass: card.starRageBlackHoleBaseDamagePerMass,
      starRageBlackHoleBlockIgnorePerMass: card.starRageBlackHoleBlockIgnorePerMass,
      starRageBlackHoleBlockIgnoreOffset: card.starRageBlackHoleBlockIgnoreOffset,
      starRageBlackHoleSelfHpCostBaseRatio: card.starRageBlackHoleSelfHpCostBaseRatio,
      starRageBlackHoleSelfHpCostPerMassRatio: card.starRageBlackHoleSelfHpCostPerMassRatio,
      starRageBlackHoleSelfHpCostOffsetRatio: card.starRageBlackHoleSelfHpCostOffsetRatio,
      starRageCeControlDamageScale: card.starRageCeControlDamageScale,
      starRageCeControlDamageScaleLimit: card.starRageCeControlDamageScaleLimit,
      starRageCeControlMaxMultiplier: card.starRageCeControlMaxMultiplier,
      starRageCePoolDamageScale: card.starRageCePoolDamageScale,
      starRageCePoolMaxMultiplier: card.starRageCePoolMaxMultiplier,
      starRageMartialDamageScale: card.starRageMartialDamageScale,
      starRageMartialMaxMultiplier: card.starRageMartialMaxMultiplier,
      starRageGarudaUnit: card.starRageGarudaUnit ? { ...card.starRageGarudaUnit } : undefined,
      projectionSorcery: card.effect?.special?.projectionSorcery ? { ...card.effect.special.projectionSorcery } : undefined,
      summonSpec: card?.summon?.unitId ? {
        unitCardId: card.summon.unitId,
        unitName: card.summon.name,
        placement: card.summon.lane,
        summonLane: card.summon.lane,
        zoneLabel: card.summon.name,
        control: "player_controlled",
        maintenanceCeCost: card.summon.maintenance?.mandatoryWhileAnyUnitTag ? 1 : 0
      } : undefined,
      mechanismSpec: card.mechanismSpec ? { ...card.mechanismSpec } : undefined,
      specialMechanism: card.specialMechanism ? cloneDuelPlain(card.specialMechanism) : undefined,
      specialMechanismSpec: card.specialMechanismSpec ? cloneDuelPlain(card.specialMechanismSpec) : undefined,
      mechanismScript: typeof card.mechanismScript === "string" ? card.mechanismScript.slice(0, 2400) : undefined,
      specialMechanismScript: typeof card.specialMechanismScript === "string" ? card.specialMechanismScript.slice(0, 2400) : undefined,
      resourceSpec: card.resourceSpec ? { ...card.resourceSpec } : undefined,
      serviceReceiptRules: card.serviceReceiptRules ? { ...card.serviceReceiptRules } : undefined,
      massiveObjectRules: card.massiveObjectRules ? { ...card.massiveObjectRules } : undefined,
      status: card.status || "CANDIDATE"
    };
  }

  function buildDuelCardTemplateHandActions() {
    var getter = getOptionalDependency("getDuelCardTemplateIndex");
    var index = getter ? getter() : global.JJKDuelCardTemplate?.getDuelCardTemplateIndex?.();
    return (index?.cards || []).map(buildDuelCardTemplateHandAction).filter(Boolean);
  }

  function scoreDuelActionCandidate(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var stable = Number(actor?.stability || 0);
    var ceRatio = actor?.maxCe ? Number(actor.ce || 0) / actor.maxCe : 0;
    var hpRatio = actor?.maxHp ? Number(actor.hp || 0) / actor.maxHp : 0;
    var domainRisk = actor?.domain?.threshold ? Number(actor.domain.load || 0) / actor.domain.threshold : 0;
    var seedContext = [
      battle?.battleSeed || battle?.seed || "",
      battle?.round || 0,
      actor?.side || "",
      actor?.characterId || actor?.id || actor?.name || "",
      opponent?.domain?.active ? "opponent-domain" : "no-opponent-domain",
      battle?.domainSubPhase?.type || "normal",
      action.id
    ].join("|");
    var seedJitter = (hashDuelSeed(seedContext) % 1000) / 1000;
    var score = 1 + seedJitter;
    if (!action.available) score -= 8;
    var subPhase = battle?.domainSubPhase;
    if (subPhase?.type === "trial" && !subPhase.verdictResolved) {
      if (action.domainSpecific) score += actor.side === subPhase.owner ? 4.2 : 3.9;
      if (action.id === "request_verdict") score += subPhase.verdictReady ? 5.5 : -3.5;
      if (subPhase.violenceRestricted && ["ce_reinforcement", "domain_expand", "domain_force_sustain", "technique_interference"].includes(action.id)) score -= 2.4;
      if (actor.side === subPhase.defender && ["defend", "challenge_evidence", "deny_charge", "delay_trial"].includes(action.id)) score += subPhase.canDefend === false ? -4 : 2.4;
      if (actor.side === subPhase.defender && action.id === "remain_silent") score += subPhase.canRemainSilent === false ? -4 : 2.4;
    }
    if (subPhase?.type === "jackpot" && !subPhase.jackpotResolved) {
      if (actor.side === subPhase.owner && action.domainSpecific) score += 4.2;
      if (action.id === "claim_jackpot") score += subPhase.jackpotReady ? 6 : -4;
      if (actor.side === subPhase.owner && ["risk_spin", "raise_probability", "advance_jackpot", "advance_jackpot_cycle"].includes(action.id)) score += 1.5;
    }
    if ((getDuelStatusEffectValue(actor, "techniqueConfiscated") > 0 || getDuelStatusEffectValue(actor, "curseTechniqueBound") > 0) && ["technique_interference", "domain_expand", "domain_force_sustain"].includes(action.id)) score -= 4.5;
    if ((getDuelStatusEffectValue(actor, "cursedToolConfiscated") > 0 || getDuelStatusEffectValue(actor, "toolFunctionLocked") > 0) && ["ce_reinforcement"].includes(action.id)) score -= 3.8;
    if (getDuelStatusEffectValue(actor, "summonSuppressed") > 0 && ["ce_reinforcement", "technique_interference", "domain_force_sustain"].includes(action.id)) score -= 2.2;
    if (getDuelStatusEffectValue(actor, "executionStateCandidate") > 0 && ["ce_reinforcement", "domain_clash"].includes(action.id)) score += 1.8;
    if (getDuelStatusEffectValue(actor, "jackpotStateCandidate") > 0 && ["ce_reinforcement", "defensive_frame", "ce_compression"].includes(action.id)) score += 1.6;
    if (ceRatio < 0.22) score += ["residue_reading", "defensive_frame", "ce_compression", "domain_release"].includes(action.id) ? 2.2 : -2;
    if (hpRatio < 0.38) score += action.id === "defensive_frame" ? 2.4 : 0;
    if (stable < 0.38) score += ["ce_compression", "defensive_frame", "residue_reading"].includes(action.id) ? 2.1 : -1.1;
    if (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0) score += ["ce_compression", "defensive_frame", "residue_reading"].includes(action.id) ? 2 : -2.2;
    if (getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0) score += action.costCe <= Math.max(8, actor.maxCe * 0.035) ? 1.3 : -1.5;
    if (isAngelTechniqueAction(action)) {
      var angelTargetVulnerable = isAngelVulnerableTarget(opponent, battle);
      if (angelTargetVulnerable) score += 2.8;
      if (opponent?.domain?.active || isDuelOpponentDomainThreat(opponent, actor, battle)) {
        if (["angel_barrier_break", "angel_technique_extinguishment", "angel_jacobs_ladder"].includes(action.id)) score += 3.4;
      }
      if (getDuelBattlefieldUnitsForSide(battle, opponent?.side || "").length && ["angel_jacobs_ladder", "angel_purifying_ray"].includes(action.id)) score += 1.6;
      if (!angelTargetVulnerable && action.id === "angel_jacobs_ladder") score -= 1.4;
      if (hpRatio < 0.44 && action.id === "angel_wing_retreat") score += 2.2;
    }
    if (isContractTicketAction(action)) {
      var contractState = getContractTicketState(battle, actor?.side || "");
      var tickets = Number(contractState.tickets || 0);
      var ticketCost = getContractTicketCost(action);
      var opponentHpRatioForContract = opponent?.maxHp ? Number(opponent.hp || 0) / Number(opponent.maxHp || 1) : 1;
      if (ticketCost > tickets) score -= 7;
      if (action.id === "recontract_receipt_stock") {
        score += tickets < 3 ? 5.2 : (tickets < 6 ? 2.1 : -1.8);
      }
      if (["recontract_santana_sedan", "recontract_kitchen_knife"].includes(action.id)) score += tickets >= ticketCost ? 1.9 : 0;
      if (action.id === "recontract_excavator") score += hpRatio < 0.62 || stable < 0.48 ? 2.8 : 1.4;
      if (action.id === "recontract_detached_house") {
        score += opponentHpRatioForContract < 0.34 ? 5.1 : -2.4;
        var opponentDomainText = [opponent?.domain?.name, opponent?.domainProfile, opponent?.techniqueName, opponent?.techniqueText].join(" ");
        if (opponent?.domain?.active && /嵌合暗翳庭|未完成|ten[_\s-]?shadows|ten_shadows/i.test(opponentDomainText)) score += 2.6;
      }
      if (action.id === "recontract_five_star_resort_week") {
        score += hpRatio < 0.58 || ceRatio < 0.35 ? 3.4 : -1.2;
        if (isActorUnderHardClosePressure(actor)) score -= 5.2;
      }
    }
    if (isComedianAction(action)) {
      var comedianState = getComedianState(battle, actor?.side || "");
      var humor = Number(comedianState.humor || 0);
      var cold = Number(comedianState.cold || 0);
      if (action.id === "comedian_setup_bit") score += humor < 3 ? 4.6 : 0.8;
      if (action.id === "comedian_absurd_recovery") score += hpRatio < 0.62 || stable < 0.5 ? 3.8 : 0.5;
      if (action.id === "feature_comedian_083") score += hpRatio < 0.58 || cold >= 2 ? 3.2 : 0.9;
      if (action.id === "feature_comedian_082") score += humor >= 2 ? 2.8 : 1.1;
      if (action.id === "feature_comedian_084") score += opponent?.domain?.active || stable < 0.55 ? 2.6 : 1.2;
      if (action.id === "comedian_audience_roar") score += humor >= 4 ? 5.2 : -3.4;
      if (cold >= 3 && action.id !== "comedian_setup_bit" && action.id !== "comedian_absurd_recovery") score -= 2.8;
    }
    if (isKusakabeAction(action)) {
      var kusakabeState = getKusakabeState(battle, actor?.side || "");
      var stance = Number(kusakabeState.stance || 0);
      var enemyDomainThreat = Boolean(opponent?.domain?.active || isDuelOpponentDomainThreat(opponent, actor, battle));
      if (action.id === "kusakabe_stance_reset") score += stance < 3 ? 4.2 : 0.6;
      if (action.id === "kusakabe_simple_domain_guard") score += enemyDomainThreat ? 6.2 : (hpRatio < 0.58 ? 2.4 : 0.8);
      if (action.id === "kusakabe_draw_defense") score += hpRatio < 0.66 || stance >= 2 ? 3.6 : 1.2;
      if (action.id === "kusakabe_ally_guard") score += hpRatio > 0.42 ? 2.7 : -1.6;
      if (action.id === "kusakabe_counter_slash") score += stance >= 2 ? 3.4 : -2.5;
    }
    if (isDisasterEnvironmentAction(action)) {
      var disasterKind = normalizeDisasterResourceKind(action.disasterResourceKind);
      var disasterState = getDisasterResourceState(battle, actor?.side || "", disasterKind, action);
      var disasterAmount = Number(disasterState.amount || 0);
      var disasterCost = Math.max(0, Number(action.disasterResourceCost || 0));
      if (disasterCost > disasterAmount) score -= 7;
      if (Number(action.disasterResourceGain || 0) > 0 && disasterAmount < Number(disasterState.max || 0)) score += 2.4;
      if (["jogo_heat_accumulation", "dagon_sea_spread", "smallpox_coffin_lock", "smallpox_countdown_advance"].includes(action.id)) score += disasterAmount < 2 ? 3.8 : 0.8;
      if (action.id === "hanami_life_drain") score += hpRatio < 0.7 && disasterAmount >= 2 ? 4.2 : -1.5;
      if (["feature_disaster_flames_059", "smallpox_three_count_settle", "dagon_domain_fish_surehit"].includes(action.id)) score += opponent?.hp && opponent.hp / Math.max(1, opponent.maxHp || opponent.hp) < 0.45 ? 3.6 : 0.8;
      if ((opponent?.domain?.active || isDuelOpponentDomainThreat(opponent, actor, battle)) && /domain|领域|压制|维持/.test(String(action.label || "") + String(action.name || "") + String(action.damageType || ""))) score += 2.1;
      if (actor?.domain?.active && action.requirements?.domainActive) score += 4.4;
    }
    if (isTacticalHumanResourceAction(action)) {
      var tacticalKind = normalizeTacticalHumanResourceKind(action.tacticalResourceKind);
      var tacticalState = getTacticalHumanResourceState(battle, actor?.side || "", tacticalKind, action);
      var tacticalAmount = Number(tacticalState.amount || 0);
      var tacticalCost = Math.max(0, Number(action.tacticalResourceCost || 0));
      var tacticalGain = Math.max(0, Number(action.tacticalResourceGain || 0));
      if (tacticalCost > tacticalAmount) score -= 7;
      if (tacticalGain > 0 && !action.tacticalResourceStrain && tacticalAmount < Number(tacticalState.max || 0)) score += tacticalAmount < 2 ? 3.2 : 0.9;
      if (tacticalKind === "throatStrain") {
        if (action.id === "inumaki_throat_care") score += tacticalAmount >= 3 ? 4.8 : -1.8;
        if (action.tacticalResourceStrain && tacticalAmount >= 4) score -= 3.4;
      }
      if (tacticalKind === "healingWindow") {
        if (Number(action.baseHealing || action.baseHpRestore || 0) > 0) score += hpRatio < 0.72 ? 3.4 : 0.8;
        if (action.id === "shoko_curse_purge" && isDuelCurseTarget(opponent)) score += 5.2;
      }
      if (tacticalKind === "pandaCoreCharge") {
        if (/防御|抗伤|姐姐/.test(String(action.label || "") + String(action.name || ""))) score += hpRatio < 0.62 ? 3.8 : 0.7;
        if (/猩猩|重击/.test(String(action.label || "") + String(action.name || ""))) score += opponent?.hp && opponent.hp / Math.max(1, opponent.maxHp || opponent.hp) < 0.48 ? 3.1 : 1.1;
      }
      if (tacticalKind === "constructionMaterial") {
        if (/真球|perfect|sphere/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount >= tacticalCost && (opponent?.hp || 0) / Math.max(1, opponent?.maxHp || opponent?.hp || 1) < 0.58 ? 4.6 : -1.2;
        if (/甲胄|armor|虫甲/.test(String(action.label || "") + String(action.name || ""))) score += hpRatio < 0.64 ? 3.2 : 0.8;
      }
      if (tacticalKind === "skyFold") {
        if (/折返|反射|偏转|redirect|counter/i.test(String(action.label || "") + String(action.name || ""))) score += hpRatio < 0.72 ? 3.4 : 1.2;
        if (/薄冰|thin/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount >= tacticalCost ? 2.2 : -1;
      }
      if (tacticalKind === "graniteCharge") {
        if (/甜点|续压|蓄压|satisfaction|charge/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount < 3 ? 3.4 : 0.4;
        if (/爆破|炮|blast/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount >= tacticalCost ? 3.1 : -1.5;
      }
      if (tacticalKind === "iceLayers") {
        if (/蓄势|霜凪|冰凝|freeze|ice/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount < 3 ? 3.2 : 0.7;
        if (/封|绝对|冰瀑|针|lock|absolute/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount >= tacticalCost ? 3.2 : -1.4;
      }
      if (tacticalKind === "rikaManifestSustain") {
        if (/维持|拥抱|守护|sustain|guard/i.test(String(action.label || "") + String(action.name || ""))) score += hpRatio < 0.74 ? 3.3 : 1.1;
        if (/光炮|武库|撕咬|pure|cannon|arsenal/i.test(String(action.label || "") + String(action.name || ""))) score += tacticalAmount >= tacticalCost ? 3.1 : -1.2;
      }
      if (tacticalKind === "cursedObjectSediment") {
        var yujiAfter68Text = String(action.label || "") + String(action.name || "") + String(action.damageType || "");
        if (/沉淀|sediment|resource/i.test(yujiAfter68Text)) score += tacticalAmount < 3 ? 4.2 : 0.7;
        if (/反领域|anti[_\s-]?domain/i.test(yujiAfter68Text)) score += enemyDomainThreat ? 6.4 : (hpRatio < 0.55 ? 1.4 : -0.8);
        if (/稳定黑闪|半人半咒|black[_\s-]?flash|soul/i.test(yujiAfter68Text)) score += tacticalAmount >= tacticalCost ? 3.2 : -2.2;
        if (/异常兑现|cashout|终结/i.test(yujiAfter68Text)) {
          var targetHpRatio = opponent?.maxHp ? Number(opponent.hp || 0) / Math.max(1, Number(opponent.maxHp || 1)) : 1;
          score += tacticalAmount >= tacticalCost && targetHpRatio < 0.48 ? 5.6 : -2.8;
        }
      }
      if (["ratioWeakpoint", "nailMarks", "boogieTempo"].includes(tacticalKind) && tacticalCost > 0 && tacticalAmount >= tacticalCost) score += 2.4;
    }
    if (Number(action.baseHealing || 0) > 0 || action.rctHealing || isCurseRegenerationAction(action)) {
      var missingHpRatio = Math.max(0, 1 - hpRatio);
      if (hpRatio < 0.72) score += Math.min(4.2, 0.8 + missingHpRatio * 5);
      if (hpRatio < 0.38) score += 1.6;
      if (action.id === "reverse_cursed_technique_heal" || action.id === "curse_regen_candidate") score += 1.8;
    }
    if (action?.effects?.rctOutputExternal || action?.rctOutput) {
      var opponentHasCurseOutputTarget = isDuelCurseTarget(opponent) || getDuelBattlefieldUnitsForSide(battle, opponent?.side || "").some(function hasCurseUnit(unit) {
        return isDuelCurseTarget(unit);
      });
      score += opponentHasCurseOutputTarget ? 7.5 : -6.5;
    }
    if (isMythicalBeastAmberTagged(action)) {
      var amberActive = hasActiveMythicalBeastAmber(actor);
      var opponentHpRatio = opponent?.maxHp ? Number(opponent.hp || 0) / Number(opponent.maxHp || 1) : 1;
      var fractureLevel = getMythicalBeastAmberFractureLevel(actor, battle);
      if (action.id === KASHIMO_MYTHICAL_BEAST_RELEASE_ACTION_ID) {
        score += opponentHpRatio < 0.45 ? 5.2 : -3.8;
        if (hpRatio < 0.35 && opponentHpRatio > 0.28) score -= 4.2;
        if (opponent?.domain?.active || isDuelOpponentDomainThreat(opponent, actor, battle)) score += 2.2;
        if (Number(battle?.round || 0) <= 1) score -= 2.8;
      }
      if (amberActive && action.id === "kashimo_emp_released") score += 3.4;
      if (amberActive && action.id === "kashimo_lightning_body_overload") score += opponentHpRatio < 0.38 || hpRatio < 0.42 ? 2.6 : -1.4;
      if (amberActive && action.id === "kashimo_electromagnetic_annihilation") score += opponentHpRatio < 0.32 ? 4.8 : -2.2;
      if (fractureLevel >= 3 && ["kashimo_lightning_body_overload", "kashimo_electromagnetic_annihilation"].includes(action.id)) score -= 1.8 + fractureLevel * 0.45;
    }
    if (actor.domain?.active) {
      score += ["domain_compress", "domain_force_sustain", "domain_release"].includes(action.id) ? 2.4 : 0;
      if (domainRisk > 0.72) score += ["domain_compress", "domain_release"].includes(action.id) ? 2.8 : (action.id === "domain_force_sustain" ? -2.4 : 0);
    } else if (action.id === "domain_expand" && ceRatio > 0.42 && stable > 0.45) {
      score += 2;
    }
    if (opponent?.domain?.active && domainResponse.allowedDomainResponseActions.includes(action.id)) score += 2.9;
    if (ceRatio > 0.55 && hpRatio > 0.45) score += ["ce_reinforcement", "technique_interference"].includes(action.id) ? 0.8 : 0;
    return score;
  }

  function pickDuelActionChoices(actor, opponent, duelState, count) {
    var battle = getBattle(duelState);
    var choiceCount = count === undefined ? 3 : count;
    var pool = buildDuelActionPool(actor, opponent, battle);
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var selected = [];
    function pushById(id) {
      var item = pool.find(function findAction(action) {
        return action.id === id && !selected.some(function isChosen(chosen) {
          return chosen.id === id;
        });
      });
      if (item && item.available) selected.push(item);
    }
    getDuelSubPhasePreferredActionIds(actor, battle).forEach(pushById);
    if (actor?.domain?.active) {
      var risk = actor.domain.threshold ? actor.domain.load / actor.domain.threshold : 0;
      pushById(risk > 0.68 ? "domain_release" : "domain_compress");
      pushById("domain_force_sustain");
    } else {
      pushById("domain_expand");
    }
    if (actor?.maxHp && Number(actor.hp || 0) / Number(actor.maxHp || 1) < 0.72) {
      pushById("reverse_cursed_technique_heal");
      pushById("curse_regen_candidate");
    }
    if (isDuelOpponentDomainThreat(opponent, actor, battle)) {
      domainResponse.allowedDomainResponseActions.forEach(pushById);
    }
    var ranked = pool
      .filter(function filterSelected(action) {
        return !selected.some(function isSelected(chosen) {
          return chosen.id === action.id;
        });
      })
      .sort(function sortByScore(a, b) {
        return scoreDuelActionCandidate(b, actor, opponent, battle) - scoreDuelActionCandidate(a, actor, opponent, battle);
      });
    ranked.forEach(function addAvailable(action) {
      if (selected.length >= choiceCount) return;
      if (action.available) selected.push(action);
    });
    ranked.forEach(function addFallback(action) {
      if (selected.length >= choiceCount) return;
      selected.push(action);
    });
    return selected.slice(0, choiceCount);
  }

  function getDuelSubPhasePreferredActionIds(actor, battle) {
    var activeBattle = getBattle(battle);
    var subPhase = activeBattle?.domainSubPhase;
    if (!actor || !subPhase) return [];
    if (subPhase.type === "trial" && !subPhase.verdictResolved) {
      if (actor.side === subPhase.owner) {
        if (subPhase.trialEligibility === "object_confiscation") {
          return ["object_confiscation", "tool_function_lock", "wielder_liability", "request_verdict", "rule_pressure"];
        }
        if (subPhase.trialEligibility === "redirect_to_controller") {
          return ["controller_redirect", "summon_suppression", "request_verdict", "rule_pressure", "present_evidence"];
        }
        if (subPhase.trialEligibility === "exorcism_ruling") {
          return subPhase.verdictReady
            ? ["request_verdict", "present_evidence", "rule_pressure", "advance_trial"]
            : ["present_evidence", "rule_pressure", "advance_trial", "request_verdict"];
        }
        return subPhase.verdictReady
          ? ["request_verdict", "present_evidence", "rule_pressure", "press_charge", "advance_trial"]
          : ["present_evidence", "press_charge", "advance_trial", "rule_pressure", "request_verdict"];
      }
      if (actor.side === subPhase.defender) {
        if (subPhase.trialSubjectType === "intelligent_curse") return ["curse_argument", "distort_residue", "curse_pressure", "remain_silent"];
        if (subPhase.trialSubjectType === "instinct_curse") return ["instinctive_struggle", "curse_fluctuation", "flee_exorcism"];
        if (subPhase.trialSubjectType === "shikigami") return ["proxy_denial"];
        if (subPhase.canDefend === false && subPhase.canRemainSilent === false) return [];
        return ["defend", "challenge_evidence", "remain_silent", "deny_charge", "delay_trial"];
      }
    }
    if (subPhase.type === "jackpot" && !subPhase.jackpotResolved && actor.side === subPhase.owner) {
      return subPhase.jackpotReady
        ? ["claim_jackpot", "stabilize_cycle", "advance_jackpot", "raise_probability", "risk_spin", "advance_jackpot_cycle"]
        : ["advance_jackpot", "raise_probability", "stabilize_cycle", "risk_spin", "claim_jackpot", "advance_jackpot_cycle"];
    }
    return [];
  }

  function getDuelActionRiskLabel(action, actor, opponent) {
    var rules = getDuelActionRules();
    var base = rules.riskLabels?.[action.risk] || action.risk || "风险未知";
    if (!actor) return base;
    if (!action.available && action.unavailableReason) return action.unavailableReason;
    var domainRisk = actor.domain?.threshold ? Number(actor.domain.load || 0) / actor.domain.threshold : 0;
    if (action.id === "domain_force_sustain" && domainRisk > 0.72) return "极高风险，可能领域崩解";
    if (getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0 && Number(action.costCe || 0) > actor.maxCe * 0.08) return "咒力回流断裂，慎用高消耗手法";
    if (getDuelStatusEffectValue(actor, "techniqueImbalance") > 0 && ["domain_expand", "technique_interference"].includes(action.id)) return "术式失衡中，风险上升";
    if (opponent?.domain?.active && action.id === "domain_clash") return "高负荷，对抗领域";
    if (opponent?.domain?.active && action.id === "simple_domain_guard") return "防必中，简易领域会磨损";
    if (opponent?.domain?.active && action.id === "hollow_wicker_basket_guard") return "防必中，行动受限";
    if (opponent?.domain?.active && action.id === "falling_blossom_emotion") return "自动迎击必中";
    if (opponent?.domain?.active && action.id === "zero_ce_domain_bypass") return "零咒力必中规避";
    if (opponent?.domain?.active && action.id === "domain_survival_guard") return "缺少硬防线，硬扛领域";
    return base;
  }

  function createEmptyDuelActionContext() {
    return {
      turn: 0,
      outgoingScale: 1,
      incomingHpScale: 1,
      cardBlockIncomingHpScale: 1,
      incomingHpReductionCap: 0,
      incomingCeScale: 1,
      sureHitScale: 1,
      domainPressureScale: 1,
      manualAttackScale: 1,
      domainLoadScale: 1,
      evasionBonus: 0,
      nextAttackAoe: false,
      nextAttackAoeDamageScale: 1,
      consumeOutgoingScaleOnDamage: true,
      weightDeltas: {},
      actionLabels: []
    };
  }

  function normalizeDuelActionContextForTurn(battle, side) {
    var turn = getDuelActionTurnNumber(battle);
    var context = battle?.actionContext?.[side];
    if (!context || Number(context.turn || 0) !== turn) {
      context = createEmptyDuelActionContext();
      context.turn = turn;
      battle.actionContext[side] = context;
      return context;
    }
    context.outgoingScale = Number(context.outgoingScale ?? 1);
    context.incomingHpScale = Number(context.incomingHpScale ?? 1);
    context.cardBlockIncomingHpScale = Number(context.cardBlockIncomingHpScale ?? 1);
    context.incomingHpReductionCap = Math.max(0, Number(context.incomingHpReductionCap || 0));
    context.incomingCeScale = Number(context.incomingCeScale ?? 1);
    context.sureHitScale = Number(context.sureHitScale ?? 1);
    context.domainPressureScale = Number(context.domainPressureScale ?? 1);
    context.manualAttackScale = Number(context.manualAttackScale ?? 1);
    context.domainLoadScale = Number(context.domainLoadScale ?? 1);
    context.evasionBonus = Number(context.evasionBonus || 0);
    context.nextAttackAoe = Boolean(context.nextAttackAoe);
    context.nextAttackAoeDamageScale = Math.max(0, Number(context.nextAttackAoeDamageScale || 1));
    context.consumeOutgoingScaleOnDamage = context.consumeOutgoingScaleOnDamage !== false;
    context.weightDeltas ||= {};
    context.actionLabels ||= [];
    return context;
  }

  function ensureDuelActionContext(battle) {
    if (!battle) return null;
    if (!battle.actionContext) {
      battle.actionContext = {
        left: createEmptyDuelActionContext(),
        right: createEmptyDuelActionContext()
      };
    }
    battle.actionContext.left ||= createEmptyDuelActionContext();
    battle.actionContext.right ||= createEmptyDuelActionContext();
    normalizeDuelActionContextForTurn(battle, "left");
    normalizeDuelActionContextForTurn(battle, "right");
    return battle.actionContext;
  }

  function getDuelActionContext(battle, side) {
    var context = battle?.actionContext?.[side];
    return context || createEmptyDuelActionContext();
  }

  function getDuelBlockIncomingHpScale(action, numericPreview, effects, tacticModifiers) {
    var block = Math.max(0, Number(numericPreview?.finalBlock || 0)) * Math.max(0, Number(tacticModifiers?.blockScale || 1));
    if (!block || !action?.blockToIncomingScale && !effects?.blockToIncomingScale) return 1;
    return Number(clamp(1 - block / 140, 0.25, 0.95).toFixed(4));
  }

  function getDuelLockedDefenseAction(entry) {
    var action = entry?.action || entry?.candidate?.action || entry?.card || entry;
    if (!action || typeof action !== "object") return null;
    return isDirectBattleCard(action) ? prepareDirectBattleCardRuntimeAction(action) : action;
  }

  function isDuelLockedRangeAdjustmentEntry(entry) {
    var action = entry?.action || entry?.candidate?.action || entry?.card || entry;
    if (!action || typeof action !== "object") return false;
    var identity = [
      entry?.id,
      entry?.actionId,
      entry?.cardId,
      entry?.label,
      action.id,
      action.actionId,
      action.cardId,
      action.name,
      action.label
    ].filter(Boolean).join(" ");
    return Boolean(
      action.rangeAdjustment ||
      action.effects?.rangeAdjustment ||
      action.effect?.rangeAdjustment ||
      /range_adjustment|card_range_adjustment|范围调整/.test(identity)
    );
  }

  function normalizeDuelLockedDefensePlan(entries) {
    var ordered = orderCustomAtomicActionEntries(entries)
      .map(function preserveLockedOrder(entry, index) { return { entry: entry, index: index }; })
      .sort(function prioritizeLockedRangeAdjustment(left, right) {
        var leftPriority = isDuelLockedRangeAdjustmentEntry(left.entry) ? 0 : 1;
        var rightPriority = isDuelLockedRangeAdjustmentEntry(right.entry) ? 0 : 1;
        return leftPriority - rightPriority || left.index - right.index;
      })
      .map(function restoreLockedEntry(item) { return item.entry; });
    return ordered.map(function attachLockedSelectionMetadata(entry, index) {
      if (!entry || typeof entry !== "object") return entry;
      var selection = {
        selectedCount: ordered.length,
        selectedIndex: index,
        selectedLast: index === ordered.length - 1
      };
      if (entry.action && typeof entry.action === "object") {
        return { ...entry, ...selection, action: { ...entry.action, ...selection } };
      }
      return { ...entry, ...selection };
    });
  }

  function getDuelDefensePrimeActionKey(action) {
    return String(action?.id || action?.actionId || action?.cardId || "");
  }

  function ensureDuelDefensePrimeState(battle) {
    if (!battle) return null;
    var turn = getDuelActionTurnNumber(battle);
    if (!battle.defensePrimeState || Number(battle.defensePrimeState.turn || 0) !== turn) {
      battle.defensePrimeState = { turn: turn, sides: {}, consumable: {} };
    }
    return battle.defensePrimeState;
  }

  function consumeDuelPrecommittedDefenseMarker(battle, side, action) {
    var state = ensureDuelDefensePrimeState(battle);
    var actionKey = getDuelDefensePrimeActionKey(action);
    var markerKey = String(side || "") + ":" + actionKey;
    var remaining = Math.max(0, Number(state?.consumable?.[markerKey] || 0));
    if (!remaining) return false;
    state.consumable[markerKey] = remaining - 1;
    return true;
  }

  function getDuelDefensePrimeRuntimeAction(action, actor, opponent, battle) {
    var next = action;
    next = getTacticalHumanRuntimeAction(getDisasterRuntimeAction(getKusakabeRuntimeAction(getComedianRuntimeAction(getAngelRuntimeAction(getProjectionRuntimeAction(getBlackBirdRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(next, actor, battle), actor, battle), actor, battle), actor, battle), actor, opponent, battle), actor, battle), actor, opponent, battle), actor, opponent, battle), actor, opponent, battle);
    next = ensureCustomAtomicActionTransforms(next, actor, opponent, battle);
    next = getSixEyesRuntimeAction(next, actor);
    return next;
  }

  function getDuelDefensePrimeShadowResource(battle, side, fallback) {
    var resourceKey = side === "right" ? "p2" : "p1";
    battle.resourceState ||= {};
    if (!battle.resourceState[resourceKey]) {
      battle.resourceState[resourceKey] = cloneDuelPlain(fallback || { side: side, hp: 0, maxHp: 0, ce: 0, maxCe: 0 });
    }
    battle.resourceState[resourceKey].side = side;
    return battle.resourceState[resourceKey];
  }

  function reserveDuelDefensePrimeSpecialResources(action, actor, battle) {
    if (!action || !actor || !battle) return false;
    var side = actor.side || "left";
    var blackBirdRuntime = action.blackBirdRuntime;
    if (blackBirdRuntime?.active && !blackBirdRuntime.rikaArsenalCopiedSpecialResourceBypass) {
      var blackBirdState = getBlackBirdState(battle, side);
      var maxFeatherCost = Math.max(0, Number(blackBirdRuntime.maxFeatherCost || 0));
      var featherCost = Math.max(0, Number(blackBirdRuntime.featherCost || 0));
      var nextMaxFeathers = Number(blackBirdState.maxFeathers || 0) - maxFeatherCost;
      var nextFeathers = Math.min(Number(blackBirdState.feathers || 0), nextMaxFeathers) - featherCost;
      if (nextMaxFeathers < -1e-9 || nextFeathers < -1e-9) return false;
      blackBirdState.maxFeathers = Math.max(0, nextMaxFeathers);
      blackBirdState.feathers = Math.max(0, nextFeathers);
      updateBlackBirdCounter(battle, side, blackBirdState);
    }

    var starRageRuntime = action.starRageRuntime;
    if (starRageRuntime?.active && !starRageRuntime.rikaArsenalCopiedSpecialResourceBypass) {
      var starRageState = getStarRageMassState(battle, side);
      var massCost = starRageRuntime.consumeAllMass
        ? Math.max(0, Number(starRageState.mass || 0))
        : Math.max(0, Number(starRageRuntime.massCost || 0));
      if (massCost > Number(starRageState.mass || 0) + 1e-9) return false;
      starRageState.mass = Math.max(0, Number(starRageState.mass || 0) - massCost);
      updateStarRageMassCounter(battle, side, starRageState);
    }

    var bloodRuntime = action.bloodRuntime;
    if (bloodRuntime?.active && !action.rikaArsenalCopiedSpecialResourceBypass) {
      var bloodState = getBloodManipulationResourceState(battle, side);
      var bloodCost = Math.max(0, Number(bloodRuntime.resourceCost?.blood || 0));
      var pierceCost = Math.max(0, Number(bloodRuntime.resourceCost?.pierce || 0));
      if (bloodCost > Number(bloodState.blood || 0) + 1e-9 || pierceCost > Number(bloodState.pierce || 0) + 1e-9) return false;
      bloodState.blood = Math.max(0, Number(bloodState.blood || 0) - bloodCost);
      bloodState.pierce = Math.max(0, Number(bloodState.pierce || 0) - pierceCost);
    }

    var blackRopeCost = getBlackRopeCost(action);
    if (blackRopeCost > 0) {
      var blackRopeState = getBlackRopeState(battle, side);
      if (blackRopeCost > Number(blackRopeState.length || 0) + 1e-9) return false;
      blackRopeState.length = Math.max(0, Number(blackRopeState.length || 0) - blackRopeCost);
    }

    var contractTicketCost = getContractTicketCost(action);
    if (contractTicketCost > 0) {
      var contractTicketState = getContractTicketState(battle, side);
      if (contractTicketCost > Number(contractTicketState.tickets || 0) + 1e-9) return false;
      contractTicketState.tickets = Math.max(0, Number(contractTicketState.tickets || 0) - contractTicketCost);
    }

    var comedianHumorCost = Math.max(0, Number(action.comedianHumorCost || action.requirements?.comedianHumorCost || 0));
    if (comedianHumorCost > 0 || Number(action.comedianColdGain || 0) > 0) {
      var comedianState = getComedianState(battle, side);
      if (comedianHumorCost > Number(comedianState.humor || 0) + 1e-9) return false;
      comedianState.humor = Math.max(0, Number(comedianState.humor || 0) - comedianHumorCost);
      // Cold gain is a burden, so preserve it in the shadow plan. Beneficial
      // humor gain/cold reduction is deliberately ignored until real settlement.
      comedianState.cold = Math.min(Number(comedianState.coldMax || COMEDIAN_DEFAULT_COLD_MAX), Number(comedianState.cold || 0) + Math.max(0, Number(action.comedianColdGain || 0)));
    }

    var kusakabeStanceCost = Math.max(0, Number(action.kusakabeStanceCost || action.requirements?.kusakabeStanceCost || 0));
    if (kusakabeStanceCost > 0) {
      var kusakabeState = getKusakabeState(battle, side);
      if (kusakabeStanceCost > Number(kusakabeState.stance || 0) + 1e-9) return false;
      kusakabeState.stance = Math.max(0, Number(kusakabeState.stance || 0) - kusakabeStanceCost);
    }

    var disasterKind = normalizeDisasterResourceKind(action.disasterResourceKind);
    var disasterCost = Math.max(0, Number(action.disasterResourceCost || action.requirements?.disasterResourceCost || 0));
    if (disasterKind && disasterCost > 0) {
      var disasterState = getDisasterResourceState(battle, side, disasterKind, action);
      if (disasterCost > Number(disasterState.amount || 0) + 1e-9) return false;
      disasterState.amount = Math.max(0, Number(disasterState.amount || 0) - disasterCost);
    }

    var tacticalKind = normalizeTacticalHumanResourceKind(action.tacticalResourceKind);
    var tacticalCost = Math.max(0, Number(action.tacticalResourceCost || 0));
    if (tacticalKind && (tacticalCost > 0 || action.tacticalResourceStrain)) {
      var tacticalState = getTacticalHumanResourceState(battle, side, tacticalKind, action);
      if (tacticalCost > Number(tacticalState.amount || 0) + 1e-9) return false;
      var nextTacticalAmount = Number(tacticalState.amount || 0) - tacticalCost;
      if (action.tacticalResourceStrain) nextTacticalAmount += Math.max(0, Number(action.tacticalResourceGain || 0));
      if (nextTacticalAmount > Number(tacticalState.max || 0) + 1e-9) return false;
      tacticalState.amount = clamp(nextTacticalAmount, 0, Number(tacticalState.max || getTacticalHumanResourceMax(action, tacticalKind)));
    }
    return true;
  }

  function primeDuelLockedDefenseActions(entries, actor, opponent, duelState, options) {
    var battle = getBattle(duelState);
    if (!battle || !actor) return { applied: false, reason: "战斗资源缺失", actions: [] };
    var side = String(options?.side || actor.side || "left");
    var state = ensureDuelDefensePrimeState(battle);
    if (state.sides[side]?.primed) return state.sides[side];
    var orderedEntries = normalizeDuelLockedDefensePlan(entries);
    battle.selectedHandActions ||= {};
    battle.selectedHandActions[side] = orderedEntries.slice();
    var contexts = ensureDuelActionContext(battle);
    var context = contexts?.[side] || createEmptyDuelActionContext();
    var primed = [];
    var budgetBattle = cloneDuelPlain(battle);
    var budgetActor = getDuelDefensePrimeShadowResource(budgetBattle, side, actor);
    var opponentSide = side === "right" ? "left" : "right";
    var budgetOpponent = getDuelDefensePrimeShadowResource(budgetBattle, opponentSide, opponent);
    battle.pendingHandActions ||= {};
    var hadPendingPlan = Object.prototype.hasOwnProperty.call(battle.pendingHandActions, side);
    var previousPendingPlan = battle.pendingHandActions[side];
    try {
      orderedEntries.forEach(function primeLockedDefenseEntry(entry, index) {
        battle.pendingHandActions[side] = orderedEntries.slice(index);
        var candidateBattle = cloneDuelPlain(budgetBattle);
        candidateBattle.selectedHandActions ||= {};
        candidateBattle.selectedHandActions[side] = cloneDuelPlain(orderedEntries);
        candidateBattle.pendingHandActions ||= {};
        candidateBattle.pendingHandActions[side] = cloneDuelPlain(orderedEntries.slice(index));
        var candidateActor = getDuelDefensePrimeShadowResource(candidateBattle, side, budgetActor);
        var candidateOpponent = getDuelDefensePrimeShadowResource(candidateBattle, opponentSide, budgetOpponent);
        var action = getDuelLockedDefenseAction(entry);
        if (!action || action.type === "pass" || action.cardType === "pass") return;
        action = getDuelDefensePrimeRuntimeAction(action, candidateActor, candidateOpponent, candidateBattle);
        action = {
          ...action,
          selectedCount: orderedEntries.length,
          selectedIndex: index,
          selectedLast: index === orderedEntries.length - 1
        };
        var availability = getDuelActionAvailability(action, candidateActor, candidateOpponent, candidateBattle) || {};
        var costCe = Math.max(0, Number(availability.costCe ?? getDuelActionCost(action, candidateActor, candidateBattle) ?? 0));
        var hpCost = Math.max(0, Number(getDuelActionHpCost(action, candidateActor, candidateBattle) || 0));
        if (
          availability.available === false ||
          !Number.isFinite(costCe) ||
          !Number.isFinite(hpCost) ||
          costCe > Number(candidateActor.ce || 0) + 1e-9 ||
          hpCost > Number(candidateActor.hp || 0) + 1e-9 ||
          !reserveDuelDefensePrimeSpecialResources(action, candidateActor, candidateBattle)
        ) return;

        // Reserve the starting resources in resolution order without applying
        // action effects. CE/HP restored or generated by an earlier card must
        // never flow backwards into simultaneous defense precommitment.
        candidateActor.ce = Number(Math.max(0, Number(candidateActor.ce || 0) - costCe).toFixed(3));
        var minimumHp = action?.effects?.selfHpCostNonlethal === false || action?.selfHpCostNonlethal === false ? 0 : 1;
        candidateActor.hp = Number(Math.max(minimumHp, Number(candidateActor.hp || 0) - hpCost).toFixed(1));
        budgetBattle = candidateBattle;
        budgetActor = candidateActor;
        budgetOpponent = candidateOpponent;

        var mechanics = collectDuelMechanicsForAction(action);
        var effects = mergeDuelMechanicEffects(action.effects || {}, mechanics);
        var numericPreview = calculateActionNumericPreview(action, budgetActor);
        var tacticModifiers = getDuelTacticActionModifiers(action, budgetActor, budgetOpponent, budgetBattle);
        var blockIncomingHpScale = getDuelBlockIncomingHpScale(action, numericPreview, effects, tacticModifiers);
        var incomingHpScale = Number(effects.incomingHpScale ?? 1);
        var incomingHpReductionCap = Math.max(0, Number(effects.incomingHpReductionCap || 0));
        var incomingCeScale = Number(effects.incomingCeScale ?? 1);
        var sureHitScale = Number(effects.sureHitScale ?? 1);
        var domainPressureScale = Number(effects.domainPressureScale ?? 1);
        var manualAttackScale = Number(effects.manualAttackScale ?? 1);
        var domainLoadScale = Number(effects.domainLoadScale ?? 1);
        var evasionBonus = Number(effects.evasionBonus || 0);
        var hasPrecommittableDefense = blockIncomingHpScale !== 1 || incomingHpScale !== 1 || incomingHpReductionCap > 0 || incomingCeScale !== 1 || sureHitScale !== 1 || domainPressureScale !== 1 || manualAttackScale !== 1 || domainLoadScale !== 1 || evasionBonus !== 0;
        if (!hasPrecommittableDefense) return;
        context.incomingHpScale *= incomingHpScale;
        context.cardBlockIncomingHpScale *= blockIncomingHpScale;
        context.incomingHpReductionCap += incomingHpReductionCap;
        context.incomingCeScale *= incomingCeScale;
        context.sureHitScale *= sureHitScale;
        context.domainPressureScale *= domainPressureScale;
        context.manualAttackScale *= manualAttackScale;
        context.domainLoadScale *= domainLoadScale;
        context.evasionBonus += evasionBonus;
        var actionKey = getDuelDefensePrimeActionKey(action);
        var markerKey = side + ":" + actionKey;
        state.consumable[markerKey] = Math.max(0, Number(state.consumable[markerKey] || 0)) + 1;
        primed.push({ actionId: actionKey, label: action.label || action.name || actionKey, blockScale: Number(blockIncomingHpScale.toFixed(4)), incomingHpScale: Number(incomingHpScale.toFixed(4)), reductionCap: Number(incomingHpReductionCap.toFixed(1)) });
      });
    } finally {
      if (hadPendingPlan) battle.pendingHandActions[side] = previousPendingPlan;
      else delete battle.pendingHandActions[side];
    }
    state.sides[side] = { applied: primed.length > 0, primed: true, side: side, actions: primed };
    return state.sides[side];
  }

  function addDuelActionWeightDeltas(context, deltas) {
    Object.entries(deltas || {}).forEach(function addDelta(entry) {
      var key = entry[0];
      var value = entry[1];
      context.weightDeltas[key] = Number((Number(context.weightDeltas[key] || 0) + Number(value || 0)).toFixed(3));
    });
  }

  function isDomainActive(resource) {
    return Boolean(resource?.domain && resource.domain.active);
  }

  function ensureDuelDomainStateForActivation(actor, action) {
    if (!actor) return null;
    actor.domain ||= {};
    var domain = actor.domain;
    var profile = actor.characterCardProfile || actor.profile || {};
    var domainName = action?.domainName || action?.domainProfile?.domainName || profile.domainName || profile.domain?.domainName || profile.domainScript?.domainName || profile.domainProfile || domain.name || domain.label || "领域展开";
    domain.name = domain.name || domainName;
    domain.label = domain.label || domainName;
    domain.threshold = Math.max(1, Number(domain.threshold || domain.maxLoad || domain.loadThreshold || 100) || 100);
    domain.load = Math.max(0, Number(domain.load || 0) || 0);
    return domain;
  }

  function getDuelActionText(action) {
    return [
      action?.id,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      action?.damageType,
      action?.scalingProfile,
      action?.cardType,
      action?.type,
      [].concat(action?.tags || []).join(" "),
      [].concat(action?.specialHandTags || []).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function createsBlackFlashWindow(action) {
    var effectText = [
      action?.effects?.selfStatus?.id,
      action?.effects?.selfStatus?.label,
      [].concat(action?.effects?.selfStatuses || []).map(function mapStatus(status) {
        return [status?.id, status?.label].filter(Boolean).join(" ");
      }).join(" ")
    ].filter(Boolean).join(" ");
    return /impactWindowCandidate|burstTimingWindowCandidate|blackFlashWindow|black_flash_window|爆发窗口候选|爆发时机窗口候选/i.test(effectText);
  }

  function isStrikeLikeAction(action) {
    var text;
    var cardType;
    var damageType;
    var scalingProfile;
    var runtimeDamage;
    var profile;

    if (!action || action.blackFlashEligible === false || action.evasionAllowed === false) return false;
    if (action.domainSpecific || action.effects?.activateDomain || action.effects?.releaseDomain || action.effects?.hutianBlackFlash) return false;
    if (createsBlackFlashWindow(action)) return false;
    text = getDuelActionText(action);
    cardType = String(action.cardType || action.type || "").toLowerCase();
    damageType = String(action.damageType || "").toLowerCase();
    scalingProfile = String(action.scalingProfile || "").toLowerCase();
    if (/domain|领域|healing|rct|反转术式|治疗|resource|support|defense|guard|防御|领域应对|domain_response/.test(cardType + " " + scalingProfile)) return false;
    if (/苍|赫|茈|blue|red|purple|解|捌|cleave|dismantle|slash|斩击|远程|远距|投射|射出|projectile|beam|光束|吸引|反转爆发|范围|area|aoe|必中|sure_hit|式神|shikigami/.test(text)) return false;
    runtimeDamage = getBattleRuntimeActionDamage(action);
    if (!(runtimeDamage > 0) && !action.instantKillOnHit && !action.effects?.instantKillOnHit && action.blackFlashEligible !== true) return false;
    if (action.blackFlashEligible === true) return true;
    profile = action.accuracyProfile ? String(action.accuracyProfile) : inferDuelAccuracyProfile(action);
    if (!["melee", "weapon", "execution_sword"].includes(profile)) return false;
    if (damageType === "melee" || damageType === "physical" || damageType === "cursed_tool") return true;
    if (["physical", "zero_ce", "cursed_tool", "melee", "strike"].includes(scalingProfile)) return true;
    return /strike|melee|physical|打击|体术|近身|拳|踢|肉搏|贴身|cursed_tool|咒具|刀|剑/.test(text);
  }

  function takeBlackFlashWindow(actor) {
    if (!Array.isArray(actor?.statusEffects)) return null;
    var ids = new Set(["impactWindowCandidate", "burstTimingWindowCandidate", "blackFlashWindow", "black_flash_window"]);
    var index = actor.statusEffects.findIndex(function findWindow(effect) {
      return ids.has(effect?.id);
    });
    if (index < 0) return null;
    var status = actor.statusEffects.splice(index, 1)[0];
    return status || null;
  }

  function calculateActionNumericPreview(action, actor) {
    var helper = global.JJKDuelCardTemplate?.calculateDuelCardFinalPreview;
    if (typeof helper !== "function") return null;
    try {
      var battle = getBattle();
      var runtimeAction = getProjectionRuntimeAction(getBlackBirdRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(action, actor || {}, battle), actor || {}, battle), actor || {}, battle), actor || {}, battle);
      runtimeAction = ensureCustomAtomicActionTransforms(runtimeAction, actor || {}, null, battle);
      runtimeAction = getSixEyesRuntimeAction(runtimeAction, actor || {});
      runtimeAction = stripCurseSpiritSummonEntryDamage(runtimeAction);
      var preview = helper(runtimeAction, actor || {});
      if (runtimeAction?.bloodRuntime) {
        preview = {
          ...(preview || {}),
          bloodRuntime: runtimeAction.bloodRuntime,
          base: {
            ...(preview?.base || {}),
            damage: getBattleRuntimeActionDamage(runtimeAction)
          }
        };
      }
      if (runtimeAction?.starRageRuntime) {
        preview = {
          ...(preview || {}),
          starRageRuntime: runtimeAction.starRageRuntime,
          base: {
            ...(preview?.base || {}),
            damage: getBattleRuntimeActionDamage(runtimeAction)
          }
        };
      }
      if (runtimeAction?.blackBirdRuntime) {
        preview = {
          ...(preview || {}),
          blackBirdRuntime: runtimeAction.blackBirdRuntime,
          base: {
            ...(preview?.base || {}),
            damage: getBattleRuntimeActionDamage(runtimeAction)
          }
        };
      }
      if (runtimeAction?.projectionRuntime) {
        preview = {
          ...(preview || {}),
          projectionRuntime: runtimeAction.projectionRuntime,
          base: {
            ...(preview?.base || {}),
            damage: getBattleRuntimeActionDamage(runtimeAction)
          }
        };
      }
      return preview;
    } catch (error) {
      return null;
    }
  }

  function getHutianBlackFlashStacks(actor, battle) {
    if (!actor || !battle) return 0;
    return Math.max(0, Math.floor(readDuelCounter(battle, actor.side || "left", "yuji_after68_black_flash", "black_flash_growth", {
      label: "黑闪递增", initial: 0, min: 0, format: "number"
    })));
  }

  function setHutianBlackFlashStacks(actor, battle, stacks) {
    if (!actor || !battle) return;
    var value = Math.max(0, Math.floor(Number(stacks || 0)));
    setDuelCounter(battle, actor.side || "left", "yuji_after68_black_flash", "black_flash_growth", value, {
      label: "黑闪递增", min: 0, format: "number"
    });
  }

  function getDuelMartialScoreForEvasion(resource) {
    var profile = resource?.characterCardProfile || {};
    var raw = resource?.raw || profile.raw || resource?.profile?.raw || {};
    var axes = resource?.axes || profile.axes || resource?.profile?.axes || {};
    return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? 0) || 0);
  }

  function getDuelHitRateFromMartialDiff(diff) {
    var value = Number(diff || 0);
    var compressed = Math.sign(value) * Math.sqrt(Math.abs(value)) * 0.055;
    return clamp(0.66 + compressed, 0.42, 0.86);
  }

  function normalizeRate(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (Math.abs(number) > 1) return number / 100;
    return number;
  }

  function normalizeDuelAccuracyProfileAlias(profile) {
    var key = String(profile || "").trim().toLowerCase();
    if (["close_quarters", "melee_precision", "technique_melee"].includes(key)) return "melee";
    // These cards are authored as domain-environment sure-hit pressure.  Treat
    // the profile explicitly as non-evadable instead of relying on an unknown
    // profile falling through getDuelAccuracyProfileConfig().
    if (key === "domain_sure_pressure") return "none";
    return key;
  }

  function hasDuelOpponentTargetEffect(action) {
    var effects = action?.effects || {};
    var directOperations = Array.isArray(action?.directEffectOperations) ? action.directEffectOperations : [];
    var opponentStatuses = [].concat(
      effects.opponentStatus ? [effects.opponentStatus] : [],
      Array.isArray(effects.opponentStatuses) ? effects.opponentStatuses : []
    ).filter(Boolean);
    return Boolean(
      opponentStatuses.length ||
      (Array.isArray(effects.opponentCounterOperations) && effects.opponentCounterOperations.length) ||
      directOperations.some(function targetsOpponent(operation) {
        return String(operation?.target || "").toLowerCase() === "opponent";
      }) ||
      Number(effects.opponentStabilityDelta || 0) ||
      Number(effects.opponentDomainLoadDelta || 0) ||
      Number(effects.opponentCeDelta || 0) ||
      Number(effects.opponentHpDelta || 0) ||
      Number(effects.opponentRegenInterference || 0) ||
      Object.keys(effects.opponentWeightDeltas || {}).length
    );
  }

  function inferDuelAccuracyProfile(action) {
    var cardType = String(action?.cardType || action?.type || "").toLowerCase();
    var damageType = String(action?.damageType || "").toLowerCase();
    var scalingProfile = String(action?.scalingProfile || "").toLowerCase();
    var text = [
      action?.id,
      action?.label,
      action?.name,
      action?.description,
      action?.effectSummary,
      cardType,
      damageType,
      scalingProfile,
      [].concat(action?.tags || []).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
    if (action?.evasionAllowed === false || action?.domainSpecific || action?.effects?.activateDomain || action?.effects?.releaseDomain) return "none";
    if (action?.accuracyProfile) {
      var explicitProfile = normalizeDuelAccuracyProfileAlias(action.accuracyProfile);
      if (explicitProfile === "none" || getDuelAccuracyProfileConfig(explicitProfile)) return explicitProfile;
      // Imported/custom cards may contain an unknown profile. An unknown label
      // must not silently become guaranteed-hit; fall through to shape inference.
    }
    if (action?.effects?.dounaImmediateWorldSlash || action?.effects?.dounaBoundWorldSlash || action?.type === "douna_world_slash" || action?.type === "douna_bound_world_slash") return "world_slash";
    if (action?.executionSword || action?.instantKillOnHit) return "execution_sword";
    if (/范围|area|aoe|environment|swarm|散射|爆破|地形|环境/.test(text)) return "technique_area";
    if (/咒具|cursed_tool|weapon|刀|剑/.test(text) || cardType === "curse_tool" || damageType === "cursed_tool") return "weapon";
    if (/苍|赫|茈|blue|red|purple|解|捌|cleave|dismantle|slash|斩击|远程|远距|投射|射出|projectile|beam|光束|吸引|反转爆发/.test(text)) return "technique_projectile";
    if (/近身|体术|拳|踢|melee|strike|physical|black_flash/.test(text) || cardType === "attack" || cardType === "basic") return "melee";
    if (cardType === "technique" || cardType === "ce_burst" || cardType === "special" || cardType === "soul_pressure") return "technique_projectile";
    return "melee";
  }

  function isDuelWorldSlashAction(action) {
    return inferDuelAccuracyProfile(action) === "world_slash";
  }

  function getDuelAccuracyProfileConfig(profile) {
    var key = String(profile || "none");
    var configs = {
      melee: { hitBonus: 0, min: 0.25, max: 0.9, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      weapon: { hitBonus: 0.02, min: 0.25, max: 0.92, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      execution_sword: { hitBonus: -0.04, min: 0.08, max: 0.86, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      world_slash: { hitBonus: 0.04, min: 0.08, max: 0.92, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      technique_projectile: { hitBonus: 0.08, min: 0.3, max: 0.94, damageScaleOnMiss: 0.18, ceScaleOnMiss: 0.25, stabilityScaleOnMiss: 0.25 },
      technique_bind: { hitBonus: 0.08, min: 0.3, max: 0.94, damageScaleOnMiss: 0, ceScaleOnMiss: 0, stabilityScaleOnMiss: 0 },
      technique_area: { hitBonus: 0.23, min: 0.42, max: 0.95, damageScaleOnMiss: 0.45, ceScaleOnMiss: 0.5, stabilityScaleOnMiss: 0.5 }
    };
    return configs[key] || null;
  }

  function hasMythicalBeastAmberAoeFullDodge(resource, battle) {
    return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).some(function hasAmberAoeDodge(effect) {
      if (!isDuelStatusEffectActive(effect, battle)) return false;
      return effect?.id === "mythicalBeastAmber" && (effect.mythicalBeastAmberAoeFullDodge === true || Number(effect.evasionBonus || 0) > 0);
    });
  }

    function shouldMythicalBeastAmberFullyDodgeAoe(action, defender, battle, profile, actor) {
    var runner = global.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
    if (typeof runner !== "function") return false;
    var result = global.JJKBattleSpecialRuntime.runBattleSpecialEntry("evasionModifier", {
      abilities: getBattleSpecialAbilitiesForRuntime(),
      battle: battle,
      side: defender?.side || "",
      actor: defender,
      opponent: actor,
      action: action,
      card: action,
      evasion: { damageScale: 1, ceScale: 1, stabilityScale: 1 },
      evasionProfile: String(profile || ""),
      turn: getDuelActionTurnNumber(battle)
    });
    return result?.evasion?.damageScale === 0;
  }

  function rollDuelEvasionRandom(battle, label) {
    var value;
    var round;
    var key;
    var count;
    var seed;
    if (battle && (battle.mode === "online" || battle.onlineRoomId || battle.onlineBattleSeed)) {
      battle.onlineRandomCounters ||= {};
      round = Number(battle.round || 0) + 1;
      key = [battle.onlineRoomId || "room", round, String(label || "evasion")].join(":");
      count = Number(battle.onlineRandomCounters[key] || 0) + 1;
      battle.onlineRandomCounters[key] = count;
      seed = [
        "online-deterministic-rng-v2",
        battle.onlineBattleSeed || battle.battleSeed || battle.seed || "",
        battle.onlineRoomId || "",
        round,
        label || "evasion",
        count
      ].join("|");
      value = (hashDuelSeed(seed) >>> 0) / 4294967296;
    } else {
      value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
    }
    if (battle) {
      battle.randomLog ||= [];
      battle.randomLog.push({
        round: Number(battle.round || 0) + 1,
        label: label || "evasion",
        value: Number(value.toFixed(8))
      });
    }
    return value;
  }

  function showDuelFloatingCombatText(battle, text, type, side) {
    var now = Date.now();
    if (!battle) return;
    battle.floatingCombatText = {
      text: text || "未命中！",
      type: type || "miss",
      side: side || "",
      createdAt: now,
      expiresAt: now + 1000
    };
  }

  function resolveDuelActionEvasion(action, actor, opponent, battle, options) {
    var profile = inferDuelAccuracyProfile(action);
    var config = getDuelAccuracyProfileConfig(profile);
    var attackerMartial;
    var defenderMartial;
    var diff;
    var baseRate;
    var hitRate;
    var roll;
    var onMiss = action?.onMiss || {};
    var defenderContext;
    var evasionBonus;
    var tacticActionModifiers;
    var tacticDefenseModifiers;
    if (action?.evasionAllowed === false) {
      return { checked: false, evaded: false, profile: "none", hitRate: 1, roll: 0 };
    }
    if (!config || !action || !actor || !opponent || !battle) {
      return { checked: false, evaded: false, profile: profile || "none", hitRate: 1, roll: 0 };
    }
    var hasHostileOutput = Number(options?.damage || 0) > 0 ||
      Number(options?.stabilityShock || 0) > 0 ||
      Number(options?.directCeDamage || 0) > 0 ||
      hasDuelOpponentTargetEffect(action);
    if (!hasHostileOutput && !action.instantKillOnHit && !action.effects?.instantKillOnHit) {
      return { checked: false, evaded: false, profile: profile, hitRate: 1, roll: 0 };
    }
    var canonNoHitResolver = global.JJKShibuyaIncident?.getSukunaJogoCanonEvasionOverride;
    if (typeof canonNoHitResolver === "function") {
      var canonNoHit = canonNoHitResolver(battle, actor, opponent, { action: action, damage: Number(options?.damage || 0) });
      if (canonNoHit?.applied) return canonNoHit;
    }
    attackerMartial = getDuelMartialScoreForEvasion(actor);
    defenderMartial = getDuelMartialScoreForEvasion(opponent);
    defenderContext = getDuelActionContext(battle, opponent.side);
    tacticActionModifiers = getDuelTacticActionModifiers(action, actor, opponent, battle);
    tacticDefenseModifiers = getDuelTacticDefenseModifiers(opponent, battle);
    var constitutionEvasion = global.JJKSpecialConstitution?.getConditionalEvasionBonus(action, opponent) || { bonus: 0, reasons: [] };
    evasionBonus = Number(defenderContext.evasionBonus || 0) + Number(getActiveDuelEvasionStatusBonus(opponent, battle) || 0) + Number(tacticDefenseModifiers.evasionBonus || 0) + Number(constitutionEvasion.bonus || 0);
    diff = attackerMartial - defenderMartial;
    if (Number.isFinite(Number(action.dounaForcedHitRate))) {
      hitRate = clamp(Number(action.dounaForcedHitRate), 0, 1);
      roll = rollDuelEvasionRandom(battle, "evasion:" + (action.id || action.label || profile));
      return {
        checked: true,
        evaded: roll > hitRate,
        profile: profile,
        hitRate: Number(hitRate.toFixed(4)),
        roll: Number(roll.toFixed(4)),
        attackerMartial: Number(attackerMartial.toFixed(2)),
        defenderMartial: Number(defenderMartial.toFixed(2)),
        martialDiff: Number(diff.toFixed(2)),
        defenderEvasionBonus: Number(evasionBonus.toFixed(4)),
        damageScaleOnMiss: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor) ? 0 : normalizeRate(onMiss.damageScale, config.damageScaleOnMiss),
        ceScaleOnMiss: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor) ? 0 : normalizeRate(onMiss.ceDamageScale, config.ceScaleOnMiss),
        stabilityScaleOnMiss: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor) ? 0 : normalizeRate(onMiss.stabilityScale, config.stabilityScaleOnMiss),
        mythicalBeastAmberAoeFullDodge: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor),
        keepCardOnMiss: Boolean(onMiss.keepCard || action.executionSword || action.retainedPermanent || action.noRefresh)
      };
    }
    baseRate = normalizeRate(action.baseHitRate ?? action.accuracyBaseRate, getDuelHitRateFromMartialDiff(diff));
    hitRate = clamp(
      baseRate +
      Number(config.hitBonus || 0) +
      Number(tacticActionModifiers.hitRateBonus || 0) +
      normalizeRate(action.hitRateModifier ?? action.accuracyModifier ?? action.effects?.hitRateModifier, 0) +
      getActiveDuelHitRateStatusModifier(actor, battle) -
      evasionBonus,
      Number(config.min || 0.05),
      Number(config.max || 0.96)
    );
    roll = rollDuelEvasionRandom(battle, "evasion:" + (action.id || action.label || profile));
    return {
      checked: true,
      evaded: roll > hitRate,
      profile: profile,
      hitRate: Number(hitRate.toFixed(4)),
      roll: Number(roll.toFixed(4)),
      attackerMartial: Number(attackerMartial.toFixed(2)),
      defenderMartial: Number(defenderMartial.toFixed(2)),
      martialDiff: Number(diff.toFixed(2)),
      defenderEvasionBonus: Number(evasionBonus.toFixed(4)),
      damageScaleOnMiss: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor) ? 0 : normalizeRate(onMiss.damageScale, config.damageScaleOnMiss),
      ceScaleOnMiss: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor) ? 0 : normalizeRate(onMiss.ceDamageScale, config.ceScaleOnMiss),
      stabilityScaleOnMiss: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor) ? 0 : normalizeRate(onMiss.stabilityScale, config.stabilityScaleOnMiss),
      mythicalBeastAmberAoeFullDodge: shouldMythicalBeastAmberFullyDodgeAoe(action, opponent, battle, profile, actor),
      keepCardOnMiss: Boolean(onMiss.keepCard || action.executionSword || action.retainedPermanent || action.noRefresh)
    };
  }

  function getDuelUnitFixedEvasionRate(unit) {
    var configured = normalizeRate(
      unit?.fixedEvasionRate ??
      unit?.unitStats?.fixedEvasionRate ??
      unit?.evasionRate ??
      unit?.unitStats?.evasionRate,
      NaN
    );
    if (Number.isFinite(configured)) return clamp(configured, 0, 0.95);
    if (isYutaVolume0RikaManifestedUnit(unit)) return 0.6;
    if (isYutaRikaManifestedUnit(unit)) return 0.35;
    return 0;
  }

  function resolveDuelUnitFixedEvasion(unit, battle, target, options) {
    if (!unit || !battle || options?.ignoreUnitFixedEvasion) {
      return { checked: false, evaded: false, profile: "unit_fixed_evasion", evasionRate: 0, hitRate: 1, roll: 0 };
    }
    var evasionRate = getDuelUnitFixedEvasionRate(unit);
    if (!(evasionRate > 0)) {
      return { checked: false, evaded: false, profile: "unit_fixed_evasion", evasionRate: 0, hitRate: 1, roll: 0 };
    }
    var roll = rollDuelEvasionRandom(battle, "unit_fixed_evasion:" + (unit.id || unit.cardId || unit.name || "unit"));
    var evaded = roll < evasionRate;
    var result = {
      checked: true,
      evaded: evaded,
      profile: "unit_fixed_evasion",
      evasionRate: Number(evasionRate.toFixed(4)),
      hitRate: Number((1 - evasionRate).toFixed(4)),
      roll: Number(roll.toFixed(4)),
      targetId: target?.id || unit.id || "",
      targetName: target?.name || unit.name || "召唤单位"
    };
    if (evaded) {
      battle.evasionLog ||= [];
      battle.evasionLog.unshift({
        round: Number(battle.round || 0) + 1,
        actorSide: "",
        defenderSide: target?.side || unit.ownerSide || unit.side || "",
        actionId: "unit_fixed_evasion",
        actionLabel: unit?.unitStats?.fixedEvasionLabel || unit?.fixedEvasionLabel || "固定闪避",
        profile: "unit_fixed_evasion",
        hitRate: result.hitRate,
        roll: result.roll,
        evaded: true,
        targetName: result.targetName,
        detail: result.targetName + " 触发固定闪避。"
      });
      showDuelFloatingCombatText(battle, "闪避", "miss", target?.side || unit.ownerSide || unit.side || "");
    }
    return result;
  }

  function getDuelBattlefieldUnits(battle) {
    if (!battle) return [];
    if (!Array.isArray(battle.battlefieldUnits)) battle.battlefieldUnits = [];
    return battle.battlefieldUnits;
  }

  function isYutaRikaFullManifestationAction(action) {
    var text = [
      action?.id,
      action?.actionId,
      action?.cardId,
      action?.label,
      action?.name,
      action?.summonSpec?.unitCardId,
      action?.summonSpec?.unitName
    ].concat(
      Array.isArray(action?.tags) ? action.tags : [],
      Array.isArray(action?.specialHandTags) ? action.specialHandTags : []
    ).filter(Boolean).join(" ");
    return /yuta_rika_full_manifestation|yuta_rika_manifestation|祈本里香完全显现/.test(text);
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

  function isYutaVolume0RikaManifestedUnit(unit) {
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
    return /rika_volume0_full_manifestation|yuta_rika_manifestation_volume0|特级过咒怨灵-完全显现/.test(text);
  }

  function isRctOutputInstantKillImmuneTarget(resource) {
    var text = [
      resource?.id,
      resource?.cardId,
      resource?.actionId,
      resource?.name,
      resource?.label,
      resource?.displayName,
      resource?.officialGrade,
      resource?.powerTier,
      resource?.notes,
      resource?.characterCardProfile?.displayName,
      resource?.characterCardProfile?.officialGrade,
      resource?.characterCardProfile?.powerTier,
      resource?.characterCardProfile?.notes
    ].concat(
      Array.isArray(resource?.tags) ? resource.tags : [],
      Array.isArray(resource?.unitStats?.tags) ? resource.unitStats.tags : [],
      Array.isArray(resource?.innateTraits) ? resource.innateTraits : [],
      Array.isArray(resource?.characterCardProfile?.innateTraits) ? resource.characterCardProfile.innateTraits : []
    ).filter(Boolean).join(" ");
    return /rika_volume0_full_manifestation|yuta_rika_manifestation_volume0|特级过咒怨灵-完全显现/.test(text);
  }

  function getActiveYutaRikaManifestationUnit(battle, side) {
    if (!battle || !side) return null;
    return getDuelBattlefieldUnits(battle).find(function findRikaUnit(unit) {
      if (!unit?.active || unit.defeated) return false;
      if ((unit.controllerSide || unit.ownerSide || unit.side || "") !== side) return false;
      return isYutaRikaManifestedUnit(unit);
    }) || null;
  }

  function hasActiveYutaRikaManifestation(battle, side) {
    return Boolean(getActiveYutaRikaManifestationUnit(battle, side));
  }

  function isYutaTruePureLoveCannonAction(action) {
    var text = [
      action?.id,
      action?.actionId,
      action?.cardId,
      action?.label,
      action?.name
    ].concat(
      Array.isArray(action?.tags) ? action.tags : [],
      Array.isArray(action?.specialHandTags) ? action.specialHandTags : []
    ).filter(Boolean).join(" ");
    return Boolean(action?.effects?.yutaTruePureLoveCannon || /yuta_true_pure_love_cannon|真-纯爱大炮|真纯爱大炮/.test(text));
  }

  function getDuelCePoolMultiplierForResource(resource) {
    var statGetter = global.JJKDuelCardTemplate?.getDuelCharacterCombatStats;
    var multiplierGetter = global.JJKDuelCardTemplate?.getDuelRankMultiplier;
    if (typeof statGetter !== "function" || typeof multiplierGetter !== "function") return 1;
    try {
      var stats = statGetter(resource || {});
      return Math.max(0.1, Number(stats?.multipliers?.cePool || multiplierGetter(stats?.cePool || "B") || 1));
    } catch (error) {
      return 1;
    }
  }

  function getDuelMartialMultiplierForResource(resource) {
    var statGetter = global.JJKDuelCardTemplate?.getDuelCharacterCombatStats;
    var multiplierGetter = global.JJKDuelCardTemplate?.getDuelRankMultiplier;
    if (typeof statGetter !== "function" || typeof multiplierGetter !== "function") return 1;
    try {
      var stats = statGetter(resource || {});
      var physical = Number(stats?.multipliers?.physicalPower || multiplierGetter(stats?.physicalPower || "B") || 1);
      var speed = Number(stats?.multipliers?.speed || multiplierGetter(stats?.speed || "B") || 1);
      return Math.max(0.1, Math.max(physical, speed));
    } catch (error) {
      return 1;
    }
  }

  function getScaledStarRageMultiplier(rawMultiplier, scale, cap) {
    var multiplier = Math.max(0.1, Number(rawMultiplier || 1));
    var normalizedScale = Math.max(0, Number(scale || 0));
    var maxMultiplier = Math.max(1, Number(cap || 1));
    if (!normalizedScale) return 1;
    return Number(Math.min(maxMultiplier, 1 + (multiplier - 1) * normalizedScale).toFixed(4));
  }

  function cloneDuelPlain(value) {
    if (value == null || typeof value !== "object") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return Array.isArray(value) ? value.slice() : { ...value };
    }
  }

  function getDuelCardTemplateByCardId(cardId) {
    var getter = getOptionalDependency("getDuelCardTemplateIndex");
    var index = getter ? getter() : global.JJKDuelCardTemplate?.getDuelCardTemplateIndex?.();
    var cards = Array.isArray(index?.cards) ? index.cards : [];
    return cards.find(function findCard(card) {
      return card?.cardId === cardId || card?.actionId === cardId;
    }) || getDuelSpecialCardByCardId(cardId);
  }

  function collectDuelSummonZoneText(action, unitTemplate, summonSpec, unitStats) {
    return [
      action?.id,
      action?.cardId,
      action?.actionId,
      action?.name,
      action?.label,
      action?.type,
      action?.cardType,
      summonSpec?.unitCardId,
      summonSpec?.unitName,
      summonSpec?.placement,
      summonSpec?.summonLane,
      unitTemplate?.cardId,
      unitTemplate?.actionId,
      unitTemplate?.name,
      unitTemplate?.cardType,
      unitStats?.placement,
      unitStats?.summonLane
    ].concat(
      Array.isArray(action?.tags) ? action.tags : [],
      Array.isArray(unitTemplate?.tags) ? unitTemplate.tags : [],
      Array.isArray(unitStats?.tags) ? unitStats.tags : []
    ).filter(Boolean).join(" ");
  }

  function getDuelDefaultSummonPlacement(action, unitTemplate, summonSpec, unitStats) {
    var text = collectDuelSummonZoneText(action, unitTemplate, summonSpec, unitStats);
    if (/ten_shadows|十影|十种影|十種影|shikigami|式神|curse_spirit_manipulation|咒灵操术|咒灵/i.test(text)) {
      return "shikigami_zone";
    }
    return "battlefield";
  }

  function getDuelDefaultSummonZoneLabel(action, unitTemplate, summonSpec, unitStats, placement) {
    var text = collectDuelSummonZoneText(action, unitTemplate, summonSpec, unitStats);
    if (/curse_spirit_manipulation|咒灵操术|咒灵|虹龙|口裂女|化身玉藻前/i.test(text)) return "咒灵式神区";
    if (placement === "shikigami_zone" || /ten_shadows|十影|十种影|十種影|shikigami|式神|shadow_/i.test(text)) return "式神区";
    return "";
  }

  function buildDuelGeneratedHandAction(card, sourceAction, round) {
    var actionId = card?.actionId || card?.id || card?.cardId;
    if (!actionId) return null;
    var ceCost = Number(card.cost?.ce ?? card.ceCost ?? 0);
    var damage = Number(card.effect?.damage ?? card.damage ?? 0);
    var block = Number(card.effect?.block ?? card.block ?? 0);
    var effect = {
      ...buildCardTemplateRuntimeEffects(card),
      ...(card.effect || {}),
      damage: damage,
      block: block,
      stabilityDamage: Number(card.effect?.stabilityDamage ?? card.stabilityDamage ?? card.baseStabilityDamage ?? 0),
      ceDamage: Number(card.effect?.ceDamage ?? card.ceDamage ?? card.baseCeDamage ?? 0),
      domainLoadDelta: Number(card.effect?.domainLoadDelta ?? card.domainLoadDelta ?? card.baseDomainLoadDelta ?? 0),
      domainPressure: Number(card.effect?.domainPressure ?? card.domainPressure ?? card.baseDomainPressure ?? 0)
    };
    return {
      id: actionId,
      actionId: actionId,
      cardId: card.cardId || card.id || ("card_" + actionId),
      label: card.name || actionId,
      name: card.name || actionId,
      description: card.effectSummary || card.summary || "",
      type: card.cardType || card.type || "maintenance",
      cardType: card.cardType || card.type || "maintenance",
      tags: Array.isArray(card.tags) ? card.tags.slice() : [],
      specialHandTags: Array.isArray(card.specialHandTags) ? card.specialHandTags.slice() : [],
      contexts: Array.isArray(card.contexts) ? card.contexts.slice() : ["normal"],
      requirements: cloneDuelPlain(card.requirements || {}),
      apCost: Number(card.apCost || 0),
      cost: { ...(card.cost || {}), ce: ceCost },
      ceCost: ceCost,
      damage: damage,
      block: block,
      durationRounds: Number(card.durationRounds || 0),
      damageType: card.damageType || "none",
      scalingProfile: card.scalingProfile || "card_template_runtime",
      accuracyProfile: card.accuracyProfile || "none",
      evasionAllowed: card.evasionAllowed,
      hitRateModifier: Number(card.hitRateModifier || 0),
      effect: effect,
      effects: effect,
      risk: card.risk || sourceAction?.risk || "medium",
      rarity: card.rarity || "common",
      effectSummary: card.effectSummary || card.summary || "",
      maintenanceSpec: cloneDuelPlain(card.maintenanceSpec || card.summon?.maintenance || card.effect?.special?.maintenanceSpec),
      generatedBy: card.generatedBy || sourceAction?.id || sourceAction?.actionId || "",
      generatedRound: round,
      handSource: card.handSource || "generated-maintenance",
      retainedPermanent: true,
      noRefresh: true,
      playableGeneratedCard: true,
      weight: 999
    };
  }

  function injectDuelGeneratedHandCard(battle, side, card, sourceAction) {
    if (!battle || !side || !card) return null;
    battle.handState ||= {};
    battle.handState[side] ||= { cards: [], discardPile: [], round: 0, lastDrawn: [], lastInjected: [] };
    var hand = battle.handState[side];
    var id = card.actionId || card.cardId || card.id || "";
    if (!id) return null;
    var existing = (hand.cards || []).find(function findExisting(entry) {
      return (entry?.actionId || entry?.id || entry?.action?.id || "") === id;
    });
    if (existing) return existing;
    var generated = buildDuelGeneratedHandAction(card, sourceAction, Number(battle.round || 0) + 1);
    if (!generated) return null;
    hand.cards = Array.isArray(hand.cards) ? hand.cards : [];
    hand.cards.unshift(generated);
    hand.lastInjected = [{ actionId: generated.id, label: generated.label, reason: "summon-maintenance" }].concat(hand.lastInjected || []).slice(0, 8);
    return generated;
  }

  function applyDuelSummonAction(action, actor, battle) {
    var summonSpec = action?.summonSpec;
    if (!summonSpec?.unitCardId || !actor || !battle) return null;
    var unitTemplate = getDuelCardTemplateByCardId(summonSpec.unitCardId);
    var unitStats = cloneDuelPlain(unitTemplate?.unitStats || action.unitStats || summonSpec.unitStats || {});
    var ownerSide = summonSpec.ownerSide || actor.side || "";
    var round = Number(battle.round || 0) + 1;
    var unitId = [summonSpec.unitCardId, ownerSide || "neutral", round, getDuelBattlefieldUnits(battle).length + 1].join("_");
    var control = summonSpec.control || unitStats.control || "player_controlled";
    var side = control === "neutral_uncontrolled" || control === "neutral_berserk" ? "neutral" : ownerSide;
    var damage = Number(unitStats.damage ?? unitTemplate?.damage ?? 0);
    var maxHp = Number(unitStats.maxHp || unitStats.currentHp || unitTemplate?.baseHp || 0);
    var guardRules = cloneDuelPlain(unitTemplate?.guardRules || action.guardRules || unitStats.guardRules || {});
    var targetingRules = cloneDuelPlain(unitTemplate?.targetingRules || action.targetingRules || unitStats.targetingRules || {});
    var isFriendlyControlled = side !== "neutral" && control !== "neutral_uncontrolled" && control !== "neutral_berserk";
    var hasExplicitGuardBehavior = guardRules.protectOwner === true || guardRules.interceptsOpponentAttacks === true;
    if (isFriendlyControlled && hasExplicitGuardBehavior && targetingRules.neverCountsAsGuard !== true && guardRules.neverCountsAsGuard !== true) {
      guardRules.priority = Number(guardRules.priority ?? unitStats.guardPriority ?? 10);
    }
    var maintenanceCeCost = Number(
      summonSpec.maintenanceCeCost ??
      unitStats.maintenanceCeCost ??
      unitTemplate?.maintenanceCeCost ??
      Math.ceil(damage * 0.32 + maxHp * 0.035)
    );
    var placement = summonSpec.placement || unitStats.placement || getDuelDefaultSummonPlacement(action, unitTemplate, summonSpec, unitStats);
    var zoneLabel = summonSpec.zoneLabel || unitStats.zoneLabel || getDuelDefaultSummonZoneLabel(action, unitTemplate, summonSpec, unitStats, placement);
    var unit = {
      id: unitId,
      cardId: unitTemplate?.cardId || summonSpec.unitCardId,
      actionId: unitTemplate?.actionId || unitTemplate?.actionId || summonSpec.unitCardId,
      name: unitTemplate?.name || summonSpec.unitName || summonSpec.unitCardId,
      label: unitTemplate?.name || summonSpec.unitName || summonSpec.unitCardId,
      side: side,
      ownerSide: ownerSide,
      controllerSide: side === "neutral" ? "" : ownerSide,
      control: control,
      placement: placement,
      summonLane: summonSpec.summonLane || unitStats.summonLane || "",
      zoneLabel: zoneLabel,
      tags: uniqueFeatureList([]
        .concat(Array.isArray(unitTemplate?.tags) ? unitTemplate.tags : [])
        .concat(Array.isArray(action?.tags) ? action.tags : [])
        .concat(Array.isArray(unitStats?.tags) ? unitStats.tags : [])),
      unitStats: unitStats,
      hp: maxHp,
      maxHp: maxHp,
      damage: damage,
      damageType: unitTemplate?.damageType || unitStats.damageType || action.damageType || "",
      targetingRules: targetingRules,
      guardRules: guardRules,
      adaptationRules: cloneDuelPlain(unitTemplate?.adaptationRules || unitStats.adaptationRules || action.adaptationRules || {}),
      matchupModifiers: cloneDuelPlain(unitTemplate?.matchupModifiers || unitStats.matchupModifiers || action.matchupModifiers || {}),
      baseStats: cloneDuelPlain(unitStats.baseStats || unitTemplate?.baseStats || {}),
      raw: cloneDuelPlain(unitStats.raw || unitTemplate?.raw || {}),
      axes: cloneDuelPlain(unitStats.axes || unitTemplate?.axes || {}),
      attackProfile: cloneDuelPlain(unitStats.attackProfile || unitTemplate?.attackProfile || {}),
      maintenanceCeCost: Math.max(0, Number.isFinite(maintenanceCeCost) ? Math.round(maintenanceCeCost) : 0),
      uniqueSummonKey: summonSpec.uniqueSummonKey || unitStats.uniqueSummonKey || "",
      lastMaintenanceRound: 0,
      active: true,
      spawnedBy: action.id || action.actionId || "",
      spawnedRound: round,
      durationRounds: Math.max(0, Number(summonSpec.durationRounds ?? unitTemplate?.durationRounds ?? action.durationRounds ?? 0) || 0),
      expiresAfterRound: Math.max(0, Number(summonSpec.durationRounds ?? unitTemplate?.durationRounds ?? action.durationRounds ?? 0) || 0)
        ? round + Math.max(0, Number(summonSpec.durationRounds ?? unitTemplate?.durationRounds ?? action.durationRounds ?? 0) || 0) - 1
        : 0
    };
    getDuelBattlefieldUnits(battle).push(unit);
    var maintenanceCard = null;
    if (summonSpec.requiresMaintenanceCardId) {
      maintenanceCard = injectDuelGeneratedHandCard(battle, ownerSide, getDuelCardTemplateByCardId(summonSpec.requiresMaintenanceCardId), action);
    }
    var grantedHandCards = [];
    var grantIds = []
      .concat(Array.isArray(action?.effects?.grantHandCardsOnSummon) ? action.effects.grantHandCardsOnSummon : [])
      .concat(Array.isArray(action?.grantHandCardsOnSummon) ? action.grantHandCardsOnSummon : []);
    uniqueFeatureList(grantIds).forEach(function grantSummonHandCard(cardId) {
      var card = getDuelCardTemplateByCardId(cardId);
      if (!card) return;
      var granted = injectDuelGeneratedHandCard(battle, ownerSide, { ...card, handSource: "summon-granted" }, action);
      if (granted) grantedHandCards.push(granted);
    });
    // 真-纯爱大炮不是复制术式的常驻抽牌；它由里香完全显现一次性赋予，
    // 并通过自身 maintenanceSpec 在显现单位退场后从手牌中移除。
    if (isYutaRikaFullManifestationAction(action)) {
      var pureLoveCannon = getDuelCardTemplateByCardId("card_yuta_true_pure_love_cannon");
      if (pureLoveCannon) {
        var grantedCannon = injectDuelGeneratedHandCard(battle, ownerSide, { ...prepareDirectBattleCardHandAction(cloneDuelPlain(pureLoveCannon)), handSource: "rika-manifestation-granted" }, action);
        if (grantedCannon) grantedHandCards.push(grantedCannon);
      }
    }
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: ownerSide,
      actionId: action.actionId || action.id || "",
      cardId: action.cardId || "",
      unitCardId: summonSpec.unitCardId || "",
      unitId: unit.id,
      unitName: unit.name,
      control: control,
      maintenanceActionId: maintenanceCard?.id || "",
      grantedHandCards: grantedHandCards.map(function mapGranted(card) { return card?.id || card?.actionId || card?.cardId || ""; }).filter(Boolean),
      maintenanceCeCost: unit.maintenanceCeCost,
      uniqueTenShadowsSummon: isTenShadowsUniqueShikigamiAction(action),
      uniqueRikaManifestationSummon: isYutaRikaFullManifestationAction(action),
      uniqueSummonKey: action?.summonSpec?.uniqueSummonKey || "",
      uniqueCurseSpiritSummon: isCurseSpiritManipulationUniqueSummonAction(action)
    });
    markTenShadowsShikigamiSummoned(battle, ownerSide, action, unit);
    markYutaRikaManifestationSummoned(battle, ownerSide, action, unit);
    markCurseSpiritManipulationSummoned(battle, ownerSide, action, unit);
    return { unit: unit, maintenanceCard: maintenanceCard, grantedHandCards: grantedHandCards };
  }

  function cleanupExpiredDuelBattlefieldUnits(battle, round) {
    var currentRound = Number(round || battle?.round || 0) + 1;
    return getDuelBattlefieldUnits(battle).filter(function cleanup(unit) {
      if (!unit?.active) return false;
      var expiresAfterRound = Number(unit.expiresAfterRound || 0);
      if (!expiresAfterRound || currentRound <= expiresAfterRound) return false;
      unit.active = false;
      unit.expiredRound = currentRound;
      battle.summonLog ||= [];
      battle.summonLog.unshift({
        round: currentRound,
        unitId: unit.id || "",
        unitName: unit.name || unit.label || "",
        ownerSide: unit.ownerSide || "",
        reason: "duration-expired"
      });
      return true;
    });
  }

  function getFriendlyAssistSummonUnits(battle, side) {
    return getDuelBattlefieldUnits(battle).filter(function keepUnit(unit) {
      if (!unit?.active || unit.side === "neutral") return false;
      if ((unit.controllerSide || unit.ownerSide || unit.side) !== side) return false;
      if (unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
      return Number(unit.damage || unit.unitStats?.damage || 0) > 0;
    });
  }

  function applyDuelSummonUpkeep(actor, battle) {
    var side = actor?.side || "";
    if (!side || !battle) return null;
    var round = Number(battle.round || 0) + 1;
    var units = getDuelBattlefieldUnits(battle).filter(function keepUnit(unit) {
      if (!unit?.active || unit.side === "neutral") return false;
      if ((unit.controllerSide || unit.ownerSide || unit.side) !== side) return false;
      if (unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
      if (Number(unit.lastMaintenanceRound || 0) === round) return false;
      if (Number(unit.spawnedRound || 0) >= round) return false;
      return Boolean(unit.starRageGaruda) || Number(unit.maintenanceCeCost || unit.unitStats?.maintenanceCeCost || 0) > 0;
    });
    if (!units.length) return null;
    var paid = [];
    var dismissed = [];
    units.forEach(function maintainUnit(unit) {
      if (unit.maintenanceResource === "counter" && unit.maintenanceResourceNamespace && unit.maintenanceResourceCounterId) {
        var resourceState = readDuelCounter(battle, side, unit.maintenanceResourceNamespace, unit.maintenanceResourceCounterId);
        var resourceCost = Math.max(0, Number(unit.maintenanceResourceAmount || 0));
        if (resourceState >= resourceCost) {
          consumeDuelCounter(battle, side, unit.maintenanceResourceNamespace, unit.maintenanceResourceCounterId, resourceCost, { allowPartial: false });
          unit.lastMaintenanceRound = round;
          paid.push({ id: unit.id || "", name: unit.name || unit.label || "召唤物", costCounter: resourceCost, counterId: unit.maintenanceResourceCounterId });
        } else {
          unit.active = false;
          unit.dismissedRound = round;
          unit.dismissedReason = "maintenance-counter-shortage";
          dismissed.push({ id: unit.id || "", name: unit.name || unit.label || "召唤物", requiredCounter: resourceCost, availableCounter: resourceState });
        }
        return;
      }
      if (unit.starRageGaruda) {
        var massState = getStarRageMassState(battle, side);
        var beforeMass = Math.max(0, Number(massState.mass || 0));
        if (beforeMass >= 1) {
          massState.mass = beforeMass - 1;
          updateStarRageMassCounter(battle, side, massState);
          unit.lastMaintenanceRound = round;
          paid.push({ id: unit.id || "", name: unit.name || unit.label || "凰轮", costVirtualMass: 1 });
        } else {
          unit.active = false;
          unit.dismissedRound = round;
          unit.dismissedReason = "maintenance-virtual-mass-shortage";
          dismissed.push({ id: unit.id || "", name: unit.name || unit.label || "凰轮", requiredVirtualMass: 1, availableVirtualMass: beforeMass });
        }
        return;
      }
      var cost = Math.max(1, Number(unit.maintenanceCeCost || unit.unitStats?.maintenanceCeCost || 1));
      var beforeCe = Number(actor.ce || 0);
      if (beforeCe >= cost) {
        actor.ce = Number((beforeCe - cost).toFixed(1));
        unit.lastMaintenanceRound = round;
        paid.push({ id: unit.id || "", name: unit.name || unit.label || "", costCe: cost });
      } else {
        unit.active = false;
        unit.dismissedRound = round;
        unit.dismissedReason = "maintenance-ce-shortage";
        dismissed.push({ id: unit.id || "", name: unit.name || unit.label || "", requiredCe: cost, availableCe: beforeCe });
      }
    });
    if (!paid.length && !dismissed.length) return null;
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: side,
      reason: "summon-maintenance-upkeep",
      paid: paid,
      dismissed: dismissed
    });
    return { round: round, side: side, paid: paid, dismissed: dismissed };
  }

  function applyDuelSummonAssist(actor, opponent, battle) {
    var side = actor?.side || "";
    if (!side || !battle) return null;
    var round = Number(battle.round || 0) + 1;
    battle.summonAssistState ||= {};
    if (Number(battle.summonAssistState[side] || 0) === round) return null;
    var units = getFriendlyAssistSummonUnits(battle, side);
    var curseSpiritUnits = units.filter(function keepCurseSpiritUnit(unit) {
      return isMaximumUzumakiConsumableUnit(unit, side);
    });
    if (curseSpiritUnits.length > 2) {
      var selectedCurseSpiritIds = new Set(curseSpiritUnits
        .slice()
        .sort(function highestThreatFirst(left, right) {
          return getDuelSummonUnitThreatScore(right) - getDuelSummonUnitThreatScore(left);
        })
        .slice(0, 2)
        .map(function mapUnitId(unit) { return unit.id; }));
      units = units.filter(function keepActiveAssistUnit(unit) {
        return !isMaximumUzumakiConsumableUnit(unit, side) || selectedCurseSpiritIds.has(unit.id);
      });
    }
    if (!units.length) return null;
    var attacks = [];
    var totalDamage = 0;
    var totalStabilityShock = 0;
    units.forEach(function attackWithUnit(unit) {
      var count = Math.max(1, Math.min(3, Math.round(Number(unit.unitStats?.actionsPerRound || unit.actionsPerRound || 1))));
      for (var index = 0; index < count; index += 1) {
        var attack = resolveDuelSummonUnitAttack(unit, actor, opponent, battle, round, index);
        if (attack) {
          attacks.push(attack);
          totalDamage += Number(attack.damageApplied || 0);
          totalStabilityShock += Number(attack.stabilityShock || 0);
        }
      }
    });
    if (!attacks.length) return null;
    battle.summonAssistState[side] = round;
    var result = {
      round: round,
      side: side,
      damage: Number(totalDamage.toFixed(1)),
      stabilityShock: Number(totalStabilityShock.toFixed(4)),
      attacks: attacks.slice(0, 12),
      units: units.map(function mapUnit(unit) {
        return { id: unit.id || "", name: unit.name || unit.label || "", damage: Number(unit.damage || unit.unitStats?.damage || 0), actionsPerRound: Number(unit.unitStats?.actionsPerRound || unit.actionsPerRound || 1) };
      }).slice(0, 6)
    };
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: side,
      reason: "friendly-summon-assist",
      damage: result.damage,
      attacks: result.attacks,
      units: result.units
    });
    return result;
  }

  function getDuelSummonUnitMartialScore(unit) {
    var raw = unit?.raw || unit?.unitStats?.raw || {};
    var axes = unit?.axes || unit?.unitStats?.axes || {};
    return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? 0) || 0);
  }

  function getDuelSummonAttackDefenderMartialScore(target) {
    if (target?.type === "unit") return getDuelSummonUnitMartialScore(target.unit);
    return getDuelMartialScoreForEvasion(target?.resource || target);
  }

  function calculateDuelSummonUnitHitRate(unit, target, actor, battle, action) {
    var attackerMartial = getDuelSummonUnitMartialScore(unit);
    var defenderMartial = getDuelSummonAttackDefenderMartialScore(target);
    var profile = unit?.attackProfile || unit?.unitStats?.attackProfile || {};
    var baseRate = getDuelHitRateFromMartialDiff(attackerMartial - defenderMartial);
    var modifier = normalizeRate(profile.hitRateModifier, 0);
    var targetResource = target?.type === "character" ? target?.resource : null;
    var tacticActionModifiers = getDuelTacticActionModifiers(action, actor, targetResource || target?.unit, battle);
    var attackerTacticHitBonus = Number(tacticActionModifiers.hitRateBonus || 0);
    var defenderContext = targetResource ? getDuelActionContext(battle, targetResource.side) : createEmptyDuelActionContext();
    var tacticDefenseModifiers = targetResource ? getDuelTacticDefenseModifiers(targetResource, battle) : { evasionBonus: 0 };
    // A summon attacks under its owner's offensive tendency. Character targets
    // keep their locked-action, status and defensive-tendency evasion, while a
    // unit target only uses its own martial score and never borrows its owner's
    // character evasion bonuses.
    var defenderActionEvasionBonus = targetResource ? Number(defenderContext.evasionBonus || 0) : 0;
    var defenderStatusEvasionBonus = targetResource ? Number(getActiveDuelEvasionStatusBonus(targetResource, battle) || 0) : 0;
    var defenderTacticEvasionBonus = targetResource ? Number(tacticDefenseModifiers.evasionBonus || 0) : 0;
    var defenderEvasionBonus = defenderActionEvasionBonus + defenderStatusEvasionBonus + defenderTacticEvasionBonus;
    return {
      hitRate: clamp(baseRate + modifier + attackerTacticHitBonus - defenderEvasionBonus, 0.05, 0.96),
      attackerMartial: attackerMartial,
      defenderMartial: defenderMartial,
      attackerTacticHitBonus: attackerTacticHitBonus,
      defenderEvasionBonus: defenderEvasionBonus,
      defenderActionEvasionBonus: defenderActionEvasionBonus,
      defenderStatusEvasionBonus: defenderStatusEvasionBonus,
      defenderTacticEvasionBonus: defenderTacticEvasionBonus,
      targetType: target?.type || "character"
    };
  }

  function isDuelCurseTarget(resource) {
    var text = [
      resource?.name,
      resource?.label,
      resource?.displayName,
      resource?.officialGrade,
      resource?.powerTier,
      resource?.characterCardProfile?.name,
      resource?.characterCardProfile?.displayName,
      resource?.characterCardProfile?.pool,
      resource?.characterCardProfile?.officialGrade,
      resource?.characterCardProfile?.powerTier,
      ...(Array.isArray(resource?.tags) ? resource.tags : []),
      ...(Array.isArray(resource?.traits) ? resource.traits : []),
      ...(Array.isArray(resource?.innateTraits) ? resource.innateTraits : []),
      ...(Array.isArray(resource?.characterCardProfile?.tags) ? resource.characterCardProfile.tags : []),
      ...(Array.isArray(resource?.characterCardProfile?.traits) ? resource.characterCardProfile.traits : []),
      ...(Array.isArray(resource?.characterCardProfile?.innateTraits) ? resource.characterCardProfile.innateTraits : []),
      ...(Array.isArray(resource?.unitStats?.tags) ? resource.unitStats.tags : [])
    ].filter(Boolean).join(" ");
    return Boolean(resource?.characterCardProfile?.isCurse || resource?.isCurse ||
      /咒灵|咒靈|咒物|怨灵|怨靈|cursed_spirit|curse_spirit|disaster[_\s-]?curse|special[_\s-]?grade[_\s-]?curse|low[_\s-]?grade[_\s-]?curse/i.test(text));
  }

  function isDuelCursedSpiritTarget(resource) {
    var profile = resource?.characterCardProfile || {};
    var explicitTags = []
      .concat(Array.isArray(resource?.tags) ? resource.tags : [])
      .concat(Array.isArray(resource?.traits) ? resource.traits : [])
      .concat(Array.isArray(resource?.innateTraits) ? resource.innateTraits : [])
      .concat(Array.isArray(profile?.tags) ? profile.tags : [])
      .concat(Array.isArray(profile?.traits) ? profile.traits : [])
      .concat(Array.isArray(profile?.innateTraits) ? profile.innateTraits : [])
      .concat(Array.isArray(profile?.archetypes) ? profile.archetypes : [])
      .concat(Array.isArray(resource?.unitStats?.tags) ? resource.unitStats.tags : [])
      .map(function normalizeCursedSpiritTag(tag) { return String(tag || "").trim().toLowerCase(); })
      .filter(Boolean);
    var explicitTagSet = new Set(explicitTags);
    var excludedIncarnatedOrObject = resource?.isIncarnated === true || profile?.isIncarnated === true || [
      "incarnated", "incarnated_sorcerer", "cursed_object", "curse_object", "受肉", "咒物"
    ].some(function hasExcludedTag(tag) { return explicitTagSet.has(tag); });
    if (excludedIncarnatedOrObject) return false;
    if (resource?.isCurse === true || profile?.isCurse === true) return true;
    return [
      "cursed_spirit", "curse_spirit", "curse_spirit_general", "disaster_curse",
      "special_grade_curse", "low_grade_curse", "咒灵", "咒靈", "怨灵", "怨靈"
    ].some(function hasCursedSpiritTag(tag) { return explicitTagSet.has(tag); });
  }

  function isMahoragaSummonUnit(unit) {
    var text = [
      unit?.id,
      unit?.cardId,
      unit?.actionId,
      unit?.name,
      unit?.label,
      unit?.summonLane,
      unit?.zoneLabel,
      unit?.attackProfile?.attackType,
      unit?.unitStats?.attackProfile?.attackType
    ].concat(
      Array.isArray(unit?.tags) ? unit.tags : [],
      Array.isArray(unit?.unitStats?.tags) ? unit.unitStats.tags : []
    ).filter(Boolean).join(" ");
    return /mahoraga|魔虚罗|魔虛羅|魔须罗|魔須羅|八握剑|八握劍/i.test(text);
  }

  function getDuelSummonDomainDamageScale(actor, opponent) {
    var actorDomainActive = Boolean(actor?.domain?.active);
    var opponentDomainActive = Boolean(opponent?.domain?.active);
    if (actorDomainActive === opponentDomainActive) return 1;
    return actorDomainActive ? UNOPPOSED_DOMAIN_DAMAGE_SCALE : 0.75;
  }

  function resolveDuelSummonUnitAttack(unit, actor, opponent, battle, round, attackIndex) {
    var unitDamage = Math.max(0, Number(unit?.damage ?? unit?.unitStats?.damage ?? 0));
    if (!unitDamage || !opponent) return null;
    var harutaSuppressedRound = Number(unit?.harutaSuppressedRound ?? unit?.unitStats?.harutaSuppressedRound ?? 0);
    if ((unit?.harutaHandSword || unit?.unitStats?.harutaHandSword) && harutaSuppressedRound === Number(round || 0)) {
      return {
        unitId: unit.id || "",
        unitName: unit.name || unit.label || "手形刀柄咒具",
        attackIndex: attackIndex + 1,
        base: unitDamage,
        damage: 0,
        damageScale: 0,
        damageApplied: 0,
        evaded: false,
        deterministicHit: true,
        suppressed: true,
        suppressedReason: "haruta_tactic_suppress_tool",
        stabilityShock: 0,
        attackType: "cursed_tool_suppressed"
      };
    }
    var mahoragaRegen = Math.max(0, Number(unit?.mahoragaTurnEndHpRegen || unit?.unitStats?.mahoragaTurnEndHpRegen || 0));
    if (mahoragaRegen > 0 && Number(unit.mahoragaLastRegenRound || 0) !== Number(round || 0)) {
      unit.currentHp = Math.min(Number(unit.maxHp || unit.unitStats?.maxHp || 0), Number(unit.currentHp || unit.hp || 0) + mahoragaRegen);
      unit.hp = unit.currentHp;
      unit.mahoragaLastRegenRound = Number(round || 0);
    }
    var profile = unit?.attackProfile || unit?.unitStats?.attackProfile || {};
    var blockIgnoreRatio = Math.max(0, Math.min(0.9, Number(unit?.blockIgnoreRatio ?? unit?.unitStats?.blockIgnoreRatio ?? profile.blockIgnoreRatio ?? 0)));
    var damageScale = Math.max(0, Number(profile.damageScale || 1));
    // Independent summon attacks bypass the standard direct-damage pipeline,
    // so apply the uncontested-domain multiplier exactly once in this branch.
    var domainDamageScale = getDuelSummonDomainDamageScale(actor, opponent);
    damageScale *= domainDamageScale;
    var activityBossMechanicModifier = getDuelActivityBossMechanicDamageScale(null, actor, opponent, battle);
    damageScale *= Math.max(0, Number(activityBossMechanicModifier.scale || 1));
    if (isYutaRikaManifestedUnit(unit)) {
      damageScale *= Math.max(1, Number(unit?.yutaRikaDamageScale ?? unit?.unitStats?.yutaRikaDamageScale ?? 1.25));
    }
    if (unit?.starRageGaruda) {
      var garudaCePoolScale = getScaledStarRageMultiplier(
        getDuelCePoolMultiplierForResource(actor),
        unit.cePoolDamageScale ?? unit.unitStats?.cePoolDamageScale,
        unit.cePoolMaxMultiplier ?? unit.unitStats?.cePoolMaxMultiplier
      );
      var garudaMartialScale = getScaledStarRageMultiplier(
        getDuelMartialMultiplierForResource(actor),
        unit.martialDamageScale ?? unit.unitStats?.martialDamageScale,
        unit.martialMaxMultiplier ?? unit.unitStats?.martialMaxMultiplier
      );
      var garudaCeWeight = Math.max(0, Number(unit.cePoolDamageScale ?? unit.unitStats?.cePoolDamageScale ?? 0));
      var garudaMartialWeight = Math.max(0, Number(unit.martialDamageScale ?? unit.unitStats?.martialDamageScale ?? 0));
      var garudaWeightTotal = garudaCeWeight + garudaMartialWeight;
      var garudaCombinedScale = garudaWeightTotal > 0
        ? (garudaCePoolScale * garudaCeWeight + garudaMartialScale * garudaMartialWeight) / garudaWeightTotal
        : 1;
      damageScale *= Math.max(0, garudaCombinedScale);
    }
    if (Number(unit?.starRageMassAttackBuffRound || 0) === round) {
      damageScale *= Math.max(0, Number(unit.starRageMassAttackBuffScale || 1));
    }
    var preferredTarget = getPreferredDuelSummonAttackUnitTarget(battle, opponent.side || "", unit, unit.targetingRules || {});
    var action = {
      id: "summon_unit_attack_" + (unit.id || unit.cardId || "unit") + "_" + attackIndex,
      label: (unit.name || unit.label || "式神") + "·独立攻击",
      cardType: "summon_unit_attack",
      damageType: unit.damageType || unit.unitStats?.damageType || "shikigami",
      accuracyProfile: profile.accuracyProfile || "melee",
      damage: unitDamage,
      effect: { damage: unitDamage },
      effects: { damage: unitDamage },
      blockIgnoreRatio: blockIgnoreRatio,
      targetPlan: {
        ...(unit.targetingRules || {}),
        explicitTargetId: preferredTarget?.id || unit.targetingRules?.explicitTargetId || unit.targetingRules?.targetId || "",
        selectionMode: preferredTarget?.selectionMode || unit.targetingRules?.selectionMode || ""
      }
    };
    var damageTarget = resolveDuelDamageTarget(action, actor, opponent, battle, { damage: unitDamage, summonUnitAttack: true });
    var hitTarget = damageTarget?.type === "unit" ? damageTarget : { type: "character", resource: opponent };
    var damage = Math.round(unitDamage * damageScale);
    var effectiveTargetResource = damageTarget?.type === "unit" ? damageTarget.unit : opponent;
    var mahoragaCurseInstantKill = isMahoragaSummonUnit(unit) && isDuelCurseTarget(effectiveTargetResource);
    if (Number(profile.curseDamageMultiplier || 0) > 1 && isDuelCurseTarget(effectiveTargetResource)) {
      damage = Math.round(damage * Number(profile.curseDamageMultiplier));
    }
    var hit = calculateDuelSummonUnitHitRate(unit, hitTarget, actor, battle, action);
    var deterministicHit = profile.deterministicHit === true || unit?.deterministicHit === true || unit?.unitStats?.deterministicHit === true;
    var roll = deterministicHit ? 0 : rollDuelEvasionRandom(battle, "summon-unit:" + (unit.id || unit.cardId || unit.name || "unit") + ":" + round + ":" + attackIndex);
    var evaded = deterministicHit ? false : roll > hit.hitRate;
    var application = evaded ? null : (
      mahoragaCurseInstantKill
        ? applyDuelInstantKillToTarget(damageTarget, battle, "mahoraga_curse_instant_kill")
        : applyDuelStandardDamageToTarget(damageTarget, damage, battle, {
          actor: actor,
          opponent: opponent,
          action: action,
          sourceKind: "summon",
          source: "summon-unit-attack",
          sourceLabel: action.label,
          blockIgnoreRatio: blockIgnoreRatio,
          // This branch already applies the summon-domain state multiplier in
          // damageScale so it must not be multiplied a second time.
          applyDomainStateScale: false
        })
    );
    var stabilityShock = evaded || damageTarget?.type === "unit" ? 0 : Math.min(0.08, Number((damage / 650).toFixed(4)));
    if (stabilityShock > 0) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) - stabilityShock, 0, 1).toFixed(4));
    }
    return {
      unitId: unit.id || "",
      unitName: unit.name || unit.label || "",
      attackIndex: attackIndex + 1,
      base: unitDamage,
      damage: damage,
      damageScale: Number(damageScale.toFixed(4)),
      domainDamageScale: Number(domainDamageScale.toFixed(4)),
      activityBossMechanicScale: activityBossMechanicModifier.scale !== 1 ? Number(activityBossMechanicModifier.scale.toFixed(4)) : undefined,
      activityBossMechanicReason: activityBossMechanicModifier.reason || undefined,
      unitHpAfterRegen: mahoragaRegen > 0 ? unit.hp : undefined,
      damageApplied: application ? Number(application.applied || 0) : 0,
      instantKill: Boolean(!evaded && mahoragaCurseInstantKill),
      instantKillReason: !evaded && mahoragaCurseInstantKill ? "mahoraga_curse_instant_kill" : undefined,
      evaded: evaded,
      hitRate: Number(hit.hitRate.toFixed(4)),
      roll: Number(roll.toFixed(4)),
      deterministicHit: deterministicHit || undefined,
      attackerMartial: Number(hit.attackerMartial.toFixed(2)),
      defenderMartial: Number(hit.defenderMartial.toFixed(2)),
      attackerTacticHitBonus: Number(hit.attackerTacticHitBonus.toFixed(4)),
      defenderEvasionBonus: Number(hit.defenderEvasionBonus.toFixed(4)),
      defenderActionEvasionBonus: Number(hit.defenderActionEvasionBonus.toFixed(4)),
      defenderStatusEvasionBonus: Number(hit.defenderStatusEvasionBonus.toFixed(4)),
      defenderTacticEvasionBonus: Number(hit.defenderTacticEvasionBonus.toFixed(4)),
      blockIgnoreRatio: blockIgnoreRatio ? Number(blockIgnoreRatio.toFixed(4)) : undefined,
      target: damageTarget ? { type: damageTarget.type, id: damageTarget.id || "", name: damageTarget.name || "", intercepted: Boolean(damageTarget.intercepted), selectionMode: damageTarget.selectionMode || "" } : undefined,
      damageApplication: application || undefined,
      damageMitigation: application?.damageMitigation || undefined,
      stabilityShock: Number(stabilityShock.toFixed(4)),
      attackType: profile.attackType || ""
    };
  }

  function isMahoragaTuningRitualAction(action) {
    var text = [
      action?.id,
      action?.actionId,
      action?.cardId,
      action?.label,
      action?.name,
      action?.effectSummary
    ].filter(Boolean).join(" ");
    return /mahoraga_tuning_ritual|魔虚罗调幅仪式|魔须罗调幅仪式|调幅魔须罗仪式|调幅仪式/.test(text)
      && /mahoraga|魔虚罗|魔须罗/.test(text);
  }

  function getDuelCharacterV2RuntimeProfile(profileId) {
    var appState = getOptionalDependency("state") || {};
    var library = appState.duelCharacterV2 || {};
    var profiles = library.builtinRuntimeProfiles || {};
    return cloneDuelPlain(profiles[profileId] || null);
  }

  function mergeUniqueTextList() {
    var values = [];
    for (var index = 0; index < arguments.length; index += 1) {
      var list = Array.isArray(arguments[index]) ? arguments[index] : [];
      values = values.concat(list);
    }
    return Array.from(new Set(values.filter(Boolean).map(String)));
  }

  function getDuelHandInjectionV2Unit(unitId) {
    var appState = getOptionalDependency("state") || {};
    var units = appState.duelHandInjectionsV2?.runtimeUnits || {};
    return cloneDuelPlain(units[unitId] || null);
  }

  function buildRuntimeUnitFromHandInjection(unitId, overrides) {
    var unitStats = getDuelHandInjectionV2Unit(unitId) || {};
    if (!unitStats || typeof unitStats !== "object") unitStats = {};
    var damage = Number(unitStats.damage ?? 0);
    var block = Number(unitStats.block ?? 0);
    var maxHp = Math.max(1, Number(unitStats.maxHp || unitStats.currentHp || 1));
    var merged = {
      ...unitStats,
      maxHp: maxHp,
      currentHp: Math.max(0, Number(unitStats.currentHp || maxHp)),
      damage: damage,
      block: block,
      hp: Math.max(0, Number(unitStats.currentHp || maxHp)),
      damageType: unitStats.damageType || "melee",
      accuracyProfile: unitStats.accuracyProfile || unitStats.attackProfile?.accuracyProfile || "melee",
      evasionAllowed: Boolean(unitStats.evasionAllowed ?? false)
    };
    return {
      ...merged,
      ...(overrides || {}),
      unitStats: {
        ...merged,
        ...((overrides && overrides.unitStats) || {})
      }
    };
  }

  function getDuelHandInjectionV2Template(templateId) {
    var appState = getOptionalDependency("state") || {};
    var templates = appState.duelHandInjectionsV2?.templates || {};
    return cloneDuelPlain(templates[templateId] || null);
  }

  function createMahoragaProxyProfile(sourceProfile, side) {
    var original = sourceProfile || {};
    var template = getDuelCharacterV2RuntimeProfile("mahoragaProxy") || {};
    var name = template.displayName || template.name || "八握剑异戒神将 魔虚罗";
    var originalFlags = Array.isArray(original.flags) ? original.flags : [];
    var originalTags = Array.isArray(original.tags) ? original.tags : [];
    var disruptionUnit = cloneDuelPlain(original.disruptionUnit || {});
    var templateDisruptionUnit = cloneDuelPlain(template.disruptionUnit || {});
    var profileIdPrefix = template.profileIdPrefix || "builtin_mahoraga_proxy";
    return {
      ...original,
      id: profileIdPrefix + "_" + (side || "side"),
      characterId: profileIdPrefix + "_" + (side || "side"),
      name: name,
      displayName: name,
      officialGrade: template.officialGrade || original.officialGrade || "特级式神",
      visibleGrade: template.visibleGrade || original.visibleGrade || "specialGrade",
      grade: template.grade || original.grade || "specialGrade",
      powerTier: template.powerTier || original.powerTier || "specialGrade",
      baseStats: cloneDuelPlain(template.baseStats || original.baseStats || {}),
      raw: cloneDuelPlain(template.raw || original.raw || {}),
      axes: cloneDuelPlain(template.axes || original.axes || {}),
      combatScore: Number(template.combatScore || original.combatScore || 0),
      combatPowerUnit: cloneDuelPlain(template.combatPowerUnit || original.combatPowerUnit || {}),
      disruptionScore: Math.max(Number(template.disruptionScoreMin || 0), Number(original?.disruptionScore || 0)),
      disruptionUnit: {
        ...templateDisruptionUnit,
        ...disruptionUnit,
        label: templateDisruptionUnit.label || disruptionUnit.label || "特级适应压制",
        value: Math.max(Number(template.disruptionUnitValueMin || 0), Number(disruptionUnit.value || 0))
      },
      pool: template.pool || original.pool || "builtin_shikigami",
      flags: mergeUniqueTextList(originalFlags, template.flags),
      tags: mergeUniqueTextList(originalTags, template.tags),
      traits: cloneDuelPlain(template.traits || original.traits || []),
      description: template.description || original.description || ""
    };
  }

  function isUnfinishedTenShadowsDomainTarget(opponent, battle) {
    if (!opponent || !isDomainActive(opponent)) return false;
    var profile = getDuelProfileForSide(battle, opponent.side) || opponent.characterCardProfile || {};
    var domainState = battle?.domainProfileStates?.[opponent.side] || {};
    var text = [
      profile?.id,
      profile?.name,
      profile?.displayName,
      profile?.domainProfile,
      profile?.techniqueText,
      profile?.externalResource,
      domainState?.domainName,
      domainState?.barrierType,
      domainState?.domainCompletion,
      domainState?.effectSummary,
      opponent.domain?.name,
      opponent.domain?.label
    ].filter(Boolean).join(" ");
    return /伏黑惠|megumi|十种影|十影|ten[_\s-]?shadows|嵌合暗翳庭/i.test(text)
      && /未完成|不完全|incomplete|incomplete_barrier|嵌合暗翳庭/i.test(text);
  }

  function applyRecontractUnfinishedTenShadowsResolution(action, actor, opponent, battle, directDamage) {
    var rule = action?.specialResolution?.unfinishedTenShadowsDomainRule;
    if (!rule) return null;
    if (isDomainActive(actor)) return null;
    if (!isUnfinishedTenShadowsDomainTarget(opponent, battle)) return null;
    var multiplier = Number(rule.damageMultiplier || 1);
    var adjustedDamage = Math.max(0, Math.round(Number(directDamage || 0) * (Number.isFinite(multiplier) ? multiplier : 1)));
    return {
      id: "recontract_unfinished_ten_shadows_domain",
      treatedAsSureHit: Boolean(rule.treatedAsSureHit),
      damageBefore: directDamage,
      damageAfter: adjustedDamage,
      damageMultiplier: Number((Number.isFinite(multiplier) ? multiplier : 1).toFixed(3)),
      reason: rule.reason || "unfinished ten shadows domain special resolution"
    };
  }

  function activateMahoragaProxy(action, actor, battle) {
    var side = actor?.side;
    var profileKey = side === "right" ? "right" : "left";
    var profile = battle?.[profileKey] || actor?.characterCardProfile || {};
    if (!side || !actor || !battle) return null;
    battle.mahoragaProxy ||= {};
    if (!battle.mahoragaProxy[side]?.active) {
      battle.mahoragaProxy[side] = {
        active: true,
        side: side,
        startedRound: Number(battle.round || 0) + 1,
        ritualActionId: action?.id || action?.actionId || "mahoraga_tuning_ritual",
        originalProfile: cloneDuelPlain(profile),
        originalResource: cloneDuelPlain(actor),
        attackMemory: {}
      };
    }
    var proxyProfile = createMahoragaProxyProfile(profile, side);
    battle[profileKey] = proxyProfile;
    actor.name = proxyProfile.name;
    actor.maxHp = Math.max(300, Number(actor.maxHp || 0));
    actor.hp = actor.maxHp;
    actor.maxCe = Math.max(220, Number(actor.maxCe || 0));
    actor.ce = Math.min(actor.maxCe, Math.max(0, Number(actor.ce || 0)));
    actor.ceRegen = Math.max(18, Number(actor.ceRegen || 0));
    actor.stability = Math.max(0.92, Number(actor.stability || 0));
    actor.characterCardProfile = proxyProfile;
    actor.combatPowerUnit = proxyProfile.combatPowerUnit;
    actor.baseStats = { ...proxyProfile.baseStats };
    actor.raw = { ...proxyProfile.raw };
    actor.axes = { ...proxyProfile.axes };
    actor.statusEffects = (Array.isArray(actor.statusEffects) ? actor.statusEffects : [])
      .filter(function removeDuplicate(effect) { return effect?.id !== "mahoragaSubstitute"; });
    actor.statusEffects.push(cloneDuelPlain(
      (getDuelCharacterV2RuntimeProfile("mahoragaProxy") || {}).statusEffect
      || { id: "mahoragaSubstitute", label: "魔虚罗代打中", rounds: 999, value: 1 }
    ));
    return {
      active: true,
      side: side,
      name: proxyProfile.name,
      startedRound: Number(battle.round || 0) + 1
    };
  }

  function getMahoragaProxyState(battle, side) {
    var state = battle?.mahoragaProxy?.[side];
    return state?.active ? state : null;
  }

  function getMahoragaAttackKey(action) {
    return String(action?.actionId || action?.cardId || action?.id || action?.label || action?.name || "unknown_action");
  }

  function applyMahoragaAdaptation(action, opponent, battle, directDamage, stabilityShock) {
    var state = getMahoragaProxyState(battle, opponent?.side);
    if (!state || directDamage <= 0) return null;
    var key = getMahoragaAttackKey(action);
    var before = Math.max(0, Number(state.attackMemory?.[key] || 0));
    var maxCount = 4;
    var scale = Math.max(0, (maxCount - before) / maxCount);
    // Try DSL damageModifier for mahoraga adaptation scaling
    var runner = globalThis.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
    var dslScale = scale;
    if (typeof runner === "function") {
      var dslResult = runner("damageModifier", {
        abilities: getBattleSpecialAbilitiesForRuntime(),
        battle: battle, side: opponent?.side || "", actor: opponent, opponent: null,
        action: action, card: action, damage: directDamage,
        turn: getDuelActionTurnNumber(battle)
      });
      if (dslResult?.damage !== undefined) dslScale = Number(dslResult.damage) / Math.max(1, Number(directDamage));
    }
    var adaptedDamage = Math.max(0, Math.round(Number(directDamage || 0) * dslScale));
    var adaptedShock = Math.max(0, Number(stabilityShock || 0) * scale);
    state.attackMemory[key] = Math.min(maxCount, before + 1);
    return {
      actionKey: key,
      actionLabel: action?.label || action?.name || key,
      countBefore: before,
      countAfter: state.attackMemory[key],
      damageScale: Number(dslScale.toFixed(4)),
      originalDamage: directDamage,
      adaptedDamage: adaptedDamage,
      originalStabilityShock: Number((stabilityShock || 0).toFixed(4)),
      adaptedStabilityShock: Number(adaptedShock.toFixed(4))
    };
  }

  function applyDuelMaintenanceAction(action, actor, battle) {
    var spec = action?.maintenanceSpec;
    if (!spec || !actor || !battle) return null;
    var actorSide = actor.side || "";
    var stateId = spec.grantsState || "";
    if (stateId) {
      actor.statusEffects = Array.isArray(actor.statusEffects) ? actor.statusEffects : [];
      var existing = actor.statusEffects.find(function findState(status) {
        return status?.id === stateId;
      });
      if (existing) existing.rounds = Math.max(Number(existing.rounds || 0), 1);
      else actor.statusEffects.push({ id: stateId, label: "影中藏身", rounds: 1, value: 1, actionId: action.id || "" });
    }
    if (spec.apCostMode === "all_remaining_ap" && battle.actionPoints?.[actorSide]) {
      battle.actionPoints[actorSide].spent = Number(battle.actionPoints[actorSide].spent || 0) + Number(battle.actionPoints[actorSide].current || 0);
      battle.actionPoints[actorSide].current = 0;
    }
    return {
      grantsState: stateId,
      skipActiveTurn: Boolean(spec.skipActiveTurn),
      apCostMode: spec.apCostMode || ""
    };
  }


  function handleMahoragaUnitDefeat(battle, defeatedUnit) {
    if (!battle || !defeatedUnit || !battle.mahoragaProxy) return null;
    var unitId = defeatedUnit.id;

    for (var side in battle.mahoragaProxy) {
        var state = battle.mahoragaProxy[side];
        if (!state || !state.active || state.unitId !== unitId) continue;

        var actor = callDependency("getDuelResourcePair", [battle, side]);
        if (!actor) return null;

        // DSL: run summonDefeated entry for mahoraga
        var runner = globalThis.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
        var dslResult = null;
        if (typeof runner === "function") {
          dslResult = runner("summonDefeated", {
            abilities: getBattleSpecialAbilitiesForRuntime(),
            battle: battle,
            side: side,
            actor: actor,
            opponent: callDependency("getDuelResourcePair", [battle, side === "left" ? "right" : "left"]) || {},
            action: { id: defeatedUnit.id, cardId: defeatedUnit.cardId },
            card: { id: defeatedUnit.id, cardId: defeatedUnit.cardId },
            turn: getDuelActionTurnNumber(battle)
          });
        }
        var effect = dslResult?.defeatedEffect || { ownerHpZero: true, deactivateProxy: true, removeStatuses: ["mahoragaSubstitute"] };

        // 移除代打状态（解除 HP 锁定）
        if (effect.removeStatuses && effect.removeStatuses.length) {
          actor.statusEffects = (Array.isArray(actor.statusEffects) ? actor.statusEffects : [])
              .filter(function(e) { return effect.removeStatuses.indexOf(e.id) < 0; });
        }

        // 魔虚罗被击破后召唤者直接落败
        if (effect.ownerHpZero) actor.hp = 0;

        // 关闭魔虚罗代理标记
        if (effect.deactivateProxy) {
          state.active = false;
          state.endedRound = Number(battle.round || 0) + 1;
        }
        battle.actionUiMessage = "魔虚罗代打结束，召唤者体势崩解。";

        callDependency("recordDuelResourceChange", [battle, {
            side: side,
            title: "魔虚罗被击破",
            detail: getDuelResourceSideLabel(side) + "召唤的魔虚罗已被击败，体势崩解。",
            type: "mahoraga_defeat",
            delta: { hp: -1, mahoragaProxyActive: false }
        }]);

        return { side: side, actorName: actor.name || "", hpBefore: 1, hpAfter: actor.hp, defeated: true };
    }
    return null;
  }

  function getDuelTargetSide(resource, fallback) {
    return resource?.side || resource?.ownerSide || resource?.teamSide || fallback || "";
  }

  function getDuelUnitHp(unit) {
    var hp = unit?.hp ?? unit?.currentHp ?? unit?.unitStats?.currentHp ?? unit?.unitStats?.maxHp ?? 0;
    hp = Number(hp || 0);
    return Number.isFinite(hp) ? Math.max(0, hp) : 0;
  }

  function setDuelUnitHp(unit, hp) {
    if (!unit) return;
    var value = Math.max(0, Number(hp || 0));
    unit.hp = value;
    unit.currentHp = value;
    if (unit.unitStats && typeof unit.unitStats === "object") unit.unitStats.currentHp = value;
    if (value <= 0) {
      unit.defeated = true;
      unit.active = false;
    }
  }

  function isDuelUnitAlive(unit) {
    if (!unit || unit.defeated) return false;
    if (unit.active === false && getDuelUnitHp(unit) <= 0) return false;
    return getDuelUnitHp(unit) > 0;
  }

  function getMahoragaProxyUnit(battle, side) {
    var state = battle?.mahoragaProxy?.[side];
    if (!state?.active || !state.unitId) return null;
    return getDuelBattlefieldUnits(battle).find(function findProxyUnit(unit) {
      return unit?.id === state.unitId && isDuelUnitAlive(unit);
    }) || null;
  }

  function isMahoragaProxyProtectingSide(battle, side) {
    return Boolean(getMahoragaProxyUnit(battle, side));
  }

  function protectMahoragaSummonerHp(battle, side) {
    if (!isMahoragaProxyProtectingSide(battle, side)) return false;
    var actor = callDependency("getDuelResourcePair", [battle, side]);
    if (!actor || Number(actor.hp || 0) > 0) return false;
    actor.hp = 1;
    battle.actionUiMessage = "魔虚罗仍在场，召唤者伤害由调幅仪式保护。";
    return true;
  }

  function protectMahoragaSummoners(battle) {
    protectMahoragaSummonerHp(battle, "left");
    protectMahoragaSummonerHp(battle, "right");
  }

  function getDuelUnitTags(unit) {
    var tags = [];
    if (Array.isArray(unit?.tags)) tags = tags.concat(unit.tags);
    if (Array.isArray(unit?.template?.tags)) tags = tags.concat(unit.template.tags);
    if (Array.isArray(unit?.cardTemplate?.tags)) tags = tags.concat(unit.cardTemplate.tags);
    return tags.map(function normalizeTag(tag) { return String(tag || "").toLowerCase(); });
  }

  function isMaximumUzumakiConsumableUnit(unit, side) {
    if (!unit || !side || !isDuelUnitAlive(unit)) return false;
    if ((unit.controllerSide || unit.ownerSide || unit.side || "") !== side) return false;
    if (unit.side === "neutral" || unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
    var text = [
      unit.id,
      unit.cardId,
      unit.actionId,
      unit.name,
      unit.label,
      unit.summonLane,
      unit.zoneLabel
    ].concat(Array.isArray(unit.tags) ? unit.tags : []).join(" ").toLowerCase();
    if (/mahoraga|魔虚罗|魔虛羅|garuda|凰轮/.test(text)) return false;
    return /curse_spirit_manipulation|curse_spirit|cursed_spirit|咒灵操术|咒灵|咒靈|低级咒灵|特级咒灵/.test(text);
  }

  function getMaximumUzumakiCandidateUnits(battle, side, action) {
    if (!battle || !side) return [];
    var spec = action?.maximumUzumakiSpec || {};
    var explicitIds = []
      .concat(Array.isArray(spec.unitIds) ? spec.unitIds : [])
      .concat(Array.isArray(action?.selectedUnitIds) ? action.selectedUnitIds : [])
      .concat(Array.isArray(action?.targetPlan?.selectedUnitIds) ? action.targetPlan.selectedUnitIds : [])
      .map(function normalizeId(id) { return String(id || "").trim(); })
      .filter(Boolean);
    var explicitSet = new Set(explicitIds);
    var currentRound = Number(battle?.round || 0) + 1;
    var requiresPriorRoundUnits = Boolean(spec.requiresPriorRoundUnits);
    var units = getDuelBattlefieldUnits(battle)
      .filter(function keepUnit(unit) {
        if (!isMaximumUzumakiConsumableUnit(unit, side)) return false;
        if (requiresPriorRoundUnits && Number(unit.spawnedRound || 0) > 0 && Number(unit.spawnedRound || 0) >= currentRound) return false;
        if (!explicitSet.size) return true;
        return explicitSet.has(String(unit.id || "")) ||
          explicitSet.has(String(unit.cardId || "")) ||
          explicitSet.has(String(unit.actionId || ""));
      })
      .sort(function byHpThenGuard(left, right) {
        return getDuelUnitHp(right) - getDuelUnitHp(left) || getDuelGuardPriority(right) - getDuelGuardPriority(left);
      });
    var maxUnits = Math.max(0, Number(spec.maxUnits || 0));
    return maxUnits > 0 ? units.slice(0, maxUnits) : units;
  }

  function getMaximumUzumakiCooldownState(battle, side, action) {
    var configured = Math.max(0, Math.round(Number(action?.maximumUzumakiSpec?.cooldownRounds || 0)));
    var lastUsedRound = Math.max(0, Number(battle?.maximumUzumakiState?.[side]?.lastUsedRound || 0));
    var currentRound = Number(battle?.round || 0) + 1;
    var elapsed = lastUsedRound > 0 ? Math.max(0, currentRound - lastUsedRound) : configured + 1;
    return {
      configuredRounds: configured,
      lastUsedRound: lastUsedRound,
      remainingRounds: lastUsedRound > 0 ? Math.max(0, configured - elapsed + 1) : 0
    };
  }

  function markMaximumUzumakiUsed(battle, side, round) {
    if (!battle || !side) return;
    battle.maximumUzumakiState ||= {};
    battle.maximumUzumakiState[side] = { lastUsedRound: Math.max(1, Number(round || 0)) };
  }

  function getMaximumUzumakiRankScore(rank, fallback) {
    var scores = {
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
    };
    var normalized = String(rank || "").trim().toUpperCase();
    return Number(scores[normalized] ?? fallback ?? scores.B);
  }

  function getMaximumUzumakiCePoolScore(actor, battle) {
    var profile = getDuelProfileForSide(battle, actor?.side || "") || actor?.characterCardProfile || actor?.profile || {};
    var raw = actor?.raw || profile.raw || actor?.characterCardProfile?.raw || actor?.profile?.raw || {};
    var direct = Number(raw.cursedEnergyScore ?? profile.cursedEnergyScore ?? actor?.cursedEnergyScore);
    if (Number.isFinite(direct)) return Math.max(0, direct);
    var baseStats = actor?.baseStats || profile.baseStats || actor?.characterCardProfile?.baseStats || actor?.profile?.baseStats || {};
    return getMaximumUzumakiRankScore(
      actor?.cursedEnergy || actor?.cePool || baseStats.cursedEnergy || profile.cursedEnergy || profile.cePool,
      4
    );
  }

  function getMaximumUzumakiDamageMultiplier(action, actor, battle) {
    var spec = action?.maximumUzumakiSpec || {};
    var hpMultiplier = Math.max(0, Number(spec.hpMultiplier ?? 1.5));
    var cePoolScore = getMaximumUzumakiCePoolScore(actor, battle);
    var divisor = Math.max(1, Number(spec.cePoolBonusDivisor || 20));
    var ceMultiplier = spec.cePoolBonus === false ? 1 : (1 + cePoolScore / divisor);
    var minCeMultiplier = Number.isFinite(Number(spec.cePoolBonusMin)) ? Number(spec.cePoolBonusMin) : 1;
    var maxCeMultiplier = Number.isFinite(Number(spec.cePoolBonusMax)) ? Number(spec.cePoolBonusMax) : 1.75;
    ceMultiplier = clamp(ceMultiplier, minCeMultiplier, maxCeMultiplier);
    return {
      hpMultiplier: Number(hpMultiplier.toFixed(4)),
      cePoolScore: Number(cePoolScore.toFixed(4)),
      ceMultiplier: Number(ceMultiplier.toFixed(4)),
      totalMultiplier: Number((hpMultiplier * ceMultiplier).toFixed(4))
    };
  }

  function applyMaximumUzumakiConsumption(action, actor, opponent, battle) {
    var side = actor?.side || "";
    var units = getMaximumUzumakiCandidateUnits(battle, side, action);
    var minUnits = Math.max(1, Math.round(Number(action?.maximumUzumakiSpec?.minUnits || 1)));
    if (units.length < minUnits || getMaximumUzumakiCooldownState(battle, side, action).remainingRounds > 0) return null;
    var round = Number(battle?.round || 0) + 1;
    var consumed = [];
    var totalHp = 0;
    var multiplier = getMaximumUzumakiDamageMultiplier(action, actor, battle);
    var damageFromHp = 0;
    units.forEach(function consumeUnit(unit) {
      var hp = getDuelUnitHp(unit);
      if (hp <= 0) return;
      totalHp += hp;
      consumed.push({
        unitId: unit.id || "",
        cardId: unit.cardId || "",
        actionId: unit.actionId || "",
        name: unit.name || unit.label || unit.cardId || "咒灵",
        hp: Number(hp.toFixed(1))
      });
      unit.maximumUzumakiConsumed = true;
      unit.consumedByActionId = action?.id || action?.actionId || "";
      unit.consumedRound = round;
      unit.defeated = true;
      unit.active = false;
      setDuelUnitHp(unit, 0);
    });
    if (!consumed.length) return null;
    markMaximumUzumakiUsed(battle, side, round);
    var uncappedDamageFromHp = Math.max(0, Math.round(totalHp * multiplier.totalMultiplier));
    var characterMaxHpDamageRatio = Math.max(0, Number(action?.maximumUzumakiSpec?.characterMaxHpDamageRatio ?? 0.75));
    var targetMaxHp = Math.max(0, Number(opponent?.maxHp || opponent?.hp || 0));
    var damageCap = characterMaxHpDamageRatio > 0 && targetMaxHp > 0
      ? Math.max(1, Math.round(targetMaxHp * characterMaxHpDamageRatio))
      : 0;
    damageFromHp = damageCap > 0 ? Math.min(uncappedDamageFromHp, damageCap) : uncappedDamageFromHp;
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: round,
      actorSide: side,
      actionId: action?.id || "",
      cardId: action?.cardId || "",
      reason: "maximum-uzumaki-consume",
      consumed: consumed,
      totalHp: Number(totalHp.toFixed(1)),
      hpMultiplier: multiplier.hpMultiplier,
      cePoolScore: multiplier.cePoolScore,
      ceMultiplier: multiplier.ceMultiplier,
      uncappedDamageFromHp: uncappedDamageFromHp,
      characterMaxHpDamageRatio: characterMaxHpDamageRatio,
      damageCap: damageCap || undefined,
      damageFromHp: damageFromHp
    });
    return {
      consumed: consumed,
      totalHp: Number(totalHp.toFixed(1)),
      consumedCount: consumed.length,
      hpMultiplier: multiplier.hpMultiplier,
      cePoolScore: multiplier.cePoolScore,
      ceMultiplier: multiplier.ceMultiplier,
      damageMultiplier: multiplier.totalMultiplier,
      uncappedDamageFromHp: uncappedDamageFromHp,
      characterMaxHpDamageRatio: characterMaxHpDamageRatio,
      damageCap: damageCap || undefined,
      damageFromHp: damageFromHp
    };
  }

  function getDuelGuardPriority(unit) {
    return Number(unit?.guardPriority ?? unit?.guardRules?.priority ?? unit?.targetingRules?.guardPriority ?? 0);
  }

  function isDuelGuardUnit(unit) {
    var tags = getDuelUnitTags(unit);
    if (unit?.targetingRules?.neverCountsAsGuard || unit?.guardRules?.neverCountsAsGuard) return false;
    if (unit?.unitStats?.control === "neutral_berserk" || unit?.control === "neutral_berserk") return false;
    if (tags.includes("狂暴单位") || tags.includes("berserk")) return false;
    return Boolean(
      unit?.guardRules?.interceptsOpponentAttacks ||
      unit?.guardRules?.protectOwner ||
      unit?.targetingRules?.interceptsOpponentAttacks ||
      unit?.interceptsOpponentAttacks ||
      unit?.protectsOwner ||
      tags.includes("guard") ||
      tags.includes("protector") ||
      tags.includes("守护")
    );
  }

  function getDuelGuardUnitsForSide(battle, defenderSide) {
    return getDuelBattlefieldUnits(battle)
      .filter(function guardForSide(unit) {
        var side = getDuelTargetSide(unit, unit?.side);
        var suppressedThisTurn = (unit?.harutaHandSword || unit?.unitStats?.harutaHandSword) &&
          Number(unit?.harutaSuppressedRound ?? unit?.unitStats?.harutaSuppressedRound ?? 0) === getDuelActionTurnNumber(battle);
        return side === defenderSide && !suppressedThisTurn && isDuelUnitAlive(unit) && isDuelGuardUnit(unit);
      })
      .sort(function byPriority(left, right) {
        return getDuelGuardPriority(right) - getDuelGuardPriority(left) || getDuelUnitHp(right) - getDuelUnitHp(left);
      });
  }

  function canCurseSpiritManipulationGuardIntercept(battle, defenderSide) {
    if (!battle || !defenderSide) return true;
    var turn = getDuelActionTurnNumber(battle);
    var state = battle.curseSpiritGuardInterceptState?.[defenderSide];
    return !state || Number(state.turn || 0) !== turn || Number(state.count || 0) < 1;
  }

  function recordCurseSpiritManipulationGuardIntercept(battle, defenderSide, unit) {
    if (!battle || !defenderSide || !unit) return null;
    var turn = getDuelActionTurnNumber(battle);
    battle.curseSpiritGuardInterceptState ||= {};
    var previous = battle.curseSpiritGuardInterceptState[defenderSide];
    var count = previous && Number(previous.turn || 0) === turn ? Number(previous.count || 0) : 0;
    var next = {
      turn: turn,
      count: count + 1,
      unitId: unit.id || unit.cardId || unit.actionId || "",
      unitName: unit.name || unit.label || "咒灵"
    };
    battle.curseSpiritGuardInterceptState[defenderSide] = next;
    return next;
  }

  function getDuelBattlefieldUnitsForSide(battle, side) {
    return getDuelBattlefieldUnits(battle).filter(function unitForSide(unit) {
      if (!isDuelUnitAlive(unit)) return false;
      if (unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
      return getDuelTargetSide(unit, unit?.side) === side;
    });
  }

  function getDuelSummonUnitThreatScore(unit) {
    var text = [
      unit?.id,
      unit?.cardId,
      unit?.actionId,
      unit?.name,
      unit?.label,
      ...(Array.isArray(unit?.tags) ? unit.tags : []),
      ...(Array.isArray(unit?.unitStats?.tags) ? unit.unitStats.tags : [])
    ].filter(Boolean).join(" ");
    var score = 0;
    score += Math.max(0, Number(unit?.damage ?? unit?.unitStats?.damage ?? 0)) * 1.35;
    score += Math.max(0, Number(unit?.unitStats?.actionsPerRound || unit?.actionsPerRound || 1) - 1) * 55;
    score += Math.max(0, getDuelGuardPriority(unit)) * 3.2;
    score += Math.max(0, Number(unit?.block ?? unit?.unitStats?.block ?? 0)) * 0.28;
    score += Math.min(160, getDuelUnitHp(unit) * 0.18);
    if (isDuelGuardUnit(unit)) score += 520;
    if (/魔虚罗|魔須羅|魔须罗|mahoraga/i.test(text)) score += 360;
    if (/顎吐|颚吐|agito|嵌合兽|嵌合獸/i.test(text)) score += 260;
    if (/虹龙|虹龍|特级|特級|口裂女|玉藻前|咒灵|咒靈|curse/i.test(text)) score += 120;
    return Number(score.toFixed(3));
  }

  function getPreferredDuelSummonAttackUnitTarget(battle, defenderSide, attackerUnit, targetPlan) {
    if (!battle || !defenderSide || targetPlan?.ignoreEnemyUnits === true) return null;
    var units = getDuelBattlefieldUnitsForSide(battle, defenderSide).filter(function keepEnemyUnit(unit) {
      return unit?.id !== attackerUnit?.id;
    });
    if (!units.length) return null;
    var explicitMode = String(targetPlan?.summonUnitTargetMode || targetPlan?.unitTargetMode || "auto").toLowerCase();
    if (explicitMode === "character_only") return null;
    units.sort(function bySummonTargetPriority(left, right) {
      return getDuelSummonUnitThreatScore(right) - getDuelSummonUnitThreatScore(left) ||
        getDuelUnitHp(left) - getDuelUnitHp(right);
    });
    var target = units[0];
    if (!target) return null;
    return {
      type: "unit",
      unit: target,
      id: target.id || target.cardId || target.actionId || "",
      name: target.name || target.label || target.cardName || "敌方式神",
      side: defenderSide,
      explicit: true,
      intercepted: false,
      selectionMode: isDuelGuardUnit(target) ? "summon_unit_vs_guard" : "summon_unit_duel"
    };
  }

  function findDuelBattlefieldTargetById(battle, targetId, defender) {
    if (!targetId) return null;
    var normalized = String(targetId);
    var unit = getDuelBattlefieldUnits(battle).find(function matchUnit(candidate) {
      return String(candidate?.id || candidate?.cardId || candidate?.actionId || "") === normalized;
    });
    if (unit && isDuelUnitAlive(unit)) return { type: "unit", unit: unit, id: unit.id || unit.cardId || normalized, name: unit.name || unit.label || unit.cardName || normalized, side: getDuelTargetSide(unit, defender?.side) };
    if (String(defender?.id || defender?.side || "") === normalized) return { type: "character", resource: defender, id: defender.id || defender.side || normalized, name: defender.name || defender.label || defender.side || normalized, side: defender.side || "" };
    return null;
  }

  function resolveDuelDamageTarget(action, actor, opponent, battle, options) {
    var targetPlan = action?.targetPlan || action?.targetingPlan || {};
    var defenderSide = targetPlan.primaryTargetSide || targetPlan.targetSide || opponent?.side || "";
    if (isDuelWorldSlashAction(action)) {
      return { type: "character", resource: opponent, id: opponent?.id || opponent?.side || defenderSide, name: opponent?.name || opponent?.label || defenderSide, side: defenderSide, explicit: false, intercepted: false, selectionMode: "world_slash_character" };
    }
    if (opponent && battle) {
      var oppSide = opponent.side || "";
      if (getMahoragaProxyState(battle, oppSide)) {
        var unit = getDuelBattlefieldUnits(battle).find(function(u) {
          return u.id === battle.mahoragaProxy[oppSide].unitId && u.active;
        });
        if (unit) {
          return {
            type: "unit",
            unit: unit,
            id: unit.id,
            name: unit.name,
            side: "neutral",
            explicit: false,
            intercepted: true,
            selectionMode: "mahoraga_proxy_guard",
            isMahoragaProxy: true
          };
        }
      }
    }
    var explicitTarget = findDuelBattlefieldTargetById(battle, targetPlan.primaryTargetId || targetPlan.explicitTargetId || targetPlan.targetId, opponent);
    if (explicitTarget) return { ...explicitTarget, explicit: true, intercepted: false, selectionMode: targetPlan.selectionMode || "explicit" };
    if (options?.damage > 0 && targetPlan.allowUnitInterception !== false && !action?.effects?.bypassGuard && !action?.bypassGuard) {
      var guardUnit = getDuelGuardUnitsForSide(battle, defenderSide).find(function findAvailableGuard(unit) {
        return !isMaximumUzumakiConsumableUnit(unit, defenderSide) || canCurseSpiritManipulationGuardIntercept(battle, defenderSide);
      });
      if (guardUnit) {
        var curseSpiritGuardState = isMaximumUzumakiConsumableUnit(guardUnit, defenderSide)
          ? recordCurseSpiritManipulationGuardIntercept(battle, defenderSide, guardUnit)
          : null;
        return {
          type: "unit",
          unit: guardUnit,
          id: guardUnit.id || guardUnit.cardId || guardUnit.actionId || "",
          name: guardUnit.name || guardUnit.label || guardUnit.cardName || "守护单位",
          side: defenderSide,
          explicit: false,
          intercepted: true,
          selectionMode: "guard_priority",
          curseSpiritGuardState: curseSpiritGuardState
        };
      }
    }
    return { type: "character", resource: opponent, id: opponent?.id || opponent?.side || defenderSide, name: opponent?.name || opponent?.label || defenderSide, side: defenderSide, explicit: false, intercepted: false, selectionMode: targetPlan.selectionMode || "opponent_character" };
  }

  function applyDuelHpDamageToTarget(target, amount, battle, options) {
    var damage = Math.max(0, Number(amount || 0));
    if (!target || damage <= 0) return { applied: 0, overkill: 0, defeated: false, targetType: target?.type || "" };
    var targetResource = target.type === "character" ? target.resource : null;
    var incomingActor = options?.actor || null;
    if (targetResource && incomingActor) {
      var beforeDamageOptions = { source: options?.source || "hp-damage", amount: damage };
      dispatchCustomAtomicTrigger("before-receive-damage", targetResource, incomingActor, battle, beforeDamageOptions);
      damage = Math.max(0, Number(beforeDamageOptions.amount ?? damage));
    }
    if (target.type === "unit") {
      var beforeHp = getDuelUnitHp(target.unit);
      var unitEvasion = resolveDuelUnitFixedEvasion(target.unit, battle, target, options);
      if (unitEvasion.evaded) {
        return {
          targetType: "unit",
          targetId: target.id || "",
          targetName: target.name || "",
          applied: 0,
          blocked: 0,
          beforeHp: Number(beforeHp.toFixed(1)),
          afterHp: Number(beforeHp.toFixed(1)),
          overkill: 0,
          defeated: false,
          evaded: true,
          evasion: unitEvasion
        };
      }
      var unitBlock = Math.max(0, Number(target.unit?.block ?? target.unit?.unitStats?.block ?? 0) || 0);
      var blockIgnoreRatio = options?.ignoreTargetDefense === true ? 1 : Math.max(0, Math.min(0.9, Number(options?.blockIgnoreRatio || 0)));
      var effectiveBlock = Math.max(0, unitBlock * (1 - blockIgnoreRatio));
      var unitDamageReductionRatio = Math.max(0, Math.min(0.9, Number(target.unit?.damageReductionRatio ?? target.unit?.unitStats?.damageReductionRatio ?? 0)));
      var effectiveDamage = Math.max(0, damage - effectiveBlock);
      if (unitDamageReductionRatio > 0) effectiveDamage *= (1 - unitDamageReductionRatio);
      var appliedToUnit = Math.min(beforeHp, effectiveDamage);
      var afterHp = Math.max(0, beforeHp - appliedToUnit);
      setDuelUnitHp(target.unit, afterHp);
      var result = {
        targetType: "unit",
        targetId: target.id || "",
        targetName: target.name || "",
        applied: Number(appliedToUnit.toFixed(1)),
        blocked: Number(Math.min(damage, effectiveBlock).toFixed(1)),
        reduced: unitDamageReductionRatio ? Number(Math.max(0, damage - effectiveBlock - effectiveDamage).toFixed(1)) : undefined,
        blockIgnored: Number(Math.max(0, unitBlock - effectiveBlock).toFixed(1)),
        blockIgnoreRatio: blockIgnoreRatio ? Number(blockIgnoreRatio.toFixed(4)) : undefined,
        beforeHp: Number(beforeHp.toFixed(1)),
        afterHp: Number(afterHp.toFixed(1)),
        overkill: Number(Math.max(0, effectiveDamage - appliedToUnit).toFixed(1)),
        defeated: beforeHp > 0 && afterHp <= 0
      };
      // 若魔虚罗单位被击败，触发召唤者体势归零
      if (result.defeated && battle) {
        handleMahoragaUnitDefeat(battle, target.unit);
        var summonOwner = getDuelResourcePair(battle, target.unit.ownerSide || target.unit.side || "left");
        var summonOpponent = getDuelResourcePair(battle, (target.unit.ownerSide || target.unit.side || "left") === "left" ? "right" : "left");
        dispatchCustomAtomicTrigger("summon-defeated", summonOwner, summonOpponent, battle, { summon: target.unit, source: options?.source || "damage" });
      }
      if (result.applied > 0 && target.unit?.statusEffects) target.unit.statusEffects = target.unit.statusEffects.filter(function keepAfterHitStatus(status) { return status?.removeOnReceiveDamage !== true; });
      return result;
    }
    var beforeCharacterHp = Number(target.resource?.hp || 0);
    var shieldAbsorbed = 0;
    var teamBarriers = getCustomAtomicState(battle)?.barriers?.[String(target.side || target.resource?.side || "")] || [];
    teamBarriers.forEach(function absorbTeamBarrier(barrier) {
      if (damage <= 0 || barrier.scope !== "all-allies" || Number(barrier.value || 0) <= 0) return;
      var absorbed = Math.min(damage, Number(barrier.value || 0));
      barrier.value = Number(Math.max(0, Number(barrier.value || 0) - absorbed).toFixed(1));
      damage = Math.max(0, damage - absorbed);
      shieldAbsorbed += absorbed;
      if (barrier.value <= 0) {
        var triggerState = getCustomAtomicState(battle);
        triggerState.triggerEffects["shield-broken"].push({ effect: { id: barrier.breakEventId, tool: "emit_battle_event", trigger: "shield-broken", target: "self", when: [], params: { eventId: barrier.breakEventId, label: "护盾破裂" } }, ownerSide: barrier.ownerSide });
        var ownerResource = getDuelResourcePair(battle, barrier.ownerSide);
        var otherResource = getDuelResourcePair(battle, barrier.ownerSide === "left" ? "right" : "left");
        dispatchCustomAtomicTrigger("shield-broken", ownerResource, otherResource, battle, { source: "barrier" });
      }
    });
    var shieldStatuses = (target.resource?.statusEffects || []).filter(function findAbsorptionShield(effect) {
      return (effect?.id === "projectionFrameShield" || effect?.duelShield === true) && Number(effect.value || 0) > 0;
    });
    shieldStatuses.forEach(function absorbWithShield(shieldStatus) {
      if (damage <= 0) return;
      var absorbed = Math.min(damage, Math.max(0, Number(shieldStatus.value || 0)));
      shieldStatus.value = Number(Math.max(0, Number(shieldStatus.value || 0) - absorbed).toFixed(1));
      damage = Math.max(0, damage - absorbed);
      shieldAbsorbed += absorbed;
    });
    var dounaShield = (target.resource?.statusEffects || []).find(function findDounaShield(effect) {
      return effect?.id === "dounaLowHpSlashShield" && Number(effect.remainingReduction || 0) > 0;
    });
    if (dounaShield) {
      var prevented = Math.min(Math.max(0, Number(dounaShield.remainingReduction || 0)), damage * 0.2);
      dounaShield.remainingReduction = Number(Math.max(0, Number(dounaShield.remainingReduction || 0) - prevented).toFixed(1));
      if (Number(dounaShield.remainingReduction || 0) <= 0) dounaShield.rounds = 0;
      damage = Math.max(0, damage - prevented);
      shieldAbsorbed += prevented;
    }
    var shibuyaDamageBudget = typeof global.JJKShibuyaIncident?.applyShibuyaBossDamageBudget === "function"
      ? global.JJKShibuyaIncident.applyShibuyaBossDamageBudget(damage, target.resource, battle, {
        targetSide: target.side || target.resource?.side || "",
        source: options?.source || "hp-damage"
      })
      : null;
    if (shibuyaDamageBudget?.applied || shibuyaDamageBudget?.preventInstantKill) {
      damage = Math.max(0, Number(shibuyaDamageBudget.damage || 0));
    }
    target.resource.hp = Math.max(0, beforeCharacterHp - damage);
    var miraclePrevention = applyDuelMiracleLethalPrevention(target.resource, battle, {
      side: target.side || target.resource?.side || "",
      beforeHp: beforeCharacterHp,
      damage: damage,
      source: options?.source || "hp-damage"
    });
    var afterCharacterHp = Number(target.resource.hp || 0);
    var appliedCharacterDamage = Math.max(0, beforeCharacterHp - afterCharacterHp);
    var overkillCharacterDamage = miraclePrevention
      ? Math.max(0, Number(miraclePrevention.preventedLethalDamage || 0))
      : Math.max(0, damage - beforeCharacterHp);
    if (appliedCharacterDamage > 0 && target.resource?.statusEffects) target.resource.statusEffects = target.resource.statusEffects.filter(function keepAfterHitStatus(status) { return status?.removeOnReceiveDamage !== true; });
    if (targetResource && incomingActor) dispatchCustomAtomicTrigger("after-receive-damage", targetResource, incomingActor, battle, { source: options?.source || "hp-damage", amount: appliedCharacterDamage });
    return {
      targetType: "character",
      targetId: target.id || "",
      targetName: target.name || "",
      applied: Number(appliedCharacterDamage.toFixed(1)),
      shieldAbsorbed: shieldAbsorbed ? Number(shieldAbsorbed.toFixed(1)) : undefined,
      beforeHp: Number(beforeCharacterHp.toFixed(1)),
      afterHp: Number(afterCharacterHp.toFixed(1)),
      overkill: Number(overkillCharacterDamage.toFixed(1)),
      defeated: beforeCharacterHp > 0 && afterCharacterHp <= 0,
      miraclePrevention: miraclePrevention || undefined,
      activityDamageBudget: shibuyaDamageBudget?.applied ? shibuyaDamageBudget : undefined
    };
  }

  function getDuelStandardPanelMitigation(amount, resource, blockIgnoreRatio) {
    var resolver = global.JJKBattleDataDirect?.calculateBattleTargetMitigation;
    if (typeof resolver === "function") {
      return resolver(amount, resource, { defensePenetrationRatio: blockIgnoreRatio });
    }
    // Runtime fallback for isolated legacy harnesses. These values mirror the
    // canonical direct-card defaults and keep all non-card damage defensive.
    var rankDelta = {
      "E-": -5,
      E: -4.2,
      D: -3.4,
      C: -2.6,
      B: -1.8,
      A: -0.9,
      S: 0,
      SS: 1.15,
      SSS: 2.35,
      "EX-": 3.55,
      EX: 4.75
    };
    var profile = resource?.characterCardProfile || resource?.profile || resource || {};
    var rank = String(profile?.baseStats?.body ?? profile?.stats?.body ?? profile?.body ?? "S").trim().toUpperCase();
    var bodyDelta = Number(rankDelta[rank] ?? 0);
    var rawResistance = clamp(0.14 + bodyDelta * 0.07, 0.04, 0.62);
    var penetration = clamp(Number(blockIgnoreRatio || 0), 0, 0.9);
    var resistance = rawResistance * (1 - penetration);
    var incoming = Math.max(0, Number(amount || 0));
    var prevented = Math.max(0, incoming * resistance);
    return {
      damage: Number(Math.max(0, incoming - prevented).toFixed(3)),
      mitigation: {
        damageBeforeTargetDefense: Number(incoming.toFixed(3)),
        targetBodyDelta: bodyDelta,
        rawBodyResistanceRatio: Number(rawResistance.toFixed(4)),
        bodyResistanceRatio: Number(resistance.toFixed(4)),
        defensePenetrationRatio: Number(penetration.toFixed(4)),
        bodyResistancePrevented: Number(prevented.toFixed(3)),
        panelPrevented: Number(prevented.toFixed(3))
      }
    };
  }

  function recordDuelStandardDamageMitigation(battle, target, application, options) {
    var mitigation = application?.damageMitigation;
    var logger = getOptionalDependency("recordDuelResourceChange");
    if (!battle || typeof logger !== "function" || Number(mitigation?.totalPrevented || 0) <= 0) return;
    var targetSide = target?.side || target?.resource?.side || options?.opponent?.side || "";
    var targetName = target?.name || target?.resource?.name || target?.unit?.name || options?.opponent?.name || "目标";
    var sourceLabel = String(options?.sourceLabel || options?.action?.label || options?.action?.name || "本次伤害");
    var breakdown = [];
    if (Number(mitigation.panelDefensePrevented || 0) > 0) breakdown.push("面板抗性 " + Number(mitigation.panelDefensePrevented).toFixed(1));
    if (Number(mitigation.scalePrevented || 0) > 0) breakdown.push("减伤 " + Number(mitigation.scalePrevented).toFixed(1));
    if (Number(mitigation.inversePrevented || 0) > 0) breakdown.push("反比例反转 " + Number(mitigation.inversePrevented).toFixed(1));
    if (Number(mitigation.inverseAmplified || 0) > 0) breakdown.push("反比例放大 +" + Number(mitigation.inverseAmplified).toFixed(1));
    if (Number(mitigation.blocked || 0) > 0) breakdown.push("格挡 " + Number(mitigation.blocked).toFixed(1));
    if (Number(mitigation.reduced || 0) > 0) breakdown.push("单位减伤 " + Number(mitigation.reduced).toFixed(1));
    if (Number(mitigation.shieldAbsorbed || 0) > 0) breakdown.push("护盾 " + Number(mitigation.shieldAbsorbed).toFixed(1));
    logger(battle, {
      side: targetSide,
      title: "防御结算",
      detail: targetName + "面对「" + sourceLabel + "」时抵消 " + Number(mitigation.totalPrevented).toFixed(1) + " 点伤害" + (breakdown.length ? "（" + breakdown.join("、") + "）" : "") + "，实际承受 " + Number(application.applied || 0).toFixed(1) + " 点。",
      type: "resource",
      delta: {
        sourceKind: options?.sourceKind || "standard",
        incomingDamage: Number(mitigation.incomingBeforeDefense || 0),
        panelPrevented: Number(mitigation.panelDefensePrevented || 0),
        scalePrevented: Number(mitigation.scalePrevented || 0),
        inversePrevented: Number(mitigation.inversePrevented || 0),
        inverseAmplified: Number(mitigation.inverseAmplified || 0),
        blocked: Number(mitigation.blocked || 0),
        reduced: Number(mitigation.reduced || 0),
        shieldAbsorbed: Number(mitigation.shieldAbsorbed || 0),
        totalPrevented: Number(mitigation.totalPrevented || 0),
        appliedDamage: Number(application.applied || 0)
      }
    });
  }

  /**
   * Canonical packet settlement for damage sources outside direct cards.
   * Summons, domain scripts and delayed effects all pass through the same
   * attacker buffs, body resistance, committed defense, tactics and shields.
   */
  function getDuelRoundDamageScale(battle) {
    var round = Math.max(1, Math.floor(Number(battle?.round || 1)));
    return Math.min(2, 1 + Math.max(0, round - 7) * 0.1);
  }

  function applyDuelStandardDamageToTarget(target, amount, battle, options) {
    options ||= {};
    var rawDamage = Math.max(0, Number(amount || 0));
    if (!target || rawDamage <= 0) return { applied: 0, overkill: 0, defeated: false, targetType: target?.type || "" };
    var actor = options.actor || null;
    var defender = target.type === "character" ? target.resource : (options.opponent || null);
    var action = options.action || {
      id: String(options.sourceKind || "standard") + "_damage",
      label: options.sourceLabel || "独立伤害",
      cardType: options.sourceKind === "domain" ? "domain" : "special"
    };
    var sourceKind = String(options.sourceKind || "standard");
    var blockIgnoreRatio = clamp(Number(options.blockIgnoreRatio || 0), 0, 0.9);
    var contexts = ensureDuelActionContext(battle);
    var actorContext = actor?.side ? (contexts?.[actor.side] || createEmptyDuelActionContext()) : createEmptyDuelActionContext();
    var defenderContext = defender?.side ? (contexts?.[defender.side] || createEmptyDuelActionContext()) : createEmptyDuelActionContext();
    var applyAttackerScales = options.applyAttackerScales !== false && Boolean(actor);
    var pendingOutgoingScale = applyAttackerScales && options.applyActorContextScale !== false
      ? Math.max(0, Number(actorContext.outgoingScale || 1))
      : 1;
    var activeStatusOutgoingScale = applyAttackerScales && options.applyActiveStatusOutgoingScale !== false
      ? Math.max(0, Number(getActiveDuelOutgoingStatusScale(actor, battle) ?? 1))
      : 1;
    var tacticActionModifiers = applyAttackerScales && options.applyTacticOffense !== false
      ? getDuelTacticActionModifiers(action, actor, defender, battle)
      : { damageScale: 1 };
    var tacticDamageScale = Math.max(0, Number(tacticActionModifiers.damageScale || 1));
    var domainStateScale = 1;
    if (actor && defender && options.applyDomainStateScale !== false) {
      if (actor?.domain?.active && !defender?.domain?.active) {
        domainStateScale = battle?.dounaGauntlet ? Math.max(1.5, UNOPPOSED_DOMAIN_DAMAGE_SCALE) : UNOPPOSED_DOMAIN_DAMAGE_SCALE;
      } else if (defender?.domain?.active && !actor?.domain?.active) {
        domainStateScale = battle?.dounaGauntlet ? 0.5 : 0.75;
      }
    }
    var roundDamageScale = getDuelRoundDamageScale(battle);
    var damageBeforePanel = Math.max(0, rawDamage * pendingOutgoingScale * activeStatusOutgoingScale * tacticDamageScale * domainStateScale * roundDamageScale);
    var panel = target.type === "character" && options.applyPanelDefense !== false
      ? getDuelStandardPanelMitigation(damageBeforePanel, defender, blockIgnoreRatio)
      : { damage: damageBeforePanel, mitigation: { panelPrevented: 0, bodyResistancePrevented: 0, rawBodyResistanceRatio: 0, bodyResistanceRatio: 0, defensePenetrationRatio: blockIgnoreRatio } };
    var damageAfterPanel = Math.max(0, Number(panel.damage || 0));
    var defenderCardBlockScale = clamp(Number(defenderContext.cardBlockIncomingHpScale ?? 1), 0.15, 1);
    var effectiveDefenderCardBlockScale = 1 - (1 - defenderCardBlockScale) * (1 - blockIgnoreRatio);
    var activeIncomingStatusScale = defender ? Math.max(0, Number(getActiveDuelIncomingHpStatusScale(defender, battle) ?? 1)) : 1;
    var tacticDefenseModifiers = defender && options.applyDefenderScales !== false
      ? getDuelTacticDefenseModifiers(defender, battle)
      : { incomingDamageScale: 1 };
    var tacticDefenseScale = Math.max(0, Number(tacticDefenseModifiers.incomingDamageScale ?? 1));
    var sureHitDefenseScale = sourceKind === "domain" && options.applySureHitScale !== false
      ? Math.max(0, Number(defenderContext.sureHitScale ?? 1))
      : 1;
    var additionalDefenderScale = Math.max(0, Number(options.additionalDefenderScale ?? 1));
    var defenderIncomingScale = options.applyDefenderScales === false
      ? 1
      : Math.max(0, Number(defenderContext.incomingHpScale ?? 1)) * effectiveDefenderCardBlockScale * activeIncomingStatusScale * tacticDefenseScale * sureHitDefenseScale * additionalDefenderScale;
    var dounaDefenseValue = defender ? Math.max(0, Number(getDuelStatusEffectValue(defender, "dounaSukunaDefense") || 0)) : 0;
    if (dounaDefenseValue > 0 && options.applyDefenderScales !== false) {
      var dounaDefenseEffectiveValue = defender?.domain?.active ? dounaDefenseValue * 0.42 : dounaDefenseValue;
      defenderIncomingScale *= Math.max(0.08, 1 / (1 + dounaDefenseEffectiveValue));
    }
    var defenderIncomingHpReductionCap = options.applyDefenderScales === false ? 0 : Math.max(0, Number(defenderContext.incomingHpReductionCap || 0));
    var uncappedDamage = Math.max(0, damageAfterPanel * defenderIncomingScale);
    var preventedByDefenderScale = Math.max(0, damageAfterPanel - uncappedDamage);
    var cappedPrevention = defenderIncomingHpReductionCap > 0
      ? Math.min(preventedByDefenderScale, defenderIncomingHpReductionCap)
      : preventedByDefenderScale;
    var damageAfterDefenderScale = defenderIncomingHpReductionCap > 0
      ? Math.max(0, damageAfterPanel - cappedPrevention)
      : uncappedDamage;
    if (defenderIncomingHpReductionCap > 0 && defender?.side) {
      defenderContext.incomingHpReductionCap = Math.max(0, defenderIncomingHpReductionCap - cappedPrevention);
    }
    damageAfterDefenderScale = Number(Math.max(0, damageAfterDefenderScale).toFixed(1));
    var damageBeforeInverseCurve = damageAfterDefenderScale;
    var inverseDamageCurve = target.type === "character"
      ? resolveDuelInverseDamageCurve(damageBeforeInverseCurve, defender, battle, {
          action: action,
          sourceKind: sourceKind
        })
      : null;
    var damageAfterInverseCurve = inverseDamageCurve?.applied
      ? Number(inverseDamageCurve.damageAfter || 0)
      : damageBeforeInverseCurve;
    var application = applyDuelHpDamageToTarget(target, damageAfterInverseCurve, battle, {
      actor: actor,
      opponent: defender,
      blockIgnoreRatio: blockIgnoreRatio,
      source: options.source || sourceKind + "-damage"
    });
    if (inverseDamageCurve?.applied) application.inverseDamageCurve = inverseDamageCurve;
    var panelPrevented = Math.max(0, Number(panel.mitigation?.panelPrevented || panel.mitigation?.bodyResistancePrevented || 0));
    var scalePrevented = Math.max(0, Number(damageAfterPanel - damageBeforeInverseCurve));
    var inversePrevented = Math.max(0, Number(inverseDamageCurve?.prevented || 0));
    var inverseAmplified = Math.max(0, Number(inverseDamageCurve?.amplified || 0));
    var blocked = Math.max(0, Number(application?.blocked || 0));
    var reduced = Math.max(0, Number(application?.reduced || 0));
    var shieldAbsorbed = Math.max(0, Number(application?.shieldAbsorbed || 0));
    var targetPrevented = blocked + reduced + shieldAbsorbed;
    var totalPrevented = panelPrevented + scalePrevented + inversePrevented + targetPrevented;
    application.damageMitigation = {
      targetSide: target?.side || defender?.side || "",
      targetType: target?.type || application?.targetType || "",
      targetId: target?.id || application?.targetId || "",
      targetName: target?.name || application?.targetName || defender?.name || "",
      incomingBeforeDefense: Number(damageBeforePanel.toFixed(1)),
      afterPanelDefense: Number(damageAfterPanel.toFixed(1)),
      afterScaleDefense: Number(damageBeforeInverseCurve.toFixed(1)),
      afterInverseDamageCurve: Number(damageAfterInverseCurve.toFixed(1)),
      panelDefensePrevented: Number(panelPrevented.toFixed(1)),
      scalePrevented: Number(scalePrevented.toFixed(1)),
      inversePrevented: Number(inversePrevented.toFixed(1)),
      inverseAmplified: Number(inverseAmplified.toFixed(1)),
      blocked: Number(blocked.toFixed(1)),
      reduced: Number(reduced.toFixed(1)),
      shieldAbsorbed: Number(shieldAbsorbed.toFixed(1)),
      targetPrevented: Number(targetPrevented.toFixed(1)),
      totalPrevented: Number(totalPrevented.toFixed(1)),
      bodyResistanceRatio: Number(panel.mitigation?.bodyResistanceRatio || 0),
      defensePenetrationRatio: Number(panel.mitigation?.defensePenetrationRatio || blockIgnoreRatio || 0),
      defenderCardBlockScale: Number(defenderCardBlockScale.toFixed(4)),
      effectiveDefenderCardBlockScale: Number(effectiveDefenderCardBlockScale.toFixed(4)),
      defenderIncomingScale: Number(defenderIncomingScale.toFixed(4)),
      pendingOutgoingScale: Number(pendingOutgoingScale.toFixed(4)),
      activeStatusOutgoingScale: Number(activeStatusOutgoingScale.toFixed(4)),
      tacticDamageScale: Number(tacticDamageScale.toFixed(4)),
      domainStateScale: Number(domainStateScale.toFixed(4)),
      sureHitDefenseScale: Number(sureHitDefenseScale.toFixed(4)),
      additionalDefenderScale: Number(additionalDefenderScale.toFixed(4)),
      cappedIncomingHpReduction: defenderIncomingHpReductionCap > 0 ? Number(cappedPrevention.toFixed(1)) : undefined
    };
    recordDuelStandardDamageMitigation(battle, target, application, { ...options, action: action, sourceKind: sourceKind, opponent: defender });
    return application;
  }

  function applyDuelHpHealingToTarget(target, amount, battle) {
    var healing = Math.max(0, Number(amount || 0));
    if (!target || healing <= 0) return { applied: 0, targetType: target?.type || "" };
    if (target.type === "unit") {
      var beforeUnitHp = getDuelUnitHp(target.unit);
      var maxUnitHp = Math.max(beforeUnitHp, Number(target.unit?.maxHp ?? target.unit?.unitStats?.maxHp ?? beforeUnitHp));
      var afterUnitHp = Math.min(maxUnitHp, beforeUnitHp + healing);
      setDuelUnitHp(target.unit, afterUnitHp);
      return {
        targetType: "unit",
        targetId: target.id || "",
        targetName: target.name || "",
        applied: Number(Math.max(0, afterUnitHp - beforeUnitHp).toFixed(1)),
        beforeHp: Number(beforeUnitHp.toFixed(1)),
        afterHp: Number(afterUnitHp.toFixed(1))
      };
    }
    var resource = target.resource;
    var beforeHp = Number(resource?.hp || 0);
    var cap = getDuelActionTemporaryResourceCap(resource, "hp", "maxHp", "temporaryHpOverCap");
    resource.hp = Number(clamp(beforeHp + healing, 0, cap).toFixed(1));
    return {
      targetType: "character",
      targetId: target.id || "",
      targetName: target.name || "",
      applied: Number(Math.max(0, Number(resource.hp || 0) - beforeHp).toFixed(1)),
      beforeHp: Number(beforeHp.toFixed(1)),
      afterHp: Number(Number(resource.hp || 0).toFixed(1))
    };
  }

  function applyDuelInstantKillToTarget(target, battle, reason) {
    if (!target) return { applied: 0, targetType: "" };
    if (target.type === "unit") {
      var beforeUnitHp = getDuelUnitHp(target.unit);
      setDuelUnitHp(target.unit, 0);
      if (beforeUnitHp > 0 && battle) handleMahoragaUnitDefeat(battle, target.unit);
      return {
        targetType: "unit",
        targetId: target.id || "",
        targetName: target.name || "",
        applied: Number(beforeUnitHp.toFixed(1)),
        beforeHp: Number(beforeUnitHp.toFixed(1)),
        afterHp: 0,
        overkill: 0,
        defeated: beforeUnitHp > 0,
        instantKill: true,
        reason: reason || "instant_kill"
      };
    }
    var beforeHp = Number(target.resource?.hp || 0);
    var shibuyaInstantBudget = typeof global.JJKShibuyaIncident?.applyShibuyaBossDamageBudget === "function"
      ? global.JJKShibuyaIncident.applyShibuyaBossDamageBudget(beforeHp, target.resource, battle, {
        targetSide: target.side || target.resource?.side || "",
        source: reason || "instant-kill"
      })
      : null;
    target.resource.hp = shibuyaInstantBudget?.preventInstantKill
      ? beforeHp - Math.max(0, Number(shibuyaInstantBudget.damage || 0))
      : 0;
    var miraclePrevention = applyDuelMiracleLethalPrevention(target.resource, battle, {
      side: target.side || target.resource?.side || "",
      beforeHp: beforeHp,
      damage: beforeHp,
      source: reason || "instant-kill"
    });
    var afterHp = Number(target.resource?.hp || 0);
    return {
      targetType: "character",
      targetId: target.id || "",
      targetName: target.name || "",
      applied: Number(Math.max(0, beforeHp - afterHp).toFixed(1)),
      beforeHp: Number(beforeHp.toFixed(1)),
      afterHp: Number(afterHp.toFixed(1)),
      overkill: miraclePrevention ? Number(miraclePrevention.preventedLethalDamage.toFixed(1)) : 0,
      defeated: beforeHp > 0 && afterHp <= 0,
      instantKill: !miraclePrevention && !shibuyaInstantBudget?.preventInstantKill,
      instantKillAttempted: true,
      miraclePrevention: miraclePrevention || undefined,
      activityDamageBudget: shibuyaInstantBudget?.applied ? shibuyaInstantBudget : undefined,
      reason: reason || "instant_kill"
    };
  }

  function hasDuelMissingHp(resource) {
    var hp = Number(resource?.hp || 0);
    var maxHp = Number(resource?.maxHp || 0);
    return Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp < maxHp - 0.5;
  }

  function getReverseCursedTechniqueOutputEnemyCurseUnit(opponent, battle) {
    var opponentSide = opponent?.side || "";
    if (!battle || !opponentSide) return null;
    return getDuelBattlefieldUnitsForSide(battle, opponentSide)
      .filter(function keepCurseUnit(unit) {
        return isDuelCursedSpiritTarget(unit) && !isRctOutputInstantKillImmuneTarget(unit);
      })
      .sort(function byThreat(left, right) {
        return getDuelSummonUnitThreatScore(right) - getDuelSummonUnitThreatScore(left) || getDuelUnitHp(right) - getDuelUnitHp(left);
      })[0] || null;
  }

  function getReverseCursedTechniqueOutputFriendlyHealTargets(actor, battle) {
    var actorSide = actor?.side || "";
    if (!actorSide) return [];
    var targets = [];
    if (hasDuelMissingHp(actor)) {
      targets.push({
        type: "character",
        resource: actor,
        id: actor?.id || actorSide,
        name: actor?.name || actor?.label || actorSide,
        side: actorSide,
        hpRatio: Number(actor?.hp || 0) / Math.max(1, Number(actor?.maxHp || 1))
      });
    }
    getDuelBattlefieldUnitsForSide(battle, actorSide).forEach(function collectInjuredFriendlyUnit(unit) {
      if (!hasDuelMissingHp(unit)) return;
      targets.push({
        type: "unit",
        unit: unit,
        id: unit.id || unit.cardId || unit.actionId || "",
        name: unit.name || unit.label || unit.cardName || "友方召唤物",
        side: actorSide,
        hpRatio: getDuelUnitHp(unit) / Math.max(1, Number((unit?.maxHp ?? unit?.unitStats?.maxHp ?? getDuelUnitHp(unit)) || 1))
      });
    });
    return targets.sort(function mostInjuredFirst(left, right) {
      return Number(left.hpRatio || 0) - Number(right.hpRatio || 0);
    });
  }

  function resolveReverseCursedTechniqueOutputExplicitTarget(action, actor, opponent, battle) {
    var targetPlan = action?.targetPlan || action?.targetingPlan || {};
    var targetId = targetPlan.primaryTargetId || targetPlan.explicitTargetId || targetPlan.targetId || "";
    var actorId = String(actor?.id || actor?.characterId || actor?.side || "");
    if (targetPlan.target === "self" || (targetId && String(targetId) === actorId)) {
      return {
        type: "character",
        resource: actor,
        id: actor?.id || actor?.side || "",
        name: actor?.name || actor?.label || actor?.side || "自身",
        side: actor?.side || ""
      };
    }
    var explicitTarget = findDuelBattlefieldTargetById(battle, targetId, opponent);
    if (!explicitTarget) return null;
    if (explicitTarget.side === actor?.side) return explicitTarget;
    var explicitResource = explicitTarget.type === "unit" ? explicitTarget.unit : explicitTarget.resource;
    return isDuelCursedSpiritTarget(explicitResource) && !isRctOutputInstantKillImmuneTarget(explicitResource)
      ? explicitTarget
      : null;
  }

  function hasReverseCursedTechniqueOutputTarget(action, actor, opponent, battle) {
    var targetPlan = action?.targetPlan || action?.targetingPlan || {};
    var explicitTarget = resolveReverseCursedTechniqueOutputExplicitTarget(action, actor, opponent, battle);
    if (explicitTarget) return true;
    if (targetPlan.targetSide === actor?.side || targetPlan.target === "self" || targetPlan.target === "ally") {
      return getReverseCursedTechniqueOutputFriendlyHealTargets(actor, battle).length > 0;
    }
    if (getReverseCursedTechniqueOutputEnemyCurseUnit(opponent, battle)) return true;
    if (isDuelCursedSpiritTarget(opponent) && !isRctOutputInstantKillImmuneTarget(opponent)) return true;
    return getReverseCursedTechniqueOutputFriendlyHealTargets(actor, battle).length > 0;
  }

  function resolveReverseCursedTechniqueOutputTarget(action, actor, opponent, battle) {
    var targetPlan = action?.targetPlan || action?.targetingPlan || {};
    var explicitTarget = resolveReverseCursedTechniqueOutputExplicitTarget(action, actor, opponent, battle);
    if (explicitTarget) return { ...explicitTarget, explicit: true, intercepted: false, selectionMode: targetPlan.selectionMode || "rct_output_explicit" };
    var actorSide = actor?.side || "";
    var opponentSide = opponent?.side || "";
    if (targetPlan.targetSide === actorSide || targetPlan.target === "self" || targetPlan.target === "ally") {
      var selectedFriendly = getReverseCursedTechniqueOutputFriendlyHealTargets(actor, battle)[0];
      if (selectedFriendly) return { ...selectedFriendly, explicit: true, intercepted: false, selectionMode: selectedFriendly.type === "unit" ? "rct_output_ally_summon" : "rct_output_ally_character" };
    }
    var curseUnit = getReverseCursedTechniqueOutputEnemyCurseUnit(opponent, battle);
    if (curseUnit && !isDuelCursedSpiritTarget(opponent)) {
      return {
        type: "unit",
        unit: curseUnit,
        id: curseUnit.id || curseUnit.cardId || curseUnit.actionId || "",
        name: curseUnit.name || curseUnit.label || curseUnit.cardName || "咒灵",
        side: opponentSide,
        explicit: false,
        intercepted: false,
        selectionMode: "rct_output_enemy_curse_unit"
      };
    }
    if (isDuelCursedSpiritTarget(opponent) && !isRctOutputInstantKillImmuneTarget(opponent)) {
      return {
        type: "character",
        resource: opponent,
        id: opponent?.id || opponentSide,
        name: opponent?.name || opponent?.label || opponentSide,
        side: opponentSide,
        explicit: false,
        intercepted: false,
        selectionMode: "rct_output_enemy_curse_character"
      };
    }
    var friendlyHealTarget = getReverseCursedTechniqueOutputFriendlyHealTargets(actor, battle)[0];
    if (friendlyHealTarget) {
      return {
        ...friendlyHealTarget,
        explicit: false,
        intercepted: false,
        selectionMode: friendlyHealTarget.type === "unit" ? "rct_output_ally_summon_fallback" : "rct_output_self_recovery_fallback"
      };
    }
    return {
      type: "character",
      resource: actor,
      id: actor?.id || actorSide,
      name: actor?.name || actor?.label || actorSide,
      side: actorSide,
      explicit: false,
      intercepted: false,
      selectionMode: "rct_output_self_recovery_fallback"
    };
  }

  function applyReverseCursedTechniqueOutput(action, actor, opponent, battle, numericPreview, effects) {
    var target = resolveReverseCursedTechniqueOutputTarget(action, actor, opponent, battle);
    var healScale = Math.max(0, Number(effects?.rctOutputHealScale ?? action?.rctOutputHealScale ?? 0.8));
    var baseHealing = Math.max(0, Number(
      numericPreview?.finalHealing ||
      action?.baseHealing ||
      action?.healing ||
      effects?.healing ||
      action?.effect?.healing ||
      0
    ));
    var healingAmount = action?.reverseOutputDslOnly === true
      ? Math.max(0, Math.round(Number(target?.resource?.maxHp || target?.unit?.maxHp || actor?.maxHp || 0) * 0.15))
      : Math.max(0, Math.round(baseHealing * healScale));
    var targetResource = target?.type === "unit" ? target.unit : target?.resource;
    var rctInstantKillImmune = isRctOutputInstantKillImmuneTarget(targetResource);
    var curseTarget = target?.side !== actor?.side && isDuelCursedSpiritTarget(targetResource) && !rctInstantKillImmune;
    var positiveEnergyShell = curseTarget
      ? global.JJKSpecialConstitution?.consumePositiveEnergyShell(targetResource)
      : null;
    var application = positiveEnergyShell?.consumed
      ? { applied: 0, beforeHp: Number(targetResource?.hp || 0), afterHp: Number(targetResource?.hp || 0), defeated: false, positiveEnergyShellBlocked: true }
      : (curseTarget
        ? applyDuelInstantKillToTarget(target, battle, "reverse_cursed_technique_output")
        : applyDuelHpHealingToTarget(target, healingAmount, battle));
    battle.rctOutputLog ||= [];
    battle.rctOutputLog.unshift({
      round: Number(battle?.round || 0) + 1,
      actorSide: actor?.side || "",
      targetSide: target?.side || "",
      actionId: action?.id || "",
      targetType: target?.type || "",
      targetId: target?.id || "",
      targetName: target?.name || "",
      curseTarget: Boolean(curseTarget),
      rctInstantKillImmune: Boolean(rctInstantKillImmune),
      instantKill: Boolean(curseTarget && !positiveEnergyShell?.consumed),
      positiveEnergyShellBlocked: Boolean(positiveEnergyShell?.consumed),
      positiveEnergyShellRemaining: Number(positiveEnergyShell?.remaining || 0),
      healingAmount: curseTarget ? 0 : healingAmount,
      applied: Number(application?.applied || 0)
    });
    return {
      target: target,
      curseTarget: Boolean(curseTarget),
      rctInstantKillImmune: Boolean(rctInstantKillImmune),
      instantKill: Boolean(curseTarget && !positiveEnergyShell?.consumed),
      positiveEnergyShell: positiveEnergyShell?.consumed ? positiveEnergyShell : undefined,
      healingAmount: curseTarget ? 0 : healingAmount,
      healingScale: Number(healScale.toFixed(4)),
      baseHealing: Number(baseHealing.toFixed(1)),
      application: application
    };
  }

  function applyMaximumUzumakiRikaArsenalBypass(action, actor, battle) {
    if (!isMaximumUzumakiAction(action) || !isRikaArsenalCopiedSpecialResourceAction(action)) return null;
    var spec = action?.maximumUzumakiSpec || {};
    var fallbackDamage = Math.max(1, Math.round(Number(
      action.rikaArsenalCopyFallbackDamage ??
      spec.copiedFallbackDamage ??
      spec.fallbackDamage ??
      getBattleRuntimeActionDamage(action) ??
      120
    ) || 120));
    return {
      damageFromHp: fallbackDamage,
      aoe: true,
      bypassedSpecialResource: true,
      consumed: [],
      consumedCount: 0,
      totalHp: 0,
      multiplier: { totalMultiplier: 1, copiedFallback: true },
      reason: "rika-arsenal-copy-special-resource-bypass"
    };
  }

  function applyMaximumUzumakiAoeDamage(action, actor, opponent, battle, amount, options) {
    var damage = Math.max(0, Number(amount || 0));
    var damageBeforeTargetDefense = Math.max(0, Number(options?.damageBeforeTargetDefense ?? damage));
    var defenderSide = opponent?.side || "";
    var reason = options?.reason || "maximum-uzumaki-aoe";
    var targetId = options?.targetId || "maximum_uzumaki_aoe";
    var selectionModePrefix = options?.selectionModePrefix || "maximum_uzumaki_aoe";
    var unitSelectionMode = options?.unitSelectionMode || (selectionModePrefix === "maximum_uzumaki_aoe" ? "maximum_uzumaki_aoe_unit" : selectionModePrefix + "_unit");
    var characterSelectionMode = options?.characterSelectionMode || (selectionModePrefix === "maximum_uzumaki_aoe" ? "maximum_uzumaki_aoe_character" : selectionModePrefix + "_character");
    if (!damage || !defenderSide) {
      return {
        aoe: true,
        damagePerTarget: damage,
        targetCount: 0,
        totalApplied: 0,
        applied: 0
      };
    }
    var unitTargets = getDuelBattlefieldUnitsForSide(battle, defenderSide)
      .map(function mapUnitTarget(unit) {
        return {
          type: "unit",
          unit: unit,
          id: unit.id || unit.cardId || unit.actionId || "",
          name: unit.name || unit.label || unit.cardName || "场上单位",
          side: defenderSide,
          explicit: true,
          intercepted: false,
          selectionMode: unitSelectionMode
        };
      });
    var characterTarget = {
      type: "character",
      resource: opponent,
      id: opponent?.id || opponent?.side || defenderSide,
      name: opponent?.name || opponent?.label || defenderSide,
      side: defenderSide,
      explicit: true,
      intercepted: false,
      selectionMode: characterSelectionMode
    };
    var aoeTargets = options?.includeCharacter === false
      ? unitTargets
      : unitTargets.concat([characterTarget]);
    var applications = aoeTargets
      .map(function applyAoeTarget(target) {
        // AoE must settle each target independently. Reusing the character's
        // already-defended damage made S/SSS body values cosmetic and then
        // applied that same incorrect packet to every summoned unit.
        var application = applyDuelStandardDamageToTarget(target, damageBeforeTargetDefense, battle, {
          actor: actor,
          opponent: opponent,
          action: action,
          sourceKind: "aoe",
          source: reason,
          sourceLabel: action?.label || action?.name || "范围攻击",
          blockIgnoreRatio: Math.max(0, Number(options?.blockIgnoreRatio || 0)),
          // Offence/domain multipliers are already included in the packet
          // computed by the direct-card pipeline above.
          applyAttackerScales: false,
          applyDomainStateScale: false
        });
        return {
          target: {
            type: target.type,
            id: target.id || "",
            name: target.name || "",
            side: target.side || "",
            selectionMode: target.selectionMode || ""
          },
          application: application
        };
      });
    var totalApplied = applications.reduce(function sumApplied(total, entry) {
      return total + Number(entry?.application?.applied || 0);
    }, 0);
    var defeatedUnits = applications
      .filter(function keepDefeated(entry) {
        return entry?.target?.type === "unit" && entry?.application?.defeated;
      })
      .map(function mapDefeated(entry) {
        return {
          id: entry.target.id || "",
          name: entry.target.name || ""
        };
      });
    var characterApplication = applications.find(function findCharacter(entry) {
      return entry?.target?.type === "character";
    })?.application || null;
    battle.summonLog ||= [];
    battle.summonLog.unshift({
      round: Number(battle?.round || 0) + 1,
      actorSide: actor?.side || "",
      opponentSide: defenderSide,
      actionId: action?.id || "",
      cardId: action?.cardId || "",
      reason: reason,
      damagePerTarget: Number(damageBeforeTargetDefense.toFixed(1)),
      targetCount: applications.length,
      totalApplied: Number(totalApplied.toFixed(1)),
      defeatedUnits: defeatedUnits
    });
    return {
      aoe: true,
      damagePerTarget: Number(damageBeforeTargetDefense.toFixed(1)),
      targetCount: applications.length,
      unitTargetCount: unitTargets.length,
      unitApplications: applications.filter(function keepUnit(entry) { return entry?.target?.type === "unit"; }),
      characterApplication: characterApplication || undefined,
      defeatedUnits: defeatedUnits,
      totalApplied: Number(totalApplied.toFixed(1)),
      applied: Number(totalApplied.toFixed(1))
    };
  }

  function applyHutianBlackFlashEffect(effects, actor, opponent, options) {
    var battle = options?.battle || getBattle();
    var stacks = getHutianBlackFlashStacks(actor, battle);
    var maxHpRatio = Math.max(0, Number(effects.hutianBlackFlashMaxHpRatio || 0.08));
    var baseRatio = Number(effects.hutianBlackFlashBaseHpRatio || 0.03) + stacks * Number(effects.hutianBlackFlashGrowthPerHit || 0.005);
    if (maxHpRatio > 0) baseRatio = Math.min(baseRatio, maxHpRatio);
    var sourceDamage = Math.max(0, Number(actor?.hp || 0) * baseRatio);
    var damageMultiplier = Math.max(0, Number(effects.hutianBlackFlashDamageMultiplier || 2.5));
    var uncappedDamage = Math.max(0, Math.round(sourceDamage * damageMultiplier));
    var targetMaxHpDamageRatio = Math.max(0, Number(effects.hutianBlackFlashTargetMaxHpDamageRatio || 0.45));
    var targetMaxHp = Math.max(0, Number(opponent?.maxHp || opponent?.hp || 0));
    var damageCap = targetMaxHpDamageRatio > 0 && targetMaxHp > 0 ? Math.max(1, Math.round(targetMaxHp * targetMaxHpDamageRatio)) : 0;
    var directDamage = damageCap > 0 ? Math.min(uncappedDamage, damageCap) : uncappedDamage;
    if (options?.previewOnly) {
      return {
        directDamage: directDamage,
        sourceDamage: Number(sourceDamage.toFixed(4)),
        baseRatio: Number(baseRatio.toFixed(4)),
        damageMultiplier: Number(damageMultiplier.toFixed(4)),
        maxHpRatio: Number(maxHpRatio.toFixed(4)),
        targetMaxHpDamageRatio: Number(targetMaxHpDamageRatio.toFixed(4)),
        uncappedDamage: uncappedDamage,
        damageCap: damageCap || undefined,
        stacksBefore: stacks,
        stacksAfter: stacks + 1,
        hpHeal: 0,
        ceHeal: 0,
        previewOnly: true
      };
    }
    // This helper owns the formula, recovery and stack state only. HP damage
    // is always committed by the canonical target settlement call site.
    var hpHeal = Math.max(0, Number(actor?.hp || 0) * Number(effects.hutianBlackFlashHpHealCurrentRatio || 0.08));
    var ceHeal = Math.max(0, Number(actor?.ce || 0) * Number(effects.hutianBlackFlashCeHealCurrentRatio || 0.04));
    actor.hp = Number(actor.hp || 0) + hpHeal;
    actor.ce = Number(actor.ce || 0) + ceHeal;
    actor.stability = Number(clamp(Number(actor.stability || 0) + Number(effects.hutianBlackFlashStabilityDelta || 0.01), 0, 1).toFixed(4));
    setHutianBlackFlashStacks(actor, battle, stacks + 1);
    if (!options?.skipOpponentStatus) {
      opponent.statusEffects = Array.isArray(opponent.statusEffects) ? opponent.statusEffects : [];
      opponent.statusEffects.push({ id: "hutianBlackFlashShock", label: "黑闪！", rounds: 1, value: 1 });
    }
    return {
      directDamage: directDamage,
      sourceDamage: Number(sourceDamage.toFixed(4)),
      baseRatio: Number(baseRatio.toFixed(4)),
      damageMultiplier: Number(damageMultiplier.toFixed(4)),
      maxHpRatio: Number(maxHpRatio.toFixed(4)),
      targetMaxHpDamageRatio: Number(targetMaxHpDamageRatio.toFixed(4)),
      uncappedDamage: uncappedDamage,
      damageCap: damageCap || undefined,
      stacksBefore: stacks,
      stacksAfter: stacks + 1,
      hpHeal: Number(hpHeal.toFixed(1)),
      ceHeal: Number(ceHeal.toFixed(1))
    };
  }

  function applyGenericSpecialMechanismPatch(action, actor, opponent, battle) {
    if (action?.genericMechanicDslOnly === true) return { action: action, applied: [] };
    var bridge = global.JJKDuelSpecialMechanism;
    if (!bridge || typeof bridge.applyActionPatch !== "function") return { action: action, applied: [] };
    try {
      return bridge.applyActionPatch(action, actor, opponent, battle) || { action: action, applied: [] };
    } catch (error) {
      if (battle) {
        battle.specialMechanismErrors ||= [];
        battle.specialMechanismErrors.unshift({
          actionId: action?.id || "",
          message: error?.message || "特殊机制接口执行失败。"
        });
        battle.specialMechanismErrors = battle.specialMechanismErrors.slice(0, 8);
      }
      return { action: action, applied: [] };
    }
  }

  function resolveTowerInverseDamageAdjustment(action, actor, opponent, battle, rawDamage) {
    var damageBefore = Math.max(0, Number(rawDamage || 0));
    var resolver = global.JJKShibuyaIncident?.getTowerInverseDamageAdjustment;
    if (typeof resolver !== "function" || damageBefore <= 0) return null;
    try {
      var adjustment = resolver(action, actor, opponent, battle, damageBefore);
      if (!adjustment || adjustment.applied !== true) return null;
      var declaredScale = Number(adjustment.scale ?? adjustment.multiplier);
      var returnedDamageAfter = Number(adjustment.damageAfter);
      var damageAfter = Number.isFinite(returnedDamageAfter)
        ? Math.max(0, returnedDamageAfter)
        : (Number.isFinite(declaredScale) ? Math.max(0, damageBefore * declaredScale) : NaN);
      if (!Number.isFinite(damageAfter)) return null;
      var effectiveScale = damageBefore > 0 ? damageAfter / damageBefore : 1;
      return {
        ...adjustment,
        applied: true,
        scale: Number((Number.isFinite(declaredScale) ? declaredScale : effectiveScale).toFixed(4)),
        multiplier: Number((Number.isFinite(declaredScale) ? declaredScale : effectiveScale).toFixed(4)),
        effectiveScale: Number(effectiveScale.toFixed(4)),
        damageBefore: Number(damageBefore.toFixed(1)),
        damageAfter: Number(damageAfter.toFixed(1)),
        label: String(adjustment.label || "强弱颠倒"),
        detail: String(adjustment.detail || adjustment.reason || "强弱颠倒改变了本次直接伤害。")
      };
    } catch (error) {
      if (battle) {
        battle.towerBossMechanicErrors ||= [];
        battle.towerBossMechanicErrors.unshift({
          actionId: action?.id || action?.actionId || "",
          mechanicId: battle?.activityContext?.bossMechanicId || "",
          message: error?.message || "塔顶首领伤害机制执行失败。"
        });
        battle.towerBossMechanicErrors = battle.towerBossMechanicErrors.slice(0, 8);
      }
      return null;
    }
  }

  function applyDuelActionEffect(action, actor, opponent, duelState) {
    var battle = getBattle(duelState);
    if (!action || !actor || !opponent || !battle) return null;
    var actorDomain = normalizeDuelDomainState(actor);
    var opponentDomain = normalizeDuelDomainState(opponent);
    if (!actorDomain.ok || !opponentDomain.ok) {
      return {
        applied: false,
        blocked: true,
        code: !actorDomain.ok ? actorDomain.code : opponentDomain.code,
        reason: "领域状态无效，无法结算本回合。",
        domainBefore: { actor: actorDomain.state, opponent: opponentDomain.state }
      };
    }
    var directBattleCard = isDirectBattleCard(action);
    if (directBattleCard) action = prepareDirectBattleCardRuntimeAction(action);
    action = prepareWeaponInventoryCurseLoadoutAction(action, actor, battle);
    action = prepareDhruvTrackingScreenRuntimeAction(action, actor, battle);
    var constitutionAvailability = global.JJKSpecialConstitution?.getActionAvailability(action, actor, battle);
    if (constitutionAvailability && !constitutionAvailability.available) {
      return { applied: false, blocked: true, reason: constitutionAvailability.reason, costCe: 0, hpCost: 0 };
    }
    action = global.JJKSpecialConstitution?.applyActionPatch(action, actor) || action;
    // Availability is normally checked by the hand/UI layer, but online replay,
    // AI and direct test callers can reach settlement without that layer. Keep
    // ownership, range and unique-summon invariants authoritative here as well.
    var ownershipAndRangeAvailability = getDuelOwnershipAndRangeAvailability(action, actor, opponent, battle);
    if (!ownershipAndRangeAvailability.available) {
      return {
        applied: false,
        blocked: true,
        reason: ownershipAndRangeAvailability.reason,
        costCe: 0,
        hpCost: 0
      };
    }
    if (isTenShadowsUniqueShikigamiAction(action) && hasTenShadowsShikigamiBeenSummoned(battle, actor.side || "", action)) {
      return {
        applied: false,
        blocked: true,
        reason: "该十种影式神本场已经召唤过",
        costCe: 0,
        hpCost: 0,
        duplicateSummonBlocked: true
      };
    }
    var hardGatedTacticalKind = normalizeTacticalHumanResourceKind(action?.tacticalResourceKind);
    if (["cursedObjectSediment", "pandaCoreCharge"].includes(hardGatedTacticalKind) && !action?.rikaArsenalCopiedSpecialResourceBypass) {
      var tacticalAvailability = getTacticalHumanResourceAvailability(action, actor, battle);
      if (!tacticalAvailability.available) {
        return {
          applied: false,
          blocked: true,
          reason: tacticalAvailability.reason,
          costCe: 0,
          hpCost: 0,
          tacticalResourceKind: hardGatedTacticalKind
        };
      }
    }
    if (isCopyBladeDrawAction(action)) {
      var copiedTechniqueAction = buildCopyBladeResolvedAction(action, actor, battle);
      if (copiedTechniqueAction) {
        var copiedTechniqueResult = applyDuelActionEffect(copiedTechniqueAction, actor, opponent, battle);
        if (copiedTechniqueResult) {
          copiedTechniqueResult.copyBlade = {
            sourceActionId: action.id || action.actionId || "card_copy_086",
            copiedCardId: copiedTechniqueAction.copyBladeOriginalCardId,
            copiedName: copiedTechniqueAction.name,
            specialResourceBypass: Boolean(copiedTechniqueAction.rikaArsenalCopiedSpecialResourceBypass),
            damageScale: Number(copiedTechniqueAction.rikaArsenalCopyDamageScale || 1)
          };
          battle.actionUiMessage = "复制刀抽取：" + copiedTechniqueAction.name + " 已通过原术式结算管线发动。";
        }
        return copiedTechniqueResult;
      }
    }
    cleanupExpiredDuelBattlefieldUnits(battle);
    var customAtomicTimerResults = settleCustomAtomicTimers(actor, opponent, battle);
    if (action.id === "online_pass_turn" || action.id === "duel_pass_turn" || action.type === "pass") {
      var passUpkeepResult = applyDuelSummonUpkeep(actor, battle);
      var passSummonAssistResult = applyDuelSummonAssist(actor, opponent, battle);
      var passProjectionSettlement = settleProjectionTurnFrameGain(actor, battle);
      var passResult = {
        costCe: 0,
        actorCe: passUpkeepResult ? -passUpkeepResult.paid.reduce(function sumCost(total, entry) { return total + Number(entry.costCe || 0); }, 0) : 0,
        actorHp: 0,
        actorStability: 0,
        actorDomainLoad: 0,
        opponentStability: 0,
        opponentHp: 0,
        opponentDomainLoad: 0,
        domainActivated: false,
        domainReleased: false,
        directDamage: 0,
        blackFlashTriggered: false,
        blackFlashLabel: "",
        mechanicsApplied: [],
        projectionSorcery: passProjectionSettlement ? { settlement: passProjectionSettlement } : undefined,
        summonUpkeep: passUpkeepResult || undefined,
        summonAssist: passSummonAssistResult || undefined,
        customAtomicTimers: customAtomicTimerResults.length ? customAtomicTimerResults : undefined,
        passTurn: true
      };
      appendDuelActionLog(action, actor, opponent, passResult, battle);
      return passResult;
    }
    var genericSpecialMechanism = applyGenericSpecialMechanismPatch(action, actor, opponent, battle);
    action = genericSpecialMechanism.action || action;
    action = getTacticalHumanRuntimeAction(getDisasterRuntimeAction(getKusakabeRuntimeAction(getComedianRuntimeAction(getAngelRuntimeAction(getProjectionRuntimeAction(getBlackBirdRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(action, actor, battle), actor, battle), actor, battle), actor, battle), actor, opponent, battle), actor, battle), actor, opponent, battle), actor, opponent, battle), actor, opponent, battle);
    action = ensureCustomAtomicActionTransforms(action, actor, opponent, battle);
    action = getSixEyesRuntimeAction(action, actor);
    action = stripCurseSpiritSummonEntryDamage(action);
    if (action?.bloodRuntime?.active && !action.bloodRuntime.resourceAvailable) {
      return {
        applied: false,
        blocked: true,
        reason: action.bloodRuntime.unavailableReason || "赤血资源不足",
        costCe: 0,
        hpCost: 0,
        bloodManipulation: { ...action.bloodRuntime, resource: { blocked: true } }
      };
    }
    var side = actor.side;
    var opponentSide = opponent.side;
    var tacticActionModifiers = getDuelTacticActionModifiers(action, actor, opponent, battle);
    var tacticDefenseModifiers = getDuelTacticDefenseModifiers(opponent, battle);
    var mechanicsApplied = collectDuelMechanicsForAction(action);
    if (genericSpecialMechanism.applied?.length) {
      mechanicsApplied = mechanicsApplied.concat(genericSpecialMechanism.applied.map(function mapGenericMechanism(entry) {
        return {
          id: entry.id || "generic_special_mechanism",
          label: entry.label || "特殊机制",
          logTemplate: entry.log || ""
        };
      }));
    }
    var effects = mergeDuelMechanicEffects({ ...(action.effects || {}), ...(directBattleCard ? (action.effect || {}) : {}) }, mechanicsApplied);
    var customAtomicPrepared = prepareCustomAtomicRuntime(action, effects, actor, opponent, battle);
    action = customAtomicPrepared.action || action;
    effects = customAtomicPrepared.effects || effects;
    var customAtomicRuntime = customAtomicPrepared.runtime;
    ensureBloodConversionAtomicResourceGain(customAtomicRuntime, action);
    if (customAtomicRuntime?.blocked) {
      return {
        applied: false,
        blocked: true,
        reason: customAtomicRuntime.reason || "原子效果前置条件未满足。",
        costCe: 0,
        hpCost: 0,
        customAtomic: customAtomicRuntime
      };
    }
    var rikaArsenalCopyDamageScale = getRikaArsenalCopyDamageScale(action);
    if (rikaArsenalCopyDamageScale !== 1) {
      effects = {
        ...effects,
        damageScale: Number((Number(effects.damageScale || 1) * rikaArsenalCopyDamageScale).toFixed(4))
      };
    }
    var contexts = ensureDuelActionContext(battle);
    var actorContext = contexts?.[side] || createEmptyDuelActionContext();
    var opponentContext = contexts?.[opponentSide] || createEmptyDuelActionContext();
    var before = {
      actorCe: actor.ce,
      actorHp: actor.hp,
      actorStability: actor.stability,
      actorDomainLoad: actor.domain?.load || 0,
      actorDomainActive: Boolean(actor.domain?.active),
      opponentCe: opponent.ce,
      opponentHp: opponent.hp,
      opponentStability: opponent.stability,
      opponentDomainLoad: opponent.domain?.load || 0
    };
    var summonUpkeepResult = applyDuelSummonUpkeep(actor, battle);
    var numericPreview = calculateActionNumericPreview(action, actor);
    var directResolution = directBattleCard ? calculateDirectBattleCardSettlementWithTactics(action, actor, opponent, battle) : null;
    showHighCeSaturationStatus(actor, directResolution);
    var bloodRuntime = action.bloodRuntime || numericPreview?.bloodRuntime || null;
    var starRageRuntime = action.starRageRuntime || numericPreview?.starRageRuntime || null;
    var blackBirdRuntime = action.blackBirdRuntime || numericPreview?.blackBirdRuntime || null;
    var blackRopeResult = null;
    var contractTicketResult = null;
    var comedianResult = null;
    var kusakabeResult = null;
    var disasterResourceResult = null;
    var tacticalHumanResourceResult = null;
    var directSelfCounterResults = [];
    var directOpponentCounterResults = [];
    var directDomainActionResult = null;
    var specialConstitutionResult = null;
    var blackFlashWindow = null;
    var actorCe = Math.max(0, finiteDuelNumber(actor.ce, actor.maxCe));
    var constitutionCostOverride = global.JJKSpecialConstitution?.getCostOverride(action, actor);
    var rawCostCe = constitutionCostOverride != null && Number.isFinite(Number(constitutionCostOverride))
      ? Number(constitutionCostOverride)
      : (isCursedToolDuelAction(action) ? 0 : getDuelActionCost(action, actor, battle));
    var costCe = Math.min(actorCe, Math.max(0, finiteDuelNumber(rawCostCe, 0)));
    actor.ce = Number((actorCe - costCe).toFixed(3));
    var hpCost = applyDuelActionHpCost(action, actor, battle);
    specialConstitutionResult = global.JJKSpecialConstitution?.applySpecialAction(action, actor, battle) || null;
    if (specialConstitutionResult?.recalculateResource && typeof global.JJKDuelResource?.deriveDuelResourcesFromProfile === "function") {
      var oldMaxCe = Math.max(0, Number(actor.maxCe || 0));
      var constitutionProfile = actor.characterCardProfile || actor;
      var refreshedConstitutionResource = global.JJKDuelResource.deriveDuelResourcesFromProfile(constitutionProfile, null, actor.side);
      var constitutionRankDelta = Math.max(0, Number(specialConstitutionResult.cursedEnergyRankDelta || 0));
      var previousConstitutionResource = null;
      if (constitutionRankDelta > 0 && constitutionProfile?.raw) {
        var previousConstitutionProfile = {
          ...constitutionProfile,
          raw: {
            ...constitutionProfile.raw,
            cursedEnergyScore: Math.max(0, Number(constitutionProfile.raw.cursedEnergyScore || 0) - constitutionRankDelta)
          }
        };
        previousConstitutionResource = global.JJKDuelResource.deriveDuelResourcesFromProfile(previousConstitutionProfile, null, actor.side);
      }
      // Preserve scenario/boss/custom resource baselines and apply only the
      // capacity produced by the newly granted ranks. Replacing the current
      // max with a freshly derived absolute value could make a valid +3 rank
      // grant appear to do nothing whenever the battle snapshot used a higher
      // custom baseline.
      var derivedCeDelta = Math.max(0, Number(refreshedConstitutionResource?.maxCe || 0) - Number(previousConstitutionResource?.maxCe || 0));
      var newMaxCe = constitutionRankDelta > 0
        ? oldMaxCe + derivedCeDelta
        : Math.max(oldMaxCe, Number(refreshedConstitutionResource?.maxCe || oldMaxCe));
      actor.maxCe = newMaxCe;
      actor.ce = Number(Math.min(newMaxCe, Math.max(0, Number(actor.ce || 0)) + Math.max(0, newMaxCe - oldMaxCe)).toFixed(1));
      actor.ceRegen = Number(refreshedConstitutionResource?.ceRegen || actor.ceRegen || 0);
      actor.regenRatio = Number(refreshedConstitutionResource?.regenRatio || actor.regenRatio || 0);
      if (actor.domain && refreshedConstitutionResource?.domain) actor.domain.threshold = refreshedConstitutionResource.domain.threshold;
      invalidateDuelActionChoices(battle);
    }
    var weaponInventoryLoadoutResult = consumeWeaponInventoryCurseLoadout(action, battle);
    blackRopeResult = consumeBlackRopeForAction(action, actor, battle);
    contractTicketResult = applyContractTicketsForAction(action, actor, battle);
    comedianResult = applyComedianForAction(action, actor, battle);
    kusakabeResult = applyKusakabeForAction(action, actor, battle);
    disasterResourceResult = applyDisasterResourceForAction(action, actor, battle);
    tacticalHumanResourceResult = applyTacticalHumanResourceForAction(action, actor, battle);
    if (effects.dounaBoundWorldSlash && battle.dounaGauntlet) {
      battle.dounaGauntlet.boundWorldSlashUsed = true;
      battle.dounaGauntlet.pendingBoundWorldSlash = {
        casterSide: actor.side || "right",
        targetSide: opponent.side || "left",
        triggerTurn: getDuelActionTurnNumber(battle) + 1,
        hitRate: 0.7,
        resolved: false
      };
      battle.actionUiMessage = "宿傩摆出了世界斩的手势。";
      if (Array.isArray(actor.statusEffects)) {
        actor.statusEffects.push({ id: "dounaBoundWorldSlashGesture", label: "世界斩手势", rounds: 1, value: 1 });
      }
      var boundResult = {
        costCe: costCe,
        hpCost: hpCost,
        actorCe: Number((actor.ce - before.actorCe).toFixed(1)),
        actorHp: Number((actor.hp - before.actorHp).toFixed(1)),
        actorStability: Number((actor.stability - before.actorStability).toFixed(4)),
        actorDomainLoad: Number(((actor.domain?.load || 0) - before.actorDomainLoad).toFixed(1)),
        opponentStability: 0,
        opponentHp: 0,
        opponentDomainLoad: 0,
        domainActivated: false,
        domainReleased: false,
        directDamage: 0,
        delayedWorldSlash: true,
        mechanicsApplied: mechanicsApplied.map(function mapMechanic(mechanic) {
          return {
            id: mechanic.id || "",
            label: mechanic.label || mechanic.id || "",
            logTemplate: mechanic.logTemplate || mechanic.effectSummary || ""
          };
        })
      };
      appendDuelActionLog(action, actor, opponent, boundResult, battle);
      callDependency("recordDuelResourceChange", [battle, {
        side: actor.side || "right",
        title: "束缚世界斩预告",
        detail: "宿傩摆出了世界斩的手势；下一回合将以 70% 命中率结算。",
        type: "action",
        delta: { dounaBoundWorldSlashPending: true }
      }]);
      return boundResult;
    }
    var bloodConversionResult = applyBloodManipulationConversion(action, actor, costCe, hpCost);
    if (bloodRuntime?.active) {
      action = getTacticalHumanRuntimeAction(getDisasterRuntimeAction(getKusakabeRuntimeAction(getComedianRuntimeAction(getAngelRuntimeAction(getProjectionRuntimeAction(getBlackBirdRuntimeAction(getStarRageRuntimeAction(getBloodManipulationRuntimeAction(action, actor, battle, {
        actualCeCost: costCe,
        actualHpCost: hpCost
      }), actor, battle), actor, battle), actor, battle), actor, opponent, battle), actor, battle), actor, opponent, battle), actor, opponent, battle), actor, opponent, battle);
      action = ensureCustomAtomicActionTransforms(action, actor, opponent, battle);
      action = getSixEyesRuntimeAction(action, actor);
      action = stripCurseSpiritSummonEntryDamage(action);
      effects = mergeDuelMechanicEffects(action.effects || {}, mechanicsApplied);
      rikaArsenalCopyDamageScale = getRikaArsenalCopyDamageScale(action);
      if (rikaArsenalCopyDamageScale !== 1) {
        effects = {
          ...effects,
          damageScale: Number((Number(effects.damageScale || 1) * rikaArsenalCopyDamageScale).toFixed(4))
        };
      }
      numericPreview = calculateActionNumericPreview(action, actor);
      // The first direct-card settlement was built from the pre-payment
      // preview. Rebuild it after the HP clamp so mitigation/scaling metadata
      // and the applied damage share the same actual-cost packet.
      if (directBattleCard) directResolution = calculateDirectBattleCardSettlementWithTactics(action, actor, opponent, battle);
      bloodRuntime = action.bloodRuntime || numericPreview?.bloodRuntime || bloodRuntime;
      starRageRuntime = action.starRageRuntime || numericPreview?.starRageRuntime || starRageRuntime;
      blackBirdRuntime = action.blackBirdRuntime || numericPreview?.blackBirdRuntime || blackBirdRuntime;
    }
    var bloodResourceState = settleBloodManipulationResources(battle, side, bloodRuntime);
    actor.stability = Number(clamp(Number(actor.stability || 0) + Number(effects.stabilityDelta || 0), 0, 1).toFixed(4));
    if (effects.activateDomain) {
      var activatedDomain = ensureDuelDomainStateForActivation(actor, action);
      if (activatedDomain) {
        activatedDomain.active = true;
        activatedDomain.turnsActive = 0;
      }
    }
    if (effects.releaseDomain && actor.domain) {
      actor.domain.active = false;
      if (battle.domainProfileStates?.[side]) delete battle.domainProfileStates[side];
      if (battle.domainSubPhase?.owner === side) {
        battle.domainSubPhase.verdictResolved = true;
        battle.domainSubPhase.endedByRelease = true;
        battle.domainSubPhase.trialEndReason = "domainManuallyEnded";
        battle.domainSubPhase.trialStatus = "resolved";
        updateDuelDomainTrialContext(battle, {
          trialStatus: "resolved",
          trialEndReason: "domainManuallyEnded"
        });
        invalidateDuelActionChoices(battle);
      }
    }
    // `domainPressure` is the card packet's environment pressure and remains
    // independent from a dodge.  Explicit opponent-target operations are
    // contact effects, so keep them pending until the hit result is known.
    var directOpponentDomainPressureDelta = 0;
    var pendingOpponentDomainLoadDelta = Number(effects.opponentDomainLoadDelta || 0);
    var pendingOpponentStabilityDelta = Number(effects.opponentStabilityDelta || 0);
    var pendingOpponentRegenInterference = Number(effects.opponentRegenInterference || 0);
    if (directBattleCard) {
      effects.domainLoadDelta = Number(directResolution?.domainLoad || 0) + Number(effects.domainLoadDelta || 0);
      directOpponentDomainPressureDelta = Number(directResolution?.domainPressure || 0);
    }
    if (tacticActionModifiers.category === "domain") {
      effects.domainLoadDelta = Number(effects.domainLoadDelta || 0) * Number(tacticActionModifiers.domainLoadScale || 1);
      directOpponentDomainPressureDelta *= Number(tacticActionModifiers.domainPressureScale || 1);
      pendingOpponentDomainLoadDelta *= Number(tacticActionModifiers.domainPressureScale || 1);
    }
    if (actor.domain && (isDomainActive(actor) || directBattleCard) && Number(effects.domainLoadDelta || 0)) {
      actor.domain.load += Number(effects.domainLoadDelta || 0);
    } else if (directBattleCard && Number(effects.domainLoadDelta || 0)) {
      actor.domainLoad = Math.max(0, Number(actor.domainLoad || 0) + Number(effects.domainLoadDelta || 0));
    }
    if (opponent.domain && (isDomainActive(opponent) || directBattleCard) && directOpponentDomainPressureDelta) {
      opponent.domain.load += directOpponentDomainPressureDelta;
    } else if (directBattleCard && directOpponentDomainPressureDelta) {
      opponent.domainLoad = Math.max(0, Number(opponent.domainLoad || 0) + directOpponentDomainPressureDelta);
    }
    if (Number(effects.selfCeRestoreFlat || 0) > 0 && Number(actor.maxCe || 0) > 0) {
      actor.ce = Number(clamp(Number(actor.ce || 0) + Number(effects.selfCeRestoreFlat || 0), 0, getDuelActionTemporaryResourceCap(actor, "ce", "maxCe", "temporaryCeOverCap")).toFixed(1));
    }
    var rikaArsenalPending = isRikaArsenalAction(action) ? scheduleRikaArsenalDraw(action, actor, battle) : null;
    (effects.selfStatuses || []).forEach(function addSelfStatus(status) {
      if (status?.id) upsertDuelStatusEffect(actor, { ...status }, { appliedTurn: getDuelActionTurnNumber(battle) });
    });
    var inverseDamageCurveActivation = activateDuelInverseDamageCurve(action, actor, battle);
    var bodyHoppingResult = activateDuelBodyHoppingState(action, actor, battle);
    directSelfCounterResults = applyDirectBattleCounterOperations(effects.selfCounterOperations, battle, actor);
    (effects.delayedSelfStatuses || []).forEach(function addDelayedSelfStatus(status) {
      if (!status?.id) return;
      var delayedStatus = { ...status };
      var delayTurns = Math.max(0, Number(delayedStatus.triggerDelayTurns || 0));
      if (!delayedStatus.triggerRound && delayTurns > 0) {
        delayedStatus.triggerRound = getDuelActionTurnNumber(battle) + delayTurns;
      }
      delete delayedStatus.triggerDelayTurns;
      upsertDuelStatusEffect(actor, delayedStatus, { appliedTurn: getDuelActionTurnNumber(battle) });
    });
    var mythicalBeastAmberResult = applyMythicalBeastAmberRuntimeEffects(action, actor, opponent, battle);
    var pendingOpponentStatuses = Array.isArray(effects.opponentStatuses) ? effects.opponentStatuses : [];
    if (Number(effects.lowStabilityHpRecoil || 0) && Number(actor.stability || 0) < 0.38) actor.hp -= Number(effects.lowStabilityHpRecoil);
    // card_template_runtime already stores the standardized preview value.
    // Applying the legacy 45% action-template compression a second time made
    // common attacks deal 7/6/12 while their numeric preview showed 16/14/26.
    var standardizedCardTemplateRuntime = action?.type === "card_template_runtime";
    var damageSettlementRatio = directBattleCard || standardizedCardTemplateRuntime ? 1 : (action?.projectionRuntime?.active
      ? Number(action.projectionRuntime.damageSettlementRatio || action.projectionDamageSettlementRatio || 0.72)
      : (action.risk === "high" || action.risk === "critical" ? 0.58 : 0.45));
    // Direct battle cards must deduct the same target-aware settlement that is
    // shown in mitigation logs. The old path used an actor-only preview here,
    // so body/martial defenses were logged but did not change actual HP.
    var settledDirectDamage = directBattleCard ? directResolution?.damage : numericPreview?.finalDamage;
    var roundDamageScale = getDuelRoundDamageScale(battle);
    var directDamage = Math.max(0, Math.round(Number(settledDirectDamage || 0) * damageSettlementRatio * roundDamageScale));
    var directDamageBeforeScale = directDamage;
    var towerInverseDamageAdjustment = null;
    var mythicalBeastAmberChargeDamage = applyMythicalBeastAmberChargeDamage(action, opponent, directDamage, actor, battle);
    if (mythicalBeastAmberChargeDamage) {
      directDamage = mythicalBeastAmberChargeDamage.damageAfter;
      directDamageBeforeScale = directDamage;
    }
    var damageScaleSummary = { roundDamageScale: roundDamageScale };
    var directPanelDefensePrevented = 0;
    var directHealing = Math.max(0, Math.round(Number(numericPreview?.finalHealing || 0) * Number(tacticActionModifiers.healingScale || 1)));
    var directShield = Math.max(0, Math.round(Number(directBattleCard ? directResolution?.shield : 0)));
    if (directShield > 0) {
      actor.statusEffects = Array.isArray(actor.statusEffects) ? actor.statusEffects : [];
      var existingDirectShield = actor.statusEffects.find(function findDirectCardShield(status) {
        return status?.id === "directCardShield";
      });
      if (existingDirectShield) {
        existingDirectShield.value = Number((Number(existingDirectShield.value || 0) + directShield).toFixed(1));
        existingDirectShield.rounds = Math.max(1, Number(existingDirectShield.rounds || 1));
        existingDirectShield.label = "手牌护盾";
        existingDirectShield.duelShield = true;
      } else {
        upsertDuelStatusEffect(actor, { id: "directCardShield", label: "手牌护盾", rounds: 1, value: directShield, duelShield: true }, { appliedTurn: getDuelActionTurnNumber(battle) });
      }
    }
    var actualHealing = 0;
    var healingBlockedByDefeat = false;
    var stabilityShock = Math.max(0, Number(directBattleCard ? directResolution?.stabilityDamage : numericPreview?.base?.baseStabilityDamage || 0) / 100);
    var directCeDamage = Math.max(0, Number(directBattleCard ? directResolution?.ceDamage : 0));
    var hutianBlackFlashResult = null;
    var lifeDrainResult = null;
    var hutianPanelMitigation = null;
    var evasionResult = null;
    var blackFlashStatus = null;
    var blackFlashDamageBefore = 0;
    var blackFlashDamageBonus = 0;
    var damageTarget = null;
    var damageApplication = null;
    var inverseDamageCurveResolution = null;
    var reverseCursedTechniqueOutputResult = null;
    var summonResult = null;
    var weaponInventoryCurseResult = null;
    var dhruvOrbitResult = null;
    var summonAssistResult = null;
    var maintenanceResult = null;
    var mahoragaProxyResult = null;
    var mahoragaAdaptation = null;
    var maximumUzumakiResult = null;
    var maximumUzumakiAoeResult = null;
    var atomicAoeResult = null;
    var atomicTargeting = action?.atomicTargeting || null;
    var atomicAoeActive = Boolean(
      atomicTargeting?.scope === "all-enemies"
      || (
        atomicTargeting?.scope === "all-enemies-if-units"
        && getDuelBattlefieldUnitsForSide(battle, opponentSide).length > 0
      )
    );
    var atomicAoeDamageScale = atomicAoeActive
      ? Math.max(0, Number(atomicTargeting?.damageScale ?? 1))
      : 1;
    var rangeAdjustmentAoeResult = null;
    var aoeDamageBeforeTargetDefense = 0;
    var rangeAdjustmentAoeActive = false;
    var rangeAdjustmentDamageScale = 1;
    var rangeAdjustmentAoeDamage = 0;
    var specialResolutionResult = null;
    var starRageResult = null;
    var blackBirdResult = null;
    var projectionOutOfFrameResult = triggerProjectionOutOfFrameIfReady(action, actor, opponent, battle, actorContext);
    var projectionResult = applyProjectionImmediateEffects(action, actor, battle, actorContext);
    var projectionSettlement = null;
    var projectionReflect = null;
    var starRageSingleCardBonus = null;
    var instantKillOnHit = Boolean(action.instantKillOnHit || effects.instantKillOnHit);
    if (effects.hutianBlackFlash) {
      hutianBlackFlashResult = applyHutianBlackFlashEffect(effects, actor, opponent, { previewOnly: true, battle: battle });
      hutianPanelMitigation = getDuelStandardPanelMitigation(
        hutianBlackFlashResult.directDamage,
        opponent,
        bloodRuntime?.blockIgnoreRatio ?? action.blockIgnoreRatio ?? 0
      );
      directDamage = Math.max(0, Number(hutianPanelMitigation.damage || 0));
    }
    if (!effects.hutianBlackFlash && directDamage > 0 && isStrikeLikeAction(action)) {
      blackFlashWindow = takeBlackFlashWindow(actor);
    }
    if (blackFlashWindow) {
      blackFlashDamageBefore = directDamage;
      directDamage = Math.max(directDamage + 8, Math.round(directDamage * 1.35));
      blackFlashDamageBonus = Math.max(0, directDamage - blackFlashDamageBefore);
      stabilityShock += 0.085;
      blackFlashStatus = { id: "blackFlashShock", label: actor?.characterCardProfile?.isZeroCe ? "极限打击冲击" : "黑闪冲击", rounds: 1, value: 1 };
    }
    if (isMaximumUzumakiAction(action)) {
      maximumUzumakiResult = applyMaximumUzumakiConsumption(action, actor, opponent, battle);
      if (!maximumUzumakiResult && isRikaArsenalCopiedSpecialResourceAction(action)) {
        maximumUzumakiResult = applyMaximumUzumakiRikaArsenalBypass(action, actor, battle);
      }
      if (maximumUzumakiResult?.damageFromHp > 0) {
        maximumUzumakiResult.aoe = true;
        directDamage = maximumUzumakiResult.damageFromHp;
        stabilityShock += Math.min(0.28, Math.max(0.06, maximumUzumakiResult.damageFromHp / 900));
      } else {
        directDamage = 0;
      }
    }
    var skipStandardDirectHealing = false;
    if (isReverseCursedTechniqueOutputAction(action)) {
      if (battle?.dounaGauntlet && actor?.side === "right") {
        action = {
          ...action,
          targetPlan: {
            ...(action.targetPlan || {}),
            target: "self",
            targetSide: actor.side,
            selectionMode: "douna_sukuna_self_rct_only"
          }
        };
      }
      directDamage = 0;
      directHealing = 0;
      stabilityShock = 0;
      instantKillOnHit = false;
      skipStandardDirectHealing = true;
    }
    specialResolutionResult = applyRecontractUnfinishedTenShadowsResolution(action, actor, opponent, battle, directDamage);
    if (specialResolutionResult) directDamage = specialResolutionResult.damageAfter;
    directDamageBeforeScale = directDamage;
    if (directDamage > 0) {
      var pendingOutgoingScale = Math.max(0, Number(actorContext.outgoingScale || 1));
      var activeStatusOutgoingScale = Math.max(0, Number(getActiveDuelOutgoingStatusScale(actor, battle, action) ?? 1));
      var effectDamageScale = Math.max(0, Number(effects.damageScale || 1));
      var activityBossMechanicModifier = getDuelActivityBossMechanicDamageScale(action, actor, opponent, battle);
      var activityBossMechanicScale = Math.max(0, Number(activityBossMechanicModifier.scale || 1));
      effectDamageScale *= activityBossMechanicScale;
      if (atomicAoeActive) effectDamageScale *= atomicAoeDamageScale;
      var tacticDamageScale = Math.max(0, Number(tacticActionModifiers.damageScale || 1));
      rangeAdjustmentAoeActive = Boolean(actorContext.nextAttackAoe) && !maximumUzumakiResult?.aoe && !atomicAoeActive;
      rangeAdjustmentDamageScale = rangeAdjustmentAoeActive ? Math.max(0, Number(actorContext.nextAttackAoeDamageScale || 0.6)) : 1;
      if (rangeAdjustmentAoeActive) effectDamageScale *= rangeAdjustmentDamageScale;
      var activeYutaRikaUnit = getActiveYutaRikaManifestationUnit(battle, side);
      var yutaTruePureLoveCannonActive = isYutaTruePureLoveCannonAction(action) && activeYutaRikaUnit;
      // 真·纯爱大炮 already owns a two-pool CE multiplier. Do not stack the
      // ordinary manifestation 1.25x on top, and cap the combined pool bonus
      // so high-rank panels cannot multiply the finisher three separate times.
      var yutaRikaManifestDamageScale = activeYutaRikaUnit && !yutaTruePureLoveCannonActive
        ? Math.max(1, Number(activeYutaRikaUnit?.yutaRikaDamageScale ?? activeYutaRikaUnit?.unitStats?.yutaRikaDamageScale ?? 1.25))
        : 1;
      var yutaTruePureLoveCannonScale = yutaTruePureLoveCannonActive
        ? clamp(getDuelCePoolMultiplierForResource(actor) * getDuelCePoolMultiplierForResource(activeYutaRikaUnit), 1, 1.75)
        : 1;
      var targetDefenseOnlyPolicy = action.atomicDamagePolicy === "target-defense-only";
      var ignoreTargetDefensePolicy = action.atomicDamagePolicy === "ignore-target-defense";
      if (targetDefenseOnlyPolicy) {
        // The policy intentionally leaves hit resolution and every defender-side
        // mitigation intact, while removing all attacker-derived multipliers.
        pendingOutgoingScale = 1;
        activeStatusOutgoingScale = 1;
        effectDamageScale = 1;
        tacticDamageScale = 1;
        rangeAdjustmentAoeActive = false;
        rangeAdjustmentDamageScale = 1;
        yutaRikaManifestDamageScale = 1;
        yutaTruePureLoveCannonScale = 1;
      }
      var directBlockIgnoreRatio = clamp(Math.max(
        Number(action.blockIgnoreRatio || 0),
        Number(bloodRuntime?.blockIgnoreRatio || 0)
      ), 0, 0.9);
      var defenderCardBlockScale = clamp(Number(opponentContext.cardBlockIncomingHpScale ?? 1), 0.15, 1);
      var effectiveDefenderCardBlockScale = 1 - (1 - defenderCardBlockScale) * (1 - directBlockIgnoreRatio);
      var defenderIncomingHpScale = Math.max(0, Number(opponentContext.incomingHpScale ?? 1)) * effectiveDefenderCardBlockScale * getActiveDuelIncomingHpStatusScale(opponent, battle) * Math.max(0, Number(tacticDefenseModifiers.incomingDamageScale ?? 1));
      if (ignoreTargetDefensePolicy) {
        defenderIncomingHpScale = 1;
        directBlockIgnoreRatio = 0.9;
      }
      var actorHasUnopposedDomain = Boolean(actor?.domain?.active && !opponent?.domain?.active);
      var domainAdvantageScale = !targetDefenseOnlyPolicy && actorHasUnopposedDomain
        ? (battle?.dounaGauntlet ? Math.max(1.5, UNOPPOSED_DOMAIN_DAMAGE_SCALE) : UNOPPOSED_DOMAIN_DAMAGE_SCALE)
        : 1;
      var dounaDefenseValue = Math.max(0, Number(getDuelStatusEffectValue(opponent, "dounaSukunaDefense") || 0));
      if (dounaDefenseValue > 0) {
        var dounaDefenseEffectiveValue = opponent?.domain?.active ? dounaDefenseValue * 0.42 : dounaDefenseValue;
        defenderIncomingHpScale *= Math.max(0.08, 1 / (1 + dounaDefenseEffectiveValue));
      }
      if (opponent?.domain?.active && !actor?.domain?.active) {
        var unopposedDomainDefenseScale = battle?.dounaGauntlet ? 0.5 : 0.75;
        defenderIncomingHpScale *= unopposedDomainDefenseScale;
        damageScaleSummary ||= {};
        damageScaleSummary.unopposedDomainDefenseScale = unopposedDomainDefenseScale;
      }
      var defenderIncomingHpReductionCap = Math.max(0, Number(opponentContext.incomingHpReductionCap || 0));
      var damageWithoutDefenderScale = directDamage * pendingOutgoingScale * activeStatusOutgoingScale * effectDamageScale * tacticDamageScale * yutaRikaManifestDamageScale * yutaTruePureLoveCannonScale * domainAdvantageScale;
      towerInverseDamageAdjustment = resolveTowerInverseDamageAdjustment(action, actor, opponent, battle, damageWithoutDefenderScale);
      var towerInverseEffectiveScale = 1;
      if (towerInverseDamageAdjustment?.applied) {
        towerInverseEffectiveScale = Math.max(0, Number(towerInverseDamageAdjustment.effectiveScale || 0));
        damageWithoutDefenderScale = Math.max(0, Number(towerInverseDamageAdjustment.damageAfter || 0));
      }
      if (directBattleCard && Number(directResolution?.mitigation?.panelPrevented || 0) > 0) {
        var postSettlementDamageScale = directDamageBeforeScale > 0 ? damageWithoutDefenderScale / directDamageBeforeScale : 1;
        directPanelDefensePrevented = Math.max(0, Number(directResolution.mitigation.panelPrevented || 0) * postSettlementDamageScale);
      } else if (hutianPanelMitigation && Number(hutianPanelMitigation.mitigation?.panelPrevented || 0) > 0) {
        var hutianPostSettlementDamageScale = directDamageBeforeScale > 0 ? damageWithoutDefenderScale / directDamageBeforeScale : 1;
        directPanelDefensePrevented = Math.max(0, Number(hutianPanelMitigation.mitigation.panelPrevented || 0) * hutianPostSettlementDamageScale);
      }
      var totalDamageScale = pendingOutgoingScale * activeStatusOutgoingScale * effectDamageScale * tacticDamageScale * yutaRikaManifestDamageScale * yutaTruePureLoveCannonScale * domainAdvantageScale * towerInverseEffectiveScale * defenderIncomingHpScale;
      damageScaleSummary = {
        pendingOutgoingScale: Number(pendingOutgoingScale.toFixed(4)),
        activeStatusOutgoingScale: Number(activeStatusOutgoingScale.toFixed(4)),
        effectDamageScale: Number(effectDamageScale.toFixed(4)),
        activityBossMechanicScale: activityBossMechanicScale !== 1 ? Number(activityBossMechanicScale.toFixed(4)) : undefined,
        activityBossMechanicReason: activityBossMechanicModifier.reason || undefined,
        tacticDamageScale: Number(tacticDamageScale.toFixed(4)),
        tacticId: tacticActionModifiers.tacticId,
        initiativeCostScale: tacticActionModifiers.initiativeCostScale !== 1 ? tacticActionModifiers.initiativeCostScale : undefined,
        initiativeDefenseScale: tacticDefenseModifiers.initiativeDefenseScale !== 1 ? tacticDefenseModifiers.initiativeDefenseScale : undefined,
        rangeAdjustment: rangeAdjustmentAoeActive ? true : undefined,
        rangeAdjustmentDamageScale: rangeAdjustmentAoeActive ? Number(rangeAdjustmentDamageScale.toFixed(4)) : undefined,
        yutaRikaManifestDamageScale: yutaRikaManifestDamageScale !== 1 ? yutaRikaManifestDamageScale : undefined,
        yutaTruePureLoveCannonCePoolScale: yutaTruePureLoveCannonScale !== 1 ? Number(yutaTruePureLoveCannonScale.toFixed(4)) : undefined,
        atomicDamagePolicy: targetDefenseOnlyPolicy ? "target-defense-only" : undefined,
        unopposedDomainAttackScale: domainAdvantageScale !== 1 ? domainAdvantageScale : undefined,
        unopposedDomainDefenseScale: unopposedDomainDefenseScale !== 1 ? unopposedDomainDefenseScale : undefined,
        towerInverseScale: towerInverseDamageAdjustment?.applied ? towerInverseDamageAdjustment.scale : undefined,
        towerInverseEffectiveScale: towerInverseDamageAdjustment?.applied ? towerInverseDamageAdjustment.effectiveScale : undefined,
        towerInverseReason: towerInverseDamageAdjustment?.applied ? towerInverseDamageAdjustment.reason : undefined,
        towerInverseDamageBefore: towerInverseDamageAdjustment?.applied ? towerInverseDamageAdjustment.damageBefore : undefined,
        towerInverseDamageAfter: towerInverseDamageAdjustment?.applied ? towerInverseDamageAdjustment.damageAfter : undefined,
        defenderIncomingHpScale: Number(defenderIncomingHpScale.toFixed(4)),
        defenderCardBlockScale: Number(defenderCardBlockScale.toFixed(4)),
        effectiveDefenderCardBlockScale: Number(effectiveDefenderCardBlockScale.toFixed(4)),
        blockIgnoreRatio: directBlockIgnoreRatio ? Number(directBlockIgnoreRatio.toFixed(4)) : undefined,
        defenderIncomingHpReductionCap: defenderIncomingHpReductionCap || undefined,
        panelDefensePreventedDamage: directPanelDefensePrevented ? Number(directPanelDefensePrevented.toFixed(1)) : 0,
        total: Number(totalDamageScale.toFixed(4))
      };
      if (Number.isFinite(totalDamageScale) && totalDamageScale !== 1) {
        if (defenderIncomingHpReductionCap > 0 && defenderIncomingHpScale < 1 && Number.isFinite(damageWithoutDefenderScale)) {
          var uncappedDefenderScaledDamage = damageWithoutDefenderScale * defenderIncomingHpScale;
          var preventedByDefenderScale = Math.max(0, damageWithoutDefenderScale - uncappedDefenderScaledDamage);
          var cappedPrevention = Math.min(preventedByDefenderScale, defenderIncomingHpReductionCap);
          directDamage = Math.max(0, Math.round(damageWithoutDefenderScale - cappedPrevention));
          opponentContext.incomingHpReductionCap = Math.max(0, defenderIncomingHpReductionCap - cappedPrevention);
          damageScaleSummary.cappedIncomingHpReduction = Number(cappedPrevention.toFixed(1));
          damageScaleSummary.uncappedIncomingHpReduction = Number(preventedByDefenderScale.toFixed(1));
          damageScaleSummary.remainingIncomingHpReductionCap = Number(opponentContext.incomingHpReductionCap.toFixed(1));
        } else {
          directDamage = towerInverseDamageAdjustment?.applied
            ? Math.max(0, Math.round(damageWithoutDefenderScale * defenderIncomingHpScale))
            : Math.max(0, Math.round(directDamage * totalDamageScale));
        }
      }
      if (Number.isFinite(damageWithoutDefenderScale)) {
        // Keep the offensive packet before character-specific body/card/tactic
        // defense so an AoE can independently settle every target.
        // 极之番·涡以消耗单位体势动态生成伤害，已完全替换牌面
        // damage；此时 directResolution 的旧面板减免不属于该伤害包，
        // 不能反向加回。范围调整仍需重建普通直伤的面板前数值。
        var aoePanelDefenseToRestore = maximumUzumakiResult?.aoe ? 0 : directPanelDefensePrevented;
        aoeDamageBeforeTargetDefense = Math.max(0, Number((damageWithoutDefenderScale + aoePanelDefenseToRestore).toFixed(3)));
        damageScaleSummary.damageBeforeDefenderScale = Number(damageWithoutDefenderScale.toFixed(1));
        damageScaleSummary.damageAfterDefenderScale = Number(directDamage.toFixed(1));
        damageScaleSummary.defenderPreventedDamage = defenderIncomingHpScale < 1
          ? Number(Math.max(0, damageWithoutDefenderScale - directDamage).toFixed(1))
          : 0;
      }
      if (rangeAdjustmentAoeActive) rangeAdjustmentAoeDamage = directDamage;
      if (rangeAdjustmentAoeActive) {
        actorContext.nextAttackAoe = false;
        actorContext.nextAttackAoeDamageScale = 1;
      }
    }
    evasionResult = specialResolutionResult?.treatedAsSureHit
      ? { checked: true, evaded: false, profile: "special_resolution_sure_hit", hitRate: 1, roll: 0 }
      : resolveDuelActionEvasion(action, actor, opponent, battle, { damage: directDamage, stabilityShock: stabilityShock, directCeDamage: directCeDamage, instantKillOnHit: instantKillOnHit });
    if (evasionResult?.evaded) {
      showDuelFloatingCombatText(battle, "未命中！", "miss", opponentSide);
      battle.evasionLog ||= [];
      battle.evasionLog.unshift({
        round: Number(battle.round || 0) + 1,
        actionId: action.id || "",
        actionLabel: action.label || action.id || "",
        actorSide: side,
        opponentSide: opponentSide,
        hitRate: evasionResult.hitRate,
        roll: evasionResult.roll,
        profile: evasionResult.profile
      });
      if (evasionResult.mythicalBeastAmberAoeFullDodge) {
        recordDuelResourceChange(battle, {
          side: opponentSide,
          title: "幻兽琥珀规避",
          detail: getDuelResourceSideLabel(opponentSide) + opponent.name + " 以电化肉体避开范围攻击余波，本次范围攻击残余伤害归零。",
          type: "special",
          delta: { mythicalBeastAmberAoeFullDodge: true }
        });
      }
      directDamage = Math.max(0, Math.round(directDamage * Number(evasionResult.damageScaleOnMiss || 0)));
      stabilityShock = Math.max(0, Number(stabilityShock || 0) * Number(evasionResult.stabilityScaleOnMiss || 0));
      instantKillOnHit = false;
      directCeDamage = Math.max(0, directCeDamage * Number(evasionResult.ceScaleOnMiss || 0));
      if (hutianBlackFlashResult) hutianBlackFlashResult.evaded = true;
    }
    if (!evasionResult?.evaded) {
      disasterResourceResult = settleDeferredDisasterResourceGain(disasterResourceResult, actor, battle);
      tacticalHumanResourceResult = settleDeferredTacticalHumanResourceGain(tacticalHumanResourceResult, actor, battle);
    }
    if (isReverseCursedTechniqueOutputAction(action)) {
      reverseCursedTechniqueOutputResult = applyReverseCursedTechniqueOutput(action, actor, opponent, battle, numericPreview, effects);
      damageTarget = reverseCursedTechniqueOutputResult?.target || null;
      damageApplication = reverseCursedTechniqueOutputResult?.application || null;
      if (reverseCursedTechniqueOutputResult?.instantKill) {
        directDamage = Number(damageApplication?.applied || 0);
      } else {
        directHealing = Number(reverseCursedTechniqueOutputResult?.healingAmount || 0);
        if (damageTarget?.type === "character" && damageTarget?.side === side) {
          actualHealing = Number(damageApplication?.applied || 0);
        }
      }
    } else if (maximumUzumakiResult?.aoe) {
      damageTarget = {
        type: "aoe",
        id: "maximum_uzumaki_aoe",
        name: action.label || action.name || "极之番-涡",
        side: opponentSide,
        explicit: true,
        intercepted: false,
        selectionMode: "maximum_uzumaki_aoe"
      };
      if (!evasionResult?.evaded && directDamage > 0) {
        maximumUzumakiAoeResult = applyMaximumUzumakiAoeDamage(action, actor, opponent, battle, directDamage, {
          blockIgnoreRatio: bloodRuntime?.blockIgnoreRatio ?? action.blockIgnoreRatio ?? 0,
          damageBeforeTargetDefense: aoeDamageBeforeTargetDefense || directDamage
        });
        damageApplication = {
          targetType: "aoe",
          targetId: "maximum_uzumaki_aoe",
          targetName: damageTarget.name,
          applied: Number(maximumUzumakiAoeResult?.totalApplied || 0),
          targetCount: Number(maximumUzumakiAoeResult?.targetCount || 0),
          unitTargetCount: Number(maximumUzumakiAoeResult?.unitTargetCount || 0),
          characterApplied: Number(maximumUzumakiAoeResult?.characterApplication?.applied || 0),
          defeatedUnits: maximumUzumakiAoeResult?.defeatedUnits || []
        };
        if (Number(maximumUzumakiAoeResult?.characterApplication?.applied || 0) > 0) {
          var maximumUzumakiCharacterTarget = {
            type: "character",
            resource: opponent,
            id: opponent?.id || opponentSide,
            name: opponent?.name || opponent?.label || opponentSide,
            side: opponentSide
          };
          applyProjectionDamageTakenFrameGain(maximumUzumakiCharacterTarget, battle, maximumUzumakiAoeResult.characterApplication.applied);
          projectionReflect = applyProjectionFrameShieldReflect(opponent, actor, battle, maximumUzumakiAoeResult.characterApplication.applied);
        }
      }
    } else if (atomicAoeActive) {
      damageTarget = {
        type: "aoe",
        id: "atomic_aoe",
        name: action.label || action.name || "范围攻击",
        side: opponentSide,
        explicit: true,
        intercepted: false,
        selectionMode: "atomic_aoe"
      };
      if (!evasionResult?.evaded && directDamage > 0) {
        atomicAoeResult = applyMaximumUzumakiAoeDamage(action, actor, opponent, battle, directDamage, {
          blockIgnoreRatio: action.blockIgnoreRatio ?? 0,
          damageBeforeTargetDefense: aoeDamageBeforeTargetDefense || directDamage,
          reason: "atomic_aoe",
          targetId: "atomic_aoe",
          selectionModePrefix: "atomic_aoe"
        });
        damageApplication = {
          targetType: "aoe",
          targetId: "atomic_aoe",
          targetName: damageTarget.name,
          applied: Number(atomicAoeResult?.totalApplied || 0),
          targetCount: Number(atomicAoeResult?.targetCount || 0),
          unitTargetCount: Number(atomicAoeResult?.unitTargetCount || 0),
          characterApplied: Number(atomicAoeResult?.characterApplication?.applied || 0),
          defeatedUnits: atomicAoeResult?.defeatedUnits || []
        };
      }
    } else if (rangeAdjustmentAoeActive) {
      damageTarget = {
        type: "aoe",
        id: "range_adjustment_aoe",
        name: action.label || action.name || "范围调整攻击",
        side: opponentSide,
        explicit: true,
        intercepted: false,
        selectionMode: "range_adjustment_aoe"
      };
      var rangeAdjustmentSettlementDamage = evasionResult?.evaded
        ? (evasionResult.mythicalBeastAmberAoeFullDodge ? 0 : rangeAdjustmentAoeDamage)
        : directDamage;
      if (rangeAdjustmentSettlementDamage > 0) {
        rangeAdjustmentAoeResult = applyMaximumUzumakiAoeDamage(action, actor, opponent, battle, rangeAdjustmentSettlementDamage, {
          blockIgnoreRatio: bloodRuntime?.blockIgnoreRatio ?? action.blockIgnoreRatio ?? 0,
          damageBeforeTargetDefense: aoeDamageBeforeTargetDefense || rangeAdjustmentSettlementDamage,
          reason: "range_adjustment_aoe",
          targetId: "range_adjustment_aoe",
          selectionModePrefix: "range_adjustment_aoe",
          includeCharacter: !evasionResult?.evaded
        });
        damageApplication = {
          targetType: "aoe",
          targetId: "range_adjustment_aoe",
          targetName: damageTarget.name,
          applied: Number(rangeAdjustmentAoeResult?.totalApplied || 0),
          targetCount: Number(rangeAdjustmentAoeResult?.targetCount || 0),
          unitTargetCount: Number(rangeAdjustmentAoeResult?.unitTargetCount || 0),
          characterApplied: Number(rangeAdjustmentAoeResult?.characterApplication?.applied || 0),
          defeatedUnits: rangeAdjustmentAoeResult?.defeatedUnits || []
        };
        if (Number(rangeAdjustmentAoeResult?.characterApplication?.applied || 0) > 0) {
          var rangeAdjustmentCharacterTarget = {
            type: "character",
            resource: opponent,
            id: opponent?.id || opponentSide,
            name: opponent?.name || opponent?.label || opponentSide,
            side: opponentSide
          };
          applyProjectionDamageTakenFrameGain(rangeAdjustmentCharacterTarget, battle, rangeAdjustmentAoeResult.characterApplication.applied);
          projectionReflect = applyProjectionFrameShieldReflect(opponent, actor, battle, rangeAdjustmentAoeResult.characterApplication.applied);
        }
      }
    } else {
      damageTarget = resolveDuelDamageTarget(action, actor, opponent, battle, { damage: directDamage, stabilityShock: stabilityShock, instantKillOnHit: instantKillOnHit });
      if (!evasionResult?.evaded && damageTarget?.type !== "unit") {
        mahoragaAdaptation = applyMahoragaAdaptation(action, opponent, battle, directDamage, stabilityShock);
        if (mahoragaAdaptation) {
          directDamage = mahoragaAdaptation.adaptedDamage;
          stabilityShock = mahoragaAdaptation.adaptedStabilityShock;
        }
      }
      if (!evasionResult?.evaded && !instantKillOnHit && directDamage > 0 && damageTarget?.type === "character") {
        inverseDamageCurveResolution = resolveDuelInverseDamageCurve(directDamage, damageTarget.resource || opponent, battle, {
          action: action,
          sourceKind: "direct-card"
        });
        if (inverseDamageCurveResolution?.applied) {
          directDamage = Number(inverseDamageCurveResolution.damageAfter || 0);
          if (damageScaleSummary) {
            damageScaleSummary.damageAfterDefenderScaleBeforeInverse = inverseDamageCurveResolution.damageBefore;
            damageScaleSummary.damageAfterInverseDamageCurve = inverseDamageCurveResolution.damageAfter;
            damageScaleSummary.inverseDamageCurveTier = inverseDamageCurveResolution.tier;
            damageScaleSummary.inverseDamageCurveScale = inverseDamageCurveResolution.scale;
          }
        }
      }
      if (!evasionResult?.evaded && instantKillOnHit) {
        directDamage = Math.max(directDamage, Math.ceil(damageTarget?.type === "unit" ? getDuelUnitHp(damageTarget.unit) : Number(opponent.hp || 0)));
        damageApplication = applyDuelHpDamageToTarget(damageTarget, directDamage, battle, { actor: actor, opponent: opponent, blockIgnoreRatio: action.atomicDamagePolicy === "ignore-target-defense" ? 1 : (bloodRuntime?.blockIgnoreRatio ?? action.blockIgnoreRatio ?? 0), ignoreTargetDefense: action.atomicDamagePolicy === "ignore-target-defense" });
      } else if (!evasionResult?.evaded && effects.hutianBlackFlash) {
        var settledHutianBlackFlashDamage = directDamage;
        var hutianBlackFlashRuntimeResult = applyHutianBlackFlashEffect(effects, actor, opponent, {
          battle: battle,
          // Damage has already passed through the canonical panel and action
          // defense pipeline above; this call only resolves healing/stacks.
          skipOpponentDamage: true,
          skipOpponentStatus: damageTarget?.type === "unit"
        });
        hutianBlackFlashResult = {
          ...hutianBlackFlashRuntimeResult,
          directDamageBeforeDefense: hutianBlackFlashRuntimeResult.directDamage,
          directDamage: Number(settledHutianBlackFlashDamage.toFixed(1))
        };
        directDamage = settledHutianBlackFlashDamage;
        damageApplication = applyDuelHpDamageToTarget(damageTarget, directDamage, battle, { actor: actor, opponent: opponent, blockIgnoreRatio: action.atomicDamagePolicy === "ignore-target-defense" ? 1 : (bloodRuntime?.blockIgnoreRatio ?? action.blockIgnoreRatio ?? 0), ignoreTargetDefense: action.atomicDamagePolicy === "ignore-target-defense" });
      } else if (!effects.hutianBlackFlash && directDamage > 0) {
        damageApplication = applyDuelHpDamageToTarget(damageTarget, directDamage, battle, { actor: actor, opponent: opponent, blockIgnoreRatio: action.atomicDamagePolicy === "ignore-target-defense" ? 1 : (bloodRuntime?.blockIgnoreRatio ?? action.blockIgnoreRatio ?? 0), ignoreTargetDefense: action.atomicDamagePolicy === "ignore-target-defense" });
      }
      if (inverseDamageCurveResolution?.applied && damageApplication) {
        damageApplication.inverseDamageCurve = inverseDamageCurveResolution;
      }
    }
    var rctOutputDealsDamage = Boolean(reverseCursedTechniqueOutputResult?.instantKill);
    if (!evasionResult?.evaded && (!reverseCursedTechniqueOutputResult || rctOutputDealsDamage) && hasProjectionSorceryAccess(actor, battle) && Number(damageApplication?.applied || 0) > 0) {
      recordProjectionTurnDamage(battle, side, damageApplication.applied);
    }
    if ((!reverseCursedTechniqueOutputResult || rctOutputDealsDamage) && damageApplication?.applied > 0 && damageTarget?.type === "character") {
      applyProjectionDamageTakenFrameGain(damageTarget, battle, damageApplication.applied);
      projectionReflect = applyProjectionFrameShieldReflect(damageTarget.resource, actor, battle, damageApplication.applied);
    }
    lifeDrainResult = applyDuelLifeDrainAfterDamage(action, actor, opponent, damageTarget, damageApplication, battle);
    if (lifeDrainResult?.hpRestored) {
      actualHealing = Number((actualHealing + Number(lifeDrainResult.hpRestored || 0)).toFixed(1));
    }
    if (directBattleCard && directCeDamage > 0) {
      opponent.ce = Math.max(0, Number(opponent.ce || 0) - directCeDamage);
    }
    if (!evasionResult?.evaded && blackFlashStatus && damageTarget?.type !== "unit") opponent.statusEffects.push(blackFlashStatus);
    if (!evasionResult?.evaded && damageTarget?.type !== "unit") {
      directOpponentCounterResults = applyDirectBattleCounterOperations(effects.opponentCounterOperations, battle, opponent);
      if (pendingOpponentDomainLoadDelta) {
        if (opponent.domain && (isDomainActive(opponent) || directBattleCard)) {
          opponent.domain.load += pendingOpponentDomainLoadDelta;
        } else if (directBattleCard) {
          opponent.domainLoad = Math.max(0, Number(opponent.domainLoad || 0) + pendingOpponentDomainLoadDelta);
        }
      }
      if (pendingOpponentStabilityDelta && !(opponent.statusEffects || []).some(function hasStabilityImmunity(status) { return isDuelStatusEffectActive(status, battle) && status?.stabilityImmune === true; })) {
        opponent.stability = Number(clamp(Number(opponent.stability || 0) + pendingOpponentStabilityDelta, 0, 1).toFixed(4));
      }
      if (pendingOpponentRegenInterference) {
        upsertDuelStatusEffect(opponent, {
          id: "ceRegenInterference",
          label: "咒力回流受扰",
          rounds: 1,
          value: pendingOpponentRegenInterference
        });
      }
      pendingOpponentStatuses.forEach(function addOpponentStatus(status) {
        if (!status?.id) return;
        if (status.id === "lifeDrained" && lifeDrainResult?.active && !lifeDrainResult.triggered) return;
        upsertDuelStatusEffect(opponent, { ...status }, { appliedTurn: getDuelActionTurnNumber(battle) });
      });
    }
    if (stabilityShock > 0 && damageTarget?.type !== "unit" && !(opponent.statusEffects || []).some(function hasStabilityImmunity(status) { return isDuelStatusEffectActive(status, battle) && status?.stabilityImmune === true; })) {
      opponent.stability = Number(clamp(Number(opponent.stability || 0) - stabilityShock, 0, 1).toFixed(4));
    }
    if (!skipStandardDirectHealing && directHealing > 0 && Number(actor.maxHp || 0) > 0) {
      if (isDuelResourceDefeated(actor, battle)) {
        healingBlockedByDefeat = true;
      } else {
        var beforeHealHp = Number(actor.hp || 0);
        actor.hp = Number(clamp(beforeHealHp + directHealing, 0, getDuelActionTemporaryResourceCap(actor, "hp", "maxHp", "temporaryHpOverCap")).toFixed(1));
        actualHealing = Math.max(0, Number((Number(actor.hp || 0) - beforeHealHp).toFixed(1)));
      }
    }
    directDomainActionResult = applyDirectDomainActionRuntime(action, actor, opponent, battle, directResolution);
    starRageResult = applyStarRageResolution(action, actor, battle, actorContext);
    blackBirdResult = applyBlackBirdResolution(action, actor, battle);
    weaponInventoryCurseResult = applyWeaponInventoryCurseCycle(action, actor, battle);
    dhruvOrbitResult = applyDhruvOrbitRuntime(action, actor, battle);
    if (isMahoragaTuningRitualAction(action)) {
      // 魔虚罗调幅仪式：召唤未调幅魔虚罗独立单位，锁定召唤者体势为1
      if (!battle.mahoragaProxy || !battle.mahoragaProxy[side]?.active) {
        // 创建未调幅魔虚罗单位（中立，狂暴），基础数值来自正式 V2 牌库。
        var unitId = "mahoraga_unsubdued_" + side + "_" + (Number(battle.round || 0) + 1);
        var mahoragaUnit = buildRuntimeUnitFromHandInjection("mahoraga_unattuned_unit", {
          id: unitId,
          cardId: "card_unit_mahoraga_unattuned",
          actionId: "unit_mahoraga_unattuned",
          name: "八握剑异戒神将 魔虚罗",
          label: "八握剑异戒神将 魔虚罗（未调幅）",
          side: "neutral",
          ownerSide: side,
          controllerSide: "neutral",
          control: "neutral_berserk",
          placement: "battlefield",
          tags: ["魔虚罗", "狂暴", "适应"],
          active: true,
          spawnedBy: action.id,
          spawnedRound: Number(battle.round || 0) + 1,
          durationRounds: 0,
          expiresAfterRound: 0,
          adaptationMemory: {}
        });
        // 标记十影一次召唤（同满象）
        if (!battle.tenShadowsSummonState) battle.tenShadowsSummonState = {};
        if (!battle.tenShadowsSummonState[side]) battle.tenShadowsSummonState[side] = {};
        battle.tenShadowsSummonState[side]["mahoraga_unsubdued_unit"] = {
          unitId: unitId,
          unitName: mahoragaUnit.name,
          uniqueTenShadowsSummon: true
        };
        getDuelBattlefieldUnits(battle).push(mahoragaUnit);

        // 锁定召唤者 HP = 1
        actor.hp = 1;
        actor.statusEffects = (actor.statusEffects || []).filter(function(e) {
          return e.id !== "mahoragaSubstitute";
        });
        actor.statusEffects.push(cloneDuelPlain(
          (getDuelCharacterV2RuntimeProfile("mahoragaProxy") || {}).statusEffect
          || { id: "mahoragaSubstitute", label: "八握剑异戒神将 魔虚罗 代打中", rounds: 999, value: 1 }
        ));
        battle.actionUiMessage = "八握剑异戒神将 魔虚罗 代打中";

        // 建立 proxy 状态记录
        battle.mahoragaProxy ||= {};
        battle.mahoragaProxy[side] = {
          active: true,
          side: side,
          unitId: unitId,
          startedRound: Number(battle.round || 0) + 1,
          ritualActionId: action.id
        };

        mahoragaProxyResult = { active: true, unitId: unitId, name: mahoragaUnit.name };
      } else {
        mahoragaProxyResult = { active: false, reason: "魔虚罗已经存在于战场" };
      }
    } else {
      summonResult = applyDuelSummonAction(action, actor, battle);
    }
    var customAtomicPostResults = applyCustomAtomicPostRuntime(customAtomicRuntime, actor, opponent, battle, {
      missed: Boolean(evasionResult?.evaded),
      action: action,
      hpCost: hpCost,
      ceCost: costCe
    });
    var customAtomicTurnEndResults = action.selectedLast !== false
      ? settleCustomAtomicTurnEndEffects(actor, opponent, battle)
      : [];
    maintenanceResult = applyDuelMaintenanceAction(action, actor, battle);
    if (action.selectedLast === true || action.resolveSummonAssist === true) {
      summonAssistResult = applyDuelSummonAssist(actor, opponent, battle);
    }
    protectMahoragaSummoners(battle);

    var contextOutgoingScaleBeforeUpdate = Math.max(0, Number(actorContext.outgoingScale || 1));
    var effectOutgoingScale = Math.max(0, Number(effects.outgoingScale || 1));
    var blockIncomingHpScale = getDuelBlockIncomingHpScale(action, numericPreview, effects, tacticActionModifiers);
    var defenseWasPrecommitted = consumeDuelPrecommittedDefenseMarker(battle, side, action);
    if (directDamageBeforeScale > 0 && contextOutgoingScaleBeforeUpdate !== 1 && actorContext.consumeOutgoingScaleOnDamage !== false) {
      actorContext.outgoingScale = 1;
      actorContext.consumeOutgoingScaleOnDamage = true;
    }
    if (effectOutgoingScale !== 1) actorContext.outgoingScale *= effectOutgoingScale;
    if (effects.consumeOutgoingScaleOnDamage === false) actorContext.consumeOutgoingScaleOnDamage = false;
    if (effects.rangeAdjustment) {
      actorContext.nextAttackAoe = true;
      actorContext.nextAttackAoeDamageScale = Math.max(0, Number(effects.rangeAdjustmentDamageScale || 0.6));
    }
    if (!defenseWasPrecommitted) {
      actorContext.incomingHpScale *= Number(effects.incomingHpScale ?? 1);
      actorContext.cardBlockIncomingHpScale *= blockIncomingHpScale;
      actorContext.incomingHpReductionCap += Math.max(0, Number(effects.incomingHpReductionCap || 0));
      if (bloodRuntime?.active && Number(effects.incomingHpReductionCapFromBloodHpCostMultiplier || 0) > 0) {
        actorContext.incomingHpReductionCap += Math.max(0, Number((hpCost * Number(effects.incomingHpReductionCapFromBloodHpCostMultiplier || 0)).toFixed(1)));
      }
      actorContext.incomingCeScale *= Number(effects.incomingCeScale ?? 1);
      actorContext.sureHitScale *= Number(effects.sureHitScale ?? 1);
      actorContext.domainPressureScale *= Number(effects.domainPressureScale ?? 1);
      actorContext.manualAttackScale *= Number(effects.manualAttackScale ?? 1);
      actorContext.domainLoadScale *= Number(effects.domainLoadScale ?? 1);
      actorContext.evasionBonus += Number(effects.evasionBonus || 0);
    }
    actorContext.actionLabels.push(action.label);
    addDuelActionWeightDeltas(actorContext, effects.weightDeltas);
    // A targeted weight debuff belongs to the attack packet: once an
    // evadable action misses, it must not silently alter the defender's AI
    // weights. Non-checked actions (summons, environment effects and the
    // explicit `none` profile) are authored as unavoidable auras and keep
    // their weight deltas.
    if (!evasionResult?.checked || !evasionResult?.evaded) {
      addDuelActionWeightDeltas(opponentContext, effects.opponentWeightDeltas);
    }
    var domainSpecificResult = action.domainSpecific
      ? applyDuelDomainSpecificAction(action, actor, opponent, battle)
      : null;
    if (action.selectedLast || action.projectionSettleTurn) {
      projectionSettlement = settleProjectionTurnFrameGain(actor, battle);
    }
    clampDuelResource(actor);
    clampDuelResource(opponent);
    if (bloodConversionResult?.allowOverCap) {
      actor.hp = bloodConversionResult.afterHp;
      actor.ce = bloodConversionResult.afterCe;
      syncBloodManipulationTemporaryOverCap(actor);
      recordBloodManipulationConversionChange(battle, side, actor, bloodConversionResult);
    }

    var mitigationPanelPrevented = Math.max(0, Number(damageScaleSummary?.panelDefensePreventedDamage || 0));
    var mitigationScalePrevented = Math.max(0, Number(damageScaleSummary?.defenderPreventedDamage || 0));
    var mitigationBlocked = Math.max(0, Number(damageApplication?.blocked || 0));
    var mitigationReduced = Math.max(0, Number(damageApplication?.reduced || 0));
    var mitigationShield = Math.max(0, Number(damageApplication?.shieldAbsorbed || 0));
    var mitigationInversePrevented = Math.max(0, Number(inverseDamageCurveResolution?.prevented || 0));
    var mitigationInverseAmplified = Math.max(0, Number(inverseDamageCurveResolution?.amplified || 0));
    var mitigationTargetPrevented = mitigationBlocked + mitigationReduced + mitigationShield;
    var mitigationTotalPrevented = mitigationPanelPrevented + mitigationScalePrevented + mitigationInversePrevented + mitigationTargetPrevented;
    var damageMitigation = directDamageBeforeScale > 0 || damageApplication
      ? {
          targetSide: damageTarget?.side || opponentSide,
          targetType: damageTarget?.type || damageApplication?.targetType || "",
          targetId: damageTarget?.id || damageApplication?.targetId || "",
          targetName: damageTarget?.name || damageApplication?.targetName || opponent?.name || "",
          incomingBeforeDefense: Number(Math.max(0, Number(damageScaleSummary?.damageBeforeDefenderScale ?? directDamage ?? 0) + mitigationPanelPrevented).toFixed(1)),
          afterScaleDefense: Number(Math.max(0, Number(damageScaleSummary?.damageAfterDefenderScale ?? directDamage ?? 0)).toFixed(1)),
          panelDefensePrevented: Number(mitigationPanelPrevented.toFixed(1)),
          scalePrevented: Number(mitigationScalePrevented.toFixed(1)),
          inversePrevented: Number(mitigationInversePrevented.toFixed(1)),
          inverseAmplified: Number(mitigationInverseAmplified.toFixed(1)),
          blocked: Number(mitigationBlocked.toFixed(1)),
          reduced: Number(mitigationReduced.toFixed(1)),
          shieldAbsorbed: Number(mitigationShield.toFixed(1)),
          targetPrevented: Number(mitigationTargetPrevented.toFixed(1)),
          totalPrevented: Number(mitigationTotalPrevented.toFixed(1)),
          applied: Number(Math.max(0, Number(damageApplication?.applied || 0)).toFixed(1))
        }
      : null;

    if (towerInverseDamageAdjustment?.applied) {
      var towerInverseLogDetail = towerInverseDamageAdjustment.detail + " 直接伤害在普通防御前 " +
        Number(towerInverseDamageAdjustment.damageBefore || 0).toFixed(1) + "→" +
        Number(towerInverseDamageAdjustment.damageAfter || 0).toFixed(1) + "（×" +
        Number(towerInverseDamageAdjustment.scale || 1).toFixed(2) + "）" +
        (evasionResult?.evaded ? "；随后被闪避。" : "。");
      recordDuelResourceChange(battle, {
        side: opponentSide,
        title: towerInverseDamageAdjustment.label || "强弱颠倒",
        detail: towerInverseLogDetail,
        type: "special",
        delta: {
          towerInverseDamageBefore: towerInverseDamageAdjustment.damageBefore,
          towerInverseDamageAfter: towerInverseDamageAdjustment.damageAfter,
          towerInverseScale: towerInverseDamageAdjustment.scale,
          towerInverseReason: towerInverseDamageAdjustment.reason || ""
        }
      });
    }

    var result = {
      costCe: costCe,
      hpCost: hpCost,
      actorCe: Number((actor.ce - before.actorCe).toFixed(1)),
      actorHp: Number((actor.hp - before.actorHp).toFixed(1)),
      actorStability: Number((actor.stability - before.actorStability).toFixed(4)),
      actorDomainLoad: Number(((actor.domain?.load || 0) - before.actorDomainLoad).toFixed(1)),
      opponentStability: Number((opponent.stability - before.opponentStability).toFixed(4)),
      opponentHp: Number((opponent.hp - before.opponentHp).toFixed(1)),
      opponentDomainLoad: Number(((opponent.domain?.load || 0) - before.opponentDomainLoad).toFixed(1)),
      domainActivated: !before.actorDomainActive && Boolean(actor.domain?.active),
      domainReleased: before.actorDomainActive && !actor.domain?.active,
      directDamage: directDamage,
      directDamageBeforeScale: directDamageBeforeScale,
      damageApplied: Number(damageApplication?.applied || 0),
      damageBlocked: Number(mitigationTargetPrevented.toFixed(1)),
      damageScale: damageScaleSummary || undefined,
      damageMitigation: damageMitigation || undefined,
      towerInverseDamageAdjustment: towerInverseDamageAdjustment || undefined,
      inverseDamageCurve: inverseDamageCurveResolution || undefined,
      inverseDamageCurveActivated: inverseDamageCurveActivation || undefined,
      bodyHopping: bodyHoppingResult || undefined,
      rikaArsenalCopiedSpecialResourceBypass: rikaArsenalCopyDamageScale !== 1 ? { damageScale: rikaArsenalCopyDamageScale, bloodExcluded: !isBloodManipulationAction(action) } : undefined,
      blockIncomingHpScale: blockIncomingHpScale !== 1 ? blockIncomingHpScale : undefined,
      directHealing: directHealing,
      directShield: directShield || undefined,
      directCard: directBattleCard || undefined,
      directScaling: directBattleCard ? directResolution?.multipliers : undefined,
      highCeActive: directBattleCard ? directResolution?.highCeActive : undefined,
      directCeDamage: directBattleCard ? directCeDamage : undefined,
      tactic: {
        id: tacticActionModifiers.tacticId,
        label: tacticActionModifiers.tacticLabel,
        category: tacticActionModifiers.category,
        damageScale: tacticActionModifiers.damageScale,
        ceCostScale: tacticActionModifiers.ceCostScale,
        healingScale: tacticActionModifiers.healingScale,
        blockScale: tacticActionModifiers.blockScale,
        hitRateBonus: tacticActionModifiers.hitRateBonus,
        incomingDamageScale: tacticDefenseModifiers.incomingDamageScale,
        evasionBonus: tacticDefenseModifiers.evasionBonus
      },
      actorHealing: actualHealing,
      healingBlockedByDefeat: healingBlockedByDefeat || undefined,
      instantKillOnHit: Boolean(!evasionResult?.evaded && (action.instantKillOnHit || effects.instantKillOnHit)),
      evasion: evasionResult?.checked ? evasionResult : undefined,
      blackFlashTriggered: Boolean(!evasionResult?.evaded && (blackFlashWindow || effects.hutianBlackFlash)),
      blackFlashLabel: !evasionResult?.evaded && effects.hutianBlackFlash ? "黑闪！" : (!evasionResult?.evaded && blackFlashWindow ? (actor?.characterCardProfile?.isZeroCe ? "极限打击窗口" : "黑闪") : ""),
      blackFlashDamageBefore: blackFlashWindow ? blackFlashDamageBefore : undefined,
      blackFlashDamageBonus: blackFlashWindow ? blackFlashDamageBonus : undefined,
      blackFlashSourceActionId: blackFlashWindow ? (action.id || "") : undefined,
      hutianBlackFlash: hutianBlackFlashResult || undefined,
      damageTarget: damageTarget ? {
        type: damageTarget.type,
        id: damageTarget.id || "",
        name: damageTarget.name || "",
        side: damageTarget.side || "",
        intercepted: Boolean(damageTarget.intercepted),
        selectionMode: damageTarget.selectionMode || ""
      } : undefined,
      damageApplication: damageApplication || undefined,
      rangeAdjustment: rangeAdjustmentAoeResult ? {
        aoe: true,
        damageScale: Number(rangeAdjustmentDamageScale.toFixed(4)),
        result: rangeAdjustmentAoeResult
      } : undefined,
      bloodManipulation: bloodRuntime ? {
        ceCostRatio: Number(action.bloodCeCostRatio || 0),
        hpCostRatio: Number(action.bloodHpCostRatio || 0),
        actualCeCost: Number(costCe || 0),
        actualHpCost: Number(hpCost || 0),
        effectiveHpCost: bloodRuntime.effectiveHpCost,
        hpDamageSoftCap: bloodRuntime.hpDamageSoftCap,
        bloodHpToDamageScale: bloodRuntime.bloodHpToDamageScale,
        originalBaseDamage: bloodRuntime.originalBaseDamage,
        damageFromCeCost: bloodRuntime.damageFromCeCost,
        damageFromHpCost: bloodRuntime.damageFromHpCost,
        damageFromBlood: bloodRuntime.damageFromBlood,
        damageFromPierce: bloodRuntime.damageFromPierce,
        dynamicDamage: bloodRuntime.dynamicDamage,
        settledFromActualCeCost: Boolean(bloodRuntime.settledFromActualCeCost),
        settledFromActualHpCost: Boolean(bloodRuntime.settledFromActualHpCost),
        bloodPierceRatio: bloodRuntime.bloodPierceRatio,
        bloodBoostRatio: bloodRuntime.bloodBoostRatio,
        blockIgnoreRatio: bloodRuntime.blockIgnoreRatio,
        armorBreakRatio: bloodRuntime.armorBreakRatio,
        resourceRole: bloodRuntime.resourceRole,
        resourceBefore: bloodRuntime.resourceBefore,
        resourceCost: bloodRuntime.resourceCost,
        resourceGain: bloodRuntime.resourceGain,
        resourceAfterPreview: bloodRuntime.resourceAfterPreview,
        previewLines: bloodRuntime.previewLines,
        resource: bloodResourceState || undefined,
        conversion: bloodConversionResult || undefined,
        clearedAfterDamage: false,
        resetsOnNextRound: false,
        persistentAcrossRounds: true
      } : undefined,
      starRage: starRageRuntime ? starRageResult || { massBefore: starRageRuntime.massBefore } : (starRageSingleCardBonus || undefined),
      blackBirdManipulation: blackBirdRuntime ? blackBirdResult || { feathersBefore: blackBirdRuntime.feathersBefore, maxFeathersBefore: blackBirdRuntime.maxFeathersBefore } : undefined,
      weaponInventoryCurse: weaponInventoryCurseResult || weaponInventoryLoadoutResult || undefined,
      dhruvOrbit: dhruvOrbitResult || action.dhruvTrackingScreenRuntime || undefined,
      blackRope: blackRopeResult || undefined,
      contractTickets: contractTicketResult || undefined,
      comedian: comedianResult || undefined,
      kusakabeGuard: kusakabeResult || undefined,
      disasterResource: disasterResourceResult || undefined,
      lifeDrain: lifeDrainResult || undefined,
      tacticalHumanResource: tacticalHumanResourceResult || undefined,
      directCounters: directSelfCounterResults.length || directOpponentCounterResults.length ? {
        self: directSelfCounterResults,
        opponent: directOpponentCounterResults
      } : undefined,
      atomicAoe: atomicAoeActive ? {
        aoe: true,
        scope: atomicTargeting?.scope || "all-enemies",
        damageScale: Number(atomicAoeDamageScale.toFixed(4)),
        result: atomicAoeResult
      } : undefined,
      directDomainAction: directDomainActionResult || undefined,
      mythicalBeastAmber: mythicalBeastAmberResult || mythicalBeastAmberChargeDamage ? {
        ...(mythicalBeastAmberResult || {}),
        chargeDamage: mythicalBeastAmberChargeDamage || undefined
      } : undefined,
      projectionSorcery: projectionResult || projectionOutOfFrameResult || projectionSettlement || projectionReflect ? {
        runtime: action.projectionRuntime || undefined,
        immediate: projectionResult || undefined,
        outOfFrame: projectionOutOfFrameResult || undefined,
        settlement: projectionSettlement || undefined,
        reflect: projectionReflect || undefined
      } : undefined,
      reverseCursedTechniqueOutput: reverseCursedTechniqueOutputResult || undefined,
      guardIntercepted: Boolean(damageTarget?.intercepted),
      summon: summonResult ? {
        unitId: summonResult.unit?.id || "",
        unitName: summonResult.unit?.name || "",
        side: summonResult.unit?.side || "",
        ownerSide: summonResult.unit?.ownerSide || "",
        control: summonResult.unit?.control || "",
        hp: summonResult.unit?.hp || 0,
        maxHp: summonResult.unit?.maxHp || 0,
        damage: summonResult.unit?.damage || 0,
        maintenanceActionId: summonResult.maintenanceCard?.id || "",
        grantedHandCards: (summonResult.grantedHandCards || []).map(function mapGrantedCard(card) {
          return card?.id || card?.actionId || card?.cardId || "";
        }).filter(Boolean)
      } : undefined,
      maintenance: maintenanceResult || undefined,
      summonUpkeep: summonUpkeepResult || undefined,
      summonAssist: summonAssistResult || undefined,
      mahoragaProxy: mahoragaProxyResult || undefined,
      mahoragaAdaptation: mahoragaAdaptation || undefined,
      rikaArsenalPending: rikaArsenalPending || undefined,
      maximumUzumaki: maximumUzumakiResult ? {
        ...maximumUzumakiResult,
        aoeResult: maximumUzumakiAoeResult || undefined
      } : undefined,
      specialResolution: specialResolutionResult || undefined,
      specialConstitution: specialConstitutionResult || undefined,
      numericPreview: numericPreview,
      mechanicsApplied: mechanicsApplied.map(function mapMechanic(mechanic) {
        return {
          id: mechanic.id || "",
          label: mechanic.label || mechanic.id || "",
          logTemplate: mechanic.logTemplate || mechanic.effectSummary || ""
        };
      }),
      domainSpecific: domainSpecificResult || undefined,
      customAtomic: customAtomicRuntime?.effects?.length ? {
        applied: customAtomicRuntime.applied,
        skipped: customAtomicRuntime.skipped,
        pre: customAtomicRuntime.pre,
        post: customAtomicPostResults,
        turnEnd: customAtomicTurnEndResults.length ? customAtomicTurnEndResults : undefined,
        timers: customAtomicTimerResults.length ? customAtomicTimerResults : undefined
      } : undefined
    };
    if (effects.dounaImmediateWorldSlash && battle.dounaGauntlet) {
      battle.dounaGauntlet.worldSlashUsed = true;
      if (effects.dounaSecondLifeBoundWorldSlash || action.type === "douna_bound_world_slash") {
        battle.dounaGauntlet.boundWorldSlashLastRound = Number(battle.round || 0) + 1;
        battle.dounaGauntlet.boundWorldSlashUsed = true;
      }
    }
    recordDounaActionDamage(action, actor, opponent, result, battle);
    appendDuelActionLog(action, actor, opponent, result, battle);
    return result;
  }

  function applyDuelDomainSpecificAction(action, actor, opponent, duelState) {
    return callDependency("applyDuelDomainSpecificAction", [action, actor, opponent, duelState]);
  }

  function appendDuelActionLog(action, actor, opponent, result, duelState) {
    return callDependency("appendDuelActionLog", [action, actor, opponent, result, duelState]);
  }

  function recordDounaActionDamage(action, actor, opponent, result, duelState) {
    var recorder = getOptionalDependency("recordDounaActionDamage");
    if (typeof recorder === "function") recorder(action, actor, opponent, result, duelState);
  }

  function getDuelCpuAction(actor, opponent, duelState) {
    var battle = getBattle(duelState);
    var pool = buildDuelActionPool(actor, opponent, battle).filter(function availableOnly(action) {
      return action.available;
    });
    if (!pool.length) return null;
    var profile = getDuelProfileForSide(battle, actor?.side || "");
    var domainResponse = getDuelDomainResponseProfile(profile || {}, actor, opponent, battle);
    var hpRatio = actor.maxHp ? actor.hp / actor.maxHp : 0;
    var ceRatio = actor.maxCe ? actor.ce / actor.maxCe : 0;
    var domainRisk = actor.domain?.threshold ? actor.domain.load / actor.domain.threshold : 0;
    var preferred = [];
    if (actor.domain?.active && domainRisk > 0.75) preferred.push("domain_release", "domain_compress");
    if (isDuelOpponentDomainThreat(opponent, actor, battle)) preferred.push(...domainResponse.allowedDomainResponseActions, "defensive_frame");
    if (hpRatio < 0.36) preferred.push("defensive_frame", "ce_compression");
    if (ceRatio < 0.24) preferred.push("residue_reading", "ce_compression");
    if (actor.domain?.active && domainRisk < 0.45) preferred.push("domain_force_sustain");
    if (!actor.domain?.active && ceRatio > 0.5) preferred.push("domain_expand", "technique_interference", "ce_reinforcement");
    preferred.push("technique_interference", "ce_reinforcement", "defensive_frame", "residue_reading");
    return preferred.map(function findPreferred(id) {
      return pool.find(function findAction(action) {
        return action.id === id;
      });
    }).find(Boolean) ||
      pool.sort(function sortByScore(a, b) {
        return scoreDuelActionCandidate(b, actor, opponent, battle) - scoreDuelActionCandidate(a, actor, opponent, battle);
      })[0];
  }

  function resolveMahoragaTurnEndAttack(battle) {
    if (!battle || !battle.mahoragaProxy) return null;
    var results = [];
    Object.keys(battle.mahoragaProxy).forEach(function(side) {
      var state = battle.mahoragaProxy[side];
      if (!state.active) return;
      var unit = getDuelBattlefieldUnits(battle).find(function(u) {
        return u.id === state.unitId && u.active;
      });
      if (!unit) return;
      // 确定攻击目标：优先攻击十影召唤者（若未影中藏身）
      
      var opponentSide = side === "left" ? "right" : "left";
      var opponent = callDependency("getDuelResourcePair", [battle, opponentSide]);
      var owner = callDependency("getDuelResourcePair", [battle, side]);
      if (!opponent) return;
      var regen = Math.max(0, Number(unit.mahoragaTurnEndHpRegen || unit.unitStats?.mahoragaTurnEndHpRegen || 0));
      if (regen > 0) {
        unit.currentHp = Math.min(Number(unit.maxHp || 0), Number(unit.currentHp || unit.hp || 0) + regen);
        unit.hp = unit.currentHp;
      }
      var damage = Math.max(0, Number(unit.damage || unit.unitStats?.damage || 200));
      var instantKill = isMahoragaSummonUnit(unit) && isDuelCurseTarget(opponent);
      var damageTarget = {
        type: "character",
        resource: opponent,
        id: opponent.id || opponentSide,
        name: opponent.name || opponentSide,
        side: opponentSide
      };
      var damageApplication;
      if (instantKill) {
        damage = Math.max(0, Number(opponent.hp || 0));
        damageApplication = applyDuelInstantKillToTarget(damageTarget, battle, "mahoraga_curse_instant_kill");
      } else {
        damageApplication = applyDuelStandardDamageToTarget(damageTarget, damage, battle, {
          actor: owner,
          opponent: opponent,
          action: {
            id: "mahoraga_turn_end_attack",
            label: (unit.name || "魔虚罗") + "·回合末攻击",
            cardType: "summon_unit_attack"
          },
          sourceKind: "summon",
          source: "mahoraga-turn-end",
          sourceLabel: (unit.name || "魔虚罗") + "·回合末攻击",
          blockIgnoreRatio: Math.max(0, Number(unit.blockIgnoreRatio ?? unit.unitStats?.blockIgnoreRatio ?? 0))
        });
      }
      // 稳定性冲击
      opponent.stability = Number(clamp((opponent.stability || 0) - 0.02, 0, 1).toFixed(4));
      results.push({
        side: side,
        targetSide: opponentSide,
        unitId: unit.id,
        damage: damage,
        damageApplied: Number(damageApplication?.applied || 0),
        damageApplication: damageApplication || undefined,
        damageMitigation: damageApplication?.damageMitigation || undefined,
        instantKill: instantKill,
        instantKillReason: instantKill ? "mahoraga_curse_instant_kill" : undefined,
        unitHpAfterRegen: unit.hp,
        targetHpAfter: opponent.hp
      });
    });
    return results;
  }

  var implementations = {
    getDuelActionTemplates: getDuelActionTemplates,
    buildDuelActionPool: buildDuelActionPool,
    pickDuelActionChoices: pickDuelActionChoices,
    getDuelActionCost: getDuelActionCost,
    getDuelActionHpCost: getDuelActionHpCost,
    getDuelActionAvailability: getDuelActionAvailability,
    normalizeDuelDomainState: normalizeDuelDomainState,
    applyDuelActionEffect: applyDuelActionEffect,
    getDuelActionContext: getDuelActionContext,
    applyDuelStandardDamageToTarget: applyDuelStandardDamageToTarget,
    getDuelRoundDamageScale: getDuelRoundDamageScale,
    primeDuelLockedDefenseActions: primeDuelLockedDefenseActions,
    getDuelMiracleStockpile: getDuelMiracleStockpile,
    setDuelMiracleStockpile: setDuelMiracleStockpile,
    applyDuelMiracleLethalPrevention: applyDuelMiracleLethalPrevention,
    resolveDuelMiracleLethalPreventionForBattle: resolveDuelMiracleLethalPreventionForBattle,
    getDuelCpuAction: getDuelCpuAction,
    buildDuelDomainSpecificActions: buildDuelDomainSpecificActions,
    getActiveTemporaryTechniqueGrants: getActiveTemporaryTechniqueGrants,
    invalidateDuelActionChoices: invalidateDuelActionChoices,
    getDuelActionRiskLabel: getDuelActionRiskLabel,
    getDuelActionContext: getDuelActionContext,
    buildDuelActionTemplateIndexes: buildDuelActionTemplateIndexes,
    getDuelActionTemplateIndex: getDuelActionTemplateIndex,
    warmDuelActionTemplateCache: warmDuelActionTemplateCache,
    invalidateDuelActionTemplateCache: invalidateDuelActionTemplateCache,
    buildDuelMechanicTemplateIndexes: buildDuelMechanicTemplateIndexes,
    getDuelMechanicTemplateIndex: getDuelMechanicTemplateIndex,
    warmDuelMechanicTemplateCache: warmDuelMechanicTemplateCache,
    invalidateDuelMechanicTemplateCache: invalidateDuelMechanicTemplateCache,
    getDuelMechanicTemplateById: getDuelMechanicTemplateById,
    collectDuelMechanicsForAction: collectDuelMechanicsForAction,
    getCustomAtomicHandPolicy: getCustomAtomicHandPolicy
  };

  var api = {
    metadata: Object.freeze({
      namespace: namespace,
      version: version,
      layer: "duel-actions",
      moduleFormat: "classic-script-iife",
      scriptType: "classic",
      behavior: "implementation",
      ownsBehavior: true
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
    bindDependency: bindDependency,
    configure: configure,
    registerDependencies: registerDependencies,
    hasDependency: hasDependency,
    listDependencies: listDependencies,
    clearDependencies: clearDependencies,
    getDuelActionTemplates: getDuelActionTemplates,
    buildDuelActionPool: buildDuelActionPool,
    pickDuelActionChoices: pickDuelActionChoices,
    getDuelActionCost: getDuelActionCost,
    getDuelActionHpCost: getDuelActionHpCost,
    getDuelActionAvailability: getDuelActionAvailability,
    normalizeDuelDomainState: normalizeDuelDomainState,
    applyDuelActionEffect: applyDuelActionEffect,
    getDuelActionContext: getDuelActionContext,
    applyDuelStandardDamageToTarget: applyDuelStandardDamageToTarget,
    getDuelRoundDamageScale: getDuelRoundDamageScale,
    primeDuelLockedDefenseActions: primeDuelLockedDefenseActions,
    getDuelMiracleStockpile: getDuelMiracleStockpile,
    setDuelMiracleStockpile: setDuelMiracleStockpile,
    applyDuelMiracleLethalPrevention: applyDuelMiracleLethalPrevention,
    resolveDuelMiracleLethalPreventionForBattle: resolveDuelMiracleLethalPreventionForBattle,
    getDuelCpuAction: getDuelCpuAction,
    buildDuelDomainSpecificActions: buildDuelDomainSpecificActions,
    getActiveTemporaryTechniqueGrants: getActiveTemporaryTechniqueGrants,
    invalidateDuelActionChoices: invalidateDuelActionChoices,
    buildDuelActionTemplateIndexes: buildDuelActionTemplateIndexes,
    getDuelActionTemplateIndex: getDuelActionTemplateIndex,
    warmDuelActionTemplateCache: warmDuelActionTemplateCache,
    invalidateDuelActionTemplateCache: invalidateDuelActionTemplateCache,
    buildDuelMechanicTemplateIndexes: buildDuelMechanicTemplateIndexes,
    getDuelMechanicTemplateIndex: getDuelMechanicTemplateIndex,
    warmDuelMechanicTemplateCache: warmDuelMechanicTemplateCache,
    invalidateDuelMechanicTemplateCache: invalidateDuelMechanicTemplateCache,
    getDuelMechanicTemplateById: getDuelMechanicTemplateById,
    normalizeDuelMechanicIds: normalizeDuelMechanicIds,
    collectDuelMechanicsForAction: collectDuelMechanicsForAction,
    isCopyableTechniqueCard: isCopyableTechniqueCard,
    getCopyableTechniqueCardPool: getCopyableTechniqueCardPool,
    pickCopyableTechniqueCard: pickCopyableTechniqueCard,
    isCopiedTechniqueSpecialResourceCard: isCopiedTechniqueSpecialResourceCard,
    prepareDirectBattleCardRuntimeAction: prepareDirectBattleCardRuntimeAction,
    prepareDirectBattleCardHandAction: prepareDirectBattleCardHandAction,
    isCommonDuelBattleCardDefinition: isCommonDuelBattleCardDefinition,
    applyDuelSummonAction: applyDuelSummonAction,
    resolveMahoragaTurnEndAttack: resolveMahoragaTurnEndAttack,
    getCustomAtomicHandPolicy: getCustomAtomicHandPolicy,
    orderCustomAtomicActionEntries: orderCustomAtomicActionEntries,
    getCustomAtomicControllerSide: getCustomAtomicControllerSide,
    settleCustomAtomicTurnEndEffects: settleCustomAtomicTurnEndEffects,
    dispatchCustomAtomicTrigger: dispatchCustomAtomicTrigger,
    __test: Object.freeze({
      isDuelCursedSpiritTarget: isDuelCursedSpiritTarget,
      getAngelRuntimeAction: getAngelRuntimeAction,
      applyMahoragaAdaptation: applyMahoragaAdaptation,
      settleProjectionTurnFrameGain: settleProjectionTurnFrameGain,
      getCustomAtomicEffects: getCustomAtomicEffects,
      applyCustomAtomicActionTransforms: applyCustomAtomicActionTransforms,
      getCustomAtomicActionAvailability: getCustomAtomicActionAvailability,
      getCustomAtomicHandPolicy: getCustomAtomicHandPolicy,
      prepareCustomAtomicRuntime: prepareCustomAtomicRuntime,
      applyCustomAtomicPostOperation: applyCustomAtomicPostOperation,
      applyDuelHpDamageToTarget: applyDuelHpDamageToTarget,
      applyCustomAtomicPostRuntime: applyCustomAtomicPostRuntime,
      settleCustomAtomicTimers: settleCustomAtomicTimers,
      settleCustomAtomicTurnEndEffects: settleCustomAtomicTurnEndEffects,
      dispatchCustomAtomicTrigger: dispatchCustomAtomicTrigger,
      buildCustomDuelOwnerTechniqueFamily: buildCustomDuelOwnerTechniqueFamily,
      normalizeOwnedCustomDuelSpecialAction: normalizeOwnedCustomDuelSpecialAction,
      getCustomAtomicHpCostConfig: getCustomAtomicHpCostConfig,
      syncCustomAtomicCounterModifiers: syncCustomAtomicCounterModifiers
    }),
    getDuelActionCacheStats: function getDuelActionCacheStats() {
      return {
        actionIndexReady: Boolean(actionTemplateIndexCache),
        mechanicIndexReady: Boolean(mechanicTemplateIndexCache),
        actionLastInvalidatedAt: performanceCacheStats.actionLastInvalidatedAt,
        mechanicLastInvalidatedAt: performanceCacheStats.mechanicLastInvalidatedAt
      };
    }
  };

  global[namespace] = api;
})(globalThis);
