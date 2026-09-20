import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { StoryRuntime } from '../web-runtime/story-runtime.mjs';

const cwd = resolve(process.cwd());
const root = cwd.endsWith('backend') ? resolve(cwd, '..') : cwd;
const pkg = JSON.parse(await readFile(resolve(root, 'data/story/story-package.json'), 'utf8'));
const runtime = new StoryRuntime(pkg);
let events = runtime.start();
assert.equal(events[0].type, 'node_entered');
assert.ok(events.some((event) => event.type === 'show_choices'));
const choices = runtime.choicesFor();
assert.ok(choices.length >= 2 && choices.every((choice) => choice.enabled));
events = runtime.choose(choices[1].id);
assert.equal(runtime.state.currentNodeId, 'chapter1_selection');
assert.ok(events.some((event) => event.type === 'show_choices'));
const action = runtime.choicesFor()[0];
events = runtime.choose(action.id);
assert.ok(events.some((event) => event.type === 'runtime_error' && event.code === 'time_slot_required'));
assert.equal(runtime.state.currentNodeId, 'chapter1_selection');
runtime.setTimeSlot('早上');
events = runtime.choose(action.id);
assert.equal(runtime.state.currentNodeId, 'chapter1_map');
assert.ok(runtime.snapshot().revision > 0);
// Selection actions must resolve the selected time-slot outcome, not discard
// the authored resource/growth/text payload.
const selectionRuntime = new StoryRuntime(pkg, {
  currentNodeId: 'chapter1_selection',
  resources: { xp: 0, stability: 0 },
  growth: {},
  flags: {},
});
selectionRuntime.start();
selectionRuntime.state.timeSlot = '晚上';
const selectionEvents = selectionRuntime.choose('观察');
assert.equal(selectionRuntime.state.currentNodeId, 'chapter1_map');
assert.equal(selectionRuntime.state.resources.xp, 8);
assert.equal(selectionRuntime.state.resources.stability, -2);
assert.equal(selectionRuntime.state.growth['悟性'], 1);
assert.equal(selectionEvents.find((event) => event.type === 'show_dialogue')?.text, '路灯依次亮起，黑影却避开灯光聚向河岸。你找到了异常最浓的位置。');

const lineRuntime = new StoryRuntime(pkg, { currentNodeId: 'chapter1_clue' });
const lineEvents = lineRuntime.start();
assert.equal(lineEvents.find((event) => event.type === 'show_dialogue')?.lines?.length, 4);
assert.match(lineEvents.find((event) => event.type === 'show_dialogue')?.text || '', /夜色压在仙台郊外/);

const randomSnapshot = { currentNodeId: 'chapter1_optional_event', randomSeed: 'acceptance-seed', resources: {}, growth: {}, flags: {}, inventory: {}, npcFlags: {} };
const randomA = new StoryRuntime(pkg, randomSnapshot);
randomA.start();
const randomEventsA = randomA.choose('roll');
const resolvedA = randomEventsA.find((event) => event.type === 'condition_resolved');
assert.ok(resolvedA?.outcomeId, 'weighted condition must select an authored outcome');
assert.ok(Number(randomA.state.resources.xp) > 0, 'selected outcome must apply resources');
assert.equal(randomA.state.currentNodeId, 'chapter1_branch');
const randomB = new StoryRuntime(pkg, randomSnapshot);
randomB.start();
const resolvedB = randomB.choose('roll').find((event) => event.type === 'condition_resolved');
assert.equal(resolvedB.outcomeId, resolvedA.outcomeId, 'same save seed and state must reproduce the same outcome');
const battleRuntime = new StoryRuntime(pkg, { currentNodeId: 'chapter1_battle', resources: { hp: 20 } });
assert.ok(battleRuntime.start().some((event) => event.type === 'start_battle'));
const battleEvents = battleRuntime.battleResolved('victory', { turns: 3 });
assert.equal(battleRuntime.state.currentNodeId, 'chapter1_end');
assert.equal(battleRuntime.state.resources.xp, 16);
assert.ok(battleEvents.some((event) => event.type === 'battle_resolved'));
console.log(`WEB_STORY_RUNTIME PASS node=${runtime.state.currentNodeId} history=${runtime.state.history.length}`);
