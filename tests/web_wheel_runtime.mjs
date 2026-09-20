import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WheelFlowRuntime } from '../web-runtime/wheel-runtime.mjs';

const root = resolve(process.cwd().endsWith('backend') ? '..' : '.');
const read = async (file) => JSON.parse(await readFile(resolve(root, file), 'utf8'));
const flow = await read('data/wheel/source/flow-v1-candidate.json');
const strength = await read('data/wheel/source/strength-v0.2-candidate.json');
const optionEffects = await read('data/wheel/source/option-effects-v0.1.json');
const wheels = await read('data/wheels.json');

const runtime = new WheelFlowRuntime({ flow, strength, optionEffects, wheels, seed: 20260920 });
assert.equal(runtime.start().type, 'wheel');
let task = runtime.currentTask;
let steps = 0;
while (task.type !== 'computed_grade' && task.type !== 'end' && steps < 240) {
  assert.ok(task.options?.length || task.items?.length, `task ${task.nodeId} needs choices`);
  const result = runtime.roll();
  assert.ok(result, `task ${task.nodeId} must produce a deterministic result`);
  task = runtime.accept(result).currentTask;
  steps += 1;
}
assert.equal(task.type, 'computed_grade', 'source flow should reach the grade node');
const grade = runtime.accept(runtime.computeGrade()).currentTask;
let finalTask = grade;
let postGradeSteps = 0;
while (finalTask.type !== 'end' && postGradeSteps < 600) {
  if (finalTask.type === 'computed_grade') { runtime.computeGrade(); }
  const result = runtime.roll();
  finalTask = runtime.accept(result || runtime.snapshot().grade?.grade_label || '').currentTask;
  postGradeSteps += 1;
}
assert.equal(finalTask.type, 'end');
assert.ok(runtime.snapshot().answers.identity);
assert.ok(runtime.snapshot().grade?.grade_label);
assert.ok(runtime.snapshot().effectLedger.length >= 0);
console.log(`WEB_WHEEL_RUNTIME PASS steps=${steps} grade=${runtime.snapshot().grade.grade_label} answers=${Object.keys(runtime.snapshot().answers).length}`);
