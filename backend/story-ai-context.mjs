const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const short = (value, max = 600) => String(value ?? '').trim().slice(0, max);

/** Select only facts available at the current node. This is intentionally
 * boring and explicit: no full package dump, hidden future nodes, or secrets. */
export function buildAiContext({ packageData = {}, session = {}, input = '', context = {} } = {}) {
  // Node and NPC identity are server-owned session bindings. Context fields
  // supplied by the browser may add harmless display hints, but can never
  // switch the model to a future node or another character.
  const nodeId = session.nodeId || '';
  const npcId = session.npcId || '';
  const node = object(packageData.nodes?.[nodeId]);
  const card = object(packageData.characters?.[npcId]);
  const world = Object.values(object(packageData.worldEntries)).filter((entry) => {
    const item = object(entry);
    const scopes = [...(item.chapterScopes || []), ...(item.characterScopes || []), ...(item.locationScopes || [])];
    const keywords = item.keywords || item.aliases || [];
    return (!scopes.length || scopes.includes(context.chapterId) || scopes.includes(npcId)) && (!keywords.length || keywords.some((keyword) => String(input).includes(keyword)));
  }).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).slice(0, 3).map((entry) => ({ id: entry.id, content: short(entry.content, 500) }));
  return {
    npc: {
      id: npcId,
      displayName: short(card.displayName || npcId, 80),
      identity: short(card.identity, 160),
      personality: (card.personality || []).slice(0, 8),
      speechStyle: short(card.speechStyle, 240),
      forbiddenBehaviors: (card.forbiddenBehaviors || []).slice(0, 8),
    },
    node: {
      id: nodeId,
      type: short(node.type, 40),
      title: short(node.title, 120),
      tags: (node.tags || []).slice(0, 12),
      ...(node.interactionGoal ? { interactionGoal: short(node.interactionGoal, 240) } : {}),
      ...(Array.isArray(node.allowedTopics) ? { allowedTopics: node.allowedTopics.slice(0, 12).map((item) => short(item, 80)) } : {}),
      ...(Array.isArray(node.blockedTopics) ? { blockedTopics: node.blockedTopics.slice(0, 12).map((item) => short(item, 80)) } : {}),
      ...(node.maxTurns !== undefined ? { maxTurns: Math.max(1, Math.min(8, Number(node.maxTurns) || 1)) } : {}),
    },
    relationshipState: session.effects?.relationships?.[npcId] || context.relationshipState || {},
    memory: { tags: session.effects?.memoryTags || [], softFlags: session.effects?.softFlags || {}, recentSummary: short(context.recentSummary, 500) },
    worldEntries: world,
    recentTurns: (session.history || []).slice(-6).map((turn) => ({ input: short(turn.input, 300), text: short(turn.text, 500), source: turn.source })),
    playerInput: short(input, 600),
  };
}
