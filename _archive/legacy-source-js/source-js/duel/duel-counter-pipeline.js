const COUNTER_SCHEMA = "jjk-duel-counter-state-v1";
const COUNTER_VERSION = 4;

function definition(label, max, options = {}) {
  return Object.freeze({
    label,
    min: Number.isFinite(Number(options.min)) ? Number(options.min) : 0,
    max: Number(max),
    initial: Number.isFinite(Number(options.initial)) ? Number(options.initial) : 0,
    format: String(options.format || "number"),
    visible: options.visible !== false,
    roundScoped: options.roundScoped === true,
    ownerTags: Object.freeze((Array.isArray(options.ownerTags) ? options.ownerTags : []).map(String)),
    allowExternalTarget: options.allowExternalTarget === true
  });
}

// 唯一合法地址表。运行数据只能修改这里声明过的计数器，不能临时创建术式或扩大上限。
const COUNTER_DEFINITIONS = Object.freeze({
  "black_rope:length": definition("黑绳剩余长度", 5),
  "contract_recreation:tickets": definition("契约票据", 8),
  "comedian:humor": definition("笑点", 6),
  "comedian:cold": definition("冷场负担", 4),
  "comedian:taboo": definition("禁忌负担", 80),
  "kusakabe:stance": definition("新阴流架势", 5),
  "disaster:flameHeat": definition("火焰热度", 6),
  "disaster:curseSeeds": definition("咒种", 6),
  "disaster:seaLayers": definition("海潮层数", 6),
  "disaster:poxCountdown": definition("疱疮倒计时", 3),
  "tactical_resource:ratioWeakpoint": definition("十划弱点", 4),
  "tactical_resource:throatStrain": definition("咒言喉咙负担", 6),
  "tactical_resource:boogieTempo": definition("不义游戏节奏", 5),
  "tactical_resource:constructionMaterial": definition("构筑材料", 6),
  "tactical_resource:nailMarks": definition("钉痕", 5),
  "tactical_resource:iceLayers": definition("冰凝层数", 6),
  "tactical_resource:skyFold": definition("天空折叠", 6),
  "tactical_resource:graniteCharge": definition("花岗岩蓄力", 6),
  "tactical_resource:cursedObjectSediment": definition("咒物沉积", 6),
  "tactical_resource:pandaCoreCharge": definition("熊猫核心充能", 5),
  "limitless:blue": definition("苍", 999, { ownerTags: ["limitless"] }),
  "limitless:purple_ready": definition("虚式·茈许可", 1, { ownerTags: ["limitless"], visible: false }),
  // 赤血 v4：血与穿是跨回合保留的整数资源，不再是当回合被动百分比。
  "blood_manipulation:pierce": definition("穿", 6, { format: "number" }),
  "blood_manipulation:blood": definition("血", 8, { format: "number" }),
  "blood_manipulation:_round": definition("内部回合", 10000, { visible: false }),
  "star_rage:virtual_mass": definition("虚拟质量", 7, { ownerTags: ["star_rage"] }),
  "star_rage:_round": definition("内部回合", 10000, { visible: false, ownerTags: ["star_rage"] }),
  "star_rage:_base": definition("内部基准", 7, { visible: false, ownerTags: ["star_rage"] }),
  "star_rage:_auto_progress": definition("内部进度", 1, { visible: false, ownerTags: ["star_rage"] }),
  "star_rage:_single_card_bonus_round": definition("内部触发回合", 10000, { visible: false, ownerTags: ["star_rage"] }),
  "black_bird_manipulation:feathers": definition("乌羽", 16, { initial: 16 }),
  "black_bird_manipulation:feather_limit": definition("乌羽上限", 16, { initial: 16 }),
  "black_bird_manipulation:_initial_feathers": definition("内部初始乌羽", 16, { initial: 16, visible: false }),
  "projection_sorcery:projectionFrame": definition("投射帧率", 24, { ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:frame_rate": definition("投射帧率", 24, { ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:projectionFrameLockUntil": definition("出框锁定回合", 10000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:frame_lock_until": definition("出框锁定回合", 10000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:handSealCount": definition("结印次数", 24, { ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_base": definition("内部基准", 24, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_round": definition("内部回合", 10000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_turn_damage": definition("内部回合伤害", 1000000000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_turn_damage_round": definition("内部伤害回合", 10000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_settled_round": definition("内部结算回合", 10000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_overdrive_round": definition("内部超速回合", 10000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_overdrive_damage_threshold": definition("内部超速阈值", 1000000000, { visible: false, ownerTags: ["projection_sorcery"] }),
  "projection_sorcery:_overdrive_frame_gain": definition("内部超速增帧", 24, { visible: false, ownerTags: ["projection_sorcery"] }),
  "yuji_after68_black_flash:black_flash_growth": definition("黑闪递增", 80),
  "mythical_beast_amber:charge": definition("电荷积蓄", 6, { ownerTags: ["mythical_beast_amber"], allowExternalTarget: true }),
  "mythical_beast_amber:fracture": definition("琥珀裂解", 9, { ownerTags: ["mythical_beast_amber"] }),
  "idle_death_gamble:jackpot_gauge": definition("坐杀博徒期待度", 120, { ownerTags: ["hakari_jackpot_owner", "jackpot"] }),
  "angel_extinguishment:purification": definition("净化层数", 5, { ownerTags: ["angel_technique", "jacobs_ladder"], allowExternalTarget: true }),
  "miracles:stockpile": definition("奇迹储备", 3),
  "rika_manifestation:sustain": definition("完全显现维持", 5)
});

const COUNTER_DISPLAY_LABELS = Object.freeze(Object.fromEntries(
  Object.entries(COUNTER_DEFINITIONS).map(([address, spec]) => [address, spec.label])
));

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSide(side) {
  const value = String(side || "left").trim().toLowerCase();
  if (value === "left" || value === "right") return value;
  if (value === "p1" || value === "player1") return "left";
  if (value === "p2" || value === "player2") return "right";
  throw new Error(`invalid counter side: ${value || "(empty)"}`);
}

function normalizeKey(value, fallback) {
  const key = String(value || fallback || "").trim();
  if (!key) throw new Error("counter namespace/id cannot be empty");
  return key;
}

function counterAddress(namespace, counterId) {
  return `${normalizeKey(namespace, "default")}:${normalizeKey(counterId, "value")}`;
}

function getCounterDefinition(namespace, counterId) {
  const address = counterAddress(namespace, counterId);
  const spec = COUNTER_DEFINITIONS[address];
  if (spec) return spec;
  const dynamic = _customCounterRegistry.get(address);
  if (dynamic) return dynamic;
  // Auto-create a default definition for AI-generated / custom counters
  // so battles don't crash when consuming/reading unregistered counters.
  const fallback = Object.freeze({
    label: counterId,
    min: 0,
    max: 9999,
    initial: 0,
    format: "number",
    visible: true,
    roundScoped: false,
    ownerTags: [],
    allowExternalTarget: false
  });
  _customCounterRegistry.set(address, fallback);
  return fallback;
}

const _customCounterRegistry = new Map();

function registerCustomCounter(namespace, counterId, options = {}) {
  const address = counterAddress(namespace, counterId);
  const spec = definition(String(options.label || counterId), options.max ?? 999, options);
  _customCounterRegistry.set(address, Object.freeze(spec));
}

function isRegisteredCounter(namespace, counterId) {
  try {
    getCounterDefinition(namespace, counterId);
    return true;
  } catch {
    return false;
  }
}

function resolveCounterDisplayLabel(namespace, counterId) {
  return getCounterDefinition(namespace, counterId).label;
}

function currentRound(battle) {
  // battle.round is the authoritative combat clock. resourceState.round is a
  // transport/UI mirror and can arrive one poll earlier during online sync.
  // Letting the mirror lead would clear round-scoped counters (notably 血/穿)
  // while the player is still rebuilding the hand in the same combat round.
  return number(battle?.round ?? battle?.resourceState?.round, 0);
}

function clampValue(value, min, max, fallback = 0) {
  return Math.max(number(min, 0), Math.min(number(max, 0), number(value, fallback)));
}

function cleanEntry(raw, namespace, counterId, round, initialOverride) {
  const spec = getCounterDefinition(namespace, counterId);
  // Some mechanics (for example 乌羽上限) change a counter's effective
  // capacity during a battle.  Keep that override separate from the
  // registry maximum so sanitization/ensureCounter does not reset it.
  const maxOverride = raw?.maxOverride == null
    ? spec.max
    : clampValue(raw.maxOverride, spec.min, spec.max, spec.max);
  const effectiveMax = Math.min(spec.max, Math.max(spec.min, maxOverride));
  const initial = initialOverride == null ? spec.initial : clampValue(initialOverride, spec.min, spec.max, spec.initial);
  const value = clampValue(raw?.value, spec.min, effectiveMax, initial);
  return {
    id: counterId,
    label: spec.label,
    value,
    min: spec.min,
    max: effectiveMax,
    maxOverride: effectiveMax,
    format: spec.format,
    visible: spec.visible,
    roundScoped: spec.roundScoped,
    round: clampValue(raw?.round, 0, 10000, round),
    updatedRound: clampValue(raw?.updatedRound, 0, 10000, round),
    activationRound: clampValue(raw?.activationRound, 0, 10000, 0),
    expiresRound: clampValue(raw?.expiresRound, 0, 10000, 0),
    source: String(raw?.source || "counter-pipeline").slice(0, 120)
  };
}

function sideOwnsCounterDefinition(battle, side, spec) {
  if (!spec.ownerTags.length || spec.allowExternalTarget) return true;
  const profile = battle?.[side];
  if (!profile || typeof profile !== "object") return true;
  const tags = []
    .concat(profile.specialHandTags || [], profile["特殊手札"] || [], profile.explicitSpecialHandTags || [])
    .concat(profile.techniqueFamilies || [], profile.traits || [], profile.cardTags || [])
    .concat([profile.id, profile.characterId])
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  const available = new Set(tags);
  return spec.ownerTags.some((owner) => available.has(String(owner).trim().toLowerCase()));
}

function isCounterAllowedForSide(battle, side, namespace, counterId) {
  const sideKey = normalizeSide(side);
  return sideOwnsCounterDefinition(battle, sideKey, getCounterDefinition(namespace, counterId));
}

function sanitizeCounterRoot(raw, battle) {
  const root = { schema: COUNTER_SCHEMA, version: COUNTER_VERSION, sides: {} };
  const round = currentRound(battle);
  const rawVersion = number(raw?.version, 0);
  const rawSides = raw?.sides && typeof raw.sides === "object" ? raw.sides : {};
  for (const rawSide of Object.keys(rawSides)) {
    let side;
    try { side = normalizeSide(rawSide); } catch { continue; }
    const sideState = rawSides[rawSide];
    if (!sideState || typeof sideState !== "object" || Array.isArray(sideState)) continue;
    for (const [namespace, counters] of Object.entries(sideState)) {
      if (!counters || typeof counters !== "object" || Array.isArray(counters)) continue;
      for (const [counterId, entry] of Object.entries(counters)) {
        // Legacy black-bird saves stored the capacity as a separate visible
        // counter. Fold it into feathers.maxOverride and never re-expose the
        // deprecated feather_limit resource.
        if (namespace === "black_bird_manipulation" && counterId === "feather_limit") {
          root.sides[side] ||= {};
          root.sides[side][namespace] ||= {};
          const legacyValue = number(entry?.value ?? entry?.max, 16);
          const feathersEntry = root.sides[side][namespace].feathers;
          if (feathersEntry) {
            feathersEntry.maxOverride = Math.max(0, Math.min(16, legacyValue));
            feathersEntry.max = feathersEntry.maxOverride;
            feathersEntry.value = Math.min(number(feathersEntry.value, 0), feathersEntry.max);
          }
          continue;
        }
        if (!isRegisteredCounter(namespace, counterId)) continue;
        const spec = getCounterDefinition(namespace, counterId);
        if (!sideOwnsCounterDefinition(battle, side, spec)) continue;
        let sourceEntry = entry;
        if (rawVersion < 4 && namespace === "blood_manipulation" && entry && typeof entry === "object") {
          const legacyMax = counterId === "blood" ? 0.65 : (counterId === "pierce" ? 0.35 : 0);
          if (legacyMax > 0) {
            sourceEntry = {
              ...entry,
              value: Math.round(clampValue(entry.value, 0, legacyMax, 0) / legacyMax * spec.max),
              source: "blood-v3-percent-migration"
            };
          }
        }
        root.sides[side] ||= {};
        root.sides[side][namespace] ||= {};
        root.sides[side][namespace][counterId] = cleanEntry(sourceEntry, namespace, counterId, round);
      }
    }
  }
  return root;
}

function ensureCounterRoot(battle) {
  if (!battle || typeof battle !== "object") throw new Error("counter pipeline requires a battle object");
  if (!battle.counterState || battle.counterState.schema !== COUNTER_SCHEMA || battle.counterState.version !== COUNTER_VERSION) {
    battle.counterState = sanitizeCounterRoot(battle.counterState, battle);
  }
  battle.counterState.sides ||= {};
  return battle.counterState;
}

function ensureCounterNamespace(battle, side, namespace) {
  const root = ensureCounterRoot(battle);
  const sideKey = normalizeSide(side);
  const namespaceKey = normalizeKey(namespace, "default");
  root.sides[sideKey] ||= {};
  root.sides[sideKey][namespaceKey] ||= {};
  return root.sides[sideKey][namespaceKey];
}

function ensureCounter(battle, side, namespace, counterId, options = {}) {
  const namespaceKey = normalizeKey(namespace, "default");
  const id = normalizeKey(counterId, "value");
  const spec = getCounterDefinition(namespaceKey, id);
  const sideKey = normalizeSide(side);
  if (!sideOwnsCounterDefinition(battle, sideKey, spec)) {
    return {
      ...cleanEntry(null, namespaceKey, id, currentRound(battle), options.initial),
      rejected: true,
      transient: true,
      rejectionReason: "counter-owner-mismatch"
    };
  }
  const namespaceState = ensureCounterNamespace(battle, sideKey, namespaceKey);
  const round = currentRound(battle);
  let entry = namespaceState[id];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    entry = cleanEntry(null, namespaceKey, id, round, options.initial);
    namespaceState[id] = entry;
  } else {
    entry = cleanEntry(entry, namespaceKey, id, round, options.initial);
    namespaceState[id] = entry;
  }
  if (options.maxOverride !== undefined) {
    const requestedMax = options.maxOverride;
    entry.maxOverride = clampValue(requestedMax, spec.min, spec.max, entry.max);
    entry.max = entry.maxOverride;
    entry.value = clampValue(entry.value, entry.min, entry.max, entry.value);
  }
  if ((options.roundScoped === true || spec.roundScoped) && number(entry.round, round) !== round) {
    entry.value = clampValue(options.initial ?? spec.initial, spec.min, spec.max, spec.initial);
    entry.round = round;
  }
  // 元数据可记录来源，但标签、可见性和上下限只能来自注册表。
  if (options.source) entry.source = String(options.source).slice(0, 120);
  entry.updatedRound = clampValue(entry.updatedRound, 0, 10000, round);
  return entry;
}

function readCounter(battle, side, namespace, counterId, options = {}) {
  const entry = ensureCounter(battle, side, namespace, counterId, options);
  const round = currentRound(battle);
  if (number(entry.activationRound, 0) > round) return 0;
  if (number(entry.expiresRound, 0) > 0 && number(entry.expiresRound, 0) < round) return 0;
  return number(entry.value, 0);
}

function configureCounter(battle, side, namespace, counterId, options = {}) {
  return ensureCounter(battle, side, namespace, counterId, options);
}

function setCounter(battle, side, namespace, counterId, value, options = {}) {
  const entry = ensureCounter(battle, side, namespace, counterId, options);
  const spec = getCounterDefinition(namespace, counterId);
  const before = number(entry.value, spec.initial);
  entry.min = number(entry.min, spec.min);
  entry.maxOverride = clampValue(entry.maxOverride == null ? entry.max : entry.maxOverride, entry.min, spec.max, spec.max);
  entry.max = entry.maxOverride;
  entry.value = clampValue(value, entry.min, entry.max, before);
  entry.updatedRound = currentRound(battle);
  if (options.activationDelayRounds !== undefined || options.durationRounds !== undefined) {
    const activationDelay = Math.max(0, number(options.activationDelayRounds, 0));
    const duration = Math.max(0, number(options.durationRounds, 0));
    entry.activationRound = currentRound(battle) + activationDelay;
    entry.expiresRound = duration > 0 ? entry.activationRound + duration - 1 : 0;
  }
  return { ok: entry.rejected !== true, rejected: entry.rejected === true, before, after: entry.value, delta: entry.value - before, entry };
}

function adjustCounter(battle, side, namespace, counterId, delta, options = {}) {
  const entry = ensureCounter(battle, side, namespace, counterId, options);
  if (options.maxDelta !== undefined) {
    const registryMax = number(getCounterDefinition(namespace, counterId).max, 999999);
    entry.maxOverride = Math.max(number(entry.min, 0), Math.min(registryMax, number(entry.max, registryMax) + number(options.maxDelta, 0)));
    entry.max = entry.maxOverride;
    entry.value = Math.min(number(entry.value, 0), entry.max);
  }
  return setCounter(battle, side, namespace, counterId, number(entry.value, 0) + number(delta, 0), options);
}

function consumeCounter(battle, side, namespace, counterId, amount, options = {}) {
  const entry = ensureCounter(battle, side, namespace, counterId, options);
  const before = readCounter(battle, side, namespace, counterId, options);
  const consumeAll = options.consumeAll === true || amount === "all";
  const requested = consumeAll ? before : Math.max(0, number(amount, 0));
  if (!consumeAll && requested > before && options.allowPartial !== true) {
    return { ok: false, before, after: before, consumed: 0, requested, entry };
  }
  const consumed = Math.min(before, requested);
  const change = setCounter(battle, side, namespace, counterId, before - consumed, options);
  return { ok: true, before, after: change.after, consumed, requested, entry: change.entry };
}

function removeCounter(battle, side, namespace, counterId) {
  getCounterDefinition(namespace, counterId);
  const root = ensureCounterRoot(battle);
  const namespaceState = root.sides?.[normalizeSide(side)]?.[normalizeKey(namespace, "default")];
  if (!namespaceState) return false;
  return delete namespaceState[normalizeKey(counterId, "value")];
}

function resetCounterNamespace(battle, side, namespace) {
  const root = ensureCounterRoot(battle);
  const sideKey = normalizeSide(side);
  const namespaceKey = normalizeKey(namespace, "default");
  if (!Object.keys(COUNTER_DEFINITIONS).some((address) => address.startsWith(`${namespaceKey}:`))
      && ![..._customCounterRegistry.keys()].some((address) => address.startsWith(`${namespaceKey}:`))) {
    throw new Error(`unregistered counter namespace: ${namespaceKey}`);
  }
  [..._customCounterRegistry.keys()].filter((k) => k.startsWith(`${namespaceKey}:`)).forEach((k) => _customCounterRegistry.delete(k));
  if (!root.sides?.[sideKey]?.[namespaceKey]) return false;
  delete root.sides[sideKey][namespaceKey];
  return true;
}

function listCounters(battle, side, options = {}) {
  const root = ensureCounterRoot(battle);
  const sideKey = normalizeSide(side);
  const clean = sanitizeCounterRoot(root, battle);
  root.sides[sideKey] = clean.sides[sideKey] || {};
  const sideState = root.sides[sideKey];
  const namespaceFilter = options.namespace ? String(options.namespace) : "";
  const result = [];
  for (const [namespace, counters] of Object.entries(sideState)) {
    if (namespaceFilter && namespace !== namespaceFilter) continue;
    for (const [counterId, entry] of Object.entries(counters || {})) {
      if (!isRegisteredCounter(namespace, counterId)) continue;
      if (options.visibleOnly && entry.visible === false) continue;
      result.push({ namespace, ...clone(entry) });
    }
  }
  return result.sort((a, b) => `${a.namespace}:${a.id}`.localeCompare(`${b.namespace}:${b.id}`));
}

function createCounterView(battle, side, namespace, definitions) {
  const view = {};
  for (const [property, definitionValue] of Object.entries(definitions || {})) {
    const requested = typeof definitionValue === "string" ? { counterId: definitionValue } : { ...(definitionValue || {}) };
    ensureCounter(battle, side, namespace, requested.counterId || property, requested);
  }
  for (const [property, definitionValue] of Object.entries(definitions || {})) {
    const requested = typeof definitionValue === "string" ? { counterId: definitionValue } : { ...(definitionValue || {}) };
    const counterId = requested.counterId || property;
    const field = requested.field || "value";
    Object.defineProperty(view, property, {
      enumerable: true,
      configurable: false,
      get() {
        const entry = ensureCounter(battle, side, namespace, counterId);
        return field === "value" ? number(entry.value, 0) : entry[field];
      },
      set(value) {
        if (field === "value") {
          setCounter(battle, side, namespace, counterId, value);
          return;
        }
        // 上下限、标签、可见性均为注册表元数据；旧调用允许赋值但不能改变边界。
        if (field === "max" || field === "min" || field === "label" || field === "visible") return;
        const entry = ensureCounter(battle, side, namespace, counterId);
        entry[field] = value;
        entry.updatedRound = currentRound(battle);
      }
    });
  }
  Object.defineProperty(view, "toJSON", {
    enumerable: false,
    value() {
      return Object.fromEntries(Object.keys(definitions || {}).map((key) => [key, view[key]]));
    }
  });
  return view;
}

function snapshotCounterState(battle) {
  const clean = sanitizeCounterRoot(ensureCounterRoot(battle), battle);
  battle.counterState = clean;
  return clone(clean);
}

function restoreCounterState(battle, snapshot) {
  if (!snapshot || snapshot.schema !== COUNTER_SCHEMA || typeof snapshot.sides !== "object") {
    throw new Error("counter snapshot schema mismatch");
  }
  battle.counterState = sanitizeCounterRoot(snapshot, battle);
  return battle.counterState;
}

const api = {
  namespace: "JJKDuelCounterPipeline",
  schema: COUNTER_SCHEMA,
  version: COUNTER_VERSION,
  definitions: COUNTER_DEFINITIONS,
  displayLabels: COUNTER_DISPLAY_LABELS,
  getCounterDefinition,
  isRegisteredCounter,
  isCounterAllowedForSide,
  resolveCounterDisplayLabel,
  ensureCounterRoot,
  ensureCounter,
  configureCounter,
  readCounter,
  setCounter,
  adjustCounter,
  consumeCounter,
  removeCounter,
  resetCounterNamespace,
  listCounters,
  createCounterView,
  registerCustomCounter,
  snapshotCounterState,
  restoreCounterState
};

globalThis.JJKDuelCounterPipeline = api;

export {
  COUNTER_SCHEMA,
  COUNTER_VERSION,
  COUNTER_DEFINITIONS,
  COUNTER_DISPLAY_LABELS,
  getCounterDefinition,
  isRegisteredCounter,
  isCounterAllowedForSide,
  resolveCounterDisplayLabel,
  ensureCounterRoot,
  ensureCounter,
  configureCounter,
  readCounter,
  setCounter,
  adjustCounter,
  consumeCounter,
  removeCounter,
  resetCounterNamespace,
  listCounters,
  createCounterView,
  registerCustomCounter,
  snapshotCounterState,
  restoreCounterState
};

export default api;
