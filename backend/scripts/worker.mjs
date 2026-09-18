#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const command = process.argv[2] || 'health';
const worker = new URL('../local-worker.mjs', import.meta.url).pathname;
if (command === 'start' || command === 'restart') {
  const child = spawn(process.execPath, [worker], { stdio: 'inherit', env: process.env });
  child.on('exit', code => process.exit(code ?? 0));
} else if (command === 'stop') {
  process.stdout.write('worker stop requested; terminate the managed process via service supervisor\n');
} else if (command === 'health') {
  process.stdout.write(JSON.stringify({ ok: true, service: 'jjk-worker', timestamp: new Date().toISOString() }) + '\n');
} else if (command === 'migrate' || command === 'backup' || command === 'logs') {
  process.stdout.write(`${command} is delegated to the deployment supervisor\n`);
} else {
  process.stderr.write(`unknown worker command: ${command}\n`); process.exit(2);
}
