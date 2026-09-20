#!/usr/bin/env node
/**
 * Build the canonical, platform-independent story package consumed by the
 * Web runtime/editor. The Godot JSON remains the authoring source during the
 * migration; this command is deliberately deterministic and never mutates it.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

const projectRoot = resolve(process.env.STORY_PROJECT_ROOT || process.cwd());
const sourcePath = resolve(projectRoot, process.env.STORY_SOURCE || 'data/story/chapter1.json');
const npcPath = resolve(projectRoot, process.env.STORY_NPCS || 'data/story/npcs.json');
const dialoguePath = resolve(projectRoot, process.env.STORY_DIALOGUE || 'data/story/npc_dialogue.json');
const chaptersPath = resolve(projectRoot, process.env.STORY_CHAPTERS || 'data/story/chapters.json');
const policyPath = resolve(projectRoot, process.env.STORY_AI_POLICIES || 'data/story/ai-effect-policies.json');
const outputPath = resolve(projectRoot, process.env.STORY_PACKAGE_OUT || 'data/story/story-package.json');
const editorOutputPath = resolve(projectRoot, process.env.STORY_EDITOR_PACKAGE_OUT || 'web-editor/story-package.json');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function normalizeType(raw) {
  const legacy = String(raw?.type || 'dialogue');
  if (legacy === 'rpg') return 'dialogue';
  if (legacy === 'selection') return 'choice';
  if (legacy === 'branch') return 'condition';
  if (legacy === 'random') return 'condition';
  if (legacy === 'settlement') return 'command';
  if (legacy === 'map') return 'presentation';
  return ['dialogue', 'choice', 'condition', 'command', 'presentation', 'battle', 'ai_dialogue', 'checkpoint', 'jump', 'end'].includes(legacy) ? legacy : 'dialogue';
}

function collectAssetReferences(value, set) {
  if (typeof value === 'string' && value.startsWith('res://')) set.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectAssetReferences(item, set));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectAssetReferences(item, set));
}

function assetId(path) {
  return path.replace(/^res:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
}

function fallbackSets(dialogues) {
  const sets = {};
  for (const [npcId, route] of Object.entries(asObject(dialogues?.routes))) {
    const lines = asObject(route).dialogue || {};
    const authored = asObject(asObject(route).fallback);
    const displayName = String(asObject(route).displayName || npcId);
    const categoryEntries = Object.entries(authored).map(([category, value]) => ({ speaker: displayName, text: String(value || ''), category }));
    sets[`${npcId}_fallback`] = {
      id: `${npcId}_fallback`,
      npcId,
      entries: [
        ...categoryEntries,
        ...(lines.available || lines.unknown || []).map((line) => ({ ...line, category: 'default' })),
        ...Object.entries(lines).flatMap(([category, values]) => (Array.isArray(values) ? values : []).map((line) => ({ ...line, category }))),
      ],
    };
  }
  return sets;
}

function buildNode(raw) {
  const source = asObject(raw);
  const node = {
    ...source,
    id: String(source.id || ''),
    type: normalizeType(source),
    legacyType: String(source.type || ''),
    title: String(source.title || source.id || ''),
    tags: Array.isArray(source.tags) ? source.tags : [],
    editorNotes: String(source.editorNotes || ''),
  };
  if (source.type === 'rpg') node.dialogue = source.dialogue || source.text || '';
  if (source.choices && !Array.isArray(source.choices)) node.choices = [];
  if (node.type === 'battle') {
    node.encounterId = String(source.battleProfile || source.encounterId || source.id || '');
    node.aiMayResolve = source.aiMayResolve === true;
  }
  if (node.type === 'choice' && source.actions) {
    node.choiceSet = Object.entries(asObject(source.actions)).map(([id, action]) => ({ id, label: id, ...asObject(action) }));
  }
  return node;
}

const source = await readJson(sourcePath);
const npcs = await readJson(npcPath).catch(() => ({}));
const dialogues = await readJson(dialoguePath).catch(() => ({}));
const chapterMeta = await readJson(chaptersPath).catch(() => ({}));
const effectPolicies = await readJson(policyPath).catch(() => ({ policies: {} }));
const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
const nodes = Object.fromEntries(rawNodes.map((raw) => [String(raw.id), buildNode(raw)]));
const assetsSet = new Set();
rawNodes.forEach((node) => collectAssetReferences(node, assetsSet));
const assets = Object.fromEntries([...assetsSet].sort().map((path) => [assetId(path), {
  id: assetId(path),
  path,
  kind: /\.(png|jpg|jpeg|webp)$/i.test(path) ? 'image' : /\.(mp3|wav|ogg)$/i.test(path) ? 'audio' : 'resource',
}]));

const chapterId = String(source.chapterId || 'chapter1');
const packageData = {
  schemaVersion: 'story-package.v1',
  contentVersion: process.env.STORY_CONTENT_VERSION || 'chapter1-v1',
  project: {
    id: 'jjk-wheel-demo',
    title: String(source.title || '第一章：初入咒术世界'),
    source: relative(projectRoot, sourcePath).replaceAll('\\', '/'),
    generatedAt: new Date().toISOString(),
    entryNodeId: String(rawNodes[0]?.id || 'chapter1_intro'),
  },
  chapters: [{
    id: chapterId,
    title: String(source.title || '第一章'),
    sourcePeriod: String(source.sourcePeriod || ''),
    entryNodeId: String(rawNodes[0]?.id || 'chapter1_intro'),
    nodeIds: rawNodes.map((node) => String(node.id)),
  }],
  nodes,
  characters: Object.fromEntries((Array.isArray(npcs.npcs) ? npcs.npcs : []).map((npc) => [String(npc.id), {
    id: String(npc.id),
    displayName: String(npc.name || npc.displayName || npc.id),
    aliases: npc.aliases || [],
    identity: String(npc.type || ''),
    personality: npc.personality || [],
    goals: npc.goals || [],
    fears: npc.fears || [],
    values: npc.values || [],
    speechStyle: String(npc.speechStyle || ''),
    relationshipRules: npc.routeStages || [],
    forbiddenBehaviors: npc.forbiddenBehaviors || [],
    knowledgeScopes: npc.knowledgeScopes || [],
    aiPolicyId: String(npc.aiPolicy || 'disabled'),
    source: 'data/story/npcs.json',
  }])),
  locations: {},
  encounters: Object.fromEntries(rawNodes.filter((node) => node.type === 'battle').map((node) => [String(node.battleProfile || node.id), {
    id: String(node.battleProfile || node.id),
    profile: String(node.battleProfile || node.id),
    nodeId: String(node.id),
    enemyCharacterId: String(node.enemyCharacterId || ''),
    enemyHpScale: Number(node.enemyHpScale ?? 1),
    rules: node.battleRules || {},
  }])),
  worldEntries: {},
  assets,
  fallbackDialogues: fallbackSets(dialogues),
  effectPolicies: effectPolicies.policies || {},
  sourceMetadata: {
    chapterMeta,
    generatedFrom: [relative(projectRoot, sourcePath).replaceAll('\\', '/'), relative(projectRoot, npcPath).replaceAll('\\', '/'), relative(projectRoot, dialoguePath).replaceAll('\\', '/'), relative(projectRoot, policyPath).replaceAll('\\', '/')],
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
await mkdir(dirname(editorOutputPath), { recursive: true });
await writeFile(editorOutputPath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, output: relative(projectRoot, outputPath), editorOutput: relative(projectRoot, editorOutputPath), nodes: Object.keys(nodes).length, assets: Object.keys(assets).length, characters: Object.keys(packageData.characters).length }, null, 2));
