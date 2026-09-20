#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const allowedTypes = new Set(['dialogue', 'choice', 'condition', 'command', 'presentation', 'battle', 'ai_dialogue', 'checkpoint', 'jump', 'end']);
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const isString = (value) => typeof value === 'string' && value.length > 0;

/**
 * Validate a canonical story package. This is shared by the CLI validator and
 * the local story API so editor/API validation cannot silently disagree.
 */
export async function validateStoryPackage(packageData, { projectRoot = resolve(process.env.STORY_PROJECT_ROOT || process.cwd()) } = {}) {
  const errors = [];
  const warnings = [];
  const addError = (code, message, id = '') => errors.push({ code, id, message });
  const addWarning = (code, message, id = '') => warnings.push({ code, id, message });
  const candidate = asObject(packageData);
  const nodeMap = asObject(candidate.nodes);
  const nodeIds = new Set(Object.keys(nodeMap));
  const outgoing = new Map();

  if (candidate.schemaVersion !== 'story-package.v1') addError('schema_version', 'schemaVersion must be story-package.v1');
  if (!isString(candidate.contentVersion)) addError('content_version', 'contentVersion is required');
  if (!isString(candidate.project?.entryNodeId) || !nodeIds.has(candidate.project.entryNodeId)) {
    addError('entry_node', 'project.entryNodeId must reference a node', candidate.project?.entryNodeId || '');
  }
  if (!Array.isArray(candidate.chapters) || candidate.chapters.length === 0) addError('chapters_missing', 'at least one chapter is required');

  const seen = new Set();
  for (const [id, node] of Object.entries(nodeMap)) {
    const item = asObject(node);
    if (seen.has(id)) addError('duplicate_node', 'duplicate node id', id);
    seen.add(id);
    if (!isString(item.id) || item.id !== id) addError('node_id_mismatch', 'node key and node.id must match', id);
    if (!allowedTypes.has(item.type)) addError('node_type', `unsupported node type: ${item.type}`, id);

    const refs = [];
    if (isString(item.next)) refs.push(['next', item.next]);
    for (const choice of Array.isArray(item.choices) ? item.choices : []) if (isString(choice?.next)) refs.push(['choice.next', choice.next]);
    for (const choice of Array.isArray(item.choiceSet) ? item.choiceSet : []) if (isString(choice?.next)) refs.push(['choiceSet.next', choice.next]);
    for (const [key, target] of Object.entries(asObject(item.nextNodes))) if (isString(target)) refs.push([`nextNodes.${key}`, target]);
    for (const [key, target] of Object.entries(asObject(item.completionRoutes))) if (isString(target)) refs.push([`completionRoutes.${key}`, target]);
    for (const [key, target] of Object.entries(asObject(item.outcomes))) if (isString(target)) refs.push([`outcomes.${key}`, target]);
    outgoing.set(id, refs.map(([, target]) => target));
    for (const [field, target] of refs) if (!nodeIds.has(target)) addError('broken_reference', `${field} references missing node ${target}`, id);

    if (item.type === 'battle') {
      if (!isString(item.encounterId)) addError('battle_encounter_missing', 'battle node requires encounterId', id);
      else if (!asObject(candidate.encounters)[item.encounterId]) addError('battle_profile_missing', `encounter ${item.encounterId} not found`, id);
    }
    if (item.type === 'ai_dialogue') {
      if (!isString(item.speakerId) || !asObject(candidate.characters)[item.speakerId]) addError('ai_character_missing', 'AI node requires a known speakerId', id);
      if (!isString(item.fallbackSetId) || !asObject(candidate.fallbackDialogues)[item.fallbackSetId]) addError('ai_fallback_missing', 'AI node requires a known fallbackSetId', id);
      if (!isString(item.effectPolicyId)) addError('ai_policy_missing', 'AI node requires effectPolicyId', id);
      else if (!asObject(candidate.effectPolicies)[item.effectPolicyId]) addError('ai_policy_unknown', `effect policy ${item.effectPolicyId} not found`, id);
      if (!Number.isInteger(Number(item.maxTurns)) || Number(item.maxTurns) < 1) addError('ai_max_turns_invalid', 'AI node maxTurns must be a positive integer', id);
    }
  }

  for (const chapter of Array.isArray(candidate.chapters) ? candidate.chapters : []) {
    const chapterId = chapter?.id || '';
    if (!isString(chapter?.entryNodeId) || !nodeIds.has(chapter.entryNodeId)) addError('chapter_entry_node', 'chapter.entryNodeId must reference a node', chapterId);
    if (!Array.isArray(chapter?.nodeIds)) addError('chapter_nodes_missing', 'chapter.nodeIds must be an array', chapterId);
    else for (const nodeId of chapter.nodeIds) if (!nodeIds.has(nodeId)) addError('chapter_node_missing', `chapter references missing node ${nodeId}`, chapterId);
  }

  const reachable = new Set();
  const visit = (id, depth = 0) => {
    if (!id || reachable.has(id) || depth > nodeIds.size + 1) return;
    reachable.add(id);
    for (const target of outgoing.get(id) || []) visit(target, depth + 1);
  };
  visit(candidate.project?.entryNodeId);
  for (const id of nodeIds) if (!reachable.has(id)) addWarning('unreachable_node', 'node is not reachable from project entry', id);
  for (const [id, node] of Object.entries(nodeMap)) {
    if (node.type !== 'end' && (outgoing.get(id) || []).length === 0 && !['command', 'presentation'].includes(node.type)) addWarning('dead_end', 'non-terminal node has no outgoing edge', id);
  }

  for (const [id, asset] of Object.entries(asObject(candidate.assets))) {
    if (!isString(asset?.path)) addError('asset_path_missing', 'asset path is required', id);
    else if (asset.path.startsWith('res://')) {
      const local = resolve(projectRoot, asset.path.slice('res://'.length));
      try { await access(local); } catch { addWarning('missing_asset', `asset does not exist on disk: ${asset.path}`, id); }
    }
  }

  return {
    ok: errors.length === 0,
    package: undefined,
    schemaVersion: candidate.schemaVersion,
    contentVersion: candidate.contentVersion,
    counts: {
      chapters: Array.isArray(candidate.chapters) ? candidate.chapters.length : 0,
      nodes: nodeIds.size,
      reachable: reachable.size,
      characters: Object.keys(asObject(candidate.characters)).length,
      encounters: Object.keys(asObject(candidate.encounters)).length,
      assets: Object.keys(asObject(candidate.assets)).length,
    },
    errors,
    warnings,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const projectRoot = resolve(process.env.STORY_PROJECT_ROOT || process.cwd());
  const packagePath = resolve(projectRoot, process.argv[2] || process.env.STORY_PACKAGE || 'data/story/story-package.json');
  const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
  const report = await validateStoryPackage(packageData, { projectRoot });
  report.package = packagePath;
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
