import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createStoryContentService } from '../../backend/story-content-server.mjs';

const cwd = resolve(process.cwd());
const root = cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
const dataDir = await mkdtemp(join(tmpdir(), 'jjk-story-api-'));
const service = createStoryContentService({ projectRoot: root, dataDir });
const request = (method, path, body) => service.handle({ method, path, body });
try {
  const latest = await request('GET', '/api/story/packages/latest');
  assert.equal(latest.status, 200); assert.equal(latest.body.package.schemaVersion, 'story-package.v1');
  const version = latest.body.package.contentVersion;
  const chapter = await request('GET', `/api/story/chapters/${latest.body.package.chapters[0].id}`);
  assert.equal(chapter.status, 200); assert.ok(chapter.body.chapter.nodes.length >= 50);
  const validation = await request('POST', '/api/story/validate', {});
  assert.equal(validation.status, 200); assert.equal(validation.body.report.ok, true);
  assert.ok(validation.body.report.counts.reachable >= 1, 'validation report must include reachable node count');

  const invalidPolicyPackage = structuredClone(latest.body.package);
  invalidPolicyPackage.nodes.chapter1_ai_contact.effectPolicyId = 'missing-policy';
  const invalidPolicy = await request('POST', '/api/story/validate', { package: invalidPolicyPackage });
  assert.equal(invalidPolicy.status, 200);
  assert.equal(invalidPolicy.body.report.ok, false, 'unknown AI effect policy must fail validation');
  assert.ok(invalidPolicy.body.report.errors.some((error) => error.code === 'ai_policy_unknown'));

  const invalidCompletionPackage = structuredClone(latest.body.package);
  invalidCompletionPackage.nodes.chapter1_ai_contact.completionRoutes.normal = 'missing_completion_target';
  const invalidCompletion = await request('POST', '/api/story/validate', { package: invalidCompletionPackage });
  assert.equal(invalidCompletion.status, 200);
  assert.equal(invalidCompletion.body.report.ok, false, 'AI completion route must be validated');
  assert.ok(invalidCompletion.body.report.errors.some((error) => error.code === 'broken_reference'));
  const first = await request('POST', '/api/saves/demo/events', { expectedRevision: 0, events: [{ type: 'node_entered', nodeId: latest.body.package.project.entryNodeId }], snapshot: { currentNodeId: latest.body.package.project.entryNodeId } });
  assert.equal(first.status, 200); assert.equal(first.body.revision, 1);
  const stale = await request('POST', '/api/saves/demo/events', { expectedRevision: 0, events: [{ type: 'duplicate' }] });
  assert.equal(stale.status, 409);
  console.log(`STORY_CONTENT_API PASS version=${version} nodes=${chapter.body.chapter.nodes.length} revision=${first.body.revision}`);
} finally { await rm(dataDir, { recursive: true, force: true }); }
