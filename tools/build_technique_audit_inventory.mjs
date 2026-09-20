import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const cardsRoot = readJson('data/battle/source/cards.json');
const charsRoot = readJson('data/battle/source/characters.json');
const wheelSource = readJson('data/wheel/source/strength-v0.2-candidate.json');
const cards = Array.isArray(cardsRoot.cards) ? cardsRoot.cards : [];
const characters = Array.isArray(charsRoot.characters) ? charsRoot.characters : [];
const excludedMatchTags = new Set([
  'domain_access', 'high_level_anti_domain', 'simple_domain', 'hollow_wicker_basket', 'falling_blossom_emotion',
  'trial_defender_common', 'cursed_tool_user', 'zero_ce_heavenly_restriction', 'public_baseline',
  'special_constitution_physical_tyrant', 'special_constitution_super_vessel', 'special_constitution_half_curse', 'special_constitution_curse_body',
  'inverted_spear_of_heaven', 'chain_of_thousand_miles', 'soul_split_katana', 'playful_cloud', 'weapon_inventory_curse', 'black_rope', 'miguel_evasion',
  'simple_domain_sword', 'rct_support', 'yuji_after68_black_flash', 'yuji_soul_melee', 'panda_core_shift', 'assistant_supervisor', 'recontract_icon',
  'grade2', 'semiGrade1', 'specialGrade1', 'kyoto_school', 'shibuya', 'culling', 'boss_only', 'canonCeiling', 'heianToShinjuku'
]);
const fallbackFamilies = {
  '疱疮神': 'smallpox_deity_countdown', '天使': 'jacobs_ladder', '激震掌': 'panda_core_shift',
  '自定义': 'custom', '自定义术式': 'custom', '穿越者当然是外挂（进入彩蛋池）': 'custom',
  '黑绳体术': 'black_rope', '新阴流简易领域／拔刀术': 'simple_domain_sword',
  '焦眉之赳': 'ogi_flame_blade', '反转术式医师': 'rct_support', '简易领域': 'simple_domain'
};
const manualOverrides = new Map([
  ['blood_manipulation', { name: '赤血操术', domainId: '', power: 'B', aliases: ['赤血操术 —— 加茂'] }],
  ['limitless', { name: '无下限', domainId: 'gojo_unlimited_void', power: 'A', aliases: ['无下限术式', 'infinity'] }],
  ['ten_shadows', { name: '十种影法术', domainId: 'megumi_chimera_shadow_garden', power: 'A', aliases: ['十种影', '十影'] }],
  ['curse_spirit_manipulation', { name: '咒灵操术', domainId: '', power: 'B', aliases: ['curse_manipulation'] }],
  ['cursed_speech', { name: '咒言', domainId: '', power: 'B', aliases: [] }],
  ['projection_sorcery', { name: '投射咒法', domainId: '', power: 'A', aliases: [] }],
  ['black_bird_manipulation', { name: '黑鸟操术', domainId: '', power: 'B', aliases: ['黑鸟操术（乌鸦）'] }],
  ['star_rage', { name: '星之怒', domainId: '', power: 'A', aliases: ['星之怒（九十九）'] }],
  ['ice_formation', { name: '冰凝咒法', domainId: '', power: 'A', aliases: ['冰凝咒法（里梅）'] }],
  ['construction', { name: '构筑术式', domainId: '', power: 'B', aliases: [] }],
  ['puppet_manipulation', { name: '傀儡操术', domainId: '', power: 'B', aliases: ['傀儡操术（机械丸）'] }],
  ['jacobs_ladder', { name: '术式消灭', domainId: '', power: 'A', aliases: ['术式消灭（天使）'] }]
]);
const normalizeSourceFamily = (family) => {
  if (family === 'ganesh_obstacle_removal') return 'ganesha_obstacle_removal';
  if (family === 'curse_manipulation') return 'curse_spirit_manipulation';
  if (family === 'recontract_icon') return 'contract_recreation';
  return family;
};
const profileEntries = Object.entries(wheelSource.techniqueProfiles ?? {});
const familyByKey = new Map();
const ensureFamily = (key, profileName, profile, aliases = []) => {
  const override = manualOverrides.get(key) ?? {};
  if (!familyByKey.has(key)) {
    familyByKey.set(key, {
      key,
      name: String(override.name ?? profile.displayName ?? profileName),
      domainId: String(override.domainId ?? ''),
      power: String(override.power ?? (['S', 'SS', 'SSS', 'EX', 'EX-'].includes(profile.visibleGrade) ? 'A' : 'B')),
      category: String(profile.category ?? profile.poolCategory ?? 'source_profile'),
      sourceProfiles: [],
      aliases: new Set(),
      cardIds: [],
      characterIds: [],
      missingReason: null
    });
  }
  const family = familyByKey.get(key);
  if (!family.sourceProfiles.includes(profileName)) family.sourceProfiles.push(profileName);
  for (const alias of [profileName, profile.displayName, ...(profile.alias ?? []), ...(profile.specialHandTags ?? []), ...(override.aliases ?? []), ...aliases]) {
    const normalized = String(alias ?? '').trim();
    if (normalized) family.aliases.add(normalized);
  }
  return family;
};
for (const [profileName, profile] of profileEntries) {
  const tags = (profile.specialHandTags ?? []).map((tag) => normalizeSourceFamily(String(tag))).filter(Boolean);
  const displayName = String(profile.displayName ?? profileName).trim();
  const fallback = fallbackFamilies[profileName] ?? fallbackFamilies[displayName] ?? null;
  const key = tags.find((tag) => !excludedMatchTags.has(tag)) ?? fallback ?? `profile_${profileName}`;
  ensureFamily(key, profileName, profile, tags);
}
for (const family of familyByKey.values()) family.aliases = [...family.aliases];
const registry = [...familyByKey.values()].map((family) => ({ name: family.name, key: family.key, aliases: family.aliases, domainId: family.domainId, power: family.power }));
const aliases = new Map();
for (const item of registry) {
  for (const alias of [item.name, item.key, ...item.aliases]) if (!aliases.has(alias.toLowerCase())) aliases.set(alias.toLowerCase(), item.key);
}

