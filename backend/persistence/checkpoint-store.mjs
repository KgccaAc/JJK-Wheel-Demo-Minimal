import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class CheckpointStore {
  constructor(path) { this.path = path; }
  async save(snapshot) {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    await writeFile(temp, JSON.stringify({ schema: 'jjk-checkpoint-v1', savedAt: new Date().toISOString(), snapshot }), 'utf8');
    await rename(temp, this.path);
    return this.path;
  }
  async load() {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8'));
      return value?.schema === 'jjk-checkpoint-v1' ? value.snapshot : null;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
}
