import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const rootFor = () => { const cwd = resolve(process.env.STORY_PROJECT_ROOT || process.cwd()); return cwd.endsWith('backend') ? resolve(cwd, '..') : cwd; };
const clone = (value) => structuredClone(value);

export function createWheelContentService(options = {}) {
  const root = options.projectRoot || rootFor();
  const paths = {
    flow: options.flowPath || join(root, 'data/wheel/source/flow-v1-candidate.json'),
    strength: options.strengthPath || join(root, 'data/wheel/source/strength-v0.2-candidate.json'),
    optionEffects: options.optionEffectsPath || join(root, 'data/wheel/source/option-effects-v0.1.json'),
    wheels: options.wheelsPath || join(root, 'data/wheels.json'),
  };
  let cache;
  async function load() {
    if (cache) return cache;
    const [flow, strength, optionEffects, wheels] = await Promise.all(Object.values(paths).map((path) => readFile(path, 'utf8').then(JSON.parse)));
    cache = { flow, strength, optionEffects, wheels, version: `${flow.version || 'unknown'}:${wheels.version || 'unknown'}` };
    return cache;
  }
  async function handle(request) {
    if (request.method !== 'GET' || request.path !== '/api/wheel/config') return null;
    try { return { status: 200, body: { ok: true, config: clone(await load()) } }; }
    catch (error) { return { status: 503, body: { ok: false, error: 'wheel_content_unavailable', detail: error.message } }; }
  }
  return { handle, load, paths };
}
