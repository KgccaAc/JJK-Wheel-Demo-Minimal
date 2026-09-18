import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export class EventStore {
  constructor(path) { this.path = path; }
  async append(event) {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify({ schema: 'jjk-event-v1', ...event })}\n`, 'utf8');
  }
}
