import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [sourceRoot, leftCharacterId, rightCharacterId, seed, ...options] = process.argv.slice(2);

if (!sourceRoot || !leftCharacterId || !rightCharacterId || !seed) {
	throw new Error("Usage: node tools/export_source_duel_fixture.mjs <thenewproject path> <left character id> <right character id> <seed>");
}

const runtimeRoot = await readFile(path.join(sourceRoot, "serve", "jjk-v267", "server", "duel-simulation-engine.js"), "utf8")
	.then(() => path.join(sourceRoot, "serve", "jjk-v267"))
	.catch(() => sourceRoot);
const charactersPath = path.join(runtimeRoot, "public", "formal", "data", "battle", "characters.json");
const charactersDocument = JSON.parse(await readFile(charactersPath, "utf8"));
const characters = Array.isArray(charactersDocument.characters) ? charactersDocument.characters : [];

function profileFor(characterId, side) {
	const profile = characters.find((entry) => String(entry?.id || "") === characterId);
	if (!profile) throw new Error(`Source character profile is unavailable: ${characterId}`);
	return {
		side,
		characterId,
		name: String(profile.name || characterId),
		hp: 500,
		maxHp: 500,
		ce: 300,
		maxCe: 300,
		stability: 0.72,
		characterCardProfile: profile,
		duelProfileSnapshot: profile
	};
}

const sourceEngineUrl = pathToFileURL(path.join(runtimeRoot, "server", "duel-simulation-engine.js")).href;
const sourceEngine = await import(sourceEngineUrl);
const prepared = sourceEngine.prepareAuthoritativeTurnState({
	roomId: "godot-baseline-gojo-vs-sukuna",
	turn: 1,
	seed,
	resourceState: {
		p1: profileFor(leftCharacterId, "left"),
		p2: profileFor(rightCharacterId, "right")
	}
});

if (!prepared?.ok) throw new Error(String(prepared?.error || "Source authoritative hand preparation failed"));

const resolveFlagIndex = options.indexOf("--resolve-left");
const resolvedLeftActionId = resolveFlagIndex >= 0 ? String(options[resolveFlagIndex + 1] || "") : "";

function handCards(state, side) {
	return Array.isArray(state?.[side]?.cards) ? state[side].cards : [];
}

function canonicalHandCard(card) {
	const action = card?.action && typeof card.action === "object" ? card.action : card;
	return {
		instance_id: String(card?.cardInstanceId || ""),
		action_id: String(card?.actionId || action?.actionId || action?.id || ""),
		name: String(card?.label || action?.name || action?.label || ""),
		ap_cost: Number(card?.apCost ?? action?.cost?.ap ?? 0),
		ce_cost: Number(card?.ceCost ?? action?.cost?.ce ?? 0),
		type: String(card?.cardType || action?.cardType || action?.type || ""),
		drawn_round: Number(card?.drawnRound || 0),
		hand_source: String(card?.handSource || "")
	};
}

function canonicalHand(state, side) {
	return handCards(state, side).map(canonicalHandCard);
}

const fixtureState = {
	ruleset_version: "godot-battle-rules-v1",
	seed,
	round: 1,
	left: {
		character_id: leftCharacterId,
		hp: prepared.resourceState?.p1?.hp,
		max_hp: prepared.resourceState?.p1?.maxHp,
		ce: prepared.resourceState?.p1?.ce,
		max_ce: prepared.resourceState?.p1?.maxCe,
		normal_hand_capacity: Number(prepared.authoritativeHandState?.left?.maxHandSize || 8),
		domain_hand_capacity: Number(prepared.authoritativeDomainHandState?.left?.maxHandSize || 3),
		normal_hand: canonicalHand(prepared.authoritativeHandState, "left"),
		domain_hand: canonicalHand(prepared.authoritativeDomainHandState, "left")
	},
	right: {
		character_id: rightCharacterId,
		hp: prepared.resourceState?.p2?.hp,
		max_hp: prepared.resourceState?.p2?.maxHp,
		ce: prepared.resourceState?.p2?.ce,
		max_ce: prepared.resourceState?.p2?.maxCe,
		normal_hand_capacity: Number(prepared.authoritativeHandState?.right?.maxHandSize || 8),
		domain_hand_capacity: Number(prepared.authoritativeDomainHandState?.right?.maxHandSize || 3),
		normal_hand: canonicalHand(prepared.authoritativeHandState, "right"),
		domain_hand: canonicalHand(prepared.authoritativeDomainHandState, "right")
	},
	events: []
};

if (resolvedLeftActionId) {
	const selected = handCards(prepared.authoritativeHandState, "left").find((card) =>
		String(card?.actionId || card?.action?.id || card?.id || "") === resolvedLeftActionId
	);
	if (!selected) throw new Error(`Source opening hand does not contain requested action: ${resolvedLeftActionId}`);
	const lockedAction = {
		actionId: resolvedLeftActionId,
		cardInstanceId: String(selected.cardInstanceId || ""),
		action: selected.action || selected
	};
	const resolved = sourceEngine.resolveDuelTurnWithRuntime({
		roomId: "godot-baseline-gojo-vs-sukuna",
		turn: 1,
		seed,
		resourceState: prepared.resourceState,
		authoritativeHandState: prepared.authoritativeHandState,
		authoritativeDomainHandState: prepared.authoritativeDomainHandState,
		actions: { left: [lockedAction], right: [] }
	});
	if (!resolved?.ok) throw new Error(String(resolved?.error || "Source authoritative turn resolution failed"));
	const resourceState = resolved.resourceState || {};
	const events = Array.isArray(resolved.result?.runtimeResults?.left) ? resolved.result.runtimeResults.left : [];
	process.stdout.write(`${JSON.stringify({
		schema: "godot-source-duel-turn-fixture-v1",
		ruleset_version: "godot-battle-rules-v1",
		seed,
		round: 1,
		input: { left: [canonicalHandCard(selected)], right: [] },
		after: {
			round: Number(resourceState.round || 1),
			left: { hp: Number(resourceState.p1?.hp || 0), ce: Number(resourceState.p1?.ce || 0), statuses: resourceState.p1?.statusEffects || [] },
			right: { hp: Number(resourceState.p2?.hp || 0), ce: Number(resourceState.p2?.ce || 0), statuses: resourceState.p2?.statusEffects || [] }
		},
		events,
		state_hash: String(resolved.result?.stateHash || sourceEngine.hashCanonicalState(resourceState))
	})}\n`);
	process.exit(0);
}

process.stdout.write(`${JSON.stringify({
	schema: "godot-source-duel-fixture-v1",
	source: "serve/jjk-v267/server/duel-simulation-engine.js",
	...fixtureState,
	state_hash: sourceEngine.hashCanonicalState(fixtureState)
})}\n`);

