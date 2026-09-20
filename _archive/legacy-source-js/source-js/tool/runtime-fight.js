//--斗蛐蛐与角色对战运行时--//
function resolveDuelCharacterStrengthHelper(name) {
  const characterApi = globalThis.JJKCharacter;
  const direct = characterApi?.[name];
  if (typeof direct === "function") return direct;
  try {
    const registered = characterApi?.getHelper?.(name);
    if (typeof registered === "function") return registered;
  } catch {
    // The fallback below keeps the battle runtime usable while helpers load.
  }
  return null;
}

function formatCombatPowerUnit(value) {
  const helper = resolveDuelCharacterStrengthHelper("formatCombatPowerUnit");
  if (helper) return helper(value);
  const number = Math.max(0, Number(value) || 0);
  return number >= 10000
    ? `${(number / 10000).toFixed(2).replace(/\.?0+$/, "")}万`
    : number.toLocaleString("zh-CN");
}

function getCombatPowerUnitBand(value) {
  const helper = resolveDuelCharacterStrengthHelper("getCombatPowerUnitBand");
  if (helper) return helper(value);
  const unit = Math.max(0, Number(value) || 0);
  if (unit < 420) return "weak";
  if (unit < 850) return "normal-";
  if (unit < 2100) return "normal";
  if (unit < 5200) return "strong";
  return "special";
}

function buildCombatPowerUnit(score) {
  const helper = resolveDuelCharacterStrengthHelper("buildCombatPowerUnit");
  if (helper) return helper(score);
  const normalized = Math.max(0, Math.min(12, Number(score) || 0));
  const value = Math.round(100 * Math.pow(2, normalized / 1.55));
  return {
    value,
    label: formatCombatPowerUnit(value),
    scoreBasis: Number(normalized.toFixed(4)),
    band: getCombatPowerUnitBand(value),
    formula: "round(100 * 2^(instantPowerScore / 1.55))"
  };
}

function addCustomDuelCharacter() {
  const form = readCustomDuelForm();
  if (!form) return;
  const editingId = state.customDuelEditId;
  const card = buildCustomDuelCard(form, editingId);
  if (card.canonicalValidation && !card.canonicalValidation.ok) {
    const firstError = card.canonicalValidation.errors?.[0]?.message || "自定义角色未通过 V3 结构与数值校验。";
    updateCustomDuelAccessStatus(`无法保存：${firstError}`, true);
    return;
  }
  const existingIndex = editingId ? state.customDuelCards.findIndex((item) => item.characterId === editingId) : -1;
  if (existingIndex >= 0) {
    state.customDuelCards[existingIndex] = card;
    state.customDuelEditId = "";
  } else {
    state.customDuelCards.push(card);
  }
  state.pendingCustomDuelHandCards = [];
  state.pendingCustomDuelSpecialHandTags = [];
  state.pendingCustomDuelDomainScript = null;
  state.pendingCustomDuelSpecialConstitutionStatsApplied = false;
  state.pendingCustomCharacterV3Draft = null;
  state.duelBattle = null;
  renderDuelCustomList();
  renderPendingCustomDuelHandList();
  syncCustomDuelEditMode();
  renderDuelMode();

  if (existingIndex >= 0) {
    if (els.duelLeftSelect?.value === editingId) els.duelLeftSelect.value = card.characterId;
    if (els.duelRightSelect?.value === editingId) els.duelRightSelect.value = card.characterId;
  } else if (state.customDuelCards.length === 1 && els.duelLeftSelect) {
    els.duelLeftSelect.value = card.characterId;
  } else if (els.duelRightSelect) {
    els.duelRightSelect.value = card.characterId;
  }
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
}

function notifyDuelCharacterPoolChanged() {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("jjk-duel-character-pool-changed", {
    detail: {
      customCount: state.customDuelCards.length,
      totalCount: getDuelCharacterCards().length
    }
  }));
}

function normalizeLoginCardCharacterForPool(card = {}, options = {}) {
  const copy = cloneCustomDuelExportValue(card) || {};
  const characterId = String(copy.characterId || copy.id || `login_card_${Date.now().toString(36)}`).trim();
  const displayName = String(copy.displayName || copy.name || "未命名角色").trim();
  const ownerFamily = buildCustomDuelSpecialHandTag(characterId);
  const specialHandTags = normalizeCustomDuelSpecialHandTags(ownerFamily, normalizeCustomDuelMechanismSourceTags(copy));
  return {
    ...copy,
    characterId,
    displayName,
    name: copy.name || displayName,
    specialHandTags,
    "特殊手札": specialHandTags,
    explicitSpecialHandTags: normalizeCustomDuelSpecialHandTags(copy.explicitSpecialHandTags, specialHandTags),
    techniqueFamilies: normalizeCustomDuelSpecialHandTags(copy.techniqueFamilies, ownerFamily),
    customHandCards: (copy.customHandCards || []).map((hand) => normalizeCustomDuelDirectHandCardShape(hand, specialHandTags, characterId)),
    customDuel: copy.customDuel !== false,
    source: copy.source || "login-card",
    __loginCardCharacter: true,
    __loginCardOwnerId: options.ownerId || copy.__loginCardOwnerId || ""
  };
}

function importLoginCardCharacters(cards = [], options = {}) {
  const normalizedCards = (Array.isArray(cards) ? cards : [])
    .map((card) => normalizeLoginCardCharacterForPool(card, options))
    .filter((card) => card.characterId);
  if (!normalizedCards.length) return { imported: 0, total: state.customDuelCards.length };
  const stableCharacterPoolStringify = (value) => {
    if (Array.isArray(value)) return `[${value.map(stableCharacterPoolStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableCharacterPoolStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  };
  const sameCard = (left, right) => {
    if (!left || !right) return false;
    return stableCharacterPoolStringify(left) === stableCharacterPoolStringify(right);
  };
  const unchanged = normalizedCards.every((card) => {
    const existing = state.customDuelCards.find((item) => item.characterId === card.characterId);
    return existing && sameCard(existing, card);
  });
  if (unchanged) return { imported: 0, total: state.customDuelCards.length, skipped: true };
  for (const card of normalizedCards) {
    const existingIndex = state.customDuelCards.findIndex((item) => item.characterId === card.characterId);
    if (existingIndex >= 0) state.customDuelCards[existingIndex] = card;
    else state.customDuelCards.push(card);
  }
  renderDuelCustomList();
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
  return { imported: normalizedCards.length, total: state.customDuelCards.length };
}

function removeLoginCardCharactersFromPool(characterIds = [], options = {}) {
  const ids = new Set((Array.isArray(characterIds) ? characterIds : [characterIds]).map(String).filter(Boolean));
  if (!ids.size) return { removed: 0, total: state.customDuelCards.length };
  const ownerId = String(options.ownerId || "");
  const before = state.customDuelCards.length;
  state.customDuelCards = state.customDuelCards.filter((card) => {
    if (!ids.has(String(card.characterId))) return true;
    if (!card.__loginCardCharacter) return true;
    if (ownerId && String(card.__loginCardOwnerId || "") !== ownerId) return true;
    return false;
  });
  const removed = before - state.customDuelCards.length;
  if (!removed) return { removed: 0, total: state.customDuelCards.length };
  renderDuelCustomList();
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
  return { removed, total: state.customDuelCards.length };
}

function readCustomDuelForm() {
  const name = normalizeCustomDuelText(els.duelCustomName?.value || "");
  if (!name) {
    void globalThis.JJKDomModal?.alert("请先填写自定义角色名字。");
    els.duelCustomName?.focus();
    return null;
  }
  const stats = { ...DUEL_DEFAULT_CUSTOM_STATS };
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    if (!stat) return;
    stats[stat] = DUEL_RANKS.includes(select.value) ? select.value : (DUEL_DEFAULT_CUSTOM_STATS[stat] || "B");
  });
  const librarySelection = readDuelLibrarySelection();

  return {
    name,
    visibleGrade: els.duelCustomGrade?.value || "grade2",
    stage: getValidDuelStage(els.duelCustomStage?.value || "custom"),
    techniquePower: els.duelCustomTechniquePower?.value || "B",
    technique: mergeDuelLocalList(splitCustomDuelList(els.duelCustomTechnique?.value || ""), librarySelection.techniques).join("、"),
    domain: mergeDuelLocalList(splitCustomDuelList(els.duelCustomDomain?.value || ""), librarySelection.domains).join("、"),
    tools: splitCustomDuelList(els.duelCustomTools?.value || ""),
    traits: mergeDuelLocalList(splitCustomDuelList(els.duelCustomTraits?.value || ""), librarySelection.advanced),
    mechanismTags: readSelectedDuelDefinitionValues(els.duelCustomMechanisms),
    toolTags: readSelectedDuelDefinitionValues(els.duelCustomToolTags),
    externalResource: mergeDuelLocalList(splitCustomDuelList(els.duelCustomResource?.value || ""), librarySelection.resources).join("、"),
    notes: normalizeCustomDuelText(els.duelCustomNotes?.value || ""),
    librarySelection,
    manualCombatScore: parseOptionalDuelNumber(els.duelCustomCombatScore?.value, 0, 12),
    manualCombatUnit: parseOptionalDuelNumber(els.duelCustomCombatUnit?.value, 1, 99999999),
    specialHandTags: normalizeCustomDuelSpecialHandTags(state.pendingCustomDuelSpecialHandTags || []),
    customHandCards: (state.pendingCustomDuelHandCards || []).map((card) => ({ ...card })),
    domainScript: state.pendingCustomDuelDomainScript ? { ...state.pendingCustomDuelDomainScript } : null,
    specialConstitutionStatsApplied: state.pendingCustomDuelSpecialConstitutionStatsApplied === true,
    stats
  };
}

function buildCustomDuelCard(form, existingId = "") {
  if (!existingId) state.customDuelSeq += 1;
  const id = existingId || `custom_duel_${Date.now().toString(36)}_${state.customDuelSeq}`;
  const specialHandTag = buildCustomDuelSpecialHandTag(id);
  const selectedMechanisms = Array.from(new Set(form.mechanismTags || []));
  const selectedToolTags = Array.from(new Set(form.toolTags || []));
  const selectedLibrary = {
    techniques: mergeDuelLocalList(form.librarySelection?.techniques || []),
    domains: mergeDuelLocalList(form.librarySelection?.domains || []),
    advanced: mergeDuelLocalList(form.librarySelection?.advanced || []),
    resources: mergeDuelLocalList(form.librarySelection?.resources || [])
  };
  // Technique ownership is derived only from the explicit technique fields.
  // Domains, tools, traits, mechanisms, resources and prose notes remain
  // metadata and cannot teach an unrelated innate technique family.
  const techniqueEvidenceText = buildCustomDuelTechniqueEvidenceText(
    form.technique,
    selectedLibrary.techniques
  );
  const techniqueSpecialHandTags = inferCustomDuelTechniqueSpecialHandTags(
    form.technique,
    selectedLibrary.techniques
  );
  const mechanismSourceTags = inferCustomDuelMechanismSourceSpecialHandTags(
    form.technique,
    selectedLibrary.techniques,
    form.domain,
    selectedLibrary.domains,
    form.tools,
    selectedToolTags,
    form.traits,
    selectedMechanisms,
    form.externalResource,
    selectedLibrary.resources
  );
  const inheritedSpecialHandTags = normalizeCustomDuelSpecialHandTags(form.specialHandTags || [], form["特殊手札"] || []);
  const specialHandTags = sanitizeCustomDuelTechniqueSpecialHandTags(
    normalizeCustomDuelSpecialHandTags(specialHandTag, inheritedSpecialHandTags, techniqueSpecialHandTags, mechanismSourceTags),
    techniqueEvidenceText
  );
  const techniqueFamilies = sanitizeCustomDuelTechniqueSpecialHandTags(
    normalizeCustomDuelSpecialHandTags(specialHandTag, inferCustomDuelTechniqueFamilies(techniqueEvidenceText), techniqueSpecialHandTags),
    techniqueEvidenceText
  );
  const traits = Array.from(new Set([form.technique, ...form.traits, ...selectedMechanisms].filter(Boolean)));
  const loadout = Array.from(new Set([...(form.tools || []), ...selectedToolTags].filter(Boolean)));
  const customHandCards = normalizeCustomDuelHandCardsForCharacter(form.customHandCards, id, specialHandTag, form.domain, form.domainScript);
  const hp = duelRankValue(form.stats.body);
  const mp = duelRankValue(form.stats.cursedEnergy);
  const legacyCard = {
    name: form.name,
    hp,
    mp,
    "四轴": buildCustomDuelCardAxes(form.stats, form.techniquePower, form.domain, loadout, traits, form.specialConstitutionStatsApplied),
    "特殊手札": specialHandTags,
    specialHandTags,
    explicitSpecialHandTags: specialHandTags,
    characterId: id,
    displayName: form.name,
    customDuel: true,
    stage: getValidDuelStage(form.stage || "custom"),
    baseStats: {
      cursedEnergy: form.stats.cursedEnergy,
      control: form.stats.control,
      efficiency: form.stats.efficiency,
      body: form.stats.body,
      martial: form.stats.martial,
      talent: form.stats.talent
    },
    specialConstitutionStatsApplied: form.specialConstitutionStatsApplied === true,
    innateTraits: traits,
    loadout,
    selectedMechanisms,
    selectedToolTags,
    selectedLibrary,
    techniqueText: form.technique || "无",
    techniqueFamilies,
    externalResource: form.externalResource || "无",
    techniqueName: form.technique || "无",
    techniqueDescription: "无",
    techniquePower: form.techniquePower || "无",
    domainProfile: form.domain || "无",
    domainScript: form.domainScript || null,
    visibleGrade: DUEL_GRADE_OPTIONS.some((item) => item.value === form.visibleGrade) ? form.visibleGrade : "grade2",
    officialGrade: gradeLabel(form.visibleGrade),
    powerTier: ["specialGradeLow", "specialGrade", "specialGradeHigh"].includes(form.visibleGrade) ? form.visibleGrade : "custom",
    debugManualCombatScore: form.manualCombatScore,
    debugManualCombatUnit: form.manualCombatUnit,
    customHandCards,
    notes: form.notes || "无"
  };
  const customV3 = globalThis.JJKCustomCharacterV3;
  if (!customV3?.migrateLegacyCustomCharacter || !customV3?.validateCustomCharacter) return legacyCard;
  const canonicalV3 = customV3.migrateLegacyCustomCharacter(legacyCard, { source: "manual" });
  const validation = customV3.validateCustomCharacter(canonicalV3, { requireCards: false });
  return {
    ...legacyCard,
    customSchemaVersion: 3,
    canonicalV3: validation.value,
    canonicalSnapshot: customV3.createCharacterSnapshot?.(validation.value, {
      characterRevision: validation.value.editor?.revision || 0,
      requireCards: false
    }) || null,
    canonicalValidation: {
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      budget: validation.budget,
      budgetLimit: validation.budgetLimit
    }
  };
}

function updateCustomDuelAccessStatus(message, isError = false) {
  const target = els.duelCustomAccessStatus || els.duelWheelImportStatus;
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("error-text", Boolean(isError));
}

function cloneCustomDuelExportValue(value) {
  const cloned = typeof clonePlain === "function" ? clonePlain(value) : null;
  if (cloned != null || value == null) return cloned;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function sanitizeCustomDuelFilenamePart(value) {
  return String(value || "custom-character")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "custom-character";
}

function getCustomDuelExportDateText(date = new Date()) {
  if (typeof formatDateForFilename === "function") return formatDateForFilename(date);
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadCustomDuelCharacterJson(text, filename) {
  if (typeof downloadTextFile === "function") {
    downloadTextFile(text, filename, "application/json;charset=utf-8");
    return;
  }
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeCustomDuelDirectHandCardShape(card = {}, fallbackTags = [], characterId = "") {
  const copy = cloneCustomDuelExportValue(card) || {};
  const ownerId = String(characterId || copy.customCharacterId || copy.exclusive?.characters?.[0] || "");
  const ownerFamily = ownerId ? buildCustomDuelSpecialHandTag(ownerId) : "";
  const specialHandTags = normalizeCustomDuelSpecialHandTags(
    copy.specialHandTags,
    copy["特殊手札"],
    fallbackTags,
    ownerFamily
  );
  const tags = normalizeCustomDuelSpecialHandTags(
    copy.tags,
    "自定义",
    "特殊手札",
    specialHandTags
  );
  const type = String(copy.type || copy.cardType || "special");
  const domainOnly = type === "domain" || copy.domainSpecific === true || copy.domainHand === true;
  const costCe = Number(copy.cost?.ce ?? copy.ceCost ?? copy.costCe ?? 0) || 0;
  const costAp = Number(copy.cost?.ap ?? copy.apCost ?? 0) || 0;
  const damage = Number(copy.effect?.damage ?? copy.damage ?? 0) || 0;
  const block = Number(copy.effect?.block ?? copy.block ?? 0) || 0;
  const domainLoad = Number(copy.effect?.domainLoad ?? copy.domainLoadDelta ?? 0) || 0;
  const accuracyProfile = String(copy.accuracy?.profile || copy.accuracyProfile || (damage > 0 ? "technique_projectile" : "none"));
  return {
    ...copy,
    id: String(copy.id || copy.actionId || `custom_hand_${Date.now().toString(36)}`),
    name: copy.name || copy.label || "未命名特殊手札",
    label: copy.label || copy.name || "未命名特殊手札",
    type,
    cardType: String(copy.cardType || type),
    summary: String(copy.summary || copy.description || copy.effectSummary || `${copy.name || copy.label || "自定义特殊手札"}。`),
    cost: { ...(copy.cost || {}), ap: costAp, ce: costCe, hp: Number(copy.cost?.hp || 0) || 0 },
    effect: {
      damage,
      damageType: String(copy.effect?.damageType || copy.damageType || "technique"),
      ceDamage: Number(copy.effect?.ceDamage || 0) || 0,
      stabilityDamage: Number(copy.effect?.stabilityDamage || 0) || 0,
      domainLoad,
      domainPressure: Number(copy.effect?.domainPressure || 0) || 0,
      healing: Number(copy.effect?.healing || copy.healing || 0) || 0,
      block,
      shield: Number(copy.effect?.shield || copy.shield || 0) || 0,
      effects: Array.isArray(copy.effect?.effects) ? cloneCustomDuelExportValue(copy.effect.effects).slice(0, 24) : [],
      special: copy.effect?.special || copy.specialMechanism || null
    },
    accuracy: {
      profile: accuracyProfile,
      hitRate: copy.accuracy?.hitRate ?? copy.baseHitRate ?? null,
      modifier: Number(copy.accuracy?.modifier ?? copy.hitRateModifier ?? 0) || 0,
      evasionAllowed: copy.accuracy?.evasionAllowed ?? copy.evasionAllowed ?? (damage > 0 && accuracyProfile !== "none"),
      onMiss: cloneCustomDuelExportValue(copy.accuracy?.onMiss || copy.onMiss || { damageScale: 0, keepCard: false })
    },
    scaling: copy.scaling && typeof copy.scaling === "object" ? cloneCustomDuelExportValue(copy.scaling) : {
      source: "自定义手札",
      baseDamageMultiplier: 1,
      martialDamagePerRank: 0,
      controlAccuracyBase: 1,
      controlAccuracyPerRank: 0,
      martialEvasionPerRank: 0,
      accuracyMin: 0.1,
      accuracyMax: 1,
      talentDamagePerRank: 0,
      highCeThreshold: 0.5,
      highCeDamageMultiplier: 1.1,
      efficiencyCostPerRank: 0.08,
      efficiencyCostMin: 0.35,
      efficiencyCostMax: 1.55,
      efficiencyRecoveryPerRank: 0,
      bodyResistanceBase: 0,
      bodyResistancePerRank: 0,
      bodyResistanceMin: 0,
      bodyResistanceMax: 0.3,
      talentBlockPerRank: 0,
      talentHealingPerRank: 0,
      ceDamageMultiplier: 1,
      ceDamageControlPerRank: 0,
      stabilityDamageMultiplier: 1,
      stabilityDamageControlPerRank: 0,
      domainLoadMultiplier: 1,
      domainLoadEfficiencyPerRank: 0,
      domainPressureMultiplier: 1,
      domainPressureControlPerRank: 0
    },
    contexts: domainOnly ? ["domain", "domain_active", "domain_owner"] : Array.from(new Set([...(copy.contexts || []), "normal", "domain", "trial_allowed"])),
    domainSpecific: domainOnly,
    domainHand: domainOnly,
    requirements: cloneCustomDuelExportValue(copy.requirements || {}),
    summon: cloneCustomDuelExportValue(copy.summon || { unitId: null, name: null, uniqueKey: null, lane: null, entryDamageDisabled: false, unit: null, guard: null, maintenance: null }),
    domain: cloneCustomDuelExportValue(copy.domain || { id: null, action: null }),
    exclusive: { ...(cloneCustomDuelExportValue(copy.exclusive || {})), characters: ownerId ? [ownerId] : [] },
    exclusiveToCharacters: ownerId ? [ownerId] : [],
    selection: cloneCustomDuelExportValue(copy.selection || { guaranteed: false, retention: "none", ignoreLimit: false, doesNotCountTowardLimit: false, lockReason: null }),
    specialHandTags,
    "特殊手札": specialHandTags,
    sourceTechniqueFamily: ownerFamily || String(copy.sourceTechniqueFamily || "").trim(),
    specialHandCard: Boolean(ownerFamily || specialHandTags.length),
    tags,
    customCharacterId: ownerId,
    customDuel: true,
    customCard: true,
    customBattleCard: true,
    directCardVersion: 1
  };
}

function normalizeCustomDuelExportHandCard(card = {}, fallbackTags = []) {
  return normalizeCustomDuelDirectHandCardShape(card, fallbackTags, card.customCharacterId || "");
}

function normalizeCustomDuelCharacterCardForExport(card = {}) {
  const techniqueEvidenceText = buildCustomDuelTechniqueEvidenceText(
    card.technique,
    card.techniqueName,
    card.selectedLibrary?.techniques
  );
  const techniqueSpecialHandTags = inferCustomDuelTechniqueSpecialHandTags(
    card.technique,
    card.techniqueName,
    card.selectedLibrary?.techniques
  );
  const mechanismSourceTags = inferCustomDuelMechanismSourceSpecialHandTags(
    card.technique,
    card.techniqueName,
    card.techniqueText,
    card.techniqueDescription,
    card.domainProfile,
    card.externalResource,
    card.innateTraits,
    card.traits,
    card.advancedTechniques,
    card.loadout,
    card.selectedMechanisms,
    card.selectedToolTags,
    card.selectedLibrary?.techniques,
    card.selectedLibrary?.domains,
    card.selectedLibrary?.advanced,
    card.selectedLibrary?.resources,
    card.selectedLibrary?.tools,
    card.selectedLibrary?.cursedTools
  );
  const specialHandTags = sanitizeCustomDuelTechniqueSpecialHandTags(
    normalizeCustomDuelSpecialHandTags(
      card.specialHandTags,
      card["特殊手札"],
      card.explicitSpecialHandTags,
      mechanismSourceTags
    ),
    techniqueEvidenceText
  );
  const customHandCards = (card.customHandCards || []).map((hand) => normalizeCustomDuelExportHandCard(hand, specialHandTags));
  return {
    name: card.name || card.displayName || "未命名角色",
    hp: card.hp,
    mp: card.mp,
    "四轴": cloneCustomDuelExportValue(card["四轴"] || {}),
    "特殊手札": specialHandTags,
    specialHandTags,
    explicitSpecialHandTags: specialHandTags,
    characterId: card.characterId || card.id || "",
    displayName: card.displayName || card.name || "未命名角色",
    customDuel: true,
    stage: getValidDuelStage(card.stage || "custom"),
    baseStats: cloneCustomDuelExportValue(card.baseStats || {}),
    specialConstitutionStatsApplied: card.specialConstitutionStatsApplied === true,
    innateTraits: cloneCustomDuelExportValue(card.innateTraits || []),
    loadout: cloneCustomDuelExportValue(card.loadout || []),
    selectedMechanisms: cloneCustomDuelExportValue(card.selectedMechanisms || []),
    selectedToolTags: cloneCustomDuelExportValue(card.selectedToolTags || []),
    selectedLibrary: cloneCustomDuelExportValue(card.selectedLibrary || {}),
    techniqueText: card.techniqueText || card.techniqueName || "无",
    techniqueFamilies: sanitizeCustomDuelTechniqueSpecialHandTags(
      normalizeCustomDuelSpecialHandTags(
        card.techniqueFamilies,
        techniqueSpecialHandTags,
        inferCustomDuelTechniqueFamilies(techniqueEvidenceText)
      ),
      techniqueEvidenceText
    ),
    externalResource: card.externalResource || "无",
    techniqueName: card.techniqueName || card.techniqueText || "无",
    techniqueDescription: card.techniqueDescription || "无",
    techniquePower: card.techniquePower || "B",
    domainProfile: card.domainProfile || "无",
    domainScript: card.domainScript ? cloneCustomDuelExportValue(card.domainScript) : null,
    visibleGrade: card.visibleGrade || "grade2",
    officialGrade: card.officialGrade || gradeLabel(card.visibleGrade),
    powerTier: card.powerTier || "custom",
    debugManualCombatScore: card.debugManualCombatScore,
    debugManualCombatUnit: card.debugManualCombatUnit,
    customHandCards,
    notes: card.notes || "无"
  };
}

function buildCustomDuelCharacterCardExport(card, exportedAt = new Date()) {
  return {
    schema: "jjk-battle-character-card-export",
    version: 1,
    status: "CUSTOM_USER_CARD",
    source: "custom-duel-character",
    siteVersion: APP_BUILD_VERSION,
    duelSystemVersion: typeof DUEL_SYSTEM_VERSION === "string" ? DUEL_SYSTEM_VERSION : "",
    exportedAt: exportedAt.toISOString(),
    character: normalizeCustomDuelCharacterCardForExport(card),
    importHint: "可在自定义角色的“角色卡 / 转盘导出数据导入”中读取。"
  };
}

async function exportCustomDuelCharacterCard(characterId) {
  const card = state.customDuelCards.find((item) => item.characterId === characterId);
  if (!card) {
    updateCustomDuelAccessStatus("没有找到要导出的自定义角色。", true);
    return;
  }
  const exportedAt = new Date();
  const payload = buildCustomDuelCharacterCardExport(card, exportedAt);
  if (globalThis.JJKLoginCard?.hasLogin?.()) {
    try {
      const result = await globalThis.JJKLoginCard.addCharacterExportPayload(payload);
      if (result?.ok) {
        updateCustomDuelAccessStatus(result.message || `已存入登录卡：${card.displayName || card.name || "未命名角色"}。请到“对战设置 > 管理卡面角色”统一下载。`);
        void globalThis.JJKDomModal?.alert("记得导出登录卡！否则你的角色就消失了！");
        return;
      }
      updateCustomDuelAccessStatus(result?.message || "写入登录卡失败。", true);
    } catch (error) {
      updateCustomDuelAccessStatus(error?.message || "写入登录卡失败。", true);
    }
    return;
  }
  updateCustomDuelAccessStatus("请先用登录卡 PNG 登录，再点击“存入登陆卡”。统一下载入口在“对战设置 > 管理卡面角色”。", true);
}

function buildCustomDuelSpecialHandTag(characterId) {
  return `custom_character_${String(characterId || "custom").replace(/[^\w-]+/g, "_")}`;
}

function normalizeCustomDuelSpecialHandTags(...sources) {
  const seen = new Set();
  return sources.flatMap((source) => Array.isArray(source) ? source : [source])
    .map((tag) => String(tag || "").trim())
    .filter((tag) => {
      if (!tag || tag === "无" || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    })
    .slice(0, 24);
}

function inferCustomDuelMechanismSourceSpecialHandTags(...sources) {
  const text = buildCustomDuelTechniqueEvidenceText(...sources);
  const tags = [];
  if (/零咒力天与咒缚|零咒力.*天与|天与咒缚[（(]?肉体强化型|天与暴君型|完全体天与咒缚|完全体天与|physical[_\s-]?heavenly[_\s-]?restriction|zero[_\s-]?ce/i.test(text)) {
    tags.push("zero_ce_heavenly_restriction");
  }
  if (/天逆鉾|天逆矛|inverted[_\s-]?spear/i.test(text)) tags.push("inverted_spear_of_heaven", "cursed_tool_user");
  if (/万里锁|万里の鎖|chain[_\s-]?of[_\s-]?thousand[_\s-]?miles/i.test(text)) tags.push("chain_of_thousand_miles", "cursed_tool_user");
  if (/释魂刀|釈魂刀|soul[_\s-]?split/i.test(text)) tags.push("soul_split_katana", "cursed_tool_user");
  if (/游云|遊雲|playful[_\s-]?cloud/i.test(text)) tags.push("playful_cloud", "cursed_tool_user");
  if (/黑绳|黒縄|black[_\s-]?rope/i.test(text)) tags.push("black_rope", "cursed_tool_user");
  if (/武器库咒灵|武器庫咒霊|inventory[_\s-]?curse/i.test(text)) tags.push("weapon_inventory_curse");
  if (/雅各布天梯|术式消灭|術式消滅|天使术式|天使術式|jacobs?[_\s-]?ladder|technique[_\s-]?extinguishment/i.test(text)) {
    tags.push("jacobs_ladder");
  }
  if (/再契象|契约再现|契約再現|服务收据|服務收據|收据|收據|票据|票據|receipt|recontract/i.test(text)) {
    tags.push("contract_recreation", "recontract_icon");
  }
  if (/超人术式|超人術式|高羽术式|高羽術式|笑点|冷场|包袱|comedian|comedy/i.test(text)) {
    tags.push("comedian");
  }
  if (/简易领域|簡易領域|新阴流|新陰流|拔刀防御|拔刀防禦|拔刀术|拔刀術|simple[_\s-]?domain|simple[_\s-]?domain[_\s-]?sword/i.test(text)) {
    tags.push("simple_domain_sword", "kusakabe_guard");
  }
  if (/不义游戏|不義遊戲|鼓掌换位|拍手节奏|boogie[_\s-]?woogie/i.test(text)) tags.push("boogie_woogie");
  if (/十划咒法|七三弱点|七三|ratio[_\s-]?technique/i.test(text)) tags.push("ratio_technique");
  if (/刍灵咒法|芻靈咒法|藁偶|共鸣|簪爆|straw[_\s-]?doll/i.test(text)) tags.push("straw_doll_technique");
  if (/咒言|停下|爆散令|喉咙负荷|cursed[_\s-]?speech/i.test(text)) tags.push("cursed_speech");
  if (/反转术式医师|反转治疗|战场急救|稳定治疗|医师分诊|rct[_\s-]?support|healer/i.test(text)) tags.push("rct_support");
  if (/咒骸|三核心|熊猫核|猩猩核|姐姐核|panda[_\s-]?core/i.test(text)) tags.push("panda_core_shift");
  if (/构筑术式|構築術式|真球|液金|虫甲|昆虫机理|construction|perfect[_\s-]?sphere/i.test(text)) tags.push("construction");
  if (/天空术式|天空術式|薄冰碎|空间折面|空面滑翔|sky[_\s-]?manipulation|thin[_\s-]?ice/i.test(text)) tags.push("sky_manipulation");
  if (/咒力大炮|龙髓炮|龍髓炮|花岗岩|花崗岩|granite[_\s-]?blast/i.test(text)) tags.push("granite_blast");
  if (/熔灾火藏|盖棺铁围山|火砾虫|极之番陨|漏瑚|disaster[_\s-]?flames/i.test(text)) tags.push("disaster_flames");
  if (/咒植幻生|朶颐光海|花田|咒种|花御|disaster[_\s-]?plants/i.test(text)) tags.push("disaster_plants");
  if (/潮灾式海|荡蕴平线|死累累涌军|海域|陀艮|disaster[_\s-]?tides/i.test(text)) tags.push("disaster_tides");
  if (/瘟柩葬仪|瘟柩三刻|疱疮神|三刻倒计时|棺材锁定|smallpox/i.test(text)) tags.push("smallpox_deity_countdown");
  if (/冰凝咒法|冰凝|霜凪|冰瀑|冻足|冻结层数|ice[_\s-]?formation/i.test(text)) tags.push("ice_formation");
  if (/祈本里香完全显现|完全显现里香|独立里香|特级过咒怨灵|完全显现式神|rika[_\s-]?independent/i.test(text)) tags.push("rika_independent_unit");
  if (/具象化杀意|杀意光束|暗光合压|达布拉卡拉巴|embodied[_\s-]?killing[_\s-]?intent/i.test(text)) tags.push("embodied_killing_intent_light");
  if (/混沌与调和|混沌偏移|调和修复|星律对冲|chaos[_\s-]?and[_\s-]?harmony/i.test(text)) tags.push("chaos_and_harmony");
  if (/Modulo复制|真剑复制|乙骨真剑|tsurugi[_\s-]?copy|modulo[_\s-]?copy/i.test(text)) tags.push("modulo_copy_lightweight");
  return normalizeCustomDuelSpecialHandTags(tags);
}

function normalizeCustomDuelMechanismSourceTags(card = {}) {
  const selectedLibrary = card.selectedLibrary || card.librarySelection || {};
  return normalizeCustomDuelSpecialHandTags(
    card.specialHandTags,
    card["特殊手札"],
    inferCustomDuelMechanismSourceSpecialHandTags(
      card.technique,
      card.techniqueName,
      card.techniqueText,
      card.techniqueDescription,
      card.domainProfile,
      card.externalResource,
      card.innateTraits,
      card.traits,
      card.advancedTechniques,
      card.loadout,
      card.selectedMechanisms,
      card.selectedToolTags,
      selectedLibrary.techniques,
      selectedLibrary.domains,
      selectedLibrary.advanced,
      selectedLibrary.resources,
      selectedLibrary.tools,
      selectedLibrary.cursedTools
    )
  );
}

function buildCustomDuelTechniqueEvidenceText(...sources) {
  return sources
    .flatMap((source) => Array.isArray(source) ? source : [source])
    .map((value) => normalizeCustomDuelText(value))
    .filter(Boolean)
    .join(" ");
}

function hasCustomDuelConstructionTechniqueEvidence(text = "") {
  const value = String(text || "");
  return /构筑术式|真球|液态金属|昆虫铠甲|三重疾苦|禅院真依|真依|yorozu|construction\s+sorcery/i.test(value) ||
    /(^|[\s、，,;；|/／])万($|[\s、，,;；|/／])/i.test(value);
}

function hasCustomDuelBloodTechniqueEvidence(text = "") {
  return /赤血操术|穿血|血刃|赤鳞跃动|超新星|苅祓|百敛|胀相|脹相|加茂宪纪|加茂憲紀|blood\s+manipulation/i.test(String(text || ""));
}

function hasCustomDuelTagEvidence(tag, evidenceText = "") {
  const text = String(evidenceText || "");
  const checks = {
    ten_shadows: /十种影法术|十种影|十影|嵌合暗翳庭|魔虚罗|魔須羅|魔须罗|mahoraga|ten[_\s-]?shadows/i,
    construction: /构筑术式|真球|液态金属|昆虫铠甲|三重疾苦|禅院真依|真依|yorozu|construction\s+sorcery/i,
    blood_manipulation: /赤血操术|穿血|血刃|赤鳞跃动|超新星|苅祓|百敛|胀相|脹相|加茂宪纪|加茂憲紀|blood\s+manipulation/i,
    projection_sorcery: /投射术式|投射咒法|二十四帧|帧率|直哉|直毘人|projection\s+sorcery/i,
    star_rage: /星之怒|虚拟质量|凰轮|黑洞|九十九由基|star\s+rage/i,
    limitless: /无下限|无量空处|赫|苍|茈|limitless|infinity/i,
    shrine: /御厨子|伏魔御厨子|宿傩|斩击|捌|sukuna|shrine|cleave|dismantle/i
  };
  const checker = checks[String(tag || "")];
  return checker ? checker.test(text) : true;
}

function sanitizeCustomDuelTechniqueSpecialHandTags(tags = [], evidenceText = "") {
  const normalized = normalizeCustomDuelSpecialHandTags(tags);
  return normalized.filter((tag) => {
    if (tag === "construction") return hasCustomDuelConstructionTechniqueEvidence(evidenceText);
    if (tag === "blood_manipulation") return hasCustomDuelBloodTechniqueEvidence(evidenceText);
    if (/^custom_duel_|^custom_hand_|^duel_ai_term_/.test(tag)) return true;
    if (["ten_shadows", "projection_sorcery", "star_rage", "limitless", "shrine"].includes(tag)) {
      return hasCustomDuelTagEvidence(tag, evidenceText);
    }
    return true;
  });
}

function inferCustomDuelTechniqueFamilies(text = "") {
  const values = collectCustomDuelTechniqueSourceTokens(text);
  const families = [];
  const hasAny = (aliases) => aliases.some((alias) => values.has(alias));
  if (hasAny(["无下限", "无下限术式", "limitless", "unlimitedvoid", "infinity"])) families.push("limitless", "gojo_limitless", "无下限");
  if (hasAny(["六眼", "sixeyes"])) families.push("six_eyes", "六眼");
  if (hasAny(["十种影法术", "十种影", "十影", "tenshadows"])) families.push("ten_shadows", "十种影法术");
  if (hasAny(["御厨子", "shrine", "sukunaslash"])) families.push("shrine", "御厨子");
  return Array.from(new Set(families));
}

function normalizeCustomDuelTechniqueLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s"'`“”‘’()[\]{}<>（）【】《》:：;；,，、\/／\\|._-]+/g, "")
    .trim();
}

function getCustomDuelTechniqueProfiles() {
  return state.strength?.techniqueProfiles && typeof state.strength.techniqueProfiles === "object"
    ? state.strength.techniqueProfiles
    : {};
}

function getCustomDuelProfileSpecialHandTags(profile) {
  if (!profile || typeof profile !== "object") return [];
  return normalizeCustomDuelSpecialHandTags(
    profile.specialHandTags,
    profile["特殊手札"],
    profile.specialHandTag,
    profile.specialTag
  );
}

function collectCustomDuelTechniqueProfileAliases(key, profile) {
  if (!profile || typeof profile !== "object") return [key].filter(Boolean);
  return normalizeCustomDuelSpecialHandTags(
    key,
    profile.displayName,
    profile.name,
    profile.owner,
    profile.representative,
    profile.ownerOrRepresentative,
    profile.domainName,
    profile.domainProfile,
    profile.alias,
    profile.aliases,
    profile.specialHandTags,
    profile["特殊手札"]
  );
}

function collectCustomDuelTechniqueSourceTokens(...sources) {
  return new Set(sources.flatMap((source) => Array.isArray(source) ? source : [source]).flatMap((source) => {
    if (source && typeof source === "object") {
      return [source.id, source.key, source.value, source.name, source.label, source.displayName];
    }
    return splitCustomDuelList(source);
  }).map(normalizeCustomDuelTechniqueLookupText).filter(Boolean));
}

function inferCustomDuelTechniqueSpecialHandTags(...sources) {
  const sourceTokens = collectCustomDuelTechniqueSourceTokens(...sources);
  if (!sourceTokens.size) return [];
  const sourceText = buildCustomDuelTechniqueEvidenceText(...sources);
  const tags = [];
  Object.entries(getCustomDuelTechniqueProfiles()).forEach(([key, profile]) => {
    const exactMatch = collectCustomDuelTechniqueProfileAliases(key, profile)
      .map(normalizeCustomDuelTechniqueLookupText)
      .filter(Boolean)
      .some((alias) => sourceTokens.has(alias));
    if (exactMatch && getCustomDuelProfileSpecialHandTags(profile).length) {
      tags.push(...getCustomDuelProfileSpecialHandTags(profile));
    }
  });
  return sanitizeCustomDuelTechniqueSpecialHandTags(
    normalizeCustomDuelSpecialHandTags(tags, inferCustomDuelTechniqueFamilies(...sources)),
    sourceText
  );
}

function buildCustomDuelCardAxes(stats = {}, techniquePower = "B", domain = "", loadout = [], traits = [], specialConstitutionStatsApplied = false) {
  const mechanismAdjustedStats = applyDuelMechanismRankAdjustments(stats, getDuelActiveMechanisms({ innateTraits: traits }));
  const adjustedStats = globalThis.JJKSpecialConstitution?.applyStatContract(
    mechanismAdjustedStats,
    { traits, innateTraits: traits, specialConstitutionStatsApplied: specialConstitutionStatsApplied === true }
  ) || mechanismAdjustedStats;
  const raw = {
    cursedEnergyScore: duelRankValue(adjustedStats.cursedEnergy),
    controlScore: duelRankValue(adjustedStats.control),
    efficiencyScore: duelRankValue(adjustedStats.efficiency),
    bodyScore: duelRankValue(adjustedStats.body),
    martialScore: duelRankValue(adjustedStats.martial),
    talentScore: duelRankValue(adjustedStats.talent)
  };
  const jujutsu = Number((raw.cursedEnergyScore * 0.5 + raw.controlScore * 0.27 + raw.efficiencyScore * 0.23).toFixed(2));
  const body = Number((raw.bodyScore * 0.54 + raw.martialScore * 0.46).toFixed(2));
  const insight = Number((raw.talentScore * 0.72 + raw.controlScore * 0.16 + raw.martialScore * 0.12).toFixed(2));
  const build = Number(Math.min(12, duelRankValue(techniquePower) * 0.38 + (domain ? 0.22 : 0) + Math.min(1.2, (loadout || []).length * 0.25) * 0.18 + Math.min(0.8, (traits || []).length * 0.18) * 0.1).toFixed(2));
  return { "咒术": jujutsu, "肉体": body, "悟性": insight, "构筑": build };
}

function normalizeCustomDuelHandCardsForCharacter(cards = [], characterId = "", specialHandTag = "", domainProfile = "", domainScript = null) {
  const forbiddenDomainNames = getCustomDuelDomainHandNames(domainProfile, domainScript);
  return (cards || [])
    .filter((card) => !isCustomDuelDomainNameHand(card, forbiddenDomainNames))
    .filter((card) => !isCustomDuelRuleSubphaseOnlyHand(card, domainScript))
    .map((card, index) => {
    const id = card.id || `custom_action_${String(characterId || "custom").replace(/[^\w-]+/g, "_")}_${index + 1}`;
    const tags = Array.from(new Set([...(card.tags || []), "自定义", "特殊手札", specialHandTag].filter(Boolean)));
    return normalizeCustomDuelDirectHandCardShape({
      ...card,
      id,
      actionId: id,
      cardId: card.cardId || `card_${id}`,
      status: "CANDIDATE",
      customDuelCard: true,
      customCharacterId: characterId,
      exclusiveToCharacters: [characterId],
      specialHandTags: [specialHandTag],
      "特殊手札": [specialHandTag],
      tags
    }, [specialHandTag], characterId);
  });
}

function getCustomDuelDomainHandNames(domainProfile = "", domainScript = null) {
  const names = new Set();
  splitCustomDuelList(domainProfile || "").forEach((part) => {
    const cleaned = part.replace(/^(领域展开|开放领域|顶级领域|未完成领域|领域)[:：]?/, "").trim();
    if (cleaned && !/无明确领域|无领域|没有领域|不具备领域|未知|未公开/.test(cleaned)) names.add(cleaned);
  });
  const scriptName = normalizeCustomDuelText(domainScript?.domainName || "");
  if (scriptName && !/无明确领域|无领域|没有领域|不具备领域|未知|未公开/.test(scriptName)) names.add(scriptName);
  return names;
}

function isCustomDuelDomainNameHand(card = {}, forbiddenDomainNames = new Set()) {
  const name = normalizeCustomDuelText(card.name || card.label || "");
  const cardType = normalizeCustomDuelText(card.cardType || card.type || "");
  if (!name) return false;
  if (/^(领域展开|展开领域|domain expansion)$/i.test(name)) return true;
  if (/^(领域展开|展开领域)[·:：\-\s]/i.test(name)) return true;
  if (forbiddenDomainNames.has(name)) return true;
  if (cardType === "domain" && card?.effects?.activateDomain) return true;
  return false;
}

function isCustomDuelRuleSubphaseOnlyHand(card = {}, domainScript = null) {
  const name = normalizeCustomDuelText(card.name || card.label || "");
  const text = [
    name,
    card.id,
    card.actionId,
    card.description,
    card.effectSummary,
    ...(card.tags || [])
  ].filter(Boolean).join(" ");
  if (/处刑人之剑|死刑判决|请求判决|证据提出|指控推进|辩护|审判牌|trial-replacement|request_verdict|present_evidence|press_charge|advance_trial|rule_pressure|challenge_evidence|deny_charge|delay_trial/i.test(text)) return true;
  if ((domainScript?.scriptType === "rule_trial_execution" || (domainScript?.effectTags || []).includes("rule_trial")) && /审判|裁判|判决|证据|指控|没收|死刑|处刑/.test(text)) return true;
  return false;
}

function normalizeCustomDuelText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function normalizeCustomDuelLongText(value, maxLength = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, Math.max(1, Number(maxLength) || 1200));
}

function splitCustomDuelList(value) {
  return String(value || "")
    .split(/[\n,，、;；]+/g)
    .map(normalizeCustomDuelText)
    .filter(Boolean)
    .slice(0, 12);
}

function readSelectedDuelDefinitionValues(select) {
  if (!select) return [];
  return Array.from(select.selectedOptions || [])
    .map((option) => normalizeCustomDuelText(option.value || option.textContent || ""))
    .filter(Boolean)
    .slice(0, 18);
}

function setSelectedDuelDefinitionValues(select, values = []) {
  if (!select) return;
  const selected = new Set((values || []).map(normalizeCustomDuelText).filter(Boolean));
  Array.from(select.options || []).forEach((option) => {
    option.selected = selected.has(normalizeCustomDuelText(option.value || option.textContent || ""));
  });
}

function parseOptionalDuelNumber(value, min, max) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Number(clamp(number, min, max).toFixed(4));
}

function parseRequiredDuelInteger(input, label, min = 0, max = 9999) {
  const raw = typeof input === "object" ? input?.value : input;
  const text = String(raw ?? "").trim();
  if (!/^-?\d+$/.test(text)) {
    throw new Error(`${label}必须填写整数。`);
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label}必须在 ${min} 到 ${max} 之间。`);
  }
  return value;
}

function populateDuelCustomHandTypeSelect() {
  if (!els.duelCustomHandType) return;
  const defaultLabels = {
    attack: "攻击",
    technique: "术式",
    ce_burst: "咒力爆发",
    defense: "防御",
    domain: "领域",
    support: "支援",
    resource: "资源",
    counter: "反击",
    rule: "规则",
    soul_pressure: "灵魂压迫",
    basic: "基础攻击",
    curse_tool: "咒具",
    special: "特殊术式",
    domain_response: "领域应对",
    domain_maintenance: "领域维持",
    rule_trial: "审判规则",
    rule_defense: "审判应对",
    jackpot: "坐杀搏徒"
  };
  const labels = { ...defaultLabels, ...(state.duelCardTemplateRules?.cardTypeLabels || {}) };
  const usedTypes = new Set(Object.keys(labels));
  (state.duelCardTemplateRules?.cards || []).forEach((card) => {
    if (card?.cardType) usedTypes.add(card.cardType);
  });
  const options = Array.from(usedTypes)
    .filter(Boolean)
    .sort()
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}（${escapeHtml(labels[type] || type)}）</option>`)
    .join("");
  if (els.duelCustomHandType.dataset.optionSignature === options) return;
  els.duelCustomHandType.innerHTML = options;
  els.duelCustomHandType.dataset.optionSignature = options;
  populateCustomDuelAtomicEffectTools();
}

function getCustomDuelAtomicToolDefinitions() {
  const api = globalThis.JJKCustomCharacterV3;
  return typeof api?.getEffectToolDefinitions === "function" ? api.getEffectToolDefinitions() : [];
}

function getCanonicalPendingCustomDuelEffects() {
  const protocol = globalThis.JJKDuelAtomicProtocol;
  const effects = state.pendingCustomDuelEffectTools || [];
  return typeof protocol?.normalizeAtomicEffects === "function"
    ? protocol.normalizeAtomicEffects(effects)
    : effects.map((effect) => ({
      ...cloneCustomDuelExportValue(effect),
      schema: effect.schema || "jjk.atomic-effect.v2",
      trigger: effect.trigger || effect.timing || "post-damage",
      when: Array.isArray(effect.when) ? effect.when : (effect.condition ? [effect.condition] : [])
    }));
}

function refreshCustomDuelEffectDslPreview() {
  if (!els.duelCustomEffectDslPreview) return;
  const graphApi = globalThis.JJKAtomicEffectGraph;
  if (!graphApi?.createAtomicEffectGraph || !graphApi?.serializeAtomicEffectDsl) {
    els.duelCustomEffectDslPreview.textContent = "原子图模块尚未加载。";
    return;
  }
  const effects = getCanonicalPendingCustomDuelEffects();
  if (!effects.length) {
    const unresolved = state.customDuelEffectNormalization?.unresolved || [];
    els.duelCustomEffectDslPreview.textContent = unresolved.length
      ? unresolved.map((entry) => `待解析｜${entry.text}`).join("\n")
      : "暂无预设效果。";
    return;
  }
  try {
    const graph = graphApi.createAtomicEffectGraph(effects, { graphId: "custom-duel-effect-preview" });
    const dsl = graphApi.serializeAtomicEffectDsl(graph);
    const unresolved = state.customDuelEffectNormalization?.unresolved || [];
    els.duelCustomEffectDslPreview.textContent = [
      dsl,
      ...unresolved.map((entry) => `待解析｜${entry.text}｜候选：${(entry.candidateTools || []).join("、")}`)
    ].filter(Boolean).join("\n");
  } catch (error) {
    els.duelCustomEffectDslPreview.textContent = `无法编译：${error?.issues?.[0]?.message || error?.message || "未知错误"}`;
  }
}

function updateCustomDuelEffectNormalizeStatus(message, isError = false) {
  if (!els.duelCustomEffectNormalizeStatus) return;
  els.duelCustomEffectNormalizeStatus.textContent = message || "";
  els.duelCustomEffectNormalizeStatus.classList.toggle("error-text", Boolean(isError));
}

const OC_SEMANTIC_STATE_LABELS = Object.freeze({
  direct: "已执行",
  composite: "可组合执行",
  descriptive: "仅保留说明",
  "needs-confirmation": "待确认"
});

function renderCustomDuelEffectSemanticReview(validation = null) {
  if (!els.duelCustomEffectSemanticReview || !els.duelCustomEffectSemanticGroups) return;
  const value = validation?.value;
  const groups = Array.isArray(value?.groups) ? value.groups : [];
  if (!groups.length) {
    els.duelCustomEffectSemanticReview.hidden = true;
    els.duelCustomEffectSemanticGroups.innerHTML = "";
    return;
  }
  const sourceById = new Map((state.customDuelEffectSourceDocument?.segments || []).map((entry) => [entry.id, entry]));
  els.duelCustomEffectSemanticGroups.innerHTML = groups.map((group) => {
    const clauses = Array.isArray(group.clauses) ? group.clauses : [];
    return `
      <section class="duel-semantic-group" data-semantic-group="${escapeHtml(group.id || "")}">
        <h4>${escapeHtml(group.name || "未命名能力组")}</h4>
        ${clauses.map((clause) => {
          const stateId = String(clause.disposition || "needs-confirmation");
          const sourceText = (clause.sourceRefs || []).map((ref) => sourceById.get(ref)?.text || "").filter(Boolean).join(" / ");
          const dsl = Array.isArray(clause.dsl) ? clause.dsl.filter(Boolean).join("\n") : "";
          return `
            <article class="duel-semantic-clause" data-semantic-state="${escapeHtml(stateId)}">
              <span class="duel-semantic-clause-state" data-semantic-state="${escapeHtml(stateId)}">${escapeHtml(OC_SEMANTIC_STATE_LABELS[stateId] || stateId)}</span>
              <p><strong>原文：</strong>${escapeHtml(sourceText || "未找到引用原文")}</p>
              <p><strong>整理：</strong>${escapeHtml(clause.meaning || "")}</p>
              ${clause.reason ? `<p><strong>说明：</strong>${escapeHtml(clause.reason)}</p>` : ""}
              ${dsl ? `<pre>${escapeHtml(dsl)}</pre>` : ""}
            </article>`;
        }).join("") || `<p class="muted">此分组没有可展示子句。</p>`}
      </section>`;
  }).join("");
  if (validation?.errors?.length) {
    els.duelCustomEffectSemanticGroups.insertAdjacentHTML("afterbegin", `<p class="error-text">安全校验未通过：${escapeHtml(validation.errors[0].message || "未知错误")}</p>`);
  }
  els.duelCustomEffectSemanticReview.hidden = false;
}

function shouldUseOcSemanticInterpreter(text, sourceDocument, normalization) {
  const rootCount = Number(normalization?.graph?.roots?.length || 0);
  const unresolvedCount = Number(normalization?.unresolved?.length || 0);
  return text.length > 400
    || Number(sourceDocument?.segments?.length || 0) > 6
    || unresolvedCount > 3
    || (rootCount > 1 && unresolvedCount / rootCount >= 0.6);
}

function applyCustomDuelOcInterpretation(validation) {
  state.customDuelEffectSemanticInterpretation = validation;
  state.pendingCustomDuelEffectTools = cloneCustomDuelExportValue(validation.compiledEffects || []);
  state.customDuelEffectEditIndex = -1;
  renderCustomDuelAtomicEffectList();
  renderCustomDuelEffectSemanticReview(validation);
}

function fillCustomDuelEffectSyntaxExample(event) {
  const text = String(event?.currentTarget?.dataset?.customEffectSyntaxExample || "").trim();
  if (!text || !els.duelCustomEffectNaturalText) return;
  els.duelCustomEffectNaturalText.value = text;
  updateCustomDuelEffectNormalizeStatus("示例已填入；点击“识别为预设效果”后才会解析，不会自动调用 AI。");
  els.duelCustomEffectNaturalText.focus();
}

function applyCustomDuelEffectNormalization(result, graphApi) {
  state.customDuelEffectNormalization = result;
  const resolvedGraph = cloneCustomDuelExportValue(result.graph);
  (result.unresolved || []).forEach((entry) => {
    resolvedGraph.roots = resolvedGraph.roots.filter((id) => id !== entry.id);
    delete resolvedGraph.nodes[entry.id];
  });
  state.pendingCustomDuelEffectTools = resolvedGraph.roots.length
    ? graphApi.compileAtomicEffectGraph(resolvedGraph)
    : [];
  state.customDuelEffectEditIndex = -1;
  renderCustomDuelAtomicEffectList();
}

async function normalizeCustomDuelEffectText() {
  const normalizer = globalThis.JJKChineseEffectNormalizer;
  const graphApi = globalThis.JJKAtomicEffectGraph;
  const sourceApi = globalThis.JJKOcSourceDocument;
  const text = String(els.duelCustomEffectNaturalText?.value || "").trim();
  if (!text) {
    updateCustomDuelEffectNormalizeStatus("请先填写中文效果描述。", true);
    els.duelCustomEffectNaturalText?.focus();
    return;
  }
  if (!normalizer?.normalizeChineseEffectText || !graphApi?.compileAtomicEffectGraph || !sourceApi?.buildOcSourceDocument) {
    updateCustomDuelEffectNormalizeStatus("中文归一化模块尚未加载，请刷新后重试。", true);
    return;
  }
  try {
    const sourceDocument = sourceApi.buildOcSourceDocument(text, {
      sourceId: String(els.duelCustomHandId?.value || els.duelCustomHandName?.value || "custom-card")
    });
    state.customDuelEffectSourceDocument = sourceDocument;
    state.customDuelEffectSemanticInterpretation = null;
    renderCustomDuelEffectSemanticReview(null);
    const result = normalizer.normalizeChineseEffectText(text, {
      sourceId: String(els.duelCustomHandName?.value || "custom-card")
    });
    applyCustomDuelEffectNormalization(result, graphApi);
    if (!result.aiRequired) {
      updateCustomDuelEffectNormalizeStatus(`已由本地规则生成 ${state.pendingCustomDuelEffectTools.length} 个预设效果，无需调用 AI。`);
      return;
    }
    if (shouldUseOcSemanticInterpreter(text, sourceDocument, result)) {
      const semanticBatches = globalThis.JJKOcEffectInterpreter?.buildOcEffectInterpretationBatches?.(sourceDocument, {
        maxBatches: 3,
        targetChars: 1600,
        targetSegments: 45,
      }) || [sourceDocument];
      let pointsPerRequest = 1;
      try {
        pointsPerRequest = window.localStorage.getItem("jjk-ai-credit-model-choice-v1") === "pro" ? 2 : 1;
      } catch (error) {
        pointsPerRequest = 1;
      }
      const requiredPoints = semanticBatches.length * pointsPerRequest;
      try {
        const creditStatus = await globalThis.JJKAiCredits?.refresh?.();
        if (Number.isFinite(Number(creditStatus?.credits)) && Number(creditStatus.credits) < requiredPoints) {
          document.dispatchEvent(new CustomEvent("jjk-ai-credits-insufficient", {
            detail: { required: requiredPoints, available: Number(creditStatus.credits) }
          }));
          updateCustomDuelEffectNormalizeStatus(
            `本次需要 ${requiredPoints} AI 积分，当前只有 ${Number(creditStatus.credits)}；尚未发起请求或扣分。`,
            true
          );
          return;
        }
      } catch (error) {
        updateCustomDuelEffectNormalizeStatus("无法刷新 AI 积分，尚未发起请求或扣分；请检查网络后重试。", true);
        return;
      }
      updateCustomDuelEffectNormalizeStatus(
        `检测到真实长设定或高歧义输入；将按 ${semanticBatches.length} 批短上下文整理 ${sourceDocument.segments.length} 个原文片段，预计消耗 ${requiredPoints} 积分。`
      );
      if (els.duelCustomEffectNormalizeBtn) els.duelCustomEffectNormalizeBtn.disabled = true;
      try {
        const semanticValidation = await requestCustomDuelOcEffectInterpretation(sourceDocument, {
          onBatchStart: ({ index, count }) => updateCustomDuelEffectNormalizeStatus(
            `正在处理第 ${index}/${count} 批短上下文；本次共预计消耗 ${count * pointsPerRequest} 积分。`
          )
        });
        applyCustomDuelOcInterpretation(semanticValidation);
        const counts = semanticValidation.clauseReports.reduce((result, entry) => {
          result[entry.disposition] = Number(result[entry.disposition] || 0) + 1;
          return result;
        }, {});
        updateCustomDuelEffectNormalizeStatus(
          `整理完成（${semanticValidation.batchCount || 1} 批）：应用 ${semanticValidation.compiledEffects.length} 个安全效果；可组合 ${counts.composite || 0} 条，仅说明 ${counts.descriptive || 0} 条，待确认 ${counts["needs-confirmation"] || 0} 条。`
        );
      } catch (error) {
        if (error?.semanticValidation) renderCustomDuelEffectSemanticReview(error.semanticValidation);
        const message = typeof buildDuelAiFailureMessage === "function"
          ? buildDuelAiFailureMessage(error)
          : (error?.message || "真实 OC 语义整理失败");
        updateCustomDuelEffectNormalizeStatus(`语义整理未通过安全校验；已保留原文和本地确认结果：${message}`, true);
      } finally {
        if (els.duelCustomEffectNormalizeBtn) els.duelCustomEffectNormalizeBtn.disabled = false;
      }
      return;
    }
    const fragments = result.unresolved.map((entry) => `“${entry.text}”`).join("、");
    updateCustomDuelEffectNormalizeStatus(
      `本地已确认 ${state.pendingCustomDuelEffectTools.length} 个积木；正在请求 AI 仅补全 ${result.unresolved.length} 个歧义片段：${fragments}`
    );
    if (els.duelCustomEffectNormalizeBtn) els.duelCustomEffectNormalizeBtn.disabled = true;
    try {
      const resolved = await requestCustomDuelAtomicResolution(result, {
        cardId: String(els.duelCustomHandId?.value || els.duelCustomHandName?.value || "custom-card"),
        cardName: String(els.duelCustomHandName?.value || ""),
        cardText: text
      });
      applyCustomDuelEffectNormalization(resolved, graphApi);
      if (resolved.aiRequired) {
        updateCustomDuelEffectNormalizeStatus(
          `AI 已补全一部分；仍有 ${resolved.unresolved.length} 个片段无法可靠判断，已原样保留供手动组装。`,
          true
        );
      } else {
        updateCustomDuelEffectNormalizeStatus(
          `识别完成：本地规则与 AI 受限补丁共生成 ${state.pendingCustomDuelEffectTools.length} 个预设效果。`
        );
      }
    } catch (error) {
      const message = typeof buildDuelAiFailureMessage === "function"
        ? buildDuelAiFailureMessage(error)
        : (error?.message || "AI 补丁请求失败");
      updateCustomDuelEffectNormalizeStatus(
        `AI 补全失败，已保留本地确认结果和全部歧义原文：${message}`,
        true
      );
    } finally {
      if (els.duelCustomEffectNormalizeBtn) els.duelCustomEffectNormalizeBtn.disabled = false;
    }
  } catch (error) {
    updateCustomDuelEffectNormalizeStatus(error?.message || "中文效果识别失败。", true);
  }
}

function importCustomDuelEffectDsl() {
  const graphApi = globalThis.JJKAtomicEffectGraph;
  const text = String(els.duelCustomEffectDsl?.value || "").trim();
  if (!text) {
    updateCustomDuelEffectNormalizeStatus("请先填写中文 DSL。", true);
    return;
  }
  if (!graphApi?.parseAtomicEffectDsl || !graphApi?.compileAtomicEffectGraph) {
    updateCustomDuelEffectNormalizeStatus("原子图模块尚未加载，请刷新后重试。", true);
    return;
  }
  try {
    const parsed = graphApi.parseAtomicEffectDsl(text, { graphId: "custom-duel-dsl-import" });
    if (parsed.errors.length) throw new Error(parsed.errors.map((entry) => entry.message).join("；"));
    state.pendingCustomDuelEffectTools = graphApi.compileAtomicEffectGraph(parsed.graph);
    state.customDuelEffectNormalization = null;
    state.customDuelEffectEditIndex = -1;
    renderCustomDuelAtomicEffectList();
    updateCustomDuelEffectNormalizeStatus(`中文 DSL 编译成功，已替换为 ${state.pendingCustomDuelEffectTools.length} 个预设效果。`);
  } catch (error) {
    updateCustomDuelEffectNormalizeStatus(error?.message || "中文 DSL 编译失败。", true);
  }
}

function exportCurrentCustomDuelDraft() {
  const form = readCustomDuelForm();
  if (!form) return;
  const customV3 = globalThis.JJKCustomCharacterV3;
  if (!customV3?.migrateLegacyCustomCharacter || !customV3?.validateCustomCharacter) {
    updateCustomDuelAccessStatus("V3 角色数据模块尚未加载，暂时无法导出。", true);
    return;
  }
  const cards = (state.pendingCustomDuelHandCards || []).map((card) => (
    cloneCustomDuelExportValue(card.canonicalCard || card)
  ));
  const character = customV3.migrateLegacyCustomCharacter({
    displayName: form.name,
    visibleGrade: form.visibleGrade,
    stage: form.stage,
    baseStats: form.stats,
    techniquePower: form.techniquePower,
    techniques: splitCustomDuelList(form.technique).map((name, index) => ({
      id: `custom-technique-${index + 1}`,
      name,
      power: form.techniquePower
    })),
    domain: form.domain && form.domain !== "无" ? { name: form.domain } : null,
    loadout: form.tools,
    innateTraits: form.traits,
    externalResource: form.externalResource,
    notes: form.notes,
    cards
  }, { source: "workbench-export" });
  const validation = customV3.validateCustomCharacter(character, { requireCards: false });
  let payload = {
    schema: "jjk.custom-character.workbench-export.v1",
    version: 1,
    exportedAt: new Date().toISOString(),
    character: validation.value,
    cards: validation.value.cards,
    validation: {
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
      budget: validation.budget,
      budgetLimit: validation.budgetLimit
    }
  };
  const filename = `${sanitizeCustomDuelFilenamePart(form.name)}-角色卡牌-${getCustomDuelExportDateText()}.json`;
  downloadCustomDuelCharacterJson(JSON.stringify(payload, null, 2), filename);
  updateCustomDuelAccessStatus(`已导出 ${validation.value.cards.length} 张卡牌和角色结构；${validation.ok ? "校验通过" : `仍有 ${validation.errors.length} 个校验问题` }。`, !validation.ok);
}

function populateCustomDuelAtomicEffectTools() {
  if (!els.duelCustomEffectTool) return;
  const definitions = getCustomDuelAtomicToolDefinitions();
  const signature = definitions.map((definition) => `${definition.id}:${definition.label}`).join("|");
  if (els.duelCustomEffectTool.dataset.optionSignature !== signature) {
    els.duelCustomEffectTool.innerHTML = definitions
      .map((definition) => `<option value="${escapeHtml(definition.id)}">${escapeHtml(definition.label)}（${escapeHtml(definition.id)}）</option>`)
      .join("");
    els.duelCustomEffectTool.dataset.optionSignature = signature;
  }
  renderCustomDuelAtomicEffectFields();
  renderCustomDuelAtomicEffectList();
}

function getSelectedCustomDuelAtomicDefinition() {
  const id = String(els.duelCustomEffectTool?.value || "");
  return getCustomDuelAtomicToolDefinitions().find((definition) => definition.id === id) || null;
}

function syncCustomDuelAtomicTimingOptions(definition, preferredTiming = "") {
  if (!els.duelCustomEffectTiming || !definition) return;
  const labels = {
    "pre-damage": "伤害前",
    "post-damage": "伤害后",
    "turn-end": "回合结束"
  };
  const timings = Array.isArray(definition.timings) && definition.timings.length
    ? definition.timings
    : ["pre-damage", "post-damage", "turn-end"];
  const fallback = definition.defaultTiming || (timings.includes("post-damage") ? "post-damage" : timings[0]);
  const selected = timings.includes(preferredTiming)
    ? preferredTiming
    : (timings.includes(els.duelCustomEffectTiming.value) ? els.duelCustomEffectTiming.value : fallback);
  els.duelCustomEffectTiming.innerHTML = timings
    .map((timing) => `<option value="${escapeHtml(timing)}">${escapeHtml(labels[timing] || timing)}</option>`)
    .join("");
  els.duelCustomEffectTiming.value = selected;
  els.duelCustomEffectTiming.disabled = timings.length === 1;
  els.duelCustomEffectTiming.title = timings.length === 1 ? "该工具的结算时机由运行规则固定" : "选择该效果的实际结算时机";
}

function renderCustomDuelAtomicEffectFields() {
  if (!els.duelCustomEffectFields) return;
  const definition = getSelectedCustomDuelAtomicDefinition();
  if (!definition) {
    els.duelCustomEffectFields.innerHTML = `<p class="muted">原子效果定义尚未加载。</p>`;
    return;
  }
  syncCustomDuelAtomicTimingOptions(definition);
  const fields = Array.isArray(definition.fields) ? definition.fields : [];
  els.duelCustomEffectFields.innerHTML = `
    <p class="duel-atomic-effect-help">${escapeHtml(definition.help || "")}</p>
    ${fields.map((field) => {
      const value = field.default ?? "";
      if (field.type === "select") {
        return `<label class="field"><span>${escapeHtml(field.label)}</span><select data-custom-atomic-param="${escapeHtml(field.key)}">${(field.options || []).map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(value) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
        }).join("")}</select></label>`;
      }
      if (field.type === "checkbox") {
        return `<label class="field duel-atomic-checkbox"><span>${escapeHtml(field.label)}</span><input data-custom-atomic-param="${escapeHtml(field.key)}" type="checkbox" ${value ? "checked" : ""}></label>`;
      }
      if (field.type === "number") {
        return `<label class="field"><span>${escapeHtml(field.label)}</span><input data-custom-atomic-param="${escapeHtml(field.key)}" type="number" min="${escapeHtml(field.min ?? "")}" max="${escapeHtml(field.max ?? "")}" step="${escapeHtml(field.step ?? 1)}" value="${escapeHtml(value)}"></label>`;
      }
      return `<label class="field"><span>${escapeHtml(field.label)}</span><input data-custom-atomic-param="${escapeHtml(field.key)}" type="text" maxlength="100" value="${escapeHtml(value)}"></label>`;
    }).join("")}`;
}

function readCustomDuelAtomicEffectForm() {
  const definition = getSelectedCustomDuelAtomicDefinition();
  if (!definition) throw new Error("请选择原子效果工具。");
  const params = {};
  (definition.fields || []).forEach((field) => {
    const input = els.duelCustomEffectFields?.querySelector(`[data-custom-atomic-param="${field.key}"]`);
    if (!input) return;
    if (field.type === "checkbox") params[field.key] = Boolean(input.checked);
    else if (field.type === "number") {
      const value = Number(input.value);
      if (!Number.isFinite(value)) throw new Error(`${field.label}必须是有效数字。`);
      params[field.key] = Math.max(Number(field.min ?? -Infinity), Math.min(Number(field.max ?? Infinity), value));
    } else params[field.key] = String(input.value || "").trim().slice(0, 100);
  });
  state.customDuelEffectSeq = Number(state.customDuelEffectSeq || 0) + 1;
  const effect = {
    id: `custom_effect_${Date.now().toString(36)}_${state.customDuelEffectSeq}`,
    tool: definition.id,
    timing: String(els.duelCustomEffectTiming?.value || "post-damage"),
    target: String(els.duelCustomEffectTarget?.value || "self"),
    params
  };
  const conditionInputs = [
    [
      els.duelCustomEffectConditionSource,
      els.duelCustomEffectConditionOperator,
      els.duelCustomEffectConditionThreshold
    ],
    [
      els.duelCustomEffectConditionSource2,
      els.duelCustomEffectConditionOperator2,
      els.duelCustomEffectConditionThreshold2
    ]
  ];
  effect.when = conditionInputs.flatMap(([sourceInput, operatorInput, thresholdInput]) => {
    const source = String(sourceInput?.value || "");
    if (!source) return [];
    return [{
      source,
      operator: String(operatorInput?.value || ">="),
      threshold: Number(thresholdInput?.value || 0)
    }];
  });
  return effect;
}

function addCustomDuelAtomicEffect() {
  try {
    const effect = readCustomDuelAtomicEffectForm();
    state.pendingCustomDuelEffectTools ||= [];
    const editIndex = Number(state.customDuelEffectEditIndex);
    if (Number.isInteger(editIndex) && editIndex >= 0 && editIndex < state.pendingCustomDuelEffectTools.length) {
      effect.id = state.pendingCustomDuelEffectTools[editIndex].id || effect.id;
      state.pendingCustomDuelEffectTools[editIndex] = effect;
    } else state.pendingCustomDuelEffectTools.push(effect);
    state.customDuelEffectNormalization = null;
    state.customDuelEffectEditIndex = -1;
    if (els.duelCustomEffectAddBtn) els.duelCustomEffectAddBtn.textContent = "加入效果";
    renderCustomDuelAtomicEffectList();
    updateCustomDuelHandStatus(`已${editIndex >= 0 ? "保存" : "加入"}原子效果：${getSelectedCustomDuelAtomicDefinition()?.label || effect.tool}`);
  } catch (error) {
    updateCustomDuelHandStatus(error?.message || "原子效果格式不正确。", true);
  }
}

function formatCustomDuelAtomicEffect(effect) {
  const definition = getCustomDuelAtomicToolDefinitions().find((item) => item.id === effect.tool);
  const fields = Object.entries(effect.params || {}).map(([key, value]) => `${key}=${value}`).join("，");
  const conditions = Array.isArray(effect.when) ? effect.when : (effect.condition ? [effect.condition] : []);
  const condition = conditions.length
    ? `；条件 ${conditions.map((entry) => `${entry.source} ${entry.operator} ${entry.threshold}`).join(" 且 ")}`
    : "";
  return `${definition?.label || effect.tool} · ${effect.target || "self"} · ${effect.trigger || effect.timing || "post-damage"}${fields ? `；${fields}` : ""}${condition}`;
}

function renderCustomDuelAtomicEffectList() {
  if (!els.duelCustomEffectList) return;
  const effects = state.pendingCustomDuelEffectTools || [];
  if (!effects.length) {
    els.duelCustomEffectList.innerHTML = `<p class="muted">暂无原子效果；普通伤害、防御和系数仍会按牌面生效。</p>`;
    refreshCustomDuelEffectDslPreview();
    return;
  }
  els.duelCustomEffectList.innerHTML = effects.map((effect, index) => `
    <article class="duel-atomic-effect-item" data-custom-effect-index="${index}">
      <span class="duel-atomic-effect-order">${index + 1}</span>
      <div class="duel-atomic-effect-copy">
        <strong>${escapeHtml(getCustomDuelAtomicToolDefinitions().find((item) => item.id === effect.tool)?.label || effect.tool)}</strong>
        <span>${escapeHtml(formatCustomDuelAtomicEffect(effect))}</span>
      </div>
      <div class="duel-custom-actions">
        <button class="secondary mini" type="button" data-custom-effect-move="up" aria-label="上移效果">↑</button>
        <button class="secondary mini" type="button" data-custom-effect-move="down" aria-label="下移效果">↓</button>
        <button class="secondary mini" type="button" data-custom-effect-duplicate aria-label="复制效果">复制</button>
        <button class="secondary" type="button" data-custom-effect-edit="${index}">编辑</button>
        <button class="secondary danger" type="button" data-custom-effect-remove="${index}">移除</button>
      </div>
    </article>
  `).join("");
  els.duelCustomEffectList.querySelectorAll("[data-custom-effect-edit]").forEach((button) => button.addEventListener("click", () => editCustomDuelAtomicEffect(Number(button.dataset.customEffectEdit))));
  els.duelCustomEffectList.querySelectorAll("[data-custom-effect-remove]").forEach((button) => button.addEventListener("click", () => {
    state.pendingCustomDuelEffectTools.splice(Number(button.dataset.customEffectRemove), 1);
    state.customDuelEffectNormalization = null;
    renderCustomDuelAtomicEffectList();
  }));
  els.duelCustomEffectList.querySelectorAll("[data-custom-effect-move]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.closest("[data-custom-effect-index]")?.dataset.customEffectIndex);
    const direction = button.dataset.customEffectMove === "up" ? -1 : 1;
    const nextIndex = index + direction;
    if (!Number.isInteger(index) || nextIndex < 0 || nextIndex >= state.pendingCustomDuelEffectTools.length) return;
    const [effect] = state.pendingCustomDuelEffectTools.splice(index, 1);
    state.pendingCustomDuelEffectTools.splice(nextIndex, 0, effect);
    state.customDuelEffectNormalization = null;
    renderCustomDuelAtomicEffectList();
  }));
  els.duelCustomEffectList.querySelectorAll("[data-custom-effect-duplicate]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.closest("[data-custom-effect-index]")?.dataset.customEffectIndex);
    const source = state.pendingCustomDuelEffectTools[index];
    if (!source) return;
    state.customDuelEffectSeq = Number(state.customDuelEffectSeq || 0) + 1;
    const copy = cloneCustomDuelExportValue(source);
    copy.id = `custom_effect_${Date.now().toString(36)}_${state.customDuelEffectSeq}`;
    state.pendingCustomDuelEffectTools.splice(index + 1, 0, copy);
    state.customDuelEffectNormalization = null;
    renderCustomDuelAtomicEffectList();
  }));
  refreshCustomDuelEffectDslPreview();
}

function editCustomDuelAtomicEffect(index) {
  const effect = state.pendingCustomDuelEffectTools?.[index];
  if (!effect) return;
  state.customDuelEffectEditIndex = index;
  if (els.duelCustomEffectTool) els.duelCustomEffectTool.value = effect.tool;
  if (els.duelCustomEffectTarget) els.duelCustomEffectTarget.value = effect.target || "self";
  renderCustomDuelAtomicEffectFields();
  syncCustomDuelAtomicTimingOptions(getSelectedCustomDuelAtomicDefinition(), effect.timing || "post-damage");
  Object.entries(effect.params || {}).forEach(([key, value]) => {
    const input = els.duelCustomEffectFields?.querySelector(`[data-custom-atomic-param="${key}"]`);
    if (!input) return;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value ?? "");
  });
  const conditions = Array.isArray(effect.when) ? effect.when : (effect.condition ? [effect.condition] : []);
  const conditionControls = [
    [
      els.duelCustomEffectConditionSource,
      els.duelCustomEffectConditionOperator,
      els.duelCustomEffectConditionThreshold,
      0.5
    ],
    [
      els.duelCustomEffectConditionSource2,
      els.duelCustomEffectConditionOperator2,
      els.duelCustomEffectConditionThreshold2,
      1
    ]
  ];
  conditionControls.forEach(([sourceInput, operatorInput, thresholdInput, fallback], conditionIndex) => {
    const condition = conditions[conditionIndex];
    if (sourceInput) sourceInput.value = condition?.source || "";
    if (operatorInput) operatorInput.value = condition?.operator || ">=";
    if (thresholdInput) thresholdInput.value = String(condition?.threshold ?? fallback);
  });
  if (els.duelCustomEffectAddBtn) els.duelCustomEffectAddBtn.textContent = "保存效果";
}

function readCustomDuelHandForm() {
  const name = normalizeCustomDuelText(els.duelCustomHandName?.value || "").slice(0, 40);
  if (!name) throw new Error("请先填写手札名称。");
  const cardType = normalizeCustomDuelText(els.duelCustomHandType?.value || "");
  if (!cardType) throw new Error("请选择手札类型。");
  const risk = ["low", "medium", "high", "critical"].includes(els.duelCustomHandRisk?.value)
    ? els.duelCustomHandRisk.value
    : "medium";
  const apCost = parseRequiredDuelInteger(els.duelCustomHandApCost, "行动点消耗", 0, 3);
  const ceCost = parseRequiredDuelInteger(els.duelCustomHandCeCost, "咒力消耗", 0, 999);
  const damage = parseRequiredDuelInteger(els.duelCustomHandDamage, "伤害", 0, 999);
  const block = parseRequiredDuelInteger(els.duelCustomHandBlock, "防御", 0, 999);
  const stability = parseRequiredDuelInteger(els.duelCustomHandStability, "稳定修正", -100, 100);
  const domainLoad = parseRequiredDuelInteger(els.duelCustomHandDomainLoad, "领域负荷", 0, 999);
  const summary = normalizeCustomDuelText(els.duelCustomHandSummary?.value || "") || `${name}：自定义特殊手札。`;
  const effectSourceText = String(els.duelCustomEffectNaturalText?.value || "").trim() || summary;
  const tags = splitCustomDuelList(els.duelCustomHandTags?.value || "");
  const readScale = (input, label) => {
    const value = Number(input?.value || 0);
    if (!Number.isFinite(value) || value < 0 || value > 1.2) throw new Error(`${label}必须在 0 到 1.2 之间。`);
    return Number(value.toFixed(3));
  };
  const scope = ["solo", "aoe"].includes(els.duelCustomHandScope?.value) ? els.duelCustomHandScope.value : "solo";
  const damageType = ["common", "penetrate", "real"].includes(els.duelCustomHandDamageType?.value) ? els.duelCustomHandDamageType.value : "common";
  const penetrationRatio = Math.max(0, Math.min(0.8, Number(els.duelCustomHandPenetration?.value || 0)));
  const atomicEffects = (state.pendingCustomDuelEffectTools || []).map((effect) => cloneCustomDuelExportValue(effect));
  if (stability) atomicEffects.push({ id: "stability-adjustment", tool: "adjust_resource", timing: "post-damage", target: "self", params: { resource: "stability", amount: Number((stability / 100).toFixed(4)) } });
  if (domainLoad) atomicEffects.push({ id: "domain-load-adjustment", tool: "adjust_resource", timing: "post-damage", target: "self", params: { resource: "domainLoad", amount: domainLoad } });
  state.customDuelHandSeq += 1;
  const draftId = `custom_hand_draft_${Date.now().toString(36)}_${state.customDuelHandSeq}`;
  const v3 = globalThis.JJKCustomCharacterV3;
  if (!v3?.validateCardV3 || !v3?.projectCardToRuntime) throw new Error("V3 自定义卡牌校验器尚未加载，请刷新页面后重试。");
  const validation = v3.validateCardV3({
    schema: v3.schemas?.card || "jjk.card.v3",
    id: draftId,
    name,
    cardType,
    cost: { ap: apCost, ce: { mode: "flat", value: ceCost } },
    tags: Array.from(new Set(["自定义", "特殊手札", ...tags].filter(Boolean))),
    text: { summary },
    power: { attack: damage, defense: block },
    damage: { scope, type: damageType, penetrationRatio: damageType === "penetrate" ? penetrationRatio : 0 },
    scaleWith: {
      cePool: readScale(els.duelCustomHandScaleCePool, "咒力总量系数"),
      ceControl: readScale(els.duelCustomHandScaleControl, "咒力操纵系数"),
      physicalPower: readScale(els.duelCustomHandScalePhysical, "体术系数"),
      techniquePower: readScale(els.duelCustomHandScaleTechnique, "术式强度系数")
    },
    effects: atomicEffects,
    risk
  });
  if (!validation.ok) throw new Error(validation.errors?.[0]?.message || "卡牌未通过 V3 数值与结构校验。");
  const card = v3.projectCardToRuntime(validation.value, { index: state.pendingCustomDuelHandCards?.length || 0 });
  card.effects = { weightDeltas: buildCustomHandWeightDeltas(card.cardType, damage, block) };
  card.effectSummary = summary;
  card.effectSourceText = effectSourceText;
  card.originalEffectDescription = effectSourceText;
  card.logTemplate = summary;
  card.rarity = "special";
  card.weight = 1;
  card.contexts = ["normal", "domain", "trial_allowed"];
  card.canonicalValidation = { ok: true, budget: validation.budget, budgetLimit: validation.budgetLimit, warnings: validation.warnings };
  return card;
}

function buildCustomHandWeightDeltas(cardType, damage, block) {
  const deltas = {};
  if (damage > 0) {
    deltas.technique = cardType === "technique" || cardType === "special" ? 0.8 : 0.25;
    deltas.finisher = Math.min(1.2, damage / 40);
  }
  if (block > 0 || cardType === "defense") {
    deltas.sustain = Math.max(deltas.sustain || 0, 0.65);
    deltas.counter = Math.max(deltas.counter || 0, 0.25);
  }
  if (cardType === "domain") deltas.domain = 1.1;
  if (cardType === "resource") deltas.resource = 0.9;
  if (cardType === "curse_tool") deltas.melee = 0.7;
  return deltas;
}

function inferCustomHandDamageType(cardType) {
  if (cardType === "curse_tool") return "cursed_tool";
  if (cardType === "basic") return "melee";
  if (cardType === "defense" || cardType === "support" || cardType === "resource") return "none";
  return "technique";
}

function inferCustomHandScalingProfile(cardType) {
  if (cardType === "defense") return "defense";
  if (cardType === "domain") return "domain";
  if (cardType === "curse_tool" || cardType === "basic") return "physical";
  return "balanced";
}

function addCustomDuelHandCard() {
  try {
    const card = readCustomDuelHandForm();
    const editIndex = Number(state.customDuelHandEditIndex);
    if (Number.isInteger(editIndex) && editIndex >= 0 && editIndex < state.pendingCustomDuelHandCards.length) {
      const preservedId = state.pendingCustomDuelHandCards[editIndex].id || card.id;
      card.id = preservedId;
      if (card.canonicalCard) card.canonicalCard.id = preservedId;
      state.pendingCustomDuelHandCards[editIndex] = card;
      state.customDuelHandEditIndex = -1;
    } else {
      state.pendingCustomDuelHandCards.push(card);
    }
    clearCustomDuelHandForm();
    renderPendingCustomDuelHandList();
    updateCustomDuelHandStatus(`${editIndex >= 0 ? "已保存" : "已加入"}特殊手札：${card.name}`);
  } catch (error) {
    updateCustomDuelHandStatus(error?.message || "特殊手札格式不正确。", true);
    void globalThis.JJKDomModal?.alert(error?.message || "特殊手札格式不正确。");
  }
}

function clearCustomDuelHandForm() {
  if (els.duelCustomHandName) els.duelCustomHandName.value = "";
  if (els.duelCustomHandSummary) els.duelCustomHandSummary.value = "";
  if (els.duelCustomEffectNaturalText) els.duelCustomEffectNaturalText.value = "";
  if (els.duelCustomHandTags) els.duelCustomHandTags.value = "";
  if (els.duelCustomHandApCost) els.duelCustomHandApCost.value = "1";
  if (els.duelCustomHandCeCost) els.duelCustomHandCeCost.value = "10";
  if (els.duelCustomHandDamage) els.duelCustomHandDamage.value = "10";
  if (els.duelCustomHandBlock) els.duelCustomHandBlock.value = "0";
  if (els.duelCustomHandStability) els.duelCustomHandStability.value = "0";
  if (els.duelCustomHandDomainLoad) els.duelCustomHandDomainLoad.value = "0";
  if (els.duelCustomHandScope) els.duelCustomHandScope.value = "solo";
  if (els.duelCustomHandDamageType) els.duelCustomHandDamageType.value = "common";
  if (els.duelCustomHandPenetration) els.duelCustomHandPenetration.value = "0";
  if (els.duelCustomHandScaleCePool) els.duelCustomHandScaleCePool.value = "0";
  if (els.duelCustomHandScaleControl) els.duelCustomHandScaleControl.value = "0.5";
  if (els.duelCustomHandScalePhysical) els.duelCustomHandScalePhysical.value = "0";
  if (els.duelCustomHandScaleTechnique) els.duelCustomHandScaleTechnique.value = "0.5";
  state.pendingCustomDuelEffectTools = [];
  state.customDuelEffectNormalization = null;
  state.customDuelEffectEditIndex = -1;
  if (els.duelCustomEffectAddBtn) els.duelCustomEffectAddBtn.textContent = "加入效果";
  renderCustomDuelAtomicEffectList();
  state.customDuelHandEditIndex = -1;
  if (els.duelCustomHandAddBtn) els.duelCustomHandAddBtn.textContent = "加入特殊手札";
}

function clearPendingCustomDuelHandCards() {
  state.pendingCustomDuelHandCards = [];
  state.customDuelHandEditIndex = -1;
  clearCustomDuelHandForm();
  renderPendingCustomDuelHandList();
  updateCustomDuelHandStatus("已清空待接入特殊手札。");
}

function updateCustomDuelHandStatus(message, isError = false) {
  if (!els.duelCustomHandStatus) return;
  els.duelCustomHandStatus.textContent = message;
  els.duelCustomHandStatus.classList.toggle("error-text", Boolean(isError));
}

function renderPendingCustomDuelHandList() {
  if (!els.duelCustomHandList) return;
  const cards = state.pendingCustomDuelHandCards || [];
  if (!cards.length) {
    els.duelCustomHandList.innerHTML = `<p class="muted">暂无待接入特殊手札。</p>`;
    return;
  }
  els.duelCustomHandList.innerHTML = cards.map((card, index) => `
    <article class="duel-custom-item">
      <div>
        <strong>${escapeHtml(card.name || card.label)}</strong>
        <span>${escapeHtml(card.cardType)} · CE（咒力） ${escapeHtml((card.cost?.ce ?? card.ceCost ?? 0))} · 伤害 ${escapeHtml((card.effect?.damage ?? card.damage ?? 0))} · 防御 ${escapeHtml((card.effect?.block ?? card.block ?? 0))}</span>
        <span>${escapeHtml(card.effectSummary || "")}</span>
        ${(card.effectTools || card.canonicalCard?.effects || []).length ? `<span class="duel-custom-tag">原子效果 ${(card.effectTools || card.canonicalCard?.effects || []).length} 项 · 预算 ${escapeHtml(card.canonicalValidation?.budget ?? "-")}/${escapeHtml(card.canonicalValidation?.budgetLimit ?? "-")}</span>` : ""}
      </div>
      <div class="duel-custom-actions">
        <button class="secondary" type="button" data-custom-hand-edit="${index}">编辑</button>
        <button class="secondary danger" type="button" data-custom-hand-remove="${index}">移除</button>
      </div>
    </article>
  `).join("");
  els.duelCustomHandList.querySelectorAll("[data-custom-hand-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editPendingCustomDuelHandCard(Number(button.dataset.customHandEdit));
    });
  });
  els.duelCustomHandList.querySelectorAll("[data-custom-hand-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.customHandRemove);
      state.pendingCustomDuelHandCards.splice(index, 1);
      renderPendingCustomDuelHandList();
      updateCustomDuelHandStatus("已移除特殊手札。");
    });
  });
}

function editPendingCustomDuelHandCard(index) {
  const card = state.pendingCustomDuelHandCards?.[index];
  if (!card) return;
  state.customDuelHandEditIndex = index;
  if (els.duelCustomHandName) els.duelCustomHandName.value = card.name || card.label || "";
  const canonical = card.canonicalCard || {};
  if (els.duelCustomHandType) els.duelCustomHandType.value = canonical.cardType || card.cardType || card.type || "attack";
  if (els.duelCustomHandRisk) els.duelCustomHandRisk.value = ["low", "medium", "high", "critical"].includes(card.risk) ? card.risk : "medium";
  if (els.duelCustomHandApCost) els.duelCustomHandApCost.value = String(Number(canonical.cost?.ap ?? card.cost?.ap ?? card.apCost ?? 1));
  if (els.duelCustomHandCeCost) els.duelCustomHandCeCost.value = String(Number(card.cost?.ce ?? card.cost?.flatCe ?? card.ceCost ?? 10));
  if (els.duelCustomHandDamage) els.duelCustomHandDamage.value = String(Number(card.effect?.damage ?? card.damage ?? 0));
  if (els.duelCustomHandBlock) els.duelCustomHandBlock.value = String(Number(card.effect?.block ?? card.block ?? 0));
  const canonicalEffects = Array.isArray(card.effectTools) ? card.effectTools : (Array.isArray(canonical.effects) ? canonical.effects : []);
  const stabilityEffect = canonicalEffects.find((effect) => effect.id === "stability-adjustment");
  const domainLoadEffect = canonicalEffects.find((effect) => effect.id === "domain-load-adjustment");
  if (els.duelCustomHandStability) els.duelCustomHandStability.value = String(Math.round(Number(stabilityEffect?.params?.amount ?? card.effects?.stabilityDelta ?? 0) * 100));
  if (els.duelCustomHandDomainLoad) els.duelCustomHandDomainLoad.value = String(Number(domainLoadEffect?.params?.amount ?? card.effect?.domainLoad ?? card.effects?.domainLoadDelta ?? card.domainLoadDelta ?? 0));
  if (els.duelCustomHandSummary) els.duelCustomHandSummary.value = card.effectSummary || card.description || "";
  if (els.duelCustomEffectNaturalText) {
    els.duelCustomEffectNaturalText.value = card.effectSourceText || card.originalEffectDescription || canonical.text?.summary || card.effectSummary || card.description || "";
  }
  if (els.duelCustomHandTags) els.duelCustomHandTags.value = (card.tags || []).filter((tag) => !["自定义", "特殊手札"].includes(tag)).join("、");
  if (els.duelCustomHandScope) els.duelCustomHandScope.value = canonical.damage?.scope || (card.targetMode === "all-enemies" ? "aoe" : "solo");
  if (els.duelCustomHandDamageType) els.duelCustomHandDamageType.value = canonical.damage?.type || (card.damageType === "penetrating" ? "penetrate" : (["common", "real"].includes(card.damageType) ? card.damageType : "common"));
  if (els.duelCustomHandPenetration) els.duelCustomHandPenetration.value = String(Number(canonical.damage?.penetrationRatio ?? card.penetrationRatio ?? 0));
  if (els.duelCustomHandScaleCePool) els.duelCustomHandScaleCePool.value = String(Number(canonical.scaleWith?.cePool ?? card.scaling?.cePool ?? 0));
  if (els.duelCustomHandScaleControl) els.duelCustomHandScaleControl.value = String(Number(canonical.scaleWith?.ceControl ?? card.scaling?.ceControl ?? 0));
  if (els.duelCustomHandScalePhysical) els.duelCustomHandScalePhysical.value = String(Number(canonical.scaleWith?.physicalPower ?? card.scaling?.physicalPower ?? 0));
  if (els.duelCustomHandScaleTechnique) els.duelCustomHandScaleTechnique.value = String(Number(canonical.scaleWith?.techniquePower ?? card.scaling?.techniquePower ?? 0));
  state.pendingCustomDuelEffectTools = canonicalEffects.filter((effect) => !["stability-adjustment", "domain-load-adjustment"].includes(effect.id)).map((effect) => cloneCustomDuelExportValue(effect));
  state.customDuelEffectNormalization = null;
  renderCustomDuelAtomicEffectList();
  if (els.duelCustomHandAddBtn) els.duelCustomHandAddBtn.textContent = "保存特殊手札";
  updateCustomDuelHandStatus(`正在编辑特殊手札：${card.name || card.label || ""}`);
  els.duelCustomHandName?.focus();
}

function editCustomDuelCharacter(characterId) {
  const card = state.customDuelCards.find((item) => item.characterId === characterId);
  if (!card) return;
  state.customDuelEditId = characterId;
  if (els.duelCustomName) els.duelCustomName.value = card.displayName || "";
  if (els.duelCustomGrade) els.duelCustomGrade.value = card.visibleGrade || "grade2";
  if (els.duelCustomStage) els.duelCustomStage.value = getValidDuelStage(card.stage || "custom");
  if (els.duelCustomTechniquePower) els.duelCustomTechniquePower.value = DUEL_RANKS.includes(card.techniquePower) ? card.techniquePower : "B";
  els.duelCustomRankSelects?.forEach((select) => {
    const stat = select.dataset.duelCustomRank;
    const value = card.baseStats?.[stat];
    select.value = DUEL_RANKS.includes(value) ? value : (DUEL_DEFAULT_CUSTOM_STATS[stat] || "B");
  });
  const selectedLibrary = card.selectedLibrary || {};
  setSelectedDuelDefinitionValues(els.duelCustomTechniqueTags, selectedLibrary.techniques || []);
  setSelectedDuelDefinitionValues(els.duelCustomDomainTags, selectedLibrary.domains || []);
  setSelectedDuelDefinitionValues(els.duelCustomAdvancedTags, selectedLibrary.advanced || []);
  setSelectedDuelDefinitionValues(els.duelCustomResourceTags, selectedLibrary.resources || []);
  if (["techniques", "domains", "advanced", "resources"].some((key) => (selectedLibrary[key] || []).length)) {
    setDuelCustomMode("library");
  }
  if (els.duelCustomTechnique) {
    els.duelCustomTechnique.value = splitCustomDuelList(card.techniqueName || "")
      .filter((item) => !(selectedLibrary.techniques || []).includes(item))
      .join("、");
  }
  if (els.duelCustomDomain) {
    els.duelCustomDomain.value = splitCustomDuelList(card.domainProfile || "")
      .filter((item) => !(selectedLibrary.domains || []).includes(item))
      .join("、");
  }
  const selectedMechanisms = card.selectedMechanisms || [];
  const selectedToolTags = card.selectedToolTags || [];
  if (els.duelCustomTools) els.duelCustomTools.value = (card.loadout || []).filter((item) => !selectedToolTags.includes(item)).join("、");
  if (els.duelCustomTraits) {
    const technique = card.techniqueName || "";
    els.duelCustomTraits.value = (card.innateTraits || [])
      .filter((item) => item && item !== technique && !selectedMechanisms.includes(item) && !(selectedLibrary.advanced || []).includes(item))
      .join("、");
  }
  setSelectedDuelDefinitionValues(els.duelCustomMechanisms, selectedMechanisms);
  setSelectedDuelDefinitionValues(els.duelCustomToolTags, selectedToolTags);
  if (els.duelCustomResource) {
    els.duelCustomResource.value = splitCustomDuelList(card.externalResource || "")
      .filter((item) => !(selectedLibrary.resources || []).includes(item))
      .join("、");
  }
  if (els.duelCustomNotes) els.duelCustomNotes.value = card.notes || "";
  if (els.duelCustomCombatScore) els.duelCustomCombatScore.value = card.debugManualCombatScore ?? "";
  if (els.duelCustomCombatUnit) els.duelCustomCombatUnit.value = card.debugManualCombatUnit ?? "";
  state.pendingCustomDuelHandCards = (card.customHandCards || []).map((item) => ({ ...item }));
  state.pendingCustomDuelSpecialHandTags = normalizeCustomDuelSpecialHandTags(
    card.specialHandTags || [],
    card["特殊手札"] || []
  ).filter((tag) => tag !== buildCustomDuelSpecialHandTag(card.characterId));
  state.pendingCustomDuelDomainScript = card.domainScript ? { ...card.domainScript } : null;
  state.pendingCustomDuelSpecialConstitutionStatsApplied = card.specialConstitutionStatsApplied === true ||
    /特殊体质面板已结算|special_constitution_stats_applied/i.test(String(card.notes || ""));
  renderPendingCustomDuelHandList();
  syncCustomDuelEditMode();
  els.duelCustomName?.focus();
}

function syncCustomDuelEditMode() {
  if (!els.duelCustomAddBtn) return;
  els.duelCustomAddBtn.textContent = state.customDuelEditId ? "保存角色" : "加入角色池";
}

function renderDuelCustomList() {
  if (els.duelCustomCount) {
    els.duelCustomCount.textContent = `${state.customDuelCards.length} 个`;
  }
  syncCustomDuelEditMode();
  if (!els.duelCustomList) return;
  if (!state.customDuelCards.length) {
    els.duelCustomList.innerHTML = `<p class="muted">暂无自定义角色。</p>`;
    return;
  }
  els.duelCustomList.innerHTML = state.customDuelCards.map((card) => `
    <article class="duel-custom-item">
      <div>
        <strong>${escapeHtml(card.displayName)}</strong>
        <span>${escapeHtml(gradeLabel(card.visibleGrade))} · 术式 ${escapeHtml(card.techniquePower || "-")} · ${escapeHtml(formatDuelList(card.loadout))}</span>
        <span>特殊手札 ${escapeHtml((card.customHandCards || []).length)} 张 · 标签 ${escapeHtml(formatDuelList(card.specialHandTags || []))}</span>
      </div>
      <div class="duel-custom-actions">
        <button class="secondary" type="button" data-duel-custom-use="left" data-duel-custom-id="${escapeHtml(card.characterId)}">我方</button>
        <button class="secondary" type="button" data-duel-custom-use="right" data-duel-custom-id="${escapeHtml(card.characterId)}">对方</button>
        <button class="secondary" type="button" data-duel-custom-export="${escapeHtml(card.characterId)}">存入登陆卡</button>
        <button class="secondary" type="button" data-duel-custom-edit="${escapeHtml(card.characterId)}">编辑</button>
        <button class="secondary danger" type="button" data-duel-custom-delete="${escapeHtml(card.characterId)}">删除</button>
      </div>
    </article>
  `).join("");
}

function handleCustomDuelListClick(event) {
  const exportButton = event.target.closest("[data-duel-custom-export]");
  if (exportButton) {
    exportCustomDuelCharacterCard(exportButton.dataset.duelCustomExport);
    return;
  }
  const editButton = event.target.closest("[data-duel-custom-edit]");
  if (editButton) {
    editCustomDuelCharacter(editButton.dataset.duelCustomEdit);
    return;
  }
  const deleteButton = event.target.closest("[data-duel-custom-delete]");
  if (deleteButton) {
    removeCustomDuelCharacter(deleteButton.dataset.duelCustomDelete);
    return;
  }
  const useButton = event.target.closest("[data-duel-custom-use]");
  if (useButton) {
    useCustomDuelCharacter(useButton.dataset.duelCustomId, useButton.dataset.duelCustomUse);
  }
}

function useCustomDuelCharacter(characterId, side) {
  if (!state.customDuelCards.some((card) => card.characterId === characterId)) return;
  state.duelBattle = null;
  renderDuelMode();
  const target = side === "right" ? els.duelRightSelect : els.duelLeftSelect;
  if (target) target.value = characterId;
  renderDuelMode();
}

function removeCustomDuelCharacter(characterId) {
  const before = state.customDuelCards.length;
  state.customDuelCards = state.customDuelCards.filter((card) => card.characterId !== characterId);
  if (state.customDuelCards.length === before) return;
  if (state.customDuelEditId === characterId) {
    state.customDuelEditId = "";
    state.pendingCustomDuelHandCards = [];
    state.pendingCustomDuelSpecialHandTags = [];
    state.pendingCustomDuelDomainScript = null;
    state.pendingCustomDuelSpecialConstitutionStatsApplied = false;
    renderPendingCustomDuelHandList();
  }
  state.duelBattle = null;
  renderDuelCustomList();
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
}

function clearCustomDuelCharacters() {
  if (!state.customDuelCards.length) return;
  state.customDuelCards = [];
  state.customDuelEditId = "";
  state.pendingCustomDuelHandCards = [];
  state.pendingCustomDuelSpecialHandTags = [];
  state.pendingCustomDuelDomainScript = null;
  state.pendingCustomDuelSpecialConstitutionStatsApplied = false;
  state.duelBattle = null;
  renderDuelCustomList();
  renderPendingCustomDuelHandList();
  renderDuelMode();
  notifyDuelCharacterPoolChanged();
}

function addDuelSpecialTerm() {
  const term = readDuelSpecialTermForm();
  if (!term) return;
  state.duelSpecialTermSeq += 1;
  state.duelSpecialTerms.push({
    ...term,
    id: `duel_special_${Date.now().toString(36)}_${state.duelSpecialTermSeq}`
  });
  state.duelBattle = null;
  if (els.duelSpecialTermName) els.duelSpecialTermName.value = "";
  if (els.duelSpecialTermRounds) els.duelSpecialTermRounds.value = "";
  if (els.duelSpecialTermDefinition) els.duelSpecialTermDefinition.value = "";
  renderDuelSpecialTermList();
  renderDuelMode();
}

function readDuelSpecialTermForm() {
  const name = normalizeCustomDuelText(els.duelSpecialTermName?.value || "").slice(0, 30);
  const definition = normalizeCustomDuelLongText(els.duelSpecialTermDefinition?.value || "").slice(0, 360);
  const roundValue = parseOptionalDuelNumber(els.duelSpecialTermRounds?.value, 1, DUEL_SPECIAL_TERM_MAX_ROUNDS);
  const rounds = roundValue == null ? null : Math.round(roundValue);
  const tags = inferDuelSpecialTermTags(name, definition);
  if (!name) {
    void globalThis.JJKDomModal?.alert("请先填写特殊词条名。");
    els.duelSpecialTermName?.focus();
    return null;
  }
  if (!definition) {
    void globalThis.JJKDomModal?.alert("请先写清特殊词条定义。");
    els.duelSpecialTermDefinition?.focus();
    return null;
  }
  if (tags.includes("survivalRounds") && !rounds) {
    void globalThis.JJKDomModal?.alert("耐活/不死类词条需要填写保护回合数。");
    els.duelSpecialTermRounds?.focus();
    return null;
  }
  return {
    name,
    rounds,
    definition,
    category: inferDuelGeneratedCategoryFromTags(tags),
    calculationTemplate: normalizeDuelCalculationTemplate("", inferDuelGeneratedCategoryFromTags(tags)),
    params: rounds ? { rounds } : {},
    source: "manual",
    tags
  };
}

function inferDuelGeneratedCategoryFromTags(tags = []) {
  const set = new Set(tags || []);
  if (set.has("survivalRounds")) return "survival";
  if (set.has("curseAgeGrowth")) return "curseAgeGrowth";
  if (set.has("growthScaling")) return "growth";
  if (set.has("domainSpecialty")) return "domainSpecialty";
  if (set.has("techniqueDisruption")) return "techniqueDisruption";
  if (set.has("bodyBoost")) return "bodyBoost";
  if (set.has("resourceStock")) return "resourceStock";
  if (set.has("burstWindow")) return "burstWindow";
  if (set.has("recovery")) return "recovery";
  if (set.has("specialWeakness")) return "specialWeakness";
  return "growth";
}

function inferDuelSpecialTermTags(name, definition) {
  const text = `${name || ""} ${definition || ""}`;
  const tags = ["debugSpecialTerm"];
  if (/survival|耐活|不会死亡|不会死|不死|不会被杀|不会被击杀|不结算死亡|不结算击杀|不会倒下|锁血/.test(text)) {
    tags.push("survivalRounds");
  }
  if (/growth|curseAgeGrowth|成长|越活越强|长期存活|千年|百年|年限|沉淀|积累/i.test(text)) tags.push("growthScaling");
  if (/curseAgeGrowth|咒灵|咒物|受肉|半人半咒/.test(text) && tags.includes("growthScaling")) tags.push("curseAgeGrowth");
  if (/domain|领域|必中|结界|反领域/.test(text)) tags.push("domainSpecialty");
  if (/disruption|封锁|干扰|扰乱|压制|术式无效|破坏防御|关闭术式|限制行动/.test(text)) tags.push("techniqueDisruption");
  if (/bodyBoost|体质|肉体|力量|速度|耐久|暴君|强化/.test(text)) tags.push("bodyBoost");
  if (/resourceStock|资源|库存|军团|尸体|僵尸|式神|咒灵库存|召唤|傀儡/.test(text)) tags.push("resourceStock");
  if (/burst|爆发|一次性|超频|过载|全力|短时间/.test(text)) tags.push("burstWindow");
  if (/recovery|恢复|再生|反转术式|治疗|续航/.test(text)) tags.push("recovery");
  if (/weakness|弱点|代价|限制|副作用|容易被/.test(text)) tags.push("specialWeakness");
  return Array.from(new Set(tags));
}

function handleDuelSpecialTermListClick(event) {
  const deleteButton = event.target.closest("[data-duel-special-delete]");
  if (deleteButton) removeDuelSpecialTerm(deleteButton.dataset.duelSpecialDelete);
}

function removeDuelSpecialTerm(termId) {
  const before = state.duelSpecialTerms.length;
  state.duelSpecialTerms = state.duelSpecialTerms.filter((term) => term.id !== termId);
  if (state.duelSpecialTerms.length === before) return;
  state.duelBattle = null;
  renderDuelSpecialTermList();
  renderDuelMode();
}

function clearDuelSpecialTerms() {
  if (!state.duelSpecialTerms.length) return;
  state.duelSpecialTerms = [];
  state.duelBattle = null;
  renderDuelSpecialTermList();
  renderDuelMode();
}

function renderDuelSpecialTermList() {
  if (els.duelSpecialTermCount) {
    els.duelSpecialTermCount.textContent = `${state.duelSpecialTerms.length} 条；在角色特质/说明中写入词条名即可触发。`;
  }
  if (!els.duelSpecialTermList) return;
  if (!state.duelSpecialTerms.length) {
    els.duelSpecialTermList.innerHTML = `<p class="muted">暂无特殊词条。</p>`;
    return;
  }
  els.duelSpecialTermList.innerHTML = state.duelSpecialTerms.map((term) => `
    <article class="duel-custom-item">
      <div>
        <strong>${escapeHtml(formatDuelSpecialTermLabel(term))}</strong>
        <span>${escapeHtml(term.definition)} · ${escapeHtml(formatDuelList(term.tags))}</span>
      </div>
      <div class="duel-custom-actions">
        <button class="secondary danger" type="button" data-duel-special-delete="${escapeHtml(term.id)}">删除</button>
      </div>
    </article>
  `).join("");
}

function formatDuelSpecialTermLabel(term) {
  return term?.rounds ? `${term.name}（${term.rounds}回合）` : term?.name || "未命名词条";
}

function getDuelSpecialTermsForAi() {
  return state.duelSpecialTerms.map((term) => ({
    name: term.name,
    category: term.category || "",
    rounds: term.rounds || null,
    params: term.params || {},
    calculationTemplate: term.calculationTemplate || "",
    definition: term.definition,
    tags: term.tags || [],
    source: term.source || "manual"
  }));
}

function applyDuelSpecialTermsToProfile(profile) {
  if (!state.duelSpecialTerms.length) return profile;
  const text = getDuelProfileTermText(profile);
  const matched = state.duelSpecialTerms.filter((term) => term.name && text.includes(term.name));
  if (!matched.length) return profile;
  const survivalRounds = matched
    .filter((term) => (term.tags || []).includes("survivalRounds"))
    .reduce((max, term) => Math.max(max, Number(term.rounds || 0)), 0);
  const impact = summarizeDuelSpecialTermImpact(matched);
  const nextFlags = new Set([...(profile.flags || []), "debugSpecialTerm"]);
  if (survivalRounds > 0) nextFlags.add("survivalRounds");
  for (const term of matched) {
    for (const tag of term.tags || []) nextFlags.add(tag);
  }
  const nextScore = clamp(Number(profile.combatScore || 0) + impact.scoreBonus, 0, 12);
  const nextDisruption = clamp(Number(profile.disruptionScore || 0) + impact.disruptionBonus, 0, 12);
  return {
    ...profile,
    flags: Array.from(nextFlags),
    combatScore: nextScore,
    combatPowerUnit: buildCombatPowerUnit(nextScore),
    pool: classifyInstantCombatPool(nextScore).label,
    disruptionScore: nextDisruption,
    disruptionUnit: buildDuelDisruptionUnit(nextDisruption),
    specialTerms: matched.map((term) => ({
      name: term.name,
      category: term.category || "",
      rounds: term.rounds || null,
      params: term.params || {},
      calculationTemplate: term.calculationTemplate || "",
      definition: term.definition,
      tags: term.tags || [],
      source: term.source || "manual"
    })),
    specialTermImpact: impact,
    survivalRounds: Math.max(Number(profile.survivalRounds || 0), survivalRounds)
  };
}

function summarizeDuelSpecialTermImpact(terms = []) {
  let scoreBonus = 0;
  let disruptionBonus = 0;
  for (const term of terms) {
    const tags = new Set(term.tags || []);
    if (tags.has("growthScaling")) scoreBonus += 0.2;
    if (tags.has("curseAgeGrowth")) scoreBonus += 0.28;
    if (tags.has("domainSpecialty")) {
      scoreBonus += 0.14;
      disruptionBonus += 0.28;
    }
    if (tags.has("techniqueDisruption")) {
      scoreBonus += 0.16;
      disruptionBonus += 0.8;
    }
    if (tags.has("bodyBoost")) scoreBonus += 0.18;
    if (tags.has("resourceStock")) {
      scoreBonus += 0.18;
      disruptionBonus += 0.42;
    }
    if (tags.has("burstWindow")) {
      scoreBonus += 0.16;
      disruptionBonus += 0.36;
    }
    if (tags.has("recovery")) scoreBonus += 0.12;
    if (tags.has("specialWeakness")) {
      scoreBonus -= 0.18;
      disruptionBonus -= 0.12;
    }
  }
  return {
    scoreBonus: Number(clamp(scoreBonus, -0.8, 1.25).toFixed(4)),
    disruptionBonus: Number(clamp(disruptionBonus, -0.8, 2.4).toFixed(4))
  };
}

function getDuelProfileTermText(profile) {
  return [
    profile?.name,
    profile?.techniqueText,
    profile?.domainProfile,
    profile?.externalResource,
    profile?.notes,
    ...(profile?.innateTraits || []),
    ...(profile?.advancedTechniques || []),
    ...(profile?.loadout || [])
  ].filter(Boolean).join(" ");
}

function formatDuelProfileSpecialTerms(profile) {
  return formatDuelList((profile?.specialTerms || []).map(formatDuelSpecialTermLabel));
}

function swapDuelCharacters() {
  if (!els.duelLeftSelect || !els.duelRightSelect) return;
  const left = els.duelLeftSelect.value;
  els.duelLeftSelect.value = els.duelRightSelect.value;
  els.duelRightSelect.value = left;
  state.duelBattle = null;
  renderDuelMode();
}

function applyDuelSideDebugOverride(profile, side) {
  if (!state.debugMode) return profile;
  const scoreInput = side === "right" ? els.duelDebugRightScore : els.duelDebugLeftScore;
  const unitInput = side === "right" ? els.duelDebugRightUnit : els.duelDebugLeftUnit;
  return applyDuelManualCombatOverride(profile, {
    combatScore: parseOptionalDuelNumber(scoreInput?.value, 0, 12),
    combatUnit: parseOptionalDuelNumber(unitInput?.value, 1, 99999999),
    source: side === "right" ? "对方调试覆盖" : "我方调试覆盖"
  });
}

function applyDuelManualCombatOverride(profile, override = {}) {
  const score = override.combatScore;
  const unit = override.combatUnit;
  if (score == null && unit == null) return profile;
  const next = {
    ...profile,
    flags: Array.from(new Set([...(profile.flags || []), "debugManualPower"])),
    manualCombatSource: override.source || "调试直填"
  };
  if (score != null) {
    next.combatScore = clamp(Number(score), 0, 12);
    next.combatPowerUnit = buildCombatPowerUnit(next.combatScore);
    next.pool = classifyInstantCombatPool(next.combatScore).label;
  }
  if (unit != null) {
    const value = Math.max(1, Math.round(Number(unit) || 1));
    next.combatPowerUnit = {
      ...next.combatPowerUnit,
      value,
      label: formatCombatPowerUnit(value),
      band: getCombatPowerUnitBand(value),
      formula: "debug manual combat unit"
    };
  }
  return next;
}

function renderDuelDebugStatus(left, right) {
  if (!els.duelDebugStatus) return;
  if (!state.debugMode) {
    els.duelDebugStatus.textContent = "";
    return;
  }
  const pieces = [];
  if (left.manualCombatSource) pieces.push(`我方战力：${left.manualCombatSource}`);
  if (right.manualCombatSource) pieces.push(`对方战力：${right.manualCombatSource}`);
  els.duelDebugStatus.textContent = pieces.length ? pieces.join("；") : "空白则使用角色公式；战斗结算由术式手札与体势系统推进。";
}

function clearDuelDebugOverrides() {
  [
    els.duelDebugLeftScore,
    els.duelDebugLeftUnit,
    els.duelDebugRightScore,
    els.duelDebugRightUnit
  ].forEach((input) => {
    if (input) input.value = "";
  });
  state.duelBattle = null;
  renderDuelMode();
}

function getBattlePageModule() {
  return globalThis.JJKBattlePage || null;
}

function getDuelBattleMode() {
  return state.duelModeState.mode || getBattlePageModule()?.getBattleMode?.() || "none";
}

function setDuelBattleMode(mode, patch = {}) {
  const normalizedMode = ["solo", "online"].includes(mode) ? mode : "none";
  state.duelModeState = {
    ...state.duelModeState,
    mode: normalizedMode,
    ...patch
  };
  getBattlePageModule()?.setBattleMode?.(normalizedMode, {
    activeBattleId: state.duelModeState.activeBattleId,
    activeRoomId: state.duelModeState.activeRoomId,
    playerSide: state.duelModeState.playerSide,
    localLocked: state.duelModeState.localLocked,
    activePage: patch.activePage
  });
  syncDuelModeIsolation();
  syncOnlineTurnDeadlineRenderTimer();
  return state.duelModeState;
}

function normalizeDuelCpuDifficulty(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["easy", "normal", "hard"].includes(key) ? key : "normal";
}

function getDuelCpuDifficultyLabel(value) {
  return {
    easy: "简单：陪练",
    normal: "普通：稳定",
    hard: "困难：强规划"
  }[normalizeDuelCpuDifficulty(value)] || "普通：稳定";
}

function getSelectedDuelCpuDifficulty() {
  return normalizeDuelCpuDifficulty(els.duelCpuDifficultySelect?.value || state.duelCpuDifficulty || "normal");
}

function normalizeDuelCpuComputeMode(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["auto", "cloud", "local"].includes(key) ? key : "auto";
}

function getSelectedDuelCpuComputeMode() {
  return normalizeDuelCpuComputeMode(els.duelCpuComputeModeSelect?.value || state.duelCpuComputeMode || "auto");
}

function getDuelCpuComputeModeLabel(value) {
  return {
    auto: "自动：优先云端，失败回本地",
    cloud: "云端：服务器规划",
    local: "本地：设备内规划"
  }[normalizeDuelCpuComputeMode(value)] || "自动：优先云端，失败回本地";
}

function clonePlain(value) {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function isDuelLiteModeActive() {
  return Boolean(state.duelVisualSettings?.liteMode);
}

function getDuelVisualSettingsSnapshot() {
  const settings = state.duelVisualSettings || {};
  const liteMode = Boolean(settings.liteMode);
  const cardSkin = liteMode
    ? "classic"
    : (["classic", "v224", "custom", "champion-kashimo", "ukiyo-memorial-1", "ukiyo-memorial-2"].includes(settings.cardSkin) ? settings.cardSkin : "v224");
  return {
    theme: liteMode ? "original" : (settings.theme === "dark" ? "dark" : "original"),
    cardSkin,
    compactCards: Boolean(settings.compactCards || liteMode),
    liteMode,
    customSkin: !liteMode && cardSkin === "custom" ? clonePlain(settings.customSkin || null) : null
  };
}

function createDuelPassTurnAction(side = "left", battle = state.duelBattle) {
  const turn = Number(battle?.round || 0) + 1;
  const action = {
    id: "duel_pass_turn",
    label: "本回合待机",
    name: "本回合待机",
    type: "pass",
    cardType: "pass",
    risk: "low",
    costCe: 0,
    ceCost: 0,
    apCost: 0,
    cost: { ce: 0 },
    effect: {},
    effects: {},
    description: "无法或不选择手札时，保守待机并推进回合。"
  };
  return {
    id: action.id,
    actionId: action.id,
    label: action.label,
    action,
    apCost: 0,
    ceCost: 0,
    source: "pass_turn",
    status: "CANDIDATE",
    selectedRound: turn,
    side
  };
}

function getSelectedOnlineActionSnapshots(side = state.duelModeState.playerSide || "left") {
  const battle = state.duelBattle;
  if (!battle) return [];
  const actorSide = side === "right" ? "right" : "left";
  const { actor, opponent } = getDuelSideResources(battle, actorSide);
  const pendingDiscardCount = Math.max(0, Number(battle.handState?.[actorSide]?.pendingDiscardCount || 0));
  if (pendingDiscardCount > 0) {
    if (battle.mode === "online") {
      battle.actionUiMessage = `请先弃置 ${formatNumber(pendingDiscardCount)} 张溢出手牌，再锁定本回合行动。`;
      return [];
    }
    const discarded = autoDiscardDuelHandOverflow(actor, opponent, battle, {
      side: actorSide,
      reason: "onlineOverflowAutoDiscard"
    });
    if (discarded.length) {
      clearDuelSelectedHandActions(battle, actorSide, { refund: false });
      battle.pendingAction = null;
      battle.actionUiMessage = `已自动弃置 ${formatNumber(discarded.length)} 张溢出手牌，并按待机提交联机行动。`;
      updateDuelActionAvailability(battle);
      updateDuelResourceReplayKey(battle);
      requestDuelInteractionRender();
    }
    return [];
  }
  const visualSettings = getDuelVisualSettingsSnapshot();
  const initiativeInvestment = getDuelInitiativeInvestment(battle, actorSide);
  const tacticId = String(battle.selectedTactic || "balanced");
  return getDuelSelectedHandActions(battle, actorSide).map((entry, index) => {
    const action = entry?.action || entry;
    const view = getDuelHandCardViewModel(entry, actor, opponent, battle) || {};
    const skinCategory = getDuelCardSkinCategory(view, entry);
    const actionSnapshot = {
      ...(clonePlain(action) || {}),
      skinCategory,
      cardSkinCategory: skinCategory,
      cardSkin: visualSettings.cardSkin,
      visualCardSkin: visualSettings.cardSkin,
      visualSettings,
      domainHand: Boolean(view.domainHand || entry?.domainHand || action?.domainHand),
      domainSpecific: Boolean(view.domainSpecific || entry?.domainSpecific || action?.domainSpecific),
      specialHandCard: Boolean(view.specialHandCard || entry?.specialHandCard || action?.specialHandCard),
      techniqueFeatureHand: Boolean(view.techniqueFeatureHand || entry?.techniqueFeatureHand || action?.techniqueFeatureHand),
      tags: Array.isArray(action?.tags) && action.tags.length ? clonePlain(action.tags) : clonePlain(view.tags || []),
      uiTags: clonePlain(view.uiTags || action?.uiTags || []),
      specialHandTags: clonePlain(action?.specialHandTags || entry?.specialHandTags || []),
      initiativeInvestment,
      tacticId
    };
    return {
      actionId: entry?.actionId || entry?.id || action?.id || `action_${index + 1}`,
      cardInstanceId: String(entry?.cardInstanceId || action?.cardInstanceId || ""),
      displayName: entry?.label || action?.label || action?.name || entry?.actionId || `手札 ${index + 1}`,
      cardType: entry?.cardType || action?.cardType || action?.type || "",
      apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
      ceCost: Number(entry?.ceCost ?? action?.ceCost ?? action?.costCe ?? 0),
      selectedRound: Number(entry?.selectedRound || battle.round + 1),
      skinCategory,
      cardSkinCategory: skinCategory,
      cardSkin: visualSettings.cardSkin,
      visualCardSkin: visualSettings.cardSkin,
      visualSettings,
      tags: clonePlain(view.tags || entry?.tags || action?.tags || []),
      uiTags: clonePlain(view.uiTags || entry?.uiTags || action?.uiTags || []),
      specialHandTags: clonePlain(entry?.specialHandTags || action?.specialHandTags || []),
      domainHand: Boolean(view.domainHand || entry?.domainHand || action?.domainHand),
      domainSpecific: Boolean(view.domainSpecific || entry?.domainSpecific || action?.domainSpecific),
      specialHandCard: Boolean(view.specialHandCard || entry?.specialHandCard || action?.specialHandCard),
      techniqueFeatureHand: Boolean(view.techniqueFeatureHand || entry?.techniqueFeatureHand || action?.techniqueFeatureHand),
      initiativeInvestment,
      tacticId,
      customDuel: Boolean(entry?.customDuel || action?.customDuel),
      customCard: Boolean(entry?.customCard || action?.customCard),
      customBattleCard: Boolean(entry?.customBattleCard || action?.customBattleCard),
      action: actionSnapshot
    };
  });
}

function normalizeOnlineResolvedActions(actions = [], side = "left", battle = state.duelBattle) {
  return (Array.isArray(actions) ? actions : []).map((entry, index) => {
    const action = entry?.action || entry?.actionSnapshot || entry;
    const actionId = entry?.actionId || entry?.id || action?.id || `online_${side}_${index + 1}`;
    return {
      ...entry,
      id: actionId,
      actionId,
      label: entry?.label || entry?.displayName || action?.label || action?.name || actionId,
      action: {
        ...(action || {}),
        id: action?.id || actionId,
        label: action?.label || entry?.displayName || entry?.label || actionId
      },
      apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
      ceCost: Number(entry?.ceCost ?? action?.ceCost ?? action?.costCe ?? 0),
      selectedRound: Number(entry?.selectedRound || battle?.round + 1 || 1),
      initiativeInvestment: Number(entry?.initiativeInvestment ?? action?.initiativeInvestment ?? 0),
      side
    };
  });
}

async function resolveRemoteActionDefinition(options = {}) {
  const resolver = globalThis.JJKOnlineDuelSync?.resolveRemoteActionDefinition;
  if (typeof resolver !== "function") {
    const error = new Error("远端动作还原器不可用。");
    error.code = "ACTION_SNAPSHOT_UNRESTORABLE";
    throw error;
  }
  return resolver(options);
}

function getDuelControlledSide(battle = state.duelBattle) {
  if (battle?.mode === "online" || isOnlineDuelModeActive()) {
    if (battle?.onlinePlayerSide === "spectator" || state.duelModeState.playerSide === "spectator") return "left";
    return (battle?.onlinePlayerSide || state.duelModeState.playerSide) === "right" ? "right" : "left";
  }
  return "left";
}

function getDuelViewerSide(battle = state.duelBattle) {
  if (battle?.onlinePlayerSide) return battle.onlinePlayerSide;
  if (state.duelModeState.playerSide) return state.duelModeState.playerSide;
  return "";
}

function getDuelPerspectiveSideLabel(side, battle = state.duelBattle) {
  const normalizedSide = side === "right" ? "right" : side === "left" ? "left" : "neutral";
  if (normalizedSide === "neutral") return "战场";
  if (battle?.mode === "online" || isOnlineDuelModeActive()) {
    const viewerSide = getDuelViewerSide(battle);
    if (viewerSide === "spectator") return normalizedSide === "left" ? "左方" : "右方";
    if (viewerSide === "right") return normalizedSide === "right" ? "我方" : "对方";
    if (viewerSide === "left") return normalizedSide === "left" ? "我方" : "对方";
  }
  return normalizedSide === "left" ? "我方" : "对方";
}

globalThis.JJKDuelPerspectiveSideLabel = getDuelPerspectiveSideLabel;

function syncOnlineSpectatorActions(room = {}) {
  const battle = state.duelBattle;
  if (!battle || battle.mode !== "online" || battle.onlineRoomId !== room?.roomId) return null;
  battle.onlineSpectator = true;
  battle.spectatorActions ||= { left: [], right: [] };
  if (room.phase === "battle_starting") {
    const complete = Boolean((room.battleSeed || room.battleSeedHash) && room.players?.left?.characterId && room.players?.right?.characterId);
    battle.spectatorActionSource = "waiting";
    battle.spectatorActionRound = Number(room.round || 0);
    battle.actionUiMessage = complete ? "观战模式：等待开赛同步。" : "SPECTATOR_BATTLE_STATE_INCOMPLETE：等待双方角色与战斗种子。";
    if (!complete) battle.spectatorActions = { left: [], right: [] };
    requestDuelInteractionRender("#duelBattle");
    return battle.spectatorActions;
  }
  const dounaOnlineBattle = Boolean(battle.dounaGauntlet?.online || room.mode === "douna" || room.teamMode === "douna_gauntlet");
  if (dounaOnlineBattle) {
    const dounaActionsSource = room.turnState?.dounaActions || room.battleState?.dounaActions || {};
    const challengerActions = Object.entries(dounaActionsSource)
      .flatMap(([slot, actions]) => normalizeOnlineResolvedActions(actions, slot, battle));
    const bossActions = [
      ...normalizeOnlineResolvedActions(room.turnState?.bossActions || [], "right", battle),
      ...normalizeOnlineResolvedActions(room.battleState?.bossActions || [], "right", battle),
      ...normalizeOnlineResolvedActions(room.battleState?.sukunaActions || [], "right", battle)
    ];
    if (challengerActions.length || bossActions.length) {
      battle.spectatorActions = {
        left: challengerActions,
        right: bossActions
      };
      battle.spectatorActionsTurnId = room.turnState?.turnId || `turn_${room.round || battle.round + 1}`;
    }
    battle.actionUiMessage = "观战模式：只读取斗傩挑战者与宿傩的实际手札。";
    requestDuelInteractionRender("#duelBattle");
    return battle.spectatorActions;
  }
  const synchronizedReveal = room.syncState?.lastReveal;
  if (isClientSynchronizedOnlineRoom(room) && synchronizedReveal?.commits) {
    battle.spectatorActions = {
      left: normalizeOnlineResolvedActions(synchronizedReveal.commits.left?.actions || [], "left", battle),
      right: normalizeOnlineResolvedActions(synchronizedReveal.commits.right?.actions || [], "right", battle)
    };
    battle.spectatorActionsTurnId = `sync_reveal_${synchronizedReveal.round}`;
    battle.spectatorActionSource = "lastReveal.commits";
    battle.spectatorActionRound = Number(synchronizedReveal.round || room.round || 0);
    battle.spectatorStateHash = "";
    battle.actionUiMessage = "观战模式：读取服务器广播的双方回合操作。";
    requestDuelInteractionRender("#duelBattle");
    return battle.spectatorActions;
  }
  const frame = room.battleState?.spectatorFrame || room.reviewState?.lastResolvedTurn?.spectatorFrame || null;
  const frameActions = frame?.published && frame.actions?.left && frame.actions?.right ? frame.actions : null;
  const bothLiveLocked = Boolean(room.turnState?.locks?.left && room.turnState?.locks?.right);
  const liveActions = bothLiveLocked ? {
    left: Array.isArray(room.turnState?.actions?.left) ? room.turnState.actions.left : [],
    right: Array.isArray(room.turnState?.actions?.right) ? room.turnState.actions.right : []
  } : null;
  const resolvedTurn = room.reviewState?.lastResolvedTurn || null;
  const resolvedActionsSource = resolvedTurn?.actions || {};
  const resolvedActions = {
    left: Array.isArray(resolvedActionsSource.left) ? resolvedActionsSource.left : [],
    right: Array.isArray(resolvedActionsSource.right) ? resolvedActionsSource.right : []
  };
  const nextActions = frameActions || liveActions || (resolvedTurn?.turn ? resolvedActions : null);
  if (nextActions) {
    battle.spectatorActions = {
      left: normalizeOnlineResolvedActions(nextActions.left || [], "left", battle),
      right: normalizeOnlineResolvedActions(nextActions.right || [], "right", battle)
    };
    battle.spectatorActionsTurnId = frame?.frameId || (liveActions
      ? (room.turnState?.turnId || `turn_${room.round || battle.round + 1}`)
      : `resolved_turn_${resolvedTurn?.turn || room.round || battle.round || ""}`);
    battle.spectatorStateHash = String(frame?.stateHash || resolvedTurn?.stateHash || "");
    battle.spectatorActionSource = frameActions ? "spectatorFrame" : liveActions ? "turnState.actions" : "lastResolvedTurn.actions";
    battle.spectatorActionRound = Number(frame?.round || resolvedTurn?.turn || room.round || 0);
  } else {
    battle.spectatorActions = { left: [], right: [] };
    battle.spectatorActionsTurnId = "";
    battle.spectatorActionSource = "none";
    battle.spectatorActionRound = Number(room.round || 0);
  }
  battle.actionUiMessage = "观战模式：只读取双方锁定的实际手札。";
  requestDuelInteractionRender("#duelBattle");
  return battle.spectatorActions;
}

function getDuelSideResources(battle = state.duelBattle, side = getDuelControlledSide(battle)) {
  const actorSide = side === "right" ? "right" : "left";
  return {
    actorSide,
    actor: actorSide === "right" ? battle?.resourceState?.p2 : battle?.resourceState?.p1,
    opponent: actorSide === "right" ? battle?.resourceState?.p1 : battle?.resourceState?.p2
  };
}

function snapshotOnlineResourceEntry(resource) {
  const entry = clonePlain(resource || {});
  if (!entry || typeof entry !== "object") return null;
  if (Array.isArray(entry.statusEffects)) entry.statusEffects = entry.statusEffects.slice(-40);
  if (Array.isArray(entry.summonedUnits)) entry.summonedUnits = entry.summonedUnits.slice(-30);
  delete entry.randomLog;
  return entry;
}

function syncActiveDuelBattlePage(battle = state.duelBattle) {
  if (!battle?.battleId || battle.focusModeDismissed) return false;
  const mode = battle.mode === "online" ? "online" : "solo";
  const activePage = mode === "online" ? "online" : (battle.dounaGauntlet ? "douna" : "solo");
  const current = getBattlePageModule()?.getBattlePageState?.() || {};
  if (
    current.mode === mode &&
    current.activePage === activePage &&
    current.activeBattleId === battle.battleId
  ) return false;
  setDuelBattleMode(mode === "oc-challenge" ? "solo" : mode, {
    activeBattleId: battle.battleId,
    activeRoomId: battle.onlineRoomId || state.duelModeState.activeRoomId || "",
    playerSide: battle.onlinePlayerSide || state.duelModeState.playerSide || null,
    localLocked: state.duelModeState.localLocked,
    activePage
  });
  return true;
}

function snapshotOnlineDounaPrivateRuntimeState(battle) {
  if (!battle?.dounaGauntlet?.online) return null;
  const gauntlet = clonePlain(battle.dounaGauntlet || {});
  delete gauntlet.roster;
  const trimHandSide = (sideState = {}) => ({
    ...clonePlain(sideState || {}),
    cards: clonePlain((sideState.cards || []).slice(0, 30)),
    discardPile: clonePlain((sideState.discardPile || []).slice(-80)),
    lastDrawn: clonePlain((sideState.lastDrawn || []).slice(0, 30)),
    lastInjected: clonePlain((sideState.lastInjected || []).slice(0, 30)),
    lastDiscarded: clonePlain((sideState.lastDiscarded || []).slice(0, 30))
  });
  return {
    handState: {
      left: trimHandSide(battle.handState?.left || {}),
      right: trimHandSide(battle.handState?.right || {})
    },
    actionChoices: clonePlain((battle.actionChoices || []).slice(0, 30)),
    handCandidates: clonePlain((battle.handCandidates || []).slice(0, 30)),
    actionRound: Math.max(1, Number(battle.actionRound || battle.round + 1 || 1)),
    actionPoints: clonePlain(battle.actionPoints || {}),
    selectedHandActions: clonePlain(battle.selectedHandActions || { left: [], right: [] }),
    onlineRandomCounters: Object.fromEntries(Object.entries(battle.onlineRandomCounters || {}).slice(-400)),
    dounaGauntlet: gauntlet,
    operations: clonePlain((battle.operations || []).slice(-160)),
    leftScore: Number(battle.leftScore || 0),
    rightScore: Number(battle.rightScore || 0),
    momentum: Number(battle.momentum || 0),
    selectedTactic: String(battle.selectedTactic || "balanced"),
    opponentTactic: String(battle.opponentTactic || "balanced")
  };
}

function snapshotOnlineResourceStateForReport(battle) {
  if (!battle?.resourceState) return null;
  return {
    p1: snapshotOnlineResourceEntry(battle.resourceState.p1),
    p2: snapshotOnlineResourceEntry(battle.resourceState.p2),
    round: Number(battle.round || 0),
    distanceState: clonePlain(battle.distanceState || null),
    resourceLog: clonePlain((battle.resourceState.resourceLog || []).slice(-60)),
    residualLog: clonePlain((battle.resourceState.residualLog || []).slice(-60)),
    duelLog: clonePlain((battle.log || []).slice(0, 60)),
    battlefieldUnits: clonePlain((battle.battlefieldUnits || []).slice(-60)),
    summonLog: clonePlain((battle.summonLog || []).slice(-60)),
    serverSpectatorHandState: clonePlain(battle.handState || {}),
    special: clonePlain(battle.special || {}),
    customAtomicState: clonePlain(battle.customAtomicState || {}),
    mahoragaProxy: clonePlain(battle.mahoragaProxy || {}),
    specialConstitutionState: clonePlain(battle.specialConstitutionState || {}),
    specialConstitutionRandomCounter: Math.max(0, Number(battle.specialConstitutionRandomCounter || 0)),
    resolvedHandActionIds: clonePlain(battle.resolvedHandActionIds || { left: [], right: [] }),
    domainHandState: clonePlain(battle.domainHandState || {}),
    domainHandCandidates: clonePlain((battle.domainHandCandidates || []).slice(0, 20)),
    domainProfileStates: clonePlain(battle.domainProfileStates || {}),
    domainProfileActivations: clonePlain((battle.domainProfileActivations || []).slice(-20)),
    domainTrialContext: clonePlain(battle.domainTrialContext || null),
    domainSubPhase: clonePlain(battle.domainSubPhase || null),
    domainScriptNoCardLocks: clonePlain(battle.domainScriptNoCardLocks || {}),
    handLockMessages: clonePlain(battle.handLockMessages || {}),
    rikaArsenalPending: clonePlain(battle.rikaArsenalPending || {}),
    initiativeState: clonePlain(battle.initiativeState || null),
    initiativeHistory: clonePlain((battle.initiativeHistory || []).slice(-30)),
    randomLog: clonePlain((battle.randomLog || []).slice(-120)),
    authoritativeTurnSeed: String(battle.onlineAuthoritativeTurnSeed || ""),
    actionContext: clonePlain(battle.actionContext || null),
    dounaPrivateRuntimeState: snapshotOnlineDounaPrivateRuntimeState(battle),
    counterState: typeof globalThis.JJKDuelCounterPipeline?.snapshotCounterState === "function"
      ? globalThis.JJKDuelCounterPipeline.snapshotCounterState(battle)
      : null,
    lastRoundMemo: clonePlain(battle.lastRoundMemo || null)
  };
}

function reportOnlineAuthoritativeTurnState(battle, room = {}, turn = 0) {
  if (!battle || !room?.roomId || battle.onlinePlayerSide === "spectator") return;
  if (Number(room.battleApiVersion || 0) === 3 && String(room.simulationAuthority || "") === "client-synchronized-v1") return;
  if (!battle.dounaGauntlet?.online && (
    room.battleState?.authoritativeReporterSide === "server" ||
    room.battleState?.authoritativeResolverSide === "server" ||
    room.reviewState?.lastResolvedTurn?.result?.clientLocalResolutionRequired === false
  )) return;
  const side = battle.dounaGauntlet?.online
    ? String(battle.dounaGauntlet.onlinePlayerSide || battle.onlinePlayerSide || "")
    : (battle.onlinePlayerSide === "right" ? "right" : "left");
  if (!side || side === "spectator") return;
  const resourceState = snapshotOnlineResourceStateForReport(battle);
  if (!resourceState?.p1 || !resourceState?.p2) return;
  const currentTurn = Math.max(0, Number(turn || battle.round || 0));
  const reportKey = `${room.roomId}:${side}:${currentTurn}:${Math.round(Number(resourceState.p1.hp || 0))}:${Math.round(Number(resourceState.p2.hp || 0))}`;
  if (battle.onlineLastAuthoritativeReportKey === reportKey) return;
  battle.onlineLastAuthoritativeReportKey = reportKey;
  const dounaActions = {};
  if (battle.dounaGauntlet?.online && side) {
    dounaActions[side] = normalizeOnlineResolvedActions(battle.currentActions || [], "left", battle);
  }
  const bossActions = battle.dounaGauntlet?.online ? normalizeOnlineResolvedActions(battle.cpuActions || [], "right", battle) : [];
  globalThis.JJKOnline?.reportTurnState?.(room.roomId, {
    turn: currentTurn,
    round: Number(battle.round || 0),
    expectedBattleId: String(room.battleState?.battleId || ""),
    expectedTurnId: String(room.turnState?.turnId || `turn_${Math.max(1, Number(room.round || currentTurn || 1))}`),
    expectedRound: Math.max(1, Number(room.round || currentTurn || 1)),
    side,
    battleSeed: battle.onlineBattleSeed || battle.battleSeed || battle.seed || "",
    resolved: Boolean(battle.resolved),
    winnerSide: battle.winnerSide || "",
    summary: battle.resolutionReason || battle.actionUiMessage || "",
    resourceState,
    dounaActions,
    bossActions,
    sukunaActions: bossActions
  }, {
    side,
    playerId: globalThis.JJKOnline?.getUiState?.()?.playerId || undefined
  }).catch(function ignoreOnlineTurnStateReport(error) {
    battle.onlineTurnStateReportError = String(error?.message || error || "");
  });
}

function applyOnlineAuthoritativeResourceState(battle, room = {}) {
  const authoritativeTurn = Math.max(0, Number(room.battleState?.authoritativeTurn || 0));
  const resourceState = room.battleState?.resourceState;
  if (!battle?.resourceState || !resourceState?.p1 || !resourceState?.p2) return false;
  const appliedTurn = Math.max(0, Number(battle.onlineAuthoritativeTurnApplied || 0));
  if (authoritativeTurn < appliedTurn) return false;
  battle.resourceState.p1 = clonePlain(resourceState.p1);
  battle.resourceState.p2 = clonePlain(resourceState.p2);
  if (resourceState.distanceState !== undefined) {
    battle.distanceState = clonePlain(resourceState.distanceState || null);
    battle.engagementRange = String(resourceState.distanceState?.range || "");
    battle.combatRange = String(resourceState.distanceState?.range || "");
  }
  battle.resourceState.resourceLog = clonePlain(resourceState.resourceLog || battle.resourceState.resourceLog || []);
  battle.resourceState.residualLog = clonePlain(resourceState.residualLog || battle.resourceState.residualLog || []);
  battle.resourceLog = battle.resourceState.resourceLog;
  battle.residualLog = battle.resourceState.residualLog;
  battle.battlefieldUnits = Array.isArray(resourceState.battlefieldUnits)
    ? clonePlain(resourceState.battlefieldUnits)
    : clonePlain((battle.resourceState.p1?.summonedUnits || []).concat(battle.resourceState.p2?.summonedUnits || []));
  battle.summonLog = Array.isArray(resourceState.summonLog) ? clonePlain(resourceState.summonLog.slice(0, 60)) : (battle.summonLog || []);
  if (
    resourceState.serverSpectatorHandState &&
    typeof resourceState.serverSpectatorHandState === "object" &&
    Object.values(resourceState.serverSpectatorHandState).some((hand) => Array.isArray(hand?.cards) && hand.cards.length)
  ) {
    battle.handState = clonePlain(resourceState.serverSpectatorHandState);
  }
  if (resourceState.special && typeof resourceState.special === "object") battle.special = clonePlain(resourceState.special);
  if (resourceState.customAtomicState && typeof resourceState.customAtomicState === "object") battle.customAtomicState = clonePlain(resourceState.customAtomicState);
  if (resourceState.mahoragaProxy && typeof resourceState.mahoragaProxy === "object") battle.mahoragaProxy = clonePlain(resourceState.mahoragaProxy);
  if (resourceState.specialConstitutionState && typeof resourceState.specialConstitutionState === "object") {
    battle.specialConstitutionState = clonePlain(resourceState.specialConstitutionState);
  }
  battle.specialConstitutionRandomCounter = Math.max(0, Number(resourceState.specialConstitutionRandomCounter || 0));
  if (resourceState.resolvedHandActionIds && typeof resourceState.resolvedHandActionIds === "object") {
    battle.resolvedHandActionIds = clonePlain(resourceState.resolvedHandActionIds);
  }
  if (resourceState.domainHandState && typeof resourceState.domainHandState === "object") {
    battle.domainHandState = clonePlain(resourceState.domainHandState);
  }
  if (Array.isArray(resourceState.domainHandCandidates)) {
    battle.domainHandCandidates = clonePlain(resourceState.domainHandCandidates.slice(0, 20));
  }
  if (resourceState.domainProfileStates && typeof resourceState.domainProfileStates === "object") {
    battle.domainProfileStates = clonePlain(resourceState.domainProfileStates);
  }
  if (Array.isArray(resourceState.domainProfileActivations)) {
    battle.domainProfileActivations = clonePlain(resourceState.domainProfileActivations.slice(-20));
  }
  if (resourceState.domainTrialContext !== undefined) {
    battle.domainTrialContext = clonePlain(resourceState.domainTrialContext || null);
  }
  if (resourceState.domainSubPhase !== undefined) {
    battle.domainSubPhase = clonePlain(resourceState.domainSubPhase || null);
  }
  if (resourceState.domainScriptNoCardLocks && typeof resourceState.domainScriptNoCardLocks === "object") {
    battle.domainScriptNoCardLocks = clonePlain(resourceState.domainScriptNoCardLocks);
  }
  if (resourceState.handLockMessages && typeof resourceState.handLockMessages === "object") {
    battle.handLockMessages = clonePlain(resourceState.handLockMessages);
  }
  if (resourceState.rikaArsenalPending && typeof resourceState.rikaArsenalPending === "object") {
    battle.rikaArsenalPending = clonePlain(resourceState.rikaArsenalPending);
  }
  if (resourceState.counterState && typeof resourceState.counterState === "object") {
    const restoreCounters = globalThis.JJKDuelCounterPipeline?.restoreCounterState;
    if (typeof restoreCounters === "function") {
      try {
        restoreCounters(battle, resourceState.counterState);
      } catch (error) {
        battle.onlineCounterStateError = String(error?.message || "联机计数器快照无效");
      }
    } else {
      battle.onlineCounterStateError = "计数器管线尚未加载，已拒绝联机计数器快照。";
    }
  }
  if (resourceState.initiativeState && typeof resourceState.initiativeState === "object") {
    battle.initiativeState = clonePlain(resourceState.initiativeState);
  }
  if (Array.isArray(resourceState.initiativeHistory)) {
    battle.initiativeHistory = clonePlain(resourceState.initiativeHistory.slice(-30));
  }
  if (Array.isArray(resourceState.randomLog)) {
    battle.randomLog = clonePlain(resourceState.randomLog.slice(-120));
  }
  battle.onlineAuthoritativeTurnSeed = String(resourceState.authoritativeTurnSeed || room.battleState?.turnSeed || "");
  battle.onlineAuthoritativeStateHash = String(room.battleState?.stateHash || room.reviewState?.lastResolvedTurn?.stateHash || "");
  battle.onlineAuthoritativeResolutionId = String(room.battleState?.resolutionId || room.reviewState?.lastResolvedTurn?.resolutionId || "");
  if (Array.isArray(resourceState.duelLog)) {
    battle.log = clonePlain(resourceState.duelLog.slice(0, 60));
  } else if (Array.isArray(resourceState.battleLog)) {
    battle.log = clonePlain(resourceState.battleLog.slice(0, 60));
  }
  if (resourceState.lastRoundMemo && typeof resourceState.lastRoundMemo === "object") {
    battle.lastRoundMemo = clonePlain(resourceState.lastRoundMemo);
  }
  const privateRuntime = resourceState.dounaPrivateRuntimeState;
  if (battle.dounaGauntlet?.online && privateRuntime && typeof privateRuntime === "object") {
    if (privateRuntime.handState && typeof privateRuntime.handState === "object") {
      battle.handState = clonePlain(privateRuntime.handState);
    }
    if (Array.isArray(privateRuntime.actionChoices)) battle.actionChoices = clonePlain(privateRuntime.actionChoices.slice(0, 30));
    if (Array.isArray(privateRuntime.handCandidates)) battle.handCandidates = clonePlain(privateRuntime.handCandidates.slice(0, 30));
    battle.actionRound = Math.max(1, Number(privateRuntime.actionRound || authoritativeTurn + 1));
    if (privateRuntime.actionPoints && typeof privateRuntime.actionPoints === "object") battle.actionPoints = clonePlain(privateRuntime.actionPoints);
    if (privateRuntime.selectedHandActions && typeof privateRuntime.selectedHandActions === "object") {
      battle.selectedHandActions = clonePlain(privateRuntime.selectedHandActions);
    }
    if (privateRuntime.onlineRandomCounters && typeof privateRuntime.onlineRandomCounters === "object") {
      battle.onlineRandomCounters = clonePlain(privateRuntime.onlineRandomCounters);
    }
    if (privateRuntime.dounaGauntlet && typeof privateRuntime.dounaGauntlet === "object") {
      const roster = battle.dounaGauntlet.roster;
      battle.dounaGauntlet = {
        ...battle.dounaGauntlet,
        ...clonePlain(privateRuntime.dounaGauntlet),
        roster
      };
      const currentIndex = Math.max(0, Math.min((roster || []).length - 1, Number(battle.dounaGauntlet.currentIndex || 0)));
      if (roster?.[currentIndex]) battle.left = clonePlain(roster[currentIndex]);
      if (Number(battle.dounaGauntlet.bossLife || 1) === 2) {
        battle.right = buildDounaSukunaProfile(2) || battle.right;
      }
    }
    if (Array.isArray(privateRuntime.operations)) battle.operations = clonePlain(privateRuntime.operations.slice(-160));
    battle.leftScore = Number(privateRuntime.leftScore || 0);
    battle.rightScore = Number(privateRuntime.rightScore || 0);
    battle.momentum = Number(privateRuntime.momentum || 0);
    battle.selectedTactic = String(privateRuntime.selectedTactic || battle.selectedTactic || "balanced");
    battle.opponentTactic = String(privateRuntime.opponentTactic || battle.opponentTactic || "balanced");
  }
  battle.round = Math.max(Number(battle.round || 0), authoritativeTurn);
  battle.resourceState.round = battle.round;
  battle.onlineAuthoritativeTurnApplied = authoritativeTurn;
  battle.onlineAppliedTurns ||= [];
  const turnKey = `${room.roomId || battle.onlineRoomId || "room"}:${authoritativeTurn}`;
  if (!battle.onlineAppliedTurns.includes(turnKey)) battle.onlineAppliedTurns.push(turnKey);
  updateDuelResourceReplayKey(battle);
  maybeResolveDuelBattle(battle);
  return true;
}

function getOnlineAuthoritativeResolverSide(room = {}) {
  const value = String(room.reviewState?.lastResolvedTurn?.authoritativeResolverSide || room.battleState?.authoritativeResolverSide || "left").trim();
  if (value === "server") return "server";
  return value === "right" ? "right" : "left";
}

function ensureOnlineDomainPanelState(battle) {
  if (!battle?.resourceState) return false;
  battle.domainProfileStates ||= {};
  let changed = false;
  for (const side of ["left", "right"]) {
    const actor = side === "left" ? battle.resourceState.p1 : battle.resourceState.p2;
    if (!actor?.domain?.active || battle.domainProfileStates[side]) continue;
    const ownerProfile = getDuelProfileForSide(battle, side);
    const rawProfile = getDuelDomainProfileForCharacter(ownerProfile, null, battle);
    if (!rawProfile) continue;
    const profile = normalizeDuelDomainBarrierProfile(rawProfile);
    const summary = getDuelDomainBarrierSummary(profile);
    battle.domainProfileStates[side] = {
      ownerSide: side,
      domainId: String(profile.id || `${side}-online-domain`),
      domainName: String(profile.domainName || ownerProfile?.domainName || ownerProfile?.domainProfile || "领域展开"),
      ownerName: String(profile.ownerName || actor.name || side),
      domainClass: profile.domainClass || "standard",
      barrierType: profile.barrierType || "unknown",
      domainCompletion: profile.domainCompletion || "unknown",
      domainSwitchability: profile.domainSwitchability || "unknown",
      barrierBehavior: profile.barrierBehavior || {},
      barrierModifiers: getDuelDomainBarrierModifiers(profile, actor, side === "left" ? battle.resourceState.p2 : battle.resourceState.p1, battle),
      effectTags: profile.effectTags || [], profile,
      weakened: false, specialEffectEffective: true, effectDisclosure: "implemented",
      barrierHint: summary?.hint || "联机领域状态已同步",
      roundStarted: Math.max(1, Number(battle.round || 0)), status: "SYNCED"
    };
    changed = true;
  }
  return changed;
}

function ensureOnlineDomainPanelState(battle) {
  if (!battle?.resourceState) return false;
  battle.domainProfileStates ||= {};
  let changed = false;
  for (const side of ["left", "right"]) {
    const actor = side === "left" ? battle.resourceState.p1 : battle.resourceState.p2;
    if (!actor?.domain?.active || battle.domainProfileStates[side]) continue;
    const ownerProfile = getDuelProfileForSide(battle, side);
    const rawProfile = getDuelDomainProfileForCharacter(ownerProfile, null, battle);
    if (!rawProfile) continue;
    const profile = normalizeDuelDomainBarrierProfile(rawProfile);
    const summary = getDuelDomainBarrierSummary(profile);
    battle.domainProfileStates[side] = { ownerSide: side, domainId: String(profile.id || `${side}-online-domain`), domainName: String(profile.domainName || ownerProfile?.domainName || ownerProfile?.domainProfile || "领域展开"), ownerName: String(profile.ownerName || actor.name || side), domainClass: profile.domainClass || "standard", barrierType: profile.barrierType || "unknown", domainCompletion: profile.domainCompletion || "unknown", domainSwitchability: profile.domainSwitchability || "unknown", barrierBehavior: profile.barrierBehavior || {}, barrierModifiers: getDuelDomainBarrierModifiers(profile, actor, side === "left" ? battle.resourceState.p2 : battle.resourceState.p1, battle), effectTags: profile.effectTags || [], profile, weakened: false, specialEffectEffective: true, effectDisclosure: "implemented", barrierHint: summary?.hint || "联机领域状态已同步", roundStarted: Math.max(1, Number(battle.round || 0)), status: "SYNCED" };
    changed = true;
  }
  return changed;
}

function applyOnlineOwnerFinalState(battle, room = {}) {
  if (!battle || !room || !["reviewing", "ended"].includes(room.phase)) return false;
  const result = room.reviewState?.competitionResult || {};
  const winnerSide = ["left", "right", "draw"].includes(result.winnerSide)
    ? result.winnerSide
    : (["left", "right", "draw"].includes(room.reviewState?.winnerSide) ? room.reviewState.winnerSide : "");
  if (!winnerSide) return false;
  applyOnlineAuthoritativeResourceState(battle, room);
  battle.winnerSide = winnerSide;
  battle.battleEnded = true;
  battle.resolved = true;
  battle.endReason = result.endReason || result.resultType || battle.endReason || "owner_authoritative_result";
  battle.endingRound = Number(result.endingRound || room.battleState?.authoritativeTurn || battle.round || room.round || 0);
  battle.round = Math.max(Number(battle.round || 0), Number(battle.endingRound || 0));
  if (battle.resourceState) battle.resourceState.round = battle.round;
  battle.resolutionReason = room.reviewState?.summary || result.summary || battle.resolutionReason || "房主侧已确认胜负，联机对战结束。";
  battle.actionUiMessage = battle.resolutionReason;
  battle.onlineOwnerFinalStateApplied = `${room.roomId || battle.onlineRoomId || "room"}:${winnerSide}:${battle.endingRound}:${room.reviewState?.competitionResult?.reportedAt || room.updatedAt || ""}`;
  if (!battle.finalSnapshot) {
    try {
      const snapshot = buildDuelFinalSnapshot(battle);
      battle.finalSnapshot = snapshot;
      battle.finalResourceSnapshot = snapshot.finalResourceSnapshot;
      battle.finalHandState = snapshot.finalHandState;
      battle.finalDomainState = snapshot.finalDomainState;
    } catch {
      battle.finalSnapshot = battle.finalSnapshot || null;
    }
  }
  updateDuelResourceReplayKey(battle);
  return true;
}

function hasAuthoritativeOnlineTerminalResult(room = {}) {
  const result = room?.reviewState?.competitionResult || room?.competitionResult || {};
  const winners = new Set(["left", "right", "draw"]);
  return (result.locked === true && winners.has(String(result.winnerSide || "")))
    || (String(room?.phase || "") === "ended" && winners.has(String(
      result.winnerSide || room?.reviewState?.winnerSide || room?.lastExitNotice?.winnerSide || ""
    )));
}

function recordOnlineObservedTurnSummary(battle, room = {}, turnOverride = null) {
  const turn = turnOverride || room.reviewState?.lastResolvedTurn || null;
  if (!battle?.resourceState || !turn?.turn) return false;
  const result = turn.result || {};
  const detail = String(result.summary || room.reviewState?.summary || "").trim();
  const turnKey = `${room.roomId || battle.onlineRoomId || "room"}:${turn.turn}:${detail}`;
  battle.onlineObservedTurnSummaries ||= [];
  if (battle.onlineObservedTurnSummaries.includes(turnKey)) return true;
  battle.onlineObservedTurnSummaries.push(turnKey);
  battle.onlineObservedTurnSummaries = battle.onlineObservedTurnSummaries.slice(-20);
  const serverMemo = room.battleState?.resourceState?.lastRoundMemo && typeof room.battleState.resourceState.lastRoundMemo === "object"
    ? clonePlain(room.battleState.resourceState.lastRoundMemo)
    : null;
  const fallbackMemo = {
    round: Number(turn.turn || 0),
    leftMiss: result.leftHit === false ? "未命中" : "命中",
    rightMiss: result.rightHit === false ? "未命中" : "命中",
    leftDelta: String(result.leftEffect || "联机回合已同步"),
    rightDelta: String(result.rightEffect || "联机回合已同步"),
    leftMitigation: normalizeObservedMitigationSummary(result.leftMitigation || result.mitigation?.left),
    rightMitigation: normalizeObservedMitigationSummary(result.rightMitigation || result.mitigation?.right),
    leftStatuses: [],
    rightStatuses: []
  };
  battle.lastRoundMemo = serverMemo ? {
    ...fallbackMemo,
    ...serverMemo,
    leftMitigation: chooseObservedMitigationSummary(serverMemo.leftMitigation, fallbackMemo.leftMitigation),
    rightMitigation: chooseObservedMitigationSummary(serverMemo.rightMitigation, fallbackMemo.rightMitigation),
    stateHash: String(turn.stateHash || room.battleState?.stateHash || ""),
    resolutionId: String(turn.resolutionId || room.battleState?.resolutionId || "")
  } : {
    ...fallbackMemo,
    stateHash: String(turn.stateHash || room.battleState?.stateHash || ""),
    resolutionId: String(turn.resolutionId || room.battleState?.resolutionId || "")
  };
  if (!detail) return true;
  try {
    recordDuelResourceChange(battle, {
      side: result.winnerHint === "right" ? "right" : result.winnerHint === "left" ? "left" : "neutral",
      title: `服务器回合纪要 R${turn.turn}`,
      detail,
      type: "system",
      delta: {
        aiSource: turn.source || result.source || "",
        authoritativeResolverSide: turn.authoritativeResolverSide || getOnlineAuthoritativeResolverSide(room),
        leftEffect: result.leftEffect || "",
        rightEffect: result.rightEffect || "",
        leftMitigation: clonePlain(battle.lastRoundMemo.leftMitigation || null),
        rightMitigation: clonePlain(battle.lastRoundMemo.rightMitigation || null)
      }
    });
    battle.resourceLog = battle.resourceState.resourceLog;
    battle.residualLog = battle.resourceState.residualLog;
  } catch {
    battle.resourceState.resourceLog ||= [];
    battle.resourceState.residualLog ||= [];
    const entry = {
      id: `online_summary_${turn.turn}_${battle.resourceState.resourceLog.length + 1}`,
      round: Number(turn.turn || battle.round || 0),
      side: "neutral",
      title: `服务器回合纪要 R${turn.turn}`,
      detail,
      type: "system"
    };
    battle.resourceState.resourceLog.unshift(entry);
    battle.resourceState.residualLog.unshift(entry);
    battle.resourceLog = battle.resourceState.resourceLog;
    battle.residualLog = battle.resourceState.residualLog;
  }
  updateDuelResourceReplayKey(battle);
  return true;
}

// Spectators consume the server's public result frame. They must never rebuild
// a reveal from private hands or run the player-side capability validators.
function applyOnlineSpectatorAuthoritativeState(battle, room = {}) {
  if (!battle || battle.onlinePlayerSide !== "spectator" || !room?.roomId) return false;
  syncOnlineSpectatorActions(room);
  const persistedTurn = room.reviewState?.lastResolvedTurn || null;
  const frame = room.battleState?.spectatorFrame || persistedTurn?.spectatorFrame || null;
  const frameTurn = Number(frame?.turn || frame?.round || 0);
  // A public frame is published atomically with the authoritative resolution.
  // Prefer it when it is newer than the compatibility review projection; the
  // latter can legitimately lag by one poll/write cycle.
  const resolvedTurn = frameTurn > Number(persistedTurn?.turn || 0)
    ? { ...persistedTurn, turn: frameTurn, actions: frame.actions || persistedTurn?.actions, result: frame.result || persistedTurn?.result, stateHash: frame.stateHash || persistedTurn?.stateHash, resolutionId: frame.resolutionId || persistedTurn?.resolutionId, spectatorFrame: frame }
    : persistedTurn;
  const resolvedRound = Number(resolvedTurn?.turn || room.battleState?.authoritativeTurn || 0);
  if (resolvedRound > 0) {
    recordOnlineObservedTurnSummary(battle, room, resolvedTurn);
    battle.round = Math.max(Number(battle.round || 0), resolvedRound);
    if (battle.resourceState) battle.resourceState.round = battle.round;
    battle.onlineObservedTurn = Math.max(Number(battle.onlineObservedTurn || 0), resolvedRound);
    battle.currentActions = battle.spectatorActions?.left || [];
    battle.cpuActions = battle.spectatorActions?.right || [];
    battle.currentAction = battle.currentActions[0] || null;
    battle.cpuAction = battle.cpuActions[0] || null;
  }
  if (hasAuthoritativeOnlineTerminalResult(room) || room.phase === "ended") {
    applyOnlineOwnerFinalState(battle, room);
  }
  battle.pendingAction = null;
  battle.actionUiMessage = room.phase === "turn_resolving"
    ? "双方已锁定，正在等待服务器公开结算。"
    : resolvedRound > 0
      ? `第 ${resolvedRound} 回合已同步，等待双方下一回合行动。`
      : "观战模式：等待双方加入并同步公开战况。";
  updateDuelActionAvailability(battle);
  return resolvedRound > 0;
}

function hasPublicSpectatorRevealInputs(room = {}) {
  const reveal = room?.syncState?.lastReveal;
  const commits = reveal?.commits || {};
  const hasActions = ["left", "right"].every((side) =>
    Array.isArray(commits?.[side]?.actions) && commits[side].actions.every((entry) =>
      entry && (entry.actionId || entry.cardInstanceId) &&
      (!entry.action || (typeof entry.action === "object" && !Array.isArray(entry.action)))
    )
  );
  return Boolean(
    room?.syncProtocolVersion === "reveal-ack-input-only-v3" &&
    reveal?.turnSeed && reveal?.initiative?.firstSide && reveal?.initiativeHash && hasActions
  );
}

function applyOnlineResolvedTurnToBattle(battle, room = {}, playerSide = "") {
  const turn = room.reviewState?.lastResolvedTurn || null;
  if (!battle?.resourceState || !turn?.turn) return false;
  battle.onlineAppliedTurns ||= [];
  const turnKey = `${room.roomId || battle.onlineRoomId || "room"}:${turn.turn}`;
  if (battle.onlineAppliedTurns.includes(turnKey)) return true;
  const expectedLocalTurn = battle.round + 1;
  if (Number(turn.turn) !== expectedLocalTurn) return false;

  const serverAuthoritative = Boolean(
    turn.authoritativeResolverSide === "server" ||
    turn.result?.authoritativeResolverSide === "server" ||
    turn.result?.clientLocalResolutionRequired === false ||
    room.battleState?.authoritativeResolverSide === "server" ||
    room.battleState?.authoritativeReporterSide === "server"
  );
  if (serverAuthoritative) {
    if (!applyOnlineAuthoritativeResourceState(battle, room)) return false;
    const leftActions = normalizeOnlineResolvedActions(turn.actions?.left || turn.spectatorFrame?.actions?.left, "left", battle);
    const rightActions = normalizeOnlineResolvedActions(turn.actions?.right || turn.spectatorFrame?.actions?.right, "right", battle);
    if ((playerSide === "left" || playerSide === "right") && Number(room.battleApiVersion || 0) < 2) {
      const localResolvedActions = playerSide === "right" ? rightActions : leftActions;
      battle.onlineHandConsumption ||= [];
      if (!battle.onlineHandConsumption.includes(turnKey)) {
        consumeDuelResolvedHandActions(battle, playerSide, localResolvedActions, { authoritativeTurn: Number(turn.turn || 0) });
        battle.onlineHandConsumption.push(turnKey);
        battle.onlineHandConsumption = battle.onlineHandConsumption.slice(-30);
      }
    }
    battle.currentActions = leftActions;
    battle.cpuActions = rightActions;
    battle.currentAction = leftActions[0] || null;
    battle.cpuAction = rightActions[0] || null;
    battle.initiativeState = clonePlain(turn.result?.initiative || turn.spectatorFrame?.initiative || battle.initiativeState || null);
    battle.currentOptions = [];
    battle.pendingAction = null;
    battle.onlineServerAuthoritativeApplied = turnKey;
    updateDuelResourceReplayKey(battle);
    maybeResolveDuelBattle(battle);
    return true;
  }

  const beforeMemoSnapshot = snapshotDuelMemoState(battle);
  // Legacy non-authoritative replay still settles locally. Install both full,
  // normalized locked plans (including an explicit pass) before initiative so
  // the first actor can inspect the opponent's complete combo selection.
  const leftActions = normalizeOnlineLockedActionPlan(turn.actions?.left, "left", battle);
  const rightActions = normalizeOnlineLockedActionPlan(turn.actions?.right, "right", battle);
  battle.selectedHandActions ||= {};
  battle.selectedHandActions.left = leftActions.slice();
  battle.selectedHandActions.right = rightActions.slice();
  appendDuelHandBatchLog(battle, "left", leftActions, { phase: "selected" });
  appendDuelHandBatchLog(battle, "right", rightActions, { phase: "selected" });
  battle.initiativeInvestmentSelections = {
    left: Number(leftActions[0]?.initiativeInvestment ?? leftActions[0]?.action?.initiativeInvestment ?? 0),
    right: Number(rightActions[0]?.initiativeInvestment ?? rightActions[0]?.action?.initiativeInvestment ?? 0)
  };
  const initiative = resolveDuelInitiativeContest(battle, battle.initiativeInvestmentSelections);
  const onlineOrder = initiative?.firstSide === "right" ? ["right", "left"] : ["left", "right"];
  const onlineResults = {};
  let onlineEndedByFirstAction = false;
  for (const actingSide of onlineOrder) {
    if (onlineEndedByFirstAction) {
      onlineResults[actingSide] = { applied: false, skipped: true, reason: "对手已被先手行动击败，本回合后手行动取消", side: actingSide, actions: [], results: [] };
      continue;
    }
    onlineResults[actingSide] = actingSide === "left"
      ? applyDuelSelectedHandActions(battle.resourceState.p1, battle.resourceState.p2, battle, { side: "left", actions: leftActions, clearAfter: false })
      : applyDuelSelectedHandActions(battle.resourceState.p2, battle.resourceState.p1, battle, { side: "right", actions: rightActions, clearAfter: false });
    if (actingSide === "left" && onlineResults.left?.applied) {
      globalThis.JJKShibuyaIncident?.completeMahitoDamageThresholdAfterLeftHand?.(battle, leftActions, onlineResults.left?.results || []);
    }
    if (onlineResults[actingSide]?.applied && maybeResolveDuelBattleAfterHandActions(battle)) onlineEndedByFirstAction = true;
  }
  const leftResult = onlineResults.left || { applied: false, skipped: true, reason: "本回合未行动", actions: [], results: [] };
  const rightResult = onlineResults.right || { applied: false, skipped: true, reason: "本回合未行动", actions: [], results: [] };
  appendDuelHandBatchLog(battle, "left", leftActions, { phase: "executed", result: leftResult });
  appendDuelHandBatchLog(battle, "right", rightActions, { phase: "executed", result: rightResult });

  battle.currentActions = leftResult.actions || [];
  battle.cpuActions = rightResult.actions || [];
  battle.currentAction = battle.currentActions[0] || null;
  battle.cpuAction = battle.cpuActions[0] || null;
  if (onlineEndedByFirstAction || maybeResolveDuelBattleAfterHandActions(battle)) {
    battle.lastRoundMemo = buildDuelRoundMemo(battle, beforeMemoSnapshot, snapshotDuelMemoState(battle), leftResult, rightResult);
    battle.onlineAppliedTurns.push(turnKey);
    battle.currentOptions = [];
    battle.pendingAction = null;
    updateDuelResourceReplayKey(battle);
    reportOnlineAuthoritativeTurnState(battle, room, turn.turn);
    return true;
  }
  battle.opponentTactic = pickDuelOpponentTactic(battle);
  const domainActivationPairs = [
    ...battle.currentActions.map((action) => ({ action, actor: battle.resourceState.p1, opponent: battle.resourceState.p2, responseAction: battle.cpuActions[0] || null })),
    ...battle.cpuActions.map((action) => ({ action, actor: battle.resourceState.p2, opponent: battle.resourceState.p1, responseAction: battle.currentActions[0] || null }))
  ];
  resolveDuelDomainProfileActivations(battle, domainActivationPairs);
  battle.currentOptions = buildDuelRoundOptions(battle);
  const result = drawWeightedDuelOption(battle.currentOptions, () => duelRandom(battle, "onlineRoundEvent"));
  if (!result) return false;
  battle.operations.push(`online:${room.roomId || battle.onlineRoomId || "room"}:turn:${turn.turn}:left:${leftActions.map((action) => action.actionId).join("+") || "none"}:right:${rightActions.map((action) => action.actionId).join("+") || "none"}:event:${result.index}`);
  applyDuelRoundResult(battle, result);
  if (turn.result?.summary) {
    recordDuelResourceChange(battle, {
      side: turn.result?.winnerHint === "right" ? "right" : turn.result?.winnerHint === "left" ? "left" : "neutral",
      title: `服务器结算摘要 R${turn.turn}`,
      detail: turn.result.summary,
      type: "system",
      delta: { aiSource: turn.source || turn.result?.source || "", leftEffect: turn.result?.leftEffect || "", rightEffect: turn.result?.rightEffect || "" }
    });
  }
  battle.lastRoundMemo = buildDuelRoundMemo(battle, beforeMemoSnapshot, snapshotDuelMemoState(battle), leftResult, rightResult);
  battle.onlineAppliedTurns.push(turnKey);
  battle.currentOptions = [];
  battle.pendingAction = null;
  maybeResolveDuelBattle(battle);
  updateDuelResourceReplayKey(battle);
  reportOnlineAuthoritativeTurnState(battle, room, turn.turn);
  return true;
}

function getActiveDuelHandLockMessage(battle = state.duelBattle, side = getDuelControlledSide(battle)) {
  if (!battle || !side) return "";
  if (battle.mahoragaProxy?.[side]?.active) return "魔虚罗代打中";
  const lockEntry = battle.handLockMessages?.[side];
  return lockEntry && Number(lockEntry.round || 0) === battle.round + 1 ? String(lockEntry.message || "") : "";
}

function clearOnlineDuelBattle(roomId = "") {
  const battle = state.duelBattle;
  if (!battle || battle.mode !== "online") {
    commitDuelHtml(els.duelBattle, "");
    syncDuelBattleFocusMode(null);
    return false;
  }
  const targetRoomId = String(roomId || "");
  if (targetRoomId && battle.onlineRoomId && battle.onlineRoomId !== targetRoomId) return false;
  state.duelBattle = null;
  clearOnlineTemporaryCustomDuelCards(targetRoomId);
  setDuelBattleMode("none", {
    activeBattleId: "",
    activeRoomId: "",
    playerSide: null,
    localLocked: false,
    activePage: "online"
  });
  getBattlePageModule()?.activateBattlePage?.("online", { primeMode: false });
  commitDuelHtml(els.duelBattle, "");
  syncDuelBattleFocusMode(null);
  return true;
}

function buildOnlineRoomRuntimeSyncKey(room = {}, playerSide = "") {
  const actionIds = (actions = []) => (Array.isArray(actions) ? actions : [])
    .map((entry) => String(entry?.actionId || entry?.id || entry?.displayName || ""))
    .join(",");
  const resourceStateSignature = (resourceState = {}) => {
    const sideSignature = (resource = {}) => [
      Math.round(Number(resource.hp || 0)),
      Math.round(Number(resource.ce || 0)),
      Math.round(Number(resource.domain?.load ?? resource.domainLoad ?? 0)),
      resource.domain?.active ? "D1" : "D0",
      (resource.statusEffects || []).map((effect) => [
        effect?.id || "",
        Number(effect?.value || 0),
        Number(effect?.rounds || 0)
      ].join(":")).join(",")
    ].join("/");
    return JSON.stringify({
      p1: sideSignature(resourceState.p1 || {}),
      p2: sideSignature(resourceState.p2 || {}),
      distanceState: resourceState.distanceState || null,
      domainProfileStates: resourceState.domainProfileStates || {},
      domainSubPhase: resourceState.domainSubPhase || null,
      domainTrialContext: resourceState.domainTrialContext || null,
      counterState: resourceState.counterState || null,
      special: resourceState.special || {},
      customAtomicState: resourceState.customAtomicState || {},
      mahoragaProxy: resourceState.mahoragaProxy || {},
      specialConstitutionState: resourceState.specialConstitutionState || {},
      specialConstitutionRandomCounter: Number(resourceState.specialConstitutionRandomCounter || 0),
      resolvedHandActionIds: resourceState.resolvedHandActionIds || {}
    }).slice(0, 1800);
  };
  const authoritativeResourceState = room.battleState?.resourceState || {};
  return [
    room.roomId || "",
    room.mode || "",
    room.teamMode || "",
    room.phase || "",
    room.round || "",
    room.viewerSide || playerSide || "",
    room.battleState?.battleSeed || "",
    room.turnState?.turnId || "",
    room.turnState?.phase || "",
    room.turnState?.locks?.left ? "L1" : "L0",
    room.turnState?.locks?.right ? "R1" : "R0",
    room.localPendingLock ? "LP1" : "LP0",
    actionIds(room.turnState?.actions?.left),
    actionIds(room.turnState?.actions?.right),
    room.reviewState?.lastResolvedTurn?.turn || "",
    room.reviewState?.lastResolvedTurn?.source || "",
    room.reviewState?.lastResolvedTurn?.result?.summary || "",
    room.battleState?.spectatorFrame?.frameId || room.reviewState?.lastResolvedTurn?.spectatorFrame?.frameId || "",
    room.battleState?.stateHash || room.reviewState?.lastResolvedTurn?.stateHash || "",
    room.battleState?.resolutionId || room.reviewState?.lastResolvedTurn?.resolutionId || "",
    room.battleState?.authoritativeTurn || "",
    room.battleState?.authoritativeReporterSide || "",
    room.privateState?.revision || "",
    room.privateState?.handState?.handRevision || "",
    (room.privateState?.handState?.cards || []).map((card) => card?.cardInstanceId || card?.actionId || card?.id || "").join(","),
    room.privateState?.handState?.pendingDiscardCount || 0,
    resourceStateSignature(authoritativeResourceState),
    room.battleState?.resourceState?.duelLog?.[0]?.title || "",
    room.battleState?.resourceState?.duelLog?.[0]?.detail || "",
    room.battleState?.resourceState?.lastRoundMemo?.round || "",
    room.reviewState?.winnerSide || "",
    room.reviewState?.aiBattleSummary || "",
    room.simulationAuthority || "",
    room.syncState?.lastReveal?.round || "",
    room.syncState?.lastReveal?.status || "",
    room.syncState?.lastReveal?.turnSeed || "",
    JSON.stringify(room.syncState?.lastReveal?.acknowledgements || {}),
    JSON.stringify(room.syncState?.lastReveal?.receipts || {}),
    room.turnState?.deadlineAt || 0,
    JSON.stringify(room.turnState?.timeoutCommittedSides || {}),
    actionIds(room.syncState?.lastReveal?.commits?.left),
    actionIds(room.syncState?.lastReveal?.commits?.right),
    ...(room.dounaPlayers || []).flatMap((player, index) => [
      `D${index + 1}`,
      player?.playerId || "",
      player?.characterId || "",
      player?.characterLocked ? "1" : "0"
    ])
  ].join("|");
}

function isClientSynchronizedOnlineRoom(room = {}) {
  return Number(room?.battleApiVersion || 0) >= 3 && String(room?.simulationAuthority || "") === "client-synchronized-v1";
}

function recordDuelDiagnostic(battle, operation, status, detail = {}) {
  if (!battle || typeof battle !== "object") return null;
  battle.runtimeDiagnostics ||= [];
  const entry = {
    at: new Date().toISOString(),
    operation: String(operation || "unknown"),
    status: String(status || "info"),
    round: Number(battle.round || 0),
    roomId: String(battle.onlineRoomId || ""),
    detail: clonePlain(detail || {})
  };
  battle.runtimeDiagnostics.push(entry);
  if (battle.runtimeDiagnostics.length > 120) battle.runtimeDiagnostics.splice(0, battle.runtimeDiagnostics.length - 120);
  return entry;
}

const TERMINAL_ONLINE_REVEAL_CODES = new Set(["RULESET_MISMATCH", "REVEAL_INCOMPLETE", "REVEAL_INPUT_INVALID", "TURN_STATE_DIVERGED", "INITIATIVE_STATE_MISMATCH", "TURN_OUTPUT_HASH_MISMATCH", "DOMAIN_STATE_INVALID", "DOMAIN_LOAD_LIMIT", "TURN_RESOLVE_TIMEOUT"]);

function freezeOnlineRevealFromResponse(battle, errorOrResponse = {}, fallback = {}) {
  const responseData = errorOrResponse?.responseData || errorOrResponse || {};
  const code = String(errorOrResponse?.code || responseData?.code || responseData?.operationStatus?.code || "");
  if (!TERMINAL_ONLINE_REVEAL_CODES.has(code) || !battle) return false;
  const room = responseData?.room || responseData?.snapshot || fallback.room || null;
  if (room?.roomId) battle.onlineRoomSnapshot = clonePlain(room);
  battle.onlineRevealState ||= {};
  battle.onlineRevealState.status = "blocked";
  battle.onlineRevealState.lastError = code;
  battle.actionUiMessage = code === "TURN_STATE_DIVERGED" || code === "TURN_OUTPUT_HASH_MISMATCH"
    ? "双方回合结果不一致，比赛已冻结。"
    : code === "TURN_RESOLVE_TIMEOUT"
      ? "联机回合收据超时，正在等待服务器恢复。"
      : "服务器已冻结本回合同步，请导出诊断并等待处理。";
  const reveal = room?.syncState?.lastReveal || fallback.reveal || {};
  recordDuelDiagnostic(battle, "turn_reveal", code, {
    roomId: String(room?.roomId || fallback.roomId || ""),
    round: Number(reveal?.round || fallback.round || 0),
    revealId: String(reveal?.revealId || fallback.revealId || "").slice(0, 80),
    requestId: String(errorOrResponse?.requestId || responseData?.requestId || fallback.requestId || "").slice(0, 80),
    code,
    turnId: String(room?.turnId || room?.turnState?.turnId || "").slice(0, 40),
    barrierMode: String(room?.syncState?.barrierMode || room?.turnState?.barrierMode || ""),
    revealStatus: String(reveal?.status || ""),
    receiptSides: Object.keys(reveal?.receipts || {}),
    inputHashPrefix: String(reveal?.inputHash || fallback.inputHash || "").slice(0, 16)
  });
  updateDuelActionAvailability(battle);
  return true;
}

function adoptOnlineRevealResponseSnapshot(battle, response = {}, side = "left") {
  const snapshot = response?.room || response?.snapshot || null;
  if (!battle || !snapshot?.roomId) return false;
  const previousRound = Number(battle.onlineRoomSnapshot?.round || battle.onlineRevealState?.round || 0);
  const nextRound = Number(snapshot?.round || snapshot?.syncState?.lastReveal?.round || 0);
  battle.onlineRoomSnapshot = clonePlain(snapshot);
  if (previousRound && nextRound && nextRound > previousRound) {
    battle.onlineRevealState = null;
    battle.onlineLastReveal = null;
    battle.onlineLastRevealResult = null;
  }
  syncOnlineRoomState(snapshot, side);
  return true;
}

function clearOnlineReceiptRecovery(battle) {
  const revealState = battle?.onlineRevealState;
  if (!revealState) return;
  if (revealState.receiptRecoveryTimer) globalThis.clearTimeout?.(revealState.receiptRecoveryTimer);
  revealState.receiptRecoveryTimer = 0;
}

function classifyTurnReceiptResponse(response = {}) {
  const data = response?.responseData || response || {};
  const code = String(data?.operationStatus?.code || data?.code || "").trim().toUpperCase();
  const known = new Set(["WAITING_TURN_RECEIPT", "TURN_RESOLVED", "REVEAL_ALREADY_RESOLVED", "TURN_OUTPUT_HASH_MISMATCH", "TURN_RESOLVE_TIMEOUT"]);
  return { code: known.has(code) ? code : (code || "UNKNOWN_SUCCESS_CODE"), detail: {
    round: Number(data?.round || data?.room?.round || 0),
    revealRound: Number(data?.revealRound || data?.syncState?.lastReveal?.round || 0),
    receiptSides: Array.isArray(data?.receiptSides) ? data.receiptSides.slice(0, 2) : Object.keys(data?.syncState?.lastReveal?.receipts || {}).slice(0, 2),
    barrierMode: String(data?.syncState?.barrierMode || data?.room?.syncState?.barrierMode || "")
  } };
}

function requestReceiptWaitingRecovery(battle, room = {}, side = "left", detail = {}) {
  const state = battle?.onlineRevealState;
  const roomId = String(room?.roomId || "");
  if (!state || !roomId || state.receiptWaitingRecoveryRequested === true) return;
  state.receiptWaitingRecoveryRequested = true;
  Promise.resolve(globalThis.JJKOnline?.getRoomState?.(roomId, { side, viewerSide: side }))
    .then((fresh) => {
      const snapshot = fresh?.room || fresh;
      if (snapshot?.roomId) adoptOnlineRevealResponseSnapshot(battle, snapshot, side);
    })
    .catch((error) => recordDuelDiagnostic(battle, "turn_receipt", "recovery_failed", {
      ...detail, code: "ONLINE_TURN_RECEIPT_RECOVERY_FAILED", message: String(error?.message || "GET_ROOM_FAILED").slice(0, 80)
    }));
}

function armOnlineReceiptRecovery(battle, room = {}, side = "left") {
  const revealState = battle?.onlineRevealState;
  const roomId = String(room?.roomId || "");
  if (!revealState || !roomId || revealState.receiptRecoveryArmed === true) return;
  revealState.receiptRecoveryArmed = true;
  revealState.receiptRecoveryTimer = globalThis.setTimeout?.(() => {
    if (battle?.onlineRevealState !== revealState || !["receipt_pending", "receipt_waiting"].includes(revealState.status) || revealState.receiptRecoveryAttempted === true) return;
    revealState.receiptRecoveryAttempted = true;
    revealState.receiptRecoveryTimer = 0;
    revealState.status = "receipt_timeout";
    revealState.lastError = "ONLINE_TURN_RECEIPT_TIMEOUT";
    battle.actionUiMessage = "结算异常，正在等待服务器权威状态。";
    const detail = {
      roomId,
      round: Number(revealState.round || room?.round || 0),
      revealId: String(revealState.revealId || "").slice(0, 80),
      requestId: String(revealState.receiptRequestId || "").slice(0, 80)
    };
    console.error("ONLINE_TURN_RECEIPT_TIMEOUT", detail);
    recordDuelDiagnostic(battle, "turn_receipt", "ONLINE_TURN_RECEIPT_TIMEOUT", detail);
    Promise.resolve(globalThis.JJKOnline?.getRoomState?.(roomId, { side, viewerSide: side }))
      .then((fresh) => {
        const snapshot = fresh?.room || fresh;
        if (snapshot?.roomId) adoptOnlineRevealResponseSnapshot(battle, snapshot, side);
      })
      .catch((error) => recordDuelDiagnostic(battle, "turn_receipt", "recovery_failed", {
        ...detail,
        code: String(error?.code || error?.message || "GET_ROOM_FAILED").slice(0, 80)
      }));
  }, 8000) || 0;
}

function retryPendingOnlineRevealReceipt(battle, room = {}, side = "left") {
  // Input-only V3 has no per-turn resolve receipt. Keep this compatibility
  // hook inert so stale state from an older runtime cannot issue a receipt.
  return false;
}

function applyOnlineSynchronizedRevealUnsafe(battle, room = {}, side = "left", options = {}) {
  const spectatorReplay = options?.spectator === true;
  recordDuelDiagnostic(battle, "turn_reveal", "received", {
    roomId: room?.roomId, side, round: room?.syncState?.lastReveal?.round,
    hasSeed: Boolean(room?.syncState?.lastReveal?.turnSeed),
    hasCommits: Boolean(room?.syncState?.lastReveal?.commits)
  });
  if (!battle || !isClientSynchronizedOnlineRoom(room)) return false;
  const reveal = room.syncState?.lastReveal;
  const revealRound = Number(reveal?.round || 0);
  const currentRound = Number(room?.round || room?.syncState?.currentRound || 0);
  const sharedRevealFreshness = globalThis.JJKOnlineTurnPresentation?.getOnlineRevealFreshness?.(room);
  const inputOnlyPostAdvanceReveal = String(room?.syncProtocolVersion || "") === "reveal-ack-input-only-v3" &&
    revealRound > 0 && currentRound > 0 && revealRound === currentRound - 1;
  const fallbackRevealFreshness = revealRound > currentRound
    ? "future"
    : (!inputOnlyPostAdvanceReveal && (
      room?.syncState?.lastRevealIsStale === true ||
      Number(room?.syncState?.lastRevealRound || revealRound) < currentRound ||
      revealRound < currentRound
    )) ? "stale" : "current";
  const revealFreshness = sharedRevealFreshness || fallbackRevealFreshness;
  if (revealFreshness === "stale") {
    battle.onlineStaleRevealIgnored = `${room.roomId || ""}:${revealRound}:${currentRound}`;
    return false;
  }
  if (revealFreshness === "future") {
    battle.onlineSyncBlocked = true;
    battle.onlineSyncBlockedReason = "REVEAL_ROUND_AHEAD";
    battle.actionUiMessage = "服务器回合状态异常，请重新拉取房间状态。";
    recordDuelDiagnostic(battle, "sync_blocked", "reveal_round_ahead", {
      roomId: String(room?.roomId || "").slice(0, 12), round: currentRound, revealRound
    });
    return false;
  }
  const serverBattleSeed = String(room?.battleSeed || room?.battleState?.battleSeed || "").trim();
  if (!reveal || !Number.isFinite(Number(reveal.round)) || !reveal.turnSeed || !serverBattleSeed) {
    battle.onlineSyncBlocked = true;
    battle.onlineSyncBlockedReason = !serverBattleSeed ? "BATTLE_SEED_REQUIRED" : "TURN_SEED_REQUIRED";
    battle.actionUiMessage = !serverBattleSeed ? "服务器战斗种子未同步，正在恢复房间状态。" : "服务器回合种子未同步，正在恢复房间状态。";
    recordDuelDiagnostic(battle, "sync_blocked", battle.onlineSyncBlockedReason, { roomId: String(room?.roomId || "").slice(0, 12) });
    updateDuelActionAvailability(battle);
    return false;
  }
  const authoritativeInitiative = reveal?.initiative;
  const authoritativeInitiativeHash = String(reveal?.initiativeHash || "").trim();
  if (!authoritativeInitiative || !["left", "right"].includes(String(authoritativeInitiative.firstSide || "")) || !authoritativeInitiativeHash) {
    battle.onlineSyncBlocked = true;
    battle.onlineSyncBlockedReason = "INITIATIVE_STATE_MISSING";
    battle.onlineInitiativeHash = "";
    battle.actionUiMessage = "服务器先后手尚未同步，正在恢复房间状态。";
    recordDuelDiagnostic(battle, "sync_blocked", "INITIATIVE_STATE_MISSING", {
      roomId: String(room?.roomId || "").slice(0, 12), round: revealRound,
      hasInitiative: Boolean(authoritativeInitiative), hasInitiativeHash: Boolean(authoritativeInitiativeHash)
    });
    updateDuelActionAvailability(battle);
    return false;
  }
  const round = Math.max(1, Number(reveal.round));
  const adapter = globalThis.JJKOnlineDuelSync;
  if (Number(battle.onlineResolvedRevealRound || battle.onlineLastRevealRound || 0) >= round) {
    retryPendingOnlineRevealReceipt(battle, room, side);
    return false;
  }
  const inputOnlyV3 = String(room?.syncProtocolVersion || "") === "reveal-ack-input-only-v3";
  const usesRevealAck = inputOnlyV3 && typeof adapter?.buildOnlineTurnRevealAck === "function";
  const barrierMode = String(room?.syncState?.barrierMode || room?.turnState?.barrierMode || "");
  const usesRevealBarrier = String(room?.syncProtocolVersion || "") !== "reveal-ack-input-only-v3";
  const enforceRevealBarrier = usesRevealBarrier && barrierMode === "enforce";
  const commits = reveal.commits || {};
  if (usesRevealBarrier && barrierMode === "enforce" && reveal.status === "published" && !reveal.acknowledgements) return false;
  const findSelections = (commit, actorSide) => {
    const actor = actorSide === "right" ? battle.resourceState?.p2 : battle.resourceState?.p1;
    const opponent = actorSide === "right" ? battle.resourceState?.p1 : battle.resourceState?.p2;
    const hand = Array.isArray(battle.handState?.[actorSide]?.cards) ? battle.handState[actorSide].cards : [];
    // The opponent's private hand is intentionally not sent to this client.
    // Rebuild the same deterministic candidate pool from the frozen profile so
    // the revealed action id can enter the normal hand execution path.
    const generated = buildDuelActionPool(actor, opponent, battle);
    const domain = pickDuelDomainHandCandidates(actor, opponent, battle, 12);
    const source = [];
    const seen = new Set();
    for (const candidate of [...hand, ...(Array.isArray(generated) ? generated : []), ...(Array.isArray(domain) ? domain : [])]) {
      const id = String(candidate?.actionId || candidate?.action?.id || candidate?.id || candidate?.cardId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      source.push(candidate);
    }
    const adapter = globalThis.JJKOnlineDuelSync;
    let resolved;
    if (typeof adapter?.resolveSynchronizedCommitActions === "function") {
      resolved = adapter.resolveSynchronizedCommitActions(commit, source);
    } else {
      resolved = (Array.isArray(commit?.actions) ? commit.actions : []).map((entry) => source.find((candidate) => {
      const actionId = String(candidate?.actionId || candidate?.action?.id || candidate?.id || "");
      const instanceId = String(candidate?.cardInstanceId || candidate?.instanceId || candidate?.action?.cardInstanceId || "");
      return (entry.actionId && entry.actionId === actionId) || (entry.cardInstanceId && entry.cardInstanceId === instanceId);
      })).filter(Boolean);
    }
    // resolveDuelHandTurn consumes canonical selection entries and filters by
    // the current turn. Re-wrap rebuilt candidates so synchronized reveals
    // enter the same execution path as local hand selections.
    const actions = Array.isArray(commit?.actions) ? commit.actions : [];
    return (Array.isArray(resolved) ? resolved : []).map((candidate, index) => {
      const action = candidate?.action || candidate;
      const committed = actions[index] || {};
      return {
        id: String(candidate?.id || candidate?.actionId || action?.id || committed.actionId || ""),
        actionId: String(candidate?.actionId || action?.id || committed.actionId || ""),
        cardInstanceId: String(candidate?.cardInstanceId || candidate?.instanceId || committed.cardInstanceId || ""),
        label: candidate?.label || action?.label || action?.name || action?.id || "同步手札",
        action,
        source: "online-turn-reveal",
        status: "CANDIDATE",
        selectedRound: round,
        side: actorSide
      };
    }).filter((entry) => entry.action?.id || entry.actionId);
  };
  const leftSelections = findSelections(commits.left, "left");
  const rightSelections = findSelections(commits.right, "right");
  const transportOnlyMode = room?.transportValidationMode === "transport-only-v1";
  const leftCapabilityStatus = typeof adapter?.getOnlineTurnCapabilitiesStatus === "function"
    ? adapter.getOnlineTurnCapabilitiesStatus(room, "left")
    : { code: "TURN_CAPABILITIES_MISSING", capabilities: adapter?.getOnlineTurnCapabilities?.(room, "left") || null };
  const rightCapabilityStatus = typeof adapter?.getOnlineTurnCapabilitiesStatus === "function"
    ? adapter.getOnlineTurnCapabilitiesStatus(room, "right")
    : { code: "TURN_CAPABILITIES_MISSING", capabilities: adapter?.getOnlineTurnCapabilities?.(room, "right") || null };
  const leftCapabilities = leftCapabilityStatus.capabilities;
  const rightCapabilities = rightCapabilityStatus.capabilities;
  if (!transportOnlyMode && (!leftCapabilities || !rightCapabilities)) {
    const capabilityCode = !leftCapabilities ? leftCapabilityStatus.code : rightCapabilityStatus.code;
    battle.onlineSyncBlocked = true;
    battle.onlineSyncBlockedReason = capabilityCode || "TURN_CAPABILITIES_MISSING";
    battle.actionUiMessage = battle.onlineSyncBlockedReason === "ROOM_PROTOCOL_MISMATCH"
      ? "房间协议已失效，请重新匹配。"
      : battle.onlineSyncBlockedReason === "TURN_CAPABILITIES_MISMATCH"
        ? "双方联机能力不一致，正在重新同步房间状态。"
        : "联机能力字段缺失，正在重新同步房间状态。";
    return false;
  }
  const leftCount = transportOnlyMode ? { ok: true } : typeof adapter?.validateOnlineActionCount === "function"
    ? adapter.validateOnlineActionCount(leftSelections, leftCapabilities)
    : { ok: true };
  const rightCount = transportOnlyMode ? { ok: true } : typeof adapter?.validateOnlineActionCount === "function"
    ? adapter.validateOnlineActionCount(rightSelections, rightCapabilities)
    : { ok: true };
  const validation = typeof adapter?.validateSynchronizedRevealSelections === "function"
    ? adapter.validateSynchronizedRevealSelections(reveal, {
      left: leftSelections,
      right: rightSelections,
      initiativeInvestment: {
        [side]: Number(battle.initiativeInvestmentSelections?.[side])
      },
      rulesetRevision: String(battle.onlineRulesetRevision || room.rulesetRevision || ""),
      rulesetHash: String(battle.onlineRulesetHash || room.rulesetHash || ""),
      characterSnapshotHash: String(reveal?.characterSnapshotHash || battle.onlineCharacterSnapshotHash || "").trim()
    })
    : { ok: false, missingActionIds: { left: [], right: [] } };
  battle.onlineRevealState = {
    revealId: String(reveal.revealId || ""), round, status: String(reveal.status || "published"),
    inputHash: String(reveal.inputHash || ""), outputHash: "", ackRequestId: "", receiptRequestId: "", lastError: "",
    acknowledgements: clonePlain(reveal.acknowledgements || {}), receipts: clonePlain(reveal.receipts || {}), receiptPayload: null
  };
  const sendRevealAck = (currentValidation) => {
    if (spectatorReplay || !usesRevealAck) return;
    const acknowledgement = adapter.buildOnlineTurnRevealAck({ roomId: room.roomId, side, reveal, validation: currentValidation });
    battle.onlineRevealState.ackRequestId = String(acknowledgement.requestId || "");
    globalThis.JJKOnline?.acknowledgeTurnReveal?.(room.roomId, acknowledgement.payload, { side, requestId: acknowledgement.requestId })
      ?.then?.((response) => {
        adoptOnlineRevealResponseSnapshot(battle, response, side);
        freezeOnlineRevealFromResponse(battle, response, { room, round, reveal, requestId: acknowledgement.requestId });
      })
      ?.catch?.((error) => {
        if (freezeOnlineRevealFromResponse(battle, error, { room, round, reveal, requestId: acknowledgement.requestId })) return;
        battle.onlineRevealState.lastError = error?.code || error?.message || "TURN_REVEAL_ACK_FAILED";
      });
  };
  if (!leftCount.ok || !rightCount.ok) {
    const countError = !leftCount.ok ? leftCount : rightCount;
    battle.onlineRevealState = { revealId: String(reveal.revealId || ""), round, status: "blocked", inputHash: String(reveal.inputHash || ""), outputHash: "", ackRequestId: "", receiptRequestId: "", lastError: "ACTION_COUNT_EXCEEDED" };
    console.error("ONLINE_TURN_RESOLVE_FAILED", { roomId: String(room?.roomId || ""), round, revealId: String(reveal?.revealId || "").slice(0, 80), code: "ACTION_COUNT_EXCEEDED", receivedActionCount: countError.received, effectiveMaxActionsPerTurn: countError.max });
    recordDuelDiagnostic(battle, "turn_resolve", "ACTION_COUNT_EXCEEDED", { roomId: String(room?.roomId || ""), round, revealId: String(reveal?.revealId || "").slice(0, 80), receivedActionCount: countError.received, effectiveMaxActionsPerTurn: countError.max });
    battle.actionUiMessage = `服务器行动超过本回合上限（${countError.received}/${countError.max}），已暂停同步。`;
    updateDuelActionAvailability(battle);
    return false;
  }
  if (!validation.ok) {
    battle.onlineRevealState.status = "blocked";
    battle.onlineRevealState.lastError = validation.code || "CLIENT_REVEAL_INCOMPLETE";
    recordDuelDiagnostic(battle, "turn_reveal", validation.code || "CLIENT_REVEAL_INCOMPLETE", {
      roomId: String(room?.roomId || ""), round, revealId: String(reveal?.revealId || "").slice(0, 80),
      requestId: String(battle.onlineRevealState.ackRequestId || "").slice(0, 80), code: validation.code || "REVEAL_INCOMPLETE",
      inputHashPrefix: String(reveal?.inputHash || "").slice(0, 16)
    });
    // An invalid local reconstruction is diagnostic-only. Sending an
    // invalid ACK creates a guaranteed 409 and repeats on every poll.
    battle.actionUiMessage = "服务器行动无法完整还原，已暂停本回合同步。";
    updateDuelActionAvailability(battle);
    return false;
  }
  sendRevealAck(validation);
  // Input-only V3 ACK confirms receipt and local validation; it never blocks
  // the next turn on a per-turn resolve receipt.
  // Candidate reconstruction and private-hand maintenance may consume random
  // values. Reset immediately before execution so both clients start the
  // actual turn resolver at the same deterministic RNG position.
  if (typeof adapter?.createOnlineSeededRng === "function") {
    adapter.resetOnlineTurnRandomScope?.(battle.onlineRandomCounters ||= {}, room.roomId, round);
    battle.rng = adapter.createOnlineSeededRng(room.roomId, round, reveal.turnSeed);
    battle.onlineTurnSeed = String(reveal.turnSeed);
    // Hash-based hit/evasion paths read onlineBattleSeed before battle.rng.
    // Keep that seed on the reveal too, otherwise each client falls back to
    // its locally generated battle.seed and can resolve different outcomes.
    battle.onlineBattleSeed = String(room?.battleSeed || room?.battleState?.battleSeed || "");
    battle.onlineTurnRngKey = `${room.roomId}:${round}:${reveal.turnSeed}`;
  }
  battle.selectedHandActions = { left: leftSelections, right: rightSelections };
  battle.initiativeInvestmentSelections = {
    left: Number(commits.left?.initiativeInvestment || 0),
    right: Number(commits.right?.initiativeInvestment || 0)
  };
  const tactics = typeof adapter?.mapSynchronizedTactics === "function"
    ? adapter.mapSynchronizedTactics(commits)
    : { leftTactic: String(commits.left?.tacticId || "balanced"), rightTactic: String(commits.right?.tacticId || "balanced") };
  battle.selectedTactic = tactics.leftTactic;
  battle.opponentTactic = tactics.rightTactic;
  if (authoritativeInitiative?.firstSide === "left" || authoritativeInitiative?.firstSide === "right") {
    battle.initiativeState = clonePlain(authoritativeInitiative);
    battle.onlineInitiativeHash = authoritativeInitiativeHash;
    battle.initiativeHistory ||= [];
    if (Number(battle.initiativeHistory[0]?.round || 0) !== round) battle.initiativeHistory.unshift(clonePlain(authoritativeInitiative));
    battle.initiativeHistory = battle.initiativeHistory.slice(0, 30);
  }
  battle.round = Math.max(Number(battle.round || 0), round - 1);
  const beforeMemoSnapshot = snapshotDuelMemoState(battle);
  const result = resolveDuelHandTurn(battle, {
    autoPickCpu: false,
    firstSide: authoritativeInitiative.firstSide
  });
  ensureOnlineDomainPanelState(battle);
  const leftResult = result?.left || { applied: false, actions: [], results: [] };
  const rightResult = result?.right || { applied: false, actions: [], results: [] };
  battle.lastRoundMemo = buildDuelRoundMemo(
    battle,
    beforeMemoSnapshot,
    snapshotDuelMemoState(battle),
    leftResult,
    rightResult
  );
  battle.lastRoundMemo.round = round;
  if (authoritativeInitiative) battle.lastRoundMemo.initiative = clonePlain(authoritativeInitiative);
  battle.resourceState.lastRoundMemo = clonePlain(battle.lastRoundMemo);
  if (result?.ok) {
    recordDuelResourceChange(battle, {
      side: "neutral",
      title: `联机回合纪要 R${round}`,
      detail: `${battle.lastRoundMemo.leftDelta || ""} ${battle.lastRoundMemo.rightDelta || ""}`.trim() || "本回合已完成同步结算。",
      type: "system",
      delta: {
        leftMitigation: clonePlain(battle.lastRoundMemo.leftMitigation || null),
        rightMitigation: clonePlain(battle.lastRoundMemo.rightMitigation || null)
      }
    });
    battle.resourceLog = battle.resourceState.resourceLog;
    battle.residualLog = battle.resourceState.residualLog;
  }
  recordDuelDiagnostic(battle, "turn_resolve", result?.ok ? "success" : "failed", {
    round, result: result?.summary || result?.reason || "", selectedLeft: leftSelections.length,
    selectedRight: rightSelections.length, rngSeeded: typeof battle.rng === "function",
    committedLeft: Array.isArray(commits.left?.actions) ? commits.left.actions.length : 0,
    committedRight: Array.isArray(commits.right?.actions) ? commits.right.actions.length : 0
  });
  if (!result?.ok) {
    battle.onlineRevealState.status = "blocked";
    battle.onlineRevealState.lastError = "CLIENT_TURN_RESOLVE_FAILED";
    recordDuelDiagnostic(battle, "turn_resolve", "CLIENT_TURN_RESOLVE_FAILED", { roomId: room?.roomId, round, reason: result?.reason || "" });
    battle.actionUiMessage = "本回合结算未完成，正在等待服务器权威状态。";
    updateDuelActionAvailability(battle);
    return false;
  }
  // Keep CE recovery and terminal checks on the same runtime hooks used by
  // local rounds; the server never supplies resource snapshots for v3 rooms.
  if (result?.ok) {
    applyDuelRoundResourceRegen(battle.resourceState?.p1, battle, "left");
    applyDuelRoundResourceRegen(battle.resourceState?.p2, battle, "right");
    maybeResolveDuelBattleAfterHandActions(battle);
    // V3 players still publish a sanitized local frame for spectators. This
    // is presentation data only; the next player turn remains reveal-driven.
    if (!usesRevealBarrier) reportOnlineAuthoritativeTurnState(battle, room, round);
  }
  // Mark local execution separately. The durable reveal marker advances only
  // after the receipt succeeds, so a failed receipt cannot look authoritative.
  battle.onlineResolvedRevealRound = round;
  battle.onlineLastReveal = clonePlain(reveal);
  battle.onlineLastRevealResult = clonePlain(result);
  battle.round = Math.max(Number(battle.round || 0), round);
  battle.resourceState.round = battle.round;
  battle.actionUiMessage = `第 ${round} 回合已按服务器种子同步结算。`;
  // Input-only V3 has no per-turn output receipt or receipt recovery timer.
  if (!usesRevealBarrier) battle.onlineLastRevealRound = round;
  updateDuelActionAvailability(battle);
  return true;
}

function applyOnlineSynchronizedReveal(battle, room = {}, side = "left", options = {}) {
  try {
    return applyOnlineSynchronizedRevealUnsafe(battle, room, side, options);
  } catch (error) {
    const code = String(error?.code || "CLIENT_TURN_RESOLVE_FAILED").slice(0, 80);
    console.error("ONLINE_TURN_RESOLVE_FAILED", { roomId: String(room?.roomId || "").slice(0, 12), round: Number(room?.round || 0), code });
    recordDuelDiagnostic(battle, "sync_blocked", code, {
      roomId: String(room?.roomId || "").slice(0, 12),
      round: Number(room?.round || 0),
      turnId: String(room?.turnState?.turnId || "").slice(0, 80)
    });
    if (battle && typeof battle === "object") {
      battle.onlineSyncBlocked = true;
      battle.onlineSyncBlockedReason = code;
      battle.onlineRevealState ||= {};
      battle.onlineRevealState.status = "blocked";
      battle.onlineRevealState.lastError = code;
      battle.actionUiMessage = "本回合本地结算失败，正在恢复房间状态。";
      updateDuelActionAvailability(battle);
    }
    return false;
  }
}

function applyOnlinePrivateHandState(battle, room = {}, side = "left") {
  const privateState = room?.privateState;
  const privateSide = privateState?.side === "right" ? "right" : privateState?.side === "left" ? "left" : "";
  if (!battle || !privateSide || privateSide !== side || !Array.isArray(privateState?.handState?.cards)) return false;
  const privateHandSignature = [
    Number(privateState.revision || privateState.handState?.handRevision || 0),
    Number(privateState.handState?.pendingDiscardCount || 0),
    ...privateState.handState.cards.map((card) => String(card?.cardInstanceId || card?.actionId || card?.id || "")),
    Number(privateState.domainHandState?.round || 0),
    ...(privateState.domainHandState?.cards || []).map((card) => String(card?.cardInstanceId || card?.actionId || card?.id || ""))
  ].join("|");
  if (battle.onlinePrivateHandSignature === privateHandSignature) return false;
  battle.handState ||= {};
  battle.handState[side] = clonePlain(privateState.handState);
  battle.handState[side].cards = battle.handState[side].cards.map((card) => ({
    ...card,
    cardInstanceId: String(card?.cardInstanceId || "")
  }));
  battle.actionChoices = battle.handState[side].cards;
  battle.handCandidates = battle.handState[side].cards;
  if (Array.isArray(privateState.domainHandState?.cards)) {
    battle.domainHandState ||= {};
    battle.domainHandState[side] = clonePlain(privateState.domainHandState);
    battle.domainHandState[side].cards = battle.domainHandState[side].cards.map((card) => ({
      ...card,
      cardInstanceId: String(card?.cardInstanceId || "")
    }));
    battle.domainHandCandidates = battle.domainHandState[side].cards;
  }
  battle.onlinePrivateHandRevision = Math.max(0, Number(privateState.revision || privateState.handState?.handRevision || 0));
  battle.onlinePrivateHandSignature = privateHandSignature;
  battle.onlineAuthoritativePrivateHand = Number(room?.battleApiVersion || 0) >= 2 && !isClientSynchronizedOnlineRoom(room);
  battle.onlineAuthoritativePrivateHandSide = battle.onlineAuthoritativePrivateHand ? side : "";
  clearDuelSelectedHandActions(battle, side, { refund: false, preserveResolved: true });
  battle.pendingAction = null;
  updateDuelActionAvailability(battle);
  updateDuelResourceReplayKey(battle);
  return true;
}

function syncOnlineRoomState(room = {}, playerSide = state.duelModeState.playerSide || "left") {
  const battle = state.duelBattle;
  recordDuelDiagnostic(battle, "room_sync", "received", {
    roomId: room?.roomId, phase: room?.phase, round: room?.round,
    authority: room?.simulationAuthority, apiVersion: room?.battleApiVersion,
    hasReveal: Boolean(room?.syncState?.lastReveal)
  });
  if (!battle || battle.mode !== "online" || !room?.roomId) return null;
  const previousOnlineTurnId = String(battle.onlineRoomSnapshot?.turnState?.turnId || "");
  const nextOnlineTurnId = String(room?.turnState?.turnId || "");
  battle.onlineRoomSnapshot = clonePlain(room);
  if (previousOnlineTurnId && nextOnlineTurnId && previousOnlineTurnId !== nextOnlineTurnId) {
    battle.onlineLocalTurnTimer = null;
    battle.onlineLocalTurnPassRequestId = "";
  }
  syncOnlineTurnDeadlineRenderTimer();
  const roomId = String(room.roomId || "");
  if (battle.onlineRoomId && battle.onlineRoomId !== roomId) return battle;
  restoreOnlineSettlementState(roomId, battle);
  const serverResult = room.reviewState?.competitionResult || {};
  const sharedPointsDetector = globalThis.JJKOnline?.isPointsCompetitionRoom;
  const isPointsRoom = typeof sharedPointsDetector === "function"
    ? sharedPointsDetector(room)
    : Boolean(room.competitionRoom && ["points", "ranked", "积分赛", "culling-season-2-qualifier", "culling-season-2-playoffs"].includes(String(room.competitionType || room.competitionFormat || "").trim().toLowerCase()));
  recordDuelDiagnostic(battle, "room_type_detected", isPointsRoom ? "points" : "non_points", {
    roomTypeDetected: isPointsRoom ? "points" : "other",
    competitionTypeDetected: String(room.competitionType || room.competitionFormat || ""),
    rankedMatchIdPresent: Boolean(room.rankedMatchId)
  });
  const terminalSettlement = isPointsRoom && hasAuthoritativeOnlineTerminalResult(room);
  if (terminalSettlement) {
    battle.resolved = true;
    battle.winnerSide ||= serverResult.winnerSide || room.winnerSide || "draw";
    battle.onlineSettlementKey ||= serverResult.settlementKey || `${room.rankedSeasonId || "points"}:${roomId}`;
    battle.onlineResultRequestId ||= serverResult.resultRequestId || `resultCommit:${roomId}:${battle.battleId || battle.endingRound || room.round || "resolved"}`;
    battle.onlineSettlementStatus = getOnlineSettlementStatus({ room });
    const reconciledByWinnerSnapshot = String(serverResult.reconciledBy || "") === "winner_snapshot" ||
      String(serverResult.stateHashComparison || "") === "mismatch_reconciled";
    const retrySettlement = reconciledByWinnerSnapshot
      ? () => globalThis.JJKOnline?.reconcileResultConflict?.(roomId, playerSide, {
          reasonCode: "RESULT_STATE_DIVERGED",
          settlementKey: battle.onlineSettlementKey,
          resultRequestId: battle.onlineResultRequestId
        })
      : () => reportOnlineCompetitionBattleResult(battle, room, playerSide);
    showOnlineSettlementModal({ battle, room, side: playerSide, status: battle.onlineSettlementStatus, settlementKey: battle.onlineSettlementKey, resultRequestId: battle.onlineResultRequestId, retry: retrySettlement });
  }
  if (serverResult.locked && (serverResult.settlementKey || serverResult.pointsSettlementStatus || serverResult.settlementStatus)) {
    battle.onlineSettlementKey = String(serverResult.settlementKey || battle.onlineSettlementKey || `${room.rankedSeasonId || "points"}:${roomId}`);
    battle.onlineResultRequestId = String(serverResult.resultRequestId || battle.onlineResultRequestId || "");
    battle.onlineSettlementStatus = getOnlineSettlementStatus({ room });
    // Keep the settled result modal visible so the winner and final point state
    // remain explicit; the modal enables exit only after authoritative settle.
  }
  if (room.phase === "reviewing" && !hasAuthoritativeOnlineTerminalResult(room)) {
    battle.onlineSyncBlocked = true;
    battle.onlineSyncBlockedReason = String(room?.syncState?.errorCode || "REVIEWING_WITHOUT_TERMINAL_RESULT");
    battle.resolved = false;
    battle.battleEnded = false;
    battle.actionUiMessage = "正在恢复回合同步，请稍候。";
    const diagnosticKey = [roomId, room.round, room.turnId || room.turnState?.turnId || "", battle.onlineSyncBlockedReason].join(":");
    if (battle.onlineSyncBlockedDiagnosticKey !== diagnosticKey) {
      battle.onlineSyncBlockedDiagnosticKey = diagnosticKey;
      console.warn("ONLINE_SYNC_BLOCKED", { roomId: String(roomId).slice(0, 12), round: Number(room.round || 0), code: battle.onlineSyncBlockedReason });
      recordDuelDiagnostic(battle, "sync_blocked", "entered", {
      roomId: String(roomId).slice(0, 12),
      round: Number(room.round || 0),
      turnId: String(room.turnId || room.turnState?.turnId || "").slice(0, 40),
      phase: String(room.phase || ""),
      turnPhase: String(room.turnState?.phase || ""),
      barrierMode: String(room.syncState?.barrierMode || room.turnState?.barrierMode || ""),
      revealStatus: String(room.syncState?.lastReveal?.status || ""),
      receiptSides: Object.keys(room.syncState?.lastReveal?.receipts || {})
      });
    }
  } else if (room.phase === "sync_blocked") {
    battle.onlineSyncBlocked = true;
    battle.onlineSyncBlockedReason = String(room?.syncState?.errorCode || "SYNC_BLOCKED");
    battle.resolved = false;
    battle.battleEnded = false;
    battle.actionUiMessage = "正在恢复回合同步，请稍候。";
    const recoveryCode = String(battle.onlineSyncBlockedReason || "CLIENT_TURN_RESOLVE_FAILED");
    const recoveryRound = Math.max(1, Number(room.round || 1));
    const recoveryKey = `${roomId}:${recoveryRound}:${String(room.syncState?.lastReveal?.revealId || "")}:${recoveryCode}`;
    if (battle.onlineSyncRecoveryDiagnosticKey !== recoveryKey) {
      battle.onlineSyncRecoveryDiagnosticKey = recoveryKey;
      const localSide = playerSide === "right" ? "right" : "left";
      const recover = recoveryCode === "RESULT_STATE_DIVERGED"
        ? globalThis.JJKOnline?.reconcileResultConflict
        : globalThis.JJKOnline?.syncRecovery;
      if (typeof recover === "function") {
        Promise.resolve(recover(roomId, localSide, {
          knownRound: recoveryRound,
          knownTurnId: room.turnState?.turnId || room.turnId,
          knownRevealId: room.syncState?.lastReveal?.revealId,
          knownPhase: "sync_blocked",
          reasonCode: recoveryCode,
          diagnosticKey: recoveryKey
        }))
          .then((response) => {
            const recoveredRoom = response?.room || response?.snapshot || response;
            if (recoveredRoom?.roomId) adoptOnlineRevealResponseSnapshot(battle, { room: recoveredRoom }, localSide);
          })
          .catch((error) => {
            const responseRoom = error?.responseData?.room || error?.responseData?.snapshot;
            if (responseRoom?.roomId) adoptOnlineRevealResponseSnapshot(battle, { room: responseRoom }, localSide);
            recordDuelDiagnostic(battle, "sync_blocked", recoveryCode === "RESULT_STATE_DIVERGED" ? "result_reconcile_failed" : "recovery_failed", {
              roomId: String(roomId).slice(0, 12), round: recoveryRound,
              code: String(error?.code || error?.message || "SYNC_RECOVERY_FAILED").slice(0, 100)
            });
          });
      }
    }
  }
  if ((room.phase === "reviewing" && hasAuthoritativeOnlineTerminalResult(room)) || room.phase === "ended") {
    clearOnlineTemporaryCustomDuelCards(roomId);
  }
  const side = playerSide === "right" ? "right" : "left";
  const spectatorMode = playerSide === "spectator";
  const dounaOnlineBattle = Boolean(battle.dounaGauntlet?.online || room.mode === "douna" || room.teamMode === "douna_gauntlet");
  const localLocked = !dounaOnlineBattle && ["turn_selecting", "turn_resolving"].includes(room.phase) && Boolean(room.turnState?.locks?.[side] || room.localPendingLock);
  const serverRound = Math.max(1, Number(room.round) || 1);
  const targetBattleRound = Math.max(0, serverRound - 1);
  const previousRound = battle.round;
  const activePage = getBattlePageModule()?.getBattlePageState?.().activePage || state.duelModeState.activePage || "online";
  const syncKey = buildOnlineRoomRuntimeSyncKey(room, playerSide);
  const sameRuntimeSync = syncKey && battle.onlineLastRoomRuntimeSyncKey === syncKey;
  if (battle.onlineStateLost) {
    battle.actionUiMessage = "本地联机战斗状态已丢失，无法从服务器恢复；请结束本局并重新开始。";
    battle.onlineCannotContinue = true;
    requestDuelInteractionRender("#duelBattle");
    return battle;
  }
  if (sameRuntimeSync) {
    battle.onlineRoomId = roomId;
    battle.onlinePlayerSide = spectatorMode ? "spectator" : side;
    setDuelBattleMode("online", {
      activeBattleId: battle.battleId,
      activeRoomId: roomId,
      playerSide: spectatorMode ? "spectator" : side,
      localLocked: localLocked || battle.onlineCannotContinue,
      activePage
    });
    if (!localLocked && room.phase === "turn_selecting" && /正在(?:提交|发送)联机行动/.test(String(battle.actionUiMessage || ""))) {
      battle.actionUiMessage = "服务器已同步，请选择或锁定本回合手札。";
      requestDuelInteractionRender("#duelBattle");
    }
    return battle;
  }
  battle.onlineLastRoomRuntimeSyncKey = syncKey;
  battle.onlineRoomId = roomId;
  battle.onlinePlayerSide = spectatorMode ? "spectator" : side;
  setDuelBattleMode("online", {
    activeBattleId: battle.battleId,
    activeRoomId: roomId,
    playerSide: spectatorMode ? "spectator" : side,
    localLocked: localLocked || battle.onlineCannotContinue,
    activePage
  });
  const appliedDounaAuthoritativeState = dounaOnlineBattle
    ? applyOnlineAuthoritativeResourceState(battle, room)
    : (spectatorMode && room.battleState?.resourceState
      ? applyOnlineAuthoritativeResourceState(battle, room)
      : false);
  const appliedFinalState = applyOnlineOwnerFinalState(battle, room);
  const appliedSpectatorState = spectatorMode
    ? applyOnlineSpectatorAuthoritativeState(battle, room)
    : false;
  const appliedSynchronizedReveal = spectatorMode
    ? ((!room.battleState?.resourceState?.p1 || !room.battleState?.resourceState?.p2) && hasPublicSpectatorRevealInputs(room)
      ? applyOnlineSynchronizedReveal(battle, room, side, { spectator: true })
      : false)
    : applyOnlineSynchronizedReveal(battle, room, side);
  if (appliedSpectatorState) {
    battle.pendingAction = null;
    battle.currentAction = battle.currentActions?.[0] || null;
    battle.cpuAction = battle.cpuActions?.[0] || null;
  } else if (appliedSynchronizedReveal) {
    battle.pendingAction = null;
    battle.currentAction = battle.currentActions?.[0] || null;
    battle.cpuAction = battle.cpuActions?.[0] || null;
  } else if (targetBattleRound > battle.round && !isClientSynchronizedOnlineRoom(room)) {
    const appliedResolvedTurn = applyOnlineResolvedTurnToBattle(battle, room, side);
    if (!appliedResolvedTurn || battle.round < targetBattleRound) battle.round = targetBattleRound;
    if (battle.resourceState) battle.resourceState.round = battle.round;
    if (!spectatorMode) clearDuelSelectedHandActions(battle, side, { refund: false });
    battle.pendingAction = null;
    battle.currentAction = null;
    battle.currentActions = [];
    battle.cpuAction = null;
    battle.cpuActions = [];
    battle.actionChoices = [];
    battle.handCandidates = [];
    updateDuelActionAvailability(battle);
    battle.actionUiMessage = getActiveDuelHandLockMessage(battle, side) || `服务器已进入第 ${serverRound} 回合，请选择本回合手札。`;
  } else if (appliedFinalState) {
    battle.actionUiMessage = battle.resolutionReason || "房主侧已确认胜负，联机对战结束。";
  } else if (appliedDounaAuthoritativeState && room.phase === "turn_selecting") {
    battle.actionUiMessage = getActiveDuelHandLockMessage(battle, side) || `服务器已恢复第 ${serverRound} 回合的斗傩权威战局。`;
  } else if (room.phase === "turn_resolving") {
    battle.actionUiMessage = "双方已锁定，服务器正在同步结算。";
  } else if (localLocked) {
    battle.actionUiMessage = "行动已锁定，等待对方锁定或服务器结算。";
  } else if (battle.actionUiMessage === "正在提交联机行动..." || battle.actionUiMessage === "正在发送联机行动...") {
    battle.actionUiMessage = previousRound !== battle.round ? "" : "服务器已同步，请选择或锁定本回合手札。";
  }
  if (!spectatorMode && !isClientSynchronizedOnlineRoom(room)) applyOnlinePrivateHandState(battle, room, side);
  const onlineCompetitionType = String(room.competitionType || room.competitionFormat || "").trim().toLowerCase();
  const isPointsCompetition = ["points", "ranked", "积分赛", "culling-season-2-qualifier", "culling-season-2-playoffs"].includes(onlineCompetitionType);
  if (room.competitionRoom && isPointsCompetition && battle.resolved && !battle.onlineCompetitionResultReported) {
    battle.onlineCompetitionResultReported = true;
    battle.onlineCompetitionResultPromise = reportOnlineCompetitionBattleResult(battle, room, playerSide).catch((error) => {
      const message = globalThis.JJKOnlineDuelSync?.formatOnlineResultCommitFailure?.(error) || "比赛结果同步失败。";
      battle.onlineResultCommitError = message;
      battle.actionUiMessage = message;
      requestDuelInteractionRender("#duelBattle");
      return null;
    }).finally(() => {
      battle.onlineCompetitionResultPromise = null;
    });
  }
  requestDuelInteractionRender("#duelBattle");
  return battle;
}

async function reportOnlineCompetitionBattleResult(battle, room = {}, playerSide = "") {
  const competitionType = String(room.competitionType || room.competitionFormat || "").trim().toLowerCase();
  if (!battle?.resolved || !room?.competitionRoom || !room?.roomId || !["points", "ranked", "积分赛", "culling-season-2-qualifier", "culling-season-2-playoffs"].includes(competitionType)) return null;
  if (playerSide === "spectator" || battle.onlinePlayerSide === "spectator") return null;
  const side = playerSide === "right" ? "right" : playerSide === "left" ? "left" : (battle.onlinePlayerSide === "right" ? "right" : "left");
  const seasonId = String(room.rankedSeasonId || room.seasonId || globalThis.JJKLoginCard?.getCompetitionIdentity?.()?.seasonId || "points").trim() || "points";
  const settlementKey = String(battle.onlineSettlementKey || `${seasonId}:${room.roomId}`).slice(0, 180);
  const resultRequestId = String(battle.onlineResultRequestId || `resultCommit:${room.roomId}:${battle.battleId || battle.endingRound || "resolved"}`).slice(0, 180);
  const matchId = String(battle.onlineMatchId || room.reviewState?.competitionResult?.matchId || room.matchId || "").slice(0, 180);
  battle.onlineSettlementKey = settlementKey;
  battle.onlineResultRequestId = resultRequestId;
  battle.onlineMatchId = matchId;
  persistOnlineSettlementState({ roomId: room.roomId, settlementKey, resultRequestId, matchId, winnerSide: battle.winnerSide || "draw", reporterSide: side, settlementStatus: "result_commit_submitting" });
  showOnlineSettlementModal({ battle, room, side, status: "result_commit_submitting", settlementKey, resultRequestId, retry: () => reportOnlineCompetitionBattleResult(battle, room, side) });
  const endingRound = Math.max(1, Number(battle.endingRound || battle.round || 1));
  const winnerSide = ["left", "right", "draw"].includes(String(battle.winnerSide || "")) ? battle.winnerSide : "draw";
  const resolutionId = globalThis.JJKOnlineDuelSync?.buildOnlineResultResolutionId?.({
    roomId: room.roomId,
    endingRound,
    authoritativeResolutionId: battle.onlineAuthoritativeResolutionId || room.battleState?.resolutionId || room.reviewState?.lastResolvedTurn?.resolutionId || ""
  });
  const resultInput = globalThis.JJKOnlineDuelSync?.buildClientResultCommitInput?.({ battle, room, side });
  const terminalSnapshot = Object.freeze({
    roomId: room.roomId,
    endingRound,
    winnerSide,
    resolutionId,
    battleSeedHash: resultInput?.battleSeedHash,
    rulesetHash: resultInput?.rulesetHash,
    leftCharacterSnapshotHash: resultInput?.leftCharacterSnapshotHash,
    rightCharacterSnapshotHash: resultInput?.rightCharacterSnapshotHash,
    left: clonePlain(resultInput?.left || battle.resourceState?.p1 || battle.left || {}),
    right: clonePlain(resultInput?.right || battle.resourceState?.p2 || battle.right || {})
  });
  const basePayload = {
    winnerSide,
    resultType: winnerSide === "draw" ? "draw" : "normal",
    endingRound,
    matchId,
    summary: buildFallbackDuelBattleSummary(battle),
    aiSummary: "",
    // Result submission must remain non-interactive in the Toy sandbox.
    postBattleComment: "",
    reporterSide: side,
    reportSource: "duel_runtime",
    leftName: battle.left?.name || "",
    rightName: battle.right?.name || "",
    endReason: battle.endReason || battle.resolutionReason || "",
    seasonId,
    settlementKey,
    resultRequestId,
    battleId: battle.battleId || "",
    turnArchive: (battle.resourceState?.resourceLog || []).slice(-24).map((entry) => ({
      round: entry.round,
      title: entry.title,
      detail: entry.detail,
      delta: entry.delta
    }))
  };
  const cachedPayload = battle.onlineResultCommitPayload;
  const canReuseFrozenPayload = cachedPayload
    && cachedPayload.settlementKey === settlementKey
    && cachedPayload.resultRequestId === resultRequestId
    && cachedPayload.winnerSide === winnerSide
    && cachedPayload.endingRound === endingRound;
  const payload = canReuseFrozenPayload ? cachedPayload : await (async () => {
    try {
      const resultPayload = await globalThis.JJKOnlineDuelSync?.buildResultCommitPayload?.({
        ...terminalSnapshot,
        side,
        settlementKey,
        resultRequestId,
        matchId
      });
      const payload = globalThis.JJKOnlineDuelSync?.mergeOnlineResultCommitPayload?.(basePayload, resultPayload);
      if (!payload?.stateHash || !payload?.resolutionId) throw new Error("终局校验数据生成失败。");
      battle.onlineAuthoritativeStateHash = payload.stateHash;
      battle.onlineAuthoritativeResolutionId = payload.resolutionId;
      battle.onlineResultCommitPayload = globalThis.JJKOnlineDuelSync?.normalizeResultCommitPayload?.({ payload, side }) || Object.freeze({ ...payload });
      return battle.onlineResultCommitPayload;
    } catch (error) {
      const safeError = new Error(globalThis.JJKOnlineDuelSync?.formatOnlineResultCommitFailure?.(error) || "比赛结果同步失败：终局校验数据生成失败。");
      safeError.code = "CLIENT_RESULT_BUILD_FAILED";
      battle.onlineSettlementStatus = "result_commit_unknown";
      battle.onlineResultCommitError = safeError.message;
      persistOnlineSettlementState({ roomId: room.roomId, settlementKey, resultRequestId, matchId, winnerSide, reporterSide: side, settlementStatus: "result_commit_unknown", lastSettlementError: safeError.message });
      showOnlineSettlementModal({ battle, room, side, error: safeError, status: "result_commit_unknown", settlementKey, resultRequestId, retry: () => reportOnlineCompetitionBattleResult(battle, room, side) });
      throw safeError;
    }
  })();
  const request = () => globalThis.JJKOnline?.reportCompetitionBattleResult?.(room.roomId, payload, {
    side,
    playerId: globalThis.JJKOnline?.getUiState?.()?.playerId || undefined,
    requestId: resultRequestId,
  });
  try {
    const result = await request();
    battle.onlineSettlementKey = String(result?.settlementKey || battle.onlineSettlementKey || settlementKey);
    battle.onlineResultRequestId = String(result?.resultRequestId || battle.onlineResultRequestId || resultRequestId);
    battle.onlineMatchId = String(result?.matchId || battle.onlineMatchId || matchId);
    const authoritativeResult = result?.room?.reviewState?.competitionResult;
    if (authoritativeResult?.winnerSide) battle.winnerSide = authoritativeResult.winnerSide;
    const settlementStatus = getOnlineSettlementStatus(result);
    battle.onlineSettlementStatus = settlementStatus;
    persistOnlineSettlementState({ roomId: room.roomId, settlementKey: battle.onlineSettlementKey, resultRequestId: battle.onlineResultRequestId, matchId: battle.onlineMatchId, winnerSide: battle.winnerSide || "draw", reporterSide: side, settlementStatus });
    showOnlineSettlementModal({ battle, room, payload, side, result, retry: request, settlementKey, resultRequestId });
    return result;
  } catch (error) {
    const authoritativeRoom = error?.responseData?.room || error?.responseData?.snapshot;
    const authoritativeResult = authoritativeRoom?.reviewState?.competitionResult;
    if (authoritativeResult?.winnerSide) battle.winnerSide = authoritativeResult.winnerSide;
    if (authoritativeResult?.matchId) battle.onlineMatchId = String(authoritativeResult.matchId);
    battle.onlineSettlementStatus = getOnlineSettlementStatus(error) || "settlement_pending";
    persistOnlineSettlementState({ roomId: room.roomId, settlementKey: battle.onlineSettlementKey, resultRequestId: battle.onlineResultRequestId, matchId: battle.onlineMatchId, winnerSide: battle.winnerSide || "draw", reporterSide: side, settlementStatus: battle.onlineSettlementStatus, lastSettlementError: error?.message || "" });
    showOnlineSettlementModal({ battle, room, payload, side, error, retry: request, settlementKey, resultRequestId });
    throw error;
  }
}

function getOnlineSettlementStatus(value = {}) {
  const result = value?.room?.reviewState?.competitionResult || value?.responseData?.room?.reviewState?.competitionResult || {};
  const code = String(value?.code || value?.responseData?.code || "");
  if (code === "WAITING_OPPONENT_RESULT") return "waiting_opponent_result";
  if (code === "RESULT_STATE_DIVERGED" || code === "RESULT_COMMIT_IMMUTABLE" || code === "SETTLEMENT_KEY_MISMATCH" || code === "CHARACTER_SNAPSHOT_HASH_MISMATCH" || code === "BATTLE_SEED_HASH_MISMATCH") return "result_state_diverged";
  if (code === "RESULT_COMMITTED") return "result_committed";
  if (code === "SETTLEMENT_CONFIRMED") return "settlement_settled";
  if (code === "BATTLE_SEED_NOT_READY") return "settlement_pending";
  if (code === "SETTLEMENT_PENDING") return "settlement_pending";
  if (code === "SETTLEMENT_FAILED") return "settlement_failed";
  if (code === "SETTLEMENT_SETTLED") return "settlement_settled";
  return String(value?.settlementStatus || value?.responseData?.settlementStatus || result.pointsSettlementStatus || result.settlementStatus || (result.pointsSettledAt ? "settlement_settled" : "settlement_pending"));
}

function persistOnlineSettlementState(state = {}) {
  try {
    const key = `jjk-online-settlement:${String(state.roomId || "").slice(0, 80)}`;
    window.sessionStorage?.setItem?.(key, JSON.stringify({
      roomId: state.roomId,
      settlementKey: state.settlementKey,
      resultRequestId: state.resultRequestId,
      matchId: state.matchId,
      winnerSide: state.winnerSide,
      reporterSide: state.reporterSide,
      settlementStatus: state.settlementStatus,
      lastSettlementError: String(state.lastSettlementError || "").slice(0, 500)
    }));
  } catch {
    // Restricted WebViews may deny session storage; in-memory battle state remains authoritative.
  }
}

function restoreOnlineSettlementState(roomId = "", battle = {}) {
  try {
    const key = `jjk-online-settlement:${String(roomId || "").slice(0, 80)}`;
    const restored = JSON.parse(window.sessionStorage?.getItem?.(key) || "null");
    if (!restored || String(restored.roomId || "") !== String(roomId || "")) return battle;
    battle.onlineSettlementKey ||= restored.settlementKey || "";
    battle.onlineResultRequestId ||= restored.resultRequestId || "";
    battle.onlineMatchId ||= restored.matchId || "";
    battle.onlineSettlementStatus = restored.settlementStatus || battle.onlineSettlementStatus || "settlement_pending";
    return battle;
  } catch {
    return battle;
  }
}

function closeOnlineSettlementModal() {
  const node = document.querySelector?.('[data-online-settlement-modal="true"]');
  if (node) node.remove();
}

const dismissedOnlineSettlements = new Map();

function settlementPresentationKey(settlementKey, status) {
  return `${String(settlementKey || "")}:${String(status || "")}`;
}

function settlementStageText(status = "") {
  if (status === "settled" || status === "settlement_settled" || status === "settlement_confirmed") return "积分已完成";
  if (status === "waiting_opponent_result") return "已提交本方结果，等待对方终局确认";
  if (status === "result_state_diverged") return "双方终局不一致，比赛已冻结";
  if (status === "result_committed") return "胜负已锁定，正在进入积分结算";
  if (status === "settlement_pending") return "胜负已锁定，积分处理中";
  if (status === "settlement_failed") return "积分结算失败，等待重试";
  if (status === "result_commit_submitting") return "正在提交结果";
  return "积分上传中";
}

function renderOnlineSettlementStatusStrip(options = {}) {
  if (typeof document === "undefined") return;
  const existing = document.querySelector?.('[data-online-settlement-strip="true"]');
  if (existing) existing.remove();
  const strip = document.createElement("div");
  strip.dataset.onlineSettlementStrip = "true";
  strip.className = "online-settlement-status-strip";
  strip.innerHTML = `<span>${escapeOnlineSettlementText(settlementStageText(options.status))}</span><button type="button" data-online-settlement-reopen>查看详情</button>`;
  document.body?.appendChild(strip);
  strip.querySelector("[data-online-settlement-reopen]")?.addEventListener("click", () => {
    strip.remove();
    showOnlineSettlementModal({ ...options, force: true });
  });
}

function showOnlineSettlementModal({ battle, room, side, error, result, retry, status, settlementKey, resultRequestId, force = false }) {
  if (typeof document === "undefined") return;
  const settlementSide = side === "right" ? "right" : side === "spectator" ? "spectator" : "left";
  const settlementReadOnly = settlementSide === "spectator";
  const currentStatus = status || getOnlineSettlementStatus(error || result || {});
  const presentationKey = settlementPresentationKey(settlementKey, currentStatus);
  if (!force && dismissedOnlineSettlements.has(presentationKey)) {
    renderOnlineSettlementStatusStrip({ battle, room, side, error, result, retry, status: currentStatus, settlementKey, resultRequestId });
    return;
  }
  document.querySelector?.('[data-online-settlement-strip="true"]')?.remove?.();
  closeOnlineSettlementModal();
  const overlay = document.createElement("div");
  overlay.dataset.onlineSettlementModal = "true";
  overlay.className = "online-settlement-modal-backdrop";
  const settled = currentStatus === "settled" || currentStatus === "settlement_settled" || currentStatus === "settlement_confirmed";
  const waitingOpponent = currentStatus === "waiting_opponent_result";
  const diverged = currentStatus === "result_state_diverged";
  const resultCommitted = currentStatus === "result_committed";
  const resultConflict = result?.resultConflict || error?.resultConflict || error?.responseData?.resultConflict || {};
  const conflictField = String(resultConflict?.field || "").slice(0, 80);
  const retryAfterMs = Math.max(0, Number(result?.retryAfterMs || error?.retryAfterMs || error?.responseData?.retryAfterMs || 0));
  const stageText = settlementStageText(currentStatus);
  const progress = globalThis.JJKOnlineSettlementProgress?.settlementProgress?.(currentStatus, result?.fallbackStage || error?.fallbackStage || "") || { value: 0, terminal: false, text: stageText };
  overlay.innerHTML = `<section class="online-settlement-modal" role="dialog" aria-modal="true" aria-labelledby="onlineSettlementTitle">
    <h2 id="onlineSettlementTitle">胜负已确认，积分正在等待上传</h2>
    <p>${escapeOnlineSettlementText(battle?.winnerSide === "draw" ? "本局判定为平局。" : "胜者已确认，但积分服务未完成确认。")}</p>
    <p data-settlement-stage>${escapeOnlineSettlementText(progress.text || stageText)}</p>
    <progress max="100" value="${progress.value}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.value}" aria-label="积分结算进度"></progress>
    <p class="online-settlement-error" data-settlement-error>${escapeOnlineSettlementText(error?.message || "积分上传失败，请重试。")}</p>
    ${conflictField ? `<p data-settlement-conflict>冲突字段：${escapeOnlineSettlementText(conflictField)}</p>` : ""}
    ${currentStatus === "settlement_failed" && retryAfterMs ? `<p data-settlement-retry-after>建议 ${Math.ceil(retryAfterMs / 1000)} 秒后重试。</p>` : ""}
    <div class="online-settlement-actions">
      <button type="button" data-online-settlement-retry ${settlementReadOnly || settled || waitingOpponent || diverged || resultCommitted || currentStatus === "result_commit_submitting" ? "disabled" : ""}>重试积分上传</button>
      <button type="button" data-online-settlement-reconcile>查询结算状态</button>
      <button type="button" data-online-settlement-diagnostics>导出诊断</button>
      <button type="button" data-online-settlement-close>稍后处理</button>
      <button type="button" data-online-settlement-exit ${settled && !settlementReadOnly ? "" : "disabled"}>退出房间</button>
    </div>
  </section>`;
  document.body?.appendChild(overlay);
  overlay.querySelector("[data-online-settlement-retry]")?.addEventListener("click", async () => {
    if (settlementReadOnly) return;
    const button = overlay.querySelector("[data-online-settlement-retry]");
    button.disabled = true;
    try {
      const retryResult = await retry();
      const nextStatus = getOnlineSettlementStatus(retryResult);
      if (nextStatus === "settled" || nextStatus === "settlement_settled") overlay.remove();
      else {
        button.disabled = false;
        const stage = overlay.querySelector("[data-settlement-stage]");
        if (stage) stage.textContent = "积分待重试";
      }
    } catch (retryError) {
      button.disabled = false;
      const errorNode = overlay.querySelector(".online-settlement-error");
      if (errorNode) errorNode.textContent = retryError?.message || "积分上传仍未完成。";
    }
  });
  overlay.querySelector("[data-online-settlement-reconcile]")?.addEventListener("click", async () => {
    const ui = globalThis.JJKOnline?.getUiState?.() || {};
    const reconcileButton = overlay.querySelector("[data-online-settlement-reconcile]");
    if (reconcileButton) reconcileButton.disabled = true;
    try {
      const fresh = await globalThis.JJKOnline?.getRoomState?.(room?.roomId, { playerId: ui.playerId, side: settlementSide, viewerSide: settlementSide });
      const nextStatus = getOnlineSettlementStatus({ room: fresh });
      persistOnlineSettlementState({ roomId: room?.roomId, settlementKey, resultRequestId, winnerSide: battle?.winnerSide || "draw", reporterSide: settlementSide, settlementStatus: nextStatus });
      const stage = overlay.querySelector("[data-settlement-stage]");
      const nextProgress = globalThis.JJKOnlineSettlementProgress?.settlementProgress?.(nextStatus) || { value: 0, terminal: false, text: settlementStageText(nextStatus) };
      if (stage) stage.textContent = nextProgress.text;
      const progressNode = overlay.querySelector("progress");
      if (progressNode) {
        progressNode.value = nextProgress.value;
        progressNode.setAttribute("aria-valuenow", String(nextProgress.value));
      }
      const exit = overlay.querySelector("[data-online-settlement-exit]");
      if (exit) exit.disabled = settlementReadOnly || !(nextStatus === "settled" || nextStatus === "settlement_settled");
    } catch (reconcileError) {
      const errorNode = overlay.querySelector("[data-settlement-error]");
      if (errorNode) errorNode.textContent = reconcileError?.message || "结算状态查询失败。";
    } finally {
      if (reconcileButton) reconcileButton.disabled = false;
    }
  });
  overlay.querySelector("[data-online-settlement-close]")?.addEventListener("click", () => {
    dismissedOnlineSettlements.set(presentationKey, true);
    overlay.remove();
    renderOnlineSettlementStatusStrip({ battle, room, side, error, result, retry, status: currentStatus, settlementKey, resultRequestId });
  });
  overlay.querySelector("[data-online-settlement-diagnostics]")?.addEventListener("click", () => {
    try {
      const diagnostic = {
        roomId: String(room?.roomId || ""),
        side: settlementSide,
        status: currentStatus,
        code: String(result?.code || error?.code || error?.responseData?.code || ""),
        phase: String(result?.phase || error?.phase || error?.responseData?.phase || room?.phase || ""),
        settlementKey: String(settlementKey || ""),
        resultRequestId: String(resultRequestId || ""),
        stateHash: String(battle?.onlineAuthoritativeStateHash || ""),
        resolutionId: String(battle?.onlineAuthoritativeResolutionId || "")
      };
      const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `jjk-online-settlement-${diagnostic.roomId || "diagnostic"}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (diagnosticError) {
      const errorNode = overlay.querySelector("[data-settlement-error]");
      if (errorNode) errorNode.textContent = diagnosticError?.message || "诊断导出失败。";
    }
  });
  overlay.querySelector("[data-online-settlement-exit]")?.addEventListener("click", async () => {
    if (settlementReadOnly || overlay.querySelector("[data-online-settlement-exit]")?.disabled) return;
    try {
      const ui = globalThis.JJKOnline?.getUiState?.() || {};
      await (globalThis.JJKOnline?.leaveAfterSettlement || globalThis.JJKOnline?.leaveRoom)?.(room?.roomId, { playerId: ui.playerId, side: settlementSide });
      overlay.remove();
    } catch (exitError) {
      const errorNode = overlay.querySelector("[data-settlement-error]");
      if (errorNode) errorNode.textContent = exitError?.message || "房间仍受结算保护，暂不能退出。";
    }
  });
}

function escapeOnlineSettlementText(value) {
  return String(value || "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function buildFallbackDuelBattleSummary(battle = {}) {
  const winner = battle.winnerSide === "left" ? battle.left?.name : battle.winnerSide === "right" ? battle.right?.name : "";
  const endRound = battle.endingRound || battle.round || 0;
  if (winner) return `第 ${formatNumber(endRound)} 回合，${winner} 胜出。`;
  return `第 ${formatNumber(endRound)} 回合，比赛结束但未自然分出胜负。`;
}

function isOnlineDuelModeActive() {
  return getDuelBattleMode() === "online" && Boolean(state.duelModeState.activeRoomId);
}

function forceOnlineBattleInterface(playerSide = state.duelModeState.playerSide || "left") {
  const roomId = state.duelModeState.activeRoomId || "";
  const side = playerSide === "spectator" ? "spectator" : (playerSide === "right" ? "right" : "left");
  getBattlePageModule()?.activateBattlePage?.("online", { primeMode: "online" });
  return setDuelBattleMode("online", {
    activeRoomId: roomId,
    playerSide: side,
    activePage: "online"
  });
}

function isSoloDuelModeActive() {
  return getDuelBattleMode() === "solo" && Boolean(state.duelModeState.activeBattleId);
}

function isDounaBattlePageActive() {
  const page = getBattlePageModule()?.getBattlePageState?.().activePage || state.duelModeState.activePage || "";
  return page === "douna";
}

function getDounaStartButtonLabel() {
  const battle = state.duelBattle;
  if (!isDounaBattlePageActive()) return "开始单人对战";
  if (battle?.dounaGauntlet) {
    if (battle.autoRunning) return "阶段生成中";
    return battle.resolved ? "再挑战宿傩" : "重开斗傩";
  }
  return "开始挑战宿傩";
}

function syncDuelModeIsolation() {
  const onlineActive = isOnlineDuelModeActive();
  const dounaPage = isDounaBattlePageActive();
  if (els.duelStartBtn) {
    const startDisabled = onlineActive || Boolean(dounaPage && state.duelBattle?.dounaGauntlet && state.duelBattle.autoRunning);
    els.duelStartBtn.disabled = startDisabled;
    els.duelStartBtn.setAttribute("aria-disabled", startDisabled ? "true" : "false");
    els.duelStartBtn.textContent = onlineActive ? "联机进行中" : (dounaPage ? getDounaStartButtonLabel() : "开始单人对战");
  }
  if (els.duelSwapBtn) {
    const disabled = onlineActive || dounaPage;
    els.duelSwapBtn.disabled = disabled;
    els.duelSwapBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
  if (els.duelModeStatus) {
    const mode = getDuelBattleMode();
    if (mode === "online") {
      const sideText = state.duelModeState.playerSide === "spectator" ? "观战" : (state.duelModeState.playerSide === "right" ? "右方" : "左方");
      els.duelModeStatus.textContent = `当前为联机对战；你控制：${sideText}；房间：${state.duelModeState.activeRoomId || "未加入"}。`;
    } else if (dounaPage) {
      els.duelModeStatus.textContent = state.duelBattle?.dounaGauntlet
        ? "当前为斗傩大陆车轮战；挑战者会依次上阵，宿傩状态跨角色保留。"
        : "当前为斗傩大陆赛前页；选择 5 名挑战者后开始挑战宿傩。";
    } else if (mode === "solo") {
      els.duelModeStatus.textContent = state.duelBattle?.dounaGauntlet
        ? "当前为斗傩大陆车轮战；宿傩状态会跨挑战者保留。"
        : (isSoloDuelModeActive()
          ? "当前为单人对战；手札执行会推进本地战斗。"
          : "当前为单人对战页；开始后显示手札、体势、咒力、领域和日志。");
    } else {
      els.duelModeStatus.textContent = "尚未进入对战。";
    }
  }
}

function getDuelCharacterCardById(characterId) {
  const id = String(characterId || "");
  return getDuelCharacterCards().find((card) => card.characterId === id || card.id === id) || null;
}

const ONLINE_SNAPSHOT_MUTABLE_FIELDS = new Set(["hp", "maxHp", "ce", "maxCe"]);

function buildOnlineSafeSnapshot(snapshotPlayer = {}) {
  const snapshot = clonePlain(snapshotPlayer?.characterSnapshot);
  if (!snapshot || typeof snapshot !== "object") return null;
  const characterId = String(snapshot.characterId || snapshot.id || snapshotPlayer?.characterId || "").trim();
  const localCard = characterId ? getDuelCharacterCardById(characterId) : null;
  const fallbackCard = snapshotPlayer?.characterCardProfile;
  const baseline = localCard && typeof localCard === "object"
    ? clonePlain(localCard)
    : (fallbackCard && typeof fallbackCard === "object" ? clonePlain(fallbackCard) : null);
  if (!baseline) return snapshot;

  const repaired = clonePlain(baseline) || {};
  Object.keys(snapshot).forEach((field) => {
    if (ONLINE_SNAPSHOT_MUTABLE_FIELDS.has(field)) {
      if (snapshot[field] !== undefined) {
        const numericValue = Number(snapshot[field]);
        repaired[field] = Number.isFinite(numericValue) ? numericValue : clonePlain(snapshot[field]);
      }
      return;
    }
    if (!(field in repaired)) {
      repaired[field] = clonePlain(snapshot[field]);
    }
  });

  if (String(snapshot.characterId || "").trim()) {
    repaired.characterId = String(snapshot.characterId);
  }
  if (String(snapshot.id || "").trim()) {
    repaired.id = String(snapshot.id);
  }
  if (String(snapshot.displayName || "").trim()) {
    repaired.displayName = repaired.displayName || String(snapshot.displayName);
  }
  return repaired;
}

function evaluateDuelCharacterById(characterId, fallbackSide = "left") {
  const cards = getDuelCharacterCards();
  const fallbackValue = fallbackSide === "right" ? els.duelRightSelect?.value : els.duelLeftSelect?.value;
  const card = getDuelCharacterCardById(characterId) ||
    getDuelCharacterCardById(fallbackValue) ||
    cards[fallbackSide === "right" ? 1 : 0] ||
    cards[0];
  if (!card) return null;
  return applyDuelSideDebugOverride(evaluateDuelCharacterCard(card), fallbackSide);
}

function getOnlineSnapshotCharacterProfile(snapshotPlayer, fallbackSide = "left") {
  const snapshot = buildOnlineSafeSnapshot(snapshotPlayer);
  if (snapshot) return applyDuelSideDebugOverride(evaluateDuelCharacterCard(snapshot), fallbackSide);
  return evaluateDuelCharacterById(snapshotPlayer?.characterId, fallbackSide);
}

function normalizeDounaRosterBattleProfile(entry = {}, fallbackSide = "left") {
  if (!entry) return null;
  if (entry.raw && entry.axes && entry.combatPowerUnit) {
    return applyDuelSideDebugOverride(clonePlain(entry), fallbackSide);
  }
  return applyDuelSideDebugOverride(evaluateDuelCharacterCard(entry), fallbackSide);
}

function normalizeOnlineSnapshotCustomCard(snapshot, roomId = "") {
  if (!snapshot || !snapshot.customDuel) return null;
  const characterId = String(snapshot.characterId || snapshot.id || "");
  if (!characterId) return null;
  return {
    ...clonePlain(snapshot),
    id: snapshot.id || characterId,
    characterId,
    customDuel: true,
    __onlineTemporaryCustomDuel: true,
    __onlineRoomId: String(roomId || "")
  };
}

function cacheOnlineSnapshotCustomCharacters(snapshot = {}) {
  if (!snapshot?.players) return 0;
  state.customDuelCards = Array.isArray(state.customDuelCards) ? state.customDuelCards : [];
  const roomId = String(snapshot.roomId || "");
  const cachedCards = [
    normalizeOnlineSnapshotCustomCard(
      buildOnlineSafeSnapshot({ ...snapshot.players.left }),
      roomId
    ),
    normalizeOnlineSnapshotCustomCard(
      buildOnlineSafeSnapshot({ ...snapshot.players.right }),
      roomId
    )
  ].filter(Boolean);
  cachedCards.forEach((cached) => {
    const existingIndex = state.customDuelCards.findIndex((card) =>
      card?.characterId === cached.characterId || card?.id === cached.characterId
    );
    if (existingIndex >= 0) {
      if (state.customDuelCards[existingIndex]?.__onlineTemporaryCustomDuel) {
        state.customDuelCards[existingIndex] = cached;
      }
      return;
    }
    state.customDuelCards.push(cached);
  });
  if (cachedCards.length) notifyDuelCharacterPoolChanged();
  return cachedCards.length;
}

function clearOnlineTemporaryCustomDuelCards(roomId = "") {
  if (!Array.isArray(state.customDuelCards)) return 0;
  const targetRoomId = String(roomId || "");
  const before = state.customDuelCards.length;
  state.customDuelCards = state.customDuelCards.filter((card) =>
    !card?.__onlineTemporaryCustomDuel || (targetRoomId && card.__onlineRoomId && card.__onlineRoomId !== targetRoomId)
  );
  const removed = before - state.customDuelCards.length;
  if (removed > 0) notifyDuelCharacterPoolChanged();
  return removed;
}

function purgeLegacyOnlineDounaImportedCharacters(roomId = "") {
  if (!Array.isArray(state.customDuelCards)) return 0;
  const ownerId = roomId ? `room_${roomId}` : "";
  const before = state.customDuelCards.length;
  state.customDuelCards = state.customDuelCards.filter((card) => {
    const source = String(card?.source || "");
    const owner = String(card?.__loginCardOwnerId || "");
    const legacyOnlineDouna = source === "online-douna" || source === "online-douna-boss";
    if (!legacyOnlineDouna) return true;
    return ownerId && owner && owner !== ownerId;
  });
  const removed = before - state.customDuelCards.length;
  if (removed > 0) notifyDuelCharacterPoolChanged();
  return removed;
}

let duelModeRenderFrame = 0;
let duelModeRenderGeneration = 0;
let duelModeRenderScrollTarget = null;
let duelModeRenderScrollToken = 0;
let onlineTurnDeadlineRenderTimer = 0;
const LOCAL_ONLINE_TURN_DURATION_MS = 60_000;
const duelHtmlCache = new WeakMap();
const duelRenderPerformance = {
  requested: 0,
  committed: 0,
  skippedIdentical: 0,
  cancelledStaleFrames: 0,
  animationsApplied: 0,
  fullReplacements: 0,
  incrementalPatches: 0,
  preservedHandPanels: 0,
  preservedHandCards: 0,
  scrollCorrections: 0,
  lastCommitAt: 0
};

const DUEL_STABLE_NODE_CLASSES = [
  "duel-battle-stage",
  "duel-battle-head",
  "duel-battle-status",
  "duel-action-panel",
  "duel-action-scroll",
  "duel-action-head",
  "duel-haruta-interaction",
  "duel-action-toolbar",
  "duel-selected-hand-summary",
  "duel-hand-control-buttons",
  "duel-hand-choices",
  "duel-domain-hand-head",
  "duel-domain-hand-choices",
  "duel-initiative-control",
  "duel-hand-execute-control",
  "duel-battle-support-grid",
  "duel-interaction",
  "duel-round-panel"
];
const DUEL_TRANSIENT_ANIMATION_CLASS = /^(?:deal|play|lock)-(?:animation|in|out|variant-\d+)$/;
const DUEL_TRANSIENT_ANIMATION_ATTRIBUTES = new Set([
  "data-duel-deal-animation-key",
  "data-duel-action-animation-key"
]);
const duelControlBindings = new WeakMap();

function getDuelStableNodeKey(node) {
  if (!node || node.nodeType !== 1) return "";
  const element = node;
  const duelCardId = String(element.dataset?.duelCardId || "");
  if (duelCardId) return `card:${element.tagName}:${duelCardId}`;
  if (element.id) return `id:${element.tagName}:${element.id}`;
  const stableClass = DUEL_STABLE_NODE_CLASSES.find((className) => element.classList?.contains(className));
  return stableClass ? `class:${element.tagName}:${stableClass}` : "";
}

function areDuelDomNodesCompatible(currentNode, nextNode) {
  if (!currentNode || !nextNode || currentNode.nodeType !== nextNode.nodeType) return false;
  if (currentNode.nodeType !== 1) return true;
  if (currentNode.tagName !== nextNode.tagName) return false;
  const currentKey = getDuelStableNodeKey(currentNode);
  const nextKey = getDuelStableNodeKey(nextNode);
  return currentKey || nextKey ? currentKey === nextKey : true;
}

function syncDuelElementAttributes(currentElement, nextElement) {
  const openState = currentElement.tagName === "DETAILS" && currentElement.open;
  const transientClasses = Array.from(currentElement.classList || [])
    .filter((className) => DUEL_TRANSIENT_ANIMATION_CLASS.test(className));
  Array.from(currentElement.attributes || []).forEach((attribute) => {
    if (attribute.name === "class") return;
    if (DUEL_TRANSIENT_ANIMATION_ATTRIBUTES.has(attribute.name)) return;
    if (!nextElement.hasAttribute(attribute.name)) currentElement.removeAttribute(attribute.name);
  });
  Array.from(nextElement.attributes || []).forEach((attribute) => {
    if (attribute.name === "class") return;
    if (currentElement.getAttribute(attribute.name) !== attribute.value) {
      currentElement.setAttribute(attribute.name, attribute.value);
    }
  });
  const nextClasses = new Set(Array.from(nextElement.classList || []));
  transientClasses.forEach((className) => nextClasses.add(className));
  const nextClassName = Array.from(nextClasses).join(" ");
  if (currentElement.className !== nextClassName) currentElement.className = nextClassName;
  if (openState && !nextElement.hasAttribute("open")) currentElement.open = true;
}

function reconcileDuelDomNode(currentNode, nextNode) {
  if (currentNode.nodeType === 3 || currentNode.nodeType === 8) {
    if (currentNode.nodeValue !== nextNode.nodeValue) currentNode.nodeValue = nextNode.nodeValue;
    return currentNode;
  }
  if (currentNode.nodeType !== 1) return currentNode;
  syncDuelElementAttributes(currentNode, nextNode);
  reconcileDuelDomChildren(currentNode, nextNode);
  return currentNode;
}

function reconcileDuelDomChildren(currentParent, nextParent) {
  let cursor = currentParent.firstChild;
  Array.from(nextParent.childNodes || []).forEach((nextChild) => {
    const nextKey = getDuelStableNodeKey(nextChild);
    let match = null;
    if (nextKey) {
      match = Array.from(currentParent.childNodes || []).find((candidate) => getDuelStableNodeKey(candidate) === nextKey) || null;
    } else if (cursor && !getDuelStableNodeKey(cursor) && areDuelDomNodesCompatible(cursor, nextChild)) {
      match = cursor;
    }
    if (!match) {
      const clone = nextChild.cloneNode(true);
      currentParent.insertBefore(clone, cursor);
      return;
    }
    if (match !== cursor) {
      const remainingNodes = [];
      for (let node = cursor; node; node = node.nextSibling) remainingNodes.push(node);
      if (remainingNodes.includes(match)) {
        while (cursor && cursor !== match) {
          const staleNode = cursor;
          cursor = cursor.nextSibling;
          currentParent.removeChild(staleNode);
        }
      } else {
        currentParent.insertBefore(match, cursor);
      }
    }
    reconcileDuelDomNode(match, nextChild);
    cursor = match.nextSibling;
  });
  while (cursor) {
    const next = cursor.nextSibling;
    currentParent.removeChild(cursor);
    cursor = next;
  }
}

function commitDuelBattleDomIncrementally(element, markup) {
  if (!element || typeof document === "undefined") return false;
  const currentStage = Array.from(element.children || []).find((child) => child.classList?.contains("duel-battle-stage"));
  if (!currentStage) return false;
  const template = document.createElement("template");
  template.innerHTML = String(markup || "");
  const nextStage = Array.from(template.content.children || []).find((child) => child.classList?.contains("duel-battle-stage"));
  if (!nextStage) return false;
  const previousPanel = element.querySelector(".duel-action-panel");
  const previousCards = new Set(Array.from(element.querySelectorAll(".duel-hand-card[data-duel-card-id]")));
  reconcileDuelDomChildren(element, template.content);
  const currentPanel = element.querySelector(".duel-action-panel");
  const currentCards = new Set(Array.from(element.querySelectorAll(".duel-hand-card[data-duel-card-id]")));
  duelRenderPerformance.incrementalPatches += 1;
  if (previousPanel && previousPanel === currentPanel) duelRenderPerformance.preservedHandPanels += 1;
  previousCards.forEach((card) => {
    if (currentCards.has(card)) duelRenderPerformance.preservedHandCards += 1;
  });
  return true;
}

function bindDuelControlOnce(element, eventName, key, listener, options) {
  if (!element || typeof element.addEventListener !== "function") return;
  let bindings = duelControlBindings.get(element);
  if (!bindings) {
    bindings = new Set();
    duelControlBindings.set(element, bindings);
  }
  const bindingKey = `${eventName}:${key}`;
  if (bindings.has(bindingKey)) return;
  element.addEventListener(eventName, listener, options);
  bindings.add(bindingKey);
}

function commitDuelHtml(element, markup) {
  if (!element) return false;
  const next = String(markup || "");
  if (duelHtmlCache.get(element) === next) {
    duelRenderPerformance.skippedIdentical += 1;
    return false;
  }
  const incrementallyPatched = element.id === "duelBattle" && commitDuelBattleDomIncrementally(element, next);
  if (!incrementallyPatched) {
    element.innerHTML = next;
    duelRenderPerformance.fullReplacements += 1;
  }
  duelHtmlCache.set(element, next);
  duelRenderPerformance.committed += 1;
  duelRenderPerformance.lastCommitAt = Date.now();
  return true;
}

const DUEL_NATIVE_BATTLE_VIEWS = Object.freeze(["hand", "status", "tactics", "report"]);

function getDuelNativeBattleView() {
  if (typeof document === "undefined") return "hand";
  const view = String(document.documentElement.dataset.jjkNativeBattleView || "hand");
  return DUEL_NATIVE_BATTLE_VIEWS.includes(view) ? view : "hand";
}

function getDuelAuxiliaryBattleView() {
  if (typeof document === "undefined") return "status";
  const view = String(document.documentElement.dataset.jjkNativeBattleAuxView || "status");
  return ["status", "tactics", "report"].includes(view) ? view : "status";
}

function refreshDuelNativeBattleControls() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const view = getDuelNativeBattleView();
  const dualLayout = root.dataset.jjkBattleLayout === "landscape-dual";
  const paneMode = dualLayout ? (root.dataset.jjkBattlePaneMode === "focused" ? "focused" : "dual") : "single";
  els.duelBattle?.querySelectorAll?.("[data-duel-native-view]").forEach((button) => {
    const active = button.dataset.duelNativeView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  els.duelBattle?.querySelectorAll?.("[data-duel-pane-mode-toggle]").forEach((button) => {
    const focused = paneMode === "focused";
    button.hidden = !dualLayout;
    button.classList.toggle("is-dual", !focused);
    button.setAttribute("aria-pressed", focused ? "false" : "true");
    button.textContent = focused ? "恢复双栏" : "放大右栏";
    button.setAttribute("aria-label", focused ? "恢复手牌与辅助信息双栏" : "放大当前右侧信息栏");
  });
}

function normalizeObservedMitigationSummary(value = {}) {
  const summary = {
    total: Number(value?.total ?? value?.totalPrevented ?? 0) || 0,
    panel: Number(value?.panel ?? value?.panelDefensePrevented ?? 0) || 0,
    scale: Number(value?.scale ?? value?.scalePrevented ?? 0) || 0,
    inverse: Number(value?.inverse ?? value?.inversePrevented ?? 0) || 0,
    blocked: Number(value?.blocked ?? value?.damageBlocked ?? 0) || 0,
    reduced: Number(value?.reduced ?? 0) || 0,
    shield: Number(value?.shield ?? value?.shieldAbsorbed ?? 0) || 0
  };
  if (!(summary.total > 0)) summary.total = summary.panel + summary.scale + summary.inverse + summary.blocked + summary.reduced + summary.shield;
  Object.keys(summary).forEach((key) => { summary[key] = Number(summary[key].toFixed(1)); });
  return summary;
}

function chooseObservedMitigationSummary(primary = {}, fallback = {}) {
  const preferred = normalizeObservedMitigationSummary(primary);
  const recovered = normalizeObservedMitigationSummary(fallback);
  return preferred.total + 0.05 >= recovered.total ? preferred : recovered;
}

function isOnlineRangeAdjustmentAction(entry = {}) {
  const action = entry?.action || entry?.actionSnapshot || entry;
  const identity = [entry?.id, entry?.actionId, entry?.label, action?.id, action?.cardId, action?.name, action?.label]
    .filter(Boolean)
    .join(" ");
  return Boolean(action?.effects?.rangeAdjustment || action?.effect?.rangeAdjustment || /range_adjustment|范围调整/.test(identity));
}

function normalizeOnlineLockedActionPlan(actions = [], side = "left", battle = state.duelBattle) {
  const normalized = normalizeOnlineResolvedActions(actions, side, battle);
  const completePlan = normalized.length ? normalized : [createDuelPassTurnAction(side, battle)];
  const atomicOrdered = globalThis.JJKDuelActions?.orderCustomAtomicActionEntries?.(completePlan) || completePlan;
  const ordered = atomicOrdered
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftPriority = isOnlineRangeAdjustmentAction(left.entry) ? 0 : 1;
      const rightPriority = isOnlineRangeAdjustmentAction(right.entry) ? 0 : 1;
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map((item) => item.entry);
  return ordered.map((entry, index) => {
    const selection = {
      selectedCount: ordered.length,
      selectedIndex: index,
      selectedLast: index === ordered.length - 1
    };
    return {
      ...entry,
      ...selection,
      action: { ...(entry?.action || {}), ...selection }
    };
  });
}

function syncDuelResponsiveBattleLayout(options = {}) {
  if (typeof document === "undefined") return "desktop";
  const root = document.documentElement;
  const previousLayout = String(root.dataset.jjkBattleLayout || "");
  const layout = globalThis.JJKDuelMobileInteraction?.syncMobileBattleLayout?.(root) || previousLayout || "desktop";
  const entering = Boolean(options.entering);
  const layoutChanged = previousLayout && previousLayout !== layout;
  if (layout === "landscape-dual") {
    if (entering || layoutChanged || !["dual", "focused"].includes(root.dataset.jjkBattlePaneMode || "")) {
      root.dataset.jjkBattlePaneMode = "dual";
    }
    const current = getDuelNativeBattleView();
    const auxiliary = current === "hand" ? getDuelAuxiliaryBattleView() : current;
    root.dataset.jjkNativeBattleAuxView = auxiliary;
    if (root.dataset.jjkBattlePaneMode === "dual") root.dataset.jjkNativeBattleView = auxiliary;
  } else {
    root.dataset.jjkBattlePaneMode = "single";
    if (entering || layoutChanged) root.dataset.jjkNativeBattleView = "hand";
  }
  refreshDuelNativeBattleControls();
  return layout;
}

function syncDuelBattleFocusMode(battle = state.duelBattle) {
  if (typeof document === "undefined") return;
  const active = Boolean(battle?.left && battle?.right && !battle.focusModeDismissed);
  const entering = active && document.documentElement.dataset.jjkBattleFocus !== "true";
  document.body?.classList.toggle("battle-focus-mode", active);
  document.documentElement.dataset.jjkBattleFocus = active ? "true" : "false";
  if (active) {
    if (!DUEL_NATIVE_BATTLE_VIEWS.includes(document.documentElement.dataset.jjkNativeBattleView || "")) {
      document.documentElement.dataset.jjkNativeBattleView = "hand";
    }
    syncDuelResponsiveBattleLayout({ entering });
  } else {
    document.documentElement.dataset.jjkBattlePaneMode = "single";
  }
}

function setDuelNativeBattleView(view = "hand", options = {}) {
  if (typeof document === "undefined") return "hand";
  const root = document.documentElement;
  const normalized = DUEL_NATIVE_BATTLE_VIEWS.includes(String(view)) ? String(view) : "hand";
  const dualLayout = root.dataset.jjkBattleLayout === "landscape-dual";
  if (dualLayout && options.userInitiated && normalized === "hand") {
    root.dataset.jjkBattlePaneMode = "focused";
  }
  if (normalized !== "hand") root.dataset.jjkNativeBattleAuxView = normalized;
  root.dataset.jjkNativeBattleView = normalized;
  refreshDuelNativeBattleControls();
  return normalized;
}

function toggleDuelBattlePaneMode() {
  if (typeof document === "undefined") return "single";
  const root = document.documentElement;
  if (root.dataset.jjkBattleLayout !== "landscape-dual") return "single";
  if (root.dataset.jjkBattlePaneMode === "focused") {
    root.dataset.jjkBattlePaneMode = "dual";
    const auxiliary = getDuelNativeBattleView() === "hand" ? getDuelAuxiliaryBattleView() : getDuelNativeBattleView();
    root.dataset.jjkNativeBattleAuxView = auxiliary;
    root.dataset.jjkNativeBattleView = auxiliary;
  } else {
    root.dataset.jjkBattlePaneMode = "focused";
    if (getDuelNativeBattleView() === "hand") root.dataset.jjkNativeBattleView = getDuelAuxiliaryBattleView();
  }
  refreshDuelNativeBattleControls();
  return root.dataset.jjkBattlePaneMode;
}

if (typeof document !== "undefined" && !globalThis.__JJK_DUEL_VIEWPORT_PROFILE_BOUND__) {
  globalThis.__JJK_DUEL_VIEWPORT_PROFILE_BOUND__ = true;
  document.addEventListener("jjk-viewport-profile-changed", () => {
    if (document.documentElement.dataset.jjkBattleFocus !== "true") return;
    syncDuelResponsiveBattleLayout();
    globalThis.JJKDuelMobileInteraction?.restoreBattlePaneScroll?.(els.duelBattle);
  });
  document.addEventListener("jjk-mobile-back-request", (event) => {
    if (document.documentElement.dataset.jjkBattleFocus !== "true") return;
    if (
      document.documentElement.dataset.jjkBattleLayout === "landscape-dual" &&
      document.documentElement.dataset.jjkBattlePaneMode === "focused"
    ) {
      toggleDuelBattlePaneMode();
      event.preventDefault();
      return;
    }
    const exit = els.duelBattle?.querySelector?.("#duelExitFocusBtn");
    if (exit) {
      exit.click();
      event.preventDefault();
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.JJKDuelRenderPerformance = duelRenderPerformance;
}

function blurDuelActionFocus() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (!active || typeof active.matches !== "function" || typeof active.blur !== "function") return;
  if (active.matches("#duelAutoRunBtn, #duelOnlineLockFromHandBtn, [data-duel-action], [data-duel-haruta-counter-action], [data-duel-tower-counter-action], [data-duel-dagon-counter-action], [data-duel-choso-counter-action], [data-duel-mahito-counter-action], [data-duel-hand-clear], [data-duel-hand-undo], [data-duel-discard], [data-duel-initiative-investment], [data-duel-tactic], [data-duel-uzumaki-unit], [data-duel-uzumaki-all], [data-duel-uzumaki-cancel], [data-duel-uzumaki-confirm]")) {
    active.blur();
  }
}

function captureDuelRenderScroll(options = {}) {
  if (!options?.preserveScroll || typeof document === "undefined") return;
  const anchorSelector = String(options.anchorSelector || "");
  const anchor = anchorSelector && typeof document !== "undefined" ? document.querySelector(anchorSelector) : null;
  const panes = Array.from(document.querySelectorAll("[data-duel-scroll-pane], .duel-action-scroll, .duel-action-status, .duel-battle-report"))
    .map((element) => ({ selector: element.getAttribute("data-duel-scroll-pane") || `.${element.className?.split?.(" ")?.[0] || "duel-action-scroll"}`, top: element.scrollTop, left: element.scrollLeft }))
    .filter((entry) => entry.selector);
  duelModeRenderScrollTarget = {
    panes,
    anchorSelector,
    anchorTop: anchor?.getBoundingClientRect?.().top,
    token: ++duelModeRenderScrollToken,
  };
}

function restoreDuelRenderScroll() {
  if (!duelModeRenderScrollTarget || typeof document === "undefined") return;
  const target = duelModeRenderScrollTarget;
  duelModeRenderScrollTarget = null;
  if (target.token !== duelModeRenderScrollToken) return;
  for (const pane of target.panes || []) {
    const element = document.querySelector(`[data-duel-scroll-pane="${pane.selector}"], ${pane.selector}`);
    if (!element) continue;
    element.scrollTop = pane.top;
    element.scrollLeft = pane.left;
  }
}

function requestDuelModeRender(options = {}) {
  duelRenderPerformance.requested += 1;
  if (!options?.preserveScroll) {
    duelModeRenderScrollTarget = null;
    duelModeRenderScrollToken += 1;
  }
  captureDuelRenderScroll(options);
  if (duelModeRenderFrame) return;
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    renderDuelMode();
    restoreDuelRenderScroll();
    return;
  }
  const generation = ++duelModeRenderGeneration;
  duelModeRenderFrame = window.requestAnimationFrame(() => {
    if (generation !== duelModeRenderGeneration) return;
    duelModeRenderFrame = 0;
    renderDuelMode({ fromScheduledFrame: true });
    restoreDuelRenderScroll();
  });
}

function requestDuelInteractionRender(anchorSelector = ".duel-action-panel") {
  requestDuelModeRender({ preserveScroll: true, anchorSelector });
}

function usesRankedTurnDeadline(room = {}) {
  const competitionType = String(room?.competitionType || room?.competitionFormat || "").trim().toLowerCase();
  const competitionRoom = Boolean(room?.competitionRoom || room?.tournamentRoom || room?.mode === "competition") ||
    (room?.mode === "ranked" && Boolean(room?.rankedMatchId || room?.matchId));
  return Number(room?.battleApiVersion || 0) >= 3 &&
    String(room?.simulationAuthority || "") === "client-synchronized-v1" &&
    String(room?.rankedOpponentType || "").toLowerCase() === "human" &&
    competitionRoom &&
    ["points", "culling-season-2-qualifier", "culling-season-2-playoffs"].includes(competitionType);
}

function shouldRunOnlineTurnDeadlineRenderTimer(battle = state.duelBattle, now = Date.now()) {
  const room = battle?.onlineRoomSnapshot || {};
  if (battle?.onlinePlayerSide === "spectator") return false;
  const side = battle?.onlinePlayerSide === "right" ? "right" : "left";
  const localTimer = battle?.onlineLocalTurnTimer || null;
  return Boolean(
    battle?.mode === "online" &&
    !battle.resolved &&
    room?.syncProtocolVersion === "reveal-ack-input-only-v3" &&
    String(room?.rankedOpponentType || "human").toLowerCase() === "human" &&
    room?.phase === "turn_selecting" &&
    localTimer?.side === side &&
    localTimer?.turnId === String(room?.turnState?.turnId || "") &&
    ["running", "submitting"].includes(localTimer?.status) &&
    room?.turnState?.locks?.[side] !== true &&
    state.duelModeState.localLocked !== true &&
    (typeof document === "undefined" || document.visibilityState !== "hidden")
  );
}

function clearOnlineTurnDeadlineRenderTimer() {
  if (!onlineTurnDeadlineRenderTimer) return;
  globalThis.clearInterval?.(onlineTurnDeadlineRenderTimer);
  onlineTurnDeadlineRenderTimer = 0;
}

function syncOnlineTurnDeadlineRenderTimer() {
  if (!shouldRunOnlineTurnDeadlineRenderTimer()) {
    clearOnlineTurnDeadlineRenderTimer();
    return;
  }
  if (onlineTurnDeadlineRenderTimer) return;
  onlineTurnDeadlineRenderTimer = globalThis.setInterval?.(() => {
    const battle = state.duelBattle;
    const timerApi = globalThis.JJKOnlineLocalTurnTimer;
    if (battle?.onlineLocalTurnTimer && typeof timerApi?.tickLocalTurnTimer === "function") {
      const result = timerApi.tickLocalTurnTimer(battle.onlineLocalTurnTimer, Date.now());
      battle.onlineLocalTurnTimer = result.state;
      if (result.shouldSubmitPass && !battle.onlineLocalTurnPassRequestId) {
        battle.onlineLocalTurnPassRequestId = `localTimeoutPass:${battle.onlineRoomId}:${battle.round}:${battle.onlinePlayerSide}`;
        battle.actionUiMessage = "本回合时间到，正在锁定 PASS。";
        Promise.resolve(globalThis.JJKOnline?.lockSelectedTurnFromBattle?.({ forcePass: true }))
          .then(() => { battle.onlineLocalTurnTimer = { ...battle.onlineLocalTurnTimer, status: "locked" }; })
          .catch((error) => {
            battle.actionUiMessage = `自动 PASS 提交失败：${String(error?.message || error)}`;
            battle.onlineLocalTurnTimer = { ...battle.onlineLocalTurnTimer, status: "submitting" };
          });
      } else if (!result.expired && battle.onlineLocalTurnTimer.status === "running") {
        battle.actionUiMessage = `本回合剩余 ${Math.max(0, Math.ceil(result.remainingMs / 1000))} 秒`;
      }
    }
    if (!shouldRunOnlineTurnDeadlineRenderTimer()) {
      clearOnlineTurnDeadlineRenderTimer();
      requestDuelInteractionRender("#duelBattle");
      return;
    }
    requestDuelInteractionRender("#duelBattle");
  }, 250) || 0;
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") clearOnlineTurnDeadlineRenderTimer();
    else syncOnlineTurnDeadlineRenderTimer();
  });
  globalThis.addEventListener("pagehide", () => {
    clearOnlineTurnDeadlineRenderTimer();
  });
}

function renderDuelMode(options = {}) {
  if (!options.fromScheduledFrame && duelModeRenderFrame) {
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(duelModeRenderFrame);
    }
    duelModeRenderGeneration += 1;
    duelRenderPerformance.cancelledStaleFrames += 1;
  }
  duelModeRenderFrame = 0;
  if (!els.duelLeftSelect || !els.duelRightSelect || !state.characterCards) return;
  const cards = getDuelCharacterCards();
  if (!cards.length) {
    commitDuelHtml(els.duelSummary, `<p class="muted">暂无可用角色卡。</p>`);
    commitDuelHtml(els.duelCards, "");
    syncDuelBattleFocusMode(null);
    syncDuelModeIsolation();
    return;
  }

  syncDuelSelectOptions(cards);
  const dounaPage = isDounaBattlePageActive();
  let left = null;
  let right = null;
  if (state.duelBattle?.left && state.duelBattle?.right) {
    left = state.duelBattle.left;
    right = state.duelBattle.right;
  } else if (dounaPage) {
    const selectedId = getDounaRosterSelectionIds()[0] || cards.find((item) => !isDounaSukunaCard(item))?.characterId || cards[0]?.characterId;
    left = evaluateDuelCharacterById(selectedId, "left");
    right = buildDounaSukunaProfile(1);
  } else {
    const leftCard = cards.find((item) => item.characterId === els.duelLeftSelect.value) || cards[0];
    const rightCard = cards.find((item) => item.characterId === els.duelRightSelect.value) || cards[1] || cards[0];
    left = applyDuelSideDebugOverride(evaluateDuelCharacterCard(leftCard), "left");
    right = applyDuelSideDebugOverride(evaluateDuelCharacterCard(rightCard), "right");
  }
  if (!left || !right) {
    if (els.duelSummary) {
      commitDuelHtml(els.duelSummary, `<p class="muted">${dounaPage ? "未找到宿傩或挑战者角色数据，无法生成斗傩大陆赛前情报。" : "暂无可用对战角色数据。"}</p>`);
    }
    commitDuelHtml(els.duelCards, "");
    syncDuelBattleFocusMode(null);
    syncDuelModeIsolation();
    return;
  }

  const leftLabel = getDuelPerspectiveSideLabel("left", state.duelBattle);
  const rightLabel = getDuelPerspectiveSideLabel("right", state.duelBattle);
  commitDuelHtml(els.duelSummary, `
    <div class="duel-match-summary-card">
      <span>${escapeHtml(leftLabel)}</span>
      <strong>${escapeHtml(left.name)}</strong>
      <small>${escapeHtml(getDuelDisplayGrade(left))} · ${escapeHtml(getDuelPowerTierLabel(left))}</small>
    </div>
    <div class="duel-versus">VS</div>
    <div class="duel-match-summary-card right">
      <span>${escapeHtml(rightLabel)}</span>
      <strong>${escapeHtml(right.name)}</strong>
      <small>${escapeHtml(getDuelDisplayGrade(right))} · ${escapeHtml(getDuelPowerTierLabel(right))}</small>
    </div>
  `);
  renderDuelDebugStatus(left, right);
  renderDuelBattlePanel(left, right, 0.5);
  commitDuelHtml(
    els.duelCards,
    `${renderDuelCharacterCard(left, leftLabel)}${renderDuelCharacterCard(right, rightLabel)}${renderDuelCharacterRankReferenceTable()}`
  );
  syncDuelModeIsolation();
  if (dounaPage) refreshDounaLeaderboard().catch(() => {});
}

function getCurrentDuelProfiles() {
  const cards = getDuelCharacterCards();
  const leftCard = cards.find((item) => item.characterId === els.duelLeftSelect?.value) || cards[0];
  const rightCard = cards.find((item) => item.characterId === els.duelRightSelect?.value) || cards[1] || cards[0];
  if (!leftCard || !rightCard) return null;
  const left = applyDuelSideDebugOverride(evaluateDuelCharacterCard(leftCard), "left");
  const right = applyDuelSideDebugOverride(evaluateDuelCharacterCard(rightCard), "right");
  return {
    left,
    right,
    leftRate: 0.5
  };
}

function getDounaRosterSelects() {
  return Array.from(els.dounaRosterSelects || []);
}

function isDounaSukunaCard(card) {
  const id = String(card?.characterId || card?.id || card?.battleCharacterId || "");
  return /douna_sukuna_boss|douna_sukuna_life_[12]/i.test(id);
}

function findDounaSukunaCard(cards = getDuelCharacterCards()) {
  return cards.find(isDounaSukunaCard) || null;
}

function hasDounaSukunaRuntimeCard() {
  return true;
}

function buildDounaSukunaRuntimeCard(life = 1) {
  const rctTags = ["rct_user", "reverse_cursed_technique", "healing", "output_rct"];
  const tags = life === 1
    ? ["douna_sukuna_boss", "douna_sukuna_life_1", "sukuna", "shrine", "world_slash", "malevolent_shrine", "ten_shadows", ...rctTags]
    : ["douna_sukuna_boss", "douna_sukuna_life_2", "sukuna", "shrine", "world_slash", "malevolent_shrine", ...rctTags];
  return {
    characterId: `douna_sukuna_life_${life}`,
    battleCharacterId: "douna_sukuna_boss",
    battleCharacterName: "两面宿傩",
    displayName: life === 1 ? "两面宿傩（斗傩第一命）" : "两面宿傩（斗傩第二命）",
    name: life === 1 ? "两面宿傩（斗傩第一命）" : "两面宿傩（斗傩第二命）",
    stage: "douna_boss",
    baseStats: life === 2
      ? { cursedEnergy: "SS", control: "SSS", efficiency: "S", body: "SSS", martial: "EX-", talent: "SSS" }
      : { cursedEnergy: "SSS", control: "SSS", efficiency: "S", body: "SSS", martial: "SSS", talent: "SSS" },
    techniqueName: life === 1 ? "Shrine / Ten Shadows" : "Shrine",
    techniqueDescription: life === 1
      ? "Dedicated Douna boss profile. This runtime card is separate from the normal playable Sukuna character."
      : "Dedicated second-life Douna boss profile without Ten Shadows or domain privileges.",
    domainId: life === 1 ? "sukuna_malevolent_shrine" : "",
    domainProfile: life === 1 ? "Malevolent Shrine" : "",
    domainScript: null,
    externalResource: life === 1 ? "Douna boss-only Sukuna runtime source, not selectable as normal solo character." : "Douna boss-only Sukuna second life runtime source.",
    advancedTechniques: ["World Slash", "Reverse Cursed Technique"],
    innateTraits: life === 1 ? ["已调幅魔虚罗"] : [],
    traits: ["sukuna", "boss_only", "douna_boss", "shrine", "ten_shadows", "open_domain", ...(life === 1 ? ["已调幅魔虚罗"] : [])],
    cardTags: tags.slice(),
    specialHandTags: tags.slice(),
    flags: { hasCe: true, hasInnateTechnique: true, hasDomainAccess: life === 1, isDounaBoss: true, hasRctOutputAccess: true }
  };
}

function restoreDuelAutoRunScroll(battle = state.duelBattle) {
  if (battle?.mode === "online") return;
  const target = battle?.autoRunScrollTarget;
  if (!target || typeof window === "undefined" || typeof window.scrollTo !== "function") return;
  const shouldClear = !battle.autoRunning;
  if (battle.autoRunScrollTarget === target) {
    const anchor = target.anchorSelector ? document.querySelector(target.anchorSelector) : null;
    const anchorDelta = anchor && Number.isFinite(target.anchorTop)
      ? anchor.getBoundingClientRect().top - target.anchorTop
      : 0;
    if (!anchor || Math.abs(anchorDelta) >= 1) {
      const currentTop = Number.isFinite(window.scrollY) ? window.scrollY : target.y;
      const nextTop = Math.max(0, anchor ? currentTop + anchorDelta : target.y);
      try {
        window.scrollTo({ left: target.x, top: nextTop, behavior: "auto" });
      } catch {
        window.scrollTo(target.x, nextTop);
      }
      duelRenderPerformance.scrollCorrections += 1;
    }
    if (shouldClear) delete battle.autoRunScrollTarget;
  }
}
function buildDounaSukunaProfile(life = 1) {
  const card = buildDounaSukunaRuntimeCard(life);
  const profile = applyDuelSideDebugOverride(evaluateDuelCharacterCard(card), "right");
  profile.id = `douna_sukuna_life_${life}`;
  profile.characterId = `douna_sukuna_life_${life}`;
  profile.battleCharacterId = "douna_sukuna_boss";
  profile.name = card.displayName;
  profile.displayName = card.displayName;
  profile.specialHandTags = card.specialHandTags.slice();
  profile["特殊手札"] = card.specialHandTags.slice();
  profile.explicitSpecialHandTags = card.specialHandTags.slice();
  profile.characterCardProfile = card;
  profile.techniqueText = `${card.techniqueName} / ${card.techniqueDescription}`;
  profile.externalResource = card.externalResource;
  profile.flags = Array.from(new Set([...(profile.flags || []), ...card.specialHandTags, ...(life === 1 ? ["douna_subdued_mahoraga", "已调伏魔虚罗"] : [])]))
    .filter((flag) => !/limitless|gojo/i.test(String(flag || "")));
  if (life === 2) {
    profile.flags = profile.flags.filter((flag) => !/ten[_-]?shadows|domain|openDomain|topDomain|customDomain/i.test(String(flag || "")));
  }
  return profile;
}

function getDounaRosterSelectionIds() {
  return getDounaRosterSelects().map((select) => String(select.value || "").trim()).filter(Boolean);
}

function collapseDounaLeaderboard() {
  const details = document.querySelector("#dounaLeaderboardDetails");
  if (details) details.open = false;
}

function renderDounaSetupStatus() {
  if (!els.dounaStatus) return;
  const ids = getDounaRosterSelectionIds();
  const uniqueCount = new Set(ids).size;
  if (ids.length < 5) {
    els.dounaStatus.textContent = `还需要选择 ${5 - ids.length} 名角色。`;
    return;
  }
  if (uniqueCount < 5) {
    els.dounaStatus.textContent = "5 名挑战者必须不同，避免同一角色连续刷新。";
    return;
  }
  els.dounaStatus.textContent = "已选择 5 名挑战者，可以开始挑战宿傩。";
}

function syncDounaRosterOptions(cards = getDuelCharacterCards()) {
  const selects = getDounaRosterSelects();
  if (!selects.length) return;
  const options = cards.map((card) => `<option value="${escapeHtml(card.characterId)}">${escapeHtml(getDuelCardOptionLabel(card))}</option>`).join("");
  selects.forEach((select, index) => {
    const value = select.value;
    if (select.options.length !== cards.length || select.dataset.optionSignature !== options) {
      select.innerHTML = options;
      select.dataset.optionSignature = options;
    }
    const fallback = cards.find((card) => !isDounaSukunaCard(card) && !selects.some((other, otherIndex) => otherIndex < index && other.value === card.characterId)) || cards[index] || cards[0];
    select.value = cards.some((card) => card.characterId === value) ? value : (fallback?.characterId || "");
  });
  renderDounaSetupStatus();
}

function autoFillDounaRoster() {
  const cards = getDuelCharacterCards().filter((card) => !isDounaSukunaCard(card));
  const fallbackCards = cards.length >= 5 ? cards : getDuelCharacterCards();
  getDounaRosterSelects().forEach((select, index) => {
    select.value = fallbackCards[index]?.characterId || fallbackCards[0]?.characterId || "";
  });
  renderDounaSetupStatus();
  requestDuelModeRender();
}

function getDounaOnlineHpMultiplier(options = {}) {
  if (!options.online) return 1;
  const humanCount = Math.max(1, Math.min(5, Math.floor(Number(options.humanPlayerCount || 1) || 1)));
  return Number((1 + Math.max(0, humanCount - 1) * 0.18).toFixed(2));
}

function normalizeDounaChallengeMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "wheel" || text === "gauntlet" || text === "rotate" || text === "车轮战") return "wheel";
  if (text === "raid" || text === "together" || text === "all" || text === "五人一起上" || text === "同战") return "raid";
  return "raid";
}

function getDounaChallengeModeLabel(value) {
  return normalizeDounaChallengeMode(value) === "wheel" ? "车轮战" : "五人一起上";
}

function getSelectedDounaChallengeMode() {
  return normalizeDounaChallengeMode(document.querySelector("#dounaBattleModeSelect")?.value || "raid");
}

function getDounaRosterBaseHp(profile) {
  return Math.max(1, Math.round(Number(profile?.maxHp || profile?.hp || profile?.computedHp || profile?.resourceState?.maxHp || 0) || 360));
}

function createDounaRosterResourceSnapshot(profile = {}, index = 0) {
  const slot = `douna${Math.max(0, Math.round(Number(index || 0))) + 1}`;
  const maxHp = getDounaRosterBaseHp(profile);
  let resource = null;
  try {
    resource = deriveDuelResourcesFromProfile(clonePlain(profile), null, "left");
  } catch (error) {
    resource = null;
  }
  if (!resource || typeof resource !== "object") {
    resource = {
      id: String(profile?.characterId || profile?.id || slot),
      name: String(profile?.name || profile?.displayName || `挑战者 ${index + 1}`),
      characterCardProfile: clonePlain(profile),
      baseStats: clonePlain(profile?.baseStats || profile?.stats || {}),
      raw: clonePlain(profile?.raw || {}),
      axes: clonePlain(profile?.axes || {}),
      statusEffects: clonePlain(profile?.statusEffects || []),
      domain: clonePlain(profile?.domain || {})
    };
  }
  // Counter/status pipelines only accept canonical battle sides. Keep each
  // roster identity in dounaRosterSlot while resolving it as a left-side
  // challenger resource.
  resource.side = "left";
  resource.dounaRosterSlot = slot;
  resource.name = String(resource.name || profile?.name || profile?.displayName || `挑战者 ${index + 1}`);
  resource.maxHp = maxHp;
  resource.hp = maxHp;
  resource.statusEffects = Array.isArray(resource.statusEffects) ? resource.statusEffects : [];
  resource.dounaRosterSnapshot = true;
  return resource;
}

function createDounaDamageShareEntries(roster = []) {
  return (Array.isArray(roster) ? roster : []).slice(0, 5).map((profile, index) => {
    const name = String(profile?.name || profile?.displayName || `挑战者 ${index + 1}`).trim().slice(0, 80) || `挑战者 ${index + 1}`;
    const maxHp = getDounaRosterBaseHp(profile);
    return {
      index,
      slot: `douna${index + 1}`,
      name,
      totalRawDamage: 0,
      thresholds: [],
      maxHp,
      hp: maxHp,
      defeated: false,
      resourceSnapshot: createDounaRosterResourceSnapshot(profile, index)
    };
  });
}

function patchDounaSukunaResourceForLife(resource, life = 1, options = {}) {
  if (!resource) return;
  const hpMultiplier = getDounaOnlineHpMultiplier(options);
  const baseHp = life === 1 ? 720 : 520;
  const targetHp = Math.round(baseHp * hpMultiplier);
  resource.raw = { ...(resource.raw || {}) };
  resource.axes = { ...(resource.axes || {}) };
  resource.raw.martialScore = Math.max(Number(resource.raw.martialScore || resource.raw.bodyScore || 0) || 0, life === 1 ? 10 : 9.2);
  resource.raw.bodyScore = Math.max(Number(resource.raw.bodyScore || 0) || 0, life === 1 ? 9.8 : 9);
  resource.axes.body = Math.max(Number(resource.axes.body || 0) || 0, life === 1 ? 9.8 : 9);
  resource.maxHp = targetHp;
  resource.hp = targetHp;
  const rctTags = ["rct_user", "reverse_cursed_technique", "反转术式", "反转术式疗伤"];
  resource.specialHandTags = ["World Slash"].concat(life === 1 ? ["ten_shadows", "shrine"] : ["shrine"], rctTags);
  resource["特殊手札"] = resource.specialHandTags.slice();
  resource.explicitSpecialHandTags = resource.specialHandTags.slice();
  resource.advancedTechniques = Array.from(new Set([...(resource.advancedTechniques || []), "反转术式外放"]));
  resource.statusEffects = Array.isArray(resource.statusEffects) ? resource.statusEffects : [];
  resource.statusEffects.push({
    id: life === 1 ? "dounaSukunaFirstLife" : "dounaSukunaSecondLife",
    label: life === 1 ? "斗傩第一命" : "斗傩第二命",
    rounds: 999,
    value: 1
  });
  resource.statusEffects.push({
    id: "dounaSukunaDefense",
    label: life === 1 ? "斩击护身" : "斩击护身·强化",
    rounds: 999,
    value: life === 1 ? 0.18 : 2.8
  });
  if (life === 2) {
    resource.statusEffects.push({
      id: "dounaSukunaSecondLifeOutput",
      label: "第二命斩击输出",
      rounds: 999,
      value: 1.2,
      outgoingScale: 2.2
    });
  }
  if (life === 1) {
    resource.domain ||= {};
    resource.domain.threshold = Math.max(1, Number(resource.domain.threshold || 0) || 100);
    resource.domain.load = 0;
    resource.domain.meltdownRisk = 0;
    resource.domain.active = false;
    resource.domain.name = resource.domain.name || "伏魔御厨子";
    resource.statusEffects.push({
      id: "dounaSubduedMahoraga",
      label: "已调伏魔虚罗",
      rounds: 999,
      value: 1
    });
  }
  if (life === 2 && resource.domain) {
    resource.domain.active = false;
    resource.domain.load = 0;
    resource.domain.threshold = 0;
  }
  clampDuelResource(resource);
}

function initializeDounaGauntletBattle(battle, config = {}) {
  if (!battle) return;
  const roster = Array.isArray(config.roster) ? config.roster.map((profile) => clonePlain(profile)).filter(Boolean) : [];
  const rosterNames = roster.map((profile) => profile?.name || profile?.displayName || "未命名挑战者").slice(0, 5);
  const rosterTotalCombatPower = roster.reduce((sum, profile) => sum + Math.max(0, Number(profile?.combatPowerUnit?.value || 0) || 0), 0);
  battle.dounaGauntlet = {
    roster,
    rosterNames,
    rosterTotalCombatPower: Math.round(rosterTotalCombatPower),
    challengeMode: normalizeDounaChallengeMode(config.challengeMode || config.dounaBattleMode),
    totalDamageTaken: 0,
    totalRawDamageDealt: 0,
    damageBySlot: createDounaDamageShareEntries(roster),
    damageBroadcasts: [],
    broadcastThresholds: [10, 25, 50, 75],
    bossTotalHpBudget: 0,
    maxRawDamage: 0,
    maxRawDamageAction: "",
    maxRawDamageRound: 0,
    deaths: 0,
    leaderboardSubmitted: false,
    online: Boolean(config.online),
    onlineRoomId: String(config.onlineRoomId || ""),
    onlineTeamName: String(config.onlineTeamName || ""),
    onlinePlayerSide: String(config.onlinePlayerSide || config.playerSide || ""),
    currentIndex: Math.max(0, Number(config.currentIndex || 0)),
    bossLife: 1,
    worldSlashGranted: false,
    worldSlashUsed: false,
    boundWorldSlashUsed: false,
    pendingBoundWorldSlash: null
  };
  battle.dounaGauntlet.humanPlayerCount = Math.max(1, Math.min(5, Math.floor(Number(config.humanPlayerCount || 1) || 1)));
  battle.dounaGauntlet.hpMultiplier = getDounaOnlineHpMultiplier({
    online: battle.dounaGauntlet.online,
    humanPlayerCount: battle.dounaGauntlet.humanPlayerCount
  });
  battle.dounaGauntlet.bossTotalHpBudget = Math.round((720 + 520) * battle.dounaGauntlet.hpMultiplier);
  patchDounaSukunaResourceForLife(battle.resourceState?.p2, 1, battle.dounaGauntlet);
  battle.cpuDifficulty = "hard";
  battle.cpuDifficultyLabel = "困难：强规划";
  battle.cpuComputeMode = normalizeDuelCpuComputeMode(state.duelCpuComputeMode || getSelectedDuelCpuComputeMode());
  battle.cpuComputeModeLabel = getDuelCpuComputeModeLabel(battle.cpuComputeMode);
  battle.safetyRoundCap = Math.max(Number(battle.safetyRoundCap || 0), 80);
  battle.maxRounds = Math.max(Number(battle.maxRounds || 0), 80);
  battle.log.unshift({
    round: battle.round || 0,
    title: "斗傩大陆开战",
    detail: `宿傩以第一命登场：${formatNumber(battle.resourceState?.p2?.maxHp || 720)} HP，御厨子与十影同时可用，当前仅有削弱版斩击护身；挑战方式=${getDounaChallengeModeLabel(battle.dounaGauntlet.challengeMode)}${battle.dounaGauntlet.online ? `；联机真人挑战者 ${formatNumber(battle.dounaGauntlet.humanPlayerCount)} 人，血量倍率 ${formatNumber(battle.dounaGauntlet.hpMultiplier)}x` : ""}。`
  });
}

function startDounaGauntletBattle() {
  const ids = getDounaRosterSelectionIds();
  if (ids.length < 5 || new Set(ids).size < 5) {
    void globalThis.JJKDomModal?.alert("斗傩大陆需要选择 5 名不同角色。");
    renderDounaSetupStatus();
    return;
  }
  const roster = ids.map((id) => evaluateDuelCharacterById(id, "left")).filter(Boolean);
  if (roster.length < 5) {
    void globalThis.JJKDomModal?.alert("挑战者角色数据不足，请刷新角色池后重试。");
    return;
  }
  const sukuna = buildDounaSukunaProfile(1);
  if (!sukuna) {
    void globalThis.JJKDomModal?.alert("未找到可用于斗傩大陆的宿傩角色数据。");
    return;
  }
  startDuelBattle({
    mode: "solo",
    left: roster[0],
    right: sukuna,
    cpuDifficulty: "hard",
    dounaGauntlet: { roster, challengeMode: getSelectedDounaChallengeMode() }
  });
  collapseDounaLeaderboard();
}

function startOnlineDounaGauntletBattle(roster = [], options = {}) {
  purgeLegacyOnlineDounaImportedCharacters(options.roomId || options.snapshot?.roomId || "");
  const normalizedRoster = (Array.isArray(roster) ? roster : [])
    .map((profile) => normalizeDounaRosterBattleProfile(profile, "left"))
    .filter(Boolean)
    .slice(0, 5);
  if (normalizedRoster.length < 5) throw new Error("斗傩大陆联机房间需要 5 名挑战者。");
  const sukuna = buildDounaSukunaProfile(1);
  if (!sukuna) throw new Error("未找到可用于斗傩大陆的宿傩角色数据。");
  const challengeMode = normalizeDounaChallengeMode(options.challengeMode || options.dounaBattleMode || options.snapshot?.dounaBattleMode);
  const playerSide = String(options.playerSide || options.onlinePlayerSide || "");
  const playerIndex = /^douna[1-5]$/.test(playerSide) ? Math.max(0, Number(playerSide.replace("douna", "")) - 1) : 0;
  const activeIndex = challengeMode === "raid" ? Math.min(normalizedRoster.length - 1, playerIndex) : 0;
  startDuelBattle({
    mode: "online",
    allowOnline: true,
    left: normalizedRoster[activeIndex],
    right: sukuna,
    cpuDifficulty: "hard",
    spectator: Boolean(options.spectator),
    snapshot: options.snapshot || null,
    dounaGauntlet: {
      roster: normalizedRoster,
      challengeMode,
      online: true,
      onlineRoomId: options.roomId || options.snapshot?.roomId || "",
      onlineTeamName: options.teamName || "",
      onlinePlayerSide: playerSide,
      currentIndex: activeIndex,
      humanPlayerCount: Math.max(1, Math.min(5, Math.floor(Number(options.humanPlayerCount || 1) || 1)))
    }
  });
  collapseDounaLeaderboard();
}

function grantDounaWorldSlashIfNeeded(battle) {
  const gauntlet = battle?.dounaGauntlet;
  const boss = battle?.resourceState?.p2;
  if (!gauntlet || gauntlet.bossLife !== 1 || gauntlet.worldSlashGranted || !boss) return false;
  if (Number(boss.hp || 0) >= 150) return false;
  gauntlet.worldSlashGranted = true;
  boss.statusEffects ||= [];
  if (!boss.statusEffects.some((effect) => effect?.id === "dounaLowHpSlashShield")) {
    boss.statusEffects.push({
      id: "dounaLowHpSlashShield",
      label: "临界斩击护盾",
      rounds: 999,
      value: 1,
      remainingReduction: 100
    });
  }
  recordDuelResourceChange(battle, {
    side: "right",
    title: "世界斩入手",
    detail: "宿傩第一命体势低于 150，获得特殊手札「世界斩」，并展开最多抵消 100 伤害的临界斩击护盾（减伤 20%）。",
    type: "system",
    delta: { dounaWorldSlashGranted: true, dounaLowHpSlashShield: true }
  });
  return true;
}

function transitionDounaSukunaSecondLife(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet || gauntlet.bossLife !== 1) return false;
  const secondLifeProfile = buildDounaSukunaProfile(2);
  if (!secondLifeProfile) return false;
  gauntlet.bossLife = 2;
  gauntlet.worldSlashGranted = true;
  gauntlet.boundWorldSlashUsed = false;
  gauntlet.pendingBoundWorldSlash = null;
  battle.right = secondLifeProfile;
  battle.resourceState.p2 = deriveDuelResourcesFromProfile(secondLifeProfile, null, "right");
  patchDounaSukunaResourceForLife(battle.resourceState.p2, 2, gauntlet);
  battle.domainProfileStates ||= {};
  delete battle.domainProfileStates.right;
  if (battle.domainSubPhase?.owner === "right") battle.domainSubPhase = null;
  if (battle.handState) delete battle.handState.right;
  if (battle.domainHandState) delete battle.domainHandState.right;
  if (battle.actionPoints) delete battle.actionPoints.right;
  if (battle.selectedHandActions) battle.selectedHandActions.right = [];
  initializeDuelHandState(battle);
  updateDuelActionAvailability(battle);
  recordDuelResourceChange(battle, {
    side: "right",
    title: "第二命显现",
    detail: `宿傩第一命归零后进入第二命：${formatNumber(battle.resourceState?.p2?.maxHp || 520)} HP，体术 EX-，咒力总量 SS，失去十影与领域，并获得「束缚世界斩」。`,
    type: "system",
    delta: { dounaBossLife: 2 }
  });
  return true;
}

function advanceDounaChallenger(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet) return false;
  if (isDounaRaidBattle(battle)) {
    syncDounaRaidCurrentPlayerHp(battle);
    return false;
  }
  const nextIndex = Number(gauntlet.currentIndex || 0) + 1;
  if (nextIndex >= gauntlet.roster.length) return false;
  const defeated = battle.resourceState?.p1;
  const defeatedMaxHp = Math.max(0, Number(defeated?.maxHp || defeated?.hp || 0) || 0);
  const defeatedHp = Math.max(0, Number(defeated?.hp || 0) || 0);
  gauntlet.totalDamageTaken = Math.round(Number(gauntlet.totalDamageTaken || 0) + Math.min(defeatedMaxHp, Math.max(0, defeatedMaxHp - defeatedHp)));
  gauntlet.deaths = Math.min(5, Number(gauntlet.deaths || 0) + 1);
  gauntlet.currentIndex = nextIndex;
  const nextProfile = clonePlain(gauntlet.roster[nextIndex]);
  battle.left = applyDuelSideDebugOverride(nextProfile, "left");
  battle.resourceState.p1 = deriveDuelResourcesFromProfile(battle.left, null, "left");
  if (battle.handState) delete battle.handState.left;
  if (battle.domainHandState) delete battle.domainHandState.left;
  if (battle.actionPoints) delete battle.actionPoints.left;
  if (battle.selectedHandActions) battle.selectedHandActions.left = [];
  battle.currentActions = [];
  battle.currentAction = null;
  battle.pendingAction = null;
  const swapText = `第 ${formatNumber(nextIndex + 1)} 位挑战者「${battle.left.name}」上阵`;
  battle.dounaSwapNotice = {
    text: swapText,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600
  };
  showDounaSwapPopup(swapText);
  initializeDuelHandState(battle);
  updateDuelActionAvailability(battle);
  recordDuelResourceChange(battle, {
    side: "left",
    title: "挑战者更替",
    detail: `第 ${formatNumber(nextIndex + 1)} 位挑战者「${battle.left.name}」上阵。宿傩保留当前状态。`,
    type: "system",
    delta: { dounaChallengerIndex: nextIndex }
  });
  return true;
}

function resolveDounaPendingBoundWorldSlash(battle) {
  const gauntlet = battle?.dounaGauntlet;
  const pending = gauntlet?.pendingBoundWorldSlash;
  if (!pending || pending.resolved) return false;
  const turn = Number(battle.round || 0) + 1;
  if (turn < Number(pending.triggerTurn || 0)) return false;
  const target = getDuelResourcePair(battle, pending.targetSide || "left");
  if (!target) return false;
  const boss = getDuelResourcePair(battle, "right");
  const evasion = resolveDuelEvasionCheck({
    battle,
    actor: boss,
    opponent: target,
    profile: "world_slash",
    label: "douna_bound_world_slash",
    damage: Math.max(1, Number(target.hp || target.maxHp || 1)),
    hitRateModifier: Number(pending.hitRateModifier || 0)
  });
  const hitRate = evasion.checked ? evasion.hitRate : clamp(Number(pending.hitRate || 0.7), 0, 1);
  const roll = evasion.checked ? evasion.roll : duelRandom(battle, "douna_bound_world_slash");
  pending.resolved = true;
  gauntlet.pendingBoundWorldSlash = null;
  if (roll <= hitRate) {
    target.hp = 0;
    recordDuelResourceChange(battle, {
      side: "right",
      title: "束缚世界斩生效",
      detail: `世界斩抹杀。命中率 ${formatPercent(hitRate)}，掷值 ${formatPercent(roll)}，体术差 ${formatNumber(evasion.martialDiff || 0)}，闪避加成 ${formatPercent(evasion.defenderEvasionBonus || 0)}。`,
      type: "action",
      delta: { dounaBoundWorldSlashHit: true, roll: Number(roll.toFixed(4)), hitRate, evasion }
    });
  } else {
    recordDuelResourceChange(battle, {
      side: "left",
      title: "束缚世界斩落空",
      detail: `宿傩的束缚世界斩被避开。命中率 ${formatPercent(hitRate)}，掷值 ${formatPercent(roll)}，体术差 ${formatNumber(evasion.martialDiff || 0)}，闪避加成 ${formatPercent(evasion.defenderEvasionBonus || 0)}。`,
      type: "action",
      delta: { dounaBoundWorldSlashHit: false, roll: Number(roll.toFixed(4)), hitRate, evasion }
    });
  }
  handleDounaGauntletTransitions(battle);
  return true;
}

function estimateDounaRaidAllyRawDamage(profile) {
  const combat = Math.max(0, Number(profile?.combatPowerUnit?.value || profile?.combatPower || 0) || 0);
  const raw = profile?.raw || {};
  const axes = profile?.axes || {};
  const technique = Math.max(Number(raw.techniqueScore || 0) || 0, Number(axes.technique || 0) || 0, Number(raw.ceScore || 0) || 0);
  const martial = Math.max(Number(raw.martialScore || raw.bodyScore || 0) || 0, Number(axes.body || 0) || 0);
  return Math.max(10, Math.min(110, Math.round(14 + combat / 330 + technique * 2.4 + martial * 1.2)));
}

function getDounaRosterResourceSnapshot(battle, index) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet) return null;
  const safeIndex = Math.max(0, Math.round(Number(index || 0) || 0));
  const entry = Array.isArray(gauntlet.damageBySlot) ? gauntlet.damageBySlot[safeIndex] : null;
  const profile = Array.isArray(gauntlet.roster) ? gauntlet.roster[safeIndex] : null;
  if (!entry || !profile) return null;
  if (!entry.resourceSnapshot || typeof entry.resourceSnapshot !== "object") {
    entry.resourceSnapshot = createDounaRosterResourceSnapshot(profile, safeIndex);
  }
  const resource = entry.resourceSnapshot;
  resource.side = "left";
  resource.dounaRosterSlot = entry.slot || `douna${safeIndex + 1}`;
  resource.name = entry.name || resource.name || `挑战者 ${safeIndex + 1}`;
  resource.maxHp = Math.max(1, Number(entry.maxHp || resource.maxHp || getDounaRosterBaseHp(profile)) || 1);
  resource.hp = Math.max(0, Math.min(resource.maxHp, Number(entry.hp ?? resource.hp ?? resource.maxHp) || 0));
  resource.statusEffects = Array.isArray(resource.statusEffects) ? resource.statusEffects : [];
  return resource;
}

function applyDounaRaidAllyAssist(battle) {
  const gauntlet = battle?.dounaGauntlet;
  const boss = battle?.resourceState?.p2;
  if (!gauntlet || !isDounaRaidBattle(battle) || !boss || Number(boss.hp || 0) <= 0) return false;
  const roundKey = Math.max(1, Math.round(Number(battle.round || 0) + 1));
  if (gauntlet.lastRaidAssistRound === roundKey) return false;
  gauntlet.lastRaidAssistRound = roundKey;
  const localIndex = getDounaLocalPlayerIndex(battle);
  let totalApplied = 0;
  (gauntlet.roster || []).forEach((profile, index) => {
    if (index === localIndex || Number(boss.hp || 0) <= 0) return;
    const entry = getDounaDamageShareEntry(battle, index);
    if (entry?.defeated) return;
    const raw = estimateDounaRaidAllyRawDamage(profile);
    const ally = getDounaRosterResourceSnapshot(battle, index);
    if (!ally) return;
    const action = {
      id: `douna_raid_ally_assist_${index + 1}`,
      label: `${entry?.name || ally.name || `挑战者 ${index + 1}`}·协同攻击`,
      cardType: "special",
      damageType: "douna_raid_assist"
    };
    const application = applyDuelStandardDamageToTarget({
      type: "character",
      resource: boss,
      side: boss.side || "right",
      id: boss.id || "douna_sukuna",
      name: boss.name || "宿傩"
    }, raw, battle, {
      actor: ally,
      opponent: boss,
      action,
      sourceKind: "douna_raid_assist",
      source: "douna-raid-ally-assist",
      sourceLabel: action.label
    });
    const applied = Number(application?.applied || 0);
    if (applied <= 0) return;
    totalApplied += applied;
    recordDounaRawDamage(battle, "left", { label: "五人同战协同攻击", dounaOwnerIndex: index }, raw);
  });
  if (totalApplied > 0) {
    clampDuelResource(boss);
    recordDuelResourceChange(battle, {
      side: "left",
      title: "五人同战协同攻击",
      detail: `其余挑战者本轮合计造成 ${formatNumber(totalApplied)} 点实际伤害。`,
      type: "douna_raid_assist",
      delta: { damage: totalApplied }
    });
    return true;
  }
  return false;
}

function syncDounaRaidCurrentPlayerHp(battle) {
  if (!isDounaRaidBattle(battle)) return;
  const entry = getDounaDamageShareEntry(battle, getDounaLocalPlayerIndex(battle));
  const current = battle?.resourceState?.p1;
  if (!entry || !current) return;
  entry.maxHp = Math.max(entry.maxHp || 0, Number(current.maxHp || 0) || 0);
  entry.hp = Math.max(0, Number(current.hp || 0) || 0);
  entry.defeated = entry.defeated || entry.hp <= 0;
}

function applyDounaRaidBossHandToAllies(battle, rightHandResult) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet || !isDounaRaidBattle(battle) || !rightHandResult?.applied) return false;
  const roundKey = Math.max(1, Math.round(Number(battle.round || 0) + 1));
  if (gauntlet.lastRaidBossPressureRound === roundKey) return false;
  gauntlet.lastRaidBossPressureRound = roundKey;
  syncDounaRaidCurrentPlayerHp(battle);
  const localIndex = getDounaLocalPlayerIndex(battle);
  const results = Array.isArray(rightHandResult.results) ? rightHandResult.results : [];
  const damagePackets = results.map((item, resultIndex) => ({
    rawDamage: getDounaActionRawDamageValue(item?.result),
    action: item?.action || {
      id: `douna_raid_boss_pressure_${resultIndex + 1}`,
      label: "宿傩全体压制",
      cardType: "special",
      damageType: "douna_raid_boss_pressure"
    }
  })).filter((packet) => packet.rawDamage > 0);
  const rawTotal = damagePackets.reduce((sum, packet) => sum + packet.rawDamage, 0);
  if (rawTotal <= 0) return false;
  let defeated = 0;
  let totalApplied = 0;
  const damageBySlot = [];
  const boss = battle?.resourceState?.p2;
  (gauntlet.damageBySlot || []).forEach((entry, index) => {
    if (!entry || index === localIndex || entry.defeated) return;
    const target = getDounaRosterResourceSnapshot(battle, index);
    if (!target) return;
    let slotApplied = 0;
    damagePackets.forEach((packet) => {
      if (Number(target.hp || 0) <= 0) return;
      const application = applyDuelStandardDamageToTarget({
        type: "character",
        resource: target,
        side: entry.slot || `douna${index + 1}`,
        id: target.id || entry.slot || `douna${index + 1}`,
        name: target.name || entry.name || `挑战者 ${index + 1}`
      }, packet.rawDamage, battle, {
        actor: boss,
        opponent: target,
        action: packet.action,
        sourceKind: "douna_raid_boss_pressure",
        source: "douna-raid-boss-pressure",
        sourceLabel: packet.action?.label || packet.action?.name || "宿傩全体压制"
      });
      slotApplied += Number(application?.applied || 0);
    });
    entry.hp = Math.max(0, Number(target.hp || 0));
    totalApplied += slotApplied;
    damageBySlot.push({ index, name: entry.name, rawDamage: rawTotal, appliedDamage: Number(slotApplied.toFixed(1)) });
    if (entry.hp <= 0 && !entry.defeated) {
      entry.defeated = true;
      defeated += 1;
      gauntlet.deaths = Math.min(5, Math.round(Number(gauntlet.deaths || 0) + 1));
    }
  });
  gauntlet.totalDamageTaken = Math.round(Number(gauntlet.totalDamageTaken || 0) + totalApplied);
  recordDuelResourceChange(battle, {
    side: "right",
    title: "宿傩全体压制",
    detail: `五人同战中，宿傩本轮手札对所有挑战者生效。非当前视角挑战者合计承受 ${formatNumber(totalApplied)} 点实际伤害（每人原始压力 ${formatNumber(rawTotal)}）${defeated ? `，${formatNumber(defeated)} 人倒下` : ""}。`,
    type: "douna_raid_boss_pressure",
    delta: { rawDamageToEach: rawTotal, totalAppliedDamage: Number(totalApplied.toFixed(1)), damageBySlot, defeated }
  });
  return totalApplied > 0;
}

function advanceDounaRaidPerspectiveIfNeeded(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet || !isDounaRaidBattle(battle) || Number(battle.resourceState?.p1?.hp || 0) > 0) return false;
  syncDounaRaidCurrentPlayerHp(battle);
  const currentIndex = getDounaLocalPlayerIndex(battle);
  const nextEntry = (gauntlet.damageBySlot || []).find((entry) => entry && !entry.defeated && entry.index !== currentIndex);
  if (!nextEntry) return false;
  gauntlet.currentIndex = nextEntry.index;
  gauntlet.onlinePlayerSide = nextEntry.slot;
  const nextProfile = clonePlain(gauntlet.roster[nextEntry.index]);
  battle.left = applyDuelSideDebugOverride(nextProfile, "left");
  battle.resourceState.p1 = deriveDuelResourcesFromProfile(battle.left, null, "left");
  battle.resourceState.p1.hp = Math.max(1, Math.min(Number(battle.resourceState.p1.maxHp || 1), Number(nextEntry.hp || nextEntry.maxHp || 1)));
  if (battle.handState) delete battle.handState.left;
  if (battle.domainHandState) delete battle.domainHandState.left;
  if (battle.actionPoints) delete battle.actionPoints.left;
  if (battle.selectedHandActions) battle.selectedHandActions.left = [];
  battle.currentActions = [];
  battle.currentAction = null;
  battle.pendingAction = null;
  const swapText = `同战视角切换：「${battle.left.name}」继续迎战宿傩`;
  battle.dounaSwapNotice = { text: swapText, createdAt: Date.now(), expiresAt: Date.now() + 3600 };
  showDounaSwapPopup(swapText);
  initializeDuelHandState(battle);
  updateDuelActionAvailability(battle);
  recordDuelResourceChange(battle, {
    side: "left",
    title: "同战视角切换",
    detail: swapText,
    type: "system",
    delta: { dounaRaidPerspectiveIndex: nextEntry.index }
  });
  return true;
}

function handleDounaGauntletTransitions(battle) {
  if (!battle?.dounaGauntlet || battle.resolved) return false;
  applyDounaRaidAllyAssist(battle);
  grantDounaWorldSlashIfNeeded(battle);
  let handled = false;
  if (Number(battle.resourceState?.p2?.hp || 0) <= 0 && battle.dounaGauntlet.bossLife === 1) {
    handled = transitionDounaSukunaSecondLife(battle) || handled;
  }
  if (Number(battle.resourceState?.p1?.hp || 0) <= 0) {
    handled = (isDounaRaidBattle(battle) ? advanceDounaRaidPerspectiveIfNeeded(battle) : advanceDounaChallenger(battle)) || handled;
  }
  return handled;
}

function renderDounaGauntletStatus(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet) return "";
  const total = gauntlet.roster.length || 5;
  const index = Math.min(total, Number(gauntlet.currentIndex || 0) + 1);
  const pending = gauntlet.pendingBoundWorldSlash
    ? `<span class="duel-chip strong">束缚世界斩：下回合结算</span>`
    : "";
  const mode = normalizeDounaChallengeMode(gauntlet.challengeMode);
  const damageRows = mode === "raid" && Array.isArray(gauntlet.damageBySlot)
    ? `<div class="douna-damage-share" aria-label="斗傩伤害占比">
        ${gauntlet.damageBySlot.map((entry) => {
          const percent = Math.max(0, Number(entry?.percent || 0) || 0);
          return `<span class="duel-chip${entry?.defeated ? " danger" : ""}" title="${escapeHtml(entry?.name || "")}">${escapeHtml(entry?.name || `挑战者 ${Number(entry?.index || 0) + 1}`)} ${formatNumber(percent, 1)}%</span>`;
        }).join("")}
      </div>`
    : "";
  const broadcastRows = Array.isArray(gauntlet.damageBroadcasts) && gauntlet.damageBroadcasts.length
    ? `<div class="douna-damage-broadcasts">${gauntlet.damageBroadcasts.slice(0, 3).map((item) => `<span>${escapeHtml(item.text || "")}</span>`).join("")}</div>`
    : "";
  return `
    <div class="douna-status douna-mode-${escapeHtml(mode)}">
      <span class="duel-chip strong">斗傩大陆</span>
      <span class="duel-chip strong">${escapeHtml(getDounaChallengeModeLabel(mode))}</span>
      <span class="duel-chip">挑战者 ${index} / ${total}</span>
      <span class="duel-chip">宿傩第 ${formatNumber(gauntlet.bossLife || 1)} 命</span>
      ${gauntlet.worldSlashGranted ? `<span class="duel-chip strong">${gauntlet.worldSlashUsed ? "后续世界斩转为束缚" : "World Slash 已解锁"}</span>` : ""}
      ${pending}
      ${damageRows}
      ${broadcastRows}
    </div>
  `;
}

function renderDounaSwapNotice(battle) {
  const notice = battle?.dounaSwapNotice;
  if (!notice?.text) return "";
  if (Number(notice.expiresAt || 0) && Number(notice.expiresAt || 0) < Date.now()) {
    delete battle.dounaSwapNotice;
    return "";
  }
  return `<div class="douna-swap-notice" role="status" aria-live="polite">${escapeHtml(notice.text)}</div>`;
}

let dounaSwapPopupTimer = 0;

function showDounaSwapPopup(text) {
  if (typeof document === "undefined") return;
  const message = String(text || "").trim();
  if (!message) return;
  let popup = document.getElementById("dounaSwapPopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "dounaSwapPopup";
    popup.className = "douna-swap-popup";
    popup.setAttribute("role", "status");
    popup.setAttribute("aria-live", "polite");
    popup.innerHTML = `
      <strong>挑战者更替</strong>
      <span></span>
    `;
    document.body.appendChild(popup);
  }
  const messageNode = popup.querySelector("span");
  if (messageNode) messageNode.textContent = message;
  popup.classList.add("is-visible");
  if (dounaSwapPopupTimer) globalThis.clearTimeout(dounaSwapPopupTimer);
  dounaSwapPopupTimer = globalThis.setTimeout(() => {
    popup?.classList.remove("is-visible");
    popup?.remove();
    dounaSwapPopupTimer = 0;
  }, 3600);
}

function showDounaDamageBroadcastPopup(text) {
  if (typeof document === "undefined") return;
  const message = String(text || "").trim();
  if (!message) return;
  const container = document.querySelector("[data-douna-broadcast-list]");
  if (!container) return;
  const eventId = String(globalThis.__dounaBroadcastEventId || `${message}:${Date.now()}`);
  if (Array.from(container.children || []).some((node) => String(node.dataset?.eventId || "") === eventId)) return;
  const entry = document.createElement("div");
  entry.dataset.eventId = eventId;
  entry.className = "douna-damage-broadcast-entry";
  entry.setAttribute("role", "status");
  entry.textContent = message;
  container.appendChild(entry);
}

const DEDICATED_SERVER_HTTPS_ORIGIN = "https://119.91.224.223";

function isDedicatedServerNativeRuntime() {
  try {
    if (globalThis.Capacitor?.isNativePlatform?.()) return true;
  } catch {
    // Fall through to the bootstrap hint when the native bridge is incomplete.
  }
  const root = globalThis.document?.documentElement;
  return root?.dataset?.jjkAppRuntime === "capacitor" || root?.dataset?.jjkAppRuntimeHint === "capacitor";
}

function getDounaLeaderboardApiBase() {
  if (isDedicatedServerNativeRuntime()) return DEDICATED_SERVER_HTTPS_ORIGIN;
  const host = String(location.hostname || "");
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return location.origin;
  return DEDICATED_SERVER_HTTPS_ORIGIN;
}

function getDounaLeaderboardUrl() {
  return `${getDounaLeaderboardApiBase()}/api/douna-leaderboard`;
}

const DOUNA_LEADERBOARD_CURRENT_SEASON_ID = "beta2";
const DOUNA_LEADERBOARD_SEASONS = Object.freeze([
  { id: "beta2", label: "内测赛季2" },
  { id: "beta1", label: "内测赛季1" }
]);

function normalizeDounaLeaderboardSeasonId(value, fallback = DOUNA_LEADERBOARD_CURRENT_SEASON_ID) {
  const text = String(value || "").trim().toLowerCase();
  return DOUNA_LEADERBOARD_SEASONS.some((season) => season.id === text) ? text : fallback;
}

function getDounaLeaderboardSeasonId() {
  return normalizeDounaLeaderboardSeasonId(document.querySelector("#dounaLeaderboardSeasonSelect")?.value || DOUNA_LEADERBOARD_CURRENT_SEASON_ID);
}

function syncDounaLeaderboardSeasonSelect(seasons = DOUNA_LEADERBOARD_SEASONS, selectedId = getDounaLeaderboardSeasonId()) {
  const select = document.querySelector("#dounaLeaderboardSeasonSelect");
  if (!select) return;
  const normalizedSelected = normalizeDounaLeaderboardSeasonId(selectedId);
  const options = (Array.isArray(seasons) && seasons.length ? seasons : DOUNA_LEADERBOARD_SEASONS)
    .filter((season) => season?.id && season?.label);
  select.innerHTML = options.map((season) => `<option value="${escapeHtml(season.id)}"${season.id === normalizedSelected ? " selected" : ""}>${escapeHtml(season.label)}</option>`).join("");
  select.value = normalizedSelected;
}

function getDounaLeaderboardSeasonLabel(seasonId = getDounaLeaderboardSeasonId()) {
  const normalized = normalizeDounaLeaderboardSeasonId(seasonId);
  return DOUNA_LEADERBOARD_SEASONS.find((season) => season.id === normalized)?.label || normalized;
}

function isDounaRaidBattle(battle) {
  return normalizeDounaChallengeMode(battle?.dounaGauntlet?.challengeMode) === "raid";
}

function getDounaLocalPlayerIndex(battle) {
  const side = String(battle?.dounaGauntlet?.onlinePlayerSide || "");
  if (/^douna[1-5]$/.test(side)) return Math.max(0, Number(side.replace("douna", "")) - 1);
  return Math.max(0, Math.round(Number(battle?.dounaGauntlet?.currentIndex || 0) || 0));
}

function getDounaDamageShareEntry(battle, index) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet) return null;
  gauntlet.damageBySlot = Array.isArray(gauntlet.damageBySlot) && gauntlet.damageBySlot.length
    ? gauntlet.damageBySlot
    : createDounaDamageShareEntries(gauntlet.roster || []);
  const safeIndex = Math.max(0, Math.min(gauntlet.damageBySlot.length - 1, Math.round(Number(index || 0) || 0)));
  return gauntlet.damageBySlot[safeIndex] || null;
}

function getDounaCurrentDamageOwner(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet) return { name: "", index: -1 };
  const index = isDounaRaidBattle(battle) ? getDounaLocalPlayerIndex(battle) : Math.max(0, Math.round(Number(gauntlet.currentIndex || 0) || 0));
  const rosterEntry = Array.isArray(gauntlet.roster) ? gauntlet.roster[index] : null;
  const rosterName = Array.isArray(gauntlet.rosterNames) ? gauntlet.rosterNames[index] : "";
  const name = String(rosterName || rosterEntry?.name || rosterEntry?.displayName || battle?.resourceState?.p1?.name || battle?.left?.name || "").trim();
  return { name: name.slice(0, 80), index };
}

function getDounaDamageOwner(battle, event = null) {
  const explicit = Number(event?.dounaOwnerIndex ?? event?.ownerIndex ?? event?.slotIndex);
  if (Number.isFinite(explicit)) {
    const entry = getDounaDamageShareEntry(battle, explicit);
    if (entry) return { name: entry.name, index: entry.index };
  }
  return getDounaCurrentDamageOwner(battle);
}

function pushDounaDamageBroadcast(battle, entry, threshold) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet || !entry) return;
  const text = `${entry.name} 消耗了 ${threshold}% 血量`;
  gauntlet.damageBroadcasts ||= [];
  if (gauntlet.damageBroadcasts.some((item) => item?.index === entry.index && item?.threshold === threshold)) return;
  gauntlet.damageBroadcasts.unshift({
    eventId: `douna:${entry.index}:${threshold}`,
    round: Math.max(1, Math.round(Number(battle.round || 0) + 1)),
    index: entry.index,
    name: entry.name,
    threshold,
    text
  });
  gauntlet.damageBroadcasts = gauntlet.damageBroadcasts.slice(0, 8);
  recordDuelResourceChange(battle, {
    side: "left",
    title: "斗傩伤害播报",
    detail: text,
    type: "douna_damage_broadcast",
    delta: { dounaDamageThreshold: threshold, dounaDamageOwnerIndex: entry.index }
  });
  globalThis.__dounaBroadcastEventId = `douna:${entry.index}:${threshold}`;
  showDounaDamageBroadcastPopup(text);
}

function recordDounaRawDamage(battle, actorSide, event, rawDamage) {
  const gauntlet = battle?.dounaGauntlet;
  if (!gauntlet || actorSide !== "left") return;
  const value = Math.max(0, Math.round(Number(rawDamage || 0)));
  if (!value) return;
  gauntlet.totalRawDamageDealt = Math.round(Number(gauntlet.totalRawDamageDealt || 0) + value);
  const owner = getDounaDamageOwner(battle, event);
  const shareEntry = getDounaDamageShareEntry(battle, owner.index);
  if (shareEntry) {
    shareEntry.totalRawDamage = Math.round(Number(shareEntry.totalRawDamage || 0) + value);
    const budget = Math.max(1, Number(gauntlet.bossTotalHpBudget || 0) || Math.round((720 + 520) * Number(gauntlet.hpMultiplier || 1)));
    const percent = Number((shareEntry.totalRawDamage / budget * 100).toFixed(2));
    shareEntry.percent = percent;
    shareEntry.thresholds ||= [];
    (gauntlet.broadcastThresholds || [10, 25, 50, 75]).forEach((threshold) => {
      if (percent >= threshold && !shareEntry.thresholds.includes(threshold)) {
        shareEntry.thresholds.push(threshold);
        pushDounaDamageBroadcast(battle, shareEntry, threshold);
      }
    });
  }
  if (value > Number(gauntlet.maxRawDamage || 0)) {
    gauntlet.maxRawDamage = value;
    gauntlet.maxRawDamageAction = String(event?.label || event?.name || event?.kind || "未命名手札").slice(0, 80);
    gauntlet.maxRawDamageRound = Math.max(1, Math.round(Number(battle.round || 0) + 1));
    gauntlet.maxRawDamageOwnerName = owner.name;
    gauntlet.maxRawDamageOwnerIndex = owner.index;
  }
}

function getDounaActionRawDamageValue(result) {
  if (!result || result.evasion?.evaded) return 0;
  const target = result.damageTarget || {};
  if (target.type && target.type !== "character") return 0;
  const raw = Number(result.directDamageBeforeScale ?? result.directDamage ?? 0);
  if (raw > 0) return raw;
  if (result.instantKillOnHit && Number(result.directDamage || 0) > 0) return Number(result.directDamage || 0);
  return 0;
}

function recordDounaActionDamage(action, actor, opponent, result, battle = state.duelBattle) {
  if (!battle?.dounaGauntlet || actor?.side !== "left") return;
  const raw = getDounaActionRawDamageValue(result);
  if (raw > 0) recordDounaRawDamage(battle, actor.side, action, raw);
  const attacks = Array.isArray(result?.summonAssist?.attacks) ? result.summonAssist.attacks : [];
  attacks.forEach((attack) => {
    if (attack?.evaded) return;
    if (attack?.target?.type && attack.target.type !== "character") return;
    const damage = Number(attack.damage || attack.effect?.damage || attack.damageApplied || 0);
    if (damage > 0) {
      recordDounaRawDamage(battle, actor.side, {
        label: attack.unitName ? `${attack.unitName}·协同攻击` : "式神协同攻击"
      }, damage);
    }
  });
}

function getDounaLoginIdentity() {
  const payload = globalThis.JJKLoginCard?.getPayload?.() || {};
  return {
    nickname: String(payload.nickname || payload.ownerNickname || payload.displayName || "未命名登录卡").trim().slice(0, 80) || "未命名登录卡",
    ownerId: String(payload.ownerId || payload.cardId || payload.id || payload.nickname || payload.ownerNickname || "").trim().slice(0, 80)
  };
}

function normalizeDounaRosterKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function getDounaOfficialRosterKeySet() {
  const keys = new Set();
  (state.characterCards?.cards || []).forEach((card) => {
    [
      card?.characterId,
      card?.id
    ].forEach((value) => {
      const key = normalizeDounaRosterKey(value);
      if (key) keys.add(key);
    });
  });
  return keys;
}

function isDounaRosterProfileOfficialCandidate(profile, officialKeys = getDounaOfficialRosterKeySet()) {
  if (!profile || typeof profile !== "object") return false;
  const candidates = [
    profile.characterId,
    profile.originalCharacterId,
    profile.baseCharacterId,
    profile.sourceCharacterId,
    profile.characterCardProfile?.characterId,
    profile.characterCardProfile?.originalCharacterId,
    profile.characterCardProfile?.baseCharacterId,
    profile.characterCardProfile?.sourceCharacterId,
    profile.id,
    profile.characterCardProfile?.id
  ];
  return candidates.some((value) => officialKeys.has(normalizeDounaRosterKey(value)));
}

function getDounaRosterProfileId(profile) {
  if (!profile || typeof profile !== "object") return "";
  return String(
    profile.characterCardProfile?.characterId ||
    profile.characterId ||
    profile.originalCharacterId ||
    profile.baseCharacterId ||
    profile.sourceCharacterId ||
    profile.characterCardProfile?.id ||
    profile.id ||
    ""
  ).trim().slice(0, 80);
}

function isDounaRosterProfileDefinitelyCustom(profile, officialKeys = getDounaOfficialRosterKeySet()) {
  if (!profile || typeof profile !== "object") return true;
  if (isDounaRosterProfileOfficialCandidate(profile, officialKeys)) return false;
  if (profile.customDuel === true || profile.customDuelCard === true || profile.__onlineTemporaryCustomDuel) return true;
  const source = String(profile.source || profile.characterCardProfile?.source || "").trim().toLowerCase();
  if (source.includes("custom") || source.includes("login-card")) return true;
  const idText = [
    profile.id,
    profile.characterId,
    profile.characterCardProfile?.id,
    profile.characterCardProfile?.characterId
  ].filter(Boolean).join(" ");
  if (/\bcustom[_-]?duel\b|^custom_|login_card_|online_custom|temporary_custom|custom_character_/i.test(idText)) return true;
  return false;
}

function isDounaRosterProfileOfficial(profile, officialKeys = getDounaOfficialRosterKeySet()) {
  if (!profile || typeof profile !== "object") return false;
  if (isDounaRosterProfileOfficialCandidate(profile, officialKeys)) return true;
  return false;
}

function classifyDounaRosterSource(rosterProfiles = []) {
  const roster = (Array.isArray(rosterProfiles) ? rosterProfiles : []).slice(0, 5);
  const officialKeys = getDounaOfficialRosterKeySet();
  const rosterOfficialFlags = roster.map((profile) => isDounaRosterProfileOfficial(profile, officialKeys));
  const rosterCustomFlags = rosterOfficialFlags.map((official) => !official);
  const customRosterCount = rosterCustomFlags.filter(Boolean).length;
  const presetRosterCount = rosterOfficialFlags.filter(Boolean).length;
  return {
    rosterSource: roster.length === 5 && customRosterCount === 0 ? "preset" : "custom",
    customRosterCount,
    presetRosterCount,
    rosterOfficialFlags,
    rosterCustomFlags,
    rosterIds: roster.map((profile) => getDounaRosterProfileId(profile))
  };
}

function buildDounaLeaderboardPayload(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!battle || !gauntlet) return null;
  const current = battle.resourceState?.p1;
  const currentMaxHp = Math.max(0, Number(current?.maxHp || current?.hp || 0) || 0);
  const currentHp = Math.max(0, Number(current?.hp || 0) || 0);
  const currentDamage = Math.min(currentMaxHp, Math.max(0, currentMaxHp - currentHp));
  const identity = getDounaLoginIdentity();
  const rosterProfiles = Array.isArray(gauntlet.roster) ? gauntlet.roster : [];
  const rosterClassification = classifyDounaRosterSource(rosterProfiles);
  return {
    nickname: identity.nickname,
    ownerId: identity.ownerId,
    message: String(els.dounaLeaderboardMessageInput?.value || "").replace(/\s+/g, " ").trim().slice(0, 48),
    roster: (gauntlet.rosterNames || gauntlet.roster || []).map((item) => typeof item === "string" ? item : (item?.name || item?.displayName || "未命名挑战者")).slice(0, 5),
    rosterSource: rosterClassification.rosterSource,
    customRosterCount: rosterClassification.customRosterCount,
    presetRosterCount: rosterClassification.presetRosterCount,
    rosterIds: rosterClassification.rosterIds,
    rosterOfficialFlags: rosterClassification.rosterOfficialFlags,
    rosterCustomFlags: rosterClassification.rosterCustomFlags,
    rosterClassification: "all-official-v1",
    seasonId: DOUNA_LEADERBOARD_CURRENT_SEASON_ID,
    totalCombatPower: Math.round(Number(gauntlet.rosterTotalCombatPower || 0) || 0),
    totalDamageTaken: Math.round(Number(gauntlet.totalDamageTaken || 0) + currentDamage),
    totalRounds: Math.max(1, Math.round(Number(battle.endingRound || battle.round || 1) || 1)),
    deaths: Math.max(0, Math.min(5, Math.round(Number(gauntlet.deaths || 0) || 0))),
    mode: gauntlet.online ? "online" : "solo",
    challengeMode: normalizeDounaChallengeMode(gauntlet.challengeMode),
    teamName: gauntlet.onlineTeamName || (gauntlet.onlineRoomId ? `联机斗傩 ${gauntlet.onlineRoomId}` : ""),
    onlineRoomId: gauntlet.onlineRoomId || "",
    damageShares: (gauntlet.damageBySlot || []).map((entry) => ({
      index: Math.max(0, Math.round(Number(entry?.index || 0) || 0)),
      name: String(entry?.name || "").slice(0, 80),
      totalRawDamage: Math.max(0, Math.round(Number(entry?.totalRawDamage || 0) || 0)),
      percent: Math.max(0, Number(Number(entry?.percent || 0).toFixed(2))),
      defeated: Boolean(entry?.defeated)
    })).slice(0, 5),
    maxRawDamage: Math.max(0, Math.round(Number(gauntlet.maxRawDamage || 0) || 0)),
    maxRawDamageAction: String(gauntlet.maxRawDamageAction || "").slice(0, 80),
    maxRawDamageRound: Math.max(0, Math.round(Number(gauntlet.maxRawDamageRound || 0) || 0)),
    maxRawDamageOwnerName: String(gauntlet.maxRawDamageOwnerName || "").slice(0, 80),
    maxRawDamageOwnerIndex: Math.max(0, Math.round(Number(gauntlet.maxRawDamageOwnerIndex || 0) || 0)),
    totalRawDamageDealt: Math.max(0, Math.round(Number(gauntlet.totalRawDamageDealt || 0) || 0)),
    battleId: battle.battleId || "",
    submittedAt: new Date().toISOString()
  };
}

function getDounaLeaderboardMessageValue() {
  return String(els.dounaLeaderboardMessageInput?.value || "").replace(/\s+/g, " ").trim().slice(0, 48);
}

function setDounaLeaderboardMessageValue(value) {
  if (els.dounaLeaderboardMessageInput) els.dounaLeaderboardMessageInput.value = String(value || "").slice(0, 48);
}

function renderDounaDamageRankingList(battle) {
  const shares = (battle?.dounaGauntlet?.damageBySlot || [])
    .map((entry) => ({
      name: String(entry?.name || `挑战者 ${Number(entry?.index || 0) + 1}`).slice(0, 80),
      totalRawDamage: Math.max(0, Math.round(Number(entry?.totalRawDamage || 0) || 0)),
      percent: Math.max(0, Number(entry?.percent || 0) || 0),
      defeated: Boolean(entry?.defeated)
    }))
    .sort((left, right) => right.totalRawDamage - left.totalRawDamage);
  if (!shares.length) return "";
  return `
    <div class="douna-submit-ranking">
      <strong>队内伤害排名</strong>
      ${shares.map((entry, index) => `
        <div class="douna-submit-ranking-row">
          <span>#${formatNumber(index + 1)} ${escapeHtml(entry.name)}${entry.defeated ? "（倒下）" : ""}</span>
          <span>${formatNumber(entry.totalRawDamage)} 打出伤害 · ${formatNumber(entry.percent)}%</span>
        </div>
      `).join("")}
    </div>
  `;
}

function showDounaLeaderboardSubmitDialog(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!battle || !gauntlet || gauntlet.leaderboardSubmitted || gauntlet.leaderboardPromptOpen || battle.winnerSide !== "left") return;
  if (typeof document === "undefined") {
    submitDounaLeaderboardResult(battle).catch(() => {});
    return;
  }
  gauntlet.leaderboardPromptOpen = true;
  document.getElementById("dounaLeaderboardSubmitDialog")?.remove();
  const payload = buildDounaLeaderboardPayload(battle);
  const dialog = document.createElement("div");
  dialog.id = "dounaLeaderboardSubmitDialog";
  dialog.className = "douna-submit-dialog";
  dialog.innerHTML = `
    <div class="douna-submit-card" role="dialog" aria-modal="true" aria-labelledby="dounaSubmitTitle">
      <span class="badge">斗傩通关</span>
      <h3 id="dounaSubmitTitle">提交斗傩排行榜</h3>
      <p class="muted">已击败两命宿傩。前十名留言会显示在排行榜上。</p>
      ${renderDounaDamageRankingList(battle)}
      <label class="field">
        <span>通关留言（最多 48 字）</span>
        <input id="dounaSubmitMessageInput" type="text" maxlength="48" value="${escapeHtml(payload?.message || "")}" placeholder="例：用低战力阵容斩下宿傩" autocomplete="off">
      </label>
      <div class="douna-submit-summary">
        <span>总战力 ${escapeHtml(formatNumber(payload?.totalCombatPower || 0))}</span>
        <span>受伤 ${escapeHtml(formatNumber(payload?.totalDamageTaken || 0))}</span>
        <span>回合 ${escapeHtml(formatNumber(payload?.totalRounds || 0))}</span>
        <span>死亡 ${escapeHtml(formatNumber(payload?.deaths || 0))}</span>
      </div>
      <div class="action-row">
        <button id="dounaSubmitLeaderboardBtn" class="primary" type="button">提交成绩</button>
        <button id="dounaSubmitSkipBtn" class="secondary" type="button">不写留言直接提交</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const closeAndSubmit = (useMessage) => {
    const input = dialog.querySelector("#dounaSubmitMessageInput");
    if (useMessage) setDounaLeaderboardMessageValue(input?.value || "");
    else setDounaLeaderboardMessageValue("");
    gauntlet.leaderboardPromptOpen = false;
    dialog.remove();
    submitDounaLeaderboardResult(battle).catch(() => {});
  };
  dialog.querySelector("#dounaSubmitLeaderboardBtn")?.addEventListener("click", () => closeAndSubmit(true));
  dialog.querySelector("#dounaSubmitSkipBtn")?.addEventListener("click", () => closeAndSubmit(false));
  window.setTimeout(() => dialog.querySelector("#dounaSubmitMessageInput")?.focus(), 30);
}

let dounaLeaderboardCategory = "score_preset";

function getDounaLeaderboardCategoryLabel(category = dounaLeaderboardCategory) {
  return {
    score: "官方榜单",
    score_preset: "官方榜单",
    score_custom: "自定义通关",
    online: "联机队伍",
    damage: "最大伤害",
    failures: "最区记录"
  }[category] || "官方榜单";
}

function setDounaLeaderboardCategory(category) {
  dounaLeaderboardCategory = category === "score" ? "score_preset" : (["score_preset", "score_custom", "online", "damage", "failures"].includes(category) ? category : "score_preset");
  document.querySelectorAll("[data-douna-leaderboard-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.dounaLeaderboardTab === dounaLeaderboardCategory);
  });
}

function renderDounaLeaderboard(entries = [], category = dounaLeaderboardCategory) {
  if (!els.dounaLeaderboardList) return;
  if (!entries.length) {
    els.dounaLeaderboardList.innerHTML = `<p class="muted">暂无${escapeHtml(getDounaLeaderboardCategoryLabel(category))}记录。</p>`;
    return;
  }
  if (category === "damage") {
    const rows = entries.slice(0, 30).map((entry, index) => `
      <article class="douna-leaderboard-entry">
        <strong>#${escapeHtml(index + 1)}</strong>
        <strong class="douna-leaderboard-name" title="${escapeHtml(entry.nickname || "未命名登录卡")}">${escapeHtml(entry.nickname || "未命名登录卡")}</strong>
        <span>${escapeHtml(entry.maxRawDamageOwnerName || "未记录")}</span>
        <span>${escapeHtml(formatNumber(entry.maxRawDamage || 0))}</span>
        <span>${escapeHtml(entry.maxRawDamageAction || "未记录")}</span>
        <span>${escapeHtml(formatNumber(entry.maxRawDamageRound || 0))}</span>
        <span>${escapeHtml(formatNumber(entry.totalRawDamageDealt || 0))}</span>
        <span>${escapeHtml(entry.mode === "online" ? "联机" : "单人")}</span>
        <div class="douna-leaderboard-roster">阵容：${escapeHtml((entry.roster || []).join("、") || "未记录")}</div>
      </article>
    `).join("");
    els.dounaLeaderboardList.innerHTML = `
      <div class="douna-leaderboard-entry header">
        <span>排名</span><span>登录卡</span><span>造成者</span><span>最大打出伤害</span><span>手札</span><span>回合</span><span>总打出伤害</span><span>模式</span>
      </div>${rows}`;
    return;
  }
  if (category === "failures") {
    const rows = entries.slice(0, 30).map((entry, index) => `
      <article class="douna-leaderboard-entry">
        <strong>#${escapeHtml(index + 1)}</strong>
        <strong class="douna-leaderboard-name" title="${escapeHtml(entry.nickname || "未命名登录卡")}">${escapeHtml(entry.nickname || "未命名登录卡")}</strong>
        <span>${escapeHtml(formatNumber(entry.failures || 0))}</span>
        <span>${escapeHtml(formatNumber(entry.bestBossLife || 1))}</span>
        <span>${escapeHtml(formatNumber(entry.bestBossHpLeft || 0))}</span>
        <span>${escapeHtml(formatNumber(entry.bestRawDamage || 0))}</span>
        <span>${escapeHtml(new Date(entry.updatedAt || entry.submittedAt || Date.now()).toLocaleDateString())}</span>
        <div class="douna-leaderboard-roster">最近阵容：${escapeHtml((entry.roster || []).join("、") || "未记录")}</div>
      </article>
    `).join("");
    els.dounaLeaderboardList.innerHTML = `
      <div class="douna-leaderboard-entry header">
        <span>排名</span><span>登录卡</span><span>失败次数</span><span>最好命数</span><span>宿傩剩余HP</span><span>最高打出</span><span>更新</span>
      </div>${rows}`;
    return;
  }
  const rows = entries.slice(0, 30).map((entry, index) => `
    <article class="douna-leaderboard-entry">
      <strong>#${escapeHtml(index + 1)}</strong>
      <strong class="douna-leaderboard-name" title="${escapeHtml(entry.nickname || "未命名登录卡")}">${escapeHtml(entry.nickname || "未命名登录卡")}</strong>
      <span>${escapeHtml(formatNumber(entry.score || 0))}</span>
      <span>${escapeHtml(formatNumber(entry.totalCombatPower || 0))}</span>
      <span>${escapeHtml(formatNumber(entry.totalDamageTaken || 0))}</span>
      <span>${escapeHtml(formatNumber(entry.totalRounds || 0))}</span>
      <span>${escapeHtml(formatNumber(entry.deaths || 0))}</span>
      ${index < 10 && entry.message ? `<div class="douna-leaderboard-message-line">留言：${escapeHtml(entry.message)}</div>` : ""}
      <div class="douna-leaderboard-roster">${category === "online" ? "队伍" : "阵容"}：${escapeHtml((entry.roster || []).join("、") || "未记录")}${category === "score_custom" ? ` · 自定义 ${escapeHtml(formatNumber(entry.customRosterCount || 0))} / 5` : ""}</div>
      ${category === "online" && Array.isArray(entry.damageShares) && entry.damageShares.length ? `<div class="douna-leaderboard-roster">伤害占比：${escapeHtml(entry.damageShares.map((share) => `${share.name || `挑战者${Number(share.index || 0) + 1}`} ${formatNumber(share.percent || 0)}%`).join("、"))}</div>` : ""}
    </article>
  `).join("");
  els.dounaLeaderboardList.innerHTML = `
    <div class="douna-leaderboard-entry header">
      <span>排名</span>
      <span>登录卡</span>
      <span>分数</span>
      <span>总战力</span>
      <span>受伤</span>
      <span>回合</span>
      <span>死亡</span>
    </div>
    ${rows}
  `;
}

let dounaLeaderboardLoading = false;
let dounaLeaderboardLoadedAt = 0;

async function refreshDounaLeaderboard(options = {}) {
  if (!els.dounaLeaderboardList || dounaLeaderboardLoading) return;
  const now = Date.now();
  if (!options.force && now - dounaLeaderboardLoadedAt < 30000) return;
  const category = options.category || dounaLeaderboardCategory;
  const seasonId = getDounaLeaderboardSeasonId();
  setDounaLeaderboardCategory(category);
  syncDounaLeaderboardSeasonSelect(DOUNA_LEADERBOARD_SEASONS, seasonId);
  dounaLeaderboardLoading = true;
  if (els.dounaLeaderboardStatus) els.dounaLeaderboardStatus.textContent = "榜单加载中。";
  try {
    const response = await fetch(`${getDounaLeaderboardUrl()}?limit=30&category=${encodeURIComponent(dounaLeaderboardCategory)}&season=${encodeURIComponent(seasonId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    dounaLeaderboardLoadedAt = Date.now();
    syncDounaLeaderboardSeasonSelect(data.seasons || DOUNA_LEADERBOARD_SEASONS, data.seasonId || seasonId);
    renderDounaLeaderboard(data.entries || [], data.category || dounaLeaderboardCategory);
    if (els.dounaLeaderboardStatus) {
      els.dounaLeaderboardStatus.textContent = `${getDounaLeaderboardSeasonLabel(data.seasonId || seasonId)} · ${getDounaLeaderboardCategoryLabel(data.category || dounaLeaderboardCategory)} · 结算公式 v${formatNumber(data.formulaVersion || 5)}：分数以选角总战力为绝对核心，受伤/回合/死亡只做小幅修正；无下限与诛伏赐死会计入强化战力惩罚。联机榜只收录联机斗傩通关，最大伤害按“打出伤害”记录。更新时间 ${new Date(data.updatedAt || Date.now()).toLocaleString()}`;
    }
  } catch (error) {
    if (els.dounaLeaderboardStatus) els.dounaLeaderboardStatus.textContent = `榜单加载失败：${String(error?.message || error)}`;
  } finally {
    dounaLeaderboardLoading = false;
  }
}

async function submitDounaLeaderboardResult(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!battle || !gauntlet || gauntlet.leaderboardSubmitted || battle.winnerSide !== "left") return;
  const payload = buildDounaLeaderboardPayload(battle);
  if (!payload) return;
  gauntlet.leaderboardSubmitted = true;
  if (els.dounaLeaderboardStatus) els.dounaLeaderboardStatus.textContent = "斗傩通关成绩提交中。";
  try {
    payload.message = getDounaLeaderboardMessageValue();
    const response = await fetch(getDounaLeaderboardUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-JJK-Login-Card-Nickname": encodeURIComponent(payload.nickname),
        "X-JJK-Login-Card-Owner": encodeURIComponent(payload.ownerId || payload.nickname)
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    renderDounaLeaderboard(data.entries || [], data.category || "score_preset");
    if (els.dounaLeaderboardStatus) {
      els.dounaLeaderboardStatus.textContent = `成绩已提交：${getDounaLeaderboardSeasonLabel(data.seasonId || payload.seasonId)}，结算分 ${formatNumber(data.entry?.score || payload.score || 0)}，当前排名 #${formatNumber(data.rank || "-")}。`;
    }
    dounaLeaderboardLoadedAt = Date.now();
  } catch (error) {
    gauntlet.leaderboardSubmitted = false;
    if (els.dounaLeaderboardStatus) els.dounaLeaderboardStatus.textContent = `成绩提交失败：${String(error?.message || error)}`;
  }
}

async function submitDounaFailureResult(battle) {
  const gauntlet = battle?.dounaGauntlet;
  if (!battle || !gauntlet || gauntlet.failureSubmitted || battle.winnerSide === "left") return;
  const payload = buildDounaLeaderboardPayload(battle);
  if (!payload) return;
  gauntlet.failureSubmitted = true;
  payload.result = "failure";
  payload.bossLife = Math.max(1, Math.round(Number(gauntlet.bossLife || 1) || 1));
  payload.bossHpLeft = Math.max(0, Math.round(Number(battle.resourceState?.p2?.hp || 0) || 0));
  try {
    await fetch(getDounaLeaderboardUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-JJK-Login-Card-Nickname": encodeURIComponent(payload.nickname),
        "X-JJK-Login-Card-Owner": encodeURIComponent(payload.ownerId || payload.nickname)
      },
      body: JSON.stringify(payload)
    });
  } catch {
    gauntlet.failureSubmitted = false;
  }
}

function startDuelBattle(options = {}) {
  if (isOnlineDuelModeActive() && options.mode !== "online" && !options.allowOnline) {
    forceOnlineBattleInterface(state.duelModeState.playerSide);
    void globalThis.JJKDomModal?.alert("当前为联机对战，请在联机战斗界面操作。");
    renderDuelMode();
    return;
  }
  if (options.mode === "online" && options.snapshot?.players) {
    cacheOnlineSnapshotCustomCharacters(options.snapshot);
  }
  const onlineSnapshotProfiles = options.mode === "online" && options.snapshot?.players
    ? {
      left: getOnlineSnapshotCharacterProfile(options.snapshot?.players?.left, "left"),
      right: getOnlineSnapshotCharacterProfile(options.snapshot?.players?.right, "right"),
      leftRate: 0.5
    }
    : null;
  const profiles = options.left && options.right
    ? { left: options.left, right: options.right, leftRate: 0.5 }
    : (onlineSnapshotProfiles?.left && onlineSnapshotProfiles?.right ? onlineSnapshotProfiles : getCurrentDuelProfiles());
  if (!profiles) return;
  const mode = options.mode === "online" ? "online" : "solo";
  globalThis.JJKDuelMobileInteraction?.resetBattlePaneScroll?.();
  setDuelNativeBattleView("hand");
  if (mode === "solo" && !options.dounaGauntlet) {
    const battlePage = getBattlePageModule();
    battlePage?.ensureLegacyDuelTabActive?.();
    battlePage?.activateBattlePage?.("solo", { primeMode: "solo" });
  }
  const cpuDifficulty = mode === "solo" ? normalizeDuelCpuDifficulty(options.cpuDifficulty || getSelectedDuelCpuDifficulty()) : "normal";
  const cpuComputeMode = mode === "solo" ? normalizeDuelCpuComputeMode(options.cpuComputeMode || getSelectedDuelCpuComputeMode()) : "local";
  state.duelSpinToken += 1;
  const serverSeed = String(options.snapshot?.battleSeed || "").trim();
  if (mode === "online") {
    const seedValidator = globalThis.JJKOnlineDuelSync?.normalizeBattleSeed;
    try {
      if (typeof seedValidator === "function") seedValidator(options.snapshot || {});
      else if (!serverSeed) throw Object.assign(new Error("server battle seed required"), { code: "BATTLE_SEED_REQUIRED" });
    } catch (error) {
      console.error("ONLINE_TURN_RESOLVE_FAILED", { code: String(error?.code || "BATTLE_SEED_REQUIRED"), roomId: String(options.snapshot?.roomId || "").slice(0, 12) });
      return false;
    }
  }
  const seed = mode === "online" ? serverSeed : (options.snapshot?.battleSeed || createDuelBattleSeed(profiles.left, profiles.right));
  const battleId = createDuelBattleId(profiles.left, profiles.right, seed);
  const battle = {
    battleId,
    seed,
    replayKey: "",
    operations: ["strategy:balanced"],
    randomLog: [],
    rng: createDuelSeededRng(seed),
    left: profiles.left,
    right: profiles.right,
    baseRate: profiles.leftRate,
    round: 0,
    maxRounds: getDuelMaxRounds(profiles.left, profiles.right),
    legacyMaxRounds: getDuelMaxRounds(profiles.left, profiles.right),
    safetyRoundCap: getDuelSafetyRoundCap(),
    battleEnded: false,
    endReason: "ongoing",
    endingRound: 0,
    finalSnapshot: null,
    finalResourceSnapshot: null,
    finalHandState: null,
    finalDomainState: null,
    leftScore: 0,
    rightScore: 0,
    momentum: 0,
    selectedTactic: "balanced",
    opponentTactic: "balanced",
    initiativeInvestmentSelections: { left: 5, right: 5 },
    initiativeState: null,
    initiativeHistory: [],
    cpuDifficulty,
    cpuDifficultyLabel: getDuelCpuDifficultyLabel(cpuDifficulty),
    cpuComputeMode,
    cpuComputeModeLabel: getDuelCpuComputeModeLabel(cpuComputeMode),
    currentOptions: [],
    selectedIndex: null,
    phase: "strategy",
    autoRunning: false,
    spinning: false,
    resolved: false,
    winnerSide: "",
    finalRate: null,
    aiNarrative: "",
    aiNarrativeLoading: false,
    aiNarrativeError: "",
    actionChoices: [],
    actionRound: 1,
    selectedHandActions: { left: [], right: [] },
    pendingAction: null,
    actionUiMessage: "",
    currentAction: null,
    currentActions: [],
    cpuAction: null,
    cpuActions: [],
    actionContext: null,
    domainProfileStates: {},
    domainProfileActivations: [],
    domainTrialContext: null,
    domainSubPhase: null,
    activityContext: options.activityContext ? clonePlain(options.activityContext) : null,
    log: []
  };
  battle.mode = mode;
  battle.onlineRoomId = options.snapshot?.roomId || "";
  battle.onlineBattleSeed = options.snapshot?.battleSeed || "";
  battle.onlineBattleSeedHash = String(options.snapshot?.battleSeedHash || "");
  battle.onlineStateLost = Boolean(
    mode === "online" && Number(options.snapshot?.battleApiVersion || 0) >= 3 &&
    options.snapshot?.syncState?.lastReveal?.round && Number(options.snapshot.syncState.lastReveal.round) > 1
  );
  battle.onlinePlayerSide = options.spectator ? "spectator" : options.snapshot ? (state.duelModeState.playerSide || "left") : "";
  battle.onlineSpectator = Boolean(options.spectator);
  battle.resourceState = initializeDuelResourceState(battle);
  battle.resourceLog = battle.resourceState.resourceLog;
  battle.residualLog = battle.resourceState.residualLog;
  if (options.dounaGauntlet) initializeDounaGauntletBattle(battle, options.dounaGauntlet);
  initializeDuelHandState(battle);
  if (mode === "online" && globalThis.JJKOnlineDuelSync?.mergeOnlineHandCandidates && options.snapshot?.players) {
    for (const actorSide of ["left", "right"]) {
      const hand = battle.handState?.[actorSide];
      const frozen = options.snapshot.players?.[actorSide]?.characterSnapshot || {};
      const customCards = Array.isArray(frozen.customHandCards) ? frozen.customHandCards : [];
      if (!hand || !customCards.length) continue;
      hand.cards = globalThis.JJKOnlineDuelSync.mergeOnlineHandCandidates({
        ordinaryCandidates: hand.cards,
        customHandCards: customCards,
        frozenSnapshot: frozen
      });
      hand.lastInjected = customCards.map((card) => card.actionId || card.id || card.cardId).filter(Boolean);
    }
  }
  battle.replayKey = buildDuelReplayKey(battle);
  battle.resourceState.replayKey = battle.replayKey;
  updateDuelActionAvailability(battle);
  state.duelBattle = battle;
  recordDuelDiagnostic(battle, "battle_start", "success", {
    mode, roomId: battle.onlineRoomId || "", battleApiVersion: options.snapshot?.battleApiVersion,
    simulationAuthority: options.snapshot?.simulationAuthority,
    handCandidates: Object.fromEntries(Object.entries(battle.handCandidates || {}).map(([side, cards]) => [side, Array.isArray(cards) ? cards.length : 0]))
  });
  const currentBattlePage = getBattlePageModule()?.getBattlePageState?.().activePage || state.duelModeState.activePage || "";
  const pageMode = mode;
  setDuelBattleMode(pageMode, {
    activeBattleId: battle.battleId,
    activeRoomId: mode === "online" ? (battle.onlineRoomId || state.duelModeState.activeRoomId || "") : "",
    playerSide: mode === "online" ? (battle.onlinePlayerSide || state.duelModeState.playerSide || null) : null,
    localLocked: mode === "online" ? state.duelModeState.localLocked : false,
    activePage: mode === "online" ? (currentBattlePage || "online") : (battle.dounaGauntlet ? "douna" : "solo")
  });
  renderDuelMode();
}

function clearCurrentDuelBattle(options = {}) {
  const battle = state.duelBattle;
  const activityType = String(options.activityType || "");
  if (!battle || (activityType && battle.activityContext?.type !== activityType)) return false;
  state.duelSpinToken += 1;
  state.duelBattle = null;
  globalThis.JJKDuelMobileInteraction?.resetBattlePaneScroll?.();
  syncDuelBattleFocusMode(null);
  if (options.render !== false) renderDuelMode();
  return true;
}

function refreshDuelActionAvailability(battle = state.duelBattle, options = {}) {
  if (!battle) return null;
  updateDuelActionAvailability(battle);
  if (options.render !== false) renderDuelMode();
  return battle.handState || true;
}

globalThis.startDuelBattle = startDuelBattle;
globalThis.JJKDuelRuntime = {
  ...(globalThis.JJKDuelRuntime || {}),
  startDuelBattle,
  startDounaGauntletBattle,
  startOnlineDounaGauntletBattle,
  hasDounaSukunaRuntimeCard,
  autoFillDounaRoster,
  renderDounaSetupStatus,
  refreshDounaLeaderboard,
  renderDuelMode,
  renderJogoFlashoverBossInteractionPanel,
  renderSukunaJogoBossInteractionPanel,
  renderSukunaMahoragaBossInteractionPanel,
  renderMahitoBossInteractionPanel,
  renderShibuyaBossMissionPanel,
  refreshDuelActionAvailability,
  clearCurrentDuelBattle,
  getDuelCharacterCards: () => getDuelCharacterCards().map((card) => clonePlain(card)),
  evaluateDuelCharacterCard: (card) => clonePlain(evaluateDuelCharacterCard(card)),
  deriveDuelResourcesFromProfile: (profile, card = null, side = "") => clonePlain(deriveDuelResourcesFromProfile(profile, card, side)),
  importLoginCardCharacters,
  removeLoginCardCharactersFromPool,
  getCustomDuelCards: () => state.customDuelCards.map((card) => cloneCustomDuelExportValue(card)),
  syncOnlineRoomState,
  clearOnlineDuelBattle,
  syncOnlineSpectatorActions,
  getSelectedOnlineActionSnapshots,
  resolveRemoteActionDefinition,
  snapshotOnlineResourceStateForReport,
  getDuelBattle: () => state.duelBattle,
  recordDuelDiagnostic: (operation, status, detail) => recordDuelDiagnostic(state.duelBattle, operation, status, detail),
  discardDuelHandCandidate: (actionOrId, options = {}) => discardDuelHandCandidate(
    actionOrId,
    state.duelBattle?.resourceState?.p1,
    state.duelBattle,
    options
  ),
  resetDuelHandsForProfileChange: (battle = state.duelBattle) => {
    if (!battle) return null;
    const result = initializeDuelHandState(battle);
    updateDuelActionAvailability(battle);
    return result;
  },
  getDuelModeState: () => ({ ...state.duelModeState })
};

function getDuelMaxRoundsByGrade(left, right) {
  const leftRank = visibleGradeCategoryRank(left?.visibleGrade);
  const rightRank = visibleGradeCategoryRank(right?.visibleGrade);
  if (!Number.isFinite(leftRank) || !Number.isFinite(rightRank)) return 5;
  const gradeGap = Math.abs(leftRank - rightRank);
  if (gradeGap === 0) return 10;
  if (gradeGap === 1) return 5;
  return 1;
}

function getDuelRoundRuleText(left, right) {
  const leftRank = visibleGradeCategoryRank(left?.visibleGrade);
  const rightRank = visibleGradeCategoryRank(right?.visibleGrade);
  if (!Number.isFinite(leftRank) || !Number.isFinite(rightRank)) return `等级未知：以体势归零或特殊规则结算；技术安全上限 ${formatNumber(getDuelSafetyRoundCap())} 回合`;
  const gradeGap = Math.abs(leftRank - rightRank);
  const baseText = gradeGap === 0 ? "旧节奏参考：同级约 10 回合" : (gradeGap === 1 ? "旧节奏参考：相差一级约 5 回合" : "旧节奏参考：等级差过大约 1 回合");
  const baseRounds = getDuelMaxRoundsByGrade(left, right);
  const survivalFloor = Math.max(getDuelSurvivalRoundFloor(left), getDuelSurvivalRoundFloor(right));
  const survivalText = survivalFloor > baseRounds ? `；特殊词条保护：至少 ${survivalFloor} 回合前不收束` : "";
  return `${baseText}${survivalText}；当前正常终局以体势归零 / 特殊规则为准，技术安全上限 ${formatNumber(getDuelSafetyRoundCap())} 回合`;
}

function getDuelMaxRounds(left, right) {
  return Math.max(
    getDuelMaxRoundsByGrade(left, right),
    getDuelSurvivalRoundFloor(left),
    getDuelSurvivalRoundFloor(right)
  );
}

function getDuelSurvivalRoundFloor(profile) {
  return clamp(Math.round(Number(profile?.survivalRounds || 0)), 0, DUEL_SPECIAL_TERM_MAX_ROUNDS);
}

function getDuelBattleSurvivalFloor(battle) {
  if (!battle) return 0;
  return Math.max(getDuelSurvivalRoundFloor(battle.left), getDuelSurvivalRoundFloor(battle.right));
}

function getDuelEndRules() {
  return callDuelEndConditionImplementation(
    "getDuelEndRules",
    [state.duelEndRules],
    globalThis.JJKDuelEndCondition?.getDuelEndRules
  );
}

function getDuelSafetyRoundCap(battle = state.duelBattle) {
  const rules = getDuelEndRules();
  const debugCap = Number(rules.safety?.debugSafetyRoundCap || 120);
  const normalCap = Number(rules.safety?.normalSafetyRoundCap || 80);
  return state.debugMode || battle?.debugSafetyCap ? debugCap : normalCap;
}

function checkDuelHpEndCondition(battle) {
  return callDuelEndConditionImplementation(
    "checkDuelHpEndCondition",
    [battle, { survivalFloor: getDuelBattleSurvivalFloor(battle) }],
    globalThis.JJKDuelEndCondition?.checkDuelHpEndCondition
  );
}

function checkDuelSafetyCap(battle) {
  return callDuelEndConditionImplementation(
    "checkDuelSafetyCap",
    [battle, getDuelEndRules(), { debugMode: state.debugMode || battle?.debugSafetyCap }],
    globalThis.JJKDuelEndCondition?.checkDuelSafetyCap
  );
}

function resolveDuelBattleEnd(battle) {
  return callDuelEndConditionImplementation(
    "resolveDuelBattleEnd",
    [battle, getDuelEndRules(), { survivalFloor: getDuelBattleSurvivalFloor(battle), debugMode: state.debugMode || battle?.debugSafetyCap }],
    globalThis.JJKDuelEndCondition?.resolveDuelBattleEnd
  );
}

function buildDuelFinalSnapshot(battle) {
  return callDuelEndConditionImplementation(
    "buildDuelFinalSnapshot",
    [battle],
    globalThis.JJKDuelEndCondition?.buildDuelFinalSnapshot
  );
}

function getDuelEndReasonLabel(reason) {
  return callDuelEndConditionImplementation(
    "getDuelEndReasonLabel",
    [reason],
    globalThis.JJKDuelEndCondition?.getDuelEndReasonLabel
  );
}

function getDuelResourceRules() {
  return state.duelResourceRules || {
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
}

function getDuelActionRules() {
  return state.duelActionRules || {
    schema: "jjk-battle-runtime-action-templates",
    version: "0.1.0-candidate",
    status: "CANDIDATE",
    choiceCount: 3,
    riskLabels: { low: "低风险", medium: "中风险", high: "高风险", critical: "极高风险" },
    templates: [
      { id: "ce_reinforcement", label: "咒力强化", status: "CANDIDATE", description: "将咒力贴合肉体与近身节奏。", cost: { ceRatio: 0.045, minCe: 10 }, requirements: { domainActive: "any" }, effects: { outgoingScale: 1.12, weightDeltas: { initiative: 0.8, melee: 1.15, finisher: 0.35 }, stabilityDelta: -0.012, domainLoadDelta: 1.5 }, risk: "medium", logTemplate: "你将咒力集中于近身压制，本回合体术与直接输出上升。" },
      { id: "high_output_cursed_energy_blast", label: "大功率咒力输出", status: "CONFIRMED", description: "消耗更多咒力打出高于简单咒力打击的远程输出。", cardType: "basic", apCost: 1, cost: { ceRatio: 0.08, minCe: 18 }, requirements: { domainActive: "any" }, effects: { weightDeltas: { technique: 0.55, finisher: 0.25 }, stabilityDelta: -0.01, domainLoadDelta: 2 }, damage: 26, effect: { damage: 26 }, ceCost: 18, costType: "ce_ratio_min", damageType: "cursed_energy_blast", scalingProfile: "ce_burst", accuracyProfile: "technique_projectile", evasionAllowed: true, hitRateModifier: -0.04, risk: "medium", weight: 1.08, logTemplate: "你集中咒力打出大功率输出，伤害高于简单咒力打击，但咒力消耗更高。" },
      { id: "cursed_energy_focus", label: "咒力凝聚", status: "CONFIRMED", description: "消耗80CE凝聚咒力，本回合后续伤害提高20%。", cardType: "support", apCost: 1, cost: { ceRatio: 0, minCe: 80 }, requirements: { domainActive: "any" }, effects: { outgoingScale: 1.2, consumeOutgoingScaleOnDamage: false, weightDeltas: { technique: 0.6, finisher: 0.35 }, domainLoadDelta: 4 }, damage: 0, effect: { damage: 0 }, ceCost: 80, costType: "fixed", damageType: "none", scalingProfile: "support", risk: "medium", weight: 0.95, logTemplate: "你凝聚大量咒力，后续输出提高。" },
      { id: "loaned_next_shot", label: "贷款下一发", status: "CONFIRMED", description: "下一回合伤害增加35%，再下一回合开始伤害永久减少10%。", cardType: "support", apCost: 1, cost: { ceRatio: 0, minCe: 0 }, requirements: { domainActive: "any" }, effects: { delayedSelfStatuses: [{ id: "loaned_next_shot_boost", label: "贷款下一发", rounds: 1, value: 1.35, outgoingScale: 1.35, triggerDelayTurns: 1 }, { id: "loaned_shot_debt", label: "轻度贷款反噬", rounds: 999, value: 0.9, outgoingScale: 0.9, triggerDelayTurns: 2 }] }, damage: 0, effect: { damage: 0 }, ceCost: 0, costType: "fixed", damageType: "none", scalingProfile: "support", risk: "medium", weight: 0.9, logTemplate: "你把输出压力贷款到下一回合。" },
      { id: "defensive_frame", label: "防御构筑", status: "CANDIDATE", description: "用咒力构成防线。", cost: { ceRatio: 0.035, minCe: 8 }, requirements: { domainActive: "any" }, effects: { incomingHpScale: 0.76, incomingCeScale: 0.88, stabilityDelta: 0.018, weightDeltas: { counter: 0.45, sustain: 0.65 } }, risk: "low", logTemplate: "你先补足防御构筑，减少本回合体势损耗。" },
      { id: "technique_interference", label: "术式干涉", status: "CANDIDATE", description: "干扰对方术式与回流节奏。", cost: { ceRatio: 0.07, minCe: 14 }, requirements: { domainActive: "any" }, effects: { weightDeltas: { counter: 1.15, technique: 0.35 }, opponentWeightDeltas: { technique: -0.7, domain: -0.55 }, opponentStabilityDelta: -0.026, opponentDomainLoadDelta: 7, opponentRegenInterference: 0.22 }, risk: "medium", logTemplate: "你把咒力打入对方术式节奏，干扰其咒力回流与领域维持。" },
      { id: "residue_reading", label: "咒力流淌", status: "CANDIDATE", description: "调整自身咒力流向，使下一回合咒力回流提高15%。", cost: { ceRatio: 0.018, minCe: 4 }, requirements: { domainActive: "any" }, effects: { selfStatus: { id: "ceRegenBoost", label: "咒力流淌", rounds: 1, value: 0.15 } }, risk: "low", logTemplate: "你顺着咒力流向重新调息，下一回合咒力回流提高15%。" },
      { id: "ce_compression", label: "压缩咒力", status: "CANDIDATE", description: "收束咒力流动。", cost: { ceRatio: 0.028, minCe: 6 }, requirements: { domainActive: "any" }, effects: { outgoingScale: 0.9, stabilityDelta: 0.042, domainLoadDelta: -5, domainLoadScale: 0.72, weightDeltas: { sustain: 0.9, counter: 0.35, finisher: -0.55 } }, risk: "low", logTemplate: "你主动压缩咒力输出，降低领域负荷增长。" },
      { id: "domain_expand", label: "领域展开", status: "CANDIDATE", description: "展开领域进入高压结界。", cost: { ceRatio: 0.18, minCe: 34 }, requirements: { requiresDomainAccess: true, domainActive: false, blocksOnTechniqueImbalance: true }, effects: { activateDomain: true, domainLoadDelta: 18, weightDeltas: { domain: 2.4, technique: 0.7 }, outgoingScale: 1.12, stabilityDelta: -0.018 }, ignoreHandSelectionLimit: true, risk: "high", logTemplate: "你展开领域，结界压制启动，领域负荷同步上升。" },
      { id: "domain_compress", label: "压缩领域", status: "CANDIDATE", description: "主动收束领域边界。", cost: { ceRatio: 0.045, minCe: 10 }, requirements: { domainActive: true }, effects: { domainLoadDelta: -10, domainLoadScale: 0.45, outgoingScale: 0.88, stabilityDelta: 0.03, weightDeltas: { domain: -0.5, sustain: 1 } }, risk: "low", logTemplate: "你主动收束领域边界，换取负荷回落。" },
      { id: "domain_force_sustain", label: "强行维持领域", status: "CANDIDATE", description: "不顾负荷继续扩大领域压制。", cost: { ceRatio: 0.13, minCe: 24 }, requirements: { domainActive: true }, effects: { domainLoadDelta: 16, domainLoadScale: 1.45, outgoingScale: 1.2, stabilityDelta: -0.038, weightDeltas: { domain: 1.8, finisher: 0.6 } }, risk: "critical", logTemplate: "你强行维持领域压制，领域收益提高，但负荷逼近熔断线。" },
      { id: "domain_release", label: "主动解除领域", status: "CANDIDATE", description: "主动撤去领域避免熔断。", cost: { ceRatio: 0, minCe: 0 }, requirements: { domainActive: true }, effects: { releaseDomain: true, stabilityDelta: 0.035, domainLoadDelta: -8, weightDeltas: { sustain: 0.75, domain: -1.4 } }, risk: "low", logTemplate: "你主动解除领域，避免领域熔断。" },
      { id: "domain_clash", label: "领域对抗", status: "CANDIDATE", description: "以真正领域展开或高阶领域干涉正面对撞对方领域。", cost: { ceRatio: 0.14, minCe: 28 }, requirements: { opponentDomainActive: true, requiresDomainClash: true }, effects: { weightDeltas: { counter: 1.1, domain: 1.05 }, opponentWeightDeltas: { domain: -1.35, technique: -0.35 }, opponentDomainLoadDelta: 16, domainLoadDelta: 8, sureHitScale: 0.46, domainPressureScale: 0.72, manualAttackScale: 0.92, stabilityDelta: -0.024, lowStabilityHpRecoil: 5 }, risk: "high", logTemplate: "你以领域或高阶结界干涉正面对抗对方领域，推高对方领域负荷，但自身也承受领域负担。" },
      { id: "simple_domain_guard", label: "简易领域防御", status: "CANDIDATE", description: "以简易领域削弱必中，拖住对方领域压制。", cost: { ceRatio: 0.065, minCe: 12 }, requirements: { opponentDomainActive: true, requiresSimpleDomain: true }, effects: { sureHitScale: 0.35, domainPressureScale: 0.72, manualAttackScale: 0.95, incomingHpScale: 0.82, incomingCeScale: 0.9, opponentWeightDeltas: { domain: -0.35 }, opponentDomainLoadDelta: 2, stabilityDelta: -0.006, selfStatus: { id: "simpleDomainWearing", label: "简易领域磨损", rounds: 1, value: 1 } }, risk: "medium", logTemplate: "你展开简易领域削弱必中，结界边界被对方领域持续压缩并开始磨损。" },
      { id: "hollow_wicker_basket_guard", label: "弥虚葛笼", status: "CANDIDATE", description: "以弥虚葛笼抵消必中，但行动和输出受到明显限制。", cost: { ceRatio: 0.055, minCe: 10 }, requirements: { opponentDomainActive: true, requiresHollowWickerBasket: true }, effects: { sureHitScale: 0.28, domainPressureScale: 0.78, manualAttackScale: 1, incomingHpScale: 0.86, outgoingScale: 0.68, weightDeltas: { technique: -0.7, finisher: -0.8, melee: -0.35 }, opponentDomainLoadDelta: 1, selfStatus: { id: "hollowWickerBasketPosture", label: "弥虚葛笼架势受限", rounds: 1, value: 1 } }, risk: "medium", logTemplate: "你维持弥虚葛笼抵消必中，架势被迫固定，输出和机动同步受限。" },
      { id: "falling_blossom_emotion", label: "落花之情", status: "CANDIDATE", description: "以自动迎击削弱必中，是预留的反必中防线而非领域对撞。", cost: { ceRatio: 0.05, minCe: 10 }, requirements: { opponentDomainActive: true, requiresFallingBlossomEmotion: true }, effects: { sureHitScale: 0.48, domainPressureScale: 0.82, manualAttackScale: 0.95, incomingHpScale: 0.88, weightDeltas: { counter: 0.4 }, stabilityDelta: -0.004 }, risk: "medium", logTemplate: "你以落花之情自动迎击必中，削弱命中伤害，但这不是领域对撞。" },
      { id: "zero_ce_domain_bypass", label: "零咒力必中规避", status: "CANDIDATE", description: "零咒力个体不被领域必中正常捕捉，但仍会承受领域压制和手动攻击。", cost: { ceRatio: 0, minCe: 0 }, requirements: { opponentDomainActive: true, requiresZeroCeBypass: true }, effects: { sureHitScale: 0.08, domainPressureScale: 0.82, manualAttackScale: 1, incomingHpScale: 0.88, outgoingScale: 1.02, weightDeltas: { melee: 0.9, initiative: 0.55, counter: 0.35 } }, risk: "low", logTemplate: "零咒力个体不被领域必中正常捕捉，转而寻找近身突入、破坏结界锚点或脱出的机会。" },
      { id: "domain_survival_guard", label: "域内求生", status: "CANDIDATE", description: "缺少硬防线时以体势和咒力硬扛领域，只能争取一回合窗口。", cost: { ceRatio: 0.045, minCe: 0 }, requirements: { opponentDomainActive: true, requiresNoDomainResponse: true }, effects: { sureHitScale: 0.86, domainPressureScale: 0.93, manualAttackScale: 1, incomingHpScale: 0.92, stabilityDelta: -0.025, weightDeltas: { sustain: 0.55, counter: 0.15 } }, risk: "high", logTemplate: "你缺少领域或反领域硬防线，只能以体势和咒力硬扛，等待领域崩解、咒力耗尽或近身机会。" }
    ]
  };
}

function getDuelHandRules() {
  return state.techniqueHandRules || {
    schema: "jjk-battle-runtime-hand-rules",
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
    ap: {
      basePerTurn: 2,
      maxPerTurn: 3,
      carryOver: false
    },
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
      showTags: true
    },
    notes: "Hand-like candidates wrap existing duel actions only."
  };
}

function getDuelCharacterCardRules() {
  return state.duelCharacterCardRules || {
    schema: "jjk-battle-runtime-character-card-rules",
    version: "0.1.0",
    status: "CANDIDATE",
    description: "Character eligibility and weighting governance for duel hand candidates.",
    defaults: { enabled: false },
    archetypes: {},
    characters: {},
    sourceActionRules: {}
  };
}

function getDuelBetaCopy() {
  return state.duelBetaCopy || {
    version: "0.1.0",
    status: "CANDIDATE",
    title: "战斗反馈",
    summary: "记录并导出本场手札体验，便于复查出牌、咒力消耗与结算问题；不会改变战斗结果。",
    buttons: {
      export: "导出本场反馈",
      copy: "复制反馈 JSON"
    },
    notePlaceholder: "可选：记录本场试玩反馈。",
    publicHints: [
      "反馈包只用于复现与体验反馈，不参与战斗结算。",
      "导出的记录只用于复查，不会改变当前战斗。"
    ]
  };
}

function getDuelCardTemplateRules() {
  return state.duelCardTemplateRules || {
    schema: "jjk-battle-runtime-card-templates",
    version: "0.1.0",
    status: "CANDIDATE",
    description: "Card-like template metadata layered over existing duel action templates.",
    cardTypeLabels: {},
    rarityLabels: {},
    cards: []
  };
}

function getDuelCardCopyRules() {
  return state.duelCardCopyRules || {
    schema: "jjk-battle-runtime-card-copy",
    version: "0.1.0",
    status: "CANDIDATE",
    description: "Display copy layer for duel hand/card templates. This file does not define combat effects.",
    copy: []
  };
}

function getDuelMechanicTemplateRules() {
  return state.duelMechanicRules || {
    schema: "jjk-battle-runtime-mechanic-templates",
    version: "0.1.0-candidate",
    status: "CANDIDATE",
    mechanics: []
  };
}

function getDuelActionTemplates() {
  return callDuelActionsImplementation("getDuelActionTemplates", [], globalThis.JJKDuelActions?.getDuelActionTemplates);
}

function getDuelDomainProfiles() {
  return callDuelDomainProfileImplementation("getDuelDomainProfiles", [], globalThis.JJKDuelDomainProfile?.getDuelDomainProfiles);
}

function normalizeDuelDomainBarrierProfile(domainProfile = {}) {
  return callDuelDomainProfileImplementation(
    "normalizeDuelDomainBarrierProfile",
    [domainProfile],
    globalThis.JJKDuelDomainProfile?.normalizeDuelDomainBarrierProfile
  );
}

function inferDuelDomainBarrierType(domainProfile = {}) {
  return callDuelDomainProfileImplementation(
    "inferDuelDomainBarrierType",
    [domainProfile],
    globalThis.JJKDuelDomainProfile?.inferDuelDomainBarrierType
  );
}

function inferDuelDomainCompletion(domainProfile = {}, barrierType = "unknown") {
  return callDuelDomainProfileImplementation(
    "inferDuelDomainCompletion",
    [domainProfile, barrierType],
    globalThis.JJKDuelDomainProfile?.inferDuelDomainCompletion
  );
}

function getDuelTrialTargetRules() {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetRules", [], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetRules);
}

function normalizeDuelTrialEligibility(value = "", fallback = "partial") {
  return callDuelRuleSubphaseImplementation("normalizeDuelTrialEligibility", [value, fallback], globalThis.JJKDuelRuleSubphase?.normalizeDuelTrialEligibility);
}

function getDuelTrialTargetRuleClassId(trialSubjectType = "unknown") {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetRuleClassId", [trialSubjectType], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetRuleClassId);
}

function getDuelTrialTargetRuleProfile(trialSubjectType = "unknown") {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetRuleProfile", [trialSubjectType], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetRuleProfile);
}

function getDuelTrialTargetLabel(type = "unknown") {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetLabel", [type], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetLabel);
}

function getDuelTrialEligibilityLabel(eligibility = "partial") {
  return callDuelRuleSubphaseImplementation("getDuelTrialEligibilityLabel", [eligibility], globalThis.JJKDuelRuleSubphase?.getDuelTrialEligibilityLabel);
}

function getDuelTrialPhaseLabel(eligibility = "partial") {
  return callDuelRuleSubphaseImplementation("getDuelTrialPhaseLabel", [eligibility], globalThis.JJKDuelRuleSubphase?.getDuelTrialPhaseLabel);
}

function normalizeDuelTrialSubjectType(value = "") {
  return callDuelRuleSubphaseImplementation("normalizeDuelTrialSubjectType", [value], globalThis.JJKDuelRuleSubphase?.normalizeDuelTrialSubjectType);
}

function inferDuelTrialSubjectType(profile = {}, resource = null) {
  return callDuelRuleSubphaseImplementation("inferDuelTrialSubjectType", [profile, resource], globalThis.JJKDuelRuleSubphase?.inferDuelTrialSubjectType);
}

function normalizeDuelTrialEligibilityOverride(value, type) {
  return callDuelRuleSubphaseImplementation("normalizeDuelTrialEligibilityOverride", [value, type], globalThis.JJKDuelRuleSubphase?.normalizeDuelTrialEligibilityOverride);
}

function buildDuelTrialTargetProfile(profile = {}, resource = null, domainProfile = {}) {
  return callDuelRuleSubphaseImplementation("buildDuelTrialTargetProfile", [profile, resource, domainProfile], globalThis.JJKDuelRuleSubphase?.buildDuelTrialTargetProfile);
}

function isDuelTrialSubjectEligible(targetProfile = {}) {
  return callDuelRuleSubphaseImplementation("isDuelTrialSubjectEligible", [targetProfile], globalThis.JJKDuelRuleSubphase?.isDuelTrialSubjectEligible);
}

function getDuelTrialVerdictLabel(subPhase, key, fallback) {
  return callDuelRuleSubphaseImplementation("getDuelTrialVerdictLabel", [subPhase, key, fallback], globalThis.JJKDuelRuleSubphase?.getDuelTrialVerdictLabel);
}

function getDuelDomainBarrierModifiers(domainProfile, actor = null, opponent = null, duelState = state.duelBattle) {
  return callDuelDomainProfileImplementation(
    "getDuelDomainBarrierModifiers",
    [domainProfile, actor, opponent, duelState],
    globalThis.JJKDuelDomainProfile?.getDuelDomainBarrierModifiers
  );
}

function applyDuelDomainBarrierModifiers(actor, opponent, event = {}, context = {}) {
  const battle = context.battle || state.duelBattle;
  const stateEntry = context.profileState || battle?.domainProfileStates?.[actor?.side || ""];
  const rawProfile = stateEntry?.profile || getDuelDomainProfileForCharacter(getDuelProfileForSide(battle, actor?.side || ""), null, battle);
  if (!rawProfile) {
    return getDuelDomainBarrierModifiers({ barrierType: "unknown", domainCompletion: "unknown" }, actor, opponent, battle);
  }
  return getDuelDomainBarrierModifiers(rawProfile, actor, opponent, battle);
}

function getDuelDomainBarrierSummary(profile = {}) {
  return callDuelDomainProfileImplementation(
    "getDuelDomainBarrierSummary",
    [profile],
    globalThis.JJKDuelDomainProfile?.getDuelDomainBarrierSummary
  );
}

function getDuelProfileForSide(battle, side) {
  if (side === "left") return battle?.left || null;
  if (side === "right") return battle?.right || null;
  return null;
}

function isBattleDirectRuntimeAction(action) {
  return Boolean(action && action.effect && action.cost && Array.isArray(action.contexts) && action.effect && action.cost);
}

function isCursedToolDuelAction(action) {
  const tags = []
    .concat(Array.isArray(action?.tags) ? action.tags : [])
    .concat(Array.isArray(action?.matchTags) ? action.matchTags : [])
    .map((value) => String(value || "").trim().toLowerCase());
  if (tags.includes("higuruma_trial_owner")) return false;
  const markers = tags.concat([
    action?.cardType,
    action?.damageType,
    action?.effect?.damageType,
    action?.effect?.special?.kind
  ].map((value) => String(value || "").trim().toLowerCase()));
  return markers.some((value) => value === "咒具" || /^(?:curse|cursed)[_-]?tool$/.test(value) || value === "cursedtool");
}

function getBattleRuntimeActionCostCe(action, actor) {
  if (isCursedToolDuelAction(action)) return 0;
  if (isBattleDirectRuntimeAction(action)) return Math.max(0, Number(action.cost?.ce || 0));
  if (Number.isFinite(Number(action?.ceCost))) return Math.max(0, Number(action.ceCost));
  if (Number.isFinite(Number(action?.costCe))) return Math.max(0, Number(action.costCe));
    const cost = action?.cost || {};
  const ratioCost = Number(actor?.maxCe || 0) * Number(cost.ceRatio || 0);
  return Number(Math.max(Number(cost.flatCe || 0), Number(cost.minCe || 0), ratioCost).toFixed(1));
}

function getBattleRuntimeActionDamage(action) {
  if (isBattleDirectRuntimeAction(action)) return Number(action.effect?.damage || 0);
  return Number(action?.effect?.damage ?? action?.damage ?? 0);
}

function getDuelActionCost(action, actor) {
  if (isCursedToolDuelAction(action)) return 0;
  if (isBattleDirectRuntimeAction(action)) return getBattleRuntimeActionCostCe(action, actor);
  const costPreview = globalThis.JJKDuelCardTemplate?.calculateDuelCardCeCost;
  if (typeof costPreview === "function") {
    const preview = costPreview(action, actor || {});
    if (Number.isFinite(Number(preview?.finalCost))) return Math.max(0, Number(preview.finalCost));
  }
  if (action?.costType === "zero_ce" || action?.zeroCeCostOverride) return 0;
  return getBattleRuntimeActionCostCe(action, actor);
}

function getDuelDomainResponseProfile(profile, actor = null, opponent = null, duelState = state.duelBattle) {
  return callDuelDomainResponseImplementation(
    "getDuelDomainResponseProfile",
    [profile, actor, opponent, duelState],
    globalThis.JJKDuelDomainResponse?.getDuelDomainResponseProfile
  );
}

function hasDuelDomainCounterAccess(profile) {
  return callDuelDomainResponseImplementation(
    "hasDuelDomainCounterAccess",
    [profile],
    globalThis.JJKDuelDomainResponse?.hasDuelDomainCounterAccess
  );
}

function isDuelOpponentDomainThreat(opponent, actor = null, battle = state.duelBattle) {
  return callDuelDomainResponseImplementation(
    "isDuelOpponentDomainThreat",
    [opponent, actor, battle],
    globalThis.JJKDuelDomainResponse?.isDuelOpponentDomainThreat
  );
}

function isDuelDomainActivationAction(action) {
  return callDuelDomainResponseImplementation(
    "isDuelDomainActivationAction",
    [action],
    globalThis.JJKDuelDomainResponse?.isDuelDomainActivationAction
  );
}

function getDuelDomainProfileForCharacter(profile, card = null, duelState = state.duelBattle) {
  return callDuelDomainProfileImplementation(
    "getDuelDomainProfileForCharacter",
    [profile, card, duelState],
    globalThis.JJKDuelDomainProfile?.getDuelDomainProfileForCharacter
  );
}

function buildDuelDomainSpecificActions(actor, opponent, duelState = state.duelBattle) {
  return callDuelActionsImplementation("buildDuelDomainSpecificActions", [actor, opponent, duelState], globalThis.JJKDuelActions?.buildDuelDomainSpecificActions);
}

function invalidateDuelActionChoices(battle = state.duelBattle) {
  return callDuelActionsImplementation("invalidateDuelActionChoices", [battle], globalThis.JJKDuelActions?.invalidateDuelActionChoices);
}

function buildDuelDomainTrialContext(profile, actor, opponent, battle = state.duelBattle, response = {}, options = {}) {
  return callDuelRuleSubphaseImplementation("buildDuelDomainTrialContext", [profile, actor, opponent, battle, response, options], globalThis.JJKDuelRuleSubphase?.buildDuelDomainTrialContext);
}

function updateDuelDomainTrialContext(battle = state.duelBattle, patch = {}) {
  return callDuelRuleSubphaseImplementation("updateDuelDomainTrialContext", [battle, patch], globalThis.JJKDuelRuleSubphase?.updateDuelDomainTrialContext);
}

function getDuelActiveTrialContext(battle = state.duelBattle, subPhase = battle?.domainSubPhase) {
  return callDuelRuleSubphaseImplementation("getDuelActiveTrialContext", [battle, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelActiveTrialContext);
}

function getDuelTrialStatusLabel(status = "pending") {
  return callDuelRuleSubphaseImplementation("getDuelTrialStatusLabel", [status], globalThis.JJKDuelRuleSubphase?.getDuelTrialStatusLabel);
}

function getDuelTrialEndReasonLabel(reason = "") {
  return callDuelRuleSubphaseImplementation("getDuelTrialEndReasonLabel", [reason], globalThis.JJKDuelRuleSubphase?.getDuelTrialEndReasonLabel);
}

function syncDuelTrialSubPhaseLifecycle(battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("syncDuelTrialSubPhaseLifecycle", [battle], globalThis.JJKDuelRuleSubphase?.syncDuelTrialSubPhaseLifecycle);
}

function getDuelTrialTargetChoiceTemplates(subPhase = {}, roleFilter = null) {
  return callDuelRuleSubphaseImplementation("getDuelTrialTargetChoiceTemplates", [subPhase, roleFilter], globalThis.JJKDuelRuleSubphase?.getDuelTrialTargetChoiceTemplates);
}

function getDuelTrialOwnerActionTemplates(profile, subPhase = {}) {
  return callDuelRuleSubphaseImplementation("getDuelTrialOwnerActionTemplates", [profile, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelTrialOwnerActionTemplates);
}

function getDuelTrialDefenderActionTemplates(profile, subPhase = {}) {
  return callDuelRuleSubphaseImplementation("getDuelTrialDefenderActionTemplates", [profile, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelTrialDefenderActionTemplates);
}

function getDuelJackpotActionTemplates(profile, subPhase = {}) {
  return callDuelRuleSubphaseImplementation("getDuelJackpotActionTemplates", [profile, subPhase], globalThis.JJKDuelRuleSubphase?.getDuelJackpotActionTemplates);
}

function normalizeDuelDomainSpecificAction(template, profile, actor, opponent, stateEntry = {}, duelState = state.duelBattle) {
  const normalized = {
    id: template.id,
    label: template.label,
    status: "CANDIDATE",
    description: template.description || profile?.domainName || "领域专属手法",
    cost: template.cost || { ceRatio: 0.03, minCe: 0 },
    requirements: { domainSpecific: true },
    effects: template.effects || {},
    risk: template.risk || "medium",
    logTemplate: `${profile?.domainName || "领域"}：${template.description || template.label}`,
    domainSpecific: true,
    domainProfileId: profile?.id || "",
    domainName: profile?.domainName || "",
    domainClass: profile?.domainClass || "",
    domainRole: template.role || "",
    trialEligibility: template.trialEligibility || profile?.trialEligibility || null,
    trialSubjectType: template.trialSubjectType || profile?.trialSubjectType || "",
    hasLegalAgency: template.hasLegalAgency ?? profile?.hasLegalAgency,
    hasSelfAwareness: template.hasSelfAwareness ?? profile?.hasSelfAwareness,
    canDefend: template.canDefend ?? profile?.canDefend,
    canRemainSilent: template.canRemainSilent ?? profile?.canRemainSilent,
    verdictVocabulary: template.verdictVocabulary || profile?.verdictVocabulary || null,
    notes: template.notes || "",
    domainOwnerSide: stateEntry.ownerSide || ""
  };
  const availability = getDuelActionAvailability(normalized, actor, opponent, duelState);
  return {
    ...normalized,
    costCe: availability.costCe,
    available: availability.available,
    unavailableReason: availability.reason,
    riskLabel: getDuelActionRiskLabel(normalized, actor, opponent)
  };
}

function getDuelDomainProfileResponseImpact(responseAction, domainProfile = null) {
  return callDuelDomainResponseImplementation(
    "getDuelDomainProfileResponseImpact",
    [responseAction, domainProfile],
    globalThis.JJKDuelDomainResponse?.getDuelDomainProfileResponseImpact
  );
}

function addOrRefreshDuelStatusEffect(resource, effect = {}) {
  if (!resource || !effect.id) return;
  const normalized = {
    ...effect,
    rounds: Math.max(1, Number(effect.rounds || 1)),
    value: Number(effect.value ?? 1)
  };
  const existing = resource.statusEffects?.find((item) => item.id === normalized.id);
  if (existing) {
    existing.rounds = Math.max(Number(existing.rounds || 0), normalized.rounds);
    existing.value = Math.max(Number(existing.value || 0), normalized.value);
    existing.label = normalized.label || existing.label;
    return;
  }
  resource.statusEffects ||= [];
  resource.statusEffects.push(normalized);
}

function resolveDuelDomainProfileActivations(battle, pairs = []) {
  return callDuelDomainProfileImplementation(
    "resolveDuelDomainProfileActivations",
    [battle, pairs],
    globalThis.JJKDuelDomainProfile?.resolveDuelDomainProfileActivations
  );
}

function applyDuelDomainProfileOnActivation(actor, opponent, duelState = state.duelBattle, context = {}) {
  return callDuelDomainProfileImplementation(
    "applyDuelDomainProfileOnActivation",
    [actor, opponent, duelState, context],
    globalThis.JJKDuelDomainProfile?.applyDuelDomainProfileOnActivation
  );
}

function createDuelTrialSubPhase(profile, actor, opponent, battle = state.duelBattle, context = {}) {
  return callDuelRuleSubphaseImplementation("createDuelTrialSubPhase", [profile, actor, opponent, battle, context], globalThis.JJKDuelRuleSubphase?.createDuelTrialSubPhase);
}

function updateDuelTrialVerdictState(subPhase) {
  return callDuelRuleSubphaseImplementation("updateDuelTrialVerdictState", [subPhase], globalThis.JJKDuelRuleSubphase?.updateDuelTrialVerdictState);
}

function createDuelJackpotSubPhase(profile, actor, opponent, battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("createDuelJackpotSubPhase", [profile, actor, opponent, battle], globalThis.JJKDuelRuleSubphase?.createDuelJackpotSubPhase);
}

function updateDuelJackpotState(subPhase) {
  return callDuelRuleSubphaseImplementation("updateDuelJackpotState", [subPhase], globalThis.JJKDuelRuleSubphase?.updateDuelJackpotState);
}

function applyDuelDomainSpecificAction(action, actor, opponent, duelState = state.duelBattle) {
  const battle = duelState || state.duelBattle;
  if (!action?.domainSpecific || !battle) return null;
  const subPhase = battle.domainSubPhase;
  if (subPhase?.type === "trial" && action.domainProfileId === subPhase.domainId && !subPhase.verdictResolved) {
    return applyDuelTrialAction(action, actor, opponent, battle);
  }
  if (subPhase?.type === "jackpot" && action.domainProfileId === subPhase.domainId && !subPhase.jackpotResolved) {
    return applyDuelJackpotAction(action, actor, opponent, battle);
  }
  const effects = action.effects || {};
  const stateEntry = battle.domainProfileStates?.[action.domainOwnerSide || actor.side];
  if (Number(effects.ownerDomainLoadDelta || 0) && stateEntry?.ownerSide) {
    const owner = getDuelResourcePair(battle, stateEntry.ownerSide);
    if (owner?.domain) {
      owner.domain.load += Number(effects.ownerDomainLoadDelta || 0);
      clampDuelResource(owner);
    }
  }
  appendDuelDomainProfileLog(battle, {
    side: actor.side,
    title: `${action.domainName || "领域"}手法`,
    type: action.domainClass === "rule_trial" || action.domainRole ? "subphase" : "domain",
    detail: `${actor.name} 选择${action.label}，${action.description || "专属领域规则继续推进"}。`
  });
  return { domainActionId: action.id, domainProfileId: action.domainProfileId };
}

function applyDuelTrialAction(action, actor, opponent, battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("applyDuelTrialAction", [action, actor, opponent, battle], globalThis.JJKDuelRuleSubphase?.applyDuelTrialAction);
}

function applyDuelJackpotAction(action, actor, opponent, battle = state.duelBattle) {
  return callDuelRuleSubphaseImplementation("applyDuelJackpotAction", [action, actor, opponent, battle], globalThis.JJKDuelRuleSubphase?.applyDuelJackpotAction);
}

function resolveDuelJackpot(action, actor, opponent, battle = state.duelBattle, before = {}) {
  return callDuelRuleSubphaseImplementation("resolveDuelJackpot", [action, actor, opponent, battle, before], globalThis.JJKDuelRuleSubphase?.resolveDuelJackpot);
}

function resolveDuelTrialVerdict(action, actor, opponent, battle = state.duelBattle, before = {}) {
  return callDuelRuleSubphaseImplementation("resolveDuelTrialVerdict", [action, actor, opponent, battle, before], globalThis.JJKDuelRuleSubphase?.resolveDuelTrialVerdict);
}

function appendDuelDomainProfileLog(battle, entry = {}) {
  if (!battle) return;
  recordDuelResourceChange(battle, {
    side: entry.side || "neutral",
    title: entry.title || "领域资料层",
    detail: entry.detail || "",
    type: entry.type || entry.category || "domain",
    delta: {
      domainProfile: true,
      status: "CANDIDATE",
      ...(entry.delta || {})
    }
  });
}

function getDuelActionAvailability(action, actor, opponent, duelState) {
  return callDuelActionsImplementation("getDuelActionAvailability", [action, actor, opponent, duelState], globalThis.JJKDuelActions?.getDuelActionAvailability);
}

function buildDuelActionPool(actor, opponent, duelState) {
  return callDuelActionsImplementation("buildDuelActionPool", [actor, opponent, duelState], globalThis.JJKDuelActions?.buildDuelActionPool);
}

function pickDuelActionChoices(actor, opponent, duelState, count = 3) {
  return callDuelActionsImplementation("pickDuelActionChoices", [actor, opponent, duelState, count], globalThis.JJKDuelActions?.pickDuelActionChoices);
}

function initializeDuelHandState(battle = state.duelBattle) {
  return callDuelHandImplementation("initializeDuelHandState", [battle], globalThis.JJKDuelHand?.initializeDuelHandState);
}

function buildDuelHandCandidates(actor, opponent, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("buildDuelHandCandidates", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.buildDuelHandCandidates);
}

function pickDuelHandCandidates(actor, opponent, duelState = state.duelBattle, count) {
  return callDuelHandImplementation("pickDuelHandCandidates", [actor, opponent, duelState, count], globalThis.JJKDuelHand?.pickDuelHandCandidates);
}

function pickDuelDomainHandCandidates(actor, opponent, duelState = state.duelBattle, count) {
  return callDuelHandImplementation("pickDuelDomainHandCandidates", [actor, opponent, duelState, count], globalThis.JJKDuelHand?.pickDuelDomainHandCandidates);
}

function buildDuelCharacterCardProfile(characterOrActor, options = {}) {
  return callDuelHandImplementation("buildDuelCharacterCardProfile", [characterOrActor, options], globalThis.JJKDuelHand?.buildDuelCharacterCardProfile);
}

function isDuelCardEligibleForCharacter(actionOrCandidate, characterOrActor, options = {}) {
  return callDuelHandImplementation("isDuelCardEligibleForCharacter", [actionOrCandidate, characterOrActor, options], globalThis.JJKDuelHand?.isDuelCardEligibleForCharacter);
}

function applyDuelCharacterCardWeights(candidates, characterOrActor, options = {}) {
  return callDuelHandImplementation("applyDuelCharacterCardWeights", [candidates, characterOrActor, options], globalThis.JJKDuelHand?.applyDuelCharacterCardWeights);
}

function filterDuelHandCandidatesByCharacter(candidates, characterOrActor, options = {}) {
  return callDuelHandImplementation("filterDuelHandCandidatesByCharacter", [candidates, characterOrActor, options], globalThis.JJKDuelHand?.filterDuelHandCandidatesByCharacter);
}

function explainDuelCardIneligibility(actionOrCandidate, characterOrActor, options = {}) {
  return callDuelHandImplementation("explainDuelCardIneligibility", [actionOrCandidate, characterOrActor, options], globalThis.JJKDuelHand?.explainDuelCardIneligibility);
}

function getDuelHandCardViewModel(candidate, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle) {
  return callDuelHandImplementation("getDuelHandCardViewModel", [candidate, actor, opponent, duelState], globalThis.JJKDuelHand?.getDuelHandCardViewModel);
}

function applyDuelHandSelection(actionOrId, actor, opponent, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("applyDuelHandSelection", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.applyDuelHandSelection);
}

function getDuelSelectedHandActions(battle = state.duelBattle, side = "left") {
  return callDuelHandImplementation("getDuelSelectedHandActions", [battle, side], globalThis.JJKDuelHand?.getDuelSelectedHandActions);
}

function canSelectDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("canSelectDuelHandCandidate", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.canSelectDuelHandCandidate);
}

function selectDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("selectDuelHandCandidate", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.selectDuelHandCandidate);
}

function unselectDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("unselectDuelHandCandidate", [actionOrId, actor, opponent, duelState, options], globalThis.JJKDuelHand?.unselectDuelHandCandidate);
}

function discardDuelHandCandidate(actionOrId, actor = state.duelBattle?.resourceState?.p1, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("discardDuelHandCandidate", [actionOrId, actor, duelState, options], globalThis.JJKDuelHand?.discardDuelHandCandidate);
}

function autoDiscardDuelHandOverflow(actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("autoDiscardDuelHandOverflow", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.autoDiscardDuelHandOverflow) || [];
}

function isDuelHandLimitExemptCard(actionOrCandidate) {
  return Boolean(callDuelHandImplementation(
    "isHandLimitExemptCard",
    [actionOrCandidate],
    globalThis.JJKDuelHand?.isHandLimitExemptCard
  ));
}

function applyDuelSelectedHandActions(actor, opponent, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("applyDuelSelectedHandActions", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.applyDuelSelectedHandActions);
}

function resolveDuelHandTurn(battle = state.duelBattle, options = {}) {
  return callDuelHandImplementation("resolveDuelHandTurn", [battle, options], globalThis.JJKDuelHand?.resolveDuelHandTurn);
}

function clearDuelSelectedHandActions(battle = state.duelBattle, side = "left", options = {}) {
  return callDuelHandImplementation("clearDuelSelectedHandActions", [battle, side, options], globalThis.JJKDuelHand?.clearDuelSelectedHandActions);
}

function consumeDuelResolvedHandActions(battle = state.duelBattle, side = "left", actions = [], options = {}) {
  return callDuelHandImplementation("consumeDuelResolvedHandActions", [battle, side, actions, options], globalThis.JJKDuelHand?.consumeDuelResolvedHandActions);
}

function pickDuelCpuHandActions(actor = state.duelBattle?.resourceState?.p2, opponent = state.duelBattle?.resourceState?.p1, duelState = state.duelBattle, options = {}) {
  return callDuelHandImplementation("pickDuelCpuHandActions", [actor, opponent, duelState, options], globalThis.JJKDuelHand?.pickDuelCpuHandActions);
}

function trimDuelApiBase(base) {
  return String(base || "").replace(/\/+$/, "");
}

function isDuelLocalStaticHost(hostname = location.hostname || "") {
  return ["localhost", "127.0.0.1", "::1", ""].includes(String(hostname || "").toLowerCase()) && String(location.port || "") !== "8787";
}

function getDuelCloudCpuPlannerApiBases() {
  if (isDedicatedServerNativeRuntime()) return [DEDICATED_SERVER_HTTPS_ORIGIN];
  const host = String(location.hostname || "");
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return [trimDuelApiBase(location.origin)].filter(Boolean);
  return [DEDICATED_SERVER_HTTPS_ORIGIN];
}

function getDuelCloudCpuPlannerApiBase() {
  return getDuelCloudCpuPlannerApiBases()[0] || location.origin;
}

function buildDuelCpuPlannerApiUrl(base, path) {
  return `${trimDuelApiBase(base)}${path}`;
}

async function fetchDuelCpuPlannerApi(path, options = {}) {
  const bases = getDuelCloudCpuPlannerApiBases();
  let lastError = null;
  for (const base of bases) {
    const url = buildDuelCpuPlannerApiUrl(base, path);
    try {
      const response = await fetch(url, options);
      if (response.status === 404 && base === trimDuelApiBase(location.origin) && bases.length > 1) {
        lastError = new Error(`cloud-cpu-plan-${response.status}`);
        continue;
      }
      response.duelCpuPlannerApiBase = base;
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`cloud-cpu-plan-api-unavailable:${path}`);
}

function shouldUseDuelCloudCpuPlanner(battle) {
  if (!battle || battle.mode !== "solo" || isOnlineDuelModeActive()) return false;
  const mode = normalizeDuelCpuComputeMode(battle.cpuComputeMode || state.duelCpuComputeMode || getSelectedDuelCpuComputeMode());
  if (mode === "local") return false;
  if (typeof fetch !== "function" || typeof AbortController !== "function") return false;
  if (String(location.protocol || "") === "file:") return false;
  if (isDuelLocalStaticHost()) return false;
  return true;
}

function getRemoteDuelCpuCandidateId(candidate) {
  const action = candidate?.action || candidate || {};
  return String(candidate?.actionId || candidate?.id || action.id || action.cardId || action.actionId || "").trim();
}

function getRemoteDuelCpuCandidateText(candidate) {
  const action = candidate?.action || candidate || {};
  return [
    candidate?.label,
    candidate?.name,
    action.label,
    action.name,
    action.description,
    action.cardType,
    action.type,
    action.sourceTechniqueFamily,
    action.techniqueName,
    action.mechanicId,
    ...(Array.isArray(candidate?.tags) ? candidate.tags : []),
    ...(Array.isArray(action.tags) ? action.tags : []),
    ...(Array.isArray(action.specialHandTags) ? action.specialHandTags : []),
    ...(Array.isArray(action["特殊手札"]) ? action["特殊手札"] : [])
  ].filter(Boolean).join(" ");
}

function summarizeRemoteDuelCpuCandidate(candidate, actor, opponent, battle) {
  const action = candidate?.action || candidate || {};
  const id = getRemoteDuelCpuCandidateId(candidate);
  if (!id || !action?.id) return null;
  const availability = getDuelActionAvailability(action, actor, opponent, battle) || {};
  const text = getRemoteDuelCpuCandidateText(candidate);
  const type = String(action.cardType || action.type || candidate?.type || "").toLowerCase();
  const effects = action.effects || {};
  const damage = Math.max(0,
    Number(action.effect?.damage ?? action.damage ?? effects.damage ?? 0) +
    Number(action.effect?.stabilityDamage ?? action.baseStabilityDamage ?? 0) * 0.85 +
    Number(action.effect?.ceDamage ?? action.baseCeDamage ?? 0) * 0.35 +
    Number(action.effect?.domainPressure ?? action.baseDomainPressure ?? 0) * 0.5
  );
  const block = Math.max(0,
    Number(action.effect?.block ?? action.block ?? effects.block ?? 0) +
    Number(action.baseShield || 0) * 0.7 +
    Number(effects.damageReduction || 0) * 80
  );
  const healing = Math.max(0,
    Number(action.baseHpRestore || effects.hpRestore || effects.healing || 0) +
    Number(action.baseCeRestore || effects.ceRestore || 0) * 0.18
  );
  return {
    id,
    label: String(candidate?.label || (action.label || action.name) || action.name || id).slice(0, 80),
    type,
    text: text.slice(0, 520),
    ceCost: Math.max(0, Number(availability.costCe ?? getDuelActionCost(action, actor) ?? action.cost?.ce ?? action.cost?.flatCe ?? 0)),
    apCost: Math.max(0, Number(action.cost?.ap ?? action.apCost ?? 1)),
    available: availability.available !== false,
    reason: String(availability.reason || "").slice(0, 120),
    damage: Number(damage.toFixed(3)),
    block: Number(block.toFixed(3)),
    healing: Number(healing.toFixed(3)),
    hitRate: Math.max(0.05, Math.min(1, normalizeDuelRate(action.baseHitRate ?? action.hitRate ?? 0.75, 0.75))),
    risk: String(action.risk || "medium"),
    domain: Boolean(effects.activateDomain || /domain|领域|展开|无量空处|伏魔御厨子|嵌合暗翳庭/i.test(type + " " + text)),
    domainExpand: Boolean(effects.activateDomain || id === "domain_expand" || action.cardId === "card_domain_expand" || /domain_expand|领域展开|伏魔御厨子|无量空处|嵌合暗翳庭/i.test(type + " " + text)),
    tenShadows: /ten_shadows|十种影|十影|魔虚罗|魔须罗|式神|嵌合暗翳庭/i.test(text),
    dounaMahoraga: id === "douna_subdued_mahoraga_summon" || action.cardId === "card_douna_subdued_mahoraga_summon" || /douna_subdued_mahoraga|已调伏魔虚罗|协同召唤|協同召唤/i.test(text),
    functional: Boolean(action.summonSpec || action.resourceSpec || action.maintenanceSpec || /support|resource|defense|counter|summon|领域|防御|护卫|回复|治疗|反转|适应|调伏|式神/i.test(type + " " + text)),
    summon: Boolean(action.summonSpec || /summon|召唤|式神|魔虚罗|魔须罗/i.test(type + " " + text)),
    resource: Boolean(action.resourceSpec || /resource|咒力|补充|恢复|蓄力/i.test(type + " " + text))
  };
}

function findRemoteDuelCpuCandidateById(candidates, actionId) {
  const wanted = String(actionId || "").trim();
  if (!wanted) return null;
  return (candidates || []).find((candidate) => getRemoteDuelCpuCandidateId(candidate) === wanted) || null;
}

async function pickDuelCpuHandActionsCloudFirst(actor = state.duelBattle?.resourceState?.p2, opponent = state.duelBattle?.resourceState?.p1, duelState = state.duelBattle, options = {}) {
  const battle = duelState || state.duelBattle;
  const computeMode = normalizeDuelCpuComputeMode(battle?.cpuComputeMode || state.duelCpuComputeMode || getSelectedDuelCpuComputeMode());
  if (!shouldUseDuelCloudCpuPlanner(battle)) return pickDuelCpuHandActions(actor, opponent, battle, options);
  const side = options?.side || actor?.side || "right";
  const startedAt = performance.now();
  try {
    const rules = getDuelHandRules();
    const firstPick = getDuelCpuAction(actor, opponent, battle);
    const handCandidates = pickDuelHandCandidates(actor, opponent, battle);
    const domainCandidates = pickDuelDomainHandCandidates(actor, opponent, battle);
    const ordered = [];
    [firstPick].concat(domainCandidates || [], handCandidates || []).forEach((candidate) => {
      const id = getRemoteDuelCpuCandidateId(candidate);
      if (id && !ordered.some((item) => getRemoteDuelCpuCandidateId(item) === id)) ordered.push(candidate);
    });
    const summaries = ordered
      .map((candidate) => summarizeRemoteDuelCpuCandidate(candidate, actor, opponent, battle))
      .filter(Boolean);
    if (!summaries.length) return pickDuelCpuHandActions(actor, opponent, battle, options);
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 1100);
    const response = await fetchDuelCpuPlannerApi("/api/duel-cpu-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        difficulty: options?.difficulty || battle.cpuDifficulty || "normal",
        maxSelections: Number(rules?.maxSelections || 3),
        actor: {
          hp: Number(actor?.hp || 0),
          maxHp: Number(actor?.maxHp || 0),
          ce: Number(actor?.ce || 0),
          maxCe: Number(actor?.maxCe || 0),
          side,
          domainActive: Boolean(actor?.domain?.active),
          domainAccess: Boolean(hasDuelDomainAccess(actor?.characterCardProfile || actor?.profile || actor || {})),
          combatPower: Number(actor?.combatPowerUnit?.value || battle?.right?.combatPowerUnit?.value || 0)
        },
        opponent: {
          hp: Number(opponent?.hp || 0),
          maxHp: Number(opponent?.maxHp || 0),
          ce: Number(opponent?.ce || 0),
          maxCe: Number(opponent?.maxCe || 0),
          domainActive: Boolean(opponent?.domain?.active),
          domainAccess: Boolean(hasDuelDomainAccess(opponent?.characterCardProfile || opponent?.profile || opponent || {})),
          combatPower: Number(opponent?.combatPowerUnit?.value || battle?.left?.combatPowerUnit?.value || 0)
        },
        round: Number(battle?.round || 0) + 1,
        candidates: summaries
      }),
      signal: controller.signal,
      cache: "no-store"
    });
    globalThis.clearTimeout(timer);
    if (!response.ok) throw new Error(`cloud-cpu-plan-${response.status}`);
    const data = await response.json();
    const actionIds = Array.isArray(data?.actionIds) ? data.actionIds.map((id) => String(id || "")) : [];
    if (!data?.ok || !actionIds.length) throw new Error(data?.error || "cloud-cpu-empty-plan");
    resetDuelApForTurn(battle, side);
    clearDuelSelectedHandActions(battle, side, { refund: false, rules });
    const failures = [];
    actionIds.forEach((actionId) => {
      const candidate = findRemoteDuelCpuCandidateById(ordered, actionId);
      if (!candidate) {
        failures.push({ actionId, reason: "candidate-not-found" });
        return;
      }
      const selected = selectDuelHandCandidate(candidate, actor, opponent, battle, { side, rules });
      if (!selected?.selected) failures.push({ actionId, reason: selected?.reason || "select-failed" });
    });
    const selected = getDuelSelectedHandActions(battle, side);
    if (!selected.length) throw new Error("cloud-cpu-selection-empty");
    battle.cpuPlannerLog = {
      ...(data.log || {}),
      source: "cloud",
      computeMode,
      apiBase: response.duelCpuPlannerApiBase || getDuelCloudCpuPlannerApiBase(),
      latencyMs: Math.round(performance.now() - startedAt),
      selectionFailures: failures.slice(0, 8),
      finalSelectedCount: selected.length
    };
    return selected;
  } catch (error) {
    const selected = pickDuelCpuHandActions(actor, opponent, battle, options);
    battle.cpuPlannerLog = {
      ...(battle.cpuPlannerLog || {}),
      source: "local-fallback",
      computeMode,
      cloudError: String(error?.message || error),
      latencyMs: Math.round(performance.now() - startedAt)
    };
    return selected;
  }
}

function getDuelActionApCost(action, actor = state.duelBattle?.resourceState?.p1, opponent = state.duelBattle?.resourceState?.p2, duelState = state.duelBattle) {
  return callDuelHandImplementation("getDuelActionApCost", [action, actor, opponent, duelState], globalThis.JJKDuelHand?.getDuelActionApCost);
}

function getDuelApState(battle = state.duelBattle, side = "left") {
  return callDuelHandImplementation("getDuelApState", [battle, side], globalThis.JJKDuelHand?.getDuelApState);
}

function spendDuelAp(battle = state.duelBattle, side = "left", amount = 1, options = {}) {
  return callDuelHandImplementation("spendDuelAp", [battle, side, amount, options], globalThis.JJKDuelHand?.spendDuelAp);
}

function resetDuelApForTurn(battle = state.duelBattle, side = "left") {
  return callDuelHandImplementation("resetDuelApForTurn", [battle, side], globalThis.JJKDuelHand?.resetDuelApForTurn);
}

function getDuelActionRiskLabel(action, actor, opponent) {
  const helper = globalThis.JJKDuelActions?.getDuelActionRiskLabel;
  if (typeof helper === "function") return helper(action, actor, opponent);
  const rules = getDuelActionRules();
  return rules.riskLabels?.[action?.risk] || action?.risk || "风险未知";
}

function updateDuelActionAvailability(battle = state.duelBattle) {
  if (!battle?.resourceState || battle.resolved) return [];
  syncDuelTrialSubPhaseLifecycle(battle);
  const { actorSide, actor, opponent } = getDuelSideResources(battle);
  const onlinePresentation = battle?.mode === "online"
    ? globalThis.JJKOnlineTurnPresentation?.deriveOnlineTurnPresentation?.(battle.onlineRoomSnapshot || {}, actorSide, { submitting: Boolean(state.duelModeState.localLocked) })
    : null;
  if (onlinePresentation?.inputDisabled) {
    battle.actionUiMessage = onlinePresentation.message;
    battle.actionChoices = [];
    battle.handCandidates = [];
    battle.domainHandCandidates = [];
    return [];
  }
  const isNewActionRound = battle.actionRound !== battle.round + 1;
  if (isNewActionRound) {
    resetDuelApForTurn(battle, actorSide);
    clearDuelSelectedHandActions(battle, actorSide, { refund: false });
    battle.pendingAction = null;
    battle.actionUiMessage = "";
  }
  const handRules = getDuelHandRules();
  const handChoiceCount = handRules.hand?.maxHandSize || handRules.hand?.defaultChoiceCount || getDuelActionRules().choiceCount || 8;
  const domainHandCount = handRules.domainHand?.enabled === false ? 0 : Number(handRules.domainHand?.maxHandSize || 3);
  if (isMahoragaProxyActive(battle, actorSide)) {
    lockMahoragaHandForTurn(battle, actorSide);
    battle.actionChoices = [];
    battle.handCandidates = [];
    battle.domainHandCandidates = [];
    battle.actionRound = battle.round + 1;
    battle.pendingAction = null;
    battle.actionUiMessage = "魔虚罗代打中";
    return battle.actionChoices;
  }
  battle.actionChoices = pickDuelHandCandidates(actor, opponent, battle, handChoiceCount);
  battle.handCandidates = battle.actionChoices;
  battle.domainHandCandidates = domainHandCount > 0 ? pickDuelDomainHandCandidates(actor, opponent, battle, domainHandCount) : [];
  const authoritativePrivateHand = Boolean(
    battle?.mode === "online" &&
    battle?.onlineAuthoritativePrivateHand === true &&
    battle?.onlineAuthoritativePrivateHandSide === actorSide &&
    !battle?.dounaGauntlet?.online
  );
  if (actorSide === "left" && !authoritativePrivateHand) {
    globalThis.JJKShibuyaIncident?.prepareTowerBossInteractionTurn?.(battle);
    syncTowerTacticCardsIntoVisibleHand(battle, actorSide);
    globalThis.JJKShibuyaIncident?.prepareDagonBossInteractionTurn?.(battle);
    syncDagonTacticCardsIntoVisibleHand(battle, actorSide);
    globalThis.JJKShibuyaIncident?.prepareChosoBossInteractionTurn?.(battle);
    syncChosoTacticCardsIntoVisibleHand(battle, actorSide);
    globalThis.JJKShibuyaIncident?.prepareMegumiTojiBossInteractionTurn?.(battle);
    syncMegumiTojiTacticCardsIntoVisibleHand(battle, actorSide);
    globalThis.JJKShibuyaIncident?.prepareSukunaJogoBossInteractionTurn?.(battle);
    globalThis.JJKShibuyaIncident?.prepareSukunaMahoragaBossInteractionTurn?.(battle);
    globalThis.JJKShibuyaIncident?.prepareMahitoBossInteractionTurn?.(battle);
    syncMahitoSceneTacticCardsIntoVisibleHand(battle, actorSide);
    globalThis.JJKShibuyaIncident?.prepareHarutaBossInteractionTurn?.(battle);
    syncHarutaTacticCardsIntoVisibleHand(battle, actorSide);
  }
  if (actorSide === "left" && isDounaSecondLifeBattle(battle)) {
    prepareDounaSecondLifeTelegraphForPlayerTurn(battle);
  }
  battle.actionRound = battle.round + 1;
  const selected = getDuelSelectedHandActions(battle, actorSide);
  battle.pendingAction = selected[0]?.action || null;
  const visibleChoices = [...(battle.actionChoices || []), ...(battle.domainHandCandidates || [])];
  if (battle.pendingAction && !visibleChoices.some((action) => action.id === battle.pendingAction.id || action.actionId === battle.pendingAction.id)) {
    battle.pendingAction = null;
  }
  if (battle.mode === "online" && battle.onlineRoomSnapshot?.syncProtocolVersion === "reveal-ack-input-only-v3" &&
      !state.duelModeState.localLocked && !battle.resolved && !battle.onlineLocalTurnPassRequestId &&
      typeof globalThis.JJKOnlineLocalTurnTimer?.startLocalTurnTimer === "function") {
    battle.onlineLocalTurnTimer = globalThis.JJKOnlineLocalTurnTimer.startLocalTurnTimer({
      roomId: battle.onlineRoomId || battle.onlineRoomSnapshot.roomId,
      turnId: battle.onlineRoomSnapshot.turnState?.turnId || `turn_${battle.round}`,
      side: actorSide,
      now: Date.now(),
      durationMs: LOCAL_ONLINE_TURN_DURATION_MS,
      previous: battle.onlineLocalTurnTimer
    });
    syncOnlineTurnDeadlineRenderTimer();
  }
  return battle.actionChoices;
}

function selectDuelAction(actionId, cardInstanceId = "") {
  blurDuelActionFocus();
  const battle = state.duelBattle;
  if (!battle || battle.autoRunning || battle.resolved) return;
  if (isOnlineDuelModeActive() && state.duelModeState.localLocked) {
    battle.actionUiMessage = "联机行动已锁定；如尚未结算，请先取消锁定。";
    requestDuelInteractionRender();
    return;
  }
  if (!battle.actionChoices?.length || battle.actionRound !== battle.round + 1) updateDuelActionAvailability(battle);
  const action = [...(battle.actionChoices || []), ...(battle.domainHandCandidates || [])].find((item) =>
    (item.id === actionId || item.actionId === actionId) &&
    (!cardInstanceId || String(item.cardInstanceId || item.action?.cardInstanceId || "") === String(cardInstanceId))
  );
  if (!action) return;
  const { actorSide, actor, opponent } = getDuelSideResources(battle);
  if (isMaximumUzumakiDuelAction(action) && getMaximumUzumakiSelectableUnits(battle, actorSide).length) {
    startMaximumUzumakiClickSelection(action, battle, actorSide);
    updateDuelResourceReplayKey(battle);
    requestDuelInteractionRender();
    return;
  }
  battle.maximumUzumakiSelection = null;
  let preparedAction = prepareMaximumUzumakiSelection(action, battle, actorSide);
  const harutaTargetPicker = Array.from(els.duelBattle?.querySelectorAll?.("[data-duel-haruta-target]") || [])
    .find((element) => element.dataset.duelHarutaTarget === actionId);
  if (harutaTargetPicker) {
    const targetChoice = getHarutaTargetChoiceById(battle, harutaTargetPicker.value);
    if (targetChoice) {
      preparedAction = applyHarutaExplicitTargetChoice(preparedAction, targetChoice);
    }
  }
  if (isReverseCursedTechniqueOutputDuelAction(preparedAction)) {
    const picker = Array.from(els.duelBattle?.querySelectorAll?.("[data-duel-rct-target]") || [])
      .find((element) => element.dataset.duelRctTarget === actionId);
    const targetId = String(picker?.value || "");
    if (targetId === "__self__") {
      preparedAction = {
        ...preparedAction,
        targetPlan: { ...(preparedAction.targetPlan || {}), target: "self", targetSide: actorSide, primaryTargetId: "", selectionMode: "rct_output_explicit_self" }
      };
    } else if (targetId) {
      preparedAction = {
        ...preparedAction,
        targetPlan: { ...(preparedAction.targetPlan || {}), target: "ally", targetSide: actorSide, primaryTargetId: targetId, selectionMode: "rct_output_explicit_ally" }
      };
    }
  }
  const towerTacticGate = getTowerTacticSelectionGate(battle, preparedAction);
  if (!towerTacticGate.ok) {
    battle.actionUiMessage = towerTacticGate.reason || "该活动战术当前不可执行";
    updateDuelResourceReplayKey(battle);
    requestDuelInteractionRender();
    return;
  }
  const selection = selectDuelHandCandidate(preparedAction, actor, opponent, battle, { side: actorSide });
  if (!selection.selected) {
    battle.actionUiMessage = selection.reason || "不可执行";
    updateDuelResourceReplayKey(battle);
    requestDuelInteractionRender();
    return;
  }
  const selected = getDuelSelectedHandActions(battle, actorSide);
  battle.pendingAction = selected[0]?.action || null;
  battle.actionUiMessage = "";
  updateDuelResourceReplayKey(battle);
  requestDuelInteractionRender();
}

function isMaximumUzumakiDuelAction(action = {}) {
  if (action.maximumUzumakiSpec || action.effects?.maximumUzumakiConsumeCurseSpirits) return true;
  const text = [
    action.id,
    action.actionId,
    action.cardId,
    action.name,
    action.label,
    action.effectSummary,
    ...(Array.isArray(action.tags) ? action.tags : [])
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes("maximum_uzumaki") || (text.includes("极之番") && text.includes("涡"));
}

function isMaximumUzumakiSelectableCurseUnit(unit = {}, side = "") {
  if (!unit || unit.active === false || getDuelUnitHpValue(unit) <= 0) return false;
  if ((unit.controllerSide || unit.ownerSide || unit.side || "") !== side) return false;
  if (unit.side === "neutral" || unit.control === "neutral_uncontrolled" || unit.control === "neutral_berserk") return false;
  const text = [
    unit.id,
    unit.cardId,
    unit.name,
    unit.label,
    unit.summonLane,
    unit.zoneLabel,
    ...(Array.isArray(unit.tags) ? unit.tags : [])
  ].filter(Boolean).join(" ").toLowerCase();
  if (/mahoraga|魔虚罗|魔虛羅|garuda|凰轮/.test(text)) return false;
  return /curse_spirit_manipulation|curse_spirit|cursed_spirit|咒灵操术|咒灵|咒靈|低级咒灵|特级咒灵/.test(text);
}

function getMaximumUzumakiSelectableUnits(battle = state.duelBattle, side = "") {
  return (Array.isArray(battle?.battlefieldUnits) ? battle.battlefieldUnits : [])
    .filter((unit) => isMaximumUzumakiSelectableCurseUnit(unit, side))
    .sort((left, right) => getDuelUnitHpValue(right) - getDuelUnitHpValue(left));
}

function getMaximumUzumakiUnitSelectionId(unit = {}) {
  return String(unit.id || unit.cardId || unit.name || "").trim();
}

function startMaximumUzumakiClickSelection(action, battle, side) {
  if (!battle || !action || !side) return;
  const units = getMaximumUzumakiSelectableUnits(battle, side);
  const unitIds = units.map(getMaximumUzumakiUnitSelectionId).filter(Boolean);
  battle.maximumUzumakiSelection = {
    actionId: getDuelActionEntryId(action),
    side,
    selectedUnitIds: unitIds,
    openedAtRound: Number(battle.round || 0) + 1
  };
  battle.actionUiMessage = "选择“极之番-涡”的融合对象：点击咒灵切换投入，确认后会作为一发 AOE 结算。";
}

function resolveMaximumUzumakiSelectionAction(battle = state.duelBattle) {
  const selection = battle?.maximumUzumakiSelection;
  if (!selection?.actionId) return null;
  return [...(battle.actionChoices || []), ...(battle.domainHandCandidates || [])]
    .find((item) => getDuelActionEntryId(item) === selection.actionId || item.id === selection.actionId || item.actionId === selection.actionId) || null;
}

function toggleMaximumUzumakiUnitSelection(unitId, battle = state.duelBattle) {
  const selection = battle?.maximumUzumakiSelection;
  if (!selection || !unitId) return;
  const selected = new Set((selection.selectedUnitIds || []).map(String));
  if (selected.has(unitId)) selected.delete(unitId);
  else selected.add(unitId);
  selection.selectedUnitIds = Array.from(selected);
  battle.actionUiMessage = selection.selectedUnitIds.length
    ? `已选择 ${formatNumber(selection.selectedUnitIds.length)} 个咒灵投入“涡”。`
    : "至少选择 1 个咒灵，或点击“投入全部”。";
}

function selectAllMaximumUzumakiUnits(battle = state.duelBattle) {
  const selection = battle?.maximumUzumakiSelection;
  if (!selection) return;
  selection.selectedUnitIds = getMaximumUzumakiSelectableUnits(battle, selection.side)
    .map(getMaximumUzumakiUnitSelectionId)
    .filter(Boolean);
  battle.actionUiMessage = `已选择全部 ${formatNumber(selection.selectedUnitIds.length)} 个可投入咒灵。`;
}

function cancelMaximumUzumakiSelection(battle = state.duelBattle) {
  if (!battle) return;
  battle.maximumUzumakiSelection = null;
  battle.actionUiMessage = "已取消极之番-涡的咒灵选择。";
}

function confirmMaximumUzumakiSelection(battle = state.duelBattle) {
  if (!battle || !battle.maximumUzumakiSelection) return;
  const { actorSide, actor, opponent } = getDuelSideResources(battle);
  const selectionState = battle.maximumUzumakiSelection;
  const action = resolveMaximumUzumakiSelectionAction(battle);
  const selectedSet = new Set((selectionState.selectedUnitIds || []).map(String).filter(Boolean));
  const units = getMaximumUzumakiSelectableUnits(battle, actorSide)
    .filter((unit) => selectedSet.has(getMaximumUzumakiUnitSelectionId(unit)));
  if (!action) {
    battle.actionUiMessage = "极之番-涡手札已刷新，请重新选择。";
    battle.maximumUzumakiSelection = null;
    updateDuelResourceReplayKey(battle);
    requestDuelInteractionRender();
    return;
  }
  if (!units.length) {
    battle.actionUiMessage = "至少选择 1 个咒灵，或点击“投入全部”。";
    updateDuelResourceReplayKey(battle);
    requestDuelInteractionRender();
    return;
  }
  const preparedAction = prepareMaximumUzumakiSelection(action, battle, actorSide, units.map(getMaximumUzumakiUnitSelectionId));
  const result = selectDuelHandCandidate(preparedAction, actor, opponent, battle, { side: actorSide });
  if (!result.selected) {
    battle.actionUiMessage = result.reason || "极之番-涡选择失败。";
    updateDuelResourceReplayKey(battle);
    requestDuelInteractionRender();
    return;
  }
  const selected = getDuelSelectedHandActions(battle, actorSide);
  battle.pendingAction = selected[0]?.action || null;
  battle.maximumUzumakiSelection = null;
  battle.actionUiMessage = `已确认投入 ${formatNumber(units.length)} 个咒灵发动“极之番-涡”。`;
  updateDuelResourceReplayKey(battle);
  requestDuelInteractionRender();
}

function prepareMaximumUzumakiSelection(action, battle, side, selectedIds = null) {
  if (!isMaximumUzumakiDuelAction(action)) return action;
  const units = getMaximumUzumakiSelectableUnits(battle, side);
  if (!units.length) return action;
  const requestedSet = selectedIds && selectedIds.length ? new Set(selectedIds.map(String)) : null;
  const selectedUnits = requestedSet
    ? units.filter((unit) => requestedSet.has(getMaximumUzumakiUnitSelectionId(unit)))
    : units;
  if (!selectedUnits.length) return action;
  const selectedUnitIds = selectedUnits.map((unit) => unit.id || unit.cardId).filter(Boolean);
  const selectedHp = selectedUnits.reduce((total, unit) => total + getDuelUnitHpValue(unit), 0);
  return {
    ...action,
    selectedUnitIds,
    maximumUzumakiSpec: {
      ...(action.maximumUzumakiSpec || {}),
      selection: "manual",
      unitIds: selectedUnitIds,
      selectedUnitSummary: selectedUnits.map((unit) => ({
        id: unit.id || "",
        name: unit.name || unit.label || unit.cardId || "咒灵",
        hp: Number(getDuelUnitHpValue(unit).toFixed(1))
      })),
      selectedHp: Number(selectedHp.toFixed(1))
    }
  };
}

function getDuelActionContext(battle, side) {
  const helper = globalThis.JJKDuelResource?.getDuelActionContext || globalThis.JJKDuelActions?.getDuelActionContext;
  if (typeof helper === "function") return helper(battle, side);
  return { outgoingScale: 1, incomingHpScale: 1, incomingCeScale: 1, sureHitScale: 1, domainPressureScale: 1, manualAttackScale: 1, domainLoadScale: 1, weightDeltas: {}, actionLabels: [] };
}

function applyDuelActionEffect(action, actor, opponent, duelState) {
  return callDuelActionsImplementation("applyDuelActionEffect", [action, actor, opponent, duelState], globalThis.JJKDuelActions?.applyDuelActionEffect);
}

function appendDuelActionLog(action, actor, opponent, result, battle = state.duelBattle) {
  if (!battle) return;
  const sideLabel = getDuelResourceSideLabel(actor.side);
  const actionType = getDuelDomainResponseActionIds().has(action.id)
    ? "response"
    : ((action.effects?.activateDomain || action.effects?.releaseDomain || action.id?.startsWith("domain_")) ? "domain" : (action.domainSpecific ? "subphase" : "action"));
  const costText = result.costCe ? `咒力 ${formatSignedDuelDelta(-result.costCe)}` : "无额外咒力消耗";
  const parts = [
    action.logTemplate || `${sideLabel}${actor.name} 选择${action.label}。`,
    costText
  ];
  if (result.actorStability) parts.push(`稳定 ${formatSignedDuelDelta(result.actorStability * 100)}%`);
  if (result.actorHp && (!result.actorHealing || Math.abs(Number(result.actorHp) - Number(result.actorHealing)) > 0.1)) parts.push(`${actor.name} 体势 ${formatSignedDuelDelta(result.actorHp)}`);
  if (result.actorHealing) parts.push(`实际治疗 ${formatSignedDuelDelta(result.actorHealing)}`);
  if (result.opponentHp) parts.push(`${opponent.name} 体势 ${formatSignedDuelDelta(result.opponentHp)}`);
  if (result.opponentStability) parts.push(`${opponent.name} 稳定 ${formatSignedDuelDelta(result.opponentStability * 100)}%`);
  if (result.actorDomainLoad) parts.push(`领域负荷 ${formatSignedDuelDelta(result.actorDomainLoad)}`);
  if (result.opponentDomainLoad) parts.push(`${opponent.name} 领域负荷 ${formatSignedDuelDelta(result.opponentDomainLoad)}`);
  if (Number(result.damageMitigation?.totalPrevented || 0) > 0 && !result.evasion?.canonicalNoHit) {
    const mitigation = result.damageMitigation;
    const breakdown = [];
    if (Number(mitigation.panelDefensePrevented || 0) > 0) breakdown.push(`面板抗性 ${formatNumber(mitigation.panelDefensePrevented)}`);
    if (Number(mitigation.scalePrevented || 0) > 0) breakdown.push(`减伤 ${formatNumber(mitigation.scalePrevented)}`);
    if (Number(mitigation.blocked || 0) > 0) breakdown.push(`格挡 ${formatNumber(mitigation.blocked)}`);
    if (Number(mitigation.reduced || 0) > 0) breakdown.push(`单位减伤 ${formatNumber(mitigation.reduced)}`);
    if (Number(mitigation.shieldAbsorbed || 0) > 0) breakdown.push(`护盾 ${formatNumber(mitigation.shieldAbsorbed)}`);
    parts.push(`${mitigation.targetName || opponent.name}防御抵消伤害 ${formatNumber(mitigation.totalPrevented)}${breakdown.length ? `（${breakdown.join("、")}）` : ""}`);
  }
  if (result.domainActivated) parts.push("领域进入维持状态");
  if (result.domainReleased) parts.push("主动解除领域，未触发领域崩解");
  if (result.evasion?.canonicalNoHit) {
    parts.push(`${opponent.name} 在真正接触前避开；本场不结算命中或体势伤害`);
  } else if (result.evasion?.evaded) {
    parts.push(`未命中！${opponent.name} 完成闪避（命中率 ${formatPercent(result.evasion.hitRate)}，判定 ${formatPercent(result.evasion.roll)}）`);
  }
  if (result.instantKillOnHit) {
    parts.push(action.effects?.dounaImmediateWorldSlash || action.type === "douna_world_slash"
      ? "世界斩抹杀"
      : "处刑人之剑命中，死刑判决兑现为一击必杀");
  }
  if (result.blackFlashTriggered) {
    parts.push(result.blackFlashLabel === "极限打击窗口"
      ? "【极限打击窗口】触发！对手体势剧烈崩坏。"
      : "【黑闪】触发！打击与冲击在临界点重合，对手体势剧烈崩坏。");
  }
  (result.mechanicsApplied || []).forEach((mechanic) => {
    const text = mechanic?.logTemplate || mechanic?.label || mechanic?.id || "";
    if (text) parts.push(text);
  });
  if (action.id === "residue_reading") parts.push("下一回合咒力回流提高15%");
  recordDuelResourceChange(battle, {
    side: actor.side,
    title: `${sideLabel}手法：${action.label}`,
    detail: `${sideLabel}${actor.name}：${parts.join("；")}。`,
    type: actionType,
    delta: { actionId: action.id, ...result }
  });
}

function getDuelHandLogSideLabel(side) {
  return side === "right" ? "对手" : "你";
}

function normalizeDuelHandLogEntries(entries = []) {
  return entries
    .map((entry) => {
      const action = entry?.action || entry;
      return {
        id: entry?.actionId || entry?.id || action?.id || "",
        label: entry?.label || action?.label || entry?.actionId || entry?.id || "未命名手札",
        apCost: Number(entry?.apCost ?? action?.apCost ?? 0),
        ceCost: Number(entry?.ceCost ?? entry?.costCe ?? action?.costCe ?? 0)
      };
    })
    .filter((entry) => entry.id || entry.label);
}

function formatDuelHandLogOrder(entries = []) {
  const normalized = normalizeDuelHandLogEntries(entries);
  if (!normalized.length) return "无可执行手札";
  return normalized.map((entry, index) => `${index + 1}. ${entry.label}`).join("；");
}

function appendDuelHandBatchLog(battle, side, entries = [], options = {}) {
  if (!battle) return;
  const normalized = normalizeDuelHandLogEntries(entries);
  const sideLabel = getDuelHandLogSideLabel(side);
  const phase = options.phase || "selected";
  const result = options.result || null;
  const totalAp = normalized.reduce((total, entry) => total + Number(entry.apCost || 0), 0);
  const totalCe = normalized.reduce((total, entry) => total + Number(entry.ceCost || 0), 0);
  const title = phase === "executed"
    ? `${sideLabel}执行术式手札`
    : `${sideLabel}本回合已选择手札`;
  const resultParts = Array.isArray(result?.results)
    ? result.results.map((item, index) => `${index + 1}. ${(item.action?.label || item.action?.id || "未知手札")}${item.applied ? "成功" : `失败：${item.reason || "未结算"}`}`)
    : [];
  const detailParts = [
    normalized.length
      ? `${sideLabel}本回合${phase === "executed" ? "执行" : "选择"} ${normalized.length} 张手札：${formatDuelHandLogOrder(normalized)}。`
      : `${sideLabel}本回合未选择可执行手札。`,
    normalized.length ? `预留 CE ${formatNumber(totalCe)}。` : "",
    result?.reason ? `结果：${result.reason}。` : "",
    resultParts.length ? `执行顺序：${resultParts.join("；")}。` : ""
  ].filter(Boolean);
  recordDuelResourceChange(battle, {
    side: side || "neutral",
    title,
    detail: detailParts.join(" "),
    type: "hand",
    delta: {
      handSelection: true,
      phase,
      actionIds: normalized.map((entry) => entry.id),
      totalAp,
      totalCe,
      status: "CANDIDATE"
    }
  });
}

function getDuelCpuAction(actor, opponent, duelState) {
  return callDuelActionsImplementation("getDuelCpuAction", [actor, opponent, duelState], globalThis.JJKDuelActions?.getDuelCpuAction);
}

function createDuelBattleSeed(left, right) {
  const source = [
    DUEL_SYSTEM_VERSION,
    left?.id || left?.name || "",
    right?.id || right?.name || "",
    Date.now(),
    state.duelSpinToken
  ].join("|");
  return hashDuelSeed(source).toString(36);
}

function createDuelBattleId(left, right, seed) {
  const source = [DUEL_SYSTEM_VERSION, left?.id || left?.name || "", right?.id || right?.name || "", seed].join("|");
  return `duel_${Date.now().toString(36)}_${hashDuelSeed(source).toString(36)}`;
}

function hashDuelSeed(value) {
  let hash = 2166136261;
  const text = String(value || "duel-seed");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDuelSeededRng(seed) {
  let cursor = hashDuelSeed(seed) || 1;
  return () => {
    cursor += 0x6D2B79F5;
    let value = cursor;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function duelRandom(battle, label = "duel") {
  let value;
  if (battle && (battle.mode === "online" || battle.onlineRoomId || battle.onlineBattleSeed)) {
    battle.onlineRandomCounters ||= {};
    const round = Number(battle.round || 0) + 1;
    const key = [battle.onlineRoomId || "room", round, String(label || "duel")].join(":");
    const count = Number(battle.onlineRandomCounters[key] || 0) + 1;
    battle.onlineRandomCounters[key] = count;
    const seed = [
      "online-deterministic-rng-v2",
      battle.onlineBattleSeed || battle.battleSeed || battle.seed || "",
      battle.onlineRoomId || "",
      round,
      label || "duel",
      count
    ].join("|");
    value = (hashDuelSeed(seed) >>> 0) / 4294967296;
  } else {
    value = typeof battle?.rng === "function" ? battle.rng() : Math.random();
  }
  if (battle) {
    battle.randomLog = battle.randomLog || [];
    battle.randomLog.push({
      round: battle.round + 1,
      label,
      value: Number(value.toFixed(8))
    });
  }
  return value;
}

function getDuelMartialScoreForEvasion(resource) {
  const profile = resource?.characterCardProfile || {};
  const raw = resource?.raw || profile.raw || resource?.profile?.raw || {};
  const axes = resource?.axes || profile.axes || resource?.profile?.axes || {};
  return Math.max(0, Number(raw.martialScore ?? raw.bodyScore ?? axes.body ?? 0) || 0);
}

function getDuelHitRateFromMartialDiff(diff) {
  const rounded = Math.round(Number(diff || 0));
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

function normalizeDuelRate(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.abs(number) > 1 ? number / 100 : number;
}

function getDuelEvasionProfileConfig(profile) {
  const configs = {
    melee: { hitBonus: 0, min: 0.25, max: 0.9, damageScaleOnMiss: 0, ceScaleOnMiss: 0 },
    weapon: { hitBonus: 0.02, min: 0.25, max: 0.92, damageScaleOnMiss: 0, ceScaleOnMiss: 0 },
    execution_sword: { hitBonus: -0.04, min: 0.08, max: 0.86, damageScaleOnMiss: 0, ceScaleOnMiss: 0 },
    world_slash: { hitBonus: 0.04, min: 0.08, max: 0.92, damageScaleOnMiss: 0, ceScaleOnMiss: 0 },
    technique_projectile: { hitBonus: 0.08, min: 0.3, max: 0.94, damageScaleOnMiss: 0.18, ceScaleOnMiss: 0.25 },
    technique_area: { hitBonus: 0.23, min: 0.42, max: 0.95, damageScaleOnMiss: 0.45, ceScaleOnMiss: 0.5 }
  };
  return configs[profile] || null;
}

function isRuntimeDuelStatusEffectActive(effect, battle) {
  const triggerRound = Number(effect?.triggerRound || 0);
  return !triggerRound || triggerRound <= Number(battle?.round || 0);
}

function getActiveRuntimeDuelEvasionStatusBonus(resource, battle) {
  return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).reduce((total, effect) => {
    if (!isRuntimeDuelStatusEffectActive(effect, battle)) return total;
    const bonus = Number(effect?.evasionBonus || 0);
    return Number.isFinite(bonus) && bonus > 0 ? total + bonus : total;
  }, 0);
}

function hasRuntimeMythicalBeastAmberAoeFullDodge(resource, battle) {
  return (Array.isArray(resource?.statusEffects) ? resource.statusEffects : []).some((effect) => {
    if (!isRuntimeDuelStatusEffectActive(effect, battle)) return false;
    return effect?.id === "mythicalBeastAmber" && (effect.mythicalBeastAmberAoeFullDodge === true || Number(effect.evasionBonus || 0) > 0);
  });
}

function shouldRuntimeMythicalBeastAmberFullyDodgeAoe({ profile, label, defender, battle }) {
  const text = String(label || "");
  if (String(profile || "") !== "technique_area") return false;
  if (!hasRuntimeMythicalBeastAmberAoeFullDodge(defender, battle)) return false;
  if (/领域|必中|sure[_\s-]?hit|unavoidable|不可闪避|无法闪避|世界斩|world[_\s-]?slash|处刑人之剑|execution/i.test(text)) return false;
  return true;
}

function getDuelEventAccuracyProfile(kind) {
  if (kind === "initiative" || kind === "melee" || kind === "finisher") return "melee";
  if (kind === "technique" || kind === "backfire") return "technique_projectile";
  return "none";
}

function getDuelRoundEventOutputScale(actionContext = {}) {
  const raw = Number(actionContext.outgoingScale || 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  if (Math.abs(raw - 1) < 0.001) return 1;
  const actionCount = Math.max(1, Array.isArray(actionContext.actionLabels) ? actionContext.actionLabels.length : 1);
  if (raw > 1) {
    const singleCardBonus = Math.pow(raw, 1 / actionCount) - 1;
    return Number(clamp(1 + Math.min(singleCardBonus, 0.18), 1, 1.18).toFixed(4));
  }
  return Number(clamp(Math.pow(raw, 1 / actionCount), 0.72, 1).toFixed(4));
}

function resolveDuelEvasionCheck({ battle, actor, opponent, profile, label = "evasion", hitRateModifier = 0, damage = 0 }) {
  const canonNoHit = globalThis.JJKShibuyaIncident?.getSukunaJogoCanonEvasionOverride?.(
    battle,
    actor,
    opponent,
    { profile, label, damage }
  );
  if (canonNoHit?.applied) return canonNoHit;
  const config = getDuelEvasionProfileConfig(profile);
  if (!battle || !actor || !opponent || !config || Number(damage || 0) <= 0) {
    return { checked: false, evaded: false, profile: profile || "none", hitRate: 1, roll: 0 };
  }
  const attackerMartial = getDuelMartialScoreForEvasion(actor);
  const defenderMartial = getDuelMartialScoreForEvasion(opponent);
  const defenderContext = opponent?.side ? getDuelActionContext(battle, opponent.side) : null;
  const defenderEvasionBonus = Math.max(0, normalizeDuelRate(defenderContext?.evasionBonus || 0, 0) + getActiveRuntimeDuelEvasionStatusBonus(opponent, battle));
  const martialDiff = attackerMartial - defenderMartial;
  const hitRate = clamp(
    getDuelHitRateFromMartialDiff(martialDiff) + Number(config.hitBonus || 0) + normalizeDuelRate(hitRateModifier, 0) - defenderEvasionBonus,
    Number(config.min || 0.05),
    Number(config.max || 0.96)
  );
  const roll = duelRandom(battle, `evasion:${label}`);
  const amberAoeFullDodge = shouldRuntimeMythicalBeastAmberFullyDodgeAoe({ profile, label, defender: opponent, battle });
  return {
    checked: true,
    evaded: roll > hitRate,
    profile,
    hitRate: Number(hitRate.toFixed(4)),
    roll: Number(roll.toFixed(4)),
    attackerMartial: Number(attackerMartial.toFixed(2)),
    defenderMartial: Number(defenderMartial.toFixed(2)),
    martialDiff: Number(martialDiff.toFixed(2)),
    defenderEvasionBonus: Number(defenderEvasionBonus.toFixed(4)),
    damageScaleOnMiss: amberAoeFullDodge ? 0 : Number(config.damageScaleOnMiss || 0),
    ceScaleOnMiss: amberAoeFullDodge ? 0 : Number(config.ceScaleOnMiss || 0),
    mythicalBeastAmberAoeFullDodge: amberAoeFullDodge
  };
}

function showDuelFloatingCombatText(battle, text, type = "miss", side = "") {
  const now = Date.now();
  if (!battle) return;
  if (state.duelVisualSettings?.liteMode) return;
  battle.floatingCombatText = {
    text: text || "未命中！",
    type,
    side,
    createdAt: now,
    expiresAt: now + (type === "swap" ? 2400 : 1000)
  };
}

function buildDuelReplayKey(battle) {
  const operations = (battle?.operations || []).join(",");
  return `${DUEL_SYSTEM_VERSION}:${battle?.battleId || "duel"}:${battle?.seed || "seed"}:${battle?.left?.id || "left"}>${battle?.right?.id || "right"}:${operations}`;
}

function initializeDuelResourceState(duelState) {
  return callDuelResourceImplementation("initializeDuelResourceState", [duelState], globalThis.JJKDuelResource?.initializeDuelResourceState);
}

function deriveDuelResourcesFromProfile(profile, card = null, side = "") {
  return callDuelResourceImplementation("deriveDuelResourcesFromProfile", [profile, card, side], globalThis.JJKDuelResource?.deriveDuelResourcesFromProfile);
}

function getDuelResourcePair(battle, side) {
  return callDuelResourceImplementation("getDuelResourcePair", [battle, side], globalThis.JJKDuelResource?.getDuelResourcePair);
}

function getDuelOpponentSide(side) {
  return side === "left" ? "right" : "left";
}

function getDuelResourceSideLabel(side) {
  return getDuelPerspectiveSideLabel(side, state.duelBattle);
}

function recordDuelResourceChange(battle, entry) {
  const helper = globalThis.JJKDuelResource?.recordDuelResourceChange;
  if (typeof helper !== "function") throw new Error("JJKDuelResource.recordDuelResourceChange helper is not available.");
  return helper(battle, entry);
}

function clampDuelResource(resource) {
  return callDuelResourceImplementation("clampDuelResource", [resource], globalThis.JJKDuelResource?.clampDuelResource);
}

function applyDuelStandardDamageToTarget(target, amount, battle, options = {}) {
  const helper = globalThis.JJKDuelActions?.applyDuelStandardDamageToTarget;
  if (typeof helper !== "function") throw new Error("JJKDuelActions.applyDuelStandardDamageToTarget helper is not available.");
  return helper(target, amount, battle, options);
}

function getDuelStatusEffectValue(resource, id) {
  const helper = globalThis.JJKDuelResource?.getDuelStatusEffectValue;
  if (typeof helper === "function") return helper(resource, id);
  if (!resource?.statusEffects?.length) return 0;
  return Math.max(0, ...resource.statusEffects.filter((effect) => effect.id === id).map((effect) => Number(effect.value || 1)));
}

function applyDuelRoundResourceRegen(actor, battle = state.duelBattle, side = actor?.side) {
  return callDuelResourceImplementation("applyDuelRoundResourceRegen", [actor, battle, side], globalThis.JJKDuelResource?.applyDuelRoundResourceRegen);
}

function applyDuelEventResourceDelta(event, actor, opponent, battle = state.duelBattle) {
  if (!event || !actor || !opponent || !battle) return null;
  const rules = getDuelResourceRules();
  const kind = event.kind || "neutral";
  const config = rules.events?.[kind] || rules.events?.neutral || {};
  const actorSide = actor.side;
  const opponentSide = opponent.side;
  const before = {
    actorHp: actor.hp,
    actorCe: actor.ce,
    opponentHp: opponent.hp,
    opponentCe: opponent.ce
  };
  const scorePressure = Math.max(0, Number(event.score || 0) - 1) * 1.8;
  const ceCost = Number(config.actorCeCost || 0);
  const actualCeCost = Math.min(actor.ce, ceCost);
  actor.ce -= actualCeCost;
  const actorActionContext = getDuelActionContext(battle, actorSide);
  const opponentActionContext = getDuelActionContext(battle, opponentSide);
  const eventOutputScale = getDuelRoundEventOutputScale(actorActionContext);
  let outputScale = (ceCost > 0 ? clamp(actualCeCost / ceCost, 0.58, 1) : 1) * eventOutputScale;
  const executionStateCandidate = getDuelStatusEffectValue(actor, "executionStateCandidate");
  if (executionStateCandidate > 0) outputScale *= 1 + executionStateCandidate * 0.22;
  const techniqueImbalance = getDuelStatusEffectValue(actor, "techniqueImbalance");
  const imbalanceConfig = rules.statusEffects?.techniqueImbalance || {};
  const imbalanceAffectedEvents = imbalanceConfig.affectedEvents || ["technique", "domain", "finisher"];
  if (techniqueImbalance > 0 && imbalanceAffectedEvents.includes(kind)) {
    outputScale *= Number(imbalanceConfig.outputScale || 0.72);
  }
  if (actualCeCost < ceCost) {
    actor.stability = Number(clamp(actor.stability - 0.035, 0, 1).toFixed(4));
    actor.statusEffects.push({ id: "ceStrain", label: "咒力见底", rounds: 1, value: ceCost - actualCeCost });
  }
  const trialViolenceScale = getDuelTrialViolenceScale(battle, kind, actorSide);
  if (trialViolenceScale < 1) outputScale *= trialViolenceScale;

  const baseTargetHpDamage = Number(config.targetHpDamage || 0) + scorePressure;
  let targetHpDamage = baseTargetHpDamage * outputScale;
  let domainComponentDefenseScale = 1;
  let domainDamageText = "";
  if (kind === "domain") {
    const barrierModifiers = applyDuelDomainBarrierModifiers(actor, opponent, event, { battle });
    const sureHitDamage = baseTargetHpDamage * 0.52 * Number(barrierModifiers.sureHitScale || 1);
    const domainPressureDamage = baseTargetHpDamage * 0.3 * Number(barrierModifiers.pressureScale || 1);
    const manualAttackDamage = baseTargetHpDamage * 0.18 * Number(barrierModifiers.manualAttackScale || 1);
    const domainComponentDamage = sureHitDamage + domainPressureDamage + manualAttackDamage;
    const defendedDomainComponentDamage =
      sureHitDamage * Number(opponentActionContext.sureHitScale || 1) +
      domainPressureDamage * Number(opponentActionContext.domainPressureScale || 1) +
      manualAttackDamage * Number(opponentActionContext.manualAttackScale || 1);
    domainComponentDefenseScale = domainComponentDamage > 0
      ? Math.max(0, defendedDomainComponentDamage / domainComponentDamage)
      : 1;
    targetHpDamage = domainComponentDamage * outputScale;
    const shape = DUEL_DOMAIN_BARRIER_LABELS[barrierModifiers.barrierType] || "未知形态";
    const completion = DUEL_DOMAIN_COMPLETION_LABELS[barrierModifiers.domainCompletion] || "未知";
    domainDamageText = `领域形态：${shape}，完成度：${completion}。领域伤害拆分：必中 ${formatNumber(sureHitDamage)}、领域压制 ${formatNumber(domainPressureDamage)}、手动攻击/环境 ${formatNumber(manualAttackDamage)}；反领域组件倍率 ${formatNumber(domainComponentDefenseScale)}。`;
  }
  let targetCeDamage = Number(config.targetCeDamage || 0) * outputScale * Number(opponentActionContext.incomingCeScale || 1);
  const actorHpRecoil = Number(config.actorHpRecoil || 0) * (kind === "finisher" ? clamp(1.15 - actor.stability, 0.25, 0.9) : 1);
  const jackpotDefense = getDuelStatusEffectValue(opponent, "jackpotStateCandidate");
  if (jackpotDefense > 0 && targetHpDamage > 0) {
    targetHpDamage *= clamp(1 - jackpotDefense * 0.32, 0.45, 1);
  }
  const verdictDefenseShake = getDuelStatusEffectValue(opponent, "defenseShakenByVerdict");
  if (verdictDefenseShake > 0 && targetHpDamage > 0) {
    targetHpDamage *= 1 + verdictDefenseShake * 0.12;
  }
  const evasionResult = resolveDuelEvasionCheck({
    battle,
    actor,
    opponent,
    profile: getDuelEventAccuracyProfile(kind),
    label: event.label || kind,
    damage: targetHpDamage
  });
  if (evasionResult.evaded) {
    showDuelFloatingCombatText(battle, "未命中！", "miss", opponentSide);
    battle.evasionLog ||= [];
    battle.evasionLog.unshift({
      round: Number(battle.round || 0) + 1,
      eventKind: kind,
      eventLabel: event.label || kind,
      actorSide,
      opponentSide,
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
    targetHpDamage = Math.max(0, targetHpDamage * Number(evasionResult.damageScaleOnMiss || 0));
    targetCeDamage = Math.max(0, targetCeDamage * Number(evasionResult.ceScaleOnMiss || 0));
  }
  const damageApplication = targetHpDamage > 0
    ? applyDuelStandardDamageToTarget({
      type: "character",
      resource: opponent,
      id: opponent.id || opponentSide,
      name: opponent.name || opponentSide,
      side: opponentSide
    }, targetHpDamage, battle, {
      actor,
      opponent,
      action: { id: event.id || kind, label: event.label || kind, cardType: kind === "domain" ? "domain" : kind },
      sourceKind: kind === "domain" ? "domain" : "event",
      source: "duel-event",
      sourceLabel: event.label || kind,
      // getDuelRoundEventOutputScale already applies the turn context once;
      // active status, tactic, target defense and shields remain canonical.
      applyActorContextScale: false,
      applyDomainStateScale: kind !== "domain",
      applySureHitScale: kind !== "domain",
      additionalDefenderScale: kind === "domain" ? domainComponentDefenseScale : 1
    })
    : { applied: 0, damageMitigation: null };
  opponent.ce -= targetCeDamage;
  actor.hp -= actorHpRecoil;

  if (config.targetRegenInterference) {
    opponent.statusEffects.push({
      id: "ceRegenInterference",
      label: "咒力回流受扰",
      rounds: 1,
      value: Number(config.targetRegenInterference)
    });
  }

  if (kind === "domain") {
    updateDuelDomainLoad(actor, opponent, { battle, side: actorSide, event, domainEvent: true });
  }
  if (kind === "counter" && opponent.domain?.active) {
    opponent.domain.load += Number(config.domainLoadInterference || 0);
    recordDuelResourceChange(battle, {
      side: opponentSide,
      title: "领域受扰",
      detail: `${getDuelResourceSideLabel(opponentSide)}${opponent.name} 的领域受到干涉，负荷 +${formatNumber(config.domainLoadInterference || 0)}。`,
      type: "domain",
      delta: { domainLoad: Number(config.domainLoadInterference || 0) }
    });
  }

  clampDuelResource(actor);
  clampDuelResource(opponent);
  const delta = {
    actorHp: Number((actor.hp - before.actorHp).toFixed(1)),
    actorCe: Number((actor.ce - before.actorCe).toFixed(1)),
    opponentHp: Number((opponent.hp - before.opponentHp).toFixed(1)),
    opponentCe: Number((opponent.ce - before.opponentCe).toFixed(1))
  };
  const imbalanceText = techniqueImbalance > 0 && imbalanceAffectedEvents.includes(kind)
    ? "术式失衡压低了本次术式输出。"
    : "";
  const trialText = trialViolenceScale < 1 ? "审判规则限制了本次暴力输出。" : "";
  const jackpotText = jackpotDefense > 0 ? "中奖状态降低了承伤。" : "";
  const executionText = executionStateCandidate > 0 ? "处刑状态提高了本次收束压迫。" : "";
  const evasionText = evasionResult.canonicalNoHit
    ? `${opponent.name} 在真正接触前避开攻势；火势逼近，却没有真正触及对手。`
    : (evasionResult.evaded ? `未命中！${opponent.name} 完成闪避（命中率 ${formatPercent(evasionResult.hitRate)}，判定 ${formatPercent(evasionResult.roll)}）。` : "");
  const detail = `${getDuelResourceSideLabel(actorSide)}${actor.name} 咒力 ${formatSignedDuelDelta(delta.actorCe)}；${getDuelResourceSideLabel(opponentSide)}${opponent.name} 体势 ${formatSignedDuelDelta(delta.opponentHp)}、咒力 ${formatSignedDuelDelta(delta.opponentCe)}。${domainDamageText}${imbalanceText}${trialText}${jackpotText}${executionText}${evasionText}`;
  recordDuelResourceChange(battle, {
    side: actorSide,
    title: `${evasionResult.canonicalNoHit ? "火势逼近" : event.label}资源结算`,
    detail,
    type: kind === "domain" ? "domain" : "resource",
    delta: { ...delta, evasion: evasionResult.checked ? evasionResult : undefined, eventOutputScale, damageMitigation: damageApplication.damageMitigation || undefined }
  });
  return delta;
}

function getDuelTrialViolenceScale(battle, kind, actorSide) {
  return callDuelResourceImplementation("getDuelTrialViolenceScale", [battle, kind, actorSide], globalThis.JJKDuelResource?.getDuelTrialViolenceScale);
}

function updateDuelDomainLoad(actor, opponent, context = {}) {
  return callDuelResourceImplementation("updateDuelDomainLoad", [actor, opponent, context], globalThis.JJKDuelResource?.updateDuelDomainLoad);
}

function checkDuelDomainMeltdown(actor) {
  return Boolean(actor?.domain?.active && actor.domain.threshold > 0 && actor.domain.load >= actor.domain.threshold);
}

function triggerDuelDomainMeltdown(actor, battle = state.duelBattle, side = actor?.side) {
  return callDuelResourceImplementation("triggerDuelDomainMeltdown", [actor, battle, side], globalThis.JJKDuelResource?.triggerDuelDomainMeltdown);
}

function updateDuelResourceReplayKey(battle) {
  if (!battle) return;
  battle.replayKey = buildDuelReplayKey(battle);
  if (battle.resourceState) battle.resourceState.replayKey = battle.replayKey;
}

function snapshotDuelMemoResource(resource = {}) {
  return {
    hp: Number(resource.hp || 0),
    ce: Number(resource.ce || 0),
    stability: Number(resource.stability || 0),
    domainLoad: Number(resource.domain?.load || 0),
    statuses: (Array.isArray(resource.statusEffects) ? resource.statusEffects : []).map((effect) => ({
      id: String(effect?.id || effect?.label || ""),
      label: String(effect?.label || effect?.id || "异常状态"),
      rounds: Number(effect?.rounds || 0)
    })).filter((effect) => effect.id || effect.label)
  };
}

function snapshotDuelMemoState(battle) {
  return {
    left: snapshotDuelMemoResource(battle?.resourceState?.p1),
    right: snapshotDuelMemoResource(battle?.resourceState?.p2)
  };
}

function formatDuelMemoDelta(before = {}, after = {}) {
  const rows = [];
  const add = (label, key, suffix = "") => {
    const delta = Number(after[key] || 0) - Number(before[key] || 0);
    if (Math.abs(delta) < 0.005) return;
    rows.push(`${label}${formatSignedDuelDelta(key === "stability" ? delta * 100 : delta)}${suffix}`);
  };
  add("体势", "hp");
  add("咒力", "ce");
  add("稳定", "stability", "%");
  add("领域负荷", "domainLoad");
  return rows.length ? rows.join("，") : "无明显数值变化";
}

function getDuelNewStatuses(before = {}, after = {}) {
  const previous = new Set((before.statuses || []).map((effect) => effect.id || effect.label));
  return (after.statuses || []).filter((effect) => !previous.has(effect.id || effect.label));
}

function formatDuelStatusEffectLabel(effect = {}) {
  const label = effect.label || effect.name || "未命名状态";
  const rounds = Number(effect.rounds || 0);
  if (effect.id === "mahoragaSubstitute" || effect.id === "highCeSaturation") return label;
  return rounds > 0 && rounds < 900 ? `${label}（${formatNumber(rounds)}回合）` : label;
}

function getDuelActionMissText(actions = [], results = []) {
  const actionable = actions.filter((action) => action && action.type !== "pass" && action.id !== "duel_pass_turn" && Number(action.effect?.damage ?? action.damage ?? action.numericPreview?.finalDamage ?? 0) > 0);
  const evasionResults = results.map((entry) => entry?.result || entry).filter((result) => result?.evasion?.checked);
  if (!actionable.length && !evasionResults.length) return "未命中";
  if (evasionResults.some((result) => result.evasion?.evaded)) return "未命中";
  return "命中";
}

function summarizeDuelPreventedDamage(results = [], fallbackTargetSide = "") {
  const summary = { total: 0, panel: 0, scale: 0, inverse: 0, blocked: 0, reduced: 0, shield: 0 };
  results.forEach((entry) => {
    const result = entry?.result || entry;
    if (result?.evasion?.canonicalNoHit) return;
    const mitigation = result?.damageMitigation;
    if (!mitigation) return;
    if (fallbackTargetSide && mitigation.targetSide && mitigation.targetSide !== fallbackTargetSide) return;
    summary.total += Number(mitigation.totalPrevented || 0);
    summary.panel += Number(mitigation.panelDefensePrevented || 0);
    summary.scale += Number(mitigation.scalePrevented || 0);
    summary.inverse += Number(mitigation.inversePrevented || 0);
    summary.blocked += Number(mitigation.blocked || 0);
    summary.reduced += Number(mitigation.reduced || 0);
    summary.shield += Number(mitigation.shieldAbsorbed || 0);
  });
  Object.keys(summary).forEach((key) => {
    summary[key] = Number(summary[key].toFixed(1));
  });
  return summary;
}

function formatDuelPreventedDamageSummary(summary = {}) {
  if (!(Number(summary.total || 0) > 0)) return "0";
  const details = [];
  if (Number(summary.panel || 0) > 0) details.push(`面板抗性${formatNumber(summary.panel)}`);
  if (Number(summary.scale || 0) > 0) details.push(`减伤${formatNumber(summary.scale)}`);
  if (Number(summary.inverse || 0) > 0) details.push(`逆向克制${formatNumber(summary.inverse)}`);
  if (Number(summary.blocked || 0) > 0) details.push(`格挡${formatNumber(summary.blocked)}`);
  if (Number(summary.reduced || 0) > 0) details.push(`单位减伤${formatNumber(summary.reduced)}`);
  if (Number(summary.shield || 0) > 0) details.push(`护盾${formatNumber(summary.shield)}`);
  return `${formatNumber(summary.total)}${details.length ? `（${details.join("、")}）` : ""}`;
}

function buildDuelRoundMemo(battle, beforeSnapshot, afterSnapshot, leftHandResult, rightHandResult) {
  const leftBefore = beforeSnapshot?.left || {};
  const rightBefore = beforeSnapshot?.right || {};
  const leftAfter = afterSnapshot?.left || {};
  const rightAfter = afterSnapshot?.right || {};
  const leftMitigation = summarizeDuelPreventedDamage(rightHandResult?.results || [], "left");
  const rightMitigation = summarizeDuelPreventedDamage(leftHandResult?.results || [], "right");
  return {
    round: Number(battle?.round || 0),
    leftMiss: getDuelActionMissText(leftHandResult?.actions || [], leftHandResult?.results || []),
    rightMiss: getDuelActionMissText(rightHandResult?.actions || [], rightHandResult?.results || []),
    leftDelta: formatDuelMemoDelta(leftBefore, leftAfter),
    rightDelta: formatDuelMemoDelta(rightBefore, rightAfter),
    leftMitigation,
    rightMitigation,
    leftStatuses: getDuelNewStatuses(leftBefore, leftAfter).map(formatDuelStatusEffectLabel),
    rightStatuses: getDuelNewStatuses(rightBefore, rightAfter).map(formatDuelStatusEffectLabel)
  };
}

function renderDuelRoundMemoPanel(battle = state.duelBattle) {
  const memo = battle?.lastRoundMemo;
  const leftLabel = getDuelPerspectiveSideLabel("left", battle);
  const rightLabel = getDuelPerspectiveSideLabel("right", battle);
  if (!memo) {
    return `
      <aside class="duel-round-memo">
        <strong>上一回合纪要</strong>
        <p>暂无上一回合纪要。</p>
      </aside>
    `;
  }
  return `
    <aside class="duel-round-memo">
      <strong>上一回合纪要 · R${escapeHtml(formatNumber(memo.round))}</strong>
      <dl>
        <dt>${escapeHtml(leftLabel)}攻击</dt><dd>${escapeHtml(memo.leftMiss)}</dd>
        <dt>${escapeHtml(rightLabel)}攻击</dt><dd>${escapeHtml(memo.rightMiss)}</dd>
        <dt>${escapeHtml(leftLabel)}</dt><dd>${escapeHtml(memo.leftDelta)}</dd>
        <dt>${escapeHtml(rightLabel)}</dt><dd>${escapeHtml(memo.rightDelta)}</dd>
        <dt>${escapeHtml(leftLabel)}抵消伤害</dt><dd>${escapeHtml(formatDuelPreventedDamageSummary(memo.leftMitigation))}</dd>
        <dt>${escapeHtml(rightLabel)}抵消伤害</dt><dd>${escapeHtml(formatDuelPreventedDamageSummary(memo.rightMitigation))}</dd>
        <dt>${escapeHtml(leftLabel)}异常</dt><dd>${escapeHtml(memo.leftStatuses?.length ? memo.leftStatuses.join("、") : "无新增")}</dd>
        <dt>${escapeHtml(rightLabel)}异常</dt><dd>${escapeHtml(memo.rightStatuses?.length ? memo.rightStatuses.join("、") : "无新增")}</dd>
      </dl>
    </aside>
  `;
}

function renderDuelReplayMeta(battle = state.duelBattle) {
  if (!battle) return "";
  return `
    <details class="duel-replay-meta duel-replay-meta-log">
      <summary>复现标识</summary>
      <dl>
        <dt>battleId</dt><dd>${escapeHtml(battle.battleId)}</dd>
        <dt>seed</dt><dd>${escapeHtml(battle.seed)}</dd>
        <dt>replayKey</dt><dd>${escapeHtml(battle.replayKey)}</dd>
      </dl>
    </details>
  `;
}

function isMahoragaProxyActive(battle = state.duelBattle, side = "") {
  return Boolean(side && battle?.mahoragaProxy?.[side]?.active);
}

function clearMahoragaHandState(battle, side) {
  if (!battle || !side) return;
  battle.handState ||= {};
  battle.domainHandState ||= {};
  battle.handState[side] = {
    ...(battle.handState[side] || {}),
    cards: [],
    lastDrawn: [],
    lastInjected: [],
    lastDiscarded: [],
    pendingDiscardCount: 0,
    round: battle.round + 1
  };
  battle.domainHandState[side] = {
    ...(battle.domainHandState[side] || {}),
    cards: [],
    round: battle.round + 1
  };
  clearDuelSelectedHandActions(battle, side, { refund: false });
}

function lockMahoragaHandForTurn(battle, side) {
  if (!isMahoragaProxyActive(battle, side)) return null;
  clearMahoragaHandState(battle, side);
  battle.handLockMessages ||= {};
  battle.handLockMessages[side] = {
    round: battle.round + 1,
    message: "魔虚罗代打中",
    sourceDomainName: "魔虚罗"
  };
  const action = createMahoragaAutoAction(battle, side);
  battle.mahoragaProxy[side].lastLockedAction = {
    round: battle.round + 1,
    actionId: action.id,
    label: action.label
  };
  return action;
}

function createMahoragaAutoAction(battle, side) {
  const roll = duelRandom(battle, `mahoraga:${side}:action`);
  const variants = [
    {
      id: "mahoraga_eight_handled_sword",
      label: "魔虚罗·八握剑斩击",
      damage: 200,
      block: 100,
      effect: { damage: 200, block: 100, stabilityDamage: 34 },
      effectSummary: "魔虚罗自主代打，以八握剑进行强压斩击。"
    },
    {
      id: "mahoraga_adaptive_counter",
      label: "魔虚罗·适应反击",
      damage: 200,
      block: 130,
      effect: { damage: 200, block: 130, stabilityDamage: 28 },
      effects: { incomingHpScale: 0.62 },
      effectSummary: "法轮记录攻击模式后反打，并略微降低本回合承伤。"
    },
    {
      id: "mahoraga_guard_break_step",
      label: "魔虚罗·破防踏碎",
      damage: 200,
      block: 110,
      effect: { damage: 200, block: 110, stabilityDamage: 42 },
      effects: { opponentStabilityDelta: -0.045 },
      effectSummary: "以巨力破坏站位与防御结构。"
    }
  ];
  const picked = variants[Math.min(variants.length - 1, Math.floor(roll * variants.length))];
  return {
    ...picked,
    cardId: `card_${picked.id}`,
    cardType: "mahoraga_proxy",
    type: "attack",
    risk: "high",
    apCost: 0,
    costCe: 0,
    ceCost: 0,
    cost: { ce: 0 },
    damageType: "physical",
    scalingProfile: "mahoraga_proxy",
    accuracyProfile: "weapon",
    evasionAllowed: true,
    tags: ["魔虚罗", "代打", "适应"],
    playableInHandBeta: true,
    available: true,
    handSource: "mahoraga-proxy",
    logTemplate: `${getDuelPerspectiveSideLabel(side, battle)}魔虚罗代替术师自主行动。`
  };
}

function processMahoragaProxyAfterHandResult(battle, handResult) {
  if (!battle || !Array.isArray(handResult?.results)) return;
  handResult.results.forEach((entry) => {
    const proxy = entry?.result?.mahoragaProxy;
    if (!proxy?.active || !proxy.side) return;
    clearMahoragaHandState(battle, proxy.side);
    lockMahoragaHandForTurn(battle, proxy.side);
    battle.actionUiMessage = "魔虚罗代打中";
    recordDuelResourceChange(battle, {
      side: proxy.side,
      title: "调幅仪式完成",
      detail: `${getDuelResourceSideLabel(proxy.side)}角色栏切换为${proxy.name}，手牌区清空并进入魔虚罗代打中。`,
      type: "action",
      delta: { mahoragaProxy: true, side: proxy.side }
    });
  });
}

function formatSignedDuelDelta(value) {
  const number = Number(value || 0);
  if (Math.abs(number) < 0.05) return "+0";
  return `${number > 0 ? "+" : ""}${formatNumber(Number(number.toFixed(1)))}`;
}

function getDuelResourceWinner(battle) {
  cleanupDefeatedDuelDomains(battle);
  const p1 = battle?.resourceState?.p1;
  const p2 = battle?.resourceState?.p2;
  if (!p1 || !p2) return "";
  if (p1.hp <= 0 && p2.hp <= 0) return "draw";
  if (p1.hp <= 0) return "right";
  if (p2.hp <= 0) return "left";
  return "";
}

function cleanupDefeatedDuelDomains(battle) {
  if (!battle?.resourceState) return false;
  let changed = false;
  const pairs = [
    { side: "left", resource: battle.resourceState.p1 },
    { side: "right", resource: battle.resourceState.p2 }
  ];
  pairs.forEach(({ side, resource }) => {
    if (!resource || Number(resource.hp || 0) > 0) return;
    if (resource.domain?.active || Number(resource.domain?.load || 0) > 0) {
      resource.domain.active = false;
      resource.domain.load = 0;
      resource.domain.meltdownRisk = 0;
      changed = true;
    }
    if (battle.domainProfileStates?.[side]) {
      delete battle.domainProfileStates[side];
      changed = true;
    }
    if (battle.domainSubPhase?.owner === side) {
      battle.domainSubPhase.verdictResolved = true;
      battle.domainSubPhase.violenceRestricted = false;
      battle.domainSubPhase.trialEndReason = "domainOwnerDefeated";
      battle.domainSubPhase.trialStatus = "resolved";
      battle.domainSubPhase.endedByDefeat = true;
      updateDuelDomainTrialContext(battle, { trialStatus: "resolved", trialEndReason: "domainOwnerDefeated" });
      changed = true;
    }
  });
  if (changed) invalidateDuelActionChoices(battle);
  return changed;
}

function computeDuelResourceWinRateDelta(battle) {
  const p1 = battle?.resourceState?.p1;
  const p2 = battle?.resourceState?.p2;
  if (!p1 || !p2) return 0;
  const leftHpRatio = p1.maxHp ? p1.hp / p1.maxHp : 0;
  const rightHpRatio = p2.maxHp ? p2.hp / p2.maxHp : 0;
  const leftCeRatio = p1.maxCe ? p1.ce / p1.maxCe : 0;
  const rightCeRatio = p2.maxCe ? p2.ce / p2.maxCe : 0;
  const leftDomainRisk = p1.domain?.active ? Number(p1.domain.meltdownRisk || 0) : 0;
  const rightDomainRisk = p2.domain?.active ? Number(p2.domain.meltdownRisk || 0) : 0;
  return clamp((leftHpRatio - rightHpRatio) * 0.22 + (leftCeRatio - rightCeRatio) * 0.08 - (leftDomainRisk - rightDomainRisk) * 0.06, -0.22, 0.22);
}

function renderDuelResourcePanel(battle = state.duelBattle) {
  if (!battle?.resourceState) return "";
  return `
    <section class="duel-resource-panel">
      ${renderDuelResourceSide(battle.resourceState.p1, battle.left, battle)}
      ${renderDuelRoundMemoPanel(battle)}
      ${renderDuelResourceSide(battle.resourceState.p2, battle.right, battle)}
    </section>
  `;
}

function isDuelCursedToolBattlefieldUnit(unit = {}) {
  return unit.unitKind === "cursed_tool_object"
    || unit.battlefieldObjectType === "cursed_tool"
    || unit.unitStats?.unitKind === "cursed_tool_object"
    || unit.unitStats?.battlefieldObjectType === "cursed_tool";
}

function getDuelUnitControlLabel(control = "", unit = {}) {
  if (isDuelCursedToolBattlefieldUnit(unit)) return "自主咒具";
  const labels = {
    player_controlled: "友方控制",
    temporary_player_controlled: "临时友方",
    neutral_uncontrolled: "中立失控",
    neutral_berserk: "中立狂暴",
    mahoraga_proxy: "内置式神代打"
  };
  return labels[control] || control || "控制未定";
}

function getDuelUnitSideLabel(unit = {}) {
  if (isDuelCursedToolBattlefieldUnit(unit)) {
    if (unit.side === "right" || unit.ownerSide === "right" || unit.controllerSide === "right") return `${getDuelPerspectiveSideLabel("right")}咒具`;
    if (unit.side === "left" || unit.ownerSide === "left" || unit.controllerSide === "left") return `${getDuelPerspectiveSideLabel("left")}咒具`;
    return "战场咒具";
  }
  if (unit.control === "neutral_berserk" || unit.control === "neutral_uncontrolled" || unit.side === "neutral") return "中立单位";
  if (unit.side === "right" || unit.ownerSide === "right" || unit.controllerSide === "right") return `${getDuelPerspectiveSideLabel("right")}式神`;
  if (unit.side === "left" || unit.ownerSide === "left" || unit.controllerSide === "left") return `${getDuelPerspectiveSideLabel("left")}式神`;
  return "战场单位";
}

function getDuelUnitPlacementLabel(unit = {}) {
  if (unit.zoneLabel) return String(unit.zoneLabel);
  const placement = String(unit.placement || "");
  const text = [
    placement,
    unit.summonLane,
    unit.cardId,
    unit.name,
    ...(Array.isArray(unit.tags) ? unit.tags : [])
  ].filter(Boolean).join(" ");
  if (/curse_spirit_manipulation|咒灵操术|咒灵|虹龙|口裂女|化身玉藻前/i.test(text)) {
    return placement === "shikigami_zone" ? "咒灵式神区" : `咒灵式神区 / ${placement || "战场"}`;
  }
  if (placement === "shikigami_zone" || /ten_shadows|十影|十种影|式神|shadow_/i.test(text)) return "式神区";
  return placement || "战场";
}

function getDuelSummonPlacementLabel(summon = {}) {
  if (summon.zoneLabel) return String(summon.zoneLabel);
  const placement = String(summon.placement || "");
  const text = [
    placement,
    summon.summonLane,
    summon.unitCardId,
    summon.unitName
  ].filter(Boolean).join(" ");
  if (/curse_spirit_manipulation|咒灵操术|咒灵|虹龙|口裂女|化身玉藻前/i.test(text)) {
    return placement === "shikigami_zone" ? "咒灵式神区" : `咒灵式神区 / ${placement || "战场"}`;
  }
  if (placement === "shikigami_zone" || /ten_shadows|十影|十种影|式神|shadow_/i.test(text)) return "式神区";
  return placement || "位置未定";
}

function getDuelUnitHpValue(unit = {}) {
  const hp = Number(unit.hp ?? unit.currentHp ?? unit.unitStats?.currentHp ?? unit.unitStats?.maxHp ?? 0);
  return Number.isFinite(hp) ? Math.max(0, hp) : 0;
}

function getDuelUnitMaxHpValue(unit = {}) {
  const maxHp = Number(unit.maxHp ?? unit.unitStats?.maxHp ?? unit.hp ?? unit.currentHp ?? 0);
  return Number.isFinite(maxHp) ? Math.max(0, maxHp) : 0;
}

function getVisibleDuelBattlefieldUnits(battle = state.duelBattle) {
  const units = (Array.isArray(battle?.battlefieldUnits) ? battle.battlefieldUnits : [])
    .filter((unit) => unit && unit.active !== false && getDuelUnitHpValue(unit) > 0)
    .map((unit) => ({ ...unit, displayType: "unit" }));
  return units;
}

function renderDuelBattlefieldUnitsPanel(battle = state.duelBattle) {
  const units = getVisibleDuelBattlefieldUnits(battle);
  if (!units.length) {
    return `
      <section class="duel-battlefield-units empty">
        <div>
          <strong>战场单位 / 咒具 / 式神</strong>
          <p>当前没有已显现的咒具、式神、中立单位或内置代打单位。</p>
        </div>
      </section>
    `;
  }
  return `
    <section class="duel-battlefield-units">
      <div class="duel-battlefield-units-head">
        <strong>战场单位 / 咒具 / 式神</strong>
        <span>${escapeHtml(formatNumber(units.length))} 个单位显现</span>
      </div>
      <div class="duel-battlefield-unit-grid">
        ${units.map(renderDuelBattlefieldUnitCard).join("")}
      </div>
    </section>
  `;
}

function renderDuelBattlefieldUnitCard(unit = {}) {
  const hp = getDuelUnitHpValue(unit);
  const maxHp = getDuelUnitMaxHpValue(unit);
  const hpRatio = maxHp ? clamp(hp / maxHp, 0, 1) : 0;
  const memoryCount = Object.keys(unit.attackMemory || {}).length;
  const detail = unit.displayType === "proxy"
    ? `适应记录 ${formatNumber(memoryCount)} 类攻击手札；同名手札第 4 次记录后完全适应，后续伤害归零。`
    : `基础伤害 ${formatNumber(unit.damage || unit.effect?.damage || 0)}；${unit.defeated ? "已被击破" : "仍在场"}`;
  return `
    <article class="duel-battlefield-unit-card ${escapeHtml(unit.side || "neutral")}">
      <div class="duel-battlefield-unit-title">
        <span>${escapeHtml(getDuelUnitSideLabel(unit))}</span>
        <strong>${escapeHtml(unit.name || unit.label || unit.id || "未命名单位")}</strong>
      </div>
      <div class="duel-battlefield-unit-meta">
        <span>${escapeHtml(getDuelUnitControlLabel(unit.control, unit))}</span>
        <span>${escapeHtml(getDuelUnitPlacementLabel(unit))}</span>
        <span>R${escapeHtml(formatNumber(unit.spawnedRound || 0))} 显现</span>
      </div>
      ${renderDuelResourceBar("单位体势", hp, maxHp || hp, hpRatio, "hp")}
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function getDuelSubPhaseProfile(battle, side) {
  if (!battle || !side) return null;
  return side === "left" ? battle.left : side === "right" ? battle.right : null;
}

function getDuelTrialTextParts(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
  if (value instanceof Set) return Array.from(value).filter(Boolean).map((item) => String(item));
  return [String(value)];
}

function getDuelTrialDisplayMeta(battle, subPhase = null, trialContext = getDuelActiveTrialContext(battle, subPhase)) {
  const ownerSide = subPhase?.owner || trialContext?.owner;
  const defenderSide = subPhase?.defender || trialContext?.target;
  const defender = getDuelSubPhaseProfile(battle, defenderSide);
  const owner = getDuelSubPhaseProfile(battle, ownerSide);
  const targetType = subPhase?.trialSubjectType || trialContext?.trialSubjectType || trialContext?.trialTargetProfile?.trialSubjectType || "unknown";
  const eligibility = normalizeDuelTrialEligibility(subPhase?.trialEligibility || trialContext?.trialEligibility || trialContext?.trialTargetProfile?.trialEligibility, "partial");
  const vocabulary = subPhase?.verdictVocabulary || trialContext?.verdictVocabulary || trialContext?.trialTargetProfile?.verdictVocabulary || "legal";
  const isCursedSpirit = vocabulary === "exorcism";
  const isNonHumanTool = vocabulary === "object" || vocabulary === "controller";
  const responseStatus = trialContext?.responseStatus || {};
  const responseEffective = Boolean(subPhase?.responseEffective || responseStatus.responseEffective);
  const responseLabel = subPhase?.responseLabel || responseStatus.responseLabel || (responseEffective ? "已削弱" : "无硬防线");
  const responseDetail = subPhase?.responseDetail || responseStatus.responseDetail || "";
  const trialEndReason = subPhase?.trialEndReason
    || trialContext?.trialEndReason
    || (subPhase?.endedByMeltdown ? "domainMeltdown" : "")
    || (subPhase?.endedByRelease ? "domainManuallyEnded" : "")
    || (subPhase?.verdictResolved && subPhase?.verdict ? "verdictResolved" : "")
    || (subPhase?.verdictResolved ? "domainResponseDisrupted" : "ongoing");
  const verdictState = subPhase?.verdictResolved
    ? (subPhase.verdict || "已结算")
    : (subPhase ? (subPhase.verdictReady ? "可申请判决" : "未就绪") : (trialContext?.trialStatus === "resolved" ? "已结束" : "目标已识别"));
  const activeStage = subPhase?.verdictResolved
    ? "规则子阶段结束"
    : (subPhase ? (subPhase.verdictReady ? getDuelTrialPhaseLabel(eligibility) : `${getDuelTrialPhaseLabel(eligibility)} R${subPhase.trialRound || 1}`) : getDuelTrialStatusLabel(trialContext?.trialStatus || "pending"));
  const currentStage = responseEffective && !subPhase?.verdictResolved
    ? `${activeStage}（被削弱）`
    : activeStage;
  const responseResult = responseEffective
    ? `目标已识别但审判规则未完整成立；${responseDetail || "领域应对削弱了完整审判推进。"}`
    : "完整审判规则持续推进。";
  return {
    ownerName: owner?.name || trialContext?.ownerName || getDuelResourceSideLabel(ownerSide),
    targetName: defender?.name || trialContext?.targetName || getDuelResourceSideLabel(defenderSide),
    targetLabel: `审判对象：${getDuelTrialTargetLabel(targetType)}`,
    verdictType: getDuelTrialEligibilityLabel(eligibility),
    evidenceLabel: isCursedSpirit ? "残秽证据 / 咒力罪证" : (isNonHumanTool ? "操控链 / 物件记录" : "残秽证据 / 行动记录"),
    vocabulary,
    verdictState,
    currentStage,
    responseLabel,
    responseResult,
    trialEndReason,
    trialEndReasonLabel: getDuelTrialEndReasonLabel(trialEndReason),
    isCursedSpirit,
    isNonHumanTool
  };
}

function renderDuelTrialLogContext(entry, battle = state.duelBattle) {
  const subPhase = battle?.domainSubPhase;
  const trialContext = getDuelActiveTrialContext(battle, subPhase);
  const category = entry?.category || entry?.type || inferDuelLogCategory(entry);
  if (!["subphase", "trialTarget", "verdict", "response", "system", "exorcismRuling", "objectConfiscation", "controllerRedirect"].includes(category) || !trialContext) return "";
  const meta = getDuelTrialDisplayMeta(battle, subPhase?.type === "trial" ? subPhase : null, trialContext);
  const evidencePressure = subPhase?.type === "trial" ? formatNumber(subPhase.evidencePressure || 0) : "未进入";
  const defensePressure = subPhase?.type === "trial" ? formatNumber(subPhase.defensePressure || 0) : "未进入";
  return `
    <div class="duel-log-context">
      <span>${escapeHtml(meta.targetLabel)}：${escapeHtml(meta.targetName)}</span>
      <span>裁定类型：${escapeHtml(meta.verdictType)}</span>
      <span>当前阶段：${escapeHtml(meta.currentStage)}</span>
      <span>应对：${escapeHtml(meta.responseLabel)}</span>
      <span>证据 / 辩护：${escapeHtml(evidencePressure)} / ${escapeHtml(defensePressure)}</span>
      <span>判决状态：${escapeHtml(meta.verdictState)}</span>
      <span>结束原因：${escapeHtml(meta.trialEndReasonLabel)}</span>
    </div>
  `;
}

function renderDuelDomainProfilePanel(battle = state.duelBattle) {
  const states = Object.values(battle?.domainProfileStates || {});
  const subPhase = battle?.domainSubPhase;
  const trialContext = getDuelActiveTrialContext(battle, subPhase);
  if (!states.length && !subPhase && !trialContext) return "";
  const stateItems = states.map((entry) => {
    const normalizedProfile = normalizeDuelDomainBarrierProfile(entry.profile || entry);
    const barrierSummary = getDuelDomainBarrierSummary(normalizedProfile);
    const resource = getDuelResourcePair(battle, entry.ownerSide);
    const ownerLabel = getDuelPerspectiveSideLabel(entry.ownerSide, battle);
    const loadText = resource?.domain?.threshold
      ? `${formatNumber(resource.domain.load)} / ${formatNumber(resource.domain.threshold)}`
      : "无领域负荷";
    const responseText = entry.responseLabel || (entry.weakened ? "已削弱" : "无硬防线");
    const responseResult = entry.weakened
      ? (entry.responseDetail || "专属领域完整展开被削弱。")
      : "专属领域效果完整进入战场。";
    const effectTagLabels = {
      information_overload: "信息过载",
      jackpot_rule: "概率规则",
      placeholder: "待判明效果",
      rule_trial: "审判规则",
      shikigami_auto_attack: "式神自动攻击",
      slash_auto_attack: "斩击自动攻击",
      soul_touch: "灵魂接触",
      sure_hit: "必中"
    };
    const effects = (entry.profile?.domainEffects || [])
      .slice(0, 2)
      .map((effect) => effect.label || effect.description || "未命名领域效果")
      .filter(Boolean)
      .join("、") || "通用领域效果";
    const tags = (entry.effectTags || [])
      .slice(0, 5)
      .map((tag) => effectTagLabels[String(tag || "")] || "其他领域效果")
      .join("、");
    return `
      <article class="duel-domain-profile-card">
        <div class="duel-domain-profile-card-head">
          <span>当前领域：${escapeHtml(ownerLabel)}</span>
          <strong>${escapeHtml(entry.domainName)}</strong>
        </div>
        <dl class="duel-domain-core">
          <div><dt>领域形态</dt><dd>${escapeHtml(barrierSummary.shape)}</dd></div>
          <div><dt>完成度</dt><dd>${escapeHtml(barrierSummary.completion)}</dd></div>
          <div><dt>当前负荷</dt><dd>${escapeHtml(loadText)}</dd></div>
          <div><dt>当前应对</dt><dd>${escapeHtml(responseText)}</dd></div>
        </dl>
        <p class="duel-domain-profile-result">应对结果：${escapeHtml(responseResult)}</p>
        <details class="duel-domain-profile-details">
          <summary>领域详情</summary>
          <p>领域类型：${escapeHtml(DUEL_DOMAIN_CLASS_LABELS[entry.domainClass] || "未分类领域")}</p>
          <p>领域效果：${escapeHtml(effects)}</p>
          <p>形态风险：${escapeHtml(entry.barrierHint || barrierSummary.hint)}</p>
          <p>反制难度：${escapeHtml(barrierSummary.risk)}；切换性：${escapeHtml(barrierSummary.switchability)}</p>
          <p>效果标签：${escapeHtml(tags || "未记录")}</p>
          <em>领域规则已载入</em>
        </details>
      </article>
    `;
  }).join("");
  const trialSubPhase = subPhase?.type === "trial" ? subPhase : null;
  const trialMeta = trialContext ? getDuelTrialDisplayMeta(battle, trialSubPhase, trialContext) : null;
  const evidencePressureText = trialSubPhase ? formatNumber(trialSubPhase.evidencePressure || 0) : "未进入";
  const defensePressureText = trialSubPhase ? formatNumber(trialSubPhase.defensePressure || 0) : "未进入";
  const trialRoundText = trialSubPhase ? (trialSubPhase.trialRound || 1) : "-";
  const violenceRestrictionText = trialSubPhase
    ? (trialSubPhase.violenceRestricted && !trialSubPhase.verdictResolved ? "生效" : "解除")
    : (trialContext?.responseStatus?.responseEffective ? "被削弱" : "未生效");
  const trial = trialMeta ? `
    <article class="duel-domain-profile-card trial">
      <div class="duel-domain-profile-card-head">
        <span>${escapeHtml(trialMeta.targetLabel)}</span>
        <strong>${escapeHtml(trialMeta.targetName)}</strong>
      </div>
      <dl class="duel-domain-core">
        <div><dt>裁定类型</dt><dd>${escapeHtml(trialMeta.verdictType)}</dd></div>
        <div><dt>当前阶段</dt><dd>${escapeHtml(trialMeta.currentStage)}</dd></div>
        <div><dt>当前应对</dt><dd>${escapeHtml(trialMeta.responseLabel)}</dd></div>
        <div><dt>应对结果</dt><dd>${escapeHtml(trialMeta.responseResult)}</dd></div>
        <div><dt>证据口径</dt><dd>${escapeHtml(trialMeta.evidenceLabel)}</dd></div>
        <div><dt>证据压力</dt><dd>${escapeHtml(evidencePressureText)}</dd></div>
        <div><dt>辩护压力</dt><dd>${escapeHtml(defensePressureText)}</dd></div>
        <div><dt>审判轮次</dt><dd>${escapeHtml(trialRoundText)}</dd></div>
        <div><dt>裁定状态</dt><dd>${escapeHtml(trialMeta.verdictState)}</dd></div>
        <div><dt>暴力限制</dt><dd>${escapeHtml(violenceRestrictionText)}</dd></div>
        <div><dt>结束原因</dt><dd>${escapeHtml(trialMeta.trialEndReasonLabel)}</dd></div>
      </dl>
      <em>${escapeHtml(`${trialMeta.ownerName} 发起；${trialMeta.isCursedSpirit ? "目标按咒灵规则处理。" : (trialMeta.isNonHumanTool ? "目标不是独立被告，改为追查操控链或处理对象。" : "这里只显示裁定与术式限制，不替角色追加罪名。")}`)}</em>
    </article>
  ` : "";
  const jackpot = subPhase?.type === "jackpot" ? `
    <article class="duel-domain-profile-card trial">
      <div class="duel-domain-profile-card-head">
        <span>领域演出</span>
        <strong>坐杀搏徒</strong>
      </div>
      <dl class="duel-domain-core">
        <div><dt>中奖期待度</dt><dd>${escapeHtml(formatNumber(globalThis.JJKDuelCounterPipeline?.readCounter?.(battle, subPhase.owner || "left", "idle_death_gamble", "jackpot_gauge", { initial: 0, min: 0, max: 120 }) || 0))} / 100</dd></div>
        <div><dt>循环回合</dt><dd>${escapeHtml(subPhase.jackpotRound || 1)}</dd></div>
        <div><dt>结算状态</dt><dd>${escapeHtml(subPhase.jackpotResolved ? "已中奖" : (subPhase.jackpotReady ? "可结算" : "推进中"))}</dd></div>
        <div><dt>领域规则</dt><dd>运行中</dd></div>
      </dl>
      <em>${escapeHtml(subPhase.jackpotResolved ? "中奖状态已经生效" : "中奖前会继续累积领域负荷与咒力压力")}</em>
    </article>
  ` : "";
  return `
    <section class="duel-domain-profile-panel">
      <div class="duel-domain-profile-head">
        <h4>领域战况</h4>
        <span class="duel-chip">规则已载入</span>
      </div>
      <div class="duel-domain-profile-grid">
        ${stateItems}
        ${trial}
        ${jackpot}
      </div>
    </section>
  `;
}

function getDuelHandPoolInfluenceText(battle = state.duelBattle) {
  const subPhase = battle?.domainSubPhase;
  if (subPhase?.type === "trial") {
    return "手札池：审判子阶段优先，审判 / 辩护手札不会被普通输出挤掉。";
  }
  if (subPhase?.type === "jackpot") {
    return "手札池：中奖规则阶段优先，推进演出 / 稳定循环 / 结算中奖保持可见。";
  }
  const leftDomain = battle?.resourceState?.p1?.domain;
  const rightDomain = battle?.resourceState?.p2?.domain;
  if (leftDomain?.active || rightDomain?.active) {
    return "手札池：普通手札上限 8；领域展开、维持、对抗与反领域牌进入独立领域操控位，不占普通手札。";
  }
  return "手札池：普通手牌上限 8，每回合补 5 张；领域操控手札独立上限 3，每轮随机刷新，不占普通手牌。";
}

function getDuelTurnExecuteControlState(battle = state.duelBattle) {
  const actorSide = getDuelControlledSide(battle);
  const selectedCount = getDuelSelectedHandActions(battle, actorSide).length;
  const pendingDiscardCount = Math.max(0, Number(battle?.handState?.[actorSide]?.pendingDiscardCount || 0));
  const onlineMode = isOnlineDuelModeActive();
  const onlineLockMode = onlineMode && !battle?.dounaGauntlet?.online;
  const onlinePresentation = onlineLockMode
    ? globalThis.JJKOnlineTurnPresentation?.deriveOnlineTurnPresentation?.(
        battle?.onlineRoomSnapshot || {},
        actorSide,
        { submitting: Boolean(state.duelModeState.localLocked) }
      )
    : null;
  const onlineLocked = onlineLockMode && (state.duelModeState.localLocked || onlinePresentation?.inputDisabled);
  const overflowAutoDiscard = pendingDiscardCount > 0;
  const needsAction = false;
  const buttonText = onlineLocked
    ? "已锁定，等待对手"
    : pendingDiscardCount > 0
      ? (onlineLockMode
        ? `自动弃牌 ${formatNumber(pendingDiscardCount)} 张并锁定待机`
        : `自动弃牌 ${formatNumber(pendingDiscardCount)} 张并待机`)
    : onlineLockMode
      ? (selectedCount ? "锁定行动" : "锁定待机")
      : battle?.autoRunning
    ? "生成阶段中..."
    : (selectedCount ? "执行回合" : "待机过回合");
  const resolveHint = onlineLocked
    ? (onlinePresentation?.message || "联机行动已锁定；等待对方锁定后结算。")
    : pendingDiscardCount > 0
      ? (onlineLockMode
        ? "手牌超过上限；点击后会自动弃掉低优先级手牌，并以待机行动锁定本回合。"
        : "手牌超过上限；点击后会自动弃掉低优先级手牌并以待机行动推进，避免连续测试卡住。")
    : onlineLockMode
      ? (selectedCount
        ? "锁定后会提交到新版联机回合状态，不会触发单人结算。"
        : "当前没有选择手札；将以 0 咒力待机行动锁定本回合，避免流程卡死。")
      : needsAction
        ? "未选择手札时不会推进战斗。"
        : !selectedCount
          ? "当前没有选择手札；将以 0 咒力待机行动推进回合，避免流程卡死。"
        : "将按顺序结算已选手札；普通出牌以咒力预算为主。";
  return {
    id: onlineLockMode ? "duelOnlineLockFromHandBtn" : "duelAutoRunBtn",
    buttonText,
    resolveHint,
    disabled: Boolean(battle?.autoRunning || battle?.resolved || needsAction || onlineLocked || (pendingDiscardCount > 0 && !overflowAutoDiscard))
  };
}

function renderDuelTurnExecuteControl(battle = state.duelBattle) {
  const control = getDuelTurnExecuteControlState(battle);
  return `
    <div class="duel-hand-execute-control">
      <p class="duel-action-hint">${escapeHtml(control.resolveHint)}</p>
      <button class="primary" id="${escapeHtml(control.id)}" type="button" ${control.disabled ? "disabled" : ""} title="${escapeHtml(control.resolveHint)}">
        ${escapeHtml(control.buttonText)}
      </button>
    </div>
  `;
}

function getDuelActionEntry(actionOrCandidate = {}) {
  return actionOrCandidate?.action || actionOrCandidate || {};
}

function getDuelActionEntryId(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return actionOrCandidate?.actionId || actionOrCandidate?.id || action.actionId || action.id || action.cardId || "";
}

function normalizeTowerCardIdentity(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/^card_tower_tactic_/, "")
    .replace(/^tower_tactic_/, "")
    .replace(/^tower[-_:]/, "")
    .replace(/^card_/, "");
}

function collectTowerCardIdentityTokens(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return [
    actionOrCandidate?.id,
    actionOrCandidate?.actionId,
    actionOrCandidate?.cardId,
    actionOrCandidate?.towerTacticId,
    actionOrCandidate?.towerTacticEffect,
    actionOrCandidate?.effect,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.towerTacticId,
    action?.towerTacticEffect,
    action?.towerResponseId,
    action?.effect,
    action?.effects?.towerTacticId,
    action?.effects?.towerTacticEffect,
    action?.effects?.towerResponseId
  ].filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value || "").trim()).filter(Boolean);
}

function buildTowerVisibleIntensitySelectionSnapshot(battle = state.duelBattle, selections = []) {
  if (!battle || !Array.isArray(selections)) return [];
  if (!getTowerBossMechanicConfig(battle)) return selections;
  const { actor, opponent } = getDuelSideResources(battle, "left");
  return selections.map((entry) => {
    const action = entry?.action && typeof entry.action === "object" ? entry.action : entry;
    if (!action || typeof action !== "object") return entry;
    const view = getDuelHandCardViewModel(action, actor, opponent, battle);
    const visibleDamage = Math.max(0, Number(getDuelCompactAttackValue(view, action) || 0));
    action.towerIntensityDamage = visibleDamage;
    action.numericPreview = {
      ...(action.numericPreview || {}),
      finalDamage: visibleDamage
    };
    return entry;
  });
}

function haveMatchingTowerCardIdentity(left = {}, right = {}) {
  const rightIds = new Set(collectTowerCardIdentityTokens(right).map(normalizeTowerCardIdentity));
  return collectTowerCardIdentityTokens(left)
    .map(normalizeTowerCardIdentity)
    .some((id) => id && rightIds.has(id));
}

function isTowerTacticCard(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  if (String(action?.cardType || actionOrCandidate?.cardType || "").toLowerCase() !== "activity_tactic") {
    return collectTowerCardIdentityTokens(actionOrCandidate)
      .some((id) => id.toLowerCase().startsWith("card_tower_tactic_"));
  }
  return Boolean(action?.towerTacticId || actionOrCandidate?.towerTacticId) ||
    collectTowerCardIdentityTokens(actionOrCandidate)
      .some((id) => /^(?:card_)?tower(?:_tactic)?[_:-]/i.test(id));
}

function syncTowerTacticCardsIntoVisibleHand(battle = state.duelBattle, side = "left") {
  if (!battle || side !== "left") return 0;
  const handCards = Array.isArray(battle.handState?.left?.cards) ? battle.handState.left.cards : [];
  const tacticCards = [];
  handCards.filter(isTowerTacticCard).forEach((card) => {
    if (!tacticCards.some((existing) => haveMatchingTowerCardIdentity(existing, card))) tacticCards.push(card);
  });
  const visibleCards = (Array.isArray(battle.actionChoices) ? battle.actionChoices : []).filter((card) => !isTowerTacticCard(card));
  tacticCards.forEach((card) => visibleCards.push(card));
  battle.actionChoices = visibleCards;
  battle.handCandidates = visibleCards;
  return tacticCards.length;
}

function getTowerBossInteractionState(battle = state.duelBattle) {
  const interaction = battle?.activityContext?.towerInteraction;
  if (interaction && typeof interaction === "object") return interaction;
  const getter = globalThis.JJKShibuyaIncident?.getTowerBossInteractionState;
  if (typeof getter !== "function") return null;
  const resolved = getter(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function getTowerBossMechanicConfig(battle = state.duelBattle) {
  const context = battle?.activityContext;
  const direct = context?.bossMechanic;
  if (direct?.schema === "jjk.shibuya.tower-boss.v1") return direct;
  const getter = globalThis.JJKShibuyaIncident?.getTowerBossMechanic;
  if (typeof getter !== "function") return null;
  const resolved = getter(battle);
  return resolved?.schema === "jjk.shibuya.tower-boss.v1" ? resolved : null;
}

function getTowerBossInteractionKind(battle = state.duelBattle) {
  const encounterId = String(battle?.activityContext?.encounterId || "");
  const mechanicId = String(getTowerBossMechanicConfig(battle)?.id || battle?.activityContext?.bossMechanicId || "");
  if (encounterId === "tail_granny_toji" || mechanicId === "tower_seance_toji") {
    return Number(battle?.activityContext?.phase || 1) >= 2 ? "toji" : "ogami";
  }
  if (encounterId === "awasaka" || mechanicId === "tower_inverse_puzzle") return "awasaka";
  return "";
}

function getTowerBossInteractionStageConfig(battle = state.duelBattle) {
  const mechanic = getTowerBossMechanicConfig(battle);
  const kind = getTowerBossInteractionKind(battle);
  if (kind === "ogami") return mechanic?.phase1 || null;
  if (kind === "toji") return mechanic?.phase2 || null;
  if (kind === "awasaka") return mechanic?.interaction || null;
  return null;
}

function normalizeDagonCardIdentity(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/^card_dagon_tactic_/, "")
    .replace(/^dagon_tactic_/, "")
    .replace(/^dagon[-_:]/, "")
    .replace(/^card_/, "");
}

function collectDagonCardIdentityTokens(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return [
    actionOrCandidate?.id,
    actionOrCandidate?.actionId,
    actionOrCandidate?.cardId,
    actionOrCandidate?.dagonTacticId,
    actionOrCandidate?.dagonResponseId,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.dagonTacticId,
    action?.dagonResponseId,
    action?.effects?.dagonTacticId,
    action?.effects?.dagonResponseId
  ].filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value || "").trim()).filter(Boolean);
}

function haveMatchingDagonCardIdentity(left = {}, right = {}) {
  const rightIds = new Set(collectDagonCardIdentityTokens(right).map(normalizeDagonCardIdentity));
  return collectDagonCardIdentityTokens(left)
    .map(normalizeDagonCardIdentity)
    .some((id) => id && rightIds.has(id));
}

function isDagonTacticCard(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  if (String(action?.cardType || actionOrCandidate?.cardType || "").toLowerCase() !== "activity_tactic") {
    return collectDagonCardIdentityTokens(actionOrCandidate)
      .some((id) => id.toLowerCase().startsWith("card_dagon_tactic_"));
  }
  return Boolean(action?.dagonTacticId || actionOrCandidate?.dagonTacticId) ||
    collectDagonCardIdentityTokens(actionOrCandidate)
      .some((id) => /^(?:card_)?dagon(?:_tactic)?[_:-]/i.test(id));
}

function syncDagonTacticCardsIntoVisibleHand(battle = state.duelBattle, side = "left") {
  if (!battle || side !== "left") return 0;
  const handCards = Array.isArray(battle.handState?.left?.cards) ? battle.handState.left.cards : [];
  const tacticCards = [];
  handCards.filter(isDagonTacticCard).forEach((card) => {
    if (!tacticCards.some((existing) => haveMatchingDagonCardIdentity(existing, card))) tacticCards.push(card);
  });
  const visibleCards = (Array.isArray(battle.actionChoices) ? battle.actionChoices : []).filter((card) => !isDagonTacticCard(card));
  tacticCards.forEach((card) => visibleCards.push(card));
  battle.actionChoices = visibleCards;
  battle.handCandidates = visibleCards;
  return tacticCards.length;
}

function getDagonBossMechanicConfig(battle = state.duelBattle) {
  const direct = battle?.activityContext?.bossMechanic;
  if (direct?.schema === "jjk.shibuya.dagon-boss.v1") return direct;
  const resolved = globalThis.JJKShibuyaIncident?.getDagonBossMechanic?.(battle);
  return resolved?.schema === "jjk.shibuya.dagon-boss.v1" ? resolved : null;
}

function getDagonBossInteractionState(battle = state.duelBattle) {
  const interaction = battle?.activityContext?.dagonInteraction;
  if (interaction && typeof interaction === "object") return interaction;
  const resolved = globalThis.JJKShibuyaIncident?.getDagonBossInteractionState?.(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function getDagonBossStageConfig(battle = state.duelBattle) {
  const mechanic = getDagonBossMechanicConfig(battle);
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  const stageIndex = Math.max(0, Number(battle?.activityContext?.rotationIndex || 0));
  return stages.find((stage) => Number(stage?.rotationIndex) === stageIndex) || stages[stageIndex] || null;
}

function normalizeChosoCardIdentity(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/^card_choso_tactic_/, "")
    .replace(/^choso_tactic_/, "")
    .replace(/^choso[-_:]/, "")
    .replace(/^card_/, "");
}

function collectChosoCardIdentityTokens(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return [
    actionOrCandidate?.id,
    actionOrCandidate?.actionId,
    actionOrCandidate?.cardId,
    actionOrCandidate?.chosoTacticId,
    actionOrCandidate?.chosoResponseId,
    actionOrCandidate?.effect,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.chosoTacticId,
    action?.chosoResponseId,
    action?.effect,
    action?.effects?.chosoTacticId,
    action?.effects?.chosoResponseId
  ].filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value || "").trim()).filter(Boolean);
}

function haveMatchingChosoCardIdentity(left = {}, right = {}) {
  const rightIds = new Set(collectChosoCardIdentityTokens(right).map(normalizeChosoCardIdentity));
  return collectChosoCardIdentityTokens(left)
    .map(normalizeChosoCardIdentity)
    .some((id) => id && rightIds.has(id));
}

function isChosoTacticCard(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  if (String(action?.cardType || actionOrCandidate?.cardType || "").toLowerCase() !== "activity_tactic") {
    return collectChosoCardIdentityTokens(actionOrCandidate)
      .some((id) => id.toLowerCase().startsWith("card_choso_tactic_"));
  }
  return Boolean(action?.chosoTacticId || actionOrCandidate?.chosoTacticId) ||
    collectChosoCardIdentityTokens(actionOrCandidate)
      .some((id) => /^(?:card_)?choso(?:_tactic)?[_:-]/i.test(id));
}

function syncChosoTacticCardsIntoVisibleHand(battle = state.duelBattle, side = "left") {
  if (!battle || side !== "left") return 0;
  const handCards = Array.isArray(battle.handState?.left?.cards) ? battle.handState.left.cards : [];
  const tacticCards = [];
  handCards.filter(isChosoTacticCard).forEach((card) => {
    if (!tacticCards.some((existing) => haveMatchingChosoCardIdentity(existing, card))) tacticCards.push(card);
  });
  const visibleCards = (Array.isArray(battle.actionChoices) ? battle.actionChoices : []).filter((card) => !isChosoTacticCard(card));
  tacticCards.forEach((card) => visibleCards.push(card));
  battle.actionChoices = visibleCards;
  battle.handCandidates = visibleCards;
  return tacticCards.length;
}

function getChosoBossMechanicConfig(battle = state.duelBattle) {
  const direct = battle?.activityContext?.bossMechanic;
  return direct?.schema === "jjk.shibuya.choso-boss.v1" ? direct : null;
}

function getChosoBossInteractionState(battle = state.duelBattle) {
  const interaction = battle?.activityContext?.chosoInteraction;
  if (interaction && typeof interaction === "object") return interaction;
  const resolved = globalThis.JJKShibuyaIncident?.getChosoBossInteractionState?.(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function getChosoBossStageConfig(battle = state.duelBattle, interaction = getChosoBossInteractionState(battle)) {
  const mechanic = getChosoBossMechanicConfig(battle);
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  if (!stages.length) return null;
  const stageId = String(interaction?.stageId || "");
  const byId = stageId ? stages.find((stage) => String(stage?.id || "") === stageId) : null;
  if (byId) return byId;
  const preparedRound = Math.max(1, Number(
    interaction?.roundPrepared ||
    (Number(battle?.activityContext?.roundOffset || 0) + Number(battle?.round || 0) + 1)
  ));
  return stages.find((stage) => preparedRound >= Number(stage?.roundStart || 1) && preparedRound <= Number(stage?.roundEnd || Infinity)) ||
    stages[Math.max(0, Math.min(stages.length - 1, Number(interaction?.stageIndex || 0)))] || null;
}

function getChosoVisibleTacticCards(battle = state.duelBattle) {
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.handState?.left?.cards || [])
  ].filter(isChosoTacticCard);
  const unique = [];
  cards.forEach((card) => {
    if (!unique.some((entry) => haveMatchingChosoCardIdentity(entry, card))) unique.push(card);
  });
  return unique;
}

function getChosoTacticDefinition(battle = state.duelBattle, card = {}) {
  const stage = getChosoBossStageConfig(battle) || {};
  const definitions = Array.isArray(stage.tacticalCards) ? stage.tacticalCards : [];
  const ids = new Set(collectChosoCardIdentityTokens(card).map(normalizeChosoCardIdentity));
  return definitions.find((definition) => [definition.id, definition.effect, definition.idempotencyKey]
    .map(normalizeChosoCardIdentity)
    .some((id) => id && ids.has(id))) || null;
}

function normalizeMegumiTojiCardIdentity(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/^card_toji_tactic_/, "")
    .replace(/^toji_tactic_/, "")
    .replace(/^toji[-_:]/, "")
    .replace(/^card_/, "");
}

function collectMegumiTojiCardIdentityTokens(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return [
    actionOrCandidate?.id,
    actionOrCandidate?.actionId,
    actionOrCandidate?.cardId,
    actionOrCandidate?.megumiTojiTacticId,
    actionOrCandidate?.tojiResponseId,
    actionOrCandidate?.effect,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.megumiTojiTacticId,
    action?.tojiResponseId,
    action?.effect,
    action?.effects?.megumiTojiTacticId,
    action?.effects?.tojiResponseId
  ].filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value || "").trim()).filter(Boolean);
}

function haveMatchingMegumiTojiCardIdentity(left = {}, right = {}) {
  const rightIds = new Set(collectMegumiTojiCardIdentityTokens(right).map(normalizeMegumiTojiCardIdentity));
  return collectMegumiTojiCardIdentityTokens(left)
    .map(normalizeMegumiTojiCardIdentity)
    .some((id) => id && rightIds.has(id));
}

function isMegumiTojiTacticCard(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  if (String(action?.cardType || actionOrCandidate?.cardType || "").toLowerCase() !== "activity_tactic") {
    return collectMegumiTojiCardIdentityTokens(actionOrCandidate)
      .some((id) => id.toLowerCase().startsWith("card_toji_tactic_"));
  }
  return Boolean(action?.megumiTojiTacticId || actionOrCandidate?.megumiTojiTacticId) ||
    collectMegumiTojiCardIdentityTokens(actionOrCandidate)
      .some((id) => /^(?:card_)?toji(?:_tactic)?[_:-]/i.test(id));
}

function syncMegumiTojiTacticCardsIntoVisibleHand(battle = state.duelBattle, side = "left") {
  if (!battle || side !== "left") return 0;
  const handCards = Array.isArray(battle.handState?.left?.cards) ? battle.handState.left.cards : [];
  const tacticCards = [];
  handCards.filter(isMegumiTojiTacticCard).forEach((card) => {
    if (!tacticCards.some((existing) => haveMatchingMegumiTojiCardIdentity(existing, card))) tacticCards.push(card);
  });
  const visibleCards = (Array.isArray(battle.actionChoices) ? battle.actionChoices : []).filter((card) => !isMegumiTojiTacticCard(card));
  tacticCards.forEach((card) => visibleCards.push(card));
  battle.actionChoices = visibleCards;
  battle.handCandidates = visibleCards;
  return tacticCards.length;
}

function getMegumiTojiBossMechanicConfig(battle = state.duelBattle) {
  const direct = battle?.activityContext?.bossMechanic;
  return direct?.schema === "jjk.shibuya.megumi-toji-boss.v1" ? direct : null;
}

function getMegumiTojiBossInteractionState(battle = state.duelBattle) {
  const interaction = battle?.activityContext?.megumiTojiInteraction;
  if (interaction && typeof interaction === "object") return interaction;
  const resolved = globalThis.JJKShibuyaIncident?.getMegumiTojiBossInteractionState?.(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function getMegumiTojiBossStageConfig(battle = state.duelBattle, interaction = getMegumiTojiBossInteractionState(battle)) {
  const mechanic = getMegumiTojiBossMechanicConfig(battle);
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  if (!stages.length) return null;
  const stageId = String(interaction?.stageId || "");
  const byId = stageId ? stages.find((stage) => String(stage?.id || "") === stageId) : null;
  if (byId) return byId;
  const preparedRound = Math.max(1, Number(
    interaction?.roundPrepared ||
    (Number(battle?.activityContext?.roundOffset || 0) + Number(battle?.round || 0) + 1)
  ));
  return stages.find((stage) => preparedRound >= Number(stage?.roundStart || 1) && preparedRound <= Number(stage?.roundEnd || Infinity)) ||
    stages[Math.max(0, Math.min(stages.length - 1, Number(interaction?.stageIndex || 0)))] || null;
}

function getMegumiTojiVisibleTacticCards(battle = state.duelBattle) {
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.handState?.left?.cards || [])
  ].filter(isMegumiTojiTacticCard);
  const unique = [];
  cards.forEach((card) => {
    if (!unique.some((entry) => haveMatchingMegumiTojiCardIdentity(entry, card))) unique.push(card);
  });
  return unique;
}

function getMegumiTojiTacticDefinition(battle = state.duelBattle, card = {}) {
  const stage = getMegumiTojiBossStageConfig(battle) || {};
  const definitions = Array.isArray(stage.tacticalCards) ? stage.tacticalCards : [];
  const ids = new Set(collectMegumiTojiCardIdentityTokens(card).map(normalizeMegumiTojiCardIdentity));
  return definitions.find((definition) => [definition.id, definition.effect, definition.idempotencyKey]
    .map(normalizeMegumiTojiCardIdentity)
    .some((id) => id && ids.has(id))) || null;
}

function normalizeMahitoSceneCardIdentity(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/^card_mahito_scene_/, "")
    .replace(/^mahito_scene_/, "")
    .replace(/^mahito[-_:]/, "")
    .replace(/^card_/, "");
}

function collectMahitoSceneCardIdentityTokens(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return [
    actionOrCandidate?.id,
    actionOrCandidate?.actionId,
    actionOrCandidate?.cardId,
    actionOrCandidate?.mahitoSceneTacticId,
    actionOrCandidate?.mahitoResponseId,
    actionOrCandidate?.effect,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.mahitoSceneTacticId,
    action?.mahitoResponseId,
    action?.effect,
    action?.effects?.mahitoSceneTacticId,
    action?.effects?.mahitoResponseId
  ].filter((value) => typeof value === "string" || typeof value === "number")
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function haveMatchingMahitoSceneCardIdentity(left = {}, right = {}) {
  const rightIds = new Set(collectMahitoSceneCardIdentityTokens(right).map(normalizeMahitoSceneCardIdentity));
  return collectMahitoSceneCardIdentityTokens(left)
    .map(normalizeMahitoSceneCardIdentity)
    .some((id) => id && rightIds.has(id));
}

function isMahitoSceneTacticCard(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  if (String(action?.cardType || actionOrCandidate?.cardType || "").toLowerCase() !== "activity_tactic") {
    return collectMahitoSceneCardIdentityTokens(actionOrCandidate)
      .some((id) => id.toLowerCase().startsWith("card_mahito_scene_"));
  }
  return Boolean(action?.mahitoSceneTacticId || actionOrCandidate?.mahitoSceneTacticId) ||
    collectMahitoSceneCardIdentityTokens(actionOrCandidate)
      .some((id) => /^(?:card_)?mahito(?:_scene)?[_:-]/i.test(id));
}

function syncMahitoSceneTacticCardsIntoVisibleHand(battle = state.duelBattle, side = "left") {
  if (!battle || side !== "left") return 0;
  const handCards = Array.isArray(battle.handState?.left?.cards) ? battle.handState.left.cards : [];
  const tacticCards = [];
  handCards.filter(isMahitoSceneTacticCard).forEach((card) => {
    if (!tacticCards.some((existing) => haveMatchingMahitoSceneCardIdentity(existing, card))) tacticCards.push(card);
  });
  const visibleCards = (Array.isArray(battle.actionChoices) ? battle.actionChoices : [])
    .filter((card) => !isMahitoSceneTacticCard(card));
  tacticCards.forEach((card) => visibleCards.push(card));
  battle.actionChoices = visibleCards;
  battle.handCandidates = visibleCards;
  return tacticCards.length;
}

function getMahitoBossMechanicConfig(battle = state.duelBattle) {
  const direct = battle?.activityContext?.bossMechanic;
  if (direct?.schema === "jjk.shibuya.mahito-boss.v1") return direct;
  const resolved = globalThis.JJKShibuyaIncident?.getMahitoBossMechanic?.(battle);
  return resolved?.schema === "jjk.shibuya.mahito-boss.v1" ? resolved : null;
}

function getMahitoBossInteractionState(battle = state.duelBattle) {
  const direct = battle?.activityContext?.mahitoInteraction;
  if (direct && typeof direct === "object") return direct;
  const resolved = globalThis.JJKShibuyaIncident?.getMahitoBossInteractionState?.(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function getMahitoBossStageConfig(battle = state.duelBattle, interaction = getMahitoBossInteractionState(battle)) {
  const mechanic = getMahitoBossMechanicConfig(battle);
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  if (!stages.length) return null;
  const stageId = String(interaction?.stageId || "");
  const byId = stageId ? stages.find((stage) => String(stage?.id || "") === stageId) : null;
  if (byId) return byId;
  const encounterRound = Math.max(1,
    Number(battle?.activityContext?.roundOffset || 0) + Number(battle?.round || 0) + 1
  );
  return stages.find((stage) => encounterRound >= Number(stage?.roundStart || 1) && encounterRound <= Number(stage?.roundEnd || Infinity)) ||
    stages[Math.max(0, Math.min(stages.length - 1, Number(interaction?.stageIndex || 0)))] || null;
}

function getMahitoVisibleTacticCards(battle = state.duelBattle) {
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.handState?.left?.cards || [])
  ].filter(isMahitoSceneTacticCard);
  const unique = [];
  cards.forEach((card) => {
    if (!unique.some((entry) => haveMatchingMahitoSceneCardIdentity(entry, card))) unique.push(card);
  });
  return unique;
}

function getMahitoTacticDefinition(battle = state.duelBattle, card = {}) {
  const stage = getMahitoBossStageConfig(battle) || {};
  const definitions = Array.isArray(stage.tacticalCards) ? stage.tacticalCards : [];
  const ids = new Set(collectMahitoSceneCardIdentityTokens(card).map(normalizeMahitoSceneCardIdentity));
  return definitions.find((definition) => [definition.id, definition.effect]
    .map(normalizeMahitoSceneCardIdentity)
    .some((id) => id && ids.has(id))) || null;
}

function normalizeHarutaCardIdentity(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/^card_haruta_tactic_/, "")
    .replace(/^haruta_tactic_/, "")
    .replace(/^card_/, "");
}

function collectHarutaCardIdentityTokens(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  return [
    actionOrCandidate?.id,
    actionOrCandidate?.actionId,
    actionOrCandidate?.cardId,
    actionOrCandidate?.harutaTacticId,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.harutaTacticId,
    action?.effects?.harutaTacticId
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function haveMatchingHarutaCardIdentity(left = {}, right = {}) {
  const rightIds = new Set(collectHarutaCardIdentityTokens(right).map(normalizeHarutaCardIdentity));
  return collectHarutaCardIdentityTokens(left)
    .map(normalizeHarutaCardIdentity)
    .some((id) => id && rightIds.has(id));
}

function isHarutaTacticCard(actionOrCandidate = {}) {
  return collectHarutaCardIdentityTokens(actionOrCandidate)
    .some((id) => id.toLowerCase().startsWith("card_haruta_tactic_"));
}

function syncHarutaTacticCardsIntoVisibleHand(battle = state.duelBattle, side = "left") {
  if (!battle || side !== "left") return 0;
  const handCards = Array.isArray(battle.handState?.left?.cards) ? battle.handState.left.cards : [];
  const tacticCards = handCards.filter(isHarutaTacticCard);
  if (!tacticCards.length) return 0;
  const visibleCards = Array.isArray(battle.actionChoices) ? [...battle.actionChoices] : [];
  let appended = 0;
  tacticCards.forEach((card) => {
    if (visibleCards.some((visible) => haveMatchingHarutaCardIdentity(visible, card))) return;
    visibleCards.push(card);
    appended += 1;
  });
  battle.actionChoices = visibleCards;
  battle.handCandidates = visibleCards;
  return appended;
}

function getHarutaInteractionState(battle = state.duelBattle) {
  const interaction = battle?.activityContext?.harutaInteraction;
  return interaction && typeof interaction === "object" ? interaction : null;
}

function getHarutaCursedToolTarget(battle = state.duelBattle) {
  if (!getHarutaInteractionState(battle)) return null;
  const units = Array.isArray(battle?.battlefieldUnits) ? battle.battlefieldUnits : [];
  const activeUnits = units.filter((unit) => unit?.active !== false && getDuelUnitHpValue(unit) > 0);
  return activeUnits.find((unit) => unit?.harutaHandSword || unit?.unitStats?.harutaHandSword) ||
    activeUnits.find((unit) => {
      const objectType = String(unit?.battlefieldObjectType || unit?.unitStats?.battlefieldObjectType || "").toLowerCase();
      const ownerSide = String(unit?.controllerSide || unit?.ownerSide || unit?.side || "");
      return objectType === "cursed_tool" && (!ownerSide || ownerSide === "right");
    }) ||
    null;
}

function getHarutaTargetChoices(battle = state.duelBattle) {
  if (!getHarutaInteractionState(battle)) return [];
  const boss = battle?.resourceState?.p2;
  if (!boss) return [];
  const tool = getHarutaCursedToolTarget(battle);
  const choices = [];
  if (tool) {
    const id = String(tool.id || tool.cardId || tool.actionId || "");
    if (id) {
      choices.push({
        id,
        kind: "cursed_tool",
        label: "手形刀柄咒具",
        hp: getDuelUnitHpValue(tool),
        maxHp: Math.max(getDuelUnitHpValue(tool), getDuelUnitMaxHpValue(tool))
      });
    }
  }
  choices.push({
    id: String(boss.id || boss.side || "right"),
    kind: "boss",
    label: "重面春太",
    hp: Math.max(0, Number(boss.hp || 0)),
    maxHp: Math.max(0, Number(boss.maxHp || boss.hp || 0))
  });
  return choices;
}

function getHarutaTargetChoiceById(battle = state.duelBattle, targetId = "") {
  const normalized = String(targetId || "");
  return getHarutaTargetChoices(battle).find((choice) => choice.id === normalized) || null;
}

function applyHarutaExplicitTargetChoice(actionOrCandidate = {}, targetChoice = null) {
  if (!targetChoice?.id) return actionOrCandidate;
  const action = getDuelActionEntry(actionOrCandidate);
  const targeting = {
    targetId: targetChoice.id,
    primaryTargetId: targetChoice.id,
    targetSide: "right",
    primaryTargetSide: "right",
    allowUnitInterception: false,
    harutaTargetChoice: targetChoice.kind,
    harutaTargetLabel: targetChoice.label,
    targetPlan: {
      ...(action.targetPlan || {}),
      target: "opponent",
      targetSide: "right",
      primaryTargetSide: "right",
      primaryTargetId: targetChoice.id,
      explicitTargetId: targetChoice.id,
      allowUnitInterception: false,
      selectionMode: targetChoice.kind === "boss"
        ? "haruta_explicit_boss_bypass_guard"
        : "haruta_explicit_cursed_tool"
    }
  };
  const targetedAction = { ...action, ...targeting };
  if (actionOrCandidate?.action) {
    return {
      ...actionOrCandidate,
      ...targeting,
      action: targetedAction
    };
  }
  return targetedAction;
}

function hasSelectedHarutaRangeAdjustment(battle = state.duelBattle) {
  return getDuelSelectedHandActions(battle, "left").some((entry) => {
    const action = getDuelActionEntry(entry?.action || entry);
    return Boolean(action?.rangeAdjustment || action?.effects?.rangeAdjustment);
  });
}

function isHarutaSingleTargetAttackAction(actionOrCandidate = {}, battle = state.duelBattle, view = null) {
  if (!getHarutaInteractionState(battle) || !getHarutaCursedToolTarget(battle)) return false;
  if (isHarutaTacticCard(actionOrCandidate) || hasSelectedHarutaRangeAdjustment(battle)) return false;
  const action = getDuelActionEntry(actionOrCandidate);
  if (isReverseCursedTechniqueOutputDuelAction(action) || isMaximumUzumakiDuelAction(action)) return false;
  const cardView = view || getDuelHandCardViewModel(actionOrCandidate, battle?.resourceState?.p1, battle?.resourceState?.p2, battle);
  const typeText = [
    action?.type,
    action?.cardType,
    cardView?.cardType,
    action?.targetType,
    action?.targetMode,
    action?.damageScope,
    action?.targetScope,
    action?.scope,
    action?.scaling?.source,
    cardView?.scaling?.source,
    action?.targetPlan?.selectionMode
  ].filter(Boolean).join(" ").toLowerCase();
  if (action?.summonSpec || cardView?.summonSpec || action?.mahoragaProxySpec || /summon|召唤|召喚|式神/.test(typeText)) return false;
  const effects = action?.effects || {};
  if (
    action?.aoe || action?.areaAttack || action?.targetAll ||
    effects.aoe || effects.areaAttack || effects.areaDamage || effects.attackAll || effects.targetAll ||
    action?.rangeAdjustment || effects.rangeAdjustment
  ) return false;
  const text = [
    typeText,
    action?.id,
    action?.actionId,
    action?.cardId,
    action?.label,
    action?.name,
    action?.effectSummary,
    cardView?.effectText,
    ...(Array.isArray(action?.tags) ? action.tags : []),
    ...(Array.isArray(cardView?.tags) ? cardView.tags : [])
  ].filter(Boolean).join(" ");
  if (/\baoe\b|all[_ -]?enemies|area[_ -]?(?:attack|damage)|群体|群體|全体|全體|范围攻击|範圍攻擊|范围伤害|範圍傷害|多目标|多目標/i.test(text)) return false;
  return getDuelCompactAttackValue(cardView, actionOrCandidate) > 0;
}

function renderHarutaTargetPicker(actionOrCandidate, battle = state.duelBattle, view = null) {
  if (!isHarutaSingleTargetAttackAction(actionOrCandidate, battle, view)) return "";
  const choices = getHarutaTargetChoices(battle);
  if (choices.length < 2) return "";
  const actionId = getDuelActionEntryId(actionOrCandidate);
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  return `
    <label class="duel-haruta-target-picker">
      <span>本牌目标</span>
      <select data-duel-haruta-target="${escapeHtml(actionId)}" ${onlineLocked || view?.available === false ? "disabled" : ""}>
        ${choices.map((choice) => `<option value="${escapeHtml(choice.id)}">${escapeHtml(`${choice.label}（${formatNumber(choice.hp)}/${formatNumber(choice.maxHp)}）`)}</option>`).join("")}
      </select>
      <small>拆除咒具可停止守卫与追击；直取春太会绕过咒具，但咒具仍会行动。</small>
    </label>`;
}

function getHarutaDisplayLabel(value, fallback = "未判明") {
  if (value && typeof value === "object") return String(value.label || value.name || fallback);
  const text = String(value ?? "").trim();
  return text || fallback;
}

function renderHarutaOrdinaryCounterHint(intent = {}) {
  const labels = {
    attack: "攻击牌",
    defense: "防御牌",
    support: "支援牌",
    control: "控制牌",
    healing: "治疗牌",
    movement: "移动牌"
  };
  const categories = (Array.isArray(intent?.ordinaryCounterCategories) ? intent.ordinaryCounterCategories : [])
    .map((category) => labels[String(category || "").toLowerCase()] || "其他应对")
    .filter(Boolean);
  return categories.length
    ? `<span class="duel-haruta-ordinary-counters">普通牌也可反制：${escapeHtml(categories.join(" / "))}</span>`
    : "";
}

function getHarutaPercent(value, maximum) {
  const max = Math.max(1, Number(maximum || 1));
  return Math.max(0, Math.min(100, Math.round((Math.max(0, Number(value || 0)) / max) * 100)));
}

function renderHarutaObjectiveChecklist(interaction = {}) {
  const progress = interaction.objectiveProgress;
  if (!progress || typeof progress !== "object") return "";
  const item = (label, entry) => `${entry?.done ? "✓" : "○"} ${label}`;
  const labels = progress.variant === "nanami"
    ? [
        item("护住钉崎与新田1回合", progress.protectedRounds),
        item("压制咒具或识破佯退", progress.toolOrFeint),
        item("截住1次真正逃离", progress.escapeInterruptions),
        item("压迫满格", progress.fullPressure)
      ]
    : [
        item(`撑过${Math.max(0, Number(progress.rounds?.target || 0))}回合`, progress.rounds),
        item("至少回应1次春太意图", progress.harutaResponses)
      ];
  return `<p class="duel-haruta-route-hint" data-haruta-objective-progress="${progress.complete ? "complete" : "pending"}"><b>本场目标：</b>${labels.map((label) => escapeHtml(label)).join(" · ")}</p>`;
}

function renderHarutaMiracleEyes(marks = {}) {
  const total = Math.max(0, Math.round(Number(marks.total || 0)));
  const lit = Math.max(0, Math.min(total, Math.round(Number(marks.lit || 0))));
  const visibleTotal = Math.min(12, total);
  const visibleLit = total > visibleTotal && total > 0
    ? Math.round((lit / total) * visibleTotal)
    : Math.min(lit, visibleTotal);
  const eyes = Array.from({ length: visibleTotal }, (_, index) => `<i class="duel-haruta-eye${index < visibleLit ? " is-lit" : " is-dark"}" aria-hidden="true"></i>`).join("");
  const stateLabel = lit > 0 ? "亮起的印记仍可能改写致死结果" : "眼下印记已经全部褪色";
  return `<div class="duel-haruta-miracles" aria-label="奇迹眼下印记：${escapeHtml(stateLabel)}"><span class="duel-haruta-eye-row">${eyes || "<em>无印记</em>"}</span><b>${escapeHtml(stateLabel)}</b></div>`;
}

function renderHarutaProtecteeHearts(protectee = {}) {
  const maxHp = Math.max(1, Math.round(Number(protectee.maxHp || 1)));
  const hp = Math.max(0, Math.min(maxHp, Math.round(Number(protectee.hp ?? maxHp))));
  const visibleMax = Math.min(12, maxHp);
  const visibleHp = maxHp > visibleMax ? Math.round((hp / maxHp) * visibleMax) : hp;
  const hearts = Array.from({ length: visibleMax }, (_, index) => `<i class="${index < visibleHp ? "is-full" : "is-lost"}" aria-hidden="true">${index < visibleHp ? "♥" : "♡"}</i>`).join("");
  return `<div class="duel-haruta-protectee" aria-label="${escapeHtml(getHarutaDisplayLabel(protectee, "护送对象"))} 体势 ${hp}/${maxHp}"><span>${hearts}</span><b>${escapeHtml(formatNumber(hp))} / ${escapeHtml(formatNumber(maxHp))}</b></div>`;
}

function getHarutaVisibleCardByCounterId(battle = state.duelBattle, counterId = "") {
  const normalizedId = normalizeHarutaCardIdentity(counterId);
  if (!normalizedId) return null;
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.domainHandCandidates || []),
    ...(battle?.handState?.left?.cards || [])
  ];
  return cards.find((card) => collectHarutaCardIdentityTokens(card)
    .map(normalizeHarutaCardIdentity)
    .includes(normalizedId)) || null;
}

function collectHarutaCounterRequirements(interaction = {}) {
  const counters = new Map();
  [
    { intent: interaction.harutaIntent, source: "春太意图" },
    { intent: interaction.toolIntent, source: "咒具意图" }
  ].forEach(({ intent, source }) => {
    (Array.isArray(intent?.counterIds) ? intent.counterIds : []).forEach((counterId) => {
      const rawId = String(counterId || "").trim();
      const id = normalizeHarutaCardIdentity(rawId);
      if (!id) return;
      if (!counters.has(id)) counters.set(id, { id: rawId, sources: [] });
      if (!counters.get(id).sources.includes(source)) counters.get(id).sources.push(source);
    });
  });
  return Array.from(counters.values());
}

function renderHarutaCounterOptions(interaction, battle = state.duelBattle) {
  const requirements = collectHarutaCounterRequirements(interaction);
  if (!requirements.length) {
    return `<p class="duel-haruta-counter-empty">本回合没有专属反制牌；请用单体攻击的目标选择决定拆解咒具或直取春太。</p>`;
  }
  const { actor, opponent } = getDuelSideResources(battle, "left");
  const selectedEntries = getDuelSelectedHandActions(battle, "left");
  const selectedIds = new Set(selectedEntries.flatMap((entry) => collectHarutaCardIdentityTokens(entry?.action || entry).map(normalizeHarutaCardIdentity)));
  const pendingDiscard = Number(battle?.handState?.left?.pendingDiscardCount || 0) > 0;
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  return `<div class="duel-haruta-counter-grid">${requirements.map((requirement) => {
    const normalizedRequirement = normalizeHarutaCardIdentity(requirement.id);
    if (normalizedRequirement === "close_distance") {
      const attackAvailable = (battle?.actionChoices || []).some((candidate) => {
        const candidateView = getDuelHandCardViewModel(candidate, actor, opponent, battle);
        return candidateView.available && isHarutaSingleTargetAttackAction(candidate, battle, candidateView);
      });
      const reason = attackAvailable
        ? "可用 · 用单体攻击并把目标设为重面春太"
        : "本回合没有可直取春太的单体攻击";
      return `<div class="duel-haruta-counter is-strategy ${attackAvailable ? "is-available" : "is-blocked"}"><span>${escapeHtml(requirement.sources.join(" / "))}</span><strong>贴身追击</strong><em>${escapeHtml(reason)}</em></div>`;
    }
    if (normalizedRequirement === "suppress_tool_attack") {
      const attackAvailable = (battle?.actionChoices || []).some((candidate) => {
        const candidateView = getDuelHandCardViewModel(candidate, actor, opponent, battle);
        return candidateView.available && isHarutaSingleTargetAttackAction(candidate, battle, candidateView);
      });
      const reason = attackAvailable
        ? "可用 · 用单体攻击并把目标设为手形刀柄咒具"
        : "本回合没有可拆解咒具的单体攻击";
      return `<div class="duel-haruta-counter is-strategy ${attackAvailable ? "is-available" : "is-blocked"}"><span>${escapeHtml(requirement.sources.join(" / "))}</span><strong>直接拆解咒具</strong><em>${escapeHtml(reason)}</em></div>`;
    }
    const card = getHarutaVisibleCardByCounterId(battle, requirement.id);
    if (!card) {
      return `<button class="duel-haruta-counter is-missing" type="button" disabled><span>${escapeHtml(requirement.sources.join(" / "))}</span><strong>所需应对尚未载入</strong><em>未进入本回合手牌</em></button>`;
    }
    const view = getDuelHandCardViewModel(card, actor, opponent, battle);
    const actionId = getDuelActionEntryId(card);
    const normalizedCardIds = collectHarutaCardIdentityTokens(card).map(normalizeHarutaCardIdentity);
    const selected = normalizedCardIds.some((id) => selectedIds.has(id));
    const selectionCheck = selected ? { ok: false, reason: "已选为本回合互动" } : canSelectDuelHandCandidate(card, actor, opponent, battle, { side: "left" });
    const available = Boolean(!selected && !pendingDiscard && !onlineLocked && view.available && selectionCheck.ok);
    const reason = selected
      ? "已选为本回合互动"
      : onlineLocked
        ? "联机行动已锁定"
        : pendingDiscard
          ? "请先完成弃牌"
          : available
            ? "可用 · 点击选择互动"
            : (selectionCheck.reason || view.availabilityMessage || view.unavailableReason || "当前不可用");
    const stateClass = selected ? "is-selected" : (available ? "is-available" : "is-blocked");
    return `<button class="duel-haruta-counter ${stateClass}" data-duel-haruta-counter-action="${escapeHtml(actionId)}" type="button" ${available ? "" : "disabled"}><span>${escapeHtml(requirement.sources.join(" / "))}</span><strong>${escapeHtml(view.displayName || view.label || getHarutaDisplayLabel(card, "所需应对"))}</strong><em>${escapeHtml(reason)}</em></button>`;
  }).join("")}</div>`;
}

function renderHarutaInteractionPanel(battle = state.duelBattle) {
  const interaction = getHarutaInteractionState(battle);
  if (!interaction || getDuelControlledSide(battle) !== "left") return "";
  const protectee = interaction.protectee || {};
  const pressure = Math.max(0, Number(interaction.pressure || 0));
  const maxPressure = Math.max(1, Number(interaction.maxPressure || 1));
  const escapeProgress = Math.max(0, Number(interaction.escapeProgress || 0));
  const maxEscapeProgress = Math.max(1, Number(interaction.maxEscapeProgress || 1));
  const harutaIntent = interaction.harutaIntent || {};
  const tool = getHarutaCursedToolTarget(battle);
  const toolIntent = interaction.toolIntent || {};
  const roundPrepared = Math.max(1, Number(interaction.roundPrepared || battle.round + 1));
  const toolIntentLabel = tool ? getHarutaDisplayLabel(toolIntent, "追击未判明") : "咒具已破坏 · 守卫与追击停止";
  return `
    <section class="duel-haruta-interaction" aria-label="重面春太战斗机制" aria-live="polite">
      <header class="duel-haruta-interaction-head">
        <div><small>战况已公开</small><h5>重面春太 · 红线追猎</h5><p>看清双方动作；单体攻击可在咒具与春太之间指定目标。</p></div>
        <span>第${escapeHtml(formatNumber(roundPrepared))}回合</span>
      </header>
      <div class="duel-haruta-vitals">
        <article><small>奇迹 · 眼下印记</small>${renderHarutaMiracleEyes(interaction.miracleMarks)}</article>
        <article><small>护送对象 · ${escapeHtml(getHarutaDisplayLabel(protectee, "辅助监督"))}</small>${renderHarutaProtecteeHearts(protectee)}</article>
        <article><small>春太精神状态</small><strong>${escapeHtml(getHarutaDisplayLabel(interaction.mentalState, "游移不定"))}</strong></article>
      </div>
      <div class="duel-haruta-intents">
        <article class="is-haruta"><small>春太意图</small><strong>${escapeHtml(getHarutaDisplayLabel(harutaIntent, "动作未判明"))}</strong>${harutaIntent.detail || harutaIntent.telegraph ? `<span class="duel-haruta-intent-detail">${escapeHtml(harutaIntent.detail || harutaIntent.telegraph)}</span>` : ""}<span>目标：${escapeHtml(getHarutaDisplayLabel(harutaIntent.targetLabel, "战场弱者"))}</span>${renderHarutaOrdinaryCounterHint(harutaIntent)}</article>
        <article class="is-tool${tool ? "" : " is-disabled"}"><small>手形刀柄咒具意图</small><strong>${escapeHtml(toolIntentLabel)}</strong>${tool && (toolIntent.detail || toolIntent.telegraph) ? `<span class="duel-haruta-intent-detail">${escapeHtml(toolIntent.detail || toolIntent.telegraph)}</span>` : ""}<span>${tool ? "击破咒具即可永久停止该意图" : "现在可集中攻击重面春太"}</span>${renderHarutaOrdinaryCounterHint(toolIntent)}</article>
      </div>
      <div class="duel-haruta-race">
        <article><div><span>压制春太</span><b>${escapeHtml(formatNumber(pressure))} / ${escapeHtml(formatNumber(maxPressure))}</b></div><i class="duel-haruta-meter"><span style="--haruta-progress:${getHarutaPercent(pressure, maxPressure)}%"></span></i></article>
        <article class="is-danger"><div><span>春太脱逃</span><b>${escapeHtml(formatNumber(escapeProgress))} / ${escapeHtml(formatNumber(maxEscapeProgress))}</b></div><i class="duel-haruta-meter"><span style="--haruta-progress:${getHarutaPercent(escapeProgress, maxEscapeProgress)}%"></span></i></article>
      </div>
      ${renderHarutaObjectiveChecklist(interaction)}
      <div class="duel-haruta-counter-section">
        <div><strong>本回合可用反制</strong><span>点选后仍按原手牌顺序、咒力与锁定规则结算。</span></div>
        ${renderHarutaCounterOptions(interaction, battle)}
      </div>
      <p class="duel-haruta-route-hint">先拆咒具，它便不会再出手；直取春太，则要承担咒具的追击。</p>
    </section>`;
}

function getTowerPercent(value, maximum) {
  const max = Math.max(1, Number(maximum || 1));
  return Math.max(0, Math.min(100, Math.round((Math.max(0, Number(value || 0)) / max) * 100)));
}

function getTowerResponseLabel(responseId = "") {
  const labels = {
    interrupt_chant: "扰乱咏唱",
    suppress_grandson: "逼退护卫",
    guard_vitals: "守住要害",
    brace_impact: "架开冲撞",
    break_pursuit_line: "横切换线",
    refuse_pursuit: "不上他的钩",
    toad_weak_pincer: "蛤蟆弱击牵制",
    last_moment_pull: "临门收力",
    analyze_inverse: "比对承伤",
    break_curtain_anchor: "夺回帐钉"
  };
  return labels[normalizeTowerCardIdentity(responseId)] || "观察后应对";
}

function renderTowerMetric(label, value, maximum, tone = "") {
  const current = Math.max(0, Number(value || 0));
  const max = Math.max(1, Number(maximum || 1));
  return `
    <article class="duel-tower-metric ${tone ? `is-${escapeHtml(tone)}` : ""}">
      <div><span>${escapeHtml(label)}</span><b>${escapeHtml(formatNumber(current))} / ${escapeHtml(formatNumber(max))}</b></div>
      <i class="duel-tower-meter" aria-label="${escapeHtml(`${label} ${formatNumber(current)} / ${formatNumber(max)}`)}"><span style="--tower-progress:${getTowerPercent(current, max)}%"></span></i>
    </article>`;
}

function getTowerVisibleTacticCards(battle = state.duelBattle) {
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.handState?.left?.cards || [])
  ].filter(isTowerTacticCard);
  const unique = [];
  cards.forEach((card) => {
    if (unique.some((entry) => haveMatchingTowerCardIdentity(entry, card))) return;
    unique.push(card);
  });
  return unique;
}

function getTowerTacticDefinition(battle = state.duelBattle, card = {}) {
  const stage = getTowerBossInteractionStageConfig(battle) || {};
  const definitions = Array.isArray(stage.tacticalCards) ? stage.tacticalCards : [];
  const ids = new Set(collectTowerCardIdentityTokens(card).map(normalizeTowerCardIdentity));
  return definitions.find((definition) => [definition.id, definition.effect, definition.idempotencyKey]
    .map(normalizeTowerCardIdentity)
    .some((id) => id && ids.has(id))) || null;
}

function getTowerTacticSelectionGate(battle = state.duelBattle, card = {}) {
  if (!isTowerTacticCard(card)) return { ok: true, reason: "" };
  const definition = getTowerTacticDefinition(battle, card);
  if (!definition) {
    return { ok: false, reason: "现在还用不上这一步" };
  }
  const interaction = getTowerBossInteractionState(battle) || {};
  const requiredOpenings = Math.max(0, Number(
    definition.requiresAnchorOpenings ||
    getDuelActionEntry(card)?.requiresAnchorOpenings ||
    0
  ));
  const anchorOpenings = Math.max(0, Number(interaction.anchorOpenings || 0));
  if (requiredOpenings > anchorOpenings) {
    return {
      ok: false,
      reason: `还需 ${Math.max(0, requiredOpenings - anchorOpenings)} 个夺钉机会`
    };
  }
  return { ok: true, reason: "" };
}

function getTowerIntentCounterIds(interaction = {}) {
  const ids = [];
  (Array.isArray(interaction?.publicIntents) ? interaction.publicIntents : []).forEach((intent) => {
    const id = normalizeTowerCardIdentity(intent?.counterId || intent?.responseId || "");
    if (id && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

function renderTowerCounterOptions(interaction, battle = state.duelBattle) {
  const cards = getTowerVisibleTacticCards(battle);
  if (!cards.length) {
    return `<p class="duel-tower-counter-empty">本回合没有活动战术牌；普通攻击、防御、控制和支援牌仍会按公开提示参与机制。</p>`;
  }
  const { actor, opponent } = getDuelSideResources(battle, "left");
  const selectedEntries = getDuelSelectedHandActions(battle, "left");
  const selectedIds = new Set(selectedEntries.flatMap((entry) => collectTowerCardIdentityTokens(entry?.action || entry).map(normalizeTowerCardIdentity)));
  const pendingDiscard = Number(battle?.handState?.left?.pendingDiscardCount || 0) > 0;
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  const intentCounterIds = new Set(getTowerIntentCounterIds(interaction));
  return `<div class="duel-tower-counter-grid">${cards.map((card) => {
    const view = getDuelHandCardViewModel(card, actor, opponent, battle);
    const actionId = getDuelActionEntryId(card);
    const definition = getTowerTacticDefinition(battle, card);
    const cardIds = collectTowerCardIdentityTokens(card).map(normalizeTowerCardIdentity);
    const tacticId = normalizeTowerCardIdentity(
      definition?.effect ||
      card?.towerTacticEffect ||
      card?.towerTacticId ||
      getDuelActionEntry(card)?.towerTacticEffect ||
      getDuelActionEntry(card)?.towerTacticId ||
      actionId
    );
    const selected = cardIds.some((id) => selectedIds.has(id));
    const towerGate = getTowerTacticSelectionGate(battle, card);
    const gated = !towerGate.ok;
    const selectionCheck = selected || gated || !actionId
      ? { ok: false, reason: gated ? towerGate.reason : (selected ? "已选为本回合互动" : "行动尚未载入") }
      : canSelectDuelHandCandidate(card, actor, opponent, battle, { side: "left" });
    const available = Boolean(!selected && !gated && !pendingDiscard && !onlineLocked && view.available !== false && selectionCheck.ok);
    const reason = selected
      ? "已选为本回合互动"
      : onlineLocked
        ? "联机行动已锁定"
        : pendingDiscard
          ? "请先完成弃牌"
          : available
            ? "可用 · 点击选择互动"
            : (selectionCheck.reason || view.availabilityMessage || view.unavailableReason || "当前不可用");
    const stateClass = selected ? "is-selected" : (available ? "is-available" : "is-blocked");
    const directAnswer = intentCounterIds.has(tacticId) ? "正面应对" : (tacticId === "break_curtain_anchor" ? "夺钉机会" : "临场应对");
    const rawDescription = definition?.summary || getDuelActionEntry(card)?.description || getDuelActionEntry(card)?.summary || "";
    const description = String(rawDescription).replace(/\s*占用1个出牌位，不计入手牌上限。?\s*$/, "");
    return `<button class="duel-tower-counter ${stateClass}" data-duel-tower-counter-action="${escapeHtml(actionId)}" type="button" ${available ? "" : "disabled"}>
      <span>${escapeHtml(directAnswer)}</span>
      <strong>${escapeHtml(view.displayName || view.label || definition?.label || getTowerResponseLabel(tacticId))}</strong>
      <em>${escapeHtml(reason)}</em>
      <small>${escapeHtml(description)}</small>
    </button>`;
  }).join("")}</div>`;
}

function renderTowerPublicIntents(interaction = {}, kind = "") {
  const intents = Array.isArray(interaction.publicIntents) ? interaction.publicIntents : [];
  if (!intents.length) {
    return `<p class="duel-tower-intent-empty">对方还没有起手。先等动作出现。</p>`;
  }
  return `<div class="duel-tower-intents">${intents.map((intent, index) => {
    const owner = kind === "ogami"
      ? (index === 0 ? "尾神婆动向" : "孙的动向")
      : (kind === "toji" ? "甚尔动向" : "粟坂动向");
    const counterId = intent?.counterId || intent?.responseId || "";
    return `<article class="is-${escapeHtml(kind || "tower")}">
      <small>${escapeHtml(owner)}</small>
      <strong>${escapeHtml(getHarutaDisplayLabel(intent, "动作未判明"))}</strong>
      <span class="duel-tower-intent-detail">${escapeHtml(intent?.detail || intent?.telegraph || "本回合动作已经公开。")}</span>
      ${counterId ? `<span class="duel-tower-intent-counter">可回应：${escapeHtml(getTowerResponseLabel(counterId))}</span>` : ""}
    </article>`;
  }).join("")}</div>`;
}

function getTowerInverseSelectionPreview(battle = state.duelBattle) {
  const stage = getTowerBossInteractionStageConfig(battle) || {};
  const intensity = stage.intensity || {};
  const lightMax = Number(intensity.lightMax || 18);
  const heavyMin = Number(intensity.heavyMin || 36);
  const selected = getDuelSelectedHandActions(battle, "left");
  const values = { light: 0, medium: 0, heavy: 0 };
  selected.forEach((entry) => {
    if (isTowerTacticCard(entry)) return;
    const action = getDuelActionEntry(entry?.action || entry);
    const view = getDuelHandCardViewModel(entry?.action || entry, battle?.resourceState?.p1, battle?.resourceState?.p2, battle);
    const damage = Math.max(0, Number(getDuelCompactAttackValue(view, action) || 0));
    if (!(damage > 0)) return;
    if (damage <= lightMax) values.light += 1;
    else if (damage >= heavyMin) values.heavy += 1;
    else values.medium += 1;
  });
  const selectedTacticIds = new Set(selected.flatMap((entry) => collectTowerCardIdentityTokens(entry?.action || entry).map(normalizeTowerCardIdentity)));
  const hasToad = selectedTacticIds.has("toad_weak_pincer");
  const hasPullback = selectedTacticIds.has("last_moment_pull");
  const paired = Boolean((values.light > 0 && values.heavy > 0) || (hasToad && values.heavy > 0) || (hasPullback && values.heavy > 0));
  return { ...values, hasToad, hasPullback, paired };
}

function renderTowerBossInteractionPanel(battle = state.duelBattle) {
  const interaction = getTowerBossInteractionState(battle);
  const kind = getTowerBossInteractionKind(battle);
  if (!interaction || !kind || getDuelControlledSide(battle) !== "left") return "";
  const stage = getTowerBossInteractionStageConfig(battle) || {};
  const roundPrepared = Math.max(1, Number(interaction.roundPrepared || battle.round + 1));
  let title = "涩谷塔 · 战况";
  let subtitle = "先看对方的起手，再决定这一回合怎么接。";
  let metrics = "";
  let puzzle = "";
  let routeHint = "";

  if (kind === "ogami") {
    title = "尾神婆与其孙 · 降灵仪式";
    subtitle = "尾神婆继续咏唱，护卫同时挡在前方。扰乱只能争取时间；降灵完成后的力量不会因此被削弱。";
    const maxProgress = Math.max(1, Number(interaction.maxRitualProgress || stage?.ritual?.maxProgress || 3));
    const maxInterference = Math.max(1, Number(stage?.maxRitualInterference || 2));
    const maxInstability = Math.max(1, Number(stage?.maxGrandsonPressure || stage?.maxVesselInstability || 2));
    metrics = [
      renderTowerMetric("降灵进度", interaction.ritualProgress, maxProgress, "ritual"),
      renderTowerMetric("咏唱被扰乱", interaction.ritualInterference, maxInterference, "counter"),
      renderTowerMetric("护卫被逼退", interaction.vesselInstability, maxInstability, "vessel")
    ].join("");
    routeHint = "扰乱咏唱、逼退护卫，或先守住要害；把护卫逼到极限也不会替仪式补完。";
  } else if (kind === "toji") {
    title = "伏黑甚尔 · 零咒力追猎";
    subtitle = "没有咒力，也没有咒具。只剩一具快得不讲理的肉体——先看他的起手。";
    const maxHuntLock = Math.max(1, Number(interaction.maxHuntLock || stage.maxHuntLock || 3));
    const surviveRounds = Math.max(1, Number(stage.surviveRounds || 3));
    const phaseStartRound = Number(battle?.activityContext?.phaseStartRound || 0);
    const survived = Math.max(0, Number(
      interaction.survivedRounds ??
      interaction.phaseRoundsCompleted ??
      interaction.roundsSurvived ??
      (battle.round - phaseStartRound)
    ));
    metrics = [
      renderTowerMetric("追击压力", interaction.huntLock, maxHuntLock, "hunt"),
      renderTowerMetric("已撑过回合", Math.min(survived, surviveRounds), surviveRounds, "survival"),
      `<article class="duel-tower-metric is-zero-ce"><div><span>咒力</span><b>无</b></div><strong>徒手追猎</strong></article>`
    ].join("");
    routeHint = "正面突入就守，连续追身就换线；若他故意留下空隙，不要贸然追上去。";
  } else {
    const clueMax = Math.max(1, Number(interaction.requiredClues || stage?.deduction?.requiredClues || 2));
    const openingMax = Math.max(1, Number(interaction.requiredAnchorOpenings || stage?.curtainAnchor?.requiredOpenings || 2));
    const techniqueKnown = Boolean(interaction.techniqueRevealed || Number(interaction.deductionClues || 0) >= clueMax);
    title = techniqueKnown ? "粟坂二良 · 强弱颠倒" : "粟坂二良 · 异常承伤";
    subtitle = techniqueKnown
      ? "强击会被化轻，弱击反而被放大。把两种力道塞进同一轮，逼他漏出护住帐钉的位置。"
      : "攻击落下后的结果总与预想不符。先比较不同力道的承伤，别急着把全部力量压在一拳上。";
    metrics = [
      renderTowerMetric("术式线索", interaction.deductionClues, clueMax, "clue"),
      renderTowerMetric("夺钉机会", interaction.anchorOpenings, openingMax, "anchor")
    ].join("");
    const mix = getTowerInverseSelectionPreview(battle);
    const mixHint = techniqueKnown
      ? (mix.paired ? "轻重错拍已经形成：粟坂的判断慢了一拍。" : "力道仍然单一；混入轻击、蛤蟆牵制或临门收力。")
      : (mix.paired ? "两种力道将同时落下；这次结果足以再确认一条线索。" : "这轮力道仍然单一，只能观察一种承伤结果。");
    puzzle = `<div class="duel-tower-inverse-read ${mix.paired ? "is-paired" : ""}">
      <div><small>本回合力度组合</small><strong>轻击 ${escapeHtml(formatNumber(mix.light))} · 中击 ${escapeHtml(formatNumber(mix.medium))} · 重击 ${escapeHtml(formatNumber(mix.heavy))}</strong></div>
      <span>${escapeHtml(mixHint)}</span>
      <b>${techniqueKnown ? "术式规律已经看穿" : "还需要继续对照"}</b>
    </div>`;
    const openingReady = Number(interaction.anchorOpenings || 0) >= openingMax;
    routeHint = techniqueKnown
      ? (openingReady
        ? "粟坂已经漏出空位。现在可以夺回并破坏帐钉，也可以回身击倒他。"
        : `每让粟坂误判一次，就多一个夺回帐钉的机会；还差 ${Math.max(0, openingMax - Number(interaction.anchorOpenings || 0))} 次。`)
      : `先比较不同力道造成的实际承伤；还需要 ${Math.max(0, clueMax - Number(interaction.deductionClues || 0))} 条线索。`;
  }

  const sceneLabel = kind === "awasaka" ? "首都高速 · 动向已公开" : "涩谷塔 · 动向已公开";
  const accessibleLabel = kind === "awasaka" ? "粟坂二良战况与应对" : "涩谷塔战况与应对";
  return `
    <section class="duel-tower-interaction is-${escapeHtml(kind)}" data-tower-encounter="${escapeHtml(kind)}" aria-label="${escapeHtml(accessibleLabel)}" aria-live="polite">
      <header class="duel-tower-interaction-head">
        <div><small>${escapeHtml(sceneLabel)}</small><h5>${escapeHtml(title)}</h5><p>${escapeHtml(subtitle)}</p></div>
        <span>第${escapeHtml(formatNumber(roundPrepared))}回合 · 动向已公开</span>
      </header>
      <div class="duel-tower-metrics">${metrics}</div>
      ${renderTowerPublicIntents(interaction, kind)}
      ${puzzle}
      <div class="duel-tower-counter-section">
        <div><strong>临场应对</strong><span>独立互动区，不会混入手牌；会占用1个出牌位。</span></div>
        ${renderTowerCounterOptions(interaction, battle)}
      </div>
      <p class="duel-tower-route-hint"><b>${kind === "awasaka" ? "战况判断：" : "应对提示："}</b>${escapeHtml(routeHint)}</p>
    </section>`;
}

function getDagonResponseLabel(responseId = "") {
  const labels = {
    cover_ally: "补上防线",
    break_swarm: "截断浪头",
    hold_formation: "守住站位",
    shield_wounded: "护住负伤者",
    regroup_line: "拉回队形",
    pin_dagon: "牵住陀艮",
    guard_lifeline: "守在伏黑惠身前",
    stop_dagon: "逼停陀艮",
    share_pressure: "分担领域压力"
  };
  return labels[normalizeDagonCardIdentity(responseId)] || "临场补位";
}

function getDagonOrdinaryCategoryLabels(intent = {}) {
  const labels = {
    attack: "攻击",
    defense: "防御",
    control: "控制",
    support: "支援",
    healing: "治疗",
    movement: "移动",
    summon: "召唤"
  };
  return Array.from(new Set((Array.isArray(intent?.ordinaryCounterCategories) ? intent.ordinaryCounterCategories : [])
    .map((category) => labels[String(category || "").toLowerCase()] || "其他应对")
    .filter(Boolean)));
}

function getDagonVisibleTacticCards(battle = state.duelBattle) {
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.handState?.left?.cards || [])
  ].filter(isDagonTacticCard);
  const unique = [];
  cards.forEach((card) => {
    if (unique.some((entry) => haveMatchingDagonCardIdentity(entry, card))) return;
    unique.push(card);
  });
  return unique;
}

function getDagonTacticDefinition(battle = state.duelBattle, card = {}) {
  const stage = getDagonBossStageConfig(battle) || {};
  const definitions = Array.isArray(stage.tacticalCards) ? stage.tacticalCards : [];
  const ids = new Set(collectDagonCardIdentityTokens(card).map(normalizeDagonCardIdentity));
  return definitions.find((definition) => [definition.id, definition.effect, definition.idempotencyKey]
    .map(normalizeDagonCardIdentity)
    .some((id) => id && ids.has(id))) || null;
}

function renderDagonMetric(label, value, maximum, tone = "") {
  const current = Math.max(0, Number(value || 0));
  const max = Math.max(1, Number(maximum || 1));
  return `
    <article class="duel-dagon-metric ${tone ? `is-${escapeHtml(tone)}` : ""}">
      <div><span>${escapeHtml(label)}</span><b>${escapeHtml(formatNumber(current))} / ${escapeHtml(formatNumber(max))}</b></div>
      <i aria-label="${escapeHtml(`${label} ${formatNumber(current)} / ${formatNumber(max)}`)}"><span style="--dagon-progress:${getTowerPercent(current, max)}%"></span></i>
    </article>`;
}

function renderDagonAllyConditions(interaction = {}) {
  const allies = interaction.allyConditions && typeof interaction.allyConditions === "object"
    ? Object.values(interaction.allyConditions).filter((ally) => String(ally?.id || "") !== "megumi" || Number(interaction.stageIndex || 0) >= 2)
    : [];
  if (!allies.length) return "";
  return `<div class="duel-dagon-allies" aria-label="领域内队友状态">${allies.map((ally) => {
    const maxHp = Math.max(1, Number(ally?.maxHp || 3));
    const hp = Math.max(0, Math.min(maxHp, Number(ally?.hp ?? maxHp)));
    const marks = `${"●".repeat(hp)}${"○".repeat(Math.max(0, maxHp - hp))}`;
    const condition = hp <= 0 ? "重伤" : hp === 1 ? "危急" : hp < maxHp ? "负伤" : "尚可";
    return `<article class="${hp <= 1 ? "is-critical" : hp < maxHp ? "is-wounded" : ""}"><span>${escapeHtml(ally?.label || ally?.id || "队友")}</span><b aria-label="状态 ${escapeHtml(condition)}">${escapeHtml(marks)}</b><small>${escapeHtml(condition)}</small></article>`;
  }).join("")}</div>`;
}

function renderDagonCounterOptions(interaction, battle = state.duelBattle) {
  const cards = getDagonVisibleTacticCards(battle);
  if (!cards.length) return `<p class="duel-dagon-counter-empty">专属支援动作尚未载入；仍可按下方牌型提示使用普通手牌。</p>`;
  const { actor, opponent } = getDuelSideResources(battle, "left");
  const selectedEntries = getDuelSelectedHandActions(battle, "left");
  const selectedIds = new Set(selectedEntries.flatMap((entry) => collectDagonCardIdentityTokens(entry?.action || entry).map(normalizeDagonCardIdentity)));
  const pendingDiscard = Number(battle?.handState?.left?.pendingDiscardCount || 0) > 0;
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  return `<div class="duel-dagon-counter-grid">${cards.map((card) => {
    const view = getDuelHandCardViewModel(card, actor, opponent, battle);
    const actionId = getDuelActionEntryId(card);
    const definition = getDagonTacticDefinition(battle, card);
    const identities = collectDagonCardIdentityTokens(card).map(normalizeDagonCardIdentity);
    const tacticId = normalizeDagonCardIdentity(definition?.effect || getDuelActionEntry(card)?.dagonTacticId || actionId);
    const selected = identities.some((id) => selectedIds.has(id));
    const selectionCheck = selected || !actionId
      ? { ok: false, reason: selected ? "已选为本回合互动" : "行动尚未载入" }
      : canSelectDuelHandCandidate(card, actor, opponent, battle, { side: "left" });
    const available = Boolean(!selected && !pendingDiscard && !onlineLocked && view.available !== false && selectionCheck.ok);
    const reason = selected
      ? "已选为本回合互动"
      : onlineLocked
        ? "联机行动已锁定"
        : pendingDiscard
          ? "请先完成弃牌"
          : available
            ? "可用 · 点击选择互动"
            : (selectionCheck.reason || view.availabilityMessage || view.unavailableReason || "当前不可用");
    const rawDescription = definition?.summary || getDuelActionEntry(card)?.description || getDuelActionEntry(card)?.summary || "";
    const description = String(rawDescription).replace(/\s*占用1个出牌位，不计入手牌上限。?\s*$/, "");
    return `<button class="duel-dagon-counter ${selected ? "is-selected" : available ? "is-available" : "is-blocked"}" data-duel-dagon-counter-action="${escapeHtml(actionId)}" type="button" ${available ? "" : "disabled"}>
      <span>临场动作</span>
      <strong>${escapeHtml(view.displayName || view.label || definition?.label || getDagonResponseLabel(tacticId))}</strong>
      <em>${escapeHtml(reason)}</em>
      <small>${escapeHtml(description)}</small>
    </button>`;
  }).join("")}</div>`;
}

function renderDagonBossInteractionPanel(battle = state.duelBattle) {
  const interaction = getDagonBossInteractionState(battle);
  const mechanic = getDagonBossMechanicConfig(battle);
  const stage = getDagonBossStageConfig(battle);
  if (!interaction || !mechanic || !stage || getDuelControlledSide(battle) !== "left") return "";
  const stageIndex = Math.max(0, Number(stage.rotationIndex || battle?.activityContext?.rotationIndex || 0));
  const stageRound = Math.max(1, Number(battle?.activityContext?.roundOffset || 0) + Number(battle?.round || 0) + 1);
  const requiredRounds = Math.max(1, Number(stage.rounds || 3));
  const pressure = Math.max(0, Number(interaction.domainPressure || 0));
  const maxPressure = Math.max(1, Number(interaction.maxDomainPressure || mechanic.initialState?.maxDomainPressure || 5));
  const lifeline = Math.max(0, Number(interaction.lifelineProgress || 0));
  const maxLifeline = Math.max(1, Number(interaction.maxLifelineProgress || mechanic.initialState?.maxLifelineProgress || 5));
  const intent = interaction.publicIntents?.[0] || null;
  const ordinaryLabels = getDagonOrdinaryCategoryLabels(intent);
  const targetLabels = { nanami: "七海建人", maki: "禅院真希", naobito: "禅院直毘人", megumi: "伏黑惠", lowest: "伤势最重者", formation: "整条防线", player: "你", lifeline: "众人的活路" };
  const canonAnchor = stageIndex === 0
    ? "直毘人已先行发动术式；七海、真希与直毘人一同陷入领域危机。"
    : stageIndex === 1
      ? "伏黑惠还没有赶到。眼下只能靠领域内的人继续守住彼此。"
      : "伏黑惠刚刚介入并带来活路；伏黑甚尔尚未闯入，领域里的厮杀仍未结束。";
  const goal = stageIndex >= 2
    ? "别让刚出现的活路立刻被海域吞没。"
    : "守住队形与伤者，别让海域压力把三人逐个拆开。";
  return `
    <section class="duel-dagon-interaction is-stage-${stageIndex}" data-dagon-stage="${escapeHtml(String(stageIndex))}" aria-label="陀艮领域战况与应对" aria-live="polite">
      <div class="duel-dagon-sea" aria-hidden="true"><i></i><i></i><span class="duel-dagon-lifeline"></span></div>
      <header class="duel-dagon-interaction-head">
        <div><small>${escapeHtml(stage.sceneLabel || "涩谷站连接通路 · 领域内")}</small><h5>${escapeHtml(stage.displayName || "荡蕴平线")}</h5><p>${escapeHtml(stage.publicRule || "先看陀艮动向，再决定从哪里补位。")}</p></div>
        <span>本段 ${escapeHtml(formatNumber(Math.min(stageRound, requiredRounds)))} / ${escapeHtml(formatNumber(requiredRounds))}</span>
      </header>
      <div class="duel-dagon-metrics">
        ${renderDagonMetric("海域压力", pressure, maxPressure, "pressure")}
        ${stageIndex >= 2
          ? renderDagonMetric("活路进度", lifeline, maxLifeline, "lifeline")
          : `<article class="duel-dagon-metric is-locked"><div><span>伏黑惠介入</span><b>尚未发生</b></div><strong>先守住当前防线</strong></article>`}
      </div>
      ${intent ? `<article class="duel-dagon-intent">
        <small>陀艮本回合动向 · 目标：${escapeHtml(targetLabels[intent.targetId] || "战场一侧")}</small>
        <strong>${escapeHtml(intent.label || "动作未判明")}</strong>
        <p>${escapeHtml(intent.detail || "式神群正在改变方向。")}</p>
        <span>观察目标与水势，再判断这一轮该从哪里补位。</span>
        ${ordinaryLabels.length ? "<em>普通手札也可能奏效；根据目标与水势自行判断。</em>" : ""}
      </article>` : `<p class="duel-dagon-intent-empty">水面还没有变化。稍等陀艮露出下一步。</p>`}
      ${renderDagonAllyConditions(interaction)}
      <div class="duel-dagon-counter-section">
        <div><strong>BOSS互动区 · 从哪里补位</strong><span>不会混入手牌；会占用1个出牌位。</span></div>
        ${renderDagonCounterOptions(interaction, battle)}
      </div>
      <p class="duel-dagon-goal"><b>当前目标：</b>${escapeHtml(goal)}</p>
      <p class="duel-dagon-canon"><b>此刻战况：</b>${escapeHtml(canonAnchor)}</p>
    </section>`;
}

function renderChosoMetric(label, value, maximum, tone = "") {
  const current = Math.max(0, Number(value || 0));
  const max = Math.max(1, Number(maximum || 1));
  return `
    <article class="duel-choso-metric ${tone ? `is-${escapeHtml(tone)}` : ""}">
      <div><span>${escapeHtml(label)}</span><b>${escapeHtml(formatNumber(current))} / ${escapeHtml(formatNumber(max))}</b></div>
      <i aria-label="${escapeHtml(`${label} ${formatNumber(current)} / ${formatNumber(max)}`)}"><span style="--choso-progress:${getTowerPercent(current, max)}%"></span></i>
    </article>`;
}

function renderChosoStageRoute(mechanic = {}, activeStage = {}) {
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  const activeIndex = Math.max(0, stages.findIndex((stage) => String(stage?.id || "") === String(activeStage?.id || "")));
  const shortLabels = {
    station_corridor: "走廊",
    water_plan: "引水",
    bathroom_melee: "近身"
  };
  return `<ol class="duel-choso-stage-route" aria-label="站内战斗阶段">${stages.map((stage, index) => {
    const stateClass = index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "is-upcoming";
    return `<li class="${stateClass}"${index === activeIndex ? ' aria-current="step"' : ""}><i></i><span>${escapeHtml(shortLabels[stage?.id] || stage?.displayName || `阶段${index + 1}`)}</span></li>`;
  }).join("")}</ol>`;
}

function renderChosoCounterOptions(interaction, battle = state.duelBattle) {
  const cards = getChosoVisibleTacticCards(battle);
  if (!cards.length) return `<p class="duel-choso-counter-empty">临场动作尚未进入手牌；仍可依照动向，用符合类型的普通牌回应。</p>`;
  const { actor, opponent } = getDuelSideResources(battle, "left");
  const selectedEntries = getDuelSelectedHandActions(battle, "left");
  const selectedIds = new Set(selectedEntries.flatMap((entry) => collectChosoCardIdentityTokens(entry?.action || entry).map(normalizeChosoCardIdentity)));
  const pendingDiscard = Number(battle?.handState?.left?.pendingDiscardCount || 0) > 0;
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  return `<div class="duel-choso-counter-grid">${cards.map((card) => {
    const view = getDuelHandCardViewModel(card, actor, opponent, battle);
    const actionId = getDuelActionEntryId(card);
    const definition = getChosoTacticDefinition(battle, card);
    const identities = collectChosoCardIdentityTokens(card).map(normalizeChosoCardIdentity);
    const selected = identities.some((id) => selectedIds.has(id));
    const selectionCheck = selected || !actionId
      ? { ok: false, reason: selected ? "已选为本回合互动" : "行动尚未载入" }
      : canSelectDuelHandCandidate(card, actor, opponent, battle, { side: "left" });
    const available = Boolean(!selected && !pendingDiscard && !onlineLocked && view.available !== false && selectionCheck.ok);
    const reason = selected
      ? "已选为本回合互动"
      : onlineLocked
        ? "联机行动已锁定"
        : pendingDiscard
          ? "请先完成弃牌"
          : available
            ? "可用 · 点击选择互动"
            : (selectionCheck.reason || view.availabilityMessage || view.unavailableReason || "当前不可用");
    const rawDescription = definition?.summary || getDuelActionEntry(card)?.description || getDuelActionEntry(card)?.summary || "";
    const description = String(rawDescription).replace(/\s*占用1个出牌位，不计入手牌上限。?\s*$/, "");
    return `<button class="duel-choso-counter ${selected ? "is-selected" : available ? "is-available" : "is-blocked"}" data-duel-choso-counter-action="${escapeHtml(actionId)}" type="button" aria-pressed="${selected ? "true" : "false"}" ${available ? "" : "disabled"}>
      <span>临场应对</span>
      <strong>${escapeHtml(view.displayName || view.label || definition?.label || "观察后应对")}</strong>
      <small>${escapeHtml(description)}</small>
      <em>${escapeHtml(reason)}</em>
    </button>`;
  }).join("")}</div>`;
}

function renderChosoBossInteractionPanel(battle = state.duelBattle) {
  const interaction = getChosoBossInteractionState(battle);
  const mechanic = getChosoBossMechanicConfig(battle);
  const stage = getChosoBossStageConfig(battle, interaction);
  if (!interaction || !mechanic || !stage || getDuelControlledSide(battle) !== "left") return "";
  const stageId = String(stage.id || interaction.stageId || "station_corridor");
  const intent = Array.isArray(interaction.publicIntents) ? interaction.publicIntents[0] : null;
  const ordinaryLabels = getDagonOrdinaryCategoryLabels(intent);
  const roundPrepared = Math.max(1, Number(interaction.roundPrepared || battle.round + 1));
  const totalRounds = Math.max(1, Number(battle?.activityContext?.bossMechanic?.stages?.at?.(-1)?.roundEnd || 6));
  const bloodPressure = Math.max(0, Number(interaction.bloodPressure || 0));
  const maxBloodPressure = Math.max(1, Number(interaction.maxBloodPressure || mechanic.initialState?.maxBloodPressure || 5));
  const progressByStage = {
    station_corridor: ["逼近距离", interaction.approachProgress, interaction.maxApproachProgress || mechanic.initialState?.maxApproachProgress || 2, "approach"],
    water_plan: ["引水进度", interaction.waterPlanProgress, interaction.maxWaterPlanProgress || mechanic.initialState?.maxWaterPlanProgress || 2, "water"],
    bathroom_melee: ["有效反击", interaction.counterattackProgress, interaction.maxCounterattackProgress || mechanic.initialState?.maxCounterattackProgress || 2, "counter"]
  };
  const [progressLabel, progressValue, progressMaximum, progressTone] = progressByStage[stageId] || progressByStage.station_corridor;
  const stageNotes = {
    station_corridor: "脹相为壊相与血涂而来。狭长走廊让穿血的正面压迫更危险。",
    water_plan: "机械丸只指出方向。水会扰乱体外血液的运用，但不会封住整套赤血操术。",
    bathroom_melee: "水势改变了距离，脹相随即转入体内强化与近身攻防。"
  };
  const requiredResponses = Math.max(1, Number(mechanic?.clear?.minimumSuccessfulResponses || 3));
  const successfulResponses = Math.max(0, Number(interaction.successfulResponses || interaction.totalSuccessfulResponses || 0));
  return `
    <section class="duel-choso-interaction is-${escapeHtml(stageId)}" data-choso-stage="${escapeHtml(stageId)}" aria-label="脹相站内战况与临场应对" aria-live="polite" aria-atomic="true">
      <div class="duel-choso-blood-trace" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="duel-choso-interaction-head">
        <div><small>${escapeHtml(stage.sceneLabel || "涩谷站构内")}</small><h5>${escapeHtml(stage.displayName || "脹相 · 赤血操术")}</h5><p>${escapeHtml(stage.publicRule || "先看清脹相的起手，再决定这一轮如何接近。")}</p></div>
        <span>第${escapeHtml(formatNumber(Math.min(roundPrepared, totalRounds)))} / ${escapeHtml(formatNumber(totalRounds))}回合</span>
      </header>
      ${renderChosoStageRoute(mechanic, stage)}
      <div class="duel-choso-metrics">
        ${renderChosoMetric("血势压迫", bloodPressure, maxBloodPressure, "pressure")}
        ${renderChosoMetric(progressLabel, progressValue, progressMaximum, progressTone)}
        ${renderChosoMetric("有效回应", successfulResponses, requiredResponses, "response")}
      </div>
      ${intent ? `<article class="duel-choso-intent">
        <small>脹相本回合动向</small>
        <strong>${escapeHtml(intent.label || "起手未判明")}</strong>
        <p>${escapeHtml(intent.detail || "血液正在改变形态。先看清方向。")}</p>
        ${ordinaryLabels.length ? "<em>普通手札也可能奏效；根据现场征兆自行判断。</em>" : ""}
      </article>` : `<p class="duel-choso-intent-empty">脹相还没有显露下一步。稍等这一回合的动向出现。</p>`}
      <div class="duel-choso-counter-section">
        <div><strong>这一轮怎么接</strong><span>临场动作不消耗咒力，但会占用1个出牌位。</span></div>
        ${renderChosoCounterOptions(interaction, battle)}
      </div>
      <p class="duel-choso-stage-note"><b>此刻战况：</b>${escapeHtml(stageNotes[stageId] || stageNotes.station_corridor)}</p>
      <p class="duel-choso-goal"><b>当前目标：</b>完成三段战线，并在血势压迫满前抵达终点；每段至少完成1次有效回应。</p>
    </section>`;
}

function renderMegumiTojiStageRoute(mechanic = {}, activeStage = {}) {
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  const activeIndex = Math.max(0, stages.findIndex((stage) => String(stage?.id || "") === String(activeStage?.id || "")));
  const shortLabels = {
    blind_pursuit: "切线",
    break_the_lock: "断线",
    read_the_landing: "落点"
  };
  return `<ol class="duel-choso-stage-route" aria-label="追猎阶段">${stages.map((stage, index) => {
    const stateClass = index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "is-upcoming";
    return `<li class="${stateClass}"${index === activeIndex ? ' aria-current="step"' : ""}><i></i><span>${escapeHtml(shortLabels[stage?.id] || stage?.displayName || `阶段${index + 1}`)}</span></li>`;
  }).join("")}</ol>`;
}

function renderMegumiTojiCounterOptions(interaction, battle = state.duelBattle) {
  const cards = getMegumiTojiVisibleTacticCards(battle);
  if (!cards.length) return `<p class="duel-choso-counter-empty">临场动作尚未进入手牌；仍可依照身体动向，用符合类型的普通牌回应。</p>`;
  const { actor, opponent } = getDuelSideResources(battle, "left");
  const selectedEntries = getDuelSelectedHandActions(battle, "left");
  const selectedIds = new Set(selectedEntries.flatMap((entry) => collectMegumiTojiCardIdentityTokens(entry?.action || entry).map(normalizeMegumiTojiCardIdentity)));
  const pendingDiscard = Number(battle?.handState?.left?.pendingDiscardCount || 0) > 0;
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  return `<div class="duel-choso-counter-grid">${cards.map((card) => {
    const view = getDuelHandCardViewModel(card, actor, opponent, battle);
    const actionId = getDuelActionEntryId(card);
    const definition = getMegumiTojiTacticDefinition(battle, card);
    const identities = collectMegumiTojiCardIdentityTokens(card).map(normalizeMegumiTojiCardIdentity);
    const selected = identities.some((id) => selectedIds.has(id));
    const selectionCheck = selected || !actionId
      ? { ok: false, reason: selected ? "已选为本回合互动" : "行动尚未载入" }
      : canSelectDuelHandCandidate(card, actor, opponent, battle, { side: "left" });
    const available = Boolean(!selected && !pendingDiscard && !onlineLocked && view.available !== false && selectionCheck.ok);
    const reason = selected
      ? "已选为本回合互动"
      : onlineLocked
        ? "联机行动已锁定"
        : pendingDiscard
          ? "请先完成弃牌"
          : available
            ? "可用 · 点击选择互动"
            : (selectionCheck.reason || view.availabilityMessage || view.unavailableReason || "当前不可用");
    const rawDescription = definition?.summary || getDuelActionEntry(card)?.description || getDuelActionEntry(card)?.summary || "";
    const description = String(rawDescription).replace(/\s*占用1个出牌位，不计入手牌上限。?\s*$/, "");
    return `<button class="duel-choso-counter ${selected ? "is-selected" : available ? "is-available" : "is-blocked"}" data-duel-megumi-toji-counter-action="${escapeHtml(actionId)}" type="button" aria-pressed="${selected ? "true" : "false"}" ${available ? "" : "disabled"}>
      <span>临场判断</span>
      <strong>${escapeHtml(view.displayName || view.label || definition?.label || "观察后应对")}</strong>
      <small>${escapeHtml(description)}</small>
      <em>${escapeHtml(reason)}</em>
    </button>`;
  }).join("")}</div>`;
}

function renderMegumiTojiBossInteractionPanel(battle = state.duelBattle) {
  const interaction = getMegumiTojiBossInteractionState(battle);
  const mechanic = getMegumiTojiBossMechanicConfig(battle);
  const stage = getMegumiTojiBossStageConfig(battle, interaction);
  if (!interaction || !mechanic || !stage || getDuelControlledSide(battle) !== "left") return "";
  const stageId = String(stage.id || interaction.stageId || "blind_pursuit");
  const intent = Array.isArray(interaction.publicIntents) ? interaction.publicIntents[0] : null;
  const ordinaryLabels = getDagonOrdinaryCategoryLabels(intent);
  const roundPrepared = Math.max(1, Number(interaction.roundPrepared || battle.round + 1));
  const totalRounds = Math.max(1, Number(battle?.activityContext?.bossMechanic?.stages?.at?.(-1)?.roundEnd || 5));
  const huntPressure = Math.max(0, Number(interaction.huntPressure || 0));
  const maxHuntPressure = Math.max(1, Number(interaction.maxHuntPressure || mechanic.initialState?.maxHuntPressure || 5));
  const progressByStage = {
    blind_pursuit: ["切出直线", interaction.breakLineProgress, interaction.maxBreakLineProgress || mechanic.initialState?.maxBreakLineProgress || 2, "approach"],
    break_the_lock: ["断线次数", interaction.routeReadProgress, interaction.maxRouteReadProgress || mechanic.initialState?.maxRouteReadProgress || 2, "water"],
    read_the_landing: ["落点判断", interaction.landingReadProgress, interaction.maxLandingReadProgress || mechanic.initialState?.maxLandingReadProgress || 1, "counter"]
  };
  const [progressLabel, progressValue, progressMaximum, progressTone] = progressByStage[stageId] || progressByStage.blind_pursuit;
  const stageNotes = {
    blind_pursuit: "眼前的人没有咒力。等术式预兆只会慢一步；地面、风压和肩线才是提示。",
    break_the_lock: "脱兔与窄路只能让追猎短暂断线，不能困住或击败对方。",
    read_the_landing: "最后一轮没有无伤答案。判断只决定伏黑以怎样的重伤活下来。"
  };
  const requiredResponses = Math.max(1, Number(mechanic?.clear?.minimumSuccessfulResponses || 3));
  const successfulResponses = Math.max(0, Number(interaction.successfulResponses || 0));
  return `
    <section class="duel-choso-interaction duel-megumi-toji-interaction is-${escapeHtml(stageId)}" data-megumi-toji-stage="${escapeHtml(stageId)}" aria-label="伏黑惠遭遇不明追猎者" aria-live="polite" aria-atomic="true">
      <div class="duel-toji-speed-lines" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="duel-choso-interaction-head">
        <div><small>${escapeHtml(stage.sceneLabel || "涩谷街区")}</small><h5>${escapeHtml(stage.displayName || "不明身份的追猎者")}</h5><p>${escapeHtml(stage.publicRule || "不要等咒力预兆，只看身体动向。")}</p></div>
        <span>第${escapeHtml(formatNumber(Math.min(roundPrepared, totalRounds)))} / ${escapeHtml(formatNumber(totalRounds))}回合</span>
      </header>
      ${renderMegumiTojiStageRoute(mechanic, stage)}
      <div class="duel-choso-metrics">
        ${renderChosoMetric("追猎压力", huntPressure, maxHuntPressure, "pressure")}
        ${renderChosoMetric(progressLabel, progressValue, progressMaximum, progressTone)}
        ${renderChosoMetric("有效判断", successfulResponses, requiredResponses, "response")}
      </div>
      ${intent ? `<article class="duel-choso-intent duel-toji-intent">
        <small>本回合可见动向</small>
        <strong>${escapeHtml(intent.label || "动作未判明")}</strong>
        <p>${escapeHtml(intent.detail || "没有咒力的预兆。先看地面和身体。")}</p>
        ${ordinaryLabels.length ? "<em>普通手札也可能奏效；根据现场征兆自行判断。</em>" : ""}
      </article>` : `<p class="duel-choso-intent-empty">没有咒力可供感知。稍等身体动向出现。</p>`}
      <div class="duel-choso-counter-section">
        <div><strong>这一轮怎么活</strong><span>临场判断不消耗咒力，但会占用1个出牌位。</span></div>
        ${renderMegumiTojiCounterOptions(interaction, battle)}
      </div>
      <p class="duel-choso-stage-note"><b>此刻战况：</b>${escapeHtml(stageNotes[stageId] || stageNotes.blind_pursuit)}</p>
      <p class="duel-choso-goal"><b>当前目标：</b>撑过5轮，直到追猎者问名并停手；攻击仅用于争取距离，不判定为击杀。</p>
    </section>`;
}

function renderMahitoStageRoute(mechanic = {}, activeStage = {}) {
  const stages = Array.isArray(mechanic?.stages) ? mechanic.stages : [];
  const activeIndex = Math.max(0, stages.findIndex((stage) => String(stage?.id || "") === String(activeStage?.id || "")));
  const shortLabels = {
    clear_the_corridor: "清路",
    mahito_closes_in: "逼近",
    last_trust: "托付",
    among_civilians: "人群",
    two_fronts_converge: "汇合",
    final_curse_fight: "终局"
  };
  return `<ol class="duel-choso-stage-route duel-mahito-stage-route" aria-label="真人战阶段">${stages.map((stage, index) => {
    const stateClass = index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "is-upcoming";
    return `<li class="${stateClass}"${index === activeIndex ? ' aria-current="step"' : ""}><i></i><span>${escapeHtml(shortLabels[stage?.id] || stage?.displayName || `阶段${index + 1}`)}</span></li>`;
  }).join("")}</ol>`;
}

function renderMahitoCounterOptions(interaction, battle = state.duelBattle) {
  const cards = getMahitoVisibleTacticCards(battle);
  if (!cards.length) return `<p class="duel-choso-counter-empty">临场回应尚未进入手牌。仍可按公开动向，用符合提示类型的普通牌应对。</p>`;
  const { actor, opponent } = getDuelSideResources(battle, "left");
  const selectedEntries = getDuelSelectedHandActions(battle, "left");
  const selectedIds = new Set(selectedEntries.flatMap((entry) =>
    collectMahitoSceneCardIdentityTokens(entry?.action || entry).map(normalizeMahitoSceneCardIdentity)
  ));
  const pendingDiscard = Number(battle?.handState?.left?.pendingDiscardCount || 0) > 0;
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  return `<div class="duel-choso-counter-grid duel-mahito-counter-grid">${cards.map((card) => {
    const view = getDuelHandCardViewModel(card, actor, opponent, battle);
    const actionId = getDuelActionEntryId(card);
    const definition = getMahitoTacticDefinition(battle, card);
    const identities = collectMahitoSceneCardIdentityTokens(card).map(normalizeMahitoSceneCardIdentity);
    const selected = identities.some((id) => selectedIds.has(id));
    const selectionCheck = selected || !actionId
      ? { ok: false, reason: selected ? "已选为本回合互动" : "行动尚未载入" }
      : canSelectDuelHandCandidate(card, actor, opponent, battle, { side: "left" });
    const available = Boolean(!selected && !pendingDiscard && !onlineLocked && view.available !== false && selectionCheck.ok);
    const reason = selected
      ? "已选为本回合互动"
      : onlineLocked
        ? "联机行动已锁定"
        : pendingDiscard
          ? "请先完成弃牌"
          : available
            ? "可用 · 点击选择互动"
            : (selectionCheck.reason || view.availabilityMessage || view.unavailableReason || "当前不可用");
    const rawDescription = definition?.summary || getDuelActionEntry(card)?.description || getDuelActionEntry(card)?.summary || "";
    const description = String(rawDescription).replace(/\s*占用1个出牌位，不计入手牌上限。?\s*$/, "");
    return `<button class="duel-choso-counter duel-mahito-counter ${selected ? "is-selected" : available ? "is-available" : "is-blocked"}" data-duel-mahito-counter-action="${escapeHtml(actionId)}" type="button" aria-pressed="${selected ? "true" : "false"}" ${available ? "" : "disabled"}>
      <span>临场回应</span>
      <strong>${escapeHtml(view.displayName || view.label || definition?.label || "看清后应对")}</strong>
      <small>${escapeHtml(description)}</small>
      <em>${escapeHtml(reason)}</em>
    </button>`;
  }).join("")}</div>`;
}

function renderMahitoBossInteractionPanel(battle = state.duelBattle) {
  const interaction = getMahitoBossInteractionState(battle);
  const mechanic = getMahitoBossMechanicConfig(battle);
  const stage = getMahitoBossStageConfig(battle, interaction);
  if (!interaction || !mechanic || !stage || getDuelControlledSide(battle) !== "left") return "";
  const mode = String(mechanic.mode || "");
  const isNanami = mode === "nanami_last_stand";
  const stageId = String(stage.id || interaction.stageId || (isNanami ? "clear_the_corridor" : "among_civilians"));
  const intent = Array.isArray(interaction.publicIntents) ? interaction.publicIntents[0] : null;
  const ordinaryLabels = getDagonOrdinaryCategoryLabels(intent);
  const roundPrepared = Math.max(1,
    Number(battle?.activityContext?.roundOffset || 0) + Number(battle?.round || 0) + 1
  );
  const requiredRounds = isNanami ? 5 : 6;
  const completedRounds = Math.max(0, Number(interaction.totalRounds || 0));
  const pressure = Math.max(0, Number(interaction.pressure || 0));
  const maxPressure = Math.max(1, Number(interaction.maxPressure || mechanic.initialState?.maxPressure || 5));
  const damagePercent = Math.max(0, Math.round(Number(interaction.damageRatio || 0) * 100));
  const openingProgress = Math.max(0, Number(interaction.openingProgress || 0));
  const maxOpeningProgress = Math.max(1, Number(interaction.maxOpeningProgress || mechanic.initialState?.maxOpeningProgress || 3));
  const fateHandoffUsed = Boolean(battle?.activityContext?.fateHandoffUsed);
  const canonCast = isNanami
    ? [
        ["七海", "伤痕累累，仍在走廊中前进"],
        ["虎杖", "正从走廊另一端赶来"],
        ["真人", "借改造人与遮挡逼近"]
      ]
    : [
        ["钉崎", "在另一处迎战真人分身"],
        ["东堂、新田新", "正在向战场靠近"],
        ["虎杖", "守住最后一击的位置"],
        ["真人", "两条战线正在向本体合拢"]
      ];
  const stageNotes = isNanami
    ? {
        clear_the_corridor: "改造人的脚步声堵在走廊尽头。七海仍在挥刀，而真人正借着人群逼近。",
        mahito_closes_in: "影子在遮挡间忽近忽远。七海必须认出真人真正的来路，才能让脚步再向前一次。",
        last_trust: "奔来的脚步已经近了。七海要做的，只是再把这条走廊守住一瞬。"
      }
    : {
        among_civilians: "真人利用一般人压缩虎杖的行动空间；先分清本体的路线，再决定追击。",
        two_fronts_converge: "另一条战线仍在继续。掌声尚未响起，虎杖必须先稳住脚步。",
        final_curse_fight: "拍手声一响，位置便不再可信。别追真人的影子，等东堂撕开真正的空隙。"
      };
  const goal = isNanami
    ? fateHandoffUsed
      ? "自选角色已接战：仅累计削减真人50%体势可达标；回合数不再计入七海的坚持条件。"
      : "七海存活并完成5个有效回合，或累计削减真人50%体势；达标后进入最后的托付。"
    : "完成6个有效回合；东堂制造空隙后，由虎杖完成最后一击。";
  return `
    <section class="duel-choso-interaction duel-mahito-interaction ${isNanami ? "is-nanami-last-stand" : "is-yuji-finale"} is-${escapeHtml(stageId)}" data-mahito-stage="${escapeHtml(stageId)}" aria-label="${isNanami ? "七海最后托付战" : "虎杖与东堂迎战真人"}" aria-live="polite" aria-atomic="true">
      <div class="duel-mahito-soul-lines" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="duel-choso-interaction-head">
        <div><small>${escapeHtml(stage.sceneLabel || "涩谷站构内")}</small><h5>${escapeHtml(stage.displayName || "真人正在逼近")}</h5><p>${escapeHtml(stage.publicRule || "每回合只公开一条动向。看清以后再出牌。")}</p></div>
        <span>第${escapeHtml(formatNumber(Math.min(roundPrepared, requiredRounds)))} / ${escapeHtml(formatNumber(requiredRounds))}回合</span>
      </header>
      ${renderMahitoStageRoute(mechanic, stage)}
      <div class="duel-mahito-canon-cast" aria-label="原著人物节点">
        <small>这一刻，他们各自的位置</small>
        <div>${canonCast.map(([name, role]) => `<span><b>${escapeHtml(name)}</b>${escapeHtml(role)}</span>`).join("")}</div>
      </div>
      <div class="duel-choso-metrics">
        ${renderChosoMetric(isNanami ? "接触压力" : "战线压力", pressure, maxPressure, "pressure")}
        ${renderChosoMetric("有效回合", completedRounds, requiredRounds, "approach")}
        ${isNanami
          ? renderChosoMetric("累计伤害", Math.min(damagePercent, 50), 50, "response")
          : renderChosoMetric("有效判断", openingProgress, maxOpeningProgress, "response")}
      </div>
      ${intent ? `<article class="duel-choso-intent duel-mahito-intent">
        <small>本回合可见动向</small>
        <strong>${escapeHtml(intent.label || "真人的动作尚未判明")}</strong>
        <p>${escapeHtml(intent.detail || "先确认接近路线，再选择回应。")}</p>
        ${ordinaryLabels.length ? "<em>普通手札也可能奏效；根据现场征兆自行判断。</em>" : ""}
      </article>` : `<p class="duel-choso-intent-empty">真人的动向尚未出现。稍等本回合手牌完成载入。</p>`}
      <div class="duel-choso-counter-section">
        <div><strong>这一轮怎么回应</strong><span>临场回应不消耗咒力，但会占用1个出牌位。</span></div>
        ${renderMahitoCounterOptions(interaction, battle)}
      </div>
      <p class="duel-choso-stage-note"><b>此刻战况：</b>${escapeHtml(stageNotes[stageId] || "守住当前战线，等待下一次动向。")}</p>
      <p class="duel-choso-goal"><b>当前目标：</b>${escapeHtml(goal)}</p>
    </section>`;
}

function renderJogoFlashoverBossInteractionPanel(mechanic = {}, interaction = {}) {
  const fixedStates = Array.isArray(mechanic?.fixedOutcome?.actorStates) ? mechanic.fixedOutcome.actorStates : [];
  const stateLabels = { nanami: "七海：重伤，后续仍会前进", maki: "真希：严重烧伤，退出当前战线", naobito: "直毘人：重伤，退出当前战线" };
  const reactions = Array.isArray(mechanic?.reactions) ? mechanic.reactions : [];
  return `<section class="duel-jogo-flashover-interaction" aria-label="漏瑚瞬袭事件" aria-live="polite">
    <header><small>时刻不明 · 涩谷站连接通道</small><h5>火焰落下时，交战已经结束</h5><p>领域崩塌后的喘息尚未落定，灼热已经越过通道。你能做的，只从余焰之后开始。</p></header>
    <div class="duel-jogo-flashover-canon">${fixedStates.map((entry) => `<span>${escapeHtml(stateLabels[entry.actorId] || "一名伤者")}</span>`).join("")}</div>
    <div class="duel-jogo-flashover-actions">${reactions.map((reaction) => `<article data-duel-jogo-flashover-action="${escapeHtml(reaction.id || "afterheat")}"><strong>${escapeHtml(reaction.label || "处理余焰")}</strong><p>${escapeHtml(reaction.summary || "只影响后续交接。")}</p></article>`).join("")}</div>
    <p class="duel-jogo-flashover-lock"><b>事件规则：</b>无Boss血条、出牌回合或战前强化；无战斗治疗与战利品。</p>
  </section>`;
}

function getSukunaJogoBossMechanicConfig(battle = state.duelBattle) {
  const direct = battle?.activityContext?.bossMechanic;
  return direct?.schema === "jjk.shibuya.sukuna-jogo-boss.v1" ? direct : null;
}

function getSukunaJogoBossInteractionState(battle = state.duelBattle) {
  const direct = battle?.activityContext?.sukunaJogoInteraction;
  if (direct && typeof direct === "object") return direct;
  const resolved = globalThis.JJKShibuyaIncident?.getSukunaJogoBossInteractionState?.(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function renderSukunaJogoBossInteractionPanel(battle = state.duelBattle) {
  const mechanic = getSukunaJogoBossMechanicConfig(battle);
  const interaction = getSukunaJogoBossInteractionState(battle);
  if (!mechanic || !interaction || getDuelControlledSide(battle) !== "left") return "";
  const stages = Array.isArray(mechanic.stages) ? mechanic.stages : [];
  const stageId = String(interaction.stageId || stages[0]?.id || "shibuya_pursuit");
  const activeIndex = Math.max(0, stages.findIndex((entry) => String(entry?.id || "") === stageId));
  const stage = stages[activeIndex] || stages[0] || {};
  const round = Math.min(5, Math.max(1, Number(interaction.totalRounds || 0) + 1));
  const labels = { shibuya_pursuit: "逼近", maximum_meteor: "陨", final_fire: "终火" };
  const notes = {
    shibuya_pursuit: "熔岩沿街面追去，宿傩始终只在一步之外。用现有火焰手牌，把那一步逼到极限。",
    maximum_meteor: "天空被火光压低。第3回合后「陨」进入手牌；先积蓄火势，再决定何时压下。",
    final_fire: "火势已经燃到尽头。把最后一次攻势烧完，迎向这场挑战的终局。"
  };
  return `<section class="duel-choso-interaction duel-sukuna-jogo-interaction is-${escapeHtml(stageId)}" data-sukuna-jogo-stage="${escapeHtml(stageId)}" aria-label="宿傩与漏瑚的火焰挑战" aria-live="polite" aria-atomic="true">
    <div class="duel-sukuna-jogo-heat" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="duel-choso-interaction-head"><div><small>${escapeHtml(stage.sceneLabel || "涩谷各处")}</small><h5>${escapeHtml(stage.displayName || "追逐一次命中")}</h5><p>${escapeHtml(stage.publicRule || "火势越过街区，宿傩始终只在一步之外。")}</p></div><span>第${escapeHtml(formatNumber(round))} / 5回合</span></header>
    <ol class="duel-choso-stage-route" aria-label="漏瑚攻势阶段">${stages.map((entry, index) => `<li class="${index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "is-upcoming"}"${index === activeIndex ? ' aria-current="step"' : ""} data-duel-sukuna-jogo-action="${escapeHtml(entry?.id || `stage-${index + 1}`)}"><i></i><span>${escapeHtml(labels[entry?.id] || entry?.displayName || `阶段${index + 1}`)}</span></li>`).join("")}</ol>
    <div class="duel-choso-metrics">
      ${renderChosoMetric("逼近一击", interaction.approachProgress, interaction.maxApproachProgress || 4, "approach")}
      ${renderChosoMetric("火势", interaction.flameMomentum, interaction.maxFlameMomentum || 6, "pressure")}
      ${renderChosoMetric("攻势评价", interaction.sukunaInterest, interaction.maxSukunaInterest || 5, "response")}
    </div>
    <article class="duel-sukuna-jogo-canon-lock"><small>既定结果</small><strong>实际命中 0 · 宿傩体势不下降</strong><p>极之番：${interaction.maximumMeteorReleased ? "已释放，未命中" : "尚未释放"}；5回合后由宿傩获胜。</p></article>
    <p class="duel-choso-stage-note"><b>这一轮怎么打：</b>${escapeHtml(notes[stageId] || notes.shibuya_pursuit)}</p>
    <p class="duel-choso-goal"><b>当前操作：</b>使用漏瑚现有手牌；选牌、火焰热度与资源管理决定攻势评价。</p>
  </section>`;
}

function getSukunaMahoragaBossMechanicConfig(battle = state.duelBattle) {
  const direct = battle?.activityContext?.bossMechanic;
  return direct?.schema === "jjk.shibuya.sukuna-mahoraga-boss.v1" ? direct : null;
}

function getSukunaMahoragaBossInteractionState(battle = state.duelBattle) {
  const direct = battle?.activityContext?.sukunaMahoragaInteraction;
  if (direct && typeof direct === "object") return direct;
  const resolved = globalThis.JJKShibuyaIncident?.getSukunaMahoragaBossInteractionState?.(battle);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function renderSukunaMahoragaBossInteractionPanel(battle = state.duelBattle) {
  const mechanic = getSukunaMahoragaBossMechanicConfig(battle);
  const interaction = getSukunaMahoragaBossInteractionState(battle);
  if (!mechanic || !interaction || getDuelControlledSide(battle) !== "left") return "";
  const stages = Array.isArray(mechanic.stages) ? mechanic.stages : [];
  const stageId = String(interaction.stageId || stages[0]?.id || "read_adaptation");
  const activeIndex = Math.max(0, stages.findIndex((entry) => String(entry?.id || "") === stageId));
  const stage = stages[activeIndex] || stages[0] || {};
  const round = Math.max(1, Number(interaction.totalRounds || 0) + 1);
  const stageLabels = { read_adaptation: "转轮", malevolent_shrine: "领域", different_finish: "终结" };
  const phenomenonLabels = { slash: "斩击", fire: "火焰", physical: "肉体打击", other: "其他现象" };
  const adapted = Object.entries(interaction.adaptedPhenomena || {})
    .filter(([, count]) => Number(count || 0) > 0)
    .map(([id, count]) => `${phenomenonLabels[id] || id}${Number(count || 0) >= 2 ? "（深度适应）" : ""}`);
  const notes = {
    read_adaptation: "法阵在第一次斩击后转动。不要只看招式名称，要看它记住了哪一种现象。",
    malevolent_shrine: "御厨子张开，街区与魔虚罗一同被纳入斩击。领域能推进战局，也会留下无法抹去的代价。",
    different_finish: "斩击已经走到尽头。若要结束调伏，必须换一种现象。"
  };
  return `<section class="duel-choso-interaction duel-sukuna-mahoraga-interaction is-${escapeHtml(stageId)}" data-sukuna-mahoraga-stage="${escapeHtml(stageId)}" aria-label="宿傩对未调伏魔虚罗" aria-live="polite" aria-atomic="true">
    <div class="duel-mahoraga-wheel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <header class="duel-choso-interaction-head"><div><small>${escapeHtml(stage.sceneLabel || "23:07 · 道玄坂")}</small><h5>${escapeHtml(stage.displayName || "看清转轮")}</h5><p>${escapeHtml(stage.publicRule || "法阵已经开始转动。先认出它记住了什么。")}</p></div><span>第${escapeHtml(formatNumber(round))}回合</span></header>
    <ol class="duel-choso-stage-route" aria-label="调伏仪式阶段">${stages.map((entry, index) => `<li class="${index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "is-upcoming"}"${index === activeIndex ? ' aria-current="step"' : ""} data-duel-sukuna-mahoraga-action="${escapeHtml(entry?.id || `stage-${index + 1}`)}"><i></i><span>${escapeHtml(stageLabels[entry?.id] || entry?.displayName || `阶段${index + 1}`)}</span></li>`).join("")}</ol>
    <div class="duel-choso-metrics">
      ${renderChosoMetric("转轮响应", interaction.wheelTurns, Math.max(4, interaction.maxAnalysisProgress || 4), "pressure")}
      ${renderChosoMetric("识破程度", interaction.analysisProgress, interaction.maxAnalysisProgress || 4, "response")}
      ${renderChosoMetric("伏魔御厨子", interaction.domainDeployed ? 1 : 0, 1, "approach")}
    </div>
    <article class="duel-mahoraga-adaptation"><small>转轮记录</small><strong>${escapeHtml(adapted.join("、") || "尚未适应")}</strong><p>${adapted.length ? "再次使用同类现象会明显减伤。只有真正命中的攻击才会被法阵记住。" : "第一次真正命中后，法阵才会对该现象作出响应。"}</p></article>
    <div class="duel-mahoraga-ritual-anchors"><span><b>伏黑惠</b>濒死 · 仪式锚点 · 不可出牌</span><span><b>重面春太</b>被卷入调伏仪式</span></div>
    <p class="duel-choso-stage-note"><b>这一轮怎么打：</b>${escapeHtml(notes[stageId] || notes.read_adaptation)}</p>
    <p class="duel-choso-goal"><b>既定结果：</b>宿傩击败魔虚罗；伏黑重伤存活；区域破坏与平民伤亡保留。</p>
  </section>`;
}

const DUEL_DOMAIN_CONTROL_SKIN_IDS = new Set([
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

const DUEL_DOMAIN_CONTROL_SKIN_TAGS = new Set([
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

const DUEL_CARD_SKIN_CATEGORY_KEYS = new Set(["template", "special", "domain", "summon", "mahoraga", "trial"]);
const DUEL_CARD_SKIN_MODE_KEYS = new Set(["classic", "v224", "custom", "champion-kashimo", "ukiyo-memorial-1", "ukiyo-memorial-2"]);

function normalizeDuelSkinToken(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeDuelCardSkinMode(value = "") {
  const key = String(value || "").trim().toLowerCase();
  return DUEL_CARD_SKIN_MODE_KEYS.has(key) ? key : "";
}

function getDuelForcedCardSkinMode(view = {}, actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  return normalizeDuelCardSkinMode(
    view.visualCardSkin ||
    view.cardSkin ||
    view.visualSettings?.cardSkin ||
    entry.visualCardSkin ||
    entry.cardSkin ||
    entry.visualSettings?.cardSkin ||
    action.visualCardSkin ||
    action.cardSkin ||
    action.visualSettings?.cardSkin ||
    ""
  );
}

function sanitizeDuelInlineCssValue(value) {
  const text = String(value || "").trim().slice(0, 180);
  if (!text || /[;{}]/.test(text) || /url\s*\(/i.test(text)) return "";
  if (!/^[#(),.%\w\s-]+$/i.test(text)) return "";
  return text;
}

function getDuelForcedCustomSkinInlineStyles(view = {}, actionOrCandidate = {}, category = "template") {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  const settings = view.visualSettings || entry.visualSettings || action.visualSettings || null;
  if (settings?.cardSkin !== "custom" || !settings.customSkin?.cards) return [];
  const config = settings.customSkin.cards[category] || {};
  const suffixMap = {
    background: "bg",
    border: "border",
    accent: "accent",
    text: "text",
    muted: "muted",
    glow: "glow"
  };
  return Object.entries(suffixMap)
    .map(([field, suffix]) => {
      const value = sanitizeDuelInlineCssValue(config[field]);
      return value ? `--card-skin-${suffix}:${escapeHtml(value)}` : "";
    })
    .filter(Boolean);
}

function collectDuelSkinTags(view = {}, actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  return []
    .concat(Array.isArray(view.tags) ? view.tags : [])
    .concat(Array.isArray(view.uiTags) ? view.uiTags : [])
    .concat(Array.isArray(entry.tags) ? entry.tags : [])
    .concat(Array.isArray(action.tags) ? action.tags : [])
    .concat(Array.isArray(action.specialHandTags) ? action.specialHandTags : [])
    .concat(Array.isArray(action["特殊手札"]) ? action["特殊手札"] : [])
    .map(normalizeDuelSkinToken)
    .filter(Boolean);
}

function collectDuelSkinIds(view = {}, actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  return [
    getDuelActionEntryId(entry),
    entry.actionId,
    entry.id,
    entry.cardId,
    view.actionId,
    view.id,
    view.cardId,
    action.actionId,
    action.id,
    action.cardId
  ]
    .flatMap((value) => {
      const token = normalizeDuelSkinToken(value);
      return token.startsWith("card_") ? [token, token.slice(5)] : [token];
    })
    .filter(Boolean);
}

function isDuelDomainControlSkinChoice(view = {}, actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  const cardType = normalizeDuelSkinToken(view.cardType || entry.cardType || action.cardType || action.type || "");
  const ids = collectDuelSkinIds(view, entry);
  if (ids.some((id) => DUEL_DOMAIN_CONTROL_SKIN_IDS.has(id))) return true;
  const tags = collectDuelSkinTags(view, entry);
  const hasControlTag = tags.some((tag) => DUEL_DOMAIN_CONTROL_SKIN_TAGS.has(tag));
  if (!hasControlTag) return false;
  return Boolean(
    view.domainHand ||
    entry.domainHand ||
    action.domainHand ||
    cardType === "domain_maintenance" ||
    ids.some((id) => /^domain_(expand|compress|force_sustain|release|clash|survival)/.test(id))
  );
}

function isDuelPureDomainChoice(actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  const effects = action.effects || entry.effects || {};
  const cardType = String(entry.cardType || action.cardType || action.type || "").toLowerCase();
  if (action.domainSpecific || entry.domainSpecific || ["rule_trial", "rule_defense", "jackpot"].includes(cardType)) return false;
  if (isDuelDomainControlSkinChoice({}, entry)) return true;
  if (
    (entry.specialHandCard || action.specialHandCard || entry.techniqueFeatureHand || action.techniqueFeatureHand) &&
    (entry.normalHandOnly || action.normalHandOnly) &&
    !effects.activateDomain &&
    !effects.releaseDomain
  ) {
    return false;
  }
  return Boolean(
    entry.domainHand ||
    action.domainHand ||
    effects.activateDomain ||
    effects.releaseDomain
  );
}

function uniqueDuelActionEntries(entries = []) {
  const seen = new Set();
  return (entries || []).filter((entry) => {
    const id = getDuelActionEntryId(entry);
    const action = getDuelActionEntry(entry);
    const key = id || [entry?.label || action.label, entry?.name || action.name, entry?.cardType || action.cardType].filter(Boolean).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDuelCardAnimationVariant(actionOrCandidate = {}, battle = state.duelBattle, mode = "deal", count = 4) {
  const action = getDuelActionEntry(actionOrCandidate);
  const id = getDuelActionEntryId(actionOrCandidate) || action.label || action.name || "card";
  const source = [
    battle?.battleId || battle?.battleSeed || battle?.seed || "battle",
    battle?.round || 0,
    mode,
    id
  ].join("|");
  return (hashDuelSeed(source) % Math.max(1, count)) + 1;
}

function isDuelDomainExpandCard(actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  const ids = collectDuelSkinIds({}, actionOrCandidate);
  return ids.includes("domain_expand") ||
    ids.includes("card_domain_expand") ||
    (Boolean(action?.effects?.activateDomain || actionOrCandidate?.effects?.activateDomain) && isDuelDomainControlSkinChoice({}, actionOrCandidate));
}

function markDuelHandActionAnimation(battle = state.duelBattle, side = "left", mode = "play") {
  if (!battle) return;
  const ids = getDuelSelectedHandActions(battle, side)
    .map((entry) => entry.actionId || entry.id || entry.action?.id || "")
    .filter(Boolean);
  if (!ids.length) return;
  const round = Number(battle.round || 0) + 1;
  const safeMode = mode === "lock" ? "lock" : "play";
  battle.handActionAnimation = {
    mode: safeMode,
    side,
    round,
    ids,
    key: [battle.battleId || "battle", side, round, safeMode, ids.join(",")].join("|")
  };
}

function collectShibuyaBossMissionSignals(battle = state.duelBattle) {
  const resources = [battle?.resourceState?.p1, battle?.resourceState?.p2].filter(Boolean);
  const statuses = resources.flatMap((resource) => Array.isArray(resource?.statusEffects) ? resource.statusEffects : []);
  const uniqueByLabel = (entries) => {
    const seen = new Set();
    return entries.filter((entry) => {
      const label = String(entry?.label || "").trim();
      if (!label || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  };
  return {
    progress: uniqueByLabel(statuses.filter((entry) => ["场景目标", "机制状态", "场景支援"].includes(String(entry?.category || "")))).slice(0, 4),
    danger: uniqueByLabel(statuses.filter((entry) => String(entry?.category || "") === "危险意图")).slice(0, 2)
  };
}

function renderShibuyaBossMissionPanel(battle = state.duelBattle) {
  const context = battle?.activityContext;
  const mission = context?.type === "shibuya" && context?.bossMission && typeof context.bossMission === "object"
    ? context.bossMission
    : null;
  if (!mission || getDuelControlledSide(battle) !== "left") return "";
  const signals = collectShibuyaBossMissionSignals(battle);
  const milestones = Object.values(context?.historyRewrite?.milestones || {}).map((entry) => String(entry?.label || entry?.id || "")).filter(Boolean);
  const liveProgress = signals.progress.length
    ? signals.progress.map((entry) => `<span>${escapeHtml(entry.label)}</span>`).join("")
    : `<span>本回合进度将在公开意图载入后更新</span>`;
  const liveDanger = signals.danger.length
    ? signals.danger.map((entry) => `<span>${escapeHtml(entry.label)}</span>`).join("")
    : `<span>留意本回合公开威胁与接近极限的战场指标</span>`;
  return `<section class="duel-shibuya-mission" aria-label="本场战术任务" aria-live="polite">
    <header><div><small>涩谷事变 · 战术任务</small><strong>先读懂公开动向，再寻找收束窗口</strong></div><span>R${escapeHtml(formatNumber(Number(battle?.round || 0) + 1))}</span></header>
    <div class="duel-shibuya-mission-grid">
      <article><small>既定情势</small><p>${escapeHtml(mission.originalOutcome || "本节点沿既定时序发生。")}</p></article>
      <article class="is-danger"><small>危险征兆</small><p>关键目标倒下、压力合拢或Boss完成蓄势时，战况会迅速恶化。</p></article>
      <article class="is-rewrite"><small>判断原则</small><p>公开意图只描述征兆，不直接给出答案；结算后从回合纪要验证判断。</p></article>
    </div>
    <div class="duel-shibuya-mission-live"><div><b>实时进度</b>${liveProgress}</div><div class="is-danger"><b>本回合危险</b>${liveDanger}</div></div>
    ${milestones.length ? `<p class="duel-shibuya-mission-history"><b>已经带进本战的改变</b><span>${escapeHtml(milestones.join(" · "))}</span></p>` : ""}
  </section>`;
}

function renderDuelActionChoices(battle = state.duelBattle) {
  if (!battle?.resourceState || battle.resolved) return "";
  const onlineMode = isOnlineDuelModeActive();
  const handRules = getDuelHandRules();
  const maxDomainHandSize = handRules.domainHand?.enabled === false ? 0 : Number(handRules.domainHand?.maxHandSize || 3);
  if (
    !Array.isArray(battle.actionChoices) ||
    battle.actionRound !== battle.round + 1 ||
    (maxDomainHandSize > 0 && !Array.isArray(battle.domainHandCandidates))
  ) updateDuelActionAvailability(battle);
  const rawChoices = battle.actionChoices || [];
  const isActivityTacticChoice = (entry) => String((entry?.action || entry)?.cardType || entry?.cardType || (entry?.action || entry)?.type || "").toLowerCase() === "activity_tactic";
  const misplacedDomainChoices = rawChoices.filter(isDuelPureDomainChoice);
  const choices = rawChoices.filter((action) => !isDuelPureDomainChoice(action) && !isActivityTacticChoice(action));
  const domainChoices = uniqueDuelActionEntries([...(battle.domainHandCandidates || []), ...misplacedDomainChoices]);
  const { actorSide, actor } = getDuelSideResources(battle);
  const selectedEntries = getDuelSelectedHandActions(battle, actorSide);
  const selectedHandEntries = selectedEntries.filter((entry) => !isActivityTacticChoice(entry));
  const classifyAction = globalThis.JJKOnlineDuelSync?.classifyOnlineAction || ((entry) => isDuelPureDomainChoice(entry) ? "domain" : "normal");
  const selectedNormalCount = selectedHandEntries.filter((entry) => classifyAction(entry) === "normal").length;
  const selectedDomainCount = selectedHandEntries.filter((entry) => classifyAction(entry) === "domain").length;
  const mahoragaProxyActive = isMahoragaProxyActive(battle, actorSide);
  const selectedIds = new Set(selectedEntries.map((entry) => entry.actionId || entry.id));
  const selectedOrderMap = new Map(selectedEntries.map((entry, index) => [entry.actionId || entry.id, index + 1]));
  const capabilityStatus = onlineMode
    ? (globalThis.JJKOnlineDuelSync?.getOnlineTurnCapabilitiesStatus?.(battle.onlineRoomSnapshot || {}, actorSide) || {
      code: "TURN_CAPABILITIES_MISSING",
      capabilities: globalThis.JJKOnlineDuelSync?.getOnlineTurnCapabilities?.(battle.onlineRoomSnapshot || {}, actorSide) || null
    })
    : { code: "", capabilities: null };
  const onlineCapabilities = capabilityStatus.capabilities;
  const transportOnlyMode = battle?.onlineRoomSnapshot?.transportValidationMode === "transport-only-v1";
  if (onlineMode && !onlineCapabilities && !transportOnlyMode) {
    const message = capabilityStatus.code === "ROOM_PROTOCOL_MISMATCH"
      ? "房间协议已失效，请重新匹配。"
      : capabilityStatus.code === "TURN_CAPABILITIES_MISMATCH"
        ? "双方联机能力不一致，正在重新同步房间状态。"
        : "联机能力字段缺失，正在重新同步房间状态。";
    return `<p class=\"duel-action-message\" data-online-sync-code=\"${escapeHtml(capabilityStatus.code || "TURN_CAPABILITIES_MISSING")}\">${message}</p>`;
  }
  const localLimits = transportOnlyMode
    ? (globalThis.JJKOnlineDuelSync?.getOnlineActionLimits?.({ battle, side: actorSide }) || {})
    : {};
  const maxSelections = onlineCapabilities?.effectiveMaxActionsPerTurn || localLimits.normalActionLimit || handRules.hand?.maxSelectionsPerTurn || 1;
  const normalLimit = Number(onlineCapabilities?.normalActionLimit ?? localLimits.normalActionLimit ?? maxSelections);
  const domainLimit = Number(onlineCapabilities?.domainActionLimit ?? localLimits.domainActionLimit ?? maxDomainHandSize);
  const sideHandState = battle.handState?.[actorSide] || {};
  const visibleLastInjected = (sideHandState.lastInjected || []).filter((item) => (
    !String(item?.reason || "").includes("boss-tactic")
  ));
  const maxHandSize = handRules.hand?.maxHandSize || 8;
  const drawPerTurn = handRules.hand?.drawPerTurn || 5;
  const pendingDiscardCount = Math.max(0, Number(sideHandState.pendingDiscardCount || 0));
  const countedChoiceCount = choices.filter((choice) => !isDuelHandLimitExemptCard(choice)).length;
  const exemptChoiceCount = Math.max(0, choices.length - countedChoiceCount);
  const selectedTotalCe = selectedEntries.reduce((total, entry) => total + Number(entry?.ceCost || 0), 0);
  const actorCe = Number(actor?.ce || 0);
  const actorMaxCe = Number(actor?.maxCe || 0);
  const liteMode = isDuelLiteModeActive();
  const projectedCe = Math.max(0, actorCe - selectedTotalCe);
  const lastSelected = selectedEntries[selectedEntries.length - 1];
  const onlineLockMode = onlineMode && !battle?.dounaGauntlet?.online;
  const onlineLocked = onlineLockMode && state.duelModeState.localLocked;
  const lockEntry = battle.handLockMessages?.[actorSide];
  const handLockMessage = lockEntry && Number(lockEntry.round || 0) === battle.round + 1 ? String(lockEntry.message || "") : "";
  const currentChoiceIds = choices.map((item) => getDuelActionEntryId(item)).filter(Boolean);
  const currentDomainChoiceIds = domainChoices.map((item) => getDuelActionEntryId(item)).filter(Boolean);
  const newlyAddedNormalIds = new Set([
    ...(sideHandState.lastDrawn || []),
    ...(sideHandState.lastInjected || [])
  ].map((item) => String(item?.actionId || item?.id || item?.cardId || "")).filter(Boolean));
  const initialDeal = Number(battle.round || 0) === 0 && !battle.lastDealingAnimationKey;
  const dealAnimationIds = initialDeal
    ? currentChoiceIds.concat(currentDomainChoiceIds)
    : currentChoiceIds.filter((id) => newlyAddedNormalIds.has(String(id))).concat(currentDomainChoiceIds);
  const dealAnimationKey = dealAnimationIds.length ? [
    battle.battleId || "battle",
    actorSide,
    battle.round + 1,
    dealAnimationIds.join(",")
  ].join("|") : "";
  const suppressDealAnimation = Boolean(battle.suppressNextDealAnimation);
  const shouldAnimateDeal = Boolean(!suppressDealAnimation && !liteMode && !onlineLocked && dealAnimationKey && battle.lastDealingAnimationKey !== dealAnimationKey);
  if (suppressDealAnimation) {
    battle.suppressNextDealAnimation = false;
    if (dealAnimationKey) battle.lastDealingAnimationKey = dealAnimationKey;
  }
  const handAnimation = battle.handActionAnimation || {};
  const animationIds = new Set(Array.isArray(handAnimation.ids) ? handAnimation.ids : []);
  const animationMode = handAnimation.mode === "lock" ? "lock" : "play";
  const shouldAnimatePlay = Boolean(
    !liteMode &&
    animationIds.size &&
    handAnimation.side === actorSide &&
    Number(handAnimation.round || 0) === battle.round + 1 &&
    handAnimation.key &&
    battle.lastHandActionAnimationKey !== handAnimation.key
  );
  battle.pendingDuelHandAnimations = [
    shouldAnimateDeal ? {
      key: dealAnimationKey,
      mode: "deal",
      ids: dealAnimationIds
    } : null,
    shouldAnimatePlay ? {
      key: handAnimation.key,
      mode: animationMode,
      ids: Array.from(animationIds)
    } : null
  ].filter(Boolean);
  const selectedOrder = selectedHandEntries.length ? `
    <ol class="duel-selected-hand-list">
      ${selectedHandEntries.map((entry, index) => `
        <li><span>${escapeHtml(formatNumber(index + 1))}</span><strong>${escapeHtml(entry.label || entry.actionId || "未命名手札")}</strong><em>CE ${escapeHtml(formatNumber(entry.ceCost || 0))}</em></li>
      `).join("")}
    </ol>
  ` : `<p class="duel-selected-hand-empty">尚未选择本回合手札</p>`;
  const selectionHint = pendingDiscardCount > 0
    ? `手牌超过上限，请先弃置 ${formatNumber(pendingDiscardCount)} 张。弃牌范围包含原有手牌与本轮新增手牌。`
    : mahoragaProxyActive
    ? "魔虚罗已经接管行动；手牌区每回合后台随机锁定，由魔虚罗自行行动。"
    : onlineLocked
    ? "联机行动已锁定；等待对方锁定或结算。"
    : onlineLockMode
      ? (!selectedEntries.length
        ? "未选择手札时也可以锁定待机，用于咒力归零或没有可用手札的回合。"
        : "可以锁定行动；若继续选择手札，主要受咒力和状态限制。")
      : (!selectedEntries.length
        ? "未选择手札时将以 0 咒力待机行动推进回合。"
        : "可以执行回合，也可以继续选择咒力足够且状态允许的手札。");
  const regenBlocked = getDuelStatusEffectValue(actor, "ceRegenBlocked") > 0;
  const domainRisk = actor?.domain?.threshold
    ? actor.domain.load / actor.domain.threshold
    : 0;
  const warning = regenBlocked
    ? "咒力回流断裂，慎用高消耗手法。"
    : (domainRisk > 0.72 ? "领域负荷接近阈值，强行维持可能触发领域崩解和术式烧断。" : "");
  return `
    <section class="duel-action-panel" data-duel-deal-round="${escapeHtml(battle.round + 1)}">
      <div class="duel-action-scroll" data-duel-scroll-pane="hand">
      <div class="duel-action-head">
        <div class="duel-action-toolbar-buttons">
          <h4>${onlineMode ? "联机手札" : "术式手札"}</h4>
          <p class="muted">${onlineMode ? "选择手札后点击锁定行动；双方锁定前不会展示对方具体手札。" : "以咒力为主要资源选择 1 到多张手札，点击执行回合后统一结算。"}</p>
        </div>
        <div class="duel-action-meta">
          <span class="duel-chip">R${escapeHtml(battle.round + 1)}</span>
          <span class="duel-chip">当前咒力：${escapeHtml(formatNumber(actorCe))} / ${escapeHtml(formatNumber(actorMaxCe))}</span>
          <span class="duel-chip">已选 CE：${escapeHtml(formatNumber(selectedTotalCe))}，预计剩余：${escapeHtml(formatNumber(projectedCe))}</span>
          <span class="duel-chip${pendingDiscardCount > 0 ? " warning" : ""}">计入上限：${escapeHtml(formatNumber(countedChoiceCount))} / ${escapeHtml(formatNumber(maxHandSize))}</span>
          ${exemptChoiceCount > 0 ? `<span class="duel-chip">常驻免计：${escapeHtml(formatNumber(exemptChoiceCount))}</span>` : ""}
          <span class="duel-chip">普通动作：${escapeHtml(formatNumber(selectedNormalCount))} / ${escapeHtml(formatNumber(normalLimit))}</span>
          <span class="duel-chip">领域动作：${escapeHtml(formatNumber(selectedDomainCount))} / ${escapeHtml(formatNumber(domainLimit))}</span>
          <span class="duel-chip">每回合补牌：${escapeHtml(formatNumber(drawPerTurn))}</span>
          <span class="duel-chip">已选择 ${escapeHtml(formatNumber(selectedEntries.length))} / ${escapeHtml(formatNumber(maxSelections))}</span>
        </div>
      </div>
      ${renderDuelInitiativeControl(battle)}
      <p class="duel-hand-pool-hint">${escapeHtml(getDuelHandPoolInfluenceText(battle))}</p>
      ${renderShibuyaBossMissionPanel(battle)}
      ${renderTowerBossInteractionPanel(battle)}
      ${renderDagonBossInteractionPanel(battle)}
      ${renderChosoBossInteractionPanel(battle)}
      ${renderMegumiTojiBossInteractionPanel(battle)}
      ${renderSukunaJogoBossInteractionPanel(battle)}
      ${renderSukunaMahoragaBossInteractionPanel(battle)}
      ${renderMahitoBossInteractionPanel(battle)}
      ${renderHarutaInteractionPanel(battle)}
      ${pendingDiscardCount > 0 ? `<p class="duel-action-warning">手牌溢出：请在下方手牌中选择 ${escapeHtml(formatNumber(pendingDiscardCount))} 张弃置，直到计入上限的手牌为 ${escapeHtml(formatNumber(maxHandSize))} 张或更少后才能出牌；常驻免计牌不占槽位。</p>` : ""}
      ${visibleLastInjected.length ? `<p class="duel-action-message">本轮额外加入手牌：${escapeHtml(visibleLastInjected.map((item) => item.label || item.actionId).join("、"))}</p>` : ""}
      ${sideHandState.lastDiscarded?.length ? `<p class="duel-action-message">已弃置：${escapeHtml(sideHandState.lastDiscarded.map((item) => item.label || item.actionId).join("、"))}</p>` : ""}
      ${warning ? `<p class="duel-action-warning">${escapeHtml(warning)}</p>` : ""}
      ${battle.actionUiMessage ? `<p class="duel-action-message">${escapeHtml(battle.actionUiMessage)}</p>` : ""}
      ${renderMaximumUzumakiSelectionPanel(battle, actorSide)}
      ${mahoragaProxyActive ? `<div class="duel-mahoraga-banner">魔虚罗代打中</div>` : ""}
      ${handLockMessage ? `<div class="duel-hand-lock-message">${escapeHtml(handLockMessage)}</div>` : ""}
      <div class="duel-action-toolbar">
        <div class="duel-selected-hand-summary">
          <strong>已选择手札</strong>
          ${selectedOrder}
          <span class="duel-action-hint">${escapeHtml(selectionHint)}</span>
        </div>
        <div class="duel-hand-control-buttons">
          <button class="secondary mini" data-duel-hand-undo type="button" ${selectedEntries.length && !onlineLocked ? "" : "disabled"}>${selectedEntries.length ? `撤销：${escapeHtml(lastSelected?.label || lastSelected?.actionId || "上一张")}` : "撤销上一张"}</button>
          <button class="secondary mini" data-duel-hand-clear type="button" ${selectedEntries.length && !onlineLocked ? "" : "disabled"}>清空选择</button>
        </div>
      </div>
      <div class="duel-action-choices duel-hand-choices">
        ${choices.length
          ? choices.map((action, index) => renderDuelActionChoice(action, selectedIds, battle, selectedOrderMap, {
            discardMode: pendingDiscardCount > 0,
            dealAnimation: shouldAnimateDeal,
            dealIndex: index,
            playAnimation: shouldAnimatePlay && animationIds.has(getDuelActionEntryId(action)),
            playMode: animationMode,
            playIndex: selectedOrderMap.get(getDuelActionEntryId(action)) || index
          })).join("")
          : (handLockMessage ? `<p class="duel-selected-hand-empty">${escapeHtml(handLockMessage)}</p>` : "")}
      </div>
      ${maxDomainHandSize && !mahoragaProxyActive ? `
        <div class="duel-domain-hand-head">
          <strong>领域操控手札</strong>
          <span>独立 ${escapeHtml(formatNumber(maxDomainHandSize))} 位，每轮刷新；特色领域角色更容易抽到领域展开 / 维持牌。</span>
        </div>
        <div class="duel-action-choices duel-domain-hand-choices">
          ${domainChoices.length
            ? domainChoices.map((action, index) => renderDuelActionChoice(action, selectedIds, battle, selectedOrderMap, {
              dealAnimation: shouldAnimateDeal,
              dealIndex: choices.length + index,
              playAnimation: shouldAnimatePlay && animationIds.has(getDuelActionEntryId(action)),
              playMode: animationMode,
              playIndex: selectedOrderMap.get(getDuelActionEntryId(action)) || choices.length + index
            })).join("")
            : `<p class="duel-selected-hand-empty">当前没有可用领域操控手札。</p>`}
        </div>
      ` : ""}
      </div>
      ${renderDuelTurnExecuteControl(battle)}
    </section>
  `;
}

function renderMaximumUzumakiSelectionPanel(battle = state.duelBattle, side = "") {
  const selection = battle?.maximumUzumakiSelection;
  if (!selection || selection.side !== side) return "";
  const action = resolveMaximumUzumakiSelectionAction(battle);
  const units = getMaximumUzumakiSelectableUnits(battle, side);
  const selectedSet = new Set((selection.selectedUnitIds || []).map(String));
  const selectedUnits = units.filter((unit) => selectedSet.has(getMaximumUzumakiUnitSelectionId(unit)));
  const totalHp = selectedUnits.reduce((total, unit) => total + getDuelUnitHpValue(unit), 0);
  const estimatedDamage = estimateMaximumUzumakiClickSelectionDamage(action, getDuelSideResources(battle).actor, totalHp);
  return `
    <section class="duel-uzumaki-selection-panel">
      <div class="duel-uzumaki-selection-head">
        <div>
          <strong>极之番-涡：选择融合对象</strong>
          <span>点击咒灵切换投入；确认后作为一发 AOE 同时命中敌方角色与场上单位。</span>
        </div>
        <div class="duel-uzumaki-selection-summary">
          <span>已选 ${escapeHtml(formatNumber(selectedUnits.length))} / ${escapeHtml(formatNumber(units.length))}</span>
          <span>投入体势 ${escapeHtml(formatNumber(totalHp))}</span>
          ${estimatedDamage ? `<span>预计基础伤害 ${escapeHtml(formatNumber(estimatedDamage))}</span>` : ""}
        </div>
      </div>
      <div class="duel-uzumaki-unit-grid">
        ${units.map((unit) => {
          const unitId = getMaximumUzumakiUnitSelectionId(unit);
          const selected = selectedSet.has(unitId);
          return `
            <button class="duel-uzumaki-unit${selected ? " selected" : ""}" data-duel-uzumaki-unit="${escapeHtml(unitId)}" type="button">
              <strong>${escapeHtml(unit.name || unit.label || unit.cardId || "咒灵")}</strong>
              <span>${escapeHtml(getDuelUnitPlacementLabel(unit))} · 体势 ${escapeHtml(formatNumber(getDuelUnitHpValue(unit)))}</span>
              <em>${selected ? "已投入" : "点击投入"}</em>
            </button>
          `;
        }).join("")}
      </div>
      <div class="duel-uzumaki-selection-actions">
        <button class="secondary mini" data-duel-uzumaki-all type="button">投入全部</button>
        <button class="secondary mini" data-duel-uzumaki-cancel type="button">取消</button>
        <button class="primary mini" data-duel-uzumaki-confirm type="button" ${selectedUnits.length ? "" : "disabled"}>确认融合</button>
      </div>
    </section>
  `;
}

function estimateMaximumUzumakiClickSelectionDamage(action = {}, actor = {}, totalHp = 0) {
  if (!totalHp) return 0;
  const actionEntry = getDuelActionEntry(action);
  const spec = action?.maximumUzumakiSpec || actionEntry?.maximumUzumakiSpec || {};
  const hpMultiplier = Math.max(0, Number(spec.hpMultiplier ?? 1.5));
  const raw = actor?.raw || actor?.characterCardProfile?.raw || actor?.profile?.raw || {};
  const profile = actor?.characterCardProfile || actor?.profile || {};
  const baseStats = actor?.baseStats || profile.baseStats || {};
  const rankScores = { E: 1, D: 2, C: 3, B: 4, A: 5, S: 6.2, SS: 7.4, SSS: 8.8, "EX-": 10.2, EX: 12 };
  const directScore = Number(raw.cursedEnergyScore ?? profile.cursedEnergyScore ?? actor?.cursedEnergyScore);
  const rank = String(actor?.cursedEnergy || actor?.cePool || baseStats.cursedEnergy || profile.cursedEnergy || profile.cePool || "B").trim().toUpperCase();
  const cePoolScore = Number.isFinite(directScore) ? Math.max(0, directScore) : Number(rankScores[rank] ?? rankScores.B);
  const divisor = Math.max(1, Number(spec.cePoolBonusDivisor || 20));
  const minCeMultiplier = Number.isFinite(Number(spec.cePoolBonusMin)) ? Number(spec.cePoolBonusMin) : 1;
  const maxCeMultiplier = Number.isFinite(Number(spec.cePoolBonusMax)) ? Number(spec.cePoolBonusMax) : 1.75;
  const ceMultiplier = spec.cePoolBonus === false ? 1 : clamp(1 + cePoolScore / divisor, minCeMultiplier, maxCeMultiplier);
  return Math.max(0, Math.round(totalHp * hpMultiplier * ceMultiplier));
}

function renderDuelBetaFeedbackPanel(battle = state.duelBattle) {
  if (!battle) return "";
  const copy = getDuelBetaCopy();
  const hints = Array.isArray(copy.publicHints) ? copy.publicHints.slice(0, 3) : [];
  return `
    <details class="duel-beta-feedback-panel">
      <summary>
        <strong>${escapeHtml(copy.title || "战斗反馈")}</strong>
        <span>可选</span>
      </summary>
      <div class="duel-beta-feedback-body">
        <p>${escapeHtml(copy.summary || "可记录并导出本场手札体验，便于复查问题；不会改变战斗结果。")}</p>
        ${hints.length ? `<ul>${hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>` : ""}
        <label class="duel-beta-feedback-note">
          <span>反馈备注</span>
          <textarea id="duelBetaFeedbackNotes" rows="3" placeholder="${escapeHtml(copy.notePlaceholder || "可选：记录本场试玩反馈。")}"></textarea>
        </label>
        <div class="duel-beta-feedback-actions">
          <button class="secondary mini" data-duel-feedback-export type="button">${escapeHtml(copy.buttons?.export || "导出本场反馈")}</button>
          <button class="secondary mini" data-duel-feedback-copy type="button">${escapeHtml(copy.buttons?.copy || "复制反馈 JSON")}</button>
          <span class="duel-action-hint" data-duel-feedback-status>反馈包不会改变战斗结果。</span>
        </div>
        <pre class="duel-beta-feedback-output" data-duel-feedback-output hidden></pre>
      </div>
    </details>
  `;
}

function buildDuelBetaFeedbackPackageFromUi() {
  const notes = els.duelBattle?.querySelector("#duelBetaFeedbackNotes")?.value || "";
  return callDuelFeedbackImplementation(
    "buildDuelBetaFeedbackPackage",
    [state.duelBattle, { version: APP_BUILD_VERSION, notes, aiPromptEstimate: state.lastAiPromptEstimate }],
    globalThis.JJKDuelFeedback?.buildDuelBetaFeedbackPackage
  );
}

function writeDuelBetaFeedbackOutput(json, message) {
  const output = els.duelBattle?.querySelector("[data-duel-feedback-output]");
  const status = els.duelBattle?.querySelector("[data-duel-feedback-status]");
  if (output) {
    output.textContent = json;
    output.hidden = false;
  }
  if (status) status.textContent = message;
}

function exportDuelBetaFeedbackPackage(options = {}) {
  if (!state.duelBattle) {
    void globalThis.JJKDomModal?.alert("当前没有可导出的对局反馈。");
    return;
  }
  const payload = buildDuelBetaFeedbackPackageFromUi();
  const json = callDuelFeedbackImplementation(
    "serializeDuelBetaFeedbackPackage",
    [payload],
    globalThis.JJKDuelFeedback?.serializeDuelBetaFeedbackPackage
  );
  const filename = callDuelFeedbackImplementation(
    "getDuelBetaFeedbackFilename",
    [payload],
    globalThis.JJKDuelFeedback?.getDuelBetaFeedbackFilename
  );
  writeDuelBetaFeedbackOutput(json, options.copy ? "反馈 JSON 已生成，正在尝试复制。" : "反馈 JSON 已生成并下载。");
  if (options.copy) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json)
        .then(() => writeDuelBetaFeedbackOutput(json, "反馈 JSON 已复制。"))
        .catch(() => {
          writeDuelBetaFeedbackOutput(json, "复制失败，已在下方显示 JSON。");
        });
    } else {
      writeDuelBetaFeedbackOutput(json, "当前浏览器不支持自动复制，已在下方显示 JSON。");
    }
    return;
  }
  downloadTextFile(json, filename, "application/json;charset=utf-8");
}

function isDuelHumanEffectDescription(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !/(?:基础结算：|系数：|特殊机制：|\b(?:undefined|null|TODO|NaN)\b|[{}]|[a-z][a-z0-9]*_[a-z0-9_]+\s*=)/i.test(text);
}

function getDuelCanonicalEffectDescription(view = {}, action = {}) {
  const candidates = [
    action.flavorSummary,
    action.summary,
    view.flavorSummary,
    view.shortEffect,
    view.effectText,
    action.description
  ];
  return candidates.find(isDuelHumanEffectDescription) || "暂无效果说明。";
}

function getDuelReadableEffectPreview(view = {}, actionOrCandidate = {}) {
  const action = actionOrCandidate?.action || actionOrCandidate || {};
  const preview = view.effectPreview && typeof view.effectPreview === "object" ? view.effectPreview : {};
  const effects = action.effects && typeof action.effects === "object" ? action.effects : {};
  const requirements = {
    ...(action.requirements && typeof action.requirements === "object" ? action.requirements : {}),
    ...(action.availability && typeof action.availability === "object" ? action.availability : {})
  };
  const descriptionRows = [getDuelCanonicalEffectDescription(view, action)];
  const numericRows = normalizeDuelReadableItems([
    ...normalizeDuelReadableItems(preview.numericPreview?.lines || preview.numericPreview || preview.valuePreview || preview.values),
    ...normalizeDuelReadableItems(view.numericPreview?.lines || view.numericPreview),
    ...buildDuelReadableEffectNumbers(effects)
  ]);
  const statusSource = Array.isArray(preview.statusChanges) ? preview.statusChanges : (preview.statusChanges || preview.statusPreview);
  const statusRows = normalizeDuelReadableItems([
    ...normalizeDuelReadableItems(statusSource),
    ...buildDuelReadableStatusChanges(effects)
  ]);
  const conditionRows = normalizeDuelReadableItems([
    view.available ? "当前状态：可以执行。" : (view.availabilityMessage || view.unavailableReason || "当前状态：暂不可执行。"),
    ...normalizeDuelReadableItems(preview.conditions || preview.requirements),
    ...buildDuelReadableConditions(requirements)
  ]);
  const riskRows = normalizeDuelReadableItems([
    preview.riskDescription,
    preview.riskSummary,
    view.riskNote,
    view.riskLabel ? `风险等级：${view.riskLabel}` : "",
    action.riskNote
  ]);
  return {
    descriptions: descriptionRows.length ? descriptionRows : ["沿用既有手法效果。"],
    numbers: numericRows.length ? numericRows : ["没有额外数值预览。"],
    statuses: statusRows.length ? statusRows : ["不直接添加持续状态。"],
    conditions: conditionRows.length ? conditionRows : ["按当前战斗阶段与资源状态判定。"],
    risks: riskRows.length ? riskRows : ["风险待判定。"]
  };
}

function normalizeDuelReadableItems(value) {
  const unique = (items) => Array.from(new Set(items));
  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => normalizeDuelReadableItems(item)));
  }
  if (value && typeof value === "object") {
    return [];
  }
  const text = String(value || "").trim();
  return text ? [text] : [];
}

function buildDuelReadableEffectNumbers(effects = {}) {
  const rows = [];
  const addScale = (key, label) => {
    if (effects[key] === undefined) return;
    const value = Number(effects[key]);
    if (!Number.isFinite(value)) return;
    rows.push(`${label}：${formatDuelEffectMultiplier(value)}`);
  };
  const addDelta = (key, label, suffix = "") => {
    if (effects[key] === undefined) return;
    const value = Number(effects[key]);
    if (!Number.isFinite(value) || value === 0) return;
    rows.push(`${label}：${formatSignedDuelDelta(value)}${suffix}`);
  };
  addScale("outgoingScale", "本回合输出");
  addScale("incomingHpScale", "承受体势损耗");
  addScale("incomingCeScale", "承受咒力损耗");
  addScale("sureHitScale", "必中压力");
  addScale("domainPressureScale", "领域压力");
  addScale("manualAttackScale", "手动攻击压力");
  addScale("domainLoadScale", "领域负荷增长");
  addDelta("domainLoadDelta", "领域负荷");
  addDelta("opponentDomainLoadDelta", "对方领域负荷");
  if (effects.stabilityDelta !== undefined) {
    const value = Number(effects.stabilityDelta);
    if (Number.isFinite(value) && value !== 0) rows.push(`自身稳定：${formatSignedDuelDelta(value * 100)}%`);
  }
  if (effects.opponentStabilityDelta !== undefined) {
    const value = Number(effects.opponentStabilityDelta);
    if (Number.isFinite(value) && value !== 0) rows.push(`对方稳定：${formatSignedDuelDelta(value * 100)}%`);
  }
  return rows;
}

function formatDuelEffectMultiplier(value) {
  const percent = Math.round((Number(value) - 1) * 100);
  if (!Number.isFinite(percent) || percent === 0) return "不变";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

function buildDuelReadableStatusChanges(effects = {}) {
  const rows = [];
  if (effects.activateDomain) rows.push("展开领域，进入维持状态。");
  if (effects.releaseDomain) rows.push("主动解除领域。");
  addDuelReadableStatusRow(rows, effects.selfStatus, "自身");
  addDuelReadableStatusRow(rows, effects.opponentStatus, "对方");
  return rows;
}

function addDuelReadableStatusRow(rows, status, targetLabel) {
  if (!status || typeof status !== "object") return;
  const label = status.label || status.name || "";
  const rounds = Number(status.rounds || 0);
  const duration = Number.isFinite(rounds) && rounds > 0 ? `，持续 ${formatNumber(rounds)} 回合` : "";
  if (label) rows.push(`${targetLabel}获得「${label}」${duration}。`);
}

function buildDuelReadableConditions(requirements = {}) {
  const rows = [];
  const domainActive = requirements.domainActive;
  if (domainActive === true) rows.push("需要我方领域已经展开。");
  else if (domainActive === false) rows.push("需要我方尚未展开领域。");
  else if (domainActive === "any") rows.push("领域展开与否均可使用。");
  if (requirements.opponentDomainActive) rows.push("需要对方领域正在压制。");
  if (requirements.requiresDomainAccess) rows.push("需要角色具备领域展开条件。");
  if (requirements.blocksOnTechniqueImbalance) rows.push("术式失衡时不可使用。");
  if (requirements.requiresZeroCeBypass) rows.push("需要零咒力或绕过必中捕捉的条件。");
  if (requirements.requiresNoDomainResponse) rows.push("缺少稳定反领域手段时才会进入该选择。");
  if (requirements.handBeta) rows.push("当前战斗允许加入手札。");
  return rows;
}

function renderDuelReadableSection(title, rows) {
  const items = normalizeDuelReadableItems(rows);
  return `
    <section class="duel-card-detail-section">
      <h5>${escapeHtml(title)}</h5>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderDuelDeveloperDetails(view = {}, debug = {}) {
  if (!state.debugMode) return "";
  return `
    <details class="duel-hand-debug">
      <summary>调试信息（仅开发模式）</summary>
      <dl>
        <dt>cardId（卡牌ID）</dt><dd>${escapeHtml(debug.cardId || view.cardId || "n/a")}</dd>
        <dt>actionId（来源动作ID）</dt><dd>${escapeHtml(debug.actionId || view.actionId || "n/a")}</dd>
        <dt>mechanicIds（机制ID）</dt><dd>${escapeHtml((debug.mechanicIds || view.mechanicIds || []).join(" / ") || "none")}</dd>
        <dt>contexts（允许场景）</dt><dd>${escapeHtml((debug.contexts || view.contexts || []).join(" / ") || "normal")}</dd>
        <dt>longEffect（长效果）</dt><dd>${escapeHtml(view.longEffect || "n/a")}</dd>
        <dt>flavorLine（风味文本）</dt><dd>${escapeHtml(view.flavorLine || "n/a")}</dd>
        <dt>actionId（动作ID）</dt><dd>${escapeHtml(debug.actionId || view.actionId || "n/a")}</dd>
        <dt>cardType（卡牌类型）</dt><dd>${escapeHtml(debug.cardType || view.cardType || "n/a")}</dd>
        <dt>rarity（稀有度）</dt><dd>${escapeHtml(debug.rarity || view.rarity || "n/a")}</dd>
        <dt>effectTags（效果标签）</dt><dd>${escapeHtml((debug.effectTags || []).join(" / ") || "none")}</dd>
        <dt>status（状态）</dt><dd>${escapeHtml(debug.status || view.status || "n/a")}</dd>
        <dt>copyStatus（文案状态）</dt><dd>${escapeHtml(view.copyStatus || "n/a")}</dd>
        <dt>source（来源）</dt><dd>${escapeHtml(debug.source || view.source || "existing-action-pool")}</dd>
        <dt>weight（权重）</dt><dd>${escapeHtml(debug.weight || "n/a")}</dd>
      </dl>
    </details>
  `;
}


function getBattleRuntimePreviewDamageReference(preview = {}) {
  const base = preview?.base || {};
  return Number(preview?.damage ?? base.damage ?? 0);
}

function getBattleRuntimePreviewBlockReference(preview = {}) {
  const base = preview?.base || {};
  return Math.max(Number(preview?.block ?? base.block ?? 0), Number(base.shield ?? base.baseShield ?? 0));
}

function getDuelCardNumericBrief(view = {}) {
  const preview = view.numericPreview || view.finalPreview || {};
  const finalDamage = Number(preview.finalDamage || 0);
  const finalBlock = Number(preview.finalBlock || 0);
  const finalCost = Number(preview.cost?.finalCost ?? view.previewCeCost?.finalCost ?? view.ceCost ?? 0);
  const damageReference = getBattleRuntimePreviewDamageReference(preview);
  const blockReference = getBattleRuntimePreviewBlockReference(preview);
  const modifiers = [];
  if (damageReference > 0 && finalDamage > 0) modifiers.push(finalDamage / damageReference);
  if (blockReference > 0 && finalBlock > 0) modifiers.push(finalBlock / blockReference);
  const modifier = modifiers.length
    ? modifiers.reduce((total, value) => total + value, 0) / modifiers.length
    : null;
  const modifierText = modifier
    ? `x${formatNumber(Number(modifier.toFixed(2)))}`
    : "特殊效果";
  return `攻 ${formatNumber(finalDamage)}｜防 ${formatNumber(finalBlock)}｜CE消耗 ${formatNumber(finalCost)}｜修正倍率 ${formatDuelCardValueModifierBrief(preview.valueModifierBreakdown, modifierText)}`;
}

function formatDuelCardValueModifierBrief(breakdown = {}, fallback = "特殊效果") {
  const factors = Array.isArray(breakdown.factors) ? breakdown.factors : [];
  if (!factors.length) return fallback;
  const factorText = factors.slice(0, 5).map((factor) => {
    if (factor.coefficient !== undefined) {
      return `${factor.label}×${factor.coefficientField || "系数"}(${formatNumber(factor.value)}×${formatNumber(factor.coefficient)})=×${formatNumber(factor.multiplier)}`;
    }
    return `${factor.label}×${formatNumber(factor.multiplier)}`;
  }).join(" × ");
  const omitted = factors.length > 5 ? " × ..." : "";
  return `${factorText}${omitted} = 总倍率×${formatNumber(breakdown.totalMultiplier || 1)}`;
}
function collectDuelSkinIdentityText(view = {}, actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  return [
    entry.actionId,
    entry.id,
    entry.cardId,
    entry.cardType,
    entry.domainRole,
    entry.domainClass,
    view.actionId,
    view.id,
    view.cardId,
    view.cardType,
    view.displayName,
    view.label,
    view.name,
    view.subtitle,
    view.shortEffect,
    action.id,
    action.actionId,
    action.cardId,
    action.cardType,
    action.type,
    action.label,
    action.name,
    action.description,
    action.scalingProfile
  ].concat(
    Array.isArray(view.tags) ? view.tags : [],
    Array.isArray(view.uiTags) ? view.uiTags : [],
    Array.isArray(action.tags) ? action.tags : [],
    Array.isArray(action.specialHandTags) ? action.specialHandTags : [],
    Array.isArray(action["特殊手札"]) ? action["特殊手札"] : []
  ).filter(Boolean).join(" ");
}

function getDuelCardSkinCategory(view = {}, actionOrCandidate = {}) {
  const entry = actionOrCandidate || {};
  const action = getDuelActionEntry(entry);
  const explicitCategory = normalizeDuelSkinToken(
    view.skinCategory ||
    view.cardSkinCategory ||
    entry.skinCategory ||
    entry.cardSkinCategory ||
    action.skinCategory ||
    action.cardSkinCategory ||
    ""
  );
  if (DUEL_CARD_SKIN_CATEGORY_KEYS.has(explicitCategory)) return explicitCategory;
  const effects = action.effects || entry.effects || {};
  const cardType = String(view.cardType || entry.cardType || action.cardType || action.type || "").toLowerCase();
  const identityText = collectDuelSkinIdentityText(view, entry).toLowerCase();
  const originalIdentityText = collectDuelSkinIdentityText(view, entry);
  if (/mahoraga|魔虚罗|魔須羅|八握剑|八握劍/.test(identityText) || /魔虚罗|魔須羅|八握剑|八握劍/.test(originalIdentityText)) {
    return "mahoraga";
  }
  if (
    cardType === "rule_trial" ||
    cardType === "rule_defense" ||
    cardType === "jackpot" ||
    action.domainSpecific ||
    /trial|verdict|evidence|judgeman|higuruma|rule_trial|rule_defense|审判|判决|判決|证据|證據|抗审判|日车/.test(identityText) ||
    /审判|判决|判決|证据|證據|抗审判|日车/.test(originalIdentityText)
  ) {
    return "trial";
  }
  if (isDuelDomainControlSkinChoice(view, entry)) {
    return "domain";
  }
  if (
    cardType === "summon" ||
    Boolean(view.summonSpec || action.summonSpec || action.unitStats || action.mahoragaProxySpec) ||
    /summon|shikigami|ten_shadows|unit|式神|十种影|十影|召唤|召喚/.test(identityText) ||
    /式神|十种影|十影|召唤|召喚/.test(originalIdentityText)
  ) {
    return "summon";
  }
  if (
    action.specialHandCard ||
    action.techniqueFeatureHand ||
    view.specialHandCard ||
    view.techniqueFeatureHand ||
    Array.isArray(action.specialHandTags) && action.specialHandTags.length > 0 ||
    /特色手札|technique_feature|feature_technique|specialhand/.test(identityText)
  ) {
    return "special";
  }
  if (
    isDuelPureDomainChoice(entry) &&
    (entry.domainHand || action.domainHand || effects.activateDomain || effects.releaseDomain)
  ) {
    return "domain";
  }
  return "template";
}

function getDuelCompactAttackValue(view = {}, actionOrCandidate = {}) {
  const action = getDuelActionEntry(actionOrCandidate);
  const candidates = [
    view.finalDamage,
    view.numericPreview?.finalDamage,
    view.effectPreview?.numbers?.finalDamage,
    view.effectPreview?.finalDamage,
    action.finalDamage,
    action.numericPreview?.finalDamage,
    getBattleRuntimeActionDamage(action),
    action.effects?.damage,
    action.unitStats?.damage,
    view.summonSpec?.unitStats?.damage,
    view.summonSpec?.damage
  ];
  const value = candidates.find((item) => Number(item) > 0);
  return Number(value || 0);
}

function getDuelCompactDefenseValue(view = {}, actionOrCandidate = {}) {
  const preview = view.numericPreview || view.finalPreview;
  if (preview && Number.isFinite(Number(preview.finalBlock))) {
    return Math.max(0, Number(preview.finalBlock));
  }
  const action = getDuelActionEntry(actionOrCandidate);
  const candidates = [
    view.finalBlock,
    view.effectPreview?.numbers?.finalBlock,
    view.effectPreview?.finalBlock,
    action.finalBlock,
    action.numericPreview?.finalBlock,
    action.effects?.block,
    action.effects?.shield
  ];
  const value = candidates.find((item) => Number(item) > 0);
  return Number(value || 0);
}

function isReverseCursedTechniqueOutputDuelAction(action = {}) {
  if (action?.rctOutput || action?.effects?.rctOutputExternal) return true;
  const text = [action.id, action.actionId, action.cardId, action.label, action.name, action.type]
    .filter(Boolean).join(" ").toLowerCase();
  return /reverse_cursed_technique_output|reverse_output|rct_output|反转术式外放|反转输出/.test(text);
}

function renderDuelRctOutputTargetPicker(action, battle = state.duelBattle) {
  const runtimeAction = getDuelActionEntry(action);
  if (!isReverseCursedTechniqueOutputDuelAction(runtimeAction) || !battle) return "";
  const { actorSide, actor } = getDuelSideResources(battle);
  const options = [{ value: "", label: "自动：敌方咒灵优先，否则治疗最危急友方", disabled: false }];
  const selfMissing = Number(actor?.maxHp || 0) > 0 && Number(actor?.hp || 0) < Number(actor?.maxHp || 0) - 0.5;
  options.push({
    value: "__self__",
    label: `自己（${formatNumber(actor?.hp || 0)}/${formatNumber(actor?.maxHp || 0)}）`,
    disabled: !selfMissing
  });
  (Array.isArray(battle.battlefieldUnits) ? battle.battlefieldUnits : [])
    .filter((unit) => unit?.active !== false && Number(unit?.hp ?? unit?.currentHp ?? 0) > 0)
    .filter((unit) => (unit.controllerSide || unit.ownerSide || unit.side) === actorSide)
    .filter((unit) => unit.control !== "neutral_uncontrolled" && unit.control !== "neutral_berserk")
    .forEach((unit) => {
      const hp = Number(unit.hp ?? unit.currentHp ?? 0);
      const maxHp = Math.max(hp, Number(unit.maxHp ?? unit.unitStats?.maxHp ?? hp));
      options.push({
        value: String(unit.id || unit.cardId || unit.actionId || ""),
        label: `${unit.name || unit.label || "友方召唤物"}（${formatNumber(hp)}/${formatNumber(maxHp)}）`,
        disabled: hp >= maxHp - 0.5
      });
    });
  const actionId = getDuelActionEntryId(action);
  return `<label class="duel-rct-target-picker"><span>外放目标</span><select data-duel-rct-target="${escapeHtml(actionId)}">${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.disabled ? "disabled" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
}

function renderDuelActionChoice(action, selectedIds, battle = state.duelBattle, selectedOrderMap = new Map(), options = {}) {
  const projectionSide = options.side === "right" ? "right" : options.side === "left" ? "left" : getDuelControlledSide(battle);
  const { actor, opponent } = getDuelSideResources(battle, projectionSide);
  const view = getDuelHandCardViewModel(action, actor, opponent, battle);
  const onlineLocked = isOnlineDuelModeActive() && state.duelModeState.localLocked;
  const selected = Boolean(selectedIds?.has(view.actionId || view.id));
  const discardMode = Boolean(options.discardMode);
  const discardable = discardMode && !isDuelHandLimitExemptCard(action);
  const selectedOrder = selectedOrderMap?.get(view.actionId || view.id) || 0;
  const tags = Array.isArray(view.uiTags) && view.uiTags.length ? view.uiTags.filter(Boolean) : (Array.isArray(view.tags) ? view.tags.filter(Boolean) : []);
  const visibleTags = tags.slice(0, 4);
  const tagText = visibleTags.join(" / ") || "未标记";
  const tagSuffix = tags.length > visibleTags.length ? ` / +${tags.length - visibleTags.length}` : "";
  const fullTagText = (Array.isArray(view.tags) ? view.tags.filter(Boolean) : tags).join(" / ") || "未标记";
  const debug = view.debug || {};
  const cardTypeText = view.cardTypeLabel || view.cardType || "基础";
  const titleText = view.displayName || view.label || "未命名手札";
  const subtitleText = view.subtitle || "";
  const shortEffectText = getDuelCanonicalEffectDescription(view, action);
  const riskText = view.riskLabel || view.risk || "风险待判定";
  const towerTacticGate = getTowerTacticSelectionGate(battle, action);
  const choiceAvailable = Boolean(view.available && towerTacticGate.ok);
  const availabilityText = towerTacticGate.reason || view.availabilityMessage || view.unavailableReason || "不可用";
  const statusText = onlineLocked
    ? "状态：已锁定，等待联机同步"
    : discardMode
      ? (discardable ? "状态：可选择弃置" : "状态：免计上限，不需要弃置")
    : selected
      ? "状态：已选择，本回合将执行"
      : (choiceAvailable ? `风险：${riskText}` : availabilityText);
  const statusClass = selected ? "selected" : (choiceAvailable ? "available" : "blocked");
  const visualSettings = getDuelVisualSettingsSnapshot();
  const liteMode = Boolean(visualSettings.liteMode);
  const readablePreview = liteMode ? null : getDuelReadableEffectPreview(view, action);
  const numericBrief = liteMode ? "" : getDuelCardNumericBrief(view);
  const cardTypeClass = String(view.cardType || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const identityText = [
    view.actionId,
    view.id,
    view.displayName,
    view.label,
    view.name,
    action?.id,
    action?.label,
    action?.name
  ].filter(Boolean).join(" ");
  const specialCardClass = /mahoraga_tuning_ritual|魔虚罗调幅仪式/.test(identityText) ? " mahoraga-ritual" : "";
  const skinCategory = getDuelCardSkinCategory(view, action);
  const skinClass = ` duel-skin-${skinCategory}`;
  const cardSkinClass = ` duel-card-skin-${visualSettings.cardSkin}`;
  const compactStats = `
        <span class="duel-action-compact-stats">
          <i class="duel-action-attack">攻击 ${escapeHtml(formatNumber(getDuelCompactAttackValue(view, action)))}</i>
          <i class="duel-action-defense">防御 ${escapeHtml(formatNumber(getDuelCompactDefenseValue(view, action)))}</i>
          <i class="duel-action-cost">咒力 ${escapeHtml(formatNumber(view.ceCost || 0))}</i>
        </span>`;
  return `
    <article class="duel-hand-card ${escapeHtml(cardTypeClass)}${specialCardClass}${skinClass}${cardSkinClass}${selected ? " active" : ""}${!choiceAvailable ? " disabled" : ""}" data-duel-card-id="${escapeHtml(view.actionId || view.id)}">
      <button class="duel-action-choice duel-hand-main${selected ? " active" : ""}" data-duel-action="${escapeHtml(view.actionId)}" data-card-instance-id="${escapeHtml(view.cardInstanceId || action?.cardInstanceId || "")}" type="button" ${onlineLocked || discardMode || selected || !choiceAvailable ? "disabled" : ""}>
        <span class="duel-action-title">${escapeHtml(titleText)}</span>
        ${!liteMode && subtitleText ? `<span class="duel-action-subtitle">${escapeHtml(subtitleText)}</span>` : ""}
        ${selected ? `<span class="duel-selected-order-badge">第 ${escapeHtml(formatNumber(selectedOrder))} 手</span>` : ""}
        ${!liteMode ? `<span class="duel-action-card-meta">
          <i class="duel-action-card-type">类型：${escapeHtml(cardTypeText)}</i>
          <i class="duel-action-risk">风险：${escapeHtml(riskText)}</i>
        </span>` : ""}
        ${compactStats}
        ${!liteMode ? `<span class="duel-action-numeric-brief">${escapeHtml(numericBrief)}</span>` : ""}
        ${!liteMode ? renderDuelSummonInlinePreview(view) : ""}
        ${!liteMode ? `<span class="duel-action-effect">效果：${escapeHtml(shortEffectText)}</span>` : ""}
        ${!liteMode ? `<span class="duel-action-tags" title="${escapeHtml(fullTagText)}">标签：${escapeHtml(tagText + tagSuffix)}</span>` : ""}
        <em class="duel-action-status ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</em>
      </button>
      ${!discardMode && !selected ? `${renderHarutaTargetPicker(action, battle, view)}${renderDuelRctOutputTargetPicker(action, battle)}` : ""}
      ${discardable ? `<button class="secondary mini duel-hand-discard-btn" data-duel-discard="${escapeHtml(view.cardInstanceId || action?.cardInstanceId || view.actionId)}" data-duel-discard-action="${escapeHtml(view.actionId)}" type="button">弃置</button>` : ""}
      ${!liteMode ? `<details class="duel-hand-detail">
        <summary>卡牌详情</summary>
        <div class="duel-card-detail-grid">
          ${renderDuelReadableSection("效果说明", readablePreview.descriptions)}
          ${renderDuelReadableSection("数值预览", readablePreview.numbers)}
          ${renderDuelReadableSection("状态变化", readablePreview.statuses)}
          ${renderDuelReadableSection("适用条件", readablePreview.conditions)}
          ${renderDuelReadableSection("风险说明", readablePreview.risks)}
        </div>
        ${renderDuelDeveloperDetails(view, debug)}
      </details>` : ""}
    </article>
  `;
}

function renderDuelSummonInlinePreview(view) {
  const summon = view?.summonSpec;
  if (!summon) return "";
  const unitName = summon.unitName || summon.unitCardId || "召唤单位";
  const unitStats = view?.unitStats || summon.unitStats || {};
  const controlLabels = {
    player_controlled: "友方",
    temporary_player_controlled: "临时友方",
    neutral_uncontrolled: "中立失控",
    neutral_berserk: "中立狂暴"
  };
  const control = controlLabels[summon.control] || summon.control || "控制未定";
  const placement = getDuelSummonPlacementLabel(summon);
  const maxHp = Number(unitStats.maxHp || unitStats.currentHp || 0);
  const unitDamage = Number(unitStats.damage || unitStats.effect?.damage || 0);
  const statText = maxHp > 0 ? `｜体势 ${formatNumber(maxHp)}｜伤害 ${formatNumber(unitDamage)}` : "";
  const duration = Number(summon.durationRounds || 0) > 0 ? `｜${formatNumber(summon.durationRounds)} 回合` : "";
  return `<span class="duel-summon-preview"><b>召唤</b>${escapeHtml(unitName)}｜${escapeHtml(control)}｜${escapeHtml(placement)}${escapeHtml(statText)}${escapeHtml(duration)}</span>`;
}

function getDuelSelectedResourcePreview(resource, battle = state.duelBattle) {
  if (!resource?.side || !battle) return null;
  const preview = {
    hp: Number(resource.hp || 0),
    ce: Number(resource.ce || 0)
  };
  const selected = getDuelSelectedHandActions(battle, resource.side) || [];
  selected.forEach((entry) => {
    const action = entry?.action || entry || {};
    const runtime = action.bloodRuntime || entry?.bloodRuntime;
    if (!runtime?.active && !action.bloodConversion) return;
    const ceCost = Number(runtime?.ceCost ?? action.ceCost ?? action.costCe ?? 0) || 0;
    const hpCost = Number(runtime?.hpCost ?? action.effects?.selfHpCostFlat ?? 0) || 0;
    const actualCeCost = Math.min(Math.max(0, preview.ce), Math.max(0, ceCost));
    const minimumHp = action.effects?.selfHpCostNonlethal === false || action.selfHpCostNonlethal === false ? 0 : 1;
    const actualHpCost = Math.min(Math.max(0, preview.hp - minimumHp), Math.max(0, hpCost));
    preview.ce = Number((preview.ce - actualCeCost).toFixed(1));
    preview.hp = Number((preview.hp - actualHpCost).toFixed(1));
    if (action.bloodConversion === "ce_to_hp") {
      const hpGainCap = Math.max(0, Number(resource.maxHp || 0) * Number(action.bloodConversionGainCapRatio || 0.18));
      const hpGain = Math.min(actualCeCost * Number(action.bloodCeToHpEfficiency || 0.65), hpGainCap);
      preview.hp = Number((preview.hp + hpGain).toFixed(1));
    } else if (action.bloodConversion === "hp_to_ce") {
      const ceGainCap = Math.max(0, Number(resource.maxCe || 0) * Number(action.bloodConversionGainCapRatio || 0.18));
      const ceGain = Math.min(actualHpCost * Number(action.bloodHpToCeEfficiency || 0.65), ceGainCap);
      preview.ce = Number((preview.ce + ceGain).toFixed(1));
    }
  });
  if (Math.abs(preview.hp - Number(resource.hp || 0)) < 0.05 && Math.abs(preview.ce - Number(resource.ce || 0)) < 0.05) {
    return null;
  }
  preview.hp = Math.max(0, preview.hp);
  preview.ce = Math.max(0, preview.ce);
  return preview;
}

function renderDuelResourceSide(resource, profile, battle = state.duelBattle) {
  if (!resource) return "";
  const sideLabel = getDuelPerspectiveSideLabel(resource.side, battle);
  const preview = getDuelSelectedResourcePreview(resource, battle);
  const hpRatio = resource.maxHp ? clamp(resource.hp / resource.maxHp, 0, 1) : 0;
  const ceRatio = resource.maxCe ? clamp(resource.ce / resource.maxCe, 0, 1) : 0;
  const domainRatio = resource.domain?.threshold ? clamp(resource.domain.load / resource.domain.threshold, 0, 1) : 0;
  const initiative = battle?.initiativeState;
  const initiativeRole = initiative?.firstSide === resource.side
    ? "first"
    : initiative?.secondSide === resource.side
      ? "second"
      : "";
  const initiativeLabel = initiativeRole === "first" ? "先手" : initiativeRole === "second" ? "后手" : "";
  const initiativeDetail = initiativeRole === "first" ? "CE消耗-5%" : initiativeRole === "second" ? "承伤-10%" : "";
  const initiativeRound = Math.max(0, Number(initiative?.round || 0));
  const initiativeTag = initiativeLabel
    ? `<span class="duel-status-tag initiative-${initiativeRole}" data-duel-initiative-status="${escapeHtml(initiativeRole)}" title="第${escapeHtml(initiativeRound)}回合${escapeHtml(initiativeLabel)}：${escapeHtml(initiativeDetail)}" aria-label="第${escapeHtml(initiativeRound)}回合${escapeHtml(initiativeLabel)}，${escapeHtml(initiativeDetail)}">${escapeHtml(initiativeLabel)}</span>`
    : "";
  const conditionTags = (Array.isArray(resource.statusEffects) ? resource.statusEffects : [])
    .map(formatDuelStatusEffectLabel)
    .map((label) => `<span class="duel-status-tag condition">${escapeHtml(label)}</span>`)
    .join("");
  const statusMarkup = initiativeTag || conditionTags
    ? `${initiativeTag}${conditionTags}`
    : `<span class="duel-status-empty">无</span>`;
  const domainText = resource.domain?.threshold
    ? `${resource.domain.active ? "维持中" : "未展开"} · ${formatNumber(resource.domain.load)} / ${formatNumber(resource.domain.threshold)}`
    : "无领域负荷";
  return `
    <article class="duel-resource-side${resource.side === "right" ? " right" : ""}">
      <div class="duel-resource-head">
        <strong>${escapeHtml(resource.name)}</strong>
        <span>${escapeHtml(sideLabel)} · ${escapeHtml(getDuelDisplayGrade(profile))}</span>
      </div>
      ${renderDuelResourceBar("体势", resource.hp, resource.maxHp, hpRatio, "hp", preview?.hp)}
      ${renderDuelResourceBar("咒力", resource.ce, resource.maxCe, ceRatio, "ce", preview?.ce)}
      <div class="duel-resource-meta">
        <span>咒力回流 <strong>+${escapeHtml(formatNumber(resource.ceRegen))}</strong> / 回合</span>
        <span>咒力稳定 <strong>${escapeHtml(formatPercent(resource.stability))}</strong></span>
      </div>
      ${renderDuelBattleSpecialCounterWindow(battle, resource.side)}
      <div class="duel-domain-load">
        <span>领域负荷</span>
        <strong>${escapeHtml(domainText)}</strong>
        <div class="duel-resource-bar domain"><i style="width:${domainRatio * 100}%"></i></div>
      </div>
      <div class="duel-status-effects"><span class="duel-status-heading">状态栏</span><strong class="duel-status-content">${statusMarkup}</strong></div>
    </article>
  `;
}

function renderDuelCompactTurnExecuteButton(battle = state.duelBattle) {
  const control = getDuelTurnExecuteControlState(battle);
  return `
    <button class="primary mini duel-native-lock-button" data-duel-compact-execute type="button"
      ${control.disabled ? "disabled" : ""} title="${escapeHtml(control.resolveHint)}" aria-label="${escapeHtml(control.buttonText)}">
      ${escapeHtml(control.buttonText)}
    </button>
  `;
}

function renderDuelResourceBar(label, value, max, ratio, kind, previewValue = null) {
  const hasPreview = previewValue !== null && previewValue !== undefined && Number.isFinite(Number(previewValue)) && Math.abs(Number(previewValue) - Number(value || 0)) >= 0.05;
  const baseRatio = clamp(ratio, 0, 1);
  const previewRatio = hasPreview && max ? clamp(Number(previewValue) / max, 0, 1) : baseRatio;
  const segmentLeft = Math.min(baseRatio, previewRatio) * 100;
  const segmentWidth = Math.abs(previewRatio - baseRatio) * 100;
  const previewSegment = hasPreview
    ? `<em class="${previewRatio >= baseRatio ? "preview-gain" : "preview-loss"}" style="left:${segmentLeft}%;width:${segmentWidth}%"></em>`
    : "";
  const valueText = hasPreview
    ? `${formatNumber(value)} → ${formatNumber(previewValue)} / ${formatNumber(max)}`
    : `${formatNumber(value)} / ${formatNumber(max)}`;
  return `
    <div class="duel-resource-row ${escapeHtml(kind)}">
      <div><span>${escapeHtml(label)}</span><strong class="${hasPreview ? "preview-value" : ""}">${escapeHtml(valueText)}</strong></div>
      <div class="duel-resource-bar"><i style="width:${baseRatio * 100}%"></i>${previewSegment}</div>
    </div>
  `;
}

function renderDuelResidualLog(battle = state.duelBattle) {
  const entries = battle?.resourceState?.residualLog || [];
  if (!entries.length) return `<div class="duel-residual-log empty">残秽记录等待第一回合资源变化。</div>`;
  const visibleEntries = entries.slice(0, 10);
  const categoryCounts = visibleEntries.reduce((acc, entry) => {
    const category = entry.category || entry.type || inferDuelLogCategory(entry);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const categoryBadges = Object.entries(DUEL_LOG_CATEGORY_LABELS)
    .filter(([category]) => categoryCounts[category])
    .map(([category, label]) => `<span class="duel-log-filter ${escapeHtml(category)}">${escapeHtml(label)} ${escapeHtml(categoryCounts[category])}</span>`)
    .join("");
  return `
    <details class="duel-residual-log">
      <summary class="duel-residual-log-head">
        <strong>残秽记录</strong>
        <div class="duel-log-filters">${categoryBadges}</div>
      </summary>
      <ol>
        ${visibleEntries.map((entry) => {
          const category = entry.category || entry.type || inferDuelLogCategory(entry);
          return `
          <li class="duel-log-entry ${escapeHtml(category)}">
            <span class="duel-log-round">R${escapeHtml(entry.round)}</span>
            <span class="duel-log-type">${escapeHtml(DUEL_LOG_CATEGORY_LABELS[category] || entry.categoryLabel || "记录")}</span>
            <strong>${escapeHtml(entry.title)}</strong>
            <p>${escapeHtml(entry.detail)}</p>
            ${renderDuelTrialLogContext(entry, battle)}
          </li>
        `;
        }).join("")}
      </ol>
    </details>
  `;
}

function applyPendingDuelHandAnimations(container, battle = state.duelBattle) {
  const pending = Array.isArray(battle?.pendingDuelHandAnimations)
    ? battle.pendingDuelHandAnimations.slice()
    : [];
  if (battle) battle.pendingDuelHandAnimations = [];
  if (!container || !pending.length) return;
  const panel = container.querySelector?.(".duel-action-panel");
  if (!panel) return;
  const allCards = Array.from(panel.querySelectorAll?.(".duel-hand-card[data-duel-card-id]") || []);
  pending.forEach((entry) => {
    const mode = entry?.mode === "lock" ? "lock" : (entry?.mode === "play" ? "play" : "deal");
    const key = String(entry?.key || "");
    if (!key) return;
    const lastKeyField = mode === "deal" ? "lastDealingAnimationKey" : "lastHandActionAnimationKey";
    if (battle[lastKeyField] === key) return;
    const wanted = new Set((entry.ids || []).map(String));
    const cards = allCards.filter((card) => wanted.has(String(card.dataset?.duelCardId || "")));
    const panelClass = `${mode}-animation`;
    const cardClass = mode === "deal" ? "deal-in" : `${mode}-out`;
    const tokenField = mode === "deal" ? "duelDealAnimationKey" : "duelActionAnimationKey";
    panel.dataset[tokenField] = key;
    panel.classList.add(panelClass);
    cards.forEach((card, index) => {
      card.classList.add(cardClass, `${mode}-variant-${(index % 4) + 1}`);
    });
    battle[lastKeyField] = key;
    duelRenderPerformance.animationsApplied += 1;
    window.setTimeout?.(() => {
      if (!panel.isConnected || panel.dataset?.[tokenField] !== key) return;
      panel.classList.remove(panelClass);
      cards.forEach((card, index) => {
        card.classList.remove(cardClass, `${mode}-variant-${(index % 4) + 1}`);
      });
      delete panel.dataset[tokenField];
    }, mode === "deal" ? 1100 : 1250);
  });
}

function renderDuelBattlePanel(left, right, baseRate) {
  if (!els.duelBattle) return;
  const battle = state.duelBattle;
  const dounaPage = isDounaBattlePageActive();
  const shibuyaActivity = battle?.activityContext?.type === "shibuya";
  const activityOwnsBattlePanel = shibuyaActivity;
  if (!battle || (!activityOwnsBattlePanel && (battle.left.id !== left.id || battle.right.id !== right.id))) {
    syncDuelBattleFocusMode(null);
    if (isOnlineDuelModeActive()) {
      commitDuelHtml(els.duelBattle, `
        <div class="duel-battle-empty">
          <div>
            <strong>联机战斗初始化中</strong>
            <p class="muted">双方锁定角色后会自动进入联机手札界面；不需要点击单人开战按钮。</p>
          </div>
        </div>
      `);
      els.duelStartBtn.textContent = "联机进行中";
      els.duelStartBtn.disabled = true;
      return;
    }
    if (dounaPage) {
      const changed = commitDuelHtml(els.duelBattle, `
        <div class="duel-battle-empty">
          <div>
            <strong>斗傩大陆赛前情报已生成</strong>
            <p class="muted">点击“开始挑战宿傩”后，5 名挑战者会依次上阵；宿傩不会因为挑战者更替而刷新状态。</p>
          </div>
          <button class="primary" id="duelInlineStartBtn" type="button">开始挑战宿傩</button>
        </div>
      `);
      els.duelStartBtn.textContent = "开始挑战宿傩";
      els.duelStartBtn.disabled = false;
      if (changed) els.duelBattle.querySelector("#duelInlineStartBtn")?.addEventListener("click", startDounaGauntletBattle);
      return;
    }
    const changed = commitDuelHtml(els.duelBattle, `
      <div class="duel-battle-empty">
        <div>
          <strong>赛前情报已生成</strong>
          <p class="muted">点击“开战”后先选赛前策略，再逐阶段推进战斗。${escapeHtml(getDuelRoundRuleText(left, right))}；战力只改变事件权重，不直接跳过战斗。</p>
        </div>
        <button class="primary" id="duelInlineStartBtn" type="button">开战</button>
      </div>
    `);
    els.duelStartBtn.textContent = "开战";
    els.duelStartBtn.disabled = false;
    if (changed) els.duelBattle.querySelector("#duelInlineStartBtn")?.addEventListener("click", startDuelBattle);
    return;
  }

  syncActiveDuelBattlePage(battle);
  syncDuelBattleFocusMode(battle);

  if (battle.onlineSpectator) {
    renderDuelSpectatorBattlePanel(battle);
    return;
  }

  globalThis.JJKDuelMobileInteraction?.captureBattlePaneScroll?.(els.duelBattle);

  const leftTactic = getDuelTacticDefinition(battle.selectedTactic);
  const rightTactic = getDuelTacticDefinition(battle.opponentTactic);
  const safetyRoundCap = battle.safetyRoundCap || getDuelSafetyRoundCap(battle);
  const roundBadge = battle.resolved
    ? `第 ${formatNumber(battle.round)} 回合结束`
    : `第 ${formatNumber(battle.round + 1)} 回合 / 安全上限 ${formatNumber(safetyRoundCap)}`;
  const statusRows = renderDuelBattleStatus(battle);
  const tacticButtons = getDuelTactics().map((tactic) => `
    <button class="duel-tactic${battle.selectedTactic === tactic.id ? " active" : ""}" data-duel-tactic="${escapeHtml(tactic.id)}" type="button" ${battle.autoRunning || battle.resolved || battle.round > 0 ? "disabled" : ""}>
      <strong>${escapeHtml(tactic.label)}</strong>
      <span>${escapeHtml(tactic.description)}</span>
    </button>
  `).join("");
  const resultMarkup = battle.resolved ? renderDuelBattleResult(battle) : renderDuelAutoPanel(battle, leftTactic, rightTactic);

  els.duelStartBtn.textContent = battle.dounaGauntlet
    ? getDounaStartButtonLabel()
    : (battle.resolved ? "再打一场" : battle.autoRunning ? "阶段生成中" : "重开");
  els.duelStartBtn.disabled = battle.autoRunning;
  const battleMarkup = `
    <div class="duel-battle-stage">
      ${renderDuelFloatingCombatText(battle)}
      ${renderDounaSwapNotice(battle)}
      <div class="duel-battle-head">
        <div>
          <span class="badge">${escapeHtml(roundBadge)}</span>
          <h3>${escapeHtml(battle.left.name)} 对 ${escapeHtml(battle.right.name)}</h3>
          <p class="muted">${escapeHtml(getDuelRoundRuleText(battle.left, battle.right))}</p>
          ${battle.mode === "solo" ? `<p class="muted">电脑难度：${escapeHtml(battle.cpuDifficultyLabel || getDuelCpuDifficultyLabel(battle.cpuDifficulty))}</p>` : ""}
          ${battle.mode === "solo" ? `<p class="muted">人机运算：${escapeHtml(battle.cpuComputeModeLabel || getDuelCpuComputeModeLabel(battle.cpuComputeMode))}</p>` : ""}
        </div>
        <div class="duel-battle-head-actions">
          <button class="secondary" id="duelExitFocusBtn" type="button">${shibuyaActivity ? "返回事件树" : "返回完整界面"}</button>
          ${shibuyaActivity ? "" : '<button class="secondary" id="duelResetBtn" type="button">清空战局</button>'}
        </div>
      </div>
      ${statusRows}
      <nav class="duel-native-nav" aria-label="手机战斗视图">
        <button class="secondary mini" data-duel-native-view="hand" type="button" aria-selected="true">手牌与先手</button>
        <button class="secondary mini" data-duel-native-view="status" type="button" aria-selected="false">状态栏</button>
        ${renderDuelCompactTurnExecuteButton(battle)}
        <button class="secondary mini" data-duel-native-view="tactics" type="button" aria-selected="false">战斗倾向</button>
        <button class="secondary mini" data-duel-native-view="report" type="button" aria-selected="false">战报</button>
        <button class="secondary mini duel-native-exit-button" data-duel-compact-exit type="button" aria-label="${shibuyaActivity ? "返回事件树" : "退出战斗"}">${shibuyaActivity ? "事件树" : "退出战斗"}</button>
        <button class="secondary mini duel-mobile-mode-toggle" data-duel-pane-mode-toggle type="button" aria-pressed="true" hidden>放大右栏</button>
      </nav>
      ${renderDuelActionChoices(battle)}
      <div class="duel-battle-support-grid">
        ${renderDuelResourcePanel(battle)}
        ${renderDuelBattlefieldUnitsPanel(battle)}
        ${renderDuelDomainProfilePanel(battle)}
      </div>
      <div class="duel-interaction">
        <details class="duel-tactic-panel" ${battle.round === 0 && !battle.resolved ? "open" : ""}>
          <summary>
            <strong>战斗倾向</strong>
            <span>整场倾向；术式手札才影响当前回合</span>
          </summary>
          <div class="duel-tactics">${tacticButtons}</div>
        </details>
        <section class="duel-round-panel">
          <h4>阶段战斗推演</h4>
          ${resultMarkup}
        </section>
      </div>
      <div class="duel-native-report-pane">
        ${renderDuelBetaFeedbackPanel(battle)}
        ${renderDuelBattleLog(battle)}
        ${renderDuelReplayMeta(battle)}
        ${renderDuelResidualLog(battle)}
      </div>
    </div>
  `;
  if (commitDuelHtml(els.duelBattle, battleMarkup)) bindDuelBattleControls();
  globalThis.JJKDuelMobileInteraction?.bindBattlePaneScroll?.(els.duelBattle);
  applyPendingDuelHandAnimations(els.duelBattle, battle);
  restoreDuelAutoRunScroll(battle);
}

function renderDuelSpectatorBattlePanel(battle) {
  if (!els.duelBattle) return;
  const leftActions = battle.spectatorActions?.left || [];
  const rightActions = battle.spectatorActions?.right || [];
  const renderSpectatorCard = (entry, side, index) => {
    const action = entry?.action || entry?.actionSnapshot || entry;
    const normalized = {
      ...action,
      id: action?.id || entry?.actionId || `spectator_${side}_${index + 1}`,
      actionId: entry?.actionId || action?.actionId || action?.id || `spectator_${side}_${index + 1}`,
      label: action?.label || action?.name || entry?.displayName || entry?.actionId || "已锁定手札",
      name: action?.name || action?.label || entry?.displayName || entry?.actionId || "已锁定手札",
      cardType: action?.cardType || entry?.cardType || action?.type || "action",
      apCost: action?.apCost ?? entry?.apCost ?? 0,
      ceCost: action?.cost?.ce ?? action?.cost?.flatCe ?? action?.ceCost ?? entry?.ceCost ?? 0,
      skinCategory: entry?.skinCategory || entry?.cardSkinCategory || action?.skinCategory || action?.cardSkinCategory || "",
      cardSkinCategory: entry?.cardSkinCategory || entry?.skinCategory || action?.cardSkinCategory || action?.skinCategory || "",
      visualCardSkin: entry?.visualCardSkin || entry?.cardSkin || action?.visualCardSkin || action?.cardSkin || entry?.visualSettings?.cardSkin || action?.visualSettings?.cardSkin || "",
      cardSkin: entry?.cardSkin || entry?.visualCardSkin || action?.cardSkin || action?.visualCardSkin || entry?.visualSettings?.cardSkin || action?.visualSettings?.cardSkin || "",
      visualSettings: entry?.visualSettings || action?.visualSettings || null,
      tags: Array.isArray(action?.tags) && action.tags.length ? action.tags : (Array.isArray(entry?.tags) ? entry.tags : []),
      uiTags: Array.isArray(action?.uiTags) && action.uiTags.length ? action.uiTags : (Array.isArray(entry?.uiTags) ? entry.uiTags : []),
      specialHandTags: Array.isArray(action?.specialHandTags) && action.specialHandTags.length ? action.specialHandTags : (Array.isArray(entry?.specialHandTags) ? entry.specialHandTags : []),
      domainHand: Boolean(entry?.domainHand || action?.domainHand),
      domainSpecific: Boolean(entry?.domainSpecific || action?.domainSpecific),
      specialHandCard: Boolean(entry?.specialHandCard || action?.specialHandCard),
      techniqueFeatureHand: Boolean(entry?.techniqueFeatureHand || action?.techniqueFeatureHand)
    };
    return renderDuelActionChoice(normalized, new Set(), battle, new Map(), { spectator: true, side });
  };
  const renderSpectatorHand = (side, actions) => `
    <aside class="duel-spectator-hand ${escapeHtml(side)}">
      <h4>${side === "left" ? "左方手札" : "右方手札"}</h4>
      <div class="duel-spectator-hand-list">
        ${actions.length ? actions.map((entry, index) => renderSpectatorCard(entry, side, index)).join("") : `<p class="muted">等待本回合手札锁定；上一回合卡面会保留到下一次锁定。</p>`}
      </div>
    </aside>
  `;
  els.duelStartBtn.disabled = true;
  commitDuelHtml(els.duelBattle, `
    <div class="duel-spectator-stage">
      <div class="duel-spectator-focus-actions">
        <button class="secondary" type="button" data-online-spectator-exit>退出观战</button>
      </div>
      <div class="duel-spectator-top">
        ${renderDuelBattleStatus(battle)}
        ${renderDuelResourcePanel(battle)}
        ${renderDuelBattlefieldUnitsPanel(battle)}
        ${renderDuelDomainProfilePanel(battle)}
      </div>
      <div class="duel-spectator-layout">
        ${renderSpectatorHand("left", leftActions)}
        <main class="duel-spectator-center">
          <section class="duel-round-panel compact">
            <h4>阶段战斗推演</h4>
            ${battle.resolved ? renderDuelBattleResult(battle) : renderDuelAutoPanel(battle, getDuelTacticDefinition(battle.selectedTactic), getDuelTacticDefinition(battle.opponentTactic))}
          </section>
          ${renderDuelBattleLog(battle)}
        </main>
        ${renderSpectatorHand("right", rightActions)}
      </div>
    </div>
  `);
}

function renderDuelFloatingCombatText(battle) {
  if (isDuelLiteModeActive()) return "";
  const entry = battle?.floatingCombatText || null;
  if (!entry?.text) return "";
  if (Number(entry.expiresAt || 0) && Number(entry.expiresAt || 0) < Date.now()) {
    delete battle.floatingCombatText;
    return "";
  }
  const type = String(entry.type || "miss").replace(/[^a-z0-9_-]+/gi, "");
  const side = String(entry.side || "").replace(/[^a-z0-9_-]+/gi, "");
  return `<div class="duel-floating-combat-text ${escapeHtml(type)} ${escapeHtml(side)}" role="status" aria-live="polite">${escapeHtml(entry.text)}</div>`;
}

function renderDuelAutoPanel(battle, leftTactic, rightTactic) {
  const room = battle?.onlineRoomSnapshot || {};
  const viewerSide = battle?.onlinePlayerSide || "left";
  const synchronizedCommits = room.syncState?.lastReveal?.commits || room.syncState?.commits || room.turnState?.actions || {};
  const synchronized = globalThis.JJKOnlineDuelSync?.mapSynchronizedTactics?.(synchronizedCommits, viewerSide);
  if (synchronized?.leftTactic) leftTactic = getDuelTacticDefinition(synchronized.leftTactic);
  if (synchronized?.rightTactic) rightTactic = getDuelTacticDefinition(synchronized.rightTactic);
  const latest = battle.log[0];
  const safetyRoundCap = battle.safetyRoundCap || getDuelSafetyRoundCap(battle);
  const progress = safetyRoundCap ? clamp((battle.round / safetyRoundCap) * 100, 0, 100) : 0;
  const onlineMode = isOnlineDuelModeActive();
  const leftLabel = getDuelPerspectiveSideLabel("left", battle);
  const rightLabel = getDuelPerspectiveSideLabel("right", battle);
  return `
    <div class="duel-auto-stage">
      <div class="duel-current-choice">
        <span>${escapeHtml(leftLabel)}策略：<strong>${escapeHtml(leftTactic.label)}</strong></span>
        <span>${escapeHtml(rightLabel)}倾向：<strong>${escapeHtml(rightTactic.label)}</strong></span>
      </div>
      <div class="duel-auto-meter" aria-label="战斗推演进度">
        <span style="width:${progress}%"></span>
      </div>
      ${latest ? `
        <article class="duel-auto-latest">
          <span>R${escapeHtml(latest.round)}</span>
          <strong>${escapeHtml(latest.title)}</strong>
          <p>${escapeHtml(latest.detail)}</p>
        </article>
      ` : `
        <div class="duel-auto-empty">${onlineMode ? "选择联机手札后，点击锁定行动等待对方。" : "选择术式手札后，点击执行回合推进战斗阶段。"}</div>
      `}
    </div>
  `;
}

function bindDuelBattleControls() {
  if (!els.duelBattle || !state.duelBattle) return;
  syncDuelResponsiveBattleLayout();
  refreshDuelNativeBattleControls();
  els.duelBattle.querySelectorAll("[data-duel-native-view]").forEach((button) => {
    bindDuelControlOnce(button, "click", "native-view", () => {
      setDuelNativeBattleView(button.dataset.duelNativeView || "hand", { userInitiated: true });
      button.blur?.();
    });
  });
  els.duelBattle.querySelectorAll("[data-duel-pane-mode-toggle]").forEach((button) => {
    bindDuelControlOnce(button, "click", "pane-mode", () => {
      toggleDuelBattlePaneMode();
      button.blur?.();
    });
  });
  const exitFocus = () => {
    if (!state.duelBattle) return;
    state.duelBattle.focusModeDismissed = true;
    syncDuelBattleFocusMode(state.duelBattle);
    if (state.duelBattle.activityContext?.type === "shibuya") {
      getBattlePageModule()?.activateBattlePage?.("shibuya", { primeMode: false });
      document.querySelector("#shibuyaRunSurface")?.scrollIntoView?.({ block: "start", behavior: "auto" });
    } else {
      document.querySelector("#duel")?.scrollIntoView?.({ block: "start", behavior: "auto" });
    }
  };
  bindDuelControlOnce(els.duelBattle.querySelector("#duelExitFocusBtn"), "click", "exit-focus", exitFocus);
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-compact-exit]"), "click", "compact-exit-focus", exitFocus);
  els.duelBattle.querySelectorAll("[data-online-spectator-exit]").forEach((button) => {
    bindDuelControlOnce(button, "click", "online-spectator-exit", () => {
      document.querySelector("#onlineExitSpectatorBtn")?.click();
    });
  });
  bindDuelControlOnce(els.duelBattle.querySelector("#duelResetBtn"), "click", "reset", () => {
    const battle = state.duelBattle;
    const onlineRoomId = String(battle?.onlineRoomId || "");
    const onlineRoom = onlineRoomId && globalThis.JJKOnline?.getUiState?.()?.currentRoom;
    const isOnlineBattle = battle?.mode === "online" || Boolean(onlineRoomId);
    if (!isOnlineBattle || !(globalThis.JJKOnline?.leaveAfterSettlement || globalThis.JJKOnline?.leaveRoom)) {
      clearCurrentDuelBattle();
      return;
    }
    const onlineState = globalThis.JJKOnline.getUiState?.() || {};
    const roomId = onlineRoomId || String(onlineRoom?.roomId || onlineState.roomId || "");
    const side = String(onlineState.side || battle?.onlinePlayerSide || "");
    const playerId = String(onlineState.playerId || "");
    const finish = () => globalThis.JJKOnline.returnToBattleHomeAfterRoomExit?.("已清空并退出联机房间，已清理本地对战缓存。");
    Promise.resolve()
      .then(() => (globalThis.JJKOnline.leaveAfterSettlement || globalThis.JJKOnline.leaveRoom)(roomId, { playerId, side }))
      .then(finish)
      .catch((error) => {
        const status = Number(error?.status || error?.responseStatus || 0);
        if (status === 404 || /房间不存在|房间已结束|room.*(not found|ended)/i.test(String(error?.message || ""))) {
          finish();
          return;
        }
        if (state.duelBattle) {
          state.duelBattle.actionUiMessage = `退出联机房间失败：${error?.message || "请稍后重试。"}`;
          requestDuelInteractionRender();
        }
      });
  });
  bindDuelControlOnce(els.duelBattle.querySelector("#duelAutoRunBtn"), "click", "auto-run", () => {
    blurDuelActionFocus();
    runDuelAutoBattle();
  });
  bindDuelControlOnce(els.duelBattle.querySelector("#duelOnlineLockFromHandBtn"), "click", "online-lock", () => {
    blurDuelActionFocus();
    if (globalThis.JJKOnline?.lockSelectedTurnFromBattle) {
      const { actorSide } = getDuelSideResources(state.duelBattle);
      markDuelHandActionAnimation(state.duelBattle, actorSide, "lock");
      state.duelBattle.actionUiMessage = "正在发送联机行动...";
      requestDuelInteractionRender();
      Promise.resolve().then(() => globalThis.JJKOnline.lockSelectedTurnFromBattle()).then((room) => {
        if (!state.duelBattle) return;
        if (room) {
          syncOnlineRoomState(room, room.viewerSide || state.duelModeState.playerSide || "left");
          return;
        }
        state.duelBattle.actionUiMessage = "行动已发送，等待服务器同步。";
        requestDuelInteractionRender();
      }).catch((error) => {
        if (state.duelBattle) {
          state.duelBattle.actionUiMessage = error?.debugDetail?.timedOut
            ? "锁定请求已提交但服务器确认超时，正在保持本地锁定并等待轮询确认。"
            : `联机行动提交失败：${error?.message || "请检查房间状态后重试。"}`;
          requestDuelInteractionRender();
        }
      });
      return;
    }
    document.querySelector("#onlineLockTurnBtn")?.click();
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-compact-execute]"), "click", "compact-execute", () => {
    const control = getDuelTurnExecuteControlState(state.duelBattle);
    if (control.disabled) return;
    const source = control.id === "duelOnlineLockFromHandBtn"
      ? els.duelBattle.querySelector("#duelOnlineLockFromHandBtn")
      : els.duelBattle.querySelector("#duelAutoRunBtn");
    source?.click();
  });
  bindDuelControlOnce(els.duelBattle.querySelector("#duelAiBattleTextBtn"), "click", "ai-narrative", generateDuelBattleNarrative);
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-hand-clear]"), "click", "hand-clear", () => {
    blurDuelActionFocus();
    const { actorSide } = getDuelSideResources(state.duelBattle);
    clearDuelSelectedHandActions(state.duelBattle, actorSide);
    if (state.duelBattle) {
      state.duelBattle.pendingAction = null;
      state.duelBattle.actionUiMessage = "";
    }
    updateDuelResourceReplayKey(state.duelBattle);
    requestDuelInteractionRender();
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-hand-undo]"), "click", "hand-undo", () => {
    blurDuelActionFocus();
    const { actorSide, actor, opponent } = getDuelSideResources(state.duelBattle);
    const selected = getDuelSelectedHandActions(state.duelBattle, actorSide);
    const last = selected[selected.length - 1];
    if (last) unselectDuelHandCandidate(last.actionId || last.id, actor, opponent, state.duelBattle, { side: actorSide });
    if (state.duelBattle) {
      const remaining = getDuelSelectedHandActions(state.duelBattle, actorSide);
      state.duelBattle.pendingAction = remaining[0]?.action || null;
      state.duelBattle.actionUiMessage = "";
    }
    updateDuelResourceReplayKey(state.duelBattle);
    requestDuelInteractionRender();
  });
  els.duelBattle.querySelectorAll("[data-duel-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "hand-action-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "hand-action-select", () => selectDuelAction(button.dataset.duelAction || "", button.dataset.cardInstanceId || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-haruta-counter-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "haruta-counter-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "haruta-counter-select", () => selectDuelAction(button.dataset.duelHarutaCounterAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-tower-counter-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "tower-counter-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "tower-counter-select", () => selectDuelAction(button.dataset.duelTowerCounterAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-dagon-counter-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "dagon-counter-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "dagon-counter-select", () => selectDuelAction(button.dataset.duelDagonCounterAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-choso-counter-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "choso-counter-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "choso-counter-select", () => selectDuelAction(button.dataset.duelChosoCounterAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-megumi-toji-counter-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "megumi-toji-counter-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "megumi-toji-counter-select", () => selectDuelAction(button.dataset.duelMegumiTojiCounterAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-mahito-counter-action]").forEach((button) => {
    bindDuelControlOnce(button, "pointerup", "mahito-counter-blur", () => {
      button.blur?.();
    }, { passive: true });
    bindDuelControlOnce(button, "click", "mahito-counter-select", () => selectDuelAction(button.dataset.duelMahitoCounterAction || ""));
  });
  els.duelBattle.querySelectorAll("[data-duel-uzumaki-unit]").forEach((button) => {
    bindDuelControlOnce(button, "click", "uzumaki-unit", () => {
      blurDuelActionFocus();
      toggleMaximumUzumakiUnitSelection(button.dataset.duelUzumakiUnit || "", state.duelBattle);
      updateDuelResourceReplayKey(state.duelBattle);
      requestDuelInteractionRender();
    });
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-uzumaki-all]"), "click", "uzumaki-all", () => {
    blurDuelActionFocus();
    selectAllMaximumUzumakiUnits(state.duelBattle);
    updateDuelResourceReplayKey(state.duelBattle);
    requestDuelInteractionRender();
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-uzumaki-cancel]"), "click", "uzumaki-cancel", () => {
    blurDuelActionFocus();
    cancelMaximumUzumakiSelection(state.duelBattle);
    updateDuelResourceReplayKey(state.duelBattle);
    requestDuelInteractionRender();
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-uzumaki-confirm]"), "click", "uzumaki-confirm", () => {
    blurDuelActionFocus();
    confirmMaximumUzumakiSelection(state.duelBattle);
  });
  els.duelBattle.querySelectorAll("[data-duel-discard]").forEach((button) => {
    bindDuelControlOnce(button, "click", "hand-discard", async () => {
      blurDuelActionFocus();
      const { actorSide, actor } = getDuelSideResources(state.duelBattle);
      const pendingDiscardCount = Math.max(0, Number(state.duelBattle?.handState?.[actorSide]?.pendingDiscardCount || 0));
      if (pendingDiscardCount <= 0) {
        state.duelBattle.actionUiMessage = "当前没有需要弃置的溢出手牌。";
        updateDuelResourceReplayKey(state.duelBattle);
        requestDuelInteractionRender();
        return;
      }
      const onlineRoomState = globalThis.JJKOnline?.getUiState?.() || {};
      const onlineRoom = onlineRoomState.currentRoom || {};
      const clientSynchronizedOnline = Boolean(
        globalThis.JJKOnlineDuelSync?.shouldUseClientSynchronizedTurnSubmission?.(onlineRoom) ||
        Number(onlineRoom.battleApiVersion || 0) >= 3 ||
        String(onlineRoom.simulationAuthority || "") === "client-synchronized-v1" ||
        (state.duelBattle?.mode === "online" && Boolean(state.duelBattle?.onlineRoomId)) ||
        (onlineRoom.competitionRoom === true && ["points", "ranked", "积分赛", "culling-season-2-qualifier", "culling-season-2-playoffs"].includes(String(onlineRoom.competitionType || onlineRoom.competitionFormat || "").trim().toLowerCase()))
      );
      if (state.duelBattle?.mode === "online" && !clientSynchronizedOnline && globalThis.JJKOnline?.discardHandCards) {
        try {
          state.duelBattle.actionUiMessage = "正在向服务器提交弃牌…";
          requestDuelInteractionRender();
          const room = await globalThis.JJKOnline.discardHandCards(
            state.duelBattle.onlineRoomId || onlineRoomState.roomId,
            actorSide,
            [button.dataset.duelDiscard || ""],
            {
              playerId: onlineRoomState.playerId,
              currentRoom: onlineRoomState.currentRoom
            }
          );
          syncOnlineRoomState(room, actorSide);
          state.duelBattle.suppressNextDealAnimation = true;
          const pending = Math.max(0, Number(room?.privateState?.handState?.pendingDiscardCount || 0));
          state.duelBattle.actionUiMessage = pending > 0
            ? `已弃置，仍需弃牌 ${formatNumber(pending)} 张。`
            : "弃牌完成，可以选择手札。";
        } catch (error) {
          state.duelBattle.actionUiMessage = `弃牌失败：${String(error?.message || error || "服务器拒绝请求")}`;
        }
        updateDuelResourceReplayKey(state.duelBattle);
        requestDuelInteractionRender();
        return;
      }
      const result = discardDuelHandCandidate(button.dataset.duelDiscardAction || button.dataset.duelDiscard || "", actor, state.duelBattle, { side: actorSide });
      if (state.duelBattle) {
        if (result.discarded) state.duelBattle.suppressNextDealAnimation = true;
        state.duelBattle.actionUiMessage = result.discarded
          ? (result.pendingDiscardCount > 0 ? `已弃置，仍需弃牌 ${formatNumber(result.pendingDiscardCount)} 张。` : "弃牌完成，可以选择手札。")
          : (result.reason || "弃牌失败");
        state.duelBattle.actionChoices = state.duelBattle.handState?.[actorSide]?.cards || state.duelBattle.actionChoices || [];
      }
      updateDuelResourceReplayKey(state.duelBattle);
      requestDuelInteractionRender();
    });
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-feedback-export]"), "click", "feedback-export", () => {
    exportDuelBetaFeedbackPackage({ copy: false });
  });
  bindDuelControlOnce(els.duelBattle.querySelector("[data-duel-feedback-copy]"), "click", "feedback-copy", () => {
    exportDuelBetaFeedbackPackage({ copy: true });
  });
  els.duelBattle.querySelectorAll("[data-duel-tactic]").forEach((button) => {
    bindDuelControlOnce(button, "click", "tactic", () => {
      if (!state.duelBattle || state.duelBattle.autoRunning || state.duelBattle.resolved || state.duelBattle.round > 0) return;
      blurDuelActionFocus();
      state.duelBattle.selectedTactic = button.dataset.duelTactic || "balanced";
      state.duelBattle.operations = [`strategy:${state.duelBattle.selectedTactic}`];
      updateDuelResourceReplayKey(state.duelBattle);
      state.duelBattle.currentOptions = [];
      state.duelBattle.selectedIndex = null;
      requestDuelInteractionRender(".duel-tactic-panel");
    });
  });
  els.duelBattle.querySelectorAll("[data-duel-initiative-investment]").forEach((button) => {
    bindDuelControlOnce(button, "click", "initiative-investment", () => {
      if (!state.duelBattle || state.duelBattle.autoRunning || state.duelBattle.resolved) return;
      if (state.duelBattle.mode === "online" && (state.duelBattle.onlinePlayerSide === "spectator" || state.duelModeState.localLocked)) return;
      blurDuelActionFocus();
      const side = getDuelControlledSide(state.duelBattle);
      setDuelInitiativeInvestment(state.duelBattle, side, Number(button.dataset.duelInitiativeInvestment || 0));
      updateDuelResourceReplayKey(state.duelBattle);
      requestDuelInteractionRender(".duel-initiative-control");
    });
  });
}

function renderDuelBattleStatus(battle) {
  const diff = battle.leftScore - battle.rightScore;
  const leftWidth = clamp(50 + diff * 5, 8, 92);
  const rightWidth = 100 - leftWidth;
  return `
    <div class="duel-battle-status">
      <div class="duel-side-score">
        <strong>${escapeHtml(battle.left.name)}</strong>
        <span>${formatNumber(battle.leftScore)} 点</span>
      </div>
      <div class="duel-score-track" aria-label="战局优势">
        <span style="width:${leftWidth}%"></span>
        <span style="width:${rightWidth}%"></span>
      </div>
      <div class="duel-side-score right">
        <strong>${escapeHtml(battle.right.name)}</strong>
        <span>${formatNumber(battle.rightScore)} 点</span>
      </div>
    </div>
    ${renderDounaGauntletStatus(battle)}
  `;
}

function getDuelSpecialCounterEntries(battle, side) {
  const listCounters = globalThis.JJKDuelCounterPipeline?.listCounters;
  const entries = typeof listCounters === "function"
    ? listCounters(battle, side, { visibleOnly: true })
    : [];
  return entries
    .filter((entry) => entry && entry.label && Number.isFinite(Number(entry.value)) && Math.abs(Number(entry.value)) > 0.0001)
    .filter((entry) => !(side === "right" && getHarutaInteractionState(battle) && String(entry.label) === "奇迹储备"))
    .map((entry) => ({
      id: entry.id || entry.label,
      label: String(entry.label),
      value: Number(entry.value),
      format: entry.format || "percent"
    }));
}

function formatDuelSpecialCounterValue(entry) {
  if (entry?.format === "number") return formatNumber(entry.value);
  if (entry?.format === "signed-number") return `${entry.value > 0 ? "+" : ""}${formatNumber(entry.value)}`;
  return formatPercent(entry.value);
}

function renderDuelSpecialCounterRow(label, entries) {
  if (!entries.length) return "";
  const labelNode = label ? `<span>${escapeHtml(label)}</span>` : "";
  return `
    <div class="duel-special-counter-row${label ? "" : " no-label"}">
      ${labelNode}
      <div>
        ${entries.map((entry) => `
          <span class="duel-special-counter-chip">
            <b>${escapeHtml(entry.label)}</b>
            <strong>${escapeHtml(formatDuelSpecialCounterValue(entry))}</strong>
          </span>
        `).join("")}
      </div>
    </div>
  `;
}

function renderDuelBattleSpecialCounterWindow(battle, side = "") {
  if (side) {
    const entries = getDuelSpecialCounterEntries(battle, side);
    if (!entries.length) return "";
    return `
      <div class="duel-battle-special-counters">
        ${renderDuelSpecialCounterRow("", entries)}
      </div>
    `;
  }
  const leftEntries = getDuelSpecialCounterEntries(battle, "left");
  const rightEntries = getDuelSpecialCounterEntries(battle, "right");
  if (!leftEntries.length && !rightEntries.length) {
    return `<div class="duel-battle-special-counters empty"></div>`;
  }
  return `
    <div class="duel-battle-special-counters">
      ${renderDuelSpecialCounterRow(getDuelPerspectiveSideLabel("left", battle), leftEntries)}
      ${renderDuelSpecialCounterRow(getDuelPerspectiveSideLabel("right", battle), rightEntries)}
    </div>
  `;
}

function renderDuelBattleLog(battle) {
  if (!battle.log.length) {
    return `<div class="duel-log empty">等待第一回合。</div>`;
  }
  return `
    <details class="duel-log-panel">
      <summary><strong>战斗日志</strong><span>${escapeHtml(battle.log.length)} 条</span></summary>
      <ol class="duel-log">
        ${battle.log.map((entry) => `
          <li>
            <span>R${entry.round}</span>
            <strong>${escapeHtml(entry.title)}</strong>
            <p>${escapeHtml(entry.detail)}</p>
          </li>
        `).join("")}
      </ol>
    </details>
  `;
}

function renderDuelInitiativeControl(battle = state.duelBattle) {
  if (!battle || battle.resolved) return "";
  const side = getDuelControlledSide(battle);
  const actor = side === "right" ? battle.resourceState?.p2 : battle.resourceState?.p1;
  const selected = getDuelInitiativeInvestment(battle, side);
  const round = Number(battle.round || 0) + 1;
  const last = battle.initiativeHistory?.[0];
  const onlineSelectionLocked = battle.mode === "online" && (battle.onlinePlayerSide === "spectator" || state.duelModeState.localLocked);
  const selectionLocked = Boolean(battle.autoRunning || onlineSelectionLocked);
  const remainingHp = Math.max(0, Number(actor?.hp || 0) - Number(selected || 0));
  const tactic = getDuelTacticDefinition(battle.selectedTactic);
  const buttons = getDuelInitiativeInvestments().map((amount) => {
    const affordable = Number(amount) < Math.max(1, Number(actor?.hp || 0));
    const selectedLabel = selected === amount ? "，当前选择" : "";
    return `<button class="secondary mini duel-initiative-option${selected === amount ? " active" : ""}" data-duel-initiative-investment="${escapeHtml(amount)}" type="button" aria-pressed="${selected === amount ? "true" : "false"}" aria-label="投入 ${escapeHtml(amount)} 体势${selectedLabel}" ${selectionLocked || !affordable ? "disabled" : ""}>${escapeHtml(amount)} 体势</button>`;
  }).join("");
  const lastText = last
    ? `上一轮：左方 ${formatNumber(last.leftInvestment)} / 右方 ${formatNumber(last.rightInvestment)}，${getDuelPerspectiveSideLabel(last.firstSide, battle)}先攻。`
    : "尚未结算先手。";
  return `
    <section class="duel-initiative-control" aria-label="第${escapeHtml(round)}回合先手争夺">
      <div>
        <strong>先手争夺 · R${escapeHtml(round)}</strong>
        <p>投入体势不会返还；投入较高者先攻。先手 CE 消耗-5%，后手承伤-10%。同档比较洞察与倾向先手值，仍相同则由战局种子判定。</p>
      </div>
      <div class="duel-initiative-options">${buttons}</div>
      <div class="duel-initiative-selection" role="status">
        <strong>${onlineSelectionLocked ? "本回合先手投入已锁定" : `已选择投入 ${formatNumber(selected)} 体势`}</strong>
        <span>锁牌后预计剩余 ${formatNumber(remainingHp)} 体势 · 战斗倾向「${escapeHtml(tactic?.label || "稳扎稳打")}」先手修正 ${formatSignedDuelDelta(Number(tactic?.initiative || 0))}</span>
      </div>
      <span>${escapeHtml(lastText)}</span>
    </section>
  `;
}

function renderDuelBattleResult(battle) {
  const isDraw = battle.winnerSide === "draw" || !battle.winnerSide;
  const winner = battle.winnerSide === "left" ? battle.left : battle.winnerSide === "right" ? battle.right : null;
  const loser = battle.winnerSide === "left" ? battle.right : battle.winnerSide === "right" ? battle.left : null;
  const endReason = battle.endReason || battle.resolutionReason || "ongoing";
  const explicitSpecialEnd = battle.specialEndCondition?.ended === true || battle.pendingSpecialEndCondition?.ended === true;
  const endReasonLabel = battle.endReasonLabel || getDuelEndReasonLabel(endReason);
  const resultTitle = explicitSpecialEnd
    ? (battle.winnerSide === "left" ? "场景目标达成" : battle.winnerSide === "right" ? "场景目标失败" : "场景目标结束")
    : isDraw ? "战斗未自然分出胜负" : `${winner.name} 胜出`;
  const resultDetail = explicitSpecialEnd && (battle.endDetail || battle.specialEndCondition?.detail || battle.pendingSpecialEndCondition?.detail)
    ? `第 ${formatNumber(battle.endingRound || battle.round)} 回合：${String(battle.endDetail || battle.specialEndCondition?.detail || battle.pendingSpecialEndCondition?.detail)}`
    : isDraw
    ? `第 ${formatNumber(battle.endingRound || battle.round)} 回合：战斗没有被旧回合数开奖收束。结束原因：${endReasonLabel}。`
    : `第 ${formatNumber(battle.endingRound || battle.round)} 回合：${loser.name} 体势被压到无法继续战斗。胜者：${winner.name}。结束原因：${endReasonLabel}。`;
  const aiMarkup = `
    <div class="duel-ai-battle">
      <button class="secondary" id="duelAiBattleTextBtn" type="button" ${battle.aiNarrativeLoading ? "disabled" : ""}>${battle.aiNarrativeLoading ? "生成中..." : "AI生成对战过程"}</button>
      ${battle.aiNarrativeError ? `<p class="error-text">${escapeHtml(battle.aiNarrativeError)}</p>` : ""}
      ${battle.aiNarrative ? `<p>${escapeHtml(battle.aiNarrative)}</p>` : ""}
    </div>
  `;
  return `
    <div class="duel-result">
      <span>结算结果</span>
      <strong>${escapeHtml(resultTitle)}</strong>
      <p>${escapeHtml(resultDetail)}</p>
      ${aiMarkup}
    </div>
  `;
}

async function generateDuelBattleNarrative() {
  const battle = state.duelBattle;
  if (!battle || !battle.resolved || battle.aiNarrativeLoading) return;

  if (typeof saveAiProviderSettings === "function") saveAiProviderSettings();
  battle.aiNarrativeLoading = true;
  battle.aiNarrativeError = "";
  renderDuelMode();
  try {
    const requireRemote = typeof getAiProviderMode === "function" ? getAiProviderMode() !== "off" : true;
    const data = await requestDuelAiAssistWithFallback(buildDuelBattleAssistPayload(battle), { requireRemote });
    battle.aiNarrative = normalizeCustomDuelLongText(data.markdown || data.battleText || "");
    if (!battle.aiNarrative) throw new Error("AI 没有返回战斗短文。");
  } catch (error) {
    battle.aiNarrativeError = buildDuelAiFailureMessage(error, { taskLabel: "AI战斗总结" });
  } finally {
    battle.aiNarrativeLoading = false;
    renderDuelMode();
  }
}

function buildDuelBattleAssistPayload(battle) {
  const winner = battle.winnerSide === "left" ? battle.left : battle.winnerSide === "right" ? battle.right : null;
  const leftTactic = getDuelTacticDefinition(battle.selectedTactic);
  const rightTactic = getDuelTacticDefinition(battle.opponentTactic);
  const resources = summarizeDuelResourceStateForAi(battle);
  const roundEvents = battle.log.slice().reverse().map((entry) => ({
    round: entry.round,
    title: entry.title,
    detail: entry.detail
  }));
  const handActions = (battle.resourceState?.resourceLog || [])
    .filter((entry) => String(entry.title || "").includes("手法"))
    .slice(0, 12)
    .reverse()
    .map((entry) => ({
      round: entry.round,
      title: entry.title,
      detail: entry.detail,
      delta: entry.delta
    }));
  const domainState = {
    final: battle.finalDomainState || null,
    trial: battle.domainTrialContext || null,
    subPhase: battle.domainSubPhase || null,
    profiles: battle.domainProfileActivations || []
  };
  const battleSummary = {
    left: summarizeDuelProfileForAi(battle.left),
    right: summarizeDuelProfileForAi(battle.right),
    winnerSide: battle.winnerSide,
    winnerName: winner?.name || (battle.winnerSide === "draw" ? "平局 / 长期僵持" : ""),
    battleEnded: Boolean(battle.resolved || battle.battleEnded),
    endReason: battle.endReason || battle.resolutionReason || "ongoing",
    endingRound: battle.endingRound || battle.round,
    finalRate: roundForPayload(battle.finalRate),
    leftScore: roundForPayload(battle.leftScore),
    rightScore: roundForPayload(battle.rightScore),
    battleId: battle.battleId,
    seed: battle.seed,
    replayKey: battle.replayKey,
    cpuDifficulty: battle.cpuDifficulty || "normal",
    cpuDifficultyLabel: battle.cpuDifficultyLabel || getDuelCpuDifficultyLabel(battle.cpuDifficulty),
    roundRule: getDuelRoundRuleText(battle.left, battle.right),
    tactics: {
      left: { id: leftTactic.id, label: leftTactic.label, description: leftTactic.description },
      right: { id: rightTactic.id, label: rightTactic.label, description: rightTactic.description }
    }
  };
  return {
    schema: "jjk-battle-assist-request",
    version: 1,
    buildVersion: APP_BUILD_VERSION,
    mode: "battleNarrative",
    language: "zh-CN",
    customSpecialTerms: getDuelSpecialTermsForAi(),
    battleSummary,
    roundEvents,
    resources,
    domainState,
    handActions,
    trialOrJackpotState: battle.domainSubPhase || battle.domainTrialContext || null,
    battle: {
      left: summarizeDuelProfileForAi(battle.left),
      right: summarizeDuelProfileForAi(battle.right),
      winnerSide: battle.winnerSide,
      winnerName: winner?.name || (battle.winnerSide === "draw" ? "平局 / 长期僵持" : ""),
      battleEnded: Boolean(battle.resolved || battle.battleEnded),
      endReason: battle.endReason || battle.resolutionReason || "ongoing",
      endingRound: battle.endingRound || battle.round,
      finalRate: roundForPayload(battle.finalRate),
      leftScore: roundForPayload(battle.leftScore),
      rightScore: roundForPayload(battle.rightScore),
      legacyMaxRounds: battle.legacyMaxRounds || battle.maxRounds,
      safetyRoundCap: battle.safetyRoundCap || getDuelSafetyRoundCap(battle),
      battleId: battle.battleId,
      seed: battle.seed,
      replayKey: battle.replayKey,
      resources: summarizeDuelResourceStateForAi(battle),
      roundRule: getDuelRoundRuleText(battle.left, battle.right),
      tactics: {
        left: { id: leftTactic.id, label: leftTactic.label, description: leftTactic.description },
        right: { id: rightTactic.id, label: rightTactic.label, description: rightTactic.description }
      },
      log: battle.log.slice().reverse().map((entry) => ({
        round: entry.round,
        title: entry.title,
        detail: entry.detail
      })),
      resourceLog: (battle.resourceState?.resourceLog || []).slice(0, 12).reverse().map((entry) => ({
        round: entry.round,
        title: entry.title,
        detail: entry.detail,
        delta: entry.delta
      })),
      actionLog: (battle.resourceState?.resourceLog || [])
        .filter((entry) => String(entry.title || "").includes("手法"))
        .slice(0, 12)
        .reverse()
        .map((entry) => ({
          round: entry.round,
          title: entry.title,
          detail: entry.detail,
          delta: entry.delta
        }))
    }
  };
}

function summarizeDuelResourceStateForAi(battle) {
  const summarize = (resource) => resource ? {
    name: resource.name,
    hp: roundForPayload(resource.hp),
    maxHp: roundForPayload(resource.maxHp),
    ce: roundForPayload(resource.ce),
    maxCe: roundForPayload(resource.maxCe),
    ceRegen: roundForPayload(resource.ceRegen),
    stability: roundForPayload(resource.stability),
    domain: {
      active: Boolean(resource.domain?.active),
      load: roundForPayload(resource.domain?.load || 0),
      threshold: roundForPayload(resource.domain?.threshold || 0),
      meltdownRisk: roundForPayload(resource.domain?.meltdownRisk || 0),
      turnsActive: resource.domain?.turnsActive || 0
    },
    statusEffects: (resource.statusEffects || []).map((effect) => effect.label || effect.id)
  } : null;
  return {
    status: "CANDIDATE",
    p1: summarize(battle.resourceState?.p1),
    p2: summarize(battle.resourceState?.p2)
  };
}

function summarizeDuelProfileForAi(profile) {
  return {
    name: profile.name,
    visibleGrade: getDuelDisplayGrade(profile),
    stage: getDuelStageLabel(profile.stage),
    tier: profile.tier || "",
    pool: profile.pool || "",
    combatPowerUnit: profile.combatPowerUnit?.label || "",
    disruptionUnit: profile.disruptionUnit?.label || "",
    axes: profile.axes,
    techniqueText: profile.techniqueText,
    domainProfile: profile.domainProfile,
    loadout: profile.loadout,
    innateTraits: profile.innateTraits,
    externalResource: profile.externalResource,
    notes: profile.notes,
    specialTerms: profile.specialTerms || [],
    survivalRounds: profile.survivalRounds || 0,
    winPaths: profile.winPaths || [],
    risks: profile.risks || [],
    flags: profile.flags || []
  };
}

function getDuelStageLabel(value) {
  return DUEL_STAGE_OPTIONS.find((item) => item.value === value)?.label || value || "自定义";
}

function getDuelTactics() {
  return Array.isArray(globalThis.JJKDuelTactics?.tactics)
    ? globalThis.JJKDuelTactics.tactics
    : [{ id: "balanced", label: "稳扎稳打", description: "标准战斗倾向。", initiative: 0, technique: 0, melee: 0, domain: 0, counter: 0, sustain: 0, finisher: 0, risk: 0 }];
}

function getDuelTacticDefinition(id) {
  return globalThis.JJKDuelTactics?.getTacticDefinition?.(id) || getDuelTactics().find((item) => item.id === id) || getDuelTactics()[0];
}

function getDuelInitiativeInvestments() {
  return globalThis.JJKDuelTactics?.initiativeInvestments || [0, 5, 10, 15];
}

function getDuelInitiativeInvestment(battle = state.duelBattle, side = getDuelControlledSide(battle)) {
  battle.initiativeInvestmentSelections ||= { left: 5, right: 5 };
  const actor = side === "right" ? battle.resourceState?.p2 : battle.resourceState?.p1;
  return globalThis.JJKDuelTactics?.normalizeInitiativeInvestment?.(battle.initiativeInvestmentSelections[side] ?? 5, actor?.hp) ?? 0;
}

function setDuelInitiativeInvestment(battle, side, value) {
  if (!battle || battle.autoRunning || battle.resolved) return 0;
  battle.initiativeInvestmentSelections ||= { left: 5, right: 5 };
  const actor = side === "right" ? battle.resourceState?.p2 : battle.resourceState?.p1;
  const normalized = globalThis.JJKDuelTactics?.normalizeInitiativeInvestment?.(value, actor?.hp) ?? 0;
  battle.initiativeInvestmentSelections[side] = normalized;
  return normalized;
}

function resolveDuelInitiativeContest(battle, explicitInvestments = null) {
  if (!battle?.resourceState) return null;
  const round = Number(battle.round || 0) + 1;
  if (battle.initiativeState?.round === round) return battle.initiativeState;
  const controlledSide = getDuelControlledSide(battle) || "left";
  const leftInvestment = explicitInvestments
    ? Number(explicitInvestments.left || 0)
    : controlledSide === "left"
      ? getDuelInitiativeInvestment(battle, "left")
      : globalThis.JJKDuelTactics?.pickCpuInitiativeInvestment?.(battle, "left") ?? 5;
  const rightInvestment = explicitInvestments
    ? Number(explicitInvestments.right || 0)
    : controlledSide === "right"
      ? getDuelInitiativeInvestment(battle, "right")
      : globalThis.JJKDuelTactics?.pickCpuInitiativeInvestment?.(battle, "right") ?? 5;
  const result = globalThis.JJKDuelTactics?.resolveInitiativeContest?.(
    battle,
    leftInvestment,
    rightInvestment,
    duelRandom(battle, `initiativeTie:${round}`)
  );
  if (!result) return null;
  battle.operations.push(`initiative:${round}:left:${result.leftInvestment}:right:${result.rightInvestment}:first:${result.firstSide}`);
  recordDuelResourceChange(battle, {
    side: result.firstSide,
    title: `先手争夺：${getDuelPerspectiveSideLabel(result.firstSide, battle)}先攻`,
    detail: `${getDuelPerspectiveSideLabel("left", battle)}投入 ${formatNumber(result.leftInvestment)} 体势，${getDuelPerspectiveSideLabel("right", battle)}投入 ${formatNumber(result.rightInvestment)} 体势；${result.reason}。先手本回合 CE 消耗-5%，后手本回合承伤-10%；投入体势不返还。`,
    type: "system",
    delta: {
      initiativeFirstSide: result.firstSide,
      leftInvestment: -result.leftInvestment,
      rightInvestment: -result.rightInvestment,
      firstCeCostScale: 0.95,
      secondIncomingDamageScale: 0.9
    }
  });
  return result;
}

function pickDuelOpponentTactic(battle) {
  const profile = battle.right;
  const opponent = battle.left;
  if (battle.round >= 3 && battle.rightScore + 2 < battle.leftScore) return "finish";
  if (hasDuelDomainAccess(profile) && profile.combatPowerUnit.value >= opponent.combatPowerUnit.value * 0.72) return "domain";
  if (profile.disruptionScore >= 7) return "counter";
  if (profile.flags.includes("jackpotSustain") || profile.flags.includes("trueRikaResource")) return "delay";
  if (profile.axes.body > profile.axes.jujutsu + 0.8) return "assault";
  if (profile.axes.jujutsu >= profile.axes.body) return "technique";
  return "balanced";
}

const DOUNA_SECOND_LIFE_INTENT_CONFIG = Object.freeze({
  douna_second_life_dismantle: {
    key: "dismantle",
    label: "解",
    notice: "[ 解 ]的咒词响起，这是针对物理的斩击？",
    counterId: "douna_counter_cursed_energy_guard",
    counterLabel: "咒力防御",
    damageScaleOnCounter: 0.2,
    defenseReductionOnCounter: 0.1
  },
  douna_second_life_cleave: {
    key: "cleave",
    label: "捌",
    notice: "[ 捌 ]的咒词响起，这是针对咒力的斩击？",
    counterId: "defensive_frame",
    counterLabel: "防御构筑",
    damageScaleOnCounter: 0.3,
    defenseReductionOnCounter: 0.2
  },
  douna_second_life_furnace: {
    key: "furnace",
    label: "灶·开",
    notice: "[灶·开]的咒词响起，这是针对单体的火炎地狱？",
    counterId: "douna_counter_fly_head_interference",
    counterLabel: "蝇头干扰",
    forcedHitRateOnCounter: 0.1
  },
  douna_bound_world_slash: {
    key: "bound_world_slash",
    label: "束缚世界斩",
    notice: "[龙鳞，反反，成双之流星。]这是什么？",
    counterId: "avoid_edge",
    counterLabel: "避其锋芒",
    forcedHitRateOnCounter: 0
  }
});

function isDounaSecondLifeBattle(battle) {
  return Boolean(battle?.dounaGauntlet && Number(battle.dounaGauntlet.bossLife || 1) === 2 && battle.resourceState?.p2?.side === "right");
}

function buildDounaSecondLifeBossAction(intentId, battle) {
  const targetHp = Math.max(1, Number(battle?.resourceState?.p1?.hp || battle?.resourceState?.p1?.maxHp || 1));
  const base = {
    id: intentId,
    cardId: `card_${intentId}`,
    label: DOUNA_SECOND_LIFE_INTENT_CONFIG[intentId]?.label || intentId,
    name: DOUNA_SECOND_LIFE_INTENT_CONFIG[intentId]?.label || intentId,
    cardType: "technique",
    type: "douna_second_life_slash",
    tags: ["御厨子", "斩击", "斗傩第二命"],
    specialHandTags: ["shrine", "World Slash"],
    apCost: 1,
    ceCost: 0,
    cost: { ce: 0 },
    costType: "flat",
    damageType: "hp",
    scalingProfile: "none",
    evasionAllowed: true,
    risk: "critical",
    rarity: "legendary",
    dounaSecondLifeIntent: intentId,
    weight: 999,
    status: "CONFIRMED"
  };
  if (intentId === "douna_second_life_dismantle") {
    return { ...base, cardId: "card_dismantle_pressure", shrineBaseActionId: "dismantle_pressure", damage: 118, effect: { damage: 118 }, accuracyProfile: "technique_projectile", baseHitRate: 0.82, effectSummary: "第二命「解」：针对物理轮廓的斩击。" };
  }
  if (intentId === "douna_second_life_cleave") {
    return { ...base, cardId: "card_cleave_adaptation", shrineBaseActionId: "cleave_adaptation", damage: 132, effect: { damage: 132 }, accuracyProfile: "technique_projectile", baseHitRate: 0.78, effectSummary: "第二命「捌」：针对咒力强度的斩击。" };
  }
  if (intentId === "douna_second_life_furnace") {
    return { ...base, cardId: "card_feature_shrine_119", shrineBaseActionId: "feature_shrine_119", damage: 195, effect: { damage: 195 }, label: "灶·开", name: "灶·开", accuracyProfile: "technique_area", baseHitRate: 0.54, hitRateModifier: -0.12, tags: [...base.tags, "火炎"], effectSummary: "第二命「灶·开」：高伤害单体火炎，基础命中偏低。" };
  }
  return {
    ...base,
    id: "douna_bound_world_slash",
    cardId: "card_douna_bound_world_slash",
    label: "束缚世界斩",
    name: "束缚世界斩",
    type: "douna_bound_world_slash",
    damage: Math.max(999, targetHp + 999),
    effect: { damage: Math.max(999, targetHp + 999), instantKillOnHit: true, dounaImmediateWorldSlash: true, dounaSecondLifeBoundWorldSlash: true },
    accuracyProfile: "world_slash",
    baseHitRate: 0.94,
    dounaForcedHitRate: 0.94,
    instantKillOnHit: true,
    effects: { instantKillOnHit: true, dounaImmediateWorldSlash: true, dounaSecondLifeBoundWorldSlash: true },
    effectSummary: "第二命束缚世界斩：本回合立即结算，至少间隔一回合才能再次使用。"
  };
}

const DOUNA_SECOND_LIFE_COUNTER_HINTS = Object.freeze({
  douna_counter_cursed_energy_guard: {
    dounaCounterFor: "dismantle",
    effectSummary: "本回合打出时，可使宿傩本次「解」伤害减少 80%。"
  },
  defensive_frame: {
    dounaCounterFor: "cleave",
    effectSummary: "本回合打出时，可使宿傩本次「捌」伤害减少 70%。"
  },
  douna_counter_fly_head_interference: {
    dounaCounterFor: "furnace",
    effectSummary: "本回合打出时，宿傩本次攻击命中率降为 10%。"
  },
  avoid_edge: {
    dounaCounterFor: "bound_world_slash",
    effectSummary: "本回合打出时，宿傩本次束缚世界斩无法命中。"
  }
});

function findDounaSecondLifeCounterTemplate(counterId) {
  const cards = Array.isArray(getDuelCardTemplateRules()?.cards) ? getDuelCardTemplateRules().cards : [];
  return cards.find((card) => {
    const ids = [card?.cardId, card?.id, card?.actionId].filter(Boolean);
    return ids.includes(counterId);
  }) || null;
}

function buildDounaSecondLifeCounterCard(config) {
  if (!config?.counterId) return null;
  const normalizedCounterId = config.counterId === "evasion_focus" ? "avoid_edge" : config.counterId;
  const template = findDounaSecondLifeCounterTemplate(normalizedCounterId);
  if (!template) return null;
  const counter = clonePlain(template) || { ...template };
  const counterActionId = counter.actionId || counter.id || counter.cardId || normalizedCounterId;
  const hint = DOUNA_SECOND_LIFE_COUNTER_HINTS[counterActionId] || DOUNA_SECOND_LIFE_COUNTER_HINTS[normalizedCounterId] || {};
  counter.id = counterActionId;
  counter.actionId = counterActionId;
  counter.cardId = counter.cardId || `card_${counterActionId}`;
  counter.label = counter.label || counter.name || config.counterLabel || counterActionId;
  counter.name = counter.name || counter.label;
  counter.type = counter.type || counter.cardType || "support";
  counter.cardType = counter.cardType || counter.type;
  counter.costType = counter.costType || (counter.ceCostMode === "fixed" ? "flat" : counter.ceCostMode) || "flat";
  counter.damage = Number(counter.effect?.damage ?? counter.damage ?? 0);
  counter.block = Number(counter.effect?.block ?? counter.block ?? 0);
  counter.effect = { ...(counter.effect || {}), damage: counter.damage, block: counter.block };
  counter.damageType = counter.damageType || "none";
  counter.scalingProfile = counter.scalingProfile || "support";
  counter.effects = clonePlain(counter.effects || {}) || {};
  if (Number(counter.evasionBonus || 0) && counter.effects.evasionBonus == null) {
    counter.effects.evasionBonus = Number(counter.evasionBonus);
  }
  if (counter.exclusiveHandSelection && counter.exclusiveSelection == null) {
    counter.exclusiveSelection = true;
  }
  counter.weight = 1000;
  counter.dounaCounterFor = counter.dounaCounterFor || hint.dounaCounterFor || config.key || "";
  counter.effectSummary = [counter.effectSummary, hint.effectSummary].filter(Boolean).join(" ");
  counter.status = counter.status || "CONFIRMED";
  return counter;
}

function hasDounaPlayerCounterAvailable(battle, counterId, counterLabel) {
  const cards = [
    ...(battle?.actionChoices || []),
    ...(battle?.domainHandCandidates || []),
    ...(battle?.handState?.left?.cards || [])
  ];
  return cards.some((card) => {
    const action = card?.action || card || {};
    return action.id === counterId || card.actionId === counterId || action.cardId === `card_${counterId}` || action.label === counterLabel || card.label === counterLabel;
  });
}

function removeDounaSecondLifeCounterDuplicates(cards, config) {
  if (!Array.isArray(cards) || !config) return [];
  const seen = new Set();
  return cards.filter((card) => {
    const action = card?.action || card || {};
    const key = [
      action.id || card?.actionId || action.cardId || "",
      action.label || card?.label || ""
    ].join("|");
    const isSameCounter = action.id === config.counterId ||
      card?.actionId === config.counterId ||
      action.cardId === `card_${config.counterId}` ||
      action.label === config.counterLabel ||
      card?.label === config.counterLabel;
    if (!isSameCounter) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBattleSpecialAbilitiesForRuntimeFight() {
  return Array.isArray(state.battleSpecialAbilities?.abilities) ? state.battleSpecialAbilities.abilities : [];
}

function findDounaSecondLifeIntentConfigByCounterId(counterId) {
  const id = String(counterId || "").replace(/^card_/, "");
  return Object.values(DOUNA_SECOND_LIFE_INTENT_CONFIG).find((config) => config?.counterId === id || String(config?.counterId || "") === String(counterId || "")) || null;
}

function runDounaSecondLifeCounterSpecial(battle, action, config) {
  const runner = globalThis.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
  if (typeof runner !== "function") return { operations: [] };
  return runner("counter", {
    abilities: getBattleSpecialAbilitiesForRuntimeFight(),
    battle,
    side: "left",
    actor: battle?.resourceState?.p1 || { side: "left" },
    opponent: battle?.resourceState?.p2 || { side: "right" },
    opponentAction: { ...(action || {}), tags: Array.from(new Set([...(action?.tags || []), ...(action?.specialHandTags || []), "shrine"])), counterId: config?.counterId || "", counterLabel: config?.counterLabel || "" }
  });
}


function runBattleSpecialEntryFight(entryName, battle, action, extra = {}) {
  const runner = globalThis.JJKBattleSpecialRuntime?.runBattleSpecialEntry;
  if (typeof runner !== "function") return { operations: [] };
  return runner(entryName, {
    abilities: getBattleSpecialAbilitiesForRuntimeFight(),
    battle,
    side: extra.side || "left",
    actor: extra.actor || battle?.resourceState?.p1 || { side: "left" },
    opponent: extra.opponent || battle?.resourceState?.p2 || { side: "right" },
    action: action || {},
    card: action || {},
    turn: battle?.round || 0,
    ...extra
  });
}

function materializeDounaSecondLifeCounterOperations(battle, operations) {
  (Array.isArray(operations) ? operations : []).forEach((operation) => {
    if (operation?.op !== "injectCard" || !operation.cardId) return;
    const config = findDounaSecondLifeIntentConfigByCounterId(operation.cardId);
    if (config) injectDounaSecondLifeCounterCard(battle, config);
  });
}

function injectDounaSecondLifeCounterCard(battle, config) {
  if (!battle || !config?.counterId) return;
  const counter = buildDounaSecondLifeCounterCard(config);
  if (!counter) return;
  const round = Number(battle.round || 0) + 1;
  battle.handState ||= {};
  battle.handState.left ||= { cards: [], discardPile: [], round, lastDrawn: [], lastInjected: [], maxHandSize: 8, drawPerTurn: 5 };
  battle.handState.left.cards ||= [];
  battle.handState.left.cards = removeDounaSecondLifeCounterDuplicates(battle.handState.left.cards, config);
  battle.actionChoices ||= [];
  battle.actionChoices = removeDounaSecondLifeCounterDuplicates(battle.actionChoices, config);
  if (hasDounaPlayerCounterAvailable(battle, config.counterId, config.counterLabel)) return;
  const counterCard = {
    ...counter,
    action: counter,
    actionId: counter.id,
    fixedHandInjection: true,
    retainedPermanent: false,
    handSource: "douna-second-life-counter",
    drawnRound: round
  };
  battle.handState.left.cards.unshift(counterCard);
  battle.handState.left.lastInjected = [{ actionId: counter.id, label: counter.label, reason: "douna-second-life-counter" }];
  battle.actionChoices.unshift(counter);
  battle.handCandidates = battle.actionChoices;
}

function chooseDounaSecondLifeIntentId(battle) {
  const turn = Number(battle?.round || 0) + 1;
  const lastWorldSlashRound = Number(battle?.dounaGauntlet?.boundWorldSlashLastRound || -99);
  const worldSlashReady = lastWorldSlashRound <= turn - 2;
  const cycle = turn % 4;
  if (worldSlashReady && cycle === 0) return "douna_bound_world_slash";
  if (cycle === 1) return "douna_second_life_dismantle";
  if (cycle === 2) return "douna_second_life_cleave";
  if (cycle === 3) return "douna_second_life_furnace";
  return worldSlashReady ? "douna_bound_world_slash" : "douna_second_life_dismantle";
}

function showDounaSukunaTelegraphPopup(text) {
  if (typeof document === "undefined") return;
  const message = String(text || "").trim();
  if (!message) return;
  let popup = document.getElementById("dounaSukunaTelegraphPopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "dounaSukunaTelegraphPopup";
    popup.className = "douna-swap-popup douna-sukuna-telegraph-popup";
    popup.setAttribute("role", "alert");
    popup.setAttribute("aria-live", "assertive");
    popup.innerHTML = `<strong>宿傩的术式预兆</strong><span></span>`;
    document.body.appendChild(popup);
  }
  const messageNode = popup.querySelector("span");
  if (messageNode) messageNode.textContent = message;
  popup.classList.add("is-visible");
  window.setTimeout(() => {
    popup?.classList.remove("is-visible");
    popup?.remove();
  }, 4200);
}

function prepareDounaSecondLifeTelegraphForPlayerTurn(battle) {
  if (!isDounaSecondLifeBattle(battle)) return;
  const turn = Number(battle.round || 0) + 1;
  const existing = battle.dounaGauntlet.secondLifeIntent;
  if (existing?.turn === turn && existing?.actionId) {
    const config = DOUNA_SECOND_LIFE_INTENT_CONFIG[existing.actionId];
    const action = buildDounaSecondLifeBossAction(existing.actionId, battle);
    const specialResult = runDounaSecondLifeCounterSpecial(battle, action, config);
    materializeDounaSecondLifeCounterOperations(battle, specialResult.operations);
    return;
  }
  const actionId = chooseDounaSecondLifeIntentId(battle);
  const config = DOUNA_SECOND_LIFE_INTENT_CONFIG[actionId];
  const action = buildDounaSecondLifeBossAction(actionId, battle);
  battle.dounaGauntlet.secondLifeIntent = {
    turn,
    actionId,
    key: config?.key || actionId,
    label: config?.label || action.label,
    notice: config?.notice || "",
    counterId: config?.counterId || "",
    counterLabel: config?.counterLabel || ""
  };
  battle.actionUiMessage = config?.notice || battle.actionUiMessage || "";
  const specialResult = runDounaSecondLifeCounterSpecial(battle, action, config);
  materializeDounaSecondLifeCounterOperations(battle, specialResult.operations);
  if (battle.dounaGauntlet.lastTelegraphNoticeRound !== turn) {
    battle.dounaGauntlet.lastTelegraphNoticeRound = turn;
    showDounaSukunaTelegraphPopup(config?.notice || action.label);
    recordDuelResourceChange(battle, {
      side: "right",
      title: "宿傩术式预兆",
      detail: config?.notice || action.label,
      type: "system",
      delta: { dounaSecondLifeIntent: actionId }
    });
  }
}

function getDounaSecondLifeBossSelections(battle) {
  if (!isDounaSecondLifeBattle(battle)) return [];
  const turn = Number(battle.round || 0) + 1;
  if (!battle.dounaGauntlet.secondLifeIntent || battle.dounaGauntlet.secondLifeIntent.turn !== turn) {
    prepareDounaSecondLifeTelegraphForPlayerTurn(battle);
  }
  const actionId = battle.dounaGauntlet.secondLifeIntent?.actionId || chooseDounaSecondLifeIntentId(battle);
  const action = buildDounaSecondLifeBossAction(actionId, battle);
  return [{
    id: action.id,
    actionId: action.id,
    label: action.label,
    action,
    selectedRound: turn,
    side: "right",
    source: "douna-second-life-script"
  }];
}

function hasDounaCounterSelection(leftSelections, config) {
  if (!config?.counterId && !config?.counterLabel) return false;
  return (leftSelections || []).some((entry) => {
    const action = entry?.action || entry || {};
    return action.id === config.counterId || entry.actionId === config.counterId || action.cardId === `card_${config.counterId}` || action.label === config.counterLabel || entry.label === config.counterLabel;
  });
}

function applyDounaSecondLifeCounterToBossActions(battle, rightSelections, leftSelections) {
  if (!isDounaSecondLifeBattle(battle)) return rightSelections;
  const intent = battle.dounaGauntlet.secondLifeIntent;
  const config = DOUNA_SECOND_LIFE_INTENT_CONFIG[intent?.actionId];
  if (!config || !hasDounaCounterSelection(leftSelections, config)) return rightSelections;
  if (intent?.actionId === "douna_bound_world_slash") {
    battle.dounaGauntlet.boundWorldSlashLastRound = Number(battle.round || 0) + 1;
    battle.dounaGauntlet.boundWorldSlashUsed = true;
  }
  return (rightSelections || []).map((entry) => {
    const action = { ...(entry.action || entry || {}) };
    if (Number.isFinite(Number(config.damageScaleOnCounter))) {
      action.effects = { ...(action.effects || {}), damageScale: Number(config.damageScaleOnCounter) };
      action.dounaCounteredBy = config.counterLabel;
    }
    if (Number.isFinite(Number(config.forcedHitRateOnCounter))) {
      action.dounaForcedHitRate = Number(config.forcedHitRateOnCounter);
      action.dounaCounteredBy = config.counterLabel;
      if (Number(config.forcedHitRateOnCounter) <= 0) {
        action.damage = 0;
        action.effect = { ...(action.effect || {}), damage: 0 };
        action.instantKillOnHit = false;
        action.effects = { ...(action.effects || {}), instantKillOnHit: false, dounaImmediateWorldSlash: false };
      }
    }
    return { ...entry, action };
  });
}

function applyDounaSecondLifeCounterDefenseWindow(battle, leftSelections) {
  if (!isDounaSecondLifeBattle(battle)) return () => {};
  const intent = battle.dounaGauntlet.secondLifeIntent;
  const config = DOUNA_SECOND_LIFE_INTENT_CONFIG[intent?.actionId];
  const reduction = Number(config?.defenseReductionOnCounter || 0);
  if (!config || reduction <= 0 || !hasDounaCounterSelection(leftSelections, config)) return () => {};
  const boss = battle.resourceState?.p2;
  if (!boss || !Array.isArray(boss.statusEffects)) return () => {};
  const snapshots = boss.statusEffects
    .filter((effect) => effect?.id === "dounaSukunaDefense")
    .map((effect) => ({ effect, value: effect.value }));
  if (!snapshots.length) return () => {};
  snapshots.forEach(({ effect }) => {
    effect.value = Math.max(0, Number(effect.value || 0) * Math.max(0, 1 - reduction));
    effect.dounaCounterDefenseWindow = true;
  });
  return () => {
    snapshots.forEach(({ effect, value }) => {
      effect.value = value;
      delete effect.dounaCounterDefenseWindow;
    });
  };
}

function activeBattleGenerationTimeoutMs(battle = state.duelBattle) {
  if (battle?.dounaGauntlet?.online) return 9000;
  if (isOnlineDuelModeActive()) return 7000;
  return 6000;
}

function runDuelAutoBattle() {
  const battle = state.duelBattle;
  if (!battle || battle.autoRunning || battle.resolved) return;
  maybeResolveDuelBattle(battle);
  if (battle.resolved) {
    renderDuelMode();
    return;
  }
  if (typeof window !== "undefined") {
    const scrollAnchor = document.querySelector("#duelAutoRunBtn") || document.querySelector(".duel-action-panel");
    battle.autoRunScrollTarget = {
      x: Number.isFinite(window.scrollX) ? window.scrollX : 0,
      y: Number.isFinite(window.scrollY) ? window.scrollY : 0,
      anchorSelector: scrollAnchor?.id ? `#${scrollAnchor.id}` : ".duel-action-panel",
      anchorTop: scrollAnchor?.getBoundingClientRect?.().top
    };
  }
  const controlledSide = getDuelControlledSide(battle);
  const controlledResources = getDuelSideResources(battle, controlledSide);
  const pendingDiscardCount = Math.max(0, Number(battle.handState?.[controlledSide]?.pendingDiscardCount || 0));
  const onlineDounaBattle = Boolean(battle.dounaGauntlet?.online);
  if (pendingDiscardCount > 0 && (!isOnlineDuelModeActive() || onlineDounaBattle)) {
    const discarded = autoDiscardDuelHandOverflow(controlledResources.actor, controlledResources.opponent, battle, {
      side: controlledSide,
      reason: onlineDounaBattle ? "onlineDounaOverflowAutoAdvance" : "soloOverflowAutoAdvance"
    });
    if (discarded.length) {
      battle.actionUiMessage = `已自动弃置 ${formatNumber(discarded.length)} 张溢出手牌，并以待机行动继续推进。`;
      clearDuelSelectedHandActions(battle, controlledSide, { refund: false });
      battle.pendingAction = null;
      battle.actionChoices = battle.handState?.[controlledSide]?.cards || battle.actionChoices || [];
    }
  }
  battle.autoRunning = true;
  battle.autoRunningStartedAt = Date.now();
  const autoRunStartedAt = battle.autoRunningStartedAt;
  battle.phase = "stage";
  battle.currentOptions = [];
  battle.selectedIndex = null;
  markDuelHandActionAnimation(battle, "left", "play");
  state.duelSpinToken += 1;
  const token = state.duelSpinToken;
  renderDuelMode();
  window.setTimeout(() => {
    const activeBattle = state.duelBattle;
    if (!activeBattle || !activeBattle.autoRunning || activeBattle.autoRunningStartedAt !== autoRunStartedAt) return;
    activeBattle.autoRunning = false;
    activeBattle.actionUiMessage = "回合生成超时，已恢复操作；请重新执行本回合。";
    updateDuelActionAvailability(activeBattle);
    renderDuelMode();
  }, activeBattleGenerationTimeoutMs(battle));

  window.setTimeout(async () => {
    if (token !== state.duelSpinToken || !state.duelBattle) {
      if (state.duelBattle?.autoRunning && state.duelBattle.autoRunningStartedAt === autoRunStartedAt) {
        state.duelBattle.autoRunning = false;
        state.duelBattle.actionUiMessage = "回合生成已被新操作打断，请重新执行本回合。";
        renderDuelMode();
      }
      return;
    }
    try {
      const activeBattle = state.duelBattle;
      maybeResolveDuelBattle(activeBattle);
      if (activeBattle.resolved) {
        activeBattle.autoRunning = false;
        renderDuelMode();
        return;
      }
      if (resolveDounaPendingBoundWorldSlash(activeBattle)) {
        activeBattle.autoRunning = false;
        updateDuelActionAvailability(activeBattle);
        renderDuelMode();
        return;
      }
      activeBattle.opponentTactic = pickDuelOpponentTactic(activeBattle);
      const beforeMemoSnapshot = snapshotDuelMemoState(activeBattle);
      const leftSelections = isMahoragaProxyActive(activeBattle, "left")
        ? [lockMahoragaHandForTurn(activeBattle, "left")]
        : getDuelSelectedHandActions(activeBattle, "left").length
        ? getDuelSelectedHandActions(activeBattle, "left")
        : [createDuelPassTurnAction("left", activeBattle)];
      const useLocalBossPlanner = Boolean(activeBattle.dounaGauntlet?.online);
      const pickedRightSelections = isDounaSecondLifeBattle(activeBattle)
        ? getDounaSecondLifeBossSelections(activeBattle)
        : isMahoragaProxyActive(activeBattle, "right")
        ? [lockMahoragaHandForTurn(activeBattle, "right")]
        : useLocalBossPlanner
          ? pickDuelCpuHandActions(activeBattle.resourceState?.p2, activeBattle.resourceState?.p1, activeBattle, { side: "right", difficulty: activeBattle.cpuDifficulty })
          : await pickDuelCpuHandActionsCloudFirst(activeBattle.resourceState?.p2, activeBattle.resourceState?.p1, activeBattle, { side: "right", difficulty: activeBattle.cpuDifficulty });
      let rightSelections = pickedRightSelections.length ? pickedRightSelections : [createDuelPassTurnAction("right", activeBattle)];
      const chosoAlignedSelections = globalThis.JJKShibuyaIncident?.alignChosoBossEnemySelections?.(activeBattle, rightSelections);
      if (Array.isArray(chosoAlignedSelections) && chosoAlignedSelections.length) rightSelections = chosoAlignedSelections;
      const megumiTojiAlignedSelections = globalThis.JJKShibuyaIncident?.alignMegumiTojiBossEnemySelections?.(activeBattle, rightSelections);
      if (Array.isArray(megumiTojiAlignedSelections) && megumiTojiAlignedSelections.length) rightSelections = megumiTojiAlignedSelections;
      const sukunaJogoAlignedSelections = globalThis.JJKShibuyaIncident?.alignSukunaJogoBossEnemySelections?.(activeBattle, rightSelections);
      if (Array.isArray(sukunaJogoAlignedSelections) && sukunaJogoAlignedSelections.length) rightSelections = sukunaJogoAlignedSelections;
      const sukunaMahoragaAlignedSelections = globalThis.JJKShibuyaIncident?.alignSukunaMahoragaBossEnemySelections?.(activeBattle, rightSelections);
      if (Array.isArray(sukunaMahoragaAlignedSelections) && sukunaMahoragaAlignedSelections.length) rightSelections = sukunaMahoragaAlignedSelections;
      const mahitoAlignedSelections = globalThis.JJKShibuyaIncident?.alignMahitoBossEnemySelections?.(activeBattle, rightSelections);
      if (Array.isArray(mahitoAlignedSelections) && mahitoAlignedSelections.length) rightSelections = mahitoAlignedSelections;
      appendDuelHandBatchLog(activeBattle, "left", leftSelections, { phase: "selected" });
      appendDuelHandBatchLog(activeBattle, "right", rightSelections, { phase: "selected" });
      activeBattle.actionContext = null;
      rightSelections = applyDounaSecondLifeCounterToBossActions(activeBattle, rightSelections, leftSelections);
      activeBattle.selectedHandActions ||= {};
      activeBattle.selectedHandActions.left = leftSelections.slice();
      activeBattle.selectedHandActions.right = rightSelections.slice();
      // Locked defense is simultaneous: both sides establish their guard
      // before the initiative winner starts dealing damage. The action itself
      // still pays CE and resolves in its normal batch exactly once.
      globalThis.JJKDuelActions?.primeDuelLockedDefenseActions?.(leftSelections, activeBattle.resourceState.p1, activeBattle.resourceState.p2, activeBattle, { side: "left" });
      globalThis.JJKDuelActions?.primeDuelLockedDefenseActions?.(rightSelections, activeBattle.resourceState.p2, activeBattle.resourceState.p1, activeBattle, { side: "right" });
      const towerSelections = buildTowerVisibleIntensitySelectionSnapshot(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveTowerBossInteractionSelections?.(activeBattle, towerSelections);
      globalThis.JJKShibuyaIncident?.resolveDagonBossInteractionSelections?.(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveChosoBossInteractionSelections?.(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveMegumiTojiBossInteractionSelections?.(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveSukunaJogoBossInteractionSelections?.(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveSukunaMahoragaBossInteractionSelections?.(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveMahitoBossInteractionSelections?.(activeBattle, leftSelections);
      globalThis.JJKShibuyaIncident?.resolveHarutaBossInteractionSelections?.(activeBattle, leftSelections);
      const initiative = resolveDuelInitiativeContest(activeBattle);
      const initiativeOrder = initiative?.firstSide === "right" ? ["right", "left"] : ["left", "right"];
      const handResults = {};
      let initiativeEndedBattle = false;
      for (const actingSide of initiativeOrder) {
        if (initiativeEndedBattle) {
          handResults[actingSide] = {
            applied: false,
            skipped: true,
            reason: "对手已被先手行动击败，本回合后手行动取消",
            side: actingSide,
            actions: [],
            results: []
          };
          continue;
        }
        if (actingSide === "left") {
          const restoreDounaSecondLifeDefense = applyDounaSecondLifeCounterDefenseWindow(activeBattle, leftSelections);
          try {
            handResults.left = applyDuelSelectedHandActions(activeBattle.resourceState.p1, activeBattle.resourceState.p2, activeBattle, { side: "left", actions: leftSelections, clearAfter: false });
          } finally {
            restoreDounaSecondLifeDefense();
          }
        } else {
          handResults.right = applyDuelSelectedHandActions(activeBattle.resourceState.p2, activeBattle.resourceState.p1, activeBattle, { side: "right", actions: rightSelections, clearAfter: false });
        }
        if (actingSide === "left" && handResults.left?.applied) {
          globalThis.JJKShibuyaIncident?.completeMahitoDamageThresholdAfterLeftHand?.(activeBattle, leftSelections, handResults.left?.results || []);
        }
        const resolvedAfterHand = Boolean(handResults[actingSide]?.applied && maybeResolveDuelBattleAfterHandActions(activeBattle));
        if (resolvedAfterHand || activeBattle.towerPhaseTransitionPending === true) {
          initiativeEndedBattle = true;
        }
      }
      const leftHandResult = handResults.left || { applied: false, skipped: true, reason: "本回合未行动", actions: [], results: [] };
      const rightHandResult = handResults.right || { applied: false, skipped: true, reason: "本回合未行动", actions: [], results: [] };
      const towerRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeTowerBossInteractionRound?.(activeBattle, towerSelections, leftHandResult?.results || [])
        : null;
      const dagonRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeDagonBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      const chosoRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeChosoBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      const megumiTojiRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeMegumiTojiBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      const sukunaJogoRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeSukunaJogoBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      const sukunaMahoragaRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeSukunaMahoragaBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      const mahitoRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeMahitoBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      const harutaRoundResult = leftHandResult?.applied
        ? globalThis.JJKShibuyaIncident?.completeHarutaBossInteractionRound?.(activeBattle, leftSelections, leftHandResult?.results || [])
        : null;
      if (!leftHandResult?.applied) {
        appendDuelHandBatchLog(activeBattle, "left", leftSelections, { phase: "executed", result: leftHandResult });
        if (leftHandResult.skipped && activeBattle.resolved) {
          appendDuelHandBatchLog(activeBattle, "right", rightSelections, { phase: "executed", result: rightHandResult });
        }
        if (activeBattle.resolved) {
          activeBattle.lastRoundMemo = buildDuelRoundMemo(activeBattle, beforeMemoSnapshot, snapshotDuelMemoState(activeBattle), leftHandResult, rightHandResult);
          activeBattle.autoRunning = false;
          activeBattle.pendingAction = null;
          updateDuelResourceReplayKey(activeBattle);
          renderDuelMode();
          return;
        }
        activeBattle.autoRunning = false;
        activeBattle.pendingAction = null;
        activeBattle.actionUiMessage = leftHandResult?.reason || "手札无法执行";
        updateDuelActionAvailability(activeBattle);
        renderDuelMode();
        return;
      }
      applyDounaRaidBossHandToAllies(activeBattle, rightHandResult);
      processMahoragaProxyAfterHandResult(activeBattle, leftHandResult);
      processMahoragaProxyAfterHandResult(activeBattle, rightHandResult);
      appendDuelHandBatchLog(activeBattle, "left", leftSelections, { phase: "executed", result: leftHandResult });
      appendDuelHandBatchLog(activeBattle, "right", rightSelections, { phase: "executed", result: rightHandResult });
      const leftActions = leftHandResult.actions || [];
      const rightActions = rightHandResult.actions || [];
      activeBattle.currentActions = leftActions;
      activeBattle.cpuActions = rightActions;
      activeBattle.currentAction = leftActions[0] || null;
      activeBattle.cpuAction = rightActions[0] || null;
      const towerPhaseTransitioned = activeBattle.towerPhaseTransitionedThisRound === true || Boolean(towerRoundResult?.phaseTransitioned);
      if (towerPhaseTransitioned) {
        const towerTransitionMessage = activeBattle.actionUiMessage;
        activeBattle.currentActions = [];
        activeBattle.cpuActions = [];
        activeBattle.currentAction = null;
        activeBattle.cpuAction = null;
        activeBattle.towerPhaseTransitionedThisRound = false;
        // Rehydrate the visible hand from the remaining persistent cards.  The
        // same-round draw guard keeps ordinary cards stable while phase-two
        // tactics replace phase-one tactics.
        updateDuelActionAvailability(activeBattle);
        activeBattle.actionUiMessage = towerTransitionMessage;
      }
      if (initiativeEndedBattle || towerPhaseTransitioned || maybeResolveDuelBattleAfterHandActions(activeBattle)) {
        activeBattle.lastRoundMemo = buildDuelRoundMemo(activeBattle, beforeMemoSnapshot, snapshotDuelMemoState(activeBattle), leftHandResult, rightHandResult);
        activeBattle.currentOptions = [];
        activeBattle.selectedIndex = null;
        activeBattle.pendingAction = null;
        activeBattle.autoRunning = false;
        updateDuelResourceReplayKey(activeBattle);
        if (activeBattle.dounaGauntlet?.online) {
          reportOnlineAuthoritativeTurnState(activeBattle, globalThis.JJKOnline?.getUiState?.()?.currentRoom || {}, activeBattle.round || Number(activeBattle.resourceState?.round || 0));
        }
        renderDuelMode();
        return;
      }
      const domainActivationPairs = [
        ...leftActions.map((action) => ({
          action,
          actor: activeBattle.resourceState.p1,
          opponent: activeBattle.resourceState.p2,
          responseAction: rightActions[0] || null
        })),
        ...rightActions.map((action) => ({
          action,
          actor: activeBattle.resourceState.p2,
          opponent: activeBattle.resourceState.p1,
          responseAction: leftActions[0] || null
        }))
      ];
      resolveDuelDomainProfileActivations(activeBattle, domainActivationPairs);
      activeBattle.currentOptions = buildDuelRoundOptions(activeBattle);
      const result = drawWeightedDuelOption(activeBattle.currentOptions, () => duelRandom(activeBattle, "roundEvent"));
      if (!result) {
        activeBattle.autoRunning = false;
        renderDuelMode();
        return;
      }

      activeBattle.operations.push(`round:${activeBattle.round + 1}:action:${leftActions.map((action) => action.id).join("+") || "none"}:cpuAction:${rightActions.map((action) => action.id).join("+") || "none"}:opponent:${activeBattle.opponentTactic}:event:${result.index}`);
      updateDuelResourceReplayKey(activeBattle);
      applyDuelRoundResult(activeBattle, result);
      activeBattle.lastRoundMemo = buildDuelRoundMemo(activeBattle, beforeMemoSnapshot, snapshotDuelMemoState(activeBattle), leftHandResult, rightHandResult);
      activeBattle.currentOptions = [];
      activeBattle.selectedIndex = null;
      activeBattle.pendingAction = null;
      activeBattle.actionUiMessage = getActiveDuelHandLockMessage(activeBattle, getDuelControlledSide(activeBattle)) || "";
      maybeResolveDuelBattle(activeBattle);
      if (!activeBattle.resolved) updateDuelActionAvailability(activeBattle);
      activeBattle.autoRunning = false;
      if (activeBattle.dounaGauntlet?.online) {
        reportOnlineAuthoritativeTurnState(activeBattle, globalThis.JJKOnline?.getUiState?.()?.currentRoom || {}, activeBattle.round || Number(activeBattle.resourceState?.round || 0));
      }
      renderDuelMode();
    } catch (error) {
      const activeBattle = state.duelBattle;
      if (activeBattle) {
        activeBattle.autoRunning = false;
        activeBattle.actionUiMessage = `回合结算失败：${String(error?.message || error)}`;
      }
      renderDuelMode();
    }
  }, 220);
}

function buildDuelRoundOptions(battle) {
  const leftTactic = getDuelTacticDefinition(battle.selectedTactic);
  const rightTactic = getDuelTacticDefinition(battle.opponentTactic);
  const left = getDuelRoundFactors(battle.left, battle.right, leftTactic, battle, "left");
  const right = getDuelRoundFactors(battle.right, battle.left, rightTactic, battle, "right");
  const canonJogoPresentation = globalThis.JJKShibuyaIncident?.getSukunaJogoCanonRoundPresentation?.(battle, { actor: "neutral", kind: "neutral" });
  const canonMahoragaPresentation = globalThis.JJKShibuyaIncident?.getSukunaMahoragaCanonRoundPresentation?.(battle, { actor: "neutral", kind: "neutral" });
  const canonMahitoPresentation = globalThis.JJKShibuyaIncident?.getMahitoCanonRoundPresentation?.(battle, { actor: "neutral", kind: "neutral" });
  const canonBossPresentation = canonMahitoPresentation?.applied
    ? canonMahitoPresentation
    : canonMahoragaPresentation?.applied
      ? canonMahoragaPresentation
      : canonJogoPresentation;
  if (canonBossPresentation?.applied) {
    return [createDuelOption(
      "neutral",
      canonBossPresentation.label || "交锋仍在继续",
      canonBossPresentation.detail || "实际过程只以双方本回合使用的真实手牌为准。",
      1,
      0,
      "neutral"
    )].map((option, index) => ({ ...option, index, weight: 1 }));
  }
  const options = [
    createDuelOption("left", "先手压制", buildDuelRoundDetail(battle.left, battle.right, "initiative"), 9 + left.power + left.initiative, 1.6, "initiative"),
    createDuelOption("right", "先手压制", buildDuelRoundDetail(battle.right, battle.left, "initiative"), 9 + right.power + right.initiative, 1.6, "initiative"),
    createDuelOption("left", "术式命中", buildDuelRoundDetail(battle.left, battle.right, "technique"), 7 + left.jujutsu + left.technique, 2.2, "technique"),
    createDuelOption("right", "术式命中", buildDuelRoundDetail(battle.right, battle.left, "technique"), 7 + right.jujutsu + right.technique, 2.2, "technique"),
    createDuelOption("left", "近身交换", buildDuelRoundDetail(battle.left, battle.right, "melee"), 7 + left.body + left.melee, 1.8, "melee"),
    createDuelOption("right", "近身交换", buildDuelRoundDetail(battle.right, battle.left, "melee"), 7 + right.body + right.melee, 1.8, "melee"),
    createDuelOption("left", "资源介入", buildDuelRoundDetail(battle.left, battle.right, "resource"), 4 + left.resource + left.sustain, 2.0, "resource"),
    createDuelOption("right", "资源介入", buildDuelRoundDetail(battle.right, battle.left, "resource"), 4 + right.resource + right.sustain, 2.0, "resource"),
    createDuelOption("left", "领域拉扯", buildDuelRoundDetail(battle.left, battle.right, "domain"), 2 + left.domain, 2.8, "domain"),
    createDuelOption("right", "领域拉扯", buildDuelRoundDetail(battle.right, battle.left, "domain"), 2 + right.domain, 2.8, "domain"),
    createDuelOption("left", "相性异变", buildDuelRoundDetail(battle.left, battle.right, "counter"), 3 + left.disruption + left.counter, 2.4, "counter"),
    createDuelOption("right", "相性异变", buildDuelRoundDetail(battle.right, battle.left, "counter"), 3 + right.disruption + right.counter, 2.4, "counter"),
    createDuelOption("left", "临场爆发", buildDuelRoundDetail(battle.left, battle.right, "finisher"), 2 + left.finisher, 3.0, "finisher"),
    createDuelOption("right", "临场爆发", buildDuelRoundDetail(battle.right, battle.left, "finisher"), 2 + right.finisher, 3.0, "finisher"),
    createDuelOption("neutral", "互相试探", buildDuelNeutralRoundDetail(battle.left, battle.right), 7, 0, "neutral")
  ];

  if (leftTactic.risk > 0) {
    options.push(createDuelOption("right", "战术反噬", buildDuelTacticBackfireDetail(battle.left, battle.right, leftTactic), 2 + leftTactic.risk + right.counter, 1.9, "backfire"));
  }
  if (rightTactic.risk > 0) {
    options.push(createDuelOption("left", "战术反噬", buildDuelTacticBackfireDetail(battle.right, battle.left, rightTactic), 2 + rightTactic.risk + left.counter, 1.9, "backfire"));
  }

  return options
    .map((option, index) => ({ ...option, index, weight: Math.max(0.05, Number(option.weight) || 0.05) }))
    .filter((option) => option.weight > 0);
}

function buildDuelRoundDetail(actor, opponent, kind) {
  const actorHooks = buildDuelProfileCombatHooks(actor);
  const opponentHooks = buildDuelProfileCombatHooks(opponent);
  switch (kind) {
    case "initiative":
      return `${actor.name} 以${actorHooks.primary || "咒力节奏"}抢先铺开攻势，迫使${opponent.name}用${opponentHooks.defense || "防守和走位"}拆解第一波压制。`;
    case "technique":
      return `${actor.name} 把${actorHooks.technique || "术式"}压进有效距离，利用${actorHooks.rule || "咒力操作"}撬开${opponent.name}的防线。`;
    case "melee":
      return `${actor.name} 靠${actorHooks.body || "体术和咒力强化"}贴身交换，逼得${opponent.name}的${opponentHooks.primary || "主轴"}难以完整展开。`;
    case "resource":
      return `${actor.name} 调动${actorHooks.resource || "装备、式神或外部资源"}介入战场，把一次正面交换改成多点压迫。`;
    case "domain":
      return `${actor.name} 围绕${actorHooks.domain || "领域/反领域手段"}争夺结界主动权，压缩${opponent.name}的行动路线。`;
    case "counter":
      return `${actor.name} 借${actorHooks.counter || "相性、扰动或反制手段"}抓到空档，让${opponent.name}的${opponentHooks.primary || "攻势"}出现偏差。`;
    case "finisher":
      return `${actor.name} 把${actorHooks.winPath || actorHooks.primary || "既有胜路"}压到收束点，试图在对手调整前结束交换。`;
    default:
      return `${actor.name} 依靠${actorHooks.primary || "既有战斗配置"}拿到阶段优势。`;
  }
}

function buildDuelNeutralRoundDetail(left, right) {
  const leftHooks = buildDuelProfileCombatHooks(left);
  const rightHooks = buildDuelProfileCombatHooks(right);
  return `${left.name} 的${leftHooks.primary || "战斗主轴"}与${right.name}的${rightHooks.primary || "应对手段"}互相试探，双方都没有把情报交换成决定性收益。`;
}

function buildDuelTacticBackfireDetail(actor, opponent, tactic) {
  const actorHooks = buildDuelProfileCombatHooks(actor);
  const opponentHooks = buildDuelProfileCombatHooks(opponent);
  return `${actor.name} 选择${tactic.label}时暴露节奏，${opponent.name}用${opponentHooks.counter || opponentHooks.primary || "反制"}绕开${actorHooks.primary || "主攻路线"}。`;
}

function buildDuelProfileCombatHooks(profile = {}) {
  const technique = cleanDuelNarrativeHook(profile.techniqueText, ["未记录"]);
  const domain = cleanDuelNarrativeHook(profile.domainProfile, ["无领域", "未记录"]);
  const loadout = cleanDuelNarrativeHook([...(profile.loadout || []), profile.externalResource].filter(Boolean).join("、"), ["无"]);
  const traits = cleanDuelNarrativeHook(profile.innateTraits?.join("、"), []);
  const specialTerms = cleanDuelNarrativeHook((profile.specialTerms || []).map((term) => term.name || term).join("、"), []);
  const winPath = cleanDuelNarrativeHook(profile.winPaths?.[0], []);
  const risk = cleanDuelNarrativeHook(profile.risks?.[0], []);
  const flags = new Set(profile.flags || []);
  const body = traits && /天与|体术|黑闪|肉体|暴君|速度|力量|甚尔|真希/.test(traits)
    ? traits
    : Number(profile.axes?.body || 0) >= 7 ? "高强度肉体与近身压迫" : "";
  const counter = specialTerms ||
    (flags.has("techniqueNullification") ? "接触破术" : "") ||
    (flags.has("techniqueDisruption") ? "术式干扰" : "") ||
    (flags.has("domainSureHitInvalid") ? "规避领域必中" : "") ||
    (flags.has("soulDamage") ? "灵魂伤害" : "") ||
    winPath;
  const defense = domain ||
    (flags.has("antiDomain") ? "反领域手段" : "") ||
    (profile.survivalRounds ? `耐活 ${profile.survivalRounds} 回合` : "") ||
    risk;
  const primary = technique || domain || loadout || traits || winPath;
  return {
    primary,
    technique,
    domain,
    resource: loadout,
    traits,
    body,
    counter,
    defense,
    rule: specialTerms || traits || winPath,
    winPath,
    risk
  };
}

function cleanDuelNarrativeHook(value, blocked = []) {
  const text = normalizeCustomDuelLongText(value || "");
  if (!text) return "";
  if (blocked.some((item) => item && text.includes(item))) return "";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function createDuelOption(actor, label, detail, weight, score, kind = "neutral") {
  return { actor, label, detail, weight, score, kind };
}

function getDuelRoundFactors(profile, opponent, tactic, battle, side) {
  const unitRatio = Math.log2((profile.combatPowerUnit.value + 180) / (opponent.combatPowerUnit.value + 180));
  const scoreLead = side === "left"
    ? battle.leftScore - battle.rightScore
    : battle.rightScore - battle.leftScore;
  const comeback = scoreLead < -2 ? Math.min(1.4, Math.abs(scoreLead) * 0.18) : 0;
  const hasResources = profile.loadout.length || Boolean(profile.externalResource && profile.externalResource !== "无");
  const domainAccess = hasDuelDomainAccess(profile);
  const resource = getDuelResourcePair(battle, side);
  const techniqueImbalance = getDuelStatusEffectValue(resource, "techniqueImbalance");
  const imbalancePenalty = techniqueImbalance *
    Number(getDuelResourceRules().statusEffects?.techniqueImbalance?.weightPenalty || 1.45);
  const actionContext = getDuelActionContext(battle, side);
  const actionWeight = actionContext.weightDeltas || {};
  const residueReading = getDuelStatusEffectValue(resource, "residueReading");
  const domainActionSuppression = getDuelStatusEffectValue(resource, "domainActionSuppression");
  const domainScriptNoCard = getDuelStatusEffectValue(resource, "domainScriptNoCard");
  const techniqueConfiscated = getDuelStatusEffectValue(resource, "techniqueConfiscated");
  const curseTechniqueBound = getDuelStatusEffectValue(resource, "curseTechniqueBound");
  const incarnatedSuppressed = getDuelStatusEffectValue(resource, "incarnatedSuppressed") + getDuelStatusEffectValue(resource, "incarnatedStabilityDown");
  const summonSuppressed = getDuelStatusEffectValue(resource, "summonSuppressed") + getDuelStatusEffectValue(resource, "controllerRedirectPressure");
  const toolLocked = getDuelStatusEffectValue(resource, "cursedToolConfiscated") + getDuelStatusEffectValue(resource, "toolFunctionLocked");
  const exorcismOrderCandidate = getDuelStatusEffectValue(resource, "exorcismOrderCandidate");
  const trialRulePressure = getDuelStatusEffectValue(resource, "trialRulePressure");
  const executionStateCandidate = getDuelStatusEffectValue(resource, "executionStateCandidate");
  const jackpotStateCandidate = getDuelStatusEffectValue(resource, "jackpotStateCandidate");
  const openSlashPressure = getDuelStatusEffectValue(resource, "openSlashPressure");
  const soulTouchPressure = getDuelStatusEffectValue(resource, "soulTouchPressure");
  const shikigamiAutoAttack = getDuelStatusEffectValue(resource, "shikigamiAutoAttack");
  const jackpotCycleCandidate = getDuelStatusEffectValue(resource, "jackpotCycleCandidate");
  const domainProfilePenalty = domainActionSuppression * 0.75 + domainScriptNoCard * 2.4 + techniqueConfiscated * 1.25 + curseTechniqueBound * 1.05 + incarnatedSuppressed * 0.55 + summonSuppressed * 0.65 + toolLocked * 0.55 + trialRulePressure * 0.45 + exorcismOrderCandidate * 0.75;
  const domainPressurePenalty = openSlashPressure * 0.55 + soulTouchPressure * 0.5 + shikigamiAutoAttack * 0.45 + summonSuppressed * 0.25 + toolLocked * 0.18;
  return {
    power: clamp(unitRatio * 2.1, -3.2, 4.2),
    jujutsu: clamp((profile.axes.jujutsu - 5) * 0.75, -1.5, 3.2),
    body: clamp((profile.axes.body - 5) * 0.72, -1.5, 3.2),
    initiative: tactic.initiative + clamp(profile.axes.insight - 6, -1, 2) * 0.22 + comeback - domainActionSuppression * 0.45 - domainScriptNoCard * 1.6 - domainPressurePenalty * 0.2 + Number(actionWeight.initiative || 0),
    technique: tactic.technique + clamp(profile.axes.build - 1.5, -0.8, 2.4) + profile.disruptionScore * 0.08 - imbalancePenalty - domainProfilePenalty + executionStateCandidate * 0.35 + Number(actionWeight.technique || 0),
    melee: tactic.melee + clamp(profile.axes.body - opponent.axes.body, -2.4, 2.4) * 0.35 + executionStateCandidate * 0.45 + jackpotStateCandidate * 0.25 + Number(actionWeight.melee || 0),
    domain: tactic.domain + (domainAccess ? 2.6 : -1.4) + clamp(profile.axes.jujutsu - opponent.axes.jujutsu, -2, 2) * 0.35 - imbalancePenalty - domainProfilePenalty * 0.85 + Number(actionWeight.domain || 0),
    counter: tactic.counter + profile.disruptionScore * 0.16 + clamp(profile.axes.insight - opponent.axes.insight, -2, 2) * 0.26 + residueReading * 0.65 + Number(actionWeight.counter || 0),
    sustain: tactic.sustain + (profile.flags.includes("jackpotSustain") ? 2.2 : 0) + (hasResources ? 0.7 : 0) + jackpotCycleCandidate * 0.8 + jackpotStateCandidate * 1.7 - domainPressurePenalty * 0.35 - exorcismOrderCandidate * 0.55 + Number(actionWeight.sustain || 0),
    resource: (hasResources ? 1.4 : -0.6) + (profile.flags.includes("trueRikaResource") ? 2 : 0) + jackpotCycleCandidate * 0.45 + jackpotStateCandidate * 1.25 - summonSuppressed * 0.9 - toolLocked * 1.05 + Number(actionWeight.resource || 0),
    disruption: clamp(profile.disruptionScore - 3, 0, 6) * 0.36,
    finisher: tactic.finisher + (battle.round >= 3 ? 1.3 : 0) + clamp(profile.axes.body + profile.axes.jujutsu - 13, -1.2, 2.4) - imbalancePenalty - techniqueConfiscated * 1.1 - curseTechniqueBound * 0.95 - toolLocked * 0.75 - domainActionSuppression * 0.5 - exorcismOrderCandidate * 0.35 + executionStateCandidate * 1.4 + Number(actionWeight.finisher || 0)
  };
}

function hasDuelDomainAccess(profile) {
  return Boolean(getDuelDomainResponseProfile(profile)?.canExpandDomain);
}

function drawWeightedDuelOption(options, rng = Math.random) {
  const total = options.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  if (!options.length || total <= 0) return null;
  let cursor = rng() * total;
  for (const option of options) {
    cursor -= Number(option.weight || 0);
    if (cursor <= 0) return option;
  }
  return options[options.length - 1];
}

function applyDuelRoundResult(battle, result) {
  battle.round += 1;
  if (battle.resourceState) battle.resourceState.round = battle.round;
  let leftGain = 0;
  let rightGain = 0;
  if (result.actor === "left") leftGain = result.score;
  if (result.actor === "right") rightGain = result.score;
  if (result.actor === "neutral") {
    leftGain = 0.45;
    rightGain = 0.45;
  }
  const actorResource = getDuelResourcePair(battle, result.actor);
  const opponentResource = getDuelResourcePair(battle, getDuelOpponentSide(result.actor));
  if (actorResource && opponentResource) {
    applyDuelEventResourceDelta(result, actorResource, opponentResource, battle);
  } else {
    recordDuelResourceChange(battle, {
      side: "neutral",
      title: "互相试探",
      detail: "双方压低输出交换情报，体势与咒力没有明显变化。",
      type: "system",
      delta: {}
    });
  }
  updateDuelDomainLoad(battle.resourceState?.p1, battle.resourceState?.p2, { battle, side: "left", maintain: true });
  updateDuelDomainLoad(battle.resourceState?.p2, battle.resourceState?.p1, { battle, side: "right", maintain: true });
  if (checkDuelDomainMeltdown(battle.resourceState?.p1)) triggerDuelDomainMeltdown(battle.resourceState.p1, battle, "left");
  if (checkDuelDomainMeltdown(battle.resourceState?.p2)) triggerDuelDomainMeltdown(battle.resourceState.p2, battle, "right");
  syncDuelTrialSubPhaseLifecycle(battle);
  applyDuelRoundResourceRegen(battle.resourceState?.p1, battle, "left");
  applyDuelRoundResourceRegen(battle.resourceState?.p2, battle, "right");
  const latestResource = battle.resourceState?.residualLog?.[0]?.detail || "";
  battle.leftScore = Number((battle.leftScore + leftGain).toFixed(3));
  battle.rightScore = Number((battle.rightScore + rightGain).toFixed(3));
  battle.momentum = clamp(battle.momentum + leftGain - rightGain, -8, 8);
  const canonJogoPresentation = globalThis.JJKShibuyaIncident?.getSukunaJogoCanonRoundPresentation?.(battle, result);
  const canonMahoragaPresentation = globalThis.JJKShibuyaIncident?.getSukunaMahoragaCanonRoundPresentation?.(battle, result);
  const canonMahitoPresentation = globalThis.JJKShibuyaIncident?.getMahitoCanonRoundPresentation?.(battle, result);
  const canonPresentation = canonMahitoPresentation?.applied
    ? canonMahitoPresentation
    : canonMahoragaPresentation?.applied
      ? canonMahoragaPresentation
      : canonJogoPresentation;
  const presentation = canonPresentation?.applied
    ? { label: canonPresentation.label, detail: canonPresentation.detail }
    : { label: result.label, detail: result.detail };
  battle.log.unshift({
    round: battle.round,
    title: presentation.label,
    detail: latestResource ? `${presentation.detail} 残秽记录：${latestResource}` : presentation.detail
  });
  globalThis.JJKShibuyaIncident?.persistMahitoActiveEncounterSnapshot?.(battle, { roundResultApplied: true });
}

function maybeResolveDuelBattle(battle) {
  if (battle.resolved) return true;
  globalThis.JJKDuelActions?.resolveDuelMiracleLethalPreventionForBattle?.(battle);
  if (typeof document !== "undefined" && battle?.activityContext) {
    document.dispatchEvent(new CustomEvent("jjk-duel-battle-progress", { detail: { battle } }));
  }
  globalThis.JJKShibuyaIncident?.enforceShibuyaObjectiveEndContract?.(battle);
  cleanupDefeatedDuelDomains(battle);
  if (handleDounaGauntletTransitions(battle)) return true;
  const result = resolveDuelBattleEnd(battle);
  if (!result?.ended) return false;
  applyDuelBattleEndResult(battle, result);
  return Boolean(battle.resolved);
}

function hasDuelImmediateEndSignal(battle) {
  if (!battle?.resourceState) return false;
  if (battle.specialEndCondition?.ended || battle.pendingSpecialEndCondition?.ended) return true;
  return Number(battle.resourceState.p1?.hp || 0) <= 0 || Number(battle.resourceState.p2?.hp || 0) <= 0;
}

function maybeResolveDuelBattleAfterHandActions(battle) {
  if (!battle || battle.resolved || !hasDuelImmediateEndSignal(battle)) return false;
  const previousRound = Number(battle.round || 0);
  const previousResourceRound = Number(battle.resourceState?.round || previousRound);
  const handRound = previousRound + 1;
  battle.round = handRound;
  if (battle.resourceState) battle.resourceState.round = handRound;
  const handled = maybeResolveDuelBattle(battle);
  if (battle.resolved || handled) return true;
  battle.round = previousRound;
  if (battle.resourceState) battle.resourceState.round = previousResourceRound;
  return false;
}

function applyDuelBattleEndResult(battle, result) {
  if (!battle || battle.resolved || !result?.ended) return;
  cleanupDefeatedDuelDomains(battle);
  battle.finalRate = computeDuelBattleFinalRate(battle);
  battle.winnerSide = result.winnerSide || "draw";
  battle.battleEnded = true;
  battle.endReason = result.endReason || "special_rule";
  battle.endDetail = String(result.detail || "");
  battle.endingRound = battle.round;
  battle.resolutionReason = battle.endReason;
  battle.resolutionRoll = null;
  const snapshot = buildDuelFinalSnapshot(battle);
  battle.finalSnapshot = snapshot;
  battle.finalResourceSnapshot = snapshot.finalResourceSnapshot;
  battle.finalHandState = snapshot.finalHandState;
  battle.finalDomainState = snapshot.finalDomainState;
  const explicitSpecialEnd = battle.specialEndCondition?.ended === true || battle.pendingSpecialEndCondition?.ended === true;
  const reasonLabel = explicitSpecialEnd
    ? (battle.winnerSide === "left" ? "场景目标达成" : battle.winnerSide === "right" ? "场景目标失败" : "场景目标结束")
    : (result.endReasonLabel || getDuelEndReasonLabel(battle.endReason));
  battle.endReasonLabel = reasonLabel;
  const winnerLabel = battle.winnerSide === "left"
    ? battle.left.name
    : battle.winnerSide === "right"
      ? battle.right.name
      : "无胜者";
  const loserLabel = result.loserSide === "left"
    ? battle.left.name
    : result.loserSide === "right"
      ? battle.right.name
      : "双方";
  const detail = explicitSpecialEnd && result.detail
    ? `第 ${formatNumber(battle.round)} 回合：${String(result.detail)}`
    : battle.endReason === "safety_cap_reached"
    ? `第 ${formatNumber(battle.round)} 回合：战斗达到技术安全上限，未自然结束。系统判定为长期僵持，请导出反馈。结束原因：${reasonLabel}。`
    : battle.endReason === "mutual_collapse"
      ? `第 ${formatNumber(battle.round)} 回合：双方体势同时归零，无法继续战斗。结束原因：${reasonLabel}。`
      : `第 ${formatNumber(battle.round)} 回合：${loserLabel}体势归零，无法继续战斗。胜者：${winnerLabel}。结束原因：${reasonLabel}。`;
  const logSide = battle.winnerSide === "left" || battle.winnerSide === "right" ? battle.winnerSide : "neutral";
  recordDuelResourceChange(battle, {
    side: logSide,
    title: reasonLabel,
    detail,
    type: "system",
    delta: {
      battleEnded: true,
      winnerSide: battle.winnerSide,
      endReason: battle.endReason,
      finalRateReference: Number(battle.finalRate.toFixed(4))
    }
  });
  if (battle.domainSubPhase?.type === "trial" && !battle.domainSubPhase.verdictResolved) {
    battle.domainSubPhase.verdictResolved = true;
    battle.domainSubPhase.violenceRestricted = false;
    battle.domainSubPhase.trialEndReason = "battleEnded";
    battle.domainSubPhase.trialStatus = "resolved";
    updateDuelDomainTrialContext(battle, { trialStatus: "resolved", trialEndReason: "battleEnded" });
    invalidateDuelActionChoices(battle);
  }
  battle.resolved = true;
  updateDuelResourceReplayKey(battle);
  if (battle.dounaGauntlet && battle.winnerSide === "left") {
    showDounaLeaderboardSubmitDialog(battle);
  } else if (battle.dounaGauntlet) {
    submitDounaFailureResult(battle).catch(() => {});
  }
  if (typeof document !== "undefined" && !battle.__duelBattleEndedEventDispatched) {
    battle.__duelBattleEndedEventDispatched = true;
    document.dispatchEvent(new CustomEvent("jjk-duel-battle-ended", {
      detail: {
        battle,
        battleId: battle.battleId,
        winnerSide: battle.winnerSide,
        endReason: battle.endReason,
        activityContext: clonePlain(battle.activityContext || null)
      }
    }));
  }
}

function computeDuelBattleFinalRate(battle) {
  const scoreDelta = battle.leftScore - battle.rightScore;
  const momentumDelta = Number(battle.momentum || 0);
  const resourceDelta = computeDuelResourceWinRateDelta(battle);
  const raw = Number(battle.baseRate || 0.5) + scoreDelta * 0.052 + momentumDelta * 0.018 + resourceDelta;
  return clamp(raw, 0.03, 0.97);
}

function getDuelCharacterCards() {
  const officialCards = (state.characterCards?.cards || [])
    .filter((card) => card?.battleUnavailable !== true)
    .slice()
    .sort((left, right) => String(left.displayName).localeCompare(String(right.displayName), "zh-Hans-CN"));
  return [
    ...state.customDuelCards,
    ...officialCards
  ];
}

function syncDuelSelectOptions(cards) {
  const leftValue = els.duelLeftSelect.value;
  const rightValue = els.duelRightSelect.value;
  const options = cards.map((card) => `<option value="${escapeHtml(card.characterId)}">${escapeHtml(getDuelCardOptionLabel(card))}</option>`).join("");
  if (els.duelLeftSelect.options.length !== cards.length || els.duelLeftSelect.dataset.optionSignature !== options) {
    els.duelLeftSelect.innerHTML = options;
    els.duelLeftSelect.dataset.optionSignature = options;
  }
  if (els.duelRightSelect.options.length !== cards.length || els.duelRightSelect.dataset.optionSignature !== options) {
    els.duelRightSelect.innerHTML = options;
    els.duelRightSelect.dataset.optionSignature = options;
  }
  els.duelLeftSelect.value = cards.some((card) => card.characterId === leftValue) ? leftValue : (cards[0]?.characterId || "");
  const defaultRight = cards[1]?.characterId || cards[0]?.characterId || "";
  els.duelRightSelect.value = cards.some((card) => card.characterId === rightValue) ? rightValue : defaultRight;
  if (els.duelLeftSelect.value === els.duelRightSelect.value && cards.length > 1) {
    els.duelRightSelect.value = cards.find((card) => card.characterId !== els.duelLeftSelect.value)?.characterId || defaultRight;
  }
  syncDounaRosterOptions(cards);
}

function getDuelCardOptionLabel(card) {
  return card.customDuel ? `自定义 · ${card.displayName}` : card.displayName;
}

function renderDuelCharacterCard(profile, sideLabel) {
  const statRows = [
    ["咒力总量", profile.baseStats.cursedEnergy, profile.raw.cursedEnergyScore],
    ["咒力操纵", profile.baseStats.control, profile.raw.controlScore],
    ["咒力效率", profile.baseStats.efficiency, profile.raw.efficiencyScore],
    ["体质", profile.baseStats.body, profile.raw.bodyScore],
    ["体术", profile.baseStats.martial, profile.raw.martialScore],
    ["悟性", profile.baseStats.talent, profile.raw.talentScore]
  ].map(([label, rank, score]) => {
    const renderer = globalThis.JJKCharacter?.renderCharacterPanelStatMarkup;
    if (typeof renderer === "function") {
      return renderer(label, rank, score, { className: "duel-stat" });
    }
    return `
      <div class="character-panel-stat duel-stat" aria-label="${escapeHtml(`${label}：${rank || "-"}，真实数值 ${formatNumber(score)}`)}">
        <span class="character-panel-stat-label">${escapeHtml(label)}</span>
        <strong class="character-panel-stat-grade">${escapeHtml(rank || "-")}</strong>
        <small class="character-panel-stat-value">实值 ${formatNumber(score)}</small>
      </div>
    `;
  }).join("");

  const axisText = `咒术 ${formatNumber(profile.axes.jujutsu)} / 肉体 ${formatNumber(profile.axes.body)} / 悟性 ${formatNumber(profile.axes.insight)} / 构筑 ${formatNumber(profile.axes.build)}`;
  return `
    <article class="duel-card">
      <span class="badge">${escapeHtml(sideLabel)}</span>
      <h3>${escapeHtml(profile.name)}</h3>
      <div class="duel-meta">
        <span class="duel-chip">${escapeHtml(getDuelDisplayGrade(profile))}</span>
        <span class="duel-chip">${escapeHtml(getDuelPowerTierLabel(profile))}</span>
        <span class="duel-chip">${escapeHtml(profile.pool)}</span>
        <span class="duel-chip">战力 ${escapeHtml(profile.combatPowerUnit.label)}</span>
        <span class="duel-chip">扰动 ${escapeHtml(profile.disruptionUnit.label)}</span>
      </div>
      <div class="duel-stats">${statRows}</div>
      <dl class="duel-block">
        <dt>四轴</dt><dd>${escapeHtml(axisText)}</dd>
        <dt>特质</dt><dd>${escapeHtml(formatDuelList(profile.innateTraits))}</dd>
        <dt>术式/强度</dt><dd>${escapeHtml(profile.techniqueText)}</dd>
        <dt>领域</dt><dd>${escapeHtml(profile.domainProfile || "未记录")}</dd>
        <dt>装备/外部资源</dt><dd>${escapeHtml(formatDuelList([...profile.loadout, profile.externalResource].filter(Boolean)))}</dd>
        <dt>特殊词条</dt><dd>${escapeHtml(formatDuelProfileSpecialTerms(profile))}</dd>
        <dt class="debug-only">机制标签</dt><dd class="debug-only">${escapeHtml(formatDuelList(profile.flags))}</dd>
        <dt>说明</dt><dd>${escapeHtml(profile.notes || "无")}</dd>
      </dl>
    </article>
  `;
}

function renderDuelCharacterRankReferenceTable() {
  const renderer = globalThis.JJKCharacter?.renderCharacterRankReferenceTable;
  return typeof renderer === "function"
    ? renderer({ className: "duel-rank-reference" })
    : "";
}

function getDuelDisplayGrade(profile = {}) {
  if (isDuelSpecialGradeCursedSpiritCard(profile)) {
    const curseGrade = profile.officialGrade || "特级咒灵";
    const humanGrade = gradeLabel(profile.visibleGrade);
    return `${curseGrade} / 人类换算：${humanGrade}`;
  }
  return profile.officialGrade || gradeLabel(profile.visibleGrade) || "未记录评级";
}

function getDuelPowerTierLabel(profile = {}) {
  const labels = {
    canonCeiling: "原作天花板",
    postCanonException: "后日谈例外级",
    postCanonCeiling: "后日谈天花板",
    haxException: "规则例外型",
    topTierPhysical: "顶级肉体系",
    specialGrade: "特级战力",
    specialGrade1: "特别一级战力",
    specialGradeCurse: "特级咒灵",
    topTier: "顶级战力",
    topTierSustain: "顶级续航",
    topTierMinus: "顶级下位",
    supportHax: "辅助规则型",
    newGenerationTop: "新世代顶级",
    civilianOrSupport: "民间/辅助",
    disasterCurse: "灾害咒灵",
    cursedSpiritSpecial: "特级咒灵",
    grade1Plus: "一级以上",
    grade1: "一级",
    grade2Plus: "二级以上",
    grade1Trickster: "一级技巧型",
    sendaiTop: "仙台顶级",
    custom: "自定义"
  };
  return labels[profile.powerTier] || profile.powerTier || profile.pool || "战力层级未记录";
}

function evaluateDuelCharacterCard(card) {
  const activeMechanisms = getDuelActiveMechanisms(card);
  const mechanismAdjustedStats = applyDuelMechanismRankAdjustments(card.baseStats || {}, activeMechanisms);
  const effectiveBaseStats = globalThis.JJKSpecialConstitution?.applyStatContract(mechanismAdjustedStats, card) || mechanismAdjustedStats;
  const raw = {
    cursedEnergyScore: duelRankValue(effectiveBaseStats.cursedEnergy),
    controlScore: duelRankValue(effectiveBaseStats.control),
    efficiencyScore: duelRankValue(effectiveBaseStats.efficiency),
    bodyScore: duelRankValue(effectiveBaseStats.body),
    martialScore: duelRankValue(effectiveBaseStats.martial),
    talentScore: duelRankValue(effectiveBaseStats.talent)
  };
  const lockedRaw = applyDuelMechanismLocks(raw, activeMechanisms);
  const mechanismImpact = summarizeDuelMechanisms(activeMechanisms);
  const loadout = summarizeDuelLoadout(card.loadout || []);
  const technique = summarizeDuelTechnique(card);
  const external = summarizeDuelExternalResource(card);
  const domain = summarizeDuelDomain(card);
  const axisConfig = state.mechanisms?.axisWeights || {};
  const specialHandTags = Array.from(new Set([]
    .concat(Array.isArray(card.specialHandTags) ? card.specialHandTags : [])
    .concat(Array.isArray(card["特殊手札"]) ? card["特殊手札"] : [])
    .map((tag) => String(tag || "").trim())
    .filter((tag) => tag && tag !== "无")));
  const derivedAdvancedTechniques = /鹿紫云一?|kashimo|弥虚葛笼|弥须葛笼|彌虚葛籠|彌須葛籠|空篮|hollow[_\s-]?wicker[_\s-]?basket/i
    .test([getDuelCardMechanicText(card)].concat(specialHandTags).join(" "))
    ? ["弥虚葛笼", "反领域能力"]
    : [];
  const derivedTechniqueEvidence = [getDuelCardMechanicText(card)].concat(specialHandTags).join(" ");
  if (!/无领域|没有领域|不具备领域|无明确领域|未掌握领域|简易领域|反领域|领域对策|辅助结界|帐|轨迹型领域效果|no\s+domain/i.test(derivedTechniqueEvidence) &&
    /领域展开|生得领域|开放领域|顶级领域|顶尖领域|顶格领域|最高级领域|未完成领域|无量空处|伏魔御厨子|坐杀搏徒|真赝相爱|自闭圆顿裹|盖棺铁围山|荡蕴平线|时胞月宫殿|诛伏赐死|三重疾苦|胎藏遍野|嵌合暗翳庭|domain expansion/i.test(derivedTechniqueEvidence)) {
    derivedAdvancedTechniques.unshift("领域展开");
  }

  const jujutsu = clamp(
    weightedDuelScore(lockedRaw, axisConfig.jujutsu) + mechanismImpact.axisBonus.jujutsu + technique.axisBonus.jujutsu + external.axisBonus.jujutsu,
    0,
    12
  );
  const body = clamp(weightedDuelScore(lockedRaw, axisConfig.body) + mechanismImpact.axisBonus.body + loadout.axisBonus.body, 0, 12);
  const insight = clamp(weightedDuelScore(lockedRaw, axisConfig.insight) + mechanismImpact.axisBonus.insight + technique.axisBonus.insight, 0, 12);
  const build = clamp(
    technique.axisBonus.build + loadout.axisBonus.build + mechanismImpact.axisBonus.build + external.axisBonus.build + domain.axisBonus.build,
    0,
    12
  );

  const baseScore = jujutsu * 0.33 + body * 0.29 + insight * 0.16 + build * 0.22;
  let combatScore = clamp(
    baseScore + mechanismImpact.scoreBonus + loadout.scoreBonus + technique.scoreBonus + external.scoreBonus + domain.scoreBonus + duelStageBonus(card.stage),
    0,
    12
  );
  const physicalCarryScore = clamp(body * 0.6 + insight * 0.18 + build * 0.16 + loadout.scoreBonus + mechanismImpact.scoreBonus + loadout.disruption * 0.08, 0, 12);
  if (body >= 9 && mechanismImpact.tags.includes("zeroCE")) {
    combatScore = Math.max(combatScore, Math.min(physicalCarryScore, 8.15));
  }
  if (body >= 7.2 && jujutsu >= 6.8 && insight >= 6.6) {
    combatScore = Math.max(combatScore, body * 0.28 + jujutsu * 0.34 + insight * 0.18 + build * 0.2);
  }
  const mechanicText = getDuelCardMechanicText(card);
  const sixEyesLimitless = isDuelSixEyesLimitless(card, mechanicText);
  const regularLimitless = !sixEyesLimitless && isDuelLimitless(card, mechanicText);
  const limitlessCombatBonus = sixEyesLimitless ? 1.35 : (regularLimitless ? 0.9 : 0);
  if (limitlessCombatBonus > 0) {
    combatScore = clamp(combatScore + limitlessCombatBonus, 0, 12);
  }
  const trialExecutionOwner = isDuelTrialExecutionOwner(card, mechanicText);
  if (trialExecutionOwner) {
    combatScore = clamp(combatScore + 0.75, 0, 12);
  }

  const disruptionScore = clamp(technique.disruption + loadout.disruption + mechanismImpact.disruption + external.disruption + domain.disruption, 0, 12);
  let combatPowerUnit = buildCombatPowerUnit(combatScore);
  if (sixEyesLimitless || regularLimitless) {
    const limitlessPowerScale = sixEyesLimitless ? 1.75 : 1.34;
    const scaledValue = Math.max(combatPowerUnit.value || 0, Math.round(Number(combatPowerUnit.value || 0) * limitlessPowerScale));
    combatPowerUnit = {
      ...combatPowerUnit,
      value: scaledValue,
      label: formatCombatPowerUnit(scaledValue),
      band: getCombatPowerUnitBand(scaledValue),
      limitlessPowerScale,
      formula: `${combatPowerUnit.formula || "combatPower"} * ${limitlessPowerScale}`
    };
  }
  if (trialExecutionOwner) {
    const trialExecutionPowerScale = 2.8;
    const scaledValue = Math.max(combatPowerUnit.value || 0, Math.round(Number(combatPowerUnit.value || 0) * trialExecutionPowerScale));
    combatPowerUnit = {
      ...combatPowerUnit,
      value: scaledValue,
      label: formatCombatPowerUnit(scaledValue),
      band: getCombatPowerUnitBand(scaledValue),
      trialExecutionPowerScale,
      formula: `${combatPowerUnit.formula || "combatPower"} * ${trialExecutionPowerScale}`
    };
  }
  const profile = {
    id: card.characterId,
    characterId: card.characterId,
    battleCharacterId: card.battleCharacterId || "",
    battleCharacterName: card.battleCharacterName || "",
    name: card.displayName,
    displayName: card.displayName || card.name || card.characterId || "",
    visibleGrade: getDuelVisibleGrade(card),
    tier: card.powerTier || "",
    powerTier: card.powerTier || "",
    officialGrade: card.officialGrade || "",
    stage: card.stage || "",
    domainId: card.domainId || "",
    trialSubjectType: card.trialSubjectType || "",
    trialEligibility: card.trialEligibility || "",
    verdictVocabulary: card.verdictVocabulary || "",
    hasLegalAgency: card.hasLegalAgency,
    hasSelfAwareness: card.hasSelfAwareness,
    canDefend: card.canDefend,
    canRemainSilent: card.canRemainSilent,
    techniquePower: card.techniquePower || "",
    baseStats: effectiveBaseStats,
    rawBaseStats: card.baseStats || {},
    raw: lockedRaw,
    axes: { jujutsu, body, insight, build },
    combatScore,
    combatPowerUnit,
    pool: classifyInstantCombatPool(combatScore).label,
    disruptionScore,
    disruptionUnit: buildDuelDisruptionUnit(disruptionScore),
    innateTraits: card.innateTraits || [],
    traits: Array.isArray(card.traits) ? card.traits.slice() : [],
    cardTags: Array.isArray(card.cardTags) ? card.cardTags.slice() : [],
    advancedTechniques: Array.from(new Set([...(card.advancedTechniques || []), ...derivedAdvancedTechniques])),
    loadout: loadout.matchedTools.length ? loadout.matchedTools : (card.loadout || []),
    externalResource: card.externalResource || "",
    techniqueText: formatDuelTechniqueText(card),
    domainProfile: card.domainProfile || "",
    domainScript: card.domainScript || null,
    customDuel: Boolean(card.customDuel),
    specialHandTags,
    "特殊手札": specialHandTags,
    explicitSpecialHandTags: specialHandTags,
    characterCardProfile: card,
    battleFlags: card.flags && typeof card.flags === "object" ? { ...card.flags } : {},
    flags: Array.from(new Set([...(technique.tags || []), ...(loadout.tags || []), ...(mechanismImpact.tags || []), ...(external.tags || []), ...(domain.tags || [])])),
    notes: card.notes || ""
  };
  if (!state.debugMode) return applyDuelSpecialTermsToProfile(profile);
  const withManualOverride = applyDuelManualCombatOverride(profile, {
    combatScore: card.debugManualCombatScore,
    combatUnit: card.debugManualCombatUnit,
    source: "自定义角色直填"
  });
  return applyDuelSpecialTermsToProfile(withManualOverride);
}

function formatDuelTechniqueText(card) {
  const details = [];
  if (card.techniqueName) details.push(card.techniqueName);
  if (card.techniqueDescription) details.push(card.techniqueDescription);
  if (card.techniquePower) details.push(`强度 ${card.techniquePower}`);
  return details.length ? details.join(" / ") : "未记录";
}

function duelRankValue(rank) {
  const curve = state.mechanisms?.rankGrowthModel?.numericCurve || state.mechanisms?.rankScale || state.strength?.rankScale || {};
  const value = callSiteModuleImplementation("JJKCharacter", "characterRankValue", [rank, { rankScale: curve }]);
  return Number(value >= 0 ? value : 0);
}

function getDuelRankOrder() {
  return Array.isArray(DUEL_RANKS) && DUEL_RANKS.length
    ? DUEL_RANKS
    : ["E-", "E", "D", "C", "B", "A", "S", "SS", "SSS", "EX-", "EX"];
}

function normalizeDuelRankLabel(rank) {
  const match = String(rank || "").trim().toUpperCase().match(/^(EX-|EX|SSS|SS|S|A|B|C|D|E-|E)/);
  return match ? match[1] : "";
}

function stepDuelRank(rank, delta = 0) {
  const order = getDuelRankOrder();
  const key = normalizeDuelRankLabel(rank);
  const index = order.indexOf(key);
  const step = Number(delta);
  if (index < 0 || !Number.isFinite(step) || !step) return rank;
  return order[Math.max(0, Math.min(order.length - 1, index + Math.trunc(step)))];
}

function duelScoreFieldToBaseStat(field) {
  return {
    cursedEnergyScore: "cursedEnergy",
    controlScore: "control",
    efficiencyScore: "efficiency",
    bodyScore: "body",
    martialScore: "martial",
    talentScore: "talent"
  }[field] || "";
}

function applyDuelMechanismRankAdjustments(baseStats = {}, activeMechanisms = []) {
  const adjusted = { ...(baseStats || {}) };
  for (const mechanism of activeMechanisms || []) {
    for (const adjustment of mechanism.rankAdjustments || []) {
      const stat = adjustment.stat || duelScoreFieldToBaseStat(adjustment.field);
      if (!stat || adjusted[stat] == null) continue;
      adjusted[stat] = stepDuelRank(adjusted[stat], Number(adjustment.delta ?? adjustment.deltaRank ?? 0));
    }
  }
  return adjusted;
}

function weightedDuelScore(raw, weights = {}) {
  let total = 0;
  let weightSum = 0;
  for (const [key, value] of Object.entries(weights || {})) {
    if (!key.endsWith("Score")) continue;
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    total += Number(raw[key] || 0) * weight;
    weightSum += weight;
  }
  return weightSum ? total / weightSum : 0;
}

function getDuelActiveMechanisms(card) {
  const texts = [
    card.displayName,
    card.techniqueName,
    card.techniqueDescription,
    ...(card.innateTraits || []),
    ...(card.advancedTechniques || []),
    ...(card.loadout || []),
    ...(card.selectedMechanisms || []),
    ...(card.techniqueFamilies || []),
    card.domainProfile,
    card.externalResource,
    card.notes
  ].filter(Boolean).map(String);
  const traitTexts = [
    ...(card.innateTraits || []),
    ...(card.advancedTechniques || []),
    ...(card.selectedMechanisms || []),
    ...(card.techniqueFamilies || [])
  ].filter(Boolean).map(String);
  return (state.mechanisms?.mechanisms || []).filter((mechanism) => {
    const exclusiveIds = Array.isArray(mechanism.exclusiveCharacterIds) ? mechanism.exclusiveCharacterIds.map(String) : [];
    const cardId = String(card.characterId || card.id || "");
    if (exclusiveIds.length && !exclusiveIds.includes(cardId)) return false;
    if (mechanism.id === "sixEyes") {
      return traitTexts.some((text) => /六眼|six[_\s-]?eyes|sixEyes/i.test(text));
    }
    if (texts.some((text) => text === mechanism.id || text.includes(mechanism.id))) return true;
    return (mechanism.match || []).some((keyword) => texts.some((text) => text.includes(keyword)));
  });
}

function applyDuelMechanismLocks(raw, activeMechanisms) {
  const locked = { ...raw };
  for (const mechanism of activeMechanisms) {
    for (const lock of mechanism.locks || []) {
      locked[lock.field] = Math.max(Number(locked[lock.field] || 0), Number(lock.minScore || 0));
    }
  }
  return locked;
}

function summarizeDuelMechanisms(activeMechanisms) {
  const result = emptyDuelImpact();
  for (const mechanism of activeMechanisms) mergeDuelImpact(result, mechanism.instantCombatImpact || {});
  result.disruption += result.tags.includes("domainSureHitInvalid") ? 1.2 : 0;
  result.disruption += result.tags.includes("efficiencyLock") ? 0.5 : 0;
  return normalizeDuelImpact(result);
}

function summarizeDuelLoadout(loadout) {
  const result = emptyDuelImpact();
  const matched = [];
  for (const item of loadout) {
    const card = (state.mechanisms?.cursedTools || []).find((tool) => {
      return (tool.match || []).some((keyword) => String(item).includes(keyword));
    });
    if (!card) continue;
    matched.push(card.displayName || card.id);
    mergeDuelImpact(result, card.instantCombatImpact || {});
  }
  if (loadout.length >= 4) result.scoreBonus += 0.36;
  if (loadout.length >= 2) result.scoreBonus += 0.18;
  if (result.tags.includes("physicalScaling")) result.axisBonus.body += 0.22;
  if (result.tags.includes("soulDamage") || result.tags.includes("techniqueNullification")) result.axisBonus.build += 0.42;
  if (result.tags.includes("techniqueDisruption")) result.axisBonus.build += 0.3;
  result.disruption += result.tags.includes("techniqueNullification") ? 1.6 : 0;
  result.disruption += result.tags.includes("soulDamage") ? 1.2 : 0;
  result.disruption += result.tags.includes("techniqueDisruption") ? 1.4 : 0;
  result.matchedTools = matched;
  return normalizeDuelImpact(result);
}

function summarizeDuelTechnique(card) {
  const result = emptyDuelImpact();
  const text = getDuelCardMechanicText(card);
  const score = duelRankValue(card.techniquePower);
  if (score) {
    const scalar = (score - 4) / 8;
    result.axisBonus.jujutsu += scalar * 0.95;
    result.axisBonus.insight += scalar * 0.38;
    result.axisBonus.build += scalar * 2.45;
    result.scoreBonus += scalar * 0.42;
    result.disruption += scalar * 1.45;
    result.tags.push("techniquePower");
  }
  if (card.powerTier === "haxException") {
    result.axisBonus.build += 1.45;
    result.scoreBonus += 0.48;
    result.disruption += 7.35;
    result.tags.push("haxLimitedCombat");
  }
  if (card.powerTier === "supportHax") {
    result.axisBonus.build += 1.35;
    result.scoreBonus -= 0.18;
    result.disruption += 7.3;
    result.tags.push("supportHax");
  }
  if (isDuelSixEyesLimitless(card, text)) {
    result.axisBonus.build += 2.4;
    result.scoreBonus += 3.25;
    result.disruption += 2.4;
    result.tags.push("limitlessDefense", "sixEyesExecution", "reproducibleGojoCore", "customGojoFamilyCore");
  } else if (isDuelLimitless(card, text)) {
    result.axisBonus.build += 1.45;
    result.scoreBonus += 2;
    result.disruption += 1.7;
    result.tags.push("limitlessDefense", "customLimitless");
  }
  if (/Modulo天花板|基础数值接近宿傩|术式强度高于宿傩|达布拉/.test(text)) {
    result.scoreBonus += 1.26;
    result.disruption += 1.45;
    result.tags.push("postCanonTechniqueCeiling");
  }
  if (/400年前最强|古代最强.*无领域|电荷咒力.*强度来源|鹿紫云/.test(text)) {
    result.axisBonus.build += 0.35;
    result.scoreBonus += 0.72;
    result.disruption += 0.95;
    result.tags.push("ancientStrongestNoDomain");
  }
  if (/与秤金次长期相持|秤金次长期相持|秤.*长期相持|里梅/.test(text)) {
    result.axisBonus.build += 0.38;
    result.scoreBonus += 0.72;
    result.disruption += 0.7;
    result.tags.push("hakariAdjacentStall");
  }
  if (/五条长期缠斗|长期缠斗.*五条|黑绳构筑|米格尔/.test(text)) {
    result.axisBonus.body += 0.45;
    result.axisBonus.insight += 0.35;
    result.axisBonus.build += 0.85;
    result.scoreBonus += 1.22;
    result.disruption += 0.65;
    result.tags.push("gojoStallSpecialGrade");
  }
  if (/咒灵操术库存|百鬼夜行不兵分两路|不兵分两路|夏油杰/.test(text)) {
    result.axisBonus.build += 0.55;
    result.scoreBonus += 0.42;
    result.disruption += 0.8;
    result.tags.push("curseInventory");
  }
  return normalizeDuelImpact(result);
}

function getDuelCardMechanicText(card) {
  return [
    card.displayName,
    card.techniqueName,
    card.techniqueDescription,
    card.domainProfile,
    card.domainScript?.domainName,
    card.domainScript?.effectSummary,
    card.externalResource,
    card.notes,
    ...(card.innateTraits || []),
    ...(card.advancedTechniques || []),
    ...(card.loadout || []),
    ...(card.specialHandTags || []),
    ...(card["特殊手札"] || [])
  ].filter(Boolean).join(" ");
}

function isCustomDuelSixEyesLimitless(card, text = getDuelCardMechanicText(card)) {
  if (!card?.customDuel) return false;
  return isDuelSixEyesLimitless(card, text);
}

function isCustomDuelLimitless(card, text = getDuelCardMechanicText(card)) {
  if (!card?.customDuel) return false;
  return isDuelLimitless(card, text);
}

function isDuelSixEyesLimitless(card, text = getDuelCardMechanicText(card)) {
  return text.includes("六眼") && isDuelLimitless(card, text);
}

function isDuelLimitless(card, text = getDuelCardMechanicText(card)) {
  if (/无下限|不可侵|苍|赫|茈|无量空处/.test(text)) return true;
  return text.includes("六眼") && /无限/.test(text);
}

function isDuelTrialExecutionOwner(card, text = getDuelCardMechanicText(card)) {
  if (/诛伏赐死|日车宽见|日车领域|higuruma|deadly\s*sentencing|higuruma_trial_owner|处刑人之剑/i.test(text)) return true;
  return card?.domainScript?.scriptType === "rule_trial_execution";
}

function summarizeDuelExternalResource(card) {
  const result = emptyDuelImpact();
  const text = [card.externalResource, card.notes, ...(card.loadout || [])].filter(Boolean).join(" ");
  const isMechamaru = String(card.characterId || card.id || "") === "kokichi_muta_mechamaru_candidate";
  if (String(card.externalResource || "").includes("真里香")) {
    result.axisBonus.jujutsu += 1.8;
    result.axisBonus.build += 1.65;
    result.scoreBonus += 1.15;
    result.disruption += 1.7;
    result.tags.push("trueRikaResource");
  }
  if (text.includes("咒灵操术") || text.includes("库存")) {
    result.axisBonus.build += 0.5;
    result.scoreBonus += 0.06;
    result.disruption += 0.7;
    result.tags.push("externalCurseStock");
  }
  if (isMechamaru && /全国范围傀儡网络|超远程傀儡操控|天与束缚.*傀儡|puppet_heavenly_restriction_range/.test(text)) {
    result.axisBonus.jujutsu += 0.34;
    result.axisBonus.insight += 0.16;
    result.axisBonus.build += 0.48;
    result.scoreBonus += 0.16;
    result.disruption += 0.55;
    result.tags.push("puppetRemoteNetwork", "resourceStock", "strategicRange");
  }
  if (isMechamaru && /究极机械丸|大型机体|机械丸库存|简易领域筒|ultimate_mechamaru_stock/.test(text)) {
    result.axisBonus.jujutsu += 0.12;
    result.axisBonus.build += 0.68;
    result.scoreBonus += 0.22;
    result.disruption += 0.72;
    result.tags.push("ultimateMechamaru", "resourceStock", "burstWindow", "antiDomainStock");
  }
  if (text.includes("坐杀搏徒中奖")) {
    result.axisBonus.build += 1.45;
    result.scoreBonus += 0.78;
    result.disruption += 0.7;
    result.tags.push("jackpotSustain");
  }
  if (text.includes("乙骨戒指") || text.includes("里香资源")) {
    result.axisBonus.jujutsu += 0.6;
    result.axisBonus.build += 0.55;
    result.scoreBonus += 0.38;
    result.disruption += 0.45;
    result.tags.push("rikaResidualResource");
  }
  if (text.includes("不老") || text.includes("咒物沉淀") || text.includes("随意黑闪")) {
    result.axisBonus.insight += 1.25;
    result.axisBonus.build += 1.45;
    result.scoreBonus += 0.95;
    result.disruption += 1.4;
    result.tags.push("blackFlashAtWill", "curseObjectSedimentation");
  }
  return normalizeDuelImpact(result);
}

function summarizeDuelDomain(card) {
  const result = emptyDuelImpact();
  const text = getDuelCardMechanicText(card);
  if (text.includes("无领域")) {
    result.tags.push("noDomain");
    return normalizeDuelImpact(result);
  }
  if (/开放领域|伏魔御厨子/.test(text)) {
    result.axisBonus.build += 2.3;
    result.scoreBonus += 0.95;
    result.disruption += 2.7;
    result.tags.push("topDomain", "openDomainExecution", "reproducibleSukunaDomain");
  } else if (/无量空处|顶级领域|顶尖领域|顶格领域|最高级领域/.test(text)) {
    result.axisBonus.build += 1.3;
    result.scoreBonus += 0.5;
    result.disruption += 1.5;
    result.tags.push("topDomain", "customTopDomain");
  } else if (/真赝相爱|真里香|领域可用假定|达布拉|Modulo/.test(text)) {
    result.axisBonus.build += 0.6;
    result.scoreBonus += 0.18;
    result.disruption += 0.55;
    result.tags.push("domainCapableAssumption");
  } else if (/坐杀搏徒|中奖状态|领域续航/.test(text)) {
    result.axisBonus.build += 0.85;
    result.scoreBonus += 0.32;
    result.disruption += 0.8;
    result.tags.push("domainSustainEngine");
  } else if (/领域展开|领域|domain|Domain/.test(text)) {
    result.axisBonus.build += 0.45;
    result.scoreBonus += 0.12;
    result.disruption += 0.4;
    result.tags.push("domainCapableAssumption", "customDomain");
  }
  return normalizeDuelImpact(result);
}

function duelStageBonus(stage) {
  return {
    after68: 0.12,
    modulo: 0.04,
    shinjuku: 0.03,
    heianToShinjuku: 0.03
  }[stage] || 0;
}

function getDuelVisibleGrade(card) {
  if (isDuelSpecialGradeCursedSpiritCard(card)) return "specialGradeLow";
  if (card.visibleGrade) return card.visibleGrade;
  const official = String(card.officialGrade || "");
  if (official.includes("上位特级")) return "specialGradeHigh";
  if (official.includes("下位特级")) return "specialGradeLow";
  if (official.includes("标准特级")) return "specialGrade";
  if (official.includes("特级")) return "specialGrade";
  if (official.includes("特别一级") || official.includes("一级")) return "grade1";
  if (official.includes("二级")) return "grade2";
  if (official.includes("三级")) return "grade3";
  if (official.includes("四级")) return "grade4";
  const tier = String(card.powerTier || "");
  if (["canonCeiling", "postCanonException", "postCanonCeiling"].includes(tier)) return "specialGradeHigh";
  if (tier === "specialGrade") return "specialGrade";
  if (tier === "specialGrade1") return "semiSpecialGrade1";
  if (["topTierPhysical", "topTier", "topTierSustain", "topTierMinus", "newGenerationTop", "haxException"].includes(tier)) return "grade1";
  if (tier === "supportHax") return "grade2";
  return "support";
}

function isDuelSpecialGradeCursedSpiritCard(card = {}) {
  const official = String(card.officialGrade || "");
  const tier = String(card.powerTier || "");
  if (["disasterCurse", "specialGrade_curse", "cursedSpiritSpecial", "specialGradeCurse"].includes(tier)) return true;
  return /特级.*咒灵|特级.*疾病咒灵/.test(official) && !/过咒怨灵/.test(official);
}

function buildDuelDisruptionUnit(score) {
  const normalized = clamp(Number(score) || 0, 0, 12);
  const value = Math.round(100 * Math.pow(2, normalized / 1.85));
  return {
    score: Number(normalized.toFixed(4)),
    value,
    label: formatCombatPowerUnit(value),
    band: getCombatPowerUnitBand(value)
  };
}

function emptyDuelImpact() {
  return {
    axisBonus: { jujutsu: 0, body: 0, insight: 0, build: 0 },
    scoreBonus: 0,
    disruption: 0,
    tags: [],
    matchedTools: []
  };
}

function mergeDuelImpact(target, impact) {
  for (const axis of Object.keys(target.axisBonus)) target.axisBonus[axis] += Number(impact.axisBonus?.[axis] || 0);
  target.scoreBonus += Number(impact.scoreBonus || 0);
  target.disruption += Number(impact.disruption || 0);
  target.tags.push(...(impact.tags || []));
}

function normalizeDuelImpact(impact) {
  impact.tags = Array.from(new Set(impact.tags));
  impact.matchedTools = Array.from(new Set(impact.matchedTools || []));
  for (const axis of Object.keys(impact.axisBonus)) impact.axisBonus[axis] = clamp(impact.axisBonus[axis], -2, 4);
  impact.scoreBonus = clamp(impact.scoreBonus, -1, 2.4);
  impact.disruption = clamp(impact.disruption, 0, 12);
  return impact;
}

function formatDuelList(values) {
  const list = (values || []).filter(Boolean);
  return list.length ? list.join("、") : "无";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports.__customTechniqueOwnershipTestHooks = Object.freeze({
    inferCustomDuelTechniqueFamilies,
    inferCustomDuelTechniqueSpecialHandTags,
    normalizeLoginCardCharacterForPool,
    normalizeCustomDuelCharacterCardForExport
  });
}
