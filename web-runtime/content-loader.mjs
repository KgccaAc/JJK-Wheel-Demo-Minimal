/** Platform-neutral content loader. The editor and runtime can inject a
 * package directly for tests or load the same immutable JSON over HTTP. */
export async function loadStoryPackage(source = 'data/story/story-package.json', fetchImpl = globalThis.fetch) {
  if (typeof source === 'object' && source !== null) return structuredClone(source);
  if (typeof fetchImpl !== 'function') throw new Error('story_package_fetch_unavailable');
  const response = await fetchImpl(source, { cache: 'no-store' });
  if (!response.ok) throw new Error(`story_package_http_${response.status}`);
  const packageData = await response.json();
  if (!packageData || packageData.schemaVersion !== 'story-package.v1') throw new Error('story_package_schema_invalid');
  return packageData;
}

export function indexStoryPackage(packageData) {
  if (!packageData || typeof packageData !== 'object') throw new TypeError('story_package_required');
  return {
    ...packageData,
    nodes: packageData.nodes || {},
    characters: packageData.characters || {},
    encounters: packageData.encounters || {},
    assets: packageData.assets || {},
    fallbackDialogues: packageData.fallbackDialogues || {},
    effectPolicies: packageData.effectPolicies || {},
  };
}
