import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoot = new URL('../data/battle/source/', import.meta.url);
const configuredRoot = process.env.BATTLE_DATA_ROOT || '';
const readJson = (name) => JSON.parse(readFileSync(configuredRoot ? join(configuredRoot, name) : new URL(name, sourceRoot), 'utf8'));
const characters = readJson('characters.json').characters || [];
const cards = readJson('cards.json').cards || [];
const domains = readJson('domains.json').domains || [];
const templates = readJson('runtime/card-templates.json').cards || [];

export function buildProfile(id, custom = null) {
  const source = custom || characters.find((entry) => entry.id === id);
  if (!source) return {};
  const profile = structuredClone(source);
  profile.tag_set = tagSet(profile);
  return profile;
}

export function eligibleCards(profile, context = 'normal') {
  if (!profile?.id) return [];
  const sources = [...cards, ...(Array.isArray(profile.customHandCards) ? profile.customHandCards : []), ...publicTemplates(context)];
  return sources.filter((card) => allowed(card, profile, context));
}

export function domainRecord(id) {
  return domains.find((entry) => String(entry.id || '') === String(id)) || null;
}

function allowed(card, profile, context) {
  if (card.retired || card.playableInHandBeta === false) return false;
  const contexts = card.contexts || ['normal'];
  if (!contexts.includes(context) && !(context === 'domain' && isDomain(card) && contexts.includes('normal'))) return false;
  // Login-card snapshots cross JSON/Godot boundaries. Their tag_set may arrive
  // as a plain object rather than JavaScript Set, so reconstruct the set from
  // canonical profile fields instead of calling .has() on transport data.
  const tags = card.tags || []; const flags = profile.flags || {}; const profileTags = tagSet(profile);
  if ((profile.denyCardTypes || []).includes(card.type) || intersects(tags, profile.denyTags || [])) return false;
  if (tags.includes('zero_ce') && !flags.isZeroCe) return false;
  if (card.type === 'domain' && !flags.hasDomainAccess) return false;
  if (intersects(tags, ['术式', 'technique']) && !flags.hasInnateTechnique) return false;
  if (intersects(tags, ['cursed_tool', 'cursed_tool_user', '咒具']) && !flags.usesCursedTools) return false;
  const exclusive = card.exclusive || {};
  if (Array.isArray(exclusive.characters) && exclusive.characters.length && !exclusive.characters.includes(profile.id)) return false;
  if (Array.isArray(exclusive.archetypes) && exclusive.archetypes.length && !intersects(exclusive.archetypes, profile.archetypes || [])) return false;
  if (Array.isArray(exclusive.variants) && exclusive.variants.length && !intersects(exclusive.variants, profile.variants || [])) return false;
  if (card.sourceTechniqueFamily && !(profile.techniqueFamilies || []).includes(card.sourceTechniqueFamily)) return false;
  const matchTags = card.matchTags || [];
  const forced = (profile.forceAllowSourceActionIds || []).includes(actionId(card)) || intersects(tags, profile.forceAllowTags || []);
  if (matchTags.length && !matchTags.some((tag) => profileTags.has(tag)) && !forced) return false;
  return true;
}

function tagSet(profile) { return new Set(['traits', 'cardTags', 'archetypes', 'techniqueFamilies', 'variants', 'forceAllowTags'].flatMap((key) => profile[key] || []).map(String)); }
function actionId(card) { return String(card.actionId || card.action_id || card.id || '').replace(/^card_/, ''); }
function intersects(left, right) { return left.some((value) => right.includes(value)); }
function isDomain(card) { return card.id === 'card_domain_expand' || card.actionId === 'domain_expand' || (card.tags || []).includes('domain_expand') || card.domain?.action === 'expand'; }
function publicTemplates(context) {
  return templates.filter((entry) => entry.actionId && entry.playableInHandBeta === true && !entry.futureTemplate && (entry.contexts || ['normal']).includes(context) && (!entry.handSource || String(entry.handSource).startsWith('public-baseline-'))).map((entry) => ({
    id: entry.cardId || `card_${entry.actionId}`, actionId: entry.actionId, name: entry.name || entry.actionId, type: entry.cardType || 'basic', tags: entry.tags || [], contexts: entry.contexts || ['normal'], playableInHandBeta: true,
    cost: { ce: Number(entry.ceCost || 0) }, effect: { damage: Number(entry.damage || 0), damageType: entry.damageType || 'none', block: Number(entry.block || 0), special: { atomicEffects: [] } },
  }));
}

