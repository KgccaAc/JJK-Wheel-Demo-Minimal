import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const cards = read('data/battle/source/cards.json').cards;
const characters = read('data/battle/source/characters.json').characters;
const source = read('data/wheel/source/strength-v0.2-candidate.json');
const excluded = new Set([
  'domain_access', 'high_level_anti_domain', 'simple_domain', 'hollow_wicker_basket', 'falling_blossom_emotion',
  'trial_defender_common', 'cursed_tool_user', 'zero_ce_heavenly_restriction', 'public_baseline',
  'special_constitution_physical_tyrant', 'special_constitution_super_vessel', 'special_constitution_half_curse', 'special_constitution_curse_body',
  'inverted_spear_of_heaven', 'chain_of_thousand_miles', 'soul_split_katana', 'playful_cloud', 'weapon_inventory_curse', 'black_rope', 'miguel_evasion',
  'simple_domain_sword', 'rct_support', 'yuji_after68_black_flash', 'yuji_soul_melee', 'panda_core_shift', 'assistant_supervisor', 'recontract_icon',
  'grade2', 'semiGrade1', 'specialGrade1', 'kyoto_school', 'shibuya', 'culling', 'boss_only', 'canonCeiling', 'heianToShinjuku'
]);
const fallbackFamilies = {
  '疱疮神': 'smallpox_deity_countdown', '天使': 'jacobs_ladder', '激震掌': 'panda_core_shift',
  '自定义': 'custom', '穿越者当然是外挂（进入彩蛋池）': 'custom', '黑绳体术': 'black_rope',
  '新阴流简易领域／拔刀术': 'simple_domain_sword', '焦眉之赳': 'ogi_flame_blade',
  '反转术式医师': 'rct_support', '简易领域': 'simple_domain'
};
const normalizeFamily = (family) => {
  if (family === 'ganesh_obstacle_removal') return 'ganesha_obstacle_removal';
  if (family === 'curse_manipulation') return 'curse_spirit_manipulation';
  if (family === 'recontract_icon') return 'contract_recreation';
  return family;
};
const canonical = new Set();
for (const [name, profile] of Object.entries(source.techniqueProfiles ?? {})) {
  const tags = (profile.specialHandTags ?? []).map((tag) => normalizeFamily(String(tag)));
  const displayName = String(profile.displayName ?? name);
  const fallback = fallbackFamilies[name] ?? fallbackFamilies[displayName] ?? `profile_${name}`;
  canonical.add(tags.find((tag) => !excluded.has(tag)) ?? fallback);
}
const aliases = new Map();
for (const [name, profile] of Object.entries(source.techniqueProfiles ?? {})) {
  const tags = (profile.specialHandTags ?? []).map((tag) => normalizeFamily(String(tag)));
  for (const tag of tags) aliases.set(tag, tags.find((candidate) => !excluded.has(candidate)) ?? tag);
  const key = tags.find((tag) => !excluded.has(tag)) ?? fallbackFamilies[name] ?? fallbackFamilies[profile.displayName] ?? `profile_${name}`;
  aliases.set(name, key);
}
const familyMap = new Map();
const ensure = (key, displayName, sourceProfile = null) => {
  if (!familyMap.has(key)) familyMap.set(key, { key, displayName: displayName || key, sourceProfiles: [], cardIds: [], characterIds: [], category: canonical.has(key) ? 'registered' : 'expanded' });
  if (sourceProfile && !familyMap.get(key).sourceProfiles.includes(sourceProfile)) familyMap.get(key).sourceProfiles.push(sourceProfile);
  return familyMap.get(key);
};
for (const [profileName, profile] of Object.entries(source.techniqueProfiles ?? {})) {
  const tags = profile.specialHandTags ?? [];
  if (!tags.length) continue;
  for (const tag of tags) if (!excluded.has(tag)) ensure(tag, profile.displayName || profileName, profileName);
}
for (const card of cards) {
  const tags = card.matchTags ?? [];
  for (const tag of tags) if (!excluded.has(tag)) ensure(tag, tag).cardIds.push(card.id);
}
for (const character of characters) {
  const tags = [...(character.cardTags ?? []), ...(character.traits ?? [])];
  for (const tag of tags) if (aliases.has(tag) && !excluded.has(aliases.get(tag))) ensure(aliases.get(tag), tag).characterIds.push(character.id);
}
for (const family of familyMap.values()) {
  family.cardIds = [...new Set(family.cardIds)];
  family.characterIds = [...new Set(family.characterIds)];
  family.sourceProfiles = [...new Set(family.sourceProfiles)];
}
const tagCounts = new Map();
for (const card of cards) for (const tag of card.matchTags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
const excludedTags = [...tagCounts.entries()].filter(([tag]) => excluded.has(tag)).map(([tag, cardCount]) => ({ tag, cardCount, reason: 'support_system_or_constraint_not_an_innate_technique_family' }));
const output = { schema: 'jjk-technique-family-coverage-v1', generatedAt: new Date().toISOString(), sourceProfileCount: Object.keys(source.techniqueProfiles ?? {}).length, matchTagCount: tagCounts.size, families: [...familyMap.values()].filter((family) => family.cardIds.length || family.characterIds.length), excludedTags, notes: ['Registered families are preserved.', 'Expanded families come from source technique profiles and real matchTags.', 'Excluded tags remain visible for support/constraint scoring but are not counted as innate technique families.'] };
fs.mkdirSync(path.join(root, 'reports/balance'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/balance/technique-family-coverage-2026-09-19.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote technique family coverage profiles=${output.sourceProfileCount} families=${output.families.length} excluded=${output.excludedTags.length}`);
