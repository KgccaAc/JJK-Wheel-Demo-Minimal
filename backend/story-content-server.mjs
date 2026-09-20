import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { validateStoryPackage } from '../tools/validate_story_package.mjs';

const clone = (value) => structuredClone(value);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, fallback = '', max = 200) => String(value ?? fallback).trim().slice(0, max);

function projectRoot() {
  const cwd = resolve(process.env.STORY_PROJECT_ROOT || process.cwd());
  return cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
}

export function createStoryContentService(options = {}) {
  const root = options.projectRoot || projectRoot();
  const packagePath = options.packagePath || resolve(root, 'data/story/story-package.json');
  const dataDir = options.dataDir || process.env.STORY_RUNTIME_DATA_DIR || resolve(root, 'backend/.runtime-story');
  const savePath = join(dataDir, 'saves.json');
  const ledgerPath = join(dataDir, 'save-events.jsonl');
  let packageData;
  let saves = {};
  let loaded = false;

  async function load() {
    if (loaded) return;
    packageData = JSON.parse(await readFile(packagePath, 'utf8'));
    try { saves = JSON.parse(await readFile(savePath, 'utf8')); if (!object(saves)) saves = {}; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    loaded = true;
  }
  async function persist() {
    await mkdir(dataDir, { recursive: true });
    const temp = `${savePath}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(saves, null, 2)}\n`, 'utf8');
    await rename(temp, savePath);
  }
  async function ledger(event) { await mkdir(dataDir, { recursive: true }); await appendFile(ledgerPath, `${JSON.stringify(event)}\n`, 'utf8'); }
  function response(status, body) { return { status, body: clone(body) }; }

  async function handle(request) {
    await load();
    const method = String(request?.method || 'GET').toUpperCase();
    const path = String(request?.path || '').split('?')[0];
    if (method === 'GET' && path === '/api/story/packages/latest') return response(200, { ok: true, package: packageData });
    const packageMatch = path.match(/^\/api\/story\/packages\/([^/]+)$/);
    if (method === 'GET' && packageMatch) {
      const version = decodeURIComponent(packageMatch[1]);
      if (version !== packageData.contentVersion) return response(404, { ok: false, error: 'story_package_not_found', contentVersion: packageData.contentVersion });
      return response(200, { ok: true, package: packageData });
    }
    const chapterMatch = path.match(/^\/api\/story\/chapters\/([^/]+)$/);
    if (method === 'GET' && chapterMatch) {
      const chapter = packageData.chapters?.find((entry) => entry.id === decodeURIComponent(chapterMatch[1]));
      if (!chapter) return response(404, { ok: false, error: 'story_chapter_not_found' });
      return response(200, { ok: true, chapter: { ...chapter, nodes: chapter.nodeIds.map((id) => packageData.nodes[id]).filter(Boolean) } });
    }
    if (method === 'POST' && path === '/api/story/validate') {
      const report = await validateStoryPackage(request.body?.package || packageData, { projectRoot: root });
      return response(200, { ok: true, report });
    }
    if (method === 'POST' && path === '/api/story/preview') {
      const nodeId = text(request.body?.nodeId, packageData.project.entryNodeId, 120);
      const node = packageData.nodes[nodeId];
      if (!node) return response(404, { ok: false, error: 'story_node_not_found' });
      return response(200, { ok: true, contentVersion: packageData.contentVersion, node: clone(node), snapshot: clone(request.body?.snapshot || {}) });
    }
    const saveMatch = path.match(/^\/api\/saves\/([^/]+)$/);
    const eventMatch = path.match(/^\/api\/saves\/([^/]+)\/events$/);
    if (method === 'GET' && saveMatch) {
      const save = saves[decodeURIComponent(saveMatch[1])];
      return save ? response(200, { ok: true, save: clone(save) }) : response(404, { ok: false, error: 'save_not_found' });
    }
    if (method === 'POST' && eventMatch) {
      const saveId = decodeURIComponent(eventMatch[1]); const existing = saves[saveId] || { saveId, revision: 0, contentVersion: packageData.contentVersion, snapshot: {}, events: [] };
      const expected = Number(request.body?.expectedRevision ?? -1);
      if (expected !== existing.revision) return response(409, { ok: false, error: 'save_revision_conflict', revision: existing.revision });
      const events = Array.isArray(request.body?.events) ? request.body.events : [];
      if (!events.length) return response(422, { ok: false, error: 'events_required', revision: existing.revision });
      const now = new Date().toISOString(); const record = { eventId: randomUUID(), source: text(request.body?.source, 'story', 40), createdAt: now, events: clone(events) };
      existing.events.push(record); existing.snapshot = object(request.body?.snapshot) ? clone(request.body.snapshot) : existing.snapshot; existing.revision += 1; existing.updatedAt = now; saves[saveId] = existing;
      await persist(); await ledger({ saveId, revision: existing.revision, ...record });
      return response(200, { ok: true, saveId, revision: existing.revision, save: clone(existing), event: record });
    }
    return response(404, { ok: false, error: 'route_not_found' });
  }
  return { handle, load, paths: { packagePath, dataDir, savePath, ledgerPath } };
}