const findFamilyKeys = (values) => {
  const result = new Set();
  for (const raw of values ?? []) {
    const value = String(raw);
    if (excludedMatchTags.has(value)) continue;
    if (familyByKey.has(value)) result.add(value);
    const direct = aliases.get(value.toLowerCase());
    if (direct) result.add(direct);
    for (const item of registry) {
      if (value.toLowerCase().includes(item.key.toLowerCase())) result.add(item.key);
      if (item.aliases.some((alias) => value.toLowerCase().includes(alias.toLowerCase()))) result.add(item.key);
    }
  }
  return [...result];
};

const cardsOut = cards.map((card) => {
  const values = [...(card.matchTags ?? []), ...(card.tags ?? [])];
  const familyKeys = findFamilyKeys(values);
  const atomicEffects = card.effect?.special?.atomicEffects ?? [];
  const missingReason = familyKeys.length ? null : (atomicEffects.length || card.domain?.id || card.summon?.unitId ? 'special_or_domain_without_registry_family' : 'no_technique_match_tag');
  return {
    id: String(card.id ?? ''),
    name: String(card.name ?? ''),
    familyKeys,
    matchTags: card.matchTags ?? [],
    tags: card.tags ?? [],
    type: card.type ?? '',
    cost: card.cost ?? {},
    effect: card.effect ?? {},
    accuracy: card.accuracy ?? {},
    requirements: card.requirements ?? {},
    atomicEffects,
    domain: card.domain ?? {},
    summon: card.summon ?? {},
    exclusive: card.exclusive ?? {},
    selection: card.selection ?? {},
    scaling: card.scaling ?? {},
    risk: card.risk ?? '',
    missingReason
  };
});

const charactersOut = characters.map((character) => {
  const familyKeys = findFamilyKeys([...(character.cardTags ?? []), ...(character.traits ?? [])]);
  return {
    id: String(character.id ?? ''),
    name: String(character.name ?? ''),
    familyKeys,
    stats: character.stats ?? {},
    traits: character.traits ?? [],
    cardTags: character.cardTags ?? [],
    domainId: character.domainId ?? '',
    flags: character.flags ?? {}
  };
});

for (const card of cardsOut) for (const key of card.familyKeys) familyByKey.get(key)?.cardIds.push(card.id);
for (const character of charactersOut) for (const key of character.familyKeys) familyByKey.get(key)?.characterIds.push(character.id);
for (const family of familyByKey.values()) {
  if (!family.cardIds.length && !family.characterIds.length) family.missingReason = 'registry_family_not_referenced_by_current_data';
}

const output = {
  generatedAt: new Date().toISOString(),
  source: { cards: 'data/battle/source/cards.json', characters: 'data/battle/source/characters.json', techniqueProfiles: 'data/wheel/source/strength-v0.2-candidate.json', registry: 'scenes/wheel/WheelTechniqueRegistry.gd' },
  coverage: {
    cardCount: cards.length,
    characterCount: characters.length,
    sourceProfileCount: profileEntries.length,
    registryFamilyCount: familyByKey.size,
    unmappedCardCount: cardsOut.filter((card) => card.missingReason !== null).length,
    unmappedCharacterCount: charactersOut.filter((character) => character.familyKeys.length === 0).length
  },
  families: [...familyByKey.values()],
  cards: cardsOut,
  characters: charactersOut
};
const outputPath = path.join(root, 'reports/balance/technique-audit-inventory-2026-09-19.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
